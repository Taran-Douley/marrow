
# Structure

Skeleton Crew rule: the repository must contain **two separate folders for the two separate applications**. The `/.kiro` directory must stay at the repository root and must never be gitignored.

```
/
├── .kiro/
│   ├── steering/        product.md, tech.md, structure.md, accessibility.md, kiroween-rules.md
│   ├── specs/           one folder per spec (created by Kiro)
│   ├── hooks/           created by Kiro from natural-language requests
│   └── agents/          custom agents (level-designer, accessibility-reviewer, playtester)
├── skeleton/            the Marrow core library (TypeScript)
│   ├── src/input/  src/scanning/  src/cues/  src/speech/  src/captions/
│   ├── src/registry/  src/level/  src/proof/  src/personas/  src/log/
│   ├── src/events/  src/profile/  src/channels/  src/reviewer/  src/a11y-report/
│   ├── src/adapters/web/   (the only adapter shipped; core never imports from adapters)
│   └── test/            unit and property-based tests
├── apps/
│   ├── ghastly-moves/   story-driven rhythm game: stones in src/objects/, maths and stages in src/stages.ts, tracks in src/tracks.ts, map in src/map.ts
│   └── seance-escape/   3D haunted-house escape played by scanning: kit in src/kit.ts, 3D world in src/world.ts and src/view3d.ts
├── power/
│   └── marrow/          the Kiro power (Agent Plugins 1.0); generated parts rebuilt by scripts/build-power.mjs; templates/starter is the Bat Dash starter game made by `npm run new-game`
├── scripts/             build-power.mjs, check-claims.mjs
├── mcp/
│   └── level-forge/     local MCP server: generate_level, prove_level, prove_many, simulate_persona, review_level, a11y_report, prove_house
├── docs/
│   ├── architecture.md   quickstart.md  make your own game
│   ├── proof-report.md  index; proof-report-<app>.md written by tests, rewritten by a hook
│   └── kiro-usage-log.md  appended after each spec task (raw material for the write-up and blog)
├── private/             gitignored: ideation history, strategy, kickoff prompts
├── LICENSE              MIT
└── README.md
```

Conventions:
- Apps depend on the skeleton only through its public API: `@marrow/skeleton` (`skeleton/src/index.ts`) and the web adapter entry `@marrow/skeleton/web` (`skeleton/src/adapters/web/index.ts`). No app reaches into skeleton internals. The core never imports from `adapters/`, which is why the web adapter has its own entry.
- Each app adds only object declarations, content and art. If an app needs a new behaviour, it goes into the skeleton.
- Every new object or content file must pass the proof before it is merged.
- The public API also has `@marrow/skeleton/vite`, `@marrow/skeleton/catalogue` and `@marrow/skeleton/advisor`. `scripts/check-imports.mjs` enforces the rule in CI and in `npm test`.
- An object is one file in `apps/<game>/src/objects/` with `export default preset(...)`. `scripts/wire-objects.mjs` (run by the wire-new-object hook) writes `objects/index.generated.ts`, `test/objects.generated.test.ts` and `docs/objects-<game>.md`, then runs the proof.
- `examples/hello/` is the smallest game: one `createGame` call. `skeleton/src/catalogue/` holds the ready-made objects; `docs/catalogue.md` is made from it.
- `npm run setup` (`scripts/setup.mjs`) goes from a fresh clone to both games open.
- Each game may have a `brief.md` and an `accessibility-plan.md` beside it. `npm run advise` (`scripts/advise.mjs`, the bundled advisor in `power/marrow/mcp/advisor.mjs`) makes and builds plans; `skeleton/src/advisor/` is the advisor itself, exported as `@marrow/skeleton/advisor`. Spec: `.kiro/specs/marrow-advisor/`.
- A separate public repository will hold the Kiro Crew app (overnight Level Forge) for the Best Kiro Crew App bonus, under the same GitHub account.
