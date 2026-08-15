---
title: "17.2 · Making it real"
sidebar_label: "02 · Making it real"
sidebar_position: 2
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-08-15 against MDN — [`Proxy`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Proxy), [`Proxy` handler `get`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Proxy/Proxy/get), [`Reflect`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Reflect), [`WeakMap`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/WeakMap), [`queueMicrotask()`](https://developer.mozilla.org/en-US/docs/Web/API/Window/queueMicrotask), [`Object.is()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object/is) — and the TC39 [Signals proposal](https://github.com/tc39/proposal-signals) (**Stage 1**). Documentation-validated; **nothing was run**.

**The forty lines in [17.1](./01-from-pubsub-to-tracking.md) are eager, run effects more often
than necessary, and leak nested effects.** Fixing those three is what turns a demo into something
a framework could be built on — and each fix is a concept with a name.

## `computed` — a node that is both a subscriber and a source

```js
function computed(fn) {
  let value, dirty = true;
  const subscribers = new Set();
  const observer = { deps: new Set(), run: mark };

  function mark() {                        // a dependency changed
    if (dirty) return;                     // already marked — stop the cascade here
    dirty = true;
    for (const sub of [...subscribers]) sub.run();
  }

  return {
    get() {
      if (current) { subscribers.add(current); current.deps.add(subscribers); }
      if (dirty) {
        for (const dep of observer.deps) dep.delete(observer);
        observer.deps.clear();
        const previous = current;
        current = observer;
        try { value = fn(); } finally { current = previous; }
        dirty = false;
      }
      return value;
    },
  };
}
```

Two properties fall out of that shape, and they are the two the TC39 proposal names:

- **Lazy.** A change *marks* the computed dirty; it does not recompute. The work happens on the
  next `get()`, so a computed nobody reads costs nothing —
  *"Computations are not eagerly evaluated when they are declared, nor are they immediately
  evaluated when their dependencies change."*
- **Push marks, pull computes.** The `if (dirty) return` guard means a marking pass touches each
  node once no matter how many paths reach it. That is the mechanism behind
  *"Computation is 'glitch-free', meaning no unnecessary calculations are ever performed."*

## The diamond, which is why laziness is not just an optimisation

```js
const a  = signal(1);
const b  = computed(() => a.get() + 1);
const c  = computed(() => a.get() * 2);
effect(() => render(b.get(), c.get()));

a.set(2);
```

With the eager version from 17.1, setting `a` notifies `b`'s subscribers and then `c`'s, so the
effect runs **twice** — and on the first run it sees the *new* `b` with the *old* `c`. That
inconsistent intermediate state is what "glitch" means, and it is observable: a total that briefly
disagrees with its parts, a chart drawn from mismatched axes.

Marking fixes the second run's redundancy; getting the effect to run **once** needs the other
piece.

## Batching — one flush, not one per write

```js
const pending = new Set();
let scheduled = false;

function schedule(effectObserver) {
  pending.add(effectObserver);                    // a Set, so a repeat is free
  if (scheduled) return;
  scheduled = true;
  queueMicrotask(() => {
    scheduled = false;
    const queue = [...pending];
    pending.clear();
    for (const observer of queue) observer.run();
  });
}
```

Effects are queued rather than run, deduplicated by the `Set`, and flushed once. Three writes in
one function produce one re-run; the diamond produces one re-run.

⚠️ **It changes the API's timing contract**, and every framework that does this ends up exposing
the same escape hatch:

```js
count.set(1);
console.log(el.textContent);        // ⛔ still the old value — the effect has not flushed
await tick();                        // the framework's "wait for the queue" promise
```

📌 A microtask flush lands **before paint**, so the user never sees the intermediate state
([Phase 7 · 18 · `queueMicrotask`](../../phase-7-async/18-queuemicrotask/README.md)). Scheduling
on a timer or a frame instead is a different, visible tradeoff.

## Ownership — the leak nobody sees in a demo

```js
effect(() => {
  if (open.get()) {
    effect(() => sync(panelWidth.get()));      // ⛔ a new inner effect on every outer run
  }
});
```

The outer effect re-runs; the inner one is created again, and the previous one is still
subscribed. Toggle a panel twenty times and twenty effects run for every width change.

The fix is an **ownership tree**: while an effect runs, effects created inside it are recorded as
its children, and re-running (or disposing) an effect disposes its children first.

```js
function effect(fn) {
  const observer = { deps: new Set(), children: [], run };

  function run() {
    for (const child of observer.children) child();      // dispose children first
    observer.children.length = 0;
    for (const dep of observer.deps) dep.delete(observer);
    observer.deps.clear();
    // …track and run as before, registering into currentOwner.children
  }
}
```

**Every real reactive library has this concept** — it is what makes "create an effect inside a
component" safe, and it is the first thing missing from a hand-rolled implementation.

## `untrack` — reading without subscribing

```js
function untrack(fn) {
  const previous = current;
  current = null;
  try { return fn(); } finally { current = previous; }
}
```

Four lines, and it is not optional. You need it to read a value while *writing* one (otherwise the
effect subscribes to what it updates and loops), to log state from inside an effect without
binding to it, and to pass a current value into something being created. Its cost is that the
dependency is now invisible — an untracked read is a promise that the value does not need to
trigger this effect, and nothing checks it.

## The other shape: a `Proxy` over an object

Signals make each value explicit. The alternative, which Vue-style reactivity uses, is to make
*any* property read trackable:

```js
const registry = new WeakMap();                 // target → Map(key → Set of observers)

function reactive(target) {
  return new Proxy(target, {
    get(obj, key, receiver) {
      track(obj, key);
      return Reflect.get(obj, key, receiver);
    },
    set(obj, key, value, receiver) {
      const had = Reflect.has(obj, key);
      const previous = obj[key];
      const ok = Reflect.set(obj, key, value, receiver);
      if (!had || !Object.is(previous, value)) trigger(obj, key);
      return ok;
    },
  });
}
```

The ergonomics are better — plain property access, no `.get()` — and the cost is a longer list of
things to get right:

- **Every operation needs its own trap.** `has` (`in`), `deleteProperty`, `ownKeys` (`for…in`,
  spread, `Object.keys`) each track or trigger differently; miss one and reactivity has a hole.
- **Arrays are the hard case**: a `push` reads `length`, writes an index and writes `length`, so a
  naive implementation triggers twice and can recurse.
- **Identity splits in two.** `proxy !== target`, so a proxy used as a `Set` member or `Map` key
  does not match the raw object, and `WeakMap` lookups keyed on one will miss the other.
- **Nested objects** must be wrapped on access, which means either wrapping deeply up front or
  caching wrappers — and returning the *same* wrapper each time, or identity splits again.

**Signals are the simpler thing to implement; proxies are the nicer thing to use.** That trade is
the whole design difference between the two families of framework.

## When reactivity is the wrong tool

- **Server data.** Freshness, retries, deduplication and cache invalidation are not dependency
  tracking; a data-fetching library owns that, and a signal holds its result.
- **A stream of events over time.** A signal holds the *current* value and coalesces writes — if
  every occurrence matters, you want the pub/sub, an async iterator
  ([Phase 6 · 06](../../phase-6-iteration-and-destructuring/06-async-iterators/README.md)) or an
  `EventTarget` ([Phase 10 · 12](../../phase-10-events/12-eventtarget-base-class/README.md)).
- **Across a boundary.** Tracking is a graph inside one JavaScript realm. Another tab or another
  process needs an explicit message.

The Stage 1 proposal is candid about the audience, too: *"The API is not targeted to most
application developers. Instead, the signal API here is a better fit for frameworks to build on
top of."* Write these forty lines to understand the mechanism — reach for a maintained
implementation to ship.

## Gotchas

**Symptom:** An effect runs twice per change, and once with inconsistent values.
**Cause:** Eager propagation through a diamond — two paths from one source.
**Fix:** Mark dirty and recompute on read; batch effects into a queue flushed once.

**Symptom:** Reading the DOM straight after a write shows the old value.
**Cause:** Effects are batched into a microtask.
**Fix:** Await the framework's tick, or restructure so the read is inside an effect.

**Symptom:** Performance degrades the longer the page is open, in proportion to interactions.
**Cause:** Nested effects created on every parent run, none disposed.
**Fix:** An ownership tree — dispose children before re-running.

**Symptom:** An effect loops forever after adding a write to it.
**Cause:** It reads and writes the same signal.
**Fix:** `untrack` the read, or express the value as a `computed` instead of assigning it.

**Symptom:** A proxied object is not found in a `Set` or `Map` that holds the raw one.
**Cause:** The proxy is a different object identity.
**Fix:** Normalise at the boundary — store one form, unwrap with a `raw` accessor before comparing.

**Symptom:** Adding a new property to a reactive object does not update anything.
**Cause:** Tracking is per-key and nothing was tracking a key that did not exist.
**Fix:** Trap `has`/`ownKeys` too, or replace the object rather than mutating it.

## Interview questions

**★ What is a glitch, and how do you avoid it?**
An effect observing an inconsistent intermediate state when two paths lead from one source to it.
Avoid it by marking nodes dirty rather than recomputing eagerly, and by batching effects so the
graph settles before anything runs.

**★ Why is `computed` lazy?**
Because a change only marks it dirty; the value is recomputed on the next read. A computed nobody
reads never runs, and one that is marked several times still recomputes once.

**★ What does an ownership tree solve?**
Nested effects. Without one, every re-run of a parent creates another child effect that is never
disposed, and the work per change grows without bound.

**★ When would you use `untrack`?**
When a read must not create a dependency — reading a value while writing one, logging inside an
effect, or seeding something at creation time. The cost is a dependency that is now invisible.

**★ Signals or a `Proxy`?**
Signals are explicit and far simpler to implement correctly; a proxy gives plain property access
but needs traps for `has`, `deleteProperty` and `ownKeys`, special handling for arrays, and a
policy for identity and nesting.

**When is a signal the wrong container?**
For server state, and for streams where every event matters — a signal holds the current value and
coalesces writes. Use a data library or an event stream instead.

---

← Prev [From pub/sub to tracking](./01-from-pubsub-to-tracking.md) · [Topic index](./README.md)
