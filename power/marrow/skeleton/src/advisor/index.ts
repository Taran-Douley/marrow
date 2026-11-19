// The Marrow accessibility advisor: describe the game, get a plan that fits it, decide, build, prove.
// Pure TypeScript with no screen or engine, so the plan works for any game.

export { BriefError, GENRES, THEMES, briefTemplate, parseBrief } from './brief';
export type { Brief, Genre, Theme } from './brief';
export { AREAS, RULE_IDS, contextOf, suggestionsFor } from './suggestions';
export type { Area, BuildKey, How, Suggestion } from './suggestions';
export { CUE_FLOOR_HZ, PALETTES, PALETTE_ROLES, paletteProof } from './palette';
export type { Palette, PaletteRole, PaletteSound } from './palette';
export { accepted, advise, parsePlan, planMarkdown } from './plan';
export type { Decision, Plan, PlanItem } from './plan';
export { assistByDefault, buildFromPlan, generatedModule } from './build';
export type { Built } from './build';
export { qualityReport } from './quality';
export type { QualityReport, Verdict } from './quality';
