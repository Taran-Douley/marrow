# Customising Marrow

Marrow is a kit you build into your own game. You decide how it looks, sounds
and reads. Your player decides their own settings. The proof checks the result.

| Who | Chooses | Where |
|---|---|---|
| You (the developer) | wording, sounds, timing, which features exist, starting settings | `createKit(config)` |
| The player | speed, text size, volumes, channels on or off | their saved profile |

Everything below is in `KitConfig`. Leave out what you do not want to change.

```ts
import { createKit } from '@marrow/skeleton';

const kit = createKit({
  timing: { airtime: 1.2, beat: 0.5 },
  strings: { approaching: 'Watch out: {name}' },
});
kit.defineObstacle('hedge', { width: [0.2, 0.5] });
const level = kit.refuseIfFailing(kit.generate(42)); // throws if a player could not finish it
```

## What you can change today

| You want to change | Option | Default | Guarded by |
|---|---|---|---|
| Jump length, beat, gaps, first obstacle, count, speeds | `timing` | values in `tech.md` | Proofs 1, 2, 3, 5, 6 use your numbers |
| Minimum take-off window per speed | `floorsMs` | Slow 650 ms, Fast 400 ms | Proof 5 |
| Any spoken line or caption, or a translation | `strings` | plain English phrase list | Proof 11 (a line may not be empty) |
| Sounds for objects that set none | `voices` | 4 voices in `tech.md` | Proof 4 (every object has a sound) |
| Vibration patterns | `haptics` | 4 patterns | none yet |
| What a new player starts with | `defaults` | Slow, everything on | none: the player can change it |
| Your own game events and how each is shown, heard, felt and placed in space (`x`, `distance`) | `events` (`say`, `caption`, `sound`, `spatial`, `haptic`) | none | Proof 8: `kit.proveEvents()` checks every event reaches two senses |
| Any thing that is not an obstacle: an enemy, a coin, a landmark | `kit.defineObject` | none | Proof 4 |
| Your own version of the jump whoosh, landing, fall or approach sound | `audio.recipes` | built-in sounds | Property 13 (an approach recipe can never be louder than its share) |
| Leave a channel out | `channels.omit` | none omitted | Proof 8 (two senses), when built |
| Swap a channel for your own | `channels.replace` | built-in channels | Proof 8, when built |
| Your own rules for your game | `properties` | none | they run with the rest |
| How a fall plays out: pause, restart point, grace for a late press | `run` (`fallPause`, `restartLead`, `lateGrace`) | 2 s, 1 s, 0.6 s | none: gentle failure is the rule |
| Wind, pad, approach tone, jump/landing/fall sounds: each on or off, and the pad's key | `audio` (`ambience`, `music`, `approach`, `effects`, `keyHz`) | all on, 110 Hz | Property 13: beeps stay 6 dB over everything under them, tested |
| Who speaks aloud: a better browser voice, your recordings, or your own AI voice | web adapter `voice` (`browser`, `clips`, `provider`); see `docs/voices.md` | the most natural browser voice | Text log always written; falls back so a line is never lost |
| Every line the game can speak, to record or generate | `kit.lineScript()` | n/a | Test: every spoken line is in the list |
| A lesson: the rule, the range, the prompt, how often a target appears, and what a mistake teaches | `lesson` (`isTarget`, `values`, `prompt`, `targetShare`, `explainWrong`, `explainMiss`) | none (no lesson) | Proof 101: every number in range and solid exactly when it is a target; at least two of each |
| How timing is judged and scored | `run.scoring` (`perfectAt`, `goodAt`, `points`, `streakBonus`, `streakCap`) | 20%, 60%, 100/60/30/50, +10% a step, cap 10 | none: you choose the game's feel |
| Rank cut-offs | `run.scoring.ranks` | S 90%, A 75%, B 55% | none |
| The words for Perfect, Good, Ok, "your move", "not that one", a streak, and the number | `strings` (`perfect`, `good`, `ok`, `yourMove`, `fallWrong`, `streak`, `number`) | plain English | Proof 11, line script |
| Your own object art, with the lesson number passed in | `draw` in `defineObstacle` (`box.value`) | placeholder shape | none |
| Font and colours of the caption box and pips | web adapter `style` (`fontFamily`, `tokens`) | Atkinson Hyperlegible stack, built-in themes | Contrast: built-in themes are tested; your own colours are not yet |
| Loudness and length of the beeps | web adapter `sound` (`masterGain`, `cueSeconds`) | 0.35, 0.16 s | none |
| Where input comes from, storage, timers, audio, speech | web adapter options (all injectable) | the browser's own | none |
| Your own levels instead of generated ones | pass any `Level` to `prove` | generator | all proofs |

Per object (`defineObstacle`): `say`, `caption`, `sound`, `haptic`, `draw`, `width`.

## Not built yet (each will follow the same rule)

| Feature | Planned option | Task |
|---|---|---|
| Colours, fonts, contrast themes | `defineTheme`, checked by the contrast proof | 12 |
| Setup options and their order | `setup.options` | 14 |
| Scanning speed default | `defaults.dwellMs` (exists) and `setup` | 14 |
| A richer sound world: more varied wind and music, several objects placed in space at once | `audio` (more options) | 10 (first slice done) |
| Character coach voice (off unless you turn it on) | `coach` | 15a |
| Other engines | adapter contract | roadmap |

## What you cannot change, by design

- **Turning the proof off for a level you serve.** `refuseIfFailing` is yours to
  call, and the kit cannot force you. In Kiro, the power's hooks and steering do.
- **Writing screen-reader text.** Every line is written to the `aria-live` text
  even when you turn the spoken voice off.
- **A theme that fails contrast, or a channel setup that leaves an event with
  one sense.** These fail the proof with a plain-English reason, not silently.

## Rule for kit developers

Every new feature must be switchable, configured through `KitConfig`, worded
through `Strings`, and listed here with its default and the proof that guards it.

## Added: music, scanning and walks

| You want to change | Option | Default | Guarded by |
|---|---|---|---|
| A background track: key, scale, bass, melody and drum patterns | `audio.track` (a `TrackSpec`) | none | Creation refuses a key outside 60–132 Hz or a bad pattern. Property 13 (beeps 6 dB over the music) and 14 (music below the lowest beep) |
| How long each scanned option stays lit | `dwellMs` in the profile, and a longer time for long labels | 2200 ms | Property 102 (every option can be heard) |
| Walk speed, how far you hear the phantom or the bell, Listen range and cooldown, the pause after being caught | `resolveWalkSettings` (`stepMs`, `hearRange`, `exitRange`, `listenRange`, `listenCooldown`, `catchPauseMs`) | values in `skeleton/src/navigation/walk.ts` | none: they change feel, not fairness |
| The house: size, how often the phantom moves, spare steps, how far it starts | `generateMaze(seed, { width, height, ghostEvery, margin, minGhostStart })` | 8×8, every 2 steps, 2, 6 | Properties 201–204 refuse any house that cannot be escaped |
| How long a spoken line takes, so options wait for it | `createWalk({ speechMs, quietMs })` | no waiting | Tested: at most one line between crossings |
| Voice recordings by file name | `clipsBySlug('voice/')` and `slugOf(line)` from `@marrow/skeleton/web` | none | A missing file falls back to the browser voice |

### A track in a few lines

```ts
const kit = createKit({
  audio: {
    keyHz: 98,
    track: {
      name: 'Crypt',
      rootHz: 98,
      scale: [0, 1, 3, 5, 7, 8, 10, 12], // steps above the key, in semitones
      bass:   ['0.......', '0...1...'],   // 8 slots a bar; a digit is a scale step
      melody: ['....2...', '.3...2..'],
      kick:   ['x.......', 'x...x...'],  // any mark is a drum hit
    },
  },
});
```

The kit plays one bar with each atmosphere event, quietly, below the beeps, and thins the melody out as a countdown nears.
