# Tasks: simple and voices

Order, as the user asked: 2, 3, 4, 1, 5, 6, 7, 8. After task 2 and after task 1, stop and ask the user to play for two minutes with eyes closed. Nothing here has been tried by a player other than the author.

- [x] 2. Character voices (R2). A `characters` table in the kit and `speaker` on events; a signature before each line, placed by position and played even with the voice off; captions and the aria-live text carry "Name: line"; the signature and its pause are in every speech-duration estimate. Séance: narrator and Mabel. Ghastly: narrator and seven bosses (their taunts after a stage). Tests: `skeleton/test/characters.test.ts`, `apps/*/test/voices.test.ts`. Not done: the mixed-speaker room lines in Séance, a panning clip player, tuning by ear. See design.md.
- [ ] **Stop: the user plays for two minutes with eyes closed.**
- [ ] 3. Voice speed (R3): profile `voiceSpeed` 0.5 to 2.0, scanned menu entry, all estimates use it.
- [ ] 4. Say that again, and where am I / what next (R4): two lines, one switch, always reachable.
- [ ] 1. Keep it simple (R1): setup option, one thing at a time, matched maths, Séance changes, plain words column, quieter music.
- [ ] **Stop: the user plays for two minutes with eyes closed.**
- [ ] 5. Gentle scares (R5): profile flag, on by default in Keep it simple, 12 dB in 200 ms limiter.
- [ ] 6. Proofs (R6): one thing at a time, characters apart, timing at 0.5x, 1x and 2x, gentle loudness; each with a property test and a plain-English counterexample.
- [ ] 7. Advisor rules (R7): seven new rules, and a guideline and an ESA tag on every rule, each guideline checked on gameaccessibilityguidelines.com.
- [ ] 8. Report, docs, README "what you get for free", tests and `docs/kiro-usage-log.md` (R8).
