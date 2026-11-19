import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { createInput, type InputEvent, type RawInput } from '../src/input';

/** Feed a list of inputs and collect only the events that came out. */
function run(inputs: RawInput[]): InputEvent[] {
  const input = createInput();
  return inputs.flatMap((raw) => {
    const out = input.handle(raw);
    return out === null ? [] : [out];
  });
}

const down = (key: string, extra: Partial<Extract<RawInput, { kind: 'key' }>> = {}): RawInput => ({ kind: 'key', key, ...extra });
const up = (key: string): RawInput => ({ kind: 'key-up', key });

describe('one press from any device (Req 1.1, 1.2)', () => {
  it('turns a plain key into one press', () => {
    expect(run([down('Space'), up('Space')])).toEqual(['press']);
    expect(run([down('x'), up('x')])).toEqual(['press']);
  });

  it('counts every kind of key, even a modifier pressed alone', () => {
    for (const key of ['Enter', 'ArrowUp', 'F5', 'Shift', 'Control', 'CapsLock']) {
      expect(run([down(key)])).toEqual(['press']);
    }
  });

  it('turns a click, a touch and a gamepad button into one press each', () => {
    expect(run([{ kind: 'pointer' }])).toEqual(['press']);
    expect(run([{ kind: 'touch' }])).toEqual(['press']);
    expect(run([{ kind: 'gamepad', pad: 0, button: 3, pressed: true }])).toEqual(['press']);
  });

  it('presses once per gamepad press, not while the button is held or on release', () => {
    expect(
      run([
        { kind: 'gamepad', pad: 0, button: 0, pressed: true },
        { kind: 'gamepad', pad: 0, button: 0, pressed: true },
        { kind: 'gamepad', pad: 0, button: 0, pressed: false },
        { kind: 'gamepad', pad: 0, button: 0, pressed: true },
      ]),
    ).toEqual(['press', 'press']);
  });

  it('treats different buttons and different pads separately', () => {
    expect(
      run([
        { kind: 'gamepad', pad: 0, button: 0, pressed: true },
        { kind: 'gamepad', pad: 0, button: 1, pressed: true },
        { kind: 'gamepad', pad: 1, button: 0, pressed: true },
      ]),
    ).toEqual(['press', 'press', 'press']);
  });
});

describe('key repeat is ignored (Req 1.3)', () => {
  it('gives one press for a held key with repeats', () => {
    expect(run([down('Space'), down('Space', { repeat: true }), down('Space', { repeat: true }), up('Space')])).toEqual(['press']);
  });

  it('also ignores a second down with no release, when the system sends no repeat flag', () => {
    expect(run([down('Space'), down('Space'), down('Space')])).toEqual(['press']);
  });

  it('presses again after the key is released', () => {
    expect(run([down('Space'), up('Space'), down('Space'), up('Space')])).toEqual(['press', 'press']);
  });

  it('(PBT) gives exactly one press per physical key press, however long it is held', () => {
    const physicalPress = fc.record({
      key: fc.constantFrom('Space', 'Enter', 'a', 'ArrowLeft', 'F2', 'Shift'),
      repeats: fc.integer({ min: 0, max: 30 }),
      flagRepeats: fc.boolean(),
    });
    fc.assert(
      fc.property(fc.array(physicalPress, { maxLength: 40 }), (presses) => {
        const inputs: RawInput[] = presses.flatMap((p) => [
          down(p.key),
          ...Array.from({ length: p.repeats }, () => down(p.key, p.flagRepeats ? { repeat: true } : {})),
          up(p.key),
        ]);
        expect(run(inputs)).toEqual(presses.map(() => 'press'));
      }),
      { numRuns: 200 },
    );
  });

  it('counts two different keys held at once as two presses, never needing both', () => {
    expect(run([down('a'), down('b'), up('a'), up('b')])).toEqual(['press', 'press']);
  });

  it('does not get stuck when a capital letter is released as lower case', () => {
    expect(run([down('A', { repeat: false }), up('a'), down('a'), up('a')])).toEqual(['press', 'press']);
  });
});

describe('Escape, Tab and shortcuts (Req 1.4, 1.5)', () => {
  it('turns Escape into an escape event and never a press', () => {
    expect(run([down('Escape'), up('Escape')])).toEqual(['escape']);
  });

  it('ignores Escape repeat', () => {
    expect(run([down('Escape'), down('Escape', { repeat: true })])).toEqual(['escape']);
  });

  it('leaves Tab to the browser', () => {
    expect(run([down('Tab'), up('Tab')])).toEqual([]);
  });

  it('leaves Ctrl, Alt and Meta shortcuts to the browser', () => {
    expect(run([down('c', { ctrl: true })])).toEqual([]);
    expect(run([down('F4', { alt: true })])).toEqual([]);
    expect(run([down('r', { meta: true })])).toEqual([]);
  });

  it('still counts the modifier key itself as a press', () => {
    expect(run([down('Control', { ctrl: true })])).toEqual(['press']);
  });

  it('(PBT) a key with Ctrl, Alt or Meta never presses', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 1 }),
        fc.constantFrom({ ctrl: true }, { alt: true }, { meta: true }),
        (key, mods) => {
          expect(run([down(key, mods)])).toEqual([]);
        },
      ),
    );
  });

  it('allows Shift with a letter, which is only typing a capital', () => {
    expect(run([down('A')])).toEqual(['press']);
  });
});

describe('devices come and go (Req 1.7)', () => {
  it('keeps working after a gamepad disconnects and reconnects', () => {
    expect(
      run([
        { kind: 'gamepad', pad: 0, button: 0, pressed: true },
        { kind: 'gamepad-disconnected', pad: 0 },
        { kind: 'gamepad', pad: 0, button: 0, pressed: true },
        down(' '),
      ]),
    ).toEqual(['press', 'press', 'press']);
  });

  it('forgets held keys and buttons when focus is lost, so nothing sticks', () => {
    expect(run([down('Space'), { kind: 'blur' }, down('Space')])).toEqual(['press', 'press']);
  });

  it('reset clears held state', () => {
    const input = createInput();
    expect(input.handle(down('a'))).toBe('press');
    input.reset();
    expect(input.handle(down('a'))).toBe('press');
  });
});

describe('no hold, no chord (Req 1.6)', () => {
  it('(PBT) any single input is enough: the first input from a fresh machine always acts', () => {
    const single = fc.oneof(
      fc.constantFrom('Space', 'Enter', 'x', 'ArrowDown', 'F9').map((k) => down(k)),
      fc.constant<RawInput>({ kind: 'pointer' }),
      fc.constant<RawInput>({ kind: 'touch' }),
      fc.integer({ min: 0, max: 16 }).map<RawInput>((b) => ({ kind: 'gamepad', pad: 0, button: b, pressed: true })),
    );
    fc.assert(
      fc.property(single, (raw) => {
        expect(createInput().handle(raw)).toBe('press');
      }),
    );
  });
});
