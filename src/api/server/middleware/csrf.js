import crypto from 'node:crypto';
import { timingSafeEqualStrings } from '../../../utils/timingSafe.js';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

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
 * Replaces csurf: an opaque token in the session, sent as the `CSRF-Token` header or a
 * `_csrf` body field. Exposes `req.csrfToken()` the same way csurf did.
 */
export const createSessionCsrfProtection = () => (req, res, next) => {
  req.csrfToken = () => {
    if (!req.session) {
      req.session = {};
    }
    if (!req.session.csrfToken) {
      req.session.csrfToken = crypto.randomBytes(32).toString('hex');
    }
    return req.session.csrfToken;
  };

  if (SAFE_METHODS.has(req.method)) {
    return next();
  }

  const submitted = readSubmittedCsrfToken(req);
  const expected = req.session?.csrfToken;

  if (!expected || !timingSafeEqualStrings(submitted, expected)) {
    const err = new Error('Invalid CSRF token');
    err.code = 'EBADCSRFTOKEN';
    err.status = 403;
    return next(err);
  }

  return next();
};
