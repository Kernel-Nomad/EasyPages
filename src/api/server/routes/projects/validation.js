import {
  isValidProjectName,
  validateBuildConfig,
} from '../../../../core/projects/validation.js';

export const validateCreateProjectRequest = (body) =>
  !isValidProjectName(body?.name) ? 'Invalid project name' : null;

export const validateProjectBuildConfigRequest = (body) =>
  validateBuildConfig(body?.build_config);

export const validateProjectNameParam = (projectName) =>
  !isValidProjectName(projectName) ? 'Invalid project name' : null;
