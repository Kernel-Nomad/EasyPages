import assert from 'node:assert/strict';
import { test } from 'node:test';
import { sanitizeCloudflareErrorDetails } from '../../../../src/core/cloudflare/client.js';

test('sanitizeCloudflareErrorDetails descarta campos arbitrarios y conserva code/message', () => {
  const raw = [
    { code: 1001, message: 'Bad request', extra: { nested: 'leak' } },
    { message: 'Second' },
  ];
  const out = sanitizeCloudflareErrorDetails(raw);
  assert.deepEqual(out, [
    { code: 1001, message: 'Bad request' },
    { message: 'Second' },
  ]);
});

test('sanitizeCloudflareErrorDetails acepta strings en el array y mensaje único string', () => {
  assert.deepEqual(sanitizeCloudflareErrorDetails(['  a  ', '']), [{ message: 'a' }]);
  assert.deepEqual(sanitizeCloudflareErrorDetails('hello'), [{ message: 'hello' }]);
});

test('sanitizeCloudflareErrorDetails omite entradas sin message útil', () => {
  assert.equal(sanitizeCloudflareErrorDetails([{ foo: 1 }, null, 42]), undefined);
  assert.equal(sanitizeCloudflareErrorDetails([]), undefined);
  assert.equal(sanitizeCloudflareErrorDetails('   '), undefined);
  assert.equal(sanitizeCloudflareErrorDetails(undefined), undefined);
});

test('sanitizeCloudflareErrorDetails trunca mensajes largos', () => {
  const long = 'x'.repeat(5000);
  const out = sanitizeCloudflareErrorDetails([{ message: long }]);
  assert.equal(out[0].message.length, 2000);
});

test('sanitizeCloudflareErrorDetails ignora code no numérico', () => {
  const out = sanitizeCloudflareErrorDetails([{ code: 'nope', message: 'ok' }]);
  assert.deepEqual(out, [{ message: 'ok' }]);
});
