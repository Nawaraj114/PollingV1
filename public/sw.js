const APP_SHELL_CACHE = "friendcircle-shell-v1";
const OFFLINE_URL = "/offline.html";
const PUBLIC_SHELL = [
  OFFLINE_URL,
  "/icons/friendcircle-192.png",
  "/icons/friendcircle-512.png",
  "/icons/friendcircle-maskable-512.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(APP_SHELL_CACHE)
      .then((cache) => cache.addAll(PUBLIC_SHELL))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter(
              (key) =>
                key.startsWith("friendcircle-shell-") &&
                key !== APP_SHELL_CACHE,
            )
            .map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  if (
    event.request.method !== "GET" ||
    event.request.mode !== "navigate"
  ) {
    return;
  }

  event.respondWith(
    fetch(event.request).catch(async () => {
      const offlineResponse = await caches.match(OFFLINE_URL);
      return offlineResponse ?? Response.error();
    }),
  );
});
