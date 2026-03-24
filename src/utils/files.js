import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

export const ensureDirectory = (directoryPath) => {
  if (!fs.existsSync(directoryPath)) {
    fs.mkdirSync(directoryPath, { recursive: true });
  }
};

export const resolveSessionSecret = (secretFilePath, initialSessionSecret) => {
  if (initialSessionSecret) {
    return initialSessionSecret.trim();
  }

  const hasPersistedDataDir = Boolean(process.env.EASYPAGES_DATA_DIR?.trim());
  const isProduction = process.env.NODE_ENV === 'production';

  if (isProduction && !hasPersistedDataDir) {
    throw new Error(
      'En producción debe definir SESSION_SECRET en el entorno, o bien EASYPAGES_DATA_DIR con un volumen persistente para leer o generar .session_secret.',
    );
  }

  let finalSessionSecret;
  if (fs.existsSync(secretFilePath)) {
    try {
      finalSessionSecret = fs.readFileSync(secretFilePath, 'utf-8').trim();
    } catch (error) {
      console.warn(
        '[EasyPages] No se pudo leer .session_secret:',
        error instanceof Error ? error.message : error,
      );
    }
  }

  if (!finalSessionSecret) {
    finalSessionSecret = crypto.randomBytes(32).toString('hex');
    if (isProduction && hasPersistedDataDir) {
      console.warn(
        '[EasyPages] SESSION_SECRET no estaba definido: se generó y guardó .session_secret bajo EASYPAGES_DATA_DIR (primera ejecución o volumen vacío).',
      );
    }
    try {
      fs.writeFileSync(secretFilePath, finalSessionSecret, 'utf-8');
    } catch (error) {
      console.warn(
        '[EasyPages] No se pudo escribir .session_secret; el secreto solo vivirá en memoria hasta reiniciar:',
        error instanceof Error ? error.message : error,
      );
    }
  }

  return finalSessionSecret;
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
