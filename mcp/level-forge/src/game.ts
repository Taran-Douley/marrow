import { createKit, type ChannelId, type Kit, type Lesson, type Timing } from '@marrow/skeleton';

// A "game" in Level Forge is plain data: which obstacles it has, how wide each can be, optionally a
// lesson rule, and any timing it changes. Everything else is the kit's default. This is enough to
// build the same kit a real game would, and to prove its levels.

export interface GameConfig {
  obstacles?: { name: string; width: [number, number] }[];
  lesson?: { rule: 'multiples' | 'even' | 'odd' | 'square' | 'prime'; tables?: number[]; values: [number, number] };
  timing?: Partial<Pick<Timing, 'airtime' | 'beat' | 'halfWidth' | 'firstStart' | 'obstaclesPerLevel' | 'landingMargin'>> & {
    gap?: [number, number];
  };
  floorsMs?: Partial<Record<'slow' | 'medium' | 'fast', number>>;
  /** Leave channels out, to see what the reviewer and the report say about a game that does. */
  omitChannels?: ChannelId[];
}

/** A bad argument, in words a person can fix. */
export class ArgumentError extends Error {}

export function numberArg(value: unknown, name: string, opts: { min?: number; max?: number; integer?: boolean } = {}): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) throw new ArgumentError(`'${name}' must be a number.`);
  if (opts.integer && !Number.isInteger(value)) throw new ArgumentError(`'${name}' must be a whole number.`);
  if (opts.min !== undefined && value < opts.min) throw new ArgumentError(`'${name}' must be at least ${opts.min}.`);
  if (opts.max !== undefined && value > opts.max) throw new ArgumentError(`'${name}' must be at most ${opts.max}.`);
  return value;
}

const isSquare = (v: number): boolean => v >= 1 && Number.isInteger(Math.sqrt(v));
const smallest = (v: number): number => {
  for (let f = 2; f * f <= v; f++) if (v % f === 0) return f;
  return v;
};
const isPrime = (v: number): boolean => v >= 2 && smallest(v) === v;

function lessonFrom(config: NonNullable<GameConfig['lesson']>): Lesson {
  const [lo, hi] = config.values;
  const values: [number, number] = [numberArg(lo, 'lesson.values[0]', { integer: true }), numberArg(hi, 'lesson.values[1]', { integer: true })];
  const words = (config.tables ?? []).join(' or ');
  switch (config.rule) {
    case 'multiples': {
      const tables = config.tables ?? [];
      if (tables.length === 0 || tables.some((n) => !Number.isInteger(n) || n < 2)) {
        throw new ArgumentError("A 'multiples' lesson needs 'tables', whole numbers from 2 up.");
      }
      return {
        title: `Multiples of ${words}`,
        prompt: `Jump on every multiple of ${words}.`,
        values,
        isTarget: (v) => tables.some((n) => v % n === 0),
      };
    }
    case 'even':
      return { title: 'Even numbers', prompt: 'Jump on every even number.', values, isTarget: (v) => v % 2 === 0 };
    case 'odd':
      return { title: 'Odd numbers', prompt: 'Jump on every odd number.', values, isTarget: (v) => v % 2 !== 0 };
    case 'square':
      return { title: 'Square numbers', prompt: 'Jump on every square number.', values, isTarget: isSquare };
    case 'prime':
      return { title: 'Prime numbers', prompt: 'Jump on every prime number.', values, isTarget: isPrime };
    default:
      throw new ArgumentError("lesson.rule must be one of 'multiples', 'even', 'odd', 'square' or 'prime'.");
  }
}

/** Build the kit for a game, refusing anything that cannot work in plain words. */
export function buildKit(game: GameConfig = {}): Kit {
  const obstacles = game.obstacles ?? [
    { name: 'grave', width: [0.16, 0.3] as [number, number] },
    { name: 'fence', width: [0.12, 0.24] as [number, number] },
  ];
  if (!Array.isArray(obstacles) || obstacles.length === 0) throw new ArgumentError("'obstacles' needs at least one obstacle.");
  if (obstacles.length > 20) throw new ArgumentError("'obstacles' can have at most 20 kinds.");
  const timing = game.timing
    ? {
        ...game.timing,
        ...(game.timing.gap ? { gap: [game.timing.gap[0], game.timing.gap[1]] as const } : {}),
      }
    : undefined;
  let kit: Kit;
  try {
    kit = createKit({
      ...(timing ? { timing } : {}),
      ...(game.floorsMs ? { floorsMs: game.floorsMs } : {}),
      ...(game.omitChannels ? { channels: { omit: game.omitChannels } } : {}),
      ...(game.lesson ? { lesson: lessonFrom(game.lesson) } : {}),
    });
    for (const o of obstacles) {
      if (typeof o.name !== 'string' || o.name.trim() === '') throw new ArgumentError('Every obstacle needs a name.');
      if (!Array.isArray(o.width) || o.width.length !== 2) throw new ArgumentError(`Obstacle '${o.name}' needs width as [min, max] in running seconds.`);
      kit.defineObstacle(o.name, { width: [numberArg(o.width[0], `${o.name}.width[0]`, { min: 0.01 }), numberArg(o.width[1], `${o.name}.width[1]`, { min: 0.01 })] });
    }
  } catch (error) {
    if (error instanceof ArgumentError) throw error;
    throw new ArgumentError(error instanceof Error ? error.message : String(error));
  }
  return kit;
}
