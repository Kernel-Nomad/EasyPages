import express from 'express';
import { createProjectsService } from '../../../../core/projects/service.js';
import { sendErrorResponse, sendValidationError } from '../../http.js';
import {
  toCreateProjectInput,
  toProjectInput,
  toUpdateProjectBuildConfigInput,
} from './mappers.js';
import {
  validateCreateProjectRequest,
  validateProjectBuildConfigRequest,
  validateProjectNameParam,
} from './validation.js';

export const createProjectsRouter = ({ cloudflare, createProjectLimiter }) => {
  const router = express.Router();
  const projectsService = createProjectsService({ cloudflare });

  router.get('/projects', async (req, res) => {
    try {
      const projects = await projectsService.listProjects();
      res.json(projects);
    } catch (error) {
      sendErrorResponse(res, error, 'Failed to connect to Cloudflare', req);
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
      sendErrorResponse(res, error, 'Failed to update the project', req);
    }
  });

  router.get('/projects/:projectName/settings', async (req, res) => {
    try {
      const projectNameError = validateProjectNameParam(req.params.projectName);
      if (projectNameError) {
        return sendValidationError(res, projectNameError);
      }

      const projectSettings = await projectsService.getProjectSettings(toProjectInput(req));
      res.json(projectSettings);
    } catch (error) {
      sendErrorResponse(res, error, 'Error loading the project configuration', req);
    }
  });

  router.post('/projects', createProjectLimiter, async (req, res) => {
    try {
      const projectNameError = validateCreateProjectRequest(req.body);
      if (projectNameError) {
        return sendValidationError(res, projectNameError);
      }

      const project = await projectsService.createProject(toCreateProjectInput(req));
      res.status(201).json(project);
    } catch (error) {
      sendErrorResponse(res, error, 'Failed to create the project', req);
    }
  });

  return router;
};
