---
title: "01 · Synchronous vs asynchronous"
sidebar_label: "Overview"
sidebar_position: 0
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-13 against MDN — [JavaScript execution model](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Execution_model). Documentation-validated.

**Your JavaScript runs on one thread. Almost nothing else does.** "JavaScript is
single-threaded" is true of *your code* and false of the platform it runs on, and
keeping those apart explains why a thousand concurrent `fetch` calls are free while one
big `JSON.parse` freezes the page.

## Chunks

| # | Chunk | Covers |
|---|---|---|
| 1 | **[One thread, and what runs elsewhere](./01-one-thread.md)** | Run-to-completion and why it means no locks, asynchronous meaning *"not now"* rather than *"at the same time"*, concurrency vs parallelism, the table of what actually runs off-thread, why `await` suspends the **function** and not the thread, where the never-blocking guarantee stops, and workers as separate agents |

## The one idea

> "whenever a function runs, it cannot be preempted and will run entirely before any
> other code runs" — MDN

That single guarantee is why JavaScript needs no locks **and** why a 200 ms loop freezes
everything. The two are the same fact.

## Phase gate

You are done with this topic when you can say what "single-threaded" is and is not true
of, explain why `await` does not block the thread but also cannot rescue a slow loop, and
name three things that genuinely run off your thread.

## Where this connects

- [02 · The event loop](../02-the-event-loop/README.md) — the mechanism that schedules those jobs
- [Phase 4 · 04 · `structuredClone`](../../phase-4-objects-and-classes/04-shallow-vs-deep-copy/02-structuredclone.md) — the algorithm that moves data to a worker
- [Phase 6 · 02 · Control flow and choosing](../../phase-6-iteration-and-destructuring/02-loop-forms/02-control-flow-and-choosing.md) — sequential vs concurrent `await`

---

Start → [One thread, and what runs elsewhere](./01-one-thread.md)
