import crypto from 'node:crypto';
import express from 'express';
import { AuthError } from '../../../../core/auth/errors.js';
import { logServerError } from '../../logServerError.js';

/**
 * Public authentication endpoints.
 *
 * Mounted at /api/auth *above* the `app.use('/api', requireAuth, ...)` wall, so everything
 * here is reachable without a session. /credentials is the exception and applies
 * `requireAuth` itself.
 *
 * Every response carries a stable `code`. That, not the message, is the contract: the SPA
 * maps codes to translation keys.
 */

const STATUS_BY_CODE = {
  setup_already_completed: 409,
  setup_required: 409,
  invalid_credentials: 401,
  invalid_current_password: 401,
  validation_error: 422,
};

const sendError = (res, status, message, code, extra = {}) =>
  res.status(status).json({ error: message, code, ...extra });

/**
 * Replace the session so it inherits nothing from the old one, and mint a fresh CSRF token:
 * rotating it on login is the standard defence against session fixation.
 */
const openSession = (req, record) => {
  const csrfToken = crypto.randomBytes(32).toString('hex');
  req.session = { user: record.username, v: record.token_version, csrfToken };
  return csrfToken;
};

export const createAuthRouter = ({
  authService,
  csrfProtection,
  loginRateLimit,
  requireAuth,
  resetLoginFailures,
}) => {
  const router = express.Router();

  const handleAuthError = (res, error, context) => {
    if (error instanceof AuthError) {
      const status = STATUS_BY_CODE[error.code];
      if (status) {
        return sendError(res, status, error.message, error.code);
      }
      if (error.code === 'storage_unwritable') {
        // The remediation names the data directory, which does not belong in an HTTP
        // response; the operator reads it in the logs and the SPA renders its own string.
        logServerError(context.req, error, 'auth storage');
        return sendError(
          res,
          500,
          'Could not save the credentials. Check the server logs.',
          'storage_unwritable',
        );
      }
    }
    return context.next(error);
  };

  /**
   * SPA bootstrap: public and always 200, in all three states. Reads the store directly
   * rather than the cached snapshot, so deleting credentials.json by hand brings the wizard
   * back without a restart.
   *
   * It also mints the CSRF token eagerly. The protection middleware only creates one inside
   * `req.csrfToken()`, so without this call an anonymous visitor gets no session cookie and
   * every later POST would 403 with no way to recover.
   */
  router.get('/status', csrfProtection, (req, res) => {
    res.set('Cache-Control', 'no-store');

    const record = authService.getCredentials();
    const authenticated = Boolean(
      record
      && req.session?.user === record.username
      && req.session?.v === record.token_version,
    );

    res.json({
      setup_complete: record !== null,
      authenticated,
      // Only returned with a real session behind it, never to an anonymous caller.
      username: authenticated ? record.username : null,
      csrf_token: req.csrfToken(),
    });
  });

  /** First run only. 409 for good once the credential exists. */
  router.post('/setup', loginRateLimit, csrfProtection, async (req, res, next) => {
    // Checked before hashing: otherwise this endpoint stays a 16 MiB, 200 ms amplifier long
    // after the install is done.
    if (authService.isSetupComplete()) {
      return sendError(res, 409, 'Initial setup has already been completed.', 'setup_already_completed');
    }

    const { username, password } = req.body ?? {};
    try {
      const record = await authService.createInitialCredentials({ username, password });
      const csrfToken = openSession(req, record);
      resetLoginFailures(req);
      return res.status(201).json({ username: record.username, csrf_token: csrfToken });
    } catch (error) {
      return handleAuthError(res, error, { next, req });
    }
  });

  router.post('/login', loginRateLimit, csrfProtection, async (req, res, next) => {
    if (!authService.isSetupComplete()) {
      return sendError(res, 409, 'Initial setup is pending.', 'setup_required');
    }

    const { username, password } = req.body ?? {};
    try {
      const record = await authService.verifyCredentials({ username, password });
      if (!record) {
        // Generic on purpose: never distinguish an unknown user from a wrong password.
        return sendError(res, 401, 'Wrong username or password.', 'invalid_credentials');
      }

      const csrfToken = openSession(req, record);
      resetLoginFailures(req);
      return res.json({ username: record.username, csrf_token: csrfToken });
    } catch (error) {
      return handleAuthError(res, error, { next, req });
    }
  });

  router.post(
    '/logout',
    // Idempotent: closing an already expired session must not 403 on a CSRF token that
    // expired with it, which would leave the client unable to log out at all.
    (req, res, next) => (req.session?.isPopulated ? next() : res.json({ status: 'ok' })),
    csrfProtection,
    (req, res) => {
      req.session = null;
      res.json({ status: 'ok' });
    },
  );

  /**
   * Change username and/or password. Shares the login attempt budget and rotates
   * token_version, which signs out every other device; our own session is reissued.
   */
  router.post(
    '/credentials',
    requireAuth,
    loginRateLimit,
    csrfProtection,
    async (req, res, next) => {
      const { current_password: currentPassword, username, new_password: newPassword } = req.body ?? {};
      try {
        const record = await authService.changeCredentials({
          currentPassword,
          newPassword,
          newUsername: username,
        });
        const csrfToken = openSession(req, record);
        resetLoginFailures(req);
        return res.json({ username: record.username, csrf_token: csrfToken });
      } catch (error) {
        return handleAuthError(res, error, { next, req });
      }
    },
  );

  return router;
};

/**
 * Routes the previous release owned. Kept so bookmarks, tabs still running the old bundle
 * and healthchecks copied from an older docker-compose.yml keep working.
 */
export const createLegacyAuthRouter = () => {
  const router = express.Router();

  // 302, not 301: a 301 is cached forever. `fetch` follows redirects, so the old
  // healthcheck probing /login still resolves to a 200.
  router.get('/login', (req, res) => res.redirect(302, '/'));

  router.post('/logout', (req, res) => {
    req.session = null;
    res.redirect(302, '/');
  });

  return router;
};
