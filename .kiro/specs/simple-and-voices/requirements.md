# Requirements: simple and voices

## Introduction

Both games get a "Keep it simple" way to play, characters that sound different from each other, a voice speed, two lines a player can ask for at any time, gentle scares, four new proofs, and advisor rules tied to published accessibility guidelines. The work is done in the order 2, 3, 4, 1, 5, 6, 7, 8. The user plays for two minutes with eyes closed after task 2 and after task 1 before the work goes on.

Numbering below matches the request: R1 is the first item (Keep it simple), R2 the second (character voices), and so on to R8.

Glossary: **character** is a speaker with a name, a voice profile and a signature sound. **Narrator** is the game itself: the character that speaks every line with no named speaker. **Signature** is the short sound (under 300 ms) a character makes just before each line. **Decision** is anything the player must press for: a jump, a maths gate, a choice at a stop. **Keep it simple** is a setting in the profile, offered in first-run setup. **Gentle scares** is a setting in the profile. **Voice speed** is the pace of speech, 0.5x to 2.0x.

## Limits, said plainly

- **The browser voice cannot be placed.** The Web Speech API's voice cannot be routed through Web Audio, so it cannot be panned and no filter can be put on it. "Stereo position" applies to the signature sound, and to a recorded clip where the clip player supports it. It does not apply to the words said by the browser voice. Characters are told apart by name, pitch, pace and signature as well.
- **Signatures add time.** A signature plus a short pause comes before each line of a character that has one. Every estimate of how long a line takes, in the run, the walk and every proof, includes that time. In Ghastly Moves a signature never sounds from the first beep of a countdown to its fourth beat, so it never blurs the beat.
- **Guideline names are checked, not remembered.** Task 7 needs a check of each rule against gameaccessibilityguidelines.com. No guideline name is written from memory.
- **Nobody has tried this yet.** No player other than the author has played any of it. Real players with disabilities still outrank every assumption here.

## Requirement R1: Keep it simple

**User story.** As a player who finds a busy game hard, I want the game to ask one thing of me at a time and use plain words, so that I can play without being overwhelmed.

R1.1 WHEN first-run setup is shown, THE SYSTEM SHALL offer "Keep it simple" as a way to play. It is spoken, shown and pulsed, scanned like every other option, and can be combined with the other options. It never names a condition.
R1.2 WHILE Keep it simple is on, THE SYSTEM SHALL ask for no two decisions within 2.5 s of each other at the speed the player chose.
R1.3 WHILE Keep it simple is on in Ghastly Moves, THE SYSTEM SHALL keep every maths gate clear of every jump by that margin.
R1.4 WHILE Keep it simple is on in Séance Escape, THE SYSTEM SHALL offer one choice per stop.
R1.5 WHILE Keep it simple is on in Ghastly Moves, THE SYSTEM SHALL pick easier numbers, and adapt after successes or misses: easier after misses, harder after a run of successes, never past the stage's own range.
R1.6 WHILE Keep it simple is on in Séance Escape, THE SYSTEM SHALL make the phantom slower, never have more than one phantom at a time, always offer "What next?", and give a free hint after one catch instead of two.
R1.7 WHILE Keep it simple is on, THE SYSTEM SHALL use the plain-words column of the strings table: short sentences, no idioms.
R1.8 WHILE Keep it simple is on, THE SYSTEM SHALL play music and ambience quieter, and SHALL duck everything else while speech is playing.
R1.9 Turning Keep it simple on SHALL change nothing a player did not ask for beyond R1.2 to R1.8. A player who turns it off gets the usual game back.

## Requirement R2: Character voices

**User story.** As a player, I want to tell who is speaking, so that I can follow a story by ear, by caption or by screen reader.

R2.1 EACH speaking character SHALL have a voice profile declared in its game's kit: a name, the browser voices it prefers (a list, with a fall-back), a pitch, a rate, a stereo position from -1 to 1, and a signature sound under 300 ms.
R2.2 WHEN a character with a signature speaks, THE SYSTEM SHALL play the signature just before each of its lines, and start the voice after it.
R2.3 THE SYSTEM SHALL refuse, when the kit is made and in plain words, a signature of 300 ms or more, a position outside -1 to 1, and a speaker no character declares.
R2.4 THE SYSTEM SHALL show the speaker's name in the caption ("Mabel: ..."), and write "Name: line" to the aria-live region. A narrator with no name is shown without one, and the choice is the same in both games.
R2.5 WHERE only one system voice exists, THE SYSTEM SHALL still keep characters apart by pitch, rate, signature and name.
R2.6 WHILE the built-in voice is off, THE SYSTEM SHALL still play each signature and still write "Name: line" to the aria-live region.
R2.7 THE SYSTEM SHALL put no effect on the words themselves: no filter, echo or reverb on speech.
R2.8 THE SYSTEM SHALL count the signature and its pause in every speech-duration estimate, and SHALL keep every existing proof passing.
R2.9 THE SYSTEM SHALL keep a signature from sounding inside any Ghastly Moves countdown.
R2.10 A game developer SHALL need only a `characters` table in the kit and `speaker` on an event to use it.

## Requirement R3: Voice speed

**User story.** As a player who hears fast speech badly, or waits too long for slow speech, I want to set how fast the voice talks.

R3.1 THE SYSTEM SHALL offer a voice speed from 0.5x to 2.0x in the scanned settings menu, in steps the scanning menu can reach with one switch, and save it in the profile.
R3.2 THE SYSTEM SHALL apply the speed to the browser voice and to the estimate of every spoken line.
R3.3 EVERY speech-duration estimate used by the run, the walk and the proofs SHALL use the player's voice speed. Time added by a signature SHALL NOT scale with it.
R3.4 IF a saved voice speed is outside 0.5 to 2.0 or is not a number, THEN THE SYSTEM SHALL use 1.0.
R3.5 THE timing proofs SHALL pass at 0.5x, 1.0x and 2.0x (see R6.3).

## Requirement R4: Say that again, and where am I

**User story.** As a player who missed a line or lost my place, I want to hear the last line again, and where I am and what to do next.

R4.1 WHEN the player chooses "Say that again", THE SYSTEM SHALL speak the last spoken line again, with its speaker (signature, voice and name).
R4.2 WHEN the player chooses "Where am I / What next?", THE SYSTEM SHALL speak one line with the player's location and goal.
R4.3 BOTH SHALL be reachable with one switch at any time, in play and in menus, and neither SHALL change the game, cost the player anything or change the timing of a countdown in progress.
R4.4 IF there is no last line yet, THEN "Say that again" SHALL say so in one short line.
R4.5 BOTH lines SHALL be written to the aria-live region and shown as captions, not only spoken.

## Requirement R5: Gentle scares

**User story.** As a player who is startled easily, I want the game without sudden frights and sudden loudness.

R5.1 THE SYSTEM SHALL offer Gentle scares as a profile setting, on by default when Keep it simple is on.
R5.2 WHILE Gentle scares is on, THE SYSTEM SHALL play no jump scare: no sudden loud sound, and no sudden full-screen change, for fright.
R5.3 WHILE Gentle scares is on, THE SYSTEM SHALL keep every sound from rising more than 12 dB within 200 ms.
R5.4 Gentle scares SHALL remove no information. What a scare told the player is still heard and read.
R5.5 Turning it on SHALL change no timing and no layout.

## Requirement R6: Proofs

**User story.** As a creator, I want each promise proved, with a property test and a counterexample I can read.

R6.1 PROOF "One thing at a time" SHALL hold for every Ghastly Moves level and every Séance Escape house when Keep it simple is on (R1.2 to R1.4).
R6.2 PROOF "Characters apart" SHALL hold: every pair of speaking characters differs in at least two of pitch, rate, position and signature.
R6.3 PROOF "Timing at every voice speed" SHALL hold: every timing proof passes at 0.5x, 1.0x and 2.0x.
R6.4 PROOF "Gentle loudness" SHALL hold: with Gentle scares on, no sound rises by more than 12 dB within 200 ms.
R6.5 EACH proof SHALL have a property test over generated levels, houses or sounds, and when it fails SHALL give a counterexample in plain English that names the level or house, the thing that broke, and by how much.
R6.6 No existing proof SHALL be weakened to make these pass.

## Requirement R7: Advisor rules with guideline citations

**User story.** As a creator, I want the advisor to recommend these features, and to say which published guideline each one answers.

R7.1 THE advisor rule set SHALL gain rules for Keep it simple, distinct character voices, voice speed, say it again, where am I, plain words and gentle scares.
R7.2 EACH rule, new and existing, SHALL cite the matching Game Accessibility Guidelines item and an ESA Accessible Games Initiative tag.
R7.3 EACH guideline name and link SHALL be checked against gameaccessibilityguidelines.com when the rule is written. THE SYSTEM SHALL NOT invent a name. IF no item matches, THEN the rule SHALL say "no matching guideline item" rather than guess.
R7.4 IF no ESA tag covers a rule, THEN it SHALL say "no ESA tag covers this yet" as the report does today.

## Requirement R8: Report, docs and tests

R8.1 THE accessibility report SHALL list each new feature and proof, and what each does not do.
R8.2 THE docs and the README "what you get for free" SHALL describe the new features and the limits above.
R8.3 EACH task SHALL add or update tests, and every test file SHALL pass before the task is ticked.
R8.4 `docs/kiro-usage-log.md` SHALL get an entry for each task.
