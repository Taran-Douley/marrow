# Design: Ghastly Moves, rhythm v2

## What changes, and where

| Pillar | Kit (`skeleton/`) | Game (`apps/ghastly-moves/`) |
|---|---|---|
| 1 Locked to the song | `proof/rhythm.ts`: `lockedToTheSong` (19), added to `songProperties` | none: `generateSong` already puts presses on beats |
| 2 Instant retry | `run`: setting `explainOnce`, `falls` in the snapshot, `attempt` and `again` on the fall event, `wordsHoldMs`. `channels`: phrase `fallAttempt`. `proof/rhythm.ts`: `retryInTime` (20) | `kit.ts`: run settings and short reason words. `main.ts`: stats, new-best, no hold on a repeat fall. `progress.ts`: saved best |
| 4 The picture dances | `pulse/`: `pulseAt`. `proof/rhythm.ts`: `pulsesGentle` (21), part of `provePresentation` for a song kit | `art.ts`, `scene.ts`, `map.ts` |
| 5 Bosses you can hear | none | `pattern.ts`: the pattern, its song, tells and proofs 22 and 23. `kit.ts`, `objects/projectile.ts`, `main.ts` |

## 1. Locked to the song

The generator already places each press on the beat inside a part (`generateSong`). Property 19 checks it from the outside, on any level that has parts:

- ideal press `J = start + (width - airtime) / 2`. `J / beat` must be within 1e-6 s of a whole number.
- the part that holds `[first beep, clearAt]` must exist and must not be a rest.

A level with no song passes: there is nothing to lock to. Practice mode has no song, so it keeps its own pulse.

## 2. Instant retry

Before: a fall rested 2 s, restarted 1 s of level time before the countdown, and held level time until the whole reason and sum were said.

Now (Ghastly Moves settings): `fallPause` 0.4 s, `restartLead` 0.8 s, `explainOnce` on.

- The run remembers which obstacles the player fell at. The first fall carries `explain` (the sum). A repeat fall carries `again: true` and `attempt`, and no `explain`. The channel renders it as `"<reason> Attempt <n>."`.
- `main.ts` holds level time for the words (`holdForWords`) only when `again` is not set. This is the honest cost: the first fall at an obstacle may wait for its sum to be said; later falls there do not wait for anything. Property 20 checks the second case: with no words held, a retry waits `fallPause` and nothing more, at every speed.
- Reasons: "Early.", "Late.", "Missed." (nothing pressed on a target), "Wrong number." (pressed on a number to let pass), through `strings`.

### Progress, attempt, best

`percent = floor(100 * passed / total)`, where `passed` is the obstacles done so far (`snapshot.obstacle`, plus one while a jump over the current one is in the air). Attempt is `falls + 1`.

`best` is kept per key: `'3'` for stage 3, `'3b'` for its boss, `'t7'` for free practice of the 7 times table. It is saved as JSON under `ghastly.far` (not in `ghastly.progress`, so older saves are untouched), read and written in `try/catch`, and bad data is dropped value by value.

The best moves up as the clean stretch passes it. The new-best event plays once per attempt, only when a best was saved before the attempt began. It is sent when a right move is made, so the next countdown is at least a second of level time away.

The `run-stats` event goes to the live region only (the voice is not used for it).

## 4. The picture dances

`pulseAt(t, beat, reducedMotion)` returns 0 to 1: it rises over the first 8% of a beat, then falls away by half a beat. It is 0 for reduced motion. The scene multiplies it by `PULSE_MAX_ALPHA` (0.1) and adds that opacity to the moon's halo and the lantern's glow. Nothing else changes with it.

Property 21 checks: pulses a second (`rate / beat`) is at most 3 for each stage beat at slow, medium and fast; one rise per beat when sampled; zero with reduced motion; and `0.1 x |luminance(amber) - luminance(background)| < 0.1` in both themes.

### Graphics (`art.ts`)

- Sky: a vertical gradient per place, dark at the top and a little lighter at the horizon (text keeps 4.5:1 on the lightest, about 6.7:1). Still stars. The moon has a radial glow and two craters.
- Layers: far hills, a middle row of the place's tall things (dead trees, graves, pines, iron bars, a mill, a manor) and a near row of small things (pumpkins, graves, fence posts). They scroll at 8%, 22% and 45% of the ground's speed, and stand still with reduced motion. Colours are dark and close to the sky, so obstacles stand out.
- Ground: a gradient, tufts that move with the obstacles, and the 3 px line in the theme's line colour.
- Ghost: a radial gradient body, a hem with four waves, big eyes. Lantern: a radial glow that grows with the streak.
- High contrast: a flat background, no layers.
- A test double of the canvas that cannot make gradients still works: `art.ts` falls back to a flat colour.

## 5. Bosses you can hear

`pattern.ts` defines `BossPattern`: the throws, the order of volleys and the volley length.

The Pumpkin King:

| | Lobbed bomb | Rolled bomb |
|---|---|---|
| Beep (countdown) | 659 Hz sine | 392 Hz square |
| Throw sound | airy noise, rising | low buzz, falling |
| Tell | rising sine, 440 to 880 Hz, "Lobbed." | falling square rumble, 147 to 98 Hz, "Rolled." |
| Drawn | round, fuse up, arcs in from above | squat, dust behind, stays on the ground |

The fight is a song (`patternSong`): a 2-bar intro, then six times a 1-bar rest ("Tell lob" or "Tell roll") and a 4-bar busy volley that holds only that kind. Order: lob, roll, lob, roll, lob, roll. At 2 throws a volley the fight is 12 throws, about 54 s of level time.

The tell is sent by `main.ts` from level time (`sendTells`), a quarter second early, once. After a retry the next tell is the first one still ahead, so a tell already heard is not repeated.

The first tell comes 2 bars in, so a pattern boss holds level time until the whole introduction has been said (`holdUntil`), not only until the first countdown.

Proofs:

- 22 *Boss pattern can be heard*: for each pair of throw kinds, the beeps, the throw sounds and the tells differ in timbre and are at least a major third (1.25) apart in pitch; every tell has words and a caption; the level has the pattern's volleys in order, each with a tell, each with at least one throw, each throw of its volley's kind.
- 23 *Tell clear of the countdowns*: from the tell's start until its sound and words are done at the fastest speed (words taking 1.2 times `speechMs`), there is no throw sound or countdown, and the first throw it announces counts down at least one bar after it.
- The boss kit gets 15, 16, 19, 20, 103, 104 from the song and 22, 23 from `properties`.

Health: `need = ceil(0.7 x throws in the level)`, with `needed(boss, count)`.

## Proof ids

| Id | Name | Where |
|---|---|---|
| 19 | Locked to the song | kit, with any song |
| 20 | Instant retry | kit, with `run.explainOnce` |
| 21 | Gentle pulses | kit `provePresentation`, with any song |
| 22 | Boss pattern can be heard | game, boss with a pattern |
| 23 | Tell clear of the countdowns | game, boss with a pattern |

## Risks

- The short line and the attempt are said while play resumes, and the next number can cut them off.
- Tunes, tell sounds and bomb pitches were chosen without ears. Tune by playing.
- Real players, including blind players, have not tried the pattern yet.

## The Pumpkin King (Stage 1 redo)

Drawn in `apps/ghastly-moves/src/king.ts`, code only, no assets. Inspiration is the style of dark hand-drawn action games (cold area hue, silhouette first, rim light); nothing is copied from any game's characters, bosses or music.

- **Silhouette.** A tall triangle of cloak (about 330 px in its own units, drawn at 0.76), a round glowing head, a sharp crown. Not a blob: the read at a glance is "tall spike, round light on top".
- **Shape language.** Triangles and thorns for the body (cloak, crown tips, hooked fingers, thorns on the arms); round only for the head, so the head is the focal point.
- **Palette.** Three values plus one accent. Near-black cloak, moss and rust mids (the leaves), ember orange as the only saturated colour (the carved eyes and mouth, the cracks). Cool blue rim light from the moon on the right edges.
- **Parts.** Head: three-lobed cracked gourd with carved eyes and a jagged mouth lit from inside (flicker under 1 Hz, steady with reduced motion). Crown: five twisted dry stems with curling tendrils. Cloak: six rows of dead leaves, sweeping the ground on the left. Arms: long thin vine arms, thorned, with three hooked fingers. Roots instead of feet. Seeds drift off the cloak.
- **Poses, tied to the sound.** Idle: slow breathing, cloak sway. Lob wind-up (the rising tell): both arms over the head, head tipped back. Roll wind-up (the low rumble tell): crouch, front arm swept low. Swoop wind-up: one arm flung high and out. Throw: the front arm snaps forward at release, then eases home. Hurt: recoil, cracks flare, a few leaves fall. Laugh: head bobs, mouth widens. Defeated: the cloak sinks, the head rolls down, the glow dies, and a pile of pumpkins and leaves is left (2.6 s). The scene picks the wind-up from the song's `Tell <id>` part, so what is seen is what is heard.
- **Arena.** When the fight starts the scene shifts: a bigger moon, a ring of tall dead cornstalks, and the King on a raised mound at the right.

## Stage 1 art direction (Pumpkin Patch)

`apps/ghastly-moves/src/patch.ts`. One cold hue (blue-violet night), small warm lights (pumpkins, a church window, the lantern). Layers, far to near: sky and moon with shafts of light; far hill with church spire and dead tree; second ridge with far lit pumpkins; fence and leaning scarecrows; vines and pumpkins on the ground line (some lit, with halos); foreground silhouettes (vines, gate post, grass) at the screen edges only. Fog gradients between layers. Rim light on every silhouette. Static layers are painted once to offscreen canvases. Fireflies and seed fluff drift slowly; with reduced motion all of it stands still. A soft dark halo sits behind every obstacle so stones stay the clearest thing on screen.

## Later: bring-your-own tracks (not built)

A licensed audio track per stage would sit beside the synthesised one. Each track needs: a beat map (BPM, first-beat offset, the song's sections in bars) which the existing song proofs check against the level; pitch-preserving playback for the slower speeds (`HTMLMediaElement.preservesPitch`); the cues (beeps, tells, speech) always above it, with the same ducking; offline caching of the file; and a licence file stored next to each track naming its source and terms. Until a track is added, the synthesised one plays.
