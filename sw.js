// SDA Sabbath service worker: installs the whole app (Bibles, hymns, fonts, pdf.js) in one go
// so it runs with no internet. VERSION is rewritten by tools/build.py on every build.
const VERSION = 'c22ca43c7dbd';
const CACHE = 'selah-' + VERSION; // prefix kept from the first name so old caches are found and removed
const NETWORK_ONLY = /\/(api|media|ws)(\/|$)/;

async function broadcast(msg) {
  const cs = await self.clients.matchAll({ includeUncontrolled: true });
  cs.forEach((c) => c.postMessage(msg));
}

self.addEventListener('install', (event) => {
  // First install: take over at once. Updates wait until the operator presses "Update now"
  // (the page sends {t:'skip'}), so a running service is never switched mid-way.
  if (!self.registration.active) self.skipWaiting();
  event.waitUntil((async () => {
    const manRes = await fetch('asset-manifest.json?v=' + VERSION, { cache: 'no-store' });
    const cache = await caches.open(CACHE);
    // Keep the file list too: the app reads it offline (offline status, optional licensed Bibles).
    await cache.put('asset-manifest.json', manRes.clone());
    const man = await manRes.json();
    const files = man.files;
    const hashes = man.hashes || {};
    const older = (await caches.keys()).filter((k) => k.startsWith('selah-') && k !== CACHE);
    // A file whose content did not change is copied from the previous version's cache, so an
    // update only downloads what is new (the instruments and hymn music are 18 MB).
    async function unchanged(f) {
      const want = hashes[f];
      if (!want) return null;
      for (const k of older) {
        const r = await (await caches.open(k)).match(f);
        if (r && r.headers.get('x-selah-hash') === want) return r;
      }
      return null;
    }
    async function stamp(f, r) {
      if (!hashes[f]) return r;
      const hd = new Headers(r.headers);
      hd.set('x-selah-hash', hashes[f]);
      return new Response(await r.blob(), { status: 200, statusText: 'OK', headers: hd });
    }
    let done = 0;
    const failed = [];
    async function get(f) {
      const old = await unchanged(f);
      if (old) { await cache.put(f, old); return true; }
      const r = await fetch(f, { cache: 'no-cache' });
      if (!r.ok) return false;
      await cache.put(f, await stamp(f, r));
      return true;
    }
    // Small batches keep memory and connections low on weak devices.
    for (let i = 0; i < files.length; i += 6) {
      await Promise.all(files.slice(i, i + 6).map(async (f) => {
        let ok = false;
        try { ok = await get(f); } catch (e) { ok = false; }
        if (!ok) failed.push(f);
        done++;
      }));
      broadcast({ t: 'progress', done, total: files.length });
    }
    // Weak church Wi-Fi: try the files that failed once more, a little later, one at a time.
    if (failed.length) {
      await new Promise((r) => setTimeout(r, 3000));
      for (const f of failed) { try { await get(f); } catch (e) { /* fetched and cached when first used */ } }
    }
    // The page asks before switching versions, so a service is never interrupted.
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((k) => k.startsWith('selah-') && k !== CACHE).map((k) => caches.delete(k)));
    await self.clients.claim();
    broadcast({ t: 'progress', done: 1, total: 1 });
  })());
});

self.addEventListener('message', (e) => { if (e.data && e.data.t === 'skip') self.skipWaiting(); });

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== location.origin || NETWORK_ONLY.test(url.pathname)) return;
  if (req.headers.get('range')) return; // media byte ranges go to the network / companion
  event.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const isPage = req.mode === 'navigate' || /\.html$/.test(url.pathname);
    let hit = await cache.match(req, { ignoreSearch: isPage });
    if (!hit && isPage) hit = await cache.match(req, { ignoreSearch: true });
    if (!hit && req.mode === 'navigate') hit = await cache.match('index.html');
    if (hit) return hit;
    try {
      const res = await fetch(req);
      // Keep app files that were missed during install (weak Wi-Fi) and extra data (licensed Bibles
      // added later), so they work offline next time.
      if (res.ok && res.type === 'basic' && !isPage && /\/(data|js|css|fonts|vendor|icons)\//.test(url.pathname)) cache.put(req, res.clone()).catch(() => {});
      return res;
    } catch (e) {
      return new Response('Offline and not cached: ' + url.pathname, { status: 503, headers: { 'Content-Type': 'text/plain' } });
    }
  })());
});
