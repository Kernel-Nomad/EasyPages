import { validateProjectNameParam } from '../projectName.js';

const MAX_DELETE_DEPLOYMENT_IDS = 500;

const isValidDeploymentId = (value) =>
  typeof value === 'string'
  && /^[A-Za-z0-9._-]{1,128}$/.test(value.trim());

export { validateProjectNameParam };

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
