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
  simulateRitual,
} from './navigation';
export type { PhantomState, PhantomNews } from './navigation';
export type { Maze, MazeOptions, Cell, Dir, Walk, WalkOptions, WalkSnapshot, WalkSettings, WalkSettingsInput } from './navigation';
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
export { cuesAudible, eventsReachTwoSenses, trackClearOfCues } from './proof';
export { validateTrack, trackCeilingHz, trackNotes, TRACK_SHARE, TRACK_LEVELS } from './channels';
export type { TrackSpec } from './channels';
export type { Acoustics, SoundRecipe } from './channels/audio';
export { withAcoustics } from './channels/audio';
export { barSeconds, generateSong, moveAt, sectionAt, sideBefore, validateSong } from './song';
export type { Song, SongSection, SongOptions } from './song';
export { gateWordsInTime, gatesHaveOneRightLane, portalsGiveWarning, restsAreRests, songProperties } from './proof';
export type { Feel, Level, LevelSection, Move, Obstacle, Portal, Timing } from './level';
export type { ProofResult, ProofProperty } from './proof';
export type { Attempt, SessionLog } from './log';
export type { Run, RunSnapshot } from './run';
export type { ThemeTokens } from './theme';
export type { ChannelId, Profile, SemanticEvent, OutputCommand, EventPresentation, Speed, SoundShape, SpeechMode, SpeechTone, Wave } from './types';
