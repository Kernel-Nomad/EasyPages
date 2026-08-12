/**
 * Normalise a process.env value: trimmed, and empty-after-trim becomes undefined.
 * @param {string | undefined} value
 * @returns {string | undefined}
 */
export const trimEnv = (value) => {
  if (typeof value !== 'string') {
    return undefined;
  }
  const t = value.trim();
  return t === '' ? undefined : t;
};
