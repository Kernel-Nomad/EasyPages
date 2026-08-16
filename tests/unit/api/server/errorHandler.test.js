import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createErrorHandler } from '../../../../src/api/server/middleware/errorHandler.js';

test('errorHandler: a 403 without EBADCSRFTOKEN keeps the error message, not the CSRF copy', () => {
  const handler = createErrorHandler();
  const err = Object.assign(new Error('Forbidden by policy'), { status: 403 });
  const req = { originalUrl: '/api/recurso' };
  const res = {
    headersSent: false,
    statusCode: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      assert.equal(this.statusCode, 403);
      assert.equal(payload.error, 'Forbidden by policy');
    },
  };
  handler(err, req, res, () => {
    assert.fail('must not call next');
  });
});

test('errorHandler: EBADCSRFTOKEN answers as a CSRF failure with csrf_invalid', () => {
  const handler = createErrorHandler();
  const err = Object.assign(new Error('Invalid CSRF token'), {
    code: 'EBADCSRFTOKEN',
    status: 403,
  });
  const req = { originalUrl: '/api/foo' };
  const res = {
    headersSent: false,
    statusCode: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      assert.equal(this.statusCode, 403);
      assert.equal(payload.error, 'Invalid CSRF token');
      assert.equal(payload.code, 'csrf_invalid');
    },
  };
  handler(err, req, res, () => {
    assert.fail('must not call next');
  });
});

test('errorHandler: when headers are already sent it only logs and does not call next', () => {
  const handler = createErrorHandler();
  const err = new Error('too late');
  const req = { originalUrl: '/api/x', method: 'GET' };
  let nextCalls = 0;
  const res = { headersSent: true };
  handler(err, req, res, () => {
    nextCalls += 1;
  });
  assert.equal(nextCalls, 0);
});

test('errorHandler: an ordinary 500 masks both message and code', () => {
  const handler = createErrorHandler();
  const err = Object.assign(new Error('connect ECONNREFUSED 10.0.0.1:5432'), {
    code: 'ECONNREFUSED',
  });
  const req = { originalUrl: '/api/recurso' };
  const res = {
    headersSent: false,
    statusCode: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      assert.equal(this.statusCode, 500);
      assert.equal(payload.error, 'Internal server error');
      // A library code is not a contract with the SPA and could leak internals.
      assert.equal(payload.code, undefined);
    },
  };
  handler(err, req, res, () => assert.fail('must not call next'));
});

test('errorHandler: a 500 flagged with expose lets message and code through', () => {
  const handler = createErrorHandler();
  // The real case: the Cloudflare token sees several accounts. A configuration problem
  // whose message IS the fix; "Internal server error" would tell the operator nothing.
  const err = Object.assign(new Error('Set CF_ACCOUNT_ID in .env.'), {
    code: 'cf_account_ambiguous',
    expose: true,
    status: 500,
  });
  const req = { originalUrl: '/api/projects' };
  const res = {
    headersSent: false,
    statusCode: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      assert.equal(this.statusCode, 500);
      assert.equal(payload.error, 'Set CF_ACCOUNT_ID in .env.');
      assert.equal(payload.code, 'cf_account_ambiguous');
    },
  };
  handler(err, req, res, () => assert.fail('must not call next'));
});
