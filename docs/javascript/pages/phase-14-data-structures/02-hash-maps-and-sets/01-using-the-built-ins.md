---
title: "02.1 · Using the built-ins"
sidebar_label: "01 · Using the built-ins"
sidebar_position: 1
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-14 against MDN — [`Map`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Map), [`Set`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Set), [`WeakMap`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/WeakMap), [SameValueZero](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Equality_comparisons_and_sameness#same-value-zero_equality), [`Object.create()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object/create). Documentation-validated; **no timings**.

**`Map` and `Set` are the hash table you should be using**, and the interview question about
implementing one is about the *mechanism*, not about the API. This chunk is the API and its
sharp edges; [02 · How hashing works](./02-how-hashing-works.md) is the mechanism.

## The API, and what each guarantee is worth

```js
const m = new Map([["a", 1], ["b", 2]]);

m.get("a");        // 1        — sublinear
m.set("c", 3);     // the Map  — chainable
m.has("c");        // true
m.delete("c");     // true if it was there
m.size;            // 2        — O(1)
[...m];            // [["a",1],["b",2]]  — insertion order
[...m.keys()]; [...m.values()]; [...m.entries()];
m.forEach((value, key) => …);   // value first, like Set
```

```js
const s = new Set([1, 2, 2, 3]);   // {1, 2, 3} — construction deduplicates

s.has(2);          // true      — sublinear
s.add(4);          // the Set   — chainable
s.delete(4);
s.size;            // 3
[...s];            // [1, 2, 3] — insertion order
```

🔴 **What the specification actually guarantees is *sublinear*, not O(1).** MDN, quoting it:

> "The specification requires maps to be implemented 'that, on average, provide access times that
> are **sublinear on the number of elements** in the collection'. Therefore, it could be
> represented internally as a hash table (with O(1) lookup), a search tree (with O(log(N))
> lookup), or any other data structure, as long as the complexity is **better than O(N)**."

Engines use hash tables. Saying "sublinear, hash table in practice" is the answer that shows you
read the spec.

**Insertion order is guaranteed** — a `Map` "iterates entries, keys, and values in the order of
entry insertion". That is a real difference from a hash table in most other languages, and it is
why `Map` can replace an ordered array of pairs.

⚠️ **`set` on an existing key updates the value and keeps the original position.** Delete and
re-add if you need it moved to the end — which is exactly the operation an LRU cache needs.

## SameValueZero — the equality that is neither `===` nor `Object.is`

MDN: *"Value equality is based on the SameValueZero algorithm."*

| Comparison | `===` | `SameValueZero` (Map/Set) | `Object.is` |
|---|---|---|---|
| `NaN` vs `NaN` | `false` | **`true`** | `true` |
| `+0` vs `-0` | `true` | **`true`** | `false` |
| two identical objects | `false` | `false` | `false` |

Three practical consequences:

```js
new Set([NaN, NaN]).size;        // 1  ✅ NaN deduplicates — unlike an array indexOf
new Set([0, -0]).size;           // 1  — the same key
new Set([{id:1}, {id:1}]).size;  // 2  🔴 objects compare by REFERENCE
```

🔴 **A `Set` of objects deduplicates identity, not content.** Deduplicating records needs a key:

```js
const unique = [...new Map(items.map((i) => [i.id, i])).values()];   // last one wins
```

**`NaN` working is genuinely useful** — `[NaN].includes(NaN)` is `true` (`includes` uses
SameValueZero) but `[NaN].indexOf(NaN)` is `-1` (`indexOf` uses `===`). That inconsistency in the
array API is a common source of confusion, and `Set` sidesteps it.

## `Map` versus a plain object, decided

The comparison lives in
[Phase 5 · 10 · `Map` vs `Object`](../../phase-5-built-in-library/10-map-vs-object/README.md) and
[Phase 13 · 03](../../phase-13-complexity/03-choosing-a-structure/01-the-decision-table.md); the
short version, from MDN's own table:

- keys "can be any value" vs "must be either a `String` or a `Symbol`";
- "A `Map` does not contain any keys by default" vs "An `Object` has a prototype, so it contains
  default keys that could collide with your own keys";
- `size` is a property vs "more roundabout and less efficient";
- a `Map` is directly iterable, an `Object` "does not implement an iteration protocol";
- `Map` "performs better in scenarios involving frequent additions and removals of key-value
  pairs".

**The rule: keyed by runtime data → `Map`. Fixed, known fields → object.**

If you must use an object as a dictionary — for JSON compatibility, usually — then
`Object.create(null)` gives you one with no prototype, and therefore no inherited keys to collide
with:

```js
const counts = Object.create(null);
counts["constructor"] = 1;         // ✅ just a key now
"toString" in counts;              // false
```

## The patterns that come up constantly

**Get-or-create**, the backbone of grouping and adjacency lists:

```js
function push(map, key, value) {
  if (!map.has(key)) map.set(key, []);
  map.get(key).push(value);
}
```

⚠️ **`??=` does not help here** — `map.get(k) ??= []` is not valid, because `get` is a method call
and not an assignable reference. The `has`/`set`/`get` dance, or a `Map` subclass with a
`getOrCreate`, is the idiom. Grouping specifically has a built-in now —
[03 · Frequency maps and grouping](../../phase-14-data-structures/03-frequency-and-grouping/README.md).

**Set algebra**, which now has methods (ES2025) as well as the manual forms:

```js
// manual — works everywhere
const union        = new Set([...a, ...b]);
const intersection = new Set([...a].filter((x) => b.has(x)));
const difference   = new Set([...a].filter((x) => !b.has(x)));

// built-in
a.union(b); a.intersection(b); a.difference(b); a.symmetricDifference(b);
a.isSubsetOf(b); a.isSupersetOf(b); a.isDisjointFrom(b);
```

⚠️ **Check availability before relying on the methods** — they are recent, and the manual forms
are two lines. Note the manual `intersection` is O(|a|) only because `b.has` is sublinear;
`[...a].filter(x => [...b].includes(x))` is quadratic and looks nearly identical.

**Counting**, the single most useful line in interview problems:

```js
const counts = new Map();
for (const x of items) counts.set(x, (counts.get(x) ?? 0) + 1);
```

## Gotchas

**Symptom:** A `Set` does not deduplicate identical-looking objects
**Cause:** SameValueZero compares objects by reference.
**Fix:** Key by an id with a `Map`.

**Symptom:** `[NaN].indexOf(NaN)` is `-1` but `includes` finds it
**Cause:** `indexOf` uses `===`; `includes` and `Set` use SameValueZero.
**Fix:** Use `includes`/`Set` when `NaN` matters.

**Symptom:** A `Map` is described as guaranteed O(1)
**Cause:** The spec requires only sublinear access.
**Fix:** Say sublinear; hash table in practice.

**Symptom:** Re-setting a key does not move it to the end
**Cause:** `set` on an existing key updates in place and preserves position.
**Fix:** `delete` then `set` — the LRU operation.

**Symptom:** An object used as a dictionary answers for `"constructor"`
**Cause:** Inherited prototype keys.
**Fix:** `Map`, or `Object.create(null)`.

**Symptom:** `map.get(k) ??= []` is a syntax error
**Cause:** Logical assignment needs an assignable reference, not a method call.
**Fix:** `has`/`set`/`get`, or a helper.

**Symptom:** A "set intersection" is quadratic
**Cause:** `[...b].includes(x)` instead of `b.has(x)`.
**Fix:** Keep the membership test on the `Set`.

**Symptom:** `a.union(b)` is not a function
**Cause:** The set methods are recent.
**Fix:** Feature-detect, or use the spread/filter forms.

## Interview questions

**★ What complexity does `Map.get` guarantee?**
The specification requires access times *"sublinear on the number of elements"* — so a hash table
(O(1)) or a search tree (O(log n)) both satisfy it, *"as long as the complexity is better than
O(N)"*. Engines use hash tables.

**★ What equality does a `Set` use, and what surprises does it cause?**
SameValueZero: `NaN` equals `NaN` (unlike `===`), `+0` and `-0` are the same key, and objects
compare by **reference** — so a `Set` of structurally identical objects does not deduplicate. Key
by id with a `Map` for that.

**★ Deduplicate an array of records by id.**
`[...new Map(items.map(i => [i.id, i])).values()]` — later entries win. A `Set` cannot do it,
because it compares object identity.

**★ Why does re-inserting a key not move it in iteration order?**
`set` on an existing key updates the value in place and preserves the original insertion position.
Moving an entry to the end requires `delete` then `set` — which is precisely the touch operation
in an LRU cache.

**★ When is a plain object still the right dictionary?**
When the keys are fixed and known (a record), or when JSON serialisation matters — `Map` does not
serialise. If you need object-as-dictionary with runtime keys, `Object.create(null)` removes the
inherited-key collision.

**★ Write set intersection, and say why the obvious version is quadratic.**
`new Set([...a].filter(x => b.has(x)))` is O(|a|) because `has` is sublinear.
`[...a].filter(x => [...b].includes(x))` looks almost the same and is O(|a| · |b|) — `includes` is
a linear scan and the spread rebuilds the array every call.

**Why is insertion order worth mentioning at all?**
Because most languages' hash maps do not guarantee it. In JavaScript a `Map` is both a hash table
and an ordered collection, which lets it replace an array of pairs rather than accompany one.

---

[Topic index](./README.md) · Next → [02 · How hashing works](./02-how-hashing-works.md)
