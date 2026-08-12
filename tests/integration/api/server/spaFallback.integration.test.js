import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { createClient, prepareEnv, startApp } from '../../helpers/appHarness.js';

const env = prepareEnv();

let app;
let client;

before(async () => {
  app = await startApp();
  // The fallback does not depend on the session, but completing the wizard makes sure what
  // is measured is the routing and not a 401.
  client = createClient(app.baseUrl);
  await client.completeSetup();
});

after(async () => {
  await app.close();
  env.restore();
});

const get = (requestPath) => fetch(`${app.baseUrl}${requestPath}`, { redirect: 'manual' });

test('a navigation route receives the SPA shell', async () => {
  const response = await get('/projects');

  assert.equal(response.status, 200);
  assert.match(response.headers.get('content-type') ?? '', /text\/html/);
  // Public and cacheable: a stale index.html points at asset hashes that no longer exist.
  assert.equal(response.headers.get('cache-control'), 'no-cache');
});

test('index.html served by express.static is also no-cache', async () => {
  const response = await get('/index.html');

  assert.equal(response.status, 200);
  assert.equal(response.headers.get('cache-control'), 'no-cache');
});

test('a hashed asset that no longer exists gives a 404, not the shell', async () => {
  const response = await get('/assets/index-deadbeef.js');
  const body = await response.text();

  // With 200 + HTML the browser reports a blank page instead of a missing script.
  assert.equal(response.status, 404);
  assert.ok(!body.includes('<!doctype html'), 'must not return the shell');
});

test('any path with a dot in its last segment gives a 404', async () => {
  for (const requestPath of ['/something.json', '/favicon.png', '/folder/other.txt']) {
    assert.equal((await get(requestPath)).status, 404, `should be 404: ${requestPath}`);
  }
});

test('an unknown API route never returns the shell, with or without a session', async () => {
  // Without a session the auth wall cuts in first; what matters is that it answers JSON.
  for (const method of ['GET', 'POST', 'DELETE', 'PATCH']) {
    const response = await fetch(`${app.baseUrl}/api/does-not-exist`, { method, redirect: 'manual' });

    assert.match(response.headers.get('content-type') ?? '', /application\/json/, `method ${method}`);
    assert.equal(response.status, 401, `method ${method}`);
  }

  // With a session and a valid CSRF token the request actually reaches the 404: this is
  // what proves the SPA fallback does not swallow API 404s with 200 + index.html.
  const { body } = await client.status();
  for (const method of ['GET', 'POST', 'DELETE', 'PATCH']) {
    const response = await client.request('/api/does-not-exist', { csrfToken: body.csrf_token, method });

    assert.equal(response.status, 404, `method ${method}`);
    assert.equal((await response.json()).code, 'not_found', `method ${method}`);
  }
});

test('the CSRF token is checked before routing', async () => {
  // With a session but no token, an unknown route is 403 rather than 404: the order is
  // deliberate, nothing unsafe reaches the router without a token.
  const response = await client.request('/api/does-not-exist', { method: 'DELETE' });

  assert.equal(response.status, 403);
  assert.equal((await response.json()).code, 'csrf_invalid');
});

test('a method other than GET/HEAD never receives the shell', async () => {
  const response = await fetch(`${app.baseUrl}/ruta-inventada`, {
    method: 'POST',
    redirect: 'manual',
  });

  assert.equal(response.status, 404);
  assert.ok(!(await response.text()).includes('<!doctype html'));
});

test('HEAD on a navigation route works (Express routes it to the GET handler)', async () => {
  const response = await fetch(`${app.baseUrl}/projects`, { method: 'HEAD', redirect: 'manual' });

  assert.equal(response.status, 200);
});
