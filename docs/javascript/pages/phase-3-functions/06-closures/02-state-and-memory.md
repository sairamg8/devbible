---
title: "06.2 · Private state and memory"
sidebar_label: "02 · State and memory"
sidebar_position: 2
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 on **Node 24.19.0** (V8 13.6). Script: `sandbox/js-p3/ex6-closures.mjs`.

**A closure is the oldest way to have private state in JavaScript**, and the
oldest way to leak memory. Both come from the same property: the variables stay
alive as long as the function does.

## The counter factory

```
--- private state — the counter factory ---
  c1.get() after two inc                           2
  c2.get() after one dec from 100                  99
  count is reachable from outside?                 false
  two counters share state?                        false
```

```js
function makeCounter(start = 0) {
  let count = start;
  return {inc: () => ++count, dec: () => --count, get: () => count};
}
const c1 = makeCounter();
const c2 = makeCounter(100);
```

`count` is genuinely private — `'count' in c1` is `false`, and there is no
syntax that reaches it. The only access is through the three functions returned,
which is the whole point: **the closure is the encapsulation boundary.**

Each call to `makeCounter` creates a new scope, so `c1` and `c2` are independent
— measured `false` for sharing state. This is worth stating because it is the
opposite of the loop bug: **a new scope per call is exactly what `var` in a loop
failed to give you.**

Compare with the alternatives:

| Approach | Privacy | Cost |
|---|---|---|
| Closure | Total — unreachable from outside | One closure set per instance |
| `#private` class field | Total — `TypeError` on outside access | Needs a class; per-instance data on the instance |
| `_underscore` convention | None — just a naming hint | Free |
| `WeakMap` keyed by instance | Total | Indirection on every access |

**The trade-off for closures:** you pay one function object per method per
instance. For a handful of long-lived objects that is nothing; for a value type
allocated in a hot loop, `#private` class fields with prototype methods are
cheaper.

## Closures created together share one scope

```
--- closures share one scope when created together ---
  a() twice then b() — one shared n                4
    final value via b()                            5
```

```js
function makeShared() {
  let n = 0;
  return {a: () => ++n, b: () => ++n};
}
```

`a` and `b` are two functions over **one** `n`. Three calls to `a`/`b` in any
combination advance the same counter. This is what makes the counter factory work
at all — `inc`, `dec` and `get` must see the same `count`.

The rule: **one scope per *call* of the enclosing function, shared by every
closure created during that call.** Not one scope per closure.

## What a closure actually keeps alive

The common claim is that a closure retains its entire enclosing scope. **That is
false**, and the difference is large enough to measure. Two factories, identical
except for whether the returned closure mentions the big array:

```js
const makeBig = () => Array.from({length: 300000}, (_, n) => ({n, tag: 'row'}));

function ignoresBig() {
  const big = makeBig();
  big[0].n = 1;
  return () => 'I never mention big';
}
function usesBig() {
  const big = makeBig();
  big[0].n = 1;
  return () => big[0].n;             // the only difference
}
```

```
--- what a closure keeps alive — does an UNUSED variable stay in the context? ---
  baseline heap                                    4 MB
  5 closures that IGNORE a 300k-object array       4 MB   (+0)
  5 closures that USE a 300k-object array          73 MB   (+69)
    they still work                                1
  after dropping those closures                    4 MB   (+0)
```

**V8 only captures the variables the closure actually references.** Five closures
that ignore the array added nothing; five that read one element retained 69 MB.
Dropping the references returned the heap to baseline, confirming the retention
was live, not a measurement artefact.

Two caveats worth stating rather than hiding:

- **This is an optimisation, not a specification guarantee.** The spec describes
  a scope chain; pruning unreferenced bindings is V8's implementation choice.
  Correct code should not depend on it, though every serious engine does it.
- **The measurement needed heap-resident data.** An earlier version of this
  experiment used a `Uint8Array` and reported `+0` for *both* cases — a typed
  array's backing store is external memory and never appears in `heapUsed`. That
  result looked like a finding and was an instrumentation bug.

### Where it does leak

The optimisation prunes what is *unreferenced*, so a closure that does reference
something big holds all of it:

```js
function makeHandlers(rows) {
  return rows.map((row) => () => row.id);   // each closure holds ONE row
}
```

Measured `[0,1,2]` — each handler holds its own row, not the whole array. But
write it as `() => rows[i].id` and every handler holds the **entire** `rows`
array, because that is the variable it references. One long-lived event listener
is then enough to pin a full result set in memory.

**The rule: reference the smallest thing that does the job.** Destructure the
field you need before creating the closure, and the rest becomes collectable.

## The stale-closure bug

```
--- the stale-closure bug: a captured value that never updates ---
  staleRead() after two bumps                      0
  liveRead() after two bumps                       2
```

```js
function makeStale() {
  let value = 0;
  const snapshot = value;                 // captured ONCE, by value
  return {
    staleRead: () => snapshot,            // never changes
    liveRead: () => value,                // follows the variable
    bump: () => { value += 1; },
  };
}
```

Closing over a **copy** rather than the variable gives a value frozen at creation
time. `snapshot` was read once, when `value` was `0`, and no amount of `bump()`
changes it.

This is the mechanism behind the stale-closure bug React made famous. An effect
or callback captures a value from the render it was created in; later renders
create new bindings, but the old callback still holds the old one. The symptom is
always the same: **a handler acting on data that is one or more updates behind.**

The fixes are the same in plain JavaScript as in React:

1. **Close over the variable, not a copy** — `liveRead` above.
2. **Read through a mutable container** — a `ref`-style object whose `.current`
   you update, so the closure holds the box rather than the contents.
3. **Recreate the closure when the value changes** — React's dependency array.
4. **Use an updater function** — `setCount(c => c + 1)` never reads a captured
   `count` at all.

Full treatment in
[17 · Closure and default-parameter gotchas](../17-closure-and-default-gotchas/README.md).

## Gotchas

**Symptom:** Memory grows and never comes back down, with long-lived listeners
or timers
**Cause:** A closure references something large and stays reachable. Measured:
five closures reading one element of a 300k-object array retained 69 MB.
**Fix:** Reference the smallest value needed — destructure the field before
creating the closure — and remove listeners when done.

**Symptom:** A callback keeps acting on old data after an update
**Cause:** It closed over a copy, or over a binding from an earlier render.
Measured: `staleRead()` returned `0` after two increments while `liveRead()`
returned `2`.
**Fix:** Close over the variable, use a mutable ref, recreate the closure, or use
an updater function.

**Symptom:** Two objects from the same factory unexpectedly share state
**Cause:** The state was declared *outside* the factory, so there is one binding
rather than one per call.
**Fix:** Move the `let` inside the function. Measured: separate calls give
independent state (`2` and `99`).

**Symptom:** Methods on one object disagree about the current value
**Cause:** They were created in different calls of the factory, so they close
over different scopes.
**Fix:** Create them in one call — closures created together share one scope,
measured.

**Symptom:** A heap measurement shows no growth for obviously large data
**Cause:** `heapUsed` excludes external memory, so typed arrays and buffers are
invisible to it.
**Fix:** Measure with heap-resident objects, or read `external` / `arrayBuffers`
from `process.memoryUsage()`.

## Interview questions

**★ How do you get private state in JavaScript?**
A closure — declare the variable in a factory and return functions over it.
Measured: `'count' in c1` is `false`, so there is no path to it from outside.
The modern alternative is a `#private` class field; the closure costs one
function object per method per instance.

**★ Does a closure keep its entire enclosing scope alive?**
No. Measured: five closures that ignored a 300k-object array added **0 MB**;
five that referenced one element retained **69 MB**. V8 captures only the
variables actually referenced. It is an engine optimisation rather than a spec
guarantee, so do not rely on it for correctness.

**★ What is a stale closure?**
A function holding a value from when it was created rather than the current one.
Measured: `staleRead()` returned `0` after two increments. It happens when you
close over a copy, or over a binding from a previous render. Fix with a mutable
ref, a recreated closure, or an updater function.

**★ Do two objects from the same factory share state?**
No — each call creates a new scope. Measured: two counters at `2` and `99`
independently. Closures created *within one call*, however, do share that call's
scope, which is what makes `inc`/`dec`/`get` agree.

**How would you avoid a closure-related memory leak?**
Reference the smallest thing needed — destructure the one field rather than
closing over the whole array — and remove long-lived listeners and timers.
Measured: closures over individual rows retain rows; a closure over `rows[i]`
retains the entire array.

**Why did an earlier version of this memory experiment show no growth?**
It allocated a `Uint8Array`, whose backing store is external memory and does not
appear in `heapUsed`. Both cases read `+0`, which looked like a finding and was
an instrumentation bug — a reminder to check what a metric actually counts
before drawing a conclusion from it.

---

← [What is captured](./01-what-is-captured.md) · [Topic index](./README.md) · Next → [Lexical scope and the scope chain](../07-lexical-scope/README.md)
