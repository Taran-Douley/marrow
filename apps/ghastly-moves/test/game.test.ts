import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { EVENT_TYPES, cuesAudible, type Level, type SemanticEvent } from '@marrow/skeleton';
import { describe, expect, it } from 'vitest';
import { createGhastlyKit } from '../src/kit';
import { OBJECTS } from '../src/objects/index.generated';
import { TABLES, timesTable } from '../src/lessons';

const SRC = fileURLToPath(new URL('../src', import.meta.url));

describe('the times-table lessons', () => {
  it('every table from 2 to 12 is a working lesson', () => {
    for (const n of TABLES) expect(() => createGhastlyKit(n), `table ${n}`).not.toThrow();
  });

  it('a target is a multiple of the table, and nothing else is', () => {
    const three = timesTable(3);
    expect([3, 6, 12, 36].every((v) => three.isTarget(v))).toBe(true);
    expect([1, 2, 4, 11, 13, 35].some((v) => three.isTarget(v))).toBe(false);
    expect(timesTable(7).values).toEqual([1, 84]);
  });

  it('a mistake teaches with the sum', () => {
    const three = timesTable(3);
    expect(three.explainWrong!(11)).toBe('11 is not a multiple of 3.');
    expect(three.explainMiss!(12)).toBe('12 is a multiple of 3: 4 times 3.');
    expect(timesTable(7).explainMiss!(56)).toBe('56 is a multiple of 7: 8 times 7.');
  });

  it('refuses a table that is not a whole number from 2', () => {
    expect(() => timesTable(1)).toThrow('whole number from 2 up');
    expect(() => timesTable(2.5)).toThrow('whole number from 2 up');
  });
});

describe('every object and level passes the proof before it is merged (structure.md)', () => {
  it('declares a stone with a voice, a name, a caption and a vibration, and its own art', () => {
    const kit = createGhastlyKit(3);
    expect(kit.registry.names()).toEqual(['stone', ...OBJECTS.map((o) => o.name)]); // plus any object wired from src/objects
    const stone = kit.registry.get('stone')!;
    expect(stone.say).not.toBe('');
    expect(stone.caption).not.toBe('');
    expect(stone.sound.hz).toBeGreaterThan(0);
    expect(stone.haptic.length).toBeGreaterThan(0);
    expect(stone.draw).toBeTypeOf('function');
  });

  it('passes every proof property for 30 levels of every table', () => {
    for (const n of TABLES) {
      const kit = createGhastlyKit(n);
      for (let seed = 1; seed <= 30; seed++) {
        const results = kit.prove(kit.generate(seed));
        expect(results.map((r) => r.id)).toEqual([1, 2, 3, 4, 5, 6, 101]);
        expect(results.filter((r) => !r.pass).map((r) => r.counterexample), `table ${n}, level ${seed}`).toEqual([]);
        expect(() => kit.refuseIfFailing(kit.generate(seed), `Level ${seed}`)).not.toThrow();
      }
    }
  });

  it('every event, the game\'s own included, reaches at least two senses', () => {
    const result = createGhastlyKit(3).proveEvents();
    expect(result.counterexamples ?? []).toEqual([]);
    expect(result.pass).toBe(true);
  });

  it('the beeps stay over the wind, pad and approach tone on every table', () => {
    for (const n of [2, 7, 12]) {
      const kit = createGhastlyKit(n);
      expect(cuesAudible(kit.renderLevel(kit.generate(4))).pass).toBe(true);
    }
  });
});

describe('the game\'s own events', () => {
  const kit = createGhastlyKit(3);
  const render = (type: string, data: Record<string, unknown> = {}) => kit.render({ type, at: 0, data } as SemanticEvent);
  const speech = (type: string, data?: Record<string, unknown>) =>
    render(type, data).flatMap((c) => (c.channel === 'speech' ? [c.text] : []));

  it('the intro says the rule in plain words', () => {
    expect(speech('intro', { prompt: kit.lesson!.prompt })).toEqual([
      'Ghastly Moves. Jump on every multiple of 3. Let the others pass.',
    ]);
  });

  it('the summary gives the rank, the score and how many were right', () => {
    expect(speech('summary', { rank: 'A', score: 840, right: 10, total: 12 })).toEqual([
      'Rank A. 840 points. 10 of 12 right. Press any key to play again.',
    ]);
  });

  it('the menu line is spoken and shown', () => {
    const senses = new Set(render('menu').flatMap((c) => c.senses));
    expect(senses.has('hearing') && senses.has('sight')).toBe(true);
  });
});

describe('playing it', () => {
  function play(table: number, seed: number, decide: (level: Level, i: number) => number | null) {
    const kit = createGhastlyKit(table);
    const level = kit.generate(seed);
    const heard: string[] = [];
    const types: string[] = [];
    const run = kit.run({
      level,
      speed: 'slow',
      startReal: 0,
      emit: (event) => {
        types.push(event.type);
        for (const c of kit.render(event)) if (c.channel === 'speech') heard.push(c.text);
      },
    });
    let clock = 0;
    let guard = 0;
    let pressedFor = -1;
    while (run.snapshot().phase === 'play' && guard++ < 400000) {
      clock += 2;
      run.advance(clock);
      const i = run.snapshot().obstacle;
      const o = level.obstacles[i];
      const offset = o ? decide(level, i) : null;
      if (!o || offset === null || pressedFor === i) continue;
      const j = (o.start - kit.timing.halfWidth + (o.start + o.width + kit.timing.halfWidth - kit.timing.airtime)) / 2;
      if (run.snapshot().t >= j + offset) {
        pressedFor = i;
        run.press(clock);
      }
    }
    return { kit, level, run, heard, types };
  }

  it('a player who knows the table, and times it, finishes with the top rank', () => {
    for (const [table, seed] of [[3, 1], [7, 2], [12, 3]] as const) {
      const { kit, level, run, heard } = play(table, seed, (lv, i) => (lv.obstacles[i]!.solid ? 0 : null));
      expect(run.snapshot().phase).toBe('done');
      expect(kit.rank(level, run.snapshot().score).rank).toBe('S');
      expect(heard).toContain('Perfect');
      expect(heard.at(-1)).toBe('Level complete.');
    }
  });

  it('every number is spoken before it arrives', () => {
    const { level, heard } = play(3, 1, (lv, i) => (lv.obstacles[i]!.solid ? 0 : null));
    for (const o of level.obstacles) expect(heard).toContain(String(o.value));
  });

  it('a player who presses on everything is told why, and cannot finish by luck', () => {
    const { run, heard, types } = play(3, 1, () => 0);
    // The first distractor stops the run with an explanation; the player has not finished.
    expect(run.snapshot().phase).toBe('recover');
    expect(types).toContain(EVENT_TYPES.fallReason);
    expect(heard.some((t) => /^Not that one\. \d+ is not a multiple of 3\.$/.test(t))).toBe(true);
  });

  it('a player who never presses is told which numbers they missed', () => {
    const { run, heard } = play(3, 1, () => null);
    expect(run.snapshot().phase).toBe('recover');
    expect(heard.some((t) => /^No press\. \d+ is a multiple of 3: \d+ times 3\.$/.test(t))).toBe(true);
  });
});

describe('the app uses only the public API (structure.md)', () => {
  const files: string[] = [];
  const walk = (dir: string): void => {
    for (const name of readdirSync(dir)) {
      const full = join(dir, name);
      if (statSync(full).isDirectory()) walk(full);
      else if (name.endsWith('.ts')) files.push(full);
    }
  };
  walk(SRC);

  it('imports the skeleton only from "@marrow/skeleton" or "@marrow/skeleton/web"', () => {
    expect(files.length).toBeGreaterThan(0);
    for (const file of files) {
      const text = readFileSync(file, 'utf8');
      for (const m of text.matchAll(/from\s+['"]([^'"]+)['"]/g)) {
        const spec = m[1]!;
        if (spec.includes('skeleton')) {
          expect(['@marrow/skeleton', '@marrow/skeleton/web', '@marrow/skeleton/vite', '@marrow/skeleton/catalogue', '@marrow/skeleton/advisor'], `${file} imports ${spec}`).toContain(spec);
        }
      }
    }
  });
});
