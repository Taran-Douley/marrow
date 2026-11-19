import { speechMs } from '../scanning';
import type { Character, OutputCommand, Signature, SpeakerView } from '../types';

// Character voices: who says a line, how they sound, and the short sound they make first.
//
// Limit, said plainly: the browser's own voice (the Web Speech API) cannot be routed through Web Audio,
// so it cannot be panned and nothing can be done to it. A character's position therefore places the
// signature sound, and a recorded clip where the player's clip engine supports it. Characters stay
// apart by their words, pitch, pace and signature as well.

/** A signature is shorter than this, in ms. */
export const SIGNATURE_LIMIT_MS = 300;
/** A short pause between the end of a signature and the first word, in ms. */
export const SIGNATURE_GAP_MS = 80;
/** The id a kit uses for the voice that speaks when no character is named. It is unnamed and has no signature unless the game gives one. */
export const NARRATOR = 'narrator';

const clamp = (v: number, lo: number, hi: number): number => Math.max(lo, Math.min(hi, v));

/** Time a signature adds before its line, in ms. 0 for a character with none. */
export function signatureLeadMs(who: { signature?: Signature | undefined } | undefined): number {
  return who?.signature ? Math.round(who.signature.ms) + SIGNATURE_GAP_MS : 0;
}

/** Turn a declared character into the full view an output command carries. */
export function speakerView(id: string, c: Character): SpeakerView {
  return { ...c, id, pitch: c.pitch ?? 1, rate: c.rate ?? 1, pan: clamp(c.pan ?? 0, -1, 1) };
}

/**
 * Refuse characters that cannot work, now, in plain words: a signature of 300 ms or more, a position
 * outside -1 to 1, a pitch or pace outside 0.5 to 2, a signature with no sound in it.
 */
export function validateCharacters(characters: Readonly<Record<string, Character>>): void {
  const problems: string[] = [];
  for (const [id, c] of Object.entries(characters)) {
    const who = `Character '${id}'`;
    if (c.pitch !== undefined && !(c.pitch >= 0.5 && c.pitch <= 2)) problems.push(`${who}: pitch ${c.pitch} is outside 0.5 to 2.`);
    if (c.rate !== undefined && !(c.rate >= 0.5 && c.rate <= 2)) problems.push(`${who}: rate ${c.rate} is outside 0.5 to 2.`);
    if (c.pan !== undefined && !(c.pan >= -1 && c.pan <= 1)) problems.push(`${who}: position ${c.pan} is outside -1 (left) to 1 (right).`);
    const s = c.signature;
    if (s) {
      if (!(s.ms > 0 && s.ms < SIGNATURE_LIMIT_MS)) problems.push(`${who}: the signature lasts ${s.ms} ms. It must be under ${SIGNATURE_LIMIT_MS} ms.`);
      if (!(s.hz > 0)) problems.push(`${who}: the signature needs a pitch above 0.`);
    }
    if (c.name !== undefined && c.name.trim() === '') problems.push(`${who}: the name is empty. Leave it out for an unnamed narrator.`);
  }
  if (problems.length > 0) throw new Error(problems.join(' '));
}

/**
 * How long a spoken command takes, in ms, by a fair guess: the words, plus the signature and its pause.
 * Zero for anything that is not speech. Use this, not `speechMs` alone, for every wait on words.
 */
export function spokenMs(cmd: OutputCommand): number {
  return cmd.channel === 'speech' ? speechMs(cmd.text) + signatureLeadMs(cmd.speaker) : 0;
}

/** The total of `spokenMs` over some commands. */
export function totalSpokenMs(commands: readonly OutputCommand[]): number {
  return commands.reduce((sum, c) => sum + spokenMs(c), 0);
}

/** The line as the live text and the captions show it: "Mabel: the line" for a named character. */
export function labelled(text: string, who: { name?: string | undefined } | undefined): string {
  return who?.name ? `${who.name}: ${text}` : text;
}

export type Difference = 'pitch' | 'rate' | 'position' | 'signature';

const PITCH_APART = 0.1;
const RATE_APART = 0.08;
const POSITION_APART = 0.3;
/** Two signature pitches are apart when one is at least this many times the other (about 4 semitones). */
const SIGNATURE_HZ_RATIO = 1.25;

function signaturesDiffer(a: Signature | undefined, b: Signature | undefined): boolean {
  if (!a && !b) return false;
  if (!a || !b) return true;
  if (a.wave !== b.wave) return true;
  const hi = Math.max(a.hz, b.hz);
  const lo = Math.min(a.hz, b.hz);
  return hi / lo >= SIGNATURE_HZ_RATIO;
}

/** In which of pitch, rate, position and signature two characters can be told apart. */
export function differences(a: Character, b: Character): Difference[] {
  const out: Difference[] = [];
  if (Math.abs((a.pitch ?? 1) - (b.pitch ?? 1)) >= PITCH_APART) out.push('pitch');
  if (Math.abs((a.rate ?? 1) - (b.rate ?? 1)) >= RATE_APART) out.push('rate');
  if (Math.abs((a.pan ?? 0) - (b.pan ?? 0)) >= POSITION_APART) out.push('position');
  if (signaturesDiffer(a.signature, b.signature)) out.push('signature');
  return out;
}

/** A plain-words list of the pairs that differ in fewer than two ways. Empty means every pair is apart. */
export function charactersTooAlike(characters: Readonly<Record<string, Character>>, label = 'Characters'): string[] {
  const ids = Object.keys(characters);
  const problems: string[] = [];
  for (let i = 0; i < ids.length; i++) {
    for (let j = i + 1; j < ids.length; j++) {
      const a = characters[ids[i]!]!;
      const b = characters[ids[j]!]!;
      const apart = differences(a, b);
      if (apart.length < 2) {
        problems.push(
          `${label}: ${a.name ?? ids[i]} and ${b.name ?? ids[j]} differ only in ${apart.length === 0 ? 'nothing' : apart[0]}. ` +
            `They need to differ in at least two of pitch, rate, position and signature, so a player can tell who is speaking.`,
        );
      }
    }
  }
  return problems;
}

/** A window of level time, in running seconds, in which no signature may sound: a countdown. */
export interface Window {
  from: number;
  to: number;
}

/**
 * Plain-words problems for every signature that would sound inside one of the windows. A signature
 * sounds from the line's own time to its length later, at the speed the player plays at.
 */
export function signaturesOutsideWindows(commands: readonly OutputCommand[], windows: readonly Window[], rate: number, label = 'Level'): string[] {
  const problems: string[] = [];
  for (const cmd of commands) {
    if (cmd.channel !== 'speech' || !cmd.speaker?.signature) continue;
    const from = cmd.at;
    const to = cmd.at + (signatureLeadMs(cmd.speaker) / 1000) * rate;
    for (const w of windows) {
      if (from < w.to && to > w.from) {
        problems.push(`${label}: the signature of ${cmd.speaker.name ?? cmd.speaker.id} at ${from.toFixed(2)} s sounds inside a countdown (${w.from.toFixed(2)} to ${w.to.toFixed(2)} s).`);
      }
    }
  }
  return problems;
}
