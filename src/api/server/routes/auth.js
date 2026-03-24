import crypto from 'crypto';
import express from 'express';
import fs from 'fs';

const digestUtf8Equal = (a, b) => {
  const da = crypto.createHash('sha256').update(String(a), 'utf8').digest();
  const db = crypto.createHash('sha256').update(String(b), 'utf8').digest();
  return crypto.timingSafeEqual(da, db);
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

    if (digestUtf8Equal(username, authUser) && digestUtf8Equal(password, authPass)) {
      return req.session.regenerate((regenerateError) => {
        if (regenerateError) {
          res.status(500).send('Error iniciando sesión');
          return;
        }

        req.session.authenticated = true;
        req.session.user = username;
        req.session.save((saveError) => {
          if (saveError) {
            res.status(500).send('Error iniciando sesión');
            return;
          }
          res.redirect('/');
        });
      });
    }

    res.redirect('/login?error=1');
  });

  router.post('/logout', csrfProtection, (req, res) => {
    req.session.destroy((error) => {
      if (error) {
        res.status(500).send('Error cerrando sesión');
        return;
      }
      res.redirect('/login');
    });
  });

  router.get('/api/csrf-token', requireAuth, csrfProtection, (req, res) => {
    res.json({ csrfToken: req.csrfToken() });
  });

  return router;
};
