import { PORT } from '../../config/env.js';
import { createApp } from '../../api/server/app.js';

export const startServer = ({ port = PORT } = {}) => {
  let app;
  try {
    app = createApp();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(message || '[EasyPages] Failed to create the application.');
    process.exit(1);
  }

  const server = app.listen(port, () => {
    console.log(
      `✅ EasyPages on http://127.0.0.1:${port} — with Docker, use the port Compose publishes (e.g. 8002).`,
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
