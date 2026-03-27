import { logServerError } from '../logServerError.js';

const isApiRequest = (req) =>
  typeof req.originalUrl === 'string' && req.originalUrl.startsWith('/api');

export const createErrorHandler = () => (err, req, res, next) => {
  if (res.headersSent) {
    logServerError(req, err, 'errorHandler (headers already sent)');
    return;
  }

  const api = isApiRequest(req);
  const isCsrf = err?.code === 'EBADCSRFTOKEN';

  if (isCsrf) {
    if (api) {
      res.status(403).json({ error: err?.message || 'Token CSRF inválido' });
    } else {
      res.status(403).send('Token CSRF inválido');
    }
    return;
  }

  const status = Number.isInteger(err?.status) && err.status >= 400 ? err.status : 500;
  if (status >= 500) {
    logServerError(req, err, api ? 'errorHandler API' : 'errorHandler');
  }

  if (api) {
    const message =
      status === 500
        ? 'Error interno del servidor'
        : (err?.message || 'La petición ha fallado.');
    const payload = { error: message };
    if (err?.details !== undefined) {
      payload.details = err.details;
    }
    res.status(status).json(payload);
    return;
  }

  res.status(status).send(status === 500 ? 'Error interno del servidor' : (err?.message || 'Error'));
};
