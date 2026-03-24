import assert from 'node:assert/strict';
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
  assert.equal(isPathInsideDirectory('/a/b/c', '/a/b'), true);
  assert.equal(isPathInsideDirectory('/a/b', '/a/b'), true);
  assert.equal(isPathInsideDirectory('/a/c', '/a/b'), false);
});
