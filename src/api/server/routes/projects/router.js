import express from 'express';
import { createProjectsService } from '../../../../core/projects/service.js';
import { sendErrorResponse } from '../../http.js';
import {
  toCreateProjectInput,
  toProjectInput,
  toUpdateProjectBuildConfigInput,
  toUpdateProjectEnvInput,
} from './mappers.js';
import {
  validateCreateProjectRequest,
  validateProjectBuildConfigRequest,
  validateProjectEnvRequest,
  validateProjectNameParam,
} from './validation.js';

const sendValidationError = (res, message) =>
  res.status(400).json({ error: message });

export const createProjectsRouter = ({ cloudflare, createProjectLimiter }) => {
  const router = express.Router();
  const projectsService = createProjectsService({ cloudflare });

  router.get('/projects', async (req, res) => {
    try {
      const projects = await projectsService.listProjects();
      res.json(projects);
    } catch (error) {
      sendErrorResponse(res, error, 'Error al conectar con Cloudflare', req);
    }
  });

  router.patch('/projects/:projectName', async (req, res) => {
    try {
      const projectNameError = validateProjectNameParam(req.params.projectName);
      if (projectNameError) {
        return sendValidationError(res, projectNameError);
      }

      const buildConfigError = validateProjectBuildConfigRequest(req.body);
      if (buildConfigError) {
        return sendValidationError(res, buildConfigError);
      }

      const project = await projectsService.updateProjectBuildConfig(
        toUpdateProjectBuildConfigInput(req),
      );
      res.json(project);
    } catch (error) {
      sendErrorResponse(res, error, 'Error al actualizar el proyecto', req);
    }
  });

  router.get('/projects/:projectName/env', async (req, res) => {
    try {
      const projectNameError = validateProjectNameParam(req.params.projectName);
      if (projectNameError) {
        return sendValidationError(res, projectNameError);
      }

      const projectSettings = await projectsService.getProjectSettings(toProjectInput(req));
      res.json(projectSettings);
    } catch (error) {
      sendErrorResponse(res, error, 'Error al cargar la configuración del proyecto', req);
    }
  });

  router.put('/projects/:projectName/env', async (req, res) => {
    try {
      const projectNameError = validateProjectNameParam(req.params.projectName);
      if (projectNameError) {
        return sendValidationError(res, projectNameError);
      }

      const envError = validateProjectEnvRequest(req.body);
      if (envError) {
        return sendValidationError(res, envError);
      }

      const result = await projectsService.updateProjectEnv(toUpdateProjectEnvInput(req));
      res.json(result);
    } catch (error) {
      sendErrorResponse(res, error, 'Error al guardar variables de entorno', req);
    }
  });

  router.post('/projects', createProjectLimiter, async (req, res) => {
    try {
      const projectNameError = validateCreateProjectRequest(req.body);
      if (projectNameError) {
        return sendValidationError(res, projectNameError);
      }

      const project = await projectsService.createProject(toCreateProjectInput(req));
      res.json(project);
    } catch (error) {
      sendErrorResponse(res, error, 'Error al crear el proyecto', req);
    }
  });

  return router;
};
