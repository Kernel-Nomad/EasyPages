import assert from 'node:assert/strict';
import fs from 'node:fs';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import {
  isPathInsideDirectory,
  isSafeZipEntry,
  normalizeZipEntryPath,
} from '../../../src/utils/files.js';

test('normalizeZipEntryPath rejects path traversal', () => {
  assert.equal(normalizeZipEntryPath('../etc/passwd'), null);
  assert.equal(normalizeZipEntryPath('a/../../b'), null);
});

test('normalizeZipEntryPath accepts safe relative paths', () => {
  assert.equal(normalizeZipEntryPath('index.html'), '/index.html');
  assert.equal(normalizeZipEntryPath('assets/app.js'), '/assets/app.js');
});

test('isSafeZipEntry mirrors normalizeZipEntryPath', () => {
  assert.equal(isSafeZipEntry('ok.txt'), true);
  assert.equal(isSafeZipEntry('..\\evil'), false);
});

test('isPathInsideDirectory contains targets within base', () => {
  const base = mkdtempSync(path.join(tmpdir(), 'ep-ispath-'));
  const nested = path.join(base, 'nested');
  fs.mkdirSync(nested);
  const innerFile = path.join(nested, 'f.txt');
  writeFileSync(innerFile, 'x');
  const outside = mkdtempSync(path.join(tmpdir(), 'ep-ispath-out-'));

  assert.equal(isPathInsideDirectory(innerFile, base), true);
  assert.equal(isPathInsideDirectory(nested, base), true);
  assert.equal(isPathInsideDirectory(base, base), true);
  assert.equal(isPathInsideDirectory(outside, base), false);
});
