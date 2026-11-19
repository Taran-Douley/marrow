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
	fallReason: "fall-reason"
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
	const melodyFade = 1 - .8 * Math.min(1, Math.max(0, w.tension));
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
		if (kc !== "." && (w.tension > .2 || bar % 2 === 0)) {
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
		if (spec.hat && w.tension >= .35) {
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
				offset: dataNumber(event, "pulse") ?? 0
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
	streak: "{streak} in a row"
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
		default: return;
	}
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
		render(event) {
			const speak = (text) => [{
				channel: "speech",
				senses: ["hearing"],
				at: event.at,
				text
			}];
			const custom = customOf(ctx, event);
			if (custom) return custom.say === void 0 ? [] : speak(fillSlots(custom.say, slotsOf(event)));
			if (event.type === EVENT_TYPES.approaching) {
				const value = dataNumber(event, "value");
				if (value !== void 0) return speak(phrase("number", { value: String(value) }, ctx.strings));
				if (!dataBool(event, "first")) return [];
				const name = ctx.objects.get(dataString(event, "object") ?? "")?.say ?? dataString(event, "object");
				return name === void 0 ? [] : speak(phrase("approaching", { name }, ctx.strings));
			}
			if (event.type === EVENT_TYPES.judged) {
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
		render(event) {
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
			if (custom) return custom.caption === void 0 ? [] : show(fillSlots(custom.caption, slotsOf(event)));
			const value = dataNumber(event, "value");
			if (event.type === EVENT_TYPES.beat) {
				const beat = beatOf(event);
				if (beat === void 0) return [];
				if (beat === 4) return show(phrase(value === void 0 ? "pressNow" : "yourMove", {}, ctx.strings), 4);
				const object = dataString(event, "object") ?? "";
				return show(value === void 0 ? ctx.objects.get(object)?.caption ?? object : String(value), beat);
			}
			if (event.type === EVENT_TYPES.approaching) {
				const object = dataString(event, "object") ?? "";
				return show(value === void 0 ? ctx.objects.get(object)?.caption ?? object : String(value));
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
			if (event.type === EVENT_TYPES.cleared || event.type === EVENT_TYPES.jumped || event.type === EVENT_TYPES.fallReason || event.type === EVENT_TYPES.judged || event.type === EVENT_TYPES.passed) return marker();
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
var EPS = 1e-9;
/** Floors from tech.md (property 5). Medium has no floor in the spec. A game can pass its own. */
var WINDOW_FLOOR_MS = {
	slow: 650,
	fast: 400
};
var secs = (n) => n.toFixed(2);
var timingOf = (input) => resolveTiming(input.timing);
function describer(level, input) {
	const label = input.label ?? `Level ${level.seed}`;
	return {
		full: (o) => `${label}, obstacle ${o.index + 1} (${o.kind}, ${secs(o.width)} s wide)`,
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
		if (b < a - EPS) problems.push(`${d.full(o)}: no take-off point clears it. One jump covers only ${secs(tm.airtime - 2 * tm.halfWidth)} s.`);
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
		if (b < a - EPS) {
			lands = a + tm.airtime;
			return;
		}
		const takeoff = Math.max(a, lands);
		if (takeoff > b + EPS) {
			const prev = level.obstacles[i - 1];
			problems.push(`${d.short(o)}: after the earliest possible jump over obstacle ${prev.index + 1}, the player lands at ${secs(lands)} s, but the take-off window closes at ${secs(b)} s.`);
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
		if (lead < tm.landingMargin - EPS) {
			const when = lead < 0 ? `${secs(-lead)} s before the player lands from the jump over obstacle ${prev.index + 1}` : `only ${secs(lead)} s after the player lands from the jump over obstacle ${prev.index + 1}`;
			problems.push(`${d.short(o)}: the countdown starts ${when}. It needs at least ${secs(tm.landingMargin)} s.`);
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
		if (ms < floor - EPS) problems.push(`${d.full(o)}: the take-off window is only ${Math.round(Math.max(0, ms))} ms at ${cap(speed)}. The floor is ${floor} ms.`);
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
		if (press < a - EPS || press > b + EPS) problems.push(`${d.full(o)}: pressing on the fourth beat at ${secs(press)} s misses the take-off window (${secs(a)} s to ${secs(b)} s).`);
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
var SPEEDS$1 = [
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
		setupDone: false
	};
}
/** Apply a patch without mutating the base. Nested volume/channels merge. */
function mergeProfile(base, patch) {
	const { volume, channels, ...rest } = patch;
	return {
		...base,
		...stripUndefined$2(rest),
		volume: {
			...base.volume,
			...stripUndefined$2(volume ?? {})
		},
		channels: {
			...base.channels,
			...stripUndefined$2(channels ?? {})
		}
	};
}
function stripUndefined$2(obj) {
	return Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== void 0));
}
// ../../skeleton/src/run/index.ts
var DEFAULT_RUN_SETTINGS = {
	restartLead: 1,
	fallPause: 2,
	lateGrace: .6,
	lookahead: .25,
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
		...stripUndefined$1(rest),
		scoring: {
			...base.scoring,
			...stripUndefined$1(scoring ?? {}),
			points: {
				...base.scoring.points,
				...stripUndefined$1(scoring?.points ?? {})
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
			if (nowReal >= recoverAt) {
				restart();
				step();
			}
			return;
		}
		t += dtReal * rate;
		step();
	};
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
			if (t < plan.a) return fall("early", t);
			if (t > plan.b) return fall("late", t);
			const how = grade(t, plan);
			attempt("cleared", t);
			jumpedAt = t;
			lastJumpAt = t;
			landedSent = false;
			airborneUntil = t + timing.airtime;
			options.emit({
				type: EVENT_TYPES.jumped,
				at: t,
				data: { index: i }
			}, t);
			const { points } = earn(scoring.points[how]);
			options.emit({
				type: EVENT_TYPES.judged,
				at: t,
				data: {
					grade: how,
					index: i,
					streak,
					score,
					points
				}
			}, t);
		},
		snapshot: () => ({
			phase,
			t,
			obstacle: i,
			jumpedAt,
			lastJumpAt,
			score,
			streak,
			bestStreak
		})
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
var numbered = (value) => value === void 0 ? {} : { value };
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
				...numbered(o.value)
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
					...numbered(o.value)
				}
			});
		});
	}
	const last = level.obstacles.at(-1);
	if (last) {
		const presses = level.obstacles.map((o) => idealPress(o, timing));
		const end = last.start + last.width + timing.halfWidth + 2;
		for (let bar = 0; bar * 2 <= end; bar++) {
			const at = bar * 2;
			const next = presses.find((p) => p > at);
			const tension = next === void 0 ? .1 : Math.max(0, Math.min(1, 1 - (next - at) / TENSION_RUN_UP));
			const reach = at + 2.5;
			const quiet = presses.map((p) => [p - 3 * timing.beat - QUIET_LEAD, p + QUIET_TAIL]).filter(([from, to]) => to > at && from < reach);
			const pulse = (presses[0] % timing.beat + timing.beat) % timing.beat;
			events.push({
				type: EVENT_TYPES.atmosphere,
				at,
				data: {
					bar,
					tension,
					span: 2,
					quiet,
					pulse
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
	const runSettings = resolveRunSettings(config.run);
	const extra = [...lesson ? [lessonProperty(lesson)] : [], ...config.properties ?? []];
	const proofInput = (label) => ({
		objects: registry,
		timing,
		...label !== void 0 ? { label } : {},
		...config.floorsMs ? { floorsMs: config.floorsMs } : {},
		...extra.length > 0 ? { extra } : {}
	});
	return {
		lesson,
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
				}
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
		run: (options) => createRun({
			...options,
			timing,
			events: levelEvents(options.level, timing),
			...config.run ? { settings: config.run } : {},
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
var pct$1 = (n) => Math.round(n * 100);
function reviewerName(spec) {
	return spec.kind === "deaf" ? "deaf player (sight only)" : personaName(spec);
}
var SPEED_ORDER = [...SPEEDS$1];
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
			cause: `${persona}, level ${level.seed}, obstacle ${c.index + 1} (${c.kind}): clears it first time ${pct$1(c.chance)}% of the time at ${speed}. The take-off window is ${Math.round(c.windowMs)} ms.`,
			repair: fix ? {
				change: "speed",
				to: fix.to,
				effect: `Offer ${fix.to} to this player: the chance rises from ${pct$1(c.chance)}% to ${pct$1(fix.chance)}%.`
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
var TOOLS = [
	generateLevelTool,
	proveLevelTool,
	proveManyTool,
	simulatePersonaTool,
	reviewLevelTool,
	a11yReportTool,
	proveHouseTool
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
