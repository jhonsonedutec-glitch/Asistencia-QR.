import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    allowedHosts: ['relatable-ventricle-turbofan.ngrok-free.dev'],
    proxy: {
      '/api': {
        target: 'https://script.google.com/macros/s/AKfycbx-t-Hk3a2zZ8xJ3O_5VzYvA022iRk222mO5sY2f_vA-2_l2bX4D_R_c3g/exec',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ''),
      },
    },
  },
});