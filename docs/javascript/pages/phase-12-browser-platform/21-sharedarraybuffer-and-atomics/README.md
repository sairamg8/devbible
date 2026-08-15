---
title: "21 · `SharedArrayBuffer` and `Atomics`"
sidebar_label: "Overview"
sidebar_position: 0
---

<span className="db-tier t-when">When Needed</span>

> Verified: 2026-08-15 against MDN — [`SharedArrayBuffer`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/SharedArrayBuffer), [`Window.crossOriginIsolated`](https://developer.mozilla.org/en-US/docs/Web/API/Window/crossOriginIsolated), [`Cross-Origin-Opener-Policy`](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Cross-Origin-Opener-Policy), [`Cross-Origin-Embedder-Policy`](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Cross-Origin-Embedder-Policy), [`Atomics`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Atomics), [`Atomics.wait()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Atomics/wait), [`WebAssembly.Memory`](https://developer.mozilla.org/en-US/docs/WebAssembly/Reference/JavaScript_interface/Memory). Documentation-validated; **no timings and no console output**.

The syllabus row is *real shared memory, and the COOP/COEP headers you must ship first* — and it is
the phase's only <span className="db-tier t-when">When Needed</span> topic for a reason. This is
the one browser capability whose cost is paid by the **whole page**, before any of it is used.

🔴 **Two agents holding the same bytes is what Spectre needs, so the platform gated it on
cross-origin isolation rather than on a user prompt.** Ship two headers, audit every third party you
load, and only then does `SharedArrayBuffer` exist as a global at all.

## Chunks

| # | Chunk | Covers |
|---|---|---|
| 01 | **[Cross-origin isolation](./01-cross-origin-isolation.md)** | Why the price exists (shared memory disabled in 2018, re-enabled in 2020 behind isolation); COOP `same-origin` + COEP `require-corp` and the `crossOriginIsolated` boolean; ⚠️ the constructor is **hidden**, not merely restricted, without it; 🔴 what enabling it breaks — CDN images, fonts, third-party scripts, iframes, and popup-based OAuth; `COEP: credentialless` as an unverified alternative; when the feature is worth it, and isolating a separate origin so the rest of the site keeps working |
| 02 | **[Shared memory and `Atomics`](./02-shared-memory-and-atomics.md)** | Shared vs copied vs transferred, and why a `SharedArrayBuffer` is **not** transferable; growable-but-never-shrinkable buffers; 🔴 why plain reads and writes are not enough; the `Atomics` method groups; **`Atomics.wait()` throws on the main thread** and `waitAsync` is the answer; data races, hand-built locks, and why the real audience is **WebAssembly threads** |

## Three facts worth carrying out of this topic

- **`crossOriginIsolated` or nothing.** Without it the constructor is not on the global object, and
  every code path needs an `ArrayBuffer` fallback.
- **Sharing is a third `postMessage` behaviour**, alongside copying and transferring — and it is the
  only one where both sides keep the memory.
- **`Atomics` is not an optimisation.** Without it, a write in one agent has no guaranteed
  visibility in another.

## Phase gate

You can move a 500 ms computation into a Web Worker, keep the page responsive, and prove it
in the performance panel.

## Where this connects

- [07 · Web Workers](../07-web-workers/README.md) — the message boundary, and transferables, which
  cover almost everything this topic does not
- [15 · Cross-tab coordination](../15-cross-tab-coordination/README.md) — Web Locks, the easy kind
  of locking
- [13 · What belongs on the server instead](../13-what-belongs-on-the-server/README.md) — COOP and
  COEP are headers, so this feature starts as a server change
- [Phase 5 · 25 · Typed arrays, `ArrayBuffer` and `DataView`](../../phase-5-built-in-library/25-typed-arrays/README.md)
  — the views you read shared memory through

---

Start → [01 · Cross-origin isolation](./01-cross-origin-isolation.md)
