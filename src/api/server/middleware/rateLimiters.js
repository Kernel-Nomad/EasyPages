import rateLimit from 'express-rate-limit';

export const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    res.redirect(302, '/login?error=rate');
  },
});

export const uploadLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 10,
  message: { error: 'Límite de subidas excedido. Intente más tarde.' },
  standardHeaders: true,
  legacyHeaders: false,
});

export const createProjectLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { error: 'Demasiadas solicitudes de creación de proyectos.' },
  standardHeaders: true,
  legacyHeaders: false,
});
