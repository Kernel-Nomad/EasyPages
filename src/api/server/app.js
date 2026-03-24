import express from 'express';
import helmet from 'helmet';
import session from 'express-session';
import sessionFileStore from 'session-file-store';
import path from 'path';
import csurf from 'csurf';
import { createUploadMiddleware } from '../../config/upload.js';
import {
  AUTH_PASS,
  AUTH_USER,
  assertRequiredServerEnv,
  CF_ACCOUNT_ID,
  CF_API_TOKEN,
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

export const createApp = () => {
  assertRequiredServerEnv();

  ensureDirectory(uploadsDir);
  ensureDirectory(sessionsStorePath);

  const finalSessionSecret = resolveSessionSecret(sessionSecretPath, SESSION_SECRET);
  const upload = createUploadMiddleware({ destination: uploadsMulterDest });
  const requireAuth = createRequireAuth({ authUser: AUTH_USER, authPass: AUTH_PASS });
  const csrfProtection = csurf({ cookie: false });
  const cloudflare = createCloudflareClient({
    apiToken: CF_API_TOKEN,
    accountId: CF_ACCOUNT_ID,
  });

  const app = express();

  app.set('trust proxy', 1);

  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", 'data:', 'https:'],
        connectSrc: ["'self'", 'https://api.cloudflare.com'],
        upgradeInsecureRequests: null,
      },
    },
  }));

  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  app.use(session({
    name: 'easypages_sid',
    secret: finalSessionSecret,
    store: new FileStore({ path: sessionsStorePath, ttl: 86400, retries: 2 }),
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production' ? 'auto' : false,
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

  app.use(express.static(distDir, { index: false }));

  app.use('/api', requireAuth, csrfProtection);
  app.use('/api', createProjectsRouter({ cloudflare, createProjectLimiter }));
  app.use('/api', createDeploymentsRouter({ cloudflare, upload, uploadLimiter, uploadsDir }));
  app.use('/api', createDomainsRouter({ cloudflare }));
  app.use('/api', createApiNotFoundHandler());

  app.get('*', requireAuth, (req, res) => {
    res.sendFile(path.join(distDir, 'index.html'));
  });

  return app;
};
