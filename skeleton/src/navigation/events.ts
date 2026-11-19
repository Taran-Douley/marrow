import { mulberry32 } from '../level';

// Room events: the house surprises you. When you first walk into a room, the seed of the house and the
// number of the room roll once for an event, so a house is the same every time it is served. Each event
// is information or a small noise, never a change to the maze, so the proofs of the house still stand.
// The game gives each event its own sound, caption and spoken line (see Séance Escape's content).

/** What an event does besides being heard, seen and said. */
export type RoomEventEffect =
  /** Nothing but the scene: a landmark, a picture, a fright. */
  | { kind: 'none' }
  /** A noise the phantom hears, at the room, of this level (see NOISE). It adds to the phantom's pull. */
  | { kind: 'noise'; level: number }
  /** A hint toward the nearest relic (or the bell, when they are all found). */
  | { kind: 'hint' }
  /** The phantom's place, as Listen would say it. */
  | { kind: 'ghost-place' };

export interface RoomEventDef {
  /** Names the game's sound, caption and line for the event. */
  id: string;
  /** How often it comes up, against the others. */
  weight: number;
  /** Frightening: the game softens it with its Fright setting. */
  scary: boolean;
  effect: RoomEventEffect;
}

/** Eight or more events. Every one of them is told by sound, caption and speech by the game. */
export const ROOM_EVENTS: readonly RoomEventDef[] = [
  { id: 'door-slam', weight: 2, scary: true, effect: { kind: 'noise', level: 3 } },
  { id: 'chains-rattle', weight: 2, scary: true, effect: { kind: 'noise', level: 2 } },
  { id: 'cold-draught', weight: 3, scary: false, effect: { kind: 'hint' } },
  { id: 'whispers-in-the-walls', weight: 2, scary: false, effect: { kind: 'ghost-place' } },
  { id: 'music-box', weight: 3, scary: false, effect: { kind: 'none' } },
  { id: 'lights-gutter', weight: 3, scary: false, effect: { kind: 'none' } },
  { id: 'portrait-watches', weight: 2, scary: true, effect: { kind: 'none' } },
  { id: 'clock-strikes', weight: 2, scary: false, effect: { kind: 'none' } },
  { id: 'cold-hand', weight: 1, scary: true, effect: { kind: 'none' } },
  { id: 'scratching', weight: 2, scary: true, effect: { kind: 'none' } },
];

/** About this share of rooms have an event, rolled once the first time you walk in. */
export const EVENT_CHANCE = 0.45;

/** The most an event's picture may flicker, in times a second. Nothing flashes more than 3 a second. */
export const EVENT_FLICKER_MAX_HZ = 2;

const TOTAL_WEIGHT = ROOM_EVENTS.reduce((sum, e) => sum + e.weight, 0);

/** The event of one room of one house, or null. The same house and room always give the same answer. */
export function rollRoomEvent(seed: number, room: number): RoomEventDef | null {
  const rand = mulberry32(((seed ^ 0xe7e7e7) + Math.imul(room + 1, 2654435761)) >>> 0);
  rand(); // the first draw of a generator seeded like this is close to the seed: skip it
  if (rand() >= EVENT_CHANCE) return null;
  let pick = rand() * TOTAL_WEIGHT;
  for (const event of ROOM_EVENTS) {
    pick -= event.weight;
    if (pick < 0) return event;
  }
  return ROOM_EVENTS[ROOM_EVENTS.length - 1]!;
}
