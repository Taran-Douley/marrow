# Design: Ghastly Moves, rhythm v2

## What changes, and where

| Pillar | Kit (`skeleton/`) | Game (`apps/ghastly-moves/`) |
|---|---|---|
| 1 Locked to the song | `proof/rhythm.ts`: `lockedToTheSong` (19), added to `songProperties` | none: `generateSong` already puts presses on beats |
| 2 Instant retry | `run`: setting `explainOnce`, `falls` in the snapshot, `attempt` and `again` on the fall event, `wordsHoldMs`. `channels`: phrase `fallAttempt`. `proof/rhythm.ts`: `retryInTime` (20) | `kit.ts`: run settings and short reason words. `main.ts`: stats, new-best, no hold on a repeat fall. `progress.ts`: saved best |
| 4 The picture dances | `pulse/`: `pulseAt`. `proof/rhythm.ts`: `pulsesGentle` (21), part of `provePresentation` for a song kit | `art.ts`, `scene.ts`, `map.ts` |
| 5 Bosses you can hear | none | `pattern.ts`: the pattern, its song, tells and proofs 22 and 23. `kit.ts`, `objects/projectile.ts`, `main.ts` |

## 1. Locked to the song

The generator already places each press on the beat inside a part (`generateSong`). Property 19 checks it from the outside, on any level that has parts:

- ideal press `J = start + (width - airtime) / 2`. `J / beat` must be within 1e-6 s of a whole number.
- the part that holds `[first beep, clearAt]` must exist and must not be a rest.

A level with no song passes: there is nothing to lock to. Practice mode has no song, so it keeps its own pulse.

## 2. Instant retry

Before: a fall rested 2 s, restarted 1 s of level time before the countdown, and held level time until the whole reason and sum were said.

Now (Ghastly Moves settings): `fallPause` 0.4 s, `restartLead` 0.8 s, `explainOnce` on.

- The run remembers which obstacles the player fell at. The first fall carries `explain` (the sum). A repeat fall carries `again: true` and `attempt`, and no `explain`. The channel renders it as `"<reason> Attempt <n>."`.
- `main.ts` holds level time for the words (`holdForWords`) only when `again` is not set. This is the honest cost: the first fall at an obstacle may wait for its sum to be said; later falls there do not wait for anything. Property 20 checks the second case: with no words held, a retry waits `fallPause` and nothing more, at every speed.
- Reasons: "Early.", "Late.", "Missed." (nothing pressed on a target), "Wrong number." (pressed on a number to let pass), through `strings`.

### Progress, attempt, best

`percent = floor(100 * passed / total)`, where `passed` is the obstacles done so far (`snapshot.obstacle`, plus one while a jump over the current one is in the air). Attempt is `falls + 1`.

`best` is kept per key: `'3'` for stage 3, `'3b'` for its boss, `'t7'` for free practice of the 7 times table. It is saved as JSON under `ghastly.far` (not in `ghastly.progress`, so older saves are untouched), read and written in `try/catch`, and bad data is dropped value by value.

The best moves up as the clean stretch passes it. The new-best event plays once per attempt, only when a best was saved before the attempt began. It is sent when a right move is made, so the next countdown is at least a second of level time away.

The `run-stats` event goes to the live region only (the voice is not used for it).

## 4. The picture dances

`pulseAt(t, beat, reducedMotion)` returns 0 to 1: it rises over the first 8% of a beat, then falls away by half a beat. It is 0 for reduced motion. The scene multiplies it by `PULSE_MAX_ALPHA` (0.1) and adds that opacity to the moon's halo and the lantern's glow. Nothing else changes with it.

Property 21 checks: pulses a second (`rate / beat`) is at most 3 for each stage beat at slow, medium and fast; one rise per beat when sampled; zero with reduced motion; and `0.1 x |luminance(amber) - luminance(background)| < 0.1` in both themes.

### Graphics (`art.ts`)

- Sky: a vertical gradient per place, dark at the top and a little lighter at the horizon (text keeps 4.5:1 on the lightest, about 6.7:1). Still stars. The moon has a radial glow and two craters.
- Layers: far hills, a middle row of the place's tall things (dead trees, graves, pines, iron bars, a mill, a manor) and a near row of small things (pumpkins, graves, fence posts). They scroll at 8%, 22% and 45% of the ground's speed, and stand still with reduced motion. Colours are dark and close to the sky, so obstacles stand out.
- Ground: a gradient, tufts that move with the obstacles, and the 3 px line in the theme's line colour.
- Ghost: a radial gradient body, a hem with four waves, big eyes. Lantern: a radial glow that grows with the streak.
- High contrast: a flat background, no layers.
- A test double of the canvas that cannot make gradients still works: `art.ts` falls back to a flat colour.

## 5. Bosses you can hear

`pattern.ts` defines `BossPattern`: the throws, the order of volleys and the volley length.

The Pumpkin King:

| | Lobbed bomb | Rolled bomb |
|---|---|---|
| Beep (countdown) | 659 Hz sine | 392 Hz square |
| Throw sound | airy noise, rising | low buzz, falling |
| Tell | rising sine, 440 to 880 Hz, "Lobbed." | falling square rumble, 147 to 98 Hz, "Rolled." |
| Drawn | round, fuse up, arcs in from above | squat, dust behind, stays on the ground |

The fight is a song (`patternSong`): a 2-bar intro, then six times a 1-bar rest ("Tell lob" or "Tell roll") and a 4-bar busy volley that holds only that kind. Order: lob, roll, lob, roll, lob, roll. At 2 throws a volley the fight is 12 throws, about 54 s of level time.

The tell is sent by `main.ts` from level time (`sendTells`), a quarter second early, once. After a retry the next tell is the first one still ahead, so a tell already heard is not repeated.

The first tell comes 2 bars in, so a pattern boss holds level time until the whole introduction has been said (`holdUntil`), not only until the first countdown.

Proofs:

- 22 *Boss pattern can be heard*: for each pair of throw kinds, the beeps, the throw sounds and the tells differ in timbre and are at least a major third (1.25) apart in pitch; every tell has words and a caption; the level has the pattern's volleys in order, each with a tell, each with at least one throw, each throw of its volley's kind.
- 23 *Tell clear of the countdowns*: from the tell's start until its sound and words are done at the fastest speed (words taking 1.2 times `speechMs`), there is no throw sound or countdown, and the first throw it announces counts down at least one bar after it.
- The boss kit gets 15, 16, 19, 20, 103, 104 from the song and 22, 23 from `properties`.

Health: `need = ceil(0.7 x throws in the level)`, with `needed(boss, count)`.

## Proof ids

| Id | Name | Where |
|---|---|---|
| 19 | Locked to the song | kit, with any song |
| 20 | Instant retry | kit, with `run.explainOnce` |
| 21 | Gentle pulses | kit `provePresentation`, with any song |
| 22 | Boss pattern can be heard | game, boss with a pattern |
| 23 | Tell clear of the countdowns | game, boss with a pattern |

## Risks

- The short line and the attempt are said while play resumes, and the next number can cut them off.
- Tunes, tell sounds and bomb pitches were chosen without ears. Tune by playing.
- Real players, including blind players, have not tried the pattern yet.

## The Pumpkin King (Stage 1 redo)

Drawn in `apps/ghastly-moves/src/king.ts`, code only, no assets. Inspiration is the style of dark hand-drawn action games (cold area hue, silhouette first, rim light); nothing is copied from any game's characters, bosses or music.

- **Silhouette.** A tall triangle of cloak (about 330 px in its own units, drawn at 0.76), a round glowing head, a sharp crown. Not a blob: the read at a glance is "tall spike, round light on top".
- **Shape language.** Triangles and thorns for the body (cloak, crown tips, hooked fingers, thorns on the arms); round only for the head, so the head is the focal point.
- **Palette.** Three values plus one accent. Near-black cloak, moss and rust mids (the leaves), ember orange as the only saturated colour (the carved eyes and mouth, the cracks). Cool blue rim light from the moon on the right edges.
- **Parts.** Head: three-lobed cracked gourd with carved eyes and a jagged mouth lit from inside (flicker under 1 Hz, steady with reduced motion). Crown: five twisted dry stems with curling tendrils. Cloak: six rows of dead leaves, sweeping the ground on the left. Arms: long thin vine arms, thorned, with three hooked fingers. Roots instead of feet. Seeds drift off the cloak.
- **Poses, tied to the sound.** Idle: slow breathing, cloak sway. Lob wind-up (the rising tell): both arms over the head, head tipped back. Roll wind-up (the low rumble tell): crouch, front arm swept low. Swoop wind-up: one arm flung high and out. Throw: the front arm snaps forward at release, then eases home. Hurt: recoil, cracks flare, a few leaves fall. Laugh: head bobs, mouth widens. Defeated: the cloak sinks, the head rolls down, the glow dies, and a pile of pumpkins and leaves is left (2.6 s). The scene picks the wind-up from the song's `Tell <id>` part, so what is seen is what is heard.
- **Arena.** When the fight starts the scene shifts: a bigger moon, a ring of tall dead cornstalks, and the King on a raised mound at the right.

## Stage 1 art direction (Pumpkin Patch)

`apps/ghastly-moves/src/patch.ts`. One cold hue (blue-violet night), small warm lights (pumpkins, a church window, the lantern). Layers, far to near: sky and moon with shafts of light; far hill with church spire and dead tree; second ridge with far lit pumpkins; fence and leaning scarecrows; vines and pumpkins on the ground line (some lit, with halos); foreground silhouettes (vines, gate post, grass) at the screen edges only. Fog gradients between layers. Rim light on every silhouette. Static layers are painted once to offscreen canvases. Fireflies and seed fluff drift slowly; with reduced motion all of it stands still. A soft dark halo sits behind every obstacle so stones stay the clearest thing on screen.

## Later: bring-your-own tracks (not built)

A licensed audio track per stage would sit beside the synthesised one. Each track needs: a beat map (BPM, first-beat offset, the song's sections in bars) which the existing song proofs check against the level; pitch-preserving playback for the slower speeds (`HTMLMediaElement.preservesPitch`); the cues (beeps, tells, speech) always above it, with the same ducking; offline caching of the file; and a licence file stored next to each track naming its source and terms. Until a track is added, the synthesised one plays.

## Stages 5 to 7 redo: Haunted Mill, The Hollow, Midnight Manor

Same grammar as Stage 1: one cold hue per place, one small warm accent, rim light on every silhouette, fog between layers, static layers painted once to offscreen canvases, nothing flashing, everything still with reduced motion, obstacles kept the clearest thing on screen. Code only; style is borrowed from dark hand-drawn action games, no character, boss shape or tune is copied. Art in `src/places/{mill,hollow,manor}.ts` (dispatch in `places/stages-5-7.ts`), bosses in `src/bosses/{spider-miller,hollow-wraith,count-vexar}.ts`, tracks in `src/music/{mill,hollow,manor}.ts`. Tempo always comes from the stage's song.

### Stage 5: Haunted Mill and the Spider Miller

- **Place.** Cold hue: midnight navy-indigo. Warm accent: lamp gold (mill windows, a lantern on a post). Layers, far to near: (1) sky, low moon, two cloud wisps, moon shafts; (2) ridge with two windmills (still sails) and tall poplars; (3) hill with haystacks, a crooked footbridge, a cottage with a lit window and a big dewy orb web between two poles; (4) the mill: a tall weatherboard house, a great water wheel, a hoist beam with a hanging sack, lit windows with halos (in the boss arena: the inside of the mill, a huge cog wheel, timber posts, light through the planks, a giant web in the corner); (5) barrels, flour sacks, a millstone stack, web strands, a lantern post; (6) edge silhouettes: rafters and hanging web strands. Ground: flour-dusted plank dock. Light shapes: lit windows, moon shafts, lantern halo. Particles: flour dust.
- **Boss silhouette.** Wide and low: a fan of eight long jointed legs, a big round abdomen behind (a flour sack tied on it), a small head under a floppy miller's cap. The read at a glance is "spiky wide star with a round weight on the back", the opposite of the Warden's thin vertical.
- **Shape language.** Long thin diagonals and zigzag joints (legs, silk threads); round for the abdomen and the eye cluster, so the six eyes are the focus.
- **Palette.** Shadow violet-black `#0f0a1a`, mid dusty plum `#3a2a52`, light flour cream `#e4dcc8`; the one accent is lamp gold in the six eyes and the cap's buckle. Silver-lilac rim on the right.
- **Poses.** Idle: breathing, legs shift. Lob wind-up (rising tell): the two front legs rise over the head holding a web ball. Roll wind-up (rumble): crouch, one front leg swept far back low with a mill wheel. Swoop wind-up (falling whistle): rears, one leg flung high and out, a spiderling dangles on a thread. Throw: front legs snap forward. Hurt: recoil, eyes squeeze, a puff of flour. Laugh: abdomen shakes, fangs chatter. Defeated: legs curl in, the sack splits and a heap of flour, the legs folded over it.

### Stage 6: The Hollow and the Hollow Wraith

- **Place.** Cold hue: desaturated steel-cyan mist, the greyest place in the game. Warm accent: an amber glow from a door in the great tree. Layers: (1) sky with a blurred moon behind the canopy and wide shafts; (2) far thin dead trunks in heavy fog; (3) giant roots and bioluminescent mushrooms (small cyan lights); (4) the Hollow tree itself, a huge trunk with an amber doorway, hanging roots (arena: the doorway becomes a vast cavity behind the boss ringed by roots); (5) arching roots, ferns, pale fungi with halos; (6) hanging vines and fern edges. Ground: mossy root floor. Particles: spores rising slowly.
- **Boss silhouette.** Tall teardrop that narrows downward to a tail of smoke, with no feet (it floats), a crown of bare branches like antlers, long sleeves hanging past the knees. A tall S-curve against the Warden's straight bars and the Miller's wide star.
- **Shape language.** Long curves and ribbons, teardrops; the only hard lines are the antler branches.
- **Palette.** Shadow `#060d18`, mid slate blue `#17304a`, light ice `#b8d8ea`; the accent is the cold cyan of the two eye slits and the light it holds. Rim light in pale cyan.
- **Poses.** Idle: float and bob, ribbons stream. Lob (rising): both arms up, head back, an orb of cold light between the hands. Roll (rumble): sinks low, one arm sweeps low behind, a rotten knot in the hand. Swoop (falling whistle): leans back, one arm high, an icicle forms in the hand. Throw: arm snaps forward. Hurt: the body ripples (a shifted ghost copy), the eyes close, wisps fly off. Laugh: long thin smile, shoulders shake. Defeated: unravels upward into ribbons and wisps; the crown drops.

### Stage 7: Midnight Manor and Count Vexar

- **Place.** Cold hue: deep violet night. Warm accent: crimson-rose window light and candle gold. Layers: (1) sky with a huge pale moon, a far flock of bats, cloud streaks; (2) hill with the manor (three towers, gables, many small lit windows) and gnarled trees; (3) terraced garden: hedges, statues on plinths, a far balustrade, lantern posts; (4) the gates and a long balustrade with urns and tall arched crimson windows (arena: the ballroom, tall moonlit windows, drapes, a staircase, a chandelier); (5) dead rose bushes, urns, candelabra with candles, a bench; (6) velvet drapes at the left edge and a chandelier chain at the right. Ground: dark marble diamond tiles. Particles: rose petals and ash.
- **Boss silhouette.** An inverted triangle: a high-collared cape spread like bat wings over narrow legs and a long cane, slicked hair with a widow's peak. A V where the Pumpkin King is an A.
- **Shape language.** Sharp angles and diagonals (collar points, scalloped cape, the cane), round only for the red brooch and the eyes.
- **Palette.** Black `#0b0510`, wine `#3a0f26`, ivory `#e9e1ea`; the one accent is crimson (eyes, brooch, cape lining edge).
- **Poses.** Idle: cape breathing. Lob (rising): one hand raised with a blood orb over the palm, cape lifted. Roll (rumble): crouch, cane planted, arm sweeping a coffin along the floor. Swoop (falling whistle): cape unfurls into wings, one arm high, a bat leaves. Throw: arm snaps. Hurt: cape flaps, head snaps back. Laugh: head back, fangs, cape shakes. Defeated: he comes apart into bats that fly up; the empty cape falls with the cane.

### Music for 5 to 7

All synthesised with the Stage 1 engine; each over the spooky bed (drone, far choir, owl, creak), with stems that join with the streak, a muffle on a fall and a duck under speech (engine behaviour), and a heavier boss version with a phase change at half health.

- **5 Haunted Mill, electro swing.** G minor, i7 - iv7 - V7 - i7. Swung plucked bass (long swing 0.27), plucky offbeat stabs, claps on 2 and 4, kick on every beat, offbeat hats, keys on a clarinet-like tune.
- **6 The Hollow, trip-hop.** F minor, i7 - VImaj7 - iv7 - bII. Half-time heavy beat (kick on 1 and late on 3, snare on 3), deep sine sub holding whole bars, a sparse electric-piano pluck, airy pad and choir, a wide slow room.
- **7 Midnight Manor, gothic waltz.** B-flat harmonic minor. Waltz feel inside the 4/4 bars: the bass, pluck, timpani and shaker are laid out in groups of three slots (oom-pah-pah) over a six-bar cycle, so 16 waltz measures fit exactly; presses stay on the even slots, which the music never moves. Choir pads, harpsichord-like pluck, timpani-like kick.

## Stages 2 to 4 redo: Crypt Steps, Whispering Woods, The Old Gate

Style only from dark hand-drawn action games (cold area hue, silhouette first, rim light); no character, boss shape or tune is copied. All art is canvas code (`src/places/`, `src/bosses/`), all music is synthesised (`src/music/`). Each place has the same grammar as Stage 1: sky, far, hills, mid, near and foreground layers, fog between them, rim light on every silhouette, static layers cached, still with reduced motion, a soft dark halo behind every stone, and nothing that flashes (halos breathe under 0.2 Hz).

### Stage 2: Crypt Steps and the Bone Warden
- **Place.** Cold hue: slate teal. Warm accent: candle amber. Layers: sky with a low moon, cloud wisps and shafts; ridge with a mausoleum (lit door) and cypresses; crosses, headstones and a weeping angel with far candles; a ruined arcade of pointed arches with candle sconces; slabs, skull heaps, an iron fence and candle stubs; foreground pillars, chains and a cobweb. Flagstone path. Particles: dust. Arena: one great arch with a warm glow behind the Warden, heavy pillars, a bigger moon.
- **Boss.** Silhouette: tall, narrow, stooped; a peaked hood, a long skull, a cage of ribs, a shroud to the floor. Shape language: straight lines and long rectangles (ribs, fingers, keys). Palette: near-black shroud, bone grey, pale bone; one accent, the amber lantern burning inside the rib cage (and a pinprick in each eye). Poses: idle (sway, breathing lantern, ring of keys swaying); lob wind-up (both arms up, a bone raised, head back); roll wind-up (deep crouch, a skull held low, swung back); throw; hurt (ribs jolt, a rib falls, eyes shut, jaw drops, cracks grow); laugh (the jaw clatters at about 2 Hz); defeated (the shroud sinks, the skull rolls off, the lantern dies, a heap of bones).
- **Music.** Swing jazz in A minor, 110 Hz, changes Am7 - Dm7 - E7 - Fmaj7. Walking bass (plucked), muted comp on the "and" of two, soft keys on a lazy line, brushed snare, feathered kick, a ride pattern on the hat, swing 0.28. Stems: bed, kick and brushes; bass and chords at streak 2; comp at 4; tune at 6. Boss: G minor at 98 Hz, walking bass in eighths, kick on every beat, backbeat; phase 2 lifts three semitones and busies the ride and brushes.

### Stage 3: Whispering Woods and the Moss Witch
- **Place.** Cold hue: deep green-teal. Warm accent: firefly gold (also a hut window and glowing mushroom caps). Layers: sky with a moon behind thin cloud and wide god-rays; a pale pine ridge; darker pines with a crooked hut; huge gnarled trunks with knot-faces, hanging moss and arching branches; ferns, mushrooms (some lit) and a fallen log; foreground trunks and hanging branches. Leaf-and-moss path with roots. Particles: fireflies, pollen, three falling leaves. Arena: a ring of old trees, a half-ring of toadstools round the Witch, a bigger moon.
- **Boss.** Silhouette: low and wide with a hunched mound of moss and a huge hat bent over to one side, tip drooping; a tall crooked staff with an orb beside her. Shape language: curves, scallops, droops, spirals. Palette: near-black green, two mossy mids, lichen; one accent, acid green (eyes, the staff's orb, the hex in her hand). Poses: idle (breathing, swaying hair); lob wind-up (front hand raised, a six-point hex of sparks, hat tipped back); roll wind-up (crouch, a ball of moss scooped low); throw; hurt (hat knocked askew, eyes shut, moss flies off); laugh (a wide cackle, shaking at about 2 Hz); defeated (sinks into a mound, the hat tumbles off, the glow dies, toadstools sprout).
- **Music.** Lo-fi in B-flat dorian, 117 Hz, changes Bbm9 - Eb7 - Gbmaj7 - Ab. Soft sine bass on root and fifth, a warm pad on the chords, soft keys with many rests, a music-box pluck, a boom-bap kick, brushed snare, shaker as vinyl dust, swing 0.2, a long hazy room. Stems as above. Boss: G at 98 Hz, pulsing sub in eighths, kick on every beat, fuller shaker; phase 2 lifts three semitones.

### Stage 4: The Old Gate and the Gatekeeper
- **Place.** Cold hue: bruised violet-grey iron. Warm accent: torch and furnace orange. Layers: sky with moon, thin cloud, shafts; jagged mountains with a distant keep; a curtain wall with towers, torches and tattered banners; a tall iron fence, a gatehouse and two braziers; barrels, a broken wheel, chains, stakes and torch stands; foreground gate piers with spiked finials and chains. Cobbles. Particles: embers rising, ash. Arena: the great gate close behind him, a portcullis half raised, a furnace glowing through it.
- **Boss.** Silhouette: wide and square, a gate that walks: a flat-topped great helm on huge spiked pauldrons, a portcullis chest, a tower shield at his side. Shape language: rectangles, bars, rivets and spikes. Palette: near-black iron, blue-violet steel, pale steel; one accent, furnace orange (the cross-shaped visor slit, the fire seen through the chest bars). Poses: idle; lob wind-up (a spiked mace raised over the helm); roll wind-up (a deep crouch, an iron ball on a chain swung back); swoop wind-up (a bolt held high and out); throw; hurt (plates rattle, sparks, visor narrows, dents); laugh (the helm tips back, the chest heaves); defeated (the helm falls off, the plates fall in a heap, the fire dies).
- **Music.** A dark march in G harmonic minor, 98 Hz, changes Gm - Eb - Cm - D. A low saw pad as brass, a sine sub marching in quarters, timpani-like kick on one and three, snare rolls, a rim tick on the hat, a harp pluck, a stiff fanfare in keys, no swing. Boss: F-sharp at 92 Hz, sub in eighths, timpani on every beat, full snare roll; phase 2 lifts two semitones.
