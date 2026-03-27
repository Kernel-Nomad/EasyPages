import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import {
  resolveCookieSessionSecret,
  SESSION_SECRET_FILENAME,
} from '../../../src/utils/files.js';

test('con SESSION_SECRET definido se devuelve recortado', () => {
  assert.equal(resolveCookieSessionSecret({ sessionSecretFromEnv: '  abc  ' }), 'abc');
});

test('sin SESSION_SECRET ni dataDir genera hex de 64 caracteres y avisa', () => {
  const prevWarn = console.warn;
  let warned = false;
  console.warn = (...args) => {
    warned = true;
    prevWarn(...args);
  };
  try {
    const s = resolveCookieSessionSecret({});
    assert.match(s, /^[0-9a-f]{64}$/);
    assert.ok(warned, 'debe registrar aviso');
  } finally {
    console.warn = prevWarn;
  }
});

test('sin SESSION_SECRET pero con dataDir crea archivo y reutiliza el secreto', () => {
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

test('SESSION_SECRET tiene prioridad sobre dataDir', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'easypages-secret-'));
  try {
    resolveCookieSessionSecret({ sessionSecretFromEnv: 'from-env', dataDir: dir });
    assert.equal(resolveCookieSessionSecret({ sessionSecretFromEnv: 'from-env', dataDir: dir }), 'from-env');
    const filePath = path.join(dir, SESSION_SECRET_FILENAME);
    assert.ok(!fs.existsSync(filePath));
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
