import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['test/**/*.test.ts'],
    environment: 'node',
    // The property-based proofs run hundreds of houses; give them room on a small or busy machine.
    testTimeout: 30_000,
  },
});
