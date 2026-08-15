---
title: "1 · The lifecycle and the cache"
sidebar_label: "1 · Lifecycle and cache"
sidebar_position: 1
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-08-15 against MDN — [Using Service Workers](https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API/Using_Service_Workers), [Service Worker API](https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API), [`ServiceWorkerContainer.register()`](https://developer.mozilla.org/en-US/docs/Web/API/ServiceWorkerContainer/register), [`FetchEvent.respondWith()`](https://developer.mozilla.org/en-US/docs/Web/API/FetchEvent/respondWith), [`Cache`](https://developer.mozilla.org/en-US/docs/Web/API/Cache), [`CacheStorage`](https://developer.mozilla.org/en-US/docs/Web/API/CacheStorage). Documentation-validated; **no timings**.

**A service worker is a script the browser keeps, that sits between your pages and the
network.** Once installed it can answer requests from a cache, which is what makes an app
work offline — and, for the same reason, what makes a bad one serve stale code for weeks.

🔴 **It is a proxy you deployed, not a library you imported.** That single framing explains
every rule below: the HTTPS requirement, the scope, the two-phase lifecycle, and why an
update does not take effect on the page that fetched it.

## Registration

```js
if ("serviceWorker" in navigator) {
  const registration = await navigator.serviceWorker.register("/sw.js", { scope: "/" });
}
```

- **HTTPS only**, with `localhost` exempt for development — the same shape of rule as
  WebSocket's `wss:` ([13 · 01](../13-websocket/01-connecting.md)), and for the same reason:
  a man-in-the-middle who can install a proxy owns the site permanently.
- **Scope defaults to the directory the worker file is served from**, and **cannot be broader
  than that location** without the `Service-Worker-Allowed` header. That is why `sw.js` lives
  at the root: a worker served from `/js/sw.js` can only control `/js/`.
- **It is a worker**: `ServiceWorkerGlobalScope`, **no DOM access**, no `window`, no
  `localStorage`. It talks to pages with `postMessage`
  ([14 · 02](../14-same-origin-and-postmessage/02-postmessage.md)) and stores state in the
  Cache API or IndexedDB ([16 · 01](../16-indexeddb/01-the-shape-of-it.md)).

## The lifecycle, and why your update is not live

```
register → install → (waiting) → activate → controlling
```

```js
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open("v2").then((cache) => cache.addAll(["/", "/app.js", "/app.css"]))
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== "v2").map((k) => caches.delete(k)))
    )
  );
});
```

🔴 **Two rules cause almost all service-worker confusion:**

1. **A new worker installs, then *waits*.** While an old version is still active it stays in
   `waiting` — it does not take over mid-session, deliberately, so a page never swaps its
   proxy underneath itself.
2. **A worker "controls pages opened after successful registration"** — MDN's words —
   **"existing pages must be reloaded to be controlled"**. The very page that registered it
   is not controlled by it.

**The two escape hatches, and what each costs:**

| Call | Effect | Cost |
|---|---|---|
| `self.skipWaiting()` | the new worker activates immediately instead of waiting | a live page can suddenly be served by a worker whose cache expects a *different* app version |
| `clients.claim()` (in `activate`) | takes control of already-open pages | same risk: the page's JavaScript and the worker's assets can disagree |

⚠️ **Using both together is the standard "make my update apply now" recipe, and it is a
correctness trade, not a free win.** The safer pattern is to detect the waiting worker, tell
the user, and `skipWaiting()` only on their reload.

**`event.waitUntil()` is what keeps the worker alive** across the async work in `install` and
`activate` — a worker without it can be killed before its caches are populated. The same
applies to `event.waitUntil()` inside `fetch` for the write-behind cache update below.

## Intercepting requests

```js
self.addEventListener("fetch", (event) => {
  event.respondWith(cacheFirst(event.request));
});
```

**`respondWith()` replaces the browser's own fetch for that request** — you return a
`Response`, from anywhere: a cache, the network, or one you construct.

**Cache-first** — MDN's recommendation "for static assets":

```js
const cacheFirst = async (request) => {
  const cached = await caches.match(request);
  if (cached) return cached;
  return fetch(request);
};
```

**Network-first** — "recommended for dynamic content":

```js
const networkFirst = async (request) => {
  try { return await fetch(request); }
  catch { return caches.match(request); }
};
```

🔴 **Never cache-first your HTML.** Cache-first on the document means a user can be pinned to
an old app shell indefinitely, and the fix requires them to clear site data. Static
fingerprinted assets are cache-first; the document is network-first with a cached fallback.

## The Cache API

```js
const cache = await caches.open("v2");
await cache.addAll(["/", "/app.js"]);        // fetch and store, all-or-nothing
await cache.put(request, response);          // store a response you already have
const hit = await caches.match(request);     // search every cache
await caches.delete("v1");
```

**It stores `Request`/`Response` pairs, not strings** — headers and status included, which is
why it can answer a `fetch` directly.

🔴 **A `Response` body is a stream and can only be read once**, so caching a response you are
also returning requires `response.clone()`:

```js
const fresh = await fetch(request);
event.waitUntil(putInCache(request, fresh.clone()));   // ✅ clone before returning
return fresh;
```

⚠️ **`cache.addAll()` is atomic — if any URL fails, nothing is cached** and the `install`
rejects, leaving the worker uninstalled. One typo'd path breaks the whole offline story,
silently, which is why the asset list belongs in the build rather than hand-written.

⚠️ **Cache versioning is manual.** The convention above — a new cache name per release,
deleting the rest in `activate` — is the whole update mechanism; nothing expires on its own.

**And the Cache API is not the HTTP cache.** It is a separate, origin-scoped, quota-managed
store that ignores `Cache-Control`; nothing enters or leaves it except by your code.

## What else a service worker does

**Beyond offline, it is the entry point for the background capabilities** — Push, Background
Sync, and periodic sync — because it is the only script the browser can run when your page is
closed. Those are separate topics; what matters here is *why* they all hang off it.

## Gotchas

**Symptom → cause → fix.**

- **Registration silently does nothing** → not HTTPS (and not `localhost`) → serve over TLS.
- **The worker controls nothing after registering** → pages are controlled only if opened
  after registration → reload, or use `clients.claim()` deliberately.
- **A deployed fix does not reach users** → the new worker is stuck in `waiting` behind an
  open tab → prompt for reload and `skipWaiting()` then, or accept the next-visit delay.
- **Users are stuck on an old app version indefinitely** → the HTML was served cache-first →
  network-first for documents, cache-first only for fingerprinted assets.
- **The worker cannot control `/`** → it is served from a subdirectory, so its scope is that
  directory → serve it from the root or send `Service-Worker-Allowed`.
- **`install` never completes and offline never works** → one URL in `addAll` 404s, and
  `addAll` is all-or-nothing → generate the list at build time.
- **`TypeError: body stream already read`** → the response was returned and cached without
  cloning → `response.clone()` before caching.
- **Cached assets are never cleaned up** → nothing expires automatically → version the cache
  name and delete the others in `activate`.
- **Nothing works in the worker that touches the DOM** → there is no DOM in a worker →
  `postMessage` to a page, or store in IndexedDB.

## Interview questions

**Why does a service worker require HTTPS?** Because it is a persistent proxy for the origin.
Anyone able to inject one over a plaintext connection could intercept every request from that
origin, permanently; `localhost` is exempted for development only.

**Why doesn't a new service worker take effect immediately?** A new version installs and then
waits while an old one is still controlling pages, so a running page never has its proxy
replaced mid-session. `skipWaiting()` and `clients.claim()` override that, at the cost of a
page potentially running with assets from a different version.

**Which page does a newly registered worker control?** None of the currently open ones,
including the page that registered it — control begins with pages opened afterwards, unless
`clients.claim()` is called.

**What is the difference between the Cache API and the HTTP cache?** The Cache API is an
explicit, origin-scoped store of `Request`/`Response` pairs that your code fully controls and
that ignores `Cache-Control`. The HTTP cache is the browser's own, driven by headers.

**Why must a response be cloned before caching?** Its body is a stream that can only be
consumed once — returning it to the page and writing it to the cache are two consumptions.

**Which caching strategy for which resource?** Cache-first for fingerprinted static assets;
network-first with a cached fallback for documents and dynamic data. Cache-first HTML is how
users get stranded on an old build.

---

← [Overview](./README.md) · [Phase 11](../README.md)
