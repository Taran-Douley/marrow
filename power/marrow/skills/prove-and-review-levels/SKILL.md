---
name: prove-and-review-levels
description: Prove that a Marrow game's levels can be finished with one switch, and review them with simulated players (perfect, timing error, audio-only, deaf). Use after adding or changing any obstacle, lesson, house or timing, and before serving levels.
---

# Prove and review levels

The `level-forge` MCP server does this headlessly. Every tool takes an optional `game` describing the game: `{ obstacles: [{ name, width: [min, max] }], lesson: { rule, tables, values }, timing }`. Leave it out for the default graveyard.

## Prove

1. `prove_level` with a `seed` (or a hand-made `level`). If it fails, quote the counterexample to the developer in its own words, for example: *Level 17, obstacle 4 (crypt, 1.00 s wide): no take-off point clears it. One jump covers only 0.73 s.*
2. Fix the **object** (shrink the width, widen the gap). Do not weaken the proof, and do not change the timing model to pass.
3. `prove_many` with `count: 200`. Report how many pass, and the narrowest take-off window per speed. The kit's defaults give 717 ms at Slow, 538 ms at Medium and 430 ms at Fast.
4. For a haunted house, `prove_house` (properties 201 to 204).

A level that fails must not be served. In code: `kit.refuseIfFailing(level)`.

## Review

`review_level` runs reviewer players over a level (or `count` levels) at a speed: a perfect one-switch player, a player with timing error, an audio-only player, and a deaf player. Each finding names the player, the level, the object and the cause. A repair is offered only to that player's own settings (a slower speed). **Never offer to make a level easier for everyone.** If no speed helps, say the obstacle needs a design change.

## Estimate

`simulate_persona` gives the chance of clearing a jump first time, and of finishing a level with no fall, at each speed. These are estimates. They do not replace testing with disabled players.