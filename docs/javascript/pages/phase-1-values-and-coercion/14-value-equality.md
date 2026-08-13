---
title: "14 · Value equality in practice"
sidebar_label: "14 · Value equality"
sidebar_position: 14
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 on **Node 24.19.0**. Script: `sandbox/js-p1/ex8-null-nan-equality.mjs`.

**Objects compare by identity, so "are these two things the same?" has no
built-in answer.** This page is what to do about that: when a shallow comparison
is enough, when you need a deep one, and why the popular
`JSON.stringify` shortcut is wrong in five distinct ways.

## The `JSON.stringify` comparison, measured

```
  key order matters  : false
  undefined dropped  : {} vs {}
  Date -> string     : {"d":"1970-01-01T00:00:00.000Z"}
  Map/Set lost       : {"m":{},"s":{}}
  NaN/Infinity -> null: {"n":null,"i":null}
```

```js
const equal = (a, b) => JSON.stringify(a) === JSON.stringify(b);
```

Five failures, all measured:

1. **Key order matters.** `{a:1,b:2}` and `{b:2,a:1}` are the same object to any
   sane definition and produce different strings — measured `false`.
2. **`undefined` is dropped.** `{a: undefined}` and `{}` both stringify to `{}`,
   so a present-but-undefined key compares equal to a missing one.
3. **`Date` becomes a string**, so a `Date` and its ISO string compare equal.
4. **`Map` and `Set` become `{}`**, so *any two* Maps compare equal regardless of
   contents.
5. **`NaN` and `Infinity` become `null`**, so `NaN` equals `Infinity` equals
   `null`.

It also **throws** on circular references and silently ignores functions and
symbol keys. It is fine for a quick debug check on flat, JSON-shaped data and
wrong as a general equality function.

## What to use instead

### 1. Compare the fields you care about

Usually the right answer, and always the fastest:

```js
const sameLine = (a, b) => a.sku === b.sku && a.qty === b.qty;
```

Explicit, obvious in review, and it does not pretend to a generality you do not
need.

### 2. Shallow equality

The workhorse behind React's `memo` and dependency arrays:

```js
function shallowEqual(a, b) {
  if (Object.is(a, b)) return true;
  if (typeof a !== 'object' || a === null ||
      typeof b !== 'object' || b === null) return false;

  const keysA = Object.keys(a);
  if (keysA.length !== Object.keys(b).length) return false;

  return keysA.every(k => Object.hasOwn(b, k) && Object.is(a[k], b[k]));
}
```

Note `Object.is` rather than `===`, so `NaN` compares equal to itself
([page 16](./16-object-is-and-zero.md)). And `Object.hasOwn` rather than
`k in b`, so an inherited key does not count.

**Shallow equality is one level deep.** It is exactly right for props and state
that are updated immutably — because immutable updates guarantee a changed branch
gets a new reference ([page 02](./02-references-vs-values.md)).

### 3. Deep equality

```js
function deepEqual(a, b) {
  if (Object.is(a, b)) return true;

  if (a instanceof Date && b instanceof Date) return a.getTime() === b.getTime();
  if (a instanceof RegExp && b instanceof RegExp) return a.source === b.source && a.flags === b.flags;

  if (typeof a !== 'object' || a === null ||
      typeof b !== 'object' || b === null) return false;
  if (Object.getPrototypeOf(a) !== Object.getPrototypeOf(b)) return false;

  if (a instanceof Map && b instanceof Map) {
    if (a.size !== b.size) return false;
    for (const [k, v] of a) {
      if (!b.has(k) || !deepEqual(v, b.get(k))) return false;
    }
    return true;
  }
  if (a instanceof Set && b instanceof Set) {
    if (a.size !== b.size) return false;
    for (const v of a) if (!b.has(v)) return false;
    return true;
  }

  const keysA = Object.keys(a);
  if (keysA.length !== Object.keys(b).length) return false;
  return keysA.every(k => Object.hasOwn(b, k) && deepEqual(a[k], b[k]));
}
```

Every branch corresponds to one of the JSON failures above. Phase 17 implements
this again with cycle handling, which this version deliberately lacks — a cycle
here recurses until the stack overflows.

In production, use a library (`fast-deep-equal`, `node:util`'s
`isDeepStrictEqual`, or your test framework's assertion) rather than shipping
your own.

```js
import { isDeepStrictEqual } from 'node:util';   // Node only
isDeepStrictEqual({ a: 1 }, { a: 1 });           // true
```

## Choosing

| Situation | Use |
|---|---|
| Two known shapes | Compare the fields directly |
| React props / memo / `useMemo` deps | **Shallow** |
| "Did this API response change?" | Compare an `ETag` or `updatedAt`, not the body |
| Test assertions | The framework's deep-equal |
| Deduplicating primitives | `Set` (SameValueZero, so `NaN` dedupes) |
| Deduplicating objects | A `Map` keyed by a stable ID |

> **The best deep comparison is the one you avoid.** If you find yourself
> deep-comparing two API responses, ask whether a version field, `ETag` or
> `updatedAt` would answer the question in O(1). In a storefront that is almost
> always true.

## Deduplicating by identity

```js
const unique = [...new Set([1, 1, NaN, NaN])];        // [1, NaN] — SameValueZero
const uniqueLines = [...new Map(lines.map(l => [l.sku, l])).values()];
```

The `Map` idiom keeps the **last** occurrence per key. Reverse the array first if
you want the first.

## Gotchas

**Symptom:** two identical-looking objects compare unequal.
**Cause:** identity comparison — separate objects are never `===`.
**Fix:** shallow or deep comparison, or compare the fields you care about.

**Symptom:** a `JSON.stringify` comparison reported two different objects equal.
**Cause:** one of the five measured failures — dropped `undefined`, `Map`
flattening, `NaN`→`null`, `Date`→string.
**Fix:** a real deep-equal.

**Symptom:** `JSON.stringify` threw `Converting circular structure to JSON`.
**Cause:** a cycle.
**Fix:** do not use it for comparison; a proper deep-equal with a seen-set
handles cycles.

**Symptom:** a `useMemo`/`useEffect` dependency fires every render.
**Cause:** an object or array literal in the deps array is a new reference each
time.
**Fix:** memoise the value, or depend on primitive fields instead.

**Symptom:** `new Set(objects)` did not deduplicate.
**Cause:** `Set` uses SameValueZero, which is identity for objects.
**Fix:** key a `Map` by a stable ID.

**Symptom:** a deep-equal overflowed the stack.
**Cause:** a circular reference.
**Fix:** track visited pairs in a `WeakMap`.

## Interview questions

**★ Why is `JSON.stringify(a) === JSON.stringify(b)` a bad equality check?**
Five measured reasons: key order changes the string, so equal objects compare
unequal; `undefined` values are dropped, so `{a: undefined}` equals `{}`; `Date`
becomes a string; `Map` and `Set` become `{}`, so any two Maps compare equal;
and `NaN`/`Infinity` become `null`. It also throws on cycles and ignores
functions and symbol keys.

**★ What is the difference between shallow and deep equality?**
Shallow compares one level — same key set, and each value compared with
`Object.is`. Deep recurses into nested values and needs special handling for
`Date`, `RegExp`, `Map`, `Set` and cycles. Shallow is what React uses for props,
and it is sufficient precisely because immutable updates give changed branches
new references.

**★ How would you implement deep equality?**
Short-circuit on `Object.is`; handle `Date` by timestamp and `RegExp` by
source and flags; reject differing prototypes; handle `Map` and `Set` by size and
membership; then compare own keys recursively with `Object.hasOwn`. Track visited
pairs in a `WeakMap` to survive cycles. In production use a library rather than
shipping your own.

**How do you deduplicate an array of objects?**
`new Set(objects)` will not work — `Set` compares objects by identity. Key a
`Map` by a stable field: `[...new Map(items.map(i => [i.id, i])).values()]`,
which keeps the last occurrence per key.

**When should you avoid deep comparison entirely?**
Whenever a cheaper signal exists — an `ETag`, a version number, an `updatedAt`
timestamp. Deep-comparing two API responses to detect change is O(n) work to
answer a question the server could have answered in a header.

---

← [13 · BigInt](./13-bigint.md) · [Phase index](./) · Next: [15 · Object wrappers and autoboxing](./15-object-wrappers.md) →
