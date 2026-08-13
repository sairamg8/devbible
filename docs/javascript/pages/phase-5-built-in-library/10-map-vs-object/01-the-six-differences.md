---
title: "10.1 · The six differences"
sidebar_label: "01 · The six differences"
sidebar_position: 1
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-13 against MDN — [`Map`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Map). Documentation-validated.

**MDN has a table for this, and it is the right place to start.** Six differences,
each of which decides a real case.

## 1. Accidental keys

MDN:

> A `Map` does not contain any keys by default. It only contains what is explicitly put
> into it.
> An `Object` has a prototype, so it contains default keys that could collide with your
> own keys if you're not careful.

```js
const o = {};
o["toString"];     // a function — inherited, never assigned
"toString" in o;   // true

const m = new Map();
m.get("toString"); // undefined
m.has("toString"); // false
```

🔴 **This is the security-relevant one.** A dictionary keyed by user input — usernames,
tags, form field names — has entries it never received. `Object.create(null)` closes it
([Phase 4 · 01](../../phase-4-objects-and-classes/01-object-literals/04-proto-and-null-prototype.md)),
but a `Map` closes it *and* every other difference below.

## 2. Key types

MDN:

> A `Map`'s keys can be **any value** (including functions, objects, or any primitive).
> The keys of an `Object` must be either a `String` or a `Symbol`.

```js
const o = {};
o[1] = "a";  o["1"] = "b";   // the SAME property
o[{}] = "x"; o[{ a: 1 }] = "y";  // both "[object Object]" — one property

const m = new Map();
m.set(1, "a").set("1", "b");     // two entries
m.set({}, "x").set({}, "y");     // two entries — different objects
```

An object stringifies every key, so numbers collide with their string forms and **any
two objects collide with each other**. A `Map` compares by identity.

That makes `Map` the answer whenever the key is a DOM node, a request object, a
configuration object, or a number you care about *as a number*.

## 3. Key order

MDN:

> The keys in `Map` are ordered in a straightforward way: A `Map` object iterates
> entries, keys, and values **in the order of entry insertion**.
> Although the keys of an ordinary `Object` are ordered now, this was not always the
> case, and **the order is complex**. As a result, it's best not to rely on property
> order.

"Complex" is the three-tier rule from
[Phase 4 · 01 · Keys and order](../../phase-4-objects-and-classes/01-object-literals/03-keys-and-order.md):
integer-like keys ascending first, then strings by insertion, then symbols. So:

```js
const o = { 1002: "Ada", 17: "Grace" };
Object.keys(o);              // ["17", "1002"]  ← reordered

const m = new Map([[1002, "Ada"], [17, "Grace"]]);
[...m.keys()];               // [1002, 17]      ← as inserted
```

**An object keyed by numeric ID silently re-sorts itself; a `Map` does not.** That alone
settles most "which should I use?" questions for ID-keyed collections.

## 4. Size

MDN: *"The number of items in a `Map` is easily retrieved from its `size` property"*,
while for an object it is *"more roundabout and less efficient"* — typically
`Object.keys(o).length`, which builds an array to count it.

```js
m.size;                  // a property
Object.keys(o).length;   // allocates an array of every key
```

## 5. Iteration

MDN: *"A `Map` is an iterable, so it can be directly iterated"*, while *"`Object` does
not implement an iteration protocol, and so objects are not directly iterable using the
JavaScript `for...of` statement"*.

```js
for (const [k, v] of m) { … }                    // direct
for (const [k, v] of Object.entries(o)) { … }    // builds an intermediate array
```

`Map` also has `keys()`, `values()` and `entries()` returning iterators rather than
arrays, so `for...of` over a large map allocates nothing.

## 6. Performance for frequent changes

MDN: a `Map` *"performs better in scenarios involving frequent additions and removals of
key-value pairs"*, while an `Object` is *"not optimized"* for that.

That connects to
[Phase 4 · 03 · `delete` and its cost](../../phase-4-objects-and-classes/03-existence-checks-and-delete/03-delete-and-its-cost.md):
repeatedly adding and deleting object properties churns V8's hidden classes and can push
the object into dictionary mode. `map.delete(k)` is a first-class operation on a
structure built for it.

🔴 **As elsewhere in this corpus: no multiplier is claimed.** MDN states a direction, not
a factor, and this corpus builds no benchmarks. **"If you are calling `delete` in a
loop, you wanted a `Map`"** is the usable form of the advice.

## Key equality is SameValueZero

MDN: *"Value equality is based on the **SameValueZero** algorithm"*, which means:

- **`NaN` is considered the same as `NaN`** *"(even though `NaN !== NaN`)"*
- everything else follows `===`
- **object keys compare by identity** — *"by reference, not by value"*
- `0` and `-0` are **equal** (MDN notes the algorithm used to be SameValue, which
  distinguished them)

```js
const m = new Map();
m.set(NaN, "works");
m.get(NaN);          // "works"  ← impossible with === semantics
```

`NaN` as a usable key is a genuine capability — with an object you would have to
stringify it, and with `indexOf` you could never find it. `Set` and
`Array.prototype.includes` use the same algorithm, which is why `includes(NaN)` is
`true` while `indexOf(NaN)` is `-1`.

## The API

```js
m.set(k, v);       // returns the MAP — so calls chain
m.get(k);          // undefined if absent
m.has(k);          // boolean
m.delete(k);       // boolean: was it there?
m.clear();
m.size;

new Map([[k1, v1], [k2, v2]]);   // from an iterable of pairs
new Map(Object.entries(obj));    // from an object
Object.fromEntries(map);         // back to an object
```

**`set` returning the map** is why the `reduce` idiom from
[05 · The shape](../05-reduce/01-the-shape.md) works:
`items.reduce((m, i) => m.set(i.id, i), new Map())`.

**`delete` returning a boolean** is more useful than the object equivalent, where
`delete` returns `true` even for a key that was never there.

## Gotchas

**Symptom:** A lookup returns something for a key nobody added
**Cause:** An object inherits `Object.prototype`'s keys — MDN: *"it contains default keys
that could collide with your own"*.
**Fix:** A `Map`, or `Object.create(null)` if a plain-object shape is required.

**Symptom:** Two different objects used as keys overwrite each other
**Cause:** Object keys are stringified, and every plain object becomes
`"[object Object]"`.
**Fix:** A `Map` — object keys compare by identity.

**Symptom:** Numeric keys come back re-sorted
**Cause:** Object enumeration puts integer-like keys first in ascending order,
regardless of insertion. MDN calls object order *"complex"* and advises not relying on
it.
**Fix:** A `Map`, which iterates *"in the order of entry insertion"*.

**Symptom:** Counting entries is slow in a hot path
**Cause:** `Object.keys(o).length` allocates an array of every key.
**Fix:** `map.size`, a property.

**Symptom:** `for...of` over an object throws "is not iterable"
**Cause:** MDN: objects *"do not implement an iteration protocol"*.
**Fix:** `Object.entries(o)`, or a `Map`, which is directly iterable.

**Symptom:** `NaN` cannot be used as a key
**Cause:** Only in an object, where it stringifies to `"NaN"`. A `Map` uses
**SameValueZero**, under which `NaN` equals `NaN`.
**Fix:** A `Map`.

## Interview questions

**★ What are the differences between a `Map` and a plain object?**
MDN lists six: **accidental keys** (an object inherits `Object.prototype`'s), **key
types** (a `Map` takes any value, an object only strings and symbols), **key order**
(`Map` is insertion order, object order is *"complex"*), **size** (a property vs
`Object.keys().length`), **iteration** (a `Map` is directly iterable, an object is not),
and **performance for frequent additions and removals**.

**★ Why can't you use an object as a key in a plain object?**
Because non-symbol keys are stringified, and every plain object stringifies to
`"[object Object]"` — so any two objects collide into one property. A `Map` compares
object keys by **identity**.

**★ What equality does `Map` use?**
**SameValueZero**: like `===` except that **`NaN` equals `NaN`**, and `0` equals `-0`.
That makes `NaN` a usable key, which it is not in an object. `Set` and
`Array.prototype.includes` use the same algorithm.

**★ Why does an object keyed by numeric ID iterate in the wrong order?**
Because integer-like keys enumerate **ascending, before** all string keys, regardless of
insertion. A `Map` iterates strictly in insertion order for every key type.

**Why does `map.set()` return the map?**
So calls chain — `m.set(a,1).set(b,2)` — and so it works as a `reduce` accumulator:
`items.reduce((m, i) => m.set(i.id, i), new Map())`.

**How do you convert between the two?**
`new Map(Object.entries(obj))` and `Object.fromEntries(map)`. The second is lossy if the
keys are not strings — object keys get stringified on the way in.

---

[Topic index](./README.md) · Next → [Choosing, and what `Map` costs](./02-choosing-and-costs.md)
