import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { describe, expect, it } from 'vitest';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
describe('the over-claiming check', () => {
  it('finds a claim, and lets a denial through', async () => {
    const { findClaims, scan } = (await import(pathToFileURL(join(root, 'scripts', 'check-claims.mjs')).href)) as {
      findClaims(t: string): { line: number }[];
      scan(root: string): unknown[];
    };
    expect(findClaims('This game is fully accessible.')).toHaveLength(1);
    expect(findClaims('It works for everyone and is 100% accessible!')).toHaveLength(1);
    expect(findClaims('Great: accessible to everyone.')).toHaveLength(1);
    expect(findClaims('Never call a game "fully accessible".')).toHaveLength(0);
    expect(findClaims('It is not a claim that the game is accessible to everyone.')).toHaveLength(0);
    expect(findClaims('Plain text with nothing to flag.')).toHaveLength(0);
    expect(scan(root)).toEqual([]);
  });
});

