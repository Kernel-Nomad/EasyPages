import assert from 'node:assert/strict';
import { test } from 'node:test';
import { isValidAuthPassBcryptFormat } from '../../../src/config/env.js';

test('isValidAuthPassBcryptFormat acepta hash bcrypt estándar', () => {
  assert.equal(
    isValidAuthPassBcryptFormat('$2b$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy'),
    true,
  );
  assert.equal(
    isValidAuthPassBcryptFormat('$2b$04$eqM0W7DbZ3OJyT4u.G0a4.Uw0rcMxcIddUbY2kPIAsMWXa9ddB7IS'),
    true,
  );
});

test('isValidAuthPassBcryptFormat rechaza texto plano y formatos rotos', () => {
  assert.equal(isValidAuthPassBcryptFormat('password123'), false);
  assert.equal(isValidAuthPassBcryptFormat('$2b$10$short'), false);
  assert.equal(isValidAuthPassBcryptFormat(''), false);
  assert.equal(isValidAuthPassBcryptFormat(undefined), false);
  assert.equal(isValidAuthPassBcryptFormat('$2x$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy'), false);
});
