import { offlinePlugin } from '@marrow/skeleton/vite';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  base: './',
  build: { target: 'es2022' },
  plugins: [offlinePlugin({ name: 'hello-marrow' })],
  test: { include: ['test/**/*.test.ts'], environment: 'jsdom' },
});