---
title: "11.1 · The key problem"
sidebar_label: "01 · The key problem"
sidebar_position: 1
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-15 against MDN — [`Map`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Map), [`WeakMap`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/WeakMap), [`JSON.stringify()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/JSON/stringify) and [`Function.prototype.apply()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Function/apply). Documentation-validated; **nothing was run**.

`memoize` is six lines and the six lines are not the point. **The whole difficulty is
deciding when two calls are "the same call"** — which is a question about your arguments, not
about caching.

```js
function memoize(fn, keyOf = (args) => args[0]) {
  const cache = new Map();
  return function memoized(...args) {
    const key = keyOf(args);
    if (cache.has(key)) return cache.get(key);        // `has`, not a truthy check
    const value = fn.apply(this, args);
    cache.set(key, value);
    return value;
  };
}
```

Two details in that skeleton are already load-bearing:

- **`cache.has(key)` rather than `if (cache.get(key))`.** A cached `0`, `""`, `null`, `false`
  or `undefined` is a legitimate result, and a truthy check recomputes it every time — a
  silent performance bug in exactly the functions people memoise.
- **`fn.apply(this, args)`** and a `function` (not an arrow) wrapper, so a memoised *method*
  still gets its receiver ([02 · `call`, `apply` and `bind`](../02-call-apply-bind/README.md)).

## The default key only works for one primitive argument

`keyOf = (args) => args[0]` is right for `fib(n)`, `parseSelector(str)`, `slugify(title)` —
and wrong for everything else. Four strategies, in order of preference:

**1 · A hand-written key.** Explicit, canonical, and it documents which arguments matter:

```js
const search = memoize(doSearch, ([query, { page = 1, sort = "rank" } = {}]) =>
  `${query.trim().toLowerCase()}|${page}|${sort}`);
```

Normalising inside the key function (`trim`, `toLowerCase`, defaults) means `"Ada "` and
`"ada"` hit the same entry — a real hit-rate improvement no generic scheme can infer.

**2 · `JSON.stringify(args)` — the tempting one.** ⚠️ It is not canonical:

```js
JSON.stringify([{ a: 1, b: 2 }]) !== JSON.stringify([{ b: 2, a: 1 }]);   // same call, two keys
JSON.stringify([undefined]);        // "[null]" — undefined and null collide
JSON.stringify([new Date(0)]);      // a string; two different Dates could collide after formatting
JSON.stringify([() => {}]);         // "[null]" — every function is the same key
```

Use it only when the arguments are plain, small, JSON-safe data with stable key order — and
say so in a comment. `Map`-keyed structural equality does not exist in the language
([Phase 5 · 09 · JSON](../../phase-5-built-in-library/09-json/README.md)).

**3 · Nested `Map`s for multiple arguments**, keyed by identity at each level:

```js
function memoizeN(fn) {
  const root = new Map();
  return function (...args) {
    let node = root;
    for (const arg of args) {
      if (!node.has(arg)) node.set(arg, new Map());
      node = node.get(arg);
    }
    if (!node.has(RESULT)) node.set(RESULT, fn.apply(this, args));   // RESULT = a module symbol
    return node.get(RESULT);
  };
}
```

Exact, no serialisation, works with any argument type — and it **retains every argument
forever**, which for object arguments is a leak. It is the right shape for a fixed small
number of primitive arguments.

**4 · `WeakMap` when the argument is an object**, which fixes exactly that leak:

```js
function memoizeByObject(fn) {
  const cache = new WeakMap();
  return function (obj) {
    if (!cache.has(obj)) cache.set(obj, fn.call(this, obj));
    return cache.get(obj);
  };
}
```

Entries vanish when the key object is collected, so the cache cannot outlive its inputs. **The
cost is that identity is the equality** — a structurally identical object is a miss. That is
usually what you want for "expensive derivation of this specific object".

## Identity: `Map` keys compare with SameValueZero

Two consequences worth stating:

```js
memoized({ id: 1 });  memoized({ id: 1 });     // two different keys — always a miss
memoized(NaN);        memoized(NaN);           // ONE key — SameValueZero treats NaN as equal to itself
```

The `NaN` behaviour surprises people who expect `===` semantics, and it is the correct
behaviour for a cache. `0` and `-0` are also the same key.

## `this`, and the shared-cache trap

A memoised method defined once on a prototype shares **one cache across every instance**:

```js
class Report {
  total = memoize(function () { return heavySum(this.rows); });   // ⛔ shared if defined on the prototype
}
```

If the result depends on `this`, the receiver must be part of the key — or the memoisation
must be per instance (a field initialiser, as above, gives each instance its own). A `WeakMap`
keyed on `this` is the general fix:

```js
function memoizePerInstance(fn) {
  const perThis = new WeakMap();
  return function (...args) {
    if (!perThis.has(this)) perThis.set(this, new Map());
    const cache = perThis.get(this);
    const key = args[0];
    if (!cache.has(key)) cache.set(key, fn.apply(this, args));
    return cache.get(key);
  };
}
```

## Gotchas

**Symptom:** A function returning `0`/`false`/`undefined` was never actually cached
**Cause:** `if (cache.get(key))` instead of `cache.has(key)`.
**Fix:** Always test `has`.

**Symptom:** Object arguments never hit the cache
**Cause:** `Map` keys compare by identity (SameValueZero), not structure.
**Fix:** Derive a canonical key, or key on identity deliberately with a `WeakMap`.

**Symptom:** Two calls that differ only in property order missed each other
**Cause:** `JSON.stringify` is order-sensitive.
**Fix:** Build the key from the fields that matter, or sort the keys before stringifying.

**Symptom:** `memoized(undefined)` and `memoized(null)` shared a result
**Cause:** `JSON.stringify(undefined)` inside an array becomes `null`.
**Fix:** A key scheme that distinguishes them.

**Symptom:** A memoised method returned another instance's answer
**Cause:** One cache shared across all instances via the prototype.
**Fix:** Per-instance memoisation, or include `this` in the key with a `WeakMap`.

**Symptom:** `this` was `undefined` inside the memoised function
**Cause:** An arrow wrapper, or calling `fn(...args)` instead of `fn.apply(this, args)`.
**Fix:** A `function` wrapper and `apply`.

**Symptom:** Memory grew with every distinct argument
**Cause:** An unbounded `Map` — every key retained forever.
**Fix:** Bound it ([11.2](./02-bounding-and-invalidating.md)).

## Interview questions

**★ Write `memoize`.**
A `Map` from a derived key to the result; on call, compute the key, return the cached value if
`cache.has(key)`, otherwise call `fn.apply(this, args)`, store and return. Use a `function`
wrapper so `this` is forwarded, and accept a key function so the caller controls what "the
same call" means.

**★ Why `cache.has(key)` rather than checking the value?**
Because `0`, `""`, `false`, `null` and `undefined` are legitimate results. A truthy check
recomputes them on every call — the cache appears to work while doing nothing.

**★ How do you key on multiple arguments?**
Best: a hand-written key function that normalises and includes only what matters. Otherwise
nested `Map`s keyed by identity per argument. `JSON.stringify` is a last resort — it is
order-sensitive, collapses `undefined` to `null`, and turns functions into `null`.

**★ When is a `WeakMap` the right cache for memoisation?**
When the argument is an object and the result should live exactly as long as it does. Entries
are collected with the key, so there is no leak — at the cost of identity-based equality.

**Why do two structurally identical objects miss?**
`Map` and `WeakMap` compare keys with SameValueZero, which for objects is reference identity.
There is no structural-equality keying in the language.

**What breaks when you memoise a method?**
The receiver. A memoised function on the prototype shares one cache across instances, and an
arrow wrapper loses `this` entirely. Key on `this` with a `WeakMap`, or memoise per instance.

---

[Topic index](./README.md) · Next → [Bounding and invalidating](./02-bounding-and-invalidating.md)
