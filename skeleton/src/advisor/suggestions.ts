import type { Brief, Genre } from './brief';
import { PALETTES, type Palette } from './palette';

// The suggestions (Requirement A2). Each is a rule: when it applies to a game, what to add, why, for
// whom (as ways of playing, never a disability), which guideline it follows, and how it gets done.
// Rules, not guesses: the same brief always gets the same advice, and every line can be tested.

export type Area = 'controls' | 'sound' | 'words' | 'sight' | 'difficulty' | 'menus' | 'story' | 'features';
export const AREAS: readonly { id: Area; title: string }[] = [
  { id: 'controls', title: 'Controls' },
  { id: 'sound', title: 'Sound' },
  { id: 'words', title: 'Speech and text' },
  { id: 'sight', title: 'Sight' },
  { id: 'difficulty', title: 'Difficulty and failure' },
  { id: 'menus', title: 'Menus and setup' },
  { id: 'story', title: 'Story and dialogue' },
  { id: 'features', title: "Your game's own features" },
];

/** What the advisor can build from an accepted suggestion. */
export type BuildKey = 'palette' | 'coach' | 'assist' | 'announce';

export type How =
  /** Marrow does it already, on by default: it only needs saying, and keeping. */
  | { kind: 'built-in'; detail: string }
  /** The advisor builds it from the plan into the game's settings. */
  | { kind: 'from-plan'; builds: BuildKey; detail: string }
  /** The game's own code does it; the advisor gives the how-to and keeps it on the to-do list. */
  | { kind: 'by-hand'; detail: string };

export interface Context {
  brief: Brief;
  palette: Palette;
  /** The game uses a pattern Marrow can build and prove, in the browser. */
  marrow: boolean;
  timed: boolean;
}

export interface Suggestion {
  id: string;
  area: Area;
  title: string;
  why: string;
  helps: string;
  guideline: string;
  how: How;
}

interface Rule {
  id: string;
  area: Area;
  applies(c: Context): boolean;
  title(c: Context): string;
  why: string;
  helps: string;
  guideline: string;
  how(c: Context): How;
}

const TIMED: readonly Genre[] = ['runner', 'rhythm', 'platformer', 'shooter', 'racing'];
const MARROW: readonly Genre[] = ['runner', 'rhythm', 'quiz', 'maze'];
/** A feature in the brief mentions one of these words. */
const has = (c: Context, re: RegExp): boolean => c.brief.features.some((f) => re.test(f.toLowerCase()));
const builtOr = (c: Context, built: string, byHand: string): How => (c.marrow ? { kind: 'built-in', detail: built } : { kind: 'by-hand', detail: byHand });

const RULES: readonly Rule[] = [
  // ---- controls
  {
    id: 'one-switch',
    area: 'controls',
    applies: () => true,
    title: () => 'Every action, menus included, can be done with one switch',
    why: 'Some players use a single button, a head switch or a sip-and-puff switch. If one press can do everything, they can play the whole game.',
    helps: 'one-switch players, and anyone playing with one hand',
    guideline: 'Game Accessibility Guidelines (motor): make the game playable with a single button; Xbox Accessibility Guidelines: Input',
    how: (c) => builtOr(c, 'Any key, click, tap or gamepad button is the switch, and menus are scanned (createGame, createMenuStack).', 'Offer a one-button mode: scan through actions, and let one press choose the lit one.'),
  },
  {
    id: 'no-holds',
    area: 'controls',
    applies: () => true,
    title: () => 'Nothing needs holding, two buttons at once, or fast repeated presses',
    why: 'Holding and mashing are hard or painful for many players, and they shut out switch users entirely.',
    helps: 'players who tire quickly, and one-switch players',
    guideline: 'Game Accessibility Guidelines (motor): avoid repeated inputs and holds; Xbox Accessibility Guidelines: Input',
    how: (c) => builtOr(c, 'Proof property 10 checks it: one tap is one press, and key repeat adds none.', 'Turn every hold into a toggle and every mash into one press.'),
  },
  {
    id: 'remap',
    area: 'controls',
    applies: (c) => !c.marrow || /keyboard|controller|gamepad|buttons/.test(c.brief.controls.toLowerCase()),
    title: () => 'Let players remap every control',
    why: 'Players use what their bodies allow: a different key, a foot pedal, one side of a pad.',
    helps: 'players with their own controllers or layouts',
    guideline: 'Game Accessibility Guidelines (motor, basic): allow controls to be remapped',
    how: () => ({ kind: 'by-hand', detail: 'Keep a table of action to input in the player profile, with a screen to change it. (Marrow roadmap: full remapping.)' }),
  },
  {
    id: 'timing-help',
    area: 'controls',
    applies: (c) => c.timed,
    title: () => 'Timing help: a press anywhere in the countdown counts',
    why: 'Pressing on an exact beat is hard when your hands are slow to answer. Timing help keeps the choice yours and takes the stopwatch away.',
    helps: 'players who need more time to press',
    guideline: 'Game Accessibility Guidelines (motor): include an option to adjust the game speed or timing',
    how: (c) => (c.marrow ? { kind: 'from-plan', builds: 'assist', detail: 'Timing help is offered in the menu, and turned on for new players if you choose.' } : { kind: 'by-hand', detail: 'Widen or remove timing windows when the player asks, without changing the content.' }),
  },
  {
    id: 'aim-help',
    area: 'controls',
    applies: (c) => c.brief.genre === 'shooter' || has(c, /aim|shoot|target/),
    title: () => 'Aim help: lock on to the nearest target, and say where it is',
    why: 'Fine aiming needs steady hands and sharp eyes. Lock-on keeps the action and drops the precision.',
    helps: 'players who aim slowly, and players who play by sound',
    guideline: 'Xbox Accessibility Guidelines: Input (assist options)',
    how: () => ({ kind: 'by-hand', detail: 'Snap aim to the nearest target on one press; place its sound in space (Marrow events with spatial: true) and say its direction.' }),
  },
  {
    id: 'drive-help',
    area: 'controls',
    applies: (c) => c.brief.genre === 'racing',
    title: () => 'Steering and speed help',
    why: 'Holding a line and the throttle at once is two hard things. Help with one leaves the race.',
    helps: 'players who press slowly, and one-switch players',
    guideline: 'Xbox Accessibility Guidelines: Input (assist options)',
    how: () => ({ kind: 'by-hand', detail: 'Offer auto-accelerate and steering assist; say turns before they come, as a countdown.' }),
  },

  // ---- sound
  {
    id: 'themed-cues',
    area: 'sound',
    applies: (c) => c.timed || c.brief.genre === 'quiz',
    title: (c) => `Countdown cues as ${c.palette.sounds.cueLow.words} and ${c.palette.sounds.cueHigh.words}`,
    why: 'A cue you can hear coming lets players time a move by ear. Making the cues part of the world keeps the mood instead of breaking it.',
    helps: 'players who play by sound, and everyone in a busy moment',
    guideline: 'Xbox Accessibility Guidelines: Audio accessibility; Game Accessibility Guidelines (vision): use distinct sound for each important thing',
    how: (c) => (c.marrow ? { kind: 'from-plan', builds: 'palette', detail: `The two cue voices come from the ${c.palette.theme} palette. They differ in pitch and timbre and stay above the music (palette proof).` } : { kind: 'by-hand', detail: 'Give each kind of thing its own sound, different in pitch and timbre, and play it before it needs an answer.' }),
  },
  {
    id: 'themed-world',
    area: 'sound',
    applies: () => true,
    title: (c) => `World sounds that fit: ${c.palette.sounds.step.words} for steps, ${c.palette.sounds.reward.words} for a reward, ${c.palette.sounds.fall.words} for a fall`,
    why: 'Every action should be heard, and heard as part of the game. Random beeps tire the ear; sounds from the world tell a story.',
    helps: 'players who play by sound, and anyone who likes a game that sounds alive',
    guideline: 'Game Accessibility Guidelines (vision): ensure all key actions have a sound',
    how: (c) => (c.marrow ? { kind: 'from-plan', builds: 'palette', detail: `The jump, landing and fall sounds come from the ${c.palette.theme} palette. ${c.palette.mood}` } : { kind: 'by-hand', detail: `Use the ${c.palette.theme} palette's sounds and words as a guide: ${c.palette.mood}` }),
  },
  {
    id: 'placed-sound',
    area: 'sound',
    applies: (c) => ['maze', 'shooter', 'racing', 'platformer'].includes(c.brief.genre) || has(c, /enem|monster|ghost|explor|map/),
    title: () => 'Sounds come from where things are, quieter when far away',
    why: 'Direction and distance by ear let a player find the way, and the danger, without seeing.',
    helps: 'players who play by sound',
    guideline: 'Xbox Accessibility Guidelines: Audio accessibility (spatial audio)',
    how: (c) => builtOr(c, 'Events with spatial: true are placed in 3D on headphones and panned in mono-safe stereo; nearest() keeps only the closest few.', 'Use your engine’s 3D audio for every important thing, and a mono option.'),
  },
  {
    id: 'music-steps-aside',
    area: 'sound',
    applies: (c) => c.brief.genre === 'rhythm' || has(c, /music|song|soundtrack/),
    title: () => 'Music steps aside for every cue, and never shares its pitch',
    why: 'Music sets the mood, but a cue lost under it is a cue missed.',
    helps: 'players who play by sound, and players who hear less in some pitches',
    guideline: 'Game Accessibility Guidelines (hearing): separate volume for music, speech and effects',
    how: (c) => builtOr(c, 'Tracks duck under cues and stay below them (proofs 13 and 14); the music volume is a setting.', 'Duck the music under every cue, and keep separate volumes for music, speech and effects.'),
  },
  {
    id: 'mono',
    area: 'sound',
    applies: () => true,
    title: () => 'A mono setting',
    why: 'Players who hear with one ear, or with one earbud, miss half of a stereo mix.',
    helps: 'players who hear with one ear',
    guideline: 'Game Accessibility Guidelines (hearing): provide a stereo/mono toggle',
    how: (c) => builtOr(c, 'Sound: Mono, in the settings menu.', 'Add a mono toggle that mixes left and right.'),
  },

  // ---- words
  {
    id: 'speech',
    area: 'words',
    applies: () => true,
    title: () => 'Everything said is also written, for screen readers, and the voice can be turned off',
    why: 'Screen-reader and braille users get every line; players who use their own reader avoid hearing it twice.',
    helps: 'players who play by sound, and screen-reader and braille users',
    guideline: 'Xbox Accessibility Guidelines: Screen narration; Game Accessibility Guidelines (vision): screen reader support',
    how: (c) => builtOr(c, 'Every spoken line goes to an aria-live region; Voice is a setting.', 'Write every spoken line to the platform’s screen reader API, and offer a voice-off setting.'),
  },
  {
    id: 'captions',
    area: 'words',
    applies: () => true,
    title: (c) => (c.timed ? 'Captions for every sound, with countdown pips you can see' : 'Captions for every sound that matters'),
    why: 'If a sound tells you something, a caption must tell you the same thing.',
    helps: 'players who play by sight, and anyone playing with the sound off',
    guideline: 'Xbox Accessibility Guidelines: Subtitles and captions; Game Accessibility Guidelines (hearing): subtitles for all important sounds',
    how: (c) => builtOr(c, 'Every event reaches at least two senses (proof 8); captions wrap rather than shrink.', 'Caption every meaningful sound with what it is and where it is.'),
  },
  {
    id: 'announce',
    area: 'words',
    applies: (c) => ['shooter', 'racing', 'maze', 'story'].includes(c.brief.genre) || has(c, /enem|crowd|many|chat|inventory|shop/),
    title: () => 'Players choose how much is announced: minimal, normal or detailed',
    why: 'A busy game can say too much. Letting players choose keeps it clear for those who need less, and rich for those who want more.',
    helps: 'players who want fewer words, and players who want every detail',
    guideline: 'Game Accessibility Guidelines (cognitive): allow players to reduce distractions',
    how: (c) => (c.marrow ? { kind: 'from-plan', builds: 'announce', detail: 'Events get priorities; the announce setting drops what the player does not want (proof 18 keeps speech followable).' } : { kind: 'by-hand', detail: 'Give each announcement a priority, and let the player set a level.' }),
  },

  // ---- sight
  {
    id: 'sound-marker',
    area: 'sight',
    applies: () => true,
    title: () => 'A marker you can see for every sound',
    why: 'A player who plays by sight still needs to know a sound happened, and roughly when.',
    helps: 'players who play by sight',
    guideline: 'Xbox Accessibility Guidelines: Additional channels for visual and audio cues',
    how: (c) => builtOr(c, 'The sound marker in the caption box lights for every cue; it holds steady with reduced motion.', 'Show an on-screen indicator for each important sound, with its direction.'),
  },
  {
    id: 'contrast-text',
    area: 'sight',
    applies: () => true,
    title: () => 'High contrast, large text, and colours every eye can tell apart, never colour alone',
    why: 'Low contrast and small text lock out many players; meaning carried by colour alone locks out more.',
    helps: 'players who see less, and players who see colour differently',
    guideline: 'WCAG 2.2 AA contrast; Xbox Accessibility Guidelines: Text display, Contrast',
    how: (c) => builtOr(c, 'Contrast, Text size and Colours are settings, and proof 9 checks every theme.', 'Meet 4.5:1 for text and 3:1 for graphics; add shapes or words wherever colour carries meaning.'),
  },
  {
    id: 'motion-flash',
    area: 'sight',
    applies: () => true,
    title: () => 'Reduced motion, and nothing flashes more than three times a second',
    why: 'Motion can make players sick, and flashing can cause seizures.',
    helps: 'players sensitive to motion or light',
    guideline: 'WCAG 2.3.1 three flashes; Game Accessibility Guidelines (general): avoid flickering images',
    how: (c) => builtOr(c, 'Motion is a setting (it follows the OS); proof 7 checks flashing at every speed.', 'Cap flashes at three per second and add a reduced-motion setting.'),
  },
  {
    id: 'play-by-sound',
    area: 'sight',
    applies: () => true,
    title: () => 'The whole game can be played with the picture off',
    why: 'If it can be finished by sound alone, players who cannot see can finish it, and sighted testers can check it.',
    helps: 'players who play by sound',
    guideline: 'Game Accessibility Guidelines (vision): ensure the game is playable without sight',
    how: (c) => builtOr(c, 'Picture: Off, in the settings; the audio-only bot checks levels can be cleared by sound.', 'Test with the screen off; every needed fact must also be heard.'),
  },

  // ---- difficulty
  {
    id: 'gentle-failure',
    area: 'difficulty',
    applies: () => true,
    title: () => 'Gentle failure: say why, then try again just before',
    why: 'Losing progress is the fastest way to lose a player. Knowing why turns a mistake into learning.',
    helps: 'everyone, and players who need more tries',
    guideline: 'Game Accessibility Guidelines (cognitive): avoid punishing mistakes; give clear feedback',
    how: (c) => builtOr(c, 'Falls say why ("Pressed a little early"), wait until it is heard, and retry just before the obstacle. No lives, no game over.', 'Checkpoint often, explain failures in plain words, and never take away more than a few seconds.'),
  },
  {
    id: 'speed',
    area: 'difficulty',
    applies: (c) => c.timed || c.brief.genre === 'maze',
    title: () => 'A game speed setting, starting slow',
    why: 'Speed changes how hard it is without changing what it is.',
    helps: 'players who need more time',
    guideline: 'Game Accessibility Guidelines (motor, cognitive): allow the game speed to be changed',
    how: (c) => builtOr(c, 'Game speed is a setting; Slow is the default, and the proof checks the timing window at every speed.', 'Add a speed setting that slows the whole game, not just the player.'),
  },
  {
    id: 'coach',
    area: 'difficulty',
    applies: (c) => c.timed,
    title: () => 'A coach who says what is coming before each countdown',
    why: 'A heads-up gives time to think and get ready, without changing the cues.',
    helps: 'players who need more warning, and players new to the game',
    guideline: 'Game Accessibility Guidelines (cognitive): give advance warning of events',
    how: (c) => (c.marrow ? { kind: 'from-plan', builds: 'coach', detail: 'The coach is offered in the settings (1 to 3 seconds early); proof 17 checks it never talks over a jump.' } : { kind: 'by-hand', detail: 'Announce each challenge a few seconds before it arrives.' }),
  },
  {
    id: 'finishable',
    area: 'difficulty',
    applies: () => true,
    title: () => 'Every level is proved finishable before it is served',
    why: 'A level that cannot be finished with one switch, or by sound, excludes someone without anyone noticing.',
    helps: 'everyone',
    guideline: 'Marrow proof properties; Game Accessibility Guidelines (general): test with the players you want to include',
    how: (c) =>
      c.marrow
        ? { kind: 'built-in', detail: 'The proof runs before every level, and a failing level is refused with the reason. Bot players report how it plays.' }
        : { kind: 'by-hand', detail: `Marrow has no proof pattern for ${c.brief.genre} games yet: test every level with one switch and with the picture off, and log where players fail.` },
  },
  {
    id: 'checkpoints',
    area: 'difficulty',
    applies: (c) => c.brief.genre === 'platformer' || has(c, /long level|checkpoint|save/),
    title: () => 'Checkpoints close together, and a practice mode',
    why: 'Long stretches between saves turn one hard jump into a wall.',
    helps: 'players who need more tries',
    guideline: 'Game Accessibility Guidelines (cognitive): save progress often',
    how: () => ({ kind: 'by-hand', detail: 'Add a checkpoint before every hard section, and a practice mode that repeats it.' }),
  },

  // ---- menus
  {
    id: 'setup',
    area: 'menus',
    applies: () => true,
    title: () => 'A first-run setup that asks how you like to play',
    why: 'Good settings help only if players find them. Asking once, at the start, in ways of playing, gets them on.',
    helps: 'everyone, first of all new players',
    guideline: 'Game Accessibility Guidelines (general): offer settings before the game starts',
    how: (c) => builtOr(c, 'Just play, Play by sound, Play by sight, More time, More settings: the first time only.', 'Show a short setup before play: ways of playing, not conditions, each changing a group of settings.'),
  },
  {
    id: 'sound-guide',
    area: 'menus',
    applies: (c) => ['maze', 'rhythm', 'shooter', 'racing'].includes(c.brief.genre) || has(c, /enem|ghost|monster/),
    title: () => 'A sound guide: every important sound, and what it means, before play',
    why: 'Players who play by ear learn the sounds faster when they can hear each one on its own, named.',
    helps: 'players who play by sound',
    guideline: 'Game Accessibility Guidelines (vision): provide a sound test or glossary',
    how: () => ({ kind: 'by-hand', detail: 'A scanned menu where each entry names a sound and plays it (Séance Escape’s guide.ts is an example).' }),
  },

  // ---- story
  {
    id: 'speaker-names',
    area: 'story',
    applies: (c) => c.brief.genre === 'story' || has(c, /dialog|talk|character|story|narrat|cutscene/),
    title: () => 'Captions with speaker names, and a voice for each character',
    why: 'In speech and text, who is talking is half the meaning.',
    helps: 'players who play by sight, and players who play by sound',
    guideline: 'Xbox Accessibility Guidelines: Subtitles and captions (speaker identification)',
    how: (c) => builtOr(c, 'Put the name in the caption, and give the character a voice with voice: { pitch, rate } on the event (as Mabel has).', 'Prefix captions with the speaker, and use a distinct voice or colour plus name.'),
  },
  {
    id: 'replay-lines',
    area: 'story',
    applies: (c) => c.brief.genre === 'story' || has(c, /dialog|story|clue|hint|tutorial/),
    title: () => 'Lines can be heard again, and story waits for the player',
    why: 'A missed line is a missed clue. Text that moves on by itself leaves slow readers behind.',
    helps: 'players who read or listen slowly',
    guideline: 'Game Accessibility Guidelines (cognitive): allow text and speech to be replayed; no timed text',
    how: () => ({ kind: 'by-hand', detail: 'Keep a log of recent lines the player can scan, and advance story only on a press.' }),
  },

  // ---- features
  {
    id: 'boss-warning',
    area: 'features',
    applies: (c) => has(c, /boss/),
    title: (c) => `Every boss attack warned with ${c.palette.sounds.danger.words} and a caption, before it lands`,
    why: 'Boss fights are the peak of a game. A warning by sound and sight lets every player read the fight.',
    helps: 'players who play by sound, by sight, or need more warning',
    guideline: 'Xbox Accessibility Guidelines: Additional channels for visual and audio cues',
    how: (c) => (c.marrow ? { kind: 'by-hand', detail: `Emit an event before each attack with the palette's danger sound (${c.palette.sounds.danger.words}), a caption and a buzz; keep it a clear beat before the countdown, as Ghastly Moves' boss throw does.` } : { kind: 'by-hand', detail: 'Telegraph every attack by sound, sight and vibration, a moment before it can hit.' }),
  },
  {
    id: 'timer',
    area: 'features',
    applies: (c) => has(c, /timer|time limit|countdown clock|clock|hurry/),
    title: () => 'Timers can be slowed or switched off',
    why: 'A clock is pressure some players cannot work under. Content should not be locked behind speed.',
    helps: 'players who need more time',
    guideline: 'Game Accessibility Guidelines (cognitive): avoid time limits, or allow them to be adjusted',
    how: () => ({ kind: 'by-hand', detail: 'Read the time limit from a setting (normal, longer, off), and say the time left at set points.' }),
  },
  {
    id: 'pickups',
    area: 'features',
    applies: (c) => has(c, /coin|collect|pick ?up|gem|item|loot|treasure/),
    title: (c) => `Pickups heard where they are, as ${c.palette.sounds.reward.words}, nearest few only`,
    why: 'Collectibles reward exploring. Placing them by sound lets players who cannot see go looking too.',
    helps: 'players who play by sound',
    guideline: 'Xbox Accessibility Guidelines: Audio accessibility',
    how: (c) => builtOr(c, 'A spatial event per pickup with the reward sound; nearest(items, 3, distance) keeps it clear.', 'Give each pickup a placed sound, and only sound the nearest few.'),
  },
  {
    id: 'hints',
    area: 'features',
    applies: (c) => c.brief.genre === 'puzzle' || c.brief.genre === 'maze' || has(c, /puzzle|riddle|lost/),
    title: () => 'Hints on request, and one offered after a few tries',
    why: 'Being stuck ends more games than being hurt. A hint keeps players moving at their own pace.',
    helps: 'players who need more help, and players who play by sound',
    guideline: 'Game Accessibility Guidelines (cognitive): offer hints',
    how: (c) => builtOr(c, 'Ask for a hint is a choice at every stop, and one is given free after two catches (walk settings).', 'Add a hint button with escalating hints, and offer one after repeated failure.'),
  },
  {
    id: 'lessons',
    area: 'features',
    applies: (c) => c.brief.genre === 'quiz' || has(c, /lesson|maths|math|spelling|learn|times table|question/),
    title: () => 'Wrong answers are explained, in plain words, before the next question',
    why: 'An explanation turns a mistake into learning; waiting for it means nobody misses it.',
    helps: 'learners, and players who think at their own pace',
    guideline: 'Game Accessibility Guidelines (cognitive): explain mistakes',
    how: (c) => builtOr(c, 'A lesson in the kit (explainWrong, explainMiss); the run waits until the explanation is said.', 'Show and say why an answer was wrong, and wait for a press before going on.'),
  },
  {
    id: 'multiplayer-chat',
    area: 'features',
    applies: (c) => has(c, /chat|multiplayer|online|co-?op|voice chat/),
    title: () => 'Chat read aloud, and speech turned into text',
    why: 'Talking with others is part of the game. Every player should get to join in.',
    helps: 'players who play by sound, and players who play by sight',
    guideline: 'Xbox Accessibility Guidelines: Communication experiences',
    how: () => ({ kind: 'by-hand', detail: 'Speak incoming text chat, caption incoming voice chat, and offer quick phrases one press can send.' }),
  },
];

/** The context a brief gives every rule. */
export function contextOf(brief: Brief): Context {
  const marrow = MARROW.includes(brief.genre) && /browser|web|marrow/.test(brief.engine.toLowerCase() || 'browser');
  return { brief, palette: PALETTES[brief.theme], marrow, timed: TIMED.includes(brief.genre) || brief.genre === 'rhythm' };
}

/** Every suggestion that applies to a game, in the order of the areas. */
export function suggestionsFor(brief: Brief): Suggestion[] {
  const c = contextOf(brief);
  return AREAS.flatMap((area) =>
    RULES.filter((r) => r.area === area.id && r.applies(c)).map((r) => ({ id: r.id, area: r.area, title: r.title(c), why: r.why, helps: r.helps, guideline: r.guideline, how: r.how(c) })),
  );
}

/** Every rule id, for tests and docs. */
export const RULE_IDS: readonly string[] = RULES.map((r) => r.id);
