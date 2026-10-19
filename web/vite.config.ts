import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// En desarrollo, la web corre en 5173 y reenvía /api a la API en 3000.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://localhost:3000',
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
  },
});
