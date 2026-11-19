# Demo games

The two demo apps must be built through the Marrow power, use different genres,
be fun, and be playable by one switch and by sound alone. Judges may judge from
the video, so the first minute of each game decides whether they care.

## Game 1: Ghastly Moves (BUILT, 2026-11-18): the educational angle

A rhythm game where the ghost dances to your times tables.

- Each gravestone has a number, spoken and shown, and three beeps.
- If the number is in the chosen table (2 to 12), **jump on the fourth beat**. If
  not, **let it pass**: pressing is the mistake.
- Timing is judged **Perfect, Good or Ok**. Each right decision in a row climbs a
  note of a scale and brightens the lantern. A mistake resets the streak.
- A mistake **teaches**: "Not that one. 11 is not a multiple of 3." or "No press.
  12 is a multiple of 3: 4 times 3."
- The level ends with a **rank** (S, A, B, C) and "10 of 12 right".
- It is maths, listening and rhythm on one switch, and it is the same on every
  table because the lesson is a rule, not a list.
- In the kit, not just the app: lessons, numbered obstacles, let-it-pass
  obstacles, judgements, streaks, scores and ranks are all configuration. Any
  developer can make a spelling, notes or colours version by writing a rule.

Crossroads (the old learning idea) is dropped: Ghastly Moves is the learning game.

## Game 2: the impressive one (OPEN: choose)

It must be a different genre from a rhythm game, show something technically
striking, be fun in the first thirty seconds, and have its own pattern and its
own proof, so we can say what is and is not proven.

### Idea A: Séance Escape: a haunted house, escaped by sound (open world and horror)

First-person, in the dark, in a procedurally built mansion. You are always
walking. At every junction the directions are offered in turn: each option is
spoken, lit, and **sounded from its own direction in true 3D** (left is in your
left ear). One press picks. Nothing is timed: the ghost only moves when you do, so
the dread comes from sound, not from a clock.

- **Sound is the world.** True 3D (HRTF) audio. Footsteps change with the floor.
  Doors creak where they are. A ghost whispers from where it is, and its
  heartbeat grows as it nears. The exit has a bell. A **sonar ping** (a press)
  returns echoes that tell you how far the walls are on each side.
- **A blind player can win it, and so can a deaf player.** Every sound has a
  caption with its direction ("Whisper, behind you, close"), a touch pattern, and a
  map for those who see.
- **The proof** (a new pattern, navigation): the house is always connected, the
  exit is always reachable, and the ghost can never trap you in a dead end.
- **Kit features it uses:** placed sounds, scanning choice, the line script and
  voices (the ghost can speak), haptics (the heartbeat), recipes, the sound-world
  rules, the two-senses check and the persona reviewer.
- **Video moment:** a blind player escapes a haunted house, headphones on, and
  the screen is black.
- **Effort and risk:** high. About four to five days. The risk is the 3D audio
  and the chaser's behaviour. Highest wow and most impressive claim.

### Idea B: Echo Hunter: a shooter you aim by ear

A top-down ghost hunt. A lantern beam sweeps from left to right and back; it is
a tone that **pans with its angle**, so you hear where you aim. Ghosts drift in,
each humming from its own spot. As the beam crosses one a **lock tone** sounds.
Press on the lock to fire.

- Waves, ghosts that dodge, a boss, and a health bar you hear and feel.
- **The proof** (a new pattern, aim sweep): every ghost stays in the beam long
  enough for one switch to hit it, and threats never pile up faster than one
  switch can answer.
- Fast action, easy to understand in two seconds, very good in a video.
- **Effort and risk:** medium. About three days. The lowest-risk impressive option.

### Idea C: Dungeon of Echoes: a turn-based roguelike (depth and complexity)

An eight-by-eight grid dungeon, turn by turn. Enemies are placed in space by
sound. Your actions (move, strike, rest, use item) are scanned and chosen with one
press. Items, stats, three enemy types, and a new dungeon each time.

- **The best stress test of "any game, however detailed".** It has many objects,
  many events at once, inventory and rules, so it forces the kit to scale (see
  Requirement 25). No reflexes needed, so it suits players with slower reactions.
- **The proof:** every dungeon is connected, every item reachable, no soft-lock.
- **Effort and risk:** medium to high. About four days. Less exciting in a
  three-minute video than A or B.

### Recommendation

**A, Séance Escape**, if you want the most striking result and accept the risk.
It makes the open-world claim real, has the best video moment, and is the most
unlike a rhythm game. **B, Echo Hunter**, if you want a safer win that is still
impressive. **C** only if showing "complex games work" matters more than the
video.

Whichever you pick, build it in stages so something always works: a corridor
with sound, then the scanning choice, then the ghost, then polish. If it slips,
fall back to B, which shares most of the same parts (placed sound, spoken
options).

## Time

Freeze is Mon 30 Nov. Besides the second game you still need the setup menu and
scanning (task 14), offline (8a), the reviewer (15), the report (16), the scale
pack (16d), the MCP server, hooks, the power and the benchmark. That is tight.
If time runs short, cut in this order: the separate Crew app, persona polish,
the second game's extras. Never cut the proof, the eyes-closed demo, the video
or the power.

## Séance Escape (second game, built)

A haunted house in the dark. You walk by yourself, one room at a time. At a crossing the choices (Ahead, Left, Right, Turn back, Listen) are read out one by one, each sounded from its own direction in 3D. One press chooses. Nothing is timed while you decide. A phantom hunts you by the shortest way, and you hear it, with a heartbeat that grows as it nears. Caught means back to the last crossing, with no lives.

- Interaction pattern: navigation with scanning. The proof is properties 201 to 204 (exit reachable, shortest route safe, fair start, well formed) plus 102 (every option can be heard).
- Tested: a player who takes the shortest route is never caught, on random seeds.
- Not yet tested by a person: how it sounds, whether the pace and the phantom feel fair, and whether 3D placement is clear on real headphones.

## Ghastly Moves, now with stages

Six stages with their own rule, length, pad key and still scenery. Stages 4 and 6 mix two tables. Best rank per stage is saved. The judgement also appears as a word above the ghost. Free practice with any single table remains.

## Update: story, bosses, music and 3D

- **Ghastly Moves** is now a story of seven places in Grimsby Hollow: even numbers, fives, threes, fours or sixes, squares, sevens, primes. Each place ends with a boss with harder numbers. Beat it (70% right) to win an item: Pumpkin Lantern, Bone Key, Witch's Broom, Silver Bell, Spider Silk Cape, Moon Mirror, Crown of Midnight. Each stage has its own background track, and each boss a heavier version. The music stays below the beeps and thins out during a countdown (proof properties 13 and 14).
- **Séance Escape** is drawn in first-person 3D (three.js), with a flat-map fallback. It speaks one line between crossings and reads the options only after that line is finished.
