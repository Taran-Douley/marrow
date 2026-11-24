// The .ts ending is deliberate: Vite loads this file straight from node, which needs the full file name.
import { readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fingerprint, serviceWorkerSource } from './offline.ts';

// A Vite plugin that writes `sw.js` next to the built game. Use it in a game's vite.config.ts:
//
//   import { offlinePlugin } from '@marrow/skeleton/vite';
//   export default defineConfig({ plugins: [offlinePlugin({ name: 'my-game' })] });
//
// and call `registerOffline()` (from '@marrow/skeleton/web') when the page starts.

export interface OfflinePluginOptions {
  /** Names this game's caches. */
  name?: string;
  /** The file to write. Default 'sw.js'. */
  fileName?: string;
  /** The folder of recorded voice clips, relative to where the build runs. Default 'public/voice'. */
  publicVoiceDir?: string;
}

/** The files of a public folder, as `<prefix>/<file>` with their sizes, so the offline copy includes them. Empty when there is none. */
export function publicFiles(dir: string, prefix: string): { name: string; size: number }[] {
  try {
    return readdirSync(dir)
      .filter((f) => statSync(join(dir, f)).isFile())
      .sort()
      .map((f) => ({ name: `${prefix}/${f}`, size: statSync(join(dir, f)).size }));
  } catch {
    return [];
  }
}

interface BundleItem {
  type: 'asset' | 'chunk';
  source?: string | Uint8Array;
  code?: string;
}

/** Just the parts of a Rollup plugin that this one uses, so the skeleton does not depend on vite's types. */
export interface OfflinePlugin {
  name: string;
  apply: 'build';
  enforce: 'post';
  generateBundle(this: { emitFile(file: { type: 'asset'; fileName: string; source: string }): unknown }, options: unknown, bundle: Record<string, BundleItem>): void;
}

export function offlinePlugin(options: OfflinePluginOptions = {}): OfflinePlugin {
  const fileName = options.fileName ?? 'sw.js';
  return {
    name: 'marrow-offline',
    apply: 'build',
    enforce: 'post', // after the page itself has been written, so index.html is in the list
    generateBundle(_options, bundle) {
      const built = Object.keys(bundle).filter((n) => n !== fileName).sort();
      const contents = built.map((n) => {
        const item = bundle[n]!;
        const body = item.type === 'chunk' ? item.code : item.source;
        return typeof body === 'string' ? body : body ? String(body.length) : '';
      });
      // Recorded voice clips live in public/voice, which is copied to the build but is not in the bundle: keep them too.
      const clips = publicFiles(options.publicVoiceDir ?? 'public/voice', 'voice');
      const names = [...built, ...clips.map((c) => c.name)];
      contents.push(...clips.map((c) => String(c.size)));
      this.emitFile({
        type: 'asset',
        fileName,
        source: serviceWorkerSource({
          files: ['./', ...names],
          version: fingerprint([...names, ...contents]),
          ...(options.name ? { name: options.name } : {}),
        }),
      });
    },
  };
}
