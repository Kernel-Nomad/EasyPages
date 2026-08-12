import assert from 'node:assert/strict';
import { test } from 'node:test';
import { trimEnv } from '../../../src/config/trimEnv.js';

test('trimEnv trims surrounding whitespace', () => {
  assert.strictEqual(trimEnv('  abc  '), 'abc');
  assert.strictEqual(trimEnv('token\n'), 'token');
});

test('trimEnv returns undefined for missing, empty or whitespace-only values', () => {
  assert.strictEqual(trimEnv(undefined), undefined);
  assert.strictEqual(trimEnv(''), undefined);
  assert.strictEqual(trimEnv('   \t\n'), undefined);
});
