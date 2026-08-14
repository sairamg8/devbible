---
title: "13 · Memoization"
sidebar_label: "13 · Memoization"
sidebar_position: 13
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-14 against MDN — [`Map`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Map), [`WeakMap`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/WeakMap), [`JSON.stringify()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/JSON/stringify), [Key equality in `Map`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Map#key_equality), [`Object.groupBy()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object/groupBy). Documentation-validated; **no timings**.

**Memoization is a cache with one rule: same input, same output, so remember it.** The wrapper
is six lines and nobody fails that part of the interview. **Key derivation and eviction are the
topic** — they are where memoization goes wrong in production, and they are what a good question
is actually about.

## The wrapper

```js
function memoize(fn, keyOf = (...args) => args[0]) {
  const cache = new Map();
  return function memoized(...args) {
    const key = keyOf(...args);
    if (cache.has(key)) return cache.get(key);       // 🔴 has, not a truthy check
    const value = fn.apply(this, args);
    cache.set(key, value);
    return value;
  };
}
```

Three decisions are already visible, and each is a question:

🔴 **`cache.has(key)`, never `if (cache.get(key))`.** A cached `0`, `""`, `null`, `false`,
`NaN` or `undefined` is falsy, so a truthy check recomputes it every single time — and for an
expensive function that returns `0` legitimately, the cache silently does nothing. This is the
most common memoization bug and it is invisible: nothing breaks, it is just slow.

**`Map`, not a plain object.** A `Map` accepts any key type, keeps insertion order, has `size`,
and cannot collide with `Object.prototype` — `memoize(f)("toString")` on an object cache finds an
inherited function and returns it as a cached result. `Object.create(null)` fixes that, but `Map`
is the right tool.

**`fn.apply(this, args)`** so a memoized method still works on its receiver — though see the
`this` trap below, because the cache is shared across receivers.

## Key derivation is the whole problem

The default above keys on the first argument, which is honest — it works for the single-argument
case and obviously fails otherwise. Every alternative has a real defect.

**`JSON.stringify(args)`** is the usual reach, and it is wrong more often than people expect:

```js
JSON.stringify({ a: 1, b: 2 });   // '{"a":1,"b":2}'
JSON.stringify({ b: 2, a: 1 });   // '{"b":2,"a":1}'   ⚠️ same object, different key
```

Two calls with equivalent arguments miss each other. Worse, MDN specifies `JSON.stringify`
**omits `undefined`, functions and symbols** in objects and turns them into `null` in arrays — so
`f(1, undefined)` and `f(1)` collapse to the same key, and any argument carrying a callback
stringifies identically regardless of which callback it is. It also throws on a circular
structure and on a `BigInt`. **It is a reasonable default only for flat, JSON-shaped, ordered
arguments — say that condition out loud when you use it.**

**`args.join(",")`** is faster and worse: `f(1, "2")` and `f("1", 2)` and `f("1,2")` all produce
`"1,2"`. Every object becomes `[object Object]`, which collides with every other object.

🔴 **The honest answer is that a general-purpose key function does not exist**, and the fix is to
stop trying to write one. Pass a key function that knows the arguments:

```js
const fetchUser = memoize(getUser, (id, { includeOrders } = {}) => `${id}:${!!includeOrders}`);
```

That is three seconds of thought per call site and it removes the entire class of bug. **A
memoize that demands a key function is a better API than one that guesses.**

**For a multi-argument cache without stringifying**, nest maps one level per argument — a cache
tree. It is exact, has no serialisation cost, and the price is that eviction becomes much harder,
which is usually what rules it out.

## Eviction, or the leak

⚠️ **A memoized function is a memory leak by default.** The cache is captured by the closure, has
no bound, and lives as long as the function does — which for a module-level `const` is the life
of the page or the process. Every distinct argument adds an entry that is never removed.

For a fixed, small domain (a parser keyed on a token, `fib(n)` for `n < 100`) that is fine and
the unbounded cache is the right choice. **The moment the key space is user-controlled — a search
string, a user id, a URL — an unbounded cache is a slow leak with a user-facing trigger.**

Three bounded strategies, in order of how often they are the right answer:

**Cap the size.** A `Map` iterates in insertion order, so the oldest key is `cache.keys().next().value`
and eviction is two lines:

```js
if (cache.size > MAX) cache.delete(cache.keys().next().value);
```

That is **FIFO**, not LRU — it evicts the oldest *inserted*, not the least recently *used*. For
LRU you must also `delete` and re-`set` a key on every read so it moves to the end. Say which one
you built; conflating them is a common miss. The O(1) LRU with a doubly linked list is
**Phase 17 topic 09 · An LRU cache in O(1)** *(not written yet)*.

**Key on the object with a `WeakMap`.** When the cache key *is* an object — memoizing a derived
value per DOM node, per request, per component instance — a `WeakMap` holds its keys weakly, so an
entry disappears when the key is garbage collected. MDN is explicit that `WeakMap` keys must be
objects (or non-registered symbols) and are not enumerable. 🔴 **This is the one eviction strategy
that needs no policy at all** — the object's lifetime *is* the cache policy. It is the right answer
far more often than people reach for it.

**Time-bound it.** Store `{ value, at }` and treat an entry older than a TTL as a miss. Necessary
whenever the underlying answer can change — which is the next section.

## Where memoization is simply wrong

**Impure functions.** If the result depends on anything but the arguments — the clock, a
database, `Math.random`, module state — memoizing freezes the first answer forever. The cache is
correct; the assumption was not.

**Functions with side effects.** A cached call does not run the function, so the side effect
happens once and then silently stops. A memoized `logAndFetch` logs one time in the process's
life. **Purity is the precondition, and it is worth stating before writing any code.**

**Cheap functions.** A `Map` lookup, a key derivation and a closure hop are not free. Memoizing
`(a, b) => a + b` is slower than the addition and now leaks as well.

**Large values under a large key space.** The cache is now the memory problem you were not
having.

**Recursive functions memoized from the outside.** This one is subtle:

```js
const fib = (n) => (n < 2 ? n : fib(n - 1) + fib(n - 2));
const memoFib = memoize(fib);     // ⚠️ almost useless
```

`memoFib(40)` caches exactly one entry, because the *internal* recursive calls still reference the
original unmemoized `fib`. The exponential work happens in full, once per distinct top-level
argument. **The function must call the memoized version** — define it recursively as
`const fib = memoize((n) => n < 2 ? n : fib(n-1) + fib(n-2))`, so the closure resolves `fib` to
the wrapper. That is the difference between exponential and linear, and it is a favourite
interview trap (the whole subject is **Phase 16 · Dynamic programming**, where this is called
top-down memoization).

## The `this` trap

```js
class Report {
  constructor(rows) { this.rows = rows; }
  total = memoize(function () { return this.rows.reduce((a, r) => a + r.amount, 0); });
}
```

The wrapper forwards `this` correctly — but if the cache is created **once per class rather than
per instance**, every instance shares it and the second instance gets the first one's total. A
key of `()` is the same key for everybody.

🔴 **Rule: a memoized method needs a per-instance cache, or `this` in the key.** The field form
above creates one cache per instance, which is right. A memoized method on the *prototype* shares
one cache across all instances, which is almost never right. A `WeakMap` keyed on `this` gives
you the per-instance cache with automatic cleanup.

## Gotchas

**Symptom:** A memoized function still recomputes every call
**Cause:** `if (cache.get(key))` treats a cached `0`, `""`, `null`, `false` or `undefined` as a miss.
**Fix:** `cache.has(key)`.

**Symptom:** Two equivalent calls miss each other
**Cause:** `JSON.stringify` key order follows property insertion order, so `{a,b}` and `{b,a}` differ.
**Fix:** A key function that names the fields in a fixed order.

**Symptom:** Calls with different arguments return each other's results
**Cause:** `args.join(",")` — every object becomes `[object Object]`, and `1` and `"1"` collide.
**Fix:** A key function, or a nested `Map` per argument.

**Symptom:** `f(1, undefined)` hits the cache entry for `f(1)`
**Cause:** MDN specifies `JSON.stringify` omits `undefined` in objects and nulls it in arrays.
**Fix:** Include arity in the key, or derive it explicitly.

**Symptom:** Memory grows for as long as the page is open
**Cause:** An unbounded cache on a user-controlled key space.
**Fix:** Cap the size, use a TTL, or key on an object with a `WeakMap`.

**Symptom:** The "LRU" evicts entries that were just used
**Cause:** Insertion-order eviction is FIFO; LRU needs a re-`set` on every read.
**Fix:** `delete` then `set` on a hit, or build a real LRU.

**Symptom:** A stale value is served after the data changed
**Cause:** The function is not pure — the answer depends on something outside the arguments.
**Fix:** Do not memoize it, or add a TTL and an explicit invalidation path.

**Symptom:** A side effect happens once and then never again
**Cause:** A cache hit does not call the function.
**Fix:** Memoize the pure computation, not the effectful wrapper.

**Symptom:** Memoizing a recursive function changes nothing
**Cause:** The recursive calls still reference the unmemoized function.
**Fix:** Make the function call the memoized binding.

**Symptom:** Two instances of a class report the same cached value
**Cause:** One cache shared across instances, with `this` absent from the key.
**Fix:** A per-instance cache, or a `WeakMap` keyed on `this`.

## Interview questions

**★ Write `memoize`.**
A `Map` in a closure; derive a key; `if (cache.has(key)) return cache.get(key)`; otherwise
`fn.apply(this, args)`, store, return. Take the key function as a parameter.

**★ Why `has` rather than checking the value?**
Because `0`, `""`, `null`, `false`, `NaN` and `undefined` are legitimate cached values and all
falsy. A truthy check recomputes them forever — a silent performance bug, not a crash.

**★ How do you key on multiple arguments?**
There is no correct general answer, which is the point. `JSON.stringify` is order-sensitive on
object properties, drops `undefined`, functions and symbols, and throws on circular structures and
`BigInt`. `join` collapses every object to `[object Object]`. Pass a key function per call site, or
nest a `Map` per argument.

**★ What is the memory risk?**
The cache is closed over and unbounded, so it lives as long as the function. Fine for a small
fixed domain; a leak the moment the key space is user-controlled. Bound it by size, by time, or
use a `WeakMap` when the key is an object.

**★ When is a `WeakMap` the right cache?**
When the key *is* an object — per DOM node, per request, per instance. Keys are held weakly, so
entries vanish with the object and there is no eviction policy to get wrong. Keys must be objects
or non-registered symbols, and the map is not enumerable.

**★ Why does memoizing a recursive `fib` from the outside not help?**
The internal recursive calls still reference the original function, so only the top-level call is
cached and the exponential work happens in full. The function has to call the memoized binding.

**★ When would you not memoize?**
Impure functions, functions with side effects, cheap functions, and large values over a large key
space. Purity is the precondition — say it before writing the wrapper.

**Is FIFO eviction the same as LRU?**
No. A `Map` iterates in insertion order, so deleting the first key evicts the oldest *inserted*.
LRU needs the key moved to the end on every read — `delete` then `set` — or a proper linked-list
implementation.

---

← [12 · Composition](./12-composition.md) · [Phase index](./README.md) · **14 · Recursion** *(not written yet)* →
