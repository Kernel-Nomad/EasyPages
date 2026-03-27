import assert from 'node:assert/strict';
import { test } from 'node:test';
import { missingRequiredServerEnvKeys } from '../../../src/config/env.js';

test('missingRequiredServerEnvKeys lista AUTH_USER y AUTH_PASS si faltan', () => {
  assert.deepStrictEqual(
    missingRequiredServerEnvKeys({
      cfApiToken: 't',
      cfAccountId: 'a',
      authUser: undefined,
      authPass: undefined,
    }),
    ['AUTH_USER', 'AUTH_PASS'],
  );
});

test('missingRequiredServerEnvKeys: usuario/contraseña vacíos tras trim equivalen a faltar', () => {
  assert.deepStrictEqual(
    missingRequiredServerEnvKeys({
      cfApiToken: 't',
      cfAccountId: 'a',
      authUser: undefined,
      authPass: 'p',
    }),
    ['AUTH_USER'],
  );
});
