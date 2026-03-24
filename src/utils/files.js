import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

export const ensureDirectory = (directoryPath) => {
  if (!fs.existsSync(directoryPath)) {
    fs.mkdirSync(directoryPath, { recursive: true });
  }
};

export const resolveSessionSecret = (secretFilePath, initialSessionSecret) => {
  let finalSessionSecret = initialSessionSecret;

  if (!finalSessionSecret) {
    if (fs.existsSync(secretFilePath)) {
      try {
        finalSessionSecret = fs.readFileSync(secretFilePath, 'utf-8');
      } catch {}
    }

    if (!finalSessionSecret) {
      finalSessionSecret = crypto.randomBytes(32).toString('hex');
      try {
        fs.writeFileSync(secretFilePath, finalSessionSecret);
      } catch {}
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
