# Design: the Marrow accessibility advisor

## Shape

```
brief.md ──parseBrief──▶ Brief ──advise──▶ Plan ──planMarkdown──▶ accessibility-plan.md
                                  ▲                                  │  the developer ticks,
                                  └────────── parsePlan ◀────────────┘  rejects, adds notes
accepted Plan ──buildFromPlan──▶ accessibility.generated.ts ──▶ createKit / createGame
built kit ──qualityReport──▶ quality report (proofs + bot players)
```

All of it is pure TypeScript in `skeleton/src/advisor/`, with no DOM and no engine. That is why the plan works for any game.

## Parts

| File | Job |
|---|---|
| `advisor/brief.ts` | `parseBrief(text)`, the genre and theme lists, and plain-English errors. |
| `advisor/suggestions.ts` | `SUGGESTIONS`: rules, each with an id, area, title, why, helps, guideline, how (`built-in`, `from-plan`, `by-hand`), and `applies(brief)`. Some read the genre; some match words in the features. |
| `advisor/palette.ts` | `PALETTES` for haunted, space, forest, underwater and neutral. Each role has a sound recipe and words. `paletteProof` checks cues differ in pitch and timbre and stay above the music ceiling. |
| `advisor/plan.ts` | `advise(brief, previous?)` merges decisions by id. `planMarkdown` and `parsePlan` round-trip. Statuses: undecided, accepted, rejected; flags: new, no longer fits. |
| `advisor/build.ts` | `buildFromPlan(plan, brief)` returns `{ kit, profile, todo }`. `kit` is a `KitConfig` patch (voices from the palette, event sounds, coach). `profile` holds the defaults (announce level, assist). `generatedModule()` writes it as a TypeScript file. |
| `advisor/quality.ts` | `qualityReport(kit, levels)`: proofs, persona clear rates per speed, clean-level rate, longest quiet, and speech pace, with verdicts and the most helpful change. |

## Kiro

| Piece | Where |
|---|---|
| CLI | `scripts/advise.mjs` runs the bundled advisor (`power/marrow/mcp/advisor.mjs`): `advise <brief>` writes the plan next to it, merging decisions; `build <brief>` writes `accessibility.generated.ts`; `quality <game>` prints the report. |
| MCP tools | `advise_game`, `sound_palette` and `quality_report` in Level Forge, for any engine. |
| Agent | `.kiro/agents/accessibility-designer.md`: talks the plan through, suggests themed alternatives, edits only what is agreed, then runs `build` and `quality`. |
| Hook | `.kiro/hooks/advise-on-brief.json`: when a `brief.md` is saved, run `advise` so the plan follows the game. |
| Power | The skill tells Kiro to ask for a brief first and keep the plan current; `new-game` writes a starter brief and plan. |

## Decisions

- **Rules, not a model, decide the suggestions.** They are then the same every time, they are testable, and they can name their guideline. The agent adds judgement and talk on top.
- **Ids are stable.** That is how decisions survive a change of brief.
- **Building only touches settings.** The plan never edits game logic. Hand-built items stay to-dos, so nothing is claimed that was not done.
- **Bots judge "can be finished" and "how it plays", never "fun".** The report says so.

## Testing

Unit and property tests: brief parsing and errors; every suggestion has words, a guideline and a how; genre and feature triggers; palettes pass their proof; plan round-trip over random decisions (property-based); merge keeps decisions; the build passes the game's proofs; quality-report verdicts on known kits.
