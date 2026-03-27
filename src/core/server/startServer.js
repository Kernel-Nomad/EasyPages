import { PORT } from '../../config/env.js';
import { createApp } from '../../api/server/app.js';

export const startServer = ({ port = PORT } = {}) => {
  let app;
  try {
    app = createApp();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(message || '[EasyPages] Error al crear la aplicación.');
    process.exit(1);
  }

  const server = app.listen(port, () => {
    console.log(
      `✅ EasyPages en http://127.0.0.1:${port} — con Docker, usa el puerto que publique Compose (p. ej. 8002).`,
    );
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
