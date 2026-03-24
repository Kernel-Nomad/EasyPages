import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { resolveSessionSecret } from '../../../src/utils/files.js';

test('con SESSION_SECRET en env se devuelve recortado', () => {
  assert.equal(resolveSessionSecret(path.join(os.tmpdir(), 'nope'), '  abc  '), 'abc');
});

test('en producción sin SESSION_SECRET ni EASYPAGES_DATA_DIR lanza', () => {
  const prevNode = process.env.NODE_ENV;
  const prevData = process.env.EASYPAGES_DATA_DIR;
  process.env.NODE_ENV = 'production';
  delete process.env.EASYPAGES_DATA_DIR;
  try {
    assert.throws(
      () => resolveSessionSecret(path.join(os.tmpdir(), 'missing-ep-secret'), undefined),
      /SESSION_SECRET/,
    );
  } finally {
    process.env.NODE_ENV = prevNode;
    if (prevData === undefined) {
      delete process.env.EASYPAGES_DATA_DIR;
    } else {
      process.env.EASYPAGES_DATA_DIR = prevData;
    }
  }
});

test('en producción sin SESSION_SECRET pero con EASYPAGES_DATA_DIR genera y persiste .session_secret', () => {
  const prevNode = process.env.NODE_ENV;
  const prevData = process.env.EASYPAGES_DATA_DIR;
  process.env.NODE_ENV = 'production';
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ep-sess-prod-'));
  process.env.EASYPAGES_DATA_DIR = dir;
  const secretPath = path.join(dir, '.session_secret');
  try {
    const s = resolveSessionSecret(secretPath, undefined);
    assert.ok(s.length > 20);
    assert.equal(fs.readFileSync(secretPath, 'utf8'), s);
  } finally {
    process.env.NODE_ENV = prevNode;
    if (prevData === undefined) {
      delete process.env.EASYPAGES_DATA_DIR;
    } else {
      process.env.EASYPAGES_DATA_DIR = prevData;
    }
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('en desarrollo genera y persiste .session_secret si falta', () => {
  const prev = process.env.NODE_ENV;
  process.env.NODE_ENV = 'development';
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ep-sess-'));
  const secretPath = path.join(dir, '.session_secret');
  try {
    const s = resolveSessionSecret(secretPath, undefined);
    assert.ok(s.length > 20);
    assert.equal(fs.readFileSync(secretPath, 'utf8'), s);
  } finally {
    process.env.NODE_ENV = prev;
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
