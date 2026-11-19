# Marrow — build order and open gates

Working reference for the Kiroween 2026 build. Agreed 2026-11-05. The two games
(Lantern Run, Crossroads) and all product names are **working names only** —
the skeleton is the hero and the apps exist to prove it adapts across
entertainment and learning. Details of each game can be decided later.

Deadline anchors (updated 2026-11-18): feature freeze **Mon 30 Nov** (moved from
21 Nov), credits by 1 Dec, video day 2 Dec (protected), submit 3 Dec, hard
deadline Fri 4 Dec 2pm PT / 10pm UK. Only 2 days sit between freeze and video
day: after 30 Nov, fix bugs and record only. No new features.

---

## Build order

Build everything (two apps + MCP + Crew app + Kiro power), but in an order that
always leaves a working, demo-able thing. Each step is shippable on its own.

1. **Skeleton core + first arcade app (Lantern Run) → playable prototype.**
   Unblocks the disabled-player test gate. This is the first real goal: a
   working prototype to put in front of a player.
2. **The proof + broken-obstacle demo.** The six properties and the
   plain-English counterexample. This is the differentiator; nothing else
   replaces it.
3. **MCP level-forge server** — `generate_level`, `prove_level`,
   `simulate_persona`.
4. **Second app (Crossroads, learning) — a different one-switch interaction**
   (scanning choice vs timed press). Proves the skeleton adapts.
5. **Crew app repo + Kiro power.** Packaging work, done last. Separate public
   repo under the same GitHub account for the Best Kiro Crew App bonus.

**Cut order if time runs short** (updated 2026-11-05): separate Crew app
(overnight Level Forge, a bonus repo) → Crossroads extras → persona-agent
polish. **Never cut:** the proof, the eyes-closed demo, the video, **the Kiro
power, or the power benchmark** — the power is now the delivery mechanism and
the benchmark depends on it, so it is no longer cuttable.

(Supersedes the original ideation cut order "Crew app → power → persona-agent
polish → Crossroads extras", which listed the power as cuttable. The power and
benchmark have moved into the uncuttable core; the separate Crew app — distinct
from the power — is now first to go.)

---

## Open gates (must clear before/while writing specs)

- [ ] **Player test.** Build a working prototype, then book 1–2 disabled
  players (SpecialEffect, AbleGamers, RNIB, audiogames.net) and run the test
  protocol. Pass = they finish level 1 unaided and can tell the obstacles
  apart. This is the lock-idea gate. (Not done yet — needs the prototype first.)
- [x] **Kiro powers marketplace check.** Checked 2026-11-05: the official
  registry (kirodotdev/powers → kiro.dev/powers) is all enterprise/infra (AWS,
  Datadog, Neon, Stripe, Terraform, Zapier, etc.). No game power, no
  accessibility power. Open runway for a Marrow power. Re-check near 30 Nov.
- [ ] **Discord #kiroween-hackathon sweep.** Still pending — needs a logged-in
  Discord session (cannot be done via web search).
- [x] **Competitor sweep (web, 2026-11-05).** Accessible entries found are all
  single games (Accessible Battleship, Echoes of Light, Six Blind Sumo), not
  reusable skeletons with a finishability proof. Closest template is The Prism
  Room (general web kernel with accessibility steering, no one-switch proof).
  Core claim holds: no web game skeleton that proves finishability per input
  profile was found. Most submissions are not public this early — re-run near
  21 Nov.
- [ ] **Devpost + repo.** Register on Devpost, request 4,000 credits (by
  1 Dec), create the public GitHub repo with `/.kiro` at root (never
  gitignored), MIT licence visible in About.
- [ ] **Startup prize route.** Not tied to Shroud Labs or Enjoy CIC yet;
  Enjoy CIC fits better (education). Submission paperwork, not code — decide
  deliberately.
- [ ] **Kiroween 2025 registration check** (for the Ghost of Kiroween Past
  $2k bonus).

---

## Decided design points

- **Audio-only persona** receives the full cue stream — the three countdown
  beeps *and* their timing — and presses from the fourth beat, exactly as a
  real audio player does. It is not limited to "an obstacle exists." This makes
  it test the hardest real path.
- The skeleton's goal: a game dev drops it in and gets support for most/all
  accessibility problems, opt-out not opt-in, at near-zero extra effort.

---

## Architecture decision (2026-11-05): channels + events + one profile

Games declare **semantic events** (e.g. `obstacle-approaching`, `hurt`,
`level-complete`). The skeleton renders each event through every **enabled
channel** (sound, speech, captions, visual sound indicator, haptics), shaped by
**one player profile** (timing, dwell, contrast theme, text/UI scale,
colour-blind palette, motion, cue/speech/music volumes, mono audio). Games never
target a channel directly.

Proof now has **eleven** properties: the six finishability/cue properties plus
five safety properties — no unsafe flashing (≤ 3/s), two-sense rule, WCAG 2.2 AA
contrast per theme, no forced hold/chord (hold-to-confirm opt-in only), and
strings-table coverage. All are property-based tested and refuse-to-serve.

New module: **a11y-report** generates the game's accessibility feature list from
guaranteed channels + passing properties, mapped to the 24 ESA Accessible Games
Initiative tags.

Tiering: build now = events/channels/profile, all five new proof properties,
a11y-report. Later task = strings table, dwell-click, hold-to-confirm input.
Roadmap only = full input remapping, reading-level variants.

Steering updated to match: tech.md (channels architecture, proof properties
7–11, ESA mapping, module list, profile) and accessibility.md (hold-to-confirm
opt-in only, channels output model, contrast-per-theme).

---

## Decision (2026-11-05): Marrow ships as a Kiro power

Marrow is packaged as a **Kiro power** (Agent Plugins v1.0 format) bundling the
accessibility steering, the level-forge MCP server, the proof + store-list
hooks, and the runtime skeleton. Purpose: when a developer asks Kiro to build a
game, Kiro builds it **on Marrow** so it is accessible and proven by default,
with no accessibility request from the developer. Both demo apps (lantern-run,
crossroads) are built **through the installed power**, not by reaching into
`skeleton/` internals — the submission shows the power working end to end.

New benchmark: three fixed game prompts, built **without** the power vs **with**
it, recording how many of the eleven proof properties pass in each. This is the
headline number for the write-up and video. Report the "without" column
honestly. Added to marrow-core spec as Req 15 (power) and Req 16 (benchmark),
and to product.md (ships-as-a-power section, hard numbers, success criteria).

Note: this moves the Kiro power from "packaging, done last" (step 5 of the
build order) to a core part of the product thesis. The build order still holds
for *when* to build it, but it is no longer optional/cuttable — it is the
delivery mechanism and the benchmark depends on it.

---

## Open strategic question: developer demand (2026-11-05, REVISIT after dev interviews)

**Concern:** will Kiro judges be dubious about the demand for accessibility
features in game dev? Status: OPEN. Do not act on the four moves below until
Taran has spoken to ~3 devs (see the validation test). This is a prediction
about how people react, so test it rather than guess.

### Four moves to close the gap

1. **Widen the promise: "proven playable", accessibility as its sharpest edge.**
   Every developer generating levels — especially with AI — fears producing a
   level that can't be beaten. Marrow's proof answers that for all players:
   every level finishable, nothing flashing dangerously, every event readable.
   Then it goes further than anyone, proving the same for one-switch players and
   players who can't see. This turns "accessibility tool" into **"the
   playtesting guarantee for AI-built games"** — something every Kiro user
   making a game wants — with accessibility as the differentiator, not the whole
   pitch.

2. **Show developer demand, not just player need.** Developers already must
   declare accessibility: Steam's accessibility questionnaire was filled in for
   more than 22,000 apps by January 2026. Accessibility affects sales — 46% of
   disabled gamers bought a game because of its accessibility features, 65%
   avoided one lacking them. The store-list generator does a job developers
   already face.

3. **Give judges the hands-on moment.** "Close your eyes and play" is the
   wave-at-the-webcam. Every judge can try it; almost none will have played a
   game that way. The InteractionKit effect, not a charity appeal.

4. **Put a real person in the video.** A blind or switch-using player finishing
   a level and saying one sentence about it will do more for Impact than any
   statistic. Faxi won with real seniors; this is the same move.

### How to settle it with evidence (do this week)

Ask three Kiro users or game developers (Kiro Discord, r/gamedev):

> "Would you install a Kiro power that proves every level of your AI-built game
> can be finished, including by one-switch and blind players, and writes your
> store accessibility list?"

- If they light up at **"proves every level can be finished"** → the broader
  "proven playable" framing is right; lead with it.
- If they respond **only to accessibility** → the pitch is narrower; keep
  accessibility central.

Either answer beats guessing. Record which way it went here when known, then
decide whether to re-frame product.md's opening around "proven playable".

### Sharpened framing (2026-11-05, OPEN — do not apply to product.md until dev interviews are done)

Kiro's assessment of the four-moves framing: strong, "proven playable" is the
right pivot, keep it. Five sharpenings before it goes live:

1. **Price the scope limit before a judge finds it.** A "playtesting guarantee
   for AI-built games" invites: *then why one tiny timing game?* Turn the limit
   into a principle: "We prove the two interaction patterns a single switch
   allows — timed press and scanning choice — because those are the patterns
   that make a game playable by everyone. Add a pattern, add a proof." Scope
   becomes deliberate design, not a limitation.

2. **Lead with "refuses", not "proves".** Every AI tool will claim it tests your
   game. What only Marrow has is a machine-checkable *refusal to ship a level
   that fails*. The winning verb is "refuses": the game literally won't serve a
   level a player can't beat. That is the crypt-turns-red demo that makes a
   judge sit up.

3. **Reorder move 2's evidence.** The Steam 22,000-questionnaire stat only
   proves devs *fill in* a11y info (could read as box-ticking). Lead instead
   with the sales + cost pair — 65% avoided a game lacking a11y, 46% bought for
   it, and a11y costs ~5–10% up front vs far more to retrofit — then use Steam
   as "and platforms now require you to declare it." Pain and money first,
   compliance second.

4. **Fix the validation question (it is leading + tests three things at once).**
   "Would you install a power that proves every level is finishable, including
   one-switch and blind players, and writes your store list?" stacks three
   features into one easy yes, and "would you install" invites politeness. Split
   it: ask the playability question and the accessibility question separately,
   ask which they would notice first, and probe the *pain* not the pitch — e.g.
   "Have you ever shipped (or generated) a level that turned out unbeatable?"
   (The separate rewritten questions are a to-do; see Open gates.)

5. **Add a second hands-on moment: make the judge the developer.** "Close your
   eyes and play" is the player moment. The developer moment, which no rival
   will have: type a prompt → watch Kiro build a game on Marrow → watch the
   proof run green → break one obstacle → watch it refuse. This is the
   InteractionKit effect for the builder side and it is what proves the power
   actually works (Technological Implementation score).

**Candidate one-liner (OPEN, pending dev test):**
> Marrow is a Kiro power that makes every game it builds *refuse to ship a level
> a player can't finish* — proven for everyone, including one-switch and blind
> players, with your store accessibility list written for you.

Keeps the "proven playable" width, adds teeth ("refuse to ship"), keeps
accessibility as the sharp edge, names the developer payoff (store list) in one
breath. None of this changes the build — it changes the words, which carry the
score since judges may not run the project. Apply to product.md only after the
dev interviews settle the broad-vs-narrow question above.

---

## Risk and scope note (2026-11-05)

**Verdict: keep the idea, do not pivot.** The core — a game that *refuses to
ship a level a player can't finish*, proven for everyone including one-switch
and blind players — is both true and rare, has no direct rival in the sweep, and
hits the exact patterns that won in 2025 (one-sentence concept, hands-on judge
moment, real underserved person on screen, deep domain-specific Kiro use). The
prototype already proves the hardest part (the timing model) works. The risk is
execution and scope, not concept. Pivoting now would throw away the validated
core to chase a blank page.

### The three real risks

1. **Scope is the enemy, not the concept.** Committed surface: skeleton + two
   apps + MCP server + Kiro power + power benchmark + separate Crew app, solo,
   ~12–14 working days, and the proof is now eleven properties, not six. Every
   feature is a thing that must *work on video*. Own logged lesson: engineering
   volume alone loses (Zombie Blaster). Winners were often smaller than they
   looked. **Preference: skeleton + ONE flawless app + the power + the
   refuse-to-ship demo, polished — over six half-lit features.** Treat every
   feature as something that must survive a 3-minute video.

2. **The player-test gate is unmet and load-bearing.** Impact and Presentation
   rest on a real disabled player finishing a level and saying one sentence.
   Needs a working prototype first, then a booking (SpecialEffect / AbleGamers /
   RNIB / audiogames.net — not always available on a hackathon timeline). If
   that moment never lands, the idea loses what separates it from "another
   accessibility tool." **Action: building the thin prototype + booking the
   player is the single most urgent task, ahead of further spec polish.**

3. **Second app is undecided — keep it deliberately thin.** Lantern Run is
   validated; the second app (Crossroads or whatever it becomes) exists ONLY to
   prove the skeleton adapts across genres. Its value is existence, not
   richness. Risk = spending deep effort on something that earns one line in the
   video ("same skeleton, completely different interaction"). Keep it minimal on
   purpose.

### Theme idea to hold (OPEN, tied to the framing decision)

If dev interviews confirm the "proven playable" direction: **the proof is the
exorcism.** The game is "haunted" by levels that can't be beaten, cues that
can't be heard, flashes that can hurt — Marrow *banishes* them before anyone
plays. A through-line that ties the mechanic to Halloween without being cutesy
and gives the video its spine. Not a rename. Do not act until the framing
question resolves. (Also mirrored in the OPEN framing notes.)

### What NOT to do

Do not revert to Possessed or earlier ideas. Scored 40 vs 35 against the
strongest alternative; competitor field is clear; prototype proves the timing
model. Leverage now is in **narrowing and sharpening**, not switching — the time
for a concept-level pivot was before the prototype existed.

---

## Decisions (2026-11-18) — go-ahead given

1. **Feature freeze moved to Mon 30 Nov** (was 21 Nov).
2. **Games are undecided.** Lantern Run and Crossroads are placeholders. A
   "Lantern Run" roguelike already exists on dev.to, so rename before
   publishing. Decide the games later; build the skeleton first.
3. **Persona reviewer loop: KEPT.** Personas (perfect, timing-error,
   audio-only, plus reviewer personas) play a level, report where a real
   player with that need would fail, and the proof turns each finding into a
   plain-English refusal. It must replace hand-written tests, not add to them.
4. **Immersive audio is the heart of the "fun" answer.** Sound is the world
   (space, ambience, reactive music, reward swells), not a beep for a jump.
   Deaf players get the same events as rumble and light. Every channel is on by
   default; nobody names a condition.
5. **First-run setup flow: APPROVED.** All channels start on. The first screen
   speaks, shows and pulses each option: "Just play", "Play by sound", "Play by
   sight", "More time", "More settings". Options cycle until pressed (no time
   limit), one press picks,
   saved and changeable with one press. Reads OS preferences (reduced motion,
   contrast) automatically.
6. **Three new proof rules: APPROVED.** (a) Cues stay audible over ambience.
   (b) Every setup option reaches at least two senses. (c) No repair applies to a
   profile that didn't ask for it (the player's own "More time" choice is not a
   repair). Reworded 2026-11-18 from "difficulty is never a repair".
7. **Engine-agnostic core: APPROVED as direction.** The skeleton must work for
   any kind of game, not just browser games. Design: a pure core (events,
   channels, profile, proof, personas, report, no DOM) plus **adapters** that
   connect it to an engine. Build only the **web adapter** now. Document the
   adapter contract so Unity, Godot or native adapters can follow. Be honest in
   the write-up: one adapter shipped, others are roadmap.

---

## Decisions (2026-11-18, later) — demo games

1. **First game: Ghastly Moves (built).** An educational rhythm game: times
   tables as rhythm. Jump on multiples, let the rest pass, get judged Perfect,
   Good or Ok, build a streak, get a rank, and learn from each mistake. This is
   the **educational** angle. The old "Lantern Run" name is gone; the name
   clash with the dev.to game is resolved. Crossroads is dropped.
2. **Second game: to be chosen, and it must be impressive.** Options and a
   recommendation are in `docs/demo-games.md` (Séance Escape, Echo Hunter,
   Dungeon of Echoes). This is the **impressive** angle.
3. **Any game, however detailed or complex, must be able to use the kit.**
   Added Requirement 25 (scale): priority and verbosity for events, a speech
   queue, a sound voice budget and "nearest N" announcing. Proposed, not built.
   Until it is built we do not claim the kit is proven at scale.
4. **Leftover folder: done.** `apps/lantern-run` is gone and the workspaces entry is back to `apps/*`.
