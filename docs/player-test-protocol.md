# Player test protocol (15 minutes)

Goal: find out, with a real player, whether the prototype can be finished
unaided and whether the obstacles can be told apart. The player's feedback
outranks our assumptions. Never describe the result as "fully accessible".

## Before the session

1. Run the app: `npm.cmd run dev --workspace apps/ghastly-moves`, then open the
   address it prints (usually `http://localhost:5173`). To give someone a link,
   build with `npm.cmd run build --workspace apps/ghastly-moves` and put the
   `apps/ghastly-moves/dist` folder on any static host. Nothing has been deployed.
2. Use Chrome or Edge on a desktop. Speech and rumble vary by browser.
3. Set up for the player (a helper does this: the settings need a mouse or
   keyboard until the scanning menu exists):
   - **Speed: Slow.**
   - **Built-in voice:** on for most players. **Off for screen-reader users**,
     so they do not hear every line twice. The text log still gets every line.
   - **Picture:** on for sighted players, off for blind players or to test by sound.
4. Check the sound is audible and not too loud. Beeps are at 35% of full volume.

## The 15 minutes

| Minutes | What |
|---|---|
| 0–2 | Say what it is: "A ghost runs. Three beeps, then press on the fourth beat to jump. Any key, click or button works." |
| 2–4 | Practice: let them hear a grave (low hum) and a fence (high chime) twice. |
| 4–8 | **Level 1, picture on** (or by sound for a blind player). Do not coach. |
| 8–12 | **Level 1 again, picture off.** |
| 12–15 | Ask the questions below. Download the CSV (button on the page). |

Note: a press before the first beep is a harmless hop. A fall explains itself in
plain words and restarts just before that obstacle.

## What they should hear (so you can ask about each)

- A number spoken for each gravestone, then three beeps in the stone's low hum.
- The rule at the start, such as "Jump on every multiple of 3. Let the others pass."
- A soft brush when they rightly let a stone go by, and a rising note for each
  right decision in a row.
- "Perfect" for a jump close to the beat, with a bright pair of notes.
- After a mistake, a bonk, then the reason and the sum.
- A quiet tone that slides in from the right and opens up as the obstacle nears,
  arriving at the centre on the fourth beat.
- A whoosh the moment they press, a soft thud when they land, a chime when they clear.
- A low bonk when they fall, then the reason in words.
- Wind and a slow low pad underneath that rises when an obstacle is close.
- The voice: use the **Voice (this browser)** list on the page to try others.

## Questions

1. Could you hear and follow each number? How?
2. Did you know when to press? What told you?
3. Was there enough time to work out the answer? (Slow gives about two seconds from
   the number to the press. Say if it is too short or too long.)
4. When you got one wrong, did the explanation help you learn? Was it too long?
5. Was anything confusing, too fast or too loud? (Slow, Medium and Fast differ.)
6. Was it fun, or just timing a beep? Did the streak and the rising notes help?
7. What would make it fairer?
8. If you use a switch: could you reach everything you needed?

Try the **3** and the **7** times table: a harder table shows whether the thinking
time is fair.

## Pass and fail

- **Pass:** they finish level 1 unaided and can tell the two obstacles apart.
- **Fail:** stop and review the idea before building more (see tasks.md task 9).

## What to record

From the downloaded CSV and the page: attempts, cleared, falls, average
distance from the fourth beat in ms, speed, picture on or off. Add their words
as written. These are the "real player results" the product must report.

## Known limits of this build

- Not yet run in a real browser or heard by a person.
- A one-switch player can play with one switch but cannot change settings alone.
- Placeholder name and art. The sound world (approach tone, jump and landing
  sounds, wind, pad) is a first slice tuned without ears: levels may be too
  quiet or too loud. Say so and we will tune it.
- Needs a network on the first visit and does not work offline yet (task 8a).

---

# Addendum: both games (45 minutes in total)

Run each game on its own, with a different player if you can.

## Ghastly Moves: the story

Open `apps/ghastly-moves` (`npm.cmd run dev --workspace apps/ghastly-moves`). The first press shows the story card. The second begins the stage. At the end of a stage, a press starts the boss. A boss needs 70% right.

| Check | What to look for |
|---|---|
| Different rules | Can they tell, from the prompt, what to jump on? Which rule was hardest (even, squares, primes)? |
| Boss | Did it feel like a step up? Was "harder numbers" fair, or just slower to say? |
| Music | Can they always hear the three beeps over the track? Does the track help the beat, or distract? Try each stage. |
| Items and map | Did winning an item matter? Is the map clear by sound alone? |
| Losing the boss | Did the message help, or feel harsh? |

## Séance Escape

Open `apps/seance-escape` (`npm.cmd run dev --workspace apps/seance-escape`). Use **headphones**: the directions are in the sound. Try the **picture off** mode, and `?view=2d` once for the flat map.

| Check | What to look for |
|---|---|
| Directions | When "Left" is read, does it sound like it comes from the left? Ahead, right, behind? |
| One line per leg | Is the phantom line heard in full before the options start? Does anything talk over anything else? |
| Listen | Is the answer heard in full? Is it useful? Does asking at a crossing feel worth the cost? |
| The phantom | Do they know roughly where it is from sound alone? Is the heartbeat helpful or annoying? |
| Fairness | Did being caught feel fair? Was the wait for each line too long or too short? |
| 3D view | Can they see what is happening? Too dark? Any motion that bothers them? (Reduced motion is on if the system asks.) |

Ask: "Could you have done that with just one button?" and "What did you do when you were lost?"

Record how many games they finished, how many times they were caught, and which crossing they found hardest. Their words outrank our numbers.

## Known limits

- Nothing has been heard or played by a person yet. The wait for each spoken line is a guess from word count plus 20%.
- The 3D view needs WebGL. Without it the game falls back to a flat map.
