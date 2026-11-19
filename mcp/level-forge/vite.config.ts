import { defineConfig } from 'vitest/config';

// One self-contained file to run with node: the skeleton is bundled in, so it needs no install step.
// `vite build` makes the MCP server (dist/main.js); `vite build --mode advisor` makes the advisor's
// command line (dist/advisor.js). Two builds, so each file stands alone.
export default defineConfig(({ mode }) => {
  const advisor = mode === 'advisor';
  return {
    build: {
      ssr: advisor ? 'src/advisor-cli.ts' : 'src/main.ts',
      outDir: 'dist',
      emptyOutDir: !advisor,
      target: 'node20',
      rollupOptions: { output: { entryFileNames: advisor ? 'advisor.js' : 'main.js', format: 'es' } },
    },
    ssr: { noExternal: ['@marrow/skeleton'] },
    // One file at a time: the power test rebuilds power/marrow, which another file reads.
    test: { include: ['test/**/*.test.ts'], environment: 'node', fileParallelism: false },
  };
});