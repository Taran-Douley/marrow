import type { Lesson } from '@marrow/skeleton';

/** The tables on offer. */
export const TABLES = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12] as const;

/**
 * A times-table lesson. The kit knows nothing about maths: this is the whole
 * lesson. Jump on a multiple of `n`; let anything else go by. A mistake is
 * explained with the sum, so a wrong press teaches the table.
 */
export function timesTable(n: number): Lesson {
  if (!Number.isInteger(n) || n < 2) throw new Error('A times table needs a whole number from 2 up.');
  return {
    title: `${n} times table`,
    prompt: `Jump on every multiple of ${n}. Let the others pass.`,
    values: [1, n * 12],
    isTarget: (value) => value % n === 0,
    explainWrong: (value) => `${value} is not a multiple of ${n}.`,
    explainMiss: (value) => `${value} is a multiple of ${n}: ${value / n} times ${n}.`,
  };
}
