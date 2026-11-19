import { describe, expect, it } from 'vitest';
import { qualityReport } from '@marrow/skeleton/advisor';
import { createGhastlyKit } from '../src/kit';
import { STAGES } from '../src/stages';

// How every stage plays, for simulated players: the advisor's quality report. Kept in docs/ and checked
// here. `npm run quality --workspace apps/ghastly-moves` rewrites it.

const pct = (x: number): string => `${Math.round(x * 100)}%`;

function build(): { markdown: string; allProved: boolean } {
  const rows: string[] = [];
  const advice = new Set<string>();
  let allProved = true;
  let longest = 0;
  for (const s of STAGES) {
    const kit = createGhastlyKit(s);
    const r = qualityReport(kit, Array.from({ length: 20 }, (_, i) => kit.generate(i + 1)), s.name);
    allProved &&= r.proved === r.levels;
    for (const a of r.advice) if (!a.startsWith('The longest wait')) advice.add(a);
    longest = Math.max(longest, r.longestQuietSeconds);
    const v = r.bySpeed;
    rows.push(
      `| ${s.id} | ${s.name} | ${r.proved} of ${r.levels} | ${v.slow.verdict} (${pct(v.slow.clear250)}) | ${v.medium.verdict} (${pct(v.medium.clear250)}) | ${v.fast.verdict} (${pct(v.fast.clear250)}) | ${pct(v.slow.audioOnly)} | ${r.longestQuietSeconds.toFixed(1)} s |`,
    );
  }
  const markdown = [
    '# How Ghastly Moves plays',
    '',
    'Made by the advisor’s quality report, from simulated players, never by hand. `npm run quality --workspace apps/ghastly-moves` rewrites it.',
    '',
    '| Stage | Name | Levels proved | Slow | Medium | Fast | By sound only, slow | Longest wait, slow |',
    '|---|---|---|---|---|---|---|---|',
    ...rows,
    '',
    'Verdicts are for a player with 250 ms of timing error; the percentage is jumps cleared first time.',
    '',
    '## What would help most',
    '',
    ...[...advice].map((a) => `- ${a}`),
    ...(longest > 12 ? [`- The longest wait with nothing to do is ${longest.toFixed(0)} s at Slow (in the rests and after portals): shorten rests, or give the wait something to listen to.`] : []),
    '',
    'These numbers show whether the game can be finished and how it plays, not whether it is fun. Test with real players, including disabled players.',
    '',
  ].join('\n');
  return { markdown, allProved };
}

describe('Ghastly Moves quality report', () => {
  const report = build();
  it('every level of every stage is proved', () => {
    expect(report.allProved).toBe(true);
  });
  it('matches the report kept in docs/', async () => {
    await expect(report.markdown).toMatchFileSnapshot('../../../docs/quality-ghastly-moves.md');
  });
});
