import { PORT } from '../../config/env.js';
import { createApp } from '../../api/server/app.js';

export const startServer = ({ port = PORT } = {}) => {
  const app = createApp();
  const server = app.listen(port, () => {
    console.log(`✅ EasyPages listo en http://127.0.0.1:${port} (mapea el puerto publicado si usas Docker)`);
  });

  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.error(`[EasyPages] El puerto ${port} ya está en uso. Elige otro o libera el puerto.`);
    } else {
      console.error('[EasyPages] Error al arrancar el servidor:', err.message);
    }
    process.exit(1);
  });

  return server;
};
