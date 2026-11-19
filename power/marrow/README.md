# Marrow, a Kiro power

> Every game playable by everyone? No. But every game *you build with Kiro* can be built so that more players can finish it, and so that you know which ones.

Marrow is a small kit for browser games with accessibility built in. You declare objects and events. The kit shows each one through sound, speech, captions, a marker for every sound, and touch, from one player profile. A property-based proof checks that every level can be finished with one switch, and refuses any level that cannot.

Install this power and Kiro builds your games on Marrow, **without being asked for accessibility**.

## What is in it

| Part | What it is |
|---|---|
| `skills/` | Four skills Kiro loads when you talk about building a game: build on Marrow, prove and review levels, add an object, write the accessibility list. |
| `mcp.json`, `mcp/level-forge.js` | The Level Forge MCP server (one file, no install): `generate_level`, `prove_level`, `prove_many`, `simulate_persona`, `review_level`, `a11y_report`, `prove_house`. |
| `skeleton/` | The runtime itself (TypeScript source), copied into your project by the build skill. |
| `templates/hooks/` | Three hook templates (proof on save, accessibility list, no over-claiming). |
| `templates/agents/` | Three custom agents: level designer, accessibility reviewer, playtester. |

## Install

In Kiro: Powers panel, Add Custom Power, import this folder. Then say "let's build a game". The keywords `game`, `accessible`, `one-switch` and others activate it.

Hooks and agents are not part of the portable plugin format, so they take one extra step: the build skill's installer copies them into `.kiro/` for you when you add `--kiro`. It never overwrites a file that is already there.

## What it promises, and what it does not

It proves finishability for the interaction patterns it has a proof for: **timed press** (platformers, runners, rhythm), **lessons** (yes-or-no on a beat), and **scanning and navigation** (choosing between options in turn, houses). For other kinds of game the accessibility layer still applies, and the kit says plainly that finishability is not proven.

It never calls a game "fully accessible". It lists what it supports, what a person must still confirm, and what it does not claim. Simulated players are estimates and do not replace testing with disabled players.

## Refreshing it

The generated parts (`skeleton/`, `mcp/`, `references/`, `templates/agents/`, `LICENSE`) are rebuilt from the repository by `node scripts/build-power.mjs`. Do not edit them here.

Licence: MIT.