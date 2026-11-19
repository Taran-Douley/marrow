/**
 * A lesson turns a timing game into a thinking game. Each obstacle carries a
 * number. If the number fits the rule it is a target: jump on the beat. If not,
 * it is a distractor: let it pass, because pressing is the mistake. The game
 * explains each mistake in plain words. The kit knows nothing about maths: the
 * rule and the explanations are yours, so a lesson can be times tables,
 * spelling, notes, colours, anything with a yes or no answer.
 */
export interface Lesson {
  title: string;
  /** Said at the start, in plain words. */
  prompt: string;
  /** The numbers that can appear, inclusive. */
  values: readonly [number, number];
  /** True when the player should jump on this number. */
  isTarget(value: number): boolean;
  /** Said when the player jumped on a distractor. */
  explainWrong?(value: number): string;
  /** Said when the player let a target go by. */
  explainMiss?(value: number): string;
  /** Share of obstacles that are targets, 0.1 to 0.9. Default 0.5. */
  targetShare?: number;
}

export const DEFAULT_TARGET_SHARE = 0.5;

export interface LessonPools {
  targets: number[];
  distractors: number[];
}

/** Every whole number in range, split by the rule. Throws, in plain words, if either side is empty. */
export function lessonPools(lesson: Lesson): LessonPools {
  const [lo, hi] = lesson.values;
  if (!Number.isInteger(lo) || !Number.isInteger(hi) || lo > hi) {
    throw new Error(`Lesson '${lesson.title}' needs whole numbers for values, like [1, 36].`);
  }
  const share = lesson.targetShare ?? DEFAULT_TARGET_SHARE;
  if (!(share >= 0.1 && share <= 0.9)) {
    throw new Error(`Lesson '${lesson.title}' needs a targetShare between 0.1 and 0.9.`);
  }
  const targets: number[] = [];
  const distractors: number[] = [];
  for (let v = lo; v <= hi; v++) (lesson.isTarget(v) ? targets : distractors).push(v);
  if (targets.length === 0 || distractors.length === 0) {
    throw new Error(
      `Lesson '${lesson.title}' needs at least one target and one distractor between ${lo} and ${hi}.`,
    );
  }
  return { targets, distractors };
}
