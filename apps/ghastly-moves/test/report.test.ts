import { describe, expect, it } from 'vitest';
import { accessibilityReport, cuesAudible, factsFromKit, mergeProof, trackClearOfCues } from '@marrow/skeleton';
import { createGhastlyKit } from '../src/kit';
import { STAGES } from '../src/stages';

// The accessibility feature list for Ghastly Moves, made from what its kit guarantees. The Markdown
// is kept in docs/ and checked here, so it can never drift from the proof: when something changes,
// `npm run report --workspace apps/ghastly-moves` rewrites it.

function build() {
  const runs = [];
  let cues = true;
  let music = true;
  let senses = true;
  for (const stage of STAGES) {
    for (const boss of [false, true]) {
      const kit = createGhastlyKit(stage, { boss });
      for (const seed of [1, 2, 3, 4, 5]) {
        const level = kit.generate(seed, { count: boss ? stage.boss.count : stage.count });
        runs.push(kit.prove(level));
        const commands = kit.renderLevel(level);
        cues &&= cuesAudible(commands).pass;
        music &&= trackClearOfCues(commands).pass;
      }
      senses &&= kit.proveEvents().pass;
    }
  }
  const proof = [
    ...mergeProof(runs),
    { id: 8, name: 'Every event reaches two senses', pass: senses },
    { id: 13, name: 'Cues audible over ambience and music', pass: cues },
    { id: 14, name: 'Track clear of the beeps', pass: music },
  ];
  const kit = createGhastlyKit(STAGES[0]!);
  return accessibilityReport(factsFromKit(kit, proof, { game: 'Ghastly Moves', directionalSound: false, cameraMotion: false }));
}

describe('Ghastly Moves accessibility report', () => {
  const report = build();

  it('every proof property behind it passes', () => {
    expect(report.proof.filter((p) => !p.pass)).toEqual([]);
  });

  it('claims the tags its proof supports, and none it does not', () => {
    const supported = report.supported.map((e) => e.tag);
    expect(supported).toEqual(
      expect.arrayContaining(['Mono Sound', 'Narrated Menus', 'Playable without Button Holds', 'Playable without Rapid Button Presses', 'Playable with Keyboard Only']),
    );
    expect(supported).not.toContain('Surround Sound');
    expect(report.markdown).not.toMatch(/fully accessible/i);
  });

  it('matches the report kept in docs/ (run `npm run report` to rewrite it)', async () => {
    await expect(report.markdown).toMatchFileSnapshot('../../../docs/accessibility-report-ghastly-moves.md');
  });
});