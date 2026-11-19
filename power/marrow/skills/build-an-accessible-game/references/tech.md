
# Tech

## Stack

- **TypeScript** (strict mode), **Vite** for dev server and builds.
- **No UI framework** for the games. Canvas 2D for drawing; plain DOM for menus, settings and panels.
- **One exception: Séance Escape draws its first-person view with three.js (WebGL)**, with every shape and texture made in code. The 2D canvas sits on top for the options, captions and a small map. Without WebGL (or with `?view=2d`) the game falls back to a flat map and plays the same. The kit itself never imports three.js.
- **Background tracks** are plain patterns (`TrackSpec`) played by the kit under the beeps. Proof property 14 checks every note stays below the lowest beep, and property 13 keeps the beeps 6 dB over everything under them.
- **Web Audio API** for cues and sound effects (synthesised tones, no audio files needed).
- **Web Speech API** (`speechSynthesis`) for the built-in voice, always mirrored to an `aria-live` region so screen readers get the same text.
- **Gamepad API** so any gamepad button counts as a switch press.
- **Vitest** for unit tests and **fast-check** for property-based tests.
- Static hosting for the two apps (any static host; GitHub Pages is fine).
- Licence: MIT, visible in the repository's About section.

## Timing model (from the validated prototype; keep these unless testing says otherwise)

All gameplay is in **running seconds** (level time). The chosen speed scales real time.

| Constant | Value | Meaning |
|---|---|---|
| `T` | 0.85 | Airtime of one jump, in running seconds |
| `BEAT` | 0.4 | Countdown beat; three beeps, press on the fourth beat |
| `M` | 0.06 | Ghost half-width, in running seconds |
| `GAP` | [2.3, 3.0] | Spacing between obstacles (start of next minus end of previous) |
| First obstacle start | 6.5 | Leaves time for the spoken intro |
| Speed rates | Slow 0.6, Medium 0.8, Fast 1.0 | Real seconds = running seconds ÷ rate |
| Obstacles per level | 12 | |

For an obstacle starting at `s` with width `d`:
- Take-off window: `a = s + d + M − T`, `b = s − M`. A press at time `t0` clears it if `a ≤ t0 ≤ b`.
- Ideal press (the fourth beat): `J = (a + b) / 2`. Beeps play at `J − 3·BEAT`, `J − 2·BEAT`, `J − BEAT`.
- Obstacle widths: grave 0.16–0.30, fence 0.12–0.24 running seconds.
- With these values the gap rule guarantees each countdown starts at least 0.25 s after landing from an on-time jump.

## Properties the proof must check (property-based tests over random seeds)

1. **Jumpable:** every obstacle has a non-empty take-off window (`b ≥ a`).
2. **Reachable:** taking off at the earliest possible moment for each obstacle, the player has always landed before the next take-off window closes.
3. **Unambiguous cues:** each countdown starts after the player lands from an on-time jump over the previous obstacle (`J_next − 3·BEAT ≥ J_prev + T + 0.25`).
4. **Multisensory:** every object type has a sound, a spoken name and a caption.
5. **Window floor:** the take-off window is at least 400 ms at Fast and 650 ms at Slow (prototype minimums were 430 ms and 717 ms).
6. **Fourth beat clears:** pressing exactly on the fourth beat clears every obstacle.

Additional channel/profile properties (property-based tests over random seeds, apply to every app):

7. **No unsafe flashing:** no content flashes more than three times per second.
8. **Two-sense rule:** every semantic event reaches at least two senses through the enabled channels.
9. **Contrast:** every theme meets WCAG 2.2 AA contrast (4.5:1 text, 3:1 essential graphics).
10. **No forced hold or chord:** no input requires holding or simultaneous presses; hold-to-confirm exists only as an opt-in alternative.
11. **Strings coverage:** every caption and every spoken line exists in the strings table.
12. **Intent preserved**: repairs apply only to the profile that needs them; the default profile’s level is identical before and after any repair. **No repair applies to a profile that didn't ask for it:** a player's own choice (such as "More time" setting Speed) is not a repair and is allowed.
13. **Cues audible over ambience:** at every moment a cue plays, its level exceeds the ambient soundscape and music by a set margin, under every profile volume mix.
14. **Setup options reach two senses:** every first-run setup option is spoken, shown and pulsed; none depends on one sense alone.

Scanning and navigation (built, for Séance Escape): properties 201 to 204 prove a house can be escaped with one switch (exit reachable; the shortest route is never caught, with spare steps; the phantom starts far enough away; every passage can be walked both ways). Property 102: every scanned option stays lit long enough to be spoken in full. A walk never starts reading options until the line before it has finished, and speaks at most one line between two crossings.

Music (built, for Ghastly Moves): property 13 keeps the beeps at least 6 dB over everything under them, music included. Property 14 keeps every music note below the lowest beep, so the beeps keep their own pitch range. A track plays at full strength between cues and steps down to a small fixed share inside the game's `quiet` windows (with none given, it stays small). Presses sit on one steady pulse (`timing.onBeat`, default on, gaps unchanged), and the music plays on that pulse.

Songs (built, for Ghastly Moves stages): `song` in the kit config builds a level from parts in bars of four beats (rest, calm, busy). Calm parts may space obstacles up to half a bar past `GAP`; busy parts keep to it. A part can change the move (jump, flip, switch lanes); the change is a portal with two bars clear after it. Every move uses the jump's take-off window, so properties 1 to 6 hold for all moves. Property 15: rests have nothing to press. Property 16: a portal is clear of countdowns for at least one bar, and each obstacle asks for the move in force. Property 103: each number gate has exactly one right lane. Property 104: a gate's words ("12 or 35?", the player's number first) are said in full before the fourth beat at every speed. Each stage sets its own `beat` (0.42 down to 0.36). The track's `energy` follows the song (no drums in a breakdown). Timing help (`assist`) counts any press in the countdown and moves on the fourth beat, graded Good.

Words before countdowns (built): the run can hold level time (`holdForWords`) so an introduction, or a fall's reason and lesson, is heard in full before the next countdown. A hold only ever delays. While level time stands still (`snapshot().held`), the game plays its music on the real clock as a breakdown.

Speech (built): the web adapter can queue speech (`voice: { queue: true }`; Séance Escape uses it, Ghastly Moves keeps "newest line wins"). Events choose `speech: 'wait' | 'cut-in' | 'latest'`; scanning labels are `latest`. An event can give a character voice (`voice: { pitch, rate }`). Sounds can have `echo`/`echoSeconds` (synthesised reverb) and `wobble`/`wobbleHz`; `withAcoustics` puts sounds in a place, leaving music and ambience dry.

Walks (built): at a stop the phantom is said only when it is news (within `ghostCallNear` rooms, default 3; closer than last said; a new mood; or the chase). After `freeHintAfterCatches` catches (default 2) a free hint is given on each return.

A failing property must produce a **plain-English counterexample**, for example: "Level 17, obstacle 4 (crypt, 1.00 s wide): no take-off point clears it. One jump covers only 0.73 s." The runtime must refuse to serve any level that fails the proof.

## Channels architecture (core design)

Games do not talk to sound, speech or captions directly. A game **declares
semantic events**; the skeleton **renders each event through every enabled
channel**, shaped by one **player profile**. This is what makes accessibility
zero-effort and lets one declaration reach every sense.

- **Semantic events** (examples, games may define more): `obstacle-approaching`,
  `press-now`, `hurt`, `cleared`, `level-complete`, `menu-option`, `fall-reason`.
  An event carries data (e.g. which object, which countdown pip, a reason
  string) but says nothing about how to present it.
- **Channels** each subscribe to events and render them: **sound** (Web Audio
  cue), **speech** (Web Speech, mirrored to `aria-live`), **captions**
  (on-canvas text + countdown pips), **visual sound indicator** (an on-screen
  marker that fires with every sound cue, for deaf players), **haptics**
  (gamepad rumble mirroring the cue). A channel can be enabled or disabled
  through the profile without the game changing.
- **One player profile** drives every channel: timing (speed), dwell (scanning
  speed), contrast theme, text/UI scale, colour-blind palette, motion
  (reduced/full), volumes (cues / speech / music independently), mono audio.
  The profile is the single source of truth; a game never reads a raw setting.
- The two-sense rule (proof property 8) is enforced at the channel layer: for
  each event, the skeleton checks that at least two enabled channels render it,
  given the current profile.

## Immersive audio (sound channel)

Sound is the world, not a beep for a jump. The sound channel renders:
spatial position (left/right pan, pitch and filter by distance), a looping
ambient soundscape, music that reacts to danger and calms after a clear, a
lantern-style hum that grows near hazards, and reward swells on every clear.
Cues must stay audible over all of it (proof property 13). All sound is
synthesised in Web Audio; no audio files.

Built so far (first slice): an approach tone per obstacle that moves from the
right to the centre and opens up, arriving exactly at the press; a whoosh on the
press, a thud on landing and a bonk on a fall (each with a matching touch
pattern); a wind bed and a slow pad that rises with danger, one bar every two
seconds; a clear chime. Each part can be switched off by the developer
(`audio` in `KitConfig`). Every bed is a fixed share of the cue's gain, so a beep
stays at least 6 dB over everything under it whatever the player's volumes, and
a test checks it. Still to come: more varied wind and music, and placing several
objects in space at once.

## First-run setup flow

All channels start on, so nothing must be chosen to play. The first screen
speaks, shows and pulses each option in turn (options cycle until pressed, with
no time limit; one press picks): "Just play", "Play by sound", "Play by sight", "More time", "More
settings". Options describe ways to play, never conditions; nobody names a
disability. Choices save to the profile and can be changed with one press. The
game also reads OS preferences (reduced motion, contrast) and applies them.
Every option reaches at least two senses (proof property 14).

## Kit rule: the developer can change it (applies to every feature)

Marrow is a kit other developers build into their own games. Every new
feature, in every task, must meet all four of these before it counts as done:

1. **Switchable:** the developer can turn it off, or replace it, without
   editing kit code. Accessibility stays on by default (opt-out, never opt-in).
2. **Configurable in one place:** its values (sounds, wording, timing, styles)
   come from `KitConfig` (`createKit(config)`), not from constants buried in code.
   Defaults live in one named place and match this file.
3. **Worded through the phrase list:** every caption and spoken line comes from
   `Strings`, so it can be reworded or translated.
4. **Listed:** it appears in `docs/customisation.md` with its default and the
   proof property that guards it.

The developer chooses; the proof checks the result. A customisation that breaks
a guarantee (a theme below contrast, a channel removed so an event reaches one
sense, a window below its floor) fails the proof with a plain-English reason.
The kit never takes over the game loop, canvas, audio or input.

## Core and adapters (works for any kind of game)

The skeleton is a **pure core** with no DOM or engine dependency: semantic
events, channels (as renderers behind an interface), the player profile, the
proof, personas, the report and the level model. An **adapter** connects the
core to a specific engine: it turns engine input into `press`, and plays the
core's sound, speech, caption, indicator and haptic output through the engine.
Shipped now: the **web adapter** (Canvas 2D, Web Audio, Web Speech, Gamepad).
Roadmap: Unity, Godot and native adapters, which only need to implement the
adapter contract. The proof is pure maths over level descriptions, so it
already runs the same for any engine.

## ESA tag mapping

The skeleton can output the game's accessibility feature list automatically
from what it guarantees (channels enabled, proof properties passing), mapped to
the **ESA Accessible Games Initiative** tags (the 24 standard tags, 2025).
Example mappings: single-switch play and no-forced-hold → *Single Input*;
sound + visual-indicator + captions → *Visual Alternatives to Sound*; speech +
`aria-live` → *Screen Reader / Narration*; contrast theme + text scale +
colour-blind palette → *High Contrast* and *Colourblind Options*; speed and
dwell → *Difficulty / Timing Options*; no-unsafe-flashing → *No Flashing*. The
generated list states only what the skeleton actually guarantees; it never
claims a tag the proof does not support, and never calls a game "fully
accessible".

## Skeleton modules

- **input**: normalises every key (except Tab, Escape and modifier combinations), pointer, touch and gamepad button into one `press` event; ignores key repeat; Escape returns to the menu. Never requires holding or simultaneous presses; hold-to-confirm is an opt-in alternative only.
- **events**: games declare and emit semantic events; the event bus the channels subscribe to.
- **profile**: the single player profile (timing, dwell, contrast theme, text/UI scale, colour-blind palette, motion, volumes for cues/speech/music, mono audio) that shapes every channel.
- **channels**: render each event through every enabled channel —
  - *sound*: schedules countdown beeps on level time; pitch/timbre per object type assigned automatically from a voice table (low hum 294 Hz triangle, high chime 587 Hz sine, buzz 440 Hz square, bright bell 784 Hz triangle).
  - *speech*: built-in voice with an on/off toggle (off for screen-reader users), always mirrored to `aria-live`.
  - *captions*: on-canvas caption box with the object's name and four countdown pips (three amber, the fourth green), so deaf players get the same cue.
  - *visual sound indicator*: an on-screen marker that fires with every sound cue.
  - *haptics*: gamepad rumble mirroring the cue.
- **scanning**: highlights options in turn (default 2.2 s per option, adjustable via dwell), speaks each label through the speech channel, a press chooses the lit option; pauses when a keyboard user focuses a control.
- **registry**: `defineObstacle(name, { width, draw?, say?, sound?, caption? })` with automatic defaults.
- **level**: seeded generator (mulberry32 PRNG).
- **proof**: the properties above, callable in tests, in the browser and from the MCP server.
- **adapters**: the engine bridge. `adapters/web` ships now; the adapter contract is documented so other engines can follow. The core never imports from an adapter.
- **reviewer**: persona reviewer loop. Personas play a level, report where a real player with that need would fail, and each finding becomes a proof failure with a plain-English reason.
- **a11y-report**: generates the game's accessibility feature list from guaranteed channels + passing proof properties, mapped to ESA Accessible Games Initiative tags.
- **personas**: headless simulated players (perfect one-switch; one-switch with Gaussian timing error, σ configurable, e.g. 100/150/250 ms; audio-only, which receives only the cue events — the three countdown beeps and their timing — and presses from the fourth beat) that report clear rates per speed.
- **session log**: per attempt, records obstacle, result, press offset from the fourth beat in ms, window in ms, speed and picture mode; exports CSV.

## Settings / player profile (persisted per player in localStorage, wrapped in try/catch)

The profile is one object. Build-now fields: Speed (Slow default), Picture on/off, Built-in voice on/off, Switch scanning on/off (on by default), Reduced motion (follow the OS setting), contrast theme, text/UI scale, colour-blind palette, volumes for cues/speech/music, mono audio, visual sound indicator on/off, haptics on/off. Later fields: dwell-click, hold-to-confirm. Roadmap only: full input remapping, reading-level variants.

## Constraints

- No third-party trademarks, characters or copyrighted music anywhere in the games or the video.
- All original art drawn in code (Canvas shapes); no external assets required. A developer may supply their own voice recordings or voice service (`docs/voices.md`); the kit and our two apps ship none.
- Everything must run offline after first load.
- Keep the developer-facing API small enough to show in one screenshot.
