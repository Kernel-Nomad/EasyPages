import express from 'express';
import multer from 'multer';
import path from 'path';
import { createDeploymentsService } from '../../../../core/deployments/service.js';
import { createHttpError, sendErrorResponse } from '../../http.js';
import {
  isPathInsideDirectory,
  safeUnlink,
} from '../../../../utils/files.js';
import {
  toDeleteDeploymentsInput,
  toDeleteDeploymentsResponse,
  toListDeploymentsInput,
  toProjectInput,
  toUploadProjectBundleInput,
} from './mappers.js';
import {
  validateDeploymentDeleteRequest,
  validateProjectNameParam,
} from './validation.js';

const sendValidationError = (res, message) =>
  res.status(400).json({ error: message, code: 'validation_error' });

const cleanupUploadFile = (file, uploadsDir) => {
  if (file) {
    safeUnlink(file.path, uploadsDir);
  }
};

export const createDeploymentsRouter = ({
  cloudflare,
  upload,
  uploadLimiter,
  uploadsDir,
  uploadLimits = {},
}) => {
  const router = express.Router();
  const deploymentsService = createDeploymentsService({
    cloudflare,
    uploadLimits,
  });

  const handleUpload = (req, res, next) => {
    upload.single('file')(req, res, (error) => {
      if (!error) {
        next();
        return;
      }

      if (error instanceof multer.MulterError && error.code === 'LIMIT_FILE_SIZE') {
        sendErrorResponse(
          res,
          createHttpError(413, 'The ZIP file exceeds the maximum allowed size.'),
          'Failed to process the uploaded file',
          req,
        );
        return;
      }

      sendErrorResponse(res, error, 'Failed to process the uploaded file', req);
    });
  };

  router.get('/projects/:projectName/deployments', async (req, res) => {
    try {
      const projectNameError = validateProjectNameParam(req.params.projectName);
      if (projectNameError) {
        return sendValidationError(res, projectNameError);
      }

      const deployments = await deploymentsService.listDeployments(toListDeploymentsInput(req));
      res.json(deployments);
    } catch (error) {
      sendErrorResponse(res, error, 'Failed to load deployments', req);
    }
  });

  router.post('/projects/:projectName/deployments', async (req, res) => {
    try {
      const projectNameError = validateProjectNameParam(req.params.projectName);
      if (projectNameError) {
        return sendValidationError(res, projectNameError);
      }

      const deployment = await deploymentsService.triggerDeployment(toProjectInput(req));
      res.json(deployment);
    } catch (error) {
      sendErrorResponse(res, error, 'Failed to trigger deployment', req);
    }
  });

  router.get('/projects/:projectName/deployments/candidates', async (req, res) => {
    try {
      const projectNameError = validateProjectNameParam(req.params.projectName);
      if (projectNameError) {
        return sendValidationError(res, projectNameError);
      }

      const candidates = await deploymentsService.getDeleteCandidates(toProjectInput(req));
      res.json(candidates);
    } catch (error) {
      sendErrorResponse(res, error, 'Failed to load deletion candidates', req);
    }
  });

  router.delete('/projects/:projectName/deployments', async (req, res) => {
    try {
      const projectNameError = validateProjectNameParam(req.params.projectName);
      if (projectNameError) {
        return sendValidationError(res, projectNameError);
      }

      const deploymentIdsError = validateDeploymentDeleteRequest(req.body);
      if (deploymentIdsError) {
        return sendValidationError(res, deploymentIdsError);
      }

      const result = await deploymentsService.deleteDeployments(
        toDeleteDeploymentsInput(req),
      );
      res.json(toDeleteDeploymentsResponse(result));
    } catch (error) {
      sendErrorResponse(res, error, 'Error processing the deletion', req);
    }
  });

  router.post('/projects/:projectName/upload', uploadLimiter, handleUpload, async (req, res) => {
    const { projectName } = req.params;

    if (req.file) {
      const normalizedUploadPath = path.resolve(req.file.path);
      if (!isPathInsideDirectory(normalizedUploadPath, uploadsDir)) {
        console.error('SECURITY: path traversal attempt in upload:', req.file.path);
        cleanupUploadFile(req.file, uploadsDir);
        return res.status(403).json({ error: 'Invalid file path.' });
      }
    }

    const projectNameError = validateProjectNameParam(projectName);
    if (projectNameError) {
      cleanupUploadFile(req.file, uploadsDir);
      return sendValidationError(res, projectNameError);
    }

    if (!req.file) {
      return res.status(400).json({ error: 'No file was uploaded' });
    }

    try {
      const result = await deploymentsService.uploadProjectBundle(
        toUploadProjectBundleInput(req),
      );

      cleanupUploadFile(req.file, uploadsDir);
      res.json(result);
    } catch (error) {
      cleanupUploadFile(req.file, uploadsDir);
      sendErrorResponse(res, error, 'Failed to process the Cloudflare deployment', req);
    }
  });

  return router;
};
