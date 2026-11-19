import { describe, expect, it } from 'vitest';
import { fewestSteps, generateMaze, proveMaze, type Maze } from '@marrow/skeleton';
import { createSeanceKit } from '../src/kit';

// The proof report: 200 houses at each size, built and proved the way the game builds them, before
// any player walks in. Kept in docs/ and checked here. `npm run proof-report --workspace apps/seance-escape`.

const N = 200;
const SIZES = { small: 6, medium: 8, large: 10 } as const;

/** As the game does: a seed that cannot be made fair at this size tries the next. */
function house(seed: number, side: number): Maze | null {
  for (let i = 0; i < 10; i++) {
    try {
      return generateMaze(seed + i * 1009, { width: side, height: side, relics: 3 });
    } catch {
      // next
    }
  }
  return null;
}

function build(): { markdown: string; failures: number } {
  let failures = 0;
  const ids = new Set<number>();
  const rows = Object.entries(SIZES).map(([name, side]) => {
    let proved = 0;
    let unbuilt = 0;
    let steps = 0;
    for (let seed = 1; seed <= N; seed++) {
      const m = house(seed, side);
      if (!m) {
        unbuilt += 1;
        continue;
      }
      const results = proveMaze(m, `House ${seed}`);
      results.forEach((r) => ids.add(r.id));
      if (results.every((r) => r.pass)) proved += 1;
      else failures += 1;
      steps += fewestSteps(m);
    }
    return `| ${name} (${side} by ${side}) | ${proved} of ${N} | ${unbuilt} | ${Math.round(steps / Math.max(1, proved))} |`;
  });
  const presentation = createSeanceKit().provePresentation();
  presentation.forEach((r) => ids.add(r.id));
  failures += presentation.filter((r) => !r.pass).length;
  const markdown = [
    '# Proof report: Séance Escape',
    '',
    'Made by a test, never by hand. `npm run proof-report --workspace apps/seance-escape` rewrites it, and the test fails if it is out of date.',
    '',
    `**Every house the game serves passes every property.** Properties checked: ${[...ids].sort((a, b) => a - b).join(', ')}.`,
    '',
    '| House size | Houses proved | Seeds with no fair house at this size | Fewest steps to escape, on average |',
    '|---|---|---|---|',
    ...rows,
    '',
    'A house that cannot be proved is never served. For a seed with no fair house, the game says so and asks for a bigger house.',
    '',
  ].join('\n');
  return { markdown, failures };
}

describe('Séance Escape proof report', () => {
  const report = build();
  it('every house served passes', () => {
    expect(report.failures).toBe(0);
  });
  it('matches the report kept in docs/', async () => {
    await expect(report.markdown).toMatchFileSnapshot('../../../docs/proof-report-seance-escape.md');
  });
});
