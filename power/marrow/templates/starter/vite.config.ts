import { offlinePlugin } from '@marrow/skeleton/vite';
import { defineConfig } from 'vite';

// Relative base, so the built folder works on any static host. The plugin makes it work offline too.
export default defineConfig({
  base: './',
  build: { target: 'es2022' },
  plugins: [offlinePlugin({ name: 'my-game' })],
});