import { isValidProjectName } from '../../../core/projects/validation.js';

export const validateProjectNameParam = (projectName) =>
  !isValidProjectName(projectName) ? 'Invalid project name' : null;
