// How the phantom's nearness is felt: your heartbeat, and a sting when it is right behind you.

/** Within this many rooms (by the passages, not through walls) you hear your own heartbeat. */
export const HEART_RANGE = 5;
/** Within this many rooms, the phantom is right behind you. */
export const CLOSE_RANGE = 2;

/** Beats per minute for a distance in rooms: none out of range, 80 at the edge, racing at 160 next to you. */
export const heartRate = (rooms: number): number => (rooms > HEART_RANGE ? 0 : 60 + (HEART_RANGE - rooms) * 20);

/** Words for the heartbeat, so a deaf player reads what a blind player hears. */
export const heartWords = (bpm: number): string =>
  bpm === 0 ? '' : bpm >= 130 ? 'Heartbeat: racing' : bpm >= 100 ? 'Heartbeat: fast' : 'Heartbeat: uneasy';
