---
title: "04 · Leaks you will actually cause"
sidebar_label: "Overview"
sidebar_position: 0
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-14 against MDN — [Memory management](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Memory_management), [`WeakMap`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/WeakMap), [`WeakRef`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/WeakRef), [`AbortSignal`](https://developer.mozilla.org/en-US/docs/Web/API/AbortSignal). Documentation-validated.

**A leak is not memory the engine failed to free. It is something still reachable that you
stopped needing** — and the collector cannot tell the difference, because nothing in the
program expresses it.

> "This algorithm reduces the definition of 'an object is no longer needed' to **'an object
> is unreachable.'**" — MDN

## Chunks

| # | Chunk | Covers |
|---|---|---|
| 1 | **[Reachability is the whole model](./01-reachability.md)** | Roots, mark-and-sweep, and why **circular references do not leak**; that one live reference retains a whole graph; closures retaining their scope; **`WeakMap` versus `Map`** as the highest-value one-word fix, and why weak collections are neither iterable nor sized; and `WeakRef`/`FinalizationRegistry` with MDN's warning that the callback may never run |
| 2 | **[The four leaks](./02-the-four-leaks.md)** | Detached DOM nodes and the subtree they retain; forgotten listeners, why `removeEventListener` needs the *same reference*, and `{ signal }` as the better default; intervals and the re-arming `setTimeout` that behaves like one; module-level caches with no eviction policy; and how to confirm a leak with two snapshots, a retainer path, and the **do-it-three-times** test |

## The three sentences to keep

1. **A leak is a reference you forgot, not a collector failure.** The only fix is to break it.
2. **`Map` keyed by objects is a leak; `WeakMap` is not.**
3. **Register listeners with `{ signal }`** so one `abort()` removes all of them and no
   reference can be wrong.

## Phase gate

You are done with this topic when you can define a leak in terms of reachability, say why
circular references are fine, name the four patterns and the fix for each, and describe how
to confirm a leak from two heap snapshots rather than from a rising total.

## Where this connects

- [02 · 01 · Singletons and strict](../02-module-semantics/01-singletons-and-strict.md) — why a module-level cache lives forever
- [Phase 5 · 10 · `Map` vs a plain object](../../phase-5-built-in-library/10-map-vs-object/README.md) — the collection this topic tells you to make weak
- [Phase 3 · 06 · Closures](../../phase-3-functions/06-closures/README.md) — the scope retention that makes a small callback expensive

---

Start → [01 · Reachability is the whole model](./01-reachability.md)
