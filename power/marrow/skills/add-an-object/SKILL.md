---
name: add-an-object
description: Add an obstacle, object, lesson or event to a Marrow game the small way, so it gets sound, speech, a caption and touch automatically, and passes the proof. Use when the developer says "add a ..." to a game built on Marrow.
---

# Add an object

1. **Declare it.** In the app's `src/objects/` file:
   - Something to jump: `kit.defineObstacle('crypt', { width: [0.2, 0.3] })` (running seconds). Width is the only thing the proof needs. Add `draw(ctx, box)` for the art, drawn in code.
   - Anything else: `kit.defineObject('wraith')`, and say how its events are shown in `createKit({ events })`.
   - Numbers to think about: a `lesson` with a rule (`isTarget`), a range, a prompt and explanations. A lesson's targets are jumped on the beat; the others are let past.
2. **Do not** write sound, speech, caption or vibration code. The defaults come from the kit. Override only to change the style, with `voices`, `haptics`, `strings` or `events`.
3. **Prove it.** Run `prove_level` and `prove_many` (200 seeds) with the new object in the `game` config, then the app's tests. The proof checks the width, the cues, the windows, and that the object has a sound, a spoken name and a caption.
4. **Show the result.** If it fails, show the counterexample, fix the width, and show it pass.
5. **Keep the answer hidden** in a lesson: the sounds, the events and the picture must be the same for a target and a distractor.