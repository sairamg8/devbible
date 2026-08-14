---
title: "Static files"
sidebar_label: "05 · Static files"
sidebar_position: 5
---

<span className="db-tier t-understand">Understand</span>

**`express.static` serves files from a directory. Put it after API routes if the
same app also hosts a SPA, and set cache headers deliberately.**

> Verified: 2026-08-14 against the Express 5 documentation — **no sandbox run**.
> [`express.static`](https://expressjs.com/en/5x/api/express/) defaults, all of which
> this page relies on: `index` **`"index.html"`**, `dotfiles` **`"ignore"`**,
> `fallthrough` **`true`**, `etag` **`true`**, `lastModified` `true`, `maxAge` **`0`**,
> `immutable` `false`, `redirect` `true`, `acceptRanges` `true`, `cacheControl` `true`.
> Two of those explain most surprises: **`maxAge` is `0`**, so assets are revalidated on
> every request until you set it; and **`fallthrough: true`** means a missing file
> *"will cause this middleware to simply call `next()`"* rather than answering 404 —
> which is precisely why the SPA fallback on [page 06](06-spa-fallback.md) works, and
> why an unmatched asset ends up at whatever you registered last.

```js
import express from 'express';
import path from 'node:path';

const app = express();
app.use('/assets', express.static(path.join(process.cwd(), 'public'), {
  maxAge: '1y',
  etag: true,
  index: false,
}));
```

| Option | Notes |
|---|---|
| `maxAge` | Long for hashed filenames; short/none for HTML |
| `etag` | Default weak ETags — fine for many apps |
| `fallthrough` | Whether to `next` on miss |
| `dotfiles` | Express 5 defaults — do not serve secrets |

Prefer a CDN / Nginx for heavy static traffic (infra syllabi). Express static is
fine for small apps and admin UIs.

## Trade-off

Serving the front end from Express keeps deployment to one artifact and one
origin — no CORS, no second host, no separate CDN configuration. That is a real
simplification for a small product, and it is why so many stacks start here.

What it costs is event-loop time spent on bytes that never needed the runtime.
Every asset request occupies the same single thread that serves your API, and
Node is not the fastest static file server available. A CDN or Nginx in front
also gets you edge caching, range requests and compression without any of it
touching your process. **Start with `express.static`; move assets to a CDN when
traffic makes the thread contention visible** — not before, and not on principle.

## Gotchas

**Symptom:** Assets are re-downloaded on every page load despite "caching being on"  
**Cause:** `maxAge` defaults to **`0`** — Express sets validators but no freshness lifetime  
**Fix:** Set `maxAge` explicitly, and pair `immutable: true` with fingerprinted filenames

**Symptom:** A missing image returns your SPA's `index.html` instead of a 404  
**Cause:** `fallthrough: true` sends unmatched requests onward, straight into the
history fallback  
**Fix:** Mount the fallback so it cannot see asset paths, or set `fallthrough: false`
on the asset mount when you want a hard 404

**Symptom:** `.env` or `.git` is reachable in production  
**Cause:** A `dotfiles` setting changed to `"allow"`, or the static root pointed at the
project directory rather than the build output  
**Fix:** Leave `dotfiles` at its `"ignore"` default and serve a dedicated build
directory — never the repository root

**Symptom:** A new deploy shows stale JavaScript for hours  
**Cause:** A long `maxAge` on unfingerprinted filenames  
**Fix:** Long cache only for hashed filenames; keep `index.html` short-lived, since it
is what points at the new hashes

## Interview questions

**★ When should HTML use short cache and JS use long?**  
Fingerprinted assets can be immutable; HTML points at changing hashes.

**★ What is `express.static`'s default `maxAge`, and why does it surprise people?**  
`0`. Caching "works" — `etag` and `Last-Modified` are on by default — but every
request still makes a revalidation round trip. People read 304s as a caching bug
when they are the documented default behaviour.

**What does `fallthrough: true` do, and when would you turn it off?**  
A request that matches no file calls `next()` instead of ending in a 404, which is
what lets a history fallback run afterwards. Turn it off when a mount should be
authoritative — an `/assets` mount where a miss really is a 404.

**Why does mount order matter with `express.static`?**  
It is ordinary middleware. Mounted before your API, a file whose name collides with
a route path wins; mounted after, the routes win. Order is the only thing deciding it.

---

← Prev: [Headers already sent](04-headers-already-sent.md) · Next → [SPA fallback](06-spa-fallback.md)
