---
title: "CompletableFuture"
sidebar_label: "Overview"
sidebar_position: 0
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-18 against the JDK 25 Javadoc for `CompletableFuture`,
> `CompletionStage`, `CompletionException` and `ForkJoinPool.commonPool`,
> and the JDK 25 Core Libraries virtual-threads guide (on when blocking
> style replaces async composition).

**`Future.get` gave you one move: block. `CompletableFuture` adds the
other two — *compose* ("when this finishes, do that") and *combine*
("when all/any of these finish, join them") — which is exactly what a
service call fanning out to three downstreams needs. The price is a
second exception model (`CompletionException` wrapping), a subtle rule
about *which thread runs your callback*, and a cancellation story weaker
than `Future`'s. Virtual threads have since taken back much of its
territory: know the API, and know when plain blocking code on cheap
threads reads better.**

This topic runs deeper than one file. The chunks:

| # | Chunk | Covers |
|---|---|---|
| 1 | **[Creating and composing](01-creating-and-composing.md)** | `supplyAsync` and the commonPool caveat, `thenApply` vs `thenCompose` vs `thenCombine`, which thread runs a callback, the `-Async` variants |
| 2 | **[Fan-out: `allOf`, `anyOf`, timeouts](02-fan-out-allof-anyof-timeouts.md)** | The three-services join pattern, `allOf`'s `Void` result and the re-join idiom, `anyOf` semantics, `orTimeout`/`completeOnTimeout` |
| 3 | **[Failure, cancellation, and when not to](03-failure-cancellation-when-not.md)** | `exceptionally`/`handle`/`whenComplete`, `CompletionException` vs `ExecutionException`, why `cancel` doesn't interrupt, choosing blocking-on-virtual-threads over chains |

## Where this connects

- **[Submit and Futures](../06-executorservice-pools/02-submit-and-futures.md)** —
  the blocking baseline this API composes past; thread-starvation
  deadlock is what non-blocking composition avoids on bounded pools.
- **[Platform vs virtual threads](../02-platform-vs-virtual-threads/README.md)** —
  the reason the "when not to" chunk exists: cheap blocking changes the
  trade.
- **[Custom exceptions and translation](../../phase-5-exceptions/04-custom-exceptions-translation.md)** —
  unwrapping `CompletionException`/`ExecutionException` causes at the
  boundary is the same translation discipline.
- **Structured concurrency** — topic 08 replaces hand-rolled fan-out
  lifetimes with scoped ones.

---

← Prev: [`ExecutorService` and pools](../06-executorservice-pools/README.md) · Index: [Phase 6 — Concurrency](../README.md) · Next → [Creating and composing](01-creating-and-composing.md)
