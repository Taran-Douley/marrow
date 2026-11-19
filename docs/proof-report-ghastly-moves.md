# Proof report: Ghastly Moves

Made by a test, never by hand. `npm run proof-report --workspace apps/ghastly-moves` rewrites it, and the test fails if it is out of date.

**2800 of 2800 generated levels passed every property.** The game refuses to serve any level that does not.

Properties checked: 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 15, 16, 101, 103, 104.

Smallest take-off window across all levels: **717 ms at Slow, 538 ms at Medium, 430 ms at Fast.** The floors are 650 ms at Slow and 400 ms at Fast.

| Stage | Name | Levels proved | Smallest window, ms (slow / medium / fast) | Jumps cleared first try, 150 ms timing error (slow / fast) |
|---|---|---|---|---|
| 1 | Pumpkin Patch | 200 of 200 | 717 / 538 / 430 | 99% / 90% |
| 1 boss | The Pumpkin King | 200 of 200 | 717 / 538 / 430 | 99% / 90% |
| 2 | Crypt Steps | 200 of 200 | 717 / 538 / 430 | 100% / 92% |
| 2 boss | The Bone Warden | 200 of 200 | 717 / 538 / 430 | 99% / 90% |
| 3 | Whispering Woods | 200 of 200 | 717 / 538 / 430 | 100% / 92% |
| 3 boss | The Moss Witch | 200 of 200 | 717 / 538 / 430 | 99% / 90% |
| 4 | The Old Gate | 200 of 200 | 717 / 538 / 430 | 100% / 93% |
| 4 boss | The Gatekeeper | 200 of 200 | 717 / 538 / 430 | 99% / 90% |
| 5 | Haunted Mill | 200 of 200 | 717 / 538 / 430 | 100% / 94% |
| 5 boss | The Spider Miller | 200 of 200 | 717 / 538 / 430 | 99% / 90% |
| 6 | The Hollow | 200 of 200 | 717 / 538 / 430 | 100% / 93% |
| 6 boss | The Hollow Wraith | 200 of 200 | 717 / 538 / 430 | 99% / 90% |
| 7 | Midnight Manor | 200 of 200 | 717 / 538 / 430 | 100% / 93% |
| 7 boss | Count Vexar | 200 of 200 | 717 / 538 / 430 | 99% / 90% |

The last column comes from simulated players, not people. It estimates; it does not replace testing with disabled players.
