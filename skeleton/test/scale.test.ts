import { describe, expect, it } from 'vitest';
import { createSoundPlayer, createSpeaker, type AudioContextLike } from '../src/adapters/web';
import { createKit } from '../src/kit';
import { mergeProfile, defaultProfile } from '../src/profile';
import { nearest, speechPace } from '../src/scale';
import type { OutputCommand } from '../src/types';

type Sound = Extract<OutputCommand, { channel: 'sound' }>;
const sound = (role: Sound['role'], hz = 300): Sound => ({ channel: 'sound', senses: ['hearing'], at: 0, role, hz, wave: 'sine', gain: 0.5, pan: 0, shape: { seconds: 2 } });

function fakeContext() {
  const stopped: number[] = [];
  let made = 0;
  const param = () => ({ value: 0, setValueAtTime: () => undefined, linearRampToValueAtTime: () => undefined });
  const ctx: AudioContextLike = {
    currentTime: 0,
    destination: {},
    createOscillator: () => {
      const id = made++;
      return { type: 'sine', frequency: param(), connect: () => undefined, start: () => undefined, stop: (t?: number) => void (t !== undefined && t < 1 && stopped.push(id)) };
    },
    createGain: () => ({ gain: param(), connect: () => undefined }),
  };
  return { ctx, stopped, made: () => made };
}

describe('a busy game', () => {
  it('plays at most so many sounds at once; music gives way, a beep never does', () => {
    const { ctx, made } = fakeContext();
    const player = createSoundPlayer(ctx, { maxVoices: 4 });
    for (let i = 0; i < 4; i++) player.play(sound('music'), 0, false);
    player.play(sound('ambience'), 0, false); // less important than everything playing: left out
    expect(made()).toBe(4);
    for (let i = 0; i < 6; i++) player.play(sound('cue', 600), 0, false); // beeps always play
    expect(made()).toBe(10);
    expect(player.dropped()).toBeGreaterThanOrEqual(5);
  });

  it('nearest keeps the closest few, nearest first', () => {
    const ghosts = [{ id: 'a', d: 9 }, { id: 'b', d: 2 }, { id: 'c', d: 5 }, { id: 'd', d: Infinity }];
    expect(nearest(ghosts, 2, (g) => g.d).map((g) => g.id)).toEqual(['b', 'c']);
  });

  it('property 18 catches a flood of words, and priority and announce levels fix it', () => {
    const kit = createKit({ events: { coin: { say: 'Coin.', caption: 'Coin', priority: 'ambient' }, enemy: { say: 'Enemy.', caption: 'Enemy', priority: 'important' } } });
    const flood = Array.from({ length: 20 }, (_, i) => ({ type: i % 10 === 0 ? 'enemy' : 'coin', at: i * 0.2 }));
    const loud = flood.flatMap((e) => kit.render(e, mergeProfile(defaultProfile(), { announce: 'detailed' })));
    const r = speechPace(loud, 1);
    expect(r.pass).toBe(false);
    expect(r.counterexample).toMatch(/^Game: 4 spoken lines within 4 seconds, from 0\.0 s\. A player can follow about 3\./);
    expect(speechPace(flood.flatMap((e) => kit.render(e)), 1).pass).toBe(true); // normal: coins are not said
  });

  it('the same line waiting twice is said once', () => {
    const spoken: string[] = [];
    let end: (() => void) | undefined;
    const speaker = createSpeaker({
      region: { append: () => undefined },
      queue: true,
      synth: { speak: (u) => void spoken.push((u as { text: string }).text), cancel: () => undefined },
      makeUtterance: (text) => ({ text, addEventListener: (t: string, fn: () => void) => void (t === 'end' && (end = fn)) }),
      timers: { set: () => 0, clear: () => undefined },
    });
    for (const t of ['Now', 'Coin.', 'Coin.', 'Coin.']) speaker.say(t, { aloud: true, volume: 1 });
    end?.();
    end?.();
    expect(spoken).toEqual(['Now', 'Coin.']);
  });
});
