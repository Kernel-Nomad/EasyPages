import path from 'path';
import { fileURLToPath } from 'url';

const currentFilePath = fileURLToPath(import.meta.url);
const currentDir = path.dirname(currentFilePath);

export const appRootDir = path.resolve(currentDir, '../..');
export const repoEnvPath = path.resolve(appRootDir, '.env');
export const distDir = path.join(appRootDir, 'dist');

/**
 * Fallback for EASYPAGES_DATA_DIR. No longer optional: the credential lives there, so
 * without it the account would be recreated on every restart.
 */
export const defaultDataDir = path.join(appRootDir, 'data');

export const uploadsDir = path.join(appRootDir, 'uploads');
export const uploadsMulterDest = uploadsDir;
