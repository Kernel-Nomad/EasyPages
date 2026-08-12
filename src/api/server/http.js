import { logServerError } from './logServerError.js';

export { createHttpError } from '../../core/errors/httpError.js';

/**
 * @param {import('express').Response} res
 * @param {unknown} error
 * @param {string} fallbackMessage
 * @param {import('express').Request} [req] When given, 5xx responses are logged.
 */
export const sendErrorResponse = (res, error, fallbackMessage, req) => {
  const hasExplicitStatus = Number.isInteger(error?.status) && error.status >= 400;
  const status = hasExplicitStatus ? error.status : 500;
  const message = hasExplicitStatus ? (error?.message || fallbackMessage) : fallbackMessage;
  const payload = { error: message };

  // Same rule as the terminal error handler: on a 5xx the code only travels when the error
  // opted in with `expose`.
  if (typeof error?.code === 'string' && (status < 500 || error?.expose === true)) {
    payload.code = error.code;
  }

  if (error?.details !== undefined) {
    payload.details = error.details;
  }

  if (status >= 500 && req) {
    logServerError(req, error, 'sendErrorResponse');
  }

  return res.status(status).json(payload);
};
