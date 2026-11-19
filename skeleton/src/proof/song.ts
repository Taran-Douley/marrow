import { cueTimes, isSolid, resolveTiming, type Level, type Move } from '../level';
import type { Lesson } from '../lesson';
import { phrase } from '../channels/phrases';
import { speechMs } from '../scanning';
import { barSeconds, moveAt } from '../song';
import { lockedToTheSong } from './rhythm';
import { proofResult } from './timing';
import type { ProofInput, ProofProperty, ProofResult } from './types';

const EPS = 1e-9;
const secs = (n: number): string => n.toFixed(2);
const MOVE_WORDS: Record<Move, string> = { jump: 'jump', flip: 'flip', switch: 'switch lanes' };

/**
 * Property 15, rests are rests: in a part of the song marked as a rest, nothing counts down and nothing
 * needs a press, from the first beep to the moment the obstacle is passed. And every obstacle asks for
 * the move of the part it is in.
 */
export function restsAreRests(level: Level, input: ProofInput): ProofResult {
  const tm = resolveTiming(input.timing);
  const label = input.label ?? `Level ${level.seed}`;
  const problems: string[] = [];
  for (const o of level.obstacles) {
    const first = cueTimes(o, tm)[0];
    const passed = o.start + o.width + tm.halfWidth;
    for (const s of level.sections ?? []) {
      if (s.feel === 'rest' && first < s.to - EPS && passed > s.from + EPS) {
        problems.push(
          `${label}, obstacle ${o.index + 1} (${o.kind}): its countdown runs from ${secs(first)} s to ${secs(passed)} s, ` +
            `inside the rest '${s.name}' (${secs(s.from)} s to ${secs(s.to)} s). A rest must have nothing to press.`,
        );
      }
    }
  }
  return proofResult(15, 'Rests are rests', problems);
}

/**
 * Property 16, portals give warning: when the move changes, the portal is announced a whole bar before
 * any countdown in the new move begins, no countdown in the old move is still running over it, and every
 * obstacle asks for the move that is in force when its countdown starts.
 */
export function portalsGiveWarning(level: Level, input: ProofInput): ProofResult {
  const tm = resolveTiming(input.timing);
  const bar = barSeconds(tm);
  const label = input.label ?? `Level ${level.seed}`;
  const problems: string[] = [];
  for (const o of level.obstacles) {
    const first = cueTimes(o, tm)[0];
    const passed = o.start + o.width + tm.halfWidth;
    const wanted = o.move ?? 'jump';
    const inForce = moveAt(level, first);
    const where = `${label}, obstacle ${o.index + 1} (${o.kind})`;
    if (inForce !== wanted) {
      problems.push(`${where}: it asks the player to ${MOVE_WORDS[wanted]}, but when its countdown starts a press would ${MOVE_WORDS[inForce]}.`);
    }
    for (const p of level.portals ?? []) {
      if (first < p.at + bar - EPS && passed > p.at + EPS) {
        problems.push(
          `${where}: its countdown (${secs(first)} s to ${secs(passed)} s) runs into the portal to ${MOVE_WORDS[p.move]} mode at ` +
            `${secs(p.at)} s. Nothing may count down from the portal until one bar (${secs(bar)} s) after it.`,
        );
      }
    }
  }
  return proofResult(16, 'Portals give warning', problems);
}

/**
 * Property 103, one right lane: every number gate has two different numbers, one in each lane, and
 * exactly one of them fits the lesson's rule. The press is needed exactly when the right one is in the
 * other lane (property 101 checks that half).
 */
export function gatesHaveOneRightLane(lesson: Lesson | undefined): ProofProperty {
  return (level, input) => {
    const label = input.label ?? `Level ${level.seed}`;
    const problems: string[] = [];
    for (const o of level.obstacles) {
      if ((o.move ?? 'jump') !== 'switch') continue;
      const where = `${label}, gate ${o.index + 1} (${o.kind})`;
      if (!lesson || o.value === undefined || o.gate === undefined) {
        problems.push(`${where}: a gate needs a number in each lane and a rule to choose by.`);
        continue;
      }
      const there = lesson.isTarget(o.value);
      const here = lesson.isTarget(o.gate.here);
      if (o.value === o.gate.here) problems.push(`${where}: both lanes say ${o.value}, so there is nothing to choose.`);
      else if (there === here) {
        problems.push(
          `${where}: ${o.gate.here} and ${o.value} ${there ? 'both fit' : 'both miss'} the rule, so there is not exactly one right lane.`,
        );
      }
      if (isSolid(o) !== there) {
        problems.push(`${where}: the right lane is ${there ? 'the other one' : 'yours'}, but the gate asks the player to ${isSolid(o) ? 'switch' : 'stay'}.`);
      }
    }
    return proofResult(103, 'One right lane', problems);
  };
}

/**
 * Property 104, gate words in time: both numbers of a gate can be said in full between the first beep
 * and the fourth beat at every speed, Fast included, by a fair guess at speaking speed. The caption
 * shows them from the first beep as well.
 */
export function gateWordsInTime(level: Level, input: ProofInput): ProofResult {
  const tm = resolveTiming(input.timing);
  const label = input.label ?? `Level ${level.seed}`;
  // The fastest speed has the shortest countdown, so if the words fit there they fit everywhere.
  const [speed, fastest] = Object.entries(tm.rates).sort((a, b) => b[1] - a[1])[0]!;
  const countdownMs = ((3 * tm.beat) / fastest) * 1000;
  const problems: string[] = [];
  for (const o of level.obstacles) {
    if (!o.gate || o.value === undefined) continue;
    const words = phrase('gate', { here: String(o.gate.here), there: String(o.value) });
    const ms = speechMs(words);
    if (ms > countdownMs + EPS) {
      problems.push(
        `${label}, gate ${o.index + 1} (${o.kind}): "${words}" takes about ${Math.round(ms)} ms to say, but the countdown ` +
          `at ${speed} is ${Math.round(countdownMs)} ms. Use shorter numbers or a slower beat.`,
      );
    }
  }
  return proofResult(104, 'Gate words in time', problems);
}

/** The song properties as extras for `prove`. */
export function songProperties(lesson?: Lesson): ProofProperty[] {
  return [restsAreRests, portalsGiveWarning, gatesHaveOneRightLane(lesson), gateWordsInTime, lockedToTheSong];
}
