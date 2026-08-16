import { mapCloudflareDeployment } from '../projects/mappers.js';

/**
 * List-deployments response for the SPA: mapped deployments only (no env_vars).
 * @param {{
 *   deployments: unknown[],
 *   hasMore: boolean,
 *   page: number,
 *   productionDeploymentId: string | null,
 * }} input
 */
export const mapListDeploymentsResult = ({
  deployments,
  hasMore,
  page,
  productionDeploymentId,
}) => ({
  deployments: (Array.isArray(deployments) ? deployments : []).map(mapCloudflareDeployment),
  hasMore,
  page,
  productionDeploymentId,
});

/** Trigger / upload responses: same DTO as a list item. */
export const mapTriggeredDeployment = (deployment) => mapCloudflareDeployment(deployment);
