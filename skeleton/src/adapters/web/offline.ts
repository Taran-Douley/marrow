// Offline after the first visit (tech.md): a service worker that keeps the built game in the browser's
// cache. It is made at build time, by `offlinePlugin` in `./vite-plugin`, from the list of files the
// build produced, so a game needs no hand-written worker. `registerOffline` starts it from the page.

export interface ServiceWorkerOptions {
  /** Every file to keep, relative to the worker's own folder: './', 'index.html', 'assets/app-1a2b.js'... */
  files: readonly string[];
  /** Changes whenever the build changes, so an old copy is replaced. */
  version: string;
  /** Names this game's caches, so two games on one site never clear each other's. */
  name?: string;
}

/**
 * The text of the service worker. It keeps the files at install, answers from the cache first (the
 * address's query, such as `?level=3`, does not matter), saves anything else from the same site that it
 * has to fetch, and shows the cached page when a page is opened with no network. Old copies are removed
 * when a new version starts.
 */
export function serviceWorkerSource(options: ServiceWorkerOptions): string {
  const prefix = `marrow-${(options.name ?? 'game').replace(/[^a-z0-9-]/gi, '-')}-`;
  return `// Made by Marrow. Do not edit.
const PREFIX = ${JSON.stringify(prefix)};
const CACHE = PREFIX + ${JSON.stringify(options.version)};
const FILES = ${JSON.stringify(options.files)};

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(FILES)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith(PREFIX) && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  event.respondWith(
    caches.match(request, { ignoreSearch: true }).then((hit) => {
      if (hit) return hit;
      return fetch(request)
        .then((response) => {
          if (response && response.ok) {
            const copy = response.clone();
            caches.open(CACHE).then((cache) => cache.put(request, copy));
          }
          return response;
        })
        .catch(() => (request.mode === 'navigate' ? caches.match('index.html', { ignoreSearch: true }) : Response.error()));
    })
  );
});
`;
}

/** A short fingerprint of text, for naming a build. */
export function fingerprint(parts: readonly string[]): string {
  let h = 0x811c9dc5;
  for (const part of parts) {
    for (let i = 0; i < part.length; i++) {
      h ^= part.charCodeAt(i);
      h = Math.imul(h, 0x01000193) >>> 0;
    }
    h ^= 0xff;
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, '0');
}

function browserWorkers(): ServiceWorkerContainerLike | undefined {
  if (typeof navigator === 'undefined') return undefined;
  return (navigator as { serviceWorker?: ServiceWorkerContainerLike }).serviceWorker;
}

export interface ServiceWorkerContainerLike {
  register(url: string): Promise<unknown>;
}

/**
 * Start the worker so the game works with no network from the second visit on. Returns whether it
 * registered. A browser without service workers, or a page that is not served from a secure address,
 * simply plays online as before.
 */
export async function registerOffline(url = './sw.js', container?: ServiceWorkerContainerLike | null): Promise<boolean> {
  const target = container === undefined ? browserWorkers() : container;
  if (!target) return false;
  try {
    await target.register(url);
    return true;
  } catch {
    return false;
  }
}
