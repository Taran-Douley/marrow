// Marrow public API. Apps import only from here (see structure.md).
// The surface grows task by task; design.md section 4 is the target.
export { createKit } from './kit';
export { generateLevel, resolveTiming, takeoffWindow, idealPress, windowMs, isSolid, cueTimes, MOVES } from './level';
export { defaultProfile } from './profile';
export { defineObstacle, createRegistry } from './registry';
export { prove, refuseIfFailing, proofResult, LevelRefused } from './proof';
export { createSessionLog } from './log';
export { EVENT_TYPES } from './channels';
export { themeFor, contrastRatio } from './theme';
export { mergeProfile } from './profile';
export { createScanner, scanningAudible, speechMs, dwellFor } from './scanning';
export type { Scanner, ScanOption, ScannerOptions } from './scanning';
export {
  generateMaze,
  proveMaze,
  createWalk,
  walkResult,
  resolveWalkSettings,
  DEFAULT_WALK_SETTINGS,
  DEFAULT_MAZE,
  NAV_EVENTS,
  fewestSteps,
  indexOf,
  openings,
  distancesFrom,
  bearingFrom,
  pathBetween,
  phantomStart,
  phantomTurn,
  phantomHears,
  simulateRitual,
  NOISE,
  hearRadius,
  noiseBand,
  INVESTIGATE_EXTRA,
  NOISE_MEMORY,
  ROOM_EVENTS,
  EVENT_CHANCE,
  EVENT_FLICKER_MAX_HZ,
  rollRoomEvent,
  proveRunLength,
  exploreHouse,
  estimateRunMs,
  runLengthWords,
  lineMs,
  DEFAULT_RUN_LINES,
  RUN_BAND,
  RUN_PROFILES,
  RUN_SPEEDS,
  RUN_DWELLS,
} from './navigation';
export type { RoomEventDef, RoomEventEffect, NoiseBand, PhantomState, PhantomNews, ProveMazeOptions, RunLengthOptions, Exploration, ExploreOptions, RunLines, RunProfile } from './navigation';
export type { Maze, MazeOptions, HouseLayout, Cell, Dir, Walk, WalkOptions, WalkSnapshot, WalkSettings, WalkSettingsInput } from './navigation';
export {
  aimTimes,
  normalCdf,
  obstacleChances,
  personaName,
  personaReport,
  playOnce,
  simulatePersona,
} from './personas';
export type { ObstacleChance, PersonaReport, PersonaSpec } from './personas';
export { DEFAULT_REVIEWERS, reviewLevel, reviewLevels } from './reviewer';
export type { Finding, Repair, Review, ReviewOptions, ReviewerSpec } from './reviewer';
export { ESA_TAGS, accessibilityReport, factsFromKit, mergeProof } from './report';
export type { AccessibilityFacts, AccessibilityReport, EsaTag, TagEntry, TagStatus } from './report';
export type { KitConfig, Kit, ScriptLine } from './kit';
export type { Lesson } from './lesson';
export type { AudioOptions } from './channels';
export { cuesAudible, eventsReachTwoSenses, trackClearOfCues, linesInScript, noHoldOrChord, noUnsafeFlashing, repairsKeepTheLevel, themesHaveContrast } from './proof';
export { validateTrack, trackCeilingHz, trackNotes, TRACK_SHARE, TRACK_LEVELS } from './channels';
export type { TrackSpec } from './channels';
export type { Acoustics, SoundRecipe } from './channels/audio';
export { withAcoustics } from './channels/audio';
export { coachInTime } from './proof';
export { DEFAULT_SPEECH_PACE, nearest, speechPace } from './scale';
export { coachTimes, wordsHoldMs } from './run';
export { MAX_PULSES_PER_SECOND, PULSE_MAX_ALPHA, pulseAt, pulsesPerSecond } from './pulse';
export { RETRY_LIMIT_MS, lockedToTheSong, pulsesGentle, retryDelays, retryInTime } from './proof';
export type { CoachLine } from './run';
export { BACK_ID, PROFILE_SETTINGS, SETUP_CHOICES, createMenuStack, applySetting, applySetup, createMenu, entryLabel, menuAudible, profileEntries, setupEntries } from './menu';
export type { Menu, MenuStack, MenuStackOptions, MenuChoice, MenuEntry, MenuLit, MenuOptions, MenuResult } from './menu';
export { barSeconds, generateSong, moveAt, sectionAt, sideBefore, validateSong } from './song';
export type { Song, SongSection, SongOptions } from './song';
export { gateWordsInTime, gatesHaveOneRightLane, portalsGiveWarning, restsAreRests, songProperties } from './proof';
export type { Feel, Level, LevelSection, Move, Obstacle, Portal, Timing } from './level';
export type { ProofResult, ProofProperty } from './proof';
export type { Attempt, SessionLog } from './log';
export type { Run, RunSnapshot } from './run';
export type { ThemeTokens } from './theme';
export type { ChannelId, Profile, ProfilePatch, SemanticEvent, OutputCommand, EventPresentation, Speed, SoundShape, SpeechMode, SpeechTone, AnnounceLevel, Priority, Wave } from './types';
