import { logServerError } from './logServerError.js';

export { createHttpError } from '../../core/errors/httpError.js';

/**
 * Shared path for route-level errors. Same masking rules as the terminal errorHandler:
 * 5xx messages (and details) stay internal unless `expose === true`.
 *
 * @param {import('express').Response} res
 * @param {unknown} error
 * @param {string} fallbackMessage
 * @param {import('express').Request} [req] When given, 5xx responses are logged.
 */
export const sendErrorResponse = (res, error, fallbackMessage, req) => {
  const hasExplicitStatus = Number.isInteger(error?.status) && error.status >= 400;
  const status = hasExplicitStatus ? error.status : 500;
  const expose = error?.expose === true;
  const message = status >= 500 && !expose
    ? 'Internal server error'
    : (hasExplicitStatus ? (error?.message || fallbackMessage) : fallbackMessage);
  const payload = { error: message };

  // Same rule as the terminal error handler: on a 5xx the code only travels when the error
  // opted in with `expose`.
  if (typeof error?.code === 'string' && (status < 500 || expose)) {
    payload.code = error.code;
  }

  if (error?.details !== undefined && (status < 500 || expose)) {
    payload.details = error.details;
  }

  if (status >= 500 && req) {
    logServerError(req, error, 'sendErrorResponse');
  }

  return res.status(status).json(payload);
};

/** Validation failures on dashboard routes: 400 + stable code (auth keeps 422). */
export const sendValidationError = (res, message, code = 'validation_error') =>
  res.status(400).json({ error: message, code });
