---
title: "Phase 17 — Machine coding: implement it yourself"
sidebar_label: "Overview"
sidebar_position: 0
---

*18 topics.* The brief's **custom functions** requirement, and the round that separates people who
have used JavaScript from people who understand it. Every row is a from-scratch implementation with
the edge cases interviewers probe.

## Status — 🚧 **Master ✅ 4/4 · Understand under way — 13 of 18**

Master (01–04) landed 2026-08-14. The Understand and Know tiers are being written now by
**chunk B** of the four-way JavaScript split, which finished phase 6 first. Next up:
**14 · `promisify`**.

## Topics

| # | Topic | Tier | Status |
|---|---|---|---|
| 01 | **[`map`, `filter`, `reduce`, `forEach` on `Array.prototype`](./01-array-methods/README.md)** | <span className="db-tier t-master">Master</span> | ✅ |
| 02 | **[`call`, `apply` and `bind`](./02-call-apply-bind/README.md)** | <span className="db-tier t-master">Master</span> | ✅ |
| 03 | **[`debounce` and `throttle`](./03-debounce-throttle/README.md)** | <span className="db-tier t-master">Master</span> | ✅ |
| 04 | **[`Promise.all`, `race`, `any`, `allSettled`](./04-promise-combinators/README.md)** | <span className="db-tier t-master">Master</span> | ✅ |
| 05 | **[An `EventEmitter`](./05-eventemitter/README.md)** | <span className="db-tier t-understand">Understand</span> | ✅ |
| 06 | **[Deep clone](./06-deep-clone/README.md)** | <span className="db-tier t-understand">Understand</span> | ✅ |
| 07 | **[A concurrency-limited task queue](./07-task-queue/README.md)** | <span className="db-tier t-understand">Understand</span> | ✅ |
| 08 | **[Retry with backoff, jitter and an `AbortSignal`](./08-retry-backoff/README.md)** | <span className="db-tier t-understand">Understand</span> | ✅ |
| 09 | **[An LRU cache in O(1)](./09-lru-cache/README.md)** | <span className="db-tier t-understand">Understand</span> | ✅ |
| 10 | **[A Promise from scratch](./10-promise-from-scratch/README.md)** | <span className="db-tier t-understand">Understand</span> | ✅ |
| 11 | **[`memoize`](./11-memoize/README.md)** | <span className="db-tier t-understand">Understand</span> | ✅ |
| 12 | **[Deep equality](./12-deep-equality/README.md)** | <span className="db-tier t-understand">Understand</span> | ✅ |
| 13 | **[`curry`, `pipe`, `compose`](./13-curry-pipe-compose/README.md)** | <span className="db-tier t-understand">Understand</span> | ✅ |
| 14–15 | `promisify`, a rate limiter | <span className="db-tier t-understand">Understand</span> | deferred |
| 16–18 | `new`/`Object.create`/`instanceof` by hand, a pub/sub and a reactive `signal`, a virtual-DOM diff in outline | <span className="db-tier t-know">Know</span> | deferred |

## The phase gate

From the syllabus: **you can write `bind`, `debounce`, `Promise.all` and an `EventEmitter` from an
empty file in under thirty minutes, and name the edge case each one hides.** All four are now
written — three as Master topics, and `EventEmitter` as topic 05.

## How these pages are verified

**Documentation-validated** against MDN and the behaviours it specifies — the callback contract and
sparse-array rules, `bind` under `new`, the empty-iterable results for each Promise combinator.
**No page prints a timing**, and no page prints console output, because nothing was run.

## Where this connects

- [Phase 3 · Functions, scope and closures](../phase-3-functions/README.md) — the closures every wrapper here depends on
- [Phase 7 · Asynchronous JavaScript](../phase-7-async/README.md) — promises, microtasks and the event loop
- [Phase 5 · The built-in library](../phase-5-built-in-library/README.md) — the methods being reimplemented
- [Phase 16 · 03 · A problem-solving method](../phase-16-dynamic-programming/03-problem-solving-method/README.md) — the loop to run while writing these under pressure

---

Start → [01 · `map`, `filter`, `reduce`, `forEach`](./01-array-methods/README.md)
