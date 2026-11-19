# Make your own accessible game

This takes about ten minutes. You need Node 20 or later.

## 1. Make the game

From this repository:

```sh
npm install
npm run new-game -- ../my-game
cd ../my-game
npm install
npm run dev
```

Open the address Vite prints. Press any key. You are playing **Bat Dash**, a complete game in one file, `src/main.ts`. Without writing any accessibility code, it already has:

- a menu you can drive with one switch, including settings and a first-run setup ("Just play", "Play by sound", "Play by sight", "More time", "More settings");
- three pitch-coded beeps before every bat or rock, with captions and pips, a sound marker and a buzz;
- speech for every event, written to a live region for screen readers, with a switch to turn the voice off;
- gentle falls that say why ("Pressed a little early") and retry just before the obstacle;
- an optional coach that says what is coming before each countdown;
- levels proved finishable with one switch before they are served, and offline play after the first visit.

Using Kiro? Add `--kiro` to `new-game` to copy the proof hooks and three agents (level designer, accessibility reviewer, playtester) into the game's `.kiro/` folder.

## 2. Change what is in it

Obstacles are declared, not wired. Each one gets a sound, a spoken name, a caption and a vibration on its own:

```ts
kit.defineObstacle('bat', { width: [0.12, 0.24] });
kit.defineObstacle('rock', { width: [0.16, 0.3], say: 'Rock', caption: 'Rock' });
```

Your own events say how they are heard, read and felt. Use `{slots}` for data:

```ts
createKit({
  events: {
    intro: { say: 'Bat Dash. Press on the fourth beat.', caption: 'Press on the fourth beat' },
    'door-opens': { say: 'A door opens {side}', caption: 'Door {side}', sound: { hz: 330, wave: 'triangle' }, spatial: true, haptic: [40] },
  },
});
```

Every event must reach at least two senses. `kit.proveEvents()` tells you, in plain words, if one does not.

## 3. Break it on purpose

Make an obstacle too wide to jump:

```ts
kit.defineObstacle('crypt', { width: [1, 1] });
```

The game refuses the level, and the proof says why:

> Level 17, obstacle 1 (crypt, 1.00 s wide): no take-off point clears it. One jump covers only 0.73 s.

Set the width back to `[0.2, 0.3]` and it plays again.

## 4. Make it a song

A song builds the level from parts. Busy parts are close together, calm parts are spaced out, and rests have nothing to press. A part can change the move:

```ts
createKit({
  song: {
    name: 'Bat Song',
    sections: [
      { name: 'Intro', bars: 2, feel: 'rest' },
      { name: 'Verse', bars: 8, feel: 'calm' },
      { name: 'Upside down', bars: 8, feel: 'busy', move: 'flip' },
    ],
  },
});
```

A portal announces each new move, and proofs 15 and 16 check the rests and the warnings.

## 5. Make it a lesson

Give each obstacle a number, and a rule for which to jump:

```ts
createKit({
  lesson: {
    title: 'Threes',
    prompt: 'Jump on every multiple of 3. Let the others pass.',
    values: [1, 36],
    isTarget: (v) => v % 3 === 0,
    explainWrong: (v) => `${v} is not a multiple of 3.`,
    explainMiss: (v) => `${v} is a multiple of 3.`,
  },
});
```

Mistakes are explained, and the game waits for the explanation before the next countdown.

## 6. Check before you ship

```ts
kit.prove(level);              // can it be finished with one switch? (properties 1 to 6, and the song and lesson ones)
kit.provePresentation(level);  // flashing, two senses, contrast, no hold, every line recordable (7 to 11)
```

Then read `docs/customisation.md` for everything you can change, `docs/voices.md` for using your own voice or recordings, and `docs/genres.md` for games that are not runners (mazes, quizzes, scanning).

Marrow helps a game work for more players. It does not make a game "fully accessible", and it does not replace testing with disabled players.
