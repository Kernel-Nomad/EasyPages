import { PORT } from '../../config/env.js';
import { createApp } from '../../api/server/app.js';

export const startServer = ({ port = PORT } = {}) => {
  const app = createApp();

  return app.listen(port, () => {
    console.log(`✅ EasyPages seguro corriendo en puerto ${port}`);
  });
};
