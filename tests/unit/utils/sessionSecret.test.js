import assert from 'node:assert/strict';
import { test } from 'node:test';
import { resolveCookieSessionSecret } from '../../../src/utils/files.js';

test('con SESSION_SECRET definido se devuelve recortado', () => {
  assert.equal(resolveCookieSessionSecret('  abc  '), 'abc');
});

test('sin SESSION_SECRET genera hex de 64 caracteres y avisa', () => {
  const prevWarn = console.warn;
  let warned = false;
  console.warn = (...args) => {
    warned = true;
    prevWarn(...args);
  };
  try {
    const s = resolveCookieSessionSecret(undefined);
    assert.match(s, /^[0-9a-f]{64}$/);
    assert.ok(warned, 'debe registrar aviso');
  } finally {
    console.warn = prevWarn;
  }
});
