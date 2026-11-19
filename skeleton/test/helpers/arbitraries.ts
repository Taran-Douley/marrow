import fc from 'fast-check';
import { CHANNEL_IDS, PALETTES, SPEEDS, THEME_IDS, type ChannelId, type Profile } from '../../src/types';

/** Random but valid player profiles, for property tests across the suite. */
export const profileArb: fc.Arbitrary<Profile> = fc.record({
  speed: fc.constantFrom(...SPEEDS),
  dwellMs: fc.integer({ min: 500, max: 10000 }),
  theme: fc.constantFrom(...THEME_IDS),
  textScale: fc.integer({ min: 10, max: 30 }).map((n) => n / 10),
  palette: fc.constantFrom(...PALETTES),
  reducedMotion: fc.boolean(),
  volume: fc.record({
    cues: fc.integer({ min: 0, max: 100 }).map((n) => n / 100),
    speech: fc.integer({ min: 0, max: 100 }).map((n) => n / 100),
    music: fc.integer({ min: 0, max: 100 }).map((n) => n / 100),
  }),
  mono: fc.boolean(),
  voice: fc.boolean(),
  channels: fc
    .tuple(...CHANNEL_IDS.map(() => fc.boolean()))
    .map((flags) => Object.fromEntries(CHANNEL_IDS.map((id, i) => [id, flags[i]])) as Record<ChannelId, boolean>),
  picture: fc.boolean(),
  scanning: fc.boolean(),
  holdToConfirm: fc.boolean(),
  setupDone: fc.boolean(),
  coachLeadMs: fc.constantFrom(0, 1000, 2000, 3000),
  announce: fc.constantFrom('minimal' as const, 'normal' as const, 'detailed' as const),
});

/** Seeds for the level generator. */
export const seedArb = fc.integer({ min: 0, max: 0xffffffff });
