import { uploadProjectBundle as processUploadProjectBundle } from './upload.js';

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const MAX_DEPLOYMENT_CANDIDATE_PAGES = 50;

export const createDeploymentsService = ({ cloudflare, uploadLimits }) => ({
  async deleteDeployments({ deploymentIds, projectName }) {
    const projectResponse = await cloudflare.get(`/pages/projects/${projectName}`);
    const productionId = projectResponse.data.result.canonical_deployment?.id;
    const results = { success: 0, failed: 0, skipped: 0 };

    for (const id of deploymentIds) {
      if (id === productionId) {
        console.log(`Skipping production deployment (active): ${id}`);
        results.skipped += 1;
        continue;
      }

      try {
        await cloudflare.delete(`/pages/projects/${projectName}/deployments/${id}?force=true`);
        results.success += 1;
        await sleep(100);
      } catch (error) {
        console.error(`Error deleting ${id}:`, error.message);
        results.failed += 1;
      }
    }

    return results;
  },

  async getDeleteCandidates({ projectName }) {
    const projectResponse = await cloudflare.get(`/pages/projects/${projectName}`);
    const productionId = projectResponse.data.result.canonical_deployment?.id;

    let page = 1;
    let allIds = [];
    let keepFetching = true;
    let truncated = false;
    let fetchError = false;

    while (keepFetching) {
      try {
        const deploymentResponse = await cloudflare.get(
          `/pages/projects/${projectName}/deployments?per_page=25&page=${page}`,
        );
        const deployments = deploymentResponse.data.result;

        if (!deployments || deployments.length === 0) {
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
    const [projectResponse, deploymentsResponse] = await Promise.all([
      cloudflare.get(`/pages/projects/${projectName}`),
      cloudflare.get(
        `/pages/projects/${projectName}/deployments?per_page=${perPage}&page=${page}&sort_by=created_on&sort_order=desc`,
      ),
    ]);

    const deployments = deploymentsResponse.data.result || [];
    const totalCount = deploymentsResponse.data.result_info?.total_count;
    const hasMore = typeof totalCount === 'number'
      ? page * perPage < totalCount
      : deployments.length === perPage;

    return {
      deployments,
      hasMore,
      page,
      productionDeploymentId: projectResponse.data.result.canonical_deployment?.id ?? null,
    };
  },

  async triggerDeployment({ projectName }) {
    const response = await cloudflare.post(`/pages/projects/${projectName}/deployments`, {});
    return response.data.result;
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
