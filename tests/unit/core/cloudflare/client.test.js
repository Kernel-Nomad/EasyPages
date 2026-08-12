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

test('createAccountIdResolver does not cache failures: a network blip recovers on its own', async () => {
  let calls = 0;
  const resolve = createAccountIdResolver({
    listAccounts: async () => {
      calls += 1;
      if (calls === 1) {
        throw Object.assign(new Error('Could not connect to Cloudflare'), { status: 502 });
      }
      return [{ id: 'only-acc' }];
    },
    log: () => {},
  });

  await assert.rejects(resolve, /Could not connect/);
  assert.equal(await resolve(), 'only-acc', 'the next attempt asks again');
});
