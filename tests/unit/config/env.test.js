import assert from 'node:assert/strict';
import test from 'node:test';
import { missingRequiredServerEnvKeys } from '../../../src/config/env.js';

test('CF_API_TOKEN is the only required variable', () => {
  assert.deepEqual(missingRequiredServerEnvKeys({ cfApiToken: 'token' }), []);
  assert.deepEqual(missingRequiredServerEnvKeys({ cfApiToken: '' }), ['CF_API_TOKEN']);
  assert.deepEqual(missingRequiredServerEnvKeys({}), ['CF_API_TOKEN']);
});

test('CF_ACCOUNT_ID does not block boot: it is inferred from the token', () => {
  // There used to be four required variables, AUTH_USER and AUTH_PASS among them. The
  // account is now inferred and the credentials come from the wizard, leaving one.
  assert.deepEqual(missingRequiredServerEnvKeys({ cfApiToken: 'token', cfAccountId: undefined }), []);
});
