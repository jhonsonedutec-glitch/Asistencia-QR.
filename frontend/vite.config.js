import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    proxy: {
      '/api': {
        target: 'https://script.google.com/macros/s/AKfycbyOwBCzFNZQNRKFsdG1vLnwnLS83biDMl8NjLo7uQ-FYnnbFWnRSSqEswvUTGpHy8ff/exec',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ''),
      },
    },
  },
});