import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

export const ensureDirectory = (directoryPath) => {
  if (!fs.existsSync(directoryPath)) {
    fs.mkdirSync(directoryPath, { recursive: true });
  }
};

/** Opaque file under EASYPAGES_DATA_DIR used to sign cookies when SESSION_SECRET is unset. */
export const SESSION_SECRET_FILENAME = '.easypages-session-secret';

const MIN_SESSION_SECRET_FILE_LENGTH = 32;

const readTrimmedSecretLine = (raw) => {
  const line = String(raw).split(/\r?\n/)[0]?.trim() ?? '';
  return line;
};

const readValidSecretFromFile = (secretPath) => {
  const raw = fs.readFileSync(secretPath, 'utf8');
  const line = readTrimmedSecretLine(raw);
  return line.length >= MIN_SESSION_SECRET_FILE_LENGTH ? line : '';
};

/**
 * Key used to sign the session cookie. Order: SESSION_SECRET, then a file in dataDir, then
 * a random in-memory key (dev only).
 * @param {{ sessionSecretFromEnv?: string, dataDir?: string }} [options]
 * @returns {string}
 */
export const resolveCookieSessionSecret = ({
  sessionSecretFromEnv,
  dataDir,
} = {}) => {
  const trimmed =
    typeof sessionSecretFromEnv === 'string' ? sessionSecretFromEnv.trim() : '';
  if (trimmed) {
    return trimmed;
  }

  const dir = typeof dataDir === 'string' ? dataDir.trim() : '';
  if (dir) {
    ensureDirectory(dir);
    const secretPath = path.join(dir, SESSION_SECRET_FILENAME);
    try {
      const fromFile = readValidSecretFromFile(secretPath);
      if (fromFile) {
        try {
          fs.chmodSync(secretPath, 0o600);
        } catch {
          // ignore (e.g. Windows, or a filesystem without chmod)
        }
        return fromFile;
      }
    } catch (e) {
      if (e.code !== 'ENOENT') {
        throw e;
      }
    }

    const secret = crypto.randomBytes(32).toString('hex');
    try {
      fs.writeFileSync(secretPath, `${secret}\n`, { encoding: 'utf8', mode: 0o600, flag: 'wx' });
    } catch (e) {
      if (e.code === 'EEXIST') {
        const again = readValidSecretFromFile(secretPath);
        if (again) {
          return again;
        }
        throw new Error(
          `EasyPages: ${secretPath} exists but does not contain a valid secret (>= ${MIN_SESSION_SECRET_FILE_LENGTH} characters).`,
          { cause: e },
        );
      }
      throw e;
    }
    try {
      fs.chmodSync(secretPath, 0o600);
    } catch {
      // ignore
    }
    return secret;
  }

  console.warn(
    '[EasyPages] No SESSION_SECRET and no EASYPAGES_DATA_DIR: using a random in-memory secret. ' +
      'Sessions will not survive a restart.',
  );
  return crypto.randomBytes(32).toString('hex');
};

export const safeUnlink = (filePath, uploadsDir) => {
  if (!filePath || !uploadsDir) {
    return;
  }

  try {
    // Resolve the real path of the target file to avoid symlink-based escapes.
    const resolvedFilePath = fs.realpathSync.native
      ? fs.realpathSync.native(filePath)
      : fs.realpathSync(filePath);

    if (isPathInsideDirectory(resolvedFilePath, uploadsDir) && fs.existsSync(resolvedFilePath)) {
      fs.unlinkSync(resolvedFilePath);
    }
  } catch (error) {
    // realpathSync or unlinkSync may throw; log and continue without leaking details to the client.
    console.error('Could not delete the temporary file:', error);
  }
};

export const isPathInsideDirectory = (targetPath, directoryPath) => {
  try {
    const realDirectory = fs.realpathSync.native
      ? fs.realpathSync.native(directoryPath)
      : fs.realpathSync(directoryPath);
    const realTarget = fs.realpathSync.native
      ? fs.realpathSync.native(targetPath)
      : fs.realpathSync(targetPath);

    const relativePath = path.relative(realDirectory, realTarget);

    return (
      relativePath === '' ||
      (!relativePath.startsWith('..') && !path.isAbsolute(relativePath))
    );
  } catch {
    // If either path cannot be resolved (for example, target does not exist),
    // treat it as being outside the directory.
    return false;
  }
};

export const getMimeType = (filename) => {
  const ext = path.extname(filename).toLowerCase();
  const types = {
    '.html': 'text/html',
    '.css': 'text/css',
    '.js': 'application/javascript',
    '.json': 'application/json',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon',
    '.txt': 'text/plain',
    '.xml': 'application/xml',
    '.pdf': 'application/pdf',
    '.zip': 'application/zip',
  };

  return types[ext] || 'application/octet-stream';
};

export const isSafeZipEntry = (entryName, virtualRoot = '/safe/root') => {
  return normalizeZipEntryPath(entryName, virtualRoot) !== null;
};

export const normalizeZipEntryPath = (entryName, virtualRoot = '/safe/root') => {
  if (!entryName || entryName.includes('\0')) {
    return null;
  }

  const normalizedEntryName = entryName.replace(/\\/g, '/');
  const resolvedPath = path.posix.resolve(virtualRoot, normalizedEntryName);
  const relativePath = path.posix.relative(virtualRoot, resolvedPath);

  if (!relativePath || relativePath.startsWith('..') || path.posix.isAbsolute(relativePath)) {
    return null;
  }

  if (relativePath.split('/').some((segment) => segment === '.' || segment === '..' || segment === '')) {
    return null;
  }

  return `/${relativePath}`;
};
