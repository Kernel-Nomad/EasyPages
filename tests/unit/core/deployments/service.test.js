import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createDeploymentsService } from '../../../../src/core/deployments/service.js';

test('listDeployments returns productionDeploymentId from canonical_deployment and hasMore', async () => {
  const cloudflare = {
    get: async (resourcePath) => {
      if (resourcePath === '/pages/projects/demo') {
        return {
          data: {
            result: { canonical_deployment: { id: 'prod-1' } },
          },
        };
      }
      if (resourcePath.includes('/deployments?')) {
        return {
          data: {
            result: [{ id: 'd1' }, { id: 'd2' }],
            result_info: { total_count: 40 },
          },
        };
      }
      throw new Error(`unexpected GET ${resourcePath}`);
    },
  };

  const service = createDeploymentsService({ cloudflare, uploadLimits: {} });
  const result = await service.listDeployments({ projectName: 'demo', page: 1 });

  assert.equal(result.productionDeploymentId, 'prod-1');
  assert.equal(result.page, 1);
  assert.equal(result.hasMore, true);
  assert.equal(result.deployments.length, 2);
});

test('deleteDeployments increments skipped for the production deployment id', async () => {
  const deleted = [];
  const cloudflare = {
    get: async (resourcePath) => {
      assert.equal(resourcePath, '/pages/projects/demo');
      return {
        data: {
          result: { canonical_deployment: { id: 'prod-1' } },
        },
      };
    },
    delete: async (resourcePath) => {
      deleted.push(resourcePath);
      return { data: { success: true } };
    },
  };

  const service = createDeploymentsService({ cloudflare, uploadLimits: {} });
  const result = await service.deleteDeployments({
    deploymentIds: ['prod-1', 'old-1'],
    projectName: 'demo',
  });

  assert.deepEqual(result, { success: 1, failed: 0, skipped: 1 });
  assert.equal(deleted.length, 1);
  assert.match(deleted[0], /\/deployments\/old-1\?force=true$/);
});

test('getDeleteCandidates sets truncated when hitting the page limit', async () => {
  const cloudflare = {
    get: async (resourcePath) => {
      if (resourcePath === '/pages/projects/demo') {
        return {
          data: {
            result: { canonical_deployment: { id: 'prod-1' } },
          },
        };
      }

      const pageMatch = resourcePath.match(/[?&]page=(\d+)/);
      const page = Number(pageMatch?.[1] || 0);
      assert.ok(page >= 1 && page <= 50, `unexpected page ${page}`);

      return {
        data: {
          result: Array.from({ length: 25 }, (_, index) => ({
            id: page === 1 && index === 0 ? 'prod-1' : `d-${page}-${index}`,
          })),
        },
      };
    },
  };

  const service = createDeploymentsService({ cloudflare, uploadLimits: {} });
  const result = await service.getDeleteCandidates({ projectName: 'demo' });

  assert.equal(result.truncated, true);
  assert.equal(result.fetchError, false);
  // 50 pages × 25 ids, minus the production deployment filtered out.
  assert.equal(result.count, 50 * 25 - 1);
  assert.equal(result.ids.length, result.count);
  assert.ok(!result.ids.includes('prod-1'));
});
