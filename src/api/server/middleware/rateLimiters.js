import rateLimit from 'express-rate-limit';

const peerKey = (req) => req.socket?.remoteAddress ?? 'unknown';

const rateLimitedHandler = (fallbackRetryAfter, message) => (req, res) => {
  const resetTime = req.rateLimit?.resetTime;
  const retryAfter = resetTime instanceof Date
    ? Math.max(1, Math.ceil((resetTime.getTime() - Date.now()) / 1000))
    : fallbackRetryAfter;
  res.set('Retry-After', String(retryAfter));
  res.status(429).json({
    error: message,
    code: 'rate_limited',
    retry_after: retryAfter,
  });
};

/**
 * Factories so each `createApp()` gets fresh buckets — shared module singletons would
 * leak rate-limit state across integration tests in the same process.
 *
 * Upload and create-project also get a peer bucket when TRUST_PROXY is on: `X-Forwarded-For`
 * is client-controlled, so the socket peer is the bucket a spoofer cannot escape.
 */
export const createRateLimiters = () => {
  const staticLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 1000,
    standardHeaders: true,
    legacyHeaders: false,
    // Hashed assets are immutable; /api must not consume the static budget (this middleware
    // sits above the /api wall and would otherwise count every dashboard call).
    skip: (req) => req.path.startsWith('/assets/') || req.path.startsWith('/api'),
    handler: rateLimitedHandler(900, 'Too many requests. Try again later.'),
  });

  const spaLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 300,
    standardHeaders: true,
    legacyHeaders: false,
    handler: rateLimitedHandler(900, 'Too many requests. Try again later.'),
  });

  const uploadReported = rateLimit({
    windowMs: 60 * 60 * 1000,
    limit: 10,
    standardHeaders: true,
    legacyHeaders: false,
    handler: rateLimitedHandler(3600, 'Upload limit exceeded. Try again later.'),
  });

  const uploadPeer = rateLimit({
    windowMs: 60 * 60 * 1000,
    limit: 40,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: peerKey,
    skip: (req) => req.ip === peerKey(req),
    handler: rateLimitedHandler(3600, 'Upload limit exceeded. Try again later.'),
  });

  const createProjectReported = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 20,
    standardHeaders: true,
    legacyHeaders: false,
    handler: rateLimitedHandler(900, 'Too many project creation requests.'),
  });

  const createProjectPeer = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 80,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: peerKey,
    skip: (req) => req.ip === peerKey(req),
    handler: rateLimitedHandler(900, 'Too many project creation requests.'),
  });

  return {
    staticLimiter,
    spaLimiter,
    uploadLimiter: [uploadReported, uploadPeer],
    createProjectLimiter: [createProjectReported, createProjectPeer],
  };
};
