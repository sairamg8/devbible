---
title: "11.2 · Bounding and invalidating"
sidebar_label: "02 · Bounding and invalidating"
sidebar_position: 2
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-15 against MDN — [`Map`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Map), [`WeakMap`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/WeakMap), [`Promise`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise). Documentation-validated; **nothing was run**.

**A `Map`-backed memoise never forgets and never expires.** For `fib(n)` in an interview that
is fine. In an application it is a leak with a good reputation — and one of the few caches
people ship without a size limit because "it is just memoisation".

## Bound it

```js
function memoize(fn, { keyOf = (args) => args[0], max = 500 } = {}) {
  const cache = new Map();                       // insertion-ordered = LRU for free
  return function (...args) {
    const key = keyOf(args);
    if (cache.has(key)) {
      const value = cache.get(key);
      cache.delete(key); cache.set(key, value);  // touch: move to the recent end
      return value;
    }
    const value = fn.apply(this, args);
    cache.set(key, value);
    if (cache.size > max) cache.delete(cache.keys().next().value);
    return value;
  };
}
```

That is [09 · An LRU cache](../09-lru-cache/README.md) inlined — and in real code it should
*be* that class rather than a second copy. **A default `max` is the important part**: an
unbounded memoise is a bug waiting for an unusual input distribution.

**Which inputs are unbounded is the question to ask before memoising at all.** `slugify(title)`
over user-supplied titles has an unbounded key space; `parseSelector(sel)` over selectors in
your own source has a small one.

## Expire it

Memoisation assumes the function is **pure**. When the inputs are pure but the *world* is not —
a config lookup, a price, a permission — the result goes stale rather than wrong-per-argument:

```js
if (entry && entry.expires > Date.now()) return entry.value;
```

Same shape as [09.2](../09-lru-cache/02-making-it-real.md), same trade: lazy expiry on read,
and `performance.now()` if a clock change would matter. **If the function is genuinely impure,
do not memoise it** — add a cache with explicit invalidation instead, where the invalidation
is a designed part of the API rather than a TTL guess.

## Async memoisation: cache the promise

```js
function memoizeAsync(fn, { keyOf = (args) => args[0] } = {}) {
  const cache = new Map();
  return function (...args) {
    const key = keyOf(args);
    if (cache.has(key)) return cache.get(key);

    const promise = Promise.resolve()
      .then(() => fn.apply(this, args))
      .catch((err) => { cache.delete(key); throw err; });   // ← do not cache the failure

    cache.set(key, promise);
    return promise;
  };
}
```

**Storing the promise — not the resolved value — is what deduplicates concurrent callers.**
Ten calls before the first resolves all get the same promise, so the work happens once (the
stampede fix from [09.2](../09-lru-cache/02-making-it-real.md)).

⚠️ **The `catch` that deletes the key is not optional.** Without it a transient network failure
is memoised forever, and every later call re-rejects instantly with a stale error. Whether a
*successful* result should ever expire is then a separate decision.

## Invalidation belongs in the API

A memoised function that can go stale needs a way to say so:

```js
memoized.clear = () => cache.clear();
memoized.delete = (...args) => cache.delete(keyOf(args));
memoized.size = () => cache.size;
```

Three lines, and they turn "we cannot use memoisation here because the data changes" into a
solved problem. Attach them to the returned function so callers do not have to reach into a
closure — and note this is exactly what a test needs to isolate cases.

## When memoisation is the wrong tool

- **The function is cheap.** A `Map` lookup, a key derivation and an extra closure are not
  free. Memoising `x => x * 2` is slower than the original, and no measurement is needed to
  see it — you have added work to a function that does one multiplication.
- **The arguments are almost always new.** A near-zero hit rate is pure overhead plus a
  growing cache. Instrument hits and misses before assuming.
- **The function is impure or the world changes.** Memoisation is a claim that the same input
  always gives the same output.
- **The function has side effects.** They happen once and then silently stop — the most
  confusing bug in this list, because the return values stay correct.
- **The real fix is upstream.** Recomputing because a parent re-renders, or refetching because
  a component remounts, is a structural problem; memoisation hides it.

## The framework versions are the same idea, differently scoped

`useMemo`/`useCallback` memoise **one call site for one component instance**, keyed on a
dependency array compared with `Object.is` — not a general cache. Two consequences:

- **They are per-instance and per-render-tree**, so nothing is shared between components.
- **A dependency that is a new object every render defeats them entirely** — the same
  identity problem as [11.1](./01-the-key-problem.md), which is why deep-cloning state breaks
  memoisation ([Phase 4 · 04 · Shallow vs deep copy](../../phase-4-objects-and-classes/04-shallow-vs-deep-copy/README.md)).

A module-level `memoize` is the right tool for a pure computation shared across the app; a
hook is the right tool for a value tied to one component's props.

## Gotchas

**Symptom:** Memory grew steadily in a long-lived process
**Cause:** An unbounded memoise over an unbounded key space.
**Fix:** A `max` and LRU eviction; ask what the key space actually is.

**Symptom:** A memoised lookup kept returning last hour's value
**Cause:** The function depends on state outside its arguments.
**Fix:** A TTL, explicit invalidation, or do not memoise it.

**Symptom:** One failed request poisoned an endpoint for the session
**Cause:** A rejected promise left in the cache.
**Fix:** `.catch` that deletes the key and re-throws.

**Symptom:** Concurrent callers still triggered several requests
**Cause:** Caching the resolved value rather than the promise.
**Fix:** Store the promise as soon as the work starts.

**Symptom:** Side effects stopped happening after the first call
**Cause:** The memoised function was not pure.
**Fix:** Separate the effect from the computation, and memoise only the computation.

**Symptom:** Memoising made a hot path slower
**Cause:** A cheap function, or a hit rate near zero.
**Fix:** Remove it; count hits and misses before adding it back.

**Symptom:** `useMemo` never hit
**Cause:** A dependency created fresh each render — compared with `Object.is`.
**Fix:** Stabilise the dependency's identity, or key on primitives.

## Interview questions

**★ What is wrong with the textbook `memoize`?**
It never forgets. An unbounded `Map` over an unbounded key space is a leak, and there is no
staleness handling. Give it a `max` with LRU eviction, and a TTL or explicit invalidation if
the result can go stale.

**★ How do you memoise an async function?**
Cache the **promise**, not the resolved value, so concurrent callers share one in-flight
request — and delete the key when it rejects, so a transient failure is not remembered
forever.

**★ When should you not memoise?**
When the function is cheap, when arguments are almost always new, when it is impure or depends
on changing state, and when it has side effects — those happen once and then quietly stop.

**★ How does `useMemo` differ from a `memoize` helper?**
`useMemo` caches one value per component instance per call site, keyed on a dependency array
compared with `Object.is`, and it is a hint the framework may discard. A `memoize` helper is a
real cache, shared process-wide, keyed on arguments you choose.

**How do you invalidate a memoised result?**
Expose it: attach `clear`, `delete(...args)` and `size` to the returned function. Invalidation
that lives only inside a closure is invalidation you do not have.

**Why does the LRU version look identical to topic 09?**
Because it is: a bounded memoise *is* an LRU cache keyed on derived arguments. Compose the two
rather than writing the eviction logic twice.

---

← Prev [The key problem](./01-the-key-problem.md) · [Topic index](./README.md)
