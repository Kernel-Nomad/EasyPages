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

/**
 * Uploads live under the data directory so Docker volume mounts keep them (and so leftover
 * ZIPs do not fill the container writable layer when only `/data` is mounted).
 */
export const resolveUploadsDir = (dataDir = defaultDataDir) => path.join(dataDir, 'uploads');
