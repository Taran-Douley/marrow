import { describe, expect, it } from 'vitest';
import { isSolid, simulatePersona, windowMs, type Speed } from '@marrow/skeleton';
import { createGhastlyKit } from '../src/kit';
import { STAGES } from '../src/stages';

// The proof report: every stage and boss, 200 levels each, proved before any player sees them. The
// Markdown is kept in docs/ and checked here, so the numbers in it are always the real ones.
// `npm run proof-report --workspace apps/ghastly-moves` rewrites it.

const N = 200;
const SPEEDS: Speed[] = ['slow', 'medium', 'fast'];
const pct = (x: number): string => `${Math.round(x * 100)}%`;

function build(): { markdown: string; failures: number } {
  const rows: string[] = [];
  let total = 0;
  let failures = 0;
  const floors: Record<Speed, number> = { slow: Infinity, medium: Infinity, fast: Infinity };
  const properties = new Set<number>();
  for (const stage of STAGES) {
    for (const boss of [false, true]) {
      const kit = createGhastlyKit(stage, { boss });
      const levels = Array.from({ length: N }, (_, i) => kit.generate(i + 1, boss ? { count: stage.boss.count } : {}));
      let passed = 0;
      for (const level of levels) {
        const results = kit.prove(level);
        results.forEach((r) => properties.add(r.id));
        if (results.every((r) => r.pass)) passed += 1;
      }
      const presentation = kit.provePresentation(levels[0]);
      presentation.forEach((r) => properties.add(r.id));
      if (!presentation.every((r) => r.pass)) failures += 1;
      total += N;
      failures += N - passed;
      const min = Object.fromEntries(
        SPEEDS.map((s) => [s, Math.min(...levels.flatMap((l) => l.obstacles.filter(isSolid).map((o) => windowMs(o, s, kit.timing))))]),
      ) as Record<Speed, number>;
      for (const s of SPEEDS) floors[s] = Math.min(floors[s], min[s]);
      const slow = simulatePersona(levels.slice(0, 50), { kind: 'noisy', sigmaMs: 150 }, 'slow', kit.timing);
      const fast = simulatePersona(levels.slice(0, 50), { kind: 'noisy', sigmaMs: 150 }, 'fast', kit.timing);
      rows.push(
        `| ${stage.id}${boss ? ' boss' : ''} | ${boss ? stage.boss.name : stage.name} | ${passed} of ${N} | ${Math.round(min.slow)} / ${Math.round(min.medium)} / ${Math.round(min.fast)} | ${pct(slow.meanClearRate)} / ${pct(fast.meanClearRate)} |`,
      );
    }
  }
  const markdown = [
    '# Proof report: Ghastly Moves',
    '',
    'Made by a test, never by hand. `npm run proof-report --workspace apps/ghastly-moves` rewrites it, and the test fails if it is out of date.',
    '',
    `**${total - failures} of ${total} generated levels passed every property.** The game refuses to serve any level that does not.`,
    '',
    `Properties checked: ${[...properties].sort((a, b) => a - b).join(', ')}.`,
    '',
    `Smallest take-off window across all levels: **${Math.round(floors.slow)} ms at Slow, ${Math.round(floors.medium)} ms at Medium, ${Math.round(floors.fast)} ms at Fast.** The floors are 650 ms at Slow and 400 ms at Fast.`,
    '',
    '| Stage | Name | Levels proved | Smallest window, ms (slow / medium / fast) | Jumps cleared first try, 150 ms timing error (slow / fast) |',
    '|---|---|---|---|---|',
    ...rows,
    '',
    'The last column comes from simulated players, not people. It estimates; it does not replace testing with disabled players.',
    '',
  ].join('\n');
  return { markdown, failures };
}

describe('Ghastly Moves proof report', () => {
  const report = build();
  it('every generated level passes', () => {
    expect(report.failures).toBe(0);
  });
  it('matches the report kept in docs/', async () => {
    await expect(report.markdown).toMatchFileSnapshot('../../../docs/proof-report-ghastly-moves.md');
  });
});
