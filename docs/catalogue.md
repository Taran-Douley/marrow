# Catalogue of ready-made objects

Made from `skeleton/src/catalogue/index.ts` by a test, never by hand. `npm run catalogue --workspace skeleton` rewrites it.

```ts
import { stone, useObject } from '@marrow/skeleton/catalogue';
useObject(kit, stone);                         // as it is
useObject(kit, stone, { width: [0.2, 0.3] });  // or with any part changed
```

| Import | Kind | Width (s) | Says | Caption | Sound | Vibration (ms) | Used in |
|---|---|---|---|---|---|---|---|
| `stone` | obstacle | 0.16 to 0.3 | stone | Stone | 294 Hz triangle | 250, 120, 250 | Ghastly Moves: the numbered gravestone in every jump part |
| `spike` | obstacle | 0.12 to 0.2 | spike | Spike | 587 Hz sine | 60, 60, 60 | Ghastly Moves: flip mode, cleared by flipping to the other side |
| `gate` | obstacle | 0.12 to 0.18 | gate | Gate | 440 Hz square | 120, 80, 120, 80, 120 | Ghastly Moves: a number gate, one number in each lane |
| `pumpkinBomb` | obstacle | 0.16 to 0.3 | pumpkin bomb | pumpkin bomb | 440 Hz square | 250, 120, 250 | Ghastly Moves: what the Pumpkin King throws |
| `bone` | obstacle | 0.16 to 0.3 | bone | bone | 440 Hz square | 250, 120, 250 | Ghastly Moves: what the Bone Warden throws |
| `hex` | obstacle | 0.16 to 0.3 | hex | hex | 440 Hz square | 250, 120, 250 | Ghastly Moves: what the Moss Witch throws |
| `ironBall` | obstacle | 0.16 to 0.3 | iron ball | iron ball | 440 Hz square | 250, 120, 250 | Ghastly Moves: what the Gatekeeper throws |
| `webBall` | obstacle | 0.16 to 0.3 | web ball | web ball | 440 Hz square | 250, 120, 250 | Ghastly Moves: what the Spider Miller throws |
| `wisp` | obstacle | 0.16 to 0.3 | wisp | wisp | 440 Hz square | 250, 120, 250 | Ghastly Moves: what the Hollow Wraith throws |
| `bat` | obstacle | 0.16 to 0.3 | bat | bat | 440 Hz square | 250, 120, 250 | Ghastly Moves: what Count Vexar throws |
| `silverCandle` | object | none | silver candle | Silver candle | 523 Hz sine | 20, 40, 20 | Séance Escape: a relic that hums from its room |
| `locket` | object | none | locket | Locket | 587 Hz sine | 20, 40, 20 | Séance Escape: a relic that hums from its room |
| `planchette` | object | none | planchette | Planchette | 659 Hz sine | 20, 40, 20 | Séance Escape: a relic that hums from its room |
| `greatBell` | object | none | the great bell | Great bell | 659 Hz sine | 60, 60, 200 | Séance Escape: the way out, tolling in the Front Hall |

Every object gets all four outputs, so every one reaches at least two senses. Obstacles of the same width range pass the timing proof at every speed.
