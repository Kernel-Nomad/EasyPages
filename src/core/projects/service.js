import {
  mapCloudflareProjectSettings,
  mapCloudflareProjectSummary,
  toCloudflareBuildConfig,
  toCloudflareDeploymentConfigs,
} from './mappers.js';

export const createProjectsService = ({ cloudflare }) => ({
  async createProject({ name }) {
    const response = await cloudflare.post('/pages/projects', {
      name,
      production_branch: 'main',
    });

    return response.data.result;
  },

  async getProjectSettings({ projectName }) {
    const response = await cloudflare.get(`/pages/projects/${projectName}`);
    return mapCloudflareProjectSettings(response.data.result);
  },

  async listProjects() {
    const response = await cloudflare.get('/pages/projects');
    return response.data.result.map(mapCloudflareProjectSummary);
  },

  async updateProjectBuildConfig({ projectName, buildConfig }) {
    const response = await cloudflare.patch(`/pages/projects/${projectName}`, {
      build_config: toCloudflareBuildConfig(buildConfig),
    });

    return response.data.result;
  },

  async updateProjectEnv({ projectName, env }) {
    const currentProjectResponse = await cloudflare.get(`/pages/projects/${projectName}`);
    const deploymentConfigs = toCloudflareDeploymentConfigs({
      env,
      currentDeploymentConfigs: currentProjectResponse.data.result.deployment_configs,
    });

    await cloudflare.patch(`/pages/projects/${projectName}`, {
      deployment_configs: deploymentConfigs,
    });

    return { success: true };
  },
});
