import { describe, expect, it } from 'vitest';
import { cuesAudible, trackClearOfCues, validateTrack, type OutputCommand, type SemanticEvent } from '@marrow/skeleton';
import { CLOSE_RANGE, HEART_RANGE, heartRate, heartWords } from '../src/dread';
import { HOUSE_TRACK, createSeanceKit } from '../src/kit';

// The house's sound world. The aim: scary and exciting for a player who cannot see. Nothing beeps while
// you walk; one bell marks a crossing; the phantom is a whisper and your own heartbeat; the music plays
// out when it is safe and steps aside whenever something you need to hear could sound.

const kit = createSeanceKit();
type Sound = Extract<OutputCommand, { channel: 'sound' }>;
const at = (type: string, data?: Record<string, unknown>, t = 0): SemanticEvent => (data ? { type, at: t, data } : { type, at: t });
const sounds = (e: SemanticEvent): Sound[] => kit.render(e).filter((c): c is Sound => c.channel === 'sound');
/** A beep: a short, pitched sound. */
const isBeep = (s: Sound): boolean => !s.shape?.noise && (s.shape?.seconds ?? 0.16) < 0.8 && s.role !== 'effect';

describe('walking: no beeps, only the house', () => {
  it('footsteps, creaks, the phantom and the far bell are noise or long tolls, never beeps', () => {
    for (const e of [
      at('walk-step'),
      at('creak', { angle: 40, distance: 0.6 }),
      at('ghost-sense', { angle: -90, distance: 0.4 }),
      at('exit-sense', { angle: 120, distance: 0.7 }),
      at('heartbeat'),
      at('heartbeat-dub'),
    ]) {
      for (const s of sounds(e)) expect(isBeep(s), e.type).toBe(false);
    }
  });

  it('nothing is spoken between crossings', () => {
    for (const type of ['walk-step', 'creak', 'ghost-sense', 'exit-sense', 'heartbeat', 'heartbeat-dub', 'dead-end', 'ghost-close']) {
      expect(kit.render(at(type, { angle: 0, distance: 0.5 })).some((c) => c.channel === 'speech'), type).toBe(false);
    }
  });

  it('a crossing has one bell, and each way is a draught of air from where it lies, then its name', () => {
    const bell = sounds(at('walk-crossing', { count: 3 }));
    expect(bell).toHaveLength(1);
    expect(bell[0]!.hz).toBe(392);
    const left = sounds(at('walk-option', { id: 'dir:3', label: 'Left', angle: -90, distance: 0.3, index: 2, count: 3 }));
    expect(left[0]!.shape?.noise).toBe(true);
    expect(left[0]!.space?.x ?? 0).toBeLessThan(0);
  });

  it('the phantom whispers from its direction, louder when near', () => {
    const near = sounds(at('ghost-sense', { angle: 90, distance: 0.1 }))[0]!;
    const far = sounds(at('ghost-sense', { angle: 90, distance: 0.9 }))[0]!;
    expect(near.gain).toBeGreaterThan(far.gain);
    expect(near.space?.x ?? 0).toBeGreaterThan(0);
  });
});

describe('dread', () => {
  it('the heart is silent far away, starts at the edge of range, and races next to you', () => {
    expect(heartRate(HEART_RANGE + 1)).toBe(0);
    expect(heartRate(HEART_RANGE)).toBe(60);
    for (let d = HEART_RANGE; d > 0; d--) expect(heartRate(d - 1)).toBeGreaterThan(heartRate(d));
    expect(heartRate(1)).toBe(140);
    expect(heartWords(heartRate(1))).toBe('Heartbeat: racing');
    expect(heartWords(0)).toBe('');
    expect(CLOSE_RANGE).toBeLessThan(HEART_RANGE);
  });

  it('the heartbeat and the sting reach touch and sight as well as hearing', () => {
    for (const type of ['heartbeat', 'heartbeat-dub', 'ghost-close']) {
      const senses = new Set(kit.render(at(type)).flatMap((c) => c.senses));
      expect(senses.has('touch') && senses.has('sight') && senses.has('hearing'), type).toBe(true);
    }
  });
});

describe('music', () => {
  const bar = (quiet: [number, number][], tension = 0.15) => kit.render(at('atmosphere', { bar: 0, tension, span: 2, quiet, pulse: 0 }));
  const music = (cmds: OutputCommand[]) => cmds.filter((c): c is Sound => c.channel === 'sound' && c.role === 'music' && (c.shape?.span ?? 9) < 3);

  it('the house track is valid and slow: a slot is half a second', () => {
    expect(() => validateTrack(HOUSE_TRACK)).not.toThrow();
    const notes = music(bar([]));
    expect(notes.length).toBeGreaterThan(0);
    for (const n of notes) expect(Math.abs(n.at / 0.5 - Math.round(n.at / 0.5))).toBeLessThan(1e-9);
  });

  it('plays out when the phantom is far and nothing is being read, and steps aside when a cue may sound', () => {
    const open = Math.max(...music(bar([])).map((n) => n.gain));
    const quiet = Math.max(...music(bar([[0, 2.5]])).map((n) => n.gain));
    expect(open).toBeGreaterThan(quiet * 3);
    const wind = (cmds: OutputCommand[]) => cmds.filter((c): c is Sound => c.channel === 'sound' && c.role === 'ambience')[0]!.gain;
    expect(wind(bar([]))).toBeGreaterThan(wind(bar([[0, 2.5]])));
  });

  it('every cue stays 6 dB over the beds when the music has stepped aside, and every note is under the crossing bell', () => {
    const cmds = [
      ...bar([[0, 2.5]], 0.9),
      ...kit.render(at('heartbeat', undefined, 0.5)),
      ...kit.render(at('ghost-sense', { angle: 0, distance: 0.2 }, 0.8)),
      ...kit.render(at('walk-crossing', { count: 2 }, 1.0)),
      ...kit.render(at('walk-option', { id: 'a', label: 'Ahead', angle: 0, distance: 0.3, index: 1, count: 2 }, 1.4)),
    ];
    expect(cuesAudible(cmds).counterexamples ?? []).toEqual([]);
    expect(trackClearOfCues([...bar([]), ...kit.render(at('walk-crossing', { count: 2 }))]).counterexamples ?? []).toEqual([]);
  });
});

describe('a living house', () => {
  it('each floor has its own footstep, and none of them beeps or speaks', () => {
    const recipes = ['step-wood', 'step-stone', 'step-carpet'].map((type) => {
      const s = sounds(at(type));
      expect(s, type).toHaveLength(1);
      expect(isBeep(s[0]!), type).toBe(false);
      expect(kit.render(at(type)).some((c) => c.channel === 'speech'), type).toBe(false);
      return `${s[0]!.shape?.filterHz}-${s[0]!.shape?.seconds}`;
    });
    expect(new Set(recipes).size).toBe(3);
  });

  it('the phantom moves and moans from where it is, never as a beep, and you can see each sound marked', () => {
    for (const type of ['ghost-step', 'ghost-moan']) {
      const out = kit.render(at(type, { angle: 90, distance: 0.3 }));
      const s = out.filter((c): c is Sound => c.channel === 'sound');
      expect(s, type).toHaveLength(1);
      expect(s[0]!.role, type).toBe('effect');
      expect(s[0]!.space?.x ?? s[0]!.pan, type).toBeGreaterThan(0); // it is to the right
      expect(out.some((c) => c.channel === 'indicator'), type).toBe(true);
    }
  });

  it('the moan wobbles like a voice, and the house sounds stay out of the beeps\' pitch range', () => {
    const moan = sounds(at('ghost-moan', { angle: 0, distance: 0.5 }))[0]!;
    expect(moan.shape?.wobble).toBeGreaterThan(0);
    for (const type of ['door', 'board-creak', 'gust', 'thunder', 'breath', 'ghost-step', 'ghost-moan']) {
      for (const s of sounds(at(type, { angle: 0, distance: 0.5 }))) expect(s.role, type).not.toBe('cue');
    }
  });

  it('Mabel speaks in her own voice; the narrator does not', () => {
    const tone = (type: string, data: Record<string, unknown>) =>
      kit.render(at(type, data)).find((c) => c.channel === 'speech') as Extract<OutputCommand, { channel: 'speech' }> | undefined;
    expect(tone('walk-hint', { line: 'Go left.' })?.tone?.pitch).toBeGreaterThan(1);
    expect(tone('walk-relic', { line: 'The Locket!', relic: 'The Locket', found: 1, total: 3 })?.tone?.pitch).toBeGreaterThan(1);
    // The narrator is the plain voice: its pitch and pace are the player's own.
    expect(tone('walk-room', { line: 'The Library.', caption: 'The Library' })?.tone).toEqual({ pitch: 1, rate: 1 });
  });

  it('scanning labels never fall behind the highlight, and being caught cuts in', () => {
    const speech = (type: string, data: Record<string, unknown>) =>
      kit.render(at(type, data)).find((c) => c.channel === 'speech') as Extract<OutputCommand, { channel: 'speech' }> | undefined;
    expect(speech('walk-option', { label: 'Left', angle: -90, distance: 0.3, index: 1, count: 2 })?.mode).toBe('latest');
    expect(speech('caught', { line: 'Oh dear.' })?.mode).toBe('cut-in');
  });
});
