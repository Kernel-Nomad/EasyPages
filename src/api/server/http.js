import { logServerError } from './logServerError.js';

export { createHttpError } from '../../core/errors/httpError.js';

/**
 * @param {import('express').Response} res
 * @param {unknown} error
 * @param {string} fallbackMessage
 * @param {import('express').Request} [req] Si se pasa y el status es 5xx, se registra en log.
 */
export const sendErrorResponse = (res, error, fallbackMessage, req) => {
  const hasExplicitStatus = Number.isInteger(error?.status) && error.status >= 400;
  const status = hasExplicitStatus ? error.status : 500;
  const message = hasExplicitStatus ? (error?.message || fallbackMessage) : fallbackMessage;
  const payload = { error: message };

  if (error?.details !== undefined) {
    payload.details = error.details;
  }

  if (status >= 500 && req) {
    logServerError(req, error, 'sendErrorResponse');
  }

  return res.status(status).json(payload);
};
