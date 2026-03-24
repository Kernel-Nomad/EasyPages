import express from 'express';
import helmet from 'helmet';
import session from 'express-session';
import sessionFileStore from 'session-file-store';
import path from 'path';
import { createUploadMiddleware } from '../../config/upload.js';
import {
  AUTH_PASS,
  AUTH_USER,
  assertRequiredServerEnv,
  CF_ACCOUNT_ID,
  CF_API_TOKEN,
  SESSION_COOKIE_SECURE,
  SESSION_SECRET,
} from '../../config/env.js';
import {
  distDir,
  loginHtmlPath,
  sessionSecretPath,
  sessionsStorePath,
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
import { ensureDirectory, resolveSessionSecret } from '../../utils/files.js';

const FileStore = sessionFileStore(session);

export const createApiNotFoundHandler = () => (req, res) => {
  res.status(404).json({ error: 'Ruta API no encontrada' });
};

/**
 * @param {object} [options]
 * @param {object} [options.cloudflare] Cliente Cloudflare inyectado (p. ej. tests de integración).
 * @param {string} [options.sessionStorePath] Ruta del almacén de sesiones en disco (p. ej. directorio temporal en tests).
 */
export const createApp = (options = {}) => {
  assertRequiredServerEnv();

  const { cloudflare: cloudflareOverride, sessionStorePath: sessionStorePathOption } = options;
  const effectiveSessionStorePath = sessionStorePathOption ?? sessionsStorePath;

  ensureDirectory(uploadsDir);
  ensureDirectory(effectiveSessionStorePath);

  const finalSessionSecret = resolveSessionSecret(sessionSecretPath, SESSION_SECRET);
  const upload = createUploadMiddleware({ destination: uploadsMulterDest });
  const requireAuth = createRequireAuth({ authUser: AUTH_USER, authPass: AUTH_PASS });
  const csrfProtection = createSessionCsrfProtection();
  const cloudflare = cloudflareOverride
    ?? createCloudflareClient({
      apiToken: CF_API_TOKEN,
      accountId: CF_ACCOUNT_ID,
    });

  const app = express();

  app.set('trust proxy', 1);

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

  app.use(session({
    name: 'easypages_sid',
    secret: finalSessionSecret,
    store: new FileStore({ path: effectiveSessionStorePath, ttl: 86400, retries: 2 }),
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: SESSION_COOKIE_SECURE,
      maxAge: 24 * 60 * 60 * 1000,
      sameSite: 'lax',
    },
  }));

  app.use(createAuthRouter({
    csrfProtection,
    loginLimiter,
    requireAuth,
    authUser: AUTH_USER,
    authPass: AUTH_PASS,
    loginHtmlPath,
  }));

  app.use(createDistStatic({ distDir, requireAuth }));

  app.use('/api', requireAuth, csrfProtection);
  app.use('/api', createProjectsRouter({ cloudflare, createProjectLimiter }));
  app.use('/api', createDeploymentsRouter({ cloudflare, upload, uploadLimiter, uploadsDir }));
  app.use('/api', createDomainsRouter({ cloudflare }));
  app.use('/api', createApiNotFoundHandler());

  app.get('*', requireAuth, (req, res) => {
    res.sendFile(path.join(distDir, 'index.html'));
  });

  app.use(createErrorHandler());

  return app;
};
