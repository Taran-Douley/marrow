# Objects in ghastly-moves

Made by scripts/wire-objects.mjs from apps/ghastly-moves/src/objects/, never by hand.

```ts
import { stone, useObject } from '@marrow/skeleton/catalogue';
useObject(kit, stone);                         // as it is
useObject(kit, stone, { width: [0.2, 0.3] });  // or with any part changed
```

| Import | Kind | Width (s) | Says | Caption | Sound | Vibration (ms) | Used in |
|---|---|---|---|---|---|---|---|

Every object gets all four outputs, so every one reaches at least two senses. Obstacles of the same width range pass the timing proof at every speed.
