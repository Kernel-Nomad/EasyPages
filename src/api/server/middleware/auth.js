/**
 * Session gate for everything under /api except the public auth endpoints.
 *
 * JSON only, never a redirect: the SPA is served to anonymous visitors and decides what to
 * draw from /api/auth/status, so a 302 to /login would just ping-pong with the legacy
 * redirect that sends /login back to /.
 */
export const createRequireAuth = ({ authState }) => (req, res, next) => {
  const snapshot = authState.getSnapshot();

  if (!snapshot.configured) {
    // Not "server misconfigured": on a fresh install this is the normal state, and the SPA
    // has to tell it apart from a broken server to draw the wizard.
    return res.status(401).json({
      error: 'Initial setup is pending.',
      code: 'setup_required',
    });
  }

  // The username is compared, not just its presence: deleting credentials.json and re-running
  // the wizard restarts token_version at 1, which the previous account's cookie already carried.
  const valid = req.session?.user === snapshot.username
    && req.session?.v === snapshot.tokenVersion;

  if (!valid) {
    req.session = null;
    return res.status(401).json({
      error: 'Session expired.',
      code: 'session_expired',
    });
  }

  return next();
};
