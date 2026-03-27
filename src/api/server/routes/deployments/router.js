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
  toProjectInput,
  toUploadProjectBundleInput,
} from './mappers.js';
import {
  validateDeploymentDeleteRequest,
  validateProjectNameParam,
} from './validation.js';

const sendValidationError = (res, message) =>
  res.status(400).json({ error: message });

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
          createHttpError(413, 'El archivo ZIP excede el tamaño máximo permitido.'),
          'Error al procesar el archivo subido',
          req,
        );
        return;
      }

      sendErrorResponse(res, error, 'Error al procesar el archivo subido', req);
    });
  };

  router.get('/projects/:projectName/deployments', async (req, res) => {
    try {
      const projectNameError = validateProjectNameParam(req.params.projectName);
      if (projectNameError) {
        return sendValidationError(res, projectNameError);
      }

      const deployments = await deploymentsService.listDeployments(toProjectInput(req));
      res.json(deployments);
    } catch (error) {
      sendErrorResponse(res, error, 'Error al cargar los despliegues', req);
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
      sendErrorResponse(res, error, 'Error al disparar el despliegue', req);
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
      sendErrorResponse(res, error, 'Error obteniendo lista de borrado', req);
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
      sendErrorResponse(res, error, 'Error procesando la eliminación', req);
    }
  });

  router.post('/projects/:projectName/upload', uploadLimiter, handleUpload, async (req, res) => {
    const { projectName } = req.params;

    if (req.file) {
      const normalizedUploadPath = path.resolve(req.file.path);
      if (!isPathInsideDirectory(normalizedUploadPath, uploadsDir)) {
        console.error('ALERTA DE SEGURIDAD: intento de path traversal en upload:', req.file.path);
        cleanupUploadFile(req.file, uploadsDir);
        return res.status(403).json({ error: 'Ruta de archivo inválida.' });
      }
    }

    const projectNameError = validateProjectNameParam(projectName);
    if (projectNameError) {
      cleanupUploadFile(req.file, uploadsDir);
      return sendValidationError(res, projectNameError);
    }

    if (!req.file) {
      return res.status(400).json({ error: 'No se subió ningún archivo' });
    }

    try {
      const result = await deploymentsService.uploadProjectBundle(
        toUploadProjectBundleInput(req),
      );

      cleanupUploadFile(req.file, uploadsDir);
      res.json(result);
    } catch (error) {
      cleanupUploadFile(req.file, uploadsDir);
      sendErrorResponse(res, error, 'Error al procesar el despliegue en Cloudflare', req);
    }
  });

  return router;
};
