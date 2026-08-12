import crypto from 'node:crypto';

/**
 * Constant-time string comparison. Both sides are hashed first so the buffers are always
 * 32 bytes: `timingSafeEqual` throws on a length mismatch, which would leak the length.
 *
 * @param {unknown} submitted
 * @param {unknown} expected
 * @returns {boolean}
 */
export const timingSafeEqualStrings = (submitted, expected) => {
  if (typeof submitted !== 'string' || typeof expected !== 'string') {
    return false;
  }
  const a = crypto.createHash('sha256').update(submitted, 'utf8').digest();
  const b = crypto.createHash('sha256').update(expected, 'utf8').digest();
  return crypto.timingSafeEqual(a, b);
};
