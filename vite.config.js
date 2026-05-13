import { defineConfig } from 'vite';

const backendPort = process.env.BACKEND_PORT || '3000';

export default defineConfig({
  server: {
    host: true,          // bind to 0.0.0.0 so LAN devices can reach it
    strictPort: false,   // if chosen port is busy, pick another
    proxy: {
      '/api': {
        target: `http://127.0.0.1:${backendPort}`,
        changeOrigin: true,
      },
    },
  },
});
