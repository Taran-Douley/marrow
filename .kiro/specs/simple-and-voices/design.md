# Design: simple and voices

Task 2 (character voices) is built. Everything else is design only, and is marked so.

## 2. Character voices (built)

### The small API

```ts
createKit({
  characters: {
    narrator: {},
    mabel: { name: 'Mabel', voices: ['Libby', 'Sonia'], pitch: 1.3, rate: 1.02, pan: -0.5,
             signature: { hz: 880, hzTo: 1175, wave: 'sine', ms: 180 } },
  },
  events: { 'walk-hint': { say: '{line}', speaker: 'mabel', caption: '{line}' } },
});
```

- `characters` is a table by id. Every field but the ones a character needs is optional. The id `narrator` speaks every line with no `speaker`.
- `speaker` on an event names the character. It may use a slot (`'{boss}'`), so one event serves seven bosses.
- `also` on an event adds later lines by other speakers ("the narrator, then the boss, then the narrator"). A part whose slots the event does not fill is left out.
- Code: `skeleton/src/speech/index.ts` (validation, the time a signature adds, the "differ in two" check, the countdown check), `skeleton/src/channels/index.ts` (the speaker on each speech command, the name in captions), `skeleton/src/adapters/web/speech.ts` and `index.ts` (the signature before the voice, the voice choice, the live text).

### What happens when a character speaks

1. The speech channel gives the command a `speaker` (id, name, voices, pitch, rate, position, signature) and a `tone` of its pitch and rate.
2. The caption gets "Name: ". The live region gets "Name: line" as the line is said. The browser voice says the line only, not the name, because the voice and the signature already say who.
3. When it is the line's turn, the adapter plays the signature through Web Audio (placed by its position, centred in mono), then the voice starts 80 ms after it ends. A line that waits in the queue plays its signature when it begins, not when it was queued.
4. The browser voice is chosen from the character's own list first, then the game's list, then the best natural voice. Its pitch and rate are the character's, relative to the player's own.
5. With the built-in voice off, the signature still plays and the live text still has the name. With one system voice, every character uses it, at its own pitch and rate.
6. If the signature cannot play, the line is still said.

Nothing is done to the words: no filter, echo or reverb. Only the signature is a synthesised sound.

### Time

`spokenMs(command)` is `speechMs(text)` plus the signature (ms) plus an 80 ms pause. `totalSpokenMs(commands)` sums them. Both games' waits on words (`wordsMs` in Ghastly Moves, `spokenMs` in Séance Escape) and the Ghastly tests that measure words use it. The narrator has no signature, so every existing line takes the time it took before.

### Characters

A game declares a narrator and the characters below. The narrator is the game itself: it is unnamed, its pitch and rate are 1, and it has no signature. It speaks menus, numbers, tells, coach lines and the room names. A signature there would delay lines that sit right beside the countdowns and the scanning.

| Game | Character | Name shown | Pitch | Rate | Position | Signature |
|---|---|---|---|---|---|---|
| Séance | narrator | none | 1 | 1 | 0 | none |
| Séance | Mabel | Mabel | 1.3 | 1.02 | -0.5 | sine 880 to 1175 Hz, 180 ms |
| Ghastly | narrator | none | 1 | 1 | 0 | none |
| Ghastly | The Pumpkin King | yes | 0.7 | 0.9 | -0.7 | triangle 140 to 100 Hz, 240 ms |
| Ghastly | The Bone Warden | yes | 0.85 | 1.12 | 0.7 | square 520 Hz, 90 ms |
| Ghastly | The Moss Witch | yes | 1.4 | 0.95 | -0.35 | sine 400 to 700 Hz, 260 ms |
| Ghastly | The Gatekeeper | yes | 0.6 | 0.85 | 0.35 | square 90 Hz, 200 ms |
| Ghastly | The Spider Miller | yes | 1.2 | 1.25 | 1 | triangle 1500 to 1900 Hz, 120 ms |
| Ghastly | The Hollow Wraith | yes | 0.95 | 0.8 | -1 | sine 300 to 180 Hz, 290 ms |
| Ghastly | Count Vexar | yes | 1.1 | 1.0 | 0.1 | triangle 220 to 330 Hz, 160 ms |

Decided by reading the event tables:

- **Séance Escape.** Mabel says whole events: `intro`, `walk-relic`, `walk-ritual`, `walk-sealed`, `walk-hint`. The phantom does not speak. Its call ("Phantom left, near") is the game reading out where it is, so it is the narrator's.
- **Ghastly Moves.** A boss speaks one thing: its taunt, in `stage-clear`, as the narrator, then the boss, then the narrator. Boss tells (`boss-tell-*`) are cues placed before the countdown and are the narrator's: a signature there would break property 23 (the tell clear of the countdown). `boss-intro`, `boss-won` and `boss-lost` are the narrator describing the fight. The coach is the narrator too: its line is placed up to 250 ms before the first beep and a signature could not fit (property 17).
- Why a signature never meets a countdown in Ghastly Moves: only `stage-clear` has a signature, and it is said when the level is over. `signaturesOutsideWindows` can check any level's commands against the countdown windows, and a test checks the rendered level has none.

### Not done in task 2

- A line that mixes speakers is still one line. In Séance Escape the first visit to a room says "Library. A whisper: ..." or "Library. Mabel: ..." as one narrator line, and a search that finds a relic says Mabel's hint inside the narrator's line (`walk-room`, `walk-search`, `room-event` are built in `apps/seance-escape/src/main.ts` and the walk). Splitting them needs a second event from there, and that file is under change by the relic perks work. Until then, the aside carries "Mabel:" inside the text.
- The default clip player plays a recorded clip with an audio element, which cannot be panned. A clip player that takes the position (the third argument) can.
- The relative loudness of a signature is a guess, not tuned by ear.
- Characters are proved apart by the simple check in `charactersTooAlike`. The full proof (property, counterexample) is task 6.

## 3. Voice speed (design)

Profile gets `voiceSpeed` (0.5 to 2.0, default 1, parsed defensively). The scanned settings menu offers 0.5, 0.75, 1.0, 1.25, 1.5, 2.0. The adapter multiplies the player's rate by it. `speechMs(text, speed = 1)` divides by it; `spokenMs` divides the words but not the signature. Every caller passes the profile's speed: `wordsMs`, `spokenMs`, `proveRunLength`, the coach and the song proofs. The run-length proof (207) reads the speed and is re-run at 0.5, 1 and 2.

## 4. Say that again, and where am I (design)

Two entries at the top of every scanned menu and one in play: "Say that again", "Where am I?". The speaker remembers the last command it said, with its speaker; repeating replays it through the same path. "Where am I / What next?" is built from the game's state in one line: in Ghastly, the stage, the next obstacle and the move; in Séance, the room, relics found, and the way to the nearest goal. Neither writes to the run, and neither takes a turn in a walk.

## 1. Keep it simple (design)

A profile flag `simple`. In first-run setup it is one more way to play, combinable with the others, with no condition named. Changes while on:

- **One thing at a time (Ghastly).** The level generator for a song keeps every gate at least 2.5 s (at the chosen speed, in real time) from every other jump or gate; `generateSong` moves or drops one that is too close, and the proof checks the result.
- **Maths matched to the player (Ghastly).** The lesson's range narrows to its easy end after misses and widens after a run of successes, never past the stage's own range. Counted in a short history in the log.
- **Séance.** Each stop offers one choice; "What next?" is always offered; the phantom moves one step in two; at most one phantom; a free hint after one catch.
- **Plain words.** The strings table gets a `simple` column, written as short sentences with no idioms. The kit uses it when the flag is on.
- **Quieter.** Music and ambience volume are cut; speech ducks everything else while it is said.

## 5. Gentle scares (design)

Profile flag `gentle`, on by default when `simple` is on. The Séance `Fright` setting becomes one reading of it. A sound's rise in loudness is limited by a shared limiter on the player: no more than 12 dB within 200 ms, measured on the scheduled gain curve of every sound. Jump-scare events lose their sudden part (the level and the full-screen change), never their information.

## 6. Proofs (design)

Each is a property over generated input with a plain-English counterexample, like the existing ones:

- One thing at a time: for every level and house, with the flag on, no two decisions inside 2.5 s.
- Characters apart: every pair differs in two of four (the check built in task 2, now with a counterexample naming the pair).
- Timing at every voice speed: the existing timing proofs run at 0.5, 1 and 2.
- Gentle loudness: render a level or house, take every sound's gain curve, and check the 12 dB, 200 ms rule.

## 7. Advisor (design)

Rules in `skeleton/src/advisor/suggestions.ts` for the seven features. Each gets a `guideline` (item name and link from gameaccessibilityguidelines.com) and an `esa` tag. Each guideline is looked up on the site when written. No name is written from memory.

## 8. Report and docs (design)

`accessibilityReport` gets the new features and proofs. The docs, README and `docs/kiro-usage-log.md` are updated.
