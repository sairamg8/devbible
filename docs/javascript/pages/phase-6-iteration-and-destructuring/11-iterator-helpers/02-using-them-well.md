---
title: "11.2 · Using them well"
sidebar_label: "02 · Using them well"
sidebar_position: 2
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-08-15 against MDN — [`Iterator`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Iterator), [`Iterator.from()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Iterator/from) and [`Iterator.prototype.map()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Iterator/map). Documentation-validated.

The helpers only exist on values that inherit from `Iterator.prototype`. Knowing which
values those are — and how to promote one that is not — is most of what separates "the
helpers do not work" from a working pipeline.

## Where the helpers come from

MDN: *"All built-in iterators inherit from the `Iterator` class"*, whose prototype
*"provides a `[Symbol.iterator]()` method that returns the iterator object itself."*

```js
[1, 2, 3].values()            // ✅ array iterator
new Set([1]).values()          // ✅
new Map().entries()            // ✅
"abc"[Symbol.iterator]()       // ✅
document.querySelectorAll("li").values()   // ✅ NodeList iterator
generatorFn()                  // ✅ generator objects
{ next() {} }                  // ⛔ a plain object — no helpers
[1, 2, 3]                      // ⛔ an ARRAY is not an iterator
```

**The last one is the daily surprise.** An array is *iterable*, not an *iterator*, so
`arr.take(3)` does not exist. Call `.values()` first:

```js
users.values().filter((u) => u.active).map((u) => u.name).take(10).toArray();
```

For a hand-written iterator, `Iterator.from()` promotes it. MDN calls the target a **proper
iterator** — *"one that both conforms to the iterator protocol and inherits from `Iterator`,
and most code expects iterators to be proper iterators"*:

```js
const proper = Iterator.from({ next() { /* … */ } });
proper.take(3).toArray();
```

`Iterator.from` accepts an iterator *or* an iterable, so it also promotes anything with a
`Symbol.iterator`. And `Iterator` itself is not constructible: it *"throws an error when
constructed by itself"* and is *"intended to be extended by other classes that create
iterators"* — so `class MyIterator extends Iterator` is the way to give your own class the
helpers.

## Helpers versus array methods — choosing

| | Array methods | Iterator helpers |
|---|---|---|
| Evaluation | eager, whole array per stage | lazy, one value at a time |
| Intermediate allocations | one array per stage | none |
| Infinite sources | impossible | fine, with `take` |
| Re-iterable | yes — an array is a collection | **no** — one-shot |
| `length`, indexing, `sort` | yes | no |
| Familiarity | universal | newer |

**Default to array methods for arrays you already hold.** Switch when a stage is expensive,
the source is large or unbounded, or you want a bounded prefix — the same judgement as
[08.2 · The cost of chaining](../08-early-exit/02-the-cost-of-chaining.md), now with a
built-in tool instead of hand-written generators.

⚠️ **The one-shot property is the real behavioural difference**, and it is easy to forget
because the chain *looks* like array code:

```js
const active = users.values().filter((u) => u.active);
active.toArray();     // ["ada", "grace"]
active.toArray();     // []  — the source iterator is exhausted
```

If two consumers need it, materialise once with `toArray()` and share the array, or build
the chain from a factory.

## They pair with generators, not compete

A generator supplies values the helpers do not know how to produce; the helpers supply
stages you would otherwise hand-write:

```js
async function* pages(url) { /* … */ }        // custom source
function* naturals() { /* … */ }

naturals().filter(isPrime).take(100).toArray();   // custom source, built-in stages
```

Write a generator when the *source* or the *stage* has no built-in form — paging, tree
traversal, a stateful transform. Use the helpers for everything they already cover. The
worked pipeline in [10.2](../10-yield-delegation/02-composing-generators.md) is a good
example of the split: `chunk` was hand-written there, and `chunks()` now makes that
unnecessary.

## What they do not do

- **No async versions to rely on.** `for await...of` and async generators do not get
  `.map()`/`.take()` today; async iterator helpers are not something to build on yet. Bound
  an async sequence with a counter and `break`
  ([07.2](../07-paginating-an-api/02-making-it-production-worthy.md)).
- **No `sort`, no `reverse`, no `length`.** All three need every value, which defeats
  laziness. `toArray()` first, then sort.
- **No random access.** There is no `at(i)`; `drop(i).take(1)` reads everything up to `i`.
- **No re-use.** Covered above — one-shot.

## Closing the source

An iterator helper holds the underlying iterator, and closing the helper closes what it
wraps: `Iterator.prototype[Symbol.dispose]()` *"calls the `return()` method"*. So the
cleanup chain from [04.2](../04-iteration-protocols/02-making-your-own-object-iterable.md)
still works through a pipeline:

```js
for (const line of readLines(file).filter(isError).take(10)) {
  report(line);
}
// break/completion propagates return() down to readLines — the handle closes
```

**That is why `take` is safe over a resource-backed source**: stopping early is a normal
close, not an abandonment.

## Gotchas

**Symptom:** `arr.map(...).take(3)` — `take is not a function`
**Cause:** `Array.prototype.map` returns an **array**, not an iterator.
**Fix:** `arr.values().map(...).take(3)`, so the whole chain is iterator helpers.

**Symptom:** `arr.take(3)` — not a function
**Cause:** An array is iterable but is not itself an iterator.
**Fix:** `arr.values()` (or `Iterator.from(arr)`).

**Symptom:** The chain worked once and returned nothing the second time
**Cause:** Iterator helpers and their sources are one-shot.
**Fix:** `toArray()` once and share the array, or rebuild the chain from a factory.

**Symptom:** `new Iterator()` threw
**Cause:** It *"throws an error when constructed by itself"*.
**Fix:** `Iterator.from(...)`, or `class X extends Iterator`.

**Symptom:** `.map()` on an async generator threw
**Cause:** The helpers are synchronous; async iterators do not have them today.
**Fix:** Transform inside the async generator, or count and `break`.

**Symptom:** Reaching for helpers made simple array code harder to read
**Cause:** Laziness has a cost in familiarity, and small arrays do not need it.
**Fix:** Keep array methods unless the source is large, unbounded or expensive.

## Interview questions

**★ Why doesn't `[1,2,3].take(2)` work?**
An array is **iterable** but not an **iterator** — the helpers live on `Iterator.prototype`.
Use `[1,2,3].values()`, or `Iterator.from([1,2,3])`.

**★ How do you give a hand-written iterator the helper methods?**
`Iterator.from(it)`, which wraps it into what MDN calls a *proper iterator* — one that both
conforms to the protocol and inherits from `Iterator`. Or extend `Iterator` in a class;
`Iterator` cannot be constructed directly.

**★ What is the biggest behavioural difference from array methods?**
They are one-shot and lazy. Nothing runs until a terminal method pulls, and once pulled the
source is exhausted — an array can be iterated any number of times.

**★ When should you *not* use iterator helpers?**
On arrays you already hold and iterate once, where array methods are clearer; when you need
`sort`, `length` or indexing; when the source must be consumed twice; and for async
sequences, which do not have these helpers.

**Do iterator helpers clean up the underlying source?**
Yes — a helper's `[Symbol.dispose]()` calls `return()`, and closing a pipeline propagates
that down to the source, so a generator's `finally` runs and resources are released.

**How do generators and helpers divide the work?**
Generators produce values that have no built-in source — pages, traversals, stateful
sequences. Helpers provide the standard stages over them. Hand-write a stage only when there
is no built-in for it.

---

← Prev [The helper set](./01-the-helper-set.md) · [Topic index](./README.md)
