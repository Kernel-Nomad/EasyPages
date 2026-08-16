import { mapListDeploymentsResult, mapTriggeredDeployment } from './mappers.js';
import { uploadProjectBundle as processUploadProjectBundle } from './upload.js';

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const MAX_DEPLOYMENT_CANDIDATE_PAGES = 50;

const projectPath = (projectName) => `/pages/projects/${encodeURIComponent(projectName)}`;

export const createDeploymentsService = ({ cloudflare, uploadLimits, sleepFn = sleep }) => ({
  async deleteDeployments({ deploymentIds, projectName }) {
    const encodedProject = projectPath(projectName);
    const projectResponse = await cloudflare.get(encodedProject);
    const productionId = projectResponse.data.result.canonical_deployment?.id;
    const results = { success: 0, failed: 0, skipped: 0 };

    for (const id of deploymentIds) {
      if (id === productionId) {
        console.log(`Skipping production deployment (active): ${id}`);
        results.skipped += 1;
        continue;
      }

      try {
        await cloudflare.delete(
          `${encodedProject}/deployments/${encodeURIComponent(id)}?force=true`,
        );
        results.success += 1;
        await sleepFn(100);
      } catch (error) {
        console.error(`Error deleting ${id}:`, error.message);
        results.failed += 1;
      }
    }

    return results;
  },

  async getDeleteCandidates({ projectName }) {
    const encodedProject = projectPath(projectName);
    const projectResponse = await cloudflare.get(encodedProject);
    const productionId = projectResponse.data.result.canonical_deployment?.id;

    let page = 1;
    let allIds = [];
    let keepFetching = true;
    let truncated = false;
    let fetchError = false;

    while (keepFetching) {
      try {
        const deploymentResponse = await cloudflare.get(
          `${encodedProject}/deployments?per_page=25&page=${page}`,
        );
        const deployments = Array.isArray(deploymentResponse.data.result)
          ? deploymentResponse.data.result
          : [];

        if (deployments.length === 0) {
          keepFetching = false;
        } else {
          const ids = deployments.map((deployment) => deployment.id);
          allIds = [...allIds, ...ids];
          page += 1;

          if (page > MAX_DEPLOYMENT_CANDIDATE_PAGES) {
            truncated = deployments.length === 25;
            keepFetching = false;
          }
        }
      } catch (error) {
        console.error(`Error fetching page ${page}`, error.message);
        fetchError = true;
        keepFetching = false;
      }
    }

    const idsToDelete = allIds.filter((id) => id !== productionId);
    return {
      count: idsToDelete.length,
      fetchError,
      ids: idsToDelete,
      truncated,
    };
  },

  async listDeployments({ projectName, page = 1 }) {
    const perPage = 25;
    const encodedProject = projectPath(projectName);
    const [projectResponse, deploymentsResponse] = await Promise.all([
      cloudflare.get(encodedProject),
      cloudflare.get(
        `${encodedProject}/deployments?per_page=${perPage}&page=${page}&sort_by=created_on&sort_order=desc`,
      ),
    ]);

    const deployments = Array.isArray(deploymentsResponse.data.result)
      ? deploymentsResponse.data.result
      : [];
    const totalCount = deploymentsResponse.data.result_info?.total_count;
    const hasMore = typeof totalCount === 'number'
      ? page * perPage < totalCount
      : deployments.length === perPage;

    return mapListDeploymentsResult({
      deployments,
      hasMore,
      page,
      productionDeploymentId: projectResponse.data.result.canonical_deployment?.id ?? null,
    });
  },

  async triggerDeployment({ projectName }) {
    const response = await cloudflare.post(
      `${projectPath(projectName)}/deployments`,
      {},
    );
    return mapTriggeredDeployment(response.data.result);
  },

  async uploadProjectBundle({ filePath, projectName }) {
    return processUploadProjectBundle({
      cloudflare,
      filePath,
      projectName,
      uploadLimits,
    });
  },
});
