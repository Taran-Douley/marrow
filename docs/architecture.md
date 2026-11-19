# Architecture

Marrow is a small kit with one idea: **a game says what happens, and the kit decides how every player perceives it.**

```
game code  ──events──▶  channels  ──commands──▶  adapter  ──▶  speakers, voice, screen, vibration
   │                       ▲                         ▲
   │                       │ one player profile      │ input: any key, click, tap, gamepad = one press
   └── levels ──▶ proof ──▶ served only if every property passes
```

## The parts

| Part | Folder | Job |
|---|---|---|
| Events | `skeleton/src/channels/events.ts`, `events/` | Plain facts: "an obstacle is coming", "the player fell, early". No sound or text in them. |
| Channels | `skeleton/src/channels/` | Turn each event into commands for five senses: sound, speech, captions, a sound marker, haptics. One profile decides them all. |
| Profile | `skeleton/src/profile/` | The player's choices: speed, scan speed, voice, picture, music, text size, contrast, colours, motion, mono, announce level, coach. Saved in localStorage. |
| Registry | `skeleton/src/registry/` | `defineObstacle` / `defineObject`: a name and a width get a voice, a spoken name, a caption and a vibration by default. |
| Levels and songs | `skeleton/src/level/`, `song/` | Seeded generator (mulberry32). Songs place obstacles by part and by beat, with portals for new moves. |
| Run | `skeleton/src/run/` | The timed-press pattern as a pure state machine: countdown, one press, gentle falls, retries, scoring, timing help, the coach, holds for words. |
| Navigation | `skeleton/src/navigation/` | The scanning-maze pattern: houses, a listening phantom, relics, hiding, hints. |
| Scanning and menus | `skeleton/src/scanning/`, `menu/` | One-switch choice: entries lit and said in turn. Settings and first-run setup are menus too. |
| Proof | `skeleton/src/proof/`, `navigation/proof.ts` | Property-based checks with plain-English counterexamples. A level that fails is never served. |
| Personas and reviewer | `skeleton/src/personas/`, `reviewer/` | Simulated players with timing error, audio-only and deaf reviewers; repairs only ever change the player's own speed. |
| Report | `skeleton/src/report/` | An accessibility feature list from what the proof guarantees, mapped to 24 ESA tags. |
| Web adapter | `skeleton/src/adapters/web/` | Web Audio (synthesised sound, 3D placement, room echo, a voice limit), Web Speech with a queue and character voices, canvas captions and menus, input, gamepad, vibration, offline service worker. |

The game owns the screen, the loop and the art. The kit owns nothing it does not need.

## The proof

| Pattern | Properties |
|---|---|
| Timed press | 1 jumpable, 2 reachable, 3 unambiguous cues, 4 multisensory, 5 window floor, 6 fourth beat clears |
| Presentation (any game) | 7 no unsafe flashing, 8 two senses, 9 contrast, 10 no hold or chord, 11 every line recordable, 12 repairs keep the level |
| Sound | 13 cues audible over music, 14 music clear of the beeps' pitch |
| Songs | 15 rests are rests, 16 portals give warning, 103 one right lane, 104 gate words in time |
| Coach and scale | 17 the coach is in time, 18 speech a player can follow |
| Lessons | 101 one right answer each |
| Scanning | 102 every option can be heard |
| Navigation | 201 exit reachable, 202 shortest route safe, 203 fair start, 204 well formed, 205 ritual route safe, 206 ritual well placed |

Numbers for the two games are in `docs/proof-report-ghastly-moves.md` and `docs/proof-report-seance-escape.md`, written by tests.

## The two games

| | Ghastly Moves | Séance Escape |
|---|---|---|
| Pattern | Timed press, lessons, songs | Scanning navigation |
| Folder | `apps/ghastly-moves/` | `apps/seance-escape/` |
| What the app adds | Stages, songs, tracks, bosses, art | Rooms, story, sounds, 3D view |

Both depend on the kit only through `@marrow/skeleton` and `@marrow/skeleton/web`.

## Kiro

| Kiro feature | Where |
|---|---|
| Spec | `.kiro/specs/marrow-core/` (requirements 1 to 31, design, tasks) |
| Steering | `.kiro/steering/` (product, tech, structure, accessibility, rules) |
| Hooks | `.kiro/hooks/` (proof on object save, reports, no over-claiming, core tests, usage log) |
| Agents | `.kiro/agents/` (level designer, accessibility reviewer, playtester) |
| MCP | `mcp/level-forge/` (generate, prove, simulate, review, report, prove a house) |
| Power | `power/marrow/` (the kit, the MCP server, skills, a starter game, hook and agent templates) |
