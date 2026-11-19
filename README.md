# Marrow

**Accessibility in a game's bones.** Marrow is a small kit for browser games. You say what is in your game and what happens. Marrow makes every event heard, read, seen and felt, lets one switch do everything, and proves each level can be finished before a player sees it.

Built for Kiroween 2026, Skeleton Crew: one skeleton, two very different games.

| Game | Played by | Try it |
|---|---|---|
| **Ghastly Moves** (`apps/ghastly-moves`) | Timed presses to a beat: a maths rhythm game with seven songs, flips, number gates and bosses | `npm run dev --workspace apps/ghastly-moves` |
| **Séance Escape** (`apps/seance-escape`) | Scanning: a haunted house you escape by sound, with a phantom that listens | `npm run dev --workspace apps/seance-escape` |

Both are playable with one key or switch, by sound alone with your eyes closed, and with captions alone.

## What every Marrow game gets, for free

- **One switch does everything.** Any key, click, tap or gamepad button is the switch. Menus, settings and a first-run setup are scanned: each entry is lit and said in turn, and one press chooses. Nothing needs holding or fast presses.
- **Every event reaches two senses or more.** Pitch-coded beeps, speech, captions with countdown pips, a sound marker and vibration, set by one player profile. Speech is always written to a live region for screen readers, and the built-in voice can be turned off.
- **A guarantee, not a checklist.** Property-based proofs check every level: it can be cleared with one press, every countdown is clear, the take-off window is at least 650 ms at Slow, the music never hides a beep. A level that fails is refused, with a plain-English reason: *"Level 17, obstacle 1 (crypt, 1.00 s wide): no take-off point clears it. One jump covers only 0.73 s."*
- **Gentle failure.** A fall says why ("Pressed a little early"), waits until the reason is heard, and retries just before the obstacle. No lives, no game over.
- **Settings that matter.** Speed, scan speed, voice, picture off (play by sound), music, text size, contrast, colour-blind colours, reduced motion, mono, how much is announced, timing help, and a coach that says what is coming.
- **Sound designed for ears.** Synthesised sound only: 3D placement on headphones, room echo, music that steps aside for every cue. It works offline after the first visit.

Marrow helps games work for more players. It does not make a game "fully accessible", and it does not replace testing with disabled players.

## Make your own game in ten minutes

```sh
npm install
npm run new-game -- ../my-game
cd ../my-game && npm install && npm run dev
```

You get **Bat Dash**, a complete accessible game in one file. Read [docs/quickstart.md](docs/quickstart.md) to make it yours, and [docs/customisation.md](docs/customisation.md) for everything you can change.

The kit's public API:

```ts
const kit = createKit({ events, lesson, song, coach, timing, audio /* all optional */ });
kit.defineObstacle('bat', { width: [0.12, 0.24] });  // sound, name, caption, vibration: automatic
const level = kit.refuseIfFailing(kit.generate(seed)); // proved, or refused with a reason
const run = kit.run({ level, speed, startReal, emit });  // one press, gentle falls, scoring
kit.render(event, profile);                              // what each sense gets, for this player
```

## Proof, in numbers

- Ghastly Moves: **2,800 of 2,800** generated levels pass every property. Smallest take-off window **717 ms** at Slow, **430 ms** at Fast. [Report](docs/proof-report-ghastly-moves.md)
- Séance Escape: **600 of 600** houses pass every navigation property. [Report](docs/proof-report-seance-escape.md)
- Both games score **14 of 14** on the black-box accessibility audit in `benchmark/`. A plain game scores 1.

## Repository

| Folder | What |
|---|---|
| `skeleton/` | The Marrow kit (TypeScript), with its tests |
| `apps/ghastly-moves/`, `apps/seance-escape/` | The two games |
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
