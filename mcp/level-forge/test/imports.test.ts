import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

// Structure.md: apps depend on the kit only through its public API. The check runs as part of npm test.
describe('the games use only the public API', () => {
  it('no game, example or starter file reaches inside the kit', () => {
    const out = execFileSync(process.execPath, [join(__dirname, '..', '..', '..', 'scripts', 'check-imports.mjs')], { encoding: 'utf8' });
    expect(out).toMatch(/^Public API only: \d+ files/);
  });
});