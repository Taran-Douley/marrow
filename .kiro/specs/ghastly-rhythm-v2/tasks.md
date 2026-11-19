# Tasks: Ghastly Moves, rhythm v2

Staged. Only what is built is ticked. Stage 1 is done 2026-11-19; not yet tried by a real player.

## Stage 1: the Pumpkin Patch and the Pumpkin King (pillars 1, 2, 4, 5, and graphics)

Stage 1 has no portals by design: it teaches the beat. Portals already exist per song part in stages 2 to 7 (property 16).

- [x] 1. Locked to the song: property 19, over 250 seeds for every stage song and the boss fight (Req 1)
- [x] 2. Instant retry: `fallPause` and `restartLead` cut, `explainOnce`, short reasons, `fallAttempt`, no hold on a repeat fall (Req 2.1 to 2.3)
- [x] 3. Property 20 and a headless test of repeat-fall retries at slow, medium and fast (Req 2.8)
- [x] 4. Progress, attempt and best on the canvas; the best saved per stage and boss; new-best sound, caption and words; stats in the live region (Req 2.4 to 2.7)
- [x] 5. Beat pulses: `pulseAt`, property 21 (Req 4.1 to 4.5)
- [x] 6. Graphics: gradient sky, glowing moon, three drifting layers, textured ground, soft ghost, glowing lantern, map sky (Req 4.6, 4.7)
- [x] 7. The Pumpkin King's pattern: two throw kinds with their own sounds, a tell before each volley, the fight as a song (Req 5.1 to 5.8)
- [x] 8. Properties 22 and 23 and their tests
- [x] 9. Stage 1 checks: skeleton tests, game tests, build, public API check

## Later stages

- [ ] 10. Patterns for the other six bosses, each with its own throws, sounds and tells
- [ ] 11. A seen portal gate: a gate drawn on the way, so a change of move is seen before it is heard (pillar 3)
- [ ] 12. Beat pulses on the obstacles, and a pulse per stage look
- [ ] 13. Per-stage best on the story map
- [ ] 14. Tune the songs, tells and bomb pitches with real players, including blind players
