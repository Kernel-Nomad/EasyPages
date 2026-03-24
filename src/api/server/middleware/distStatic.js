import express from 'express';

/** Rutas bajo `dist/` accesibles sin sesión (pantalla de login). */
const LOGIN_PUBLIC_PATHS = new Set(['/login.css', '/login-error.js']);

/**
 * Sirve `dist/` con `index: false`, pero exige sesión salvo assets de login.
 * Evita que anónimos descarguen `index.html` o el bundle (`/assets/*`) sin autenticación.
 */
export const createDistStatic = ({ distDir, requireAuth }) => {
  const staticMw = express.static(distDir, { index: false });
  return (req, res, next) => {
    if (LOGIN_PUBLIC_PATHS.has(req.path)) {
      return staticMw(req, res, next);
    }
    return requireAuth(req, res, () => staticMw(req, res, next));
  };
};
