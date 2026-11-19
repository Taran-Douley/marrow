---
inclusion: always
---

# Product: Marrow (working name)

> Every game playable by everyone.

Marrow is a lean skeleton for browser games with accessibility built into its bones. A developer declares game objects in a few lines; Marrow automatically gives every object a sound cue, a spoken name, a caption and a one-switch timing window, and a property-based proof checks that every generated level can be finished with a single button before any player sees it.

Built for the Kiroween 2026 hackathon, **Skeleton Crew** category: one skeleton, two distinct applications.

## How Marrow ships: a Kiro power

Marrow ships as a **Kiro power** in the Agent Plugins format (the open,
vendor-neutral v1.0 spec for packaging skills and MCP servers). The power
bundles, in one installable package:

- the **accessibility steering** (product, tech, structure, accessibility rules);
- the **level-forge MCP server** (`generate_level`, `prove_level`,
  `simulate_persona`, plus the accessibility report);
- the **hooks** — the proof hook (run the fourteen-property proof when an object
  or content file is saved) and the store-list hook (regenerate the ESA-tagged
  accessibility feature list);
- the **runtime skeleton** itself (the `skeleton/` library).

**Its purpose:** when a developer asks Kiro to build a game, Kiro builds it
**on Marrow** — so the game is accessible by default and proven by the proof,
without the developer asking for accessibility or knowing how it works. The
power's context loads automatically when a developer mentions building a game,
and installs with no JSON or CLI setup (Kiro shows an active indicator).

Both demo apps in this repository — **ghastly-moves** (a story of seven places and
bosses, with times-table and number rules, played by timing) and **seance-escape** (a
3D haunted house played by scanning) — are built *through the installed power*, so
the submission shows the power working end to end, not just the library.

## The problem

- More than 400 million people with disabilities play games worldwide (Microsoft estimate).
- In Scope UK's survey, 66% of disabled gamers face barriers, and 2 in 5 have bought games they couldn't play.
- Only about one in three developers say they are building accessibility into their next game (GDC State of the Game Industry 2026). Indie developers often lack the time, skills or engine support, because Unity and Unreal don't natively support most accessibility features.
- Accessibility built in from the start costs roughly 5 to 10% of development effort; retrofitting costs far more. Defaults decide usage: when accessibility features are on by default, almost everyone keeps them on.

**Marrow's answer:** accessibility is the default and costs the developer nothing extra. It is opt-out, never opt-in.

## Who it is for

1. **Players** who use a single switch, play by sound (blind and low-vision players), are deaf or hard of hearing, or need slower timing.
2. **Game developers and educators** who want to ship games those players can finish, without becoming accessibility experts.

## The two applications (Skeleton Crew requires two)

**Status (2026-11-18):** the first game is built; the second is being chosen. Both must be fun, must use genuinely different genres, and must be built through the installed power.

1. **Ghastly Moves** (educational rhythm game, built): a ghost dances through a graveyard to your times tables. Each gravestone has a number, spoken and shown, and three pitch-coded beeps. If the number is in the chosen table, press on the fourth beat to jump; if not, let it pass, because pressing is the mistake. Perfect, Good and Ok timing build a streak that climbs a tune and lights the lantern; a mistake teaches ("11 is not a multiple of 3"); the level ends with a rank. Maths, listening and rhythm on one switch.
2. **The second game** (to be chosen, `docs/demo-games.md`): the impressive one, in a different genre, with its own interaction pattern and its own proof.

The two apps deliberately use **different genres and interaction patterns** to show the skeleton's versatility. The educational app covers the learning angle; the second covers the "impressive" angle.

## What makes it different

- **A guarantee, not a checklist.** Property-based tests prove every generated level is finishable with one switch, every countdown is unambiguous, and every object has sound, speech and caption. If a developer adds an object that breaks a property (for example an obstacle too wide to jump), the proof fails with a plain-English counterexample and the game refuses to serve that level.
- **Zero-effort accessibility.** Declaring an object automatically wires its accessible outputs. A Kiro hook enforces this whenever a new object is added.
- **Playtester personas.** Simulated players (one-switch with realistic timing error, audio-only) estimate how likely a real player is to clear each level at each speed.

## Demo moments (for the under-3-minute video)

1. A player closes their eyes and plays Ghastly Moves by sound alone, doing the sums in their head, then plays it again with one key.
2. "X-ray mode" peels the game's art away to reveal the shared skeleton beneath both apps.
3. The developer adds a "crypt" obstacle that is too wide; the proof turns red with a counterexample; they fix the width; it turns green.
4. Séance Escape runs on the same skeleton with a completely different interaction: a first-person haunted house where one switch scans the choices at each crossing, each sounded from its own direction in 3D.

## Hard numbers the product must produce

- Levels proven finishable with one switch (target: 100% of N generated levels, N ≥ 200).
- Minimum take-off window per speed (the prototype achieved 717 ms on Slow, 538 ms on Medium, 430 ms on Fast).
- Real player results from testing: completion, falls, average distance from the beat.
- **Power benchmark:** for three game prompts, proof properties passing without the power vs with it (expected: few or none without, all fourteen with). This is the headline number for the write-up and video.

## Design principles

1. Accessible by default; never opt-in.
2. Every piece of information is available through at least two senses (sound and sight; never colour alone; never sound alone).
3. One switch can do everything, including menus.
4. Failure is gentle: fall, hear why, retry from just before the obstacle.
5. The developer API stays tiny; the skeleton does the heavy lifting.
6. Prove it: claims about accessibility are checked by tests, not asserted.
7. Never claim Marrow makes a game "fully accessible" or replaces testing with disabled players.
8. Marrow is a kit other developers build into their own games. The developer owns every creative choice (look, sound, wording, timing, which features exist); the player owns their profile; the proof checks the result. Nothing the kit does may be hard-wired to one game, and every feature can be switched off, replaced or restyled through one config object.
9. Embed, never take over. Marrow does not own the game loop, canvas, audio or input. Events go in, output commands come out, and an adapter connects them to the engine.

## Non-goals

- Not a game engine. Marrow is an accessibility core that works with any kind of game through adapters. Only the web adapter ships in this build; other engines are roadmap.
- Not a universal "finishable" proof. The accessibility layer (events, channels, profile, checks) serves any genre. Proving a game can be finished with one switch belongs to an interaction pattern; timed press is built, others are proposed (`docs/genres.md`). Say exactly this, never "works for every game".
- Not a replacement for testing with disabled players.
- The kit has no 3D engine of its own. A game may draw its picture however it likes (Séance Escape uses three.js); the kit supplies placed 3D sound and the accessibility layer. No multiplayer, no accounts.

## Success criteria for the hackathon build

- Marrow is installable as a Kiro power (Agent Plugins format) bundling steering, the level-forge MCP server, the proof and store-list hooks, and the runtime skeleton.
- Both apps (ghastly-moves and seance-escape) are built *through the installed power* and play start to finish with one switch, by sound alone, and with captions only.
- The proof runs in CI and in the browser, and the broken-obstacle demo works.
- The power benchmark shows a clear gap: three game prompts pass far more proof properties with the power than without.
- At least one real blind or switch-using player has played Ghastly Moves and Séance Escape, and their feedback shaped the build.
