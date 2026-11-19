# Tasks: Séance Escape runs

Stages 1 to 3 are built (run loop, risk and noise, room events). Stage 4 (relic perks) is built. Nothing has been tried by a player other than the author.

## Stage 1: the run loop

- [x] 1.1 A new house per run, from a saved run counter, proven before it is served; a failing house is skipped and logged (R1)
- [x] 1.2 The headless explorer and property 207, Run length fits, over every speed and dwell, on at least 200 seeds (R2, R8)
- [x] 1.3 Three catches end a run, told gently, one press to the next run, with the "Catches end a run" setting in the scanning menu and the page (R3)
- [x] 1.4 `prove_house` can prove 207 (`runLength`) from Level Forge (R8.4)
- [x] 1.5 Graphics: warm lantern, fake shadows, fog, wainscoting, door frames, rug and wood, mist, vignette, phantom glow, flicker at most 3 a second (R9)

## Stage 2: risk and noise

- [x] 2.1 Listen, Search and Hide say their cost before they are chosen (R4). Labels carry the noise and the cost; Search is new (once per room, very loud, rolled result).
- [x] 2.2 Noise levels per action, and a phantom that follows the loudest noise, in `phantomTurn` (R5). Meter in bars and words, `ghost-step` and `ghost-heard` in 3D.
- [x] 2.3 Re-prove 205 and 206 with the costs and the noise in force. 205 plays every way of paying (any searches, every noisy event); 200 standard houses and 60 served houses are never caught.

## Stage 3: the house surprises you

- [x] 3.1 The table of room events, each with sound, caption and speech, rolled by seed (R6). Ten events; Fright softens the scary ones; the one picture effect is slow and still with reduced motion.
- [x] 3.2 Prove events never change the maze or the proof. Property over 200 seeds in `skeleton/test/risk-and-events.test.ts`.

## Stage 4: relics carry over

- [x] 4.1 One perk per run from the relics found, chosen by scanning (R7). Three perks, one per relic (Soft steps, A free look, Second chance); saved for the next run only; with no relics, none, said gently.
- [x] 4.2 Prove every house under every perk, every speed and every dwell (R8.3). 205 is played under each perk; 207 holds with the perk line said; 200 seeds with fast-check.
