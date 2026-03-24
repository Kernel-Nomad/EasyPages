import express from 'express';
import fs from 'fs';

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
      const csrfField = `<input type="hidden" name="_csrf" value="${req.csrfToken()}">`;
      html = html.replace('<form action="/login" method="POST">', `<form action="/login" method="POST">${csrfField}`);
      res.send(html);
    } catch {
      res.status(500).send('Error cargando login');
    }
  });

  router.post('/login', loginLimiter, csrfProtection, (req, res) => {
    const { username, password } = req.body;

    if (username === authUser && password === authPass) {
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
