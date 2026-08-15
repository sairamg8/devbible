---
title: "17 · A tiny pub/sub and a reactive signal"
sidebar_label: "Overview"
sidebar_position: 0
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-08-15 against MDN — [`Set`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Set), [`Object.is()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object/is), [get accessors](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Functions/get), [`Proxy`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Proxy), [`queueMicrotask()`](https://developer.mozilla.org/en-US/docs/Web/API/Window/queueMicrotask), [`WeakMap`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/WeakMap) — and the TC39 [Signals proposal](https://github.com/tc39/proposal-signals) (**Stage 1**). Documentation-validated; **nothing was run**.

**Pub/sub and signals differ in exactly one place: who names the dependency.** A subscriber names
a topic; a reactive effect names nothing at all — reading a value inside it *is* the subscription.

```js
let current = null;                       // the effect being run

get() { if (current) subscribers.add(current); return value; }        // reading subscribes
set(next) { if (Object.is(next, value)) return; value = next; notify(); }
```

Those two lines are the whole idea. Everything else — laziness, batching, disposal — is making
them survive contact with a real application.

## Chunks

| # | Chunk | Covers |
|---|---|---|
| 1 | **[From pub/sub to tracking](./01-from-pubsub-to-tracking.md)** | The twelve-line bus and its three decisions; the ~40-line signal and effect; the five load-bearing lines — the `Object.is` bail-out, re-collecting dependencies on every run, `current` as a **stack**, the `finally` that stops one throw corrupting the tracker, and iterating a copy; 🔴 **tracking is synchronous only**, so a read after `await` registers nothing; and the two ways to write an infinite loop |
| 2 | **[Making it real](./02-making-it-real.md)** | `computed` as subscriber *and* source, lazy, with **push-marks/pull-computes**; **the diamond** and what a "glitch" actually is; batching into a microtask flush and the timing contract it changes; 🔴 the **ownership tree** and the nested-effect leak; `untrack` in four lines; the `Proxy` alternative and its longer list of traps and identity problems; and when reactivity is the wrong container |

## Four facts worth carrying out of this topic

- **Dependency tracking is a side effect of reading.** No topic names, no registration — which is
  why a read that happens after an `await` silently registers nothing.
- **Dependencies must be re-collected on every run**, because a conditional read changes the
  graph.
- **Laziness is not an optimisation, it is correctness.** Marking dirty and recomputing on read is
  what stops an effect observing a half-updated graph.
- **Nested effects need an owner.** Without disposal, every re-run of a parent leaves another live
  effect behind.

## Phase gate

You are done with this topic when you can write the signal and effect pair from an empty file,
explain why a read after `await` is not tracked, describe the diamond problem and both fixes, and
say what an ownership tree is for.

## Where this connects

- [05 · An `EventEmitter`](../05-eventemitter/README.md) — the pub/sub half in full: `once`, wildcards, the listener-identity trap
- [Phase 10 · 12 · `EventTarget` as a base class](../../phase-10-events/12-eventtarget-base-class/README.md) — the platform's own emitter, and why it usually beats a hand-written one
- [Phase 7 · 18 · `queueMicrotask`](../../phase-7-async/18-queuemicrotask/README.md) — the flush timing batching depends on
- [11 · `memoize`](../11-memoize/README.md) — the same caching question without the dependency graph
- [Phase 4 · Objects, prototypes and classes](../../phase-4-objects-and-classes/README.md) — accessors and `Proxy`, the two ways a read becomes observable

---

Start → [From pub/sub to tracking](./01-from-pubsub-to-tracking.md)
