---
title: "07 · Web Workers"
sidebar_label: "Overview"
sidebar_position: 0
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-15 against MDN — [Using Web Workers](https://developer.mozilla.org/en-US/docs/Web/API/Web_Workers_API/Using_web_workers), [`Worker`](https://developer.mozilla.org/en-US/docs/Web/API/Worker), [The structured clone algorithm](https://developer.mozilla.org/en-US/docs/Web/API/Web_Workers_API/Structured_clone_algorithm), [Transferable objects](https://developer.mozilla.org/en-US/docs/Web/API/Web_Workers_API/Transferable_objects). Documentation-validated; **no timings and no console output**.

The syllabus row is *moving CPU work off the main thread, `postMessage`, structured clone cost,
and transferables* — and the order matters, because the second half is what decides whether the
first half was worth doing.

🔴 **A worker is a second JavaScript realm with its own event loop and its own memory.** It
shares nothing with the page; every message is a deep copy unless ownership is explicitly
transferred. It does not make work faster — it makes the **main thread free**, and total work
goes up by the cost of the copies.

## Chunks

| # | Chunk | Covers |
|---|---|---|
| 01 | **[Starting a worker and talking to it](./01-starting-and-talking.md)** | The `new URL(…, import.meta.url)` idiom and module workers; what exists inside and what does not; `postMessage`/`onmessage`; why an error in a worker vanishes and how to make it not; a request/response wrapper with ids; `terminate()` versus `close()`; dedicated, shared and service workers |
| 02 | **[The message boundary](./02-the-message-boundary.md)** | What structured clone copies and what it throws on; class instances losing their prototypes; why the cost is charged on both threads and synchronously on the sender; transferables and detaching; `.buffer`, not the view; `OffscreenCanvas`; `SharedArrayBuffer` and cross-origin isolation; `MessageChannel` between two workers |
| 03 | **[Deciding to use one, and the patterns](./03-deciding-and-patterns.md)** | The three conditions that justify a worker, with the good and bad candidate lists; proving it with `longtask`/LoAF; a worker pool and why `hardwareConcurrency` is a hint; the three levels of cancellation; keeping the worker's data inside the worker |

## Three facts worth carrying out of this topic

- **The message is often the bottleneck, not the work.** Serialisation runs synchronously on the
  calling thread, so posting a large object blocks exactly the thread you were protecting.
- **Class instances arrive as plain objects.** Structured clone copies data, never prototypes —
  send discriminated data and reconstruct.
- **`terminate()` is the only real cancellation.** A worker inside a tight synchronous loop
  cannot receive a cancel message, because messages are tasks there too.

## Phase gate

You can move a 500 ms computation into a Web Worker, keep the page responsive, and prove it
in the performance panel.

## Where this connects

- [06 · 03 · The metrics that matter](../06-performanceobserver/03-the-metrics.md) — the long-task
  and LoAF entries that justify the move, and the INP number that should improve
- [03 · Timers and frames](../03-timers-and-frames/README.md) — why main-thread work stalls
  animation in the first place
- [05 · 01 · Element-level responsiveness](../05-resizeobserver/01-element-level-responsiveness.md)
  — sizing the canvas whose drawing you are about to hand to a worker
- [Phase 8 · 01 · ES modules](../../phase-8-modules-errors/01-es-modules/README.md) — module
  workers, and sharing an algorithm module between page and worker
- **14 · Yielding to the main thread** *(not written yet)* — the cheaper alternative to try first
- **21 · `SharedArrayBuffer` and `Atomics`** *(not written yet)* — genuinely shared memory, and
  the COOP/COEP headers it requires

---

Start → [01 · Starting a worker and talking to it](./01-starting-and-talking.md)
