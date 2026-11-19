# Requirements: the Marrow accessibility advisor

## Introduction

A developer tells Marrow what kind of game they are making. Marrow suggests accessibility features for the whole game that fit its genre and theme. A haunted house gets creaks and bells, not random beeps. The developer discusses the plan and changes it. When they add a feature or change the idea, the plan is updated, and their decisions are kept. Marrow then builds what was agreed, and bot players check the result can be finished and plays well.

The advisor works for any game, in any engine, because its output is a plan of words. It can also *build and prove* a plan for games that use Marrow's patterns (timed press, lessons, songs, scanning navigation) in the browser. For other games it says which parts the developer builds by hand, and which proof pattern is still missing.

Scope for 30 November 2026: the brief, the suggestions, four theme palettes, the editable plan, the update on change, building the agreed items, and a quality report from the bot players. Unity and Godot adapters, and new proof patterns for other genres, are roadmap.

Glossary: **brief** is the developer's description of the game. **Suggestion** is one accessibility feature, with why, for whom and how. **Plan** is the list of suggestions with the developer's decisions. **Palette** is a set of themed sounds for the roles every game has.

---

## Requirement A1: The game brief

**User story.** As a developer, I want to describe my game in a few plain lines, so that the advice fits my game.

A1.1 THE SYSTEM SHALL read a brief written as plain lines: `Name:`, `Genre:`, `Theme:`, `Controls:`, `Engine:`, `Players:`, and a `Features:` list. Every field except the name SHALL be optional.

A1.2 THE SYSTEM SHALL know these genres: runner, rhythm, platformer, quiz, maze, puzzle, shooter, racing, card, story, and other. An unknown genre SHALL be treated as "other" and the advice SHALL say so.

A1.3 THE SYSTEM SHALL know at least four themes with their own sounds: haunted, space, forest, underwater, plus a neutral fallback.

A1.4 WHEN a brief cannot be read (no name, for example), THE SYSTEM SHALL say what is missing in plain words and give a line to copy.

## Requirement A2: Suggestions that fit the game

**User story.** As a developer, I want suggestions across the whole game, in the words of my game, so that I can see what to add and why.

A2.1 THE SYSTEM SHALL suggest features for every part of a game that applies: input and controls, sound, speech and text, sight, difficulty and failure, menus and setup, story and dialogue, and the game's own features.

A2.2 EACH suggestion SHALL say what to add, why it matters, which players it helps (as ways of playing, never naming a disability), and which guideline it follows (Game Accessibility Guidelines or Xbox Accessibility Guidelines).

A2.3 EACH suggestion SHALL say how it is done: built into Marrow (with the setting or call), built by the advisor from the plan, or built by hand in the game (with a short how-to).

A2.4 Suggestions SHALL follow the genre: for example, a rhythm game gets a visible beat; a maze gets "listen" and scanned directions; a quiz gets explained mistakes; a shooter gets aim help, built by hand.

A2.5 Suggestions SHALL follow the features in the brief: for example "boss" gets warned attacks with sound and caption; "timer" gets an adjustable or removable timer; "dialogue" gets captions with speaker names and a voice per character.

A2.6 THE SYSTEM SHALL never call a game "fully accessible", and SHALL end every plan by saying the plan does not replace testing with disabled players.

## Requirement A3: Sounds that fit the theme

**User story.** As a developer, I want the sounds Marrow adds to sound like my game, so that accessibility improves the design instead of fighting it.

A3.1 THE SYSTEM SHALL offer a palette per theme. It SHALL give a sound and plain words for each role: two countdown cues, a step, a reward, danger, a menu tick, a fall and an ambience bed. Example: a haunted palette has "a low church bell" and "a creaking board".

A3.2 IN every palette, cue sounds SHALL differ in both pitch and timbre, SHALL stay clear of the music's pitch range (property 14), and every role SHALL have a sound and words.

A3.3 THE SYSTEM SHALL check every palette with a proof that names the failing role in plain words.

## Requirement A4: A plan the developer owns

**User story.** As a developer, I want to accept, reject or change each suggestion, and talk it through, so that the final design is mine.

A4.1 THE SYSTEM SHALL write the plan as a Markdown checklist, grouped by part of the game. `[x]` accepts, `[ ]` is undecided and `[-]` rejects, and a note may follow any item.

A4.2 THE SYSTEM SHALL read the plan back with every decision and note intact (round trip).

A4.3 A custom agent (the accessibility designer) SHALL discuss the plan with the developer. It SHALL explain choices, propose alternatives that fit the theme, and edit the plan only as agreed.

## Requirement A5: Advice that follows the game as it changes

**User story.** As a developer, I want the plan to update when I add a feature or change the idea, so that the advice stays right for the game I am actually making.

A5.1 WHEN the brief changes, THE SYSTEM SHALL make a new plan and keep the developer's decisions and notes on every suggestion that still applies.

A5.2 New suggestions SHALL be marked "new". Suggestions that no longer apply SHALL be marked "no longer fits", and kept if the developer had accepted them, so nothing agreed is lost silently.

A5.3 A Kiro hook SHALL update the plan when the brief is saved.

## Requirement A6: Building what was agreed

**User story.** As a developer, I want Marrow to build the accepted plan, so that I do not wire it by hand.

A6.1 FOR every accepted suggestion that Marrow can build, THE SYSTEM SHALL produce a settings file the game passes to `createKit` or `createGame`. It covers the palette's sounds for cues and events, the coach, timing help as a default, announce levels, and the first-run setup.

A6.2 FOR every accepted suggestion that is built by hand, THE SYSTEM SHALL list it as a to-do with the how-to, and SHALL not claim it is done.

A6.3 THE built game SHALL pass every proof property it passed before.

## Requirement A7: Bots check it can be finished and plays well

**User story.** As a developer, I want evidence that the game can be finished and is good to play, so that I do not ship a level that excludes someone.

A7.1 THE SYSTEM SHALL make a quality report for a game: levels proved, the chance a simulated player with a given timing error clears each jump, and the chance they finish a level clean, at each speed. It SHALL also report the longest wait with nothing to do, and whether speech stays slow enough to follow (property 18).

A7.2 THE report SHALL give a plain verdict per speed ("good", "hard", "too hard") with the reason, and SHALL suggest the change that would help most (for example "Fast is too hard for a 250 ms player: offer timing help").

A7.3 THE report SHALL say clearly that bots measure whether a game can be finished and how it plays, not whether it is fun, and that real players must test it.
