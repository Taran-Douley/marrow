# Accessibility plan: Hello, Marrow

Genre: runner. Theme: haunted. 17 accepted, 0 rejected, 0 to decide.

Mark each item `[x]` to accept, `[-]` to reject, or leave `[ ]` to decide later. Add a note after "Note:" on the line under an item. Then ask Kiro (the accessibility designer) to talk it through, or run `npm run advise -- build` to build what you accepted.

## Controls

- [x] `one-switch` Every action, menus included, can be done with one switch
  - Why: Some players use a single button, a head switch or a sip-and-puff switch. If one press can do everything, they can play the whole game.
  - Helps: one-switch players, and anyone playing with one hand.
  - How: Built into Marrow. Any key, click, tap or gamepad button is the switch, and menus are scanned (createGame, createMenuStack).
  - Guideline: Game Accessibility Guidelines (motor): make the game playable with a single button; Xbox Accessibility Guidelines: Input.
  - Note: 
- [x] `no-holds` Nothing needs holding, two buttons at once, or fast repeated presses
  - Why: Holding and mashing are hard or painful for many players, and they shut out switch users entirely.
  - Helps: players who tire quickly, and one-switch players.
  - How: Built into Marrow. Proof property 10 checks it: one tap is one press, and key repeat adds none.
  - Guideline: Game Accessibility Guidelines (motor): avoid repeated inputs and holds; Xbox Accessibility Guidelines: Input.
  - Note: 
- [x] `timing-help` Timing help: a press anywhere in the countdown counts
  - Why: Pressing on an exact beat is hard when your hands are slow to answer. Timing help keeps the choice yours and takes the stopwatch away.
  - Helps: players who need more time to press.
  - How: Marrow builds it from this plan. Timing help is offered in the menu, and turned on for new players if you choose.
  - Guideline: Game Accessibility Guidelines (motor): include an option to adjust the game speed or timing.
  - Note: 

## Sound

- [x] `themed-cues` Countdown cues as a low church bell and a thin glass chime
  - Why: A cue you can hear coming lets players time a move by ear. Making the cues part of the world keeps the mood instead of breaking it.
  - Helps: players who play by sound, and everyone in a busy moment.
  - How: Marrow builds it from this plan. The two cue voices come from the haunted palette. They differ in pitch and timbre and stay above the music (palette proof).
  - Guideline: Xbox Accessibility Guidelines: Audio accessibility; Game Accessibility Guidelines (vision): use distinct sound for each important thing.
  - Note: 
- [x] `themed-world` World sounds that fit: a creaking board for steps, a music-box ting for a reward, a hollow thud for a fall
  - Why: Every action should be heard, and heard as part of the game. Random beeps tire the ear; sounds from the world tell a story.
  - Helps: players who play by sound, and anyone who likes a game that sounds alive.
  - How: Marrow builds it from this plan. The jump, landing and fall sounds come from the haunted palette. Old wood, bells and wind: a house that is not quite empty.
  - Guideline: Game Accessibility Guidelines (vision): ensure all key actions have a sound.
  - Note: 
- [x] `mono` A mono setting
  - Why: Players who hear with one ear, or with one earbud, miss half of a stereo mix.
  - Helps: players who hear with one ear.
  - How: Built into Marrow. Sound: Mono, in the settings menu.
  - Guideline: Game Accessibility Guidelines (hearing): provide a stereo/mono toggle.
  - Note: 

## Speech and text

- [x] `speech` Everything said is also written, for screen readers, and the voice can be turned off
  - Why: Screen-reader and braille users get every line; players who use their own reader avoid hearing it twice.
  - Helps: players who play by sound, and screen-reader and braille users.
  - How: Built into Marrow. Every spoken line goes to an aria-live region; Voice is a setting.
  - Guideline: Xbox Accessibility Guidelines: Screen narration; Game Accessibility Guidelines (vision): screen reader support.
  - Note: 
- [x] `captions` Captions for every sound, with countdown pips you can see
  - Why: If a sound tells you something, a caption must tell you the same thing.
  - Helps: players who play by sight, and anyone playing with the sound off.
  - How: Built into Marrow. Every event reaches at least two senses (proof 8); captions wrap rather than shrink.
  - Guideline: Xbox Accessibility Guidelines: Subtitles and captions; Game Accessibility Guidelines (hearing): subtitles for all important sounds.
  - Note: 

## Sight

- [x] `sound-marker` A marker you can see for every sound
  - Why: A player who plays by sight still needs to know a sound happened, and roughly when.
  - Helps: players who play by sight.
  - How: Built into Marrow. The sound marker in the caption box lights for every cue; it holds steady with reduced motion.
  - Guideline: Xbox Accessibility Guidelines: Additional channels for visual and audio cues.
  - Note: 
- [x] `contrast-text` High contrast, large text, and colours every eye can tell apart, never colour alone
  - Why: Low contrast and small text lock out many players; meaning carried by colour alone locks out more.
  - Helps: players who see less, and players who see colour differently.
  - How: Built into Marrow. Contrast, Text size and Colours are settings, and proof 9 checks every theme.
  - Guideline: WCAG 2.2 AA contrast; Xbox Accessibility Guidelines: Text display, Contrast.
  - Note: 
- [x] `motion-flash` Reduced motion, and nothing flashes more than three times a second
  - Why: Motion can make players sick, and flashing can cause seizures.
  - Helps: players sensitive to motion or light.
  - How: Built into Marrow. Motion is a setting (it follows the OS); proof 7 checks flashing at every speed.
  - Guideline: WCAG 2.3.1 three flashes; Game Accessibility Guidelines (general): avoid flickering images.
  - Note: 
- [x] `play-by-sound` The whole game can be played with the picture off
  - Why: If it can be finished by sound alone, players who cannot see can finish it, and sighted testers can check it.
  - Helps: players who play by sound.
  - How: Built into Marrow. Picture: Off, in the settings; the audio-only bot checks levels can be cleared by sound.
  - Guideline: Game Accessibility Guidelines (vision): ensure the game is playable without sight.
  - Note: 

## Difficulty and failure

- [x] `gentle-failure` Gentle failure: say why, then try again just before
  - Why: Losing progress is the fastest way to lose a player. Knowing why turns a mistake into learning.
  - Helps: everyone, and players who need more tries.
  - How: Built into Marrow. Falls say why ("Pressed a little early"), wait until it is heard, and retry just before the obstacle. No lives, no game over.
  - Guideline: Game Accessibility Guidelines (cognitive): avoid punishing mistakes; give clear feedback.
  - Note: 
- [x] `speed` A game speed setting, starting slow
  - Why: Speed changes how hard it is without changing what it is.
  - Helps: players who need more time.
  - How: Built into Marrow. Game speed is a setting; Slow is the default, and the proof checks the timing window at every speed.
  - Guideline: Game Accessibility Guidelines (motor, cognitive): allow the game speed to be changed.
  - Note: 
- [x] `coach` A coach who says what is coming before each countdown
  - Why: A heads-up gives time to think and get ready, without changing the cues.
  - Helps: players who need more warning, and players new to the game.
  - How: Marrow builds it from this plan. The coach is offered in the settings (1 to 3 seconds early); proof 17 checks it never talks over a jump.
  - Guideline: Game Accessibility Guidelines (cognitive): give advance warning of events.
  - Note: 
- [x] `finishable` Every level is proved finishable before it is served
  - Why: A level that cannot be finished with one switch, or by sound, excludes someone without anyone noticing.
  - Helps: everyone.
  - How: Built into Marrow. The proof runs before every level, and a failing level is refused with the reason. Bot players report how it plays.
  - Guideline: Marrow proof properties; Game Accessibility Guidelines (general): test with the players you want to include.
  - Note: 

## Menus and setup

- [x] `setup` A first-run setup that asks how you like to play
  - Why: Good settings help only if players find them. Asking once, at the start, in ways of playing, gets them on.
  - Helps: everyone, first of all new players.
  - How: Built into Marrow. Just play, Play by sound, Play by sight, More time, More settings: the first time only.
  - Guideline: Game Accessibility Guidelines (general): offer settings before the game starts.
  - Note: 

---

This plan helps the game work for more players. It does not make the game "fully accessible", and it does not replace testing with disabled players.
