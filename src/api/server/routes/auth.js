import crypto from 'node:crypto';
import express from 'express';
import fs from 'fs';
import bcrypt from 'bcrypt';
import { isValidAuthPassBcryptFormat } from '../../../config/env.js';

/** Hash bcrypt válido (coste 10); equilibra tiempo de CPU si `AUTH_USER` no coincide. */
const BCRYPT_TIMING_DUMMY_HASH =
  '$2b$10$/2hhSBXRvOovaLX9riwGe.FkYSS5gEgrQVwgoydJqirNh6Z9BozLW';

export const verifyPassword = async (plainPassword, storedAuthPass) => {
  if (typeof plainPassword !== 'string' || typeof storedAuthPass !== 'string') {
    return false;
  }
  if (isValidAuthPassBcryptFormat(storedAuthPass)) {
    try {
      return await bcrypt.compare(plainPassword, storedAuthPass);
    } catch {
      return false;
    }
  }
  const a = Buffer.from(plainPassword, 'utf8');
  const b = Buffer.from(storedAuthPass, 'utf8');
  if (a.length !== b.length || a.length === 0) {
    return false;
  }
  try {
    return crypto.timingSafeEqual(a, b);
  } catch {
    return false;
  }
};

const escapeHtmlAttr = (value) =>
  String(value)
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;');

const CSRF_PLACEHOLDER = '<!--EASYPAGES_CSRF_INPUT-->';

export const createAuthRouter = ({
  csrfProtection,
  loginLimiter,
  requireAuth,
  authUser,
  authPass,
  loginHtmlPath,
}) => {
  const router = express.Router();

  let cachedLoginTemplate;
  const loadLoginTemplate = () => {
    if (cachedLoginTemplate === undefined) {
      const raw = fs.readFileSync(loginHtmlPath, 'utf8');
      if (!raw.includes(CSRF_PLACEHOLDER)) {
        throw new Error('Falta el marcador CSRF en login.html');
      }
      cachedLoginTemplate = raw;
    }
    return cachedLoginTemplate;
  };

  router.get('/login', csrfProtection, (req, res) => {
    if (req.session.authenticated) {
      return res.redirect('/');
    }

    try {
      let html = loadLoginTemplate();
      const token = escapeHtmlAttr(req.csrfToken());
      const csrfField = `<input type="hidden" name="_csrf" value="${token}">`;
      html = html.replace(CSRF_PLACEHOLDER, csrfField);
      res.send(html);
    } catch (error) {
      console.error(
        '[EasyPages] Error sirviendo /login:',
        error instanceof Error ? error.message : error,
      );
      res.status(500).send('Error cargando login');
    }
  });

  router.post('/login', loginLimiter, csrfProtection, async (req, res) => {
    const { username, password } = req.body;
    const pwd = typeof password === 'string' ? password : '';
    const userMatches = username === authUser;
    const passwordOk = userMatches
      ? await verifyPassword(pwd, authPass)
      : await verifyPassword('x', BCRYPT_TIMING_DUMMY_HASH);

    if (userMatches && passwordOk) {
      req.session = { authenticated: true, user: username };
      return res.redirect('/');
    }

    res.redirect('/login?error=1');
  });

  router.post('/logout', csrfProtection, (req, res) => {
    req.session = null;
    res.redirect('/login');
  });

  router.get('/api/csrf-token', requireAuth, csrfProtection, (req, res) => {
    res.json({ csrfToken: req.csrfToken() });
  });

  return router;
};
