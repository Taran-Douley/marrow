// The sound guide: before the house, every sound that matters, one press each, with what it means.
// "Enter the house" comes first, so a player who knows it already is in with one press.

export interface GuideItem {
  id: string;
  label: string;
  /** What the sound means, in plain words. Said before the sound plays. */
  line: string;
  /** The sounds to play after the line, at seconds after it ends. */
  demo: { type: string; at: number; data?: Record<string, unknown> }[];
}

export const GUIDE: readonly GuideItem[] = [
  { id: 'enter', label: 'Enter the house', line: '', demo: [] },
  {
    id: 'doorway',
    label: 'Hear a room',
    line: 'When you reach a room, a bell rings and its name is said. Then each way out is read from where it lies. Press as you hear the one you want.',
    demo: [
      { type: 'walk-crossing', at: 0, data: { count: 2 } },
      { type: 'walk-option', at: 1.2, data: { id: 'a', label: 'Left', angle: -90, distance: 0.3, index: 1, count: 2 } },
      { type: 'walk-option', at: 2.6, data: { id: 'b', label: 'Right', angle: 90, distance: 0.3, index: 2, count: 2 } },
    ],
  },
  {
    id: 'phantom',
    label: 'Hear the phantom',
    line: "This is the phantom's whisper. It comes from where the phantom is, and it is louder the nearer it is. It cannot see. It only listens.",
    demo: [
      { type: 'ghost-sense', at: 0, data: { angle: -60, distance: 0.7 } },
      { type: 'ghost-sense', at: 1.5, data: { angle: -30, distance: 0.3 } },
    ],
  },
  {
    id: 'moving',
    label: 'Hear it move',
    line: 'When it is near, you hear its feet drag each time it moves, and now and then it moans. Both come from where it is.',
    demo: [
      { type: 'ghost-step', at: 0, data: { angle: -90, distance: 0.5 } },
      { type: 'ghost-step', at: 0.9, data: { angle: -60, distance: 0.4 } },
      { type: 'ghost-moan', at: 1.6, data: { angle: -45, distance: 0.35 } },
    ],
  },
  {
    id: 'hunting',
    label: 'Hear it hunting',
    line: 'This shriek means it heard you, and is hunting you. Get far away, or hide in a wardrobe until it gives up.',
    demo: [{ type: 'ghost-hunts', at: 0, data: { angle: 40, distance: 0.4 } }],
  },
  {
    id: 'heart',
    label: 'Hear your heartbeat',
    line: 'Your heartbeat starts when the phantom is within five rooms, and races as it gets close.',
    demo: [0, 0.17, 0.9, 1.07, 1.5, 1.67, 2.0, 2.17, 2.45, 2.62].map((at, i) => ({ type: i % 2 === 0 ? 'heartbeat' : 'heartbeat-dub', at })),
  },
  {
    id: 'relic',
    label: 'Hear a relic',
    line: 'A relic hums from its room. Follow the hum. There are three to find.',
    demo: [{ type: 'relic-sense', at: 0, data: { angle: 60, distance: 0.4 } }],
  },
  {
    id: 'bell',
    label: 'Hear the great bell',
    line: 'The great bell is in the Front Hall. When you have all three relics, ring it to banish the phantom, and escape.',
    demo: [{ type: 'exit-sense', at: 0, data: { angle: 0, distance: 0.5 } }],
  },
  {
    id: 'rooms',
    label: 'Hear the rooms',
    line: 'Every room has its own sound. A clock ticks in the study. Water drips in the cellar. Listen, and you will know where you are.',
    demo: [
      { type: 'room-study', at: 0, data: { angle: 90, distance: 0.3 } },
      { type: 'room-study', at: 1, data: { angle: 90, distance: 0.3 } },
      { type: 'room-cellar', at: 1.6, data: { angle: -90, distance: 0.3 } },
      { type: 'room-cellar', at: 3.4, data: { angle: -90, distance: 0.3 } },
    ],
  },
];
