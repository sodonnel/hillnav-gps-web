const cacheName = "hillnavgps-v8";

const addResourcesToCache = async () => {
    try {
        console.log("Downloading cache manifest");
        const cacheRequest = await fetch("cache_manifest.json");
        const toCache = await cacheRequest.json();
        const cache = await caches.open(cacheName);
        console.log("Service worker adding resources to cache");
        await cache.addAll(toCache);
    } catch (error) {
        console.error(`Error adding resources to cache: ${error}`);
        throw error;
    }
}

self.addEventListener("install", (event) => {
    console.log("Service worker installing...");
    event.waitUntil(
        addResourcesToCache()
    );
});

self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys().then(function (cacheNames) {
            return Promise.all(
                cacheNames.filter(function (existingCache) {
                    if (existingCache.startsWith("hillnavgps-") && existingCache !== cacheName) {
                        console.log("Service worker deleting old cache");
                        return caches.delete(existingCache);
                    }
                })
            );
        }).then(() => {
            console.log(cacheName + " now ready to handle fetches!");
        })
    );
    // If we want the new service worker to take control immediately, instead of waiting for reload/navigation
    // uncomment the following line:
    // event.skipWaiting();
});


self.addEventListener("update", (event) => {
    console.log("Service worker update event...");
})

const cacheMatch = async (request) => {
    const cachedResponse = await caches.match(request);
    if (cachedResponse) return cachedResponse;
    const networkResponse = await fetch(request);
    const cache = await caches.open(cacheName);
    await cache.put(request, networkResponse.clone());
    return networkResponse;
}

self.addEventListener('fetch', (event) => {
    console.log("Service worker fetching.....");
    event.respondWith(cacheMatch(event.request));
});