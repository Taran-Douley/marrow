# Tasks — marrow-core

Order is a vertical slice first: get something a real player can try, then
widen. Dates assume a feature freeze on **Mon 30 Nov**. After the freeze: fix
bugs and record only. Each task ends with its tests passing. After each task,
append a short entry to `docs/kiro-usage-log.md`.

Notation: `_Req_` = requirements covered. `(PBT)` = fast-check property test.

**Kit rule for every task below (Req 22.9).** Before ticking a task, check the
feature is switchable, configured through `KitConfig`, worded through
`Strings`, and listed in `docs/customisation.md`. Marrow is a kit other
developers build into their own games; nothing may be hard-wired to ours.

---

## Milestone 1 — Core and a playable slice (18–20 Nov)

- [x] 1. Project setup
  - Create `skeleton/` (TypeScript strict, Vite, Vitest, fast-check), root
    `package.json`/workspaces, `LICENSE` (MIT), CI that runs tests.
  - Add the import-boundary test: core must not import from `adapters/`.
  - _Req 20.1, 20.5, 13.4_

- [x] 2. Types, profile and event bus
  - `types.ts`, `profile/` (defaults, OS-preference merge, serialise),
    `events/` (bus, `defineEvent`).
  - _Req 3a.1, 3a.3, 11.1, 11.2_

- [x] 3. Level generator and timing model
  - `level/`: mulberry32, generator, window `[a,b]`, ideal press `J`, speed
    scaling, constants from `tech.md`.
  - (PBT) same seed gives same level; gaps and widths in range.
  - _Req 7.1–7.5_

- [x] 4. Registry with automatic defaults
  - `registry/`: `defineObstacle`, voice table (distinct pitch and timbre),
    default `say`, `caption`, `draw`, haptic pattern; refuse missing output.
  - _Req 6.1–6.7, 3.1, 3.4_

- [x] 5. Proof, part 1: timing properties
  - `proof/` properties 1, 2, 3, 5, 6 and 4 with plain-English counterexamples
    and `refuseIfFailing`.
  - (PBT) one test per property over N ≥ 200 seeds, plus the broken-crypt
    fixture that must fail with the expected text.
  - _Req 8.1–8.10, 13.1–13.3, 13.5_

- [x] 6. Input state machine
  - `input/`: keys, pointer, touch, gamepad to one `press`; ignore repeat;
    Escape; no hold or chord.
  - (PBT) any sequence with repeats yields one press per physical press.
  - _Req 1.1–1.7_

- [x] 7. Channels, part 1: sound, speech, captions, indicator
  - Pure channels returning `OutputCommand[]`; cue beeps at `J−3·BEAT…`; four
    pips; indicator per cue; speech always emitted.
  - _Req 3a.2, 3a.5, 3a.6, 3.2–3.6, 4.1–4.5, 5.1–5.6_

- [x] 7a. Customisation layer (added 2026-11-18 after a kit-first audit)
  - Timing, strings, voices and vibration patterns, starting profile, custom
    events with presentations, omit/replace channels, window floors, custom
    proof properties and bring-your-own levels, all through `createKit(config)`.
    Haptics channel built here. `docs/customisation.md` lists every option.
  - _Req 22.1–22.8, 3a.5_

- [x] 8. Web adapter, minimal
  - Canvas draw, Web Audio tones, Web Speech plus `aria-live`, key/pointer/touch
    input, localStorage with try/catch, picture-off.
  - _Req 4.1–4.4, 11.3, 11.4, 20.3_

- [x] 9. **Thin player-test prototype** built (first demo, target 20 Nov). The gate below is still open.
  - One placeholder runner game on the web adapter: three-beep countdown,
    jump, plain-English fall reason, gentle restart, session log with CSV.
  - Give a blind or switch player a link. Run the 15-minute protocol.
  - _Req 10.1–10.3, 12.1–12.4_
  - [ ] **Gate (open):** a real player finishes level 1 unaided. If not, stop
    and review the idea before Milestone 2. Protocol: `docs/player-test-protocol.md`.
  - Built in `apps/ghastly-moves` (first built as a plain jump game, now the
    educational rhythm game): three-beep countdown, jump, plain-English fall
    reason, restart just before the obstacle, session log with CSV download,
    settings (speed, picture, voice, times table, level number).
  - **Known limits for the test:** a one-switch player can start and play with
    one switch, but cannot change settings alone until the scanning menu (task
    14) exists, so a helper sets Speed, Picture and Voice first. It has not been
    run in a real browser or heard by a person yet. It does not work offline yet
    (task 8a).

- [x] 8a. Offline after first load (tech.md constraint) (DONE 2026-11-18: `offlinePlugin` in
  `@marrow/skeleton/vite` writes `sw.js` at build time, `registerOffline()` starts it; both apps
  use it; the worker is tested against a fake browser. Not yet tried in a real browser.)
  - A service worker that caches the built app, so a second visit works without
    a network. Required before submission.

---

## Milestone 2 — Make it fun and complete the proof (21–25 Nov)

- [x] 10. Immersive audio, thin slice (built 2026-11-18; needs real ears to tune)
  - Built: approach tone that moves from the right to the centre, jump whoosh,
    landing thud, fall bonk, wind bed, pad that rises with danger, clear chime;
    each switchable in `KitConfig.audio`; the web adapter plays glides, filters
    and noise. Mix rule tested (`cuesAudible`).
  - Still to do: more varied wind and music, several objects placed in space at
    once, and tuning the levels by ear with a real player.
  - Also built here (voices): plug-in AI voice, recorded clips, most natural
    browser voice by default, `kit.lineScript()`. See `docs/voices.md`.
  - _Req 18.1–18.10, 4.6–4.10_
  - _Req 18.1–18.4_

- [x] 11. Haptics channel and visual sound indicator polish (done in tasks 7a and 8: channel, rumble and phone vibration, steady marker for reduced motion)
  - Rumble patterns per object; `navigator.vibrate` where present; indicator
    respects reduced motion.
  - _Req 3a.5, 3a.6, 5.6_

- [x] 12. Proof, part 2: channel and profile properties (DONE 2026-11-19: `proof/presentation.ts` with 7, 9, 10, 11; `kit.provePresentation()`; property-tested; both apps pass)
  - Properties 7, 8, 9, 10, 11 (flash rate, two-sense, contrast per theme, no
    hold or chord, strings coverage) with counterexamples.
  - (PBT) over random profiles and themes.
  - _Req 8.11–8.16, 13.1_

- [x] 13. Proof, part 3: intent, audibility, setup (DONE 2026-11-19: 12 `repairsKeepTheLevel`; 13 and 14 already built; setup options reach five channels, tested)
  - Properties 12, 13, 14; repair guard (no repair applies to a profile that didn't ask for it).
  - Property 13 is already written as `cuesAudible` and property-tested; this task wires it into `prove`.
  - (PBT) default-profile level unchanged by any repair; cues exceed ambience
    under any volume mix.
  - _Req 8.17–8.20, 19.3_

- [x] 14. Scanning and first-run setup (DONE 2026-11-19: `menu/` with `createMenu`, `createMenuStack`, profile settings, the five-way first-run setup; both apps are one-switch end to end, settings included. Earlier note: PARTLY DONE: the `scanning/` state machine and property 102
  are built and tested, and used by Séance Escape; the first-run setup flow is not built)
  - `scanning/` state machine (done); `setup/` five options as `menu-option` events
    with speech, caption, indicator and pulse pattern; save and reopen with one
    press; OS preferences.
  - _Req 2.1–2.6, 17.1–17.8, 8.20_

- [x] 15. Personas and reviewer loop (DONE 2026-11-18: `personas/` with exact clear-rate maths checked against simulated plays; `reviewer/` with perfect, timing-error, audio-only and deaf reviewers, findings in plain English, repairs only to the player's speed, never an easier level. Tested.)
  - Perfect, timing-error (σ configurable), audio-only (hearing commands only);
    `simulate` clear rates per speed; `review` returns findings as failed
    proof results; headless.
  - _Req 9.1–9.5, 19.1–19.5_

- [x] 15a. Coach voice (DONE 2026-11-19, go-ahead given: lead is before the first beep, 1 to 3 s; lessons say 'decide', never the answer; property 17 `coachInTime`; on in Ghastly Moves)
  - Coach line scheduled `lead` seconds before the press as a speech event;
    profile field `coachLeadSeconds` (0 = off); proof property 15 (the line
    starts after landing plus margin); report the longest lead that fits.
  - _Req 21.1–21.5_

- [x] 16. Accessibility report (DONE 2026-11-18: `report/` maps channels and passing properties to all 24 ESA tags as supported, to confirm, or not claimed with the reason; Markdown and JSON; both apps keep theirs in `docs/accessibility-report-*.md`, checked by a test.)
  - `a11y-report/`: features from enabled channels and passing properties,
    mapped to ESA tags; JSON and Markdown; never claims "fully accessible".
  - _Req 14.1–14.5_

- [x] 16a. Genre-neutral layer (done 2026-11-18): objects without a width, events placed in space, recipes for built-in sounds, `kit.proveEvents()`, genre tests, `docs/genres.md`.
  - _Req 23.1–23.6_

- [x] 16b. First demo game built (2026-11-18): **Ghastly Moves**, an educational rhythm game
  (times tables). Lessons, numbered obstacles, let-it-pass decisions, Perfect/Good/Ok
  judgements, streak tune, score and rank, mistakes that teach. In the kit, not just the app.
  - _Req 24.1–24.9_

- [x] 16c. Second demo game built (2026-11-18): **Séance Escape**, a haunted house played by
  scanning, with a navigation pattern and proof (201–204), placed 3D sound, and a first-person
  three.js view (flat-map fallback). Echo Hunter stays the fallback idea, not built.
  - _Req 26.1–26.7_

- [x] 16e. Music and story (2026-11-18): the kit's background tracks (proof property 14, and 13
  with music), and in Ghastly Moves seven places with their own rules and tracks, bosses with
  harder numbers, items, a story map and saved progress.
  - _Req 27.1–27.5, 28.1–28.4_

- [x] 16f. Speech discipline for walks (2026-11-18): one spoken line between crossings, options wait
  for the line before them, Listen is heard in full. Needs a real voice to confirm the wait times.
  - _Req 26.6, 26.7_

- [x] 16d. Scale pack (DONE 2026-11-19: priorities and announce levels, critical cuts in, repeated waiting lines said once, a voice limit in the sound player that never drops a beep, `nearest`, property 18 `speechPace`. Not built: combining counts into one line, e.g. 'three enemies left'. Earlier note: PROPOSED): priority and verbosity for events, a speech queue with
  interruption rules, a sound voice budget, and "nearest N" announcing, so a large, busy game
  can use the kit without drowning the player. See Requirement 25.
  - _Req 25.1–25.7_

- [x] 17. Second app, different one-switch pattern: `apps/seance-escape` (done, see 16c)
  - Built on the web adapter through the public API only. Uses three.js for its picture only.
  - _Req 15.5, 2.1–2.6_

---

## Milestone 3 — MCP, power, hooks, benchmark (26–29 Nov)

- [x] 18. level-forge MCP server (DONE 2026-11-18: seven tools, `generate_level`, `prove_level`, `prove_many`,
  `simulate_persona`, `review_level`, `a11y_report` and `prove_house`, built, tested, bundled to one file and listed in
  `.kiro/settings/mcp.json`.)
  - `mcp/level-forge`: `generate_level`, `prove_level`, `simulate_persona`,
    `review_level`, `a11y_report`. Tests call the tools.
  - _Req 8.1, 9.5, 14.5_

- [x] 19. Hooks and custom agents (DONE 2026-11-18: five hooks in `.kiro/hooks/` in the v1 format, including a no-over-claiming check; three agents in `.kiro/agents/`, the reviewer and playtester read-only. Formats checked by tests; not yet run inside Kiro.)
  - Hook: on save of an object or content file, run the proof. Hook: on core
    change, run both apps' tests. Hook: after each task, append to
    `docs/kiro-usage-log.md`. Hook: regenerate the store list.
  - Agents: level-designer, accessibility-reviewer (read-only), playtester.
  - _Req 15.2_

- [x] 20. Package as a Kiro power (DONE 2026-11-18: `power/marrow/`, Agent Plugins 1.0: `plugin.json`, `mcp.json` with the bundled server, four skills, the runtime, hook and agent templates with an installer. `node scripts/build-power.mjs` refreshes it; CI fails if it is stale. Not yet imported into Kiro.)
  - `power/marrow/` in Agent Plugins format: steering, MCP, hooks, skeleton,
    and a steering rule "build games on Marrow". Confirm the format against
    the current spec. Update `structure.md` with the new folder.
  - _Req 15.1–15.4, 15.6_

- [ ] 21. Build both apps through the installed power
  - Install the power in a clean workspace; build both apps from prompts; fix
    any gaps in the power, not by hand.
  - _Req 15.5_

- [ ] 22. Power benchmark (HARNESS BUILT 2026-11-18: `benchmark/` with the three prompts, a black-box audit of 14 observable checks that scores any built game the same way, and `run.mjs` for the table. Calibrated: both apps 14 of 14, a plain control game 1 of 14. Waiting on the six Kiro builds, which a person must run in fresh workspaces. The proof cannot score a non-Marrow game, so the audit replaces it for the comparison.)
  - Three fixed prompts, with and without the power, count passing properties
    out of fourteen; JSON and table; report the "without" column honestly.
  - _Req 16.1–16.6_

---

- [x] 22a. Songs, portals and number gates (Req 29). `skeleton/src/song`, proofs 15, 16, 103, 104 in `skeleton/src/proof/song.ts`, timing help in the run; seven stage songs in `apps/ghastly-moves/src/songs.ts`, spike and gate objects, flips and lanes drawn, beat dots.
- [x] 22b. Queued speech, character voices, room echo and wobble (Req 30). Séance floors, doors, phantom feet and moan, wind, thunder, breath; fixed text panels and wrapped captions.
- [x] 22c. Play-test fixes (Req 31), from bot play-tests: gate words fit at Fast ("12 or 35?"); the run holds for the intro and for a fall's lesson (`holdForWords`), with music playing on meanwhile; a 2-bar intro; phantom said only when it is news; a free hint after two catches; a known room says its name only. Séance wait per stop 10.3 s to 6.5 s.

- [x] 22d. Plug and play (DONE 2026-11-19). `npm run setup` checks Node 20.19+, installs, checks public imports, builds both games, starts them on free local ports and opens them, and prints the next step; every failure says what to do. `createGame` in `@marrow/skeleton/web` gives a whole game from a title and objects (page, setup screen, menu, channels, proof, refusal); `examples/hello` is 4 lines. `@marrow/skeleton/catalogue`: 14 ready-made objects from both games with sound, speech, caption and haptic presets, `preset` and `useObject`; `docs/catalogue.md` is made from it. The wire-new-object hook runs `scripts/wire-objects.mjs --prove` on a new object file: registry, tests, docs, then the proof, with the counterexample in plain words. `scripts/check-imports.mjs` keeps games on the public API. README rewritten top first. No gameplay changed.

## Milestone 4 — Freeze and finish (30 Nov, then 1–3 Dec)

- [ ] 23. Freeze checkpoint (Mon 30 Nov)
  - All tests green in CI; N ≥ 200 levels at 100%; broken-crypt demo works;
    both apps playable by one switch, by sound alone, and with captions only.

- [ ] 24. Docs
  - `docs/architecture.md`, `docs/proof-report.md` (regenerated by hook),
    README with install steps, adapter contract, roadmap, and honest limits.

- [ ] 25. Video and submission (no new features)
  - Video day 2 Dec: eyes-closed run, crypt turns red and refuses, developer
    builds on the power, real player, same-level race. Submit Thu 3 Dec.

---

## Later tasks (not in this cycle)

- Strings table tooling, dwell-click, hold-to-confirm input (proof property
  and opt-in flag already built).
- Unity, Godot and native adapters.
- Full input remapping, reading-level variants.

## Cut order if time runs short
Separate Crew app, then second-app extras, then persona polish. Never cut:
the proof, the eyes-closed demo, the video, the power, the benchmark.
