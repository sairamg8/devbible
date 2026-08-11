---
title: "Phase 2 — Async and the event loop"
sidebar_label: "Overview"
sidebar_position: 0
---

> **Target runtime: Node 24 — the Active LTS as of August 2026.**
> Every example on these pages was executed on **Node 24.19.0**, including every
> output-ordering listing.

**Complete — all 22 pages written.**

The heart of Node. The syllabus says to budget real time here, and it is right:
this phase is worth more than any framework you will learn.

## The loop itself

| # | Page | Tier | In one line |
|---|---|---|---|
| 01 | **[The event loop phases](01-event-loop-phases.md)** | <span className="db-tier t-master">Master</span> | Six phases in a fixed order, and the two queues that are not phases at all |
| 02 | **[The poll phase](02-poll-phase.md)** | <span className="db-tier t-master">Master</span> | Where a server spends its life — asleep at 0% CPU, waiting on the kernel |
| 03 | **[Microtasks and macrotasks](03-microtasks-and-macrotasks.md)** | <span className="db-tier t-master">Master</span> | The full execution picture — and why `nextTick` does *not* always run first |
| 04 | **[setImmediate vs setTimeout](04-setimmediate-vs-settimeout.md)** | <span className="db-tier t-understand">Understand</span> | A coin flip from the main module, a guarantee inside an I/O callback |
| 05 | **[nextTick starvation](05-nexttick-starvation.md)** | <span className="db-tier t-understand">Understand</span> | The one starvation bug you cannot wait out |
| 06 | **[Timers](06-timers.md)** | <span className="db-tier t-understand">Understand</span> | Delays are floors, live timers hold the process open, and `timers/promises` |

## Promises and async/await

| # | Page | Tier | In one line |
|---|---|---|---|
| 07 | **[Promise states and chaining](07-promise-states.md)** | <span className="db-tier t-master">Master</span> | Three states, one transition, and the `return` that decides whether anything is chained |
| 08 | **[Async and await](08-async-await.md)** | <span className="db-tier t-master">Master</span> | Sugar over chaining — and every `await` is a yield to the microtask queue |
| 09 | **[Combinators](09-combinators.md)** | <span className="db-tier t-master">Master</span> | `all` / `allSettled` / `race` / `any`, and which failure mode each one has |
| 10 | **[Sequential vs parallel](10-sequential-vs-parallel.md)** | <span className="db-tier t-master">Master</span> | The `await` in a loop that turned 200ms of work into two seconds |
| 11 | **[Error handling](11-error-handling.md)** | <span className="db-tier t-master">Master</span> | `try`/`catch` with `await`, `.catch()` placement, and when `return await` matters |
| 12 | **[Floating promises](12-floating-promises.md)** | <span className="db-tier t-master">Master</span> | The call nobody awaited — it either dies silently or kills the process |
| 13 | **[Callbacks and promisify](13-callbacks-and-promisify.md)** | <span className="db-tier t-understand">Understand</span> | The error-first convention, and the two functions that bridge it to promises |
| 14 | **[Concurrency control](14-concurrency-control.md)** | <span className="db-tier t-understand">Understand</span> | `Promise.all` waits, it does not limit — the bound has to come from you |
| 15 | **[Unhandled rejections](15-unhandled-rejections.md)** | <span className="db-tier t-understand">Understand</span> | Both process-level events are crash reporters, not error handlers |
| 16 | **[Error design](16-error-design.md)** | <span className="db-tier t-understand">Understand</span> | Codes not messages, `error.cause`, and operational vs programmer errors |
| 17 | **[Promise anti-patterns](17-promise-antipatterns.md)** | <span className="db-tier t-know">Know</span> | Six shapes that survive review and are all strictly worse than the plain version |
| 18 | **[Async iterators](18-async-iterators.md)** | <span className="db-tier t-know">Know</span> | `for await...of`, async generators, and pull-based backpressure for free |

## Cancellation and context

| # | Page | Tier | In one line |
|---|---|---|---|
| 19 | **[AbortController](19-abortcontroller.md)** | <span className="db-tier t-master">Master</span> | Promises cannot be cancelled; this is how you stop work already in flight |
| 20 | **[AsyncLocalStorage](20-asynclocalstorage.md)** | <span className="db-tier t-understand">Understand</span> | Per-request context that survives `await` without touching every signature |
| 21 | **[async_hooks](21-async-hooks.md)** | <span className="db-tier t-when">When Needed</span> | The machinery underneath — and `AsyncResource.bind`, which fixes the common bug |

## CPU-bound work

| # | Page | Tier | In one line |
|---|---|---|---|
| 22 | **[CPU-bound work](22-cpu-bound-work.md)** | <span className="db-tier t-master">Master</span> | Node's one real weakness, and why the fix is never `async` |

## Coverage — all 26 syllabus rows

26 rows map to 22 pages, with four merges:

| Merged row | Landed on |
|---|---|
| Call stack → task queue → microtask queue | 03, with microtasks vs macrotasks |
| `AbortSignal.timeout()` / `any()`; threading a signal | 19, with `AbortController` |
| `AsyncResource` | 21, with `async_hooks` |
| Escape hatches: chunking, worker threads, offloading | 22, with recognizing CPU-bound work |

## Phase gate

**Move on when** you can hand-predict the output order of a script mixing
`process.nextTick`, `queueMicrotask`, a resolved promise, `setTimeout(…, 0)` and
`setImmediate` — and explain *why* each lands where it does.

Pages 01, 03 and 04 are what that gate tests. Note that a complete answer now has
to include the wrinkle on page 03: `nextTick` priority depends on whether you are
already inside a microtask, which is why the same script prints a different order
as `.cjs` and as `.js`.

## Where this connects

- **Phase 0 — The runtime model** showed the *symptom* of a blocked loop. This
  phase is the mechanism.
- **Phase 1 — Modules** introduced top-level `await` and dynamic `import()` as
  syntax; here they are event loop citizens.
- **Phase 5 — Processes** covers `worker_threads` and `cluster` properly.
- **Phase 10 — Observability** turns event loop delay into an alert.

---

← Syllabus: [Part 1 — Foundations](../../syllabus/01-foundations.md) · Start → [The event loop phases](01-event-loop-phases.md)
