import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { createAuthState } from '../../../../src/core/auth/authState.js';
import { createCredentialStore } from '../../../../src/core/auth/credentialStore.js';
import {
  AuthValidationError,
  InvalidCurrentPasswordError,
  SetupAlreadyCompletedError,
  SetupRequiredError,
} from '../../../../src/core/auth/errors.js';
import { createAuthService } from '../../../../src/core/auth/service.js';

const withService = async (fn) => {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'easypages-svc-'));
  try {
    const store = createCredentialStore({ dataDir });
    const authState = createAuthState({ store });
    const service = createAuthService({ authState, store });
    return await fn({ authState, service, store });
  } finally {
    fs.rmSync(dataDir, { force: true, recursive: true });
  }
};

test('the wizard creates the credential and marks the state configured', () =>
  withService(async ({ authState, service }) => {
    assert.equal(service.isSetupComplete(), false);

    const record = await service.createInitialCredentials({
      username: '  admin  ',
      password: 'a-good-password',
    });

    assert.equal(record.username, 'admin', 'the username is trimmed');
    assert.equal(record.token_version, 1);
    assert.equal(service.isSetupComplete(), true);
    assert.deepEqual(authState.getSnapshot(), {
      configured: true,
      tokenVersion: 1,
      username: 'admin',
    });
  }));

test('re-running the wizard throws SetupAlreadyCompletedError', () =>
  withService(async ({ service }) => {
    await service.createInitialCredentials({ username: 'admin', password: 'a-good-password' });

    await assert.rejects(
      () => service.createInitialCredentials({ username: 'other', password: 'another-password' }),
      SetupAlreadyCompletedError,
    );
  }));

test('validation rejects usernames and passwords outside the policy', () =>
  withService(async ({ service }) => {
    const bad = [
      { username: 'ab', password: 'a-good-password' },
      { username: 'a'.repeat(65), password: 'a-good-password' },
      { username: 'with space', password: 'a-good-password' },
      { username: 'admin', password: 'short' },
      { username: 'admin', password: 'x'.repeat(129) },
    ];

    for (const input of bad) {
      await assert.rejects(() => service.createInitialCredentials(input), (error) => {
        assert.ok(error instanceof AuthValidationError);
        assert.equal(error.code, 'validation_error');
        // The message names the rule, never the value: 4xx messages reach the client
        // verbatim and would leave the password in any proxy's logs.
        assert.ok(!error.message.includes(input.password), 'must not echo the password');
        assert.ok(!error.message.includes(input.username), 'must not echo the username');
        return true;
      });
    }

    assert.equal(service.isSetupComplete(), false);
  }));

test('verifyCredentials accepts the right pair and rejects a wrong user or password', () =>
  withService(async ({ service }) => {
    await service.createInitialCredentials({ username: 'admin', password: 'a-good-password' });

    assert.ok(await service.verifyCredentials({ username: 'admin', password: 'a-good-password' }));
    assert.equal(await service.verifyCredentials({ username: 'admin', password: 'wrong' }), null);
    assert.equal(await service.verifyCredentials({ username: 'other', password: 'a-good-password' }), null);
    assert.equal(await service.verifyCredentials({ username: undefined, password: undefined }), null);
  }));

test('an unknown username costs the same as a wrong password', () =>
  withService(async ({ service }) => {
    await service.createInitialCredentials({ username: 'admin', password: 'a-good-password' });

    const time = async (input) => {
      const started = process.hrtime.bigint();
      await service.verifyCredentials(input);
      return Number(process.hrtime.bigint() - started) / 1e6;
    };

    const wrongPassword = await time({ username: 'admin', password: 'wrong' });
    const wrongUser = await time({ username: 'nobody', password: 'wrong' });

    // The KDF runs in both cases, so response time does not give away which username
    // exists. The margin is wide on purpose: this measures that the work happens at all.
    assert.ok(
      wrongUser > wrongPassword / 3,
      `unknown user ${wrongUser}ms vs wrong password ${wrongPassword}ms`,
    );
  }));

test('without credentials, verify returns null and changing requires setup', () =>
  withService(async ({ service }) => {
    assert.equal(await service.verifyCredentials({ username: 'admin', password: 'x' }), null);
    await assert.rejects(
      () => service.changeCredentials({ currentPassword: 'x', newPassword: 'a-good-password' }),
      SetupRequiredError,
    );
  }));

test('changing credentials requires the current password', () =>
  withService(async ({ service }) => {
    await service.createInitialCredentials({ username: 'admin', password: 'a-good-password' });

    await assert.rejects(
      () => service.changeCredentials({
        currentPassword: 'wrong',
        newPassword: 'a-new-password',
      }),
      InvalidCurrentPasswordError,
    );
    // Nothing changed.
    assert.ok(await service.verifyCredentials({ username: 'admin', password: 'a-good-password' }));
  }));

test('changing the password bumps token_version and invalidates old sessions', () =>
  withService(async ({ authState, service }) => {
    await service.createInitialCredentials({ username: 'admin', password: 'a-good-password' });
    assert.equal(authState.getSnapshot().tokenVersion, 1);

    const updated = await service.changeCredentials({
      currentPassword: 'a-good-password',
      newPassword: 'a-new-password',
    });

    assert.equal(updated.token_version, 2);
    assert.equal(authState.getSnapshot().tokenVersion, 2);
    assert.ok(await service.verifyCredentials({ username: 'admin', password: 'a-new-password' }));
    assert.equal(await service.verifyCredentials({ username: 'admin', password: 'a-good-password' }), null);
  }));

test('changing only the username also rotates the token version', () =>
  withService(async ({ authState, service }) => {
    await service.createInitialCredentials({ username: 'admin', password: 'a-good-password' });

    const updated = await service.changeCredentials({
      currentPassword: 'a-good-password',
      newUsername: 'operator',
    });

    assert.equal(updated.username, 'operator');
    assert.equal(updated.token_version, 2);
    assert.equal(authState.getSnapshot().username, 'operator');
    assert.ok(await service.verifyCredentials({ username: 'operator', password: 'a-good-password' }));
  }));

test('a change that changes nothing is a validation error', () =>
  withService(async ({ service }) => {
    await service.createInitialCredentials({ username: 'admin', password: 'a-good-password' });

    await assert.rejects(
      () => service.changeCredentials({ currentPassword: 'a-good-password', newUsername: 'admin' }),
      AuthValidationError,
    );
    await assert.rejects(
      () => service.changeCredentials({ currentPassword: 'a-good-password' }),
      AuthValidationError,
    );
  }));
