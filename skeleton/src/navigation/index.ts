export { generateMaze, DEFAULT_MAZE, phantomStart, phantomTurn, simulateRitual, pathBetween, PHANTOM_NOTICE, PHANTOM_LOSE_AFTER, openings, neighbour, distancesFrom, stepToward, fewestSteps, sameCell, indexOf, opposite, DIRS } from './maze';
export { proveMaze, proveRunLength } from './proof';
export { exploreHouse, estimateRunMs, runLengthWords, lineMs, DEFAULT_RUN_LINES, RUN_BAND, RUN_PROFILES, RUN_SPEEDS, RUN_DWELLS } from './explorer';
export type { ProveMazeOptions, RunLengthOptions } from './proof';
export type { Exploration, ExploreOptions, RunLines, RunProfile } from './explorer';
export { createWalk, walkResult, bearingFrom, resolveWalkSettings, DEFAULT_WALK_SETTINGS, NAV_EVENTS } from './walk';
export type { Maze, MazeOptions, Cell, Dir, PhantomState, PhantomNews } from './maze';
export type { Walk, WalkOptions, WalkSnapshot, WalkSettings, WalkSettingsInput } from './walk';
