const cacheName = "hillnavgps-CACHEBUST";

// Everything the app needs is precached at install time from cache_manifest.json, which the
// build generates. Each build gets its own cache, so a page and its assets always come from
// the same build, and the app works with no signal.
const precache = async () => {
    const response = await fetch("cache_manifest.json", { cache: "no-store" });
    if (!response.ok) {
        throw new Error(`Unable to fetch cache manifest: ${response.status}`);
    }
    const urls = await response.json();
    const cache = await caches.open(cacheName);
    // Bypass the HTTP cache so a new build never precaches stale files. addAll fails if any
    // file fails to download, so a partly cached build is never installed.
    await cache.addAll(urls.map((url) => new Request(url, { cache: "reload" })));
};

self.addEventListener("install", (event) => {
    event.waitUntil(precache());
});

self.addEventListener("activate", (event) => {
    event.waitUntil((async () => {
        const names = await caches.keys();
        await Promise.all(names
            .filter((name) => name.startsWith("hillnavgps-") && name !== cacheName)
            .map((name) => caches.delete(name)));
        // Take control of the page that installed this worker, so it works offline without a reload
        await self.clients.claim();
    })());
});

// A new version waits until the page asks it to take over, after the user accepts the update
self.addEventListener("message", (event) => {
    if (event.data === "SKIP_WAITING") {
        self.skipWaiting();
    }
});

const cacheFirst = async (request) => {
    const cache = await caches.open(cacheName);
    // The cache is per build, so the query string (only a buster for the HTTP cache) is ignored
    const cached = await cache.match(request, { ignoreSearch: true });
    if (cached) {
        return cached;
    }
    if (request.mode === "navigate") {
        // Any page load, including "/", gets the app
        const index = await cache.match("index.html", { ignoreSearch: true });
        if (index) {
            return index;
        }
    }
    return fetch(request);
};

self.addEventListener("fetch", (event) => {
    const url = new URL(event.request.url);
    if (event.request.method !== "GET" || url.origin !== self.location.origin) {
        return;
    }
    event.respondWith(cacheFirst(event.request));
});
