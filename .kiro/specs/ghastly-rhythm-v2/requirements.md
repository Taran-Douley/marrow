# Requirements: Ghastly Moves, rhythm v2

## Introduction

Ghastly Moves is a rhythm runner that teaches maths. This spec makes it fun to replay, not only possible to finish. It follows the five Ghastly pillars in `.kiro/steering/game-feel.md`: the level is the song, a retry is instant, portals change the move, the picture dances, and bosses can be heard.

Nothing here makes the timing tighter or takes a sense away. Every generated level still passes every existing proof, and each new feature adds a proof of its own.

Size: Stage 1 (the Pumpkin Patch and its boss, the Pumpkin King) is built first, with pillars 1, 2, 4 and 5 and the new graphics. Stage 1 has no portals on purpose: it teaches the beat. Portals already exist in stages 2 to 7 (property 16). The other stages, the other six bosses and a seen portal gate come later (see tasks.md).

Glossary: **beat** is one pulse of the song. **Press** is the move on the fourth beat. **Volley** is a group of throws of one kind. **Tell** is the sound, caption and words that say which volley is next. **Attempt** is one try, from the start or from a restart after a fall. **Best** is the furthest share of a level passed in one attempt without a fall.

---

## Requirement 1: Locked to the song

**User story.** As a player, I want every press to land on a beat, so that playing feels like playing the music.

1.1 THE SYSTEM SHALL place every obstacle so that its ideal press is a whole number of beats from the start of the level, within 1e-6 seconds.

1.2 THE SYSTEM SHALL place every obstacle so that its countdown, from the first beep until the obstacle is passed, lies inside one part of the song that is not a rest.

1.3 WHEN a part of the song is a rest, THE SYSTEM SHALL have no countdown and no press in it.

1.4 THE SYSTEM SHALL refuse to serve a level that breaks 1.1 or 1.2, with the obstacle and the time in the reason (property 19).

1.5 Property 19 SHALL be proved over at least 200 random seeds for the song of every stage, and for the Pumpkin King's fight.

## Requirement 2: Instant retry

**User story.** As a player, I want to try again at once after a mistake, so that I stay in the flow.

2.1 WHEN the player falls, THE SYSTEM SHALL say a short reason at once: "Early", "Late", "Missed" or "Wrong number".

2.2 WHEN the player falls at an obstacle they have not fallen at before, THE SYSTEM SHALL also say the longer explanation (the sum behind a wrong number). The words-in-full rule still holds for this fall: level time may wait until those words are said, so this one retry can take longer than a second.

2.3 WHEN the player falls at an obstacle again, THE SYSTEM SHALL say only the short reason and the attempt number ("Early. Attempt 4."), and level time SHALL move again within 1000 real milliseconds at slow, medium and fast speed.

2.4 THE SYSTEM SHALL show, on the canvas, the progress (the share of the level passed, as a percentage), the attempt number (falls so far in this level, plus one) and the best.

2.5 THE SYSTEM SHALL save the best for each stage, and for each boss, in `localStorage`, and a store that is blocked or holds bad data SHALL count as no best.

2.6 WHEN the clean stretch of an attempt passes a best that was saved before, THE SYSTEM SHALL play a new-best sound once in that attempt, with a caption ("New best: 58%") and a short spoken "New best". A first run has no best to beat and plays no sound.

2.7 At each fall THE SYSTEM SHALL add the attempt, the progress and the best to the `aria-live` region, without speaking them.

2.8 THE SYSTEM SHALL prove that a repeat fall resumes within 1000 ms at every speed (property 20), and a headless test SHALL play three repeat falls at each speed to check it.

Not promised: the short reason and the attempt number are said while play resumes. If the next number is announced before they end, the next number cuts in.

## Requirement 3: Portals change the move (later)

3.1 WHEN a part of the song changes the move, THE SYSTEM SHALL announce the portal in sound, picture and words before it matters (property 16). This already holds for stages 2 to 7.

3.2 WHERE a part of the song changes the move (stages 2 to 7), THE SYSTEM SHALL draw a gate on the way, arriving with the portal and labelled in words with the new mode ("Flip mode"), with a mark that differs by mode. It SHALL not flash, and with reduced motion it only scrolls with the level.

## Requirement 4: The picture dances

**User story.** As a player, I want the world to move with the music, so that it feels alive, without hurting my eyes.

4.1 THE SYSTEM SHALL pulse the picture gently on each beat: a soft glow on the moon and the lantern, with at most one pulse a beat.

4.2 THE SYSTEM SHALL pulse at most 3 times a real second at every speed for every stage tempo.

4.3 WHILE motion is reduced, THE SYSTEM SHALL not pulse, scroll the scenery, wave the ghost's hem or bob it.

4.4 A full pulse SHALL change the luminance of what is behind it by less than 0.1 (the WCAG general-flash threshold) in every theme.

4.5 THE SYSTEM SHALL prove 4.1 to 4.4 (property 21).

4.6 THE SYSTEM SHALL draw the places with a gradient night sky, a moon with a soft glow, three layers of silhouette scenery that drift at different speeds, a textured ground, a ghost with a soft body and a wavy hem, and a lantern with a radial glow. The map screen SHALL have the same sky.

4.7 Essential graphics SHALL keep 3:1 contrast and text 4.5:1. Scenery SHALL be dim behind obstacles. Nothing SHALL flash.

## Requirement 5: Bosses you can hear

**User story.** As a player who cannot see the screen, I want to read a boss's pattern by sound, so that I can plan.

5.1 THE Pumpkin King SHALL attack in a fixed pattern that repeats: lobbed bombs, then rolled bombs, three times.

5.2 EACH kind of throw SHALL have its own sound, different in pitch and in timbre from the other kind (a major third or more apart, and a different wave or noise).

5.3 BEFORE each volley THE SYSTEM SHALL give a tell: a sound, a caption and two words ("Lobbed.", "Rolled."), at the start of a bar of rest that is a whole bar before the first throw of the volley.

5.4 A tell SHALL never overlap a countdown or a throw sound, at any speed (property 23).

5.5 Every throw in a volley SHALL be the kind its tell announced (property 22).

5.6 Throws SHALL keep the normal take-off window and countdown, and presses SHALL stay on the beat (property 19).

5.7 THE SYSTEM SHALL keep the boss's health, the hit count and the item reward working. The number of hits needed is 70% of the throws in the song.

5.8 THE SYSTEM SHALL say how to read the pattern in the boss's introduction.

5.9 EVERY other boss SHALL have a pattern of its own (its own throw kinds, sounds, tells and volleys), under 5.2 to 5.6. Timing is not harder for later bosses: only the fight may be longer. Bone Warden and Moss Witch have two kinds; the others three (lobbed, rolled and swooped).

5.10 THE SYSTEM SHALL pulse every obstacle softly on the beat, the same for targets and duds, give each stage its own pulse colour and wash, and show each stage's best run and its boss's best on the map, in the stage list and in the one-switch menu, in words.

## Requirement 6: Proofs first

6.1 Every generated level, stage and boss, SHALL pass all existing proofs and the new ones (19 to 23) before it is served.

6.2 A failing property SHALL give a plain-English reason.

6.3 Every new line the game says SHALL be in the strings table, and every new event SHALL reach at least two senses.

6.4 One switch SHALL still do everything.
