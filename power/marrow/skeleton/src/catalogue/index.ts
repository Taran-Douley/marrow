import type { Kit } from '../kit';
import { HAPTIC_TABLE, VOICE_TABLE, type ObjectDef, type ObjectOptions } from '../registry';
import type { Wave } from '../types';

// Ready-made objects: the ones Ghastly Moves and Séance Escape already use, each with its sound,
// spoken name, caption and vibration. Use one as it is, or change any part of it:
//
//   useObject(kit, stone);
//   useObject(kit, bat, { width: [0.12, 0.2] });
//
// docs/catalogue.md is made from this file by a test, so the two never disagree.

export interface ObjectPreset {
  /** The name used in levels and the proof. */
  name: string;
  /** An obstacle has a width and is jumped; an object is anything else (a relic, a bell). */
  kind: 'obstacle' | 'object';
  /** Width in running seconds, for obstacles. */
  width?: readonly [number, number];
  say: string;
  caption: string;
  sound: { hz: number; wave: Wave };
  haptic: readonly number[];
  /** Which game uses it, and how. */
  from: string;
}

/** What you give `preset`: a name, and a width if it is jumped. Everything else has a default. */
export type PresetInput = Pick<ObjectPreset, 'name'> & Partial<Omit<ObjectPreset, 'name'>>;

/** The same name always gets the same default voice and buzz. */
const pickFor = <T>(name: string, from: readonly T[]): T => {
  let h = 0;
  for (const c of name) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return from[h % from.length]!;
};

/**
 * Make a preset, refusing one that cannot work, in plain words. Only the name is needed: give a width
 * and it is an obstacle. The words, caption, sound and vibration default from the name.
 *
 *   export default preset({ name: 'crypt', width: [0.2, 0.3] });
 */
export function preset(input: PresetInput): ObjectPreset {
  const words = input.name.replace(/-/g, ' ');
  const p: ObjectPreset = {
    kind: input.width ? 'obstacle' : 'object',
    say: words,
    caption: words.charAt(0).toUpperCase() + words.slice(1),
    sound: (({ hz, wave }) => ({ hz, wave }))(pickFor(input.name, VOICE_TABLE)),
    haptic: pickFor(input.name, HAPTIC_TABLE),
    from: '',
    ...input,
  };
  const where = `Object '${p.name || '(no name)'}'`;
  if (!/^[a-z][a-z0-9-]*$/.test(p.name)) throw new Error(`${where}: a name is lower case letters, digits and hyphens, like 'iron-ball'.`);
  if (p.kind === 'obstacle' && !p.width) throw new Error(`${where}: an obstacle needs a width, like [0.16, 0.3].`);
  if (p.width && !(p.width[0] > 0 && p.width[1] >= p.width[0])) throw new Error(`${where}: the width must be [min, max] with min above zero.`);
  if (!p.say.trim() || !p.caption.trim()) throw new Error(`${where}: it needs words to say and a caption to show.`);
  if (!(p.sound.hz > 0)) throw new Error(`${where}: its sound needs a pitch above zero.`);
  return Object.freeze({ ...p });
}

/** Put a preset in a kit, with any part changed. Returns what the kit made of it. */
export function useObject(kit: Kit, p: ObjectPreset, change: ObjectOptions = {}): ObjectDef {
  const options: ObjectOptions = { say: p.say, caption: p.caption, sound: p.sound, haptic: p.haptic, ...(p.width ? { width: p.width } : {}), ...change };
  return p.kind === 'obstacle' || options.width !== undefined
    ? kit.defineObstacle(p.name, { ...options, width: options.width ?? p.width! })
    : kit.defineObject(p.name, options);
}

const JUMP = [0.16, 0.3] as const;
const THUD = [250, 120, 250] as const;
const throwable = (name: string, say: string, boss: string): ObjectPreset =>
  preset({ name, kind: 'obstacle', width: JUMP, say, caption: say, sound: { hz: 440, wave: 'square' }, haptic: THUD, from: `Ghastly Moves: what ${boss} throws` });

// ---- Ghastly Moves ------------------------------------------------------------------

export const stone = preset({ name: 'stone', kind: 'obstacle', width: JUMP, say: 'stone', caption: 'Stone', sound: { hz: 294, wave: 'triangle' }, haptic: THUD, from: 'Ghastly Moves: the numbered gravestone in every jump part' });
export const spike = preset({ name: 'spike', kind: 'obstacle', width: [0.12, 0.2], say: 'spike', caption: 'Spike', sound: { hz: 587, wave: 'sine' }, haptic: [60, 60, 60], from: 'Ghastly Moves: flip mode, cleared by flipping to the other side' });
export const gate = preset({ name: 'gate', kind: 'obstacle', width: [0.12, 0.18], say: 'gate', caption: 'Gate', sound: { hz: 440, wave: 'square' }, haptic: [120, 80, 120, 80, 120], from: 'Ghastly Moves: a number gate, one number in each lane' });
export const pumpkinBomb = throwable('pumpkin-bomb', 'pumpkin bomb', 'the Pumpkin King');
export const bone = throwable('bone', 'bone', 'the Bone Warden');
export const hex = throwable('hex', 'hex', 'the Moss Witch');
export const ironBall = throwable('iron-ball', 'iron ball', 'the Gatekeeper');
export const webBall = throwable('web-ball', 'web ball', 'the Spider Miller');
export const wisp = throwable('wisp', 'wisp', 'the Hollow Wraith');
export const bat = throwable('bat', 'bat', 'Count Vexar');

// ---- Séance Escape ------------------------------------------------------------------

const hum = (name: string, say: string, hz: number): ObjectPreset =>
  preset({ name, kind: 'object', say, caption: say.charAt(0).toUpperCase() + say.slice(1), sound: { hz, wave: 'sine' }, haptic: [20, 40, 20], from: 'Séance Escape: a relic that hums from its room' });

export const silverCandle = hum('silver-candle', 'silver candle', 523);
export const locket = hum('locket', 'locket', 587);
export const planchette = hum('planchette', 'planchette', 659);
export const greatBell = preset({ name: 'great-bell', kind: 'object', say: 'the great bell', caption: 'Great bell', sound: { hz: 659, wave: 'sine' }, haptic: [60, 60, 200], from: 'Séance Escape: the way out, tolling in the Front Hall' });

/** Every ready-made object, in the order the docs list them. */
export const CATALOGUE: readonly ObjectPreset[] = [stone, spike, gate, pumpkinBomb, bone, hex, ironBall, webBall, wisp, bat, silverCandle, locket, planchette, greatBell];

/** The catalogue as Markdown, for docs/catalogue.md. */
export function catalogueMarkdown(
  list: readonly ObjectPreset[] = CATALOGUE,
  heading = {
    title: 'Catalogue of ready-made objects',
    made: 'Made from `skeleton/src/catalogue/index.ts` by a test, never by hand. `npm run catalogue --workspace skeleton` rewrites it.',
  },
): string {
  const id = (name: string): string => name.replace(/-(\w)/g, (_, c: string) => c.toUpperCase());
  return [
    `# ${heading.title}`,
    '',
    heading.made,
    '',
    '```ts',
    "import { stone, useObject } from '@marrow/skeleton/catalogue';",
    'useObject(kit, stone);                         // as it is',
    'useObject(kit, stone, { width: [0.2, 0.3] });  // or with any part changed',
    '```',
    '',
    '| Import | Kind | Width (s) | Says | Caption | Sound | Vibration (ms) | Used in |',
    '|---|---|---|---|---|---|---|---|',
    ...list.map(
      (p) =>
        `| \`${id(p.name)}\` | ${p.kind} | ${p.width ? `${p.width[0]} to ${p.width[1]}` : 'none'} | ${p.say} | ${p.caption} | ${p.sound.hz} Hz ${p.sound.wave} | ${p.haptic.join(', ')} | ${p.from} |`,
    ),
    '',
    'Every object gets all four outputs, so every one reaches at least two senses. Obstacles of the same width range pass the timing proof at every speed.',
    '',
  ].join('\n');
}
