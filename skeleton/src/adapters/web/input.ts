import type { InputEvent, InputMachine, RawInput } from '../../input';

// Connects the browser to the one-switch input machine (Requirement 1).

export interface EventTargetLike {
  addEventListener(type: string, listener: (event: never) => void, options?: unknown): void;
  removeEventListener(type: string, listener: (event: never) => void, options?: unknown): void;
}

interface KeyLike {
  code?: string;
  key: string;
  repeat?: boolean;
  ctrlKey?: boolean;
  altKey?: boolean;
  metaKey?: boolean;
  target?: unknown;
  preventDefault?: () => void;
}
interface PointerLike {
  target?: unknown;
}

const SCROLL_KEYS = new Set([' ', 'Spacebar', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'PageUp', 'PageDown', 'Home', 'End']);

export interface InputHandlers {
  onPress(): void;
  onEscape(): void;
}

/** True when the event came from a form control or a link, which must keep working normally. */
export function isControl(target: unknown): boolean {
  const el = target as { closest?: (selector: string) => unknown } | null | undefined;
  return typeof el?.closest === 'function' && el.closest('input, select, textarea, button, a, summary, [data-marrow-ignore]') !== null;
}

/**
 * Listen for keys, pointer presses and focus loss. Keys and clicks that
 * land on a form control are left alone, so a keyboard user can change a
 * setting without making the ghost jump (Requirement 2.4).
 */
export function bindInput(target: EventTargetLike, machine: InputMachine, handlers: InputHandlers): () => void {
  const dispatch = (out: InputEvent | null): void => {
    if (out === 'press') handlers.onPress();
    else if (out === 'escape') handlers.onEscape();
  };

  const onKeyDown = (e: KeyLike): void => {
    if (isControl(e.target)) return;
    const raw: RawInput = {
      kind: 'key',
      key: e.code || e.key,
      repeat: e.repeat === true,
      ctrl: e.ctrlKey === true,
      alt: e.altKey === true,
      meta: e.metaKey === true,
    };
    const out = machine.handle(raw);
    // Stop only the keys that scroll the page. Other keys (F5, F12...) keep their browser job.
    if (SCROLL_KEYS.has(e.key) && !raw.ctrl && !raw.alt && !raw.meta) e.preventDefault?.();
    dispatch(out);
  };
  const onKeyUp = (e: KeyLike): void => void machine.handle({ kind: 'key-up', key: e.code || e.key });
  // Pointer events cover mouse, pen and touch once, so a tap is not counted twice.
  const onPointerDown = (e: PointerLike): void => {
    if (isControl(e.target)) return;
    dispatch(machine.handle({ kind: 'pointer' }));
  };
  const onBlur = (): void => void machine.handle({ kind: 'blur' });

  const listeners: [string, (event: never) => void][] = [
    ['keydown', onKeyDown],
    ['keyup', onKeyUp],
    ['pointerdown', onPointerDown],
    ['blur', onBlur],
  ];
  for (const [type, fn] of listeners) target.addEventListener(type, fn);
  return () => {
    for (const [type, fn] of listeners) target.removeEventListener(type, fn);
  };
}

export interface GamepadLike {
  index: number;
  buttons: readonly { pressed: boolean }[];
}

/** Call once per frame. Any gamepad button counts as the switch. */
export function createGamepadPoller(
  getPads: () => readonly (GamepadLike | null)[],
  machine: InputMachine,
  handlers: InputHandlers,
): { poll(): void } {
  const known = new Set<number>();
  return {
    poll() {
      const seen = new Set<number>();
      for (const pad of getPads()) {
        if (!pad) continue;
        seen.add(pad.index);
        known.add(pad.index);
        pad.buttons.forEach((button, b) => {
          const out = machine.handle({ kind: 'gamepad', pad: pad.index, button: b, pressed: button.pressed });
          if (out === 'press') handlers.onPress();
        });
      }
      for (const index of [...known]) {
        if (!seen.has(index)) {
          known.delete(index);
          machine.handle({ kind: 'gamepad-disconnected', pad: index });
        }
      }
    },
  };
}
