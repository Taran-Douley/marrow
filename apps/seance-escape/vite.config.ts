import { offlinePlugin } from '@marrow/skeleton/vite';
import { defineConfig } from 'vitest/config';

// Relative base so the built folder works on any static host, including a subfolder.
// The plugin writes sw.js, so the built game works with no network after the first visit.
export default defineConfig({
  base: './',
  build: { target: 'es2022' },
  plugins: [offlinePlugin({ name: 'seance-escape' })],
  // Serving a house proves it (about 0.15 s), and some tests serve dozens.
  test: { include: ['test/**/*.test.ts'], environment: 'node', testTimeout: 120_000 },
});
