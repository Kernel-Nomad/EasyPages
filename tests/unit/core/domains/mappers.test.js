import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mapCloudflareDomain } from '../../../../src/core/domains/mappers.js';

test('mapCloudflareDomain keeps id, name and status and drops the rest', () => {
  const mapped = mapCloudflareDomain({
    id: 'dom-1',
    name: 'example.com',
    status: 'active',
    verification_data: { http_url: 'https://example.com/.well-known/cf' },
    certificate_authority: 'google',
  });

  assert.deepEqual(mapped, { id: 'dom-1', name: 'example.com', status: 'active' });
});

test('mapCloudflareDomain ignores a non-object payload', () => {
  assert.deepEqual(mapCloudflareDomain(null), {
    id: undefined,
    name: undefined,
    status: undefined,
  });
});
