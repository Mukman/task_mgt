// Intentionally minimal: this app always requires a live connection to the
// database, so there is no offline app-shell or data caching here. The
// service worker's only job is to exist, since some browsers use its
// presence as one of the installability signals for "Add to Home Screen".

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

// No fetch handler: all requests pass straight through to the network.
