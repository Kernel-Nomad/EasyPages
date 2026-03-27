import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createErrorHandler } from '../../../../src/api/server/middleware/errorHandler.js';

test('errorHandler: 403 sin EBADCSRFTOKEN en API devuelve el mensaje del error, no el copy de CSRF', () => {
  const handler = createErrorHandler();
  const err = Object.assign(new Error('Prohibido por política'), { status: 403 });
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
      assert.equal(payload.error, 'Prohibido por política');
    },
  };
  handler(err, req, res, () => {
    assert.fail('no debe llamar a next');
  });
});

test('errorHandler: EBADCSRFTOKEN en API responde como CSRF', () => {
  const handler = createErrorHandler();
  const err = Object.assign(new Error('Token CSRF inválido'), {
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
      assert.equal(payload.error, 'Token CSRF inválido');
    },
  };
  handler(err, req, res, () => {
    assert.fail('no debe llamar a next');
  });
});

test('errorHandler: si headers ya enviados solo registra y no llama a next', () => {
  const handler = createErrorHandler();
  const err = new Error('demasiado tarde');
  const req = { originalUrl: '/api/x', method: 'GET' };
  let nextCalls = 0;
  const res = { headersSent: true };
  handler(err, req, res, () => {
    nextCalls += 1;
  });
  assert.equal(nextCalls, 0);
});
