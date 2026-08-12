import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createSessionCsrfProtection } from '../../../../src/api/server/middleware/csrf.js';

test('GET initialises req.csrfToken and requires no validation', () => {
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

test('POST without a token fails with EBADCSRFTOKEN', () => {
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

test('POST with a valid CSRF-Token header passes', () => {
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

test('POST with a valid _csrf body field passes', () => {
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

test('POST with a token of a different length is rejected', () => {
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
