---
title: "03.1 · The decision table"
sidebar_label: "01 · The decision table"
sidebar_position: 1
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-14 against MDN — [`Map`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Map), [`Set`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Set), [`Array`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array), [`WeakMap`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/WeakMap), [`Array.prototype.shift()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/shift). Documentation-validated; **no timings**.

**Choose the structure from the operations, not from the data.** "It is a list of users" tells you
nothing. "I look them up by id, thousands of times, and never care about order" tells you
everything — and the answer is a `Map`.

## Start with the question, not the shape

Write down what you actually do with the collection, and how often:

| What you do | What you need |
|---|---|
| look up by a key | **`Map`** (or an object for string keys) |
| ask "is this in the set?" | **`Set`** |
| access by position, iterate in order | **`Array`** |
| add/remove at the **end** | **`Array`** — `push`/`pop` |
| add/remove at the **front** | **not a plain array** — `shift`/`unshift` are O(n) |
| keep things sorted with frequent inserts | a sorted array is O(n) per insert — reconsider |
| always need the smallest/largest | a heap (**Phase 14**, *not written yet*) |
| associate data with an object without owning its lifetime | **`WeakMap`** |

🔴 **The single most common mistake in application JavaScript is using an array for lookups.**
`users.find(u => u.id === id)` inside a loop is the accidental quadratic from
[01 · 02 · Reading a bound](../01-big-o/02-reading-a-bound.md), and the fix is one line before the
loop: `const byId = new Map(users.map(u => [u.id, u]))`.

## The table

| Operation | `Array` | `Object` | `Map` | `Set` |
|---|---|---|---|---|
| Lookup by key | O(n) scan | sublinear | **sublinear** | — |
| Membership test | O(n) `includes` | `in` / `hasOwn`, sublinear | `has`, sublinear | **`has`, sublinear** |
| Access by index | **O(1)** | — | — | — |
| Insert at end | **amortised O(1)** | O(1) | O(1) | O(1) |
| Insert at front | O(n) | — | O(1) (order = insertion) | O(1) |
| Delete by key | — | O(1) `delete` | **O(1) `delete`** | **O(1) `delete`** |
| Delete at index | O(n) `splice` | — | — | — |
| Ordered iteration | **insertion order** | insertion order *with caveats* | **insertion order** | **insertion order** |
| Size | `length`, O(1) | `Object.keys().length`, **O(n)** | **`size`, O(1)** | **`size`, O(1)** |
| Any key type | — | strings and symbols only | **any value** | **any value** |

"Sublinear" rather than O(1) because that is what the specification actually requires — MDN:

> "The specification requires maps to be implemented 'that, on average, provide access times that
> are **sublinear on the number of elements** in the collection'."

**Read down the column you need, not across the row you have.** The frequent operation decides;
the rare one can be linear. A collection built once and iterated forever is happy as an array even
if lookups are occasionally linear.

## `Map` over `Object`, by default

MDN's comparison gives four reasons, and they are all correctness reasons before they are
performance ones:

- **Key types** — "A `Map`'s keys can be any value (including functions, objects, or any
  primitive)", while "The keys of an `Object` must be either a `String` or a `Symbol`."
  🔴 So `obj[1]` and `obj["1"]` are the **same** property, and `obj[someObject]` becomes the key
  `"[object Object]"` — silently collapsing every object key into one.
- **Accidental keys** — "A `Map` does not contain any keys by default. It only contains what is
  explicitly put into it", whereas "An `Object` has a prototype, so it contains default keys that
  could collide with your own keys if you're not careful." A lookup table keyed by user input and
  asked for `"constructor"` or `"__proto__"` returns something.
- **Size** — "The number of items in a `Map` is easily retrieved from its `size` property";
  for an object it is "more roundabout and less efficient" — `Object.keys(obj).length` builds an
  array, O(n).
- **Iteration** — a `Map` "iterates entries, keys, and values in the order of entry insertion" and
  is directly iterable; an `Object` "does not implement an iteration protocol".

And the performance line MDN states directly: `Map` "performs better in scenarios involving
frequent additions and removals of key-value pairs", while `Object` is "not optimized" for that.

The full comparison is [Phase 5 · 10 · `Map` vs `Object`](../../phase-5-built-in-library/10-map-vs-object/README.md);
here the rule is short: **a collection keyed at runtime is a `Map`. A record with known fields is
an object.**

## `Set` for membership, always

```js
// ❌ O(n) per check
if (allowedRoles.includes(role)) …

// ✅ built once, sublinear per check
const ALLOWED = new Set(["admin", "editor"]);
if (ALLOWED.has(role)) …
```

⚠️ **For a three-element list built once at module scope, `includes` is fine** and arguably
clearer. The rule is about *repeated* checks, or a set whose size is data-driven. Converting a
constant two-element array to a `Set` is noise.

`Set` uses **SameValueZero** for equality — MDN: *"Value equality is based on the SameValueZero
algorithm"* — which means `NaN` equals `NaN` (unlike `===`), `+0` and `-0` are the same, and
**objects are compared by reference**. So a `Set` of objects deduplicates identity, not content;
deduplicating by value needs a key: `new Map(items.map(i => [i.id, i]))`.

## `WeakMap`, and the one thing it is for

Associating data with an object **without keeping that object alive**. The keys are held weakly,
so an entry disappears when its key is otherwise unreachable.

```js
const metadata = new WeakMap();
metadata.set(domNode, { renderedAt: Date.now() });   // does not prevent collection
```

🔴 **A plain `Map` keyed by DOM nodes is a leak** — the map holds the node forever, even after it
is removed from the document, which is exactly the *detached DOM node* the Memory panel reports
([Phase 12 · 01 · 02 · The panels](../../phase-12-browser-platform/01-devtools/02-the-panels.md),
[Phase 8 · 04 · Leaks](../../phase-8-modules-errors/04-leaks/README.md)).

The trade: a `WeakMap` is **not iterable and has no `size`** — the collection cannot be enumerated
because that would expose garbage-collection timing. If you need to iterate, you need a `Map`, and
you need to remove entries yourself.

## Gotchas

**Symptom:** A lookup-heavy function is quadratic
**Cause:** An array searched with `find`/`includes` inside a loop.
**Fix:** Build a `Map`/`Set` before the loop.

**Symptom:** Numeric and string keys collide in an object
**Cause:** Object keys are strings — `obj[1]` and `obj["1"]` are one property.
**Fix:** `Map`, whose keys "can be any value".

**Symptom:** Every object used as an object key overwrites the last
**Cause:** It is coerced to `"[object Object]"`.
**Fix:** `Map`.

**Symptom:** A lookup table returns something for `"constructor"`
**Cause:** Objects inherit prototype keys — MDN: *"contains default keys that could collide."*
**Fix:** `Map`, or `Object.create(null)`.

**Symptom:** Counting entries is slow
**Cause:** `Object.keys(obj).length` allocates an array — O(n).
**Fix:** `map.size`, O(1).

**Symptom:** A queue slows down as it drains
**Cause:** `shift()` is O(n).
**Fix:** Two indices into an array, or a deque.

**Symptom:** A `Set` of objects does not deduplicate identical-looking items
**Cause:** SameValueZero compares objects by reference.
**Fix:** Key by an id — `new Map(items.map(i => [i.id, i]))`.

**Symptom:** Removed DOM nodes are never collected
**Cause:** A `Map` keyed by nodes holds them forever.
**Fix:** `WeakMap` — at the cost of iteration and `size`.

**Symptom:** A `WeakMap` cannot be iterated
**Cause:** By design — enumeration would expose GC timing.
**Fix:** Use a `Map` and manage removal yourself, if enumeration is genuinely required.

## Interview questions

**★ How do you choose a data structure?**
From the **operations and their frequency**, not the data. Lookup by key → `Map`; membership →
`Set`; positional access and ordered iteration → `Array`; add/remove at the front → not a plain
array. The frequent operation decides; a rare one is allowed to be linear.

**★ Why prefer `Map` over a plain object for a runtime-keyed collection?**
Keys of any type (object keys coerce to strings, so `obj[1]` and `obj["1"]` collide and every
object key becomes `"[object Object]"`); no inherited keys to collide with; O(1) `size` instead of
`Object.keys().length`; direct iteration in insertion order; and MDN states `Map` *"performs
better in scenarios involving frequent additions and removals"*.

**★ Is `Set.has` guaranteed O(1)?**
Sublinear is what the specification requires — hash table in practice. The point stands: it beats
`Array.includes`, which is a linear scan.

**★ When is `arr.includes` still the right call?**
Small, fixed lists checked infrequently. Converting a two-element constant to a `Set` adds noise
without changing anything. The rule is about repeated checks or data-driven size.

**★ A `Set` of objects is not deduplicating. Why?**
SameValueZero compares objects by **reference** — two structurally identical objects are distinct
members. Deduplicate on a key with a `Map`.

**★ When do you reach for `WeakMap`?**
When associating data with an object you do not own the lifetime of — DOM nodes especially. A
plain `Map` keyed by nodes keeps them alive and produces exactly the detached-node leak the memory
profiler reports. The cost is that a `WeakMap` is not iterable and has no `size`.

**Why can't a `WeakMap` be iterated?**
Enumeration would make garbage-collection timing observable. That is a deliberate design
constraint, not an omission.

---

[Topic index](./README.md) · Next → [02 · When the array is right](./02-when-the-array-is-right.md)
