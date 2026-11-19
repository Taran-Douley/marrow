import { describe, expect, it } from 'vitest';
import { createKit, LevelRefused } from '../src';

// The code in docs/quickstart.md, step by step. If this test breaks, the guide is wrong.

describe('the quickstart works as written', () => {
  it('step 1 and 2: a kit, two obstacles, a proved level', () => {
    const kit = createKit({
      events: {
        intro: { say: 'Bat Dash. Press to jump over every bat.', caption: 'Jump over every bat' },
      },
    });
    kit.defineObstacle('bat', { width: [0.12, 0.24] });
    kit.defineObstacle('rock', { width: [0.16, 0.3], say: 'Rock', caption: 'Rock' });

    const level = kit.refuseIfFailing(kit.generate(1), 'Level 1');
    expect(level.obstacles).toHaveLength(12);
    expect(kit.prove(level).every((r) => r.pass)).toBe(true);
    expect(kit.provePresentation(level).every((r) => r.pass)).toBe(true);
  });

  it('step 3: a broken obstacle is refused with a plain-English reason', () => {
    const kit = createKit();
    kit.defineObstacle('crypt', { width: [1, 1] });
    expect(() => kit.refuseIfFailing(kit.generate(17), 'Level 17')).toThrow(LevelRefused);
    expect(kit.prove(kit.generate(17), 'Level 17').find((r) => !r.pass)?.counterexample).toMatch(
      /^Level 17, obstacle 1 \(crypt, 1\.00 s wide\): no take-off point clears it\. One jump covers only 0\.73 s\.$/,
    );
  });

  it('step 4: a song with flips, and the coach', () => {
    const kit = createKit({
      coach: true,
      song: {
        name: 'Bat Song',
        sections: [
          { name: 'Intro', bars: 2, feel: 'rest' },
          { name: 'Verse', bars: 8, feel: 'calm' },
          { name: 'Upside down', bars: 8, feel: 'busy', move: 'flip' },
        ],
      },
    });
    kit.defineObstacle('bat', { width: [0.12, 0.24] });
    const level = kit.generate(1);
    expect(level.portals?.map((p) => p.move)).toEqual(['flip']);
    expect(kit.prove(level).every((r) => r.pass)).toBe(true);
  });
});
