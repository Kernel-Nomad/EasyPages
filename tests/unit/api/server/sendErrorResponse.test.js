import assert from 'node:assert/strict';
import { test } from 'node:test';
import { sendErrorResponse } from '../../../../src/api/server/http.js';

const mockRes = () => {
  const state = { statusCode: null, body: null };
  return {
    state,
    status(code) {
      state.statusCode = code;
      return this;
    },
    json(payload) {
      state.body = payload;
      return this;
    },
  };
};

test('sendErrorResponse masks 5xx messages unless expose is set', () => {
  const res = mockRes();
  sendErrorResponse(
    res,
    Object.assign(new Error('Cloudflare said something sensitive'), { status: 500 }),
    'fallback',
  );
  assert.equal(res.state.statusCode, 500);
  assert.equal(res.state.body.error, 'Internal server error');
  assert.equal(res.state.body.code, undefined);
  assert.equal(res.state.body.details, undefined);
});

test('sendErrorResponse forwards message and code on 5xx when expose is true', () => {
  const res = mockRes();
  sendErrorResponse(
    res,
    Object.assign(new Error('Set CF_ACCOUNT_ID'), {
      status: 500,
      code: 'cf_account_ambiguous',
      expose: true,
    }),
    'fallback',
  );
  assert.equal(res.state.statusCode, 500);
  assert.equal(res.state.body.error, 'Set CF_ACCOUNT_ID');
  assert.equal(res.state.body.code, 'cf_account_ambiguous');
});

test('sendErrorResponse does not forward details on a plain 502', () => {
  const res = mockRes();
  sendErrorResponse(
    res,
    Object.assign(new Error('upstream blew up'), {
      status: 502,
      details: [{ message: 'secret' }],
    }),
    'fallback',
  );
  assert.equal(res.state.statusCode, 502);
  assert.equal(res.state.body.error, 'Internal server error');
  assert.equal(res.state.body.code, undefined);
  assert.equal(res.state.body.details, undefined);
});

test('sendErrorResponse forwards cf_* codes when expose is set', () => {
  const res = mockRes();
  sendErrorResponse(
    res,
    Object.assign(new Error('Invalid API Token'), {
      status: 502,
      code: 'cf_unauthorized',
      expose: true,
      details: [{ message: 'Invalid API Token' }],
    }),
    'fallback',
  );
  assert.equal(res.state.statusCode, 502);
  assert.equal(res.state.body.error, 'Invalid API Token');
  assert.equal(res.state.body.code, 'cf_unauthorized');
  assert.deepEqual(res.state.body.details, [{ message: 'Invalid API Token' }]);
});

test('sendErrorResponse keeps 4xx message, code and details', () => {
  const res = mockRes();
  sendErrorResponse(
    res,
    Object.assign(new Error('bad zip'), {
      status: 400,
      code: 'validation_error',
      details: [{ message: 'ok to show' }],
    }),
    'fallback',
  );
  assert.equal(res.state.statusCode, 400);
  assert.equal(res.state.body.error, 'bad zip');
  assert.equal(res.state.body.code, 'validation_error');
  assert.deepEqual(res.state.body.details, [{ message: 'ok to show' }]);
});
