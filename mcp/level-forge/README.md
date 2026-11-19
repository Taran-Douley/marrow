# Level Forge

A local MCP server (Model Context Protocol, over standard input and output) that lets Kiro, or any MCP client, generate, prove and playtest Marrow levels. It reads and writes no files and opens nothing, so it is safe to run unattended.

## Run it

```
npm.cmd run build --workspace mcp/level-forge
node mcp/level-forge/dist/main.js
```

`dist/main.js` is one self-contained file (the skeleton is bundled in). Kiro finds it through `.kiro/settings/mcp.json`.

## Tools

| Tool | What it does |
|---|---|
| `generate_level` | One level from a seed: each obstacle with its take-off window, ideal press, and window in ms at each speed. |
| `prove_level` | The proof on one level (a seed, or a hand-made level). Failures come back as plain-English counterexamples. A level that fails must not be served. |
| `prove_many` | The proof on a run of seeds, such as 200. Gives how many pass, which fail, and the narrowest window per speed. |
| `simulate_persona` | Headless players: perfect, with timing error (100, 150, 250 ms) and audio-only. Gives the chance of clearing each jump first try, per speed. |
| `prove_house` | The navigation proof (201 to 204) for a haunted house. |

Every tool takes an optional `game`: `{ obstacles: [{ name, width: [min, max] }], lesson: { rule, tables?, values }, timing, floorsMs }`. Leave it out for the default graveyard.

## Try it by hand

```
echo {"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"prove_many","arguments":{"count":200}}} | node mcp/level-forge/dist/main.js
```

On the default game: 200 of 200 levels pass, with narrowest windows of 717 ms at Slow, 538 ms at Medium and 430 ms at Fast.

## Not yet built

`review_level` (the persona reviewer loop) and `a11y_report` (the ESA-tagged feature list) from the task list.
