import path from 'path';
import { fileURLToPath } from 'url';
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Separate from vite.config.js on purpose: that one sets `root` to src/web and carries the
// dev proxy, neither of which means anything in a jsdom run.
export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: [path.resolve(__dirname, 'src/web/test/setup.js')],
    include: ['src/web/**/*.test.{js,jsx}'],
    // No `globals: true`: describe/it/expect are imported explicitly so eslint can see
    // them, instead of teaching it another set of ambient names.
    globals: false,
  },
});
