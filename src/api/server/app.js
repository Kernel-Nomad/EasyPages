import cookieSession from 'cookie-session';
import express from 'express';
import helmet from 'helmet';
import path from 'path';
import rateLimit from 'express-rate-limit';
import { createUploadMiddleware } from '../../config/upload.js';
import {
  AUTH_PASS,
  AUTH_USER,
  assertRequiredServerEnv,
  CF_ACCOUNT_ID,
  CF_API_TOKEN,
  EASYPAGES_DATA_DIR,
  SESSION_COOKIE_SECURE,
  SESSION_SECRET,
  TRUST_PROXY,
} from '../../config/env.js';
import {
  distDir,
  loginHtmlPath,
  uploadsDir,
  uploadsMulterDest,
} from '../../config/paths.js';
import { createRequireAuth } from './middleware/auth.js';
import { createDistStatic } from './middleware/distStatic.js';
import { createSessionCsrfProtection } from './middleware/csrf.js';
import { createErrorHandler } from './middleware/errorHandler.js';
import {
  createProjectLimiter,
  loginLimiter,
  uploadLimiter,
} from './middleware/rateLimiters.js';
import { createAuthRouter } from './routes/auth.js';
import { createDeploymentsRouter } from './routes/deployments/router.js';
import { createDomainsRouter } from './routes/domains.js';
import { createProjectsRouter } from './routes/projects/router.js';
import { createCloudflareClient } from '../../core/cloudflare/client.js';
import { ensureDirectory, resolveCookieSessionSecret } from '../../utils/files.js';

export const createApiNotFoundHandler = () => (req, res) => {
  res.status(404).json({ error: 'Ruta API no encontrada' });
};

/**
 * @param {object} [options]
 * @param {object} [options.cloudflare] Cliente Cloudflare inyectado (p. ej. tests de integración).
 */
export const createApp = (options = {}) => {
  assertRequiredServerEnv();

  const { cloudflare: cloudflareOverride } = options;

  ensureDirectory(uploadsDir);

  const finalSessionSecret = resolveCookieSessionSecret({
    sessionSecretFromEnv: SESSION_SECRET,
    dataDir: EASYPAGES_DATA_DIR,
  });
  const upload = createUploadMiddleware({ destination: uploadsMulterDest });
  const requireAuth = createRequireAuth({ authUser: AUTH_USER, authPass: AUTH_PASS });
  const csrfProtection = createSessionCsrfProtection();
  const cloudflare = cloudflareOverride
    ?? createCloudflareClient({
      apiToken: CF_API_TOKEN,
      accountId: CF_ACCOUNT_ID,
    });

  const uiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 300,
    standardHeaders: true,
    legacyHeaders: false,
  });

  const app = express();

  app.set('trust proxy', TRUST_PROXY);

  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'"],
        imgSrc: ["'self'", 'data:', 'https:'],
        connectSrc: ["'self'", 'https://api.cloudflare.com'],
        upgradeInsecureRequests: null,
      },
    },
  }));

  app.use(express.json({ limit: '512kb' }));
  app.use(express.urlencoded({ extended: true, limit: '512kb' }));

  app.use(cookieSession({
    name: 'easypages_sid',
    keys: [finalSessionSecret],
    maxAge: 24 * 60 * 60 * 1000,
    httpOnly: true,
    secure: SESSION_COOKIE_SECURE,
    sameSite: 'lax',
    path: '/',
  }));

  app.use(createAuthRouter({
    csrfProtection,
    loginLimiter,
    requireAuth,
    authUser: AUTH_USER,
    authPass: AUTH_PASS,
    loginHtmlPath,
  }));

  app.use(uiLimiter, createDistStatic({ distDir, requireAuth }));

  app.use('/api', requireAuth, csrfProtection);
  app.use('/api', createProjectsRouter({ cloudflare, createProjectLimiter }));
  app.use('/api', createDeploymentsRouter({ cloudflare, upload, uploadLimiter, uploadsDir }));
  app.use('/api', createDomainsRouter({ cloudflare }));
  app.use('/api', createApiNotFoundHandler());

  app.get('*', requireAuth, uiLimiter, (req, res) => {
    res.sendFile(path.join(distDir, 'index.html'));
  });

  app.use(createErrorHandler());

  return app;
};
