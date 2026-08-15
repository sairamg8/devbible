---
title: "17 · `Set`"
sidebar_label: "17 · Set"
sidebar_position: 17
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-15 against MDN — [`Set`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Set), [`Set.prototype.has()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Set/has), [`Set.prototype.union()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Set/union), [`Set.prototype.intersection()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Set/intersection), [`Set.prototype.difference()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Set/difference), [`Set.prototype.symmetricDifference()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Set/symmetricDifference), [`Set.prototype.isSubsetOf()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Set/isSubsetOf), [`Set.prototype.isDisjointFrom()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Set/isDisjointFrom), [`Map`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Map), [`WeakSet`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/WeakSet), [Equality comparisons and sameness](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Equality_comparisons_and_sameness). Documentation-validated; **no timings**.

**A `Set` is a collection of unique values with a membership test.** That is the whole idea, and the
two things it is actually used for are deduplication and `has`.

```js
const s = new Set([1, 2, 2, 3]);
s.size;          // 3 — duplicates dropped on construction
s.add(3);        // no-op, still 3
s.has(2);        // true
s.delete(2);     // true (false if it was not there)
[...s];          // [1, 3] — insertion order, always
```

**Insertion order is guaranteed** on iteration, which is one of the differences from a plain object
([10 · `Map` vs a plain object](./10-map-vs-object/README.md), where integer-like keys jump the
queue).

## The two idioms

```js
const unique = [...new Set(items)];                     // deduplicate
const allowed = new Set(["admin", "editor"]);           // membership
if (allowed.has(role)) …
```

🔴 **The membership case is the one worth changing habits for.** `array.includes(x)` scans; the spec
requires `Set` implementations to provide access times that are **sublinear in the number of
elements** on average. For a lookup inside a loop over another list, that is the difference between
a nested scan and a lookup — **no timings here**, but the algorithmic shape is the reason the
collection exists.

```js
const banned = new Set(bannedIds);                 // build once
const clean = users.filter((u) => !banned.has(u.id));   // ✅ lookup per user
const clean = users.filter((u) => !bannedIds.includes(u.id));   // ⚠️ scan per user
```

## Equality is SameValueZero — which decides what "unique" means

```js
new Set([NaN, NaN]).size;    // 1  ✅ NaN equals itself here
new Set([0, -0]).size;       // 1  — same value under SameValueZero
new Set(["1", 1]).size;      // 2  — no coercion, ever
```

**That is the same rule `includes` uses**, and the reason `NaN` behaves sensibly in both while
`indexOf` can never find it ([14 · `flat`, `flatMap`, `fill`](./14-flat-flatmap-fill.md) has the
three-algorithm table).

🔴 **Objects are compared by reference**, so deduplicating objects by *value* does not work:

```js
new Set([{ id: 1 }, { id: 1 }]).size;   // 🔴 2 — two different objects
```

**Deduplicate by a key instead**, and a `Map` does it in one pass while keeping the objects:

```js
const byId = new Map(users.map((u) => [u.id, u]));
const unique = [...byId.values()];      // ✅ last one wins per id
```

⚠️ **Do not reach for `JSON.stringify` as a value key.** Property order changes the string, so two
equal objects can produce different keys — and `undefined`, functions and `Map`s are dropped
silently ([09 · `JSON`](./09-json/README.md)).

## The set operations

Modern engines have the actual set algebra, and every method **returns a new `Set`**:

```js
const a = new Set([1, 2, 3]);
const b = new Set([2, 3, 4]);

a.union(b);                // {1, 2, 3, 4}
a.intersection(b);         // {2, 3}
a.difference(b);           // {1}       — in a, not in b
a.symmetricDifference(b);  // {1, 4}    — in exactly one
a.isSubsetOf(b);           // false
a.isSupersetOf(b);         // false
a.isDisjointFrom(b);       // false
```

⚠️ **These are recent** — check your target browsers and Node version before relying on them. The
equivalents that work everywhere:

```js
const union = new Set([...a, ...b]);
const intersection = new Set([...a].filter((x) => b.has(x)));
const difference = new Set([...a].filter((x) => !b.has(x)));
const isSubset = [...a].every((x) => b.has(x));
```

**A detail worth knowing:** the argument does not have to be a `Set` — it must be **set-like**
(having `size`, `has` and `keys`). A `Map` qualifies, so `mySet.intersection(myMap)` compares
against the map's **keys**. ⚠️ A plain array does **not** qualify and throws.

## What a `Set` is not

- **Not indexable.** No `s[0]`; spread it or use `values()`.
- **Not `map`/`filter`-able directly.** `[...s].filter(…)` and rebuild, or iterate.
- **Not JSON-serialisable.** `JSON.stringify(new Set([1,2]))` gives `{}` — the same
  own-enumerable-properties rule that empties a `Map`. Convert with `[...s]`.
- **Not frozen by `Object.freeze`.** Its contents live in internal slots, so a frozen `Set` still
  accepts `add` ([Phase 4 · 12 · What freeze cannot reach](../phase-4-objects-and-classes/12-freeze-and-seal/02-what-freeze-cannot-reach.md)).

**`WeakSet`** holds its members weakly, so an object in one can still be garbage-collected — it is
for marking objects ("have I seen this node?") without keeping them alive. It is not iterable and
has no `size`; the detail is in **23 · `WeakMap` and `WeakSet`** *(not written yet)*.

## Choosing between `Set`, array and object

| You need | Use |
|---|---|
| unique values, order preserved | `Set` |
| repeated membership tests | `Set` |
| a value per key | `Map` |
| order, indexes, `map`/`filter`, JSON | array |
| a fixed record of known fields | plain object |
| to mark objects without retaining them | `WeakSet` |

⚠️ **A `Set` you build, use once and throw away has bought you nothing** over `includes` — the win
is repeated lookups. Building one inside the loop that queries it is the mistake to watch for.

## Gotchas

**Symptom:** Deduplicating objects left duplicates
**Cause:** `Set` compares objects by reference, not by value.
**Fix:** Key them — `new Map(items.map((i) => [i.id, i]))` — and take `.values()`.

**Symptom:** `JSON.stringify(set)` produced `{}`
**Cause:** A `Set`'s contents are internal slots, not own enumerable properties.
**Fix:** `JSON.stringify([...set])`.

**Symptom:** `set.map is not a function`
**Cause:** `Set` has no array methods.
**Fix:** `[...set].map(…)`.

**Symptom:** A frozen `Set` still accepted `add`
**Cause:** `Object.freeze` only affects properties.
**Fix:** There is no built-in immutable `Set`; wrap it or hand out copies.

**Symptom:** `TypeError` from `set.intersection(array)`
**Cause:** The argument must be set-like — `size`, `has`, `keys`. An array is not.
**Fix:** `set.intersection(new Set(array))`.

**Symptom:** `set.union is not a function`
**Cause:** The set methods are recent and missing in older targets.
**Fix:** The spread/filter equivalents, or check support first.

**Symptom:** `new Set(["1", 1])` has two entries
**Cause:** No coercion — SameValueZero compares types too.
**Fix:** Normalise the values before inserting.

**Symptom:** Switching to a `Set` made no difference
**Cause:** It is built and queried once, so the scan just moved.
**Fix:** Build it outside the loop that queries it.

## Interview questions

**★ What is a `Set` for?**
Unique values and membership tests. Deduplication via `[...new Set(arr)]`, and `has` for repeated
lookups — the spec requires implementations to give sublinear average access, so a `Set` built once
and queried in a loop replaces a scan per iteration.

**★ What equality does a `Set` use?**
SameValueZero — the same rule as `includes`. So `NaN` deduplicates correctly (unlike with `indexOf`),
`0` and `-0` count as the same value, and there is no coercion, so `"1"` and `1` are distinct.

**★ Why does deduplicating objects with a `Set` not work?**
Objects are compared by reference, so two structurally identical objects are two members. Key them
into a `Map` by id and take `.values()`, which also keeps the objects rather than a stringified form.

**★ What are the set methods, and what should you check before using them?**
`union`, `intersection`, `difference`, `symmetricDifference`, `isSubsetOf`, `isSupersetOf`,
`isDisjointFrom` — each returning a new `Set`. They are recent, so check target support; the
spread-and-filter equivalents work everywhere. Their argument must be **set-like**, so a `Map` works
(matching on its keys) and an array throws.

**★ What can a `Set` not do that an array can?**
Index access, `map`/`filter` directly, and JSON serialisation — `JSON.stringify(set)` is `{}`.
Spread it into an array for all three.

**When is a `Set` the wrong choice?**
When it is built and used once — the scan has just moved. And when you need a value per key, which
is a `Map`, or an ordered indexable list, which is an array.

**Why does `Object.freeze` not protect a `Set`?**
Its contents live in internal slots rather than properties, so there is nothing for the frozen flags
to apply to. `add` and `delete` keep working.

---

← [16 · Regular expressions — in practice](./16-regex-in-practice/README.md) · [Phase index](./README.md) · Next: **18 · `Object` statics** *(not written yet)* →
