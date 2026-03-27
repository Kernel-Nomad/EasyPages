import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

export const ensureDirectory = (directoryPath) => {
  if (!fs.existsSync(directoryPath)) {
    fs.mkdirSync(directoryPath, { recursive: true });
  }
};

/**
 * Secreto para firmar la cookie de sesión (`cookie-session`).
 * Si `SESSION_SECRET` no está definido, genera uno en memoria y avisa: las sesiones no sobreviven al reinicio.
 * @param {string | undefined} sessionSecretFromEnv Valor ya normalizado (p. ej. desde `trimEnv`).
 * @returns {string}
 */
export const resolveCookieSessionSecret = (sessionSecretFromEnv) => {
  const trimmed =
    typeof sessionSecretFromEnv === 'string' ? sessionSecretFromEnv.trim() : '';
  if (trimmed) {
    return trimmed;
  }

  console.warn(
    '[EasyPages] SESSION_SECRET no definido: se usa un secreto aleatorio solo en memoria. Las sesiones dejarán de ser válidas al reiniciar; con varias réplicas define el mismo SESSION_SECRET en el entorno.',
  );
  return crypto.randomBytes(32).toString('hex');
};

export const safeUnlink = (filePath, uploadsDir) => {
  if (!filePath) {
    return;
  }

  try {
    const normalizedPath = path.resolve(filePath);
    if (isPathInsideDirectory(normalizedPath, uploadsDir) && fs.existsSync(normalizedPath)) {
      fs.unlinkSync(normalizedPath);
    }
  } catch (error) {
    console.error('Error al eliminar archivo temporal:', error);
  }
};

export const isPathInsideDirectory = (targetPath, directoryPath) => {
  const normalizedDirectory = path.resolve(directoryPath);
  const normalizedTarget = path.resolve(targetPath);
  const relativePath = path.relative(normalizedDirectory, normalizedTarget);

  return relativePath === '' || (!relativePath.startsWith('..') && !path.isAbsolute(relativePath));
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
