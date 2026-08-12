import {
  PASSWORD_MAX_LEN,
  PASSWORD_MIN_LEN,
  USERNAME_CHARSET_PATTERN,
  USERNAME_MAX_LEN,
  USERNAME_MIN_LEN,
} from '../../shared/authPolicy.js';
import { AuthValidationError } from './errors.js';

const USERNAME_RE = new RegExp(`^${USERNAME_CHARSET_PATTERN}$`);

/** @throws {AuthValidationError} naming the rule, never echoing the value. */
export const validateUsername = (value) => {
  const cleaned = typeof value === 'string' ? value.trim() : '';
  if (cleaned.length < USERNAME_MIN_LEN || cleaned.length > USERNAME_MAX_LEN) {
    throw new AuthValidationError(
      `The username must be between ${USERNAME_MIN_LEN} and ${USERNAME_MAX_LEN} characters.`,
    );
  }
  if (!USERNAME_RE.test(cleaned)) {
    throw new AuthValidationError('The username only accepts letters, digits and . _ @ + -');
  }
  return cleaned;
};

/** Not trimmed: leading and trailing whitespace is part of the password. */
export const validatePassword = (value) => {
  if (typeof value !== 'string' || value.length < PASSWORD_MIN_LEN) {
    throw new AuthValidationError(
      `The password must be at least ${PASSWORD_MIN_LEN} characters.`,
    );
  }
  if (value.length > PASSWORD_MAX_LEN) {
    throw new AuthValidationError(
      `The password cannot exceed ${PASSWORD_MAX_LEN} characters.`,
    );
  }
  return value;
};
