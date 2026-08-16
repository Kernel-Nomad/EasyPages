/**
 * DTO mappers for Cloudflare Pages projects.
 *
 * The Pages API does not expose a top-level `deployment.status` or `source.repo`.
 * Status lives on `latest_stage.status`; the git repo on `source.config.{owner,repo_name}`.
 * These mappers are the only place that shape is interpreted, and they never forward
 * `env_vars` / `deployment_configs` (plain-text values can appear there).
 */

const GIT_SOURCE_TYPES = new Set(['github', 'gitlab']);

/** @param {unknown} value */
const asObject = (value) =>
  value && typeof value === 'object' && !Array.isArray(value) ? value : null;

/**
 * Normalize a Cloudflare Pages deployment / latest_deployment into a SPA-safe DTO.
 * @param {unknown} deployment
 * @returns {{ id?: string, status: string, url?: string, created_on?: string, deployment_trigger?: object, message?: string, branch?: string, commit_hash?: string }}
 */
export const mapCloudflareDeployment = (deployment) => {
  const raw = asObject(deployment);
  if (!raw) {
    return { status: 'unknown' };
  }

  const latestStage = asObject(raw.latest_stage);
  const status = typeof latestStage?.status === 'string' && latestStage.status
    ? latestStage.status
    : (typeof raw.status === 'string' && raw.status ? raw.status : 'unknown');

  const trigger = asObject(raw.deployment_trigger);
  const metadata = asObject(trigger?.metadata);

  return {
    id: typeof raw.id === 'string' ? raw.id : undefined,
    status,
    url: typeof raw.url === 'string' ? raw.url : undefined,
    created_on: typeof raw.created_on === 'string' ? raw.created_on : undefined,
    deployment_trigger: trigger
      ? {
        type: trigger.type,
        metadata: metadata
          ? {
            branch: metadata.branch,
            commit_hash: metadata.commit_hash,
            commit_message: metadata.commit_message,
          }
          : undefined,
      }
      : undefined,
    message: typeof raw.message === 'string' ? raw.message : undefined,
    branch: typeof raw.branch === 'string' ? raw.branch : undefined,
    commit_hash: typeof raw.commit_hash === 'string' ? raw.commit_hash : undefined,
  };
};

/**
 * @param {unknown} source
 * @returns {{ type: 'github' | 'gitlab' | 'upload', repo?: string }}
 */
export const mapCloudflareSource = (source) => {
  const raw = asObject(source);
  const type = typeof raw?.type === 'string' ? raw.type.toLowerCase() : '';

  if (GIT_SOURCE_TYPES.has(type)) {
    const config = asObject(raw.config);
    const owner = typeof config?.owner === 'string' ? config.owner : '';
    const repoName = typeof config?.repo_name === 'string'
      ? config.repo_name
      : '';
    // Cloudflare historically used repo_name; some payloads also expose `name`.
    const name = repoName
      || (typeof config?.name === 'string' ? config.name : '')
      || (typeof raw.repo === 'string' ? raw.repo : '');
    const repo = owner && name ? `${owner}/${name}` : (name || undefined);
    return { type, repo };
  }

  return { type: 'upload' };
};

/** True when the project is connected to GitHub or GitLab (not Direct Upload). */
export const isGitConnectedSource = (source) => {
  const type = typeof source?.type === 'string' ? source.type.toLowerCase() : '';
  return GIT_SOURCE_TYPES.has(type);
};

export const mapCloudflareProjectSummary = (project) => {
  const raw = asObject(project) || {};
  return {
    id: raw.id,
    name: raw.name,
    subdomain: raw.subdomain,
    source: mapCloudflareSource(raw.source),
    latest_deployment: mapCloudflareDeployment(raw.latest_deployment),
  };
};

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
export const mapCloudflareProjectSettings = (project) => {
  const raw = asObject(project) || {};
  const buildConfig = asObject(raw.build_config) || {};
  return {
    build_config: {
      command: buildConfig.build_command || '',
      output_dir: buildConfig.destination_dir || '',
    },
    production_branch: raw.production_branch,
  };
};
