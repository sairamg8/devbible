---
title: "Phase 7 — Asynchronous JavaScript"
sidebar_label: "Overview"
sidebar_position: 0
---

*22 topics.* **The centre of gravity of the whole syllabus.** As the syllabus puts it:
*"If you only ever finish one phase to Master depth, finish that one — it is what every
interview probes and what every production incident traces back to."*

## Status — **Master tier COMPLETE** (2026-08-14)

**Master tier first.** Phase 7 has **eleven** Master topics — 01 through 11 — more than
any other phase. They are being written in syllabus order. **ALL 11 DONE — the Master tier of phase 7 is COMPLETE.**

## Topics

| # | Topic | Tier | Status |
|---|---|---|---|
| 01 | **[Synchronous vs asynchronous](./01-sync-vs-async/README.md)** | <span className="db-tier t-master">Master</span> | ✅ |
| 02 | **[The event loop](./02-the-event-loop/README.md)** | <span className="db-tier t-master">Master</span> | ✅ |
| 03 | **[Microtasks vs macrotasks](./03-microtasks-vs-macrotasks/README.md)** | <span className="db-tier t-master">Master</span> | ✅ |
| 04 | **[Callbacks](./04-callbacks/README.md)** | <span className="db-tier t-master">Master</span> | ✅ |
| 05 | **[Promises](./05-promises/README.md)** | <span className="db-tier t-master">Master</span> | ✅ |
| 06 | **[Chaining](./06-chaining/README.md)** | <span className="db-tier t-master">Master</span> | ✅ |
| 07 | **[`async`/`await`](./07-async-await/README.md)** | <span className="db-tier t-master">Master</span> | ✅ |
| 08 | **[Error handling in async code](./08-error-handling/README.md)** | <span className="db-tier t-master">Master</span> | ✅ |
| 09 | **[Sequential vs parallel `await`](./09-sequential-vs-parallel/README.md)** | <span className="db-tier t-master">Master</span> | ✅ |
| 10 | **[`Promise.all` vs `allSettled` vs `race` vs `any`](./10-combinators/README.md)** | <span className="db-tier t-master">Master</span> | ✅ |
| 11 | **[Promise anti-patterns](./11-anti-patterns/README.md)** | <span className="db-tier t-master">Master</span> | ✅ |
| 12–22 | Cancellation, timers, generators-as-async, workers, and the rest | Understand / Know | deferred |

## How these pages are verified

**Documentation-validated** — no new measurement sandboxes. Each page's `> Verified:`
line names the MDN pages and specification sections it was checked against.

🔴 **Ordering claims are held to the documentation.** Where Node and the browser
implement different event loops, these pages assert only what both agree on — "microtasks
drain before tasks" — and name the runtime explicitly for anything narrower. **No run
means no console block**, so no page here prints an interleaving nobody produced.

## Where this connects

- [Phase 0 · How JavaScript runs](../phase-0-how-javascript-runs/README.md) — the engine and the runtime underneath
- [Phase 6 · 02 · Control flow and choosing](../phase-6-iteration-and-destructuring/02-loop-forms/02-control-flow-and-choosing.md) — sequential vs concurrent `await`, introduced there
- [Phase 5 · 04 · Callbacks, holes and async](../phase-5-built-in-library/04-array-iteration-methods/02-callbacks-holes-and-async.md) — the `forEach(async …)` trap

---

Start → [01 · Synchronous vs asynchronous](./01-sync-vs-async/README.md)
