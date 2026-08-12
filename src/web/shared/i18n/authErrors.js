import { isBackendUnreachableError } from '../../../api/client/easyPagesApi.js';

/**
 * The server's stable `code` is the contract, not its message: the UI picks its own string
 * from the code, so rewording a server message can never break a translation.
 */
const ERROR_KEYS = {
  invalid_credentials: 'auth_invalid_credentials',
  invalid_current_password: 'account_error_current_password',
  setup_already_completed: 'setup_already_done',
  setup_required: 'auth_generic_error',
  session_expired: 'auth_generic_error',
  validation_error: 'auth_validation_error',
  csrf_invalid: 'auth_csrf_invalid',
  storage_unwritable: 'auth_storage_unwritable',
  not_found: 'auth_generic_error',
};

/**
 * @param {unknown} error
 * @param {(key: string, options?: object) => string} t
 * @returns {string}
 */
export const authErrorMessage = (error, t) => {
  if (isBackendUnreachableError(error)) {
    return t('auth_backend_unreachable');
  }
  if (error?.code === 'rate_limited') {
    return t('auth_rate_limited', { seconds: error.retryAfter ?? 60 });
  }
  const key = ERROR_KEYS[error?.code];
  return key ? t(key) : t('auth_generic_error');
};
