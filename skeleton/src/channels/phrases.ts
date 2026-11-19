// Every spoken line and caption lives here, in one place, so the proof can
// check coverage (property 11) and a game can reword or translate them.
// Plain, short sentences, in the words players use (Requirement 4.5).

export const PHRASES = {
  approaching: '{name} ahead.',
  pressNow: 'Press now',
  fallEarly: 'Pressed a little early.',
  fallLate: 'Pressed a little late.',
  fallNone: 'No press.',
  cleared: 'Cleared.',
  hurt: 'Hurt.',
  levelComplete: 'Level complete.',
  /** A lesson's number, spoken and shown each time one approaches. */
  number: '{value}',
  /** Pressed on something that should have been let pass. */
  fallWrong: 'Not that one.',
  /** After a fall at an obstacle already fallen at: the short reason, then the try number (only with `run.explainOnce`). */
  fallAttempt: 'Attempt {attempt}.',
  /** The fourth beat in a lesson: it must not give away whether to press. */
  yourMove: 'Your move',
  perfect: 'Perfect',
  good: 'Good',
  ok: 'Ok',
  streak: '{streak} in a row',
  /** A portal: from here on, a press does something else. */
  portalJump: 'Jump mode. Press to jump.',
  portalFlip: 'Flip mode. Press to flip.',
  portalSwitch: 'Gates. Yours first. Press to switch.',
  /**
   * A number gate: the number in your lane first, then the one a press switches you to. Kept short so
   * it is said in full before the fourth beat even at Fast (property 104). The caption says "Stay" and "Switch".
   */
  gate: '{here} or {there}?',
  /** The coach's heads-up before a countdown. {move} is jump, flip, switch, decide or choose. */
  coach: '{what} coming. Get ready to {move}.',
  /** The caption for a gate, which has room to say which is which. */
  gateCaption: 'Stay {here} · Switch {there}',
} as const;

export type PhraseKey = keyof typeof PHRASES;
export const PHRASE_KEYS = Object.keys(PHRASES) as PhraseKey[];

/** A full set of lines. Build one with createStrings. */
export type Strings = Readonly<Record<PhraseKey, string>>;

/**
 * Your own wording, or a translation. Anything you leave out keeps the default.
 * A line may not be empty, because a silent gap is an accessibility bug.
 */
export function createStrings(overrides: Partial<Record<PhraseKey, string>> = {}): Strings {
  const merged: Record<PhraseKey, string> = { ...PHRASES };
  for (const key of Object.keys(overrides)) {
    if (!(key in PHRASES)) {
      throw new Error(`Unknown line '${key}'. Lines you can change: ${PHRASE_KEYS.join(', ')}.`);
    }
    const text = overrides[key as PhraseKey];
    if (text === undefined) continue;
    if (text.trim() === '') throw new Error(`The line '${key}' cannot be empty.`);
    merged[key as PhraseKey] = text;
  }
  return merged;
}

const capitalise = (text: string): string => text.charAt(0).toUpperCase() + text.slice(1);

/** Fill {name}-style slots, then start the sentence with a capital letter. */
export function fillSlots(template: string, vars: Record<string, string> = {}): string {
  return capitalise(template.replace(/\{(\w+)\}/g, (_match, slot: string) => vars[slot] ?? '').trim());
}

export function phrase(key: PhraseKey, vars: Record<string, string> = {}, strings: Strings = PHRASES): string {
  return fillSlots(strings[key], vars);
}
