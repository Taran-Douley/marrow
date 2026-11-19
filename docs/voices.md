# Giving your game its own voice

The built-in voice is whatever the player's browser has. Some browsers ship a
plain, robotic voice. You can improve it, or replace it entirely with your own
recordings or an AI voice service. Pick the easiest route that sounds right.

Every route keeps these rules:

- The text of every line is **always** written to the text log (`aria-live`),
  so a screen reader gets it even if your voice is off or fails.
- If the player turns the built-in voice off, nothing is spoken aloud.
- If your voice fails, the next one speaks. A line is never lost.
- The newest line cancels the old one.
- The three beeps stay the exact timing cue. Speech is not exact enough to carry
  the press: a recording or a network voice can start late.

## Route 1: do nothing

The kit picks the most natural voice the browser has for the player's language
("Natural", "Neural", "Premium" voices over the plain default). Edge and Chrome
include natural voices. To name the voices you prefer, best first, and tune the
speed:

```ts
createWebAdapter({
  region,
  voice: { browser: { names: ['Aria', 'Sonia', 'Google UK'], lang: 'en-GB', rate: 0.95 } },
});
```

## Route 2: your own recordings

1. List every line the game can speak:

   ```ts
   for (const line of kit.lineScript()) console.log(line.template ? '(template)' : '', line.text, '<-', line.from);
   ```

2. Record those lines, or generate them with a voice service **at build time**.
3. Tell the adapter where each file is, by the exact line:

   ```ts
   createWebAdapter({
     region,
     voice: {
       clips: {
         'Grave ahead.': '/voice/grave-ahead.mp3',
         'Pressed a little early.': '/voice/early.mp3',
       },
       // Or find files with a function:
       // clips: (text) => files[text],
     },
   });
   ```

A line with a `{slot}` filled at play time (like `{points} points`) is marked
`template: true` and cannot be one fixed recording; it falls back to the browser
voice. Keep lines you want recorded free of slots.

Lines with no recording fall back to the browser voice, so you can record only
the lines that matter most.

## Route 3: your own AI voice service

Plug in one object with two methods:

```ts
let current: HTMLAudioElement | undefined;

createWebAdapter({
  region,
  voice: {
    provider: {
      async speak(text, { volume }) {
        const reply = await fetch(`/api/say?text=${encodeURIComponent(text)}`); // your server, not the voice service
        current = new Audio(URL.createObjectURL(await reply.blob()));
        current.volume = volume;
        await current.play();
      },
      cancel() {
        current?.pause();
      },
    },
  },
});
```

If `speak` throws, or the promise it returns rejects, the next voice speaks.

### Do not put a voice-service key in your page

Anything in browser code can be read by anyone. Either call **your own server**,
which holds the key, or (better) **generate the clips at build time** from
`kit.lineScript()` and ship the files. That is faster for the player (no wait),
cheaper, works offline, and exposes no key.

## Notes

- The kit ships no voices or recordings. Bring your own, and follow the licence
  or terms of whoever made them.
- One voice speaks all lines for now. Separate voices per character are a
  roadmap item.
- Keep spoken lines short: a few plain words each.

## Example: recordings by file name (no audio is shipped)

The kit ships no voice audio. To try a good voice, record or generate one MP3 per line, then point the page at the folder.

1. Get the lines: `kit.lineScript()` lists every line the game can say. Lines with `{slots}` (such as `{label}`) are templates: record the spoken forms you need, such as "Left" and "Ahead".
2. Name each file with `slugOf(line)` from `@marrow/skeleton/web`. Example: "Dead end. Turning back." becomes `dead-end-turning-back.mp3`.
3. Put the files in a folder next to the built page, for example `voice/`.
4. Open the game with `?clips=voice/`. Both Ghastly Moves and Séance Escape read this setting.
5. In your own game, pass `voice: { clips: clipsBySlug('voice/') }` to `createWebAdapter`. Add `provider` for a live AI voice service.

The order is: your provider, then a clip, then the browser voice. A line with no file falls back to the browser voice, so a partial set works. The text log is always written.
