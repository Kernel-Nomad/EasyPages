import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { createCredentialStore } from '../../../../src/core/auth/credentialStore.js';
import { CredentialStorageError, SetupAlreadyCompletedError } from '../../../../src/core/auth/errors.js';

const withTempDir = (fn) => {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'easypages-store-'));
  try {
    return fn(dataDir);
  } finally {
    fs.rmSync(dataDir, { force: true, recursive: true });
  }
};

test('read returns null when there are no credentials yet', () => {
  withTempDir((dataDir) => {
    const store = createCredentialStore({ dataDir });
    assert.equal(store.read(), null);
    assert.equal(store.exists(), false);
  });
});

test('create writes the record with 0600 permissions', () => {
  withTempDir((dataDir) => {
    const store = createCredentialStore({ dataDir });
    const record = store.create({ username: 'admin', passwordHash: 'scrypt$1$2$3$a$b' });

    assert.equal(record.username, 'admin');
    assert.equal(record.token_version, 1);
    assert.equal(record.version, 1);
    assert.ok(record.created_at);

    const mode = fs.statSync(store.filePath).mode & 0o777;
    assert.equal(mode, 0o600, `expected mode 600, got ${mode.toString(8)}`);
    assert.deepEqual(store.read(), record);
  });
});

test('a second create throws SetupAlreadyCompletedError', () => {
  withTempDir((dataDir) => {
    const store = createCredentialStore({ dataDir });
    store.create({ username: 'admin', passwordHash: 'scrypt$1$2$3$a$b' });

    assert.throws(
      () => store.create({ username: 'other', passwordHash: 'scrypt$1$2$3$c$d' }),
      SetupAlreadyCompletedError,
    );
    // Whoever won the race is not clobbered.
    assert.equal(store.read().username, 'admin');
  });
});

test('create leaves no temporary files behind', () => {
  withTempDir((dataDir) => {
    const store = createCredentialStore({ dataDir });
    store.create({ username: 'admin', passwordHash: 'scrypt$1$2$3$a$b' });

    const leftovers = fs.readdirSync(dataDir).filter((name) => name.endsWith('.tmp'));
    assert.deepEqual(leftovers, []);
  });
});

test('replace overwrites atomically and keeps the mode', () => {
  withTempDir((dataDir) => {
    const store = createCredentialStore({ dataDir });
    const record = store.create({ username: 'admin', passwordHash: 'scrypt$1$2$3$a$b' });

    const updated = store.replace({ ...record, username: 'renamed', token_version: 2 });

    assert.equal(updated.username, 'renamed');
    assert.equal(updated.token_version, 2);
    assert.notEqual(updated.updated_at, undefined);
    assert.equal(store.read().username, 'renamed');
    assert.equal(fs.statSync(store.filePath).mode & 0o777, 0o600);
  });
});

test('corrupt JSON throws CredentialStorageError instead of pretending setup is open', () => {
  withTempDir((dataDir) => {
    const store = createCredentialStore({ dataDir });
    fs.writeFileSync(store.filePath, '{ this is not json', 'utf8');

    assert.throws(() => store.read(), (error) => {
      assert.ok(error instanceof CredentialStorageError);
      assert.equal(error.code, 'storage_unwritable');
      assert.match(error.message, /unreadable|Delete/i);
      return true;
    });
    // The leftover file still blocks a second create via EEXIST.
    assert.equal(store.exists(), true);
  });
});

test('a record of an unexpected shape throws rather than reopening the wizard', () => {
  withTempDir((dataDir) => {
    const store = createCredentialStore({ dataDir });
    const cases = [
      { username: 'admin' },
      { username: '', password_hash: 'x', token_version: 1 },
      { username: 'admin', password_hash: 'x', token_version: 0 },
      { username: 'admin', password_hash: 'x', token_version: 'one' },
    ];

    for (const value of cases) {
      fs.writeFileSync(store.filePath, JSON.stringify(value), 'utf8');
      assert.throws(
        () => store.read(),
        CredentialStorageError,
        `should reject: ${JSON.stringify(value)}`,
      );
    }
  });
});

test('assertWritable passes on a normal directory', () => {
  withTempDir((dataDir) => {
    const store = createCredentialStore({ dataDir });
    assert.doesNotThrow(() => store.assertWritable());
    // The probe leaves nothing behind.
    assert.deepEqual(fs.readdirSync(dataDir), []);
  });
});

test('a read-only directory gives a typed, actionable error', { skip: process.getuid?.() === 0 ? 'root ignores permissions' : false }, () => {
  withTempDir((parent) => {
    const dataDir = path.join(parent, 'readonly');
    fs.mkdirSync(dataDir, { mode: 0o500 });
    const store = createCredentialStore({ dataDir });

    // The real failure: a Docker bind mount owned by root while the container runs as uid
    // 1000. Without a typed error the wizard returned 500 with no explanation.
    assert.throws(() => store.assertWritable(), (error) => {
      assert.ok(error instanceof CredentialStorageError);
      assert.equal(error.code, 'storage_unwritable');
      assert.match(error.message, /chown/);
      return true;
    });

    assert.throws(
      () => store.create({ username: 'admin', passwordHash: 'scrypt$1$2$3$a$b' }),
      CredentialStorageError,
    );

    fs.chmodSync(dataDir, 0o700);
  });
});
