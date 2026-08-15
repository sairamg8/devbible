---
title: "05.2 · The edge cases"
sidebar_label: "02 · The edge cases"
sidebar_position: 2
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-15 against the [Node.js `events` documentation](https://nodejs.org/api/events.html) and MDN — [`EventTarget`](https://developer.mozilla.org/en-US/docs/Web/API/EventTarget), [`AbortSignal`](https://developer.mozilla.org/en-US/docs/Web/API/AbortSignal), [`queueMicrotask()`](https://developer.mozilla.org/en-US/docs/Web/API/Window/queueMicrotask). Documentation-validated; **nothing was run**.

The core in [05.1](./01-the-core.md) passes the obvious tests. These are the follow-up
questions — and in a real codebase, the reasons an emitter becomes a leak or swallows
failures.

## A throwing listener takes down the rest

`emit` calls listeners synchronously in a loop, so the first one that throws aborts the loop
and propagates out of `emit`:

```js
emitter.on("save", () => { throw new Error("boom"); });
emitter.on("save", () => audit());          // never runs
emitter.emit("save");                       // throws at the caller of emit
```

Three defensible policies, and the interview answer is knowing that you must choose:

| Policy | Implementation | When |
|---|---|---|
| **Propagate** (Node's) | do nothing | listeners are trusted internal code |
| **Isolate** | `try { l.apply(this, args) } catch (e) { this.emit("error", e) }` | plugin/subscriber code you do not control |
| **Defer** | `queueMicrotask(() => l.apply(this, args))` | you want `emit` never to throw |

⚠️ **Isolating changes the contract**: `emit` no longer throws, so a caller that relied on
failures surfacing sees silence unless something listens for `error`. And **deferring
changes the ordering** — listeners no longer run before `emit` returns, which breaks any
code that reads state immediately afterwards
([Phase 7 · 03 · Microtasks vs macrotasks](../../phase-7-async/03-microtasks-vs-macrotasks/README.md)).

## Async listeners are not awaited

```js
emitter.on("save", async () => { await write(); });
emitter.emit("save");        // returns immediately; the write is still pending
```

`emit` is synchronous, so an `async` listener's promise is **discarded** — and a rejection
inside it becomes an unhandled rejection rather than an error at the emit site. This is the
same shape as `forEach` not awaiting
([Phase 6 · 08](../../phase-6-iteration-and-destructuring/08-early-exit/01-what-can-stop.md)).

If callers genuinely need to wait, that is a different primitive — collect the results and
return a promise, and say plainly that it is no longer an `EventEmitter`:

```js
emitAsync(event, ...args) {
  const set = this.#events.get(event);
  if (!set) return Promise.resolve(false);
  return Promise.all([...set].map((l) => l.apply(this, args))).then(() => true);
}
```

Sequential-versus-concurrent is then a decision you owe the caller
([Phase 7 · 09](../../phase-7-async/09-sequential-vs-parallel/README.md)).

## Leaks: the listener that outlives its owner

An emitter holds a strong reference to every listener, and the listener's closure holds its
owner. **A subscription that is never removed keeps the whole component alive.** Node's
mitigation is a warning:

> "By default `EventEmitter`s will print a warning if more than `10` listeners are added for
> a particular event. This is a useful default that helps finding memory leaks."

Worth copying, and worth pairing with an ergonomic unsubscribe so callers actually clean up:

```js
on(event, listener) {
  /* …register… */
  if (set.size > this.maxListeners) {
    console.warn(`Possible memory leak: ${set.size} listeners for "${String(event)}"`);
  }
  return () => this.off(event, listener);      // ⚠️ an unsubscribe FUNCTION, not `this`
}
```

⚠️ **That return value conflicts with chaining** — you cannot return both `this` and an
unsubscribe function. Pick one; the unsubscribe function is usually the better trade in
modern code because it is what `useEffect` cleanup wants. **Do not use a `WeakSet`/`WeakRef`
to "fix" leaks**: a listener nobody else references would be collected at an unpredictable
time, turning a leak into a heisenbug.

## `off` needs the same function reference

```js
emitter.on("tick", () => update());
emitter.off("tick", () => update());       // a DIFFERENT function — removes nothing
```

Obvious written down, invisible in real code where the handler is defined inline or created
by a factory. Two fixes: keep the reference, or return the unsubscribe function above. The
platform's answer to the same problem is worth citing —
[`AbortSignal`](https://developer.mozilla.org/en-US/docs/Web/API/AbortSignal) as an
`addEventListener` option removes the listener when the signal aborts, so one `controller.abort()`
detaches everything at once:

```js
on(event, listener, { signal } = {}) {
  /* …register… */
  signal?.addEventListener("abort", () => this.off(event, listener), { once: true });
  return this;
}
```

## `removeAllListeners`, and why `emit` still finishes

```js
removeAllListeners(event) {
  if (event === undefined) this.#events.clear();
  else this.#events.delete(event);
  return this;
}
```

Called from inside a listener, it does not stop the emit in progress — Node again: such calls
*"will not remove them from `emit()` in progress"*. That is the copy in `emit` doing its job,
and it is the correct behaviour: a half-delivered event is worse than a fully-delivered one.

## What the built-ins already give you

Before writing this class in production code, note what exists:

- **`EventTarget`** is available in browsers and Node, and can be subclassed —
  `addEventListener`/`removeEventListener`/`dispatchEvent`, with `{ once: true }`,
  `{ signal }` and capture/bubbling if you attach it to a tree.
- **Node's `EventEmitter`** brings `prependListener`, `listenerCount`, `eventNames`,
  `setMaxListeners`, the `'newListener'`/`'removeListener'` meta-events (emitted *before* an
  add and *after* a removal), and `events.once(emitter, name)` for promise-based waiting.

**Write your own when you need something they do not do** — typed events, wildcards,
namespacing, isolation of throwing listeners — or when you are in an interview, which is what
this topic is for.

## The checklist

- [ ] `emit` iterates a **copy**
- [ ] `once` removes **before** invoking, and is removable by the original reference
- [ ] `off` removes at most one instance, and cleans up the empty entry
- [ ] Duplicate registration behaviour is chosen and documented
- [ ] `emit` returns whether there were listeners
- [ ] `'error'` with no listener is loud
- [ ] Throwing-listener policy is chosen: propagate, isolate or defer
- [ ] Every subscription has an obvious way to unsubscribe
- [ ] Listener count is warned about, or otherwise bounded

## Gotchas

**Symptom:** One listener threw and the rest never ran
**Cause:** `emit` calls them in a synchronous loop.
**Fix:** Choose a policy — propagate (Node's), isolate in `try/catch` and re-emit as
`error`, or defer with `queueMicrotask`.

**Symptom:** An `async` listener's failure showed up as an unhandled rejection
**Cause:** `emit` discards the returned promise.
**Fix:** Handle errors inside the listener, or provide an explicit `emitAsync`.

**Symptom:** A component stayed in memory after unmount
**Cause:** The emitter holds the listener, which closes over the component.
**Fix:** Unsubscribe on teardown — return an unsubscribe function from `on`, or accept an
`AbortSignal`.

**Symptom:** `off` with an inline arrow removed nothing
**Cause:** A new function object each time; removal is by identity.
**Fix:** Keep the reference, use the returned unsubscribe, or pass a `signal`.

**Symptom:** State read right after `emit` was stale
**Cause:** Listeners were deferred with `queueMicrotask`, so they had not run yet.
**Fix:** Keep `emit` synchronous, or make the deferral explicit in the API's name.

**Symptom:** `removeAllListeners()` inside a listener did not stop delivery
**Cause:** The listener set for the emit in progress is fixed — documented behaviour.
**Fix:** Expected; use a flag if you need to stop mid-delivery.

## Interview questions

**★ What happens if one listener throws?**
With a plain synchronous loop it aborts the remaining listeners and propagates to the caller
of `emit` — Node's behaviour. Alternatives are isolating each call in `try/catch` and
re-emitting as an `error` event, or deferring with `queueMicrotask`. Each changes the
contract, so it is a decision, not a detail.

**★ Are `async` listeners awaited?**
No. `emit` is synchronous and discards the returned promise, so rejections become unhandled.
If waiting matters, expose a separate `emitAsync` that collects the promises and decides
between sequential and concurrent.

**★ How do you avoid leaking listeners?**
Give every subscription an owner: return an unsubscribe function from `on`, or accept an
`AbortSignal` so one `abort()` detaches many. Warn above a listener threshold, as Node does
at ten. Do not reach for weak references — collection timing would become unpredictable.

**★ Why can't you `off` an inline arrow function?**
Removal is by identity and each arrow expression creates a new function. Keep the reference,
use the returned unsubscribe, or pass a signal.

**Would you write your own in production?**
Usually not — `EventTarget` is available in browsers and Node and supports `{ once }` and
`{ signal }`; Node's `EventEmitter` adds `prependListener`, `listenerCount` and promise-based
`events.once`. Write your own for typed events, wildcards, namespacing or listener
isolation.

**What does `removeAllListeners` do to an emit in progress?**
Nothing — the listener set was fixed when `emit` started. Delivering an event to half its
listeners would be worse than finishing.

---

← Prev [The core](./01-the-core.md) · [Topic index](./README.md)
