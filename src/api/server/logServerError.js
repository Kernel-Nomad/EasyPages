/**
 * Registra errores 5xx en servidor (sin cuerpos de petición ni cabeceras sensibles).
 * @param {import('express').Request | undefined} req
 * @param {unknown} err
 * @param {string} [contextLabel]
 */
export const logServerError = (req, err, contextLabel = '') => {
  const method = req?.method ?? '?';
  const url = typeof req?.originalUrl === 'string' ? req.originalUrl : (req?.url ?? '?');
  const label = contextLabel ? ` (${contextLabel})` : '';
  const message = err instanceof Error ? err.message : String(err);
  const stack = err instanceof Error ? err.stack : undefined;
  console.error(`[EasyPages] Error del servidor${label} ${method} ${url} ${message}`);
  if (stack) {
    console.error(stack);
  }
};
