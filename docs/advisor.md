# The accessibility advisor

Tell Marrow what kind of game you are making. It suggests accessibility features that fit your game, keeps them up to date as the game changes, builds the ones you agree to, and checks how the result plays.

The plan works for **any game, in any engine**: it is words. For browser games that use Marrow's patterns (runners, rhythm games, lessons and quizzes, scanning mazes), Marrow can also **build** the plan and **prove** the result.

## 1. Write a brief

```sh
npm run advise -- new apps/my-game/brief.md
```

```
Name: Grave Dash
Genre: runner        (runner, rhythm, platformer, quiz, maze, puzzle, shooter, racing, card, story, other)
Theme: haunted       (haunted, space, forest, underwater, neutral)
Controls: one press
Engine: browser
Players: anyone
Features:
- obstacles to jump
- a boss at the end
- coins to collect
```

Everyday words work: "endless runner" becomes runner, and "spooky graveyard" becomes haunted.

## 2. Get the plan

```sh
npm run advise -- advise apps/my-game/brief.md
```

This writes `accessibility-plan.md` next to the brief. Suggestions are grouped by part of the game: controls, sound, speech and text, sight, difficulty and failure, menus and setup, story and dialogue, and your game's own features. Each one says:

- **what** to add, in your game's terms ("Every boss attack warned with a rising moan and a caption");
- **why** it matters, and **who** it helps, as ways of playing;
- **how**: built into Marrow, built by Marrow from this plan, or yours to build, with a how-to;
- the **guideline** it follows (Game Accessibility Guidelines, Xbox Accessibility Guidelines, WCAG).

Sounds come from your theme's palette, so accessibility adds to the mood instead of breaking it:

| Theme | Cues | Steps | Reward | Danger |
|---|---|---|---|---|
| haunted | a low church bell, a thin glass chime | a creaking board | a music-box ting | a rising moan |
| space | a sonar ping, a bright console blip | a soft servo whirr | a rising power-up chime | a falling alarm sweep |
| forest | a hollow wooden knock, a bird call | leaves underfoot | a woodwind trill | a low growl |
| underwater | a deep bell buoy, a bubble pop | a slow swish of water | a shimmer of light | a low sonar warning |

Every palette is proved: its two cues differ in pitch and timbre, and both stay above the music. `npm run advise -- palette forest` lists a palette in full.

## 3. Decide, and talk it through

Mark `[x]` to accept, `[-]` to reject, or leave `[ ]` to decide later. Write your reason or wish after "Note:". In Kiro, the **accessibility-designer** agent goes through the plan with you. It says how each idea would feel in your game, offers a themed alternative when one clashes with your design, and edits only what you agree to.

## 4. Change the game, keep your decisions

Add a feature or change the idea in `brief.md`, and save it. A Kiro hook (`.kiro/hooks/advise-on-brief.json`) makes the plan again. Every decision and note stays. New ideas are marked **new**. Ideas you had accepted that no longer fit are kept and marked **no longer fits the brief**, so nothing you agreed is lost without a word. Without Kiro, run `npm run advise -- advise-all`.

## 5. Build it

```sh
npm run advise -- build apps/my-game/brief.md
```

This writes `src/accessibility.generated.ts`. Pass it to the kit:

```ts
import { ACCESSIBILITY } from './accessibility.generated';
createGame({ title: 'Grave Dash', objects: [bat, stone], kit: ACCESSIBILITY.kit, assist: ACCESSIBILITY.assistByDefault });
```

It builds the theme's sounds (cues for objects without their own sound, plus jump, landing and fall), the coach, timing help on by default if your note asks for it, and the announce level. Everything you accepted that your code must do is printed as a to-do with its how-to. Nothing is claimed as done that was not. `examples/hello` is built this way.

## 6. Check how it plays

The proof runs on every level before it is served. The quality report adds simulated players: jumps cleared first time with 150 and 250 ms of timing error and by sound only, levels finished clean, a verdict per speed, the longest wait with nothing to do, and the change that would help most. For Ghastly Moves see [quality-ghastly-moves.md](quality-ghastly-moves.md). It is rewritten with `npm run quality --workspace apps/ghastly-moves`. For any game, use the `quality_report` MCP tool.

Bots show whether a game can be finished and how it plays. They cannot tell you whether it is fun. Test with real players, including disabled players.

## For any engine

The Level Forge MCP server (in the Kiro power) has `advise_game`, `sound_palette` and `quality_report`. A Unity or Godot developer gets the same plan; anything Marrow cannot build there is marked as theirs, with the how-to. Marrow has no proof pattern yet for platformers, shooters or card games, and the plan says so.
