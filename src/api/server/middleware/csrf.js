import crypto from 'node:crypto';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

/** Compara tokens comparando digests SHA-256 (longitud fija) para evitar fugas por longitud. */
const timingSafeEqualTokenStrings = (submitted, expected) => {
  if (typeof submitted !== 'string' || typeof expected !== 'string') {
    return false;
  }
  const a = crypto.createHash('sha256').update(submitted, 'utf8').digest();
  const b = crypto.createHash('sha256').update(expected, 'utf8').digest();
  return crypto.timingSafeEqual(a, b);
};

const readSubmittedCsrfToken = (req) => {
  const header =
    req.get('CSRF-Token')
    || req.get('Csrf-Token')
    || req.get('X-CSRF-Token');
  if (header) {
    return header;
  }
  if (req.body && typeof req.body === 'object' && typeof req.body._csrf === 'string') {
    return req.body._csrf;
  }
  return '';
};

/**
 * Sustituye csurf: token opaco en sesión, cabecera `CSRF-Token` o campo `_csrf` en body.
 * Expone `req.csrfToken()` como en csurf.
 */
export const createSessionCsrfProtection = () => (req, res, next) => {
  req.csrfToken = () => {
    if (!req.session.csrfToken) {
      req.session.csrfToken = crypto.randomBytes(32).toString('hex');
    }
    return req.session.csrfToken;
  };

  if (SAFE_METHODS.has(req.method)) {
    return next();
  }

  const submitted = readSubmittedCsrfToken(req);
  const expected = req.session.csrfToken;

  if (!expected || !timingSafeEqualTokenStrings(submitted, expected)) {
    const err = new Error('Token CSRF inválido');
    err.code = 'EBADCSRFTOKEN';
    err.status = 403;
    return next(err);
  }

  return next();
};
