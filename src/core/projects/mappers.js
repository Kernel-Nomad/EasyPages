const isPlainObject = (value) =>
  value !== null && typeof value === 'object' && !Array.isArray(value);

export const mapCloudflareProjectSummary = (project) => ({
  id: project.id,
  name: project.name,
  subdomain: project.subdomain,
  source: project.source,
  latest_deployment: project.latest_deployment || { status: 'unknown' },
  build_config: project.build_config,
});

export const toCloudflareBuildConfig = (buildConfig) => {
  const cloudflareBuildConfig = {};

  if (buildConfig.command !== undefined) {
    cloudflareBuildConfig.build_command = buildConfig.command;
  }

  if (buildConfig.output_dir !== undefined) {
    cloudflareBuildConfig.destination_dir = buildConfig.output_dir;
  }

  return cloudflareBuildConfig;
};

const mergeEnvValues = (incomingEnv, currentEnv = {}) => {
  const formattedEnv = Object.create(null);

  for (const [key, value] of Object.entries(incomingEnv)) {
    const currentEntry = isPlainObject(currentEnv[key]) ? currentEnv[key] : {};
    formattedEnv[key] = {
      ...currentEntry,
      value,
    };
  }

  return formattedEnv;
};

export const toCloudflareDeploymentConfigs = ({ env, currentDeploymentConfigs = {} }) => {
  const productionEnv = currentDeploymentConfigs.production?.env || {};
  const previewEnv = currentDeploymentConfigs.preview?.env || {};

  return {
    production: {
      env: mergeEnvValues(env, productionEnv),
    },
    preview: {
      env: previewEnv,
    },
  };
};

export const mapCloudflareProjectSettings = (project) => {
  const envs = project.deployment_configs?.production?.env || {};
  const simpleEnvs = {};

  Object.keys(envs).forEach((key) => {
    simpleEnvs[key] = envs[key].value || '';
  });

  return {
    env: simpleEnvs,
    build_config: {
      command: project.build_config?.build_command || '',
      output_dir: project.build_config?.destination_dir || '',
    },
    production_branch: project.production_branch,
  };
};
