import { BIND_HOST, PORT } from '../../config/env.js';
import { createApp } from '../../api/server/app.js';

export const startServer = ({ port = PORT, host = BIND_HOST } = {}) => {
  let app;
  try {
    app = createApp();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(message || '[EasyPages] Failed to create the application.');
    process.exit(1);
  }

  const server = app.listen(port, host, () => {
    const displayHost = host === '0.0.0.0' || host === '::' ? '127.0.0.1' : host;
    console.log(
      `✅ EasyPages listening on ${host}:${port} — open http://${displayHost}:${port}`
      + (host === '0.0.0.0' || host === '::'
        ? ' (bound on all interfaces; with Docker use the port Compose publishes).'
        : '.'),
    );
  });

  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.error(`[EasyPages] Port ${port} is already in use. Pick another one or free it.`);
    } else {
      console.error('[EasyPages] Failed to start the server:', err.message);
    }
    process.exit(1);
  });

  const shutdown = (signal) => {
    console.log(`[EasyPages] ${signal} received, closing…`);
    server.close((closeError) => {
      if (closeError) {
        console.error('[EasyPages] Error while closing:', closeError.message);
        process.exit(1);
      }
      process.exit(0);
    });
  };

  process.once('SIGTERM', () => shutdown('SIGTERM'));
  process.once('SIGINT', () => shutdown('SIGINT'));

  return server;
};
