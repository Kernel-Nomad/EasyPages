/**
 * Prefer a translated string when the backend sent a known stable code.
 * The SPA keys off `code`, never the English `error` text.
 */

const DASHBOARD_I18N_ERROR_CODES = new Set([
  'validation_error',
  'invalid_domain',
  'rate_limited',
  'payload_too_large',
  'cf_unauthorized',
  'cf_forbidden',
  'cf_rate_limited',
  'cf_timeout',
  'cf_unreachable',
  'cf_upstream',
  'cf_account_not_found',
  'cf_account_ambiguous',
  'csrf_invalid',
]);

/**
 * @param {unknown} error
 * @param {string} fallbackKey
 * @param {(key: string, options?: object) => string} t
 * @returns {string}
 */
export const dashboardErrorMessage = (error, fallbackKey, t) => {
  if (error?.code && DASHBOARD_I18N_ERROR_CODES.has(error.code)) {
    if (error.code === 'rate_limited' || error.code === 'cf_rate_limited') {
      return t(error.code === 'cf_rate_limited' ? 'cf_rate_limited' : 'rate_limited', {
        seconds: error.retryAfter ?? 60,
      });
    }
    return t(error.code);
  }
  return t(fallbackKey);
};
