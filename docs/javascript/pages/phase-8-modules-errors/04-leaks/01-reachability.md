---
title: "04.1 · Reachability is the whole model"
sidebar_label: "01 · Reachability"
sidebar_position: 1
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-14 against MDN — [Memory management](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Memory_management), [`WeakMap`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/WeakMap), [`WeakRef`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/WeakRef). Documentation-validated.

**There is only one rule, and every leak in [chunk 02](./02-the-four-leaks.md) is a violation
of it.** MDN:

> "This algorithm assumes the knowledge of a set of objects called **roots**. In JavaScript,
> the root is the global object. Periodically, the garbage collector will start from these
> roots, find all objects that are referenced from these roots, then all objects referenced
> from these, etc. Starting from the roots, the garbage collector will thus find all
> **reachable** objects and collect all non-reachable objects."

And the reduction that makes it work:

> "This algorithm reduces the definition of 'an object is no longer needed' to **'an object
> is unreachable.'**"

🔴 **Read that as the definition of a leak.** A leak in JavaScript is not memory the engine
failed to free — the engine frees everything unreachable, reliably. A leak is **something
still reachable that you have stopped needing**. The collector cannot tell the difference,
because there is nothing in the program that expresses it.

MDN states the limitation directly:

> "the inability to manually control garbage collection remains… In order to release the
> memory of an object, **it needs to be made explicitly unreachable**."

So there is exactly one fix for every leak: **break the reference.** Everything in the next
chunk is a variation on finding which reference it is.

## What this buys, and what it costs

**Circular references are not a problem.** MDN:

> "Circular references are no longer a problem, since the algorithm only cares about
> reachability."

Two objects pointing at each other are collected together as soon as nothing outside points
at either. (This *was* a real leak under the old reference-counting collectors, which is why
the folklore persists.)

**But one live reference retains a whole graph.** A single forgotten pointer to an object
keeps that object, everything it references, and everything those reference. This is why
leaks are rarely proportional to the mistake: one listener on one node can retain a whole
component tree.

## Closures retain their scope

MDN, on what stays reachable:

> "variables in closures retain their scope and prevent garbage collection"

A closure keeps its enclosing scope alive for as long as the closure itself is reachable. So
a small function stored somewhere long-lived can retain something very large:

```js
function makeHandler() {
  const hugeData = new Array(1e6).fill("…");   // retained
  return () => console.log("clicked");         // never uses hugeData…
}
element.addEventListener("click", makeHandler());
```

Whether `hugeData` is actually retained depends on the engine's optimisation of unused
captures — V8 does prune some — but **it is not a guarantee you should design against**. If a
closure that outlives a scope does not need a large value, do not leave it in the same
scope, or null it explicitly.

The pattern that makes this predictable is to capture only what you need:

```js
function makeHandler(hugeData) {
  const count = hugeData.length;      // take the small thing
  return () => console.log(count);    // hugeData is not captured
}
```

## The weak collections

MDN's summary:

> "`WeakMap` allows you to maintain a collection of key-value pairs, while `WeakSet` allows
> you to maintain a collection of unique values… **The keys of `WeakMap` and `WeakSet` can be
> garbage-collected** (for `WeakMap` objects, the values would then be eligible for garbage
> collection as well) **as long as nothing else in the program is referencing the key**."

This is the built-in answer to "I need to associate data with an object without keeping the
object alive":

```js
const metadata = new WeakMap();
metadata.set(domNode, { lastSeen: Date.now() });
// when domNode becomes unreachable, the entry goes too — automatically
```

**A `Map` here would be a leak.** The `Map` holds a strong reference to every key it has ever
been given, so every node ever seen stays reachable forever. Swapping `Map` for `WeakMap` is
the single highest-value one-word fix in this topic.

Two constraints MDN names, and both follow from the design:

- **"Can only store objects or symbols (not primitives)"** — a primitive has no identity to
  collect.
- **"Are not iterable (prevents observing garbage collection)"** — if you could enumerate a
  `WeakMap`, you could observe exactly when the collector ran, which would make collection
  timing an observable part of the language.

That second point also explains why `WeakMap` has no `.size`.

## `WeakRef` and `FinalizationRegistry`

MDN's caveat is the important part, so it goes first:

> "Due to performance and security concerns, **there is no guarantee of when the callback
> will be called, or if it will be called at all**. It should only be used for cleanup — and
> non-critical cleanup. `WeakRef` and `FinalizationRegistry` exist **solely for optimization
> of memory usage in long-running programs**."

`WeakRef` holds a reference that does not keep its target alive; `.deref()` returns the value
or `undefined` if it has gone. MDN's cache example:

```js
function cached(getter) {
  const cache = new Map();
  return async (key) => {
    if (cache.has(key)) {
      const dereferencedValue = cache.get(key).deref();
      if (dereferencedValue !== undefined) {
        return dereferencedValue;
      }
    }
    const value = await getter(key);
    cache.set(key, new WeakRef(value));
    return value;
  };
}
```

Note what that leaves behind: the `Map` still accumulates **keys and dead `WeakRef`
wrappers**. That is what `FinalizationRegistry` sweeps:

```js
const registry = new FinalizationRegistry((key) => {
  if (!cache.get(key)?.deref()) {
    cache.delete(key);
  }
});
```

🔴 **Reach for `WeakMap` first, and treat `WeakRef` as a last resort.** If the lifetime you
care about is "as long as this object lives", `WeakMap` expresses it exactly and needs no
callback. `WeakRef` is for caches of values with no natural owner — and its callback may
never fire.

## Gotchas

**Symptom:** Memory grows although "nothing holds that object"
**Cause:** Something does. MDN reduces "no longer needed" to *"unreachable"*, and the
collector cannot see intent.
**Fix:** Find the retaining reference — that is the only fix.

**Symptom:** Two objects referencing each other are assumed to leak
**Cause:** Folklore from reference-counting collectors. MDN: *"Circular references are no
longer a problem."*
**Fix:** Ignore cycles; look for a reference from a root.

**Symptom:** A tiny callback retains megabytes
**Cause:** Closures *"retain their scope"* — the callback keeps its whole enclosing scope
alive.
**Fix:** Capture only the small values you need, in a narrower function.

**Symptom:** A `Map` keyed by DOM nodes grows forever
**Cause:** A `Map` holds its keys **strongly**, so every node ever added stays reachable.
**Fix:** `WeakMap`. Its keys *"can be garbage-collected… as long as nothing else in the
program is referencing the key."*

**Symptom:** `WeakMap` has no `.size` and cannot be iterated
**Cause:** Deliberate — MDN: iteration would allow *"observing garbage collection"*.
**Fix:** Expected. If you need to enumerate, you need a real `Map` and an eviction policy.

**Symptom:** A `FinalizationRegistry` callback never runs
**Cause:** MDN: *"no guarantee of when the callback will be called, or if it will be called
at all."*
**Fix:** Never put required cleanup there. It is an optimisation, not a lifecycle hook.

## Interview questions

**★ What is a memory leak in JavaScript?**
Not memory the engine failed to free — it frees everything unreachable. A leak is **something
still reachable that you no longer need**. MDN reduces *"an object is no longer needed"* to
*"an object is unreachable"*, and the collector cannot see the difference. The only fix is to
break the reference.

**★ Do circular references leak?**
No, not with a mark-and-sweep collector. MDN: *"Circular references are no longer a problem,
since the algorithm only cares about reachability."* Two objects pointing at each other are
collected together once nothing outside points at either. The belief comes from
reference-counting collectors.

**★ How can a small closure retain a lot of memory?**
Closures *"retain their scope"* — the function keeps its whole enclosing scope alive, whether
or not it uses everything in it. A handler created next to a large array can retain that
array. Capture only what you need.

**★ When would you use a `WeakMap` instead of a `Map`?**
When the entry should live exactly as long as its key object — attaching metadata to DOM
nodes, for instance. A `Map` holds keys strongly and so keeps every key ever added alive; a
`WeakMap`'s keys *"can be garbage-collected… as long as nothing else in the program is
referencing the key."*

**★ Why can't you iterate a `WeakMap`?**
Because doing so would let you *"observe garbage collection"* — making collection timing an
observable part of the language. Same reason there is no `.size`.

**When is `FinalizationRegistry` appropriate?**
Rarely. MDN: there is *"no guarantee of when the callback will be called, or if it will be
called at all"*, and it exists *"solely for optimization of memory usage in long-running
programs"*. Never for required cleanup.

---

[Topic index](./README.md) · Next → [02 · The four leaks](./02-the-four-leaks.md)
