# Proof report: Séance Escape

Made by a test, never by hand. `npm run proof-report --workspace apps/seance-escape` rewrites it, and the test fails if it is out of date.

**Every house the game serves passes every property.** Properties checked: 8, 9, 10, 11, 201, 202, 203, 204, 205, 206.

| House size | Houses proved | Seeds with no fair house at this size | Fewest steps to escape, on average |
|---|---|---|---|
| small (6 by 6) | 200 of 200 | 0 | 47 |
| medium (8 by 8) | 200 of 200 | 0 | 77 |
| large (10 by 10) | 200 of 200 | 0 | 110 |

A house that cannot be proved is never served. For a seed with no fair house, the game says so and asks for a bigger house.
