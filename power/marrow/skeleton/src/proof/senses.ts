import { EVENT_TYPES } from '../channels/events';
import type { OutputCommand, SemanticEvent } from '../types';
import { proofResult } from './timing';
import type { ProofResult } from './types';

/**
 * Property 8, two senses: every event a game can emit must reach at least two of
 * hearing, sight and touch, under the player's profile. Works for any game: a
 * creator lists their events (with example data) and the channels they use.
 *
 * Decorative events (the wind and pad) carry no information and are skipped.
 */
export function eventsReachTwoSenses(
  samples: readonly SemanticEvent[],
  render: (event: SemanticEvent) => readonly OutputCommand[],
  decorative: readonly string[] = [EVENT_TYPES.atmosphere],
): ProofResult {
  const problems: string[] = [];
  for (const event of samples) {
    if (decorative.includes(event.type)) continue;
    const senses = [...new Set(render(event).flatMap((c) => c.senses))];
    if (senses.length >= 2) continue;
    problems.push(
      `Event '${event.type}' reaches ${senses.length === 0 ? 'no sense' : `only ${senses[0]}`}. ` +
        `Give it a caption, speech, a vibration or a sound so a second sense gets it.`,
    );
  }
  return proofResult(8, 'Two senses', problems);
}
