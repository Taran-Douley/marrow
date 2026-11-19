import { defineConfig } from 'vitest/config';

// One self-contained file to run with node: the skeleton is bundled in, so the server needs no install step.
export default defineConfig({
  build: {
    ssr: 'src/main.ts',
    outDir: 'dist',
    target: 'node20',
    rollupOptions: { output: { entryFileNames: 'main.js', format: 'es' } },
  },
  ssr: { noExternal: ['@marrow/skeleton'] },
  // One file at a time: the power test rebuilds power/marrow, which another file reads.
  test: { include: ['test/**/*.test.ts'], environment: 'node', fileParallelism: false },
});
