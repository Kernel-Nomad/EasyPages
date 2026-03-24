import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';
import {
  addDomain,
  createProject,
  deleteDomain,
  fetchCsrfToken,
  resetEasyPagesApi,
} from '../../../../src/api/client/easyPagesApi.js';

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
  resetEasyPagesApi();
});

test('fetchCsrfToken requests /api/csrf-token', async () => {
  let url;
  globalThis.fetch = (u) => {
    url = u;
    return Promise.resolve(new Response('{}', { status: 200, headers: { 'content-type': 'application/json' } }));
  };
  await fetchCsrfToken();
  assert.equal(url, '/api/csrf-token');
});

test('createProject sends POST with CSRF-Token and JSON body', async () => {
  let requestInit;
  globalThis.fetch = (u, init) => {
    requestInit = { url: u, ...init };
    return Promise.resolve(new Response('{}', { status: 200, headers: { 'content-type': 'application/json' } }));
  };
  await createProject({ csrfToken: 'tok', name: 'my-proj' });
  assert.equal(requestInit.url, '/api/projects');
  assert.equal(requestInit.method, 'POST');
  assert.equal(requestInit.headers['Content-Type'], 'application/json');
  assert.equal(requestInit.headers['CSRF-Token'], 'tok');
  assert.equal(requestInit.body, JSON.stringify({ name: 'my-proj' }));
});

test('deleteDomain encodes domain segment in URL', async () => {
  let url;
  globalThis.fetch = (u, init) => {
    url = u;
    return Promise.resolve(new Response('{}', { status: 200, headers: { 'content-type': 'application/json' } }));
  };
  await deleteDomain({ projectName: 'p', csrfToken: 't', domainName: 'a/b.com' });
  assert.ok(url.includes(encodeURIComponent('a/b.com')));
});

test('addDomain posts to project domains path', async () => {
  let url;
  globalThis.fetch = (u) => {
    url = u;
    return Promise.resolve(new Response('{}', { status: 200, headers: { 'content-type': 'application/json' } }));
  };
  await addDomain({ projectName: 'demo', csrfToken: 'x', name: 'x.example.com' });
  assert.equal(url, '/api/projects/demo/domains');
});
