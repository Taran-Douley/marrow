// Perks: small helps a player carries into the next run, earned from relics (spec seance-runs, R7 and R8.3).
//
// Rules that every perk keeps, and the tests check:
//  - It never changes the house (the maze, its rooms, relics and events are the same with or without it).
//  - It never changes the timing model: stride time, the time to say a line and the dwell are untouched.
//  - It only lowers a cost or adds help. It never raises a noise, adds a phantom move or takes a hint away.
//  - It is never needed: every house is escapable without one.

export type PerkId = 'soft-steps' | 'free-ask' | 'second-chance';

/** Every perk, in the order they are offered. */
export const PERK_IDS: readonly PerkId[] = ['soft-steps', 'free-ask', 'second-chance'];

export const isPerkId = (value: unknown): value is PerkId => typeof value === 'string' && (PERK_IDS as readonly string[]).includes(value);

/**
 * Soft steps: every noise the player makes is one level quieter (walking 1 to 0, running 2 to 1, a search 3 to 2).
 * Silence stays silence. Any other perk leaves the noise as it is.
 */
export function perkNoise(perk: PerkId | null | undefined, level: number): number {
  return perk === 'soft-steps' && level > 0 ? level - 1 : level;
}

/**
 * The perks that change how the phantom behaves on the best route, so the proof of 205 has to play them.
 * The others only change what Listen and hints cost, or what a catch counts for: the best route uses neither.
 */
export const PHANTOM_PERKS: readonly PerkId[] = ['soft-steps'];
