// THE PAGE'S OWN COPY OF ITSELF (phone-1, docs/phone.md): a service worker that keeps every file of THE RUN the
// player has used, so a second visit asks the network for next to nothing and the game plays offline once it has
// been played. It sits at the root of what is served (the repo, or an exported folder) so it covers the page
// (demo/), the rules (src/) and the city (city/), workers included. It never runs where somebody develops:
// demo/boot.js registers it on a real host (https) or when the address says ?sw=1, and takes it away on this
// machine otherwise.
//
// WHAT IT KEEPS: only the files named in sw-files.js (scripts/export-web.mjs writes it: every file the page may load,
// each with the first 16 hex of its SHA-256), and only a copy whose bytes have that hash: a copy that does not match
// (a host's cache still sending the old file, or a list not made again after an edit) is handed to the page but not
// kept. Anything not in the list goes to the network as if this file were not here.
// WHEN: a file is kept the first time the page asks for it while this worker is in charge, and, the first time the
// page comes up, every file it had already loaded before the worker took charge (the page sends the list: `take`).
// A NEW VERSION (a new sw-files.js, which the browser looks for each time the page is opened): it is installed beside
// the old one, with every unchanged file copied over and every changed file the player had fetched again, and it
// WAITS: the page in front of the player stays wholly the old version. The next time the page is opened, demo/boot.js
// sees the waiting version, lets it take over and reloads once: from then on it is wholly the new one.
/* global HK2_FILES */
importScripts('./sw-files.js');

const BASE = new URL('./', self.location).href;
const FILES = HK2_FILES.files;
const CACHE = `hk2-${HK2_FILES.version}`;

/** The path of a URL relative to where this file is, as the list names it; null when it is not one of ours. */
function keyOf(url, navigate) {
  if (!url.startsWith(BASE)) return null;
  const u = new URL(url);
  let rel = decodeURIComponent(u.pathname.slice(new URL(BASE).pathname.length));
  // the page itself: /demo/ with any query is demo/index.html; any other query string is not ours to answer
  if (navigate || rel.endsWith('/') || rel === '') rel = `${rel}${rel === '' || rel.endsWith('/') ? 'index.html' : ''}`;
  else if (u.search) return null;
  return FILES[rel] ? rel : null;
}

async function hashOf(buf) {
  const d = new Uint8Array(await crypto.subtle.digest('SHA-256', buf));
  return [...d.slice(0, 8)].map(b => b.toString(16).padStart(2, '0')).join('');
}

/** Fetches one file of ours; resolves { response, kept } with a copy put in `cache` when its bytes are the listed ones. */
async function fetchAndKeep(cache, rel, mode = 'default') {
  const res = await fetch(BASE + rel.split('/').map(encodeURIComponent).join('/'), { cache: mode });
  if (!res.ok) return { response: res, kept: false };
  const buf = await res.arrayBuffer();
  const headers = new Headers(res.headers);
  headers.delete('content-encoding');
  headers.delete('content-length');
  headers.delete('vary');
  const make = () => new Response(buf.slice(0), { status: 200, statusText: 'OK', headers });
  const kept = (await hashOf(buf)) === FILES[rel];
  if (kept) await cache.put(BASE + rel, make());
  return { response: make(), kept };
}

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    // a new version beside an old one: every file the old one kept comes over, unchanged ones copied, changed ones
    // fetched again (past the browser's HTTP cache, which may hold the old bytes; a host's cache that still sends
    // them fails the hash and is fetched again at play)
    const cache = await caches.open(CACHE);
    for (const name of await caches.keys()) {
      if (name === CACHE || !name.startsWith('hk2-')) continue;
      const old = await caches.open(name);
      const oldList = JSON.parse((await (await old.match(`${BASE}__list__`))?.text().catch(() => null)) ?? '{}');
      for (const req of await old.keys()) {
        const rel = req.url.slice(BASE.length);
        if (!FILES[rel]) continue;
        if (oldList[rel] === FILES[rel]) await cache.put(req, await old.match(req));
        else await fetchAndKeep(cache, rel, 'no-cache').catch(() => null);
      }
    }
    await cache.put(`${BASE}__list__`, new Response(JSON.stringify(FILES), { headers: { 'Content-Type': 'application/json' } }));
  })());
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    for (const name of await caches.keys()) if (name !== CACHE && name.startsWith('hk2-')) await caches.delete(name);
    await self.clients.claim();
  })());
});

self.addEventListener('message', event => {
  const m = event.data;
  // demo/boot.js, at the next opening of the page after a new version was installed: take over now
  if (m === 'skip') return self.skipWaiting();
  // demo/boot.js, once the panels are up: every file the page loaded before this worker was in charge
  if (m && Array.isArray(m.take)) {
    event.waitUntil((async () => {
      const cache = await caches.open(CACHE);
      for (const url of m.take) {
        const rel = keyOf(url, false);
        if (rel && !(await cache.match(BASE + rel))) await fetchAndKeep(cache, rel).catch(() => null);
      }
    })());
  }
});

self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const rel = keyOf(req.url, req.mode === 'navigate');
  if (!rel) return;
  event.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const hit = await cache.match(BASE + rel);
    if (hit) return hit;
    try {
      return (await fetchAndKeep(cache, rel)).response;
    } catch {
      return fetch(req);
    }
  })());
});
