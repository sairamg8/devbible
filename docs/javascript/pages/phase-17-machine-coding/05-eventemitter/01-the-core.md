---
title: "05.1 · The core — `on`, `off`, `emit`, `once`"
sidebar_label: "01 · The core"
sidebar_position: 1
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-15 against the [Node.js `events` documentation](https://nodejs.org/api/events.html) and MDN — [`Map`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Map), [`Set`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Set). Documentation-validated; **nothing was run**.

`EventEmitter` is the fourth of the phase gate's four, and the one people most often write
*almost* correctly. The four methods take about fifteen lines. **The interview is entirely
about the three behaviours those fifteen lines have to get right**: what happens when a
listener is removed during an `emit`, how `once` can be removed before it fires, and what
`emit` does with an event nobody is listening to.

## The implementation

```js
class EventEmitter {
  #events = new Map();                     // event name → Set of listeners

  on(event, listener) {
    if (typeof listener !== "function") throw new TypeError("listener must be a function");
    if (!this.#events.has(event)) this.#events.set(event, new Set());
    this.#events.get(event).add(listener);
    return this;                           // chainable
  }

  off(event, listener) {
    const set = this.#events.get(event);
    if (!set) return this;
    set.delete(listener);
    if (set.size === 0) this.#events.delete(event);   // do not leak empty sets
    return this;
  }

  once(event, listener) {
    const wrapper = (...args) => {
      this.off(event, wrapper);            // remove FIRST, then call
      listener.apply(this, args);
    };
    wrapper.listener = listener;           // so off(event, listener) can find it
    return this.on(event, wrapper);
  }

  emit(event, ...args) {
    const set = this.#events.get(event);
    if (!set || set.size === 0) return false;
    for (const listener of [...set]) listener.apply(this, args);   // COPY first
    return true;                           // "had listeners"
  }
}
```

Every non-obvious line in that is one of the behaviours below.

## `Map` of `Set`, not an object of arrays

- **`Map`** because event names are arbitrary strings — an object would collide with
  `__proto__`, `constructor` and `toString`
  ([Phase 5 · 10 · `Map` vs object](../../phase-5-built-in-library/10-map-vs-object/README.md)).
  `Object.create(null)` is the alternative; `Map` is clearer.
- **`Set`** because removal is O(1) and duplicate registrations collapse. ⚠️ **That last
  part is a behaviour difference from Node**, where adding the same listener twice registers
  it twice and it fires twice. Decide deliberately, and say which you chose — an interviewer
  asking "what if I call `on` with the same function twice?" is testing whether you noticed.
- **Delete the empty `Set`** on the last removal, or a long-lived emitter accumulates one
  entry per event name it has ever seen.

## `emit` iterates a **copy**

This is the bug that separates a working emitter from a nearly-working one:

```js
for (const listener of [...set]) listener.apply(this, args);
```

Without the copy, a listener that calls `off()` — including every `once` listener — mutates
the collection mid-iteration, and the iterator skips the next listener
([Phase 6 · 04](../../phase-6-iteration-and-destructuring/04-iteration-protocols/README.md)
on why iterators do not snapshot).

Node specifies the copy semantics explicitly:

> "Once an event is emitted, all listeners attached to it at the time of emitting are called
> in order. This implies that any `removeListener()` or `removeAllListeners()` calls *after*
> emitting and *before* the last listener finishes execution will not remove them from
> `emit()` in progress."

**So the set of listeners for one `emit` is fixed at the moment `emit` is called.** A
listener added by another listener does **not** fire for that same event, and one removed
mid-emit still runs. Both are the documented behaviour, and both are what a copy gives you
for free.

## Listeners run synchronously, in order

Node: *"Synchronously calls each of the listeners registered for the event named
`eventName`, in the order they were registered, passing the supplied arguments to each."*

Two consequences worth stating out loud:

- **`emit` blocks.** A slow listener delays every listener after it and the caller of
  `emit`. Emitters are not a scheduling mechanism.
- **Order is registration order**, which callers do come to depend on. That is why a `Set`
  is safe — it preserves insertion order — and why an unordered structure would not be.

## `emit` returns a boolean

Node: *"Returns `true` if the event had listeners, `false` otherwise."* It is a small
detail that gets asked, and it is the hook for the `'error'` convention below. It does
**not** report whether the listeners succeeded.

## `once` removes before it calls

```js
const wrapper = (...args) => {
  this.off(event, wrapper);      // FIRST
  listener.apply(this, args);
};
```

Node: *"Adds a one-time `listener`… The next time `eventName` is triggered, this listener is
removed and then invoked."* Removing first is what makes it safe when the listener itself
emits the same event — otherwise a re-entrant emit runs the "one-time" listener a second
time before the removal happens.

**And `wrapper.listener = listener` is not decoration.** Without it, `off(event, original)`
cannot find the wrapper, so a `once` listener could never be cancelled before firing:

```js
off(event, listener) {
  const set = this.#events.get(event);
  if (!set) return this;
  for (const l of set) if (l === listener || l.listener === listener) { set.delete(l); break; }
  if (set.size === 0) this.#events.delete(event);
  return this;
}
```

`break` after the first removal matches Node — *"`removeListener()` will remove, at most, one
instance of a listener"*.

## The `'error'` convention

Node's rule is worth knowing even if you do not copy it:

> "If an `EventEmitter` does *not* have at least one listener registered for the `'error'`
> event, and an `'error'` event is emitted, the error is thrown, a stack trace is printed,
> and the Node.js process exits."

The reasoning is that a silently-dropped error event is worse than a crash. In a browser or
a library, the usual adaptation is to throw rather than exit:

```js
emit(event, ...args) {
  const set = this.#events.get(event);
  if (!set || set.size === 0) {
    if (event === "error") throw args[0] instanceof Error ? args[0] : new Error("Unhandled error event");
    return false;
  }
  for (const listener of [...set]) listener.apply(this, args);
  return true;
}
```

**Say which you chose and why.** "Unhandled `error` should be loud" is the answer being
looked for.

## Gotchas

**Symptom:** A listener was skipped when another listener removed itself
**Cause:** Iterating the live collection while a listener mutates it.
**Fix:** Iterate a copy — `[...set]` — which is also Node's documented semantics.

**Symptom:** A `once` listener fired twice
**Cause:** The listener re-emitted the event before the wrapper removed itself.
**Fix:** Remove first, then call.

**Symptom:** `off(event, myListener)` did not remove a `once` listener
**Cause:** The registered function is the wrapper, not the original.
**Fix:** Store `wrapper.listener = listener` and match on either in `off`.

**Symptom:** Registering the same function twice made it fire twice — or once — unexpectedly
**Cause:** An array registers duplicates; a `Set` collapses them. Node uses an array.
**Fix:** Pick one deliberately and document it.

**Symptom:** An emitter's memory grew over a long-lived process
**Cause:** Empty `Set`s left behind for every event name ever used, or listeners never
removed.
**Fix:** Delete the entry when the set empties, and give every subscription an owner that
unsubscribes.

**Symptom:** An event named `constructor` or `__proto__` behaved oddly
**Cause:** A plain object used as the registry.
**Fix:** `Map`, or `Object.create(null)`.

**Symptom:** `emit` returned `true` but nothing happened
**Cause:** It reports *"if the event had listeners"*, not whether they did anything.
**Fix:** Expected — do not treat it as a success signal.

## Interview questions

**★ Write an `EventEmitter` with `on`, `off`, `emit` and `once`.**
A `Map` from event name to a collection of listeners; `on` adds and returns `this`; `off`
removes one instance; `emit` iterates a **copy** and calls each listener synchronously with
`apply`, returning whether there were any; `once` wraps the listener, removes the wrapper
before calling, and keeps `wrapper.listener` so `off` can find it.

**★ Why must `emit` iterate a copy of the listeners?**
Because listeners can add or remove listeners while running — every `once` does. Iterating
the live collection skips entries. Node specifies the copy behaviour: the listeners attached
at the moment of emitting are the ones called.

**★ What happens if a listener is added during an `emit`?**
It does not fire for that emit. The listener set is fixed when `emit` starts, which follows
from iterating a copy and is Node's documented behaviour.

**★ Why does `once` remove the listener before invoking it?**
So a listener that re-emits the same event cannot run the one-time listener again. Node
describes it in that order too: *"removed and then invoked"*.

**★ What does `emit` return?**
`true` if the event had listeners, `false` otherwise — not whether they succeeded.

**What is special about the `'error'` event?**
By Node's convention an `'error'` event with no listener is thrown rather than dropped —
in Node it prints a stack trace and exits the process. The point is that unhandled errors
must be loud.

**Are listeners synchronous?**
Yes — called synchronously, in registration order, so a slow listener blocks the rest and
the caller of `emit`.

---

[Topic index](./README.md) · Next → [The edge cases](./02-the-edge-cases.md)
