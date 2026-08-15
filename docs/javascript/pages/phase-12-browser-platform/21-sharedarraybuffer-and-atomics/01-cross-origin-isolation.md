---
title: "01 · Cross-origin isolation"
sidebar_label: "01 · Cross-origin isolation"
sidebar_position: 1
---

<span className="db-tier t-when">When Needed</span>

> Verified: 2026-08-15 against MDN — [`SharedArrayBuffer`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/SharedArrayBuffer), [`Window.crossOriginIsolated`](https://developer.mozilla.org/en-US/docs/Web/API/Window/crossOriginIsolated), [`Cross-Origin-Opener-Policy`](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Cross-Origin-Opener-Policy), [`Cross-Origin-Embedder-Policy`](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Cross-Origin-Embedder-Policy), [`Cross-Origin-Resource-Policy`](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Cross-Origin-Resource-Policy). Documentation-validated; **no timings and no console output**.

This is the phase's only <span className="db-tier t-when">When Needed</span> topic, and the tier is
the point: **real shared memory is available, and the price is paid by your entire page before a
single byte of it is used.**

## Why the price exists

`SharedArrayBuffer` gives two agents — a page and a worker — the *same* memory. That is also
precisely what a Spectre-class attack needs: shared memory plus a high-resolution clock is enough to
build a timer accurate enough to read across process boundaries. MDN records the outcome plainly:
**shared memory and high-resolution timers were disabled in early 2018 because of Spectre**, and
came back in 2020 behind a new requirement — **cross-origin isolation**.

So the feature is not gated on a permission the user grants. It is gated on your document proving it
is not sharing a process with anything it does not trust.

## The two headers

```http
Cross-Origin-Opener-Policy: same-origin
Cross-Origin-Embedder-Policy: require-corp
```

| Header | What it does |
|---|---|
| **COOP: `same-origin`** | severs the relationship with cross-origin windows that opened you or that you open — no shared browsing-context group |
| **COEP: `require-corp`** | every cross-origin subresource must **explicitly opt in** to being embedded |

Together, and only over HTTPS, they make the document **cross-origin isolated** — which you read as
a boolean:

```js
if (crossOriginIsolated) {
  const sab = new SharedArrayBuffer(1024);
  worker.postMessage(sab);
} else {
  worker.postMessage(new ArrayBuffer(1024));   // 🔴 always have this branch
}
```

⚠️ **Without isolation the constructor is not merely restricted — it is hidden from the global
object**, and `postMessage` throws if you somehow obtain one (for example via
`WebAssembly.Memory`). So `typeof SharedArrayBuffer === 'undefined'` is a real state your code must
handle, not a theoretical one.

## 🔴 What turning it on breaks

This is the part that decides whether the feature is affordable, and it is a page-wide decision, not
a module-level one.

**Under `COEP: require-corp`, every cross-origin subresource must opt in** — with
`Cross-Origin-Resource-Policy: cross-origin` from its own server, or by being fetched with CORS.
Anything that does not simply fails to load:

| Typically affected | What it needs |
|---|---|
| Images and fonts from a CDN | a `CORP` header, or `crossorigin` + CORS |
| Third-party scripts, tags, widgets | the same, from a vendor you do not control |
| Embedded iframes (maps, video, payments, auth) | the embedded document must opt in too |
| Analytics beacons and pixels | the same |

**Under `COOP: same-origin`**, the link between your page and cross-origin popups is cut — which is
exactly how many OAuth and payment flows communicate back with `window.opener` and `postMessage`.

⚠️ **The failure mode is silent breakage in production**: the isolated page loads, and a third-party
widget quietly does not. Roll it out behind measurement — the reporting variants of both headers
exist for that reason — and expect to spend the effort on vendors, not on your own code.

There is also a **`COEP: credentialless`** variant, which loads cross-origin resources without
credentials rather than requiring an explicit opt-in. Support and behaviour differ between engines;
check MDN's compatibility table before choosing it, rather than assuming it is a drop-in relaxation.

## Deciding whether to pay

🔴 **Ask what actually needs shared memory.** The honest list is short:

- **WebAssembly threads.** `WebAssembly.Memory` with `shared: true` — a compiled codebase (ffmpeg,
  SQLite, a game engine, an image or video pipeline) that expects real threads.
- **A large buffer several workers must read at once**, where copying it per worker is the
  bottleneck — video frames, scientific data, a big index.
- **Genuine lock-free coordination** between workers.

**Everything else is better served by `postMessage` and transferables** — an `ArrayBuffer` handed
over with a transfer list moves without copying and needs none of this
([07 · 02 · The message boundary](../07-web-workers/02-the-message-boundary.md)). If you are
reaching for `SharedArrayBuffer` to avoid a structured clone of a modest object, the clone was not
your problem.

## If you do pay, isolate the smallest surface

A common shape is to put the isolated code on **its own origin** — a subdomain or a dedicated page
that hosts the WASM tool — and keep the main application un-isolated. The heavy tool is embedded or
linked; the marketing pages, the auth flow and the third-party widgets keep working. It costs a
navigation and a message boundary, and it saves the audit of every vendor your site loads.

## Gotchas

**Symptom: `SharedArrayBuffer is not defined` in production but fine locally.**
Cause — the local server sends the headers (or you tested on `localhost` with a dev-server config)
and production does not.
Fix — set COOP/COEP at the edge, and assert `crossOriginIsolated` at startup.

**Symptom: `crossOriginIsolated` is `false` even though both headers are set.**
Cause — not a secure context, or a cross-origin subresource that fails the COEP requirement.
Fix — HTTPS, and audit every cross-origin resource for `CORP`/CORS.

**Symptom: images from the CDN stop rendering after enabling COEP.**
Cause — no `Cross-Origin-Resource-Policy` header on those responses.
Fix — have the CDN send `CORP: cross-origin`, or serve them yourself.

**Symptom: an OAuth popup no longer talks back to the opener.**
Cause — `COOP: same-origin` severed the opener relationship.
Fix — a redirect-based flow, or keep that page out of the isolated origin.

**Symptom: `postMessage` throws when sending a buffer.**
Cause — a `SharedArrayBuffer` in a non-isolated context.
Fix — feature-detect and fall back to an `ArrayBuffer`.

## Interview questions

**★ Why does `SharedArrayBuffer` require special headers?**
Because shared memory plus a timer is the raw material of a Spectre-style side-channel attack. It
was disabled in 2018 and re-enabled only for documents that are **cross-origin isolated** — COOP
`same-origin` plus COEP `require-corp`, over HTTPS.

**★ How do you know at runtime whether you can use it?**
The `crossOriginIsolated` boolean. Without isolation the constructor is hidden from the global
object entirely, so the code must have an `ArrayBuffer` path.

**★ What breaks when you enable cross-origin isolation?**
Every cross-origin subresource that has not opted in via `CORP` or CORS — CDN images, fonts,
third-party scripts and iframes — and popup-based flows that rely on `window.opener`.

**★ When is `SharedArrayBuffer` actually the right answer?**
WebAssembly threads, a large buffer several workers must read simultaneously, or genuine lock-free
coordination. For ordinary worker messaging, transferring an `ArrayBuffer` moves it without copying
and needs no isolation.

**★ How do you adopt it without breaking the whole site?**
Put the isolated code on its own origin or page, and leave the main application un-isolated. The
cost is a boundary; the alternative is auditing every third party you load.

---

[Topic index](./README.md) · [02 · Shared memory and `Atomics`](./02-shared-memory-and-atomics.md) →
