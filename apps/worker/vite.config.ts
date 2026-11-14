import { defineConfig } from 'vite';

export default defineConfig({
  base: '/i/',
  server: {
    port: 5174,
    proxy: {
      '/api': 'http://localhost:4000',
    },
  },
});
