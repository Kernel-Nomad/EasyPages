import crypto from 'node:crypto';
import { promisify } from 'node:util';

// The callback form runs on the libuv threadpool. `crypto.scryptSync` does not and would
// freeze the server for the whole derivation, so it must never be used here.
const scrypt = promisify(crypto.scrypt);

// 16 MiB, ~25 ms on a desktop and 100-200 ms on a Raspberry Pi 4.
export const SCRYPT_N = 2 ** 14;
export const SCRYPT_R = 8;
export const SCRYPT_P = 1;
const DKLEN = 32;
const MAXMEM = 64 * 1024 * 1024;
const ALGO = 'scrypt';

// Guards against a tampered credentials.json turning login into a memory bomb.
const MAX_VERIFY_N = 2 ** 20;
const MAX_VERIFY_R = 32;
const MAX_VERIFY_P = 16;

/** Buffer.from is lenient with base64; this rejects anything that does not round-trip. */
const decodeStrictBase64 = (value) => {
  const decoded = Buffer.from(value, 'base64');
  return decoded.toString('base64') === value ? decoded : null;
};

/**
 * Hash a password as `scrypt$N$r$p$saltB64$hashB64`. The parameters travel inside the hash
 * so they can be raised later without invalidating what is already stored.
 *
 * @param {string} password
 * @param {{ n?: number, r?: number, p?: number }} [params]
 * @returns {Promise<string>}
 */
export const hashPassword = async (password, params = {}) => {
  const { n = SCRYPT_N, r = SCRYPT_R, p = SCRYPT_P } = params;
  const salt = crypto.randomBytes(16);
  const derived = await scrypt(password, salt, DKLEN, { N: n, r, p, maxmem: MAXMEM });
  return [ALGO, n, r, p, salt.toString('base64'), derived.toString('base64')].join('$');
};

/**
 * Constant-time verification. A malformed stored hash denies access instead of throwing:
 * a corrupt credentials.json must not crash the login endpoint.
 *
 * @param {string} password
 * @param {string} stored
 * @returns {Promise<boolean>}
 */
export const verifyPassword = async (password, stored) => {
  if (typeof password !== 'string' || typeof stored !== 'string') {
    return false;
  }

  const parts = stored.split('$');
  if (parts.length !== 6 || parts[0] !== ALGO) {
    console.warn('[EasyPages] Unknown password hash format; access denied.');
    return false;
  }

  const n = Number.parseInt(parts[1], 10);
  const r = Number.parseInt(parts[2], 10);
  const p = Number.parseInt(parts[3], 10);
  if (!Number.isInteger(n) || !Number.isInteger(r) || !Number.isInteger(p)) {
    console.warn('[EasyPages] Unreadable password hash; access denied.');
    return false;
  }

  if (!(n > 0 && n <= MAX_VERIFY_N && r > 0 && r <= MAX_VERIFY_R && p > 0 && p <= MAX_VERIFY_P)) {
    console.warn('[EasyPages] Password hash parameters out of range; access denied.');
    return false;
  }

  const salt = decodeStrictBase64(parts[4]);
  const expected = decodeStrictBase64(parts[5]);
  if (!salt?.length || !expected?.length) {
    console.warn('[EasyPages] Password hash without salt or digest; access denied.');
    return false;
  }

  let derived;
  try {
    // dklen comes from the stored digest, so a hash of a different length still verifies.
    derived = await scrypt(password, salt, expected.length, { N: n, r, p, maxmem: MAXMEM });
  } catch {
    console.warn('[EasyPages] Could not recompute the password hash; access denied.');
    return false;
  }

  return crypto.timingSafeEqual(derived, expected);
};
