import assert from 'node:assert/strict';
import { test } from 'node:test';
import bcrypt from 'bcrypt';
import { verifyPassword } from '../../../../src/api/server/routes/auth.js';

test('verifyPassword acepta contraseña contra hash bcrypt válido', async () => {
  const hash = bcrypt.hashSync('secret', 4);
  assert.equal(await verifyPassword('secret', hash), true);
  assert.equal(await verifyPassword('wrong', hash), false);
});

test('verifyPassword acepta texto plano cuando storedAuthPass no es hash bcrypt', async () => {
  assert.equal(await verifyPassword('password123', 'password123'), true);
  assert.equal(await verifyPassword('wrong', 'password123'), false);
});

test('verifyPassword con tipos no string devuelve false', async () => {
  assert.equal(await verifyPassword('', ''), false);
  assert.equal(await verifyPassword('x', null), false);
  assert.equal(await verifyPassword(null, '$2b$04$'), false);
});
