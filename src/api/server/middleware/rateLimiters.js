import rateLimit from 'express-rate-limit';

/**
 * The dist/ bundle is public now that login lives in the SPA, so this is what an anonymous
 * visitor spends just loading the app. Generous on purpose: exhausting it means the login
 * screen itself will not load.
 */
export const staticLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 1000,
  standardHeaders: true,
  legacyHeaders: false,
  // Hashed asset names are immutable and heavily requested on a cold load.
  skip: (req) => req.path.startsWith('/assets/'),
});

/** Navigation routes only: one HTML shell per request, so a smaller budget fits. */
export const spaLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 300,
  standardHeaders: true,
  legacyHeaders: false,
});

export const uploadLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    const resetTime = req.rateLimit?.resetTime;
    const retryAfter = resetTime instanceof Date
      ? Math.max(1, Math.ceil((resetTime.getTime() - Date.now()) / 1000))
      : 3600;
    res.set('Retry-After', String(retryAfter));
    res.status(429).json({
      error: 'Upload limit exceeded. Try again later.',
      code: 'rate_limited',
      retry_after: retryAfter,
    });
  },
});

export const createProjectLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    const resetTime = req.rateLimit?.resetTime;
    const retryAfter = resetTime instanceof Date
      ? Math.max(1, Math.ceil((resetTime.getTime() - Date.now()) / 1000))
      : 900;
    res.set('Retry-After', String(retryAfter));
    res.status(429).json({
      error: 'Too many project creation requests.',
      code: 'rate_limited',
      retry_after: retryAfter,
    });
  },
});
