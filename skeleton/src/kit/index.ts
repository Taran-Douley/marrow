import {
  EVENT_TYPES,
  createChannels,
  createStrings,
  phrase,
  renderEvent,
  type AudioOptions,
  type PhraseKey,
} from '../channels';
import { createEventRegistry, type EventRegistry } from '../events';
import { generateLevel, resolveTiming, type Level, type Timing } from '../level';
import { lessonPools, type Lesson } from '../lesson';
import {
  LevelRefused,
  eventsReachTwoSenses,
  lessonProperty,
  prove,
  songProperties,
  type ProofProperty,
  type ProofResult,
} from '../proof';
import { defaultProfile, mergeProfile } from '../profile';
import {
  createRegistry,
  type ObjectDef,
  type ObjectOptions,
  type ObstacleOptions,
  type Registry,
  type Voice,
} from '../registry';
import type { Attempt } from '../log';
import { createRun, maxScore, rankOf, resolveRunSettings, type Run, type RunSettingsInput } from '../run';
import { levelEvents } from '../schedule';
import { generateSong, validateSong, type Song } from '../song';
import type {
  Channel,
  ChannelId,
  EventPresentation,
  OutputCommand,
  Profile,
  ProfilePatch,
  SemanticEvent,
  Speed,
} from '../types';

/**
 * Every choice the game's developer can make, in one place. Leave out anything
 * you do not want to change. The player's own choices live in the Profile.
 */
export interface KitConfig {
  /** Your jump, beat, gaps and speeds. Default: the values in tech.md. */
  timing?: Partial<Timing>;
  /** Your wording or a translation, by line name. */
  strings?: Partial<Record<PhraseKey, string>>;
  /** Your own sounds for objects that do not set one. */
  voices?: readonly Voice[];
  /** Your own vibration patterns, in the same order as the voices. */
  haptics?: readonly (readonly number[])[];
  /** The profile a new player starts with. */
  defaults?: ProfilePatch;
  /** Your own game events, and how each is presented. */
  events?: Record<string, EventPresentation>;
  /** Swap a built-in channel for yours, or leave one out. */
  channels?: { omit?: readonly ChannelId[]; replace?: Partial<Record<ChannelId, Channel>> };
  /** Your own minimum take-off window per speed, in ms. */
  floorsMs?: Partial<Record<Speed, number>>;
  /** Your own proof properties, run after the built-in ones. */
  properties?: readonly ProofProperty[];
  /** How a fall plays out, and how timing is scored: restart point, rest time, grace, points, ranks. */
  run?: RunSettingsInput;
  /**
   * Make the game a lesson: obstacles carry numbers, some are targets to jump on
   * the beat and the rest are to be let pass, and mistakes are explained.
   */
  lesson?: Lesson;
  /** The sound world: switch wind, pad, approach tone or effects off, or change the key. */
  audio?: AudioOptions;
  /**
   * Build levels from a song: busy parts close together, calm parts spaced out, rests with nothing to
   * press, and portals where a press changes from jump to flip or to switching lanes at number gates.
   * Adds proofs 15, 16 and 103.
   */
  song?: Song;
}

/** One line the game can speak, so a creator knows exactly what to record or generate. */
export interface ScriptLine {
  text: string;
  /** True when the line has {slots} filled in at play time, so it cannot be a fixed recording. */
  template: boolean;
  /** Where it comes from, for the person recording. */
  from: string;
}

/** What `kit.run` needs from your game. */
export interface KitRunOptions {
  level: Level;
  speed: Speed;
  picture?: boolean;
  startReal: number;
  emit(event: SemanticEvent, now: number): void;
  onAttempt?(attempt: Attempt): void;
  onRestart?(levelTime: number): void;
  /** Timing help: a press any time in the countdown counts, and the move is made on the fourth beat. */
  assist?: boolean;
}

export interface Kit {
  readonly lesson: Lesson | undefined;
  readonly song: Song | undefined;
  readonly timing: Timing;
  readonly registry: Registry;
  readonly events: EventRegistry;
  readonly channels: readonly Channel[];
  /** A fresh profile for a new player, with your defaults applied. */
  newProfile(): Profile;
  /** Something the player must get past. It has a width. */
  defineObstacle(name: string, options: ObstacleOptions): ObjectDef;
  /** Anything else that should be seen, heard and felt: an enemy, a coin, a landmark. */
  defineObject(name: string, options?: ObjectOptions): ObjectDef;
  /**
   * Check that every event this game can emit reaches at least two senses under
   * a profile (proof property 8). Works for any genre.
   */
  proveEvents(profile?: Profile): ProofResult;
  /** A level from your obstacles. Define at least one first. */
  generate(seed: number, options?: { count?: number }): Level;
  /** The countdown events for a level, on level time. */
  levelEvents(level: Level): SemanticEvent[];
  /** What the player should perceive for one event, under a profile. */
  render(event: SemanticEvent, profile?: Profile): OutputCommand[];
  prove(level: Level, label?: string): ProofResult[];
  /** The level if it passes, otherwise throws LevelRefused. */
  refuseIfFailing(level: Level, label?: string): Level;
  /** Play a level: one press jumps, a fall is explained, play restarts just before the obstacle. */
  run(options: KitRunOptions): Run;
  /** How well a score did: S, A, B or C, as a share of the best possible score for this level. */
  rank(level: Level, score: number): { rank: 'S' | 'A' | 'B' | 'C'; fraction: number; best: number };
  /** Everything a level would show, say and sound under a profile, in time order. Useful for tests and proofs. */
  renderLevel(level: Level, profile?: Profile): OutputCommand[];
  /** Every line the game can speak. Record these, or send them to a voice service, then plug the audio in. */
  lineScript(): ScriptLine[];
}

export function createKit(config: KitConfig = {}): Kit {
  const timing = resolveTiming(config.timing);
  const strings = createStrings(config.strings);
  const registry = createRegistry({
    ...(config.voices ? { voices: config.voices } : {}),
    ...(config.haptics ? { haptics: config.haptics } : {}),
  });

  const events = createEventRegistry();
  for (const [type, presentation] of Object.entries(config.events ?? {})) events.define(type, presentation);

  const channels = createChannels(registry, {
    strings,
    events,
    ...(config.channels?.omit ? { omit: config.channels.omit } : {}),
    ...(config.channels?.replace ? { replace: config.channels.replace } : {}),
    // A track keeps time with the countdown: one slot is half a beat, unless the game says otherwise.
    audio: { trackSlot: timing.beat / 2, ...config.audio },
  });

  const newProfile = (): Profile => mergeProfile(defaultProfile(), config.defaults ?? {});
  const lesson = config.lesson;
  if (lesson) lessonPools(lesson); // refuse a lesson that cannot work, now, in plain words
  if (config.song) validateSong(config.song, [], lesson, { kindsLater: true });
  const runSettings = resolveRunSettings(config.run);
  // A lesson adds its own check: every number is in range and is solid exactly when it is a target.
  const song = config.song;
  const extra: readonly ProofProperty[] = [
    ...(lesson ? [lessonProperty(lesson)] : []),
    ...(song ? songProperties(lesson) : []),
    ...(config.properties ?? []),
  ];
  const proofInput = (label?: string) => ({
    objects: registry,
    timing,
    ...(label !== undefined ? { label } : {}),
    ...(config.floorsMs ? { floorsMs: config.floorsMs } : {}),
    ...(extra.length > 0 ? { extra } : {}),
  });

  return {
    lesson,
    song,
    timing,
    registry,
    events,
    channels,
    newProfile,
    defineObstacle: (name, options) => registry.define(name, options),
    defineObject: (name, options) => registry.define(name, options),
    proveEvents(profile = newProfile()) {
      // Example data for each event, so every {slot} and every position has something to work with.
      const object = registry.names()[0] ?? 'object';
      const where = { x: 0.5, distance: 0.5 };
      const builtIn: SemanticEvent[] = [
        { type: EVENT_TYPES.approaching, at: 0, data: { object, first: true, span: 1.2 } },
        ...[1, 2, 3, 4].map((beat) => ({ type: EVENT_TYPES.beat, at: 0, data: { object, beat } })),
        { type: EVENT_TYPES.cleared, at: 0, data: { object } },
        { type: EVENT_TYPES.jumped, at: 0 },
        { type: EVENT_TYPES.landed, at: 0 },
        { type: EVENT_TYPES.fallReason, at: 0, data: { reason: 'early' } },
        { type: EVENT_TYPES.fallReason, at: 0, data: { reason: 'wrong', explain: 'Example.' } },
        { type: EVENT_TYPES.judged, at: 0, data: { grade: 'perfect', streak: 5, score: 100, points: 100 } },
        { type: EVENT_TYPES.judged, at: 0, data: { grade: 'ok', streak: 1, score: 30, points: 30 } },
        { type: EVENT_TYPES.passed, at: 0, data: { object, streak: 1, score: 50, points: 50 } },
        { type: EVENT_TYPES.hurt, at: 0 },
        { type: EVENT_TYPES.levelComplete, at: 0 },
        ...(song ? (['jump', 'flip', 'switch'] as const).map((move) => ({ type: EVENT_TYPES.portal, at: 0, data: { move } })) : []),
      ];
      const own: SemanticEvent[] = events
        .list()
        .map((type) => ({ type, at: 0, data: { object, ...where, angle: 45, label: 'Example', summary: 'Example.' } }));
      // Atmosphere carries no information, so there is nothing to miss: skip what the developer marks that way.
      const decorative = [EVENT_TYPES.atmosphere, ...events.list().filter((t) => events.presentation(t)?.decorative)];
      return eventsReachTwoSenses([...builtIn, ...own], (event) => renderEvent(event, profile, channels), decorative);
    },
    generate(seed, options = {}) {
      const kinds = registry.kinds();
      if (kinds.length === 0) throw new Error('Define at least one obstacle before generating a level.');
      // A song decides how many obstacles there are and where: it fills the song.
      if (song) return generateSong(seed, song, { kinds, timing, ...(lesson ? { lesson } : {}) });
      return generateLevel(seed, {
        kinds,
        timing,
        ...(options.count !== undefined ? { count: options.count } : {}),
        ...(lesson ? { lesson } : {}),
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
    run: ({ assist, ...options }) =>
      createRun({
        ...options,
        timing,
        events: levelEvents(options.level, timing),
        ...(config.run || assist !== undefined ? { settings: { ...config.run, ...(assist !== undefined ? { assist } : {}) } } : {}),
        // Mistakes teach: a wrong press and a missed target each get the lesson's own words.
        ...(lesson
          ? {
              explain: ({ value, solid }, reason) =>
                reason === 'wrong'
                  ? lesson.explainWrong?.(value)
                  : reason === 'none' && solid
                    ? lesson.explainMiss?.(value)
                    : undefined,
            }
          : {}),
      }),
    rank(level, score) {
      const best = maxScore(level, runSettings);
      const fraction = best <= 0 ? 0 : Math.min(1, score / best);
      return { rank: rankOf(fraction, runSettings), fraction, best };
    },
    renderLevel: (level, profile = newProfile()) =>
      levelEvents(level, timing).flatMap((event) => renderEvent(event, profile, channels)),
    lineScript() {
      const lines = new Map<string, ScriptLine>();
      const add = (text: string, from: string): void => {
        if (!lines.has(text)) lines.set(text, { text, template: /\{\w+\}/.test(text), from });
      };
      // "Grave ahead." is said only for obstacles; other objects are spoken through your own events.
      for (const kind of registry.kinds()) {
        add(phrase('approaching', { name: registry.get(kind.name)!.say }, strings), `${kind.name}, the first time it appears`);
      }
      for (const key of ['fallEarly', 'fallLate', 'fallNone', 'hurt', 'levelComplete', 'perfect'] as const) {
        add(phrase(key, {}, strings), key);
      }
      if (lesson) {
        // The number, the wrong-press line and the streak call-out are said while playing a lesson.
        add(phrase('fallWrong', {}, strings), 'fallWrong');
        add(strings.number, 'the number on each obstacle');
        add(strings.streak, 'a streak of five or ten');
      }
      if (song) {
        const moves = new Set(song.sections.map((s) => s.move).filter((m) => m !== undefined));
        if (moves.has('jump') || moves.size > 0) add(phrase('portalJump', {}, strings), 'a portal back to jump mode');
        if (moves.has('flip')) add(phrase('portalFlip', {}, strings), 'a portal to flip mode');
        if (moves.has('switch')) {
          add(phrase('portalSwitch', {}, strings), 'a portal to gate mode');
          add(strings.gate, 'each number gate');
        }
      }
      for (const [type, presentation] of Object.entries(config.events ?? {})) {
        if (presentation.say) add(presentation.say.charAt(0).toUpperCase() + presentation.say.slice(1), `event '${type}'`);
      }
      return [...lines.values()];
    },
  };
}
