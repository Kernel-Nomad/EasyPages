import assert from 'node:assert/strict';
import test from 'node:test';
import { hashPassword, SCRYPT_N, SCRYPT_P, SCRYPT_R, verifyPassword } from '../../../../src/core/auth/passwordHash.js';

test('the hash is self-describing: scrypt$N$r$p$salt$digest', async () => {
  const stored = await hashPassword('correcthorsebattery');
  const parts = stored.split('$');

  assert.equal(parts.length, 6);
  assert.equal(parts[0], 'scrypt');
  assert.equal(Number(parts[1]), SCRYPT_N);
  assert.equal(Number(parts[2]), SCRYPT_R);
  assert.equal(Number(parts[3]), SCRYPT_P);
  assert.equal(Buffer.from(parts[4], 'base64').length, 16);
  assert.equal(Buffer.from(parts[5], 'base64').length, 32);
});

test('accepts the right password and rejects the wrong one', async () => {
  const stored = await hashPassword('correcthorsebattery');

  assert.equal(await verifyPassword('correcthorsebattery', stored), true);
  assert.equal(await verifyPassword('correcthorsebatterz', stored), false);
  assert.equal(await verifyPassword('', stored), false);
});

test('the same password produces different hashes (random salt)', async () => {
  const a = await hashPassword('correcthorsebattery');
  const b = await hashPassword('correcthorsebattery');

  assert.notEqual(a, b);
  assert.equal(await verifyPassword('correcthorsebattery', a), true);
  assert.equal(await verifyPassword('correcthorsebattery', b), true);
});

test('verify honours the stored parameters, not the current constants', async () => {
  // Forward compatibility: raising SCRYPT_N must not invalidate what is already stored.
  const stored = await hashPassword('correcthorsebattery', { n: 2 ** 12, r: 8, p: 1 });

  assert.equal(stored.split('$')[1], String(2 ** 12));
  assert.equal(await verifyPassword('correcthorsebattery', stored), true);
});

test('a corrupt hash is rejected without throwing', async () => {
  const cases = [
    '',
    'not-a-hash',
    'bcrypt$16384$8$1$c2FsdA==$aGFzaA==',
    'scrypt$16384$8$1$c2FsdA==',
    'scrypt$not-a-number$8$1$c2FsdA==$aGFzaA==',
    'scrypt$16384$8$1$not-base64!!$aGFzaA==',
    'scrypt$16384$8$1$$',
  ];

  for (const stored of cases) {
    assert.equal(await verifyPassword('anything', stored), false, `should reject: ${stored}`);
  }

  assert.equal(await verifyPassword('x', null), false);
  assert.equal(await verifyPassword(null, 'x'), false);
});

test('out-of-range parameters are rejected before deriving', async () => {
  // A tampered credentials.json with N=2^30 would turn login into a memory bomb.
  const bomb = `scrypt$${2 ** 30}$8$1$c2FsdHNhbHRzYWx0c2E=$aGFzaGhhc2hoYXNoaGFzaGhhc2hoYXNoaGE=`;
  const started = Date.now();

  assert.equal(await verifyPassword('anything', bomb), false);
  // Immediate rejection: deriving would not come back in tens of milliseconds.
  assert.ok(Date.now() - started < 500);

  assert.equal(await verifyPassword('x', 'scrypt$16384$999$1$c2FsdA==$aGFzaA=='), false);
  assert.equal(await verifyPassword('x', 'scrypt$16384$8$999$c2FsdA==$aGFzaA=='), false);
  assert.equal(await verifyPassword('x', 'scrypt$0$8$1$c2FsdA==$aGFzaA=='), false);
});
