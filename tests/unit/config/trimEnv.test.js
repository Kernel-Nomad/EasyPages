import assert from 'node:assert/strict';
import { test } from 'node:test';
import { trimEnv } from '../../../src/config/trimEnv.js';

test('trimEnv recorta espacios en token y cuenta', () => {
  assert.strictEqual(trimEnv('  abc  '), 'abc');
  assert.strictEqual(trimEnv('token\n'), 'token');
});

test('trimEnv devuelve undefined para ausente, vacío o solo espacios', () => {
  assert.strictEqual(trimEnv(undefined), undefined);
  assert.strictEqual(trimEnv(''), undefined);
  assert.strictEqual(trimEnv('   \t\n'), undefined);
});
