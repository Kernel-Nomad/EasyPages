import assert from 'node:assert/strict';
import { test } from 'node:test';
import { toDeleteDeploymentsInput } from '../../../../src/api/server/routes/deployments/mappers.js';

test('toDeleteDeploymentsInput persists the trimmed id that validation already accepts', () => {
  const input = toDeleteDeploymentsInput({
    body: { deploymentIds: ['  abc-1  ', 'xyz'] },
    params: { projectName: 'demo' },
  });

  assert.deepEqual(input.deploymentIds, ['abc-1', 'xyz']);
  assert.equal(input.projectName, 'demo');
});
