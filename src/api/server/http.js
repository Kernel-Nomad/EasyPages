export { createHttpError } from '../../core/errors/httpError.js';

export const sendErrorResponse = (res, error, fallbackMessage) => {
  const hasExplicitStatus = Number.isInteger(error?.status) && error.status >= 400;
  const status = hasExplicitStatus ? error.status : 500;
  const message = hasExplicitStatus ? (error?.message || fallbackMessage) : fallbackMessage;
  const payload = { error: message };

  if (error?.details !== undefined) {
    payload.details = error.details;
  }

  return res.status(status).json(payload);
};
