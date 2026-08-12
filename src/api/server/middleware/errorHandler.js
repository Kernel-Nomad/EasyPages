import { logServerError } from '../logServerError.js';

const isApiRequest = (req) =>
  typeof req.originalUrl === 'string' && req.originalUrl.startsWith('/api');

// The fourth parameter is what makes Express treat this as an error handler; it is unused
// by construction, hence the `_` prefix.
export const createErrorHandler = () => (err, req, res, _next) => {
  if (res.headersSent) {
    logServerError(req, err, 'errorHandler (headers already sent)');
    return;
  }

  const api = isApiRequest(req);
  const isCsrf = err?.code === 'EBADCSRFTOKEN';

  if (isCsrf) {
    if (api) {
      // `csrf_invalid` rather than the raw EBADCSRFTOKEN: it tells the SPA to refresh the
      // token from /api/auth/status and retry.
      res.status(403).json({ error: err?.message || 'Invalid CSRF token', code: 'csrf_invalid' });
    } else {
      res.status(403).send('Invalid CSRF token');
    }
    return;
  }

  const status = Number.isInteger(err?.status) && err.status >= 400 ? err.status : 500;
  if (status >= 500) {
    logServerError(req, err, api ? 'errorHandler API' : 'errorHandler');
  }

  // Opt-in for the few 5xx errors whose whole value is the message — a configuration problem
  // the operator has to fix. Only errors built in this codebase set it.
  const expose = err?.expose === true;

  if (api) {
    const message =
      status === 500 && !expose
        ? 'Internal server error'
        : (err?.message || 'The request failed.');
    const payload = { error: message };
    // The stable code is the contract with the SPA — `error` is for curl and logs. Not
    // forwarded on a 500 unless the error opted in.
    if ((status < 500 || expose) && typeof err?.code === 'string') {
      payload.code = err.code;
    }
    if (err?.details !== undefined) {
      payload.details = err.details;
    }
    res.status(status).json(payload);
    return;
  }

  res.status(status).send(status === 500 && !expose ? 'Internal server error' : (err?.message || 'Error'));
};
