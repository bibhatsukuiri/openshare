"use strict";
const CACHE_NAME = "harmonium-pwa-20261117-1";
const scope = self.registration.scope;
const appUrl = new URL("music.html", scope).href;
const precachePaths = [
  "music.html",
  "music.css?v=20261117-pwa1",
  "music.js?v=20261117-pwa1",
  "harmonium.webmanifest",
  "harmonium-192.png",
  "harmonium-512.png",
  "harmonium-180.png",
  "harmonium-icon.svg"
];
self.addEventListener("install", event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    await cache.addAll(precachePaths.map(path => new URL(path, scope).href));
    await self.skipWaiting();
  })());
});
self.addEventListener("activate", event => {
  event.waitUntil((async () => {
    const names = await caches.keys();
    await Promise.all(names.filter(name =>
      name.startsWith("harmonium-pwa-") && name !== CACHE_NAME
    ).map(name => caches.delete(name)));
    await self.clients.claim();
  })());
});
self.addEventListener("fetch", event => {
  const request = event.request;
  if (request.method !== "GET") return;
  const requestUrl = new URL(request.url);
  if (requestUrl.origin !== self.location.origin || !requestUrl.href.startsWith(scope)) return;
  if (request.mode === "navigate") {
    event.respondWith((async () => {
      try {
        const fresh = await fetch(request);
        if (fresh.ok) {
          const cache = await caches.open(CACHE_NAME);
          await cache.put(request, fresh.clone());
        }
        return fresh;
      } catch (error) {
        return (await caches.match(request, { ignoreSearch: true })) ||
          (await caches.match(appUrl)) ||
          Response.error();
      }
    })());
    return;
  }
  event.respondWith((async () => {
    const cached = await caches.match(request);
    if (cached) return cached;
    try {
      const fresh = await fetch(request);
      if (fresh.ok) {
        const cache = await caches.open(CACHE_NAME);
        await cache.put(request, fresh.clone());
      }
      return fresh;
    } catch (error) {
      return (await caches.match(request, { ignoreSearch: true })) || Response.error();
    }
  })());
});
