---
title: "12 · Finding a leak"
sidebar_label: "Overview"
sidebar_position: 0
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-15 against MDN — [Memory management](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Memory_management), [`Performance.measureUserAgentSpecificMemory()`](https://developer.mozilla.org/en-US/docs/Web/API/Performance/measureUserAgentSpecificMemory), [`WeakMap`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/WeakMap), [`FinalizationRegistry`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/FinalizationRegistry), [`EventTarget.addEventListener()` § signal](https://developer.mozilla.org/en-US/docs/Web/API/EventTarget/addEventListener) — and Node.js [`process.memoryUsage()`](https://nodejs.org/api/process.html#processmemoryusage), [`v8.writeHeapSnapshot()`](https://nodejs.org/api/v8.html#v8writeheapsnapshotfilename-options), [Diagnostics — memory](https://nodejs.org/en/learn/diagnostics/memory). Documentation-validated; **no timings, no console blocks, and no reproduced tool output**.

The syllabus row is *DevTools heap snapshots, the allocation timeline, retainer paths, and
comparing two snapshots*.

🔴 **The method is a ratio test, not a reading.** Build a cycle you can repeat, compare equivalent
points, and look for object counts that are a multiple of the cycle count. Everything else — the
panels, the columns, the paths — exists to turn that ratio into a line of code.

⚠️ **This topic prints no measurements.** Every number a profiler shows depends on a build, a
browser version and a machine, and none was produced here — so it teaches the procedure and what
each panel *means*.

## Chunks

| # | Chunk | Covers |
|---|---|---|
| 01 | **[Proving there is one](./01-proving-there-is-one.md)** | Leak versus large working set versus lazy collection; the repeatable cycle and discarding the warm-up run; 🔴 **troughs, not peaks**; forcing collection honestly and never depending on it; what each tool actually measures — including `external`/`arrayBuffers` outside the JS heap, and detached DOM nodes; and counting instances as the cheapest possible diagnosis |
| 02 | **[Reading a snapshot](./02-reading-a-snapshot.md)** | The three-snapshot technique and why a snapshot forces a collection first; counts as a multiple of the cycle count; which column to trust; **the retainer path**, and breaking the *leftmost* wrong link; the four recognisable shapes; `Detached` as the first thing to search for; Node's `writeHeapSnapshot` with a request as the cycle; and confirming a fix by a **constant** count |

## Four facts worth carrying out of this topic

- **Rising memory is not a leak.** Rising *troughs* after collection are.
- **Diff, do not browse.** A real heap is almost entirely legitimate; only the comparison isolates
  the leak.
- **Break the leftmost wrong link in the retainer path.** A later one shrinks the leak and leaves
  the object retained.
- **A fix is a constant count across cycles**, not a smaller one — "lower but still rising" is the
  classic false victory.

## Phase gate

You can design the repeatable experiment for a suspected leak, say what you would compare and
why, read a retainer path aloud and name which link you would break — and describe the check you
would leave behind so it cannot regress.

## Where this connects

- [11 · Cost is retention](../11-the-memory-model/02-cost-is-retention.md) — the retainer chain
  and the four anchors this topic recognises in a snapshot
- [11 · Stack and heap](../11-the-memory-model/01-stack-and-heap.md) — shallow versus retained
  size, the columns you are reading
- [04 · Reachability](../04-leaks/01-reachability.md) — why collection timing is unspecified, and
  why a finaliser proves nothing
- [04 · The four leaks](../04-leaks/02-the-four-leaks.md) — the catalogue, at Master depth
- [Phase 7 · 12 · The API and clearing](../../phase-7-async/12-timers/01-the-api.md) — the
  forgotten interval, seen from the other end
- [Phase 7 · 14 · The model](../../phase-7-async/14-cancellation/01-the-model.md) — one
  `AbortController` per scope, the prevention that removes a whole class

---

Start → [01 · Proving there is one](./01-proving-there-is-one.md)
