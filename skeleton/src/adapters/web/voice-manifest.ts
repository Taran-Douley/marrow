// The recorded-voice manifest: `voice/manifest.json`, written by `npm run voice` (scripts/voice-clips.mjs).
// It maps the exact text of each line to its recording and its real length, and lists the short sounds a
// boss makes (grunt, hurt, laugh). A game loads it at start if it exists; a line with no recording
// falls back to the browser voice, so a partial set, or none at all, is fine.

import { setClipDurations } from '../../scanning';

export interface ManifestClip {
  /** The file, relative to the manifest's folder's parent (for example `voice/not-that-one.mp3`). */
  file: string;
  /** The real length of the recording, in ms. */
  ms: number;
}

export interface VoiceManifest {
  version: 1;
  /** Exact line text to its recording. */
  lines: Readonly<Record<string, ManifestClip>>;
  /** A boss's own short sounds, by boss name, then by kind (`grunt`, `hurt`, `laugh`). */
  grunts: Readonly<Record<string, Readonly<Record<string, ManifestClip>>>>;
}

const isClip = (v: unknown): v is ManifestClip =>
  typeof v === 'object' && v !== null && typeof (v as ManifestClip).file === 'string' && typeof (v as ManifestClip).ms === 'number';

/** Check a parsed manifest. Anything malformed is left out, never thrown on, so a bad file cannot stop the game. */
export function parseManifest(json: unknown): VoiceManifest | null {
  if (typeof json !== 'object' || json === null) return null;
  const raw = json as { lines?: unknown; grunts?: unknown };
  const lines: Record<string, ManifestClip> = {};
  if (typeof raw.lines === 'object' && raw.lines !== null) {
    for (const [text, clip] of Object.entries(raw.lines)) if (isClip(clip)) lines[text] = clip;
  }
  const grunts: Record<string, Record<string, ManifestClip>> = {};
  if (typeof raw.grunts === 'object' && raw.grunts !== null) {
    for (const [boss, kinds] of Object.entries(raw.grunts)) {
      if (typeof kinds !== 'object' || kinds === null) continue;
      for (const [kind, clip] of Object.entries(kinds)) {
        if (isClip(clip)) (grunts[boss] ??= {})[kind] = clip;
      }
    }
  }
  return { version: 1, lines, grunts };
}

export type FetchLike = (url: string) => Promise<{ ok: boolean; json(): Promise<unknown> }>;

export interface VoiceClips {
  /** The recording of an exact line, or undefined: the browser voice then speaks it. */
  lookup(text: string): string | undefined;
  /** A boss's short sound (`hurt`, `laugh`, `grunt`), or undefined when there is none. */
  grunt(boss: string, kind: string): string | undefined;
  /** Load `<base>manifest.json`. Resolves false (and changes nothing) when there is none. */
  load(): Promise<boolean>;
  /** Put a manifest in directly (tests, or a game that bundles it). */
  use(manifest: VoiceManifest): void;
}

/**
 * Clips found through the manifest. Wire it in with `voice: { clips: (text) => clips.lookup(text) }` and call
 * `clips.load()` once at start. When it loads, the real length of every clip is handed to `speechMs`, so no
 * hold or proof is ever shorter than a recording.
 */
export function createVoiceClips(options: { base?: string; fetch?: FetchLike; fallback?: (text: string) => string | undefined } = {}): VoiceClips {
  const base = options.base ?? 'voice/';
  const folder = base === '' || base.endsWith('/') ? base : `${base}/`;
  let manifest: VoiceManifest | null = null;
  const use = (m: VoiceManifest): void => {
    manifest = m;
    const durations: Record<string, number> = {};
    for (const [text, clip] of Object.entries(m.lines)) durations[text] = clip.ms;
    setClipDurations(durations);
  };
  return {
    lookup: (text) => {
      const clip = manifest?.lines[text];
      return clip ? clip.file : options.fallback?.(text);
    },
    grunt: (boss, kind) => manifest?.grunts[boss]?.[kind]?.file,
    use,
    async load() {
      const get = options.fetch ?? (typeof fetch === 'function' ? (fetch as unknown as FetchLike) : undefined);
      if (!get) return false;
      try {
        const response = await get(`${folder}manifest.json`);
        if (!response.ok) return false;
        const parsed = parseManifest(await response.json());
        if (!parsed) return false;
        use(parsed);
        return true;
      } catch {
        return false;
      }
    },
  };
}

/** The browser voices closest to the recorded narrator (a young British woman), best first, for lines with no recording. */
export const NARRATOR_BROWSER_VOICES: readonly string[] = ['Libby', 'Sonia', 'Maisie', 'Google UK English Female'];
