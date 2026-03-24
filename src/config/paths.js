import path from 'path';
import { fileURLToPath } from 'url';

const currentFilePath = fileURLToPath(import.meta.url);
const currentDir = path.dirname(currentFilePath);

export const appRootDir = path.resolve(currentDir, '../..');
export const repoEnvPath = path.resolve(appRootDir, '.env');
export const distDir = path.join(appRootDir, 'dist');
export const loginHtmlPath = path.join(appRootDir, 'src/api/server/views/login.html');

const easypagesDataDir = process.env.EASYPAGES_DATA_DIR?.trim();
export const sessionSecretPath = easypagesDataDir
  ? path.join(easypagesDataDir, '.session_secret')
  : path.join(appRootDir, '.session_secret');
export const uploadsDir = path.join(appRootDir, 'uploads');
export const uploadsMulterDest = uploadsDir;
export const sessionsStorePath = easypagesDataDir
  ? path.join(easypagesDataDir, 'sessions')
  : path.join(appRootDir, 'sessions');
