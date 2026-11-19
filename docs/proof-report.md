# Proof report

Every level and every house is proved before a player sees it. The numbers are written by tests, so they cannot drift:

- [Ghastly Moves](proof-report-ghastly-moves.md): every stage and boss, 200 levels each.
- [Séance Escape](proof-report-seance-escape.md): 200 houses at each size.

Rewrite both with:

```sh
npm run proof-report --workspace apps/ghastly-moves
npm run proof-report --workspace apps/seance-escape
```

A Kiro hook (`.kiro/hooks/store-list-report.json`) does this when a kit, object or stage changes.

What the properties are is in [architecture.md](architecture.md#the-proof).
