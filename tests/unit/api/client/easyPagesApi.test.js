import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';
import {
  addDomain,
  changeCredentials,
  configureEasyPagesApi,
  createProject,
  deleteDomain,
  easyPagesClient,
  EasyPagesApiError,
  fetchAuthStatus,
  isBackendUnreachableError,
  resetEasyPagesApi,
} from '../../../../src/api/client/easyPagesApi.js';

const originalFetch = globalThis.fetch;

const jsonResponse = (body, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });

afterEach(() => {
  globalThis.fetch = originalFetch;
  resetEasyPagesApi();
});

test('fetchAuthStatus calls /api/auth/status', async () => {
  let url;
  globalThis.fetch = (u) => {
    url = u;
    return Promise.resolve(jsonResponse({}));
  };

  await fetchAuthStatus();
  assert.equal(url, '/api/auth/status');
});

test('createProject sends a POST with CSRF-Token and a JSON body', async () => {
  let requestInit;
  globalThis.fetch = (u, init) => {
    requestInit = { url: u, ...init };
    return Promise.resolve(jsonResponse({}));
  };

  await createProject({ csrfToken: 'tok', name: 'my-proj' });

  assert.equal(requestInit.url, '/api/projects');
  assert.equal(requestInit.method, 'POST');
  assert.equal(requestInit.headers['Content-Type'], 'application/json');
  assert.equal(requestInit.headers['CSRF-Token'], 'tok');
  assert.equal(requestInit.body, JSON.stringify({ name: 'my-proj' }));
});

test('deleteDomain encodes the domain segment in the URL', async () => {
  let url;
  globalThis.fetch = (u) => {
    url = u;
    return Promise.resolve(jsonResponse({}));
  };

  await deleteDomain({ projectName: 'p', csrfToken: 't', domainName: 'a/b.com' });
  assert.ok(url.includes(encodeURIComponent('a/b.com')));
});

test('addDomain targets the project domains path', async () => {
  let url;
  globalThis.fetch = (u) => {
    url = u;
    return Promise.resolve(jsonResponse({}));
  };

  await addDomain({ projectName: 'demo', csrfToken: 'x', name: 'x.example.com' });
  assert.equal(url, '/api/projects/demo/domains');
});

test('changeCredentials omits empty fields instead of sending them blank', async () => {
  let body;
  globalThis.fetch = (u, init) => {
    body = JSON.parse(init.body);
    return Promise.resolve(jsonResponse({}));
  };

  await changeCredentials({ csrfToken: 't', currentPassword: 'current', username: 'renamed' });

  // The server reads "absent" as "leave it alone"; an empty new_password would ask for a
  // change to the empty string.
  assert.deepEqual(body, { current_password: 'current', username: 'renamed' });
});

test('tier 1: a 401 on a dashboard call notifies onUnauthorized', async () => {
  let notified = false;
  configureEasyPagesApi({ onUnauthorized: () => { notified = true; } });
  globalThis.fetch = () =>
    Promise.resolve(jsonResponse({ error: 'Session expired.', code: 'session_expired' }, 401));

  await assert.rejects(() => easyPagesClient.fetchProjects(), (error) => {
    assert.ok(error instanceof EasyPagesApiError);
    // The server's code wins over the fallback: that is what the UI maps to i18n.
    assert.equal(error.code, 'session_expired');
    assert.equal(error.status, 401);
    return true;
  });

  assert.equal(notified, true);
});

test('tier 2: a 401 from the login form does NOT notify onUnauthorized', async () => {
  let notified = false;
  configureEasyPagesApi({ onUnauthorized: () => { notified = true; } });
  globalThis.fetch = () =>
    Promise.resolve(jsonResponse({ error: 'Wrong username or password.', code: 'invalid_credentials' }, 401));

  await assert.rejects(
    () => easyPagesClient.login({ csrfToken: 't', password: 'x', username: 'y' }),
    (error) => {
      assert.equal(error.code, 'invalid_credentials');
      return true;
    },
  );

  // Redirecting here would ask the SPA to draw the login screen it is already showing.
  assert.equal(notified, false);
});

test('tier 3: changing credentials only redirects when the session is really gone', async () => {
  let notified = 0;
  configureEasyPagesApi({ onUnauthorized: () => { notified += 1; } });

  globalThis.fetch = () =>
    Promise.resolve(jsonResponse({ error: 'The current password is not correct.', code: 'invalid_current_password' }, 401));
  await assert.rejects(
    () => easyPagesClient.changeCredentials({ csrfToken: 't', currentPassword: 'wrong' }),
    (error) => {
      assert.equal(error.code, 'invalid_current_password');
      return true;
    },
  );
  // Without this the dialog sat there saying "session expired" with no way out.
  assert.equal(notified, 0);

  globalThis.fetch = () =>
    Promise.resolve(jsonResponse({ error: 'Session expired.', code: 'session_expired' }, 401));
  await assert.rejects(
    () => easyPagesClient.changeCredentials({ csrfToken: 't', currentPassword: 'x' }),
    EasyPagesApiError,
  );
  assert.equal(notified, 1);
});

test('a 403 refreshes the CSRF token and retries exactly once', async () => {
  const sentTokens = [];
  let calls = 0;
  configureEasyPagesApi({ onForbidden: () => 'fresh-token' });
  globalThis.fetch = (u, init) => {
    sentTokens.push(init.headers['CSRF-Token']);
    calls += 1;
    return Promise.resolve(
      calls === 1
        ? jsonResponse({ error: 'Invalid CSRF token', code: 'csrf_invalid' }, 403)
        : jsonResponse({ ok: true }),
    );
  };

  await easyPagesClient.createProject({ csrfToken: 'stale', name: 'demo' });

  assert.deepEqual(sentTokens, ['stale', 'fresh-token']);
});

test('the rate-limit error keeps retry_after', async () => {
  globalThis.fetch = () =>
    Promise.resolve(jsonResponse(
      { error: 'Too many attempts.', code: 'rate_limited', retry_after: 42 },
      429,
    ));

  await assert.rejects(
    () => easyPagesClient.login({ csrfToken: 't', password: 'x', username: 'y' }),
    (error) => {
      assert.equal(error.code, 'rate_limited');
      assert.equal(error.retryAfter, 42);
      return true;
    },
  );
});

test('isBackendUnreachableError tells a dead network from an HTTP error', () => {
  assert.equal(isBackendUnreachableError(new TypeError('Failed to fetch')), true);
  assert.equal(isBackendUnreachableError(Object.assign(new Error('x'), { name: 'TimeoutError' })), true);
  assert.equal(isBackendUnreachableError(Object.assign(new Error('x'), { name: 'AbortError' })), true);
  assert.equal(isBackendUnreachableError(new EasyPagesApiError('no', { status: 500 })), false);
  assert.equal(isBackendUnreachableError(null), false);
});
