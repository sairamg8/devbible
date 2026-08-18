---
title: "ThreadLocal and ScopedValue"
sidebar_label: "Overview"
sidebar_position: 0
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-18 against the JDK 25 Javadoc for `ThreadLocal`,
> `InheritableThreadLocal` and `ScopedValue`, and JEP 506 (Scoped Values,
> final in JDK 25).

**Both solve the same problem — getting per-request data (a user, a trace
id, a transaction) to code twenty frames down without threading it through
every signature. `ThreadLocal` solves it with a mutable, per-thread slot
that anyone can set at any time and that lives as long as the thread does —
which is exactly what leaks on pooled threads and multiplies painfully
across a million virtual threads. `ScopedValue` (final in JDK 25) solves
it with an immutable binding whose lifetime is a lexical scope: set once at
the top, readable below, gone when the scope exits, no `remove()` to
forget.**

The chunks:

| # | Chunk | Covers |
|---|---|---|
| 1 | **[`ThreadLocal` — the slot and the leak](01-threadlocal.md)** | The per-thread map, `withInitial`, `set`/`get`/`remove`, the classic uses (request context, non-thread-safe helpers), the pooled-thread leak, `InheritableThreadLocal` and why executors break it, the virtual-thread footprint problem |
| 2 | **[`ScopedValue` — the 25-era replacement](02-scopedvalue.md)** | `where(...).run/call`, one-way immutable bindings, rebinding in nested scopes, inheritance into forked subtasks, what it refuses to do on purpose, migration — and when `ThreadLocal` remains right |

## Why this pairing matters

- **Every framework you use is built on `ThreadLocal`** — Spring's request
  attributes and transactions, logging MDC, security contexts. Its failure
  modes (stale context on a pooled thread, missing context after a thread
  hop) are production incidents you will meet regardless of whether you
  ever write `new ThreadLocal<>()` yourself.
- **Virtual threads changed the economics.** A slot per thread was cheap
  at 200 threads and is a real footprint at a million; per-task threads
  also erase `ThreadLocal`'s value as a cache.
- **`ScopedValue` is the JDK's stated successor for the share-downward
  use case** — new JDK 25 code should reach for it first, and reading it
  requires the scope-bounded mental model, not the slot one.

## Where this connects

- **[Platform vs virtual threads](../02-platform-vs-virtual-threads/README.md)** —
  why the per-thread cost model shifted underfoot.
- **[Race conditions — the cures](../03-race-conditions/03-the-cures.md)** —
  thread confinement is the strategy both of these implement.
- [topic 08 · Structured concurrency](../08-structured-concurrency.md) — the scope
  machinery `ScopedValue` inheritance is designed around.

---

← Prev: [Concurrent collections](../11-concurrent-collections.md) · Index: [Phase 6 — Concurrency](../README.md) · Next → [`ThreadLocal` — the slot and the leak](01-threadlocal.md)
