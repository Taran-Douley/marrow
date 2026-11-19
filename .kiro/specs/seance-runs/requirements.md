# Requirements: Séance Escape runs

## Introduction

Séance Escape becomes a game of short runs. Each run is a new haunted house, proven before it is served, that takes 5 to 8 minutes. Three catches end a run. Listen, search and hide each help and each cost something the player is told about. The phantom follows the noise you make, and you hear it move around you. Rooms roll random events. Relics found in a run give one perk in the next run, chosen by scanning.

Stage 1 (built now): the run loop, which is new house per run, the run length proof, the three-catch end, and the graphics. The other pillars are designed in design.md and left unbuilt in tasks.md.

Glossary: **run** is one visit to one house, from the first step to the escape or the end. **Catch** is the phantom reaching you. **Profile** is a speed (slow, medium, fast) together with a scanning dwell (at least 1500 ms, 2200 ms by default, 4000 ms at most). After the perks are built, a profile also includes the perk. **Clean run** is a run by a player who knows nothing of the house, is never caught, and never listens, hides or asks for a hint.

## Conflict with the accessibility rules, and how it is settled

`accessibility.md` says "No lives, no game over screens, no punishing restarts". The user asked for three catches to end a run. The two are settled like this:

- Catches end a run by default, because the user asked for it.
- The end is told gently ("The house lets you go."), never as "game over". There is no score loss, nothing is taken away, and one press starts the next run in a new house.
- A setting, "Catches end a run: on / off", turns the limit off for any player who needs to play with no limit. It is in the one-switch settings and on the page form. Turning it off changes nothing else.
- Escaping ends the run as a win.

## Requirement R1: Every run is a new house

**User story.** As a player, I want each run to be a different house, so that a run is never a replay.

R1.1 WHEN a run starts, THE SYSTEM SHALL serve a house from a new seed. The seed comes from a saved run counter, which moves on after each run.
R1.2 IF the saved counter cannot be read or written, THEN THE SYSTEM SHALL still start a run, from house 1 or from the number on the page.
R1.3 THE SYSTEM SHALL prove a house with properties 201 to 206, and for the standard size 207, before serving it.
R1.4 IF a house fails any property, THEN THE SYSTEM SHALL skip it, never serve it, and log the skip with the seed and the reason. It SHALL then try the next seed.
R1.5 IF no house passes within 400 seeds, THEN THE SYSTEM SHALL say so in words and stay on the menu.

## Requirement R2: A run takes 5 to 8 minutes

**User story.** As a player, I want a run to be short enough to try again and long enough to matter.

R2.1 THE SYSTEM SHALL serve, at the standard size, only a house whose clean run takes 5 to 8 minutes for every profile. This is property 207, Run length fits.
R2.2 THE SYSTEM SHALL count a clean run from the stride time of the speed, the time to say each line, and the time to read the ways out at the dwell (each way lit for the dwell or for the time it takes to say it, whichever is longer), plus a reaction time of 0.4 s.
R2.3 Speed and dwell SHALL change timing only, never the house, its rooms or its relics.
R2.4 THE SYSTEM SHALL offer a small house (a shorter run) and a large house (a longer run) as the player's own choice. They are still proven for 201 to 206, are not held to 207, and the game says it is a shorter or longer run.
R2.5 FOR every profile in the table, the proof SHALL check 5 to 8 minutes. The measured lengths are in design.md.

## Requirement R3: Three catches end a run

**User story.** As a player, I want a run to be tense and short, and the next one to be one press away.

R3.1 WHILE "Catches end a run" is on, WHEN the third catch happens, THE SYSTEM SHALL end the run.
R3.2 THE SYSTEM SHALL tell the end by sound, caption and speech (and by the aria-live region), in these words: "The house lets you go. You found 2 of 3 relics." followed by the rooms, the time and the catches. It SHALL NOT say "game over".
R3.3 WHEN a run has ended, THE SYSTEM SHALL start the next run, in a new house, on one press of any key, click, tap or gamepad button. Escape SHALL go to the menu.
R3.4 WHILE "Catches end a run" is off, THE SYSTEM SHALL play on after every catch as it did before (back to the last room, with help after two catches).
R3.5 THE SYSTEM SHALL offer "Catches end a run: on / off" in the one-switch settings menu and on the page form, save it, and say its new value when it changes.
R3.6 WHEN the player escapes, THE SYSTEM SHALL end the run as a win, with the same summary and the same one-press next run.
R3.7 THE SYSTEM SHALL ignore a press for 1.5 s after a run ends, so a press meant for the game does not skip the summary.

## Requirement R4: Choices have a told risk (designed, not built)

R4.1 THE SYSTEM SHALL tell the player the cost of Listen, Search and Hide before they choose it, in the option's own words.
R4.2 WHEN the player listens, THE SYSTEM SHALL cost one phantom move and report where the phantom, the bell and the nearest relic are.
R4.3 WHEN the player searches a room, THE SYSTEM SHALL cost noise the phantom can hear, and SHALL give a relic hint or a perk charge.
R4.4 WHEN the player hides, THE SYSTEM SHALL cost time while the phantom searches, and SHALL make the player safe from a catch for that time.
R4.5 THE SYSTEM SHALL keep every house proven with these costs in force (see Requirement R8).

## Requirement R5: The phantom tracks noise and moves in 3D audio (designed, not built)

R5.1 THE SYSTEM SHALL make each action a noise of a size the player can read: walking is small, searching is large, listening is silent.
R5.2 THE SYSTEM SHALL make the phantom walk toward the loudest recent noise it can hear.
R5.3 THE SYSTEM SHALL sound the phantom's steps, moans and breath from where it is, in 3D audio, and say its place in words, caption and the heartbeat.

## Requirement R6: The house surprises you (designed, not built)

R6.1 WHEN the player enters a room, THE SYSTEM SHALL roll a random room event from a table, using a seeded roll so a house is repeatable.
R6.2 EACH room event SHALL have a sound, a caption and a spoken line, and SHALL NOT take a sense away or require quicker timing.
R6.3 THE SYSTEM SHALL keep every event's effect inside what the proof allows (R8).

## Requirement R7: Relics carry over (built)

R7.1 WHEN a run ends, THE SYSTEM SHALL grant one perk for the next run for the relics found, chosen by the player by scanning.
R7.2 THE SYSTEM SHALL offer the choice with one switch and with no time limit.
R7.3 A perk SHALL help (a quieter step, a free Listen and hint, a first catch that does not count) and SHALL never be needed to finish a house. It SHALL apply to the next run only, and the run SHALL say which perk is on.

## Requirement R8: Every house passes the proof for every profile

R8.1 THE SYSTEM SHALL prove 201 to 206 for a house under every profile: every speed (slow, medium, fast) and every dwell (1500, 2200 and 4000 ms).
R8.2 THE SYSTEM SHALL prove 207 for the standard size under the same profiles.
R8.3 AFTER the perks are built, THE SYSTEM SHALL prove every house under every perk as well.
R8.4 `prove_house` in Level Forge SHALL be able to prove 207 (`runLength: true`).

## Requirement R9: Graphics

R9.1 THE SYSTEM SHALL draw the house with a warm lantern, fake soft shadows, fog that gives depth, wainscoting, skirting, door frames, a patterned rug, grained wood, dust, low mist, a dark vignette and a phantom with a layered glow, all made in code.
R9.2 Nothing SHALL flicker more than 3 times a second, and with reduced motion nothing SHALL flicker or drift.
R9.3 THE SYSTEM SHALL reuse geometry and materials, and draw walls, trims, door frames and shadows as instanced meshes, so a laptop keeps up.
R9.4 Text and essential graphics SHALL keep WCAG contrast. The picture shows only what is also said and written.
