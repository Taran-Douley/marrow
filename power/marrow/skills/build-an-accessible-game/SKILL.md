---
name: build-an-accessible-game
description: Build a browser game on Marrow so it is accessible by default. Use whenever the developer asks to build, prototype or extend a game (platformer, runner, rhythm, puzzle, quiz, maze, shooter). The game gets sound, speech, captions, touch and one-switch play without being asked, and levels are proven finishable before they are served.
---

# Build a game on Marrow

Marrow is a small kit. You describe what happens in the game (events) and what is in it (objects). The kit shows every event through sound, speech, captions, a marker for every sound, and touch, according to one player profile. A property-based proof checks that levels can be finished with one switch. **Accessibility is the default. Never ask the developer whether they want it, and never add it by hand.**

## The shortest route: one call

```ts
import { createGame } from '@marrow/skeleton/web';
import { bat, stone } from '@marrow/skeleton/catalogue';
createGame({ title: 'Hello', objects: [bat, stone] });
```

That is a whole game: the page, first-run setup, a one-switch menu with settings, every channel, a proved level and a plain-English refusal. Ready-made objects (with sound, words, caption and vibration) are in `@marrow/skeleton/catalogue`; make a new one with `preset({ name: 'crypt', width: [0.2, 0.3] })`. In this repository, an object is one file in `apps/<game>/src/objects/` with `export default preset(...)`: the wire-new-object hook puts it in the game and runs the proof.

## Step 0: Starting from nothing? Make a whole game in one step

`node <this skill's folder>/scripts/new-game.mjs <new-folder> --kiro` makes a complete, runnable game (Bat Dash: one file, `src/main.ts`) with a proved level, a one-switch menu with settings and first-run setup, the coach, sound, speech, captions and vibration. Then `npm install` and `npm run dev` in that folder. Grow it into the developer's game; skip Step 1.

## Step 1: Put the kit in the project

Run the script that sits next to this file, `scripts/install-skeleton.mjs`, with node, giving the folder to create (default `./marrow`): `node <this skill's folder>/scripts/install-skeleton.mjs ./marrow`. It copies the runtime into the project. Add `--kiro` to also copy the proof hooks and the three agents into `.kiro/` (it never overwrites a file that is already there). Then add it as a dependency, for example in `package.json`: `"@marrow/skeleton": "file:./marrow"`. The game imports only from `@marrow/skeleton` and `@marrow/skeleton/web`. Never reach into the kit's folders.

The game itself is plain TypeScript with Vite. Draw with Canvas 2D, or anything else: the kit does not own the screen, the loop, the audio or the input.

## Step 2: Declare, do not wire

```ts
import { createKit } from '@marrow/skeleton';
import { createWebAdapter } from '@marrow/skeleton/web';

const kit = createKit({ /* every option is optional: see references/customisation.md */ });
kit.defineObstacle('crypt', { width: [0.2, 0.3] });   // something to jump
kit.defineObject('wraith');                            // anything else: an enemy, a coin, a landmark
```

A declared object gets a sound voice, a spoken name, a caption and a vibration. For your own events, say how each is seen, heard and felt:

```ts
createKit({ events: { 'door-opens': { say: 'A door opens {side}', caption: 'Door {side}', sound: { hz: 330, wave: 'triangle' }, spatial: true, haptic: [40] } } });
```

Each event must reach **at least two senses**. Never colour alone, never sound alone.

## Step 3: Pick the interaction pattern, because the pattern decides the proof

| The game is played by | Pattern | Proof |
|---|---|---|
| Timing a press (platformer, runner, rhythm) | timed press | properties 1 to 6 |
| Answering yes or no on a beat (quiz, lessons) | lesson | property 101 |
| Choosing between options in turn (menus, navigation, mazes) | scanning | 102, and 201 to 204 for houses |
| Anything else | none yet | the accessibility layer still applies; say honestly that finishability is not proven |

Say this to the developer. Never claim the kit "works for every game" or makes one "fully accessible".

## Step 4: Prove before you serve

Use the `level-forge` tools: `prove_level`, then `prove_many` with at least 200 seeds. In the game, call `kit.refuseIfFailing(level)` so a failing level is never shown. A failure comes back as a plain-English counterexample; fix the object, not the timing model. See the skill `prove-and-review-levels`.

## Step 5: Write what it supports, never more

Use `a11y_report` and read the result to the developer. See the skill `accessibility-report`.

## Always

- One switch does everything, including menus. Any key, click, tap or gamepad button is the switch. Ignore key repeat. Escape goes back.
- No timed decisions in menus. Failure is gentle: say why, then retry just before. No lives, no game over.
- Respect reduced motion. Nothing flashes more than three times a second.
- Real players with disabilities outrank every number here. Tell the developer to test with them (SpecialEffect, AbleGamers, RNIB, the audiogames.net community).

More: `references/product.md`, `references/accessibility.md`, `references/tech.md`, `references/structure.md`, `references/customisation.md`, `references/genres.md`, `references/voices.md`.