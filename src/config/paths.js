import path from 'path';
import { fileURLToPath } from 'url';

const currentFilePath = fileURLToPath(import.meta.url);
const currentDir = path.dirname(currentFilePath);

export const appRootDir = path.resolve(currentDir, '../..');
export const repoEnvPath = path.resolve(appRootDir, '.env');
export const distDir = path.join(appRootDir, 'dist');
export const loginHtmlPath = path.join(appRootDir, 'src/api/server/views/login.html');

export const uploadsDir = path.join(appRootDir, 'uploads');
export const uploadsMulterDest = uploadsDir;
