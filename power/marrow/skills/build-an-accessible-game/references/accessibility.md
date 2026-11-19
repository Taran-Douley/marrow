
# Accessibility rules

These rules apply to every screen, menu and game in this repository. Treat a violation as a bug.

## Input
- One switch can do everything, including starting, choosing settings and returning to the menu (via switch scanning).
- Any key, click, tap, or gamepad button counts as the switch. Tab and modifier combinations are left to the browser; Escape goes back to the menu.
- Ignore key repeat. Never require holding, double-pressing, simultaneous presses or fast repeated presses.
- Hold-to-confirm is allowed **only as an opt-in alternative** a player turns on in their profile; it is never the default and never the only way to do anything.
- Menu options cycle until pressed, with no time limit. The highlight moves by itself, so one switch is enough; it never expires, skips or auto-chooses. Scanning speed (dwell) is adjustable.

## Output (channels model)
- Games declare **semantic events**; the skeleton renders each event through every enabled **channel** (sound, speech, captions, visual sound indicator, haptics), shaped by one player profile. Games never target a channel directly.
- Every semantic event must reach **at least two senses** through the enabled channels. Never by colour alone; never by sound alone.
- Countdown beeps have a matching caption with pips, and fire the visual sound indicator.
- Every announcement spoken by the built-in voice is also written to an `aria-live="polite"` region.
- The built-in voice can be turned off for screen-reader users (to avoid double speech); `aria-live` still receives every announcement.
- Picture-off mode hides the game view so sighted testers can play by sound, as blind players do.
- Distinct obstacle sounds differ in both pitch and timbre.
- Cue, speech and music volumes are independent; a mono-audio option is available.

## Visual
- Every theme (default and high-contrast) meets WCAG 2.2 AA contrast (4.5:1 text, 3:1 essential graphics). The proof checks this.
- Contrast theme, text/UI scale and a colour-blind-safe palette are player-profile options.
- Use a hyperlegible typeface (Atkinson Hyperlegible) with real fallbacks.
- Visible keyboard focus on every control.
- Respect `prefers-reduced-motion`: no flicker or idle animation when it is set.
- Nothing flashes more than three times per second. The proof checks this and refuses content that breaks it.

## Setup
- Every channel starts on, so nobody must choose anything to play.
- First-run setup offers ways to play ("Just play", "Play by sound", "Play by sight", "More time", "More settings"), never conditions. Each option is spoken, shown and pulsed. Options cycle until pressed, with no time limit; one press picks.

## Difficulty and failure
- Turning on a channel never changes difficulty. No repair applies to a profile that didn't ask for it. Only the player's own Speed choice (including "More time") changes timing.
- Speed settings change the timing window, not the content.
- Falling explains why in plain words ("Pressed a little early"), then restarts just before that obstacle.
- No lives, no game over screens, no punishing restarts.

## Language
- Plain, short sentences. Name things the way players say them ("fence", "grave", "press now").
- Never call the game "fully accessible". Say what it supports.

## Testing
- The property-based proof must pass before any level is served.
- Persona simulations run in CI.
- Real players with disabilities test the game; their feedback outranks our assumptions. Contacts: SpecialEffect, AbleGamers, RNIB, the audiogames.net community.

Reference: Game Accessibility Guidelines (gameaccessibilityguidelines.com), Xbox Accessibility Guidelines, WCAG 2.2.
