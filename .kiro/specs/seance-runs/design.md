# Design: Séance Escape runs

Stage 1 is built. The other pillars are design only.

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

207 passes for 56 of 240 seeds (23%); the other 184 are skipped. All 240 pass 201 to 206. Over 60 served houses (clean-run minutes, min / median / max):

| Speed | Dwell 1500 | Dwell 2200 | Dwell 4000 |
| --- | --- | --- | --- |
| Slow | 6.04 / 6.90 / 7.43 | 6.16 / 7.06 / 7.57 | 6.46 / 7.45 / 7.97 |
| Medium | 5.49 / 6.26 / 6.67 | 5.60 / 6.40 / 6.82 | 5.90 / 6.76 / 7.29 |
| Fast | 5.06 / 5.71 / 6.17 | 5.19 / 5.88 / 6.33 | 5.49 / 6.24 / 6.77 |

One house size fits every profile, because the houses that fit all nine are chosen by the proof, and the content is the same for everyone. A house that is 5.0 at fast, 1500 ms is at most about 6.5 at slow, 4000 ms, so the window exists. A real player, who listens, hides and is caught, takes longer than the clean run. This is an estimate, not a measurement of players.

## 3. Three catches end a run (built)

`CATCH_LIMIT = 3`. The page checks `snapshot.catches` each frame. At 3, with "Catches end a run" on, it ends the run: the third catch's own line is "That is three times, dear. Enough for tonight.", then the `run-end` event says "The house lets you go. You found 2 of 3 relics. You went through 14 rooms in 6 minutes 12 seconds. You were caught 3 times. Press any key to enter a new house, or Escape for the menu." It has a soft falling chime, a caption and speech, so it reaches sight and hearing, and it is also in the aria-live region. The mode becomes `ended`; one press calls `start()` for a new house. An escape uses the same mode with the `summary` event. A short lockout (1.5 s) stops a stray press.

The setting `seance.catches` (`on` / `off`) is in the scanning menu ("Catches end a run: On: three catches end a run / Off: no limit") and on the page form (a checkbox). Off keeps the old behaviour.

## 4. Choices with a told risk (design)

Each of the three has a cost the option says before it is chosen. Listen: "Listen, the phantom moves once". Search: "Search, noisy". Hide: "Hide, you wait". The costs are already in the walk (Listen and Hint force one phantom move, Hide passes time while the phantom prowls). Search is new: it makes a loud noise (section 5) and gives a hint or a perk charge. The proof for 205 and 206 is rerun with each action's cost in force.

## 5. Noise tracking and 3D audio (design)

Add a noise level to each action: walking 1, searching 3, listening 0, running (in the chase) 2. The phantom prowls toward the loudest noise made within hearing range in the last few moves, instead of a random room, and hunts when a noise is within `PHANTOM_NOTICE`. This stays in `phantomTurn`, which the walk and the proof share, so the proof checks the same phantom. Its steps and moans already use `ghost-step`, `ghost-moan` and `ghost-sense` with an angle and a distance, which the web adapter places in 3D audio.

## 6. Room events (design)

A table of about eight events, rolled once per room per run from a seeded generator (house seed and room index), so a house is repeatable. Each has a sound, a caption and a spoken line, and an effect that is information or a small cost. Examples: a door slams (noise, the phantom hears it), a cold draught (a relic hint), a music box starts (a landmark), the lights gutter (nothing, picture only, with reduced motion nothing). No event removes a sense or asks for timing. Events never change the maze, so 201 to 207 are not affected. Events that add noise are included in the proof of 205 and 206 as extra phantom pull.

## 7. Relics carry over, perks chosen by scanning (design)

At the end of a run, the player has earned one perk token per relic found, to a limit of one perk. A scanned list offers the perks (for example: Soft steps, one free hint, a longer hide, a warmer lantern), each lit for the dwell, no time limit, one press chooses. The choice is saved (`seance.perk`) and applies to the next run. A perk changes the phantom's rules in a small, bounded way, so every house is proven under every perk (R8.3). A perk is never needed.

## 8. Proof under every profile (built for 201 to 207, perks later)

`proveMaze` runs 201 to 206 on the house and does not depend on speed or dwell: the phantom moves by steps of the player, so a house that is safe is safe at every speed and every dwell. The profile only changes real time. 207 does depend on the profile and is checked for all nine. The tests run the proof on 240 seeds with fast-check (`skeleton/test/run-length.test.ts`), on the served houses of the app (`apps/seance-escape/test/runs.test.ts`) and from the server (`mcp/level-forge/test/server.test.ts`).

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
