import { isValidProjectName } from '../../../../core/projects/validation.js';

const MAX_DELETE_DEPLOYMENT_IDS = 500;

const isValidDeploymentId = (value) =>
  typeof value === 'string' && value.trim().length > 0;

export const validateDeploymentDeleteRequest = (body) => {
  if (!Array.isArray(body?.deploymentIds) || body.deploymentIds.length === 0) {
    return 'No deployment IDs were provided.';
  }

  if (body.deploymentIds.length > MAX_DELETE_DEPLOYMENT_IDS) {
    return `Too many deployment IDs to delete (maximum ${MAX_DELETE_DEPLOYMENT_IDS}).`;
  }

  if (!body.deploymentIds.every(isValidDeploymentId)) {
    return 'Every deployment ID must be a non-empty string.';
  }

  return null;
};

export const validateProjectNameParam = (projectName) =>
  !isValidProjectName(projectName) ? 'Invalid project name' : null;
