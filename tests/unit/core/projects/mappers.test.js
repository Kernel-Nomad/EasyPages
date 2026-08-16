import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  isGitConnectedSource,
  mapCloudflareDeployment,
  mapCloudflareProjectSettings,
  mapCloudflareProjectSummary,
  mapCloudflareSource,
} from '../../../../src/core/projects/mappers.js';
import { mapListDeploymentsResult } from '../../../../src/core/deployments/mappers.js';

test('mapCloudflareDeployment reads latest_stage.status, not a missing top-level status', () => {
  const mapped = mapCloudflareDeployment({
    id: 'd1',
    url: 'https://example.pages.dev',
    created_on: '2026-01-01T00:00:00Z',
    latest_stage: { name: 'deploy', status: 'success' },
    env_vars: { SECRET: { value: 'leak' } },
    deployment_trigger: {
      type: 'github',
      metadata: {
        branch: 'main',
        commit_hash: 'abcdef0123456789',
        commit_message: 'ship it',
      },
    },
  });

  assert.equal(mapped.status, 'success');
  assert.equal(mapped.id, 'd1');
  assert.equal(mapped.deployment_trigger.metadata.commit_message, 'ship it');
  assert.equal(mapped.env_vars, undefined);
});

test('mapCloudflareSource builds owner/repo for github and gitlab', () => {
  assert.deepEqual(
    mapCloudflareSource({ type: 'github', config: { owner: 'acme', repo_name: 'site' } }),
    { type: 'github', repo: 'acme/site' },
  );
  assert.deepEqual(
    mapCloudflareSource({ type: 'gitlab', config: { owner: 'acme', repo_name: 'site' } }),
    { type: 'gitlab', repo: 'acme/site' },
  );
  assert.deepEqual(mapCloudflareSource({}), { type: 'upload' });
  assert.deepEqual(mapCloudflareSource(null), { type: 'upload' });
});

test('isGitConnectedSource treats github and gitlab as git-connected', () => {
  assert.equal(isGitConnectedSource({ type: 'github' }), true);
  assert.equal(isGitConnectedSource({ type: 'gitlab' }), true);
  assert.equal(isGitConnectedSource({ type: 'upload' }), false);
  assert.equal(isGitConnectedSource(undefined), false);
});

test('mapCloudflareProjectSummary never forwards env_vars or deployment_configs', () => {
  const mapped = mapCloudflareProjectSummary({
    id: 'p1',
    name: 'demo',
    subdomain: 'demo.pages.dev',
    source: { type: 'github', config: { owner: 'acme', repo_name: 'demo' } },
    latest_deployment: {
      id: 'd1',
      latest_stage: { status: 'active' },
      env_vars: { X: { value: 'secret' } },
    },
    deployment_configs: {
      production: { env_vars: { TOKEN: { type: 'plain_text', value: 'nope' } } },
    },
    build_config: { build_command: 'npm run build' },
  });

  assert.equal(mapped.source.type, 'github');
  assert.equal(mapped.source.repo, 'acme/demo');
  assert.equal(mapped.latest_deployment.status, 'active');
  assert.equal(mapped.deployment_configs, undefined);
  assert.equal(mapped.build_config, undefined);
  assert.equal(mapped.latest_deployment.env_vars, undefined);
});

test('mapCloudflareProjectSettings only returns build fields', () => {
  const mapped = mapCloudflareProjectSettings({
    build_config: { build_command: 'pnpm build', destination_dir: 'dist' },
    production_branch: 'main',
    deployment_configs: { production: { env_vars: { A: { value: '1' } } } },
  });

  assert.deepEqual(mapped, {
    build_config: { command: 'pnpm build', output_dir: 'dist' },
    production_branch: 'main',
  });
});

test('mapListDeploymentsResult maps each deployment and drops secrets', () => {
  const result = mapListDeploymentsResult({
    deployments: [
      {
        id: 'd1',
        latest_stage: { status: 'canceled' },
        env_vars: { X: { value: 'secret' } },
      },
    ],
    hasMore: false,
    page: 1,
    productionDeploymentId: 'prod',
  });

  assert.equal(result.deployments[0].status, 'canceled');
  assert.equal(result.deployments[0].env_vars, undefined);
  assert.equal(result.productionDeploymentId, 'prod');
});
