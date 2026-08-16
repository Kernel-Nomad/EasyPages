import { timingSafeEqualStrings } from '../../utils/timingSafe.js';
import {
  AuthValidationError,
  InvalidCurrentPasswordError,
  SetupAlreadyCompletedError,
  SetupRequiredError,
} from './errors.js';
import { hashPassword, verifyPassword } from './passwordHash.js';
import { validatePassword, validateUsername } from './validation.js';

/**
 * Lifecycle of the single operator credential.
 *
 * @param {{ store: object, authState: object }} deps
 */
export const createAuthService = ({ store, authState }) => {
  // Keeps two requests in this process off the create path at once. The cross-process race
  // is cut by link() in the store; this only avoids the wasted hash in the common case.
  let creating = false;

  const getCredentials = () => store.read();

  const isSetupComplete = () => store.exists();

  const createInitialCredentials = async ({ username, password }) => {
    const cleanUsername = validateUsername(username);
    validatePassword(password);

    if (creating) {
      throw new SetupAlreadyCompletedError();
    }
    creating = true;
    try {
      if (isSetupComplete()) {
        throw new SetupAlreadyCompletedError();
      }
      const passwordHash = await hashPassword(password);
      const record = store.create({ username: cleanUsername, passwordHash });
      authState.markConfigured(record);
      return record;
    } finally {
      creating = false;
    }
  };

  /** @returns {Promise<object|null>} the record on success, null on any failure. */
  const verifyCredentials = async ({ username, password }) => {
    const record = getCredentials();
    if (record === null) {
      return null;
    }

    const usernameOk = timingSafeEqualStrings(
      typeof username === 'string' ? username.trim() : '',
      record.username,
    );
    // The KDF always runs, even for the wrong username: otherwise response time gives away
    // which username is the right one.
    const passwordOk = await verifyPassword(
      typeof password === 'string' ? password : '',
      record.password_hash,
    );
    return usernameOk && passwordOk ? record : null;
  };

  const changeCredentials = async ({ currentPassword, newUsername, newPassword }) => {
    const record = getCredentials();
    if (record === null) {
      throw new SetupRequiredError();
    }

    if (!await verifyPassword(
      typeof currentPassword === 'string' ? currentPassword : '',
      record.password_hash,
    )) {
      throw new InvalidCurrentPasswordError();
    }

    const next = { ...record };
    let changed = false;

    if (newUsername !== undefined && newUsername !== null) {
      const cleanUsername = validateUsername(newUsername);
      if (cleanUsername !== record.username) {
        next.username = cleanUsername;
        changed = true;
      }
    }

    if (newPassword !== undefined && newPassword !== null) {
      validatePassword(newPassword);
      next.password_hash = await hashPassword(newPassword);
      changed = true;
    }

    if (!changed) {
      throw new AuthValidationError('There is nothing to change.');
    }

    // Invalidates every cookie issued before this change.
    next.token_version = record.token_version + 1;
    const saved = store.replace(next);
    authState.bumpTokenVersion(saved);
    return saved;
  };

  return {
    changeCredentials,
    createInitialCredentials,
    getAuthSnapshot: () => authState.getSnapshot(),
    getCredentials,
    isSetupComplete,
    verifyCredentials,
  };
};
