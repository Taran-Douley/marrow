// ../../skeleton/src/registry/index.ts
var VOICE_TABLE = [
	{
		label: "low hum",
		hz: 294,
		wave: "triangle"
	},
	{
		label: "high chime",
		hz: 587,
		wave: "sine"
	},
	{
		label: "buzz",
		hz: 440,
		wave: "square"
	},
	{
		label: "bright bell",
		hz: 784,
		wave: "triangle"
	}
];
/** Vibration patterns in ms (on, off, on, ...). One per voice, so each differs by feel. */
var HAPTIC_TABLE = [
	[
		250,
		120,
		250
	],
	[
		60,
		60,
		60
	],
	[
		120,
		80,
		120,
		80,
		120
	],
	[400]
];
var RegistrationError = class extends Error {
	missing;
	constructor(message, missing = []) {
		super(message);
		this.missing = missing;
		this.name = "RegistrationError";
	}
};
var humanise = (name) => name.trim().replace(/[-_]+/g, " ").toLowerCase();
var capitalise$1 = (text) => text.charAt(0).toUpperCase() + text.slice(1);
var blank = (text) => text !== void 0 && text.trim() === "";
function validSound(s) {
	return Number.isFinite(s.hz) && s.hz > 0;
}
function toRange(width, name) {
	const range = typeof width === "number" ? [width, width] : width;
	const [lo, hi] = range;
	if (!Number.isFinite(lo) || !Number.isFinite(hi) || lo <= 0 || hi < lo) throw new RegistrationError(`Object '${name}' needs a width above zero, like 0.2 or [0.1, 0.3].`);
	return range;
}
function createRegistry(options = {}) {
	const defs = /* @__PURE__ */ new Map();
	const voices = options.voices ?? VOICE_TABLE;
	const hapticTable = options.haptics && options.haptics.length > 0 ? options.haptics : HAPTIC_TABLE;
	const pickVoice = (name) => {
		const used = [...defs.values()].map((d) => d.sound);
		const pitchFree = (v) => !used.some((u) => u.hz === v.hz);
		const timbreFree = (v) => !used.some((u) => u.wave === v.wave);
		const both = voices.findIndex((v) => pitchFree(v) && timbreFree(v));
		if (both >= 0) return {
			voice: voices[both],
			index: both,
			sharesTimbre: false
		};
		const pitchOnly = voices.findIndex(pitchFree);
		if (pitchOnly >= 0) return {
			voice: voices[pitchOnly],
			index: pitchOnly,
			sharesTimbre: true
		};
		throw new RegistrationError(`Object '${name}' has no unused voice left. Give it its own sound, like { hz: 523, wave: 'sine' }.`, ["sound"]);
	};
	return {
		define(rawName, options = {}) {
			const name = rawName.trim();
			if (name === "") throw new RegistrationError("An object needs a name.");
			if (defs.has(name)) throw new RegistrationError(`Object '${name}' is already defined.`);
			const width = options.width === void 0 ? void 0 : toRange(options.width, name);
			const missing = [];
			if (blank(options.say)) missing.push("say");
			if (blank(options.caption)) missing.push("caption");
			if (options.sound !== void 0 && !validSound(options.sound)) missing.push("sound");
			if (missing.length > 0) throw new RegistrationError(`Object '${name}' has no ${missing.map((m) => ({
				sound: "sound",
				say: "spoken name",
				caption: "caption"
			})[m]).join(" and no ")}.`, missing);
			let sound;
			let autoSound = false;
			let sharesTimbre = false;
			let haptic;
			if (options.sound !== void 0) {
				sound = {
					hz: options.sound.hz,
					wave: options.sound.wave
				};
				haptic = options.haptic ?? hapticTable[defs.size % hapticTable.length];
			} else {
				const picked = pickVoice(name);
				sound = {
					hz: picked.voice.hz,
					wave: picked.voice.wave
				};
				autoSound = true;
				sharesTimbre = picked.sharesTimbre;
				haptic = options.haptic ?? hapticTable[picked.index % hapticTable.length];
			}
			const def = {
				name,
				...width ? { width } : {},
				say: options.say?.trim() ?? humanise(name),
				caption: options.caption?.trim() ?? capitalise$1(humanise(name)),
				sound,
				haptic,
				draw: options.draw ?? null,
				autoSound,
				sharesTimbre
			};
			defs.set(name, def);
			return def;
		},
		get: (name) => defs.get(name),
		names: () => [...defs.keys()],
		kinds: () => [...defs.values()].flatMap((d) => d.width ? [{
			name: d.name,
			width: d.width
		}] : []),
		sharedTimbres() {
			const list = [...defs.values()];
			const pairs = [];
			for (let i = 0; i < list.length; i++) for (let j = i + 1; j < list.length; j++) if (list[i].sound.wave === list[j].sound.wave) pairs.push([list[i].name, list[j].name]);
			return pairs;
		}
	};
}
createRegistry();
// ../../skeleton/src/channels/events.ts
/** The event types the built-in channels understand (Requirement 3a.1). */
var EVENT_TYPES = {
	/** An obstacle is coming. data: { object: string, first: boolean } */
	approaching: "obstacle-approaching",
	/** One beat of the countdown. data: { object: string, beat: 1 | 2 | 3 | 4 }. Beat 4 is the press. */
	beat: "countdown-beat",
	/** The player cleared an obstacle. data: { object?: string } */
	cleared: "cleared",
	hurt: "hurt",
	levelComplete: "level-complete",
	/** The player pressed and took off. data: { index: number } */
	jumped: "jumped",
	/** How well a jump was timed. data: { grade: 'perfect' | 'good' | 'ok', streak, score, points, index } */
	judged: "judged",
	/** The player rightly let a distractor go by. data: { object, index, value?, streak, score, points } */
	passed: "passed",
	/** The player landed. */
	landed: "landed",
	/** The world's background, once per bar. Decorative: it carries no information. data: { bar, tension, span } */
	atmosphere: "atmosphere",
	/** A menu option is lit. data: { label: string, index: number } */
	menuOption: "menu-option",
	/** Why the player fell. data: { reason: 'early' | 'late' | 'none' } */
	fallReason: "fall-reason",
	/** A portal: from here a press does a different move. data: { move: 'jump' | 'flip' | 'switch' } */
	portal: "portal",
	/** The coach's heads-up before a countdown. data: { object, move, value?, here? } */
	coach: "coach"
};
function dataString(event, key) {
	const value = event.data?.[key];
	return typeof value === "string" ? value : void 0;
}
function dataNumber(event, key) {
	const value = event.data?.[key];
	return typeof value === "number" && Number.isFinite(value) ? value : void 0;
}
function dataBool(event, key) {
	return event.data?.[key] === true;
}
function beatOf(event) {
	const beat = dataNumber(event, "beat");
	return beat === 1 || beat === 2 || beat === 3 || beat === 4 ? beat : void 0;
}
/**
* The share of a beep's loudness each layer may use. `ducked` is used whenever a cue can sound; with
* every other bed at its own share the total stays under half a beep (6 dB). `open` is used in between.
*/
var TRACK_LEVELS = {
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
};
TRACK_LEVELS.ducked;
var NOTE = /^[0-9.-]{8}$/;
var HITS = /^[.xX]{8}$/;
/** Check a track and say, in plain words, what is wrong. Called when the kit is made. */
function validateTrack(spec) {
	const where = `Track '${spec.name}'`;
	if (!(spec.rootHz >= 60 && spec.rootHz <= 132)) throw new Error(`${where}: rootHz is ${spec.rootHz}. It must be from 60 to 132 so the music stays under the beeps.`);
	if (spec.scale.length === 0 || spec.scale.some((s) => !(s >= 0 && s <= 12))) throw new Error(`${where}: scale needs steps from 0 to 12 semitones.`);
	if (spec.slotSeconds !== void 0 && !(spec.slotSeconds >= .1 && spec.slotSeconds <= 2)) throw new Error(`${where}: slotSeconds must be from 0.1 to 2.`);
	const layers = [
		[
			"bass",
			spec.bass,
			NOTE
		],
		[
			"melody",
			spec.melody,
			NOTE
		],
		[
			"kick",
			spec.kick,
			HITS
		],
		[
			"hat",
			spec.hat,
			HITS
		]
	];
	for (const [layer, bars, shape] of layers) {
		if (bars === void 0 && layer === "hat") continue;
		if (!bars || bars.length === 0) throw new Error(`${where}: ${layer} needs at least one bar.`);
		for (const bar of bars) {
			if (!shape.test(bar)) throw new Error(shape === NOTE ? `${where}: a ${layer} bar must be 8 characters of digits, dashes and dots, not '${bar}'.` : `${where}: a ${layer} bar must be 8 characters of x, X and dots, not '${bar}'.`);
			if (shape !== NOTE) continue;
			for (const ch of bar) if (ch >= "0" && ch <= "9" && Number(ch) >= spec.scale.length) throw new Error(`${where}: ${layer} uses step ${ch}, but the scale has only ${spec.scale.length} steps.`);
		}
	}
}
/** Song energy at which each layer joins. */
var ENERGY = {
	kick: .3,
	hat: .6,
	drop: .9
};
var pick = (bars, bar) => bars[(bar % bars.length + bars.length) % bars.length];
/** How many slots a note at `slot` lasts: itself and every dash after it in the bar. */
function lengthOf(pattern, slot) {
	let n = 1;
	while (slot + n < 8 && pattern[slot + n] === "-") n++;
	return n;
}
/** The notes of a track for one stretch of time, on one steady grid, so stretches join up seamlessly. */
function trackNotes(spec, w) {
	const slot = spec.slotSeconds ?? w.slot;
	const out = [];
	const quietAt = (t, end) => w.quiet === void 0 || w.quiet.some(([a, b]) => end > a && t < b);
	const push = (at, hz, wave, gain, pan, shape) => {
		if (gain <= 0) return;
		out.push({
			channel: "sound",
			senses: ["hearing"],
			at,
			role: "music",
			hz,
			wave,
			gain,
			pan: w.mono ? 0 : pan,
			shape
		});
	};
	const hz = (step, octave) => spec.rootHz * 2 ** (spec.scale[Number(step)] / 12) * octave;
	const energy = Math.min(1, Math.max(0, w.energy ?? 1));
	const drop = w.energy !== void 0 && energy >= ENERGY.drop;
	const melodyFade = energy < ENERGY.kick ? 1 : 1 - .8 * Math.min(1, Math.max(0, w.tension));
	const offset = w.offset ?? 0;
	for (let k = Math.ceil((w.from - offset) / slot - 1e-9); offset + k * slot < w.to - 1e-9; k++) {
		const t = offset + k * slot;
		const bar = Math.floor(k / 8);
		const s = (k % 8 + 8) % 8;
		const level = (open, ducked, end) => (quietAt(t, end) ? ducked : open) * w.level;
		const bassBar = pick(spec.bass, bar);
		const b = bassBar[s];
		if (b >= "0" && b <= "9") {
			const span = lengthOf(bassBar, s) * slot * .92;
			push(t, hz(b, .5), spec.bassWave ?? "square", level(TRACK_LEVELS.open.bass, TRACK_LEVELS.ducked.bass, t + span), 0, {
				filterHz: 650,
				span
			});
		}
		if (w.tension < .75) {
			const melodyBar = pick(spec.melody, bar);
			const m = melodyBar[s];
			if (m >= "0" && m <= "9") {
				const span = lengthOf(melodyBar, s) * slot * .92;
				push(t, hz(m, 1), spec.melodyWave ?? "square", level(TRACK_LEVELS.open.melody, TRACK_LEVELS.ducked.melody, t + span) * melodyFade, s % 2 === 0 ? -.25 : .25, {
					filterHz: 1800,
					filterTo: 1200,
					span
				});
			}
		}
		const kc = pick(spec.kick, bar)[s];
		if (kc !== "." && energy >= ENERGY.kick && (w.tension > .2 || bar % 2 === 0 || drop)) {
			const strong = kc === "X" ? 1 : .75;
			const span = Math.min(.16, slot * .8);
			const quiet = quietAt(t, t + span);
			push(t, 150, "sine", level(TRACK_LEVELS.open.kick, TRACK_LEVELS.ducked.kick, t + span) * strong, 0, {
				hzTo: 48,
				span
			});
			if (!quiet) push(t, 0, "sine", TRACK_LEVELS.open.hat * w.level * strong, 0, {
				noise: true,
				filterHz: 2500,
				filterTo: 900,
				span: .02
			});
		}
		if (spec.hat && energy >= ENERGY.hat && (w.tension >= .35 || drop)) {
			const hc = pick(spec.hat, bar)[s];
			if (hc !== ".") {
				const span = .04;
				push(t, 0, "sine", level(TRACK_LEVELS.open.hat, TRACK_LEVELS.ducked.hat, t + span) * (hc === "X" ? 1 : .7), s % 2 === 0 ? .3 : -.3, {
					noise: true,
					filterHz: 7e3,
					filterTo: 9e3,
					span
				});
			}
		}
	}
	return out;
}
// ../../skeleton/src/channels/audio.ts
var DEFAULT_AUDIO = {
	ambience: true,
	music: true,
	approach: true,
	effects: true,
	keyHz: 110,
	track: null,
	trackSlot: .25,
	recipes: {}
};
var clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));
/** Semitones above the base note for each step of a streak: a major pentatonic scale, then up an octave. */
var SCALE = [
	0,
	2,
	4,
	7,
	9,
	12,
	14,
	16,
	19,
	21,
	24
];
/** An angle in degrees, folded into [-180, 180). 0 is straight ahead, positive is to the right. */
function foldAngle(angle) {
	return ((angle + 180) % 360 + 360) % 360 - 180;
}
/** Eight plain words for where something is: "ahead", "ahead right", "right", "behind right", "behind"... */
function compassWord(angle) {
	const a = foldAngle(angle);
	const abs = Math.abs(a);
	if (abs <= 22.5) return "ahead";
	if (abs >= 157.5) return "behind";
	const side = a > 0 ? "right" : "left";
	if (abs <= 67.5) return `ahead ${side}`;
	if (abs < 112.5) return side;
	return `behind ${side}`;
}
/**
* Give an event `x` (-1 left to 1 right) for a simple left-right pan, or `angle`
* (degrees, 0 ahead, 90 right, 180 behind) for a full circle, plus `distance`
* (0 close to 1 far). A sound from behind is also a little quieter and duller,
* which is how ears tell front from back.
*/
function placementOf(event) {
	const distance = clamp(dataNumber(event, "distance") ?? .5, 0, 1);
	const near = 1 - .6 * distance;
	const bright = 600 + 3400 * (1 - distance);
	const angle = dataNumber(event, "angle");
	if (angle !== void 0) {
		const rad = foldAngle(angle) * Math.PI / 180;
		const behind = (1 - Math.cos(rad)) / 2;
		return {
			pan: Math.sin(rad),
			gainScale: near * (1 - .25 * behind),
			filterHz: bright * (1 - .5 * behind),
			space: {
				x: Math.sin(rad),
				y: 0,
				z: -Math.cos(rad)
			}
		};
	}
	return {
		pan: clamp(dataNumber(event, "x") ?? 0, -1, 1),
		gainScale: near,
		filterHz: bright
	};
}
/** Words for text slots: where something is, so a deaf player reads what a blind player hears. */
function directionWords(event) {
	const words = {};
	const angle = dataNumber(event, "angle");
	const x = dataNumber(event, "x");
	const distance = dataNumber(event, "distance");
	if (angle !== void 0) words.side = compassWord(angle);
	else if (x !== void 0) words.side = x < -.25 ? "left" : x > .25 ? "right" : "ahead";
	if (distance !== void 0) words.range = distance < .34 ? "close" : distance < .67 ? "near" : "far";
	return words;
}
/**
* Shares of the cue gain. Two bars overlap at any moment, so the worst-case bed
* total is 2 x (ambience + music) + approach = 2 x (0.075 + 0.07) + 0.2 = 0.49,
* just under the 0.5 that the 6 dB rule allows. These are a first guess made
* without ears: tune the overall loudness with the web adapter's `sound.masterGain`.
*/
var BED_SHARE = {
	approach: .2,
	ambience: .075,
	musicRoot: .04,
	musicFifth: .02,
	musicOctave: .01,
	/** Wind and room tone when no cue can sound under the bar (the game said when its cues are). */
	ambienceOpen: .16
};
var BAR_OVERLAP = 1.25;
var clamp01 = (n) => Math.max(0, Math.min(1, n));
/** The sound commands for the world and the player's body. Beeps and chimes stay in the sound channel. */
function worldSound(event, profile, options, voice) {
	const cues = profile.volume.cues;
	const centre = profile.mono;
	const sound = (role, hz, wave, gain, pan, shape) => ({
		channel: "sound",
		senses: ["hearing"],
		at: event.at,
		role,
		hz,
		wave,
		gain,
		pan: centre ? 0 : pan,
		shape: centre && shape ? {
			...shape,
			panTo: void 0
		} : shape
	});
	/** Apply the developer's own recipe over a default sound. A bed can never be louder than its share. */
	const withRecipe = (key, cmd) => {
		const r = options.recipes[key];
		if (!r || cmd.channel !== "sound") return [cmd];
		const ceiling = cmd.role === "approach" ? BED_SHARE.approach * cues : cues;
		const shape = {
			...cmd.shape,
			...r.shape
		};
		return [{
			...cmd,
			hz: r.hz ?? cmd.hz,
			wave: r.wave ?? cmd.wave,
			gain: r.gain !== void 0 ? Math.min(r.gain * cues, ceiling) : cmd.gain,
			pan: centre ? 0 : cmd.pan,
			shape: centre ? {
				...shape,
				panTo: void 0
			} : shape
		}];
	};
	switch (event.type) {
		case EVENT_TYPES.approaching: {
			if (!options.approach) return [];
			const span = dataNumber(event, "span") ?? 1.2;
			return withRecipe("approach", sound("approach", voice.hz / 2, voice.wave, BED_SHARE.approach * cues, .8, {
				hzTo: voice.hz / 2 * 1.5,
				panTo: 0,
				filterHz: 300,
				filterTo: 2200,
				span
			}));
		}
		case EVENT_TYPES.jumped: return options.effects ? withRecipe("jumped", sound("effect", 0, "sine", .7 * cues, 0, {
			noise: true,
			filterHz: 500,
			filterTo: 3e3,
			seconds: .28
		})) : [];
		case EVENT_TYPES.landed: return options.effects ? withRecipe("landed", sound("effect", 95, "sine", .6 * cues, 0, {
			hzTo: 45,
			seconds: .2
		})) : [];
		case EVENT_TYPES.judged: {
			if (!options.effects) return [];
			const streak = Math.max(1, dataNumber(event, "streak") ?? 1);
			const hz = 523.25 * 2 ** (SCALE[Math.min(streak, SCALE.length) - 1] / 12);
			const grade = dataString(event, "grade");
			if (grade === "perfect") return [sound("reward", hz, "sine", .5 * cues, 0, { seconds: .18 }), sound("reward", hz * 1.5, "sine", .35 * cues, 0, { seconds: .26 })];
			if (grade === "good") return [sound("reward", hz, "sine", .45 * cues, 0, { seconds: .16 })];
			return [sound("effect", 300, "triangle", .3 * cues, 0, { seconds: .08 })];
		}
		case EVENT_TYPES.passed: return options.effects ? [sound("effect", 0, "sine", .3 * cues, 0, {
			noise: true,
			filterHz: 300,
			filterTo: 900,
			seconds: .22
		})] : [];
		case EVENT_TYPES.fallReason: return options.effects ? withRecipe("fall", sound("effect", 150, "triangle", .7 * cues, 0, {
			hzTo: 60,
			seconds: .35
		})) : [];
		case EVENT_TYPES.atmosphere: {
			const tension = clamp01(dataNumber(event, "tension") ?? .3);
			const bar = dataNumber(event, "bar") ?? 0;
			const barSpan = dataNumber(event, "span") ?? 2;
			const span = barSpan * BAR_OVERLAP;
			const rawQuiet = event.data?.quiet;
			const quiet = Array.isArray(rawQuiet) ? rawQuiet.filter((q) => Array.isArray(q) && typeof q[0] === "number" && typeof q[1] === "number") : void 0;
			const open = quiet !== void 0 && !quiet.some(([a, b]) => b > event.at && a < event.at + span);
			const level = cues * profile.volume.music;
			const out = [];
			if (options.ambience) out.push(sound("ambience", 0, "sine", (open ? BED_SHARE.ambienceOpen : BED_SHARE.ambience) * level, bar % 2 === 0 ? -.5 : .5, {
				noise: true,
				filterHz: 350 + 500 * tension,
				filterTo: 500 + 500 * tension,
				span
			}));
			if (options.music) {
				const key = options.keyHz;
				out.push(sound("music", key, "sine", BED_SHARE.musicRoot * level, 0, { span }));
				if (tension > .35) out.push(sound("music", key * 1.5, "triangle", BED_SHARE.musicFifth * level * tension, 0, { span }));
				if (tension > .7) out.push(sound("music", key * 2, "sine", BED_SHARE.musicOctave * level * tension, 0, { span }));
			}
			if (options.track && options.music) out.push(...trackNotes(options.track, {
				from: event.at,
				to: event.at + barSpan,
				tension,
				level,
				mono: centre,
				slot: options.trackSlot,
				quiet,
				offset: dataNumber(event, "pulse") ?? 0,
				...dataNumber(event, "energy") !== void 0 ? { energy: clamp01(dataNumber(event, "energy")) } : {}
			}));
			return out;
		}
		default: return [];
	}
}
/** The voice an object sounds with, for the approach tone. */
function voiceOf(event, lookup, fallback) {
	return lookup.get(dataString(event, "object") ?? "")?.sound ?? fallback;
}
// ../../skeleton/src/channels/phrases.ts
var PHRASES = {
	approaching: "{name} ahead.",
	pressNow: "Press now",
	fallEarly: "Pressed a little early.",
	fallLate: "Pressed a little late.",
	fallNone: "No press.",
	cleared: "Cleared.",
	hurt: "Hurt.",
	levelComplete: "Level complete.",
	/** A lesson's number, spoken and shown each time one approaches. */
	number: "{value}",
	/** Pressed on something that should have been let pass. */
	fallWrong: "Not that one.",
	/** The fourth beat in a lesson: it must not give away whether to press. */
	yourMove: "Your move",
	perfect: "Perfect",
	good: "Good",
	ok: "Ok",
	streak: "{streak} in a row",
	/** A portal: from here on, a press does something else. */
	portalJump: "Jump mode. Press to jump.",
	portalFlip: "Flip mode. Press to flip.",
	portalSwitch: "Gates. Yours first. Press to switch.",
	/**
	* A number gate: the number in your lane first, then the one a press switches you to. Kept short so
	* it is said in full before the fourth beat even at Fast (property 104). The caption says "Stay" and "Switch".
	*/
	gate: "{here} or {there}?",
	/** The coach's heads-up before a countdown. {move} is jump, flip, switch, decide or choose. */
	coach: "{what} coming. Get ready to {move}.",
	/** The caption for a gate, which has room to say which is which. */
	gateCaption: "Stay {here} · Switch {there}"
};
var PHRASE_KEYS = Object.keys(PHRASES);
/**
* Your own wording, or a translation. Anything you leave out keeps the default.
* A line may not be empty, because a silent gap is an accessibility bug.
*/
function createStrings(overrides = {}) {
	const merged = { ...PHRASES };
	for (const key of Object.keys(overrides)) {
		if (!(key in PHRASES)) throw new Error(`Unknown line '${key}'. Lines you can change: ${PHRASE_KEYS.join(", ")}.`);
		const text = overrides[key];
		if (text === void 0) continue;
		if (text.trim() === "") throw new Error(`The line '${key}' cannot be empty.`);
		merged[key] = text;
	}
	return merged;
}
var capitalise = (text) => text.charAt(0).toUpperCase() + text.slice(1);
/** Fill {name}-style slots, then start the sentence with a capital letter. */
function fillSlots(template, vars = {}) {
	return capitalise(template.replace(/\{(\w+)\}/g, (_match, slot) => vars[slot] ?? "").trim());
}
function phrase(key, vars = {}, strings = PHRASES) {
	return fillSlots(strings[key], vars);
}
// ../../skeleton/src/channels/index.ts
var BUILT_IN_EVENTS = new Set(Object.values(EVENT_TYPES));
var FALL_PHRASE = {
	early: "fallEarly",
	late: "fallLate",
	none: "fallNone",
	wrong: "fallWrong"
};
var fallReasonOf = (event) => {
	const reason = dataString(event, "reason");
	return reason === "early" || reason === "late" || reason === "wrong" ? reason : "none";
};
var GRADE_PHRASE = {
	perfect: "perfect",
	good: "good",
	ok: "ok"
};
var gradeOf = (event) => dataString(event, "grade") === "perfect" ? "perfect" : dataString(event, "grade") === "good" ? "good" : "ok";
/** Text slots for your own events: every string or number in the event's data. */
function slotsOf(event) {
	const slots = { ...directionWords(event) };
	for (const [key, value] of Object.entries(event.data ?? {})) if (typeof value === "string" || typeof value === "number") slots[key] = String(value);
	return slots;
}
/** The presentation of one of the developer's own events, if it is not a built-in one. */
function customOf(ctx, event) {
	return BUILT_IN_EVENTS.has(event.type) ? void 0 : ctx.events?.presentation(event.type);
}
/** Words for built-in events that are not about one object: speech and captions share them. */
function plainLine(ctx, event) {
	switch (event.type) {
		case EVENT_TYPES.fallReason: {
			const reason = phrase(FALL_PHRASE[fallReasonOf(event)], {}, ctx.strings);
			const lesson = dataString(event, "explain");
			return lesson ? `${reason} ${lesson}` : reason;
		}
		case EVENT_TYPES.cleared: return phrase("cleared", {}, ctx.strings);
		case EVENT_TYPES.hurt: return phrase("hurt", {}, ctx.strings);
		case EVENT_TYPES.levelComplete: return phrase("levelComplete", {}, ctx.strings);
		case EVENT_TYPES.menuOption: return dataString(event, "label");
		case EVENT_TYPES.coach: {
			const value = dataNumber(event, "value");
			const here = dataNumber(event, "here");
			const move = dataString(event, "move") ?? "jump";
			const name = ctx.objects.get(dataString(event, "object") ?? "")?.caption ?? dataString(event, "object") ?? "Something";
			return phrase("coach", {
				what: here !== void 0 && value !== void 0 ? `${here} or ${value}` : value !== void 0 ? String(value) : name,
				move: here !== void 0 ? "choose" : value !== void 0 ? "decide" : move
			}, ctx.strings);
		}
		case EVENT_TYPES.portal: {
			const move = dataString(event, "move");
			return phrase(move === "flip" ? "portalFlip" : move === "switch" ? "portalSwitch" : "portalJump", {}, ctx.strings);
		}
		default: return;
	}
}
/** Whether words of this priority are said and shown at the player's announce level (Requirement 25.2). */
function heard(priority, profile) {
	const p = priority ?? "important";
	if (p === "critical" || p === "important") return true;
	if (p === "information") return profile.announce !== "minimal";
	return profile.announce === "detailed";
}
/** A gate's two numbers in words: "7 or 12?" spoken, "Stay 7 · Switch 12" shown. Undefined when the event is not a gate. */
function gateWords(ctx, event, key = "gate") {
	const here = dataNumber(event, "here");
	const there = dataNumber(event, "value");
	if (here === void 0 || there === void 0) return void 0;
	return phrase(key, {
		here: String(here),
		there: String(there)
	}, ctx.strings);
}
/** Sound: the countdown beeps, one voice per object type. Beat 4 is silent: that is the press. */
function soundChannel(ctx) {
	return {
		id: "sound",
		render(event, profile) {
			const custom = customOf(ctx, event);
			if (custom?.sound) {
				const spot = custom.spatial ? placementOf(event) : void 0;
				const shape = {
					...custom.sound.shape,
					...spot ? { filterHz: spot.filterHz } : {}
				};
				return [{
					channel: "sound",
					senses: ["hearing"],
					at: event.at,
					role: custom.sound.role ?? "cue",
					hz: custom.sound.hz,
					wave: custom.sound.wave,
					gain: (custom.sound.gain ?? 1) * profile.volume.cues * (spot?.gainScale ?? 1),
					pan: profile.mono ? 0 : spot?.pan ?? 0,
					...Object.keys(shape).length > 0 ? { shape: profile.mono ? {
						...shape,
						panTo: void 0
					} : shape } : {},
					...spot?.space && !profile.mono ? { space: spot.space } : {}
				}];
			}
			if (event.type === EVENT_TYPES.menuOption) return [{
				channel: "sound",
				senses: ["hearing"],
				at: event.at,
				role: "effect",
				hz: 660,
				wave: "sine",
				gain: .35 * profile.volume.cues,
				pan: 0,
				shape: {
					hzTo: 720,
					seconds: .06
				}
			}];
			if (event.type === EVENT_TYPES.portal) {
				const move = dataString(event, "move");
				const top = move === "flip" ? 1320 : move === "switch" ? 990 : 660;
				return [{
					channel: "sound",
					senses: ["hearing"],
					at: event.at,
					role: "effect",
					hz: 220,
					wave: "triangle",
					gain: .8 * profile.volume.cues,
					pan: 0,
					shape: {
						hzTo: top,
						filterHz: 900,
						filterTo: 3e3,
						seconds: .9
					}
				}];
			}
			if (event.type === EVENT_TYPES.cleared) return [{
				channel: "sound",
				senses: ["hearing"],
				at: event.at,
				role: "reward",
				hz: 880,
				wave: "sine",
				gain: profile.volume.cues,
				pan: 0
			}];
			const voice = voiceOf(event, ctx.objects, ctx.fallback);
			if (event.type !== EVENT_TYPES.beat) return worldSound(event, profile, ctx.audio, voice);
			const beat = beatOf(event);
			if (beat === void 0 || beat === 4) return [];
			return [{
				channel: "sound",
				senses: ["hearing"],
				at: event.at,
				role: "cue",
				hz: voice.hz,
				wave: voice.wave,
				gain: profile.volume.cues,
				pan: 0
			}];
		}
	};
}
/**
* Speech: always produced. The adapter writes it to the aria-live text every
* time and speaks it aloud only when profile.voice is on (Requirements 4.1, 4.2).
*/
function speechChannel(ctx) {
	return {
		id: "speech",
		render(event, profile) {
			const speak = (text, mode, tone) => [{
				channel: "speech",
				senses: ["hearing"],
				at: event.at,
				text,
				...mode ? { mode } : {},
				...mode === "latest" ? { key: event.type } : {},
				...tone ? { tone } : {}
			}];
			const custom = customOf(ctx, event);
			if (custom) {
				if (custom.say === void 0 || !heard(custom.priority, profile)) return [];
				const mode = custom.speech ?? (custom.priority === "critical" ? "cut-in" : void 0);
				return speak(fillSlots(custom.say, slotsOf(event)), mode, custom.voice);
			}
			if (event.type === EVENT_TYPES.menuOption) {
				const label = dataString(event, "label");
				return label === void 0 ? [] : speak(label, "latest");
			}
			if (event.type === EVENT_TYPES.approaching) {
				const gate = gateWords(ctx, event);
				if (gate) return speak(gate);
				const value = dataNumber(event, "value");
				if (value !== void 0) return speak(phrase("number", { value: String(value) }, ctx.strings));
				if (!dataBool(event, "first")) return [];
				const name = ctx.objects.get(dataString(event, "object") ?? "")?.say ?? dataString(event, "object");
				return name === void 0 ? [] : speak(phrase("approaching", { name }, ctx.strings));
			}
			if (event.type === EVENT_TYPES.judged) {
				if (!heard("information", profile)) return [];
				const streak = dataNumber(event, "streak") ?? 0;
				if (streak > 0 && streak % 5 === 0) return speak(phrase("streak", { streak: String(streak) }, ctx.strings));
				return gradeOf(event) === "perfect" ? speak(phrase("perfect", {}, ctx.strings)) : [];
			}
			if (event.type === EVENT_TYPES.cleared) return [];
			const line = plainLine(ctx, event);
			return line === void 0 ? [] : speak(line);
		}
	};
}
/** Captions: the object's name, and four pips for the countdown (Requirement 5). */
function captionsChannel(ctx) {
	return {
		id: "captions",
		render(event, profile) {
			const show = (text, pip) => [pip === void 0 ? {
				channel: "captions",
				senses: ["sight"],
				at: event.at,
				text
			} : {
				channel: "captions",
				senses: ["sight"],
				at: event.at,
				text,
				pip
			}];
			const custom = customOf(ctx, event);
			if (custom) return custom.caption === void 0 || !heard(custom.priority, profile) ? [] : show(fillSlots(custom.caption, slotsOf(event)));
			const value = dataNumber(event, "value");
			if (event.type === EVENT_TYPES.beat) {
				const beat = beatOf(event);
				if (beat === void 0) return [];
				if (beat === 4) return show(phrase(value === void 0 ? "pressNow" : "yourMove", {}, ctx.strings), 4);
				const object = dataString(event, "object") ?? "";
				return show(gateWords(ctx, event, "gateCaption") ?? (value === void 0 ? ctx.objects.get(object)?.caption ?? object : String(value)), beat);
			}
			if (event.type === EVENT_TYPES.approaching) {
				const object = dataString(event, "object") ?? "";
				return show(gateWords(ctx, event, "gateCaption") ?? (value === void 0 ? ctx.objects.get(object)?.caption ?? object : String(value)));
			}
			if (event.type === EVENT_TYPES.judged) return show(phrase(GRADE_PHRASE[gradeOf(event)], {}, ctx.strings));
			const line = plainLine(ctx, event);
			return line === void 0 ? [] : show(line);
		}
	};
}
/**
* Visual sound indicator: a marker for every sound cue, so a deaf player sees
* each beep. With reduced motion it is steady, not flashing (Requirements 3a.6, 5.6).
*/
function indicatorChannel(ctx) {
	return {
		id: "indicator",
		render(event, profile) {
			const marker = () => [{
				channel: "indicator",
				senses: ["sight"],
				at: event.at,
				flash: !profile.reducedMotion
			}];
			const custom = customOf(ctx, event);
			if (custom) return custom.sound ? marker() : [];
			if (event.type === EVENT_TYPES.cleared || event.type === EVENT_TYPES.jumped || event.type === EVENT_TYPES.fallReason || event.type === EVENT_TYPES.judged || event.type === EVENT_TYPES.passed || event.type === EVENT_TYPES.portal || event.type === EVENT_TYPES.menuOption) return marker();
			if (event.type !== EVENT_TYPES.beat) return [];
			const beat = beatOf(event);
			return beat === void 0 || beat === 4 ? [] : marker();
		}
	};
}
/** Haptics: a vibration for every beep, in the object's own pattern, so touch carries the same cue. */
function hapticsChannel(ctx) {
	return {
		id: "haptics",
		render(event) {
			const buzz = (pattern) => pattern.length === 0 ? [] : [{
				channel: "haptics",
				senses: ["touch"],
				at: event.at,
				pattern: [...pattern]
			}];
			const custom = customOf(ctx, event);
			if (custom) return custom.haptic === void 0 ? [] : buzz(custom.haptic);
			if (event.type === EVENT_TYPES.jumped) return buzz([40]);
			if (event.type === EVENT_TYPES.landed) return buzz([30]);
			if (event.type === EVENT_TYPES.fallReason) return buzz([250]);
			if (event.type === EVENT_TYPES.portal) return buzz([
				40,
				40,
				40,
				40,
				120
			]);
			if (event.type === EVENT_TYPES.menuOption) return buzz([15]);
			if (event.type === EVENT_TYPES.judged) return gradeOf(event) === "perfect" ? buzz([
				30,
				30,
				30
			]) : [];
			if (event.type !== EVENT_TYPES.beat) return [];
			const beat = beatOf(event);
			if (beat === void 0) return [];
			if (beat === 4) return buzz([60]);
			return buzz(ctx.objects.get(dataString(event, "object") ?? "")?.haptic ?? []);
		}
	};
}
/**
* The channels for a game. Change anything through `options`: your own words,
* your own events, a channel swapped for yours, or a channel left out.
*/
function createChannels(objects, options = {}) {
	if (options.audio?.track) validateTrack(options.audio.track);
	const ctx = {
		objects,
		strings: options.strings ?? createStrings(),
		events: options.events,
		fallback: options.fallbackSound ?? {
			hz: VOICE_TABLE[0].hz,
			wave: VOICE_TABLE[0].wave
		},
		audio: {
			...DEFAULT_AUDIO,
			...stripUndefinedAudio(options.audio ?? {})
		}
	};
	const builtIn = [
		soundChannel(ctx),
		speechChannel(ctx),
		captionsChannel(ctx),
		indicatorChannel(ctx),
		hapticsChannel(ctx)
	];
	const omitted = new Set(options.omit ?? []);
	return builtIn.filter((channel) => !omitted.has(channel.id)).map((channel) => options.replace?.[channel.id] ?? channel);
}
function stripUndefinedAudio(options) {
	return Object.fromEntries(Object.entries(options).filter(([, v]) => v !== void 0));
}
/** Render one event through every channel the profile has turned on. */
function renderEvent(event, profile, channels) {
	return channels.filter((c) => profile.channels[c.id]).flatMap((c) => c.render(event, profile));
}
// ../../skeleton/src/events/index.ts
function checkPresentation(type, p) {
	for (const field of ["say", "caption"]) {
		const text = p[field];
		if (text !== void 0 && text.trim() === "") throw new Error(`Event '${type}' has an empty ${field}.`);
	}
	if (!(p.sound === void 0 || Number.isFinite(p.sound.hz) && (p.sound.shape?.noise ? p.sound.hz >= 0 : p.sound.hz > 0))) throw new Error(`Event '${type}' needs a sound pitch above zero.`);
}
function createEventRegistry() {
	const types = /* @__PURE__ */ new Set();
	const presentations = /* @__PURE__ */ new Map();
	return {
		define(type, presentation) {
			if (type.trim() === "") throw new Error("An event needs a name.");
			if (presentation !== void 0) {
				checkPresentation(type, presentation);
				presentations.set(type, presentation);
			}
			types.add(type);
			return (at, data) => data === void 0 ? {
				type,
				at
			} : {
				type,
				at,
				data
			};
		},
		list: () => [...types],
		has: (type) => types.has(type),
		presentation: (type) => presentations.get(type)
	};
}
/** Every whole number in range, split by the rule. Throws, in plain words, if either side is empty. */
function lessonPools(lesson) {
	const [lo, hi] = lesson.values;
	if (!Number.isInteger(lo) || !Number.isInteger(hi) || lo > hi) throw new Error(`Lesson '${lesson.title}' needs whole numbers for values, like [1, 36].`);
	const share = lesson.targetShare ?? .5;
	if (!(share >= .1 && share <= .9)) throw new Error(`Lesson '${lesson.title}' needs a targetShare between 0.1 and 0.9.`);
	const targets = [];
	const distractors = [];
	for (let v = lo; v <= hi; v++) (lesson.isTarget(v) ? targets : distractors).push(v);
	if (targets.length === 0 || distractors.length === 0) throw new Error(`Lesson '${lesson.title}' needs at least one target and one distractor between ${lo} and ${hi}.`);
	return {
		targets,
		distractors
	};
}
var DEFAULT_TIMING = {
	airtime: .85,
	beat: .4,
	halfWidth: .06,
	gap: [2.3, 3],
	firstStart: 6.5,
	obstaclesPerLevel: 12,
	landingMargin: .25,
	rates: {
		slow: .6,
		medium: .8,
		fast: 1
	},
	onBeat: true
};
/** Fill in the defaults and reject numbers that cannot work, in plain words. */
function resolveTiming(overrides = {}) {
	const timing = {
		...DEFAULT_TIMING,
		...stripUndefined$3(overrides)
	};
	const positive = (name, value) => {
		if (!Number.isFinite(value) || value <= 0) throw new Error(`Timing '${name}' must be a number above zero.`);
	};
	positive("airtime", timing.airtime);
	positive("beat", timing.beat);
	positive("halfWidth", timing.halfWidth);
	positive("firstStart", timing.firstStart);
	if (!Number.isFinite(timing.landingMargin) || timing.landingMargin < 0) throw new Error("Timing 'landingMargin' must be zero or more.");
	if (!Number.isInteger(timing.obstaclesPerLevel) || timing.obstaclesPerLevel < 1) throw new Error("Timing 'obstaclesPerLevel' must be a whole number of at least 1.");
	if (!(timing.gap[0] > 0) || timing.gap[1] < timing.gap[0]) throw new Error("Timing 'gap' must be [min, max] with min above zero and max at least min.");
	for (const speed of [
		"slow",
		"medium",
		"fast"
	]) positive(`rates.${speed}`, timing.rates[speed]);
	return timing;
}
function stripUndefined$3(obj) {
	return Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== void 0));
}
var DEFAULT_KINDS = [{
	name: "grave",
	width: [.16, .3]
}, {
	name: "fence",
	width: [.12, .24]
}];
/** An obstacle you must jump, as opposed to one you must let pass. */
var isSolid = (o) => o.solid !== false;
/** Press at t0 clears the obstacle if a <= t0 <= b. */
function takeoffWindow(o, timing = DEFAULT_TIMING) {
	return {
		a: o.start + o.width + timing.halfWidth - timing.airtime,
		b: o.start - timing.halfWidth
	};
}
/** The fourth beat: the middle of the take-off window. */
function idealPress(o, timing = DEFAULT_TIMING) {
	const { a, b } = takeoffWindow(o, timing);
	return (a + b) / 2;
}
/** The three countdown beeps, at J-3*beat, J-2*beat and J-beat. */
function cueTimes(o, timing = DEFAULT_TIMING) {
	const j = idealPress(o, timing);
	return [
		j - 3 * timing.beat,
		j - 2 * timing.beat,
		j - timing.beat
	];
}
/** Convert running seconds to real seconds at a speed. */
function toRealSeconds(running, speed, timing = DEFAULT_TIMING) {
	return running / timing.rates[speed];
}
/** Width of the take-off window in real milliseconds at a speed. */
function windowMs(o, speed, timing = DEFAULT_TIMING) {
	const { a, b } = takeoffWindow(o, timing);
	return toRealSeconds(b - a, speed, timing) * 1e3;
}
/** Small, fast, seedable PRNG. Returns floats in [0, 1). */
function mulberry32(seed) {
	let a = seed >>> 0;
	return () => {
		a = a + 1831565813 >>> 0;
		let t = a;
		t = Math.imul(t ^ t >>> 15, t | 1);
		t ^= t + Math.imul(t ^ t >>> 7, t | 61);
		return ((t ^ t >>> 14) >>> 0) / 4294967296;
	};
}
/** Same seed and options always give the same level (Requirement 7.2). */
function generateLevel(seed, options = {}) {
	const timing = resolveTiming(options.timing);
	const kinds = options.kinds ?? DEFAULT_KINDS;
	const count = options.count ?? timing.obstaclesPerLevel;
	if (kinds.length === 0) throw new Error("A level needs at least one obstacle kind.");
	const pools = options.lesson ? lessonPools(options.lesson) : void 0;
	const share = options.lesson?.targetShare ?? .5;
	const rand = mulberry32(seed);
	const obstacles = [];
	let start = timing.firstStart;
	const targetAt = [];
	if (pools) {
		const targets = count >= 4 ? Math.min(count - 2, Math.max(2, Math.round(count * share))) : Math.round(count * share);
		for (let i = 0; i < count; i++) targetAt.push(i < targets);
		for (let i = count - 1; i > 0; i--) {
			const j = Math.floor(rand() * (i + 1));
			[targetAt[i], targetAt[j]] = [targetAt[j], targetAt[i]];
		}
	}
	const half = (width) => (width - timing.airtime) / 2;
	let phase = 0;
	const onPulse = (lo, hi, width) => {
		const kMin = Math.ceil((lo + half(width) - phase) / timing.beat - 1e-9);
		const kMax = Math.floor((hi + half(width) - phase) / timing.beat + 1e-9);
		if (kMax < kMin) return lo + draw * (hi - lo);
		const k = kMin + Math.min(kMax - kMin, Math.floor(draw * (kMax - kMin + 1)));
		return phase + k * timing.beat - half(width);
	};
	let prevEnd = null;
	let draw = 0;
	for (let index = 0; index < count; index++) {
		const kind = kinds[Math.min(kinds.length - 1, Math.floor(rand() * kinds.length))];
		const width = kind.width[0] + rand() * (kind.width[1] - kind.width[0]);
		if (timing.onBeat) {
			if (prevEnd === null) phase = (start + half(width)) % timing.beat;
			else start = onPulse(prevEnd + timing.gap[0], prevEnd + timing.gap[1], width);
		}
		let numbered = {};
		if (pools) {
			const target = targetAt[index];
			const pool = target ? pools.targets : pools.distractors;
			numbered = {
				value: pool[Math.min(pool.length - 1, Math.floor(rand() * pool.length))],
				solid: target
			};
		}
		obstacles.push({
			index,
			kind: kind.name,
			start,
			width,
			...numbered
		});
		prevEnd = start + width;
		draw = rand();
		if (!timing.onBeat) start = start + width + (timing.gap[0] + draw * (timing.gap[1] - timing.gap[0]));
	}
	return {
		seed,
		obstacles
	};
}
// ../../skeleton/src/proof/timing.ts
var EPS$1 = 1e-9;
/** Floors from tech.md (property 5). Medium has no floor in the spec. A game can pass its own. */
var WINDOW_FLOOR_MS = {
	slow: 650,
	fast: 400
};
var secs$1 = (n) => n.toFixed(2);
var timingOf = (input) => resolveTiming(input.timing);
function describer(level, input) {
	const label = input.label ?? `Level ${level.seed}`;
	return {
		full: (o) => `${label}, obstacle ${o.index + 1} (${o.kind}, ${secs$1(o.width)} s wide)`,
		short: (o) => `${label}, obstacle ${o.index + 1} (${o.kind})`
	};
}
/** Build a ProofResult from a list of plain-English problems. Use it for your own properties too. */
function proofResult(id, name, problems) {
	const base = {
		id,
		name,
		failures: problems.length
	};
	return problems.length === 0 ? {
		...base,
		pass: true
	} : {
		...base,
		pass: false,
		counterexample: problems[0],
		counterexamples: problems
	};
}
/** 1. Jumpable: every obstacle has a non-empty take-off window (b >= a). */
function jumpable(level, input) {
	const tm = timingOf(input);
	const d = describer(level, input);
	const problems = [];
	for (const o of level.obstacles.filter(isSolid)) {
		const { a, b } = takeoffWindow(o, tm);
		if (b < a - EPS$1) problems.push(`${d.full(o)}: no take-off point clears it. One jump covers only ${secs$1(tm.airtime - 2 * tm.halfWidth)} s.`);
	}
	return proofResult(1, "Jumpable", problems);
}
/**
* 2. Reachable: taking off at the earliest possible moment for each obstacle,
* the player has landed before the next take-off window closes.
*/
function reachable(level, input) {
	const tm = timingOf(input);
	const d = describer(level, input);
	const problems = [];
	let lands = Number.NEGATIVE_INFINITY;
	level.obstacles.forEach((o, i) => {
		if (!isSolid(o)) return;
		const { a, b } = takeoffWindow(o, tm);
		if (b < a - EPS$1) {
			lands = a + tm.airtime;
			return;
		}
		const takeoff = Math.max(a, lands);
		if (takeoff > b + EPS$1) {
			const prev = level.obstacles[i - 1];
			problems.push(`${d.short(o)}: after the earliest possible jump over obstacle ${prev.index + 1}, the player lands at ${secs$1(lands)} s, but the take-off window closes at ${secs$1(b)} s.`);
		}
		lands = takeoff + tm.airtime;
	});
	return proofResult(2, "Reachable", problems);
}
/**
* 3. Unambiguous cues: each countdown starts after the player lands from an
* on-time jump over the previous obstacle, with a margin to spare.
*/
function unambiguousCues(level, input) {
	const tm = timingOf(input);
	const d = describer(level, input);
	const problems = [];
	for (let i = 1; i < level.obstacles.length; i++) {
		const prev = level.obstacles[i - 1];
		const o = level.obstacles[i];
		const lead = idealPress(o, tm) - 3 * tm.beat - (idealPress(prev, tm) + tm.airtime);
		if (lead < tm.landingMargin - EPS$1) {
			const when = lead < 0 ? `${secs$1(-lead)} s before the player lands from the jump over obstacle ${prev.index + 1}` : `only ${secs$1(lead)} s after the player lands from the jump over obstacle ${prev.index + 1}`;
			problems.push(`${d.short(o)}: the countdown starts ${when}. It needs at least ${secs$1(tm.landingMargin)} s.`);
		}
	}
	return proofResult(3, "Unambiguous cues", problems);
}
/** 4. Multisensory: every object type has a sound, a spoken name and a caption. */
function multisensory(level, input) {
	const label = input.label ?? `Level ${level.seed}`;
	const names = /* @__PURE__ */ new Set([...input.objects.names(), ...level.obstacles.map((o) => o.kind)]);
	const problems = [];
	for (const name of names) {
		const info = input.objects.get(name);
		if (!info) {
			problems.push(`${label}: object type '${name}' is used but not defined, so it has no sound, spoken name or caption.`);
			continue;
		}
		const missing = [];
		if (!info.sound) missing.push("sound");
		if (!info.say || info.say.trim() === "") missing.push("spoken name");
		if (!info.caption || info.caption.trim() === "") missing.push("caption");
		if (missing.length > 0) problems.push(`${label}: object type '${name}' has no ${missing.join(" and no ")}.`);
	}
	return proofResult(4, "Multisensory", problems);
}
/** 5. Window floor: at least 400 ms at Fast and 650 ms at Slow (or your own floors). */
function windowFloor(level, input) {
	const tm = timingOf(input);
	const d = describer(level, input);
	const floors = {
		...WINDOW_FLOOR_MS,
		...input.floorsMs
	};
	const problems = [];
	for (const o of level.obstacles.filter(isSolid)) for (const [speed, floor] of Object.entries(floors)) {
		if (floor === void 0) continue;
		const ms = windowMs(o, speed, tm);
		if (ms < floor - EPS$1) problems.push(`${d.full(o)}: the take-off window is only ${Math.round(Math.max(0, ms))} ms at ${cap(speed)}. The floor is ${floor} ms.`);
	}
	return proofResult(5, "Window floor", problems);
}
/** 6. Fourth beat clears: pressing exactly on the fourth beat clears every obstacle. */
function fourthBeatClears(level, input) {
	const tm = timingOf(input);
	const d = describer(level, input);
	const problems = [];
	for (const o of level.obstacles.filter(isSolid)) {
		const { a, b } = takeoffWindow(o, tm);
		const press = cueTimes(o, tm)[2] + tm.beat;
		if (press < a - EPS$1 || press > b + EPS$1) problems.push(`${d.full(o)}: pressing on the fourth beat at ${secs$1(press)} s misses the take-off window (${secs$1(a)} s to ${secs$1(b)} s).`);
	}
	return proofResult(6, "Fourth beat clears", problems);
}
var cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
var isSound = (c) => c.channel === "sound";
/** Roles that sit under the beeps. Effects and rewards are brief and never overlap a beep. */
var BED_ROLES = /* @__PURE__ */ new Set([
	"ambience",
	"music",
	"approach"
]);
/**
* Property 13, cues audible over ambience: at the moment each beep plays, its
* level must beat the sum of everything sounding under it by the margin, under
* the profile the commands were rendered for. Pass the commands for a whole
* level, rendered with the profile you want to check.
*
* Levels are static gains, which is the worst case: a bed that is fading in or
* out is quieter than its peak, so passing here means the real mix passes too.
*/
function cuesAudible(commands, marginDb = 6) {
	const sounds = commands.filter(isSound);
	const beds = sounds.filter((s) => BED_ROLES.has(s.role) && s.shape?.span !== void 0);
	const needed = 10 ** (marginDb / 20);
	const problems = [];
	for (const cue of sounds.filter((s) => s.role === "cue")) {
		if (cue.gain <= 0) continue;
		const total = beds.filter((b) => b.at <= cue.at && cue.at < b.at + b.shape.span).reduce((sum, b) => sum + b.gain, 0);
		if (total * needed > cue.gain + 1e-12) problems.push(`The beep at ${cue.at.toFixed(2)} s plays at ${cue.gain.toFixed(2)}, but the sounds under it add up to ${total.toFixed(2)}. A beep must be at least ${marginDb} dB louder than what is under it.`);
	}
	return proofResult(13, "Cues audible over ambience", problems);
}
// ../../skeleton/src/proof/senses.ts
/**
* Property 8, two senses: every event a game can emit must reach at least two of
* hearing, sight and touch, under the player's profile. Works for any game: a
* creator lists their events (with example data) and the channels they use.
*
* Decorative events (the wind and pad) carry no information and are skipped.
*/
function eventsReachTwoSenses(samples, render, decorative = [EVENT_TYPES.atmosphere]) {
	const problems = [];
	for (const event of samples) {
		if (decorative.includes(event.type)) continue;
		const senses = [...new Set(render(event).flatMap((c) => c.senses))];
		if (senses.length >= 2) continue;
		problems.push(`Event '${event.type}' reaches ${senses.length === 0 ? "no sense" : `only ${senses[0]}`}. Give it a caption, speech, a vibration or a sound so a second sense gets it.`);
	}
	return proofResult(8, "Two senses", problems);
}
// ../../skeleton/src/proof/lesson.ts
/**
* Property 101, one right answer each: in a lesson, every obstacle has a number
* in range, and it is solid exactly when the rule says it is a target. So there
* is never a trick question, and the lesson never hides a wrong answer from the
* player. A lesson also needs a few of each kind, or it is not a decision.
*/
function lessonProperty(lesson) {
	return (level, input) => {
		const label = input.label ?? `Level ${level.seed}`;
		const [lo, hi] = lesson.values;
		const problems = [];
		for (const o of level.obstacles) {
			const where = `${label}, obstacle ${o.index + 1} (${o.kind})`;
			if (o.value === void 0) {
				problems.push(`${where}: it has no number, so the player cannot decide what to do.`);
				continue;
			}
			if (o.value < lo || o.value > hi) problems.push(`${where}: the number ${o.value} is outside ${lo} to ${hi}.`);
			const target = lesson.isTarget(o.value);
			if (target !== isSolid(o)) problems.push(`${where}: ${o.value} is ${target ? "a target" : "not a target"}, but the obstacle is one to ${isSolid(o) ? "jump" : "let pass"}.`);
		}
		const jump = level.obstacles.filter(isSolid).length;
		const pass = level.obstacles.length - jump;
		if (level.obstacles.length >= 4 && (jump < 2 || pass < 2)) problems.push(`${label}: only ${jump} to jump and ${pass} to let pass. A lesson needs at least two of each.`);
		return proofResult(101, "One right answer each", problems);
	};
}
// ../../skeleton/src/run/index.ts
var DEFAULT_RUN_SETTINGS = {
	restartLead: 1,
	fallPause: 2,
	lateGrace: .6,
	lookahead: .25,
	assist: false,
	scoring: {
		perfectAt: .2,
		goodAt: .6,
		points: {
			perfect: 100,
			good: 60,
			ok: 30,
			passed: 50
		},
		streakBonus: .1,
		streakCap: 10,
		ranks: [
			.9,
			.75,
			.55
		]
	}
};
function resolveRunSettings(input = {}) {
	const { scoring, ...rest } = input;
	const base = DEFAULT_RUN_SETTINGS;
	return {
		...base,
		...stripUndefined$2(rest),
		scoring: {
			...base.scoring,
			...stripUndefined$2(scoring ?? {}),
			points: {
				...base.scoring.points,
				...stripUndefined$2(scoring?.points ?? {})
			}
		}
	};
}
/** The multiplier a streak earns: 1 at no streak, rising by `streakBonus` a step up to the cap. */
var multiplier = (streak, s) => 1 + Math.min(streak, s.streakCap) * s.streakBonus;
/** The best possible score for a level: every jump Perfect, every pass right, no fall. */
function maxScore(level, settings = DEFAULT_RUN_SETTINGS) {
	const s = settings.scoring;
	return level.obstacles.reduce((sum, o, i) => {
		const base = isSolid(o) ? s.points.perfect : s.points.passed;
		return sum + Math.round(base * multiplier(i + 1, s));
	}, 0);
}
/** S, A, B or C, by the share of the best possible score. */
function rankOf(fraction, settings = DEFAULT_RUN_SETTINGS) {
	const [s, a, b] = settings.scoring.ranks;
	return fraction >= s ? "S" : fraction >= a ? "A" : fraction >= b ? "B" : "C";
}
/**
* When the coach speaks before each countdown, for a lead in real ms at a speed (Requirement 21). A
* line never starts before the player has landed from an on-time jump over the obstacle before, plus
* the landing margin; where the asked-for lead does not fit, the longest that does is used. A line
* with less than a quarter of a second before the first beep is left out.
*/
function coachTimes(level, timing, speed, leadMs) {
	if (leadMs <= 0) return [];
	const rate = timing.rates[speed];
	const out = [];
	level.obstacles.forEach((o, i) => {
		const cue1 = cueTimes(o, timing)[0];
		const prev = level.obstacles[i - 1];
		const earliest = prev ? idealPress(prev, timing) + timing.airtime + timing.landingMargin : 0;
		const at = Math.max(cue1 - leadMs / 1e3 * rate, earliest);
		const gotMs = (cue1 - at) / rate * 1e3;
		if (gotMs >= 250) out.push({
			index: i,
			at,
			askedMs: leadMs,
			gotMs
		});
	});
	return out;
}
function createRun(options) {
	const { level, timing, speed, events } = options;
	const settings = resolveRunSettings(options.settings);
	const scoring = settings.scoring;
	const rate = timing.rates[speed];
	const picture = options.picture ?? true;
	const plans = level.obstacles.map((o) => {
		const { a, b } = takeoffWindow(o, timing);
		return {
			kind: o.kind,
			move: o.move ?? "jump",
			solid: isSolid(o),
			value: o.value,
			a,
			b,
			j: idealPress(o, timing),
			cue1: cueTimes(o, timing)[0],
			clearAt: o.start + o.width + timing.halfWidth
		};
	});
	/**
	* Index of the first event at or after a level time. Everything before a
	* restart is already behind the player, so nothing earlier is replayed.
	*/
	const firstEventFrom = (time) => {
		const at = events.findIndex((e) => e.at >= time - 1e-9);
		return at < 0 ? events.length : at;
	};
	let phase = "play";
	let t = 0;
	let lastReal = options.startReal;
	let i = 0;
	let jumpedAt = null;
	let airborneUntil = Number.NEGATIVE_INFINITY;
	let lastJumpAt = null;
	let landedSent = true;
	let recoverAt = 0;
	let cursor = 0;
	let score = 0;
	let streak = 0;
	let bestStreak = 0;
	/** With timing help: the obstacle whose move waits for its fourth beat. */
	let heldFor = -1;
	/** Real ms before which level time stands still (see `holdUntil`). */
	let heldUntil = Number.NEGATIVE_INFINITY;
	const coach = new Map(coachTimes(level, timing, speed, options.coachLeadMs ?? 0).map((c) => [c.index, c]));
	const coachSaid = /* @__PURE__ */ new Set();
	const attempt = (result, pressedAt) => {
		const plan = plans[i];
		options.onAttempt?.({
			level: level.seed,
			obstacle: i + 1,
			kind: plan.kind,
			result,
			offsetMs: pressedAt === null ? null : toRealSeconds(pressedAt - plan.j, speed, timing) * 1e3,
			windowMs: toRealSeconds(plan.b - plan.a, speed, timing) * 1e3,
			speed,
			picture
		});
	};
	/** Add points for a right decision, extend the streak, and say what was earned. */
	const earn = (base) => {
		streak += 1;
		bestStreak = Math.max(bestStreak, streak);
		const points = Math.round(base * multiplier(streak, scoring));
		score += points;
		return { points };
	};
	const grade = (pressedAt, plan) => {
		const half = (plan.b - plan.a) / 2;
		const off = half <= 0 ? 0 : Math.abs(pressedAt - plan.j) / half;
		return off <= scoring.perfectAt ? "perfect" : off <= scoring.goodAt ? "good" : "ok";
	};
	const fall = (reason, pressedAt) => {
		const plan = plans[i];
		attempt(reason, pressedAt);
		streak = 0;
		const explain = plan.value === void 0 ? void 0 : options.explain?.({
			value: plan.value,
			solid: plan.solid
		}, reason);
		options.emit({
			type: EVENT_TYPES.fallReason,
			at: t,
			data: {
				reason,
				index: i,
				...plan.value !== void 0 ? { value: plan.value } : {},
				...explain ? { explain } : {}
			}
		}, t);
		phase = "recover";
		recoverAt = lastReal + settings.fallPause * 1e3;
	};
	const restart = () => {
		const plan = plans[i];
		const previousClear = i > 0 ? plans[i - 1].clearAt + .05 : 0;
		t = Math.max(0, previousClear, plan.cue1 - settings.restartLead);
		jumpedAt = null;
		lastJumpAt = null;
		airborneUntil = Number.NEGATIVE_INFINITY;
		landedSent = true;
		cursor = firstEventFrom(t);
		heldFor = -1;
		coachSaid.delete(i);
		phase = "play";
		options.onRestart?.(t);
	};
	const step = () => {
		while (cursor < events.length && events[cursor].at <= t + settings.lookahead) {
			options.emit(events[cursor], t);
			cursor++;
		}
		if (phase === "play" && !landedSent && lastJumpAt !== null && t >= lastJumpAt + timing.airtime) {
			landedSent = true;
			options.emit({
				type: EVENT_TYPES.landed,
				at: lastJumpAt + timing.airtime
			}, t);
		}
		const line = coach.get(i);
		if (phase === "play" && line && !coachSaid.has(i) && t + settings.lookahead >= line.at) {
			coachSaid.add(i);
			const o = level.obstacles[i];
			options.emit({
				type: EVENT_TYPES.coach,
				at: Math.max(t, line.at),
				data: {
					object: o.kind,
					index: i,
					move: o.move ?? "jump",
					...o.value !== void 0 ? { value: o.value } : {},
					...o.gate ? { here: o.gate.here } : {}
				}
			}, t);
		}
		if (phase === "play" && heldFor === i && i < plans.length && jumpedAt === null && t >= plans[i].j) {
			heldFor = -1;
			takeOff(plans[i].j, "good");
		}
		while (phase === "play" && i < plans.length) {
			const plan = plans[i];
			if (!plan.solid) {
				if (t < plan.clearAt) break;
				const { points } = earn(scoring.points.passed);
				attempt("passed", null);
				options.emit({
					type: EVENT_TYPES.passed,
					at: plan.clearAt,
					data: {
						object: plan.kind,
						index: i,
						value: plan.value,
						streak,
						score,
						points
					}
				}, t);
				i++;
				continue;
			}
			if (jumpedAt !== null) {
				if (t < plan.clearAt) break;
				options.emit({
					type: EVENT_TYPES.cleared,
					at: plan.clearAt,
					data: {
						object: plan.kind,
						index: i
					}
				}, t);
				i++;
				jumpedAt = null;
				continue;
			}
			if (t >= plan.b + settings.lateGrace) fall("none", null);
			break;
		}
		if (phase === "play" && i >= plans.length) {
			options.emit({
				type: EVENT_TYPES.levelComplete,
				at: t,
				data: {
					score,
					bestStreak
				}
			}, t);
			phase = "done";
		}
	};
	const advance = (nowReal) => {
		const dtReal = Math.max(0, (nowReal - lastReal) / 1e3);
		lastReal = Math.max(lastReal, nowReal);
		if (phase === "done") return;
		if (phase === "recover") {
			if (nowReal >= recoverAt && nowReal >= heldUntil) {
				restart();
				step();
			}
			return;
		}
		if (nowReal < heldUntil) return;
		t += dtReal * rate;
		step();
	};
	/** Leave the ground (or flip, or switch lane) at level time t, graded how. */
	function takeOff(at, how) {
		const plan = plans[i];
		attempt("cleared", at);
		jumpedAt = at;
		lastJumpAt = at;
		landedSent = false;
		airborneUntil = at + timing.airtime;
		options.emit({
			type: EVENT_TYPES.jumped,
			at,
			data: {
				index: i,
				...plan.move !== "jump" ? { move: plan.move } : {}
			}
		}, t);
		const { points } = earn(scoring.points[how]);
		options.emit({
			type: EVENT_TYPES.judged,
			at,
			data: {
				grade: how,
				index: i,
				streak,
				score,
				points
			}
		}, t);
	}
	step();
	return {
		advance,
		press(nowReal) {
			advance(nowReal);
			if (phase !== "play" || i >= plans.length) return;
			if (jumpedAt !== null || t < airborneUntil) return;
			const plan = plans[i];
			if (t < plan.cue1) return;
			if (!plan.solid) return fall("wrong", t);
			if (settings.assist) {
				if (heldFor === i) return;
				if (t < plan.j) {
					heldFor = i;
					return;
				}
				if (t <= plan.b) return takeOff(t, "good");
				return fall("late", t);
			}
			if (t < plan.a) return fall("early", t);
			if (t > plan.b) return fall("late", t);
			takeOff(t, grade(t, plan));
		},
		holdUntil(real) {
			heldUntil = Math.max(heldUntil, real);
		},
		holdForWords(nowReal, ms) {
			if (phase === "done" || i >= plans.length) return;
			const plan = plans[i];
			if (phase === "recover") {
				const previousClear = i > 0 ? plans[i - 1].clearAt + .05 : 0;
				const from = Math.max(0, previousClear, plan.cue1 - settings.restartLead);
				const soon = (plan.cue1 - from) / rate * 1e3;
				heldUntil = Math.max(heldUntil, nowReal + ms - soon);
				return;
			}
			if (t >= plan.cue1) return;
			const soon = (plan.cue1 - t) / rate * 1e3;
			heldUntil = Math.max(heldUntil, nowReal + ms - soon);
		},
		snapshot: () => ({
			phase,
			t,
			obstacle: i,
			jumpedAt,
			lastJumpAt,
			score,
			streak,
			bestStreak,
			held: phase === "recover" || phase === "play" && lastReal < heldUntil
		})
	};
}
function stripUndefined$2(obj) {
	return Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== void 0));
}
// ../../skeleton/src/input/index.ts
var MODIFIER_KEYS = /* @__PURE__ */ new Set([
	"Control",
	"ControlLeft",
	"ControlRight",
	"Alt",
	"AltLeft",
	"AltRight",
	"AltGraph",
	"Meta",
	"MetaLeft",
	"MetaRight",
	"OS",
	"Shift",
	"ShiftLeft",
	"ShiftRight"
]);
/** Single letters are folded to lower case so "A" down and "a" up match. */
var keyId = (key) => key.length === 1 ? key.toLowerCase() : key;
function createInput() {
	const heldKeys = /* @__PURE__ */ new Set();
	const heldButtons = /* @__PURE__ */ new Set();
	return {
		handle(raw) {
			switch (raw.kind) {
				case "key": {
					const id = keyId(raw.key);
					if (id === "Tab") return null;
					if ((raw.ctrl === true || raw.alt === true || raw.meta === true) && !MODIFIER_KEYS.has(raw.key)) return null;
					const alreadyDown = heldKeys.has(id);
					heldKeys.add(id);
					if (raw.repeat === true || alreadyDown) return null;
					return id === "Escape" ? "escape" : "press";
				}
				case "key-up":
					heldKeys.delete(keyId(raw.key));
					return null;
				case "pointer":
				case "touch": return "press";
				case "gamepad": {
					const id = `${raw.pad}:${raw.button}`;
					if (!raw.pressed) {
						heldButtons.delete(id);
						return null;
					}
					if (heldButtons.has(id)) return null;
					heldButtons.add(id);
					return "press";
				}
				case "gamepad-disconnected":
					for (const id of [...heldButtons]) if (id.startsWith(`${raw.pad}:`)) heldButtons.delete(id);
					return null;
				case "blur":
					heldKeys.clear();
					heldButtons.clear();
					return null;
			}
		},
		reset() {
			heldKeys.clear();
			heldButtons.clear();
		}
	};
}
// ../../skeleton/src/theme/index.ts
var THEMES$1 = {
	default: {
		background: "#14101f",
		panel: "#241c36",
		text: "#f4efe6",
		mutedText: "#c9c0d8",
		amber: "#f2b134",
		green: "#4cd964",
		line: "#9d94b5",
		focus: "#ffd84d"
	},
	"high-contrast": {
		background: "#000000",
		panel: "#000000",
		text: "#ffffff",
		mutedText: "#ffffff",
		amber: "#ffd000",
		green: "#00ff6a",
		line: "#ffffff",
		focus: "#ffff00"
	}
};
/** Colour-blind-safe pip colours (Okabe-Ito orange and sky blue). Shapes and numbers still carry the meaning. */
var COLOURBLIND_PIPS = {
	amber: "#e69f00",
	green: "#56b4e9"
};
function themeFor(theme, palette) {
	const base = THEMES$1[theme];
	return palette === "colourblind" ? {
		...base,
		...COLOURBLIND_PIPS
	} : base;
}
function channel(value) {
	const s = value / 255;
	return s <= .03928 ? s / 12.92 : ((s + .055) / 1.055) ** 2.4;
}
/** Relative luminance of a #rrggbb colour (WCAG). */
function luminance(hex) {
	const match = /^#([0-9a-f]{6})$/i.exec(hex);
	if (!match) throw new Error(`'${hex}' is not a #rrggbb colour.`);
	const n = parseInt(match[1], 16);
	return .2126 * channel(n >> 16 & 255) + .7152 * channel(n >> 8 & 255) + .0722 * channel(n & 255);
}
/** WCAG contrast ratio between two #rrggbb colours: 1 (none) to 21 (black on white). */
function contrastRatio(a, b) {
	const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
	return (hi + .05) / (lo + .05);
}
/**
* Property 7, no unsafe flashing: in any one second of real time, no more than three flashes. Pass
* the commands a level renders, and the speed rate (running seconds per real second). With reduced
* motion there must be no flashes at all.
*/
function noUnsafeFlashing(commands, rate, reducedMotion = false, label = "Level") {
	const flashes = commands.filter((c) => c.channel === "indicator" && c.flash).map((c) => c.at / rate).sort((a, b) => a - b).filter((t, i, all) => i === 0 || t - all[i - 1] > .05);
	const problems = [];
	if (reducedMotion && flashes.length > 0) problems.push(`${label}: motion is reduced, but the sound marker still flashes ${flashes.length} times. It should hold steady instead.`);
	for (let i = 0, j = 0; i < flashes.length; i++) {
		while (flashes[i] - flashes[j] >= 1) j++;
		const inSecond = i - j + 1;
		if (inSecond > 3) {
			problems.push(`${label}: ${inSecond} flashes within one second, from ${flashes[j].toFixed(2)} s. The limit is 3.`);
			j = i;
		}
	}
	return proofResult(7, "No unsafe flashing", problems);
}
var TEXT = 4.5;
var GRAPHIC = 3;
/**
* Property 9, contrast: in every theme and palette, text meets 4.5:1 on the background and panels,
* and the pips, outlines and focus ring meet 3:1 (WCAG 2.2 AA). Pass your own tokens to check a restyle.
*/
function themesHaveContrast(extra = {}) {
	const problems = [];
	const check = (name, t) => {
		const pairs = [
			[
				"text",
				"background",
				TEXT
			],
			[
				"text",
				"panel",
				TEXT
			],
			[
				"mutedText",
				"panel",
				TEXT
			],
			[
				"mutedText",
				"background",
				TEXT
			],
			[
				"amber",
				"panel",
				GRAPHIC
			],
			[
				"green",
				"panel",
				GRAPHIC
			],
			[
				"line",
				"panel",
				GRAPHIC
			],
			[
				"line",
				"background",
				GRAPHIC
			],
			[
				"focus",
				"background",
				GRAPHIC
			]
		];
		for (const [fg, bg, need] of pairs) {
			const ratio = contrastRatio(t[fg], t[bg]);
			if (ratio < need) problems.push(`${name}: ${fg} (${t[fg]}) on ${bg} (${t[bg]}) is ${ratio.toFixed(2)}:1. It needs ${need}:1.`);
		}
	};
	for (const theme of Object.keys(THEMES$1)) for (const palette of ["default", "colourblind"]) check(`Theme '${theme}', palette '${palette}'`, themeFor(theme, palette));
	for (const [name, tokens] of Object.entries(extra)) check(`Your theme '${name}'`, {
		...THEMES$1.default,
		...tokens
	});
	return proofResult(9, "Contrast", problems);
}
/**
* Property 10, no hold or chord: one tap of any key, a click, a touch or one gamepad button is a whole
* press, at once. Nothing needs holding, two at once, or pressing twice; key repeat never adds presses.
*/
function noHoldOrChord() {
	const problems = [];
	const once = (name, inputs, want) => {
		const machine = createInput();
		const presses = inputs.map((i) => machine.handle(i)).filter((e) => e === "press").length;
		if (presses !== want) problems.push(`${name}: gave ${presses} presses, but should give ${want}.`);
	};
	once("A tap of the space bar", [{
		kind: "key",
		key: " "
	}], 1);
	once("A tap of a letter", [{
		kind: "key",
		key: "a"
	}], 1);
	once("A click", [{ kind: "pointer" }], 1);
	once("A touch", [{ kind: "touch" }], 1);
	once("One gamepad button", [{
		kind: "gamepad",
		pad: 0,
		button: 0,
		pressed: true
	}], 1);
	once("A key held down (key repeat)", [
		{
			kind: "key",
			key: " "
		},
		{
			kind: "key",
			key: " ",
			repeat: true
		},
		{
			kind: "key",
			key: " ",
			repeat: true
		}
	], 1);
	once("Tab, for the browser", [{
		kind: "key",
		key: "Tab"
	}], 0);
	return proofResult(10, "No hold or chord", problems);
}
/** A line template ("{value} or {there}?") as a pattern a spoken line can be checked against. */
var templatePattern = (template) => new RegExp(`^${template.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/\\\{\w+\\\}/g, ".*")}$`, "i");
/**
* Property 11, every line can be recorded: everything the game says is in its line script (the strings
* table), so a voice actor or a voice service can record all of it. Pass the lines spoken while playing
* and the script.
*/
function linesInScript(spoken, script, label = "Game") {
	const patterns = script.map((l) => templatePattern(l.text));
	return proofResult(11, "Every line can be recorded", [...new Set(spoken)].filter((line) => !patterns.some((p) => p.test(line))).map((line) => `${label}: "${line}" is spoken but is not in the line script, so it cannot be recorded or translated.`));
}
// ../../skeleton/src/scanning/index.ts
/** A fair guess at how long a line takes to say, in ms. */
var speechMs = (label) => 400 + 65 * label.length;
// ../../skeleton/src/song/index.ts
var BEATS_PER_BAR = 4;
var DEFAULT_ENERGY = {
	rest: .15,
	calm: .5,
	busy: 1
};
/** Running seconds in one bar of a song, at a timing. */
var barSeconds = (timing) => BEATS_PER_BAR * timing.beat;
/** Refuse a song that cannot work, in plain words. */
function validateSong(song, kinds, lesson, options = {}) {
	if (song.sections.length === 0) throw new Error(`Song '${song.name}' needs at least one part.`);
	const names = new Set(kinds.map((k) => k.name));
	song.sections.forEach((s, i) => {
		const where = `Song '${song.name}', part ${i + 1} (${s.name})`;
		if (!Number.isInteger(s.bars) || s.bars < 1) throw new Error(`${where}: bars must be a whole number of at least 1.`);
		if (s.energy !== void 0 && !(s.energy >= 0 && s.energy <= 1)) throw new Error(`${where}: energy must be from 0 to 1.`);
		for (const k of s.kinds ?? []) if (!options.kindsLater && !names.has(k)) throw new Error(`${where}: there is no obstacle called '${k}'.`);
		if (s.kinds && s.kinds.length === 0) throw new Error(`${where}: kinds is empty, so nothing could appear.`);
	});
	if (song.sections.some((s) => s.move === "switch" && s.feel !== "rest") && !lesson) throw new Error(`Song '${song.name}' has number gates, which need a lesson for their numbers.`);
	const claimed = new Set(song.sections.flatMap((s) => s.kinds ?? []));
	const free = kinds.filter((k) => !claimed.has(k.name));
	const needsFree = song.sections.some((s) => s.feel !== "rest" && !s.kinds);
	if (!options.kindsLater && needsFree && free.length === 0) throw new Error(`Song '${song.name}': every obstacle kind belongs to a part, so the other parts have nothing to use.`);
}
/** Same seed and song always give the same level. */
function generateSong(seed, song, options) {
	const timing = resolveTiming(options.timing);
	const { kinds, lesson } = options;
	validateSong(song, kinds, lesson);
	const rand = mulberry32(seed);
	const beat = timing.beat;
	const bar = barSeconds(timing);
	const claimed = new Set(song.sections.flatMap((s) => s.kinds ?? []));
	const free = kinds.filter((k) => !claimed.has(k.name));
	/** The press sits this far after an obstacle's start. */
	const half = (width) => (width - timing.airtime) / 2;
	const sections = [];
	const portals = [];
	const placed = [];
	let move = "jump";
	let t = 0;
	let prevEnd = null;
	let prevPress = null;
	for (const part of song.sections) {
		const from = t;
		const to = t + part.bars * bar;
		t = to;
		const here = part.move ?? move;
		sections.push({
			name: part.name,
			from,
			to,
			feel: part.feel,
			energy: part.energy ?? DEFAULT_ENERGY[part.feel],
			move: here
		});
		let lead = 0;
		if (here !== move) {
			portals.push({
				at: from,
				move: here
			});
			lead = 2 * bar;
			move = here;
		}
		if (part.feel === "rest") continue;
		const pool = part.kinds ? kinds.filter((k) => part.kinds.includes(k.name)) : free;
		for (;;) {
			const kind = pool[Math.min(pool.length - 1, Math.floor(rand() * pool.length))];
			const width = kind.width[0] + rand() * (kind.width[1] - kind.width[0]);
			let lo = from + lead + 3 * beat - half(width);
			if (prevEnd !== null) lo = Math.max(lo, prevEnd + timing.gap[0]);
			if (prevPress !== null) lo = Math.max(lo, prevPress + timing.airtime + timing.landingMargin + 3 * beat - half(width));
			const slack = part.feel === "calm" ? bar / 2 : 0;
			const fromPrev = prevEnd === null ? -Infinity : prevEnd + timing.gap[1] + slack;
			const hi = Math.max(lo, fromPrev >= lo ? fromPrev : lo + (timing.gap[1] - timing.gap[0]) + slack);
			const draw = rand();
			const lean = part.feel === "busy" ? draw * .35 : .6 + draw * .4;
			const kMin = Math.ceil((lo + half(width)) / beat - 1e-9);
			const kMax = Math.floor((hi + half(width)) / beat + 1e-9);
			const start = kMax >= kMin ? (kMin + Math.min(kMax - kMin, Math.floor(lean * (kMax - kMin + 1)))) * beat - half(width) : lo + lean * (hi - lo);
			if (start + width + timing.halfWidth > to + 1e-9) break;
			placed.push({
				kind: kind.name,
				start,
				width,
				move: here
			});
			prevEnd = start + width;
			prevPress = start + half(width);
		}
	}
	const obstacles = placed.map((o, index) => ({
		...o,
		index
	}));
	if (lesson) {
		const pools = lessonPools(lesson);
		const share = lesson.targetShare ?? .5;
		const count = obstacles.length;
		const targets = count >= 4 ? Math.min(count - 2, Math.max(2, Math.round(count * share))) : Math.round(count * share);
		const targetAt = obstacles.map((_, i) => i < targets);
		for (let i = count - 1; i > 0; i--) {
			const j = Math.floor(rand() * (i + 1));
			[targetAt[i], targetAt[j]] = [targetAt[j], targetAt[i]];
		}
		const from = (pool) => pool[Math.min(pool.length - 1, Math.floor(rand() * pool.length))];
		obstacles.forEach((o, i) => {
			const target = targetAt[i];
			o.value = from(target ? pools.targets : pools.distractors);
			o.solid = target;
			if (o.move === "switch") o.gate = { here: from(target ? pools.distractors : pools.targets) };
		});
	}
	return {
		seed,
		obstacles,
		sections,
		portals
	};
}
/** The part of the song playing at a level time, if the level has a song. */
function sectionAt(level, at) {
	return level.sections?.find((s) => at >= s.from && at < s.to);
}
/** The move a press makes at a level time. */
function moveAt(level, at) {
	let move = "jump";
	for (const p of level.portals ?? []) if (p.at <= at + 1e-9) move = p.move;
	return move;
}
// ../../skeleton/src/proof/song.ts
var EPS = 1e-9;
var secs = (n) => n.toFixed(2);
var MOVE_WORDS = {
	jump: "jump",
	flip: "flip",
	switch: "switch lanes"
};
/**
* Property 15, rests are rests: in a part of the song marked as a rest, nothing counts down and nothing
* needs a press, from the first beep to the moment the obstacle is passed. And every obstacle asks for
* the move of the part it is in.
*/
function restsAreRests(level, input) {
	const tm = resolveTiming(input.timing);
	const label = input.label ?? `Level ${level.seed}`;
	const problems = [];
	for (const o of level.obstacles) {
		const first = cueTimes(o, tm)[0];
		const passed = o.start + o.width + tm.halfWidth;
		for (const s of level.sections ?? []) if (s.feel === "rest" && first < s.to - EPS && passed > s.from + EPS) problems.push(`${label}, obstacle ${o.index + 1} (${o.kind}): its countdown runs from ${secs(first)} s to ${secs(passed)} s, inside the rest '${s.name}' (${secs(s.from)} s to ${secs(s.to)} s). A rest must have nothing to press.`);
	}
	return proofResult(15, "Rests are rests", problems);
}
/**
* Property 16, portals give warning: when the move changes, the portal is announced a whole bar before
* any countdown in the new move begins, no countdown in the old move is still running over it, and every
* obstacle asks for the move that is in force when its countdown starts.
*/
function portalsGiveWarning(level, input) {
	const tm = resolveTiming(input.timing);
	const bar = barSeconds(tm);
	const label = input.label ?? `Level ${level.seed}`;
	const problems = [];
	for (const o of level.obstacles) {
		const first = cueTimes(o, tm)[0];
		const passed = o.start + o.width + tm.halfWidth;
		const wanted = o.move ?? "jump";
		const inForce = moveAt(level, first);
		const where = `${label}, obstacle ${o.index + 1} (${o.kind})`;
		if (inForce !== wanted) problems.push(`${where}: it asks the player to ${MOVE_WORDS[wanted]}, but when its countdown starts a press would ${MOVE_WORDS[inForce]}.`);
		for (const p of level.portals ?? []) if (first < p.at + bar - EPS && passed > p.at + EPS) problems.push(`${where}: its countdown (${secs(first)} s to ${secs(passed)} s) runs into the portal to ${MOVE_WORDS[p.move]} mode at ${secs(p.at)} s. Nothing may count down from the portal until one bar (${secs(bar)} s) after it.`);
	}
	return proofResult(16, "Portals give warning", problems);
}
/**
* Property 103, one right lane: every number gate has two different numbers, one in each lane, and
* exactly one of them fits the lesson's rule. The press is needed exactly when the right one is in the
* other lane (property 101 checks that half).
*/
function gatesHaveOneRightLane(lesson) {
	return (level, input) => {
		const label = input.label ?? `Level ${level.seed}`;
		const problems = [];
		for (const o of level.obstacles) {
			if ((o.move ?? "jump") !== "switch") continue;
			const where = `${label}, gate ${o.index + 1} (${o.kind})`;
			if (!lesson || o.value === void 0 || o.gate === void 0) {
				problems.push(`${where}: a gate needs a number in each lane and a rule to choose by.`);
				continue;
			}
			const there = lesson.isTarget(o.value);
			const here = lesson.isTarget(o.gate.here);
			if (o.value === o.gate.here) problems.push(`${where}: both lanes say ${o.value}, so there is nothing to choose.`);
			else if (there === here) problems.push(`${where}: ${o.gate.here} and ${o.value} ${there ? "both fit" : "both miss"} the rule, so there is not exactly one right lane.`);
			if (isSolid(o) !== there) problems.push(`${where}: the right lane is ${there ? "the other one" : "yours"}, but the gate asks the player to ${isSolid(o) ? "switch" : "stay"}.`);
		}
		return proofResult(103, "One right lane", problems);
	};
}
/**
* Property 104, gate words in time: both numbers of a gate can be said in full between the first beep
* and the fourth beat at every speed, Fast included, by a fair guess at speaking speed. The caption
* shows them from the first beep as well.
*/
function gateWordsInTime(level, input) {
	const tm = resolveTiming(input.timing);
	const label = input.label ?? `Level ${level.seed}`;
	const [speed, fastest] = Object.entries(tm.rates).sort((a, b) => b[1] - a[1])[0];
	const countdownMs = 3 * tm.beat / fastest * 1e3;
	const problems = [];
	for (const o of level.obstacles) {
		if (!o.gate || o.value === void 0) continue;
		const words = phrase("gate", {
			here: String(o.gate.here),
			there: String(o.value)
		});
		const ms = speechMs(words);
		if (ms > countdownMs + EPS) problems.push(`${label}, gate ${o.index + 1} (${o.kind}): "${words}" takes about ${Math.round(ms)} ms to say, but the countdown at ${speed} is ${Math.round(countdownMs)} ms. Use shorter numbers or a slower beat.`);
	}
	return proofResult(104, "Gate words in time", problems);
}
/** The song properties as extras for `prove`. */
function songProperties(lesson) {
	return [
		restsAreRests,
		portalsGiveWarning,
		gatesHaveOneRightLane(lesson),
		gateWordsInTime
	];
}
// ../../skeleton/src/proof/index.ts
/**
* Run every built-in property, then any `extra` properties you supply for your
* own game rules. Results come back in that order.
*/
function prove(level, input) {
	const builtIn = [
		jumpable(level, input),
		reachable(level, input),
		unambiguousCues(level, input),
		multisensory(level, input),
		windowFloor(level, input),
		fourthBeatClears(level, input)
	];
	const custom = (input.extra ?? []).map((property) => property(level, input));
	return [...builtIn, ...custom];
}
/** Thrown when a level fails the proof. The game must never serve it (Req 8.9). */
var LevelRefused = class extends Error {
	failures;
	constructor(failures) {
		super("This level cannot be served:\n" + failures.map((f) => `- ${f.name}: ${f.counterexample ?? "failed"}`).join("\n"));
		this.failures = failures;
		this.name = "LevelRefused";
	}
};
// ../../skeleton/src/types.ts
var SPEEDS$2 = [
	"slow",
	"medium",
	"fast"
];
// ../../skeleton/src/profile/index.ts
/** Requirement 11.1: Slow by default, scanning on by default, every channel on. */
function defaultProfile() {
	return {
		speed: "slow",
		dwellMs: 2200,
		theme: "default",
		textScale: 1,
		palette: "default",
		reducedMotion: false,
		volume: {
			cues: 1,
			speech: 1,
			music: .6
		},
		mono: false,
		voice: true,
		channels: {
			sound: true,
			speech: true,
			captions: true,
			indicator: true,
			haptics: true
		},
		picture: true,
		scanning: true,
		holdToConfirm: false,
		setupDone: false,
		coachLeadMs: 0,
		announce: "normal"
	};
}
/** Apply a patch without mutating the base. Nested volume/channels merge. */
function mergeProfile(base, patch) {
	const { volume, channels, ...rest } = patch;
	return {
		...base,
		...stripUndefined$1(rest),
		volume: {
			...base.volume,
			...stripUndefined$1(volume ?? {})
		},
		channels: {
			...base.channels,
			...stripUndefined$1(channels ?? {})
		}
	};
}
function stripUndefined$1(obj) {
	return Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== void 0));
}
// ../../skeleton/src/schedule/index.ts
/** Danger rises over this many running seconds before an obstacle. */
var TENSION_RUN_UP = 3.5;
/** The music steps aside this long before the first beep, and comes back this long after the press. */
var QUIET_LEAD = .15;
var QUIET_TAIL = .15;
/**
* A lesson's number goes on the countdown events, so it is spoken and shown. Whether the
* obstacle is a target is left off on purpose: the events must never give away the answer.
*/
var numbered = (o) => ({
	...o.value === void 0 ? {} : { value: o.value },
	...o.gate ? { here: o.gate.here } : {},
	...o.move && o.move !== "jump" ? { move: o.move } : {}
});
/**
* Turn a level into the events a game would emit, in order, on level time
* (running seconds): the countdown for each obstacle (Requirement 3.2: beeps at
* J-3*beat, J-2*beat and J-beat, the press at J) and one `atmosphere` event per
* bar for the wind and pad underneath. Adapters convert running seconds to real
* time with the speed rate (Requirement 3.3). Pass your own timing if your game
* does not use the defaults.
*/
function levelEvents(level, timingOverrides = {}) {
	const timing = resolveTiming(timingOverrides);
	const events = [];
	const seen = /* @__PURE__ */ new Set();
	for (const o of level.obstacles) {
		const [first, second, third] = cueTimes(o, timing);
		const press = idealPress(o, timing);
		const firstOfKind = !seen.has(o.kind);
		seen.add(o.kind);
		events.push({
			type: EVENT_TYPES.approaching,
			at: first,
			data: {
				object: o.kind,
				index: o.index,
				first: firstOfKind,
				span: press - first,
				...numbered(o)
			}
		});
		[
			first,
			second,
			third,
			press
		].forEach((at, i) => {
			events.push({
				type: EVENT_TYPES.beat,
				at,
				data: {
					object: o.kind,
					index: o.index,
					beat: i + 1,
					...numbered(o)
				}
			});
		});
	}
	for (const p of level.portals ?? []) events.push({
		type: EVENT_TYPES.portal,
		at: p.at,
		data: { move: p.move }
	});
	const last = level.obstacles.at(-1);
	const songEnd = level.sections?.at(-1)?.to ?? 0;
	if (last) {
		const presses = level.obstacles.map((o) => idealPress(o, timing));
		const end = Math.max(last.start + last.width + timing.halfWidth + 2, songEnd);
		for (let bar = 0; bar * 2 <= end; bar++) {
			const at = bar * 2;
			const next = presses.find((p) => p > at);
			const tension = next === void 0 ? .1 : Math.max(0, Math.min(1, 1 - (next - at) / TENSION_RUN_UP));
			const reach = at + 2.5;
			const quiet = presses.map((p) => [p - 3 * timing.beat - QUIET_LEAD, p + QUIET_TAIL]).filter(([from, to]) => to > at && from < reach);
			const pulse = (presses[0] % timing.beat + timing.beat) % timing.beat;
			const part = sectionAt(level, at + 1) ?? sectionAt(level, at);
			events.push({
				type: EVENT_TYPES.atmosphere,
				at,
				data: {
					bar,
					tension,
					span: 2,
					quiet,
					pulse,
					...part ? {
						energy: part.energy,
						part: part.name
					} : {}
				}
			});
		}
	}
	return events.sort((x, y) => x.at - y.at);
}
// ../../skeleton/src/kit/index.ts
function createKit(config = {}) {
	const timing = resolveTiming(config.timing);
	const strings = createStrings(config.strings);
	const registry = createRegistry({
		...config.voices ? { voices: config.voices } : {},
		...config.haptics ? { haptics: config.haptics } : {}
	});
	const events = createEventRegistry();
	for (const [type, presentation] of Object.entries(config.events ?? {})) events.define(type, presentation);
	const channels = createChannels(registry, {
		strings,
		events,
		...config.channels?.omit ? { omit: config.channels.omit } : {},
		...config.channels?.replace ? { replace: config.channels.replace } : {},
		audio: {
			trackSlot: timing.beat / 2,
			...config.audio
		}
	});
	const newProfile = () => mergeProfile(defaultProfile(), config.defaults ?? {});
	const lesson = config.lesson;
	if (lesson) lessonPools(lesson);
	if (config.song) validateSong(config.song, [], lesson, { kindsLater: true });
	const runSettings = resolveRunSettings(config.run);
	const song = config.song;
	const extra = [
		...lesson ? [lessonProperty(lesson)] : [],
		...song ? songProperties(lesson) : [],
		...config.properties ?? []
	];
	const proofInput = (label) => ({
		objects: registry,
		timing,
		...label !== void 0 ? { label } : {},
		...config.floorsMs ? { floorsMs: config.floorsMs } : {},
		...extra.length > 0 ? { extra } : {}
	});
	return {
		lesson,
		song,
		coach: config.coach === true,
		timing,
		registry,
		events,
		channels,
		newProfile,
		defineObstacle: (name, options) => registry.define(name, options),
		defineObject: (name, options) => registry.define(name, options),
		proveEvents(profile = newProfile()) {
			const object = registry.names()[0] ?? "object";
			const where = {
				x: .5,
				distance: .5
			};
			const builtIn = [
				{
					type: EVENT_TYPES.approaching,
					at: 0,
					data: {
						object,
						first: true,
						span: 1.2
					}
				},
				...[
					1,
					2,
					3,
					4
				].map((beat) => ({
					type: EVENT_TYPES.beat,
					at: 0,
					data: {
						object,
						beat
					}
				})),
				{
					type: EVENT_TYPES.cleared,
					at: 0,
					data: { object }
				},
				{
					type: EVENT_TYPES.jumped,
					at: 0
				},
				{
					type: EVENT_TYPES.landed,
					at: 0
				},
				{
					type: EVENT_TYPES.fallReason,
					at: 0,
					data: { reason: "early" }
				},
				{
					type: EVENT_TYPES.fallReason,
					at: 0,
					data: {
						reason: "wrong",
						explain: "Example."
					}
				},
				{
					type: EVENT_TYPES.judged,
					at: 0,
					data: {
						grade: "perfect",
						streak: 5,
						score: 100,
						points: 100
					}
				},
				{
					type: EVENT_TYPES.judged,
					at: 0,
					data: {
						grade: "ok",
						streak: 1,
						score: 30,
						points: 30
					}
				},
				{
					type: EVENT_TYPES.passed,
					at: 0,
					data: {
						object,
						streak: 1,
						score: 50,
						points: 50
					}
				},
				{
					type: EVENT_TYPES.hurt,
					at: 0
				},
				{
					type: EVENT_TYPES.levelComplete,
					at: 0
				},
				...song ? [
					"jump",
					"flip",
					"switch"
				].map((move) => ({
					type: EVENT_TYPES.portal,
					at: 0,
					data: { move }
				})) : [],
				...config.coach ? [{
					type: EVENT_TYPES.coach,
					at: 0,
					data: {
						object,
						move: "jump"
					}
				}] : []
			];
			const own = events.list().map((type) => ({
				type,
				at: 0,
				data: {
					object,
					...where,
					angle: 45,
					label: "Example",
					summary: "Example."
				}
			}));
			const decorative = [EVENT_TYPES.atmosphere, ...events.list().filter((t) => events.presentation(t)?.decorative)];
			return eventsReachTwoSenses([...builtIn, ...own], (event) => renderEvent(event, profile, channels), decorative);
		},
		generate(seed, options = {}) {
			const kinds = registry.kinds();
			if (kinds.length === 0) throw new Error("Define at least one obstacle before generating a level.");
			if (song) return generateSong(seed, song, {
				kinds,
				timing,
				...lesson ? { lesson } : {}
			});
			return generateLevel(seed, {
				kinds,
				timing,
				...options.count !== void 0 ? { count: options.count } : {},
				...lesson ? { lesson } : {}
			});
		},
		levelEvents: (level) => levelEvents(level, timing),
		render: (event, profile = newProfile()) => renderEvent(event, profile, channels),
		prove: (level, label) => prove(level, proofInput(label)),
		refuseIfFailing(level, label) {
			const failures = prove(level, proofInput(label)).filter((r) => !r.pass);
			if (failures.length > 0) throw new LevelRefused(failures);
			return level;
		},
		run: ({ assist, coachLeadMs, ...options }) => createRun({
			...options,
			...config.coach && coachLeadMs ? { coachLeadMs } : {},
			timing,
			events: levelEvents(options.level, timing),
			...config.run || assist !== void 0 ? { settings: {
				...config.run,
				...assist !== void 0 ? { assist } : {}
			} } : {},
			...lesson ? { explain: ({ value, solid }, reason) => reason === "wrong" ? lesson.explainWrong?.(value) : reason === "none" && solid ? lesson.explainMiss?.(value) : void 0 } : {}
		}),
		rank(level, score) {
			const best = maxScore(level, runSettings);
			const fraction = best <= 0 ? 0 : Math.min(1, score / best);
			return {
				rank: rankOf(fraction, runSettings),
				fraction,
				best
			};
		},
		renderLevel: (level, profile = newProfile()) => levelEvents(level, timing).flatMap((event) => renderEvent(event, profile, channels)),
		provePresentation(level) {
			const sample = level ?? (registry.kinds().length > 0 ? this.generate(1) : void 0);
			const profile = newProfile();
			const results = [];
			if (sample) {
				const worst = [
					"slow",
					"medium",
					"fast"
				].map((speed) => noUnsafeFlashing(this.renderLevel(sample, {
					...profile,
					speed
				}), timing.rates[speed], false, `Level ${sample.seed} at ${speed}`)).find((r) => !r.pass);
				const still = noUnsafeFlashing(this.renderLevel(sample, {
					...profile,
					reducedMotion: true
				}), timing.rates.fast, true, `Level ${sample.seed}, reduced motion`);
				results.push(worst ?? still);
			}
			results.push(this.proveEvents(profile), themesHaveContrast(), noHoldOrChord());
			const spoken = (sample ? this.renderLevel(sample, profile) : []).flatMap((c) => c.channel === "speech" ? [c.text] : []);
			results.push(linesInScript(spoken, this.lineScript()));
			return results;
		},
		lineScript() {
			const lines = /* @__PURE__ */ new Map();
			const add = (text, from) => {
				if (!lines.has(text)) lines.set(text, {
					text,
					template: /\{\w+\}/.test(text),
					from
				});
			};
			for (const kind of registry.kinds()) add(phrase("approaching", { name: registry.get(kind.name).say }, strings), `${kind.name}, the first time it appears`);
			for (const key of [
				"fallEarly",
				"fallLate",
				"fallNone",
				"hurt",
				"levelComplete",
				"perfect"
			]) add(phrase(key, {}, strings), key);
			if (lesson) {
				add(phrase("fallWrong", {}, strings), "fallWrong");
				add(strings.number, "the number on each obstacle");
				add(strings.streak, "a streak of five or ten");
			}
			if (config.coach) add(strings.coach, "the coach, before each countdown");
			if (song) {
				const moves = new Set(song.sections.map((s) => s.move).filter((m) => m !== void 0));
				if (moves.has("jump") || moves.size > 0) add(phrase("portalJump", {}, strings), "a portal back to jump mode");
				if (moves.has("flip")) add(phrase("portalFlip", {}, strings), "a portal to flip mode");
				if (moves.has("switch")) {
					add(phrase("portalSwitch", {}, strings), "a portal to gate mode");
					add(strings.gate, "each number gate");
				}
			}
			for (const [type, presentation] of Object.entries(config.events ?? {})) if (presentation.say) add(presentation.say.charAt(0).toUpperCase() + presentation.say.slice(1), `event '${type}'`);
			return [...lines.values()];
		}
	};
}
// ../../skeleton/src/navigation/maze.ts
var DIRS = [
	{
		dx: 0,
		dy: -1
	},
	{
		dx: 1,
		dy: 0
	},
	{
		dx: 0,
		dy: 1
	},
	{
		dx: -1,
		dy: 0
	}
];
var opposite = (d) => (d + 2) % 4;
var DEFAULT_MAZE = {
	width: 8,
	height: 8,
	ghostEvery: 2,
	margin: 2,
	minGhostStart: 6,
	relics: 0,
	hides: 3,
	chase: {
		moves: 2,
		per: 3
	},
	ritualGap: 2
};
/**
* Play the ritual route perfectly and watch the phantom. It moves `1` room every `ghostEvery` steps
* until the last relic is found, then at the chase rate, always by the shortest way to the player.
* Returns the nearest it came (in rooms, along the passages), and where.
*/
function simulateRitual(m) {
	const route = m.ritualRoute;
	const lastRelicStep = m.relics.length === 0 ? Infinity : Math.max(...m.relics.map((r) => route.findIndex((c) => sameCell(c, r))));
	let phantom = phantomStart(m);
	let nearest = Infinity;
	let at = 0;
	for (let k = 1; k < route.length; k++) {
		const player = route[k];
		if (sameCell(player, phantom.at)) return {
			nearest: 0,
			at: k,
			caught: true
		};
		const turn = phantomTurn(m, phantom, player, {
			hidden: false,
			chasing: k > lastRelicStep
		});
		phantom = turn.state;
		if (turn.caught) return {
			nearest: 0,
			at: k,
			caught: true
		};
		const g = distancesFrom(m, player)[indexOf(m, phantom.at)];
		if (g < nearest) {
			nearest = g;
			at = k;
		}
	}
	return {
		nearest,
		at,
		caught: false
	};
}
var nextRng = (r) => Math.imul(r, 1664525) + 1013904223 >>> 0;
var prowls = (m) => m.relics.length > 0 && m.rooms.length > 0;
function phantomStart(m) {
	const rng = nextRng((m.seed ^ 2654435769) >>> 0);
	const target = prowls(m) ? m.rooms[rng % m.rooms.length] : m.ghost;
	return {
		at: m.ghost,
		mode: prowls(m) ? "prowl" : "hunt",
		target,
		acc: 0,
		quiet: 0,
		rng
	};
}
/**
* One step of the player's worth of time. Returns the phantom's new state, whether it caught the player,
* and what changed: it started hunting, it lost the trail, or it searched your hiding place and gave up.
* `force` makes exactly one move, whatever the speed (time spent at a crossing to listen or ask).
*/
function phantomTurn(m, state, player, how) {
	const s = { ...state };
	const news = [];
	const rate = how.chasing ? m.chase : {
		moves: 1,
		per: m.ghostEvery
	};
	let moves = 0;
	if (how.force) moves = 1;
	else {
		s.acc += rate.moves;
		while (s.acc >= rate.per) {
			s.acc -= rate.per;
			moves += 1;
		}
	}
	const newTarget = () => {
		s.rng = nextRng(s.rng);
		const far = m.rooms.filter((r) => !sameCell(r, player) && !sameCell(r, s.at));
		s.target = far.length > 0 ? far[s.rng % far.length] : m.ghost;
	};
	for (let i = 0; i < moves; i++) {
		if (prowls(m)) {
			const d = distancesFrom(m, s.at)[indexOf(m, player)];
			if (how.chasing || !how.hidden && d >= 0 && d <= 3) {
				if (s.mode !== "hunt") news.push("hunts");
				s.mode = "hunt";
				s.quiet = 0;
			} else if (s.mode === "hunt" && !how.hidden) {
				s.quiet += 1;
				if (s.quiet >= 4) {
					s.mode = "prowl";
					news.push("lost");
					newTarget();
				}
			}
		}
		const goal = s.mode === "hunt" ? player : s.target;
		const next = stepToward(m, s.at, goal);
		if (next) s.at = next;
		if (sameCell(s.at, player)) {
			if (!how.hidden) return {
				state: s,
				caught: true,
				news
			};
			news.push("searched");
			s.mode = "prowl";
			s.quiet = 0;
			newTarget();
		} else if (s.mode === "prowl" && sameCell(s.at, s.target)) newTarget();
	}
	return {
		state: s,
		caught: false,
		news
	};
}
/** The shortest path between two cells, both ends included. */
function pathBetween(m, from, to) {
	const path = [from];
	let c = from;
	for (let guard = 0; !sameCell(c, to) && guard < m.width * m.height; guard++) {
		const next = stepToward(m, c, to);
		if (!next) break;
		path.push(next);
		c = next;
	}
	return path;
}
var sameCell = (a, b) => a.x === b.x && a.y === b.y;
var indexOf = (m, c) => c.y * m.width + c.x;
var cellAt = (width, i) => ({
	x: i % width,
	y: Math.floor(i / width)
});
/** The ways you can walk from a cell. */
function openings(m, c) {
	const mask = m.open[indexOf(m, c)] ?? 0;
	return [
		0,
		1,
		2,
		3
	].filter((d) => (mask & 1 << d) !== 0);
}
var neighbour = (c, d) => ({
	x: c.x + DIRS[d].dx,
	y: c.y + DIRS[d].dy
});
/** Steps from a cell to every other cell, along the passages. -1 where there is no way. */
var distanceCache = /* @__PURE__ */ new WeakMap();
function distancesFrom(m, from) {
	let perHouse = distanceCache.get(m.open);
	if (!perHouse) {
		perHouse = /* @__PURE__ */ new Map();
		distanceCache.set(m.open, perHouse);
	}
	const key = (from.y * m.width + from.x) * 4096 + m.width;
	const known = perHouse.get(key);
	if (known) return known;
	const fresh = bfs(m, from);
	perHouse.set(key, fresh);
	return fresh;
}
function bfs(m, from) {
	const dist = new Array(m.width * m.height).fill(-1);
	const queue = [from.y * m.width + from.x];
	dist[queue[0]] = 0;
	for (let head = 0; head < queue.length; head++) {
		const i = queue[head];
		const c = cellAt(m.width, i);
		for (const d of openings(m, c)) {
			const n = neighbour(c, d);
			const j = n.y * m.width + n.x;
			if (dist[j] === -1) {
				dist[j] = dist[i] + 1;
				queue.push(j);
			}
		}
	}
	return dist;
}
/** The next cell on the shortest way from one cell to another, or null if already there. */
function stepToward(m, from, to) {
	if (sameCell(from, to)) return null;
	const dist = distancesFrom(m, to);
	let best = null;
	let bestDist = Infinity;
	for (const d of openings(m, from)) {
		const n = neighbour(from, d);
		const nd = dist[indexOf(m, n)];
		if (nd >= 0 && nd < bestDist) {
			best = n;
			bestDist = nd;
		}
	}
	return best;
}
/**
* Build a house. Same seed, same house. It is a perfect maze (one route between any two
* cells) so it is always connected, and the phantom is placed where it cannot cut off the
* shortest route to the exit. If a seed cannot be made fair it is nudged, deterministically.
*/
function generateMaze(seed, options = {}) {
	const o = {
		...DEFAULT_MAZE,
		...stripUndefined(options)
	};
	if (o.width < 4 || o.height < 4) throw new Error("A house needs to be at least 4 by 4 rooms.");
	const attempts = o.relics > 0 ? 160 : 40;
	for (let attempt = 0; attempt < attempts; attempt++) {
		const rand = mulberry32(seed + attempt * 7919 >>> 0);
		const { width: w, height: h } = o;
		const open = new Array(w * h).fill(0);
		const seen = new Array(w * h).fill(false);
		const startIndex = [
			0,
			w - 1,
			(h - 1) * w,
			h * w - 1
		][Math.floor(rand() * 4)];
		const stack = [startIndex];
		seen[startIndex] = true;
		while (stack.length > 0) {
			const here = stack[stack.length - 1];
			const c = cellAt(w, here);
			const choices = [
				0,
				1,
				2,
				3
			].filter((d) => {
				const n = neighbour(c, d);
				return n.x >= 0 && n.y >= 0 && n.x < w && n.y < h && !seen[n.y * w + n.x];
			});
			if (choices.length === 0) {
				stack.pop();
				continue;
			}
			const d = choices[Math.floor(rand() * choices.length)];
			const n = neighbour(c, d);
			const ni = n.y * w + n.x;
			open[here] |= 1 << d;
			open[ni] |= 1 << opposite(d);
			seen[ni] = true;
			stack.push(ni);
		}
		const base = {
			width: w,
			height: h,
			open
		};
		const start = cellAt(w, startIndex);
		const fromStart = distancesFrom(base, start);
		let exitIndex = 0;
		fromStart.forEach((dist, i) => {
			if (dist > fromStart[exitIndex]) exitIndex = i;
		});
		const exit = cellAt(w, exitIndex);
		const route = [exit];
		for (let c = exit; !sameCell(c, start);) {
			const here = fromStart[indexOf(base, c)];
			const next = openings(base, c).map((d) => neighbour(c, d)).find((n) => fromStart[indexOf(base, n)] === here - 1);
			route.push(next);
			c = next;
		}
		route.reverse();
		const onRoute = new Set(route.map((c) => indexOf(base, c)));
		const ritual = o.relics > 0 ? planRitual(base, start, exit, o, rand) : null;
		if (o.relics > 0 && !ritual) continue;
		const ritualRoute = ritual?.route ?? route;
		const onRitual = new Set(ritualRoute.map((c) => indexOf(base, c)));
		let best = null;
		for (let i = 0; i < w * h; i++) {
			if (!ritual && (onRoute.has(i) || onRitual.has(i))) continue;
			const g = cellAt(w, i);
			const dg = distancesFrom(base, g);
			const spare = Math.min(...route.map((r, k) => o.ghostEvery * dg[indexOf(base, r)] - k));
			const far = dg[indexOf(base, start)];
			if (!ritual && spare < o.margin + 1 || far < o.minGhostStart) continue;
			let nearest = Infinity;
			if (ritual) {
				const sim = simulateRitual({
					...base,
					seed,
					ghost: g,
					ritualRoute,
					relics: ritual.relics,
					rooms: ritual.rooms,
					ghostEvery: o.ghostEvery,
					chase: o.chase
				});
				if (sim.caught || sim.nearest < o.ritualGap) continue;
				nearest = sim.nearest;
			}
			if (!best || (ritual ? nearest > best.nearest || nearest === best.nearest && far > best.far : spare > best.spare || spare === best.spare && far > best.far)) best = {
				cell: g,
				spare,
				far,
				nearest
			};
		}
		if (!best) continue;
		return {
			rooms: ritual?.rooms ?? [],
			relics: ritual?.relics ?? [],
			hides: ritual?.hides ?? [],
			ritualRoute,
			chase: o.relics > 0 ? o.chase : {
				moves: 1,
				per: o.ghostEvery
			},
			ritualGap: o.ritualGap,
			seed,
			width: w,
			height: h,
			open,
			start,
			exit,
			ghost: best.cell,
			route,
			ghostEvery: o.ghostEvery,
			margin: o.margin,
			minGhostStart: o.minGhostStart
		};
	}
	throw new Error(`Could not build a fair house for seed ${seed}. Try a bigger house or a slower phantom.`);
}
/** Choose rooms, relics and hiding places, and the best order to fetch the relics. Null if the house is too small. */
function planRitual(base, start, exit, o, rand) {
	const { width: w, height: h } = base;
	const all = [];
	for (let i = 0; i < w * h; i++) all.push(cellAt(w, i));
	const rooms = all.filter((c) => openings(base, c).length !== 2 || sameCell(c, start) || sameCell(c, exit));
	const dist = /* @__PURE__ */ new Map();
	const from = (c) => {
		const key = indexOf(base, c);
		if (!dist.has(key)) dist.set(key, distancesFrom(base, c));
		return dist.get(key);
	};
	const gapTo = (c, set) => Math.min(...set.map((s) => from(s)[indexOf(base, c)]));
	/** Pick `n` cells from `pool`, each as far as possible from those already picked (and from `avoid`). */
	const spread = (pool, n, avoid) => {
		const shuffled = [...pool];
		for (let i = shuffled.length - 1; i > 0; i--) {
			const j = Math.floor(rand() * (i + 1));
			[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
		}
		const picked = [];
		while (picked.length < n && shuffled.length > 0) {
			let bestAt = 0;
			let bestGap = -1;
			shuffled.forEach((c, i) => {
				const g = gapTo(c, [...avoid, ...picked]);
				if (g > bestGap) {
					bestGap = g;
					bestAt = i;
				}
			});
			picked.push(shuffled.splice(bestAt, 1)[0]);
		}
		return picked;
	};
	const candidates = rooms.filter((c) => !sameCell(c, start) && !sameCell(c, exit));
	if (candidates.length < o.relics) return null;
	const relics = spread(candidates, o.relics, [start, exit]);
	const rest = candidates.filter((c) => !relics.some((r) => sameCell(r, c)));
	const hides = spread(rest, Math.min(o.hides, rest.length), [start, ...relics]);
	const route = [start];
	let here = start;
	const left = [...relics];
	while (left.length > 0) {
		left.sort((a, b) => from(here)[indexOf(base, a)] - from(here)[indexOf(base, b)]);
		const next = left.shift();
		route.push(...pathBetween(base, here, next).slice(1));
		here = next;
	}
	route.push(...pathBetween(base, here, exit).slice(1));
	return {
		rooms,
		relics,
		hides,
		route
	};
}
function stripUndefined(obj) {
	return Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== void 0));
}
// ../../skeleton/src/navigation/proof.ts
var where = (c) => `column ${c.x + 1}, row ${c.y + 1}`;
/**
* The navigation pattern's proof: can this house always be escaped? Four properties,
* numbered 201 to 204. A house that fails any of them is never served.
*
*  201 Exit reachable: there is a way from the start to the exit.
*  202 Shortest route safe: a player who takes the shortest route is never caught,
*      with steps to spare. This is the finishability guarantee.
*  203 Fair start: the phantom does not start too close.
*  204 Well formed: every passage can be walked both ways, and none leaves the house.
*  205 Ritual route safe (houses with relics): fetching every relic the best way, then running the chase, is never caught.
*  206 Ritual well placed: relics and hiding places are reachable rooms, and the exit is a room.
*/
function proveMaze(maze, label = `House ${maze.seed}`) {
	const fromStart = distancesFrom(maze, maze.start);
	const fromGhost = distancesFrom(maze, maze.ghost);
	const reach = [];
	if (fromStart[indexOf(maze, maze.exit)] === -1) reach.push(`${label}: there is no way from the start (${where(maze.start)}) to the exit (${where(maze.exit)}).`);
	const safe = [];
	if (maze.relics.length === 0) maze.route.forEach((cell, k) => {
		const dg = fromGhost[indexOf(maze, cell)];
		const ghostArrives = dg < 0 ? Infinity : maze.ghostEvery * dg;
		if (ghostArrives <= k + maze.margin) safe.push(`${label}: on the shortest route the player reaches ${where(cell)} at step ${k}, but the phantom can be there by step ${ghostArrives}. It needs ${maze.margin} spare steps.`);
	});
	const fair = [];
	const startGap = fromGhost[indexOf(maze, maze.start)];
	if (startGap >= 0 && startGap < maze.minGhostStart) fair.push(`${label}: the phantom starts only ${startGap} rooms from the player. It needs at least ${maze.minGhostStart}.`);
	const formed = [];
	for (let y = 0; y < maze.height; y++) for (let x = 0; x < maze.width; x++) {
		const here = {
			x,
			y
		};
		for (const d of openings(maze, here)) {
			const n = neighbour(here, d);
			if (n.x < 0 || n.y < 0 || n.x >= maze.width || n.y >= maze.height) formed.push(`${label}: ${where(here)} has a passage ${[
				"north",
				"east",
				"south",
				"west"
			][d]} out of the house.`);
			else if (!openings(maze, n).includes(opposite(d))) formed.push(`${label}: you can walk from ${where(here)} ${[
				"north",
				"east",
				"south",
				"west"
			][d]}, but not back.`);
		}
	}
	const results = [
		proofResult(201, "Exit reachable", reach),
		proofResult(202, "Shortest route safe", safe),
		proofResult(203, "Fair start", fair),
		proofResult(204, "Well formed", formed)
	];
	if (maze.relics.length === 0) return results;
	const ritual = [];
	const sim = simulateRitual(maze);
	if (sim.caught) ritual.push(`${label}: a player doing the ritual the best way is caught at step ${sim.at}, at ${where(maze.ritualRoute[sim.at])}.`);
	else if (sim.nearest < maze.ritualGap) ritual.push(`${label}: on the best ritual route the phantom comes within ${sim.nearest} room${sim.nearest === 1 ? "" : "s"} at step ${sim.at}. It must stay ${maze.ritualGap} away.`);
	const placed = [];
	const isRoom = (c) => maze.rooms.some((r) => sameCell(r, c));
	const seen = /* @__PURE__ */ new Set();
	maze.relics.forEach((r, i) => {
		if (fromStart[indexOf(maze, r)] === -1) placed.push(`${label}: relic ${i + 1} at ${where(r)} cannot be reached.`);
		if (!isRoom(r)) placed.push(`${label}: relic ${i + 1} at ${where(r)} is not in a room, so the walk would not stop for it.`);
		if (sameCell(r, maze.start) || sameCell(r, maze.exit)) placed.push(`${label}: relic ${i + 1} is at the start or the exit.`);
		if (seen.has(indexOf(maze, r))) placed.push(`${label}: two relics share ${where(r)}.`);
		seen.add(indexOf(maze, r));
	});
	for (const h of maze.hides) if (!isRoom(h)) placed.push(`${label}: the hiding place at ${where(h)} is not in a room.`);
	if (!isRoom(maze.exit)) placed.push(`${label}: the exit is not a room, so the sealed door cannot stop you.`);
	results.push(proofResult(205, "Ritual route safe", ritual), proofResult(206, "Ritual well placed", placed));
	return results;
}
function personaName(spec) {
	if (spec.kind === "perfect") return "perfect one-switch";
	if (spec.kind === "noisy") return `one-switch, ${spec.sigmaMs} ms timing error`;
	return `audio-only, ${spec.sigmaMs ?? 120} ms timing error`;
}
var sigmaOf = (spec) => spec.kind === "perfect" ? 0 : spec.kind === "noisy" ? spec.sigmaMs : spec.sigmaMs ?? 120;
/** The standard normal cumulative distribution (Abramowitz and Stegun 7.1.26, error under 1.5e-7). */
function normalCdf(z) {
	const x = Math.abs(z) / Math.SQRT2;
	const t = 1 / (1 + .3275911 * x);
	const erf = 1 - ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - .284496736) * t + .254829592) * t * Math.exp(-x * x);
	return z >= 0 ? .5 * (1 + erf) : .5 * (1 - erf);
}
/**
* Where this persona aims, per obstacle, in running seconds. The audio-only persona works it out
* from the cue events alone: the third beep plus one beat.
*/
function aimTimes(level, spec, timing = DEFAULT_TIMING) {
	if (spec.kind !== "audio-only") return level.obstacles.map((o) => idealPress(o, timing));
	const thirdBeeps = levelEvents(level, timing).filter((e) => e.type === EVENT_TYPES.beat && e.data?.beat === 3).map((e) => e.at);
	return level.obstacles.map((_, i) => (thirdBeeps[i] ?? NaN) + timing.beat);
}
/** The exact chance of clearing each obstacle to jump, on the first try, at a speed. */
function obstacleChances(level, spec, speed, timing = DEFAULT_TIMING) {
	const aims = aimTimes(level, spec, timing);
	const sigmaRunning = sigmaOf(spec) / 1e3 * timing.rates[speed];
	const out = [];
	level.obstacles.forEach((o, i) => {
		if (!isSolid(o)) return;
		const { a, b } = takeoffWindow(o, timing);
		const aim = aims[i];
		const chance = sigmaRunning === 0 ? aim >= a && aim <= b ? 1 : 0 : Math.max(0, normalCdf((b - aim) / sigmaRunning) - normalCdf((a - aim) / sigmaRunning));
		out.push({
			level: level.seed,
			index: i,
			kind: o.kind,
			windowMs: windowMs(o, speed, timing),
			chance
		});
	});
	return out;
}
/** Report how a persona does across levels at one speed. */
function simulatePersona(levels, spec, speed, timing = DEFAULT_TIMING) {
	let jumps = 0;
	let sum = 0;
	let clean = 0;
	let worst = null;
	for (const level of levels) {
		const chances = obstacleChances(level, spec, speed, timing);
		jumps += chances.length;
		sum += chances.reduce((s, c) => s + c.chance, 0);
		clean += chances.reduce((p, c) => p * c.chance, 1);
		for (const c of chances) if (!worst || c.chance < worst.chance) worst = c;
	}
	return {
		persona: personaName(spec),
		speed,
		levels: levels.length,
		jumps,
		meanClearRate: jumps === 0 ? 1 : sum / jumps,
		cleanLevelRate: levels.length === 0 ? 1 : clean / levels.length,
		hardest: worst ? `Level ${worst.level}, obstacle ${worst.index + 1} (${worst.kind}): ${Math.round(worst.chance * 100)}% on the first try. The take-off window is ${Math.round(worst.windowMs)} ms.` : null,
		hardestChance: worst?.chance ?? null
	};
}
/** Every persona at every speed. */
function personaReport(levels, specs, speeds = [
	"slow",
	"medium",
	"fast"
], timing = DEFAULT_TIMING) {
	return specs.flatMap((spec) => speeds.map((speed) => simulatePersona(levels, spec, speed, timing)));
}
// ../../skeleton/src/reviewer/index.ts
var DEFAULT_REVIEWERS = [
	{ kind: "perfect" },
	{
		kind: "noisy",
		sigmaMs: 150
	},
	{ kind: "audio-only" },
	{ kind: "deaf" }
];
var ORDINAL = [
	"first",
	"second",
	"third"
];
var pct$2 = (n) => Math.round(n * 100);
function reviewerName(spec) {
	return spec.kind === "deaf" ? "deaf player (sight only)" : personaName(spec);
}
var SPEED_ORDER = [...SPEEDS$2];
/** The nearest slower speed at which this player clears a jump often enough, if there is one. */
function slowerSpeedThatWorks(chanceAt, from, min) {
	for (let i = SPEED_ORDER.indexOf(from) - 1; i >= 0; i--) {
		const speed = SPEED_ORDER[i];
		const chance = chanceAt(speed);
		if (chance >= min) return {
			to: speed,
			chance
		};
	}
	return null;
}
/** Does every beep and every fall reason reach this sense? */
function perceptionFindings(kit, level, spec, sense) {
	const persona = reviewerName(spec);
	const profile = {
		...kit.newProfile(),
		picture: sense === "sight"
	};
	const findings = [];
	let obstacle = 0;
	for (const event of kit.levelEvents(level)) {
		if (event.type !== EVENT_TYPES.beat) continue;
		const beat = event.data?.beat;
		if (typeof beat !== "number" || beat > 3) continue;
		if (beat === 1) obstacle += 1;
		if (!kit.render(event, profile).some((c) => c.senses.includes(sense))) {
			const o = level.obstacles[obstacle - 1];
			findings.push({
				persona,
				level: level.seed,
				obstacle,
				object: o?.kind ?? null,
				severity: "blocks",
				cause: `${persona}, level ${level.seed}, obstacle ${obstacle} (${o?.kind ?? "object"}): the ${ORDINAL[beat - 1]} beep reaches nothing they can ${sense === "hearing" ? "hear" : "see"}. Give it ${sense === "hearing" ? "a sound or a spoken line" : "a caption or a marker"}.`,
				repair: {
					change: "none",
					note: "This is a gap in the game, not in the player’s settings, so no setting fixes it."
				}
			});
		}
	}
	for (const reason of ["early", "late"]) {
		const event = {
			type: EVENT_TYPES.fallReason,
			at: 0,
			data: { reason }
		};
		if (!kit.render(event, profile).some((c) => c.senses.includes(sense))) findings.push({
			persona,
			level: level.seed,
			obstacle: null,
			object: null,
			severity: "blocks",
			cause: `${persona}: when they fall because they pressed ${reason}, nothing tells them by ${sense === "hearing" ? "sound" : "sight"}.`,
			repair: {
				change: "none",
				note: "Give the fall reason a spoken line or a caption."
			}
		});
	}
	return findings;
}
function timingFindings(kit, level, spec, speed, min) {
	const persona = reviewerName(spec);
	const here = obstacleChances(level, spec, speed, kit.timing);
	const out = [];
	for (const c of here) {
		if (c.chance >= min) continue;
		const fix = slowerSpeedThatWorks((s) => obstacleChances(level, spec, s, kit.timing).find((x) => x.index === c.index)?.chance ?? 0, speed, min);
		out.push({
			persona,
			level: level.seed,
			obstacle: c.index + 1,
			object: c.kind,
			severity: c.chance === 0 ? "blocks" : "hard",
			cause: `${persona}, level ${level.seed}, obstacle ${c.index + 1} (${c.kind}): clears it first time ${pct$2(c.chance)}% of the time at ${speed}. The take-off window is ${Math.round(c.windowMs)} ms.`,
			repair: fix ? {
				change: "speed",
				to: fix.to,
				effect: `Offer ${fix.to} to this player: the chance rises from ${pct$2(c.chance)}% to ${pct$2(fix.chance)}%.`
			} : {
				change: "none",
				note: "No speed setting fixes this. It needs a design change to the obstacle, and a wider window would change the level for everyone, so it is not offered as a repair."
			}
		});
	}
	return out;
}
/** Run the reviewer personas over one level. */
function reviewLevel(kit, level, options = {}) {
	const speed = options.speed ?? kit.newProfile().speed;
	const min = options.minClearRate ?? .75;
	const findings = [];
	for (const spec of options.personas ?? DEFAULT_REVIEWERS) if (spec.kind === "deaf") findings.push(...perceptionFindings(kit, level, spec, "sight"));
	else {
		findings.push(...timingFindings(kit, level, spec, speed, min));
		if (spec.kind === "audio-only") findings.push(...perceptionFindings(kit, level, spec, "hearing"));
	}
	const passed = findings.length === 0;
	const first = findings[0];
	return {
		level: level.seed,
		speed,
		passed,
		findings,
		summary: passed ? `Level ${level.seed} at ${speed}: every reviewer can play it and perceive it.` : `Level ${level.seed} at ${speed}: ${findings.length} finding${findings.length === 1 ? "" : "s"}. First: ${first.cause}`
	};
}
/** Review many levels and gather the result. */
function reviewLevels(kit, levels, options = {}) {
	const reviews = levels.map((l) => reviewLevel(kit, l, options));
	const findings = reviews.flatMap((r) => r.findings);
	const clean = reviews.filter((r) => r.passed).length;
	return {
		reviewed: reviews.length,
		clean,
		findings,
		summary: `${clean} of ${reviews.length} levels have no findings.${findings[0] ? ` First: ${findings[0].cause}` : ""}`
	};
}
// ../../skeleton/src/report/index.ts
/** Take the worst result for each property across many runs: it passes only if it passed every time. */
function mergeProof(runs) {
	const merged = /* @__PURE__ */ new Map();
	for (const run of runs) for (const r of run) {
		const seen = merged.get(r.id);
		merged.set(r.id, {
			id: r.id,
			name: r.name,
			pass: (seen?.pass ?? true) && r.pass
		});
	}
	return [...merged.values()].sort((a, b) => a.id - b.id);
}
var TIMING_IDS = [
	1,
	2,
	3,
	4,
	5,
	6
];
var NAVIGATION_IDS = [
	201,
	202,
	203,
	204,
	205,
	206
];
function accessibilityReport(facts) {
	const on = (c) => facts.channels.includes(c);
	const byId = new Map(facts.proof.map((p) => [p.id, p]));
	const failing = facts.proof.filter((p) => !p.pass);
	const input = {
		keyboard: true,
		pointer: true,
		touch: true,
		gamepad: true,
		...facts.input
	};
	const failingAmong = (ids) => failing.find((p) => ids.includes(p.id));
	const timing = TIMING_IDS.some((id) => byId.has(id));
	const navigation = NAVIGATION_IDS.some((id) => byId.has(id));
	const finishableFailure = failingAmong([...TIMING_IDS, ...NAVIGATION_IDS]);
	const finishable = (timing || navigation) && !finishableFailure;
	const finishableWhy = finishable ? `${[timing ? "the timing proof (1 to 6)" : "", navigation ? byId.has(205) ? "the house proof, ritual included (201 to 206)" : "the house proof (201 to 204)" : ""].filter(Boolean).join(" and ")} passes, so it can be finished with one switch` : finishableFailure ? `proof property ${finishableFailure.id}${finishableFailure.name ? ` (${finishableFailure.name})` : ""} is failing` : "no finishability proof was given";
	const cuesFailure = failingAmong([13]);
	const sensesFailure = failingAmong([8]);
	const entries = [];
	const add = (tag, status, note) => void entries.push({
		tag,
		status,
		note
	});
	add("Multiple Volume Controls", on("sound") || on("speech") ? "check" : "no", on("sound") || on("speech") ? "Separate volumes exist for beeps and effects, for speech and for music. Wind and room tone share the music volume, so confirm that meets the tag’s separate ambient control." : "There is no sound or speech channel.");
	add("Mono Sound", on("sound") ? "supported" : "no", on("sound") ? "A mono option centres every sound." : "The sound channel is off.");
	add("Stereo Sound", !on("sound") ? "no" : !facts.spatialEvents ? "no" : cuesFailure ? "no" : "supported", !on("sound") ? "The sound channel is off." : !facts.spatialEvents ? "No important cue depends on where it comes from, so the tag does not apply." : cuesFailure ? "Proof property 13 (cues audible over the music) is failing." : "Placed sounds are panned left and right, and made quieter and duller with distance.");
	add("Surround Sound", !on("sound") ? "no" : !facts.directionalSound ? "no" : cuesFailure ? "no" : "supported", !on("sound") ? "The sound channel is off." : !facts.directionalSound ? "No cue is placed in every direction, so there is nothing a surround mix adds." : cuesFailure ? "Proof property 13 (cues audible over the music) is failing." : "Cues carry a direction all the way round, ahead and behind included, played with a 3D head-related panner where the browser has one.");
	add("Narrated Menus", on("speech") && facts.narratesMenus && !sensesFailure ? "supported" : "no", !on("speech") ? "The speech channel is off." : !facts.narratesMenus ? "The game’s menus are not spoken." : sensesFailure ? "Proof property 8 (every event reaches two senses) is failing." : "Menus and options are spoken, and every spoken line is also written to a live text region for screen readers. The voice can be turned off to avoid double speech.");
	add("Difficulty Levels", "no", "Speed changes the timing only. The tag asks for changes such as enemy health, damage or lives, which this kit does not offer.");
	add("Save Anytime", "no", "Not claimed. Progress is saved at the end of a stage, not at any moment.");
	add("Basic Input Remapping", "no", "Any key, click, tap or gamepad button is the switch, so there is nothing to remap. The tag asks for a remapping option, so it is not claimed.");
	add("Full Input Remapping", "no", "Not claimed, for the same reason as basic remapping.");
	add("Stick Inversion", "no", "Does not apply: there are no sticks to invert.");
	add("Playable without Button Holds", finishable ? "supported" : "no", finishable ? `Key repeat is ignored and no hold is ever needed; ${finishableWhy}.` : `Not claimed: ${finishableWhy}.`);
	add("Playable without Rapid Button Presses", finishable ? "supported" : "no", finishable ? `One press at a time with time between, and nothing to mash; ${finishableWhy}.` : `Not claimed: ${finishableWhy}.`);
	add("Playable with Keyboard Only", finishable && input.keyboard ? "supported" : "no", finishable && input.keyboard ? `Any key is the switch, and the menus are ordinary controls; ${finishableWhy}.` : `Not claimed: ${finishable ? "keyboard input is off" : finishableWhy}.`);
	add("Playable with Mouse Only", finishable && input.pointer ? "check" : "no", finishable && input.pointer ? "A click anywhere is the switch, but Escape (back to the menu) is a key. Confirm the whole game can be played with the mouse alone." : `Not claimed: ${finishable ? "pointer input is off" : finishableWhy}.`);
	add("Playable with Buttons Only", "no", "A gamepad button works as the switch during play, but the settings menus need a pointer or keyboard, so it is not claimed.");
	add("Playable with Touch Only", finishable && input.touch ? "check" : "no", finishable && input.touch ? "A tap anywhere is the switch, but Escape (back to the menu) is a key. Confirm the whole game can be played by touch alone." : `Not claimed: ${finishable ? "touch input is off" : finishableWhy}.`);
	add("Playable without Motion Controls", facts.usesMotionControls ? "no" : "supported", facts.usesMotionControls ? "The game uses motion controls." : "The game uses no motion controls.");
	add("Playable without Touch Controls", finishable && input.keyboard ? "supported" : "no", finishable && input.keyboard ? `It can be played with the keyboard, so touch is not needed; ${finishableWhy}.` : `Not claimed: ${finishable ? "keyboard input is off" : finishableWhy}.`);
	add("Chat Speech-to-Text & Text-to-Speech", "no", "Does not apply: there is no chat.");
	add("Clear Text", "check", "The font is Atkinson Hyperlegible with sans-serif fallbacks, and the themes meet 4.5:1 contrast. Confirm the default text height meets the tag (26 px at 1080p).");
	add("Large Text", "check", "A text size setting scales the text. Confirm it reaches the size the tag asks for.");
	add("Large & Clear Subtitles", on("captions") ? "check" : "no", on("captions") ? "Every spoken line is also written as a caption, with a size setting. The tag covers spoken dialogue and asks for an adjustable background and no overlap with the game; confirm both." : "The captions channel is off.");
	add("Color Alternatives", "check", "Information is carried by words and shapes as well as colour, and there is a colour-blind palette. Confirm no meaning rests on colour alone.");
	add("Camera Comfort", facts.cameraMotion ? "check" : "supported", facts.cameraMotion ? "The view has a moving camera. A reduced-motion setting cuts the glide and the head bob. Confirm it meets the tag." : "The game has a fixed camera and no camera control.");
	const supported = entries.filter((e) => e.status === "supported");
	const check = entries.filter((e) => e.status === "check");
	const notClaimed = entries.filter((e) => e.status === "no");
	const game = facts.game ?? "This game";
	const names = (list) => list.map((e) => e.tag).join(", ");
	const statement = `${game} supports these ESA Accessible Games Initiative tags: ${supported.length ? names(supported) : "none yet"}.` + (check.length ? ` It provides, but a person must confirm against the tag\u2019s criteria: ${names(check)}.` : "") + " This lists supported features. It is not a claim that the game is accessible to everyone, and it does not replace testing with disabled players.";
	const row = (e) => `| ${e.tag} | ${e.note.replace(/\|/g, "/")} |`;
	const table = (title, intro, list) => list.length ? `## ${title}\n\n${intro}\n\n| Tag | Why |\n|---|---|\n${list.map(row).join("\n")}\n` : `## ${title}\n\nNone.\n`;
	const proofLines = facts.proof.map((p) => `- ${p.pass ? "Pass" : "**FAIL**"}: ${p.id}${p.name ? ` ${p.name}` : ""}`);
	return {
		game,
		supported,
		check,
		notClaimed,
		statement,
		markdown: [
			`# Accessibility features: ${game}`,
			"",
			statement,
			"",
			table("Supported", "The kit guarantees these, and the proof properties behind them pass.", supported),
			table("Provided, to confirm", "The feature exists. The tag has criteria a person must check.", check),
			table("Not claimed", "Not built, not applicable, or a proof is failing.", notClaimed),
			"## Proof properties behind this list",
			"",
			proofLines.length ? proofLines.join("\n") : "No proof results were given, so no input tag is claimed.",
			"",
			"*Made from the kit’s guarantees, never by hand. Tags are the 24 of the ESA Accessible Games Initiative (2025).*",
			""
		].join("\n"),
		proof: [...facts.proof]
	};
}
/** Facts from a kit: its channels, and whether it places events in space or speaks its menu. Add what only the game knows. */
function factsFromKit(kit, proof, extras = {}) {
	const types = kit.events.list();
	return {
		channels: kit.channels.map((c) => c.id),
		proof,
		spatialEvents: types.some((t) => kit.events.presentation(t)?.spatial === true),
		narratesMenus: types.includes("menu") || types.includes("story-menu"),
		...extras
	};
}
// ../../skeleton/src/scale/index.ts
/** Most new spoken lines a player is given in any few seconds, by default. */
var DEFAULT_SPEECH_PACE = {
	lines: 3,
	seconds: 4
};
/**
* Property 18, speech a player can follow (Requirement 25.6): in any `seconds` of real time, no more
* than `lines` new spoken lines. Pass everything a stretch of play renders (a simulated flood of events
* is a good test), under the profile you care about, and the speed rate.
*/
function speechPace(commands, rate, pace = DEFAULT_SPEECH_PACE, label = "Game") {
	const times = commands.filter((c) => c.channel === "speech").map((c) => c.at / rate).sort((a, b) => a - b);
	const problems = [];
	for (let i = 0, j = 0; i < times.length; i++) {
		while (times[i] - times[j] >= pace.seconds) j++;
		const count = i - j + 1;
		if (count > pace.lines) {
			problems.push(`${label}: ${count} spoken lines within ${pace.seconds} seconds, from ${times[j].toFixed(1)} s. A player can follow about ${pace.lines}. Give the extra events a lower priority, or combine them.`);
			j = i;
		}
	}
	return proofResult(18, "Speech a player can follow", problems);
}
// ../../skeleton/src/menu/index.ts
var DWELLS = [
	1500,
	2200,
	3e3,
	4500,
	6500
];
var near = (a, b) => Math.abs(a - b) < 1e-6;
[
	"slow",
	"medium",
	"fast"
].map((s) => ({
	label: s.charAt(0).toUpperCase() + s.slice(1),
	patch: { speed: s },
	is: (p) => p.speed === s
})), DWELLS.map((ms) => ({
	label: `${ms / 1e3} seconds`,
	patch: { dwellMs: ms },
	is: (p) => p.dwellMs === ms
})), [
	1,
	1.5,
	2
].map((n) => ({
	label: n === 1 ? "Normal" : n === 1.5 ? "Large" : "Largest",
	patch: { textScale: n },
	is: (p) => near(p.textScale, n)
})), [
	0,
	1e3,
	2e3,
	3e3
].map((ms) => ({
	label: ms === 0 ? "Off" : `${ms / 1e3} ${ms === 1e3 ? "second" : "seconds"} early`,
	patch: { coachLeadMs: ms },
	is: (p) => p.coachLeadMs === ms
}));
// src/game.ts
/** A bad argument, in words a person can fix. */
var ArgumentError = class extends Error {};
function numberArg(value, name, opts = {}) {
	if (typeof value !== "number" || !Number.isFinite(value)) throw new ArgumentError(`'${name}' must be a number.`);
	if (opts.integer && !Number.isInteger(value)) throw new ArgumentError(`'${name}' must be a whole number.`);
	if (opts.min !== void 0 && value < opts.min) throw new ArgumentError(`'${name}' must be at least ${opts.min}.`);
	if (opts.max !== void 0 && value > opts.max) throw new ArgumentError(`'${name}' must be at most ${opts.max}.`);
	return value;
}
var isSquare = (v) => v >= 1 && Number.isInteger(Math.sqrt(v));
var smallest = (v) => {
	for (let f = 2; f * f <= v; f++) if (v % f === 0) return f;
	return v;
};
var isPrime = (v) => v >= 2 && smallest(v) === v;
function lessonFrom(config) {
	const [lo, hi] = config.values;
	const values = [numberArg(lo, "lesson.values[0]", { integer: true }), numberArg(hi, "lesson.values[1]", { integer: true })];
	const words = (config.tables ?? []).join(" or ");
	switch (config.rule) {
		case "multiples": {
			const tables = config.tables ?? [];
			if (tables.length === 0 || tables.some((n) => !Number.isInteger(n) || n < 2)) throw new ArgumentError("A 'multiples' lesson needs 'tables', whole numbers from 2 up.");
			return {
				title: `Multiples of ${words}`,
				prompt: `Jump on every multiple of ${words}.`,
				values,
				isTarget: (v) => tables.some((n) => v % n === 0)
			};
		}
		case "even": return {
			title: "Even numbers",
			prompt: "Jump on every even number.",
			values,
			isTarget: (v) => v % 2 === 0
		};
		case "odd": return {
			title: "Odd numbers",
			prompt: "Jump on every odd number.",
			values,
			isTarget: (v) => v % 2 !== 0
		};
		case "square": return {
			title: "Square numbers",
			prompt: "Jump on every square number.",
			values,
			isTarget: isSquare
		};
		case "prime": return {
			title: "Prime numbers",
			prompt: "Jump on every prime number.",
			values,
			isTarget: isPrime
		};
		default: throw new ArgumentError("lesson.rule must be one of 'multiples', 'even', 'odd', 'square' or 'prime'.");
	}
}
/** Build the kit for a game, refusing anything that cannot work in plain words. */
function buildKit(game = {}) {
	const obstacles = game.obstacles ?? [{
		name: "grave",
		width: [.16, .3]
	}, {
		name: "fence",
		width: [.12, .24]
	}];
	if (!Array.isArray(obstacles) || obstacles.length === 0) throw new ArgumentError("'obstacles' needs at least one obstacle.");
	if (obstacles.length > 20) throw new ArgumentError("'obstacles' can have at most 20 kinds.");
	const timing = game.timing ? {
		...game.timing,
		...game.timing.gap ? { gap: [game.timing.gap[0], game.timing.gap[1]] } : {}
	} : void 0;
	let kit;
	try {
		kit = createKit({
			...timing ? { timing } : {},
			...game.floorsMs ? { floorsMs: game.floorsMs } : {},
			...game.omitChannels ? { channels: { omit: game.omitChannels } } : {},
			...game.lesson ? { lesson: lessonFrom(game.lesson) } : {}
		});
		for (const o of obstacles) {
			if (typeof o.name !== "string" || o.name.trim() === "") throw new ArgumentError("Every obstacle needs a name.");
			if (!Array.isArray(o.width) || o.width.length !== 2) throw new ArgumentError(`Obstacle '${o.name}' needs width as [min, max] in running seconds.`);
			kit.defineObstacle(o.name, { width: [numberArg(o.width[0], `${o.name}.width[0]`, { min: .01 }), numberArg(o.width[1], `${o.name}.width[1]`, { min: .01 })] });
		}
	} catch (error) {
		if (error instanceof ArgumentError) throw error;
		throw new ArgumentError(error instanceof Error ? error.message : String(error));
	}
	return kit;
}
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
// ../../skeleton/src/advisor/palette.ts
var PALETTE_ROLES = [
	"cueLow",
	"cueHigh",
	"step",
	"reward",
	"danger",
	"tick",
	"fall",
	"ambience"
];
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
/**
* Proof for a palette (Requirement A3.2): every role has words and a sound; the two cues differ in
* pitch (by at least three semitones) and in timbre; and both sit above the music.
*/
function paletteProof(p, musicCeilingHz = 264) {
	const problems = [];
	const label = `Palette '${p.theme}'`;
	for (const role of PALETTE_ROLES) {
		const s = p.sounds[role];
		if (!s || !s.words.trim()) problems.push(`${label}: the ${role} sound has no words to describe it.`);
		else if (!(s.hz > 0) && !s.shape?.noise) problems.push(`${label}: the ${role} sound (${s.words}) has no pitch and is not noise, so it would be silent.`);
	}
	const { cueLow: lo, cueHigh: hi } = p.sounds;
	if (lo && hi) {
		if (lo.wave === hi.wave) problems.push(`${label}: both cues are ${lo.wave} waves. Two cues must differ in timbre as well as pitch.`);
		const semis = Math.abs(12 * Math.log2(hi.hz / lo.hz));
		if (!(semis >= 3)) problems.push(`${label}: the cues (${lo.words}, ${hi.words}) are only ${semis.toFixed(1)} semitones apart. They need at least 3.`);
		for (const c of [lo, hi]) if (c.hz < musicCeilingHz) problems.push(`${label}: the cue "${c.words}" is ${c.hz} Hz, inside the music's range (up to ${Math.round(musicCeilingHz)} Hz).`);
	}
	return proofResult(301, "Palette fits and can be told apart", problems);
}
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
// ../../skeleton/src/advisor/quality.ts
var SPEEDS$1 = [
	"slow",
	"medium",
	"fast"
];
var pct$1 = (x) => `${Math.round(x * 100)}%`;
var noisy = (sigmaMs) => ({
	kind: "noisy",
	sigmaMs
});
/** How a game's levels play, for simulated players with 150 and 250 ms of timing error, and by sound only. */
function qualityReport(kit, levels, title = "Game") {
	const tm = kit.timing;
	const proved = levels.filter((l) => kit.prove(l).every((r) => r.pass)).length;
	const bySpeed = {};
	for (const speed of SPEEDS$1) {
		const p150 = simulatePersona(levels, noisy(150), speed, tm);
		const p250 = simulatePersona(levels, noisy(250), speed, tm);
		const audio = simulatePersona(levels, { kind: "audio-only" }, speed, tm);
		const verdict = p250.meanClearRate >= .9 ? "good" : p250.meanClearRate >= .75 ? "hard" : "too hard";
		const reason = verdict === "good" ? `${pct$1(p250.meanClearRate)} of jumps cleared first time, even with 250 ms of timing error.` : `${pct$1(p250.meanClearRate)} of jumps cleared first time with 250 ms of timing error; ${pct$1(p250.cleanLevelRate)} of levels finished without a fall.`;
		bySpeed[speed] = {
			verdict,
			clear150: p150.meanClearRate,
			clear250: p250.meanClearRate,
			clean250: p250.cleanLevelRate,
			audioOnly: audio.meanClearRate,
			reason
		};
	}
	let quiet = 0;
	for (const l of levels) {
		let prev = 0;
		for (const o of l.obstacles) {
			quiet = Math.max(quiet, cueTimes(o, tm)[0] - prev);
			prev = idealPress(o, tm);
		}
	}
	const longestQuietSeconds = quiet / tm.rates.slow;
	const speechFollowable = levels.every((l) => speechPace(kit.renderLevel(l), tm.rates.fast).pass);
	const advice = [];
	if (proved < levels.length) advice.push(`${levels.length - proved} level(s) fail the proof and will be refused. Run kit.prove on them to see why.`);
	const hardest = SPEEDS$1.filter((s) => bySpeed[s].verdict !== "good");
	if (hardest.length > 0) advice.push(`${hardest.map((s) => s.charAt(0).toUpperCase() + s.slice(1)).join(" and ")} ${hardest.length === 1 ? "is" : "are"} hard for a player with 250 ms of timing error: offer timing help and the coach, and keep Slow as the default.`);
	if (SPEEDS$1.some((s) => bySpeed[s].audioOnly < bySpeed[s].clear150 - .05)) advice.push("Players by sound do worse than players by sight: check every cue is heard before it is needed.");
	if (longestQuietSeconds > 12) advice.push(`The longest wait with nothing to do is ${longestQuietSeconds.toFixed(0)} s at Slow: shorten rests, or give the wait something to listen to.`);
	if (!speechFollowable) advice.push("Speech comes faster than a player can follow at Fast: give lesser events a lower priority (proof 18).");
	if (advice.length === 0) advice.push("Nothing to change: every level proved, and it plays well at every speed for these players.");
	const markdown = [
		`# How ${title} plays`,
		"",
		`**${proved} of ${levels.length} levels passed every proof property.**`,
		"",
		"| Speed | Verdict | Jumps cleared, 150 ms error | Jumps cleared, 250 ms error | Levels clean, 250 ms | By sound only |",
		"|---|---|---|---|---|---|",
		...SPEEDS$1.map((s) => {
			const r = bySpeed[s];
			return `| ${s} | ${r.verdict} | ${pct$1(r.clear150)} | ${pct$1(r.clear250)} | ${pct$1(r.clean250)} | ${pct$1(r.audioOnly)} |`;
		}),
		"",
		`Longest wait with nothing to do: ${longestQuietSeconds.toFixed(1)} s at Slow. Speech a player can follow: ${speechFollowable ? "yes" : "no"}.`,
		"",
		"## What would help most",
		"",
		...advice.map((a) => `- ${a}`),
		"",
		"These numbers come from simulated players. They show whether a game can be finished and how it plays, not whether it is fun. Test with real players, including disabled players.",
		""
	].join("\n");
	return {
		levels: levels.length,
		proved,
		bySpeed,
		longestQuietSeconds,
		speechFollowable,
		advice,
		markdown
	};
}
// src/tools.ts
var SPEEDS = [
	"slow",
	"medium",
	"fast"
];
var MAX_LEVELS = 1e3;
var gameSchema = {
	type: "object",
	description: "The game to build levels for. Leave out for the default graveyard (grave and fence). obstacles: [{name, width: [min, max]}] in running seconds. lesson: {rule: multiples|even|odd|square|prime, tables?: [..], values: [lo, hi]} adds numbers on the obstacles. timing may change airtime, beat, halfWidth, gap, firstStart, obstaclesPerLevel, landingMargin.",
	properties: {
		obstacles: {
			type: "array",
			items: {
				type: "object",
				properties: {
					name: { type: "string" },
					width: {
						type: "array",
						items: { type: "number" },
						minItems: 2,
						maxItems: 2
					}
				},
				required: ["name", "width"]
			}
		},
		lesson: { type: "object" },
		timing: { type: "object" },
		floorsMs: { type: "object" }
	}
};
var asGame = (args) => {
	const game = args.game;
	if (game === void 0) return {};
	if (typeof game !== "object" || game === null || Array.isArray(game)) throw new ArgumentError("'game' must be an object.");
	return game;
};
var seedOf = (value, name = "seed") => numberArg(value, name, {
	integer: true,
	min: 0,
	max: 4294967295
});
function levelFromArgs(args, kit) {
	if (args.level !== void 0) {
		const raw = args.level;
		if (typeof raw !== "object" || raw === null || !Array.isArray(raw.obstacles)) throw new ArgumentError("'level' needs an 'obstacles' array.");
		if (raw.obstacles.length === 0 || raw.obstacles.length > 100) throw new ArgumentError("'level.obstacles' needs from 1 to 100 obstacles.");
		return {
			seed: raw.seed === void 0 ? 0 : seedOf(raw.seed, "level.seed"),
			obstacles: raw.obstacles.map((o, index) => {
				if (typeof o !== "object" || o === null || typeof o.kind !== "string") throw new ArgumentError(`Obstacle ${index + 1} needs a 'kind'.`);
				return {
					index,
					kind: o.kind,
					start: numberArg(o.start, `obstacles[${index}].start`, { min: 0 }),
					width: numberArg(o.width, `obstacles[${index}].width`, { min: .001 }),
					...o.value !== void 0 ? { value: numberArg(o.value, `obstacles[${index}].value`) } : {},
					...o.solid === false ? { solid: false } : {}
				};
			})
		};
	}
	const count = args.count === void 0 ? void 0 : numberArg(args.count, "count", {
		integer: true,
		min: 1,
		max: 100
	});
	return kit.generate(seedOf(args.seed), count ? { count } : {});
}
var describeResults = (results, label) => {
	const failing = results.filter((r) => !r.pass);
	if (failing.length === 0) return `${label} passes all ${results.length} properties. It can be finished with one switch.`;
	const first = failing[0];
	return `${label} FAILS ${failing.length} of ${results.length} properties. ${first.counterexample ?? first.name} It must not be served.`;
};
var resultRows = (results) => results.map((r) => ({
	id: r.id,
	name: r.name,
	pass: r.pass,
	failures: r.failures,
	...r.counterexamples ? { counterexamples: r.counterexamples.slice(0, 5) } : {}
}));
var generateLevelTool = {
	name: "generate_level",
	description: "Generate one level from a seed: the same seed always gives the same level. Returns each obstacle with its start, width, take-off window and ideal press, and the window in milliseconds at each speed.",
	inputSchema: {
		type: "object",
		properties: {
			seed: {
				type: "integer",
				minimum: 0
			},
			count: {
				type: "integer",
				minimum: 1,
				maximum: 100
			},
			game: gameSchema
		},
		required: ["seed"]
	},
	run(args) {
		const kit = buildKit(asGame(args));
		const level = kit.generate(seedOf(args.seed), args.count === void 0 ? {} : { count: numberArg(args.count, "count", {
			integer: true,
			min: 1,
			max: 100
		}) });
		const obstacles = level.obstacles.map((o) => {
			const w = takeoffWindow(o, kit.timing);
			return {
				index: o.index + 1,
				kind: o.kind,
				start: round(o.start),
				width: round(o.width),
				...o.value !== void 0 ? { value: o.value } : {},
				jump: isSolid(o),
				...isSolid(o) ? {
					takeoffFrom: round(w.a),
					takeoffTo: round(w.b),
					idealPress: round(idealPress(o, kit.timing)),
					windowMs: Object.fromEntries(SPEEDS.map((s) => [s, Math.round(windowMs(o, s, kit.timing))]))
				} : {}
			};
		});
		const jumps = obstacles.filter((o) => o.jump).length;
		return {
			text: `Level ${level.seed}: ${level.obstacles.length} obstacles, ${jumps} to jump. Times are running seconds; real time is running time divided by the speed rate.`,
			data: {
				seed: level.seed,
				obstacles
			}
		};
	}
};
var proveLevelTool = {
	name: "prove_level",
	description: "Run the proof on one level (by seed, or a hand-made level). Checks it can be finished with one switch, the cues are unambiguous, every object has sound, speech and caption, and the take-off windows are wide enough. A failure comes back as a plain-English counterexample. A level that fails must not be served.",
	inputSchema: {
		type: "object",
		properties: {
			seed: {
				type: "integer",
				minimum: 0
			},
			level: {
				type: "object",
				description: "A hand-made level: {seed?, obstacles: [{kind, start, width, value?, solid?}]}. Use instead of seed."
			},
			game: gameSchema
		}
	},
	run(args) {
		const kit = buildKit(asGame(args));
		const level = levelFromArgs(args, kit);
		const label = args.level !== void 0 ? "This level" : `Level ${level.seed}`;
		const results = kit.prove(level, label);
		const passed = results.every((r) => r.pass);
		return {
			text: describeResults(results, label),
			data: {
				passed,
				results: resultRows(results)
			}
		};
	}
};
var proveManyTool = {
	name: "prove_many",
	description: "Run the proof on a run of seeds, for example 200 levels, and report how many pass, which properties fail where, and the narrowest take-off window at each speed. This is the \"finishable with one switch\" number for a game.",
	inputSchema: {
		type: "object",
		properties: {
			from: {
				type: "integer",
				minimum: 0
			},
			count: {
				type: "integer",
				minimum: 1,
				maximum: MAX_LEVELS
			},
			game: gameSchema
		},
		required: ["count"]
	},
	run(args) {
		const kit = buildKit(asGame(args));
		const from = args.from === void 0 ? 1 : seedOf(args.from, "from");
		const count = numberArg(args.count, "count", {
			integer: true,
			min: 1,
			max: MAX_LEVELS
		});
		const failing = [];
		const perProperty = /* @__PURE__ */ new Map();
		const narrowest = {
			slow: Infinity,
			medium: Infinity,
			fast: Infinity
		};
		for (let i = 0; i < count; i++) {
			const seed = from + i;
			const level = kit.generate(seed);
			const results = kit.prove(level, `Level ${seed}`);
			for (const r of results) {
				const entry = perProperty.get(r.id) ?? {
					name: r.name,
					failed: 0
				};
				if (!r.pass) entry.failed += 1;
				perProperty.set(r.id, entry);
			}
			const bad = results.find((r) => !r.pass);
			if (bad) failing.push({
				seed,
				counterexample: bad.counterexample ?? bad.name
			});
			for (const o of level.obstacles.filter(isSolid)) for (const s of SPEEDS) narrowest[s] = Math.min(narrowest[s], windowMs(o, s, kit.timing));
		}
		const passing = count - failing.length;
		const windows = Object.fromEntries(SPEEDS.map((s) => [s, Number.isFinite(narrowest[s]) ? Math.round(narrowest[s]) : null]));
		return {
			text: `${passing} of ${count} levels (seeds ${from} to ${from + count - 1}) pass every property.` + (failing.length > 0 ? ` First failure: ${failing[0].counterexample}` : "") + ` Narrowest take-off window: ${windows.slow} ms at Slow, ${windows.medium} ms at Medium, ${windows.fast} ms at Fast.`,
			data: {
				levels: count,
				passing,
				failing: failing.slice(0, 20),
				properties: [...perProperty.entries()].map(([id, p]) => ({
					id,
					name: p.name,
					failedLevels: p.failed
				})),
				narrowestWindowMs: windows
			}
		};
	}
};
var DEFAULT_PERSONAS = [
	{ kind: "perfect" },
	{
		kind: "noisy",
		sigmaMs: 100
	},
	{
		kind: "noisy",
		sigmaMs: 150
	},
	{
		kind: "noisy",
		sigmaMs: 250
	},
	{ kind: "audio-only" }
];
function personasFrom(value) {
	if (value === void 0) return DEFAULT_PERSONAS;
	if (!Array.isArray(value) || value.length === 0 || value.length > 10) throw new ArgumentError("'personas' needs from 1 to 10 entries.");
	return value.map((p, i) => {
		if (p?.kind === "perfect") return { kind: "perfect" };
		if (p?.kind === "noisy") return {
			kind: "noisy",
			sigmaMs: numberArg(p.sigmaMs, `personas[${i}].sigmaMs`, {
				min: 0,
				max: 2e3
			})
		};
		if (p?.kind === "audio-only") return p.sigmaMs === void 0 ? { kind: "audio-only" } : {
			kind: "audio-only",
			sigmaMs: numberArg(p.sigmaMs, `personas[${i}].sigmaMs`, {
				min: 0,
				max: 2e3
			})
		};
		throw new ArgumentError(`personas[${i}].kind must be 'perfect', 'noisy' or 'audio-only'.`);
	});
}
var simulatePersonaTool = {
	name: "simulate_persona",
	description: "Playtest levels with simulated players, headless: a perfect one-switch player, players with timing error (100, 150, 250 ms by default) and an audio-only player who hears only the beeps. Returns the chance of clearing a jump on the first try, and of finishing a level without a fall, at each speed. Estimates only: it does not replace testing with disabled players.",
	inputSchema: {
		type: "object",
		properties: {
			from: {
				type: "integer",
				minimum: 0
			},
			count: {
				type: "integer",
				minimum: 1,
				maximum: 200
			},
			speeds: {
				type: "array",
				items: { enum: [
					"slow",
					"medium",
					"fast"
				] }
			},
			personas: {
				type: "array",
				items: {
					type: "object",
					properties: {
						kind: { enum: [
							"perfect",
							"noisy",
							"audio-only"
						] },
						sigmaMs: { type: "number" }
					},
					required: ["kind"]
				}
			},
			game: gameSchema
		}
	},
	run(args) {
		const kit = buildKit(asGame(args));
		const from = args.from === void 0 ? 1 : seedOf(args.from, "from");
		const count = args.count === void 0 ? 50 : numberArg(args.count, "count", {
			integer: true,
			min: 1,
			max: 200
		});
		const speeds = args.speeds === void 0 ? SPEEDS : args.speeds.map((s) => {
			if (s !== "slow" && s !== "medium" && s !== "fast") throw new ArgumentError("'speeds' may only hold 'slow', 'medium' and 'fast'.");
			return s;
		});
		const rows = personaReport(Array.from({ length: count }, (_, i) => kit.generate(from + i)), personasFrom(args.personas), speeds, kit.timing).map((r) => ({
			persona: r.persona,
			speed: r.speed,
			clearRate: pct(r.meanClearRate),
			cleanLevelRate: pct(r.cleanLevelRate),
			hardest: r.hardest
		}));
		return {
			text: `${count} levels, estimated:\n${rows.map((r) => `${r.persona} at ${r.speed}: ${r.clearRate}% of jumps cleared first try, ${r.cleanLevelRate}% of levels with no fall.`).join("\n")}`,
			data: {
				levels: count,
				from,
				rows
			}
		};
	}
};
var proveHouseTool = {
	name: "prove_house",
	description: "Prove a haunted house (the navigation pattern) can be escaped with one switch: the exit is reachable, the shortest route is never caught with spare steps, the phantom starts far enough away, and every passage works both ways. With relics, also that fetching them the best way and running the chase is never caught, and that relics and hiding places sit in reachable rooms.",
	inputSchema: {
		type: "object",
		properties: {
			seed: {
				type: "integer",
				minimum: 0
			},
			width: {
				type: "integer",
				minimum: 4,
				maximum: 30
			},
			height: {
				type: "integer",
				minimum: 4,
				maximum: 30
			},
			ghostEvery: {
				type: "integer",
				minimum: 1
			},
			margin: {
				type: "integer",
				minimum: 0
			},
			minGhostStart: {
				type: "integer",
				minimum: 0
			},
			relics: {
				type: "integer",
				minimum: 0,
				maximum: 5,
				description: "Relics to find before the exit opens (adds the ritual proof, 205 and 206)."
			}
		},
		required: ["seed"]
	},
	run(args) {
		const opt = (name, min, max) => args[name] === void 0 ? void 0 : numberArg(args[name], name, {
			integer: true,
			min,
			max
		});
		const seed = seedOf(args.seed);
		const options = Object.fromEntries(Object.entries({
			width: opt("width", 4, 30),
			height: opt("height", 4, 30),
			ghostEvery: opt("ghostEvery", 1, 10),
			margin: opt("margin", 0, 20),
			minGhostStart: opt("minGhostStart", 0, 60),
			relics: opt("relics", 0, 5)
		}).filter(([, v]) => v !== void 0));
		let results;
		try {
			results = proveMaze(generateMaze(seed, options), `House ${seed}`);
		} catch (error) {
			throw new ArgumentError(error instanceof Error ? error.message : String(error));
		}
		const passed = results.every((r) => r.pass);
		return {
			text: describeResults(results, `House ${seed}`),
			data: {
				passed,
				results: resultRows(results)
			}
		};
	}
};
var reviewersFrom = (value) => {
	if (value === void 0) return void 0;
	if (!Array.isArray(value) || value.length === 0 || value.length > 10) throw new ArgumentError("'personas' needs from 1 to 10 entries.");
	return value.map((p, i) => p?.kind === "deaf" ? { kind: "deaf" } : personasFrom([p])[0]);
};
var reviewLevelTool = {
	name: "review_level",
	description: "The persona reviewer loop. Simulated players with specific needs (perfect one-switch, timing error, audio-only, deaf) play a level and report every place a real player like them would fail or could not perceive a cue. Each finding names the player, level, object and cause in plain English. A repair is offered only to that player’s own settings (a slower speed); the level itself is never made easier. Give a seed, or a count of levels.",
	inputSchema: {
		type: "object",
		properties: {
			seed: {
				type: "integer",
				minimum: 0
			},
			count: {
				type: "integer",
				minimum: 1,
				maximum: 200,
				description: "Review this many levels starting at seed (default 1)."
			},
			speed: { enum: [
				"slow",
				"medium",
				"fast"
			] },
			personas: {
				type: "array",
				items: {
					type: "object",
					properties: {
						kind: { enum: [
							"perfect",
							"noisy",
							"audio-only",
							"deaf"
						] },
						sigmaMs: { type: "number" }
					},
					required: ["kind"]
				}
			},
			minClearRate: {
				type: "number",
				minimum: 0,
				maximum: 1
			},
			game: gameSchema
		}
	},
	run(args) {
		const kit = buildKit(asGame(args));
		const seed = args.seed === void 0 ? 1 : seedOf(args.seed);
		const count = args.count === void 0 ? 1 : numberArg(args.count, "count", {
			integer: true,
			min: 1,
			max: 200
		});
		const speed = args.speed === void 0 ? "slow" : args.speed;
		if (speed !== "slow" && speed !== "medium" && speed !== "fast") throw new ArgumentError("'speed' must be 'slow', 'medium' or 'fast'.");
		const personas = reviewersFrom(args.personas);
		const options = {
			speed,
			...personas ? { personas } : {},
			...args.minClearRate === void 0 ? {} : { minClearRate: numberArg(args.minClearRate, "minClearRate", {
				min: 0,
				max: 1
			}) }
		};
		if (count === 1) {
			const review = reviewLevel(kit, kit.generate(seed), options);
			return {
				text: review.summary,
				data: {
					passed: review.passed,
					speed: review.speed,
					findings: review.findings
				}
			};
		}
		const result = reviewLevels(kit, Array.from({ length: count }, (_, i) => kit.generate(seed + i)), options);
		return {
			text: result.summary,
			data: {
				reviewed: result.reviewed,
				clean: result.clean,
				findings: result.findings.slice(0, 30),
				totalFindings: result.findings.length
			}
		};
	}
};
var a11yReportTool = {
	name: "a11y_report",
	description: "The accessibility feature list, made from what the game actually guarantees: which channels are on and which proof properties pass. Maps to the 24 ESA Accessible Games Initiative tags as supported, provided-but-to-confirm, or not claimed (with the reason). Never claims a tag whose proof is failing or whose channel is off, and never says a game is fully accessible. Returns Markdown and JSON.",
	inputSchema: {
		type: "object",
		properties: {
			levels: {
				type: "integer",
				minimum: 1,
				maximum: 300,
				description: "How many levels to prove (default 50)."
			},
			navigation: {
				type: "boolean",
				description: "Also prove haunted houses (the navigation pattern)."
			},
			directionalSound: {
				type: "boolean",
				description: "Cues are placed all the way round (an angle), not just left and right."
			},
			spatialEvents: { type: "boolean" },
			narratesMenus: {
				type: "boolean",
				description: "The menus are spoken and written. Default true."
			},
			cameraMotion: { type: "boolean" },
			name: { type: "string" },
			game: gameSchema
		}
	},
	run(args) {
		const kit = buildKit(asGame(args));
		const count = args.levels === void 0 ? 50 : numberArg(args.levels, "levels", {
			integer: true,
			min: 1,
			max: 300
		});
		const levels = Array.from({ length: count }, (_, i) => kit.generate(i + 1));
		const proof = mergeProof(levels.map((l) => kit.prove(l)));
		proof.push({
			id: 13,
			name: "Cues audible over ambience",
			pass: levels.every((l) => cuesAudible(kit.renderLevel(l)).pass)
		});
		proof.push({
			id: kit.proveEvents().id,
			name: kit.proveEvents().name,
			pass: kit.proveEvents().pass
		});
		if (args.navigation === true) {
			const houses = Array.from({ length: 20 }, (_, i) => proveMaze(generateMaze(i + 1), `House ${i + 1}`));
			proof.push(...mergeProof(houses));
		}
		const flag = (name) => args[name] === void 0 ? void 0 : args[name] === true;
		const report = accessibilityReport(factsFromKit(kit, proof.sort((a, b) => a.id - b.id), {
			...typeof args.name === "string" ? { game: args.name } : {},
			...flag("directionalSound") !== void 0 ? { directionalSound: flag("directionalSound") } : {},
			...flag("spatialEvents") !== void 0 ? { spatialEvents: flag("spatialEvents") } : {},
			narratesMenus: args.narratesMenus === void 0 ? true : args.narratesMenus === true,
			...flag("cameraMotion") !== void 0 ? { cameraMotion: flag("cameraMotion") } : {}
		}));
		const failing = report.proof.filter((p) => !p.pass);
		return {
			text: `${report.statement}${failing.length ? ` Failing proof properties: ${failing.map((p) => p.id).join(", ")}.` : ""}`,
			data: {
				supported: report.supported,
				toConfirm: report.check,
				notClaimed: report.notClaimed,
				proof: report.proof,
				statement: report.statement,
				markdown: report.markdown
			}
		};
	}
};
var round = (n) => Math.round(n * 1e3) / 1e3;
var pct = (n) => Math.round(n * 1e3) / 10;
var textArg = (value, name) => {
	if (typeof value !== "string" || value.trim() === "") throw new ArgumentError(`'${name}' must be text.`);
	if (value.length > 5e4) throw new ArgumentError(`'${name}' is too long (50,000 characters at most).`);
	return value;
};
var TOOLS = [
	generateLevelTool,
	proveLevelTool,
	proveManyTool,
	simulatePersonaTool,
	reviewLevelTool,
	a11yReportTool,
	proveHouseTool,
	{
		name: "advise_game",
		description: "Suggest accessibility features for a game, in any engine, that fit its genre, theme and features. Give the brief (plain lines: Name, Genre, Theme, Controls, Engine, Players, and a Features list). Give the current plan (Markdown) too, and every decision and note in it is kept: new suggestions are marked new, and accepted ones that no longer fit are kept and marked. Returns the plan as Markdown, and what Marrow builds versus what the game must do by hand.",
		inputSchema: {
			type: "object",
			properties: {
				brief: { type: "string" },
				plan: {
					type: "string",
					description: "The current accessibility-plan.md, to keep its decisions."
				}
			},
			required: ["brief"]
		},
		run(args) {
			let brief;
			try {
				brief = parseBrief(textArg(args.brief, "brief"));
			} catch (error) {
				if (error instanceof BriefError) throw new ArgumentError(error.message);
				throw error;
			}
			const previous = args.plan === void 0 ? void 0 : parsePlan(textArg(args.plan, "plan"), brief);
			const plan = advise(brief, previous);
			const kinds = {
				"built-in": 0,
				"from-plan": 0,
				"by-hand": 0
			};
			for (const i of plan.items) kinds[i.how.kind] += 1;
			return {
				text: `${brief.name} (${brief.genre}, ${brief.theme}): ${plan.items.length} suggestions. ${kinds["built-in"]} are built into Marrow, ${kinds["from-plan"]} Marrow builds from the plan, ${kinds["by-hand"]} are for the game's own code.` + (plan.items.some((i) => i.isNew) ? ` New: ${plan.items.filter((i) => i.isNew).map((i) => i.id).join(", ")}.` : "") + (plan.items.some((i) => i.noLongerFits) ? ` No longer fit (kept): ${plan.items.filter((i) => i.noLongerFits).map((i) => i.id).join(", ")}.` : ""),
				data: {
					markdown: planMarkdown(plan),
					items: plan.items.map((i) => ({
						id: i.id,
						area: i.area,
						title: i.title,
						esa: i.esa,
						how: i.how.kind,
						decision: i.decision,
						isNew: i.isNew,
						noLongerFits: i.noLongerFits
					}))
				}
			};
		}
	},
	{
		name: "sound_palette",
		description: `The sounds that fit a theme (${THEMES.join(", ")}): two countdown cues, steps, a reward, danger, a menu tick, a fall and an ambience, each with words and a synthesis recipe. Every palette passes a proof: the cues differ in pitch and timbre and stay above the music.`,
		inputSchema: {
			type: "object",
			properties: { theme: { enum: [...THEMES] } },
			required: ["theme"]
		},
		run(args) {
			const theme = args.theme;
			if (!THEMES.includes(theme)) throw new ArgumentError(`'theme' must be one of: ${THEMES.join(", ")}.`);
			const p = PALETTES[theme];
			const proof = paletteProof(p);
			return {
				text: `${theme}: ${p.mood}\n${Object.entries(p.sounds).map(([role, s]) => `${role}: ${s.words}`).join("\n")}\nPalette proof: ${proof.pass ? "passed" : proof.counterexample}`,
				data: {
					palette: p,
					proof
				}
			};
		}
	},
	{
		name: "quality_report",
		description: "How a game plays, from proofs and simulated players: levels proved; jumps cleared first time with 150 and 250 ms of timing error and by sound only; levels finished clean; a verdict per speed; the longest wait; whether speech can be followed; and the change that would help most. It shows whether a game can be finished and how it plays, not whether it is fun.",
		inputSchema: {
			type: "object",
			properties: {
				from: {
					type: "integer",
					minimum: 0
				},
				count: {
					type: "integer",
					minimum: 1,
					maximum: 100
				},
				game: gameSchema
			}
		},
		run(args) {
			const kit = buildKit(asGame(args));
			const from = args.from === void 0 ? 1 : seedOf(args.from, "from");
			const count = args.count === void 0 ? 20 : numberArg(args.count, "count", {
				integer: true,
				min: 1,
				max: 100
			});
			const r = qualityReport(kit, Array.from({ length: count }, (_, i) => kit.generate(from + i)));
			return {
				text: `${r.proved} of ${r.levels} levels proved. Slow ${r.bySpeed.slow.verdict}, Medium ${r.bySpeed.medium.verdict}, Fast ${r.bySpeed.fast.verdict}.\n${r.advice.join("\n")}`,
				data: {
					markdown: r.markdown,
					bySpeed: r.bySpeed,
					longestQuietSeconds: r.longestQuietSeconds,
					speechFollowable: r.speechFollowable
				}
			};
		}
	}
];
// src/protocol.ts
var SERVER_INFO = {
	name: "marrow-level-forge",
	version: "0.1.0"
};
var SUPPORTED_VERSIONS = [
	"2025-06-18",
	"2025-03-26",
	"2024-11-05"
];
var ok = (id, result) => ({
	jsonrpc: "2.0",
	id,
	result
});
var fail = (id, code, message) => ({
	jsonrpc: "2.0",
	id,
	error: {
		code,
		message
	}
});
var isId = (v) => typeof v === "string" || typeof v === "number";
/** Answer one message. Returns nothing for a notification, which has no reply. */
function handle(message, tools = TOOLS) {
	if (typeof message !== "object" || message === null || Array.isArray(message)) return fail(null, -32600, "Invalid request: expected a JSON object.");
	const m = message;
	const hasId = isId(m.id);
	if (typeof m.method !== "string") return hasId ? fail(m.id, -32600, "Invalid request: missing 'method'.") : void 0;
	if (!hasId) return void 0;
	const id = m.id;
	const params = typeof m.params === "object" && m.params !== null ? m.params : {};
	switch (m.method) {
		case "initialize": {
			const asked = typeof params.protocolVersion === "string" ? params.protocolVersion : "";
			return ok(id, {
				protocolVersion: SUPPORTED_VERSIONS.includes(asked) ? asked : SUPPORTED_VERSIONS[0],
				capabilities: { tools: { listChanged: false } },
				serverInfo: SERVER_INFO,
				instructions: "Level Forge builds, proves and playtests Marrow levels. Use prove_level or prove_many before serving any level, and simulate_persona to estimate how likely real players are to clear it. A level that fails the proof must not be served."
			});
		}
		case "ping": return ok(id, {});
		case "tools/list": return ok(id, { tools: tools.map(({ name, description, inputSchema }) => ({
			name,
			description,
			inputSchema
		})) });
		case "tools/call": {
			const name = params.name;
			const tool = tools.find((t) => t.name === name);
			if (typeof name !== "string" || !tool) return fail(id, -32602, `Unknown tool '${String(name)}'.`);
			const args = typeof params.arguments === "object" && params.arguments !== null && !Array.isArray(params.arguments) ? params.arguments : {};
			try {
				const out = tool.run(args);
				return ok(id, {
					content: [{
						type: "text",
						text: `${out.text}\n\n${JSON.stringify(out.data, null, 2)}`
					}],
					structuredContent: out.data,
					isError: false
				});
			} catch (error) {
				return ok(id, {
					content: [{
						type: "text",
						text: error instanceof ArgumentError ? error.message : `Level Forge failed: ${error instanceof Error ? error.message : String(error)}`
					}],
					isError: true
				});
			}
		}
		default: return fail(id, -32601, `Method not found: ${m.method}`);
	}
}
/** Read lines from `input`, answer each on `output`. Returns when the input ends. */
async function serve(input, write, tools = TOOLS) {
	let buffer = "";
	const answer = (line) => {
		const text = line.trim();
		if (text === "") return;
		let message;
		try {
			message = JSON.parse(text);
		} catch {
			write(JSON.stringify(fail(null, -32700, "Parse error: that line is not JSON.")));
			return;
		}
		const batch = Array.isArray(message) ? message : [message];
		for (const one of batch) {
			const reply = handle(one, tools);
			if (reply) write(JSON.stringify(reply));
		}
	};
	for await (const chunk of input) {
		buffer += chunk.toString();
		let at;
		while ((at = buffer.indexOf("\n")) >= 0) {
			answer(buffer.slice(0, at));
			buffer = buffer.slice(at + 1);
		}
	}
	answer(buffer);
}
// src/main.ts
process.stdin.setEncoding("utf8");
serve(process.stdin, (line) => process.stdout.write(`${line}\n`)).catch((error) => {
	process.stderr.write(`Level Forge stopped: ${error instanceof Error ? error.message : String(error)}\n`);
	process.exitCode = 1;
});
export {};
