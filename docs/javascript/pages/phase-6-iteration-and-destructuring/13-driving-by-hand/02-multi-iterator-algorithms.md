---
title: "13.2 · Multi-iterator algorithms"
sidebar_label: "02 · Multi-iterator algorithms"
sidebar_position: 2
---

<span className="db-tier t-when">When Needed</span>

> Verified: 2026-08-15 against MDN — [Iteration protocols](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Iteration_protocols), [`Iterator`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Iterator) and [`Generator.prototype.return()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Generator/return). Documentation-validated.

`for...of` drives one iterator. **Every algorithm that advances two or more sources
independently has to call `next()` by hand** — and the four below are the ones that come up.
All of them are generators on the outside (so consumers still get `for...of`) and manual
drivers on the inside.

## `zip` — advance together, stop at the shortest

```js
function* zip(...iterables) {
  const its = iterables.map((x) => x[Symbol.iterator]());
  try {
    while (true) {
      const results = its.map((it) => it.next());
      if (results.some((r) => r.done)) return;      // shortest wins
      yield results.map((r) => r.value);
    }
  } finally {
    for (const it of its) it.return?.();            // close every source
  }
}

[...zip([1, 2, 3], "abc")];    // [[1,"a"], [2,"b"], [3,"c"]]
```

Two decisions are visible here and both need making explicitly: **stop at the shortest**
(the usual choice) versus padding to the longest, and **closing every source in `finally`**,
including the ones that were not exhausted. Miss the second and a `break` from the consumer
leaks the sources that still had values.

## `merge` — two sorted streams into one

The algorithm that needs lookahead and independent advancement, and the reason `Peekable`
from [13.1](./01-when-for-of-is-not-enough.md) exists:

```js
function* merge(a, b, compare = (x, y) => x - y) {
  const ia = a[Symbol.iterator](), ib = b[Symbol.iterator]();
  let ra = ia.next(), rb = ib.next();
  try {
    while (!ra.done && !rb.done) {
      if (compare(ra.value, rb.value) <= 0) { yield ra.value; ra = ia.next(); }
      else { yield rb.value; rb = ib.next(); }
    }
    while (!ra.done) { yield ra.value; ra = ia.next(); }   // drain the remainder
    while (!rb.done) { yield rb.value; rb = ib.next(); }
  } finally {
    ia.return?.(); ib.return?.();
  }
}
```

**One value of lookahead per stream is the whole trick** — `ra` and `rb` hold the pending
head of each source, and only the side that was consumed advances. It works on sorted arrays,
sorted database cursors and sorted paginated APIs alike, and it is stable when the comparison
uses `<=`.

## `interleave` and round-robin

```js
function* interleave(...iterables) {
  const its = iterables.map((x) => x[Symbol.iterator]());
  try {
    while (its.length) {
      for (let i = 0; i < its.length; ) {
        const r = its[i].next();
        if (r.done) its.splice(i, 1);          // drop exhausted sources, do not advance i
        else { yield r.value; i++; }
      }
    }
  } finally {
    for (const it of its) it.return?.();
  }
}
```

Round-robin over sources of different lengths, dropping each as it finishes. The
`i` handling is the fiddly part — `splice` shifts everything down, so incrementing after a
removal skips a source.

## `groupBy` on a sorted stream

Grouping without buffering the whole input, which is what makes it usable on a stream:

```js
function* runsOf(iterable, keyOf) {
  const it = iterable[Symbol.iterator]();
  let r = it.next();
  try {
    while (!r.done) {
      const key = keyOf(r.value);
      const run = [r.value];
      while (!(r = it.next()).done && keyOf(r.value) === key) run.push(r.value);
      yield [key, run];                         // one group at a time
    }
  } finally {
    it.return?.();
  }
}
```

**Only one group is in memory at a time** — the reason this beats `Object.groupBy` for a
large sorted source. It requires the input to be sorted by the key; on unsorted input it
produces repeated groups, which is a correctness bug rather than an inefficiency.

## The four rules these share

1. **Get each iterator once**, with `x[Symbol.iterator]()`, and keep it. Calling
   `[Symbol.iterator]()` again on a collection gives you a *new* cursor and restarts it.
2. **Hold the pending result, not the value.** `{ value, done }` — a bare value cannot
   express "exhausted".
3. **Advance only the source you consumed.** Advancing both in a merge is the classic
   dropped-element bug.
4. **Close every source in `finally`** with `it.return?.()`. The consumer may `break` out of
   your generator at any point, and its `return()` unwinds through your `finally`
   ([04.2](../04-iteration-protocols/02-making-your-own-object-iterable.md)).

## Do not write these if you do not have to

- **`chunks` and `windows` are built in** ([11 · Iterator helpers](../11-iterator-helpers/README.md)) —
  do not hand-roll them.
- **Arrays that fit in memory** do not need any of this. `a.concat(b).sort()` is clearer than
  a merge, and `Object.groupBy` is clearer than `runsOf`, unless the input is large or
  streaming.
- **Async sources need the async protocol.** Each `next()` returns a promise, so every line
  above gains an `await`, and "stop at the shortest" becomes a decision about pending
  requests too.

## Gotchas

**Symptom:** `zip` dropped the first element of one input
**Cause:** Both iterators were advanced when only one value was consumed.
**Fix:** Hold the pending result per source and advance only the side that was yielded.

**Symptom:** Sources kept their handles open after the consumer stopped
**Cause:** No `finally` closing them — the consumer's `break` closes *your* generator, not
the ones you opened.
**Fix:** `finally { for (const it of its) it.return?.(); }`.

**Symptom:** A merge restarted one input from the beginning
**Cause:** `[Symbol.iterator]()` called inside the loop instead of once up front.
**Fix:** Take each iterator once and reuse it.

**Symptom:** `runsOf` produced the same key several times
**Cause:** The input is not sorted by that key.
**Fix:** Sort first, or use `Object.groupBy`/a `Map` and accept buffering.

**Symptom:** `interleave` skipped a source
**Cause:** Incrementing the index after `splice` removed an element.
**Fix:** Increment only in the non-removal branch, as above.

**Symptom:** The same helper written for promises behaved oddly
**Cause:** Async iterators return promises from `next()`.
**Fix:** `await` each `next()` and write it as an `async function*`.

## Interview questions

**★ Why can't you write `zip` with `for...of`?**
`for...of` drives exactly one iterator and controls its own advancement. Zipping requires
calling `next()` on each source independently and comparing the results, which means driving
them by hand.

**★ How do you merge two sorted streams without loading them?**
Keep one pending result per stream, yield the smaller, advance only that stream, then drain
whichever remains. One value of lookahead per source is enough, and it never holds more than
that.

**★ What is the cleanup obligation when you open several iterators?**
You must close all of them, including ones that still have values, in a `finally`. Consumers
can `break` out of your generator at any point; `return()` unwinds through your `finally`,
which is where `it.return?.()` belongs.

**★ Why hold `{ value, done }` rather than the value?**
Because a bare value cannot represent "this source is exhausted" — `undefined` is a legal
value. The result object carries both, which is what the merge condition tests.

**When should you not hand-roll these?**
When the data fits in memory (`concat`+`sort`, `Object.groupBy` are clearer), and when a
built-in exists — `chunks` and `windows` are already on `Iterator.prototype`.

---

← Prev [When `for...of` is not enough](./01-when-for-of-is-not-enough.md) · [Topic index](./README.md)
