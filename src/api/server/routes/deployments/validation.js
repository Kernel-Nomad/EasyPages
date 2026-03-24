import { isValidProjectName } from '../../../../core/projects/validation.js';

const MAX_DELETE_DEPLOYMENT_IDS = 500;

const isValidDeploymentId = (value) =>
  typeof value === 'string' && value.trim().length > 0;

export const validateDeploymentDeleteRequest = (body) => {
  if (!Array.isArray(body?.deploymentIds) || body.deploymentIds.length === 0) {
    return 'No se enviaron IDs para borrar';
  }

  if (body.deploymentIds.length > MAX_DELETE_DEPLOYMENT_IDS) {
    return `Se enviaron demasiados IDs para borrar (máximo ${MAX_DELETE_DEPLOYMENT_IDS}).`;
  }

  if (!body.deploymentIds.every(isValidDeploymentId)) {
    return 'Todos los IDs de despliegue deben ser strings no vacíos.';
  }

  return null;
};

export const validateProjectNameParam = (projectName) =>
  !isValidProjectName(projectName) ? 'Nombre de proyecto inválido' : null;
