import { DEFAULT_TARGET_SHARE, lessonPools, type Lesson } from '../lesson';
import {
  mulberry32,
  resolveTiming,
  type Feel,
  type LevelSection,
  type Level,
  type Move,
  type Obstacle,
  type ObstacleKind,
  type Portal,
  type Timing,
} from '../level';

// A level built from a song. The song is a list of parts (an intro, a build, a drop, a breakdown...),
// each so many bars long. Busy parts put the obstacles close together, calm parts space them out, and
// a rest has none at all, so the player gets a breather where the music does. A part can change the
// move a press makes (jump, flip, switch lanes); the change is a portal, announced a whole bar before
// anything needs a press. Every press lands on the beat of the music.
//
// Nothing here changes how hard the timing is: every move uses the same take-off window as a jump, so
// proofs 1 to 6 hold as they are, and the song's own properties (15, 16 and 103) are checked on top.

export interface SongSection {
  /** "intro", "drop", "breakdown": said in reports and shown in tests. */
  name: string;
  /** Length in bars of four beats. */
  bars: number;
  feel: Feel;
  /** The move from here on. Default: the move of the part before (jump at the start). */
  move?: Move;
  /** How much of the band plays, 0 to 1. Default: rest 0.15, calm 0.5, busy 1. */
  energy?: number;
  /** Only these obstacle kinds appear here. Kinds named by any part are kept out of parts that name none. */
  kinds?: readonly string[];
}

export interface Song {
  name: string;
  sections: readonly SongSection[];
}

const BEATS_PER_BAR = 4;
const DEFAULT_ENERGY: Record<Feel, number> = { rest: 0.15, calm: 0.5, busy: 1 };

/** Running seconds in one bar of a song, at a timing. */
export const barSeconds = (timing: Pick<Timing, 'beat'>): number => BEATS_PER_BAR * timing.beat;

/** Refuse a song that cannot work, in plain words. */
export function validateSong(song: Song, kinds: readonly ObstacleKind[], lesson?: Lesson, options: { kindsLater?: boolean } = {}): void {
  if (song.sections.length === 0) throw new Error(`Song '${song.name}' needs at least one part.`);
  const names = new Set(kinds.map((k) => k.name));
  song.sections.forEach((s, i) => {
    const where = `Song '${song.name}', part ${i + 1} (${s.name})`;
    if (!Number.isInteger(s.bars) || s.bars < 1) throw new Error(`${where}: bars must be a whole number of at least 1.`);
    if (s.energy !== undefined && !(s.energy >= 0 && s.energy <= 1)) throw new Error(`${where}: energy must be from 0 to 1.`);
    for (const k of s.kinds ?? []) if (!options.kindsLater && !names.has(k)) throw new Error(`${where}: there is no obstacle called '${k}'.`);
    if (s.kinds && s.kinds.length === 0) throw new Error(`${where}: kinds is empty, so nothing could appear.`);
  });
  const usesGates = song.sections.some((s) => s.move === 'switch' && s.feel !== 'rest');
  if (usesGates && !lesson) throw new Error(`Song '${song.name}' has number gates, which need a lesson for their numbers.`);
  const claimed = new Set(song.sections.flatMap((s) => s.kinds ?? []));
  const free = kinds.filter((k) => !claimed.has(k.name));
  const needsFree = song.sections.some((s) => s.feel !== 'rest' && !s.kinds);
  if (!options.kindsLater && needsFree && free.length === 0) {
    throw new Error(`Song '${song.name}': every obstacle kind belongs to a part, so the other parts have nothing to use.`);
  }
}

export interface SongOptions {
  kinds: readonly ObstacleKind[];
  timing?: Partial<Timing>;
  lesson?: Lesson;
}

/** Same seed and song always give the same level. */
export function generateSong(seed: number, song: Song, options: SongOptions): Level {
  const timing = resolveTiming(options.timing);
  const { kinds, lesson } = options;
  validateSong(song, kinds, lesson);
  const rand = mulberry32(seed);
  const beat = timing.beat;
  const bar = barSeconds(timing);
  const claimed = new Set(song.sections.flatMap((s) => s.kinds ?? []));
  const free = kinds.filter((k) => !claimed.has(k.name));
  /** The press sits this far after an obstacle's start. */
  const half = (width: number): number => (width - timing.airtime) / 2;

  const sections: LevelSection[] = [];
  const portals: Portal[] = [];
  const placed: Omit<Obstacle, 'index'>[] = [];
  let move: Move = 'jump';
  let t = 0;
  let prevEnd: number | null = null;
  let prevPress: number | null = null;

  for (const part of song.sections) {
    const from = t;
    const to = t + part.bars * bar;
    t = to;
    const here: Move = part.move ?? move;
    sections.push({ name: part.name, from, to, feel: part.feel, energy: part.energy ?? DEFAULT_ENERGY[part.feel], move: here });
    // A new move is announced at the start of the part, and nothing counts down for two bars, so the
    // portal's words are finished before the first countdown in the new move (property 16 asks for one).
    let lead = 0;
    if (here !== move) {
      portals.push({ at: from, move: here });
      lead = 2 * bar;
      move = here;
    }
    if (part.feel === 'rest') continue;
    const pool = part.kinds ? kinds.filter((k) => part.kinds!.includes(k.name)) : free;

    for (;;) {
      const kind = pool[Math.min(pool.length - 1, Math.floor(rand() * pool.length))]!;
      const width = kind.width[0] + rand() * (kind.width[1] - kind.width[0]);
      // The earliest start: the countdown inside this part (after any portal), the gap kept, and the
      // countdown after the landing from an on-time jump over the one before.
      let lo = from + lead + 3 * beat - half(width);
      if (prevEnd !== null) lo = Math.max(lo, prevEnd + timing.gap[0]);
      if (prevPress !== null) lo = Math.max(lo, prevPress + timing.airtime + timing.landingMargin + 3 * beat - half(width));
      // Calm parts may breathe up to half a bar longer than the usual gap; busy parts keep to the gap.
      const slack = part.feel === 'calm' ? bar / 2 : 0;
      const fromPrev = prevEnd === null ? -Infinity : prevEnd + timing.gap[1] + slack;
      const hi = Math.max(lo, fromPrev >= lo ? fromPrev : lo + (timing.gap[1] - timing.gap[0]) + slack);
      const draw = rand();
      const lean = part.feel === 'busy' ? draw * 0.35 : 0.6 + draw * 0.4;
      // Every press on the beat of the music.
      const kMin = Math.ceil((lo + half(width)) / beat - 1e-9);
      const kMax = Math.floor((hi + half(width)) / beat + 1e-9);
      const start =
        kMax >= kMin ? (kMin + Math.min(kMax - kMin, Math.floor(lean * (kMax - kMin + 1)))) * beat - half(width) : lo + lean * (hi - lo);
      // It must be passed before the part ends, so a rest is really a rest.
      if (start + width + timing.halfWidth > to + 1e-9) break;
      placed.push({ kind: kind.name, start, width, move: here });
      prevEnd = start + width;
      prevPress = start + half(width);
    }
  }

  // Numbers last, so the shape of the song does not depend on the lesson. A fixed share of targets,
  // shuffled, so every level has real decisions in it.
  const obstacles: Obstacle[] = placed.map((o, index) => ({ ...o, index }));
  if (lesson) {
    const pools = lessonPools(lesson);
    const share = lesson.targetShare ?? DEFAULT_TARGET_SHARE;
    const count = obstacles.length;
    const targets = count >= 4 ? Math.min(count - 2, Math.max(2, Math.round(count * share))) : Math.round(count * share);
    const targetAt = obstacles.map((_, i) => i < targets);
    for (let i = count - 1; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1));
      [targetAt[i], targetAt[j]] = [targetAt[j]!, targetAt[i]!];
    }
    const from = (pool: number[]): number => pool[Math.min(pool.length - 1, Math.floor(rand() * pool.length))]!;
    obstacles.forEach((o, i) => {
      const target = targetAt[i]!;
      o.value = from(target ? pools.targets : pools.distractors);
      o.solid = target;
      // A gate: the right number is in the other lane (press to switch) or in yours (stay).
      if (o.move === 'switch') o.gate = { here: from(target ? pools.distractors : pools.targets) };
    });
  }
  return { seed, obstacles, sections, portals };
}

/** The part of the song playing at a level time, if the level has a song. */
export function sectionAt(level: Level, at: number): LevelSection | undefined {
  return level.sections?.find((s) => at >= s.from && at < s.to);
}

/** The move a press makes at a level time. */
export function moveAt(level: Level, at: number): Move {
  let move: Move = 'jump';
  for (const p of level.portals ?? []) if (p.at <= at + 1e-9) move = p.move;
  return move;
}

/**
 * Which side or lane the player is on just before obstacle `index`, if every move so far was right:
 * 'up' or 'down'. It starts down, and each right flip or switch changes it. A portal puts you back
 * down, on the ground. Useful for drawing; the rules never depend on it.
 */
export function sideBefore(level: Level, index: number): 'up' | 'down' {
  let up = false;
  let move: Move = 'jump';
  const portals = level.portals ?? [];
  for (let i = 0; i < Math.min(index, level.obstacles.length); i++) {
    const o = level.obstacles[i]!;
    const m = o.move ?? 'jump';
    if (m !== move) {
      move = m;
      up = false;
    }
    if (m !== 'jump' && o.solid !== false) up = !up;
  }
  const next = level.obstacles[index];
  if (next && (next.move ?? 'jump') !== move) up = false;
  // A portal with no obstacles after it still puts you on the ground.
  if (!next && portals.length > 0 && (portals.at(-1)!.move !== move)) up = false;
  return up ? 'up' : 'down';
}
