import rateLimit from 'express-rate-limit';

/**
 * Limit on failed credential checks — two buckets, not one.
 *
 * `req.ip` is the useful identity, but behind a proxy it comes from `X-Forwarded-For`,
 * which the client itself sends: rotating a forged value would give a fresh bucket on every
 * request. The socket peer gets a second, looser bucket that a spoofer cannot escape.
 *
 * A single global counter would also stop the rotation, but then anyone could lock the
 * owner out of their own instance.
 */

export const LOGIN_WINDOW_MS = 5 * 60 * 1000;
export const LOGIN_MAX_PER_IP = 15;
// Looser: behind a reverse proxy every legitimate user shares one peer.
export const LOGIN_MAX_PER_PEER = 60;

const peerKey = (req) => req.socket?.remoteAddress ?? 'unknown';

const rateLimitHandler = (req, res) => {
  const resetTime = req.rateLimit?.resetTime;
  const retryAfter = resetTime instanceof Date
    ? Math.max(1, Math.ceil((resetTime.getTime() - Date.now()) / 1000))
    : Math.ceil(LOGIN_WINDOW_MS / 1000);

  res.set('Retry-After', String(retryAfter));
  res.status(429).json({
    error: 'Too many attempts. Try again later.',
    code: 'rate_limited',
    retry_after: retryAfter,
  });
};

/**
 * Only a failed credential check consumes the budget — except /setup during the claim
 * window, where every hashing attempt must count. A 422 is validation, a 409 is
 * already-done; charging those locked operators out of their own fresh install.
 */
const requestWasSuccessful = (req, res) => {
  const path = req.path || '';
  if (path === '/setup' || path.endsWith('/setup')) {
    return res.statusCode === 409 || res.statusCode === 422;
  }
  return res.statusCode !== 401;
};

/**
 * One shared budget for /login, /setup and /credentials: guessing `current_password` is
 * guessing a password, and a separate quota would hand out twice the attempts.
 */
export const createLoginRateLimiters = () => {
  const common = {
    windowMs: LOGIN_WINDOW_MS,
    standardHeaders: true,
    legacyHeaders: false,
    skipSuccessfulRequests: true,
    requestWasSuccessful,
    handler: rateLimitHandler,
  };

  // Default keyGenerator is req.ip, which respects app.set('trust proxy', TRUST_PROXY).
  const reportedIpLimiter = rateLimit({ ...common, limit: LOGIN_MAX_PER_IP });

  const peerLimiter = rateLimit({
    ...common,
    limit: LOGIN_MAX_PER_PEER,
    keyGenerator: peerKey,
    // Only when they differ, i.e. when a trusted proxy header named someone else. With
    // TRUST_PROXY=false there is a single bucket.
    skip: (req) => req.ip === peerKey(req),
  });

  /** The success path clears the budget outright, not just one hit. */
  const resetLoginFailures = (req) => {
    reportedIpLimiter.resetKey(req.ip);
    peerLimiter.resetKey(peerKey(req));
  };

  return { loginRateLimit: [reportedIpLimiter, peerLimiter], resetLoginFailures };
};
