---
inclusion: manual
---

# Game feel (reference with #game-feel)

The pillars for making both games fun, not just finishable. Every pillar must keep the accessibility rules and the proofs. Fun never comes from taking a sense away or from tighter timing than the player chose.

## Ghastly Moves: the rhythm runner (spec `ghastly-rhythm-v2`)

1. **Locked to the song.** Every press lands on a beat, every obstacle sits inside one part of the song, and rests are silent of cues. The level is the song.
2. **Instant retry.** After a mistake, play is moving again in under 1 second. The screen shows progress (%), the attempt number and your best. Beating your best plays its own sound.
3. **Portals change the mode.** A song part can switch what a press does (jump, flip, switch lanes). The portal is heard, seen and said before it matters.
4. **The picture dances.** Visuals pulse with the beat, but stay within the flash proof (3 a second at most) and stand still when motion is reduced.
5. **Bosses you can hear.** Each boss attacks in a pattern, and the pattern can be read by sound alone: a tell you can hear, then the throws.

## Séance Escape: the haunted runs (spec `seance-runs`)

1. **Every run is a new house.** Each run is a fresh house, proven before it is served, that takes about 5 to 8 minutes.
2. **Three catches end a run.** A run is short and tense; the next run starts with one press. The end of a run is told gently, never as "game over".
3. **Every choice has a risk.** Listen, search and hide each help, and each has a clear cost the player is told about.
4. **The phantom hunts by sound.** It follows the noise you make, and you hear it move around you in 3D.
5. **The house surprises you.** Rooms roll random events from a table, each heard, seen and said.
6. **Relics carry over.** A relic found in a run grants one perk for the next run.

## Rules for every pillar

- Proofs first: every generated level and house passes all proofs before it is served.
- Two senses for everything; never colour alone; never sound alone.
- Speed changes timing only, never content.
- One switch can do everything, including the end-of-run choices.
