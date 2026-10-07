import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import process from 'node:process';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    // A busy port is a loud error instead of a silent move to 5174, which would break CORS allow-lists.
    strictPort: true,
    // 127.0.0.1 rather than localhost: Node resolves localhost to the IPv6 ::1 first on Windows.
    // API_PORT follows the backend's PORT when 3000 is taken by another app.
    proxy: {
      '/api': { target: `http://127.0.0.1:${process.env.API_PORT || 3000}`, changeOrigin: true },
    },
  },
  build: { sourcemap: true },
});
