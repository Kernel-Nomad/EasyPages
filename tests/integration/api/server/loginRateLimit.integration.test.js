import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { createClient, prepareEnv, startApp } from '../../helpers/appHarness.js';
import { LOGIN_MAX_PER_IP, LOGIN_MAX_PER_PEER } from '../../../../src/api/server/middleware/loginRateLimit.js';

// Default TRUST_PROXY (1): req.ip comes from X-Forwarded-For, which is exactly the case
// the second bucket exists for.
const env = prepareEnv();

before(async () => {
  const app = await startApp();
  try {
    await createClient(app.baseUrl).completeSetup();
  } finally {
    await app.close();
  }
});

after(() => env.restore());

/**
 * Each test gets a fresh server and, with it, empty buckets. Limits live in process memory,
 * and the rotation test deliberately fills the peer bucket (127.0.0.1 for everyone), which
 * would leave later tests blocked from their first attempt.
 */
const withFreshApp = async (fn) => {
  const app = await startApp();
  try {
    /** One login attempt from the given reported IP. */
    const attemptLogin = async (forwardedFor, { password = 'wrong', username = 'admin' } = {}) => {
      const client = createClient(app.baseUrl);
      const { body } = await client.status();
      return client.request('/api/auth/login', {
        csrfToken: body.csrf_token,
        headers: forwardedFor ? { 'X-Forwarded-For': forwardedFor } : {},
        json: { password, username },
        method: 'POST',
      });
    };
    return await fn({ app, attemptLogin });
  } finally {
    await app.close();
  }
};

test('a fixed reported IP is blocked with 429 and Retry-After', () =>
  withFreshApp(async ({ attemptLogin }) => {
    const ip = '203.0.113.10';

    for (let i = 0; i < LOGIN_MAX_PER_IP; i += 1) {
      assert.equal((await attemptLogin(ip)).status, 401, `attempt ${i + 1} should still be 401`);
    }

    const blocked = await attemptLogin(ip);
    assert.equal(blocked.status, 429);

    const body = await blocked.json();
    assert.equal(body.code, 'rate_limited');
    assert.ok(body.retry_after > 0);
    assert.equal(blocked.headers.get('retry-after'), String(body.retry_after));
  }));

test('rotating a forged X-Forwarded-For does not grant endless attempts', () =>
  withFreshApp(async ({ attemptLogin }) => {
    // Without the peer bucket every request would get a fresh one and the limit would be
    // decorative: X-Forwarded-For is sent by the client itself.
    let blockedAt = null;

    for (let i = 0; i < LOGIN_MAX_PER_PEER + 5; i += 1) {
      if ((await attemptLogin(`198.51.100.${i % 254}`)).status === 429) {
        blockedAt = i + 1;
        break;
      }
    }

    assert.ok(blockedAt !== null, 'IP rotation should hit the peer bucket');
    assert.ok(
      blockedAt > LOGIN_MAX_PER_IP,
      `the peer bucket must be looser than the IP one; blocked at ${blockedAt}`,
    );
  }));

test('one noisy network does not lock out another', () =>
  withFreshApp(async ({ attemptLogin }) => {
    const noisy = '203.0.113.40';
    for (let i = 0; i < LOGIN_MAX_PER_IP; i += 1) {
      await attemptLogin(noisy);
    }
    assert.equal((await attemptLogin(noisy)).status, 429);

    // An attacker anywhere must not be able to lock the owner out of their own instance:
    // that is why the second bucket is the peer and not a global counter.
    assert.equal((await attemptLogin('203.0.113.41')).status, 401);
  }));

test('a successful login clears the budget for that identity', () =>
  withFreshApp(async ({ attemptLogin }) => {
    const ip = '203.0.113.20';

    for (let i = 0; i < LOGIN_MAX_PER_IP - 1; i += 1) {
      assert.equal((await attemptLogin(ip)).status, 401);
    }

    assert.equal((await attemptLogin(ip, { password: 'a-good-password' })).status, 200);

    // Without resetKey on the success path the next failure would exhaust the bucket.
    assert.equal((await attemptLogin(ip)).status, 401);
  }));

test('a 409 or a 422 does not consume budget', () =>
  withFreshApp(async ({ app }) => {
    const ip = '203.0.113.30';
    const client = createClient(app.baseUrl);

    for (let i = 0; i < LOGIN_MAX_PER_IP + 5; i += 1) {
      const { body } = await client.status();
      const response = await client.request('/api/auth/setup', {
        csrfToken: body.csrf_token,
        headers: { 'X-Forwarded-For': ip },
        json: { password: 'short', username: 'admin' },
        method: 'POST',
      });
      // An operator who mistypes the password 15 times in the wizard must not be locked
      // out of their own fresh install.
      assert.notEqual(response.status, 429, `iteration ${i + 1} should not be limited`);
    }
  }));

// The TRUST_PROXY=false case lives in its own file: src/config/env.js resolves the variable
// on import, so changing it at runtime would have no effect.
