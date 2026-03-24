import path from 'path';
import { fileURLToPath } from 'url';
import { startServer } from './core/server/startServer.js';

export { startServer } from './core/server/startServer.js';

const isDirectExecution =
  typeof process.argv[1] === 'string'
  && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isDirectExecution) {
  startServer();
}
