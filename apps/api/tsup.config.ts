import { defineConfig } from 'tsup';

export default defineConfig({
  entry: { server: 'src/server.ts', 'ensure-indexes': 'src/scripts/ensure-indexes.ts' },
  format: ['esm'],
  platform: 'node',
  target: 'node24',
  outDir: 'dist',
  sourcemap: true,
  clean: true,
  noExternal: ['@understood/shared'],
});
