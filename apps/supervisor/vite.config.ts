import { defineConfig } from 'vite';

export default defineConfig({
  base: '/',
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://localhost:4000',
      '/media': 'http://localhost:4000',
      '^/i/': {
        target: 'http://localhost:5174',
        changeOrigin: false,
      },
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
  },
});
