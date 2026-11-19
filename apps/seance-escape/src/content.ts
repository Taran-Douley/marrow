import type { Acoustics, Maze, SoundShape, Wave } from '@marrow/skeleton';

// The house's story, its rooms and their sounds, and Mabel, the friendly ghost who helps you.
// Everything a player hears or reads in the game's own words lives here, so it can be rewritten
// or translated in one place.

export type RoomKind =
  | 'entrance'
  | 'front-hall'
  | 'library'
  | 'study'
  | 'cellar'
  | 'chapel'
  | 'kitchen'
  | 'nursery'
  | 'ballroom'
  | 'gallery'
  | 'conservatory';

export interface RoomSound {
  hz: number;
  wave: Wave;
  gain: number;
  shape: SoundShape;
  /** Seconds between sounds. */
  every: number;
}

export interface RoomStyle {
  name: string;
  /** Where the sound is coming from, in plain words, for captions: "a clock ticking". */
  heard: string;
  sound: RoomSound | null;
  /** The colour of the torchlight in this room. */
  light: number;
  /** What your feet sound like here. */
  floor: Floor;
  /** How the room answers: stone halls ring, carpeted rooms are hushed. */
  acoustics: Acoustics;
}

export type Floor = 'wood' | 'stone' | 'carpet';

/** The passages between rooms: old boards, a little echo. */
export const PASSAGE: { floor: Floor; acoustics: Acoustics } = { floor: 'wood', acoustics: { echo: 0.2, echoSeconds: 0.9 } };
/** Inside a wardrobe: coats all round, no echo at all. */
export const WARDROBE: Acoustics = { echo: 0, echoSeconds: 0.3 };

export const ROOM_STYLES: Record<RoomKind, RoomStyle> = {
  entrance: { name: 'Entrance Hall', heard: 'the door', sound: null, light: 0xff9a4a, floor: 'stone', acoustics: { echo: 0.35, echoSeconds: 1.8 } },
  'front-hall': { name: 'Front Hall', heard: 'the great bell', sound: null, light: 0xffb15e, floor: 'stone', acoustics: { echo: 0.45, echoSeconds: 2.6 } },
  library: {
    name: 'Library',
    heard: 'pages turning',
    sound: { hz: 0, wave: 'sine', gain: 0.35, every: 2.6, shape: { noise: true, filterHz: 3200, filterTo: 1400, seconds: 0.35 } },
    light: 0xffa04a,
    floor: 'carpet',
    acoustics: { echo: 0.12, echoSeconds: 0.6 },
  },
  study: {
    name: 'Study',
    heard: 'a clock ticking',
    sound: { hz: 0, wave: 'sine', gain: 0.4, every: 1, shape: { noise: true, filterHz: 4200, filterTo: 3000, seconds: 0.03 } },
    light: 0xff8a3a,
    floor: 'carpet',
    acoustics: { echo: 0.1, echoSeconds: 0.5 },
  },
  cellar: {
    name: 'Cellar',
    heard: 'water dripping',
    sound: { hz: 1500, wave: 'sine', gain: 0.32, every: 1.9, shape: { hzTo: 900, seconds: 0.07 } },
    light: 0x6a8cff,
    floor: 'stone',
    acoustics: { echo: 0.5, echoSeconds: 2.2 },
  },
  chapel: {
    name: 'Chapel',
    heard: 'an organ humming',
    sound: { hz: 147, wave: 'triangle', gain: 0.3, every: 3.2, shape: { hzTo: 147, filterHz: 900, seconds: 2.8 } },
    light: 0xb36bff,
    floor: 'stone',
    acoustics: { echo: 0.6, echoSeconds: 3.2 },
  },
  kitchen: {
    name: 'Kitchen',
    heard: 'a fire crackling',
    sound: { hz: 0, wave: 'sine', gain: 0.38, every: 0.45, shape: { noise: true, filterHz: 2600, filterTo: 900, seconds: 0.04 } },
    light: 0xff6a20,
    floor: 'stone',
    acoustics: { echo: 0.25, echoSeconds: 1 },
  },
  nursery: {
    name: 'Nursery',
    heard: 'a music box',
    sound: { hz: 880, wave: 'triangle', gain: 0.22, every: 1.4, shape: { hzTo: 880, seconds: 0.5 } },
    light: 0xff9ad0,
    floor: 'carpet',
    acoustics: { echo: 0.1, echoSeconds: 0.5 },
  },
  ballroom: {
    name: 'Ballroom',
    heard: 'a piano, out of tune',
    sound: { hz: 311, wave: 'triangle', gain: 0.25, every: 2.2, shape: { hzTo: 300, filterHz: 1800, seconds: 1.2 } },
    light: 0xffd27a,
    floor: 'wood',
    acoustics: { echo: 0.45, echoSeconds: 2.4 },
  },
  gallery: {
    name: 'Gallery',
    heard: 'wind whistling',
    sound: { hz: 620, wave: 'sine', gain: 0.18, every: 4, shape: { hzTo: 700, filterHz: 1500, seconds: 1.8 } },
    light: 0x9fd8ff,
    floor: 'wood',
    acoustics: { echo: 0.35, echoSeconds: 1.8 },
  },
  conservatory: {
    name: 'Conservatory',
    heard: 'rain on glass',
    sound: { hz: 0, wave: 'sine', gain: 0.25, every: 0.7, shape: { noise: true, filterHz: 6000, filterTo: 3000, seconds: 0.4 } },
    light: 0x7ee0a0,
    floor: 'stone',
    acoustics: { echo: 0.3, echoSeconds: 1.4 },
  },
};

const WANDERING_KINDS: RoomKind[] = ['library', 'study', 'cellar', 'chapel', 'kitchen', 'nursery', 'ballroom', 'gallery', 'conservatory'];
const SECOND_NAMES = ['Old', 'Small', 'Cold', 'Far', 'Dusty', 'Dark', 'Long', 'Little'];

export interface RoomInfo {
  kind: RoomKind;
  name: string;
  style: RoomStyle;
}

/** Name every room in a house. The same house always gets the same names. */
export function nameRooms(maze: Maze): RoomInfo[] {
  const used = new Map<RoomKind, number>();
  const order = [...WANDERING_KINDS];
  // Shuffle by the seed, so each house is laid out differently.
  let r = (maze.seed * 2654435761) >>> 0;
  for (let i = order.length - 1; i > 0; i--) {
    r = (Math.imul(r, 1664525) + 1013904223) >>> 0;
    const j = r % (i + 1);
    [order[i], order[j]] = [order[j]!, order[i]!];
  }
  let next = 0;
  return maze.rooms.map((cell) => {
    let kind: RoomKind;
    if (cell.x === maze.start.x && cell.y === maze.start.y) kind = 'entrance';
    else if (cell.x === maze.exit.x && cell.y === maze.exit.y) kind = 'front-hall';
    else kind = order[next++ % order.length]!;
    const n = used.get(kind) ?? 0;
    used.set(kind, n + 1);
    const style = ROOM_STYLES[kind];
    const name = n === 0 ? `the ${style.name}` : `the ${SECOND_NAMES[(n - 1) % SECOND_NAMES.length]} ${style.name}`;
    return { kind, name, style };
  });
}

export const RELICS = [
  { name: 'the Silver Candle', hum: 523 },
  { name: 'the Locket', hum: 587 },
  { name: 'the Planchette', hum: 659 },
] as const;

/** Voices of people who were here before. Each is heard once, in a room, the first time you enter it. */
export const WHISPERS = [
  'Lady Vale called the spirits in this house, a hundred years ago tonight.',
  'Something answered her. It was not her husband.',
  'She hid three relics, so no one could finish what she started.',
  'Only the great bell can send it back. Find the relics, then ring it.',
  'If it hears you, hide. It cannot see. It only listens.',
];

/** Mabel, a friendly ghost, who helps you through the house. */
export const MABEL = {
  intro:
    "Hello, dear. I'm Mabel. I've haunted this house for a hundred years, and the thing hunting you is not like me. Find three relics, then ring the great bell in the Front Hall to banish it. Ask me if you get lost.",
  relic: (name: string, found: number, total: number): string =>
    found < total ? `${name}! ${total - found === 1 ? 'Just one more' : `${total - found} more to find`}, dear.` : `${name}! That's all three!`,
  ritual: 'The bell is calling. Now run! It knows exactly where you are!',
  sealed: (left: number): string => `The front door is sealed. The séance holds it shut. Find the relics first, dear. ${left} to go.`,
  hint: (what: 'relic' | 'exit', way: string, rooms: number): string => {
    const go = way === 'here' ? 'It is right here' : way === 'back' ? 'Turn back' : `Go ${way}`;
    return what === 'relic'
      ? `I can feel a relic ${rooms} ${rooms === 1 ? 'room' : 'rooms'} away. ${go}.`
      : `The bell is ${rooms} ${rooms === 1 ? 'room' : 'rooms'} away. ${go}, quickly!`;
  },
  /** Said the first time you are caught, the second time, and so on; the last one repeats. */
  caught: (catches: number): string =>
    [
      'Oh dear. Up you get, try again.',
      'That was close, dear. Off we go again.',
      'It only wants to frighten you. Quieter this time. Hide if you hear it coming.',
      'Chin up, dear. Ask me the way if you are lost.',
    ][Math.max(0, Math.min(3, catches - 1))]!,
  /** Said at the third catch, when catches end a run. */
  lastCatch: 'That is three times, dear. Enough for tonight.',
  /** Said before a hint Mabel gives without being asked, after you have been caught a few times. */
  offer: 'Let me help, dear.',
  /** Mabel's word on a kind of room, the first time you walk into one. Short, so the ways out come soon. */
  rooms: {
    library: 'Mind the books, dear. Some of them bite.',
    study: 'That clock has not told the right time since 1924.',
    cellar: 'Ugh, the cellar. Always damp. Always dripping.',
    chapel: 'Lady Vale held the séance in here. Feel how cold it is.',
    kitchen: 'I used to bake in here. Before I was, well, dead.',
    nursery: 'I never liked that music box. It plays by itself.',
    ballroom: 'I danced in here once. Nobody could see me.',
    gallery: 'Do not look at the portraits, dear. They look back.',
    conservatory: 'Listen to that rain. It always rains in here.',
  } as Partial<Record<RoomKind, string>>,
};

// ---- noise and risk (spec seance-runs, stage 2) ---------------------------------------------------

/** The noise meter, in the player's words. Only a change of band is told. */
export const NOISE_WORDS: Record<'quiet' | 'loud' | 'very loud', { say: string; caption: string; detail: string }> = {
  quiet: { say: 'Quiet.', caption: 'Noise: quiet', detail: 'Your steps are quiet.' },
  loud: { say: 'Loud.', caption: 'Noise: loud', detail: 'The phantom can hear that from some way off.' },
  'very loud': { say: 'Very loud!', caption: 'Noise: very loud', detail: 'The phantom can hear that from a long way off.' },
};

/** A bearing in words, for a line that says where something is. */
export function sideWord(angle: number): string {
  const a = Math.abs(angle);
  return a <= 45 ? 'ahead' : a >= 135 ? 'behind you' : angle < 0 ? 'to your left' : 'to your right';
}

/** What a search turns up, in words. The noise and the cost are told in the option before it is chosen. */
export const SEARCH_LINES = {
  relic: (hint: string): string => `You search the room. That was loud. You find a torn note. ${hint}`,
  trail: (angle: number, rooms: number, near: boolean): string =>
    near
      ? `You search the room. That was loud. You find scuff marks in the dust. The phantom is ${sideWord(angle)}, ${rooms} ${rooms === 1 ? 'room' : 'rooms'} away.`
      : 'You search the room. That was loud. You find scuff marks, but they are old. The phantom is far away.',
  nothing: 'You search the room. That was loud, and you find only dust.',
};

/** The phantom heard a noise it was too far to hunt you for, and has gone to see. */
export const GHOST_HEARD = { say: 'It heard that. It is coming to look.', caption: 'It heard that. It is coming to look.' };

// ---- room events (stage 3) ----------------------------------------------------------------------

type EventSound = { hz: number; wave: Wave; gain: number; shape: SoundShape };

export interface RoomEventStyle {
  /** What the picture says: short, for the caption box. */
  caption: string;
  /** What the voice says. */
  line: string;
  /** The same, softened, when Fright is gentle or off. Only scary events have one. */
  soft?: string;
  /** What it sounds like. A scary event is softened by Fright (see kit.ts). */
  sound: EventSound;
  /** The picture, if it is more than the caption: a dimming of the room. Never a flash. */
  visual?: 'gutter';
  haptic?: number[];
}

/** The text and sound of each room event in the skeleton's table (ROOM_EVENTS), by id. */
export const ROOM_EVENT_STYLES: Record<string, RoomEventStyle> = {
  'door-slam': {
    caption: 'A door slams!',
    line: 'A door slams somewhere close. That was loud. The phantom may have heard it.',
    soft: 'A door closes somewhere close. That was loud. The phantom may have heard it.',
    sound: { hz: 90, wave: 'square', gain: 0.8, shape: { hzTo: 45, filterHz: 500, seconds: 0.5 } },
    haptic: [120, 40, 60],
  },
  'chains-rattle': {
    caption: 'Chains rattle',
    line: 'Chains rattle in the walls. That was loud. The phantom may have heard it.',
    soft: 'Something metal rattles in the walls. That was loud. The phantom may have heard it.',
    sound: { hz: 0, wave: 'sine', gain: 0.6, shape: { noise: true, filterHz: 5200, filterTo: 2400, seconds: 1.1 } },
    haptic: [30, 30, 30, 30, 30],
  },
  'cold-draught': {
    caption: 'A cold draught',
    line: 'A cold draught slips past you.',
    sound: { hz: 0, wave: 'sine', gain: 0.5, shape: { noise: true, filterHz: 500, filterTo: 1500, seconds: 1.2 } },
  },
  'whispers-in-the-walls': {
    caption: 'Whispers in the walls',
    line: 'The walls whisper, and for a moment you know where it is.',
    sound: { hz: 0, wave: 'sine', gain: 0.45, shape: { noise: true, filterHz: 2800, filterTo: 1100, seconds: 1.6 } },
  },
  'music-box': {
    caption: 'A music box starts',
    line: 'A music box starts to play, a long way off. Now you know where it is.',
    sound: { hz: 880, wave: 'triangle', gain: 0.35, shape: { hzTo: 988, seconds: 1.4 } },
  },
  'lights-gutter': {
    caption: 'The lights gutter',
    line: 'The lantern gutters, the light sinks, and then it steadies.',
    sound: { hz: 0, wave: 'sine', gain: 0.4, shape: { noise: true, filterHz: 900, filterTo: 250, seconds: 1.3 } },
    visual: 'gutter',
  },
  'portrait-watches': {
    caption: 'A portrait watches you',
    line: 'A portrait on the wall watches you. Its eyes follow you across the room.',
    soft: 'A portrait hangs on the wall. It looks very old.',
    sound: { hz: 330, wave: 'triangle', gain: 0.5, shape: { hzTo: 392, filterHz: 1200, seconds: 1.3 } },
  },
  'clock-strikes': {
    caption: 'A clock strikes',
    line: 'A clock strikes, slow and low, and loses count.',
    sound: { hz: 196, wave: 'sine', gain: 0.55, shape: { hzTo: 190, seconds: 2.4 } },
  },
  'cold-hand': {
    caption: 'A cold hand on your shoulder',
    line: 'A cold hand rests on your shoulder, and is gone.',
    soft: 'A chill touches your shoulder, and is gone.',
    sound: { hz: 0, wave: 'sine', gain: 0.5, shape: { noise: true, filterHz: 700, filterTo: 180, seconds: 1.0 } },
    haptic: [50, 60, 20],
  },
  scratching: {
    caption: 'Scratching in the walls',
    line: 'Something scratches inside the walls, then stops.',
    soft: 'Something small scratches in the walls, then stops.',
    sound: { hz: 0, wave: 'sine', gain: 0.45, shape: { noise: true, filterHz: 4200, filterTo: 3000, seconds: 0.7 } },
  },
};
