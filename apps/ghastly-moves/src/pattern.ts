import {
  barSeconds,
  cueTimes,
  proofResult,
  resolveTiming,
  speechMs,
  type EventPresentation,
  type Level,
  type ProofProperty,
  type SoundShape,
  type Wave,
} from '@marrow/skeleton';
import type { StageSong } from './songs';

// A boss that attacks in a pattern you can read by sound alone. The fight is a song: after the intro
// it plays the same volleys in the same order, over and over. Before each volley comes one bar of rest
// with a tell: a sound, a caption and two words that say what is coming. Then the volley: every throw
// in it is the same kind, and each kind has its own sound, different in pitch and in timbre.
//
// The tell sits in the rest, so it can never overlap a countdown (property 15 keeps rests free of
// cues), and it starts a whole bar before the first throw it announces (property 23). Presses stay
// on the beat like everywhere else (property 19).

/** The drawn shapes a throw can have (see objects/projectile.ts). */
export type ThrowShape = 'bomb' | 'bone' | 'skull' | 'star' | 'ball' | 'bolt' | 'web' | 'wheel' | 'spider' | 'wisp' | 'bat' | 'coffin';

/** One kind of throw. */
export interface ThrowKind {
  /** Short id used in the song's part names: 'lob' or 'roll'. */
  id: string;
  /** The obstacle's name in the kit. */
  name: string;
  /** What the player hears and reads: 'lobbed bomb'. */
  label: string;
  colour: string;
  /** How it comes: lobbed (arcs in from above), rolled (along the ground) or swooped (flies in on a slant). */
  motion: 'lobbed' | 'rolled' | 'swooped';
  /** What it looks like. Kinds in one fight differ in shape as well as colour. */
  shape: ThrowShape;
  /** Said in the introduction: what the tell sounds like, 'A rising sound'. Followed by 'means' and `plural`. */
  heard: string;
  /** The kind in the plural, for the introduction: 'lobbed bombs'. */
  plural: string;
  /** The beep voice of this kind of throw: the countdown beeps and approach tone use it. */
  beep: { hz: number; wave: Wave };
  /** The boss's throw: a short sound just before the countdown. */
  whoosh: { hz: number; wave: Wave; gain: number; shape: SoundShape };
  /** The tell, one bar before the volley. */
  tell: { say: string; caption: string; hz: number; wave: Wave; gain: number; shape: SoundShape; haptic: number[] };
}

export interface BossPattern {
  throws: readonly ThrowKind[];
  /** The fixed order of volleys, as ids of throws. The fight plays them in this order. */
  volleys: readonly string[];
  /** How long each volley is, in bars of four beats, unless `volleyBars` says otherwise. */
  bars: number;
  /** A length for each volley, in order, to make some volleys longer than others. */
  volleyBars?: readonly number[];
  /** What one throw is called in the introduction: 'bomb'. */
  noun: string;
}

/** How long before the first beep the boss throws, in running seconds, so the whoosh never sits on a beep. */
export const THROW_LEAD = 0.3;

/**
 * The Pumpkin King throws pumpkin bombs in two ways. A lobbed bomb arcs in from above: its sound is high
 * and clear (a sine), and its tell rises. A rolled bomb comes along the ground: its sound is low and
 * buzzy (a square wave), and its tell rumbles downward. Each pair differs in pitch and in timbre.
 */
export const PUMPKIN_PATTERN: BossPattern = {
  throws: [
    {
      id: 'lob',
      name: 'lobbed-bomb',
      label: 'lobbed bomb',
      colour: '#ff9a2e',
      motion: 'lobbed',
      shape: 'bomb',
      heard: 'A rising sound',
      plural: 'lobbed bombs',
      beep: { hz: 659, wave: 'sine' },
      whoosh: { hz: 0, wave: 'sine', gain: 0.45, shape: { noise: true, filterHz: 400, filterTo: 2600, seconds: 0.26 } },
      tell: {
        say: 'Lobbed.',
        caption: 'Lobbed bombs next',
        hz: 440,
        wave: 'sine',
        gain: 0.7,
        shape: { hzTo: 880, seconds: 0.7 },
        haptic: [40, 60, 40, 60, 40],
      },
    },
    {
      id: 'roll',
      name: 'rolled-bomb',
      label: 'rolled bomb',
      colour: '#c4601a',
      motion: 'rolled',
      shape: 'bomb',
      heard: 'A low rumble',
      plural: 'rolled bombs',
      beep: { hz: 392, wave: 'square' },
      whoosh: { hz: 90, wave: 'square', gain: 0.5, shape: { filterHz: 320, filterTo: 160, hzTo: 60, seconds: 0.45 } },
      tell: {
        say: 'Rolled.',
        caption: 'Rolled bombs next',
        hz: 147,
        wave: 'square',
        gain: 0.7,
        shape: { hzTo: 98, filterHz: 500, filterTo: 250, seconds: 0.7 },
        haptic: [240, 80, 240],
      },
    },
  ],
  volleys: ['lob', 'roll', 'lob', 'roll', 'lob', 'roll'],
  bars: 4,
  noun: 'bomb',
};

export const throwByName = (pattern: BossPattern, name: string): ThrowKind | undefined => pattern.throws.find((t) => t.name === name);

const intro = { name: 'Intro', bars: 2, feel: 'rest' } as const;

/** The boss fight as a song: an intro, then for each volley a bar of rest (the tell) and the volley. */
export function patternSong(pattern: BossPattern, beat: number, name = 'Boss pattern'): StageSong {
  const sections = [
    intro,
    ...pattern.volleys.flatMap((id, i) => {
      const kind = pattern.throws.find((t) => t.id === id);
      if (!kind) throw new Error(`The pattern names a volley '${id}', but there is no throw with that id.`);
      return [
        { name: `Tell ${id}`, bars: 1, feel: 'rest' },
        { name: `Volley ${id}`, bars: pattern.volleyBars?.[i] ?? pattern.bars, feel: 'busy', move: 'jump', kinds: [kind.name] },
      ] as const;
    }),
  ];
  return { beat, song: { name, sections } };
}

/** The events that carry the pattern's sounds, for the kit: a tell and a throw for each kind. */
export function patternEvents(pattern: BossPattern): Record<string, EventPresentation> {
  const events: Record<string, EventPresentation> = {};
  for (const t of pattern.throws) {
    events[`boss-tell-${t.id}`] = {
      say: t.tell.say,
      caption: t.tell.caption,
      sound: { hz: t.tell.hz, wave: t.tell.wave, gain: t.tell.gain, role: 'effect', shape: t.tell.shape },
      haptic: t.tell.haptic,
    };
    events[`boss-throw-${t.id}`] = {
      sound: { hz: t.whoosh.hz, wave: t.whoosh.wave, gain: t.whoosh.gain, role: 'effect', shape: t.whoosh.shape },
      haptic: t.motion === 'rolled' ? [90, 40, 90] : t.motion === 'swooped' ? [15, 20, 15] : [25],
    };
  }
  return events;
}

/** A tell: when it starts in level time, which volley it announces, and the part of the song it sits in. */
export interface Tell {
  at: number;
  /** When the rest it sits in ends, and the volley begins. */
  until: number;
  id: string;
}

/** The tells of a level, in order, read from its song. */
export function bossTells(level: Level): Tell[] {
  return (level.sections ?? []).flatMap((s) => (s.name.startsWith('Tell ') ? [{ at: s.from, until: s.to, id: s.name.slice(5) }] : []));
}

/** The volleys of a level: each with its throw id, when it runs and the obstacles in it. */
export function volleysOf(level: Level): { id: string; from: number; to: number; obstacles: Level['obstacles'] }[] {
  return (level.sections ?? [])
    .filter((s) => s.name.startsWith('Volley '))
    .map((s) => ({
      id: s.name.slice(7),
      from: s.from,
      to: s.to,
      obstacles: level.obstacles.filter((o) => o.start + o.width / 2 >= s.from && o.start + o.width / 2 < s.to),
    }));
}

const EPS = 1e-6;

/** Pitch of a sound for comparing: its tone, or the middle of its filter for noise. */
const pitchOf = (s: { hz: number; shape?: SoundShape }): number =>
  s.shape?.noise ? ((s.shape.filterHz ?? 1000) + (s.shape.filterTo ?? s.shape.filterHz ?? 1000)) / 2 : s.hz;
const timbreOf = (s: { wave: Wave; shape?: SoundShape }): string => (s.shape?.noise ? 'noise' : s.wave);
/** Two sounds are told apart when they are at least a major third apart in pitch and differ in timbre. */
export const MIN_PITCH_RATIO = 1.25;

function apart(a: { hz: number; wave: Wave; shape?: SoundShape }, b: { hz: number; wave: Wave; shape?: SoundShape }): string | undefined {
  const pa = pitchOf(a);
  const pb = pitchOf(b);
  const ratio = Math.max(pa, pb) / Math.max(1, Math.min(pa, pb));
  if (timbreOf(a) === timbreOf(b)) return `both sound like ${timbreOf(a)}`;
  if (ratio < MIN_PITCH_RATIO) return `their pitch is only ${ratio.toFixed(2)} times apart (it needs ${MIN_PITCH_RATIO})`;
  return undefined;
}

/**
 * Property 22, the pattern can be heard: each kind of throw has a beep, a throw sound and a tell that
 * differ from every other kind in pitch and in timbre; every tell is a sound, a caption and words;
 * and the level really follows the pattern: a tell before each volley, in the pattern's order, and
 * every throw in a volley is the kind its tell announced.
 */
export function patternByEar(pattern: BossPattern): ProofProperty {
  return (level, input) => {
    const label = input.label ?? `Level ${level.seed}`;
    const problems: string[] = [];
    const pairs: [string, (t: ThrowKind) => { hz: number; wave: Wave; shape?: SoundShape }][] = [
      ['beeps', (t) => t.beep],
      ['throw sounds', (t) => t.whoosh],
      ['tells', (t) => t.tell],
    ];
    for (const [what, pick] of pairs) {
      for (let i = 0; i < pattern.throws.length; i++) {
        for (let j = i + 1; j < pattern.throws.length; j++) {
          const reason = apart(pick(pattern.throws[i]!), pick(pattern.throws[j]!));
          if (reason) problems.push(`The ${what} of the ${pattern.throws[i]!.label} and the ${pattern.throws[j]!.label} cannot be told apart: ${reason}.`);
        }
      }
    }
    for (const t of pattern.throws) {
      if (t.tell.say.trim() === '' || t.tell.caption.trim() === '') problems.push(`The tell for ${t.label} needs words and a caption as well as a sound.`);
    }
    const tells = bossTells(level);
    const volleys = volleysOf(level);
    if (tells.length !== pattern.volleys.length || volleys.length !== pattern.volleys.length) {
      problems.push(`${label}: the pattern has ${pattern.volleys.length} volleys, but the level has ${volleys.length} volleys and ${tells.length} tells.`);
    }
    volleys.forEach((v, i) => {
      const where = `${label}, volley ${i + 1} (${v.id})`;
      if (v.id !== pattern.volleys[i]) problems.push(`${where}: the pattern says '${pattern.volleys[i]}' here.`);
      if (tells[i]?.id !== v.id) problems.push(`${where}: its tell says '${tells[i]?.id ?? 'nothing'}'.`);
      if (v.obstacles.length === 0) problems.push(`${where}: it has nothing to throw, so its tell would announce nothing.`);
      const kind = pattern.throws.find((t) => t.id === v.id);
      for (const o of v.obstacles) if (o.kind !== kind?.name) problems.push(`${where}: a ${o.kind} turns up in a volley of ${kind?.name}.`);
    });
    return proofResult(22, 'Boss pattern can be heard', problems);
  };
}

/**
 * Property 23, the tell never overlaps a countdown: from the start of each tell until its sound and
 * words are done (at the fastest speed, where a second of words covers the most level time), there is
 * no countdown and no throw sound, and the first countdown it announces is a whole bar or more away.
 */
export function tellsClearOfCountdowns(pattern: BossPattern): ProofProperty {
  return (level, input) => {
    const tm = resolveTiming(input.timing);
    const label = input.label ?? `Level ${level.seed}`;
    const bar = barSeconds(tm);
    const fastest = Math.max(...Object.values(tm.rates));
    const problems: string[] = [];
    for (const tell of bossTells(level)) {
      const kind = pattern.throws.find((t) => t.id === tell.id);
      if (!kind) continue;
      const speechSeconds = (speechMs(kind.tell.say) * 1.2) / 1000;
      const seconds = Math.max(kind.tell.shape.seconds ?? 0, speechSeconds);
      const end = tell.at + seconds * fastest;
      const where = `${label}, the tell for ${kind.label} at ${tell.at.toFixed(2)} s`;
      for (const o of level.obstacles) {
        const first = cueTimes(o, tm)[0] - THROW_LEAD;
        const passed = o.start + o.width + tm.halfWidth;
        if (first < end - EPS && passed > tell.at + EPS) {
          problems.push(`${where}: it lasts until ${end.toFixed(2)} s at the fastest speed, but obstacle ${o.index + 1} starts its throw and countdown at ${first.toFixed(2)} s.`);
        }
      }
      const firstThrow = level.obstacles.find((o) => cueTimes(o, tm)[0] >= tell.at);
      if (firstThrow && cueTimes(firstThrow, tm)[0] < tell.at + bar - EPS) {
        problems.push(`${where}: the first throw it announces counts down at ${cueTimes(firstThrow, tm)[0].toFixed(2)} s, less than one bar (${bar.toFixed(2)} s) after the tell.`);
      }
    }
    return proofResult(23, 'Tell clear of the countdowns', problems);
  };
}
