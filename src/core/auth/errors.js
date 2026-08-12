/**
 * Authentication domain errors.
 *
 * `code` is the stable contract with the SPA, which maps it to a translation key. Never put
 * a submitted value in `message`: 4xx messages reach the client verbatim.
 */

export class AuthError extends Error {
  constructor(message, code) {
    super(message);
    this.name = new.target.name;
    this.code = code;
  }
}

export class SetupAlreadyCompletedError extends AuthError {
  constructor() {
    super('Initial setup has already been completed.', 'setup_already_completed');
  }
}

export class SetupRequiredError extends AuthError {
  constructor() {
    super('Initial setup is pending.', 'setup_required');
  }
}

/** Says nothing about which of the two was wrong. */
export class InvalidCredentialsError extends AuthError {
  constructor() {
    super('Wrong username or password.', 'invalid_credentials');
  }
}

export class InvalidCurrentPasswordError extends AuthError {
  constructor() {
    super('The current password is not correct.', 'invalid_current_password');
  }
}

/** Names the rule that failed, never the value. */
export class AuthValidationError extends AuthError {
  constructor(message) {
    super(message, 'validation_error');
  }
}

/** Usually a bind mount owned by root while the container runs as uid 1000. */
export class CredentialStorageError extends AuthError {
  constructor(message, options) {
    super(message, 'storage_unwritable');
    if (options?.cause !== undefined) {
      this.cause = options.cause;
    }
  }
}
