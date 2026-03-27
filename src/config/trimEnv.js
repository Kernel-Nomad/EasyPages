/**
 * Normaliza valores de process.env: recorta espacios; cadena vacía tras trim → undefined.
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
