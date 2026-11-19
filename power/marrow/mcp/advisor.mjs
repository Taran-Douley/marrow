import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
// ../../skeleton/src/advisor/brief.ts
var GENRES = [
	"runner",
	"rhythm",
	"platformer",
	"quiz",
	"maze",
	"puzzle",
	"shooter",
	"racing",
	"card",
	"story",
	"other"
];
var THEMES = [
	"haunted",
	"space",
	"forest",
	"underwater",
	"neutral"
];
/** Words that point to a genre, so "endless runner" or "dungeon crawler" still land somewhere useful. */
var GENRE_WORDS = {
	runner: /run(ner)?|endless|dash/,
	rhythm: /rhythm|music|beat|dance/,
	platformer: /platform|jump and run|metroidvania/,
	quiz: /quiz|trivia|lesson|educat|maths?|spelling/,
	maze: /maze|escape|dungeon|explor|crawler|labyrinth/,
	puzzle: /puzzle|match|logic|sokoban/,
	shooter: /shoot|fps|bullet|arena/,
	racing: /rac(e|ing)|kart|driv/,
	card: /card|deck|board game|solitaire/,
	story: /story|narrative|visual novel|adventure|text/
};
var THEME_WORDS = {
	haunted: /haunt|ghost|spook|horror|halloween|grave|crypt|witch|vampire/,
	space: /space|sci-?fi|star|planet|robot|alien|galax/,
	forest: /forest|wood|nature|garden|jungle|meadow|fairy/,
	underwater: /under ?water|ocean|sea|reef|fish|submarine|aquatic/
};
var field = (lines, name) => {
	const re = new RegExp(`^\\s*${name}\\s*:\\s*(.*)$`, "i");
	for (const line of lines) {
		const m = re.exec(line);
		if (m) return m[1].replace(/\([^)]*\)/g, "").trim();
	}
};
var BriefError = class extends Error {
	constructor(message) {
		super(message);
		this.name = "BriefError";
	}
};
/** Read a brief. Throws BriefError, in plain words, with a line to copy, if it cannot. */
function parseBrief(text) {
	const lines = text.split(/\r?\n/);
	const name = field(lines, "Name");
	if (!name) throw new BriefError("The brief needs a name. Add a line like:  Name: My Game");
	const rawGenre = (field(lines, "Genre") ?? "").toLowerCase();
	const rawTheme = (field(lines, "Theme") ?? "").toLowerCase();
	const genre = GENRES.includes(rawGenre) ? rawGenre : Object.entries(GENRE_WORDS).find(([, re]) => re.test(rawGenre))?.[0] ?? "other";
	const theme = THEMES.includes(rawTheme) ? rawTheme : Object.entries(THEME_WORDS).find(([, re]) => re.test(rawTheme))?.[0] ?? "neutral";
	const features = [];
	let inFeatures = false;
	for (const line of lines) {
		if (/^\s*features\s*:/i.test(line)) {
			inFeatures = true;
			const inline = line.split(":").slice(1).join(":").trim();
			if (inline) features.push(...inline.split(/[,;]/).map((f) => f.trim()).filter(Boolean));
			continue;
		}
		if (inFeatures) {
			const item = /^\s*[-*]\s+(.*)$/.exec(line);
			if (item) features.push(item[1].trim());
			else if (/^\s*\w[\w ]*:/.test(line)) inFeatures = false;
		}
	}
	return {
		name,
		genre,
		...rawGenre && genre === "other" && rawGenre !== "other" ? { genreAsWritten: rawGenre } : {},
		theme,
		...rawTheme && theme === "neutral" && rawTheme !== "neutral" ? { themeAsWritten: rawTheme } : {},
		controls: field(lines, "Controls") ?? "",
		engine: field(lines, "Engine") ?? "browser",
		players: field(lines, "Players") ?? "",
		features
	};
}
/** A starter brief to copy, for a new game. */
function briefTemplate(name = "My Game") {
	return [
		"# Game brief",
		"",
		"Marrow reads this to suggest accessibility features that fit your game. Change any line; the plan follows.",
		"",
		`Name: ${name}`,
		`Genre: runner        (${GENRES.join(", ")})`,
		`Theme: haunted       (${THEMES.join(", ")})`,
		"Controls: one press",
		"Engine: browser",
		"Players: anyone",
		"Features:",
		"- obstacles to jump",
		"- a score",
		""
	].join("\n");
}
// ../../skeleton/src/advisor/palette.ts
var noise = (words, from, to, seconds, gain = .35) => ({
	words,
	hz: 0,
	wave: "sine",
	gain,
	shape: {
		noise: true,
		filterHz: from,
		filterTo: to,
		seconds
	}
});
var PALETTES = {
	haunted: {
		theme: "haunted",
		mood: "Old wood, bells and wind: a house that is not quite empty.",
		sounds: {
			cueLow: {
				words: "a low church bell",
				hz: 294,
				wave: "triangle"
			},
			cueHigh: {
				words: "a thin glass chime",
				hz: 587,
				wave: "sine"
			},
			step: noise("a creaking board", 700, 220, .1, .3),
			reward: {
				words: "a music-box ting",
				hz: 880,
				wave: "sine",
				gain: .7,
				shape: {
					hzTo: 1320,
					seconds: .5
				}
			},
			danger: {
				words: "a rising moan",
				hz: 165,
				wave: "triangle",
				gain: .55,
				shape: {
					hzTo: 220,
					filterHz: 1100,
					wobbleHz: 5,
					wobble: .07,
					seconds: 1.4
				}
			},
			tick: {
				words: "a candle tick",
				hz: 660,
				wave: "sine",
				gain: .3,
				shape: { seconds: .05 }
			},
			fall: {
				words: "a hollow thud",
				hz: 120,
				wave: "triangle",
				gain: .7,
				shape: {
					hzTo: 55,
					seconds: .4
				}
			},
			ambience: noise("wind through the rafters", 300, 900, 3, .2)
		}
	},
	space: {
		theme: "space",
		mood: "Clean electronic tones over an engine hum: a ship that talks to you.",
		sounds: {
			cueLow: {
				words: "a sonar ping",
				hz: 330,
				wave: "sine"
			},
			cueHigh: {
				words: "a bright console blip",
				hz: 660,
				wave: "square"
			},
			step: noise("a soft servo whirr", 2400, 1200, .08, .25),
			reward: {
				words: "a rising power-up chime",
				hz: 523,
				wave: "triangle",
				gain: .7,
				shape: {
					hzTo: 1047,
					seconds: .5
				}
			},
			danger: {
				words: "a falling alarm sweep",
				hz: 440,
				wave: "square",
				gain: .5,
				shape: {
					hzTo: 330,
					filterHz: 1800,
					seconds: 1
				}
			},
			tick: {
				words: "a console click",
				hz: 1200,
				wave: "square",
				gain: .2,
				shape: { seconds: .03 }
			},
			fall: {
				words: "a power-down whine",
				hz: 300,
				wave: "square",
				gain: .5,
				shape: {
					hzTo: 60,
					seconds: .5
				}
			},
			ambience: noise("the engine hum", 120, 200, 3, .2)
		}
	},
	forest: {
		theme: "forest",
		mood: "Wood, birds and leaves: warm and close.",
		sounds: {
			cueLow: {
				words: "a hollow wooden knock",
				hz: 294,
				wave: "triangle"
			},
			cueHigh: {
				words: "a bird call",
				hz: 784,
				wave: "sine",
				shape: {
					wobbleHz: 9,
					wobble: .03,
					seconds: .18
				}
			},
			step: noise("leaves underfoot", 2200, 800, .12, .28),
			reward: {
				words: "a woodwind trill",
				hz: 659,
				wave: "triangle",
				gain: .7,
				shape: {
					hzTo: 988,
					wobbleHz: 12,
					wobble: .02,
					seconds: .5
				}
			},
			danger: {
				words: "a low growl",
				hz: 110,
				wave: "square",
				gain: .45,
				shape: {
					hzTo: 90,
					filterHz: 500,
					wobbleHz: 14,
					wobble: .05,
					seconds: 1
				}
			},
			tick: {
				words: "a twig snap",
				hz: 0,
				wave: "sine",
				gain: .3,
				shape: {
					noise: true,
					filterHz: 4e3,
					filterTo: 2e3,
					seconds: .03
				}
			},
			fall: {
				words: "a soft thump on moss",
				hz: 100,
				wave: "sine",
				gain: .6,
				shape: {
					hzTo: 50,
					seconds: .35
				}
			},
			ambience: noise("leaves in the wind", 1500, 3e3, 3, .18)
		}
	},
	underwater: {
		theme: "underwater",
		mood: "Soft, round, muffled sounds: everything is far and slow.",
		sounds: {
			cueLow: {
				words: "a deep bell buoy",
				hz: 311,
				wave: "triangle"
			},
			cueHigh: {
				words: "a bubble pop",
				hz: 698,
				wave: "sine",
				shape: {
					hzTo: 900,
					seconds: .12
				}
			},
			step: noise("a slow swish of water", 600, 300, .25, .25),
			reward: {
				words: "a shimmer of light",
				hz: 1047,
				wave: "sine",
				gain: .6,
				shape: {
					hzTo: 1568,
					wobbleHz: 7,
					wobble: .02,
					seconds: .7
				}
			},
			danger: {
				words: "a low sonar warning",
				hz: 196,
				wave: "sine",
				gain: .6,
				shape: {
					hzTo: 147,
					filterHz: 700,
					seconds: 1.2
				}
			},
			tick: {
				words: "a tiny bubble",
				hz: 900,
				wave: "sine",
				gain: .25,
				shape: {
					hzTo: 1200,
					seconds: .05
				}
			},
			fall: {
				words: "a muffled bump",
				hz: 90,
				wave: "triangle",
				gain: .6,
				shape: {
					hzTo: 45,
					filterHz: 400,
					seconds: .45
				}
			},
			ambience: noise("the sea's hush", 250, 500, 3, .2)
		}
	},
	neutral: {
		theme: "neutral",
		mood: "Plain, clear tones: they fit anything and are easy to tell apart.",
		sounds: {
			cueLow: {
				words: "a low hum",
				hz: 294,
				wave: "triangle"
			},
			cueHigh: {
				words: "a high chime",
				hz: 587,
				wave: "sine"
			},
			step: noise("a soft tap", 1500, 800, .05, .25),
			reward: {
				words: "a rising chime",
				hz: 880,
				wave: "sine",
				gain: .7,
				shape: {
					hzTo: 1320,
					seconds: .4
				}
			},
			danger: {
				words: "a falling buzz",
				hz: 440,
				wave: "square",
				gain: .45,
				shape: {
					hzTo: 330,
					seconds: .8
				}
			},
			tick: {
				words: "a soft tick",
				hz: 660,
				wave: "sine",
				gain: .3,
				shape: { seconds: .05 }
			},
			fall: {
				words: "a low bonk",
				hz: 150,
				wave: "triangle",
				gain: .7,
				shape: {
					hzTo: 60,
					seconds: .35
				}
			},
			ambience: noise("a quiet wind", 350, 600, 3, .18)
		}
	}
};
// ../../skeleton/src/advisor/suggestions.ts
var AREAS = [
	{
		id: "controls",
		title: "Controls"
	},
	{
		id: "sound",
		title: "Sound"
	},
	{
		id: "words",
		title: "Speech and text"
	},
	{
		id: "sight",
		title: "Sight"
	},
	{
		id: "difficulty",
		title: "Difficulty and failure"
	},
	{
		id: "menus",
		title: "Menus and setup"
	},
	{
		id: "story",
		title: "Story and dialogue"
	},
	{
		id: "features",
		title: "Your game's own features"
	}
];
var TIMED = [
	"runner",
	"rhythm",
	"platformer",
	"shooter",
	"racing"
];
var MARROW = [
	"runner",
	"rhythm",
	"quiz",
	"maze"
];
/** A feature in the brief mentions one of these words. */
var has = (c, re) => c.brief.features.some((f) => re.test(f.toLowerCase()));
var builtOr = (c, built, byHand) => c.marrow ? {
	kind: "built-in",
	detail: built
} : {
	kind: "by-hand",
	detail: byHand
};
var RULES = [
	{
		id: "one-switch",
		area: "controls",
		applies: () => true,
		title: () => "Every action, menus included, can be done with one switch",
		why: "Some players use a single button, a head switch or a sip-and-puff switch. If one press can do everything, they can play the whole game.",
		helps: "one-switch players, and anyone playing with one hand",
		guideline: "Game Accessibility Guidelines (motor): make the game playable with a single button; Xbox Accessibility Guidelines: Input",
		esa: [
			"Playable with Buttons Only",
			"Playable with Keyboard Only",
			"Playable with Mouse Only",
			"Playable with Touch Only"
		],
		how: (c) => builtOr(c, "Any key, click, tap or gamepad button is the switch, and menus are scanned (createGame, createMenuStack).", "Offer a one-button mode: scan through actions, and let one press choose the lit one.")
	},
	{
		id: "no-holds",
		area: "controls",
		applies: () => true,
		title: () => "Nothing needs holding, two buttons at once, or fast repeated presses",
		why: "Holding and mashing are hard or painful for many players, and they shut out switch users entirely.",
		helps: "players who tire quickly, and one-switch players",
		guideline: "Game Accessibility Guidelines (motor): avoid repeated inputs and holds; Xbox Accessibility Guidelines: Input",
		esa: ["Playable without Button Holds", "Playable without Rapid Button Presses"],
		how: (c) => builtOr(c, "Proof property 10 checks it: one tap is one press, and key repeat adds none.", "Turn every hold into a toggle and every mash into one press.")
	},
	{
		id: "remap",
		area: "controls",
		applies: (c) => !c.marrow || /keyboard|controller|gamepad|buttons/.test(c.brief.controls.toLowerCase()),
		title: () => "Let players remap every control",
		why: "Players use what their bodies allow: a different key, a foot pedal, one side of a pad.",
		helps: "players with their own controllers or layouts",
		guideline: "Game Accessibility Guidelines (motor, basic): allow controls to be remapped",
		esa: ["Basic Input Remapping", "Full Input Remapping"],
		how: () => ({
			kind: "by-hand",
			detail: "Keep a table of action to input in the player profile, with a screen to change it. (Marrow roadmap: full remapping.)"
		})
	},
	{
		id: "timing-help",
		area: "controls",
		applies: (c) => c.timed,
		title: () => "Timing help: a press anywhere in the countdown counts",
		why: "Pressing on an exact beat is hard when your hands are slow to answer. Timing help keeps the choice yours and takes the stopwatch away.",
		helps: "players who need more time to press",
		guideline: "Game Accessibility Guidelines (motor): include an option to adjust the game speed or timing",
		esa: ["Difficulty Levels"],
		how: (c) => c.marrow ? {
			kind: "from-plan",
			builds: "assist",
			detail: "Timing help is offered in the menu, and turned on for new players if you choose."
		} : {
			kind: "by-hand",
			detail: "Widen or remove timing windows when the player asks, without changing the content."
		}
	},
	{
		id: "aim-help",
		area: "controls",
		applies: (c) => c.brief.genre === "shooter" || has(c, /aim|shoot|target/),
		title: () => "Aim help: lock on to the nearest target, and say where it is",
		why: "Fine aiming needs steady hands and sharp eyes. Lock-on keeps the action and drops the precision.",
		helps: "players who aim slowly, and players who play by sound",
		guideline: "Xbox Accessibility Guidelines: Input (assist options)",
		esa: ["Difficulty Levels"],
		how: () => ({
			kind: "by-hand",
			detail: "Snap aim to the nearest target on one press; place its sound in space (Marrow events with spatial: true) and say its direction."
		})
	},
	{
		id: "drive-help",
		area: "controls",
		applies: (c) => c.brief.genre === "racing",
		title: () => "Steering and speed help",
		why: "Holding a line and the throttle at once is two hard things. Help with one leaves the race.",
		helps: "players who press slowly, and one-switch players",
		guideline: "Xbox Accessibility Guidelines: Input (assist options)",
		esa: ["Difficulty Levels"],
		how: () => ({
			kind: "by-hand",
			detail: "Offer auto-accelerate and steering assist; say turns before they come, as a countdown."
		})
	},
	{
		id: "themed-cues",
		area: "sound",
		applies: (c) => c.timed || c.brief.genre === "quiz",
		title: (c) => `Countdown cues as ${c.palette.sounds.cueLow.words} and ${c.palette.sounds.cueHigh.words}`,
		why: "A cue you can hear coming lets players time a move by ear. Making the cues part of the world keeps the mood instead of breaking it.",
		helps: "players who play by sound, and everyone in a busy moment",
		guideline: "Xbox Accessibility Guidelines: Audio accessibility; Game Accessibility Guidelines (vision): use distinct sound for each important thing",
		esa: [],
		how: (c) => c.marrow ? {
			kind: "from-plan",
			builds: "palette",
			detail: `The two cue voices come from the ${c.palette.theme} palette. They differ in pitch and timbre and stay above the music (palette proof).`
		} : {
			kind: "by-hand",
			detail: "Give each kind of thing its own sound, different in pitch and timbre, and play it before it needs an answer."
		}
	},
	{
		id: "themed-world",
		area: "sound",
		applies: () => true,
		title: (c) => `World sounds that fit: ${c.palette.sounds.step.words} for steps, ${c.palette.sounds.reward.words} for a reward, ${c.palette.sounds.fall.words} for a fall`,
		why: "Every action should be heard, and heard as part of the game. Random beeps tire the ear; sounds from the world tell a story.",
		helps: "players who play by sound, and anyone who likes a game that sounds alive",
		guideline: "Game Accessibility Guidelines (vision): ensure all key actions have a sound",
		esa: [],
		how: (c) => c.marrow ? {
			kind: "from-plan",
			builds: "palette",
			detail: `The jump, landing and fall sounds come from the ${c.palette.theme} palette. ${c.palette.mood}`
		} : {
			kind: "by-hand",
			detail: `Use the ${c.palette.theme} palette's sounds and words as a guide: ${c.palette.mood}`
		}
	},
	{
		id: "placed-sound",
		area: "sound",
		applies: (c) => [
			"maze",
			"shooter",
			"racing",
			"platformer"
		].includes(c.brief.genre) || has(c, /enem|monster|ghost|explor|map/),
		title: () => "Sounds come from where things are, quieter when far away",
		why: "Direction and distance by ear let a player find the way, and the danger, without seeing.",
		helps: "players who play by sound",
		guideline: "Xbox Accessibility Guidelines: Audio accessibility (spatial audio)",
		esa: ["Stereo Sound", "Surround Sound"],
		how: (c) => builtOr(c, "Events with spatial: true are placed in 3D on headphones and panned in mono-safe stereo; nearest() keeps only the closest few.", "Use your engine’s 3D audio for every important thing, and a mono option.")
	},
	{
		id: "music-steps-aside",
		area: "sound",
		applies: (c) => c.brief.genre === "rhythm" || has(c, /music|song|soundtrack/),
		title: () => "Music steps aside for every cue, and never shares its pitch",
		why: "Music sets the mood, but a cue lost under it is a cue missed.",
		helps: "players who play by sound, and players who hear less in some pitches",
		guideline: "Game Accessibility Guidelines (hearing): separate volume for music, speech and effects",
		esa: ["Multiple Volume Controls"],
		how: (c) => builtOr(c, "Tracks duck under cues and stay below them (proofs 13 and 14); the music volume is a setting.", "Duck the music under every cue, and keep separate volumes for music, speech and effects.")
	},
	{
		id: "mono",
		area: "sound",
		applies: () => true,
		title: () => "A mono setting",
		why: "Players who hear with one ear, or with one earbud, miss half of a stereo mix.",
		helps: "players who hear with one ear",
		guideline: "Game Accessibility Guidelines (hearing): provide a stereo/mono toggle",
		esa: ["Mono Sound"],
		how: (c) => builtOr(c, "Sound: Mono, in the settings menu.", "Add a mono toggle that mixes left and right.")
	},
	{
		id: "speech",
		area: "words",
		applies: () => true,
		title: () => "Everything said is also written, for screen readers, and the voice can be turned off",
		why: "Screen-reader and braille users get every line; players who use their own reader avoid hearing it twice.",
		helps: "players who play by sound, and screen-reader and braille users",
		guideline: "Xbox Accessibility Guidelines: Screen narration; Game Accessibility Guidelines (vision): screen reader support",
		esa: ["Narrated Menus"],
		how: (c) => builtOr(c, "Every spoken line goes to an aria-live region; Voice is a setting.", "Write every spoken line to the platform’s screen reader API, and offer a voice-off setting.")
	},
	{
		id: "captions",
		area: "words",
		applies: () => true,
		title: (c) => c.timed ? "Captions for every sound, with countdown pips you can see" : "Captions for every sound that matters",
		why: "If a sound tells you something, a caption must tell you the same thing.",
		helps: "players who play by sight, and anyone playing with the sound off",
		guideline: "Xbox Accessibility Guidelines: Subtitles and captions; Game Accessibility Guidelines (hearing): subtitles for all important sounds",
		esa: ["Large & Clear Subtitles"],
		how: (c) => builtOr(c, "Every event reaches at least two senses (proof 8); captions wrap rather than shrink.", "Caption every meaningful sound with what it is and where it is.")
	},
	{
		id: "announce",
		area: "words",
		applies: (c) => [
			"shooter",
			"racing",
			"maze",
			"story"
		].includes(c.brief.genre) || has(c, /enem|crowd|many|chat|inventory|shop/),
		title: () => "Players choose how much is announced: minimal, normal or detailed",
		why: "A busy game can say too much. Letting players choose keeps it clear for those who need less, and rich for those who want more.",
		helps: "players who want fewer words, and players who want every detail",
		guideline: "Game Accessibility Guidelines (cognitive): allow players to reduce distractions",
		esa: [],
		how: (c) => c.marrow ? {
			kind: "from-plan",
			builds: "announce",
			detail: "Events get priorities; the announce setting drops what the player does not want (proof 18 keeps speech followable)."
		} : {
			kind: "by-hand",
			detail: "Give each announcement a priority, and let the player set a level."
		}
	},
	{
		id: "sound-marker",
		area: "sight",
		applies: () => true,
		title: () => "A marker you can see for every sound",
		why: "A player who plays by sight still needs to know a sound happened, and roughly when.",
		helps: "players who play by sight",
		guideline: "Xbox Accessibility Guidelines: Additional channels for visual and audio cues",
		esa: [],
		how: (c) => builtOr(c, "The sound marker in the caption box lights for every cue; it holds steady with reduced motion.", "Show an on-screen indicator for each important sound, with its direction.")
	},
	{
		id: "contrast-text",
		area: "sight",
		applies: () => true,
		title: () => "High contrast, large text, and colours every eye can tell apart, never colour alone",
		why: "Low contrast and small text lock out many players; meaning carried by colour alone locks out more.",
		helps: "players who see less, and players who see colour differently",
		guideline: "WCAG 2.2 AA contrast; Xbox Accessibility Guidelines: Text display, Contrast",
		esa: [
			"Clear Text",
			"Large Text",
			"Color Alternatives"
		],
		how: (c) => builtOr(c, "Contrast, Text size and Colours are settings, and proof 9 checks every theme.", "Meet 4.5:1 for text and 3:1 for graphics; add shapes or words wherever colour carries meaning.")
	},
	{
		id: "motion-flash",
		area: "sight",
		applies: () => true,
		title: () => "Reduced motion, and nothing flashes more than three times a second",
		why: "Motion can make players sick, and flashing can cause seizures.",
		helps: "players sensitive to motion or light",
		guideline: "WCAG 2.3.1 three flashes; Game Accessibility Guidelines (general): avoid flickering images",
		esa: ["Camera Comfort"],
		how: (c) => builtOr(c, "Motion is a setting (it follows the OS); proof 7 checks flashing at every speed.", "Cap flashes at three per second and add a reduced-motion setting.")
	},
	{
		id: "play-by-sound",
		area: "sight",
		applies: () => true,
		title: () => "The whole game can be played with the picture off",
		why: "If it can be finished by sound alone, players who cannot see can finish it, and sighted testers can check it.",
		helps: "players who play by sound",
		guideline: "Game Accessibility Guidelines (vision): ensure the game is playable without sight",
		esa: ["Narrated Menus"],
		how: (c) => builtOr(c, "Picture: Off, in the settings; the audio-only bot checks levels can be cleared by sound.", "Test with the screen off; every needed fact must also be heard.")
	},
	{
		id: "gentle-failure",
		area: "difficulty",
		applies: () => true,
		title: () => "Gentle failure: say why, then try again just before",
		why: "Losing progress is the fastest way to lose a player. Knowing why turns a mistake into learning.",
		helps: "everyone, and players who need more tries",
		guideline: "Game Accessibility Guidelines (cognitive): avoid punishing mistakes; give clear feedback",
		esa: [],
		how: (c) => builtOr(c, "Falls say why (\"Pressed a little early\"), wait until it is heard, and retry just before the obstacle. No lives, no game over.", "Checkpoint often, explain failures in plain words, and never take away more than a few seconds.")
	},
	{
		id: "speed",
		area: "difficulty",
		applies: (c) => c.timed || c.brief.genre === "maze",
		title: () => "A game speed setting, starting slow",
		why: "Speed changes how hard it is without changing what it is.",
		helps: "players who need more time",
		guideline: "Game Accessibility Guidelines (motor, cognitive): allow the game speed to be changed",
		esa: ["Difficulty Levels"],
		how: (c) => builtOr(c, "Game speed is a setting; Slow is the default, and the proof checks the timing window at every speed.", "Add a speed setting that slows the whole game, not just the player.")
	},
	{
		id: "coach",
		area: "difficulty",
		applies: (c) => c.timed,
		title: () => "A coach who says what is coming before each countdown",
		why: "A heads-up gives time to think and get ready, without changing the cues.",
		helps: "players who need more warning, and players new to the game",
		guideline: "Game Accessibility Guidelines (cognitive): give advance warning of events",
		esa: [],
		how: (c) => c.marrow ? {
			kind: "from-plan",
			builds: "coach",
			detail: "The coach is offered in the settings (1 to 3 seconds early); proof 17 checks it never talks over a jump."
		} : {
			kind: "by-hand",
			detail: "Announce each challenge a few seconds before it arrives."
		}
	},
	{
		id: "finishable",
		area: "difficulty",
		applies: () => true,
		title: () => "Every level is proved finishable before it is served",
		why: "A level that cannot be finished with one switch, or by sound, excludes someone without anyone noticing.",
		helps: "everyone",
		guideline: "Marrow proof properties; Game Accessibility Guidelines (general): test with the players you want to include",
		esa: ["Playable with Buttons Only"],
		how: (c) => c.marrow ? {
			kind: "built-in",
			detail: "The proof runs before every level, and a failing level is refused with the reason. Bot players report how it plays."
		} : {
			kind: "by-hand",
			detail: `Marrow has no proof pattern for ${c.brief.genre} games yet: test every level with one switch and with the picture off, and log where players fail.`
		}
	},
	{
		id: "checkpoints",
		area: "difficulty",
		applies: (c) => c.brief.genre === "platformer" || has(c, /long level|checkpoint|save/),
		title: () => "Checkpoints close together, and a practice mode",
		why: "Long stretches between saves turn one hard jump into a wall.",
		helps: "players who need more tries",
		guideline: "Game Accessibility Guidelines (cognitive): save progress often",
		esa: ["Save Anytime"],
		how: () => ({
			kind: "by-hand",
			detail: "Add a checkpoint before every hard section, and a practice mode that repeats it."
		})
	},
	{
		id: "setup",
		area: "menus",
		applies: () => true,
		title: () => "A first-run setup that asks how you like to play",
		why: "Good settings help only if players find them. Asking once, at the start, in ways of playing, gets them on.",
		helps: "everyone, first of all new players",
		guideline: "Game Accessibility Guidelines (general): offer settings before the game starts",
		esa: ["Narrated Menus"],
		how: (c) => builtOr(c, "Just play, Play by sound, Play by sight, More time, More settings: the first time only.", "Show a short setup before play: ways of playing, not conditions, each changing a group of settings.")
	},
	{
		id: "sound-guide",
		area: "menus",
		applies: (c) => [
			"maze",
			"rhythm",
			"shooter",
			"racing"
		].includes(c.brief.genre) || has(c, /enem|ghost|monster/),
		title: () => "A sound guide: every important sound, and what it means, before play",
		why: "Players who play by ear learn the sounds faster when they can hear each one on its own, named.",
		helps: "players who play by sound",
		guideline: "Game Accessibility Guidelines (vision): provide a sound test or glossary",
		esa: ["Narrated Menus"],
		how: () => ({
			kind: "by-hand",
			detail: "A scanned menu where each entry names a sound and plays it (Séance Escape’s guide.ts is an example)."
		})
	},
	{
		id: "speaker-names",
		area: "story",
		applies: (c) => c.brief.genre === "story" || has(c, /dialog|talk|character|story|narrat|cutscene/),
		title: () => "Captions with speaker names, and a voice for each character",
		why: "In speech and text, who is talking is half the meaning.",
		helps: "players who play by sight, and players who play by sound",
		guideline: "Xbox Accessibility Guidelines: Subtitles and captions (speaker identification)",
		esa: ["Large & Clear Subtitles"],
		how: (c) => builtOr(c, "Put the name in the caption, and give the character a voice with voice: { pitch, rate } on the event (as Mabel has).", "Prefix captions with the speaker, and use a distinct voice or colour plus name.")
	},
	{
		id: "replay-lines",
		area: "story",
		applies: (c) => c.brief.genre === "story" || has(c, /dialog|story|clue|hint|tutorial/),
		title: () => "Lines can be heard again, and story waits for the player",
		why: "A missed line is a missed clue. Text that moves on by itself leaves slow readers behind.",
		helps: "players who read or listen slowly",
		guideline: "Game Accessibility Guidelines (cognitive): allow text and speech to be replayed; no timed text",
		esa: [],
		how: () => ({
			kind: "by-hand",
			detail: "Keep a log of recent lines the player can scan, and advance story only on a press."
		})
	},
	{
		id: "boss-warning",
		area: "features",
		applies: (c) => has(c, /boss/),
		title: (c) => `Every boss attack warned with ${c.palette.sounds.danger.words} and a caption, before it lands`,
		why: "Boss fights are the peak of a game. A warning by sound and sight lets every player read the fight.",
		helps: "players who play by sound, by sight, or need more warning",
		guideline: "Xbox Accessibility Guidelines: Additional channels for visual and audio cues",
		esa: [],
		how: (c) => c.marrow ? {
			kind: "by-hand",
			detail: `Emit an event before each attack with the palette's danger sound (${c.palette.sounds.danger.words}), a caption and a buzz; keep it a clear beat before the countdown, as Ghastly Moves' boss throw does.`
		} : {
			kind: "by-hand",
			detail: "Telegraph every attack by sound, sight and vibration, a moment before it can hit."
		}
	},
	{
		id: "timer",
		area: "features",
		applies: (c) => has(c, /timer|time limit|countdown clock|clock|hurry/),
		title: () => "Timers can be slowed or switched off",
		why: "A clock is pressure some players cannot work under. Content should not be locked behind speed.",
		helps: "players who need more time",
		guideline: "Game Accessibility Guidelines (cognitive): avoid time limits, or allow them to be adjusted",
		esa: ["Difficulty Levels"],
		how: () => ({
			kind: "by-hand",
			detail: "Read the time limit from a setting (normal, longer, off), and say the time left at set points."
		})
	},
	{
		id: "pickups",
		area: "features",
		applies: (c) => has(c, /coin|collect|pick ?up|gem|item|loot|treasure/),
		title: (c) => `Pickups heard where they are, as ${c.palette.sounds.reward.words}, nearest few only`,
		why: "Collectibles reward exploring. Placing them by sound lets players who cannot see go looking too.",
		helps: "players who play by sound",
		guideline: "Xbox Accessibility Guidelines: Audio accessibility",
		esa: ["Stereo Sound"],
		how: (c) => builtOr(c, "A spatial event per pickup with the reward sound; nearest(items, 3, distance) keeps it clear.", "Give each pickup a placed sound, and only sound the nearest few.")
	},
	{
		id: "hints",
		area: "features",
		applies: (c) => c.brief.genre === "puzzle" || c.brief.genre === "maze" || has(c, /puzzle|riddle|lost/),
		title: () => "Hints on request, and one offered after a few tries",
		why: "Being stuck ends more games than being hurt. A hint keeps players moving at their own pace.",
		helps: "players who need more help, and players who play by sound",
		guideline: "Game Accessibility Guidelines (cognitive): offer hints",
		esa: ["Difficulty Levels"],
		how: (c) => builtOr(c, "Ask for a hint is a choice at every stop, and one is given free after two catches (walk settings).", "Add a hint button with escalating hints, and offer one after repeated failure.")
	},
	{
		id: "lessons",
		area: "features",
		applies: (c) => c.brief.genre === "quiz" || has(c, /lesson|maths|math|spelling|learn|times table|question/),
		title: () => "Wrong answers are explained, in plain words, before the next question",
		why: "An explanation turns a mistake into learning; waiting for it means nobody misses it.",
		helps: "learners, and players who think at their own pace",
		guideline: "Game Accessibility Guidelines (cognitive): explain mistakes",
		esa: [],
		how: (c) => builtOr(c, "A lesson in the kit (explainWrong, explainMiss); the run waits until the explanation is said.", "Show and say why an answer was wrong, and wait for a press before going on.")
	},
	{
		id: "multiplayer-chat",
		area: "features",
		applies: (c) => has(c, /chat|multiplayer|online|co-?op|voice chat/),
		title: () => "Chat read aloud, and speech turned into text",
		why: "Talking with others is part of the game. Every player should get to join in.",
		helps: "players who play by sound, and players who play by sight",
		guideline: "Xbox Accessibility Guidelines: Communication experiences",
		esa: ["Chat Speech-to-Text & Text-to-Speech"],
		how: () => ({
			kind: "by-hand",
			detail: "Speak incoming text chat, caption incoming voice chat, and offer quick phrases one press can send."
		})
	}
];
/** The context a brief gives every rule. */
function contextOf(brief) {
	const marrow = MARROW.includes(brief.genre) && /browser|web|marrow/.test(brief.engine.toLowerCase() || "browser");
	return {
		brief,
		palette: PALETTES[brief.theme],
		marrow,
		timed: TIMED.includes(brief.genre) || brief.genre === "rhythm"
	};
}
/** Every suggestion that applies to a game, in the order of the areas. */
function suggestionsFor(brief) {
	const c = contextOf(brief);
	return AREAS.flatMap((area) => RULES.filter((r) => r.area === area.id && r.applies(c)).map((r) => ({
		id: r.id,
		area: r.area,
		title: r.title(c),
		why: r.why,
		helps: r.helps,
		guideline: r.guideline,
		esa: r.esa,
		how: r.how(c)
	})));
}
RULES.map((r) => r.id);
// ../../skeleton/src/advisor/plan.ts
var MARK = {
	undecided: " ",
	accepted: "x",
	rejected: "-"
};
var HOW_WORDS = {
	"built-in": "Built into Marrow",
	"from-plan": "Marrow builds it from this plan",
	"by-hand": "Your code"
};
/** A plan for a brief. Pass the plan as it was to keep every decision and note. */
function advise(brief, previous) {
	const before = new Map((previous?.items ?? []).map((i) => [i.id, i]));
	const now = suggestionsFor(brief);
	const ids = new Set(now.map((s) => s.id));
	const items = now.map((s) => {
		const old = before.get(s.id);
		return {
			...s,
			decision: old?.decision ?? "undecided",
			note: old?.note ?? "",
			isNew: previous !== void 0 && !old,
			noLongerFits: false
		};
	});
	for (const old of previous?.items ?? []) if (!ids.has(old.id) && old.decision !== "undecided") items.push({
		...old,
		isNew: false,
		noLongerFits: true
	});
	return {
		game: brief.name,
		genre: brief.genre,
		theme: brief.theme,
		items
	};
}
/** The plan as Markdown. `[x]` accepted, `[ ]` undecided, `[-]` rejected. Anything after "Note:" is kept. */
function planMarkdown(plan) {
	const counts = {
		accepted: 0,
		rejected: 0,
		undecided: 0
	};
	for (const i of plan.items) counts[i.decision] += 1;
	const lines = [
		`# Accessibility plan: ${plan.game}`,
		"",
		`Genre: ${plan.genre}. Theme: ${plan.theme}. ${counts.accepted} accepted, ${counts.rejected} rejected, ${counts.undecided} to decide.`,
		"",
		"Mark each item `[x]` to accept, `[-]` to reject, or leave `[ ]` to decide later. Add a note after \"Note:\" on the line under an item. Then ask Kiro (the accessibility designer) to talk it through, or run `npm run advise -- build` to build what you accepted.",
		""
	];
	const byArea = (area) => plan.items.filter((i) => i.area === area);
	for (const area of AREAS) {
		const items = byArea(area.id);
		if (items.length === 0) continue;
		lines.push(`## ${area.title}`, "");
		for (const i of items) {
			const flags = [i.isNew ? "**new**" : "", i.noLongerFits ? "**no longer fits the brief**" : ""].filter(Boolean).join(" ");
			lines.push(`- [${MARK[i.decision]}] \`${i.id}\` ${i.title}${flags ? ` ${flags}` : ""}`);
			lines.push(`  - Why: ${i.why}`);
			lines.push(`  - Helps: ${i.helps}.`);
			lines.push(`  - How: ${HOW_WORDS[i.how.kind]}. ${i.how.detail}`);
			lines.push(`  - Guideline: ${i.guideline}.`);
			lines.push(`  - ESA tag: ${i.esa.length > 0 ? i.esa.join(", ") : "none (no ESA tag covers this yet)"}.`);
			lines.push(`  - Note: ${i.note}`);
		}
		lines.push("");
	}
	lines.push("---", "", "This plan helps the game work for more players. It does not make the game \"fully accessible\", and it does not replace testing with disabled players.", "");
	return lines.join("\n");
}
/**
* Read a plan back from Markdown: the decision and note of every item, by id. The rest of the item is
* made again from the brief, so the developer only ever edits the boxes and the notes.
*/
function parsePlan(markdown, brief) {
	const decisions = /* @__PURE__ */ new Map();
	let last = null;
	for (const line of markdown.split(/\r?\n/)) {
		const item = /^- \[([ xX-])\] `([a-z0-9-]+)`/.exec(line);
		if (item) {
			const mark = item[1].toLowerCase();
			last = item[2];
			decisions.set(last, {
				decision: mark === "x" ? "accepted" : mark === "-" ? "rejected" : "undecided",
				note: ""
			});
			continue;
		}
		const note = /^\s+- Note:\s?(.*)$/.exec(line);
		if (note && last) decisions.get(last).note = note[1].trim();
	}
	const known = advise(brief);
	const items = known.items.map((i) => ({
		...i,
		...decisions.get(i.id) ?? {}
	}));
	for (const [id, d] of decisions) {
		if (items.some((i) => i.id === id) || d.decision === "undecided") continue;
		const title = new RegExp(`^- \\[[ xX-]\\] \`${id}\` (.*?)(?: \\*\\*.*)?$`, "m").exec(markdown)?.[1] ?? id;
		items.push({
			id,
			area: "features",
			title,
			why: "",
			helps: "",
			guideline: "",
			esa: [],
			how: {
				kind: "by-hand",
				detail: ""
			},
			...d,
			isNew: false,
			noLongerFits: true
		});
	}
	return {
		...known,
		items
	};
}
/** The accepted items, for building. */
var accepted = (plan) => plan.items.filter((i) => i.decision === "accepted" && !i.noLongerFits);
// ../../skeleton/src/advisor/build.ts
function buildFromPlan(plan, brief) {
	const palette = PALETTES[brief.theme];
	const items = accepted(plan);
	const on = (key) => items.find((i) => i.how.kind === "from-plan" && i.how.builds === key);
	const kit = {};
	const profile = {};
	const events = {};
	const done = [];
	if (on("palette")) {
		const s = palette.sounds;
		kit.voices = [{
			label: s.cueLow.words,
			hz: s.cueLow.hz,
			wave: s.cueLow.wave
		}, {
			label: s.cueHigh.words,
			hz: s.cueHigh.hz,
			wave: s.cueHigh.wave
		}];
		const recipe = (r) => ({
			hz: r.hz,
			wave: r.wave,
			...r.gain !== void 0 ? { gain: r.gain } : {},
			...r.shape ? { shape: r.shape } : {}
		});
		kit.audio = { recipes: {
			jumped: recipe(s.step),
			landed: recipe(s.step),
			fall: recipe(s.fall)
		} };
		events["palette-reward"] = {
			caption: "Reward",
			sound: {
				...recipe(s.reward),
				role: "reward"
			},
			haptic: [
				40,
				30,
				80
			]
		};
		events["palette-danger"] = {
			caption: "Danger",
			sound: {
				...recipe(s.danger),
				role: "effect"
			},
			haptic: [
				100,
				40,
				100
			],
			priority: "critical"
		};
		events["palette-tick"] = {
			decorative: true,
			sound: {
				...recipe(s.tick),
				role: "effect"
			}
		};
		done.push(`Sounds from the ${palette.theme} palette: objects without a sound of their own count down with ${s.cueLow.words} and ${s.cueHigh.words}; jumps and landings are ${s.step.words}; a fall is ${s.fall.words}.`);
	}
	if (on("coach")) {
		kit.coach = true;
		done.push("The coach is offered in the settings (off until a player picks a lead).");
	}
	if (on("assist")) {
		done.push("Timing help is offered in the menu. Its note can ask for it on by default: write \"on by default\" in the note.");
		if (/on by default/i.test(on("assist").note)) done.push("Timing help starts on for new players.");
	}
	if (on("announce")) {
		profile.announce = /minimal/i.test(on("announce").note) ? "minimal" : "normal";
		done.push(`Announcements start at ${profile.announce}; players change it in the settings.`);
	}
	if (Object.keys(events).length > 0) kit.events = events;
	if (Object.keys(profile).length > 0) kit.defaults = { ...profile };
	return {
		kit,
		profile,
		events,
		done,
		todo: items.filter((i) => i.how.kind === "by-hand").map((i) => ({
			id: i.id,
			title: i.title,
			how: i.how.detail
		}))
	};
}
/** Whether timing help should start on, from the plan. Games with a timing-help switch read this. */
var assistByDefault = (plan) => accepted(plan).some((i) => i.id === "timing-help" && /on by default/i.test(i.note));
/** The built settings as a TypeScript module the game imports. Written by `npm run advise -- build`. */
function generatedModule(built, plan) {
	const json = (v) => JSON.stringify(v, null, 2);
	return [
		`// Made by the Marrow advisor from ${plan.game}'s accessibility plan. Do not edit: change the plan and build again.`,
		"import type { KitConfig, ProfilePatch } from '@marrow/skeleton';",
		"",
		"/** Pass to createKit or createGame: { ...ACCESSIBILITY.kit, ...yourOwnSettings }. */",
		`export const ACCESSIBILITY: { kit: KitConfig; profile: ProfilePatch; assistByDefault: boolean } = ${json({
			kit: built.kit,
			profile: built.profile,
			assistByDefault: assistByDefault(plan)
		})};`,
		"",
		"/** What was built, and what your code still has to do. */",
		`export const BUILT = ${json(built.done)};`,
		`export const TODO = ${json(built.todo)};`,
		""
	].join("\n");
}
({
	open: {
		bass: .2,
		melody: .17,
		kick: .22,
		hat: .07
	},
	ducked: {
		bass: .04,
		melody: 0,
		kick: .04,
		hat: .02
	}
}).ducked;
// src/advisor-cli.ts
var [command, target] = process.argv.slice(2);
var say = (line = "") => console.log(line);
var fail = (message) => {
	console.error(message);
	process.exit(1);
};
function readBrief(path) {
	if (!existsSync(path)) fail(`There is no brief at ${path}. Make one with:  npm run advise -- new ${path}`);
	try {
		return parseBrief(readFileSync(path, "utf8"));
	} catch (error) {
		if (error instanceof BriefError) return fail(`${path}: ${error.message}`);
		throw error;
	}
}
var planPath = (brief) => join(dirname(brief), "accessibility-plan.md");
switch (command) {
	case "new": {
		const path = resolve(target ?? "brief.md");
		if (existsSync(path)) fail(`${path} already exists. Edit it, then run:  npm run advise -- advise ${relative(process.cwd(), path)}`);
		mkdirSync(dirname(path), { recursive: true });
		writeFileSync(path, briefTemplate());
		say(`Wrote a starter brief to ${path}. Fill it in, then run:  npm run advise -- advise ${relative(process.cwd(), path)}`);
		break;
	}
	case "advise": {
		const path = resolve(target ?? "brief.md");
		const brief = readBrief(path);
		const out = planPath(path);
		const plan = advise(brief, existsSync(out) ? parsePlan(readFileSync(out, "utf8"), brief) : void 0);
		writeFileSync(out, planMarkdown(plan));
		const count = (pred) => plan.items.filter(pred).length;
		say(`${brief.name} (${brief.genre}, ${brief.theme}): ${plan.items.length} suggestions in ${relative(process.cwd(), out)}.`);
		say(`  ${count((i) => i.decision === "accepted")} accepted, ${count((i) => i.decision === "rejected")} rejected, ${count((i) => i.decision === "undecided")} to decide.`);
		if (count((i) => i.isNew) > 0) say(`  New since last time: ${plan.items.filter((i) => i.isNew).map((i) => i.id).join(", ")}.`);
		if (count((i) => i.noLongerFits) > 0) say(`  No longer fit the brief (kept, as you had decided): ${plan.items.filter((i) => i.noLongerFits).map((i) => i.id).join(", ")}.`);
		if (brief.genreAsWritten) say(`  "${brief.genreAsWritten}" is not a genre Marrow knows, so the advice is general. Known: runner, rhythm, platformer, quiz, maze, puzzle, shooter, racing, card, story.`);
		if (brief.themeAsWritten) say(`  "${brief.themeAsWritten}" has no sound palette yet, so sounds use the neutral one. Palettes: ${THEMES.join(", ")}.`);
		say("Next: tick [x] or reject [-] each item (or ask the accessibility designer in Kiro), then run  npm run advise -- build " + relative(process.cwd(), path));
		break;
	}
	case "build": {
		const path = resolve(target ?? "brief.md");
		const brief = readBrief(path);
		const planFile = planPath(path);
		if (!existsSync(planFile)) fail(`There is no plan yet. Run first:  npm run advise -- advise ${relative(process.cwd(), path)}`);
		const plan = parsePlan(readFileSync(planFile, "utf8"), brief);
		const built = buildFromPlan(plan, brief);
		const out = join(dirname(path), "src", "accessibility.generated.ts");
		mkdirSync(dirname(out), { recursive: true });
		writeFileSync(out, generatedModule(built, plan));
		say(`Built ${relative(process.cwd(), out)} from ${plan.items.filter((i) => i.decision === "accepted").length} accepted suggestions.`);
		for (const d of built.done) say(`  done: ${d}`);
		for (const t of built.todo) say(`  to do in your code: ${t.title}. ${t.how}`);
		say("Pass it to the kit:  createKit({ ...ACCESSIBILITY.kit, ...yours })  or  createGame({ title, objects, kit: ACCESSIBILITY.kit })");
		say("Then check how it plays: the proof runs on every level, and the quality report shows the bots’ results.");
		break;
	}
	case "palette": {
		const theme = target ?? "neutral";
		if (!THEMES.includes(theme)) fail(`No palette called '${target}'. Palettes: ${THEMES.join(", ")}.`);
		const p = PALETTES[theme];
		say(`${theme}: ${p.mood}`);
		for (const [role, s] of Object.entries(p.sounds)) say(`  ${role.padEnd(9)} ${s.words}`);
		break;
	}
	default:
		say("The Marrow accessibility advisor.");
		say("  npm run advise -- new <folder>/brief.md       write a starter brief");
		say("  npm run advise -- advise <folder>/brief.md    make or update the plan, keeping your decisions");
		say("  npm run advise -- build <folder>/brief.md     build what you accepted");
		say(`  npm run advise -- palette <theme>             show a theme's sounds (${THEMES.join(", ")})`);
		if (command) process.exit(1);
}
export {};
