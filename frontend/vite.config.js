import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    proxy: {
      '/api': {
        target: 'https://script.google.com/macros/s/AKfycbwjavOVOERURb221OlTeEYLwq56z1_MGpXvhDI5PJ1r9KeEE9VqfxXc6JobvqiJGz49/exec',
        changeOrigin: true,
        // Ya no necesitamos reescribir la ruta. Vercel y Vite ahora se comportan igual.
        // rewrite: (path) => path.replace(/^\/api/, ''),
      },
    },
  },
});