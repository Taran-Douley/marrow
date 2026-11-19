---
name: accessibility-report
description: Produce an honest accessibility feature list for a Marrow game, mapped to the 24 ESA Accessible Games Initiative tags, from what the game's proof actually guarantees. Use when the developer wants store-page text, a README section, or to know what the game supports.
---

# The accessibility feature list

Run the `a11y_report` tool (add `navigation: true` for a house game, `directionalSound: true` if cues are placed all the way round, `cameraMotion: true` for a moving camera). It returns Markdown and JSON, in three groups:

- **Supported:** the kit guarantees it and the proof behind it passes.
- **Provided, to confirm:** the feature exists, but the tag has criteria a person must check (text height, colour alone, a moving camera, mouse-only play).
- **Not claimed:** with the reason: not built, not applicable, a channel is off, or a proof is failing.

## Rules

- Publish only the **supported** list as supported. Publish the "to confirm" list only after a person has checked it.
- A tag whose proof is failing or whose channel is off is never claimed.
- Never write that a game is "fully accessible", "accessible to everyone" or similar. Say what it supports and that it does not replace testing with disabled players.
- Do not write the list by hand. Regenerate it whenever the game changes.