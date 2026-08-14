---
title: "02 · The event loop"
sidebar_label: "Overview"
sidebar_position: 0
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-13 against MDN — [JavaScript execution model](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Execution_model). Documentation-validated.

**Three data structures and a loop.** MDN describes an agent as maintaining a **heap** of
objects, a **stack** of execution contexts, and a **queue** of jobs — and the loop pulls
one job at a time, runs it to completion, and pulls the next.

The sentence that explains almost every async surprise:

> "A job is considered completed when the stack is empty." — MDN

## Chunks

| # | Chunk | Covers |
|---|---|---|
| 1 | **[Stack, queue, heap](./01-stack-queue-heap.md)** | The three facilities and the loop MDN describes, tracing `A D C B` through it, why `setTimeout(fn, 0)` is a **minimum** and a 1-second loop delays a 10 ms timer by a second, where jobs come from, the stack and why tail recursion still overflows, and how Node and the browser differ |

## Phase gate

You are done with this topic when you can predict the output of a `setTimeout` /
`Promise.then` / synchronous mix, say when a job is considered complete, and explain why
timer delays are a floor rather than a schedule.

## Where this connects

- [01 · Synchronous vs asynchronous](../01-sync-vs-async/README.md) — run-to-completion, and what runs off-thread
- [03 · Microtasks vs macrotasks](../03-microtasks-vs-macrotasks/README.md) — the exact drain order this topic only sketches
- [Phase 0 · How JavaScript runs](../../phase-0-how-javascript-runs/README.md) — the engine underneath

---

Start → [Stack, queue, heap](./01-stack-queue-heap.md)
