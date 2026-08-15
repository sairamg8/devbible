---
title: "11.1 · The helper set, and how laziness works"
sidebar_label: "01 · The helper set, and how laziness works"
sidebar_position: 1
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-08-15 against MDN — [`Iterator`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Iterator), [`Iterator.prototype.map()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Iterator/map) and [`Iterator.prototype.take()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Iterator/take). Documentation-validated.

**Iterator helpers are the array methods, made lazy.** MDN states the whole case in one
sentence:

> "The main advantage of iterator helpers over array methods is that they are **lazy**,
> meaning that they only produce the next value when requested. This avoids unnecessary
> computation and also allows them to be used with infinite iterators."

```js
function* fibonacci() {
  let current = 1, next = 1;
  while (true) { yield current; [current, next] = [next, current + next]; }
}

for (const n of fibonacci().take(5)) console.log(n);   // 1, 1, 2, 3, 5
```

`fibonacci()` never ends and `take(5)` never asks for a sixth value. There is no array form
of that at all — which is the point made at length in
[05.2 · Lazy sequences](../05-generators/02-lazy-sequences.md), now available without
hand-writing the pipeline stages.

## The set

Everything on `Iterator.prototype`, split by whether it returns another iterator (lazy,
chainable) or a value (terminal, runs the pipeline):

| Intermediate — returns an **iterator helper** | Terminal — returns a **value** |
|---|---|
| `map(fn)` | `toArray()` |
| `filter(fn)` | `reduce(fn, init?)` |
| `take(n)` | `forEach(fn)` |
| `drop(n)` | `some(fn)` · `every(fn)` · `find(fn)` |
| `flatMap(fn)` | `includes(v)` · `join(sep?)` |
| `chunks(n)` · `windows(n)` | |

Plus two protocol members: `[Symbol.iterator]()`, which returns the iterator itself, and
`[Symbol.dispose]()`, which *"calls the `return()` method"* — so a helper participates in
the disposable protocol and closes its source.

**The mental split is the useful part.** Intermediate methods build a pipeline and compute
nothing; a terminal method is what pulls values through it. A chain with no terminal call
and no `for...of` has done no work at all.

## How the laziness actually works

MDN describes `map`'s helper precisely: *"Each time the iterator helper's `next()` method is
called, it gets the next element from the underlying iterator, applies `callbackFn`, and
yields the return value. When the underlying iterator is completed, the iterator helper is
also completed."*

So a chain is a **stack of cursors**, not a series of collections:

```js
const seq = fibonacci().map((x) => x ** 2);
seq.next().value;   // 1
seq.next().value;   // 1
seq.next().value;   // 4
```

One `next()` at the top pulls exactly one value through every stage. Nothing is buffered,
and no intermediate array exists — the difference from
`array.map(...).filter(...)` that [08.2 · The cost of chaining](../08-early-exit/02-the-cost-of-chaining.md)
is about.

## `take` and `drop`

`take(n)` *"returns a new iterator helper object that yields the given number of elements in
this iterator and then terminates"* — completing *"once `limit` elements have been yielded,
or when the original iterator is exhausted, whichever comes first."* So it is safe on a
short source; you get what there was.

⚠️ **`take` validates its argument and throws.** MDN: `RangeError` *"if `limit` becomes `NaN`
or negative when converted to an integer"*:

```js
fibonacci().take(-1);         // RangeError: -1 must be positive
fibonacci().take(undefined);  // RangeError: undefined must be positive
```

That last one is the trap in real code — `take(limit)` where `limit` is an unset option
throws rather than defaulting to something. Default the value at the call site.

`drop(n)` skips the first `n` and yields the rest, and it is lazy in the same way: the
skipped values are still pulled from the source (and discarded), because there is no way to
skip without asking.

## `chunks` and `windows`

The two that have no array equivalent, and are the reason to check this list before writing
a generator:

```js
lines.values().chunks(500);    // consecutive groups of 500 — batching
prices.values().windows(3);    // a sliding window of 3 — moving averages, diffs
```

`chunks` is exactly the batcher hand-written in
[10.2 · Composing generators](./../10-yield-delegation/02-composing-generators.md); prefer
the built-in.

## Terminal methods and short-circuiting

`some`, `every`, `find` and `includes` stop as soon as the answer is known — the same
short-circuit as their array counterparts ([08.1](../08-early-exit/01-what-can-stop.md)),
except that here **the source is never pulled further**:

```js
hugeSource().map(expensive).find((x) => x.ok);   // stops at the first match
```

`reduce`, `forEach`, `join` and `toArray` are exhaustive by nature. **Never call one on an
infinite iterator** — `fibonacci().toArray()` does not return.

## Gotchas

**Symptom:** `RangeError: undefined must be positive` from `take`
**Cause:** MDN's documented validation — `NaN` or negative after integer conversion.
**Fix:** Default the limit before passing it: `take(limit ?? 10)`.

**Symptom:** The chain produced nothing and no callback ran
**Cause:** Intermediate methods are lazy; nothing pulls without a terminal call or a loop.
**Fix:** End with `toArray()`, `find()`, `forEach()` — or iterate it.

**Symptom:** `toArray()` on an infinite iterator hung
**Cause:** Terminal methods that must see every value cannot terminate.
**Fix:** `take(n)` first.

**Symptom:** `drop(1_000_000)` was slow
**Cause:** Dropped values are still produced by the source and then discarded.
**Fix:** Skip at the source if it supports it — an offset, a cursor, a `WHERE` clause.

**Symptom:** `.map()` on a hand-written iterator threw `TypeError`
**Cause:** The helpers live on `Iterator.prototype`, which an object literal does not
inherit from.
**Fix:** `Iterator.from(it)` — covered in [11.2](./02-using-them-well.md).

**Symptom:** `chunks()` was reimplemented as a generator
**Cause:** It is not on `Array.prototype`, so it looks like it does not exist.
**Fix:** `chunks(n)` and `windows(n)` are both on `Iterator.prototype`.

## Interview questions

**★ What is the advantage of iterator helpers over array methods?**
MDN: they are *"lazy, meaning that they only produce the next value when requested. This
avoids unnecessary computation and also allows them to be used with infinite iterators."* No
intermediate arrays, work proportional to what is consumed, and infinite sources become
usable.

**★ Which helpers are lazy and which force evaluation?**
Lazy: `map`, `filter`, `take`, `drop`, `flatMap`, `chunks`, `windows`. Terminal:
`toArray`, `reduce`, `forEach`, `some`, `every`, `find`, `includes`, `join`. A chain with no
terminal call performs no work.

**★ What does `take(5)` do on an infinite generator?**
Yields five values and completes; the source is asked for exactly five. It also completes
early if the source runs out first, and it throws `RangeError` for a negative or `NaN`
limit.

**★ How does one `next()` on the end of a chain behave?**
It pulls a single value through every stage: the last helper asks the one before it, down to
the source, applying each callback to that value only. Nothing is buffered.

**Which helpers have no `Array.prototype` counterpart?**
`take`, `drop`, `chunks`, `windows` and `toArray` — `chunks` and `windows` in particular are
the batching and sliding-window operations people usually hand-write.

---

[Topic index](./README.md) · Next → [Using them well](./02-using-them-well.md)
