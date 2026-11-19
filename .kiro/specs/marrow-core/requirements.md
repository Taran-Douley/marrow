# Requirements — marrow-core

The Marrow skeleton: a TypeScript library that gives any browser game
accessibility by default. A game **declares semantic events**; the skeleton
**renders each event through every enabled channel** (sound, speech, captions,
visual sound indicator, haptics), shaped by **one player profile**. A developer
declares game objects and gets their accessible outputs for free, and a
property-based proof guarantees every generated level is finishable with a
single switch — and that no content flashes unsafely, every event reaches two
senses, every theme meets contrast, no input is forced-hold, and every line is
in the strings table — before any player sees it.

**Architecture (channels).** Games never call sound, speech or captions
directly. They emit semantic events (e.g. `obstacle-approaching`, `hurt`,
`level-complete`); channels subscribe and render; the single player profile
(timing, dwell, contrast theme, text/UI scale, colour-blind palette, motion,
volumes for cues/speech/music, mono audio) shapes every channel. See the
"Channels architecture" section in `tech.md`.

**Scope.** This spec covers the shared skeleton only (`skeleton/`). The two
apps (Ghastly Moves, built; the second game still to be chosen) and
the MCP server have their own specs. Apps
depend on the skeleton only through its public API (`skeleton/src/index.ts`).

**Conventions.** Acceptance criteria use EARS (Easy Approach to Requirements
Syntax). All timing constants (`T`, `BEAT`, `M`, `GAP`, speed rates, widths,
first-obstacle start, obstacles-per-level) come from `tech.md` and are the
single source of truth; no requirement restates a numeric value that `tech.md`
defines, it references the named constant.

Glossary: **press** = the one normalised input event; **running seconds** =
level time before the speed rate scales it to real time; **take-off window**
`[a, b]` and **ideal press** `J` as defined in `tech.md`.

---

## Requirement 1 — Single-switch input layer

**User story.** As a player who uses one switch (or a key, a touch, a mouse, or
a gamepad), I want every input device to act as the same single press, so that
I can play and navigate with whatever I have.

**Acceptance criteria.**

1.1 WHEN a key is pressed (other than Tab, Escape, or a modifier combination),
THE SYSTEM SHALL emit exactly one `press` event.

1.2 WHEN a pointer is clicked, a touch begins, or any gamepad button is pressed,
THE SYSTEM SHALL emit exactly one `press` event.

1.3 WHILE a key is held and the operating system emits key-repeat events, THE
SYSTEM SHALL ignore every repeat and emit no additional `press` event until the
key is released and pressed again.

1.4 WHEN the Escape key is pressed, THE SYSTEM SHALL return to the menu and
SHALL NOT emit a `press` event.

1.5 WHERE a key uses Tab or a modifier combination (Ctrl, Alt, Meta, Shift with
another key), THE SYSTEM SHALL leave the event to the browser and SHALL NOT emit
a `press` event.

1.6 THE SYSTEM SHALL NOT require holding, double-pressing, simultaneous presses
(chords), or fast repeated presses for any action.

1.7 WHEN a gamepad is connected or disconnected during play, THE SYSTEM SHALL
continue to accept presses from every remaining input device without a restart.

1.8 WHERE the player turns on hold-to-confirm in their profile, THE SYSTEM SHALL
offer it as an optional alternative only AND SHALL keep a single press working
for the same action; hold-to-confirm SHALL NOT be the default and SHALL NOT be
the only way to do anything. (Build-now: the proof property; the hold-to-confirm
input itself is a later task — see Tiering.)

---

## Requirement 2 — Switch scanning

**User story.** As a one-switch player, I want options to light up and be spoken
in turn so that I can choose any of them — including menus and settings — with a
single press.

**Acceptance criteria.**

2.1 WHILE scanning is active, THE SYSTEM SHALL highlight each option in turn and
SHALL speak its label as it is highlighted.

2.2 WHEN a `press` arrives while an option is highlighted, THE SYSTEM SHALL
choose that option.

2.3 THE SYSTEM SHALL use a default dwell of 2.2 seconds per option AND SHALL
allow the dwell to be adjusted.

2.4 WHILE a keyboard user has focused a control, THE SYSTEM SHALL pause scanning
until focus leaves that control.

2.5 THE SYSTEM SHALL cycle menu options automatically until one is pressed, with
no time limit, so that a one-switch player needs only one press AND SHALL NOT
expire, skip or auto-choose any option.

2.6 WHEN the end of the option list is reached, THE SYSTEM SHALL wrap to the
first option and continue scanning.

---

## Requirement 3a — Semantic events, channels and the player profile

**User story.** As a game developer, I want to emit meaning-level events and
have the skeleton present them through every enabled channel, shaped by the
player's one profile, so that I never wire sound, speech or captions by hand.

**Acceptance criteria.**

3a.1 THE SYSTEM SHALL let a game declare and emit semantic events (e.g.
`obstacle-approaching`, `press-now`, `hurt`, `cleared`, `level-complete`,
`menu-option`, `fall-reason`), each carrying data but no presentation detail.

3a.2 WHEN a semantic event is emitted, THE SYSTEM SHALL render it through every
**enabled** channel — sound, speech, captions, visual sound indicator, haptics —
and SHALL NOT require the game to target any channel directly.

3a.3 THE SYSTEM SHALL drive every channel from one **player profile** holding
timing (speed), dwell, contrast theme, text/UI scale, colour-blind palette,
motion, volumes for cues / speech / music (independent), and mono audio; a game
SHALL read the profile, never a raw per-channel setting.

3a.4 WHEN a channel is disabled in the profile, THE SYSTEM SHALL stop rendering
to it AND SHALL still satisfy the two-sense rule (Requirement 8, property 8)
through the remaining enabled channels, or refuse to serve (Requirement 8.9).

3a.5 THE SYSTEM SHALL provide, at minimum, these channels: sound, speech
(mirrored to `aria-live`), captions, visual sound indicator, haptics (gamepad
rumble).

3a.6 WHEN a sound cue plays, THE SYSTEM SHALL fire the visual sound indicator at
the same moment on level time, so a deaf player sees every sound.

---

## Requirement 3 — Sound channel (cue scheduler)

**User story.** As a player, I want each obstacle announced by three
pitch-coded countdown beeps so that I know when to press, by ear alone.

**Acceptance criteria.**

3.1 WHEN an object type is first used, THE SYSTEM SHALL assign it a distinct
voice from the voice table in `tech.md`, differing from other assigned types in
BOTH pitch AND timbre.

3.2 FOR each obstacle, THE SYSTEM SHALL schedule three countdown beeps at
`J − 3·BEAT`, `J − 2·BEAT`, and `J − BEAT` on level time, where `J` and `BEAT`
are defined in `tech.md`.

3.3 THE SYSTEM SHALL schedule all beeps on running (level) time AND SHALL scale
them to real time by the selected speed rate from `tech.md`.

3.4 WHEN the voice table has no unused entry for a new object type, THE SYSTEM
SHALL still assign a voice that differs in pitch and timbre from its immediate
neighbours in the level, OR SHALL report at build time that distinct voices are
exhausted.

3.5 THE SYSTEM SHALL NOT convey any obstacle cue by sound alone; every beep has
a matching caption pip (see Requirement 5) and fires the visual sound indicator
(Requirement 3a.6).

3.6 THE SYSTEM SHALL apply the profile's independent cue / speech / music
volumes and the mono-audio option when rendering the sound channel.

---

## Requirement 4 — Speech mirrored to aria-live

**User story.** As a screen-reader user, I want every spoken announcement also
written to a live region so that my screen reader reads it, and I want to turn
the built-in voice off so I do not hear it twice.

**Acceptance criteria.**

4.1 WHEN the system speaks any announcement through the built-in voice, THE
SYSTEM SHALL also write the identical text to an `aria-live="polite"` region.

4.2 WHILE the built-in voice is turned off, THE SYSTEM SHALL still write every
announcement to the `aria-live` region.

4.3 THE SYSTEM SHALL provide an on/off toggle for the built-in voice,
persisted per player.

4.4 IF the Web Speech API is unavailable, THEN THE SYSTEM SHALL continue to
write announcements to the `aria-live` region and SHALL NOT fail.

4.5 THE SYSTEM SHALL phrase announcements as plain, short sentences using the
words players use ("fence", "grave", "press now").

4.6 THE SYSTEM SHALL let the developer plug in their own voice (an AI voice
service or any speech engine) for the spoken lines, without editing kit code.

4.7 THE SYSTEM SHALL let the developer supply recordings for lines, by the
exact line or by a function, and SHALL speak a line with the browser voice when
it has no recording.

4.8 THE SYSTEM SHALL, by default, choose the most natural voice the browser has
for the player's language, and SHALL let the developer name preferred voices and
set speed and pitch.

4.9 WHEN a custom voice or a recording fails, THE SYSTEM SHALL fall back to the
next voice (provider, then recording, then browser voice) so that a line is
never lost, AND SHALL write the text to the `aria-live` region in every case.

4.10 THE SYSTEM SHALL list every line the game can speak, so a developer knows
exactly what to record or generate, and SHALL mark lines whose text is filled in
at play time.

---

## Requirement 5 — Captions with four countdown pips

**User story.** As a deaf or hard-of-hearing player, I want the countdown shown
on screen with pips so that I get the same cue the beeps give, without sound.

**Acceptance criteria.**

5.1 THE SYSTEM SHALL draw an on-canvas caption box showing the current object's
name.

5.2 THE SYSTEM SHALL draw four countdown pips: the first three amber (one per
countdown beep) and the fourth green (the press beat).

5.3 WHEN each countdown beep plays, THE SYSTEM SHALL light the matching pip at
the same moment on level time.

5.4 THE SYSTEM SHALL meet WCAG 2.2 AA contrast for caption text (≥ 4.5:1) and
for pips as essential graphics (≥ 3:1) in every theme, and SHALL apply the
profile's contrast theme, text/UI scale and colour-blind palette when drawing
captions and pips (checked by proof property 8.13).

5.5 THE SYSTEM SHALL distinguish the fourth pip from the first three by shape or
position as well as colour, so that nothing is conveyed by colour alone.

5.6 WHILE `prefers-reduced-motion` is set, THE SYSTEM SHALL light pips without
flashing or idle animation AND SHALL NOT flash anything more than three times
per second.

---

## Requirement 6 — Object registry with automatic accessible defaults

**User story.** As a game developer, I want to declare an object in a few lines
and get its sound, spoken name and caption for free, so that accessibility costs
me nothing extra.

**Acceptance criteria.**

6.1 THE SYSTEM SHALL expose `defineObstacle(name, { width, draw?, say?, sound?,
caption? })` where only `name` and `width` are required.

6.2 WHEN `say` is omitted, THE SYSTEM SHALL derive a spoken name from `name`.

6.3 WHEN `caption` is omitted, THE SYSTEM SHALL derive a caption from `name`.

6.4 WHEN `sound` is omitted, THE SYSTEM SHALL assign a voice automatically per
Requirement 3.1.

6.5 WHEN `draw` is omitted, THE SYSTEM SHALL draw a default placeholder shape in
code (no external asset).

6.6 IF an object is defined without a sound, a spoken name, AND a caption (after
defaults are applied), THEN THE SYSTEM SHALL refuse to register it and SHALL
report which accessible output is missing.

6.7 THE SYSTEM SHALL keep the public developer API small enough to show in one
screenshot (target: the full surface in `skeleton/src/index.ts` fits on one
screen).

---

## Requirement 7 — Seeded level generator

**User story.** As a developer and as the proof, I want levels generated from a
seed so that any level is reproducible and testable.

**Acceptance criteria.**

7.1 THE SYSTEM SHALL generate a level from a numeric seed using a mulberry32
PRNG.

7.2 WHEN the same seed is supplied twice, THE SYSTEM SHALL produce an identical
level.

7.3 THE SYSTEM SHALL place the first obstacle at the first-obstacle start time
from `tech.md` and SHALL produce the obstacles-per-level count from `tech.md`.

7.4 THE SYSTEM SHALL space obstacles so that the start of the next minus the end
of the previous falls within the `GAP` range from `tech.md`.

7.5 THE SYSTEM SHALL draw each obstacle's width from the per-type range in
`tech.md`.

---

## Requirement 8 — Proof module (fourteen properties)

**User story.** As everyone who relies on Marrow, I want a proof that checks
every level against all properties and refuses any level that fails, with a
plain-English reason. Properties 8.2–8.7 are the six finishability/cue
properties; 8.11–8.15 are the channel/profile safety properties; 8.17–8.20 are
the intent, audibility and setup properties. (These map to properties 1–14 in
`tech.md`.)

**Acceptance criteria.**

8.1 THE SYSTEM SHALL expose a proof callable from tests, from the browser, and
from the MCP server, returning pass/fail and, on failure, a plain-English
counterexample.

8.2 THE SYSTEM SHALL check **Jumpable**: every obstacle has a non-empty take-off
window (`b ≥ a`).

8.3 THE SYSTEM SHALL check **Reachable**: taking off at the earliest possible
moment for each obstacle, the player lands before the next take-off window
closes.

8.4 THE SYSTEM SHALL check **Unambiguous cues**: each countdown starts after the
player lands from an on-time jump over the previous obstacle
(`J_next − 3·BEAT ≥ J_prev + T + 0.25`).

8.5 THE SYSTEM SHALL check **Multisensory**: every object type has a sound, a
spoken name, and a caption.

8.6 THE SYSTEM SHALL check **Window floor**: the take-off window is at least
400 ms at Fast and at least 650 ms at Slow.

8.7 THE SYSTEM SHALL check **Fourth beat clears**: a press exactly on the fourth
beat (`J`) clears every obstacle.

8.8 WHEN any property fails, THE SYSTEM SHALL produce a plain-English
counterexample naming the level, the obstacle index, the object type and its
width, and the numeric reason — for example: "Level 17, obstacle 4 (crypt, 1.00
s wide): no take-off point clears it. One jump covers only 0.73 s."

8.9 WHEN a level fails any property, THE SYSTEM SHALL refuse to serve that level
to a player.

8.10 THE SYSTEM SHALL evaluate the timing properties in running seconds and
SHALL apply the window-floor check (8.6) per speed rate from `tech.md`.

8.11 THE SYSTEM SHALL check **No unsafe flashing**: no content (channel output
or drawn art) flashes more than three times per second.

8.12 THE SYSTEM SHALL check **Two-sense rule**: every semantic event the level
emits reaches at least two senses through the enabled channels, under the
profile being proved.

8.13 THE SYSTEM SHALL check **Contrast**: every theme meets WCAG 2.2 AA contrast
(≥ 4.5:1 text, ≥ 3:1 essential graphics).

8.14 THE SYSTEM SHALL check **No forced hold or chord**: no input requires
holding or simultaneous presses; hold-to-confirm, where present, is an opt-in
alternative and a single press still performs the same action.

8.15 THE SYSTEM SHALL check **Strings coverage**: every caption and every spoken
line the level can produce exists in the strings table.

8.16 WHEN any of properties 8.11–8.15 fails, THE SYSTEM SHALL produce a
plain-English counterexample in the same form as 8.8 — for example: "Theme
'midnight': caption text on panel is 3.9:1, below the 4.5:1 floor," or "Event
'hurt' reaches only one sense (sound) when captions are off." THE SYSTEM SHALL
refuse to serve content that fails any property (per 8.9).

8.17 THE SYSTEM SHALL check **Intent preserved**: a repair applies only to the
profile that needs it, and the default profile's level is identical before and
after any repair.

8.18 THE SYSTEM SHALL check **No repair for a profile that didn't ask**: no
repair applies to a profile that did not ask for it. A player's own choice
(for example "More time", which sets Speed) is a change that player made, not a
repair. WHEN a proposed repair would change timing, content or difficulty for a
profile that did not ask for it, THE SYSTEM SHALL reject it with a
plain-English reason.

8.19 THE SYSTEM SHALL check **Cues audible over ambience**: at every moment a
cue plays, its level exceeds the ambient soundscape and music by a set margin,
under every profile volume mix.

8.20 THE SYSTEM SHALL check **Setup options reach two senses**: every first-run
setup option is spoken, shown and pulsed, and none depends on one sense alone.

---

## Requirement 9 — Persona simulations

**User story.** As the team, I want headless simulated players to estimate how
likely a real player is to clear each level at each speed, so that we test
before a human does.

**Acceptance criteria.**

9.1 THE SYSTEM SHALL provide a **perfect one-switch** persona that presses
exactly on the fourth beat.

9.2 THE SYSTEM SHALL provide a **one-switch with timing error** persona whose
press offset is drawn from a Gaussian with a configurable σ (e.g. 100, 150,
250 ms).

9.3 THE SYSTEM SHALL provide an **audio-only** persona that receives only cue
events — the three countdown beeps and their timing — and presses from the
fourth beat, exactly as a player who cannot see the screen does.

9.4 WHEN a persona plays a level, THE SYSTEM SHALL report the clear rate per
speed.

9.5 THE SYSTEM SHALL run persona simulations headlessly (no audio hardware, no
display) so they can run in CI and in the MCP server.

---

## Requirement 10 — Session log with CSV export

**User story.** As the team running player tests, I want each attempt recorded
and exportable so that I can measure completion, falls, and distance from the
beat.

**Acceptance criteria.**

10.1 FOR each attempt, THE SYSTEM SHALL record the obstacle, the result, the
press offset from the fourth beat in milliseconds, the window in milliseconds,
the speed, and the picture mode.

10.2 WHEN the player requests an export, THE SYSTEM SHALL produce a CSV of all
recorded attempts.

10.3 THE SYSTEM SHALL record offsets and windows in milliseconds of real time,
derived from running seconds via the speed rate.

---

## Requirement 11 — Player profile persistence

**User story.** As a player, I want my one profile remembered so that I do not
set it again each visit, and so that every channel follows it.

**Acceptance criteria.**

11.1 THE SYSTEM SHALL persist, per player, one profile holding: Speed (default
Slow), Picture on/off, Built-in voice on/off, Switch scanning on/off (default
on), contrast theme, text/UI scale, colour-blind palette, cue / speech / music
volumes, mono audio, visual sound indicator on/off, and haptics on/off.

11.2 THE SYSTEM SHALL follow the operating system `prefers-reduced-motion`
setting for Reduced motion.

11.3 THE SYSTEM SHALL read and write settings via localStorage wrapped in
try/catch, and IF localStorage is unavailable, THEN THE SYSTEM SHALL fall back
to in-memory defaults without failing.

11.4 WHILE Picture is off, THE SYSTEM SHALL hide the game view so that a sighted
tester plays by sound, as a blind player does.

---

## Requirement 12 — Failure handling

**User story.** As a player, I want a gentle failure that tells me why and lets
me retry, so that falling is never punishing.

**Acceptance criteria.**

12.1 WHEN a player presses outside the take-off window, THE SYSTEM SHALL explain
the reason in plain words ("Pressed a little early", "Pressed a little late",
"No press").

12.2 WHEN a player falls, THE SYSTEM SHALL restart just before that obstacle.

12.3 THE SYSTEM SHALL NOT use lives, a game-over screen, or a punishing restart.

12.4 WHEN the speed is changed, THE SYSTEM SHALL change the timing window only
AND SHALL NOT change the level content.

---

## Requirement 13 — Property-based tests for every proof property

**User story.** As the team, I want each proof property checked by
property-based tests over random seeds so that the guarantee is tested, not
asserted.

**Acceptance criteria.**

13.1 THE SYSTEM SHALL provide fast-check property-based tests, one per proof
property — the six timing/cue properties (Requirements 8.2–8.7), the five
channel/profile properties (Requirements 8.11–8.15) and the four intent,
audibility and setup properties (Requirements 8.17–8.20) — over randomly generated
seeds and, where relevant, randomly generated profiles and themes.

13.2 WHEN a property-based test finds a failing case, THE SYSTEM SHALL surface
the same plain-English counterexample as Requirement 8.8 or 8.16.

13.3 THE SYSTEM SHALL use the `tech.md` constants in all property-based tests.

13.4 THE SYSTEM SHALL run the property-based tests in CI.

13.5 THE SYSTEM SHALL target 100% pass across N ≥ 200 generated levels.

---

## Requirement 14 — Accessibility feature report (ESA tag mapping)

**User story.** As a game developer, I want the skeleton to produce my game's
accessibility feature list automatically, so that I can publish honest,
standard accessibility tags without hand-writing them.

**Acceptance criteria.**

14.1 THE SYSTEM SHALL generate an accessibility feature list from what it
actually guarantees: the enabled channels and the passing proof properties.

14.2 THE SYSTEM SHALL map each guaranteed feature to the matching ESA
Accessible Games Initiative tag (the 24 standard tags, 2025) — for example
single-switch play + no-forced-hold → *Single Input*; sound + visual indicator
+ captions → *Visual Alternatives to Sound*; speech + `aria-live` → *Narration*;
contrast theme + text scale + colour-blind palette → *High Contrast* /
*Colourblind Options*; speed + dwell → *Difficulty / Timing Options*;
no-unsafe-flashing → *No Flashing*.

14.3 THE SYSTEM SHALL list only tags the skeleton's guarantees support, and
SHALL NOT claim a tag whose proof property is failing or whose channel is
disabled.

14.4 THE SYSTEM SHALL NOT describe any game as "fully accessible"; it states
what is supported.

14.5 THE SYSTEM SHALL make the report callable from tests, from the browser, and
from the MCP server, in machine-readable form (for CI) and human-readable form
(for a README or store page).

---

## Requirement 15 — Marrow ships as a Kiro power

**User story.** As a game developer using Kiro, I want to install Marrow as one
power and have Kiro build my game on it automatically, so that my game is
accessible by default and proven, without me asking for accessibility or knowing
how it works.

**Acceptance criteria.**

15.1 THE SYSTEM SHALL package Marrow as a Kiro power in the Agent Plugins format
(v1.0), installable with no manual JSON or CLI configuration.

15.2 THE power SHALL bundle: the accessibility steering (product, tech,
structure, accessibility); the level-forge MCP server (`generate_level`,
`prove_level`, `simulate_persona`, and the accessibility report of Req 14); the
hooks (the proof hook that runs the fourteen-property proof when an object or
content file is saved, and the store-list hook that regenerates the ESA-tagged
feature list); and the runtime skeleton (`skeleton/`).

15.3 WHEN a developer asks Kiro to build a game and the power is installed, THE
SYSTEM SHALL cause Kiro to build the game on Marrow — emitting semantic events,
rendering through channels, generating levels, and running the proof — by
default, without the developer requesting accessibility.

15.4 THE power SHALL load its context automatically when the developer mentions
building a game (keyword activation), and Kiro SHALL show it is active.

15.5 THE two demo apps (ghastly-moves and the second game) SHALL be built through the
installed power, not by reaching into `skeleton/` internals, so that the
submission demonstrates the power end to end.

15.6 THE SYSTEM SHALL NOT require the developer to add any accessibility
declaration for the defaults to apply; accessibility is opt-out, never opt-in.

---

## Requirement 16 — Power benchmark (with vs without)

**User story.** As the team, I want a repeatable benchmark that shows how much
the power changes the outcome, so that the write-up and video can state a hard
number.

**Acceptance criteria.**

16.1 THE SYSTEM SHALL define three fixed game prompts (e.g. a runner, a quiz, a
simple timing game) used for the benchmark, recorded in the repository.

16.2 FOR each prompt, THE SYSTEM SHALL build the game twice: once in a fresh
project **without** the Marrow power installed, and once **with** it installed.

16.3 FOR each build, THE SYSTEM SHALL run the fourteen proof properties
(Requirements 8.2–8.7, 8.11–8.15 and 8.17–8.20) and record how many pass.

16.4 THE SYSTEM SHALL produce a benchmark table — prompt × (without / with) ×
properties-passing — in machine-readable form (for CI) and human-readable form
(for the write-up).

16.5 THE benchmark SHALL be reproducible from a seed or a recorded procedure, so
a judge or reviewer can re-run it.

16.6 THE SYSTEM SHALL state the benchmark result honestly, reporting the
"without" column as-is even when it passes some properties by chance, and SHALL
NOT claim the power makes a game "fully accessible".

---

## Requirement 17 — First-run setup flow

**User story.** As a player who may not see, hear or press quickly, I want to
start playing at once and tune the game by sound, sight and touch, without
naming a condition.

**Acceptance criteria.**

17.1 WHEN the game first opens, THE SYSTEM SHALL start with every channel
enabled, so a player can play without choosing anything.

17.2 THE SYSTEM SHALL present setup options as ways to play, in this set:
"Just play", "Play by sound", "Play by sight", "More time", "More settings",
and SHALL NOT ask a player to name a condition or disability.

17.3 THE SYSTEM SHALL present each option in turn by speech, by a lit and
captioned box, and by a haptic pulse pattern unique to that option.

17.4 THE SYSTEM SHALL cycle the options automatically until one is pressed, with
no time limit, so that one switch is enough, AND SHALL let one press choose the
lit option (per Requirement 2).

17.5 THE SYSTEM SHALL save the choice to the player profile AND SHALL let the
player reopen setup with one press at any time.

17.6 THE SYSTEM SHALL read OS preferences (reduced motion, contrast) and apply
them as profile defaults.

17.7 THE SYSTEM SHALL NOT claim to detect a screen reader; it SHALL write all
spoken text to the `aria-live` region so a screen reader can read it.

17.8 THE SYSTEM SHALL NOT change timing or difficulty because a channel was
turned on; only the player's own Speed choice (including "More time") changes
timing (per Requirement 12.4).

---

## Requirement 18 — Immersive audio

**User story.** As a blind or low-vision player, I want the game world to be
heard, so that playing is fun and not only a timed press to a beep.

**Acceptance criteria.**

18.1 THE SYSTEM SHALL render object position in sound: left/right pan, plus
pitch and filter that change with distance.

18.2 THE SYSTEM SHALL provide a looping ambient soundscape and music that rises
with danger and calms after a clear.

18.3 THE SYSTEM SHALL play a reward sound on every clear.

18.4 THE SYSTEM SHALL synthesise all sound in code, with no audio files.

18.5 THE SYSTEM SHALL keep every countdown cue audible over ambience and music
(proof property 8.19) under every profile volume mix.

18.6 THE SYSTEM SHALL render the same events to deaf and hard-of-hearing
players as haptics, visual indicator and captions (per Requirement 3a).

18.7 THE SYSTEM SHALL play a sound the moment the player presses (a whoosh), when
the player lands (a thud) and when the player falls (a bonk), each with a matching
touch pattern, so that a press is never silent.

18.8 THE SYSTEM SHALL play a tone for each approaching obstacle that moves from
the side to the centre and opens up, arriving exactly at the press, as a shape
for the wait.

18.9 THE SYSTEM SHALL let the developer switch each part of the sound world
(wind, pad, approach tone, effects) off, and retune the pad's key, without
affecting the beeps or the proof.

18.10 THE SYSTEM SHALL keep the sound world carrying no information that is not
also available as a caption, speech or touch (wind and pad are decorative).

---

## Requirement 19 — Persona reviewer loop

**User story.** As a developer, I want simulated players with specific needs to
play my game and tell me where a real player would fail, so that gaps are found
before players find them.

**Acceptance criteria.**

19.1 THE SYSTEM SHALL run reviewer personas (at least perfect one-switch,
timing-error, and audio-only) over a level and report each point where that
persona fails or cannot perceive an event.

19.2 THE SYSTEM SHALL turn each finding into a proof failure with a
plain-English reason, naming the persona, level, object and cause.

19.3 THE SYSTEM SHALL offer repairs only to the profile that needs them (proof
property 8.17) and SHALL reject any repair that makes a level easier (8.18).

19.4 THE SYSTEM SHALL run the reviewer loop headlessly, so it works in CI, from
the MCP server and from a Kiro hook.

19.5 THE reviewer loop SHALL replace hand-written accessibility tests for the
properties it covers, and SHALL NOT be added on top of them as duplicate work.

---

## Requirement 20 — Engine-agnostic core with adapters

**User story.** As a developer using any kind of game engine, I want the
accessibility core to work with my game, so that I am not limited to browser
games.

**Acceptance criteria.**

20.1 THE SYSTEM SHALL keep the core (events, channels as renderer interfaces,
profile, proof, personas, reviewer, report, level model) free of DOM and engine
imports.

20.2 THE SYSTEM SHALL define an adapter contract: an adapter turns engine input
into `press`, and plays the core's sound, speech, caption, indicator and haptic
output through the engine.

20.3 THE SYSTEM SHALL ship a **web adapter** (Canvas 2D, Web Audio, Web Speech,
Gamepad) and SHALL build the two demo apps on it.

20.4 THE SYSTEM SHALL document the adapter contract so other engines (Unity,
Godot, native) can add adapters without changing the core. Those adapters are
roadmap, not built in this cycle.

20.5 THE core SHALL NOT import from any adapter.

20.6 THE proof SHALL run unchanged for any adapter, because it operates on
level and event descriptions, not on engine objects.

---

## Requirement 21 — Coach voice (PROPOSED, 2026-11-18, awaiting go-ahead)

**User story.** As a player who needs more time to react or think, I want the
character to tell me early what is coming and when to jump, so that I am not
rushed by three beeps.

**Acceptance criteria.**

21.0 THE coach SHALL be off unless the developer enables it in `KitConfig`, and
SHALL then be off unless the player turns it on. A developer who does not want a
character voice loses nothing else.

21.1 WHERE the player turns on the coach, THE SYSTEM SHALL speak a short line
from the character (for example "Grave ahead. Get ready to jump.") a set lead
time before the press moment, as a speech event rendered by the speech channel,
the captions and the `aria-live` text.

21.2 THE SYSTEM SHALL let the player choose the lead time, from 1 s to 3 s of
real time, and save it in the profile.

21.3 THE SYSTEM SHALL keep the three beeps and the fourth beat as the exact
timing cue. The spoken line is a heads-up and SHALL NOT be the only cue for the
press, because speech start time varies by device.

21.4 THE SYSTEM SHALL check (proof property 15, proposed) that every coach line
starts after the player lands from the previous jump plus the landing margin.
WHEN the chosen lead is longer than a level allows at the player's speed, THE
SYSTEM SHALL say so in plain English and use the longest lead that fits.

21.5 THE coach lines SHALL be in the phrase list (property 11) and reach two
senses (speech and caption).

**Measured room (5,000 generated levels, real seconds before the press, after
landing and the 0.25 s margin):** Slow worst 2.21 s, average 2.93 s. Medium
worst 1.66 s, average 2.20 s. Fast worst 1.33 s, average 1.76 s. So 1 s fits
everywhere, 2 s fits every level at Slow, and 3 s does not always fit.

**Open choices (need the product owner):**
(a) *What "jump" means.* Recommended: an early heads-up ("Get ready"), with the
press still on the beat. The alternative, saying "jump" at press time minus the
lead, only works if the lead matches the player's own reaction time, because the
window is about ±0.36 s to ±0.5 s at Slow. That needs a calibration step.
(b) *Leads above the safe room (for example 3 s).* Either cap the lead at what
fits, or give a player who chose it wider gaps. Wider gaps change level content
for that player, so the same-level race demo would no longer compare like for
like.

---

## Requirement 22 — Developer customisation and embedding

**User story.** As a game developer, I want to drop Marrow into my own game and
change how it looks, sounds and reads, so that the accessibility fits my game
and I keep my creative freedom.

**Acceptance criteria.**

22.1 THE SYSTEM SHALL let the developer turn off, replace or restyle every
feature it provides (each channel, immersive audio, the setup flow, scanning,
the coach voice) through one config object, without editing kit code.

22.2 THE SYSTEM SHALL keep accessibility on by default for the player (opt-out,
never opt-in), and SHALL leave the coach voice off unless the developer turns it
on.

22.3 THE SYSTEM SHALL let the developer supply: timing (jump, beat, gaps,
speeds), spoken and caption wording or a translation, sounds and vibration
patterns, the starting player profile, their own game events with how each is
presented, replacement or omitted channels, their own minimum window floors,
their own proof properties, and their own level data.

22.4 THE SYSTEM SHALL NOT take over the game loop, canvas, audio or input. Events
go in, output commands come out, and an adapter connects the kit to the engine.

22.5 THE SYSTEM SHALL refuse invalid configuration early, with a plain-English
message that names the setting.

22.6 THE proof SHALL still check the result of any customisation. A removed
channel that leaves an event with fewer than two senses, a theme below contrast,
or a window below its floor SHALL fail with a plain-English reason.

22.7 THE SYSTEM SHALL document every option, its default and the proof property
that guards it, in `docs/customisation.md`.

22.8 THE SYSTEM SHALL keep customisation to one entry point (`createKit`) so the
public API stays small enough to show in one screenshot.

22.9 EVERY new feature built under this spec SHALL meet the "Kit rule" in
`tech.md` (switchable, configured in one place, worded through the phrase list,
and listed) before its task is marked done.

---

## Requirement 23 — A genre-neutral accessibility layer, and patterns for finishability

**User story.** As a developer making any kind of game, I want the accessibility
layer to work for my genre, and I want to know honestly what is proven about my
game and what is not.

**Acceptance criteria.**

23.1 THE SYSTEM SHALL let a developer define any object, with or without a
width, so that enemies, pickups, landmarks and doors get a voice, a spoken name,
a caption and a vibration. Only objects with a width SHALL be used to generate
obstacle levels.

23.2 THE SYSTEM SHALL let an event be placed in space with an `x` and a
`distance`, panning and softening its sound, and filling `{side}` and `{range}`
in its text.

23.3 THE SYSTEM SHALL check, for any set of events, that each reaches at least
two senses under a profile (property 8), and SHALL report every failure.

23.4 THE SYSTEM SHALL let a developer replace any built-in sound with their own
recipe without breaking the rule that beeps stay 6 dB louder than what is under
them.

23.5 THE SYSTEM SHALL treat the proof that a game can be finished with one
switch as belonging to an interaction pattern. Timed press SHALL be the first
pattern. A developer SHALL be able to add their own properties for their own
game.

23.6 THE documentation SHALL state which genres have a pattern and a
finishability proof, which are served by the accessibility layer only, and which
are untested, and SHALL NOT claim that Marrow makes any game accessible.

---

## Requirement 24 — Lessons and rhythm judging (built 2026-11-18)

**User story.** As a game developer, I want a timing game to be able to teach
and to reward mastery, so that it is worth replaying, and as a learner I want to
be told why I was wrong.

**Acceptance criteria.**

24.1 THE SYSTEM SHALL let a developer give a game a lesson: a rule that says
which numbers are targets, a range of numbers, a prompt, and optional
explanations. THE SYSTEM SHALL refuse a lesson that cannot work, in plain words,
before the game starts.

24.2 THE SYSTEM SHALL give each obstacle a number and make it a target (to jump
on the beat) or a distractor (to let pass) by the rule, with an even mix by
default and at least two of each in a level.

24.3 THE SYSTEM SHALL speak and show the number every time, and SHALL NOT give
away whether to press: the events, sounds, touch patterns and fourth-beat caption
SHALL be the same for a target and a distractor.

24.4 WHEN the player presses on a distractor, THE SYSTEM SHALL treat it as a
mistake; WHEN the player lets a distractor go by, THE SYSTEM SHALL treat it as
right. A distractor SHALL NOT need a take-off window.

24.5 THE SYSTEM SHALL judge each jump Perfect, Good or Ok by its distance from
the fourth beat, with thresholds the developer can change, and give each grade
its own sound, word and touch pattern.

24.6 THE SYSTEM SHALL keep a streak of right decisions that climbs a musical
scale and scales the points, and SHALL reset it on a mistake.

24.7 THE SYSTEM SHALL score each level and give a rank (S, A, B, C) as a share of
the best possible score, with cut-offs the developer can change, and a summary
of how many were right.

24.8 WHEN the player presses on a distractor, or lets a target go by, THE SYSTEM
SHALL say the reason and then the lesson's own explanation. A timing miss SHALL
give only the timing reason.

24.9 EVERY new line SHALL be rewordable and translatable, SHALL be in the line
script, and SHALL reach at least two senses; the beeps SHALL stay 6 dB over
everything under them.

---

## Requirement 25 — Scale for large, busy games (PROPOSED, 2026-11-18)

**User story.** As a developer of a big, detailed game, I want to adopt the kit
without drowning the player in sound and speech, so that a complex game is as
usable as a simple one.

**Acceptance criteria.**

25.1 THE SYSTEM SHALL let each event carry a priority (critical, important,
information, ambient). Critical events SHALL never be dropped.

25.2 THE SYSTEM SHALL let the player choose how much is announced (minimal,
normal, detailed) in their profile, and SHALL drop events below that level from
speech and captions. The two-senses rule SHALL apply to every event at or above
"important".

25.3 THE SYSTEM SHALL queue speech so that a newer critical line interrupts, lower
priority lines wait or are dropped when the player is behind, and repeats are
combined ("three enemies left").

25.4 THE SYSTEM SHALL limit how many sounds play at once, dropping the least
important first, and SHALL never drop a countdown beep.

25.5 THE SYSTEM SHALL let a game announce and sound only the nearest N of many
placed objects.

25.6 THE SYSTEM SHALL check, with a simulated flood of events, that the player
never gets more than a set number of spoken lines a second under the default
setting, and SHALL report a failure in plain English.

25.7 THE documentation SHALL describe how a large game adopts the kit in steps:
objects and events first, then a pattern and its proof, then the scale settings.

---

## Requirement 26 — Navigation, scanning and placed sound (built 2026-11-18)

**User story.** As a player who uses one switch, I want to move through a place by
choosing between the ways forward, hearing each from where it lies, so that I can
find my way without any timing, and as a developer I want a pattern that proves a
place can always be escaped.

**Acceptance criteria.**

26.1 THE SYSTEM SHALL offer a scanner: options are lit and spoken in turn, a press
chooses the lit one, it cycles until pressed, and it never chooses, skips or times
out for the player. Each option SHALL stay lit long enough to be spoken in full
(proof property 102).

26.2 THE SYSTEM SHALL let an event or option carry an `angle` (0 ahead, 90 right,
180 behind) and a `distance`. The sound SHALL be placed in true 3D where the
browser supports it, and by stereo pan otherwise (and centred for mono). Text MAY
say where, in plain words.

26.3 THE SYSTEM SHALL provide a navigation pattern: a maze, a walk that moves one
room at a time, and a pursuer that follows by the shortest way. A press on the
move gives a free "Listen"; at a crossing "Listen" is an option that costs one
step of the pursuer's time. Being caught SHALL return the player to the last
crossing and send the pursuer home. There SHALL be no lives and no game over.

26.4 BEFORE a house is served, THE SYSTEM SHALL prove: 201 the exit is reachable;
202 a player who takes the shortest route is never caught, with spare steps; 203
the pursuer starts far enough away; 204 every passage can be walked both ways. A
house that fails SHALL be refused, with a plain-English reason.

26.5 THE SYSTEM SHALL NOT time any decision. While the player is choosing, the
world SHALL wait.

26.6 THE SYSTEM SHALL read at most one spoken line between two crossings. The
walk SHALL NOT start reading options until the line before them has finished, and
a later line SHALL begin after an earlier one, not on top of it. A game gives the
walk a function for how long a line takes, and the length of any introduction.

26.7 A Listen at a crossing SHALL be heard in full, and the options SHALL then
begin again from the first. A press while an answer is being given SHALL do
nothing.

26.8 THE SYSTEM SHALL let a house hold a ritual: relics to find before a sealed exit opens, rooms the
walk always stops in (each named and given its own sound by the game), and rooms with a hiding place.

26.9 IN a ritual house the pursuer SHALL prowl from room to room until it hears the player (within a
set distance along the passages), then hunt; it SHALL lose the trail when the player gets far away or
hides. Once every relic is found it SHALL always know, and move faster (the chase). The walk and the
proof SHALL use the same pursuer.

26.10 WHILE hidden the player SHALL NOT be caught; the pursuer may reach the hiding place, search, and
move on. Coming out SHALL be the player's choice, with no time limit.

26.11 THE SYSTEM SHALL offer a hint at any stop: which way leads to the nearest relic, or to the exit.

26.12 BEFORE a ritual house is served, THE SYSTEM SHALL prove: 205 a player who fetches the relics the
best way and runs the chase is never caught, and the pursuer never comes within a set distance; 206
every relic and hiding place is a reachable room, and the exit is a room.

---

## Requirement 27 — Background music that never hides a cue (built 2026-11-18)

**User story.** As a developer, I want each part of my game to have its own music,
and as a player I want to hear every beep over it.

**Acceptance criteria.**

27.1 THE SYSTEM SHALL let a game give a track as plain patterns: a key, a scale,
and bars of 8 slots for bass, melody and drum. THE SYSTEM SHALL refuse a track
that cannot keep out of the way, in plain words, when the kit is made.

27.2 THE SYSTEM SHALL play one bar of the track with each atmosphere event. The
bass SHALL sound an octave under the key, and no layer's notes SHALL overlap
themselves.

27.3 THE SYSTEM SHALL keep each layer to a fixed small share of a beep's loudness,
so that together with every other bed the beeps stay at least 6 dB louder
(proof property 13).

27.4 THE SYSTEM SHALL keep every music note below the lowest beep (proof property
14), so the beeps keep their own pitch range.

27.5 THE SYSTEM SHALL thin the track as a countdown nears: the melody fades and
then stops; the player's music volume SHALL scale it, and mono SHALL centre it.

---

## Requirement 28 — A story with bosses (built in the app, 2026-11-18)

**User story.** As a learner, I want a reason to keep playing, so that I practise
different kinds of number rules and feel I am getting somewhere.

**Acceptance criteria.**

28.1 THE GAME SHALL offer a story of places on a map, each with its own rule
(even numbers, multiples, squares, primes), its own length, scenery and track, in
the order they are played. The map SHALL also be given in words.

28.2 AT the end of each place, THE GAME SHALL give a boss with harder numbers and
more stones. Getting enough right SHALL win an item; falling short SHALL give a
kind line and another try, with no game over.

28.3 THE GAME SHALL save progress and best ranks, and treat anything unreadable as
a fresh start.

28.4 EVERY stage and boss level SHALL pass the whole proof, and the music SHALL
pass properties 13 and 14, at every speed.

---

## Requirement 29 — Songs, portals and number gates (built 2026-11-19)

**User story.** As a player, I want each level to feel like a song, with new moves
to learn, and still play it with one press.

**Acceptance criteria.**

29.1 THE SYSTEM SHALL build a level from a song: parts in bars of four beats, each
marked rest, calm or busy. Busy parts SHALL put countdowns close together, calm
parts SHALL space them out (up to half a bar past the gap), and a rest SHALL have
nothing to press (proof property 15). Every press SHALL land on the beat.

29.2 A part MAY change what a press does: jump, flip (gravity turns over) or switch
lanes. THE SYSTEM SHALL announce the change with a portal (a sweep, words, a
caption, a marker and a buzz) and SHALL start no countdown for two bars after it
(proof property 16 asks for at least one).

29.3 Every move SHALL use the jump's take-off window, so proofs 1 to 6 hold for all
moves unchanged.

29.4 A number gate SHALL show and say two numbers, the player's first. Exactly one
SHALL fit the rule, and a press SHALL be needed exactly when the right one is in
the other lane (proof properties 101 and 103). Both numbers SHALL be said in full
before the fourth beat at every speed (proof property 104).

29.5 THE SYSTEM SHALL let the music follow the song: no drums in a breakdown, the
whole band in the drop, with no note louder than its share (properties 13 and 14
still hold).

29.6 WHERE a player turns on timing help, THE SYSTEM SHALL count a press anywhere
from the first beep to the end of the take-off window and make the move on the
fourth beat, graded Good. A press on something to let pass SHALL still be a
mistake.

---

## Requirement 30 — Speech that is never cut off, and a house that sounds alive (built 2026-11-19)

**User story.** As a blind player, I want to hear every line in full, and to know
where I am by how the place sounds.

**Acceptance criteria.**

30.1 WHERE a game turns on queued speech, THE SYSTEM SHALL let each line finish
before the next begins. A line MAY say 'cut-in' (warnings) or 'latest' (scanning
labels, so the voice never falls behind the highlight). A voice that never reports
the end SHALL be given up on after twice its guessed length plus 1.5 s.

30.2 An event MAY give its line a character voice (pitch and rate), relative to
the player's chosen voice.

30.3 A sound MAY have a room echo and a pitch wobble. THE SYSTEM SHALL make the
echo from synthesised decaying noise. Effects, cues and rewards MAY take a place's
echo; music and ambience SHALL stay dry.

30.4 THE GAME (Séance Escape) SHALL give each floor its own footstep and each room
its own echo, and SHALL play the phantom's feet and moan from where it is.

30.5 On-screen text SHALL sit in fixed panels that never overlap; a panel's text
SHALL shrink to fit, and a long caption SHALL wrap before it shrinks.

---

## Requirement 31 — Words before the countdown, and less waiting (built 2026-11-19)

**User story.** As a player who listens, I want the rule and the reason for a
mistake in full before the next countdown, and I do not want to stand waiting.

**Acceptance criteria.**

31.1 THE SYSTEM SHALL let a game hold level time until a line has been said: the
introduction before the first countdown, and the reason and lesson of a fall
before the retry. A hold SHALL only ever delay a countdown, never bring one sooner.

31.2 WHILE level time is held or resting after a fall, THE GAME SHALL keep its
music playing on the real clock, as a calm breakdown. No countdown runs then, so
there is nothing for it to cover.

31.3 AT a stop in a walk, THE SYSTEM SHALL say where the phantom is only when it
is news: within three rooms, closer than last said, in a new mood, or in the chase.
Listen SHALL always tell it. A game MAY choose to say it at every stop.

31.4 AFTER a set number of catches (default two), THE SYSTEM SHALL give a hint for
free each time the player is put back. It SHALL not move the phantom or count as
a hint asked for.

31.5 THE GAME (Séance Escape) SHALL say only the name of a room already visited.

---
## Tiering — what this spec builds now vs later vs roadmap

**Build now (this spec, Requirements 1–14):**
- Semantic events + channels + one player profile (Req 3a, 11).
- Channels: sound, speech + `aria-live`, captions + pips, visual sound
  indicator, haptics (Req 3, 3a, 4, 5).
- Single-switch input, no forced hold/chord, Escape to menu, ignore key repeat
  (Req 1).
- Switch scanning (Req 2).
- Registry with automatic accessible defaults (Req 6).
- Seeded generator (Req 7).
- Proof — all fourteen properties, counterexamples, refuse-to-serve (Req 8):
  the six timing/cue properties; no unsafe flashing, two-sense, contrast, no
  forced hold/chord, strings coverage; intent preserved, difficulty never a
  repair, cues audible over ambience, setup options reach two senses.
- First-run setup flow (Req 17), immersive audio (Req 18), persona reviewer
  loop (Req 19), engine-agnostic core with the web adapter (Req 20).
- Personas (Req 9), session log + CSV (Req 10), failure handling (Req 12).
- Property-based tests for every property (Req 13).
- Profile fields: speed, picture, voice, scanning, contrast theme, text/UI
  scale, colour-blind palette, volumes, mono audio, visual indicator, haptics
  (Req 11).
- Accessibility feature report + ESA tag mapping (Req 14).
- **Marrow packaged as a Kiro power** (Agent Plugins format) bundling steering,
  the level-forge MCP server, the proof and store-list hooks, and the runtime
  skeleton; both apps built through the installed power (Req 15).
- **Power benchmark** — three prompts, with vs without the power, proof
  properties passing recorded (Req 16).

**Later task (separate spec):**
- The **strings table** as the backing store for captions and speech (the proof
  property 8.15 is built now and checks coverage against it; the table and its
  tooling are the later task).
- **Dwell-click** input method.
- **Hold-to-confirm** input (the proof property 8.14 and the opt-in profile flag
  are built now; the input handler is the later task).

**Roadmap only (documented, not built this cycle):**
- **Unity, Godot and native adapters** (the contract is documented now).
- Full input **remapping** (arbitrary action-to-input binding).
- **Reading-level variants** of captions and speech (simplified wording tiers).

These roadmap items are named in `docs/architecture.md` as intended extensions
the channels/profile design already allows, so a future developer can add them
without changing the core.
