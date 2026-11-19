import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['test/**/*.test.ts'],
    environment: 'node',
    // The property-based proofs run hundreds of houses; give them room on a small or busy machine.
    // Some take 20 to 26 s alone, so 30 s was too tight when the machine is busy.
    testTimeout: 120_000,
  },
});
