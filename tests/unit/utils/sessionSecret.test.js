import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import {
  resolveCookieSessionSecret,
  SESSION_SECRET_FILENAME,
} from '../../../src/utils/files.js';

const LONG_SECRET = '0123456789abcdef0123456789abcdef';

test('a defined SESSION_SECRET is returned trimmed', () => {
  assert.equal(
    resolveCookieSessionSecret({ sessionSecretFromEnv: `  ${LONG_SECRET}  ` }),
    LONG_SECRET,
  );
});

test('a short SESSION_SECRET is rejected', () => {
  assert.throws(
    () => resolveCookieSessionSecret({ sessionSecretFromEnv: 'abc' }),
    /at least 32 characters/,
  );
});

test('without SESSION_SECRET or dataDir it generates 64 hex chars and warns', () => {
  const prevWarn = console.warn;
  let warned = false;
  console.warn = (...args) => {
    warned = true;
    prevWarn(...args);
  };
  try {
    const s = resolveCookieSessionSecret({});
    assert.match(s, /^[0-9a-f]{64}$/);
    assert.ok(warned, 'must log a warning');
  } finally {
    console.warn = prevWarn;
  }
});

test('without SESSION_SECRET but with dataDir it creates the file and reuses the secret', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'easypages-secret-'));
  try {
    const a = resolveCookieSessionSecret({ dataDir: dir });
    assert.match(a, /^[0-9a-f]{64}$/);
    const filePath = path.join(dir, SESSION_SECRET_FILENAME);
    assert.ok(fs.existsSync(filePath));
    const b = resolveCookieSessionSecret({ dataDir: dir });
    assert.equal(a, b);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('SESSION_SECRET takes precedence over dataDir', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'easypages-secret-'));
  try {
    resolveCookieSessionSecret({ sessionSecretFromEnv: LONG_SECRET, dataDir: dir });
    assert.equal(
      resolveCookieSessionSecret({ sessionSecretFromEnv: LONG_SECRET, dataDir: dir }),
      LONG_SECRET,
    );
    const filePath = path.join(dir, SESSION_SECRET_FILENAME);
    assert.ok(!fs.existsSync(filePath));
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
