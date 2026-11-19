import { VOICE_TABLE } from '../registry';
import type {
  Channel,
  ChannelId,
  EventPresentation,
  OutputCommand,
  Profile,
  SemanticEvent,
  SpeechMode,
  SpeechTone,
  Wave,
} from '../types';
import { DEFAULT_AUDIO, directionWords, placementOf, voiceOf, worldSound, type AudioOptions } from './audio';
import { EVENT_TYPES, beatOf, dataBool, dataNumber, dataString, type FallReason } from './events';
import { createStrings, fillSlots, phrase, type PhraseKey, type Strings } from './phrases';
import { validateTrack } from './track';

export { EVENT_TYPES } from './events';
export { PHRASES, PHRASE_KEYS, createStrings, phrase } from './phrases';
export type { PhraseKey, Strings } from './phrases';

/** What a channel needs to know about an object type. Registry entries fit this. */
export interface ObjectView {
  say: string;
  caption: string;
  sound: { hz: number; wave: Wave };
  haptic?: readonly number[];
}

export interface ObjectLookup {
  get(name: string): ObjectView | undefined;
}

export interface ChannelOptions {
  /** Your wording or translation. Build with createStrings. */
  strings?: Strings;
  /** Presentations for your own events. An EventRegistry fits this. */
  events?: { presentation(type: string): EventPresentation | undefined };
  /** Sound used for an object that is not defined. Default: the first default voice. */
  fallbackSound?: { hz: number; wave: Wave };
  /** Swap a built-in channel for your own, by id. */
  replace?: Partial<Record<ChannelId, Channel>>;
  /** Leave a built-in channel out. The proof will tell you if an event then reaches fewer than two senses. */
  omit?: readonly ChannelId[];
  /** Switch parts of the sound world on or off, or change its key. */
  audio?: AudioOptions;
}

const BUILT_IN_EVENTS = new Set<string>(Object.values(EVENT_TYPES));

const FALL_PHRASE: Record<FallReason, PhraseKey> = {
  early: 'fallEarly',
  late: 'fallLate',
  none: 'fallNone',
  wrong: 'fallWrong',
};

const fallReasonOf = (event: SemanticEvent): FallReason => {
  const reason = dataString(event, 'reason');
  return reason === 'early' || reason === 'late' || reason === 'wrong' ? reason : 'none';
};

const GRADE_PHRASE = { perfect: 'perfect', good: 'good', ok: 'ok' } as const;
const gradeOf = (event: SemanticEvent): keyof typeof GRADE_PHRASE =>
  dataString(event, 'grade') === 'perfect' ? 'perfect' : dataString(event, 'grade') === 'good' ? 'good' : 'ok';

/** Text slots for your own events: every string or number in the event's data. */
function slotsOf(event: SemanticEvent): Record<string, string> {
  // {side} and {range} come from the event's x and distance, unless the game sets its own.
  const slots: Record<string, string> = { ...directionWords(event) };
  for (const [key, value] of Object.entries(event.data ?? {})) {
    if (typeof value === 'string' || typeof value === 'number') slots[key] = String(value);
  }
  return slots;
}

interface Context {
  objects: ObjectLookup;
  strings: Strings;
  events: ChannelOptions['events'];
  fallback: { hz: number; wave: Wave };
  audio: Required<AudioOptions>;
}

/** The presentation of one of the developer's own events, if it is not a built-in one. */
function customOf(ctx: Context, event: SemanticEvent): EventPresentation | undefined {
  return BUILT_IN_EVENTS.has(event.type) ? undefined : ctx.events?.presentation(event.type);
}

/** Words for built-in events that are not about one object: speech and captions share them. */
function plainLine(ctx: Context, event: SemanticEvent): string | undefined {
  switch (event.type) {
    case EVENT_TYPES.fallReason: {
      // The reason in plain words, then what to learn from it, if the game has something to teach.
      const reason = phrase(FALL_PHRASE[fallReasonOf(event)], {}, ctx.strings);
      const lesson = dataString(event, 'explain');
      return lesson ? `${reason} ${lesson}` : reason;
    }
    case EVENT_TYPES.cleared:
      return phrase('cleared', {}, ctx.strings);
    case EVENT_TYPES.hurt:
      return phrase('hurt', {}, ctx.strings);
    case EVENT_TYPES.levelComplete:
      return phrase('levelComplete', {}, ctx.strings);
    case EVENT_TYPES.menuOption:
      return dataString(event, 'label');
    case EVENT_TYPES.portal: {
      const move = dataString(event, 'move');
      return phrase(move === 'flip' ? 'portalFlip' : move === 'switch' ? 'portalSwitch' : 'portalJump', {}, ctx.strings);
    }
    default:
      return undefined;
  }
}

/** A gate's two numbers in words: "7 or 12?" spoken, "Stay 7 · Switch 12" shown. Undefined when the event is not a gate. */
function gateWords(ctx: Context, event: SemanticEvent, key: 'gate' | 'gateCaption' = 'gate'): string | undefined {
  const here = dataNumber(event, 'here');
  const there = dataNumber(event, 'value');
  if (here === undefined || there === undefined) return undefined;
  return phrase(key, { here: String(here), there: String(there) }, ctx.strings);
}

/** Sound: the countdown beeps, one voice per object type. Beat 4 is silent: that is the press. */
function soundChannel(ctx: Context): Channel {
  return {
    id: 'sound',
    render(event, profile) {
      const custom = customOf(ctx, event);
      if (custom?.sound) {
        // A creator's own event. If it is placed in space, pan it, and make it quieter and duller with distance.
        const spot = custom.spatial ? placementOf(event) : undefined;
        const shape = { ...custom.sound.shape, ...(spot ? { filterHz: spot.filterHz } : {}) };
        return [
          {
            channel: 'sound',
            senses: ['hearing'],
            at: event.at,
            role: custom.sound.role ?? 'cue',
            hz: custom.sound.hz,
            wave: custom.sound.wave,
            gain: (custom.sound.gain ?? 1) * profile.volume.cues * (spot?.gainScale ?? 1),
            pan: profile.mono ? 0 : (spot?.pan ?? 0),
            ...(Object.keys(shape).length > 0
              ? { shape: profile.mono ? { ...shape, panTo: undefined } : shape }
              : {}),
            ...(spot?.space && !profile.mono ? { space: spot.space } : {}),
          },
        ];
      }
      // A lit menu entry: a soft tick, so a highlight moving is heard before its words.
      if (event.type === EVENT_TYPES.menuOption) {
        return [{ channel: 'sound', senses: ['hearing'], at: event.at, role: 'effect', hz: 660, wave: 'sine', gain: 0.35 * profile.volume.cues, pan: 0, shape: { hzTo: 720, seconds: 0.06 } }];
      }
      // A portal is a long rising sweep, unlike any beep, so a change of move is heard before it is said.
      if (event.type === EVENT_TYPES.portal) {
        const move = dataString(event, 'move');
        const top = move === 'flip' ? 1320 : move === 'switch' ? 990 : 660;
        return [
          {
            channel: 'sound',
            senses: ['hearing'],
            at: event.at,
            role: 'effect',
            hz: 220,
            wave: 'triangle',
            gain: 0.8 * profile.volume.cues,
            pan: 0,
            shape: { hzTo: top, filterHz: 900, filterTo: 3000, seconds: 0.9 },
          },
        ];
      }
      // A clear is a short rising chime, not speech: a spoken "Cleared." would
      // talk over the next countdown. Task 10 builds the full reward sound.
      if (event.type === EVENT_TYPES.cleared) {
        return [
          {
            channel: 'sound',
            senses: ['hearing'],
            at: event.at,
            role: 'reward',
            hz: 880,
            wave: 'sine',
            gain: profile.volume.cues,
            pan: 0,
          },
        ];
      }
      const voice = voiceOf(event, ctx.objects, ctx.fallback);
      if (event.type !== EVENT_TYPES.beat) return worldSound(event, profile, ctx.audio, voice);
      const beat = beatOf(event);
      if (beat === undefined || beat === 4) return [];
      return [
        {
          channel: 'sound',
          senses: ['hearing'],
          at: event.at,
          role: 'cue',
          hz: voice.hz,
          wave: voice.wave,
          gain: profile.volume.cues,
          pan: 0,
        },
      ];
    },
  };
}

/**
 * Speech: always produced. The adapter writes it to the aria-live text every
 * time and speaks it aloud only when profile.voice is on (Requirements 4.1, 4.2).
 */
function speechChannel(ctx: Context): Channel {
  return {
    id: 'speech',
    render(event) {
      const speak = (text: string, mode?: SpeechMode, tone?: SpeechTone): OutputCommand[] => [
        {
          channel: 'speech',
          senses: ['hearing'],
          at: event.at,
          text,
          ...(mode ? { mode } : {}),
          ...(mode === 'latest' ? { key: event.type } : {}),
          ...(tone ? { tone } : {}),
        },
      ];
      const custom = customOf(ctx, event);
      if (custom) return custom.say === undefined ? [] : speak(fillSlots(custom.say, slotsOf(event)), custom.speech, custom.voice);
      // A scanning label never makes the voice fall behind the highlight.
      if (event.type === EVENT_TYPES.menuOption) {
        const label = dataString(event, 'label');
        return label === undefined ? [] : speak(label, 'latest');
      }

      if (event.type === EVENT_TYPES.approaching) {
        // A gate: both numbers, yours first. The player chooses.
        const gate = gateWords(ctx, event);
        if (gate) return speak(gate);
        // A lesson's number is spoken every time: it is the question.
        const value = dataNumber(event, 'value');
        if (value !== undefined) return speak(phrase('number', { value: String(value) }, ctx.strings));
        // Otherwise the name is spoken the first time only; later the beeps are enough.
        if (!dataBool(event, 'first')) return [];
        const name = ctx.objects.get(dataString(event, 'object') ?? '')?.say ?? dataString(event, 'object');
        return name === undefined ? [] : speak(phrase('approaching', { name }, ctx.strings));
      }
      if (event.type === EVENT_TYPES.judged) {
        // Speech stays rare so it never talks over the next countdown: only a perfect, or a streak of five.
        const streak = dataNumber(event, 'streak') ?? 0;
        if (streak > 0 && streak % 5 === 0) return speak(phrase('streak', { streak: String(streak) }, ctx.strings));
        return gradeOf(event) === 'perfect' ? speak(phrase('perfect', {}, ctx.strings)) : [];
      }
      // "Cleared" is a sound and a caption, never speech (it would talk over the next countdown).
      if (event.type === EVENT_TYPES.cleared) return [];
      const line = plainLine(ctx, event);
      return line === undefined ? [] : speak(line);
    },
  };
}

/** Captions: the object's name, and four pips for the countdown (Requirement 5). */
function captionsChannel(ctx: Context): Channel {
  return {
    id: 'captions',
    render(event) {
      const show = (text: string, pip?: 1 | 2 | 3 | 4): OutputCommand[] => [
        pip === undefined
          ? { channel: 'captions', senses: ['sight'], at: event.at, text }
          : { channel: 'captions', senses: ['sight'], at: event.at, text, pip },
      ];
      const custom = customOf(ctx, event);
      if (custom) return custom.caption === undefined ? [] : show(fillSlots(custom.caption, slotsOf(event)));

      // In a lesson the caption is the number, and the fourth beat must not say "press now".
      const value = dataNumber(event, 'value');
      if (event.type === EVENT_TYPES.beat) {
        const beat = beatOf(event);
        if (beat === undefined) return [];
        if (beat === 4) return show(phrase(value === undefined ? 'pressNow' : 'yourMove', {}, ctx.strings), 4);
        const object = dataString(event, 'object') ?? '';
        const gate = gateWords(ctx, event, 'gateCaption');
        return show(gate ?? (value === undefined ? (ctx.objects.get(object)?.caption ?? object) : String(value)), beat);
      }
      if (event.type === EVENT_TYPES.approaching) {
        const object = dataString(event, 'object') ?? '';
        const gate = gateWords(ctx, event, 'gateCaption');
        return show(gate ?? (value === undefined ? (ctx.objects.get(object)?.caption ?? object) : String(value)));
      }
      if (event.type === EVENT_TYPES.judged) return show(phrase(GRADE_PHRASE[gradeOf(event)], {}, ctx.strings));
      const line = plainLine(ctx, event);
      return line === undefined ? [] : show(line);
    },
  };
}

/**
 * Visual sound indicator: a marker for every sound cue, so a deaf player sees
 * each beep. With reduced motion it is steady, not flashing (Requirements 3a.6, 5.6).
 */
function indicatorChannel(ctx: Context): Channel {
  return {
    id: 'indicator',
    render(event, profile) {
      const marker = (): OutputCommand[] => [
        { channel: 'indicator', senses: ['sight'], at: event.at, flash: !profile.reducedMotion },
      ];
      const custom = customOf(ctx, event);
      if (custom) return custom.sound ? marker() : [];

      // The clear chime, the jump whoosh and the stumble are sounds too, so each lights the marker.
      if (
        event.type === EVENT_TYPES.cleared ||
        event.type === EVENT_TYPES.jumped ||
        event.type === EVENT_TYPES.fallReason ||
        event.type === EVENT_TYPES.judged ||
        event.type === EVENT_TYPES.passed ||
        event.type === EVENT_TYPES.portal ||
        event.type === EVENT_TYPES.menuOption
      ) {
        return marker();
      }
      if (event.type !== EVENT_TYPES.beat) return [];
      const beat = beatOf(event);
      return beat === undefined || beat === 4 ? [] : marker();
    },
  };
}

/** Haptics: a vibration for every beep, in the object's own pattern, so touch carries the same cue. */
function hapticsChannel(ctx: Context): Channel {
  return {
    id: 'haptics',
    render(event) {
      const buzz = (pattern: readonly number[]): OutputCommand[] =>
        pattern.length === 0 ? [] : [{ channel: 'haptics', senses: ['touch'], at: event.at, pattern: [...pattern] }];

      const custom = customOf(ctx, event);
      if (custom) return custom.haptic === undefined ? [] : buzz(custom.haptic);

      // The body hears what the ears hear: a tap for the jump, a thump for the landing, a long buzz for a fall.
      if (event.type === EVENT_TYPES.jumped) return buzz([40]);
      if (event.type === EVENT_TYPES.landed) return buzz([30]);
      if (event.type === EVENT_TYPES.fallReason) return buzz([250]);
      if (event.type === EVENT_TYPES.portal) return buzz([40, 40, 40, 40, 120]);
      if (event.type === EVENT_TYPES.menuOption) return buzz([15]);
      if (event.type === EVENT_TYPES.judged) return gradeOf(event) === 'perfect' ? buzz([30, 30, 30]) : [];

      if (event.type !== EVENT_TYPES.beat) return [];
      const beat = beatOf(event);
      if (beat === undefined) return [];
      // The press itself is a short tap, so the moment to act is felt as well as seen.
      if (beat === 4) return buzz([60]);
      return buzz(ctx.objects.get(dataString(event, 'object') ?? '')?.haptic ?? []);
    },
  };
}

/**
 * The channels for a game. Change anything through `options`: your own words,
 * your own events, a channel swapped for yours, or a channel left out.
 */
export function createChannels(objects: ObjectLookup, options: ChannelOptions = {}): Channel[] {
  if (options.audio?.track) validateTrack(options.audio.track); // refuse a track that could hide the beeps, now, in plain words
  const ctx: Context = {
    objects,
    strings: options.strings ?? createStrings(),
    events: options.events,
    fallback: options.fallbackSound ?? { hz: VOICE_TABLE[0]!.hz, wave: VOICE_TABLE[0]!.wave },
    audio: { ...DEFAULT_AUDIO, ...stripUndefinedAudio(options.audio ?? {}) },
  };
  const builtIn: Channel[] = [
    soundChannel(ctx),
    speechChannel(ctx),
    captionsChannel(ctx),
    indicatorChannel(ctx),
    hapticsChannel(ctx),
  ];
  const omitted = new Set(options.omit ?? []);
  return builtIn
    .filter((channel) => !omitted.has(channel.id))
    .map((channel) => options.replace?.[channel.id] ?? channel);
}

function stripUndefinedAudio(options: AudioOptions): AudioOptions {
  return Object.fromEntries(Object.entries(options).filter(([, v]) => v !== undefined)) as AudioOptions;
}

export { BAR_SECONDS, BED_SHARE, DEFAULT_AUDIO } from './audio';
export { TRACK_LEVELS, TRACK_SHARE, trackCeilingHz, trackNotes, validateTrack } from './track';
export type { TrackSpec } from './track';
export type { AudioOptions } from './audio';

/** Render one event through every channel the profile has turned on. */
export function renderEvent(event: SemanticEvent, profile: Profile, channels: readonly Channel[]): OutputCommand[] {
  return channels.filter((c) => profile.channels[c.id]).flatMap((c) => c.render(event, profile));
}
