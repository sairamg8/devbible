---
title: "05 · An EventEmitter"
sidebar_label: "Overview"
sidebar_position: 0
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-15 against the [Node.js `events` documentation](https://nodejs.org/api/events.html) and MDN — [`EventTarget`](https://developer.mozilla.org/en-US/docs/Web/API/EventTarget), [`AbortSignal`](https://developer.mozilla.org/en-US/docs/Web/API/AbortSignal), [`Map`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Map). Documentation-validated; **nothing was run**.

**The fourth of the phase gate's four**, and the one most often written *almost* correctly.
Fifteen lines of code; three behaviours that decide whether they are right.

```js
emit(event, ...args) {
  const set = this.#events.get(event);
  if (!set || set.size === 0) return false;
  for (const listener of [...set]) listener.apply(this, args);   // ← the copy is the whole trick
  return true;
}
```

Node states the semantics that copy implements: listeners are called *"synchronously… in the
order they were registered"*, `emit` *"returns `true` if the event had listeners"*, and
removals during an emit *"will not remove them from `emit()` in progress"*.

## Chunks

| # | Chunk | Covers |
|---|---|---|
| 1 | **[The core](./01-the-core.md)** | The full `on`/`off`/`emit`/`once` implementation, `Map`-of-`Set` versus object-of-arrays (and the **duplicate-registration** difference from Node), **why `emit` must iterate a copy**, synchronous ordering, `emit`'s boolean, **`once` removing before it calls** and `wrapper.listener` so `off` can find it, and the **`'error'`-with-no-listener** convention |
| 2 | **[The edge cases](./02-the-edge-cases.md)** | A **throwing listener** and the three policies (propagate / isolate / defer), **`async` listeners not being awaited**, leaks and the max-listener warning, unsubscribe functions versus chaining, `AbortSignal` support, `removeAllListeners` during an emit, what `EventTarget` and Node's `EventEmitter` already give you, and a nine-point checklist |

## The three that decide it

```js
for (const l of set) l(...args);      // ⛔ a self-removing listener makes this skip one
const w = (...a) => { fn(...a); this.off(e, w); };   // ⛔ removes AFTER — a re-emit fires it twice
emitter.off("tick", () => update());  // ⛔ a different function object — removes nothing
```

## Phase gate

You are done with this topic when you can write `on`, `off`, `emit` and `once` from an empty
file, say what happens when a listener is added or removed during an `emit`, and name your
policy for a listener that throws.

## Where this connects

- [03 · `debounce` and `throttle`](../03-debounce-throttle/README.md) — the same closure-and-lifecycle problems, and the same teardown obligation
- **17 · A tiny pub/sub and a reactive signal** *(not written yet)* — the same machinery with dependency tracking on top
- [Phase 10 · 12 · The `EventTarget` base class](../../phase-10-events/12-eventtarget-base-class/README.md) — the platform's version, and when to subclass it instead
- [Phase 7 · 03 · Microtasks vs macrotasks](../../phase-7-async/03-microtasks-vs-macrotasks/README.md) — what deferring listeners changes
- [Phase 6 · 04 · The iteration protocols](../../phase-6-iteration-and-destructuring/04-iteration-protocols/README.md) — why iterating a live collection while mutating it skips entries
- [Phase 5 · 10 · `Map` vs object](../../phase-5-built-in-library/10-map-vs-object/README.md) — why the registry is a `Map`

---

Start → [The core](./01-the-core.md)
