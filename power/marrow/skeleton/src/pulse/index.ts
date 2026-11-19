// Beat-synced visuals. A picture can breathe with the music, but only gently: a soft swell on each
// beat, never more than one a beat, and none at all when motion is reduced. This is pure maths, so
// any game, and the proof (property 21), can use it. The game decides what swells (a glow, a line).

/** Most pulses allowed in one real second. It matches the flash limit (WCAG 2.3.1: three). */
export const MAX_PULSES_PER_SECOND = 3;

/**
 * The most a pulse may change what is on screen: this share of the way from its own colour to the
 * background behind it. With the pulse colour no brighter than white, the change in relative
 * luminance stays under 0.1, the WCAG threshold for a general flash.
 */
export const PULSE_MAX_ALPHA = 0.1;

/** A pulse rises over this share of a beat, then falls away by `PULSE_SPAN`. It is still for the rest. */
const ATTACK = 0.08;
export const PULSE_SPAN = 0.5;

/**
 * How strong the pulse is at a level time: 0 to 1, rising softly on each beat and dying away before
 * the next. Zero when motion is reduced. Multiply by `PULSE_MAX_ALPHA` to get an opacity.
 */
export function pulseAt(t: number, beat: number, reducedMotion = false): number {
  if (reducedMotion || !(beat > 0) || !Number.isFinite(t) || t < 0) return 0;
  const into = (((t / beat + 1e-9) % 1) + 1) % 1;
  if (into < ATTACK) return into / ATTACK;
  if (into >= PULSE_SPAN) return 0;
  const x = 1 - (into - ATTACK) / (PULSE_SPAN - ATTACK);
  return x * x;
}

/** How many pulses a player sees each real second, at a speed's rate (running seconds per real second). */
export const pulsesPerSecond = (beat: number, rate: number): number => rate / beat;
