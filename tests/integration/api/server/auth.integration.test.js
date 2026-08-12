import assert from 'node:assert/strict';
import fs from 'node:fs';
import { after, afterEach, test } from 'node:test';
import { createClient, prepareEnv, startApp } from '../../helpers/appHarness.js';

const env = prepareEnv();

/** Each test gets a pristine instance: setup is a one-shot operation by design. */
const withFreshApp = async (fn) => {
  fs.rmSync(env.credentialsPath, { force: true });
  const app = await startApp();
  try {
    return await fn({ app, client: createClient(app.baseUrl) });
  } finally {
    await app.close();
  }
};

afterEach(() => {
  fs.rmSync(env.credentialsPath, { force: true });
});

after(() => env.restore());

test('/api/auth/status answers 200 in all three states', () =>
  withFreshApp(async ({ client }) => {
    const anonymous = await client.status();
    assert.equal(anonymous.response.status, 200);
    assert.deepEqual(
      { authenticated: anonymous.body.authenticated, setup_complete: anonymous.body.setup_complete, username: anonymous.body.username },
      { authenticated: false, setup_complete: false, username: null },
    );
    assert.equal(anonymous.response.headers.get('cache-control'), 'no-store');

    await client.completeSetup();

    const authenticated = await client.status();
    assert.equal(authenticated.response.status, 200);
    assert.equal(authenticated.body.setup_complete, true);
    assert.equal(authenticated.body.authenticated, true);
    assert.equal(authenticated.body.username, 'admin');

    await client.request('/api/auth/logout', {
      csrfToken: authenticated.body.csrf_token,
      method: 'POST',
    });

    const loggedOut = await client.status();
    assert.equal(loggedOut.response.status, 200);
    assert.equal(loggedOut.body.setup_complete, true);
    assert.equal(loggedOut.body.authenticated, false);
    // The username is never revealed without a session.
    assert.equal(loggedOut.body.username, null);
  }));

test('/api/auth/status plants the cookie and hands out a usable CSRF token', () =>
  withFreshApp(async ({ client }) => {
    // The CSRF middleware only mints inside req.csrfToken(). Without that explicit call an
    // anonymous visitor gets no cookie and every POST would 403 with no way out.
    const { body, response } = await client.status();

    const setCookie = response.headers.getSetCookie?.() ?? [];
    assert.ok(setCookie.some((c) => c.startsWith('easypages_sid=')), 'must emit the session cookie');
    assert.ok(typeof body.csrf_token === 'string' && body.csrf_token.length >= 32);

    const setup = await client.request('/api/auth/setup', {
      csrfToken: body.csrf_token,
      json: { password: 'a-good-password', username: 'admin' },
      method: 'POST',
    });
    assert.equal(setup.status, 201);
  }));

test('before the wizard the API answers 401 setup_required', () =>
  withFreshApp(async ({ app }) => {
    const response = await fetch(`${app.baseUrl}/api/projects`);

    assert.equal(response.status, 401);
    assert.equal((await response.json()).code, 'setup_required');
  }));

test('the wizard opens a session and grants immediate API access', () =>
  withFreshApp(async ({ client }) => {
    const { body, response } = await client.completeSetup();

    assert.equal(response.status, 201);
    assert.equal(body.username, 'admin');
    assert.ok(body.csrf_token);
    assert.equal((await client.request('/api/projects')).status, 200);
  }));

test('re-running the wizard answers 409 without hashing again', () =>
  withFreshApp(async ({ client }) => {
    await client.completeSetup();

    const { body: bootstrap } = await client.status();
    const started = process.hrtime.bigint();
    const response = await client.request('/api/auth/setup', {
      csrfToken: bootstrap.csrf_token,
      json: { password: 'another-password', username: 'intruder' },
      method: 'POST',
    });
    const elapsedMs = Number(process.hrtime.bigint() - started) / 1e6;

    assert.equal(response.status, 409);
    assert.equal((await response.json()).code, 'setup_already_completed');
    // Checked before hashing: otherwise this stays a 16 MiB, ~200 ms amplifier long after
    // the install is done.
    assert.ok(elapsedMs < 40, `answered in ${elapsedMs}ms, it looks like it derived the hash`);
  }));

test('the validation error does not echo the submitted password', () =>
  withFreshApp(async ({ client }) => {
    const { body: bootstrap } = await client.status();
    const password = 'short';

    const response = await client.request('/api/auth/setup', {
      csrfToken: bootstrap.csrf_token,
      json: { password, username: 'admin' },
      method: 'POST',
    });
    const raw = await response.text();

    assert.equal(response.status, 422);
    assert.equal(JSON.parse(raw).code, 'validation_error');
    // Asserted on the raw body: echoing it would leave the password in any proxy's logs.
    assert.ok(!raw.includes(password), `the body echoes the password: ${raw}`);
    assert.ok(!raw.includes('input'));
  }));

test('a wrong password and an unknown user return identical bodies', () =>
  withFreshApp(async ({ client }) => {
    await client.completeSetup();
    const { body: bootstrap } = await client.status();

    const wrongPassword = await client.request('/api/auth/login', {
      csrfToken: bootstrap.csrf_token,
      json: { password: 'wrong', username: 'admin' },
      method: 'POST',
    });
    const wrongPasswordBody = await wrongPassword.text();

    const { body: bootstrap2 } = await client.status();
    const unknownUser = await client.request('/api/auth/login', {
      csrfToken: bootstrap2.csrf_token,
      json: { password: 'wrong', username: 'nobody' },
      method: 'POST',
    });
    const unknownUserBody = await unknownUser.text();

    assert.equal(wrongPassword.status, 401);
    assert.equal(unknownUser.status, 401);
    assert.equal(wrongPasswordBody, unknownUserBody);
    assert.equal(JSON.parse(wrongPasswordBody).code, 'invalid_credentials');
  }));

test('login before the wizard answers 409 setup_required', () =>
  withFreshApp(async ({ client }) => {
    const { body: bootstrap } = await client.status();

    const response = await client.request('/api/auth/login', {
      csrfToken: bootstrap.csrf_token,
      json: { password: 'a-good-password', username: 'admin' },
      method: 'POST',
    });

    assert.equal(response.status, 409);
    assert.equal((await response.json()).code, 'setup_required');
  }));

test('logout is public and idempotent', () =>
  withFreshApp(async ({ client }) => {
    // With no session at all: closing an expired one must not 401, nor 403 on a CSRF token
    // that expired with it.
    const first = await client.request('/api/auth/logout', { method: 'POST' });
    assert.equal(first.status, 200);

    const { csrfToken } = await client.completeSetup();
    assert.equal((await client.request('/api/projects')).status, 200);

    const second = await client.request('/api/auth/logout', { csrfToken, method: 'POST' });
    assert.equal(second.status, 200);
    assert.equal((await client.request('/api/projects')).status, 401);

    const third = await client.request('/api/auth/logout', { method: 'POST' });
    assert.equal(third.status, 200);
  }));

test('login without a CSRF token is 403; with the one from /status it is 200', () =>
  withFreshApp(async ({ client }) => {
    await client.completeSetup();
    await client.request('/api/auth/logout', {
      csrfToken: (await client.status()).body.csrf_token,
      method: 'POST',
    });

    const { body: bootstrap } = await client.status();

    const withoutToken = await client.request('/api/auth/login', {
      json: { password: 'a-good-password', username: 'admin' },
      method: 'POST',
    });
    assert.equal(withoutToken.status, 403);
    assert.equal((await withoutToken.json()).code, 'csrf_invalid');

    const withToken = await client.request('/api/auth/login', {
      csrfToken: bootstrap.csrf_token,
      json: { password: 'a-good-password', username: 'admin' },
      method: 'POST',
    });
    assert.equal(withToken.status, 200);
  }));

test('changing credentials invalidates sessions on other devices', () =>
  withFreshApp(async ({ app, client }) => {
    await client.completeSetup();

    const other = createClient(app.baseUrl);
    await other.login();
    assert.equal((await other.request('/api/projects')).status, 200);

    const { body: bootstrap } = await client.status();
    const change = await client.request('/api/auth/credentials', {
      csrfToken: bootstrap.csrf_token,
      json: { current_password: 'a-good-password', new_password: 'a-new-password' },
      method: 'POST',
    });
    assert.equal(change.status, 200);

    // Our own session is reissued on the new version...
    assert.equal((await client.request('/api/projects')).status, 200);
    // ...and the other device's stops working.
    const otherAfter = await other.request('/api/projects');
    assert.equal(otherAfter.status, 401);
    assert.equal((await otherAfter.json()).code, 'session_expired');
  }));

test('changing credentials requires the current password', () =>
  withFreshApp(async ({ client }) => {
    await client.completeSetup();
    const { body: bootstrap } = await client.status();

    const response = await client.request('/api/auth/credentials', {
      csrfToken: bootstrap.csrf_token,
      json: { current_password: 'wrong', new_password: 'a-new-password' },
      method: 'POST',
    });

    assert.equal(response.status, 401);
    assert.equal((await response.json()).code, 'invalid_current_password');
    // The session is still alive: a 401 here means "wrong current password", not "session
    // expired", and the client has to tell them apart.
    assert.equal((await client.request('/api/projects')).status, 200);
  }));

test('a session from a wiped and recreated account is rejected', () =>
  withFreshApp(async ({ app, client }) => {
    await client.completeSetup({ username: 'admin' });
    assert.equal((await client.request('/api/projects')).status, 200);

    // The documented password recovery: stop, delete credentials.json, start again.
    await app.close();
    fs.rmSync(env.credentialsPath, { force: true });

    const restarted = await startApp();
    try {
      // token_version restarts at 1, exactly what the old cookie carried: without also
      // comparing the username, that cookie would walk into the new account.
      const nextOwner = createClient(restarted.baseUrl);
      const recreated = await nextOwner.completeSetup({ username: 'other.owner' });
      assert.equal(recreated.response.status, 201);

      const oldSession = createClient(restarted.baseUrl, client.jar);
      const response = await oldSession.request('/api/projects');

      assert.equal(response.status, 401);
      assert.equal((await response.json()).code, 'session_expired');
    } finally {
      await restarted.close();
    }
  }));

test('legacy routes: GET /login redirects to / and POST /logout ends the session', () =>
  withFreshApp(async ({ app, client }) => {
    await client.completeSetup();

    const loginPage = await client.request('/login');
    assert.equal(loginPage.status, 302);
    assert.equal(loginPage.headers.get('location'), '/');

    // The legacy healthcheck fetches /login and follows redirects, so it must end on a 200
    // for an older docker-compose.yml to keep reporting the container healthy.
    const followed = await fetch(`${app.baseUrl}/login`);
    assert.equal(followed.status, 200);

    const logout = await client.request('/logout', { method: 'POST' });
    assert.equal(logout.status, 302);
    assert.equal((await client.request('/api/projects')).status, 401);
  }));

test('GET /api/health is public and does not touch the session', () =>
  withFreshApp(async ({ app }) => {
    const response = await fetch(`${app.baseUrl}/api/health`);

    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { status: 'ok' });
    // At a 30 s interval, minting a cookie here would throw away thousands of sessions a day.
    assert.deepEqual(response.headers.getSetCookie?.() ?? [], []);
  }));
