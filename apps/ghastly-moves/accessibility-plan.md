# Accessibility plan: Ghastly Moves

Genre: rhythm. Theme: haunted. 19 accepted, 4 rejected, 2 to decide.

Mark each item `[x]` to accept, `[-]` to reject, or leave `[ ]` to decide later. Add a note after "Note:" on the line under an item. Then ask Kiro (the accessibility designer) to talk it through, or run `npm run advise -- build` to build what you accepted.

## Controls

- [x] `one-switch` Every action, menus included, can be done with one switch
  - Why: Some players use a single button, a head switch or a sip-and-puff switch. If one press can do everything, they can play the whole game.
  - Helps: one-switch players, and anyone playing with one hand.
  - How: Built into Marrow. Any key, click, tap or gamepad button is the switch, and menus are scanned (createGame, createMenuStack).
  - Guideline: Game Accessibility Guidelines (motor): make the game playable with a single button; Xbox Accessibility Guidelines: Input.
  - ESA tag: Playable with Buttons Only, Playable with Keyboard Only, Playable with Mouse Only, Playable with Touch Only.
  - Note: 
- [x] `no-holds` Nothing needs holding, two buttons at once, or fast repeated presses
  - Why: Holding and mashing are hard or painful for many players, and they shut out switch users entirely.
  - Helps: players who tire quickly, and one-switch players.
  - How: Built into Marrow. Proof property 10 checks it: one tap is one press, and key repeat adds none.
  - Guideline: Game Accessibility Guidelines (motor): avoid repeated inputs and holds; Xbox Accessibility Guidelines: Input.
  - ESA tag: Playable without Button Holds, Playable without Rapid Button Presses.
  - Note: 
- [x] `timing-help` Timing help: a press anywhere in the countdown counts
  - Why: Pressing on an exact beat is hard when your hands are slow to answer. Timing help keeps the choice yours and takes the stopwatch away.
  - Helps: players who need more time to press.
  - How: Marrow builds it from this plan. Timing help is offered in the menu, and turned on for new players if you choose.
  - Guideline: Game Accessibility Guidelines (motor): include an option to adjust the game speed or timing.
  - ESA tag: Difficulty Levels.
  - Note: 

## Sound

- [-] `themed-cues` Countdown cues as a low church bell and a thin glass chime
  - Why: A cue you can hear coming lets players time a move by ear. Making the cues part of the world keeps the mood instead of breaking it.
  - Helps: players who play by sound, and everyone in a busy moment.
  - How: Marrow builds it from this plan. The two cue voices come from the haunted palette. They differ in pitch and timbre and stay above the music (palette proof).
  - Guideline: Xbox Accessibility Guidelines: Audio accessibility; Game Accessibility Guidelines (vision): use distinct sound for each important thing.
  - ESA tag: none (no ESA tag covers this yet).
  - Note: Kept our own: the stone hum and a track per stage were tuned for the songs.
- [-] `themed-world` World sounds that fit: a creaking board for steps, a music-box ting for a reward, a hollow thud for a fall
  - Why: Every action should be heard, and heard as part of the game. Random beeps tire the ear; sounds from the world tell a story.
  - Helps: players who play by sound, and anyone who likes a game that sounds alive.
  - How: Marrow builds it from this plan. The jump, landing and fall sounds come from the haunted palette. Old wood, bells and wind: a house that is not quite empty.
  - Guideline: Game Accessibility Guidelines (vision): ensure all key actions have a sound.
  - ESA tag: none (no ESA tag covers this yet).
  - Note: Kept our own jump, landing and fall sounds.
- [-] `placed-sound` Sounds come from where things are, quieter when far away
  - Why: Direction and distance by ear let a player find the way, and the danger, without seeing.
  - Helps: players who play by sound.
  - How: Built into Marrow. Events with spatial: true are placed in 3D on headphones and panned in mono-safe stereo; nearest() keeps only the closest few.
  - Guideline: Xbox Accessibility Guidelines: Audio accessibility (spatial audio).
  - ESA tag: Stereo Sound, Surround Sound.
  - Note: The map is a story map, not a place to explore: nothing needs placing.
- [x] `music-steps-aside` Music steps aside for every cue, and never shares its pitch
  - Why: Music sets the mood, but a cue lost under it is a cue missed.
  - Helps: players who play by sound, and players who hear less in some pitches.
  - How: Built into Marrow. Tracks duck under cues and stay below them (proofs 13 and 14); the music volume is a setting.
  - Guideline: Game Accessibility Guidelines (hearing): separate volume for music, speech and effects.
  - ESA tag: Multiple Volume Controls.
  - Note: 
- [x] `mono` A mono setting
  - Why: Players who hear with one ear, or with one earbud, miss half of a stereo mix.
  - Helps: players who hear with one ear.
  - How: Built into Marrow. Sound: Mono, in the settings menu.
  - Guideline: Game Accessibility Guidelines (hearing): provide a stereo/mono toggle.
  - ESA tag: Mono Sound.
  - Note: 

## Speech and text

- [x] `speech` Everything said is also written, for screen readers, and the voice can be turned off
  - Why: Screen-reader and braille users get every line; players who use their own reader avoid hearing it twice.
  - Helps: players who play by sound, and screen-reader and braille users.
  - How: Built into Marrow. Every spoken line goes to an aria-live region; Voice is a setting.
  - Guideline: Xbox Accessibility Guidelines: Screen narration; Game Accessibility Guidelines (vision): screen reader support.
  - ESA tag: Narrated Menus.
  - Note: 
- [x] `captions` Captions for every sound, with countdown pips you can see
  - Why: If a sound tells you something, a caption must tell you the same thing.
  - Helps: players who play by sight, and anyone playing with the sound off.
  - How: Built into Marrow. Every event reaches at least two senses (proof 8); captions wrap rather than shrink.
  - Guideline: Xbox Accessibility Guidelines: Subtitles and captions; Game Accessibility Guidelines (hearing): subtitles for all important sounds.
  - ESA tag: Large & Clear Subtitles.
  - Note: 

## Sight

- [x] `sound-marker` A marker you can see for every sound
  - Why: A player who plays by sight still needs to know a sound happened, and roughly when.
  - Helps: players who play by sight.
  - How: Built into Marrow. The sound marker in the caption box lights for every cue; it holds steady with reduced motion.
  - Guideline: Xbox Accessibility Guidelines: Additional channels for visual and audio cues.
  - ESA tag: none (no ESA tag covers this yet).
  - Note: 
- [x] `contrast-text` High contrast, large text, and colours every eye can tell apart, never colour alone
  - Why: Low contrast and small text lock out many players; meaning carried by colour alone locks out more.
  - Helps: players who see less, and players who see colour differently.
  - How: Built into Marrow. Contrast, Text size and Colours are settings, and proof 9 checks every theme.
  - Guideline: WCAG 2.2 AA contrast; Xbox Accessibility Guidelines: Text display, Contrast.
  - ESA tag: Clear Text, Large Text, Color Alternatives.
  - Note: 
- [x] `motion-flash` Reduced motion, and nothing flashes more than three times a second
  - Why: Motion can make players sick, and flashing can cause seizures.
  - Helps: players sensitive to motion or light.
  - How: Built into Marrow. Motion is a setting (it follows the OS); proof 7 checks flashing at every speed.
  - Guideline: WCAG 2.3.1 three flashes; Game Accessibility Guidelines (general): avoid flickering images.
  - ESA tag: Camera Comfort.
  - Note: 
- [x] `play-by-sound` The whole game can be played with the picture off
  - Why: If it can be finished by sound alone, players who cannot see can finish it, and sighted testers can check it.
  - Helps: players who play by sound.
  - How: Built into Marrow. Picture: Off, in the settings; the audio-only bot checks levels can be cleared by sound.
  - Guideline: Game Accessibility Guidelines (vision): ensure the game is playable without sight.
  - ESA tag: Narrated Menus.
  - Note: 

## Difficulty and failure

- [x] `gentle-failure` Gentle failure: say why, then try again just before
  - Why: Losing progress is the fastest way to lose a player. Knowing why turns a mistake into learning.
  - Helps: everyone, and players who need more tries.
  - How: Built into Marrow. Falls say why ("Pressed a little early"), wait until it is heard, and retry just before the obstacle. No lives, no game over.
  - Guideline: Game Accessibility Guidelines (cognitive): avoid punishing mistakes; give clear feedback.
  - ESA tag: none (no ESA tag covers this yet).
  - Note: 
- [x] `speed` A game speed setting, starting slow
  - Why: Speed changes how hard it is without changing what it is.
  - Helps: players who need more time.
  - How: Built into Marrow. Game speed is a setting; Slow is the default, and the proof checks the timing window at every speed.
  - Guideline: Game Accessibility Guidelines (motor, cognitive): allow the game speed to be changed.
  - ESA tag: Difficulty Levels.
  - Note: 
- [x] `coach` A coach who says what is coming before each countdown
  - Why: A heads-up gives time to think and get ready, without changing the cues.
  - Helps: players who need more warning, and players new to the game.
  - How: Marrow builds it from this plan. The coach is offered in the settings (1 to 3 seconds early); proof 17 checks it never talks over a jump.
  - Guideline: Game Accessibility Guidelines (cognitive): give advance warning of events.
  - ESA tag: none (no ESA tag covers this yet).
  - Note: 
- [x] `finishable` Every level is proved finishable before it is served
  - Why: A level that cannot be finished with one switch, or by sound, excludes someone without anyone noticing.
  - Helps: everyone.
  - How: Built into Marrow. The proof runs before every level, and a failing level is refused with the reason. Bot players report how it plays.
  - Guideline: Marrow proof properties; Game Accessibility Guidelines (general): test with the players you want to include.
  - ESA tag: Playable with Buttons Only.
  - Note: 

## Menus and setup

- [x] `setup` A first-run setup that asks how you like to play
  - Why: Good settings help only if players find them. Asking once, at the start, in ways of playing, gets them on.
  - Helps: everyone, first of all new players.
  - How: Built into Marrow. Just play, Play by sound, Play by sight, More time, More settings: the first time only.
  - Guideline: Game Accessibility Guidelines (general): offer settings before the game starts.
  - ESA tag: Narrated Menus.
  - Note: 
- [ ] `sound-guide` A sound guide: every important sound, and what it means, before play
  - Why: Players who play by ear learn the sounds faster when they can hear each one on its own, named.
  - Helps: players who play by sound.
  - How: Your code. A scanned menu where each entry names a sound and plays it (Séance Escape’s guide.ts is an example).
  - Guideline: Game Accessibility Guidelines (vision): provide a sound test or glossary.
  - ESA tag: Narrated Menus.
  - Note: 

## Story and dialogue

- [x] `speaker-names` Captions with speaker names, and a voice for each character
  - Why: In speech and text, who is talking is half the meaning.
  - Helps: players who play by sight, and players who play by sound.
  - How: Built into Marrow. Put the name in the caption, and give the character a voice with voice: { pitch, rate } on the event (as Mabel has).
  - Guideline: Xbox Accessibility Guidelines: Subtitles and captions (speaker identification).
  - ESA tag: Large & Clear Subtitles.
  - Note: Done: each boss says its own name in its lines.
- [ ] `replay-lines` Lines can be heard again, and story waits for the player
  - Why: A missed line is a missed clue. Text that moves on by itself leaves slow readers behind.
  - Helps: players who read or listen slowly.
  - How: Your code. Keep a log of recent lines the player can scan, and advance story only on a press.
  - Guideline: Game Accessibility Guidelines (cognitive): allow text and speech to be replayed; no timed text.
  - ESA tag: none (no ESA tag covers this yet).
  - Note: 

## Your game's own features

- [x] `boss-warning` Every boss attack warned with a rising moan and a caption, before it lands
  - Why: Boss fights are the peak of a game. A warning by sound and sight lets every player read the fight.
  - Helps: players who play by sound, by sight, or need more warning.
  - How: Your code. Emit an event before each attack with the palette's danger sound (a rising moan), a caption and a buzz; keep it a clear beat before the countdown, as Ghastly Moves' boss throw does.
  - Guideline: Xbox Accessibility Guidelines: Additional channels for visual and audio cues.
  - ESA tag: none (no ESA tag covers this yet).
  - Note: Done: the boss throw whooshes 0.3 s before the first beep, with a caption and a buzz.
- [-] `pickups` Pickups heard where they are, as a music-box ting, nearest few only
  - Why: Collectibles reward exploring. Placing them by sound lets players who cannot see go looking too.
  - Helps: players who play by sound.
  - How: Built into Marrow. A spatial event per pickup with the reward sound; nearest(items, 3, distance) keeps it clear.
  - Guideline: Xbox Accessibility Guidelines: Audio accessibility.
  - ESA tag: Stereo Sound.
  - Note: Items are won from bosses, not picked up.
- [x] `lessons` Wrong answers are explained, in plain words, before the next question
  - Why: An explanation turns a mistake into learning; waiting for it means nobody misses it.
  - Helps: learners, and players who think at their own pace.
  - How: Built into Marrow. A lesson in the kit (explainWrong, explainMiss); the run waits until the explanation is said.
  - Guideline: Game Accessibility Guidelines (cognitive): explain mistakes.
  - ESA tag: none (no ESA tag covers this yet).
  - Note: 

---

This plan helps the game work for more players. It does not make the game "fully accessible", and it does not replace testing with disabled players.
