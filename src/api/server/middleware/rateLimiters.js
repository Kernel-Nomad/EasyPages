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
  message: { error: 'Upload limit exceeded. Try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

export const createProjectLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  message: { error: 'Too many project creation requests.' },
  standardHeaders: true,
  legacyHeaders: false,
});
