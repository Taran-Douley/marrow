import { isSolid } from '../level';
import type { Lesson } from '../lesson';
import { proofResult } from './timing';
import type { ProofProperty } from './types';

/**
 * Property 101, one right answer each: in a lesson, every obstacle has a number
 * in range, and it is solid exactly when the rule says it is a target. So there
 * is never a trick question, and the lesson never hides a wrong answer from the
 * player. A lesson also needs a few of each kind, or it is not a decision.
 */
export function lessonProperty(lesson: Lesson): ProofProperty {
  return (level, input) => {
    const label = input.label ?? `Level ${level.seed}`;
    const [lo, hi] = lesson.values;
    const problems: string[] = [];

    for (const o of level.obstacles) {
      const where = `${label}, obstacle ${o.index + 1} (${o.kind})`;
      if (o.value === undefined) {
        problems.push(`${where}: it has no number, so the player cannot decide what to do.`);
        continue;
      }
      if (o.value < lo || o.value > hi) problems.push(`${where}: the number ${o.value} is outside ${lo} to ${hi}.`);
      const target = lesson.isTarget(o.value);
      if (target !== isSolid(o)) {
        problems.push(
          `${where}: ${o.value} is ${target ? 'a target' : 'not a target'}, but the obstacle is one to ${isSolid(o) ? 'jump' : 'let pass'}.`,
        );
      }
    }

    const jump = level.obstacles.filter(isSolid).length;
    const pass = level.obstacles.length - jump;
    if (level.obstacles.length >= 4 && (jump < 2 || pass < 2)) {
      problems.push(`${label}: only ${jump} to jump and ${pass} to let pass. A lesson needs at least two of each.`);
    }
    return proofResult(101, 'One right answer each', problems);
  };
}
