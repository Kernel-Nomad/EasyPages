export const createHttpError = (status, message, options = {}) => {
  const error = new Error(message);
  error.status = status;

  if (typeof options === 'object' && options !== null && !Array.isArray(options)) {
    if (typeof options.code === 'string') {
      error.code = options.code;
    }
    if (options.details !== undefined) {
      error.details = options.details;
    }
    if (options.expose === true) {
      error.expose = true;
    }
  } else if (options !== undefined) {
    // Legacy call shape: createHttpError(status, message, details)
    error.details = options;
  }

  return error;
};
