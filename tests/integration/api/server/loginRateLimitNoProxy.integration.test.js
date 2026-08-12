import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { createClient, prepareEnv, startApp } from '../../helpers/appHarness.js';
import { LOGIN_MAX_PER_IP } from '../../../../src/api/server/middleware/loginRateLimit.js';

/**
 * TRUST_PROXY=false, in its own file — and therefore its own process — because
 * src/config/env.js resolves the variable on import.
 *
 * With no trusted proxy, req.ip is the socket peer, the second limiter's `skip` fires and a
 * single bucket is left: the forged header stops being worth anything.
 */
const env = prepareEnv({ TRUST_PROXY: 'false' });

let app;

before(async () => {
  app = await startApp();
  await createClient(app.baseUrl).completeSetup();
});

after(async () => {
  await app.close();
  env.restore();
});

test('without a trusted proxy there is only one bucket', async () => {
  const attempt = async (forwardedFor) => {
    const client = createClient(app.baseUrl);
    const { body } = await client.status();
    return client.request('/api/auth/login', {
      csrfToken: body.csrf_token,
      headers: { 'X-Forwarded-For': forwardedFor },
      json: { password: 'wrong', username: 'admin' },
      method: 'POST',
    });
  };

  for (let i = 0; i < LOGIN_MAX_PER_IP; i += 1) {
    assert.equal((await attempt(`198.51.100.${i}`)).status, 401, `attempt ${i + 1}`);
  }

  assert.equal((await attempt('198.51.100.200')).status, 429);
});
