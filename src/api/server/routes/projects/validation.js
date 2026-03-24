import {
  isValidProjectName,
  validateBuildConfig,
  validateEnvPayload,
} from '../../../../core/projects/validation.js';

export const validateCreateProjectRequest = (body) =>
  !isValidProjectName(body?.name) ? 'Nombre de proyecto inválido' : null;

export const validateProjectBuildConfigRequest = (body) =>
  validateBuildConfig(body?.build_config);

export const validateProjectEnvRequest = (body) =>
  validateEnvPayload(body?.env);

export const validateProjectNameParam = (projectName) =>
  !isValidProjectName(projectName) ? 'Nombre de proyecto inválido' : null;
