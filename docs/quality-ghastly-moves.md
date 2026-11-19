# How Ghastly Moves plays

Made by the advisor’s quality report, from simulated players, never by hand. `npm run quality --workspace apps/ghastly-moves` rewrites it.

| Stage | Name | Levels proved | Slow | Medium | Fast | By sound only, slow | Longest wait, slow |
|---|---|---|---|---|---|---|---|
| 1 | Pumpkin Patch | 20 of 20 | good (91%) | hard (79%) | too hard (69%) | 100% | 8.4 s |
| 2 | Crypt Steps | 20 of 20 | good (92%) | hard (81%) | too hard (71%) | 100% | 9.8 s |
| 3 | Whispering Woods | 20 of 20 | good (92%) | hard (81%) | too hard (71%) | 100% | 10.0 s |
| 4 | The Old Gate | 20 of 20 | good (93%) | hard (83%) | too hard (73%) | 100% | 10.0 s |
| 5 | Haunted Mill | 20 of 20 | good (94%) | hard (84%) | too hard (74%) | 100% | 7.6 s |
| 6 | The Hollow | 20 of 20 | good (93%) | hard (83%) | too hard (73%) | 100% | 7.6 s |
| 7 | Midnight Manor | 20 of 20 | good (93%) | hard (83%) | too hard (72%) | 100% | 7.2 s |

Verdicts are for a player with 250 ms of timing error; the percentage is jumps cleared first time.

## What would help most

- Medium and Fast are hard for a player with 250 ms of timing error: offer timing help and the coach, and keep Slow as the default.

These numbers show whether the game can be finished and how it plays, not whether it is fun. Test with real players, including disabled players.
