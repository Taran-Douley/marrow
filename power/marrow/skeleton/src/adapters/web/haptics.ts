// Vibration: a gamepad rumble and, where the browser allows it, the phone
// vibrator. Touch is a sense a deaf player gets the cue through (Requirement 3a.5).
// Phone vibration is not available on iPhones, so this never throws.

export interface RumblePadLike {
  vibrationActuator?: { playEffect(type: string, params: Record<string, number>): unknown } | null;
}

export interface HapticsOptions {
  /** `navigator.vibrate`, when the browser has it. */
  vibrate?: ((pattern: number[]) => unknown) | undefined;
  getPads?: () => readonly (RumblePadLike | null)[];
  /** Used to space out the segments of a rumble pattern. */
  schedule: (fn: () => void, ms: number) => unknown;
}

export interface Haptics {
  buzz(pattern: readonly number[]): void;
}

export function createHaptics(options: HapticsOptions): Haptics {
  return {
    buzz(pattern) {
      if (pattern.length === 0) return;
      try {
        options.vibrate?.([...pattern]);
      } catch {
        // Not allowed here: ignore.
      }
      // Pattern is on, off, on, off... in ms. Gamepads need one effect per "on".
      let offset = 0;
      pattern.forEach((ms, i) => {
        if (i % 2 === 0) {
          const start = offset;
          options.schedule(() => {
            for (const pad of options.getPads?.() ?? []) {
              try {
                void pad?.vibrationActuator?.playEffect('dual-rumble', {
                  duration: ms,
                  strongMagnitude: 0.8,
                  weakMagnitude: 0.8,
                });
              } catch {
                // This pad cannot rumble: ignore.
              }
            }
          }, start);
        }
        offset += ms;
      });
    },
  };
}
