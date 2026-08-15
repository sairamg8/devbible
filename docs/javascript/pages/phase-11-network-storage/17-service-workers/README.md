---
title: "17 · Service workers and the Cache API"
sidebar_label: "Overview"
sidebar_position: 17
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-08-15 against MDN — [Using Service Workers](https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API/Using_Service_Workers), [Service Worker API](https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API), [`Cache`](https://developer.mozilla.org/en-US/docs/Web/API/Cache). Documentation-validated; **no timings**.

**A service worker is a proxy you deploy to your users' browsers.** It intercepts requests
from the pages in its scope and may answer them from a cache, which is what makes offline
possible — and what makes a careless one serve a stale app for weeks.

🔴 **Know-tier: recognise the lifecycle and the two rules that catch everyone.** A new worker
**waits** while an old one is active, and it **controls only pages opened after
registration** — including not the page that registered it.

## Chunks

| # | Chunk | Covers |
|---|---|---|
| 1 | **[The lifecycle and the cache](./01-the-lifecycle-and-the-cache.md)** | Registration, the HTTPS rule and how **scope** is limited by the file's location; install → waiting → activate → controlling, and what `skipWaiting()`/`clients.claim()` really cost; `event.waitUntil()`; intercepting with `respondWith()`; cache-first vs network-first and 🔴 **why HTML is never cache-first**; the Cache API, `clone()`, atomic `addAll()` and manual versioning |

## The shape in twelve lines

```js
// page
navigator.serviceWorker.register("/sw.js", { scope: "/" });

// sw.js
self.addEventListener("install", (e) =>
  e.waitUntil(caches.open("v2").then((c) => c.addAll(["/", "/app.js"]))));

self.addEventListener("activate", (e) =>
  e.waitUntil(caches.keys().then((keys) =>
    Promise.all(keys.filter((k) => k !== "v2").map((k) => caches.delete(k))))));

self.addEventListener("fetch", (e) =>
  e.respondWith(caches.match(e.request).then((hit) => hit ?? fetch(e.request))));
```

## Phase gate

You are done with this topic when you can say **why a newly registered worker does not
control the page that registered it**, and **why serving HTML cache-first is a trap**.

## Where this connects

- [01 · `fetch`](../01-fetch/README.md) — the requests a worker intercepts, and the `Request`/`Response` pairs the cache stores
- [16 · IndexedDB](../16-indexeddb/README.md) — where a worker keeps structured state, since it has no `localStorage`
- [14 · 02 · `postMessage`](../14-same-origin-and-postmessage/02-postmessage.md) — how a worker talks to its pages
- [13 · WebSocket](../13-websocket/README.md) — the other reason `https:` is not optional

---

Start → [1 · The lifecycle and the cache](./01-the-lifecycle-and-the-cache.md)
