import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { ensureDirectory } from '../../utils/files.js';
import { CredentialStorageError, SetupAlreadyCompletedError } from './errors.js';

/**
 * The single operator credential, persisted as one small JSON file.
 *
 * There is no database in EasyPages, so what SQLite would have given for free — "create it
 * or tell me it already exists", against two tabs running the wizard at once — comes from
 * `link()` instead. All I/O is synchronous: the file is a few hundred bytes.
 */

export const CREDENTIALS_FILENAME = 'credentials.json';
export const CREDENTIALS_SCHEMA_VERSION = 1;

const FILE_MODE = 0o600;

const isValidRecord = (value) =>
  Boolean(value)
  && typeof value === 'object'
  && typeof value.username === 'string'
  && value.username.length > 0
  && typeof value.password_hash === 'string'
  && value.password_hash.length > 0
  && Number.isInteger(value.token_version)
  && value.token_version > 0;

const unwritableError = (dataDir, cause) =>
  new CredentialStorageError(
    `EasyPages: cannot write to ${dataDir}. With Docker this is usually the mounted volume: `
    + 'the container runs as uid 1000, so run `chown -R 1000:1000 <directory>` on the host '
    + 'and restart.',
    { cause },
  );

const corruptCredentialsError = (filePath, cause) =>
  new CredentialStorageError(
    `EasyPages: ${filePath} is present but unreadable. Delete that file and re-run the `
    + 'setup wizard (Docker: rm ./easypages-data/credentials.json).',
    { cause },
  );

export const createCredentialStore = ({ dataDir }) => {
  const filePath = path.join(dataDir, CREDENTIALS_FILENAME);

  const writeTempFile = (record) => {
    // Unique per attempt so two concurrent submissions cannot share a temp file.
    const tempPath = `${filePath}.${process.pid}.${crypto.randomBytes(6).toString('hex')}.tmp`;
    const payload = `${JSON.stringify(record, null, 2)}\n`;
    const handle = fs.openSync(tempPath, 'wx', FILE_MODE);
    try {
      fs.writeFileSync(handle, payload, 'utf8');
      // fsync before publishing: the target must never appear half-written.
      fs.fsyncSync(handle);
    } finally {
      fs.closeSync(handle);
    }
    return tempPath;
  };

  /**
   * @returns {object|null} the record, or null when the file is absent.
   * @throws {CredentialStorageError} when the file exists but is corrupt / unexpected.
   */
  const read = () => {
    let raw;
    try {
      raw = fs.readFileSync(filePath, 'utf8');
    } catch (error) {
      if (error.code === 'ENOENT') {
        return null;
      }
      throw error;
    }

    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch (error) {
      // Do not reopen the wizard: create() would hit EEXIST on the leftover file.
      console.error(
        `[EasyPages] ${filePath} does not contain valid JSON. Delete it to re-run setup.`,
      );
      throw corruptCredentialsError(filePath, error);
    }

    if (!isValidRecord(parsed)) {
      console.error(
        `[EasyPages] ${filePath} is not in the expected format. Delete it to re-run setup.`,
      );
      throw corruptCredentialsError(filePath);
    }

    return parsed;
  };

  /** True when the credential file is on disk (even if corrupt). */
  const exists = () => fs.existsSync(filePath);

  /** @throws {SetupAlreadyCompletedError} when a credential is already there. */
  const create = ({ username, passwordHash }) => {
    ensureDirectory(dataDir);
    const now = new Date().toISOString();
    const record = {
      version: CREDENTIALS_SCHEMA_VERSION,
      username,
      password_hash: passwordHash,
      token_version: 1,
      created_at: now,
      updated_at: now,
    };

    let tempPath;
    try {
      tempPath = writeTempFile(record);
    } catch (error) {
      throw unwritableError(dataDir, error);
    }

    try {
      // link() is atomic and fails with EEXIST if the target exists. rename() would clobber
      // whoever won the race in silence.
      fs.linkSync(tempPath, filePath);
    } catch (error) {
      if (error.code === 'EEXIST') {
        throw new SetupAlreadyCompletedError();
      }
      // Some network and overlay mounts refuse hard links. O_CREAT|O_EXCL on the target
      // keeps the EEXIST guarantee, giving up only the never-half-written one.
      if (['EPERM', 'EXDEV', 'ENOSYS', 'ENOTSUP', 'EOPNOTSUPP'].includes(error.code)) {
        try {
          fs.writeFileSync(filePath, `${JSON.stringify(record, null, 2)}\n`, {
            encoding: 'utf8',
            mode: FILE_MODE,
            flag: 'wx',
          });
        } catch (fallbackError) {
          if (fallbackError.code === 'EEXIST') {
            throw new SetupAlreadyCompletedError();
          }
          throw unwritableError(dataDir, fallbackError);
        }
      } else {
        throw unwritableError(dataDir, error);
      }
    } finally {
      try {
        fs.unlinkSync(tempPath);
      } catch {
        // A leftover temp file is harmless.
      }
    }

    return record;
  };

  /** Here rename() is right: replacing is the intent. */
  const replace = (record) => {
    ensureDirectory(dataDir);
    const next = { ...record, updated_at: new Date().toISOString() };
    let tempPath;
    try {
      tempPath = writeTempFile(next);
      fs.renameSync(tempPath, filePath);
    } catch (error) {
      if (tempPath) {
        try {
          fs.unlinkSync(tempPath);
        } catch {
          // ignore
        }
      }
      throw unwritableError(dataDir, error);
    }
    return next;
  };

  /**
   * Boot-time probe. Without it, the first symptom of an unwritable volume is the setup
   * wizard failing in the browser with nothing in the logs.
   */
  const assertWritable = () => {
    try {
      ensureDirectory(dataDir);
    } catch (error) {
      throw unwritableError(dataDir, error);
    }

    const probePath = path.join(dataDir, `.easypages-write-probe-${process.pid}`);
    try {
      fs.writeFileSync(probePath, '', { mode: FILE_MODE, flag: 'w' });
    } catch (error) {
      throw unwritableError(dataDir, error);
    } finally {
      try {
        fs.unlinkSync(probePath);
      } catch {
        // ignore
      }
    }
  };

  return { assertWritable, create, exists, filePath, read, replace };
};
