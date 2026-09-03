import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createAccountIdResolver, sanitizeCloudflareErrorDetails } from '../../../../src/core/cloudflare/client.js';

test('sanitizeCloudflareErrorDetails drops arbitrary fields and keeps code/message', () => {
  const raw = [
    { code: 1001, message: 'Bad request', extra: { nested: 'leak' } },
    { message: 'Second' },
  ];
  const out = sanitizeCloudflareErrorDetails(raw);
  assert.deepEqual(out, [
    { code: 1001, message: 'Bad request' },
    { message: 'Second' },
  ]);
});

test('sanitizeCloudflareErrorDetails accepts strings in the array and a single string', () => {
  assert.deepEqual(sanitizeCloudflareErrorDetails(['  a  ', '']), [{ message: 'a' }]);
  assert.deepEqual(sanitizeCloudflareErrorDetails('hello'), [{ message: 'hello' }]);
});

test('sanitizeCloudflareErrorDetails skips entries without a usable message', () => {
  assert.equal(sanitizeCloudflareErrorDetails([{ foo: 1 }, null, 42]), undefined);
  assert.equal(sanitizeCloudflareErrorDetails([]), undefined);
  assert.equal(sanitizeCloudflareErrorDetails('   '), undefined);
  assert.equal(sanitizeCloudflareErrorDetails(undefined), undefined);
});

test('sanitizeCloudflareErrorDetails truncates long messages', () => {
  const long = 'x'.repeat(5000);
  const out = sanitizeCloudflareErrorDetails([{ message: long }]);
  assert.equal(out[0].message.length, 2000);
});

test('sanitizeCloudflareErrorDetails ignores a non-numeric code', () => {
  const out = sanitizeCloudflareErrorDetails([{ code: 'nope', message: 'ok' }]);
  assert.deepEqual(out, [{ message: 'ok' }]);
});

test('createAccountIdResolver uses CF_ACCOUNT_ID without calling the API', async () => {
  let calls = 0;
  const resolve = createAccountIdResolver({
    explicitAccountId: '  explicit-acc  ',
    listAccounts: async () => {
      calls += 1;
      return [{ id: 'api-acc' }];
    },
    log: () => {},
  });

  assert.equal(await resolve(), 'explicit-acc', 'trimmed, and it wins');
  assert.equal(calls, 0, 'explicit wins: no reason to ask');
});

test('createAccountIdResolver infers the account when the token sees only one', async () => {
  const logged = [];
  const resolve = createAccountIdResolver({
    listAccounts: async () => [{ id: 'only-acc', name: 'My account' }],
    log: (message) => logged.push(message),
  });

  assert.equal(await resolve(), 'only-acc');
  // Which account was picked is logged; otherwise it is silent magic.
  assert.match(logged.join('\n'), /My account.*only-acc/);
});

test('createAccountIdResolver caches the hit and does not look up twice', async () => {
  let calls = 0;
  const resolve = createAccountIdResolver({
    listAccounts: async () => {
      calls += 1;
      return [{ id: 'only-acc' }];
    },
    log: () => {},
  });

  await resolve();
  await resolve();
  await resolve();

  assert.equal(calls, 1);
});

test('createAccountIdResolver collapses concurrent lookups into one', async () => {
  let calls = 0;
  const resolve = createAccountIdResolver({
    listAccounts: async () => {
      calls += 1;
      await new Promise((done) => setTimeout(done, 10));
      return [{ id: 'only-acc' }];
    },
    log: () => {},
  });

  // A cold start can fire several calls at once; they must not become several lookups.
  const results = await Promise.all([resolve(), resolve(), resolve()]);

  assert.deepEqual(results, ['only-acc', 'only-acc', 'only-acc']);
  assert.equal(calls, 1);
});

test('createAccountIdResolver asks for CF_ACCOUNT_ID when the token sees several accounts', async () => {
  const logged = [];
  const resolve = createAccountIdResolver({
    listAccounts: async () => [
      { id: 'acc-1', name: 'Personal' },
      { id: 'acc-2', name: 'Work' },
    ],
    log: (message) => logged.push(message),
  });

  await assert.rejects(resolve, (error) => {
    assert.equal(error.code, 'cf_account_ambiguous');
    assert.equal(error.status, 500);
    // `expose` is what lets message and code through on a 5xx: here the message IS the
    // remediation, and "Internal server error" would say nothing.
    assert.equal(error.expose, true);
    assert.match(error.message, /CF_ACCOUNT_ID/);
    return true;
  });

  // The IDs go to the log, not the HTTP response: the operator has to choose.
  assert.match(logged.join('\n'), /Personal \(acc-1\).*Work \(acc-2\)/);
});

test('createAccountIdResolver reports a token that sees no account at all', async () => {
  const resolve = createAccountIdResolver({ listAccounts: async () => [], log: () => {} });

  await assert.rejects(resolve, (error) => {
    assert.equal(error.code, 'cf_account_not_found');
    assert.match(error.message, /Cloudflare Pages/);
    return true;
  });
});

test('normalizeCloudflareError maps 401/403/429 away from session statuses', async () => {
  const { normalizeCloudflareError } = await import('../../../../src/core/cloudflare/client.js');

  const unauthorized = normalizeCloudflareError(
    { response: { status: 401, data: { errors: [{ message: 'Invalid token' }] } } },
    'fallback',
  );
  assert.equal(unauthorized.status, 502);
  assert.equal(unauthorized.code, 'cf_unauthorized');
  assert.equal(unauthorized.expose, true);
  assert.match(unauthorized.message, /Invalid token/);

  const forbidden = normalizeCloudflareError(
    { response: { status: 403, data: { errors: [{ message: 'No access' }] } } },
    'fallback',
  );
  assert.equal(forbidden.status, 502);
  assert.equal(forbidden.code, 'cf_forbidden');
  assert.equal(forbidden.expose, true);

  const rateLimited = normalizeCloudflareError(
    { response: { status: 429, data: { errors: [{ message: 'Slow down' }] } } },
    'fallback',
  );
  assert.equal(rateLimited.status, 503);
  assert.equal(rateLimited.code, 'cf_rate_limited');
  assert.equal(rateLimited.expose, true);

  const upstream = normalizeCloudflareError(
    { response: { status: 500, data: { errors: [{ message: 'Boom' }] } } },
    'fallback',
  );
  assert.equal(upstream.status, 502);
  assert.equal(upstream.code, 'cf_upstream');
  assert.equal(upstream.expose, true);

  const notFound = normalizeCloudflareError(
    { response: { status: 404, data: { errors: [{ message: 'Missing' }] } } },
    'fallback',
  );
  assert.equal(notFound.status, 404);
  assert.equal(notFound.code, undefined);
});

test('normalizeCloudflareError exposes timeouts and connection failures', async () => {
  const { normalizeCloudflareError } = await import('../../../../src/core/cloudflare/client.js');

  const timeout = normalizeCloudflareError({ code: 'ECONNABORTED' }, 'fallback');
  assert.equal(timeout.status, 504);
  assert.equal(timeout.code, 'cf_timeout');
  assert.equal(timeout.expose, true);

  const unreachable = normalizeCloudflareError({ request: {} }, 'fallback');
  assert.equal(unreachable.status, 502);
  assert.equal(unreachable.code, 'cf_unreachable');
  assert.equal(unreachable.expose, true);
});

const pageFromListPath = (path) => {
  const match = /(?:^|&|[?])page=(\d+)/.exec(path);
  return match ? Number.parseInt(match[1], 10) : 1;
};

test('listAllPages walks until a short page when result_info.per_page is present', async () => {
  const { listAllPages } = await import('../../../../src/core/cloudflare/client.js');
  const calls = [];
  const cloudflare = {
    get: async (path) => {
      calls.push(path);
      const page = pageFromListPath(path);
      if (page === 1) {
        return {
          data: {
            result: [{ id: 'a' }, { id: 'b' }],
            result_info: { per_page: 2 },
          },
        };
      }
      if (page === 2) {
        return {
          data: {
            result: [{ id: 'c' }],
            result_info: { per_page: 2 },
          },
        };
      }
      return { data: { result: [] } };
    },
  };

  const all = await listAllPages(cloudflare, '/pages/projects', { perPage: 2 });
  assert.deepEqual(all.map((row) => row.id), ['a', 'b', 'c']);
  assert.equal(calls.length, 2);
});

test('listAllPages keeps walking when Cloudflare clamps per_page below the request', async () => {
  const { listAllPages } = await import('../../../../src/core/cloudflare/client.js');
  const calls = [];
  const cloudflare = {
    get: async (path) => {
      calls.push(path);
      const page = pageFromListPath(path);
      if (page === 1) {
        return {
          data: {
            result: Array.from({ length: 50 }, (_, i) => ({ id: `p${i}` })),
            result_info: { per_page: 50, total_count: 70, page: 1 },
          },
        };
      }
      if (page === 2) {
        return {
          data: {
            result: Array.from({ length: 20 }, (_, i) => ({ id: `p${50 + i}` })),
            result_info: { per_page: 50, total_count: 70, page: 2 },
          },
        };
      }
      return { data: { result: [] } };
    },
  };

  const all = await listAllPages(cloudflare, '/pages/projects', { perPage: 100 });
  assert.equal(all.length, 70);
  assert.equal(calls.length, 2);
});

test('listAllPages walks until an empty page when result_info is missing', async () => {
  const { listAllPages } = await import('../../../../src/core/cloudflare/client.js');
  const calls = [];
  const cloudflare = {
    get: async (path) => {
      calls.push(path);
      const page = pageFromListPath(path);
      if (page === 1) {
        return { data: { result: [{ id: 'a' }, { id: 'b' }] } };
      }
      if (page === 2) {
        return { data: { result: [{ id: 'c' }] } };
      }
      return { data: { result: [] } };
    },
  };

  const all = await listAllPages(cloudflare, '/pages/projects', { perPage: 2 });
  assert.deepEqual(all.map((row) => row.id), ['a', 'b', 'c']);
  assert.equal(calls.length, 3);
});

test('listAllPages treats a non-array result as empty', async () => {
  const { listAllPages } = await import('../../../../src/core/cloudflare/client.js');
  const cloudflare = {
    get: async () => ({ data: { result: null } }),
  };
  assert.deepEqual(await listAllPages(cloudflare, '/pages/projects'), []);
});

test('unwrapCloudflareResponse throws on HTTP 200 with success:false', async () => {
  const { unwrapCloudflareResponse } = await import('../../../../src/core/cloudflare/client.js');

  await assert.throws(
    () => unwrapCloudflareResponse(
      {
        status: 200,
        data: { success: false, result: null, errors: [{ message: 'No good' }] },
      },
      'fallback',
    ),
    (error) => {
      assert.equal(error.status, 400);
      assert.match(error.message, /No good/);
      return true;
    },
  );
});

test('unwrapCloudflareResponse lets a successful envelope through', async () => {
  const { unwrapCloudflareResponse } = await import('../../../../src/core/cloudflare/client.js');
  const response = { status: 200, data: { success: true, result: [] } };
  assert.equal(unwrapCloudflareResponse(response, 'fallback'), response);
});

test('unwrapCloudflareResponse ignores a missing success flag', async () => {
  const { unwrapCloudflareResponse } = await import('../../../../src/core/cloudflare/client.js');
  const response = { status: 200, data: { result: [{ id: 'a' }] } };
  assert.equal(unwrapCloudflareResponse(response, 'fallback'), response);
});

test('collectPagedResults keeps walking when Cloudflare clamps per_page to 20', async () => {
  const { collectPagedResults } = await import('../../../../src/core/cloudflare/client.js');
  const calls = [];
  const all = await collectPagedResults(async (page, perPage) => {
    calls.push({ page, perPage });
    if (page === 1) {
      return {
        data: {
          result: Array.from({ length: 20 }, (_, i) => ({ id: `a${i}` })),
          result_info: { per_page: 20, total_count: 25, total_pages: 2, page: 1 },
        },
      };
    }
    return {
      data: {
        result: Array.from({ length: 5 }, (_, i) => ({ id: `b${i}` })),
        result_info: { per_page: 20, total_count: 25, total_pages: 2, page: 2 },
      },
    };
  }, { perPage: 50 });

  assert.equal(all.length, 25);
  assert.equal(calls.length, 2);
  assert.equal(calls[0].perPage, 50);
});

test('multipart form-data headers win over the JSON Content-Type default', async () => {
  const { AxiosHeaders } = await import('axios');
  const FormData = (await import('form-data')).default;
  const formData = new FormData();
  formData.append('manifest', '{}');
  const merged = {
    Authorization: 'Bearer t',
    'Content-Type': 'application/json',
    ...formData.getHeaders(),
  };
  const headers = AxiosHeaders.from(merged);
  const contentType = String(headers.get('Content-Type') || '');
  assert.match(contentType, /multipart\/form-data/i);
  assert.doesNotMatch(contentType, /application\/json/i);
});
