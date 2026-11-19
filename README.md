# Marrow

**Marrow makes a browser game playable with one switch, by sound, by sight and by touch, and proves every level can be finished before anyone plays it.**

## Quickstart

```sh
git clone https://github.com/Taran-Douley/marrow.git
cd marrow
npm run setup
```

`npm run setup` checks your Node version, installs, builds, and opens both games in your browser. If anything goes wrong, it says what to do. After that, `npm run play` starts both games straight from the newest code, with live reload. The games are also online at [taran-douley.github.io/marrow](https://taran-douley.github.io/marrow/), rebuilt on every merge to main.

## A whole game in 4 lines

[`examples/hello/src/main.ts`](examples/hello/src/main.ts):

```ts
import { createGame } from '@marrow/skeleton/web';
import { bat, stone } from '@marrow/skeleton/catalogue';

createGame({ title: 'Hello, Marrow', objects: [bat, stone] });
```

Run it with `npm run dev --workspace examples/hello`. That call gives you the page, a first-run setup, a one-switch menu with settings, every channel, a proved level, and a plain-English refusal if a level cannot be finished. Ready-made objects are listed in [docs/catalogue.md](docs/catalogue.md).

## What you get for free

- **One switch does everything.** Any key, click, tap or gamepad button is the switch. Menus, settings and the first-run setup are scanned: each entry is lit and said in turn, and one press chooses. Nothing needs holding or fast presses.
- **Every event reaches two senses or more.** Pitch-coded beeps, speech, captions with countdown pips, a sound marker and vibration, all set by one player profile. Speech is always written to a live region for screen readers, and the built-in voice can be turned off.
- **A guarantee, not a checklist.** Property-based proofs check every level before it is served. A level that fails is refused, with the reason: *"Level 17, obstacle 1 (crypt, 1.00 s wide): no take-off point clears it. One jump covers only 0.73 s."*
- **Gentle failure.** A fall says why ("Pressed a little early"), waits until you have heard the reason, and retries just before the obstacle. No lives, no game over.
- **Settings that matter.** Speed, scan speed, voice, picture off (play by sound), music, text size, contrast, colour-blind colours, reduced motion, mono, how much is announced, timing help, and a coach that says what is coming.
- **Sound designed for ears.** All sound is synthesised: 3D placement on headphones, room echo, and music that steps aside for every cue. Games work offline after the first visit.

Marrow helps games work for more players. It does not make a game "fully accessible", and it does not replace testing with disabled players.

## The second route: the Kiro power

Open this folder in Kiro and ask: *"Add a crypt obstacle to Ghastly Moves."* Kiro writes `apps/ghastly-moves/src/objects/crypt.ts`:

```ts
import { preset } from '@marrow/skeleton/catalogue';
export default preset({ name: 'crypt', width: [0.2, 0.3] });
```

A hook (`.kiro/hooks/wire-new-object.json`) then puts it in the game, its tests and its docs, and runs the proof. Make it too wide and the proof says why, and the game refuses those levels until it is fixed. You can run the same step yourself with `npm run wire-objects`.

In another project, install the power from `power/marrow/`. Its skill builds games on Marrow, and `new-game.mjs` makes a starter game ([docs/quickstart.md](docs/quickstart.md)). The power also brings the Level Forge MCP server (generate, prove, simulate players, review) and the hook and agent templates.

## The advisor: a plan that fits your game

Describe your game in a few lines (`brief.md`: genre, theme, controls, engine, features). Marrow suggests accessibility features across the whole game, in your theme's own sounds: a haunted house gets a church bell and a creaking board, a space game a sonar ping. You accept or reject each one, alone or with the accessibility-designer agent. When the game changes, the plan follows and keeps your decisions. Marrow then builds what you agreed, and bot players check it can be finished and plays well.

```sh
npm run advise -- advise apps/ghastly-moves/brief.md   # the plan, next to the brief
npm run advise -- build examples/hello/brief.md        # build what was accepted
```

It works for any engine as a plan, through the `advise_game` MCP tool. See [docs/advisor.md](docs/advisor.md).

## The two games

Built for Kiroween 2026, Skeleton Crew: one skeleton, two very different games.

| Game | Played by | Run it alone |
|---|---|---|
| **Ghastly Moves** (`apps/ghastly-moves`) | Timed presses to a beat: a maths rhythm game with seven songs, flips, number gates and bosses | `npm run dev --workspace apps/ghastly-moves` |
| **Séance Escape** (`apps/seance-escape`) | Scanning: a haunted house you escape by sound, with a phantom that listens | `npm run dev --workspace apps/seance-escape` |

Both can be played with one key or switch, by sound alone with your eyes closed, or with captions alone.

## The kit, for more control

```ts
const kit = createKit({ events, lesson, song, coach, timing, audio /* all optional */ });
kit.defineObstacle('bat', { width: [0.12, 0.24] });  // sound, name, caption, vibration: automatic
const level = kit.refuseIfFailing(kit.generate(seed)); // proved, or refused with a reason
const run = kit.run({ level, speed, startReal, emit });  // one press, gentle falls, scoring
kit.render(event, profile);                              // what each sense gets, for this player
```

See [docs/quickstart.md](docs/quickstart.md), [docs/customisation.md](docs/customisation.md) and [docs/architecture.md](docs/architecture.md).
## Proof, in numbers

- Ghastly Moves: **2,800 of 2,800** generated levels pass every property. Smallest take-off window **717 ms** at Slow, **430 ms** at Fast. [Report](docs/proof-report-ghastly-moves.md)
- Séance Escape: **600 of 600** houses pass every navigation property. [Report](docs/proof-report-seance-escape.md)
- Both games score **14 of 14** on the black-box accessibility audit in `benchmark/`. A plain game scores 1.

## Repository

| Folder | What |
|---|---|
| `skeleton/` | The Marrow kit (TypeScript), with its tests |
| `apps/ghastly-moves/`, `apps/seance-escape/` | The two games |
| `examples/hello/` | The smallest game: one `createGame` call |
| `scripts/` | `setup`, `wire-objects` (the object hook), `check-imports` (public API only), `check-claims`, `build-power` |
| `mcp/level-forge/` | A local MCP server: generate, prove, simulate players, review, report |
| `power/marrow/` | Marrow as a Kiro power: the kit, the MCP server, skills, a starter game, hook and agent templates |
| `benchmark/` | The audit that scores any built game the same way |
| `.kiro/` | Spec, steering, hooks and custom agents |
| `docs/` | [Architecture](docs/architecture.md), [quickstart](docs/quickstart.md), proof and accessibility reports, the [Kiro usage log](docs/kiro-usage-log.md) |

## Commands

```sh
npm install
npm run typecheck
npm test --workspace skeleton        # one workspace at a time on a small machine
npm run build --workspace apps/ghastly-moves
```

## Disclosure

A throwaway browser prototype, made outside Kiro after 30 October 2026, was used for early timing tests. None of its code is in this repository.

## Licence

MIT. See [LICENSE](LICENSE).
