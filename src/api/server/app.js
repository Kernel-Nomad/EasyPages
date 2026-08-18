import cookieSession from 'cookie-session';
import express from 'express';
import helmet from 'helmet';
import path from 'path';
import { createUploadMiddleware } from '../../config/upload.js';
import {
  assertRequiredServerEnv,
  CF_ACCOUNT_ID,
  CF_API_TOKEN,
  EASYPAGES_DATA_DIR,
  SESSION_COOKIE_SECURE,
  SESSION_SECRET,
  TRUST_PROXY,
} from '../../config/env.js';
import { distDir, resolveUploadsDir } from '../../config/paths.js';
import { createAuthState } from '../../core/auth/authState.js';
import { createCredentialStore } from '../../core/auth/credentialStore.js';
import { createAuthService } from '../../core/auth/service.js';
import { createRequireAuth } from './middleware/auth.js';
import { createSessionCsrfProtection } from './middleware/csrf.js';
import { createErrorHandler } from './middleware/errorHandler.js';
import { createLoginRateLimiters } from './middleware/loginRateLimit.js';
import { createRateLimiters } from './middleware/rateLimiters.js';
import { createAuthRouter, createLegacyAuthRouter } from './routes/auth/router.js';
import { createDeploymentsRouter } from './routes/deployments/router.js';
import { createDomainsRouter } from './routes/domains.js';
import { createProjectsRouter } from './routes/projects/router.js';
import { createCloudflareClient } from '../../core/cloudflare/client.js';
import { ensureDirectory, resolveCookieSessionSecret } from '../../utils/files.js';

export const createApiNotFoundHandler = () => (req, res) => {
  res.status(404).json({ error: 'API route not found', code: 'not_found' });
};

/**
 * Asset-looking = a dot in the last segment. Those must 404 rather than get the SPA shell:
 * a stale `/assets/index-<hash>.js` answered with 200 + HTML looks like a blank page.
 */
const looksLikeAsset = (requestPath) =>
  requestPath.slice(requestPath.lastIndexOf('/') + 1).includes('.');

/**
 * @param {object} [options]
 * @param {object} [options.cloudflare] Injected Cloudflare client (used by integration tests).
 */
export const createApp = (options = {}) => {
  assertRequiredServerEnv();

  const { cloudflare: cloudflareOverride } = options;

  const uploadsDir = resolveUploadsDir(EASYPAGES_DATA_DIR);
  ensureDirectory(EASYPAGES_DATA_DIR);
  ensureDirectory(uploadsDir);

  const credentialStore = createCredentialStore({ dataDir: EASYPAGES_DATA_DIR });
  // Fail here rather than in the browser: an unwritable bind mount otherwise surfaces as
  // the setup wizard returning 500 with nothing in the logs.
  credentialStore.assertWritable();

  const authState = createAuthState({ store: credentialStore });
  // Primed at boot so the first request does not have to read the file.
  authState.prime();
  if (!authState.getSnapshot().configured) {
    console.log(
      '[EasyPages] No credentials yet: opening the app will show the setup wizard.',
    );
  }

  const authService = createAuthService({ authState, store: credentialStore });
  const { loginRateLimit, resetLoginFailures } = createLoginRateLimiters();
  const {
    staticLimiter,
    spaLimiter,
    uploadLimiter,
    createProjectLimiter,
  } = createRateLimiters();

  const finalSessionSecret = resolveCookieSessionSecret({
    sessionSecretFromEnv: SESSION_SECRET,
    dataDir: EASYPAGES_DATA_DIR,
  });
  const upload = createUploadMiddleware({ destination: uploadsDir });
  const requireAuth = createRequireAuth({ authState });
  const csrfProtection = createSessionCsrfProtection();
  const cloudflare = cloudflareOverride
    ?? createCloudflareClient({
      apiToken: CF_API_TOKEN,
      accountId: CF_ACCOUNT_ID,
    });

  const app = express();

  app.set('trust proxy', TRUST_PROXY);

  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'"],
        imgSrc: ["'self'", 'data:'],
        connectSrc: ["'self'"],
        // The Ko-fi support widget renders in its own browsing context, so only creating the
        // frame needs authorising here: the framed document is governed by ko-fi.com's own CSP.
        // script-src / img-src / connect-src stay closed on purpose.
        frameSrc: ["'self'", 'https://ko-fi.com'],
        baseUri: ["'self'"],
        objectSrc: ["'none'"],
        frameAncestors: ["'none'"],
        upgradeInsecureRequests: null,
      },
    },
  }));

  // Above cookieSession on purpose: the healthcheck runs every 30 s and has no business
  // minting a session cookie or a CSRF token thousands of times a day.
  app.get('/api/health', (req, res) => {
    res.set('Cache-Control', 'no-store');
    res.json({ status: 'ok' });
  });

  // express.json short-circuits on req._body, so the first parser wins. A 4 KB cap on the
  // auth endpoints keeps the wizard from reading half a megabyte per request.
  app.use('/api/auth', express.json({ limit: '4kb' }));

  app.use(express.json({ limit: '512kb' }));

  app.use(cookieSession({
    name: 'easypages_sid',
    keys: [finalSessionSecret],
    maxAge: 24 * 60 * 60 * 1000,
    httpOnly: true,
    secure: SESSION_COOKIE_SECURE,
    sameSite: 'lax',
    path: '/',
  }));

  // Public, and mounted above the `/api` wall below.
  app.use('/api/auth', createAuthRouter({
    authService,
    csrfProtection,
    loginRateLimit,
    requireAuth,
    resetLoginFailures,
  }));
  app.use(createLegacyAuthRouter());

  // The bundle is public: login is drawn by the SPA, so gating it would leave anonymous
  // visitors with nothing to load. It carries no secrets — no import.meta.env, no VITE_*
  // and no `define` in vite.config.js.
  app.use(staticLimiter, express.static(distDir, {
    index: false,
    setHeaders: (res, filePath) => {
      // The shell used to be uncacheable by accident, because it always came back with a
      // Set-Cookie. Cached, a stale index.html points at asset hashes that no longer exist.
      if (filePath.endsWith('.html')) {
        res.setHeader('Cache-Control', 'no-cache');
      }
    },
  }));

  // Allowlist-only: nothing under /api is public except what was mounted above. Never grant
  // access by file extension — that is how `/api/projects.json` becomes readable.
  app.use('/api', requireAuth, csrfProtection);
  app.use('/api', createProjectsRouter({ cloudflare, createProjectLimiter }));
  app.use('/api', createDeploymentsRouter({ cloudflare, upload, uploadLimiter, uploadsDir }));
  app.use('/api', createDomainsRouter({ cloudflare }));
  // `app.use`, so it answers every method: otherwise DELETE /api/nope falls through to the
  // SPA fallback and gets 200 + index.html.
  app.use('/api', createApiNotFoundHandler());

  // `app.get`, so only GET and HEAD can reach the shell (Express routes HEAD to GET).
  app.get('*', spaLimiter, (req, res, next) => {
    if (req.path.startsWith('/api') || looksLikeAsset(req.path)) {
      return next();
    }
    res.set('Cache-Control', 'no-cache');
    return res.sendFile(path.join(distDir, 'index.html'));
  });

  app.use((req, res) => {
    res.status(404).send('Not found');
  });

  app.use(createErrorHandler());

  return app;
};
