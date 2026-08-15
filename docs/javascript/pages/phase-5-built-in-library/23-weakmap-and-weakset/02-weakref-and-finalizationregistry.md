---
title: "2 · `WeakRef` and `FinalizationRegistry`"
sidebar_label: "2 · WeakRef and FinalizationRegistry"
sidebar_position: 2
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-08-15 against MDN — [`WeakRef`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/WeakRef), [`WeakRef.prototype.deref()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/WeakRef/deref), [`FinalizationRegistry`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/FinalizationRegistry), [`FinalizationRegistry.prototype.register()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/FinalizationRegistry/register), [`FinalizationRegistry.prototype.unregister()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/FinalizationRegistry/unregister), [Memory management](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Memory_management). Documentation-validated; **no timings**.

[Chunk 1](./01-the-weak-collections.md) covered the two collections, which are safe and
useful. **These two are neither, and MDN says so on both pages.**

🔴 **Start with the conclusion: MDN advises avoiding `WeakRef` and `FinalizationRegistry`
where possible**, and correct use is described as hard. This chunk exists so you recognise
them, understand what they do, and know why the answer is almost always something else.

## `WeakRef` — a weak reference to one object

```js
const ref = new WeakRef(someObject);

const obj = ref.deref();     // the object, or undefined if it has been collected
if (obj) {
  // ✅ safe to use — you now hold a strong reference for this turn
}
```

**A `WeakRef` holds an object without keeping it alive.** `deref()` is the only method:
it returns the object if it still exists, and `undefined` if the collector has taken it.

⚠️ **Every use must handle `undefined`.** There is no "is it alive?" that stays true —
by the time you acted on the answer it could be stale, which is why the idiom is always
`deref()` into a local variable and check that.

### What makes it hard to use correctly

🔴 **Collection timing is completely unspecified.** Whether an unreachable object has
actually been collected depends on the engine, the heap state, and whether a collection
happened to run. Two consequences:

- **`deref()` may keep returning the object long after it is logically dead.** Code that
  assumes a `WeakRef` behaves like a cache with automatic eviction can hold memory
  indefinitely.
- **Two engines — or two runs — will disagree.** Anything whose *correctness* depends on
  when `deref()` starts returning `undefined` is not deterministic.

⚠️ **And there is a subtler rule:** within one turn of the event loop, a `deref()` that
returns the object keeps it alive for at least the rest of that turn. So a program can
behave one way when the work is synchronous and another when it is split across `await`
boundaries.

## `FinalizationRegistry` — a callback after collection

```js
const registry = new FinalizationRegistry((heldValue) => {
  // called some time after the target is collected — maybe
  console.log("collected:", heldValue);
});

registry.register(target, "a label", unregisterToken);
registry.unregister(unregisterToken);
```

**Three arguments to `register`:** the object to watch, a *held value* passed to the
callback, and an optional token you can later unregister with.

🔴 **The held value must not reference the target.** If it does, the target is reachable
from the registry and can never be collected — the callback then never runs, which is the
classic way this is got wrong. Pass an id or a string, never the object.

### The guarantees, and there are almost none

**MDN is explicit about all of these:**

- **The callback may never be called.** If the program exits, or the collector never runs
  for that object, nothing happens.
- **There is no ordering and no timing** — not at the moment of collection, not in
  registration order.
- **It is not called on page unload or process exit.** Anything you must do on shutdown
  belongs in an explicit teardown path.

⚠️ **So it cannot be used for anything that must happen.** Closing a file handle, releasing
a lock, flushing a buffer, decrementing a counter someone reads — none of these are safe
here. It is at best a *hint* for opportunistic cleanup, and at worst a bug that appears
only under memory pressure.

## When either is the right answer

**Rarely, and the honest list is short:**

- **A cache that genuinely may lose entries at any moment**, where a miss is only a
  performance cost and never a correctness one — and where a `WeakMap` will not do because
  you need to iterate or the key is not the right lifetime anchor.
- **Releasing an external resource** — a WebAssembly allocation, a native handle — as a
  **backstop** behind an explicit `close()`/`dispose()`, never as the primary path.
- **Instrumentation**: observing in development that objects you expected to be collected
  actually are.

🔴 **What to reach for instead, in order:**

1. **`WeakMap` / `WeakSet`** — if the question is "data attached to an object", this is
   almost always it, and it has none of these problems.
2. **An explicit lifecycle.** `dispose()`, `close()`, `unsubscribe()`, a component
   teardown, an `AbortController`. Deterministic, testable, and the answer a reviewer
   expects.
3. **A bounded cache.** An LRU with a size limit does what people hope `WeakRef` will do,
   predictably.

## Gotchas

**Symptom:** `deref()` kept returning the object after it should have been collected
**Cause:** Collection timing is unspecified; nothing forces the collector to run.
**Fix:** Never depend on it. Treat `WeakRef` as "may still be here", not "will be gone".

**Symptom:** A `FinalizationRegistry` callback never fired
**Cause:** The held value referenced the target, so the target stayed reachable — or the
collector simply never ran for it.
**Fix:** Pass an id, not the object. And do not rely on the callback at all.

**Symptom:** Cleanup did not run when the page closed
**Cause:** Finalization callbacks are not called on unload or process exit.
**Fix:** An explicit teardown path — `pagehide`, a `dispose()`, an abort signal.

**Symptom:** Behaviour differed between a synchronous path and an `await`-ed one
**Cause:** A successful `deref()` keeps the object alive for the rest of that turn; across
turns it may vanish.
**Fix:** `deref()` once into a local, and treat that local as the object for the whole
operation.

**Symptom:** A test using `WeakRef` was flaky
**Cause:** It asserted on collection, which is not deterministic.
**Fix:** Do not test the collector. Test the behaviour you actually control.

## Interview questions

**★ What is a `WeakRef`, and why is it discouraged?**
A reference to a single object that does not keep it alive; `deref()` returns the object
or `undefined`. MDN advises avoiding it because collection timing is unspecified — the
object may persist long after it is logically dead, engines disagree, and a successful
`deref()` pins the object for the rest of the event-loop turn. Almost every real use is
better served by a `WeakMap` or by an explicit lifecycle.

**★ What does `FinalizationRegistry` guarantee?**
Essentially nothing. The callback may never run, has no timing or ordering guarantees, and
is not invoked on page unload or process exit. It is a hint for opportunistic cleanup, not
a destructor — anything that must happen needs an explicit teardown path.

**★ Why might a finalization callback never fire?**
Most commonly because the held value passed to `register` references the target, keeping
it reachable from the registry. Pass an identifier instead. Beyond that, the collector may
simply never run for that object.

**★ When would you choose `WeakRef` over `WeakMap`?**
When you need a weak reference to a *single* object rather than a keyed association — for
example an opportunistic cache entry, or a backstop behind an explicit `dispose()` for an
external resource. If the question is "attach data to an object", `WeakMap` is the answer
and has none of `WeakRef`'s hazards.

**Can you use these to detect memory leaks in tests?**
Not reliably. Collection is not deterministic, so any assertion about whether an object was
collected is flaky by construction. Use the browser's or Node's heap tooling for that
instead.

---

← [1 · The weak collections](./01-the-weak-collections.md) · [Topic index](./README.md) · [Phase index](../README.md) →
