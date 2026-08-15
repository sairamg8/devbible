---
title: "08.2 · The cost of chaining"
sidebar_label: "02 · The cost of chaining"
sidebar_position: 2
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-15 against MDN — [`find`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/find), [`some`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/some), [`filter`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/filter), [`toReversed`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/toReversed) and [`Iterator`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Iterator). Documentation-validated.

A chained pipeline is eager at every link. `filter` builds a whole array, hands it to
`map`, which builds another, which `slice` then throws most of away. **Each stage visits
every element the previous stage produced, and each stage allocates.** For a hundred rows
that is irrelevant. For a hundred thousand, or a stage that hits an expensive function, it
is the difference between one pass and four.

The fix is rarely "optimise the chain". It is **ask for what you actually want**, and the
built-in method for it usually short-circuits.

## The four substitutions worth knowing by heart

```js
list.filter(fn)[0]            →  list.find(fn)
list.filter(fn).length > 0    →  list.some(fn)
list.filter(fn).length === 0  →  !list.some(fn)
list.indexOf(x) !== -1        →  list.includes(x)
```

Every left-hand side visits **every** element and allocates an array; every right-hand side
stops at the first hit and allocates nothing. They also read as the question being asked —
`some` says "is there one", `filter(...).length > 0` makes the reader reconstruct that.

Two more in the same family:

```js
[...list].reverse().find(fn)  →  list.findLast(fn)
list.slice(-1)[0]             →  list.at(-1)
```

⚠️ **`reverse()` mutates.** Writing `list.reverse().find(fn)` reorders the caller's array
as a side effect of a *read* — one of the nastiest bugs in this family, because everything
still "works" until something else depends on the order. `findLast` avoids it entirely;
`toReversed()` is the non-mutating copy when you genuinely need a reversed array
([Phase 5 · 13 · Non-mutating counterparts](../../phase-5-built-in-library/13-non-mutating-counterparts.md)).

## What a chain actually costs

```js
const names = users
  .filter((u) => u.active)     // pass 1 — allocates
  .map((u) => u.name)          // pass 2 — allocates
  .slice(0, 10);               // pass 3 — allocates, discards the rest
```

Three passes and three arrays to produce ten strings. The complexity is still linear —
this is not a `O(n²)` trap — but the constant factor is real and, more importantly, **the
work is proportional to the input rather than to the output.** The `slice(0, 10)` at the
end is the tell: the pipeline computed every name and kept ten.

The one-pass version:

```js
const names = [];
for (const u of users) {
  if (!u.active) continue;
  names.push(u.name);
  if (names.length === 10) break;   // stops reading users entirely
}
```

**Longer, and correct for a different reason** — it stops when the answer is complete
rather than when the input is exhausted. Reach for it when the array is large, when the
callbacks are expensive, or when you only want a bounded prefix. For a small array, the
chain is clearer and clarity wins.

## Lazy chaining — the actual fix

Iterator helpers give you the readability of a chain with the stopping behaviour of a loop,
because each stage pulls one value at a time
([05.2 · Lazy sequences](../05-generators/02-lazy-sequences.md)):

```js
const names = users.values()          // an array iterator
  .filter((u) => u.active)
  .map((u) => u.name)
  .take(10)
  .toArray();                         // ONE pass, ten names, no intermediate arrays
```

`take(10)` bounds the whole pipeline: nothing upstream is asked for an eleventh value.
The `.toArray()` at the end is the only allocation. **This is the shape to prefer when a
pipeline is genuinely long or the source is genuinely large** — and it is the same code
over a generator, a `Set`, or anything else iterable. Depth on the helpers is
**11 · Iterator helpers** *(not written yet)*.

## Where the array methods still win

Do not read any of this as "loops are better".

- **Small arrays.** Nothing in a UI list of 50 rows justifies losing the chain's clarity.
- **`map`/`filter`/`reduce` express intent.** A `for` loop with a `push` says "I built an
  array"; `map` says "one output per input". That is worth real money in review.
- **When you need every element anyway.** No short-circuit is available, so there is
  nothing to gain — `sort`, a sum, a group-by.
- **Immutability.** The chain naturally produces new arrays, which is usually what a React
  render or a reducer wants.

**The rule: pick the method that answers the question.** `find` when you want one, `some`
when you want a boolean, `filter` when you genuinely want all the matches. Performance is a
by-product of asking correctly, not a separate concern to optimise afterwards.

## `reduce` is not the escape hatch

Fusing a `filter` and a `map` into one `reduce` avoids the intermediate array — and costs
more in readability than the array cost:

```js
const names = users.reduce((acc, u) => (u.active ? [...acc, u.name] : acc), []);   // ⛔ quadratic
const names = users.reduce((acc, u) => { if (u.active) acc.push(u.name); return acc; }, []);
```

The first line allocates a new array **per element** — the quadratic pattern from
[Phase 5 · 05 · When not to use reduce](../../phase-5-built-in-library/05-reduce/02-when-not-to-use-it.md).
The second is fine and is also just a `for...of` loop with more ceremony. **If the reason
for `reduce` is performance, write the loop; if it is expressiveness, `filter().map()` was
already more expressive.**

## Measuring, not guessing

Nothing on this page carries a timing, and that is deliberate — this repository does not
publish numbers it did not measure. What you can reason about without measuring:

- **Number of passes** — one per eager stage.
- **Allocations** — one array per eager stage.
- **Work proportional to input or to output** — the question a `slice`/`[0]`/`length > 0`
  at the end of a chain answers.

Anything finer than that (whether the engine elides an allocation, how a particular
callback inlines) needs a profiler on your own workload, and the honest default in the
absence of one is: **write the clear version, and change it when a profile says to.**
Complexity itself is [Phase 13 · Complexity and real costs](../../phase-13-complexity/README.md).

## Gotchas

**Symptom:** `filter(...)[0]` returned `undefined` and the whole array was scanned anyway
**Cause:** `filter` never short-circuits.
**Fix:** `find` — it stops at the first match and returns `undefined` if there is none.

**Symptom:** The caller's array came back reordered
**Cause:** `reverse()` and `sort()` mutate in place; chaining them into a read looks
harmless.
**Fix:** `findLast`, or `toReversed()`/`toSorted()` for a copy.

**Symptom:** A pipeline ending in `.slice(0, 10)` was slow on a large list
**Cause:** Every stage ran over every element before the slice discarded the rest.
**Fix:** Iterator helpers with `take(10)`, or a loop with a `break`.

**Symptom:** Rewriting `filter().map()` as `reduce` with a spread made it much slower
**Cause:** `[...acc, x]` allocates a new array per element — quadratic.
**Fix:** `push` into the accumulator, or keep `filter().map()`.

**Symptom:** `list.length > 0 && list.filter(fn).length > 0` in a hot path
**Cause:** Asking "are there any" by counting all of them.
**Fix:** `list.some(fn)`.

**Symptom:** An optimisation made the code slower and less readable
**Cause:** Guessing instead of profiling; array methods on small inputs are not the
bottleneck.
**Fix:** Keep the clear version until a measurement says otherwise.

## Interview questions

**★ Why prefer `find` over `filter(...)[0]`?**
`find` stops at the first match and allocates nothing; `filter` visits every element and
builds a whole array you then throw away. It also states the intent — one result, not all
results.

**★ What is wrong with `list.reverse().find(fn)`?**
`reverse()` **mutates** the array, so a read operation silently reorders the caller's data.
Use `findLast`, or `toReversed()` if you really want a reversed copy.

**★ How many passes does `arr.filter(f).map(g).slice(0, 10)` make?**
Three, with an array allocated at each stage, and the work is proportional to the input
rather than the ten results wanted. `arr.values().filter(f).map(g).take(10).toArray()` does
it in one pass because iterator helpers are lazy.

**★ When is chaining array methods the right choice?**
Small to moderate arrays, where clarity dominates; when you need every element anyway; and
when the new arrays are wanted for immutability. The chain's cost only matters when the
input is large, a callback is expensive, or you want a bounded prefix.

**Is `reduce` a good way to avoid intermediate arrays?**
Only in its mutating-accumulator form, which is a loop with extra syntax. The spread form
`[...acc, x]` is quadratic. If the motivation is performance, write the loop.

**How do you decide between `some`, `find` and `filter`?**
By the question. Boolean → `some`. One item → `find`. All matching items → `filter`. The
short-circuiting follows from choosing correctly, rather than being a separate
optimisation.

---

← Prev [What can stop, and what cannot](./01-what-can-stop.md) · [Topic index](./README.md)
