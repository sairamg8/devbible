---
title: "06 · The hosts you write for"
sidebar_label: "06 · Hosts and globals"
sidebar_position: 6
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 on **Node 24.19.0**. Script: `sandbox/js-p0/ex4-hosts.mjs`.
> The browser column below is documented behaviour, not measured here —
> see the [verification policy](../README.md#how-these-pages-are-verified).

The same JavaScript runs in at least four places in a normal fullstack project,
and they do not offer the same globals. Knowing the map is what lets you write a
`formatPrice` or a `fetchJson` **once** and use it on the server and the client.

## The four hosts

| Host | Runs | Has | Lacks |
|---|---|---|---|
| **Browser main thread** | Your UI | DOM, `window`, `document`, `localStorage`, `history` | `process`, `fs`, raw sockets |
| **Web Worker** | Background CPU work | `self`, `fetch`, `postMessage`, most web APIs | **DOM**, `window`, `localStorage` |
| **Node** | Server, tooling, tests | `process`, `fs`, `net`, `Buffer`, plus most web APIs | DOM, `window`, `localStorage` |
| **Edge runtime** (Workers, Deno Deploy, Vercel Edge) | Middleware, SSR at the CDN | Web APIs only | `fs`, `process` (mostly), native modules |

A Web Worker having no DOM is the constraint people hit first: you can move a
price-recalculation loop off the main thread, but the worker cannot touch the
page. It computes and posts a message back. Phase 12 covers the mechanics.

## The measured map

```
language (spec):
  Object=true Array=true Promise=true Map=true Symbol=true JSON=true Math=true Intl=true globalThis=true
web platform in node 24:
  fetch=true URL=true URLSearchParams=true AbortController=true Headers=true Request=true Response=true structuredClone=true queueMicrotask=true TextEncoder=true crypto=true Blob=true FormData=true EventTarget=true ReadableStream=true WebSocket=true performance=true setTimeout=true
browser-only:
  window=false document=false localStorage=false history=false navigator=true IntersectionObserver=false requestAnimationFrame=false XMLHttpRequest=false alert=false
node-only (in ESM):
  process=true Buffer=true require=false __dirname=false module=false
```

The middle block is the useful one. **Every web API in that list is available in
Node 24**, which is what makes a shared `fetch` wrapper possible without a shim.

## The shared surface, in practice

These work identically in browser, worker, Node and edge, so code using only
them is portable by construction:

| API | What you use it for in a storefront |
|---|---|
| `fetch`, `Request`, `Response`, `Headers` | Every API call, on both sides of SSR |
| `URL`, `URLSearchParams` | Building product-list URLs with filters |
| `AbortController`, `AbortSignal` | Cancelling a stale search request |
| `FormData`, `Blob` | Review photo uploads |
| `structuredClone` | Deep-copying cart state |
| `TextEncoder`/`TextDecoder` | Byte-accurate string handling |
| `crypto.randomUUID`, `crypto.subtle` | Idempotency keys, hashing |
| `EventTarget`, `CustomEvent` | Framework-free pub/sub |
| `ReadableStream` | Streaming a large response |
| `queueMicrotask`, `setTimeout`, `performance.now` | Scheduling and measuring |
| `Intl.*` | Prices, dates, plurals per locale |

**Write shared utilities against this list only.** The moment a shared module
touches `window` or `process`, it stops being shared.

## `navigator` is the trap

```
browser-only:
  window=false  document=false  localStorage=false  navigator=true  ...
```

`navigator` is `true` **in Node**. Node 21 added a minimal `navigator`
(`navigator.userAgent`, `navigator.hardwareConcurrency`), so the historically
common browser check is now wrong:

```js
// BROKEN on Node 21+ — this branch runs on the server
if (typeof navigator !== 'undefined') {
  // "we must be in a browser"
}

// Correct — test for the thing you actually need
const hasDom = typeof document !== 'undefined';
const canStore = typeof localStorage !== 'undefined';
```

Test for the **capability**, never for the environment. That is the whole of
[10 · Feature detection](./10-feature-detection.md).

## Writing a module that runs in both

```js
// lib/format.js — safe everywhere: language + Intl only
export function formatPrice(minorUnits, currency = 'INR', locale = 'en-IN') {
  return new Intl.NumberFormat(locale, { style: 'currency', currency })
    .format(minorUnits / 100);
}

// lib/storage.js — needs a browser API, so it degrades explicitly
const memory = new Map();

const hasLocalStorage = (() => {
  try {
    if (typeof localStorage === 'undefined') return false;
    localStorage.setItem('__probe', '1');   // Safari private mode throws here
    localStorage.removeItem('__probe');
    return true;
  } catch {
    return false;
  }
})();

export function saveCart(cart) {
  const json = JSON.stringify(cart);
  if (hasLocalStorage) localStorage.setItem('cart', json);
  else memory.set('cart', json);          // SSR and private mode both land here
}

export function loadCart() {
  const json = hasLocalStorage ? localStorage.getItem('cart') : memory.get('cart');
  return json ? JSON.parse(json) : { items: [] };
}
```

Two things this gets right. The probe **writes** rather than only checking that
the name exists — Safari private mode defines `localStorage` and then throws on
`setItem`, so an existence check is not enough. And the fallback is a real
in-memory store, so the cart still works during SSR instead of crashing the
render.

## Globals that are *not* the global object

`globalThis` names the global object in every host. But three things people
reach for on it are not on it in a module:

```
node-only (in ESM):
  process=true Buffer=true require=false __dirname=false module=false
```

`require`, `__dirname` and `module` are **CommonJS module bindings**, not
globals. They do not exist in an ES module in any runtime. The ESM equivalents:

| CommonJS | ES module |
|---|---|
| `__dirname` | `import.meta.dirname` |
| `__filename` | `import.meta.filename` |
| `require('x')` | `import x from 'x'` or `await import('x')` |
| `module.exports` | `export` / `export default` |

## Gotchas

**Symptom:** `ReferenceError: localStorage is not defined` during SSR or a
Next.js build.
**Cause:** the module body ran on the server host.
**Fix:** move the access into a client-only effect, or guard with a capability
probe as above. Do not guard with `typeof navigator`.

**Symptom:** `QuotaExceededError` from `localStorage.setItem` in Safari private
browsing, even though `localStorage` exists.
**Cause:** the API is present but every write throws.
**Fix:** probe with a real write inside `try`/`catch`, once, at module load.

**Symptom:** code moved into a Web Worker throws on `document`.
**Cause:** workers have no DOM by design.
**Fix:** keep DOM work on the main thread; the worker returns data via
`postMessage` and the main thread renders it.

**Symptom:** a shared utility works in the browser bundle and breaks on the edge
runtime.
**Cause:** it reached for `process.env` or a Node built-in.
**Fix:** restrict shared modules to the web-platform surface listed above; pass
configuration in as arguments rather than reading the environment inside.

## Interview questions

**★ How do you write code that runs in both Node and the browser?**
Restrict it to the language plus the shared web-platform surface — `fetch`,
`URL`, `AbortController`, `structuredClone`, `Intl`, `crypto`, `TextEncoder`.
Push anything host-specific to the edges of the module and inject it. Where a
capability may be missing, probe for the capability with a real operation, not
for the environment name.

**★ Why is `typeof navigator !== 'undefined'` a bad browser check?**
Because Node 21+ defines `navigator`, so it is `true` on the server —
measured `true` on Node 24.19.0. It never tested for a browser, only for a name.
Test for what you need: `document` for DOM, `localStorage` for storage.

**What does a Web Worker not have, and why does that matter?**
No DOM, no `window`, no `localStorage`. It exists to keep long computation off
the main thread, so it is deliberately denied the ability to touch the page.
Work is sent in and results come back through `postMessage`.

**Why do `__dirname` and `require` not exist in an ES module?**
They are CommonJS module-system bindings, not globals. ESM provides
`import.meta.dirname`, `import.meta.filename` and static or dynamic `import`
instead.

**What is `globalThis` for?**
One name for the global object across every host — `window` in a browser, `self`
in a worker, `global` in Node. Before it existed, portable library code had to
sniff all three, and the sniffing broke under bundlers and strict CSP.

---

← [05 · ECMAScript and TC39](./05-ecmascript-and-tc39.md) · [Phase index](./) · Next: [07 · Loading scripts](./07-loading-scripts.md) →
