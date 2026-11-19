import type { SemanticEvent } from '../types';

/** The event types the built-in channels understand (Requirement 3a.1). */
export const EVENT_TYPES = {
  /** An obstacle is coming. data: { object: string, first: boolean } */
  approaching: 'obstacle-approaching',
  /** One beat of the countdown. data: { object: string, beat: 1 | 2 | 3 | 4 }. Beat 4 is the press. */
  beat: 'countdown-beat',
  /** The player cleared an obstacle. data: { object?: string } */
  cleared: 'cleared',
  hurt: 'hurt',
  levelComplete: 'level-complete',
  /** The player pressed and took off. data: { index: number } */
  jumped: 'jumped',
  /** How well a jump was timed. data: { grade: 'perfect' | 'good' | 'ok', streak, score, points, index } */
  judged: 'judged',
  /** The player rightly let a distractor go by. data: { object, index, value?, streak, score, points } */
  passed: 'passed',
  /** The player landed. */
  landed: 'landed',
  /** The world's background, once per bar. Decorative: it carries no information. data: { bar, tension, span } */
  atmosphere: 'atmosphere',
  /** A menu option is lit. data: { label: string, index: number } */
  menuOption: 'menu-option',
  /** Why the player fell. data: { reason: 'early' | 'late' | 'none' } */
  fallReason: 'fall-reason',
  /** A portal: from here a press does a different move. data: { move: 'jump' | 'flip' | 'switch' } */
  portal: 'portal',
} as const;

export type FallReason = 'early' | 'late' | 'none' | 'wrong';

export function dataString(event: SemanticEvent, key: string): string | undefined {
  const value = event.data?.[key];
  return typeof value === 'string' ? value : undefined;
}

export function dataNumber(event: SemanticEvent, key: string): number | undefined {
  const value = event.data?.[key];
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

export function dataBool(event: SemanticEvent, key: string): boolean {
  return event.data?.[key] === true;
}

export function beatOf(event: SemanticEvent): 1 | 2 | 3 | 4 | undefined {
  const beat = dataNumber(event, 'beat');
  return beat === 1 || beat === 2 || beat === 3 || beat === 4 ? beat : undefined;
}
