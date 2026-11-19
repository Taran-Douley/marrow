// One switch: every key, click, touch and gamepad button becomes the same
// `press`. Pure state machine, so it runs in tests and under any adapter.
// Requirements 1.1 to 1.7.

/**
 * What an adapter feeds in.
 * - `key`: pass `event.code` when you have it, else `event.key`.
 * - The web adapter should use pointer events only, so a touch is not counted
 *   twice (once as a touch, once as a synthesised click).
 */
export type RawInput =
  | { kind: 'key'; key: string; repeat?: boolean; ctrl?: boolean; alt?: boolean; meta?: boolean }
  | { kind: 'key-up'; key: string }
  | { kind: 'pointer' }
  | { kind: 'touch' }
  | { kind: 'gamepad'; pad: number; button: number; pressed: boolean }
  | { kind: 'gamepad-disconnected'; pad: number }
  /** Focus left the page: forget everything held, so no key stays stuck. */
  | { kind: 'blur' };

export type InputEvent = 'press' | 'escape';

export interface InputMachine {
  /** Returns the event this input produces, or null when it produces none. */
  handle(raw: RawInput): InputEvent | null;
  reset(): void;
}

const MODIFIER_KEYS = new Set([
  'Control',
  'ControlLeft',
  'ControlRight',
  'Alt',
  'AltLeft',
  'AltRight',
  'AltGraph',
  'Meta',
  'MetaLeft',
  'MetaRight',
  'OS',
  'Shift',
  'ShiftLeft',
  'ShiftRight',
]);

/** Single letters are folded to lower case so "A" down and "a" up match. */
const keyId = (key: string): string => (key.length === 1 ? key.toLowerCase() : key);

export function createInput(): InputMachine {
  const heldKeys = new Set<string>();
  const heldButtons = new Set<string>();

  return {
    handle(raw) {
      switch (raw.kind) {
        case 'key': {
          const id = keyId(raw.key);
          // Tab belongs to the browser: it moves focus.
          if (id === 'Tab') return null;
          // Ctrl, Alt or Meta with another key is a browser or system shortcut.
          const combo = raw.ctrl === true || raw.alt === true || raw.meta === true;
          if (combo && !MODIFIER_KEYS.has(raw.key)) return null;

          const alreadyDown = heldKeys.has(id);
          heldKeys.add(id);
          // A repeat, or a second down without a release, never counts.
          if (raw.repeat === true || alreadyDown) return null;
          return id === 'Escape' ? 'escape' : 'press';
        }
        case 'key-up':
          heldKeys.delete(keyId(raw.key));
          return null;
        case 'pointer':
        case 'touch':
          return 'press';
        case 'gamepad': {
          const id = `${raw.pad}:${raw.button}`;
          if (!raw.pressed) {
            heldButtons.delete(id);
            return null;
          }
          if (heldButtons.has(id)) return null;
          heldButtons.add(id);
          return 'press';
        }
        case 'gamepad-disconnected':
          for (const id of [...heldButtons]) {
            if (id.startsWith(`${raw.pad}:`)) heldButtons.delete(id);
          }
          return null;
        case 'blur':
          heldKeys.clear();
          heldButtons.clear();
          return null;
      }
    },
    reset() {
      heldKeys.clear();
      heldButtons.clear();
    },
  };
}
