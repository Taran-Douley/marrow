import { createInput, type RawInput } from '../input';
import type { Level } from '../level';
import { THEMES, contrastRatio, themeFor, type ThemeTokens } from '../theme';
import type { OutputCommand, Palette, Speed, ThemeId } from '../types';
import { proofResult } from './timing';
import type { ProofResult } from './types';

// The properties about how a game is presented and played, not about one level's timing:
// 7 no unsafe flashing, 9 contrast, 10 no hold or chord, 11 every line can be recorded,
// 12 a repair never changes the game for anyone who did not ask.

/** Most flashes allowed in any one second (WCAG 2.3.1: three). */
export const MAX_FLASHES_PER_SECOND = 3;

/**
 * Property 7, no unsafe flashing: in any one second of real time, no more than three flashes. Pass
 * the commands a level renders, and the speed rate (running seconds per real second). With reduced
 * motion there must be no flashes at all.
 */
export function noUnsafeFlashing(commands: readonly OutputCommand[], rate: number, reducedMotion = false, label = 'Level'): ProofResult {
  const flashes = commands
    .filter((c): c is Extract<OutputCommand, { channel: 'indicator' }> => c.channel === 'indicator' && c.flash)
    .map((c) => c.at / rate)
    .sort((a, b) => a - b)
    // Markers lit together (the jump and its grade) are one flash on screen.
    .filter((t, i, all) => i === 0 || t - all[i - 1]! > 0.05);
  const problems: string[] = [];
  if (reducedMotion && flashes.length > 0) {
    problems.push(`${label}: motion is reduced, but the sound marker still flashes ${flashes.length} times. It should hold steady instead.`);
  }
  for (let i = 0, j = 0; i < flashes.length; i++) {
    while (flashes[i]! - flashes[j]! >= 1) j++;
    const inSecond = i - j + 1;
    if (inSecond > MAX_FLASHES_PER_SECOND) {
      problems.push(`${label}: ${inSecond} flashes within one second, from ${flashes[j]!.toFixed(2)} s. The limit is ${MAX_FLASHES_PER_SECOND}.`);
      j = i; // report each burst once
    }
  }
  return proofResult(7, 'No unsafe flashing', problems);
}

const TEXT = 4.5;
const GRAPHIC = 3;

/**
 * Property 9, contrast: in every theme and palette, text meets 4.5:1 on the background and panels,
 * and the pips, outlines and focus ring meet 3:1 (WCAG 2.2 AA). Pass your own tokens to check a restyle.
 */
export function themesHaveContrast(extra: Readonly<Record<string, Partial<ThemeTokens>>> = {}): ProofResult {
  const problems: string[] = [];
  const check = (name: string, t: ThemeTokens): void => {
    const pairs: [keyof ThemeTokens, keyof ThemeTokens, number][] = [
      ['text', 'background', TEXT],
      ['text', 'panel', TEXT],
      ['mutedText', 'panel', TEXT],
      ['mutedText', 'background', TEXT],
      ['amber', 'panel', GRAPHIC],
      ['green', 'panel', GRAPHIC],
      ['line', 'panel', GRAPHIC],
      ['line', 'background', GRAPHIC],
      ['focus', 'background', GRAPHIC],
    ];
    for (const [fg, bg, need] of pairs) {
      const ratio = contrastRatio(t[fg], t[bg]);
      if (ratio < need) problems.push(`${name}: ${fg} (${t[fg]}) on ${bg} (${t[bg]}) is ${ratio.toFixed(2)}:1. It needs ${need}:1.`);
    }
  };
  for (const theme of Object.keys(THEMES) as ThemeId[]) {
    for (const palette of ['default', 'colourblind'] as Palette[]) check(`Theme '${theme}', palette '${palette}'`, themeFor(theme, palette));
  }
  for (const [name, tokens] of Object.entries(extra)) check(`Your theme '${name}'`, { ...THEMES.default, ...tokens });
  return proofResult(9, 'Contrast', problems);
}

/**
 * Property 10, no hold or chord: one tap of any key, a click, a touch or one gamepad button is a whole
 * press, at once. Nothing needs holding, two at once, or pressing twice; key repeat never adds presses.
 */
export function noHoldOrChord(): ProofResult {
  const problems: string[] = [];
  const once = (name: string, inputs: RawInput[], want: number): void => {
    const machine = createInput();
    const presses = inputs.map((i) => machine.handle(i)).filter((e) => e === 'press').length;
    if (presses !== want) problems.push(`${name}: gave ${presses} presses, but should give ${want}.`);
  };
  once('A tap of the space bar', [{ kind: 'key', key: ' ' }], 1);
  once('A tap of a letter', [{ kind: 'key', key: 'a' }], 1);
  once('A click', [{ kind: 'pointer' }], 1);
  once('A touch', [{ kind: 'touch' }], 1);
  once('One gamepad button', [{ kind: 'gamepad', pad: 0, button: 0, pressed: true }], 1);
  once('A key held down (key repeat)', [{ kind: 'key', key: ' ' }, { kind: 'key', key: ' ', repeat: true }, { kind: 'key', key: ' ', repeat: true }], 1);
  once('Tab, for the browser', [{ kind: 'key', key: 'Tab' }], 0);
  return proofResult(10, 'No hold or chord', problems);
}

/** A line template ("{value} or {there}?") as a pattern a spoken line can be checked against. */
const templatePattern = (template: string): RegExp =>
  new RegExp(`^${template.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\\\{\w+\\\}/g, '.*')}$`, 'i');

/**
 * Property 11, every line can be recorded: everything the game says is in its line script (the strings
 * table), so a voice actor or a voice service can record all of it. Pass the lines spoken while playing
 * and the script.
 */
export function linesInScript(spoken: readonly string[], script: readonly { text: string }[], label = 'Game'): ProofResult {
  const patterns = script.map((l) => templatePattern(l.text));
  const missing = [...new Set(spoken)].filter((line) => !patterns.some((p) => p.test(line)));
  return proofResult(
    11,
    'Every line can be recorded',
    missing.map((line) => `${label}: "${line}" is spoken but is not in the line script, so it cannot be recorded or translated.`),
  );
}

/**
 * Property 12, intent preserved: a repair is a change to one player's settings, never to the level.
 * The level for everyone else is the same before and after.
 */
export function repairsKeepTheLevel(before: Level, after: Level, repairs: readonly { change: string; to?: Speed }[], label = 'Level'): ProofResult {
  const problems: string[] = [];
  if (JSON.stringify(before) !== JSON.stringify(after)) problems.push(`${label}: the level changed after a repair. A repair may only change one player's settings.`);
  for (const r of repairs) {
    if (r.change !== 'speed' && r.change !== 'none') problems.push(`${label}: a repair changes '${r.change}'. Only the player's own speed may change.`);
  }
  return proofResult(12, 'Intent preserved', problems);
}
