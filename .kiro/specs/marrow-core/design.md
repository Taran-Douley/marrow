# Design — marrow-core

Implements `requirements.md` (Requirements 1–20). Constants come from
`.kiro/steering/tech.md`; nothing here restates them.

## 1. Shape of the system

A **pure core** decides what a player should perceive and whether a level is
fair. An **adapter** performs it on a real engine. The core never touches the
DOM, audio hardware or an engine, so the proof, personas and reviewer run
headless in tests, CI and the MCP server.

```
 game code ──emit(event)──▶ EVENTS ──▶ CHANNELS (pure) ──▶ OutputCommand[]
                                          ▲                      │
                                     PROFILE (one)               ▼
                                                           ADAPTER (web)
 engine input ──▶ ADAPTER ──press──▶ INPUT ──▶ game        plays tones, speech,
                                                           captions, haptics
 level seed ──▶ LEVEL ──▶ PROOF / PERSONAS / REVIEWER ──▶ report, refusal
```

Key decision: **channels are pure functions** `(event, profile) → OutputCommand[]`.
They describe output; they do not perform it. This lets the proof count senses
(property 8), measure flash rate (7), compare cue and ambience level (13) and
check setup options (14) without any engine. (Alternative considered: channels
that call Web Audio directly. Rejected: not testable headless, ties the core to
the browser, breaks Requirement 20.)

## 2. Folder layout

```
skeleton/src/
  index.ts            public API (one screen)
  types.ts            Sense, SemanticEvent, OutputCommand, Profile, Level
  events/             event bus, defineEvent
  profile/            Profile, defaults, OS-preference merge, serialise
  channels/           sound, speech, captions, indicator, haptics (pure)
  audio/              soundscape model (ambience, music, pan, reward) as data
  input/              press normaliser (pure state machine)
  scanning/           scanning state machine, dwell
  setup/              first-run setup options and flow
  registry/           defineObstacle, voice table, defaults
  level/              mulberry32, generator, timing model
  proof/              14 properties, counterexample text, refuse-to-serve gate
  personas/           perfect, timing-error, audio-only
  reviewer/           persona reviewer loop, repairs, repair guard
  a11y-report/        feature list + ESA tag map
  log/                session log, CSV
  adapters/web/       Canvas 2D, Web Audio, Web Speech, Gamepad, DOM, storage
skeleton/test/        unit + fast-check properties
```

Rule: `core` folders import nothing from `adapters/`. A lint test enforces it
(Requirement 20.5).

## 3. Core types (the contract)

```ts
type Sense = 'hearing' | 'sight' | 'touch';
type ChannelId = 'sound' | 'speech' | 'captions' | 'indicator' | 'haptics';

interface SemanticEvent { type: string; at: number; data?: Record<string, unknown> }

type OutputCommand =
  | { channel: 'sound';     senses: ['hearing']; at: number; role: 'cue'|'ambience'|'music'|'reward';
      hz: number; wave: 'sine'|'triangle'|'square'; gain: number; pan: number }
  | { channel: 'speech';    senses: ['hearing']; at: number; text: string }   // also aria-live
  | { channel: 'captions';  senses: ['sight'];   at: number; text: string; pip?: 1|2|3|4 }
  | { channel: 'indicator'; senses: ['sight'];   at: number; flash: boolean }
  | { channel: 'haptics';   senses: ['touch'];   at: number; pattern: number[] };

interface Channel { id: ChannelId; render(e: SemanticEvent, p: Profile): OutputCommand[] }

interface Profile {
  speed: 'slow'|'medium'|'fast'; dwellMs: number; theme: ThemeId; textScale: number;
  palette: 'default'|'colourblind'; reducedMotion: boolean;
  volume: { cues: number; speech: number; music: number }; mono: boolean;
  voice: boolean;   // built-in voice aloud; aria-live text is always written
  channels: Record<ChannelId, boolean>; picture: boolean; scanning: boolean;
  holdToConfirm: boolean; setupDone: boolean;
}

interface Adapter {              // Requirement 20.2
  onPress(cb: () => void): void; onEscape(cb: () => void): void;
  perform(cmds: OutputCommand[]): void;     // play tones, speak, draw, rumble
  load(): Partial<Profile>; save(p: Profile): void;
  osPreferences(): { reducedMotion?: boolean; highContrast?: boolean };
  now(): number;
}
```

The speech channel always emits its text. The web adapter writes it to the
`aria-live="polite"` region every time and speaks it only if the voice is on
(Requirement 4.1–4.2).

## 4. Public API (fits one screenshot)

```ts
// skeleton/src/index.ts
export { createGame } from './game';            // createGame({ adapter, profile? })
export { defineObstacle, defineEvent } from './registry';
export { generateLevel } from './level';
export { prove, refuseIfFailing } from './proof';
export { review } from './reviewer';
export { simulate } from './personas';
export { report } from './a11y-report';
export { webAdapter } from './adapters/web';
export type { Profile, SemanticEvent, Adapter } from './types';
```

Two entry points: `@marrow/skeleton` (above) and `@marrow/skeleton/web` (the web
adapter, `createWebAdapter`). They are separate so the core never imports an
adapter. As built, the adapter is driven by the app's loop:
`adapter.perform(commands, { now, rate }, profile)` plays each command at
`(command.at − now) / rate` real seconds from now, sound on the audio clock and
the rest on timers; `kit.run(...)` supplies the events. The earlier `Adapter`
interface in section 3 is the contract other engines will implement.

`defineObstacle('crypt', { width: [0.4, 0.6] })` is a complete declaration.
Sound, spoken name, caption and drawing default automatically (Requirement 6).

## 5. Components

### 5.1 Input and scanning (Req 1, 2)
`input` is a pure state machine over raw events `{kind, key?, repeat, mods}`.
It emits `press` for keys (not Tab, Escape, or modifier combos), pointer, touch
and gamepad buttons; drops `repeat: true`; emits `escape` for Escape. It never
needs a held key or a chord. Hold-to-confirm (later task) is a separate
wrapper enabled only by `profile.holdToConfirm`.

`scanning` is a state machine: options list, current index, `dwellMs`. A tick
advances and wraps; each advance emits a `menu-option` event (speech + lit
caption + haptic pulse pattern = index + 1). A `press` selects. A `pause` flag
is set while a DOM control has focus. The highlight advances by itself and
cycles until a press, with no time limit: it never expires, skips or
auto-chooses, so one switch is enough. (The `dwellMs` timer only moves the
highlight; it never decides for the player.)

### 5.2 Setup flow (Req 17)
`setup` defines five options: Just play, Play by sound, Play by sight, More
time, More settings. Each maps to a profile patch (for example Play by sound:
`picture:false`, voice on; More time: `speed:'slow'`). Every option renders as a
`menu-option` event, so it gets speech, caption, indicator and haptic pulses.
OS preferences merge into defaults first (Req 17.6).

### 5.3 Events and channels (Req 3a, 3, 4, 5)
`createGame` holds an event bus. `emit(event)` runs every **enabled** channel's
`render` and passes the combined `OutputCommand[]` to `adapter.perform`.

- **sound**: cue beeps at `J−3·BEAT`, `J−2·BEAT`, `J−BEAT` using the voice table;
  position (pan from object x, pitch and filter from distance); reward swell on
  `cleared`. Ambience and music commands come from `audio/` as data (Req 18).
- **speech**: plain short sentences from the strings source. A missing string is
  a proof failure (property 11), never a silent gap.
- **captions**: object name, four pips (three amber, the fourth green, differing
  by shape and position), scaled by `textScale`, coloured by theme and palette.
- **indicator**: one `flash:true` command per sound cue.
- **haptics**: pattern per object type (grave slow pulse, fence quick tap).

Channels read `profile.volume`, `mono`, `reducedMotion` (no flash when set).

### 5.4 Registry (Req 6)
`defineObstacle(name, opts)` fills defaults: `say` from name, `caption` from
name, `sound` from the next free voice (distinct in pitch and timbre), `draw`
as a placeholder shape, `haptic` pattern from a table. Registration fails with
a message naming the missing output if anything is still absent (6.6).

### 5.5 Level and timing (Req 7)
`generateLevel(seed)` uses mulberry32. All times are running seconds. The
formulas are exactly those in `tech.md`: window `[a,b]`, ideal press `J`, gap,
widths. Real time = running time ÷ speed rate.

### 5.6 Proof (Req 8)
`prove(level, profile, registry) → ProofResult[]`, one entry per property:

```ts
interface ProofResult { id: number; name: string; pass: boolean; counterexample?: string }
```

| # | Property | How it is checked (pure) |
|---|---|---|
| 1–3, 6 | Jumpable, Reachable, Unambiguous, Fourth beat | arithmetic over obstacles |
| 4 | Multisensory | registry entry has sound, say, caption |
| 5 | Window floor | `(b−a)/rate` ≥ 400 ms Fast, 650 ms Slow |
| 7 | No unsafe flashing | collect `flash`/visual-change commands from all events; max per 1 s window ≤ 3 |
| 8 | Two-sense | render each event type under the profile; distinct senses ≥ 2 |
| 9 | Contrast | WCAG ratio for every theme: text ≥ 4.5, graphics ≥ 3 |
| 10 | No forced hold/chord | input spec has no hold or chord; hold only behind opt-in and a single press still works |
| 11 | Strings | every caption/speech key exists in the strings source |
| 12 | Intent preserved | default-profile level identical before and after any repair |
| 13 | Cues over ambience | at each cue time, `cueGain·volume.cues` exceeds ambience+music by margin M |
| 14 | Setup two senses | each setup option renders speech + caption + haptics |

Counterexamples are built from templates with the level, object, numbers and a
plain cause, for example: "Level 17, obstacle 4 (crypt, 1.00 s wide): no
take-off point clears it. One jump covers only 0.73 s."

`refuseIfFailing(level)` throws `LevelRefused` carrying the counterexamples; the
game shows the reason and never serves the level (8.9).

Open choice: margin M for property 13 (start at 6 dB; tune with the player test).

### 5.7 Personas and reviewer (Req 9, 19)
A persona is `{ perceives(cmd): boolean; pressTimes(level, outputs): number[] }`.
- perfect: perceives all, presses at `J`.
- timing-error: presses at `J + N(0,σ)`.
- audio-only: perceives only `senses: ['hearing']` commands and presses on the
  fourth beat counted from the beeps.

`simulate(level, persona, speed, n)` returns a clear rate. `review(level,
profile)` runs each reviewer persona, finds each failure or unperceived event,
and returns `Finding[]` (persona, level, object, cause). Each finding converts
to a failed `ProofResult`. A `Repair` is `{ describe, apply(level, profile) }`.
`repairGuard` rejects any repair that applies to a profile that did not ask for
it, or that alters the default profile's level (properties 12 and the "no repair
for a profile that didn't ask" rule). A player's own choice, such as "More
time" setting Speed, is not a repair and is allowed. The reviewer
replaces hand-written accessibility tests for what it covers (19.5).

### 5.8 Report, log, settings (Req 10, 11, 14)
`report(profile, proofResults)` lists only features backed by an enabled
channel and a passing property, each with its ESA tag. Output as JSON and
Markdown. `log` records attempts and exports CSV (ms of real time). Settings
persist through `adapter.save`; the web adapter wraps localStorage in try/catch
and falls back to memory.

### 5.9 Web adapter (Req 20.3)
Canvas 2D for drawing, Web Audio for sound (oscillators and gain only), Web
Speech for voice plus the `aria-live` region, Gamepad for presses and rumble,
`navigator.vibrate` where present, DOM for setup and settings with visible
focus and Atkinson Hyperlegible. Picture-off hides the canvas.

### 5a. Songs, moves and holds (Req 29, 31)
`song/index.ts` turns a `Song` (parts in bars, each rest, calm or busy, with a
move and obstacle kinds) into a `Level` with `sections` and `portals`. Presses
land on whole beats; each countdown starts after the landing from the one before.
Numbers are given last, so the song's shape does not depend on the lesson. Gates
carry `gate.here` (the player's lane) and `value` (the other lane). The schedule
adds `portal` events and puts each part's `energy` on the atmosphere events; the
track thins its drums by energy. `proof/song.ts` holds properties 15, 16, 103
and 104. The run gains `assist` (timing help), `holdUntil`, `holdForWords` and
`snapshot().held`; a game plays music on the real clock while held.

### 5b. Speech queue and place sound (Req 30)
`createSpeaker({ queue })` keeps lines in order and calls each voice's end (an
utterance's `end`, a clip's `done`, a provider's promise), with a guard timer.
Speech commands carry `mode`, `key` and `tone`. The sound player builds one
reverb per echo length from decaying noise, sends a share of each echoing sound
into it, and adds a vibrato oscillator for `wobble`. `withAcoustics` applies a
place's echo to effects, cues and rewards only.

## 6. Failure handling (Req 12)
On a miss, the game emits `fall-reason` with "Pressed a little early/late" or
"No press", then restarts just before that obstacle. No lives, no game over.

## 7. Testing strategy (Req 13)
- Vitest unit tests per module.
- fast-check, one property test per proof property, over arbitrary seeds,
  profiles and themes, N ≥ 200 levels. A shrunk failure prints the plain-English
  counterexample.
- A seeded "broken crypt" fixture proves the proof fails with the expected text
  and the gate refuses (the demo).
- An import-boundary test fails if core imports from `adapters/`.
- Personas run in CI headless.

## 8. Packaging as a Kiro power (Req 15, 16)
A new root folder `power/marrow/` in Agent Plugins format holds: the steering
files, the `level-forge` MCP server (`mcp/level-forge`, tools `generate_level`,
`prove_level`, `simulate_persona`, `review_level`, `a11y_report`), the two hooks
(proof-on-save, store-list regenerate) and a copy of the built skeleton. A
steering file tells Kiro: when asked to build a game, build it on Marrow. The
benchmark script runs three fixed prompts with and without the power and counts
passing properties.

## 8a. Customisation layer (Requirement 22)

Two kinds of choice, kept apart:

| | Who | Where | Example |
|---|---|---|---|
| **KitConfig** | the game's developer | `createKit(config)` | jump length, wording, voices, which channels exist |
| **Profile** | the player | saved per player | speed, text size, volumes |

`createKit(config)` builds a registry, event registry, channels, level
generator and proof that all read the same config, so nothing is hard-wired:

```ts
const kit = createKit({
  timing:   { airtime: 1.2, beat: 0.5 },          // your jump and beat
  strings:  { approaching: 'Watch out: {name}' }, // your words, or a translation
  voices:   [{ label: 'low', hz: 200, wave: 'sine' }],
  defaults: { speed: 'medium', textScale: 1.5 },  // what a new player starts with
  events:   { 'coin-collected': { say: 'Coin', caption: 'Coin', sound: { hz: 1200, wave: 'sine' } } },
  channels: { omit: ['haptics'], replace: { indicator: myGlow } },
  properties: [myOwnRule],                        // extra proof properties
});
```

Built (task 7a): timing, strings, voices and vibration patterns, starting
profile, custom events with presentations, omit/replace channels, window floors,
custom proof properties, bring-your-own level data. Still to come, each under
the Kit rule: themes (`defineTheme`, checked by the contrast property), setup
options, audio mix and ambience, scanning dwell, coach voice (off by default),
and adapter styling (caption box, pip shapes).

The kit cannot force a developer to call the proof. In Kiro, the power's hooks
and steering do that; outside Kiro, it is the developer's call.

## 9. Risks and open choices
1. Immersive audio is large. Build a thin slice first (pan, ambience, reward),
   then add music.
2. Property 13 margin M needs real ears. Tune after the player test.
3. Power format details are not fully confirmed. Check the Agent Plugins spec
   when packaging (task 11).
4. "Any engine" is a claim about the contract. State that only the web adapter
   ships.
