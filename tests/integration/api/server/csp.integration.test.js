import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { prepareEnv, startApp } from '../../helpers/appHarness.js';

const env = prepareEnv();

let app;

before(async () => {
  app = await startApp();
});

after(async () => {
  await app.close();
  env.restore();
});

const directives = async () => {
  const response = await fetch(`${app.baseUrl}/`, { redirect: 'manual' });
  const header = response.headers.get('content-security-policy') ?? '';
  return Object.fromEntries(
    header.split(';').map((part) => part.trim()).filter(Boolean).map((part) => {
      const [name, ...values] = part.split(/\s+/);
      return [name, values];
    }),
  );
};

test('frames may be loaded from ko-fi.com so the support widget can embed', async () => {
  const csp = await directives();

  // default-src governs frames by inheritance, so without an explicit frame-src the
  // browser blocks the Ko-fi iframe outright.
  assert.deepEqual(csp['frame-src'], ["'self'", 'https://ko-fi.com']);
});

test('embedding Ko-fi does not widen any other directive', async () => {
  const csp = await directives();

  // The framed document runs under ko-fi.com's own CSP. Nothing it loads is our concern,
  // so the fetch directives stay closed: widening them is the tempting wrong fix when a
  // future Ko-fi feature breaks.
  assert.deepEqual(csp['default-src'], ["'self'"]);
  assert.deepEqual(csp['script-src'], ["'self'"]);
  assert.deepEqual(csp['connect-src'], ["'self'"]);
  assert.deepEqual(csp['img-src'], ["'self'", 'data:']);
  assert.deepEqual(csp['object-src'], ["'none'"]);
  // Unrelated to embedding Ko-fi: this one keeps EasyPages out of somebody else's frame.
  assert.deepEqual(csp['frame-ancestors'], ["'none'"]);
});
