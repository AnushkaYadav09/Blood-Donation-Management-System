import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
        secure: false,
        ws: false,
      },
    },
  },
  define: {
    // Makes VITE_API_URL available at build time
    __API_URL__: JSON.stringify(process.env.VITE_API_URL || ''),
  },
});
