import { describe, expect, it } from 'vitest';
import {
  accessibilityReport,
  cuesAudible,
  factsFromKit,
  generateMaze,
  mergeProof,
  proveMaze,
  scanningAudible,
  type SemanticEvent,
} from '@marrow/skeleton';
import { createSeanceKit } from '../src/kit';

// The accessibility feature list for Séance Escape, made from what its kit guarantees and kept in docs/.
// `npm run report --workspace apps/seance-escape` rewrites it.

function build() {
  const kit = createSeanceKit();
  // The houses the game serves: with the ritual (relics, hiding, the chase), so 205 and 206 are in the list too.
  const houses = [8, 10].flatMap((side) =>
    Array.from({ length: 15 }, (_, i) => proveMaze(generateMaze(i + 1, { width: side, height: side, relics: 3 }))),
  );
  const at = (type: string, data?: Record<string, unknown>): SemanticEvent => (data ? { type, at: 0, data } : { type, at: 0 });
  const commands = [
    ...kit.render(at('atmosphere', { bar: 0, tension: 0.8, span: 2 })),
    ...kit.render(at('ghost-sense', { angle: 0, distance: 0.5 })),
    ...kit.render(at('walk-option', { id: 'a', label: 'Ahead', angle: 0, distance: 0.3, index: 1, count: 2 })),
  ];
  const scanning = scanningAudible(
    ['Ahead', 'Left', 'Right', 'Turn back', 'Listen'].map((label) => ({ id: label, label })),
    kit.newProfile().dwellMs,
  );
  const senses = kit.proveEvents();
  const proof = [
    ...mergeProof(houses),
    { id: scanning.id, name: scanning.name, pass: scanning.pass },
    { id: 8, name: 'Every event reaches two senses', pass: senses.pass },
    { id: 13, name: 'Cues audible over ambience', pass: cuesAudible(commands).pass },
  ].sort((a, b) => a.id - b.id);
  return accessibilityReport(factsFromKit(kit, proof, { game: 'Séance Escape', directionalSound: true, cameraMotion: true }));
}

describe('Séance Escape accessibility report', () => {
  const report = build();

  it('every proof property behind it passes', () => {
    expect(report.proof.filter((p) => !p.pass)).toEqual([]);
  });

  it('claims directional sound and the house proof, and asks a person to confirm the moving camera', () => {
    const supported = report.supported.map((e) => e.tag);
    expect(supported).toEqual(expect.arrayContaining(['Surround Sound', 'Stereo Sound', 'Narrated Menus', 'Playable with Keyboard Only']));
    expect(report.check.map((e) => e.tag)).toContain('Camera Comfort');
    expect(report.markdown).not.toMatch(/fully accessible/i);
  });

  it('matches the report kept in docs/ (run `npm run report` to rewrite it)', async () => {
    await expect(report.markdown).toMatchFileSnapshot('../../../docs/accessibility-report-seance-escape.md');
  });
});