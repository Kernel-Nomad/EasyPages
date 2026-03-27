import crypto from 'crypto';
import express from 'express';
import fs from 'fs';
import bcrypt from 'bcrypt';

const verifyPassword = (plainPassword, hashedPassword) => {
  if (typeof plainPassword !== 'string' || typeof hashedPassword !== 'string') {
    return false;
  }
  try {
    return bcrypt.compareSync(plainPassword, hashedPassword);
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

  router.get('/login', csrfProtection, (req, res) => {
    if (req.session.authenticated) {
      return res.redirect('/');
    }

    try {
      let html = fs.readFileSync(loginHtmlPath, 'utf8');
      if (!html.includes(CSRF_PLACEHOLDER)) {
        throw new Error('Falta el marcador CSRF en login.html');
      }
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

  router.post('/login', loginLimiter, csrfProtection, (req, res) => {
    const { username, password } = req.body;

    if (username === authUser && verifyPassword(password, authPass)) {
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
