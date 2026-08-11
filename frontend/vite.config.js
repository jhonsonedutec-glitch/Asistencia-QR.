import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    proxy: {
      '/api': {
        target: 'https://script.google.com/macros/s/AKfycbzsoZBB9YQKioI40E-5h1524pEnnqmfEylFcZ62UGAUx4Z0Nrxcv015JKUM7Fc_rlP0/exec',
        changeOrigin: true,
        // Ya no necesitamos reescribir la ruta. Vercel y Vite ahora se comportan igual.
        rewrite: (path) => path.replace(/^\/api/, ''),
      },
    },
  },
});