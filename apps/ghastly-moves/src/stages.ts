import type { Lesson, TrackSpec } from '@marrow/skeleton';
import { PUMPKIN_PATTERN, type BossPattern } from './pattern';
import { BONE_PATTERN, GATEKEEPER_PATTERN, MOSS_PATTERN, SPIDER_PATTERN, VEXAR_PATTERN, WRAITH_PATTERN } from './patterns';
import { SONGS, type StageSong } from './songs';
import { TRACKS, bossTrack } from './tracks';

/**
 * The story of Ghastly Moves: seven places on the road through Grimsby Hollow. Each place has
 * its own kind of maths, its own length, its own scenery and its own background track. At the
 * end of each stands a boss with harder numbers. Beat the boss and you win an item for your
 * lantern. Nothing here changes how hard the timing is: that is the player's speed setting.
 */

export interface Item {
  id: string;
  name: string;
  /** What it is, in one plain line. */
  blurb: string;
}

/** How a boss looks. Each is drawn in code from simple shapes. */
export type BossLook = 'pumpkin' | 'skeleton' | 'witch' | 'knight' | 'spider' | 'wraith' | 'vampire';

export interface Projectile {
  /** The obstacle's name: its own sound and spoken name, the same for every throw so the answer is never given away. */
  name: string;
  /** What the player hears and reads: 'pumpkin bomb'. */
  label: string;
  colour: string;
  shape: 'round' | 'bone' | 'star' | 'bat' | 'bomb';
}

export interface Boss {
  name: string;
  look: BossLook;
  /** What the boss throws. Jump over the ones that fit the rule; the others are duds that fly through you. */
  projectile: Projectile;
  /**
   * A fixed attack pattern, read by sound alone: volleys of different throws, each with its own sound,
   * and a tell before each volley. The fight is then a song, so `count` is only a rough size; the
   * throws are whatever the song holds. Without one, the boss throws `projectile` at a steady pace.
   */
  pattern?: BossPattern;
  /** Said when the boss appears. */
  taunt: string;
  lesson: Lesson;
  count: number;
  /** Share of the stones that must be right to win. Below this, the boss laughs and you try again. */
  need: number;
  item: Item;
}

export type Scenery = 'moon' | 'mist' | 'woods' | 'gate' | 'hollow' | 'midnight' | 'mill' | 'patch';

export interface Stage {
  id: number;
  name: string;
  /** Said at the start of the stage. */
  story: string;
  /** Said and shown when the maths is named, for the list and the map. */
  rule: string;
  /** The rule as it fits in a sentence: 'an even number'. */
  ruleWords: string;
  lesson: Lesson;
  count: number;
  scenery: Scenery;
  track: TrackSpec;
  /** The song the level is built from: its parts, its moves and its tempo. */
  song: StageSong;
  boss: Boss;
  /** Where the place sits on the story map, as a share of its width and height. */
  at: { x: number; y: number };
}

// ---- the maths --------------------------------------------------------------

const listWords = (tables: readonly number[]): string =>
  tables.length <= 2 ? tables.join(' or ') : `${tables.slice(0, -1).join(', ')} or ${tables.at(-1)}`;

/** Jump on a multiple of any of these tables. */
export function multiplesOf(tables: readonly number[], values: readonly [number, number] = [1, Math.max(...tables) * 12], title?: string): Lesson {
  if (tables.length === 0 || tables.some((n) => !Number.isInteger(n) || n < 2)) {
    throw new Error('A times table needs a whole number from 2 up.');
  }
  const words = listWords(tables);
  const first = (value: number): number => tables.find((n) => value % n === 0) ?? tables[0]!;
  return {
    title: title ?? (tables.length === 1 ? `${tables[0]} times table` : `${words} times tables`),
    prompt: `Jump on every multiple of ${words}. Let the others pass.`,
    values,
    isTarget: (value) => tables.some((n) => value % n === 0),
    explainWrong: (value) => `${value} is not a multiple of ${words}.`,
    explainMiss: (value) => {
      const n = first(value);
      return `${value} is a multiple of ${n}: ${value / n} times ${n}.`;
    },
  };
}

export function evenNumbers(values: readonly [number, number], title = 'Even numbers'): Lesson {
  return {
    title,
    prompt: 'Jump on every even number. Let the odd ones pass.',
    values,
    isTarget: (v) => v % 2 === 0,
    explainWrong: (v) => `${v} is odd. Even numbers end in 0, 2, 4, 6 or 8.`,
    explainMiss: (v) => `${v} is even: it ends in ${v % 10}.`,
  };
}

const isSquare = (v: number): boolean => v >= 1 && Number.isInteger(Math.sqrt(v));

export function squareNumbers(values: readonly [number, number], title = 'Square numbers'): Lesson {
  return {
    title,
    prompt: 'Jump on every square number. That is a number times itself, like 3 times 3. Let the others pass.',
    values,
    isTarget: isSquare,
    explainWrong: (v) => `${v} is not a square. No whole number times itself makes ${v}.`,
    explainMiss: (v) => `${v} is a square: ${Math.sqrt(v)} times ${Math.sqrt(v)}.`,
  };
}

const smallestFactor = (v: number): number => {
  for (let f = 2; f * f <= v; f++) if (v % f === 0) return f;
  return v;
};
export const isPrime = (v: number): boolean => v >= 2 && smallestFactor(v) === v;

export function primeNumbers(values: readonly [number, number], title = 'Prime numbers'): Lesson {
  return {
    title,
    prompt: 'Jump on every prime number. A prime can only be shared out by 1 and itself. Let the others pass.',
    values,
    isTarget: isPrime,
    explainWrong: (v) => `${v} is not prime: ${smallestFactor(v)} times ${v / smallestFactor(v)} makes ${v}.`,
    explainMiss: (v) => `${v} is prime: only 1 and ${v} go into it.`,
  };
}

// ---- the story --------------------------------------------------------------

const item = (id: string, name: string, blurb: string): Item => ({ id, name, blurb });

export const STAGES: readonly Stage[] = [
  {
    id: 1,
    name: 'Pumpkin Patch',
    story: 'The lights of Grimsby Hollow have gone out. Your lantern is all that is left. Start in the pumpkin patch.',
    rule: 'Even numbers',
    ruleWords: 'an even number',
    lesson: evenNumbers([1, 30], 'Stage 1: Pumpkin Patch'),
    count: 10,
    scenery: 'patch',
    track: TRACKS[0]!,
    song: SONGS[0]!,
    at: { x: 0.08, y: 0.72 },
    boss: {
      name: 'The Pumpkin King',
      look: 'pumpkin',
      projectile: { name: 'pumpkin-bomb', label: 'pumpkin bomb', colour: '#ff9a2e', shape: 'bomb' },
      pattern: PUMPKIN_PATTERN,
      taunt: 'The Pumpkin King rises from the vines. Big even numbers now!',
      lesson: evenNumbers([100, 400], 'Boss: The Pumpkin King'),
      count: 12,
      need: 0.7,
      item: item('pumpkin-lantern', 'Pumpkin Lantern', 'A glowing pumpkin for your lantern.'),
    },
  },
  {
    id: 2,
    name: 'Crypt Steps',
    story: 'Cold stone steps lead down to the old crypt. Something rattles below. New here: flip mode. When you hear the portal, a press flips you onto the ceiling, past the spike.',
    rule: 'Multiples of 5',
    ruleWords: 'a multiple of 5',
    lesson: multiplesOf([5], [1, 60], 'Stage 2: Crypt Steps'),
    count: 10,
    scenery: 'moon',
    track: TRACKS[1]!,
    song: SONGS[1]!,
    at: { x: 0.22, y: 0.4 },
    boss: {
      name: 'The Bone Warden',
      look: 'skeleton',
      projectile: { name: 'bone', label: 'bone', colour: '#efe8d8', shape: 'bone' },
      pattern: BONE_PATTERN,
      taunt: 'The Bone Warden clacks his teeth. Count in fives, up to five hundred!',
      lesson: multiplesOf([5], [100, 500], 'Boss: The Bone Warden'),
      count: 12,
      need: 0.7,
      item: item('bone-key', 'Bone Key', 'A key made of bone. It opens the old doors.'),
    },
  },
  {
    id: 3,
    name: 'Whispering Woods',
    story: 'The trees lean in and whisper numbers. Keep your lantern high. New here: number gates. Two paths, two numbers. Press to switch to the other path, or stay on yours.',
    rule: 'Multiples of 3',
    ruleWords: 'a multiple of 3',
    lesson: multiplesOf([3], [1, 36], 'Stage 3: Whispering Woods'),
    count: 12,
    scenery: 'woods',
    track: TRACKS[2]!,
    song: SONGS[2]!,
    at: { x: 0.38, y: 0.68 },
    boss: {
      name: 'The Moss Witch',
      look: 'witch',
      projectile: { name: 'hex', label: 'hex', colour: '#7ee081', shape: 'star' },
      pattern: MOSS_PATTERN,
      taunt: 'The Moss Witch cackles. Her threes go up to a hundred and fifty!',
      lesson: multiplesOf([3], [30, 150], 'Boss: The Moss Witch'),
      count: 14,
      need: 0.7,
      item: item('witch-broom', 'Witch\u2019s Broom', 'A little broom that sweeps the fog away.'),
    },
  },
  {
    id: 4,
    name: 'The Old Gate',
    story: 'A rusty gate blocks the road. It only opens for two tables at once. Jumps, flips and gates, all in one song.',
    rule: 'Multiples of 4 or 6',
    ruleWords: 'a multiple of 4 or 6',
    lesson: multiplesOf([4, 6], [1, 72], 'Stage 4: The Old Gate'),
    count: 12,
    scenery: 'gate',
    track: TRACKS[3]!,
    song: SONGS[3]!,
    at: { x: 0.54, y: 0.36 },
    boss: {
      name: 'The Gatekeeper',
      look: 'knight',
      projectile: { name: 'iron-ball', label: 'iron ball', colour: '#b9bfd0', shape: 'round' },
      pattern: GATEKEEPER_PATTERN,
      taunt: 'The Gatekeeper rattles his chains. Fours and sixes, bigger than ever!',
      lesson: multiplesOf([4, 6], [40, 168], 'Boss: The Gatekeeper'),
      count: 14,
      need: 0.7,
      item: item('silver-bell', 'Silver Bell', 'A bell whose ring warns of ghosts.'),
    },
  },
  {
    id: 5,
    name: 'Haunted Mill',
    story: 'The mill wheel turns by itself. Its stones are carved with squares.',
    rule: 'Square numbers',
    ruleWords: 'a square number',
    lesson: squareNumbers([1, 100], 'Stage 5: Haunted Mill'),
    count: 12,
    scenery: 'mill',
    track: TRACKS[4]!,
    song: SONGS[4]!,
    at: { x: 0.68, y: 0.7 },
    boss: {
      name: 'The Spider Miller',
      look: 'spider',
      projectile: { name: 'web-ball', label: 'web ball', colour: '#e9e2ff', shape: 'star' },
      pattern: SPIDER_PATTERN,
      taunt: 'The Spider Miller spins a web of numbers. Squares up to two hundred and twenty five!',
      lesson: squareNumbers([1, 225], 'Boss: The Spider Miller'),
      count: 14,
      need: 0.7,
      item: item('spider-cape', 'Spider Silk Cape', 'A cape that shimmers in the dark.'),
    },
  },
  {
    id: 6,
    name: 'The Hollow',
    story: 'Deep in the hollow tree, the sevens live. They are the tricky ones.',
    rule: 'Multiples of 7',
    ruleWords: 'a multiple of 7',
    lesson: multiplesOf([7], [1, 84], 'Stage 6: The Hollow'),
    count: 12,
    scenery: 'hollow',
    track: TRACKS[5]!,
    song: SONGS[5]!,
    at: { x: 0.82, y: 0.38 },
    boss: {
      name: 'The Hollow Wraith',
      look: 'wraith',
      projectile: { name: 'wisp', label: 'wisp', colour: '#9fd8ff', shape: 'round' },
      pattern: WRAITH_PATTERN,
      taunt: 'The Hollow Wraith drifts out of the tree. Sevens, all the way past a hundred!',
      lesson: multiplesOf([7], [50, 175], 'Boss: The Hollow Wraith'),
      count: 14,
      need: 0.7,
      item: item('moon-mirror', 'Moon Mirror', 'A mirror that shows what hides in the dark.'),
    },
  },
  {
    id: 7,
    name: 'Midnight Manor',
    story: 'At last, the manor on the hill. Only prime numbers can pass its doors.',
    rule: 'Prime numbers',
    ruleWords: 'a prime number',
    lesson: primeNumbers([2, 50], 'Stage 7: Midnight Manor'),
    count: 14,
    scenery: 'midnight',
    track: TRACKS[6]!,
    song: SONGS[6]!,
    at: { x: 0.93, y: 0.62 },
    boss: {
      name: 'Count Vexar',
      look: 'vampire',
      projectile: { name: 'bat', label: 'bat', colour: '#c0392b', shape: 'bat' },
      pattern: VEXAR_PATTERN,
      taunt: 'Count Vexar sweeps down the stairs. Primes up to a hundred. This is the last one!',
      lesson: primeNumbers([2, 100], 'Boss: Count Vexar'),
      count: 16,
      need: 0.7,
      item: item('midnight-crown', 'Crown of Midnight', 'The crown that brings the lights back to Grimsby Hollow.'),
    },
  },
];

export const stageById = (id: number): Stage | undefined => STAGES.find((s) => s.id === id);

/** How many stones must be right to beat a boss. */
export const needed = (boss: Boss, count: number = boss.count): number => Math.ceil(boss.need * count);

/** The track for a boss: the stage's tune, lower and heavier. */
export const bossTrackOf = (stage: Stage): TrackSpec => bossTrack(stage.track);

/** What the player is told at the start of a boss fight: what to jump, and what to let fly through. */
export function bossPrompt(stage: Stage): string {
  const p = stage.boss.projectile.label;
  if (stage.boss.pattern) {
    // A pattern boss: say how to read it by ear, then what to jump.
    const sounds = stage.boss.pattern.throws.map((t) => `${t.heard} means ${t.plural}`);
    return `Jump over every ${stage.boss.pattern.noun} with ${stage.ruleWords}. The others are duds: let them fly through you. Before each volley you hear what is coming. ${sounds.join('. ')}. Every right move hurts ${stage.boss.name}.`;
  }
  return `Jump over every ${p} with ${stage.ruleWords}. The others are duds: let them fly through you. Every right move hurts ${stage.boss.name}.`;
}

/** The boss's lesson: the same rule and harder numbers, told as a fight. */
export function bossLesson(stage: Stage): Lesson {
  return { ...stage.boss.lesson, prompt: bossPrompt(stage) };
}

/** Kept for free practice. */
export const lessonForStage = (stage: Stage): Lesson => stage.lesson;
