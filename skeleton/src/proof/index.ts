import type { Level } from '../level';
import {
  fourthBeatClears,
  jumpable,
  multisensory,
  proofResult,
  reachable,
  unambiguousCues,
  windowFloor,
} from './timing';
import type { ProofInput, ProofResult } from './types';

export type { ObjectInfo, ObjectSource, ProofInput, ProofProperty, ProofResult } from './types';
export { WINDOW_FLOOR_MS, proofResult } from './timing';
export { CUE_MARGIN_DB, cuesAudible, trackClearOfCues } from './audio';
export { eventsReachTwoSenses } from './senses';
export { lessonProperty } from './lesson';
export { coachInTime } from './coach';
export { MAX_FLASHES_PER_SECOND, linesInScript, noHoldOrChord, noUnsafeFlashing, repairsKeepTheLevel, themesHaveContrast } from './presentation';
export { gateWordsInTime, gatesHaveOneRightLane, portalsGiveWarning, restsAreRests, songProperties } from './song';

/**
 * Run every built-in property, then any `extra` properties you supply for your
 * own game rules. Results come back in that order.
 */
export function prove(level: Level, input: ProofInput): ProofResult[] {
  const builtIn = [
    jumpable(level, input),
    reachable(level, input),
    unambiguousCues(level, input),
    multisensory(level, input),
    windowFloor(level, input),
    fourthBeatClears(level, input),
  ];
  const custom = (input.extra ?? []).map((property) => property(level, input));
  return [...builtIn, ...custom];
}

/** Thrown when a level fails the proof. The game must never serve it (Req 8.9). */
export class LevelRefused extends Error {
  constructor(readonly failures: ProofResult[]) {
    super(
      'This level cannot be served:\n' +
        failures.map((f) => `- ${f.name}: ${f.counterexample ?? 'failed'}`).join('\n'),
    );
    this.name = 'LevelRefused';
  }
}

/** Returns the level if it passes every property, otherwise throws LevelRefused. */
export function refuseIfFailing(level: Level, input: ProofInput): Level {
  const failures = prove(level, input).filter((r) => !r.pass);
  if (failures.length > 0) throw new LevelRefused(failures);
  return level;
}
