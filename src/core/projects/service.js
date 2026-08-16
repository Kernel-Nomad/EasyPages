import { listAllPages } from '../cloudflare/client.js';
import {
  mapCloudflareProjectSettings,
  mapCloudflareProjectSummary,
  toCloudflareBuildConfig,
} from './mappers.js';

export const createProjectsService = ({ cloudflare }) => ({
  async createProject({ name }) {
    const response = await cloudflare.post('/pages/projects', {
      name,
      production_branch: 'main',
    });

    return mapCloudflareProjectSummary(response.data.result);
  },

  async getProjectSettings({ projectName }) {
    const response = await cloudflare.get(`/pages/projects/${encodeURIComponent(projectName)}`);
    return mapCloudflareProjectSettings(response.data.result);
  },

  async listProjects() {
    const projects = await listAllPages(cloudflare, '/pages/projects');
    return projects.map(mapCloudflareProjectSummary);
  },

  async updateProjectBuildConfig({ projectName, buildConfig }) {
    const response = await cloudflare.patch(`/pages/projects/${encodeURIComponent(projectName)}`, {
      build_config: toCloudflareBuildConfig(buildConfig),
    });

    return mapCloudflareProjectSummary(response.data.result);
  },
});
