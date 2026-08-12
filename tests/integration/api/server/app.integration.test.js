import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { createClient, prepareEnv, startApp } from '../../helpers/appHarness.js';

// Must happen before app.js (and therefore src/config/env.js) is imported.
const env = prepareEnv();

let app;
let client;

before(async () => {
  app = await startApp();
  client = createClient(app.baseUrl);
  await client.completeSetup();
});

after(async () => {
  await app.close();
  env.restore();
});

test('HTTP flow: wizard session, CSRF token and project list against a mocked Cloudflare', async () => {
  const { body: bootstrap } = await client.status();
  assert.equal(bootstrap.setup_complete, true);
  assert.equal(bootstrap.authenticated, true);
  assert.equal(bootstrap.username, 'admin');
  assert.ok(typeof bootstrap.csrf_token === 'string' && bootstrap.csrf_token.length > 0);

  const response = await client.request('/api/projects');
  assert.equal(response.status, 200);

  const projects = await response.json();
  assert.ok(Array.isArray(projects));
  assert.equal(projects.length, 1);
  assert.equal(projects[0].name, 'demo');
});

test('HTTP flow: list, add and delete a domain against a mocked Cloudflare', async () => {
  const { body: bootstrap } = await client.status();
  const { csrf_token: csrfToken } = bootstrap;

  const listRes = await client.request('/api/projects/demo/domains');
  assert.equal(listRes.status, 200);
  const list = await listRes.json();
  assert.equal(list.length, 1);
  assert.equal(list[0].name, 'existing.example.com');

  const addRes = await client.request('/api/projects/demo/domains', {
    csrfToken,
    json: { name: 'new.example.com' },
    method: 'POST',
  });
  assert.equal(addRes.status, 200);
  assert.equal((await addRes.json()).name, 'new.example.com');

  const delRes = await client.request('/api/projects/demo/domains/example.com', {
    csrfToken,
    method: 'DELETE',
  });
  assert.equal(delRes.status, 200);
  assert.equal((await delRes.json()).success, true);
});

test('an unsafe request without a CSRF token is rejected with 403 csrf_invalid', async () => {
  const response = await client.request('/api/projects/demo/domains', {
    json: { name: 'no-token.example.com' },
    method: 'POST',
  });

  assert.equal(response.status, 403);
  assert.equal((await response.json()).code, 'csrf_invalid');
});

test('without a session the bundle is public and the API is not', async () => {
  // Inverted from the previous release: with login inside the SPA, gating the shell would
  // leave an anonymous visitor with nothing to load.
  const shell = await fetch(`${app.baseUrl}/index.html`, { redirect: 'manual' });
  assert.equal(shell.status, 200);

  const api = await fetch(`${app.baseUrl}/api/projects`, { redirect: 'manual' });
  assert.equal(api.status, 401);
  assert.equal((await api.json()).code, 'session_expired');
});
