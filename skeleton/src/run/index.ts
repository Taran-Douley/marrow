import { EVENT_TYPES } from '../channels/events';
import {
  cueTimes,
  idealPress,
  isSolid,
  takeoffWindow,
  toRealSeconds,
  type Level,
  type Timing,
} from '../level';
import type { Attempt } from '../log';
import type { SemanticEvent, Speed } from '../types';

// The timed-press pattern as a pure state machine: the level plays, one press
// jumps, a miss is explained in plain words, and play restarts just before the
// obstacle. No lives, no game over (Requirement 12). The adapter drives it with
// real clock time and performs what it emits.
//
// A level may also carry a lesson: each obstacle has a number, and some are
// targets to jump on the beat while the rest are to be let pass. Pressing on a
// distractor is the mistake, and the game says why.

export interface Scoring {
  /** A press within this share of the half-window of the beat is Perfect. */
  perfectAt: number;
  /** ...within this share is Good. Anything else inside the window is Ok. */
  goodAt: number;
  points: { perfect: number; good: number; ok: number; passed: number };
  /** Each step of the streak adds this share to the points. */
  streakBonus: number;
  /** The streak stops adding after this many. */
  streakCap: number;
  /** Rank cut-offs as a share of the best possible score: S, A, B. Below B is C. */
  ranks: readonly [number, number, number];
}

/** Gentle-failure and scoring settings. A game can change any of them. */
export interface RunSettings {
  /** After a fall, restart this many running seconds before the countdown. */
  restartLead: number;
  /** Real seconds to rest after a fall, so the reason can be heard and read. */
  fallPause: number;
  /** Running seconds after the take-off window closes in which a press still counts as "late". */
  lateGrace: number;
  /** Emit events this many running seconds early, so audio can be scheduled exactly. */
  lookahead: number;
  /**
   * Timing help, for players who cannot press at an exact moment: a press any time from the first beep
   * to the end of the take-off window counts, and the move is made on the fourth beat. The choice is
   * still the player's: a press on something to let pass is still a mistake. Graded Good, never Perfect.
   */
  assist: boolean;
  scoring: Scoring;
}

export type RunSettingsInput = Partial<Omit<RunSettings, 'scoring'>> & {
  scoring?: Partial<Omit<Scoring, 'points'>> & { points?: Partial<Scoring['points']> };
};

export const DEFAULT_RUN_SETTINGS: RunSettings = {
  restartLead: 1.0,
  fallPause: 2.0,
  lateGrace: 0.6,
  lookahead: 0.25,
  assist: false,
  scoring: {
    perfectAt: 0.2,
    goodAt: 0.6,
    points: { perfect: 100, good: 60, ok: 30, passed: 50 },
    streakBonus: 0.1,
    streakCap: 10,
    ranks: [0.9, 0.75, 0.55],
  },
};

export function resolveRunSettings(input: RunSettingsInput = {}): RunSettings {
  const { scoring, ...rest } = input;
  const base = DEFAULT_RUN_SETTINGS;
  return {
    ...base,
    ...stripUndefined(rest),
    scoring: {
      ...base.scoring,
      ...stripUndefined(scoring ?? {}),
      points: { ...base.scoring.points, ...stripUndefined(scoring?.points ?? {}) },
    },
  };
}

export type Grade = 'perfect' | 'good' | 'ok';
export type FallKind = 'early' | 'late' | 'none' | 'wrong';

/** The multiplier a streak earns: 1 at no streak, rising by `streakBonus` a step up to the cap. */
const multiplier = (streak: number, s: Scoring): number => 1 + Math.min(streak, s.streakCap) * s.streakBonus;

/** The best possible score for a level: every jump Perfect, every pass right, no fall. */
export function maxScore(level: Level, settings: RunSettings = DEFAULT_RUN_SETTINGS): number {
  const s = settings.scoring;
  return level.obstacles.reduce((sum, o, i) => {
    const base = isSolid(o) ? s.points.perfect : s.points.passed;
    return sum + Math.round(base * multiplier(i + 1, s));
  }, 0);
}

/** S, A, B or C, by the share of the best possible score. */
export function rankOf(fraction: number, settings: RunSettings = DEFAULT_RUN_SETTINGS): 'S' | 'A' | 'B' | 'C' {
  const [s, a, b] = settings.scoring.ranks;
  return fraction >= s ? 'S' : fraction >= a ? 'A' : fraction >= b ? 'B' : 'C';
}

export interface RunOptions {
  level: Level;
  timing: Timing;
  speed: Speed;
  /** Whether the picture is on; recorded in the log. */
  picture?: boolean;
  /** The countdown events for this level (from `kit.levelEvents`). */
  events: readonly SemanticEvent[];
  settings?: RunSettingsInput;
  /** Real clock time, in ms, when the level starts. */
  startReal: number;
  /** Called for each event, with the current level time in running seconds. */
  emit(event: SemanticEvent, now: number): void;
  onAttempt?(attempt: Attempt): void;
  /** Called after a fall, when play restarts at this level time. Cancel scheduled sound here. */
  onRestart?(levelTime: number): void;
  /**
   * Teach from a mistake: return a short plain sentence for a wrong press or a
   * missed target, or nothing. It is spoken and shown after the reason.
   */
  explain?(info: { value: number; solid: boolean }, reason: FallKind): string | undefined;
}

export interface RunSnapshot {
  phase: 'play' | 'recover' | 'done';
  /** Level time, in running seconds. */
  t: number;
  /** Index of the obstacle being played (0-based). Equals the obstacle count when done. */
  obstacle: number;
  /** Level time when the current jump began, or null when on the ground. */
  jumpedAt: number | null;
  /** Level time of the most recent jump, even after the obstacle is passed. For drawing the arc. */
  lastJumpAt: number | null;
  score: number;
  /** Right decisions in a row. */
  streak: number;
  bestStreak: number;
  /**
   * Level time is standing still: resting after a fall, or held for words. Its music stops with it, so
   * a game can play something on real time meanwhile.
   */
  held: boolean;
}

export interface Run {
  /** Move the clock to this real time (ms). Call every frame. */
  advance(nowReal: number): void;
  /** A press at this real time (ms). */
  press(nowReal: number): void;
  /**
   * Keep level time still until this real time (ms), so words can finish before the next countdown:
   * a long introduction, or the reason for a fall. A restart after a fall waits for it too. A later
   * call can only make the hold longer.
   */
  holdUntil(nowReal: number): void;
  /**
   * Make sure the next countdown starts no sooner than ms real milliseconds from 
owReal, so a line
   * being spoken now (an introduction, a fall's reason and lesson) is heard in full first. It only ever
   * waits; it never brings a countdown sooner.
   */
  holdForWords(nowReal: number, ms: number): void;
  snapshot(): RunSnapshot;
}

interface Plan {
  kind: string;
  move: string;
  solid: boolean;
  value: number | undefined;
  a: number;
  b: number;
  j: number;
  cue1: number;
  /** When the ghost has passed the obstacle. */
  clearAt: number;
}

export function createRun(options: RunOptions): Run {
  const { level, timing, speed, events } = options;
  const settings = resolveRunSettings(options.settings);
  const scoring = settings.scoring;
  const rate = timing.rates[speed];
  const picture = options.picture ?? true;

  const plans: Plan[] = level.obstacles.map((o) => {
    const { a, b } = takeoffWindow(o, timing);
    return {
      kind: o.kind,
      move: o.move ?? 'jump',
      solid: isSolid(o),
      value: o.value,
      a,
      b,
      j: idealPress(o, timing),
      cue1: cueTimes(o, timing)[0],
      clearAt: o.start + o.width + timing.halfWidth,
    };
  });

  /**
   * Index of the first event at or after a level time. Everything before a
   * restart is already behind the player, so nothing earlier is replayed.
   */
  const firstEventFrom = (time: number): number => {
    const at = events.findIndex((e) => e.at >= time - 1e-9);
    return at < 0 ? events.length : at;
  };

  let phase: RunSnapshot['phase'] = 'play';
  let t = 0;
  let lastReal = options.startReal;
  let i = 0;
  let jumpedAt: number | null = null;
  let airborneUntil = Number.NEGATIVE_INFINITY;
  let lastJumpAt: number | null = null;
  let landedSent = true;
  let recoverAt = 0;
  let cursor = 0;
  let score = 0;
  let streak = 0;
  let bestStreak = 0;
  /** With timing help: the obstacle whose move waits for its fourth beat. */
  let heldFor = -1;
  /** Real ms before which level time stands still (see `holdUntil`). */
  let heldUntil = Number.NEGATIVE_INFINITY;

  const attempt = (result: Attempt['result'], pressedAt: number | null): void => {
    const plan = plans[i]!;
    options.onAttempt?.({
      level: level.seed,
      obstacle: i + 1,
      kind: plan.kind,
      result,
      offsetMs: pressedAt === null ? null : toRealSeconds(pressedAt - plan.j, speed, timing) * 1000,
      windowMs: toRealSeconds(plan.b - plan.a, speed, timing) * 1000,
      speed,
      picture,
    });
  };

  /** Add points for a right decision, extend the streak, and say what was earned. */
  const earn = (base: number): { points: number } => {
    streak += 1;
    bestStreak = Math.max(bestStreak, streak);
    const points = Math.round(base * multiplier(streak, scoring));
    score += points;
    return { points };
  };

  const grade = (pressedAt: number, plan: Plan): Grade => {
    const half = (plan.b - plan.a) / 2;
    const off = half <= 0 ? 0 : Math.abs(pressedAt - plan.j) / half;
    return off <= scoring.perfectAt ? 'perfect' : off <= scoring.goodAt ? 'good' : 'ok';
  };

  const fall = (reason: FallKind, pressedAt: number | null): void => {
    const plan = plans[i]!;
    attempt(reason, pressedAt);
    streak = 0;
    const explain = plan.value === undefined ? undefined : options.explain?.({ value: plan.value, solid: plan.solid }, reason);
    options.emit(
      {
        type: EVENT_TYPES.fallReason,
        at: t,
        data: {
          reason,
          index: i,
          ...(plan.value !== undefined ? { value: plan.value } : {}),
          ...(explain ? { explain } : {}),
        },
      },
      t,
    );
    phase = 'recover';
    recoverAt = lastReal + settings.fallPause * 1000;
  };

  const restart = (): void => {
    const plan = plans[i]!;
    const previousClear = i > 0 ? plans[i - 1]!.clearAt + 0.05 : 0;
    t = Math.max(0, previousClear, plan.cue1 - settings.restartLead);
    jumpedAt = null;
    lastJumpAt = null;
    airborneUntil = Number.NEGATIVE_INFINITY;
    landedSent = true; // nothing is in the air after a restart
    cursor = firstEventFrom(t);
    heldFor = -1;
    phase = 'play';
    options.onRestart?.(t);
  };

  const step = (): void => {
    while (cursor < events.length && events[cursor]!.at <= t + settings.lookahead) {
      options.emit(events[cursor]!, t);
      cursor++;
    }
    if (phase === 'play' && !landedSent && lastJumpAt !== null && t >= lastJumpAt + timing.airtime) {
      landedSent = true;
      options.emit({ type: EVENT_TYPES.landed, at: lastJumpAt + timing.airtime }, t);
    }
    // Timing help: a press held from earlier in the countdown is made now, on the fourth beat.
    if (phase === 'play' && heldFor === i && i < plans.length && jumpedAt === null && t >= plans[i]!.j) {
      heldFor = -1;
      takeOff(plans[i]!.j, 'good');
    }
    while (phase === 'play' && i < plans.length) {
      const plan = plans[i]!;

      if (!plan.solid) {
        // A distractor: the right move is to do nothing and let it go by.
        if (t < plan.clearAt) break;
        const { points } = earn(scoring.points.passed);
        attempt('passed', null);
        options.emit(
          {
            type: EVENT_TYPES.passed,
            at: plan.clearAt,
            data: { object: plan.kind, index: i, value: plan.value, streak, score, points },
          },
          t,
        );
        i++;
        continue;
      }

      if (jumpedAt !== null) {
        if (t < plan.clearAt) break;
        options.emit({ type: EVENT_TYPES.cleared, at: plan.clearAt, data: { object: plan.kind, index: i } }, t);
        i++;
        jumpedAt = null;
        continue;
      }
      if (t >= plan.b + settings.lateGrace) fall('none', null);
      break;
    }
    if (phase === 'play' && i >= plans.length) {
      options.emit({ type: EVENT_TYPES.levelComplete, at: t, data: { score, bestStreak } }, t);
      phase = 'done';
    }
  };

  const advance = (nowReal: number): void => {
    const dtReal = Math.max(0, (nowReal - lastReal) / 1000);
    lastReal = Math.max(lastReal, nowReal);
    if (phase === 'done') return;
    if (phase === 'recover') {
      if (nowReal >= recoverAt && nowReal >= heldUntil) {
        restart();
        step();
      }
      return;
    }
    if (nowReal < heldUntil) return; // held: the level waits for words to finish
    t += dtReal * rate;
    step();
  };

  /** Leave the ground (or flip, or switch lane) at level time t, graded how. */
  function takeOff(at: number, how: Grade): void {
    const plan = plans[i]!;
    attempt('cleared', at);
    jumpedAt = at;
    lastJumpAt = at;
    landedSent = false;
    airborneUntil = at + timing.airtime;
    // The player must hear and feel that the press worked, at once.
    options.emit({ type: EVENT_TYPES.jumped, at, data: { index: i, ...(plan.move !== 'jump' ? { move: plan.move } : {}) } }, t);
    const { points } = earn(scoring.points[how]);
    options.emit({ type: EVENT_TYPES.judged, at, data: { grade: how, index: i, streak, score, points } }, t);
  }

  // A level with nothing to jump is complete at once.
  step();

  return {
    advance,
    press(nowReal) {
      advance(nowReal);
      if (phase !== 'play' || i >= plans.length) return;
      if (jumpedAt !== null || t < airborneUntil) return; // already in the air: one press, one jump
      const plan = plans[i]!;
      if (t < plan.cue1) return; // before the countdown: a harmless hop, never a fall
      if (!plan.solid) return fall('wrong', t); // pressing on a distractor is the mistake
      if (settings.assist) {
        if (heldFor === i) return; // already held: one press is enough
        if (t < plan.j) {
          heldFor = i; // made on the fourth beat
          return;
        }
        if (t <= plan.b) return takeOff(t, 'good');
        return fall('late', t);
      }
      if (t < plan.a) return fall('early', t);
      if (t > plan.b) return fall('late', t);
      takeOff(t, grade(t, plan));
    },
    holdUntil(real) {
      heldUntil = Math.max(heldUntil, real);
    },
    holdForWords(nowReal, ms) {
      if (phase === 'done' || i >= plans.length) return;
      const plan = plans[i]!;
      if (phase === 'recover') {
        // After the restart, the countdown comes this soon: hold the restart so the words finish first.
        const previousClear = i > 0 ? plans[i - 1]!.clearAt + 0.05 : 0;
        const from = Math.max(0, previousClear, plan.cue1 - settings.restartLead);
        const soon = ((plan.cue1 - from) / rate) * 1000;
        heldUntil = Math.max(heldUntil, nowReal + ms - soon);
        return;
      }
      if (t >= plan.cue1) return; // the countdown has begun: it cannot be held
      const soon = ((plan.cue1 - t) / rate) * 1000;
      heldUntil = Math.max(heldUntil, nowReal + ms - soon);
    },
    snapshot: () => ({
      phase,
      t,
      obstacle: i,
      jumpedAt,
      lastJumpAt,
      score,
      streak,
      bestStreak,
      held: phase === 'recover' || (phase === 'play' && lastReal < heldUntil),
    }),
  };
}

function stripUndefined<V extends object>(obj: V): Partial<V> {
  return Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined)) as Partial<V>;
}
