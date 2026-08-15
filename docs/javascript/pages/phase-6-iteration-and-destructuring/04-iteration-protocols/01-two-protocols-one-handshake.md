---
title: "04.1 · Two protocols, one handshake"
sidebar_label: "01 · Two protocols, one handshake"
sidebar_position: 1
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-15 against MDN — [Iteration protocols](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Iteration_protocols). Documentation-validated.

**`for...of` has no idea what an array is.** Neither does spread, nor array
destructuring, nor `Promise.all`, nor `new Map(...)`. Every one of them performs the same
two-step handshake against an interface, and anything implementing that interface works
everywhere they do. That is the whole reason a `Set`, a `NodeList`, a string and a
generator all behave identically in a `for...of` loop despite sharing no code.

There are **two** protocols, and conflating them is the single most common source of
confusion in this phase:

| | The **iterable** protocol | The **iterator** protocol |
|---|---|---|
| Answers | *"can you be iterated?"* | *"what is the next value?"* |
| Required member | `[Symbol.iterator]()` | `next()` |
| Returns | an **iterator** | an **`IteratorResult`** object |
| Held by | the collection | a cursor over the collection |
| Optional members | — | `return(value)`, `throw(exception)` |

## The iterable protocol — one method, and it is keyed by a symbol

MDN: *"The iterable protocol allows JavaScript objects to define or customize their
iteration behavior, such as what values are looped over in a `for...of` construct."*

To be iterable, an object needs exactly one thing — `[Symbol.iterator]()`, described as
*"a zero-argument function that returns an object, conforming to the iterator
protocol."*

```js
const range = {
  from: 1,
  to: 3,
  [Symbol.iterator]() {
    let n = this.from;
    const last = this.to;
    return {
      next: () => (n <= last ? { value: n++, done: false } : { value: undefined, done: true }),
    };
  },
};

[...range];              // [1, 2, 3]
for (const n of range) { /* 1, 2, 3 */ }
const [first] = range;   // 1
Math.max(...range);      // 3
```

Nothing was registered anywhere. **Adding one symbol-keyed method admitted this object
to every iterable-consuming syntax in the language at once.**

The key is a **well-known symbol**, not the string `"iterator"` — so it never collides
with a real property name, and it does not show up in `Object.keys`, `JSON.stringify` or
a `for...in` loop ([Phase 4 · 08](../../phase-4-objects-and-classes/08-keys-values-entries/README.md)).
`Symbol.iterator` is just a property key like any other; what makes it special is that
the language looks it up by that key.

**When is it called?** MDN: *"Whenever an object needs to be iterated (such as at the
beginning of a `for...of` loop), its `[Symbol.iterator]()` method is called with no
arguments, and the returned iterator is used to obtain the values to be iterated."*
Once, at the start — not per element.

## The iterator protocol — `next()` and the result object

MDN: *"The iterator protocol defines a standard way to produce a sequence of values
(either finite or infinite), and potentially a return value when all values have been
generated."*

`next()` is *"a function that accepts zero or one argument and returns an object
conforming to the `IteratorResult` interface"*, and that interface has two properties:

```js
{ done: false, value: 42 }        // still going, here is a value
{ done: true,  value: undefined } // finished
```

- **`done`** — `true` when the sequence is exhausted, `false` (or absent) otherwise.
- **`value`** — any value. When `done` is `true` it is the *return value* of the
  iteration, and `for...of` **discards it**. This is why a `return` inside a generator is
  invisible to a `for...of` loop and visible to a manual `next()` caller.

Both properties are optional in the spec sense — an empty `{}` reads as
`done: undefined` (falsy, so "not done") and `value: undefined`. **What is not optional
is returning an object at all:**

> "If a non-object value gets returned (such as `false` or `undefined`) when a built-in
> language feature (such as `for...of`) is using the iterator, a `TypeError`
> (`"iterator.next() returned a non-object value"`) will be thrown."

And once finished, stay finished — MDN: *"If an iterator returns a result with
`done: true`, any subsequent calls to `next()` are expected to return `done: true` as
well, although this is not enforced on the language level."* It is a convention the
language relies on but does not police, so **your** iterator must honour it.

## The two optional methods

`next()` is the only method the protocol demands. Two more are honoured if present:

- **`return(value)`** — *"tells the iterator that the caller does not intend to make any
  more `next()` calls and can perform any cleanup actions."* This is the hook that closes
  a file handle or aborts a request when a loop `break`s. It gets a chunk of its own in
  [Making your own object iterable](./02-making-your-own-object-iterable.md).
- **`throw(exception)`** — *"tells the iterator that the caller detects an error
  condition."* Almost nothing in the language calls it; generators expose it so a
  consumer can inject an error at the `yield`, which is the mechanism behind
  **09 · Two-way generators** *(not written yet)*.

## What is iterable already

MDN's list of built-in iterables: **`String`, `Array`, `TypedArray`, `Map`, `Set`**, and
**`Segments`** (from `Intl.Segmenter.prototype.segment()`) — *"the `arguments` object and
some DOM collection types such as `NodeList` are also iterables."*

Read the omissions, because they are the ones that bite:

| Value | Iterable? | Why |
|---|---|---|
| `Array`, `String`, `Map`, `Set`, `TypedArray` | ✅ | built-in |
| `arguments`, `NodeList`, `FileList` | ✅ | array-like **and** iterable |
| Generator objects | ✅ | and they are their own iterator |
| **Plain objects** `{ a: 1 }` | ❌ | **no `Symbol.iterator`** — use `Object.entries(obj)` |
| **`HTMLCollection`** | ❌ | array-like only — `Array.from` it, or use `querySelectorAll` |
| `Object.keys(obj)` etc. | ✅ | because they return **arrays** |

**"Plain objects are not iterable" is the answer to half the `TypeError`s in this area**,
including `[...obj]` from [03 · Spread with iterables](../03-spread-with-iterables/README.md)
and `for (const x of obj)` from [02 · Loop forms](../02-loop-forms/README.md).
`for...in` exists for objects; `for...of` does not serve them.

## What consumes iterables

Syntaxes: **`for...of`**, **array and parameter spreading**, **`yield*`**, and **array
destructuring**. APIs: `Map()`, `WeakMap()`, `Set()`, `WeakSet()`, `Promise.all()`,
`Promise.allSettled()`, `Promise.race()`, `Promise.any()`, `Array.from()`,
`Object.groupBy()` and `Map.groupBy()`.

Three consequences worth holding on to:

```js
new Map(range);                 // any iterable of [k, v] pairs — not just an array
await Promise.all(promiseSet);  // a Set of promises is fine; Promise.all takes an ITERABLE
const [a, b] = someGenerator;   // destructuring pulls exactly two values, then stops
```

**`Promise.all` taking an iterable rather than an array** is the detail people miss, and
it is what lets you feed it a `Set`, a `Map`'s `.values()`, or a generator that produces
requests lazily ([Phase 7 · 10 · Combinators](../../phase-7-async/10-combinators/README.md)).

**`Array.from` is the bridge in the other direction.** It accepts an iterable *or* an
array-like — the only built-in that takes both — which is why it converts an
`HTMLCollection` that spread cannot touch
([Phase 5 · 01](../../phase-5-built-in-library/01-array-creation-and-shape/01-making-arrays.md)).

## Getting it wrong — the three `TypeError`s, in order

The language checks well-formedness in a fixed order, and MDN gives the exact messages:

```js
const nonWellFormedIterable = { [Symbol.iterator]: 1 };
[...nonWellFormedIterable]; // TypeError: nonWellFormedIterable is not iterable

nonWellFormedIterable[Symbol.iterator] = () => 1;
[...nonWellFormedIterable]; // TypeError: [Symbol.iterator]() returned a non-object value

nonWellFormedIterable[Symbol.iterator] = () => ({});
[...nonWellFormedIterable]; // TypeError: nonWellFormedIterable[Symbol.iterator]().next is not a function
```

The three invariants being enforced: *"It has a callable `[Symbol.iterator]()` method"* ·
*"The `[Symbol.iterator]()` method returns an object"* · *"The object returned by
`[Symbol.iterator]()` has a callable `next()` method."*

**Read the message, not the line number.** Each of the three names a different half-built
implementation, and together they are a checklist: is the key there, does it return an
object, does that object have `next`.

## Do not modify a collection while iterating it

MDN's warning applies to essentially every built-in:

> "Almost all iterables have the same underlying semantic: they don't copy the data at
> the time when iteration starts. Rather, they keep a pointer and move it around.
> Therefore, if you add, delete, or modify elements in the collection while iterating
> over the collection, you may inadvertently change whether other *unchanged* elements in
> the collection are visited."

An iterator is a **cursor into live data**, not a snapshot. Deleting the current element
shifts everything after it back one position, and the cursor has already advanced — so
the next element is skipped. MDN's conclusion: *"Concurrent modifications, in general,
are very bug-prone and confusing. Unless you know precisely how the iterable is
implemented, it's best to avoid modifying the collection while iterating over it."*

**The fix is to iterate a copy or build a new collection**, which is the same advice that
makes `filter` preferable to deleting inside a loop:

```js
for (const item of [...items]) { /* safe to mutate `items` here */ }
const kept = items.filter(keep);   // better still — no mutation at all
```

## Gotchas

**Symptom:** `TypeError: obj is not iterable` on a plain object
**Cause:** Plain objects have no `Symbol.iterator`; the built-in iterables are `String`,
`Array`, `TypedArray`, `Map`, `Set` and `Segments`, plus `arguments` and `NodeList`.
**Fix:** `Object.entries(obj)` / `Object.values(obj)`, or give the object a
`[Symbol.iterator]()`.

**Symptom:** `TypeError: [Symbol.iterator]() returned a non-object value`
**Cause:** The method exists but returned a primitive instead of an iterator object.
**Fix:** Return `{ next() { … } }` — or make the method a `function*`.

**Symptom:** `TypeError: …[Symbol.iterator]().next is not a function`
**Cause:** An object was returned, but without a callable `next`.
**Fix:** Add `next()`, and check you did not return the *collection* by mistake instead of
a cursor over it.

**Symptom:** `TypeError: iterator.next() returned a non-object value`
**Cause:** `next()` returned `undefined`, `false` or a bare value rather than a result
object.
**Fix:** Always return `{ value, done }` — including on the terminating call.

**Symptom:** The loop never ends
**Cause:** `next()` never sets `done: true`, or returns `{}` — which reads as
`done: undefined`, and that is falsy.
**Fix:** Return an explicit `done: true`, and keep returning it afterwards.

**Symptom:** A `for...of` loop skipped elements while items were being removed
**Cause:** Iterators keep *"a pointer and move it around"* — they do not copy.
**Fix:** Iterate a copy (`[...items]`), or build a new collection with `filter`.

**Symptom:** A generator's `return` value never appeared in the `for...of` loop
**Cause:** The `value` accompanying `done: true` is the iteration's return value, and
`for...of` discards it.
**Fix:** Drive the iterator by hand and read the final result — **13 · Driving an iterator
by hand** *(not written yet)*.

## Interview questions

**★ What is the difference between an iterable and an iterator?**
An **iterable** has a `[Symbol.iterator]()` method that *returns* an iterator — it answers
"can you be iterated". An **iterator** has a `next()` method returning
`{ value, done }` — it answers "what comes next". The collection is usually the iterable;
the cursor is the iterator. An object can be both, and generator objects are.

**★ What exactly does `for...of` do to the object you give it?**
It calls `[Symbol.iterator]()` **once**, with no arguments, to obtain an iterator, then
calls `next()` repeatedly until a result comes back with `done: true`, using each
`value`. If the loop exits early it calls the iterator's `return()` when present.

**★ Why is `[...{a: 1}]` a `TypeError` when `{...[1, 2]}` is fine?**
Array spread requires the **iterable protocol** and a plain object has no
`Symbol.iterator`. Object spread is a different operation entirely — it copies own
enumerable properties and needs no protocol
([03 · Spread with iterables](../03-spread-with-iterables/README.md)).

**★ What does `next()` have to return?**
An **object** conforming to `IteratorResult` — `{ value, done }`. Returning a non-object
from a built-in-driven iteration throws `TypeError: iterator.next() returned a non-object
value`, and once `done: true` has been returned every later call is expected to return
`done: true` too.

**Which built-in APIs accept an iterable rather than an array?**
`Map`, `WeakMap`, `Set` and `WeakSet` constructors; `Promise.all`, `allSettled`, `race`
and `any`; `Array.from`; `Object.groupBy` and `Map.groupBy`. Syntactically: `for...of`,
spread, `yield*` and array destructuring.

**Why is `Symbol.iterator` a symbol instead of a string key?**
So it cannot collide with a real property name and does not appear in `Object.keys`,
`JSON.stringify` or `for...in`. The behaviour is opted into deliberately, never by
accident.

**Can you iterate a `NodeList`? An `HTMLCollection`?**
`NodeList` yes — MDN lists it as iterable, so `for...of` and spread both work.
`HTMLCollection` is only array-**like**: no `Symbol.iterator`, so use `Array.from`.

---

[Topic index](./README.md) · Next → [Making your own object iterable](./02-making-your-own-object-iterable.md)
