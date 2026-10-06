// Line Net CRM service worker: exists only so phones offer "install as app".
// Deliberately caches nothing: every request goes to the network, so data is always fresh.
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));
self.addEventListener("fetch", () => {
  // No respondWith: the browser handles the request as if there were no worker.
});
