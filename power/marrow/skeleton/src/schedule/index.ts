import { BAR_SECONDS } from '../channels/audio';
import { EVENT_TYPES } from '../channels/events';
import { cueTimes, idealPress, resolveTiming, type Level, type Obstacle, type Timing } from '../level';
import { sectionAt } from '../song';
import type { SemanticEvent } from '../types';

/** Danger rises over this many running seconds before an obstacle. */
const TENSION_RUN_UP = 3.5;
/** The music steps aside this long before the first beep, and comes back this long after the press. */
const QUIET_LEAD = 0.15;
const QUIET_TAIL = 0.15;

/**
 * A lesson's number goes on the countdown events, so it is spoken and shown. Whether the
 * obstacle is a target is left off on purpose: the events must never give away the answer.
 */
const numbered = (o: Pick<Obstacle, 'value' | 'gate' | 'move'>): Record<string, unknown> => ({
  ...(o.value === undefined ? {} : { value: o.value }),
  // A gate says both numbers, so the player can choose; which one is right is still left to them.
  ...(o.gate ? { here: o.gate.here } : {}),
  ...(o.move && o.move !== 'jump' ? { move: o.move } : {}),
});

/**
 * Turn a level into the events a game would emit, in order, on level time
 * (running seconds): the countdown for each obstacle (Requirement 3.2: beeps at
 * J-3*beat, J-2*beat and J-beat, the press at J) and one `atmosphere` event per
 * bar for the wind and pad underneath. Adapters convert running seconds to real
 * time with the speed rate (Requirement 3.3). Pass your own timing if your game
 * does not use the defaults.
 */
export function levelEvents(level: Level, timingOverrides: Partial<Timing> = {}): SemanticEvent[] {
  const timing = resolveTiming(timingOverrides);
  const events: SemanticEvent[] = [];
  const seen = new Set<string>();

  for (const o of level.obstacles) {
    const [first, second, third] = cueTimes(o, timing);
    const press = idealPress(o, timing);
    const firstOfKind = !seen.has(o.kind);
    seen.add(o.kind);

    events.push({
      type: EVENT_TYPES.approaching,
      at: first,
      // `span` is how long the approach lasts, so the tone can arrive exactly at the press.
      data: { object: o.kind, index: o.index, first: firstOfKind, span: press - first, ...numbered(o) },
    });
    [first, second, third, press].forEach((at, i) => {
      events.push({
        type: EVENT_TYPES.beat,
        at,
        data: { object: o.kind, index: o.index, beat: i + 1, ...numbered(o) },
      });
    });
  }

  // Portals: from here a press makes a different move. Said a bar before anything needs it.
  for (const p of level.portals ?? []) events.push({ type: EVENT_TYPES.portal, at: p.at, data: { move: p.move } });

  // The world underneath: one event per bar, with danger rising toward each obstacle.
  const last = level.obstacles.at(-1);
  const songEnd = level.sections?.at(-1)?.to ?? 0;
  if (last) {
    const presses = level.obstacles.map((o) => idealPress(o, timing));
    const end = Math.max(last.start + last.width + timing.halfWidth + BAR_SECONDS, songEnd);
    for (let bar = 0; bar * BAR_SECONDS <= end; bar++) {
      const at = bar * BAR_SECONDS;
      const next = presses.find((p) => p > at);
      const tension = next === undefined ? 0.1 : Math.max(0, Math.min(1, 1 - (next - at) / TENSION_RUN_UP));
      // When the beeps play under this bar, so the music can step aside for them and play out in between.
      const reach = at + BAR_SECONDS * 1.25;
      const quiet = presses
        .map((p) => [p - 3 * timing.beat - QUIET_LEAD, p + QUIET_TAIL] as [number, number])
        .filter(([from, to]) => to > at && from < reach);
      // The pulse the presses sit on, so the music can play on it too.
      const pulse = ((presses[0]! % timing.beat) + timing.beat) % timing.beat;
      // In a song, the part playing sets how much of the band plays: a breakdown, a build, the drop.
      const part = sectionAt(level, at + BAR_SECONDS / 2) ?? sectionAt(level, at);
      events.push({
        type: EVENT_TYPES.atmosphere,
        at,
        data: { bar, tension, span: BAR_SECONDS, quiet, pulse, ...(part ? { energy: part.energy, part: part.name } : {}) },
      });
    }
  }

  // Stable sort keeps the approaching line ahead of beat 1, which shares its time.
  return events.sort((x, y) => x.at - y.at);
}
