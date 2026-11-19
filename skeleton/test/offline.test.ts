import vm from 'node:vm';
import { describe, expect, it } from 'vitest';
import { fingerprint, registerOffline, serviceWorkerSource } from '../src/adapters/web';
import { offlinePlugin } from '../src/adapters/web/vite-plugin';

// The worker is plain text. These tests run that text against a small fake of the browser's worker
// environment (caches, fetch, events), so what is checked is the real worker, not a copy of its idea.

const ORIGIN = 'https://game.test';
const base = (url: string): string => new URL(url, `${ORIGIN}/`).href;
const noQuery = (url: string): string => {
  const u = new URL(url);
  u.search = '';
  return u.href;
};

function makeWorld(source: string, network: (url: string) => Response | Promise<Response> = () => {
    throw new TypeError('Failed to fetch'); // what a browser does with no network
  },
) {
  const stores = new Map<string, Map<string, Response>>();
  const handlers: Record<string, (event: any) => void> = {};
  const fetched: string[] = [];
  let skipped = false;
  let claimed = false;

  const cacheOf = (name: string) => {
    if (!stores.has(name)) stores.set(name, new Map());
    const store = stores.get(name)!;
    return {
      addAll: async (files: string[]) => {
        for (const f of files) store.set(base(f), new Response(`cached:${f}`, { status: 200 }));
      },
      put: async (request: Request | string, response: Response) => void store.set(typeof request === 'string' ? base(request) : request.url, response),
      match: async (request: Request | string, options: { ignoreSearch?: boolean } = {}) => {
        const url = typeof request === 'string' ? base(request) : request.url;
        for (const [key, value] of store) if ((options.ignoreSearch ? noQuery(key) === noQuery(url) : key === url)) return value.clone();
        return undefined;
      },
    };
  };
  const caches = {
    open: async (name: string) => cacheOf(name),
    keys: async () => [...stores.keys()],
    delete: async (name: string) => stores.delete(name),
    match: async (request: Request | string, options: { ignoreSearch?: boolean } = {}) => {
      for (const name of stores.keys()) {
        const hit = await cacheOf(name).match(request, options);
        if (hit) return hit;
      }
      return undefined;
    },
  };
  const self = {
    addEventListener: (type: string, fn: (event: any) => void) => void (handlers[type] = fn),
    location: { origin: ORIGIN },
    skipWaiting: async () => void (skipped = true),
    clients: { claim: async () => void (claimed = true) },
  };
  const context = {
    self,
    caches,
    Response,
    URL,
    Promise,
    fetch: async (request: Request) => {
      fetched.push(request.url);
      return network(request.url);
    },
  };
  vm.runInNewContext(source, context);

  const run = async (type: 'install' | 'activate'): Promise<void> => {
    let waiting: Promise<unknown> = Promise.resolve();
    handlers[type]!({ waitUntil: (p: Promise<unknown>) => void (waiting = p) });
    await waiting;
  };
  const get = async (url: string, mode = 'cors', method = 'GET'): Promise<{ answered: boolean; text?: string; ok?: boolean }> => {
    const request = new Request(base(url), { method });
    Object.defineProperty(request, 'mode', { value: mode });
    let answered: Promise<Response> | undefined;
    handlers.fetch!({ request, respondWith: (p: Promise<Response>) => void (answered = Promise.resolve(p)) });
    if (!answered) return { answered: false };
    const response = await answered;
    return { answered: true, ok: response.ok, text: response.ok ? await response.text() : undefined };
  };
  return { stores, run, get, fetched, state: () => ({ skipped, claimed }) };
}

const SOURCE = serviceWorkerSource({ files: ['./', 'index.html', 'assets/app-1a2b.js'], version: 'v1', name: 'my game' });

describe('the offline worker', () => {
  it('carries the files, the version and a name for its caches', () => {
    expect(SOURCE).toContain('"assets/app-1a2b.js"');
    expect(SOURCE).toContain('marrow-my-game-');
    expect(SOURCE).toContain('"v1"');
  });

  it('keeps every file when it installs, and takes over at once', async () => {
    const w = makeWorld(SOURCE);
    await w.run('install');
    const cache = [...w.stores.entries()][0]!;
    expect(cache[0]).toBe('marrow-my-game-v1');
    expect([...cache[1].keys()].map((k) => k.replace(`${ORIGIN}/`, ''))).toEqual(['', 'index.html', 'assets/app-1a2b.js']);
    expect(w.state().skipped).toBe(true);
    await w.run('activate');
    expect(w.state().claimed).toBe(true);
  });

  it('removes an old copy of its own caches, and leaves other games alone', async () => {
    const w = makeWorld(SOURCE);
    w.stores.set('marrow-my-game-v0', new Map());
    w.stores.set('marrow-other-game-v9', new Map());
    await w.run('install');
    await w.run('activate');
    expect([...w.stores.keys()].sort()).toEqual(['marrow-my-game-v1', 'marrow-other-game-v9']);
  });

  it('plays with no network: kept files come from the cache, even with ?level=3 on the address', async () => {
    const w = makeWorld(SOURCE, () => {
      throw new Error('the network must not be used');
    });
    await w.run('install');
    for (const url of ['/', '/?level=3', '/?level=3&clips=voice/', '/index.html', '/assets/app-1a2b.js']) {
      const r = await w.get(url);
      expect(r.answered, url).toBe(true);
      expect(r.ok, url).toBe(true);
    }
    expect(w.fetched).toEqual([]);
  });

  it('shows the cached game when a page is opened offline, and an error for a missing file', async () => {
    const w = makeWorld(SOURCE); // the network fails
    await w.run('install');
    const page = await w.get('/some/other/page', 'navigate');
    expect(page.ok).toBe(true);
    expect(page.text).toBe('cached:index.html');
    expect((await w.get('/voice/missing.mp3')).ok).toBe(false);
  });

  it('keeps a file it had to fetch (such as a recording), then serves it offline', async () => {
    let online = true;
    const w = makeWorld(SOURCE, (url) => {
      if (!online) throw new TypeError('Failed to fetch');
      return new Response(`net:${url}`);
    });
    await w.run('install');
    expect((await w.get('/voice/left.mp3')).text).toBe(`net:${ORIGIN}/voice/left.mp3`);
    await new Promise((r) => setTimeout(r, 0));
    online = false;
    expect((await w.get('/voice/left.mp3')).text).toBe(`net:${ORIGIN}/voice/left.mp3`);
  });

  it('ignores other sites and anything but GET', async () => {
    const w = makeWorld(SOURCE);
    await w.run('install');
    expect((await w.get('/', 'cors', 'POST')).answered).toBe(false);
    expect((await w.get('https://elsewhere.test/x.js')).answered).toBe(false);
    expect(w.fetched).toEqual([]);
  });
});

describe('the build plugin', () => {
  const bundle = {
    'index.html': { type: 'asset' as const, source: '<html>' },
    'assets/app-1a2b.js': { type: 'chunk' as const, code: 'console.log(1)' },
    'assets/style.css': { type: 'asset' as const, source: 'body{}' },
  };
  const build = (b: typeof bundle, options = {}) => {
    const emitted: { fileName: string; source: string }[] = [];
    offlinePlugin(options).generateBundle.call({ emitFile: (f) => void emitted.push(f as never) }, {}, b);
    return emitted;
  };

  it('writes sw.js listing every built file, once, after the page itself', () => {
    const [sw, ...rest] = build(bundle, { name: 'ghastly' });
    expect(rest).toEqual([]);
    expect(sw!.fileName).toBe('sw.js');
    expect(sw!.source).toContain('"./"');
    for (const f of Object.keys(bundle)) expect(sw!.source).toContain(JSON.stringify(f));
    expect(sw!.source).toContain('marrow-ghastly-');
    expect(offlinePlugin().enforce).toBe('post');
  });

  it('gives a new version when anything changes, and the same one when nothing does', () => {
    const a = build(bundle)[0]!.source;
    const same = build({ ...bundle })[0]!.source;
    const changed = build({ ...bundle, 'assets/app-1a2b.js': { type: 'chunk' as const, code: 'console.log(2)' } })[0]!.source;
    expect(same).toBe(a);
    expect(changed).not.toBe(a);
  });

  it('never lists itself', () => {
    const withSw = { ...bundle, 'sw.js': { type: 'asset' as const, source: 'old' } };
    expect(build(withSw)[0]!.source).not.toContain('"sw.js"');
  });
});

describe('registering', () => {
  it('registers where it can, and says so', async () => {
    const urls: string[] = [];
    expect(await registerOffline('./sw.js', { register: async (u) => void urls.push(u) })).toBe(true);
    expect(urls).toEqual(['./sw.js']);
  });

  it('plays online as before when there is no worker support, or registering fails', async () => {
    expect(await registerOffline('./sw.js', undefined)).toBe(false);
    expect(
      await registerOffline('./sw.js', {
        register: async () => {
          throw new Error('insecure');
        },
      }),
    ).toBe(false);
  });

  it('fingerprints differ for different text', () => {
    expect(fingerprint(['a', 'b'])).not.toBe(fingerprint(['ab']));
    expect(fingerprint(['a'])).toBe(fingerprint(['a']));
  });
});
