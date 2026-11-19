# Design: Séance Escape runs

Stages 1 to 4 are built.

## 1. Every run is a new house (built)

`apps/seance-escape/src/runs.ts`, `serveHouse(firstSeed, size, onSkip)`. It tries seed after seed from the saved run counter (`localStorage` key `seance.run`, read and written in try/catch). For each seed it builds a house (`generateMaze`, 3 relics), proves it with `proveMaze(house, label, { runLength })`, and serves the first that passes. A house that fails is reported to `onSkip`, logged to the console ("house N skipped, not served" with the reason), and never reaches the player. The counter moves to the served seed plus one. `?level=` sets the first house of a visit. At most 400 seeds are tried.

Sizes (rooms across by down): small 8 by 8, medium 12 by 10 (the standard house), large 14 by 14.

## 2. Run length (built): property 207, Run length fits

`skeleton/src/navigation/explorer.ts` has a headless explorer. It walks the house depth first, as a player who does not know the map. It steers toward a relic whose hum is in range (8 rooms), takes each relic it comes to, then goes by the shortest road to the bell. It never listens, hides or asks for a hint, and is never caught.

Time it counts:

- Walking: `stepMs` for the speed (slow 800, medium 600, fast 450), a first stride after a choice at 0.6 of that.
- Speaking: the introduction (17 s), each room (4.4 s the first time, 1.7 s again), each relic (4.1 s), the ritual line (5.8 s), the sealed exit (7.4 s) and the phantom's place (1 s a stop). These are measured from Séance Escape's own words (`lineMs`, the scanner's rule times 1.2); a test checks them against the real lines.
- Choosing: each way before the one wanted is lit for `dwellFor` (the dwell, or longer for a long label), plus a reaction time of 0.4 s.

`proveMaze(house, label, { runLength: true })` adds 207: for every profile (slow, medium, fast by dwell 1500, 2200, 4000 ms: 9 profiles) the estimate must be 5 to 8 minutes. It is opt-in, so the older tests that prove other sizes still stand. The game turns it on for the standard size. Level Forge's `prove_house` takes `runLength: true`.

### Measured: the standard house (12 by 10, 3 relics)

Before the fix, 207 passed for 56 of 240 seeds (23%): 118 houses were too short, 66 too long, and the game skipped 3 in 4 seeds. A clean run varies a lot with how soon the explorer finds the last relic, and the nine profiles span about 1.3 times between the quickest (fast, 1500 ms) and the slowest (slow, 4000 ms), so only a house whose quickest run is 5.0 to 6.2 minutes fits.

The fix is in the generator, not the proof: `generateMaze(seed, { fit })` lays the house out again (a new carving, relics and rooms from the same seed, in a fixed order) until `fit` accepts the layout, before the phantom is placed. The game passes `fit` = property 207 itself, so the band is still 5 to 8 minutes, the explorer is unchanged, and content is the same at every speed and dwell. Now 240 of 240 seeds pass 201 to 207 for all 9 profiles (cost: about 0.15 s to serve a house). Level Forge's `prove_house` with `runLength: true` lays the house out the same way. Over the first 60 served houses (clean-run minutes, min / median / max):

| Speed | Dwell 1500 | Dwell 2200 | Dwell 4000 |
| --- | --- | --- | --- |
| Slow | 5.81 / 6.83 / 7.40 | 5.97 / 6.98 / 7.55 | 6.38 / 7.41 / 8.00 |
| Medium | 5.38 / 6.16 / 6.71 | 5.53 / 6.31 / 6.88 | 5.92 / 6.73 / 7.39 |
| Fast | 5.03 / 5.65 / 6.24 | 5.18 / 5.82 / 6.43 | 5.49 / 6.19 / 6.95 |

One house fits every profile, because the layout is chosen to fit all nine, and the content is the same for everyone. A house that is 5.0 at fast, 1500 ms is at most about 6.5 at slow, 4000 ms, so the window exists. A real player, who listens, hides and is caught, takes longer than the clean run. This is an estimate, not a measurement of players.

## 3. Three catches end a run (built)

`CATCH_LIMIT = 3`. The page checks `snapshot.catches` each frame. At 3, with "Catches end a run" on, it ends the run: the third catch's own line is "That is three times, dear. Enough for tonight.", then the `run-end` event says "The house lets you go. You found 2 of 3 relics. You went through 14 rooms in 6 minutes 12 seconds. You were caught 3 times. Press any key to enter a new house, or Escape for the menu." It has a soft falling chime, a caption and speech, so it reaches sight and hearing, and it is also in the aria-live region. The mode becomes `ended`; one press calls `start()` for a new house. An escape uses the same mode with the `summary` event. A short lockout (1.5 s) stops a stray press.

The setting `seance.catches` (`on` / `off`) is in the scanning menu ("Catches end a run: On: three catches end a run / Off: no limit") and on the page form (a checkbox). Off keeps the old behaviour.

## 4. Choices with a told risk (built, stage 2)

Each choice says its cost in its own spoken and written label, before it is chosen:

- "Listen: no noise, the phantom moves once". Silent. It costs a turn.
- "Search: very loud, the phantom moves once". New. Offered once per room, in a ritual house, never in the chase. It makes a very loud noise (noise 3). What it turns up is rolled by the house seed and the room: a relic hint (about half the rooms, while relics are left), the phantom's trail (where it is), or only dust.
- "Hide: no noise, you wait, and it may search here". A hidden player is never caught, but time passes, and the phantom may come to the wardrobe it heard you go into (it follows the last noise made there), search it and move on.
- "Ask for a hint: the phantom moves once" (Mabel, "Ask Mabel: the phantom moves once" in the game). Quiet (noise 1).

The labels are `listenLabel`, `searchLabel`, `hideLabel` and `hintLabel` in `WalkSettings`. The ids (`listen`, `search`, `hide`, `hint`) are unchanged. The proof for 205 is rerun with the costs in force (section 5).

## 5. Noise tracking and 3D audio (built, stage 2)

Noise levels (`NOISE` in `skeleton/src/navigation/maze.ts`): listening 0, hiding 0, walking 1, running in the chase 2, searching 3. The phantom hears a noise of level n within `hearRadius(n)` = 2 + n rooms along the passages (walking is 3, as before; silence only beside you) and hunts. A little farther, up to 2 more rooms (`INVESTIGATE_EXTRA`), it only hears something: it remembers the place (`PhantomState.heard`; the loudest recent noise wins; forgotten after 5 turns), prowls to it instead of a random room, and the walk says `ghost-heard`. A noise made while hidden is not heard. This is in `phantomTurn` and `phantomHears`, which the walk and the proof share, so the proof checks the same phantom.

Told three ways. The noise meter (`noise-meter` event, `snapshot.noise`) has three bands: quiet (0 to 1), loud (2), very loud (3). A loud thing dies away one level a turn. Only a change of band is told: each band has its own tone, a caption ("Noise: very loud") and a spoken word, and a meter of bars and the words is drawn bottom right (never colour alone). The phantom's moves are `ghost-step` events sent by the walk, with the angle and distance from the player, within 4 rooms, and placed in 3D by the web adapter; `ghost-heard` and `ghost-sense` are spatial too.

Proof (205): `simulateRitual` plays the best route under every way of paying the costs: every noisy room event of the route is heard, and a search (noise 3, the phantom moves once) in any subset of the relic rooms but the last. The result is the worst of them, and the generator picks the phantom's start by it, so every served house is never caught and keeps the 2-room gap however the player pays. Generating costs about 0.15 s a house; the layout limit for a ritual house rose from 160 to 400 tries. At the old test size of 6 by 6, 31 of 200 seeds now have no fair house (they were all buildable before); the game's own sizes (8 by 8, 12 by 10, 14 by 14) build every seed tried.

## 6. Room events (built, stage 3)

Ten events (`ROOM_EVENTS` in `skeleton/src/navigation/events.ts`), rolled once per room, the first time you walk in, from the house seed and the room number (`rollRoomEvent`), so a house is repeatable. About 45% of rooms have one. Never the start room, never in the chase. The skeleton holds the mechanics, the game (`content.ts`) the sound, caption and line of each, and `kit.ts` the kit events `room-event-<id>`. Scary ones have a soft line and a sound softened by Fright (gentle, or a plain chime when off). Nothing flashes more than 3 times a second: the one event with a picture, `lights-gutter`, dims the room slowly (at most 1.5 swings a second; `EVENT_FLICKER_MAX_HZ` is 2), and with reduced motion it only dims and recovers.

| Event | Scary | Effect |
| --- | --- | --- |
| door-slam | yes | noise 3: the phantom may hear it |
| chains-rattle | yes | noise 2 |
| cold-draught | no | a hint toward the nearest relic (or the bell) |
| whispers-in-the-walls | no | says where the phantom is |
| music-box | no | a landmark, from a place in the room |
| lights-gutter | no | the room dims for a moment |
| portrait-watches | yes | nothing |
| clock-strikes | no | nothing |
| cold-hand | yes | nothing |
| scratching | yes | nothing |

Events never change the maze, so 201 to 204, 206 and 207 are not affected. The noisy events are part of the proof of 205 (section 5). Property tests over 200 seeds check that playing a house with its events leaves the maze and its proof results unchanged (`skeleton/test/risk-and-events.test.ts`).

## 7. Relics carry over, perks chosen by scanning (built, stage 4)

At the end of a run (escape or three catches), each relic found offers its perk. The player chooses one by scanning: each perk is said with what it does, lit for the dwell, and the list goes round with no time limit. The last entry is "No perk". One press chooses. The choice is saved (`seance.perk`, in try/catch) and read once at the next run's start, then cleared, so it applies to that run only. The run's introduction says "Perk on: ...". With no relics found there is no perk, said gently. A perk is never needed.

| Relic | Perk | Effect | Words |
| --- | --- | --- | --- |
| the Silver Candle | Soft steps | Every noise you make is one level quieter (walking 1 to 0, running 2 to 1, a search 3 to 2, events too) | Every noise you make is one step quieter, so the phantom hears you from less far away. |
| the Locket | A free look | Your first Listen and first hint at a stop cost no turn: the phantom does not move. The option says so before it is chosen, and is priced normally after | Your first Listen and your first hint cost no turn, so the phantom does not move. |
| the Planchette | Second chance | The first catch is told and you are put back as usual, but it does not count toward the three or the score | The first time the phantom catches you does not count toward the three. |

Rules every perk keeps: it never changes the house (generation takes no perk); it never changes the timing model (stride, lines, dwell); it only lowers a cost or adds help. Only soft steps changes the phantom's part on the best route, so `simulateRitual` plays it and the generator places the phantom to be fair with and without it.

## 8. Proof under every profile and every perk (built)

`proveMaze` runs 201 to 206 on the house and does not depend on speed or dwell: the phantom moves by steps of the player, so a house that is safe is safe at every speed and every dwell. The profile only changes real time. 207 does depend on the profile and is checked for all nine. The tests run the proof on 240 seeds with fast-check (`skeleton/test/run-length.test.ts`), on the served houses of the app (`apps/seance-escape/test/runs.test.ts`) and from the server (`mcp/level-forge/test/server.test.ts`).

Perks (stage 4): property 205 is played with no perk and with each perk (`simulateRitual(house, { perk })`); the default `simulateRitual` is the worst of no perk and soft steps, which the generator uses. A run with a perk says one more line at its start, so the game's fit and final proof also judge 207 with the longest perk line added to the introduction (`PERK_RUN_LINES`). Tests: `skeleton/test/perks.test.ts` (200 seeds) and `apps/seance-escape/test/perks.test.ts` (60 served houses, all 9 profiles, 200 seeds).

## 9. Graphics (built)

All in `apps/seance-escape/src/world.ts`, `view3d.ts`, `glow.ts` and `scene.ts`.

- Warmer lantern (0xffa04a) and a warm near-black fog (exp2 0.072) with a matching background.
- Fake shadows: one instanced mesh of soft dark blots under crates, barrels, candles, skulls and bookcases.
- Wainscoting, rail and skirting: three instanced meshes over every wall, with a wood grain texture.
- Door frames at every room opening: posts and a lintel, two instanced meshes.
- A patterned rug texture (border, diamond, fringe) on the passage rugs, plank grain and knots on the floor.
- Dust (already there) and a new low mist: 36 faint puffs that follow the player.
- A vignette over the picture, warm and still.
- The phantom has an outer halo, an aura, a core and a pool of light on the floor, tinted blue when it prowls and red when it hunts.
- Flicker: lantern 2.1 and 1.2 Hz, torch 1.4 and 2.7 Hz, flame 2.2 Hz, all under 3 a second (`FLICKER`, tested). With reduced motion nothing flickers and the mist and dust do not drift.
- Draw calls: the new parts add 8 instanced draws for the whole house, plus the halo and pool for the phantom. Geometry and materials are shared.
