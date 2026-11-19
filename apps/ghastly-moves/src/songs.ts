import type { Song } from '@marrow/skeleton';

/**
 * Each stage is a song, and the level is built from it: the countdowns come close together in the
 * busy parts, spread out in the calm parts, and stop in the rests, where the band drops to a
 * breakdown. A portal changes what a press does: jump, flip (gravity turns over, you run on the
 * ceiling), or switch lanes at number gates. The first stages teach one new move each; later stages mix
 * them. Every part is in bars of four beats.
 *
 * `beat` is the song's tempo, in running seconds per beat; the player's speed setting scales it.
 * 0.42 is 143 beats a minute at Fast, 86 at Slow. Slower songs come first.
 *
 * The parts were chosen without ears. Tune them by playing.
 */
export interface StageSong {
  song: Song;
  beat: number;
}

/** Two bars to settle in. If the rule takes longer to say, the game waits for it (see main.ts). */
const intro = { name: 'Intro', bars: 2, feel: 'rest' } as const;
/** A short breather: one bar, so the music drops out and comes back before the wait drags. */
const breakdown = { name: 'Breakdown', bars: 1, feel: 'rest' } as const;
const flip = (name: string, bars: number, feel: 'calm' | 'busy') => ({ name, bars, feel, move: 'flip', kinds: ['spike'] }) as const;
const gates = (name: string, bars: number, feel: 'calm' | 'busy') => ({ name, bars, feel, move: 'switch', kinds: ['gate'] }) as const;
const jump = (name: string, bars: number, feel: 'calm' | 'busy') => ({ name, bars, feel, move: 'jump' }) as const;

export const SONGS: readonly StageSong[] = [
  {
    // Stage 1: jumps only, so the first thing to learn is the beat.
    beat: 0.42,
    song: { name: 'Pumpkin Bounce', sections: [intro, jump('Verse', 8, 'calm'), jump('Chorus', 8, 'busy'), breakdown, jump('Last chorus', 8, 'busy')] },
  },
  {
    // Stage 2: flip mode arrives.
    beat: 0.42,
    song: { name: 'Crypt Creep', sections: [intro, jump('Verse', 8, 'calm'), flip('Upside down', 10, 'busy'), breakdown, jump('Chorus', 10, 'busy')] },
  },
  {
    // Stage 3: number gates arrive.
    beat: 0.4,
    song: { name: 'Woodland Drift', sections: [intro, jump('Verse', 8, 'busy'), gates('Two paths', 12, 'calm'), breakdown, jump('Chorus', 10, 'busy')] },
  },
  {
    // Stage 4: all three moves.
    beat: 0.4,
    song: {
      name: 'Gate March',
      sections: [intro, jump('Verse', 6, 'busy'), flip('Upside down', 8, 'busy'), breakdown, gates('Two paths', 10, 'calm'), jump('Outro', 8, 'busy')],
    },
  },
  {
    beat: 0.38,
    song: {
      name: 'Mill Wheel',
      sections: [intro, gates('Two paths', 8, 'busy'), flip('Upside down', 8, 'busy'), breakdown, jump('Drop', 8, 'busy'), gates('Last paths', 8, 'busy')],
    },
  },
  {
    beat: 0.38,
    song: {
      name: 'Hollow Lurch',
      sections: [intro, flip('Upside down', 8, 'busy'), gates('Two paths', 8, 'busy'), breakdown, jump('Drop', 10, 'busy'), flip('Last flip', 8, 'busy')],
    },
  },
  {
    // Stage 7: the longest and fastest, every move.
    beat: 0.36,
    song: {
      name: 'Midnight Waltz',
      sections: [
        intro,
        jump('Verse', 6, 'busy'),
        gates('Two paths', 8, 'busy'),
        breakdown,
        flip('Upside down', 8, 'busy'),
        gates('Last paths', 6, 'busy'),
        jump('Finale', 8, 'busy'),
      ],
    },
  },
];
