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

/** Settings the SPA needs — never include production env values (secrets). */
export const mapCloudflareProjectSettings = (project) => ({
  build_config: {
    command: project.build_config?.build_command || '',
    output_dir: project.build_config?.destination_dir || '',
  },
  production_branch: project.production_branch,
});

