import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createSessionCsrfProtection } from '../../../../src/api/server/middleware/csrf.js';

test('GET inicializa req.csrfToken y no exige validación', () => {
  const mw = createSessionCsrfProtection();
  const session = {};
  const req = { method: 'GET', session, get: () => '', body: {} };
  let err;
  mw(req, {}, (e) => {
    err = e;
  });
  assert.ifError(err);
  assert.equal(typeof req.csrfToken, 'function');
  const t = req.csrfToken();
  assert.equal(typeof t, 'string');
  assert.equal(t.length > 0, true);
});

test('POST sin token coincide con error EBADCSRFTOKEN', () => {
  const mw = createSessionCsrfProtection();
  const session = { csrfToken: 'known' };
  const req = { method: 'POST', session, get: () => '', body: {} };
  let err;
  mw(req, {}, (e) => {
    err = e;
  });
  assert.ok(err);
  assert.equal(err.code, 'EBADCSRFTOKEN');
  assert.equal(err.status, 403);
});

test('POST con cabecera CSRF-Token válida pasa', () => {
  const mw = createSessionCsrfProtection();
  const session = { csrfToken: 'abc123' };
  const req = {
    method: 'POST',
    session,
    get: (name) => (String(name).toLowerCase() === 'csrf-token' ? 'abc123' : ''),
    body: {},
  };
  let err;
  mw(req, {}, (e) => {
    err = e;
  });
  assert.ifError(err);
});

test('POST con _csrf en body válido pasa', () => {
  const mw = createSessionCsrfProtection();
  const session = { csrfToken: 'bodytok' };
  const req = {
    method: 'POST',
    session,
    get: () => '',
    body: { _csrf: 'bodytok' },
  };
  let err;
  mw(req, {}, (e) => {
    err = e;
  });
  assert.ifError(err);
});

test('POST con token de longitud distinta rechaza (EBADCSRFTOKEN)', () => {
  const mw = createSessionCsrfProtection();
  const session = { csrfToken: 'short' };
  const req = {
    method: 'POST',
    session,
    get: (name) => (String(name).toLowerCase() === 'csrf-token' ? 'much-longer-token-value' : ''),
    body: {},
  };
  let err;
  mw(req, {}, (e) => {
    err = e;
  });
  assert.ok(err);
  assert.equal(err.code, 'EBADCSRFTOKEN');
});
