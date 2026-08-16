import {
  isValidProjectName,
  validateBuildConfig,
} from '../../../../core/projects/validation.js';
import { validateProjectNameParam } from '../projectName.js';

export { validateProjectNameParam };

export const validateCreateProjectRequest = (body) =>
  !isValidProjectName(body?.name) ? 'Invalid project name' : null;

export const validateProjectBuildConfigRequest = (body) =>
  validateBuildConfig(body?.build_config);
