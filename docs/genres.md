# Which games Marrow serves

Marrow has two layers. Being honest about the difference matters, because one is
finished and general, and the other is proven only for one kind of game.

## Layer 1: the accessibility layer (works for any genre)

Your game says what happened (an event). Marrow shows it through every channel
the player has on: sound, speech, captions, a marker for every sound, and touch.
It never asks what kind of game you are making.

What it gives any game today:

- Objects of any kind (`defineObject`): an enemy, a coin, a landmark, a door.
  Each gets a voice, a spoken name, a caption and a vibration.
- Your own events, with how each is seen, heard and felt.
- **Position in space.** Give an event an `x` (left to right) and a `distance`
  and the sound is panned, quieter and duller when far. Text can say where:
  "Wraith left, close", so a deaf player reads what a blind player hears.
- Sounds that glide, filter and last as long as you say, for beacons and sweeps.
- Your own recipe for any built-in sound.
- A better or your own voice (`docs/voices.md`).
- One player profile: speed, volumes, mono, text size, themes, channels.
- Checks that work for any game: every event reaches at least two senses
  (`kit.proveEvents()`), beeps stay louder than what is under them, themes meet
  contrast.

Tested with three small games built from configuration alone (a shooter, an open
world, a platformer): `skeleton/test/genres.test.ts`.

## Layer 2: patterns (a proof that a game can be finished with one switch)

"Can this be finished?" has a different answer for every kind of game, so it
cannot be one universal proof. A **pattern** knows how a kind of game is played
with one switch, and proves it can be finished that way.

| Genre | Layer 1 (any genre) | Pattern and finishability proof |
|---|---|---|
| Platformer, runner | Yes | **Built: timed press.** Every obstacle can be jumped, the next one is reachable, cues never overlap, windows are wide enough. |
| Shooter | Yes (enemy positions, shots, hits, health; tested) | **Not built.** Proposed: aim sweep. A beam sweeps; press to fire. Proof: every enemy stays in the beam long enough to hit, and threats never pile up faster than one switch can answer. |
| Open world, maze, exploration | Yes (landmarks, regions, a guiding beacon; tested) | **Built: navigation with scanning** (Séance Escape). The walk goes one room at a time; each way forward is spoken, lit and sounded from its own direction; a pursuer follows by the shortest way. Proof 201–204: the exit is reachable, the shortest route is never caught, the pursuer starts far enough away, every passage works both ways. Not yet built: free-roaming worlds without a grid. |
| Quiz, puzzle, menus | Yes | **Built: scanning choice.** Options light and speak in turn; one press chooses; property 102 proves each is lit long enough to be spoken. The first-run setup flow that uses it is not built. |
| Fighting, racing, strategy | Should work; untested | None. |

You can add your own proof for your own game: pass `properties` to `createKit`.

## How to use Layer 1 with no pattern

```ts
const kit = createKit({
  events: {
    'enemy-spotted': { say: '{object} {side}, {range}', caption: '{object} {side}',
                       sound: { hz: 330, wave: 'square' }, spatial: true, haptic: [40, 30, 40] },
  },
});
kit.defineObject('wraith');

// In your own game loop:
adapter.perform(kit.render({ type: 'enemy-spotted', at: now, data: { object: 'wraith', x: -0.8, distance: 0.2 } }),
                { now, rate: 1 }, profile);

kit.proveEvents(); // does every event reach two senses?
```

## What Marrow does not do

It does not make a game accessible by itself. Without a pattern it makes every
event heard, seen and felt, and checks that it does. It cannot tell you the game
can be finished with one switch, and it does not replace testing with disabled
players. We never call a game "fully accessible".
