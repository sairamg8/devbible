---
title: "06.1 · The default, and the comparator"
sidebar_label: "01 · The default and comparator"
sidebar_position: 1
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-13 against MDN — [`Array.prototype.sort`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/sort). Documentation-validated.

**The default sort is a string sort, and it ruins numbers.** That is the first thing to
know about `sort`, and it is a bug that ships regularly because the output *looks*
sorted.

## The default converts everything to strings

MDN: *"The default sort order is ascending, built upon **converting the elements into
strings, then comparing their sequences of UTF-16 code unit values**."*

Its own example:

```js
const array = [1, 30, 4, 21, 100000];
array.sort();
console.log(array);
// Expected output: Array [1, 100000, 21, 30, 4]
```

`"100000"` sorts before `"21"` because `"1"` comes before `"2"`. The array is
correctly sorted — as **strings**. Nothing warns you.

**Always pass a comparator for numbers:**

```js
array.sort((a, b) => a - b);   // ascending
array.sort((a, b) => b - a);   // descending
```

The subtraction form works because the contract is about the *sign* of the result, not
its magnitude.

## The comparator contract

MDN: `compareFn` must return a number where

- **negative** — `a` comes before `b`
- **positive** — `a` comes after `b`
- **zero or `NaN`** — `a` and `b` are considered equal

Note `NaN` counting as equal: a comparator that accidentally returns `NaN` (subtracting
a `undefined`, say) does not throw — it silently declares every such pair equal, and
the array comes back in an order that looks arbitrary.

### The five consistency requirements

MDN spells out what a *well-formed* comparator must satisfy, and this is the part
people have never read:

- **Pure** — *"Does not mutate objects or external state"*
- **Stable** — *"Returns the same result for the same pair of inputs"*
- **Reflexive** — `compareFn(a, a) === 0`
- **Anti-symmetric** — `compareFn(a, b)` and `compareFn(b, a)` must have opposite signs
  or both be zero
- **Transitive** — if `compareFn(a, b)` and `compareFn(b, c)` have the same sign, then
  `compareFn(a, c)` must have that sign too

**Violating these does not throw.** It produces an implementation-defined ordering —
the result depends on the engine's algorithm and even on the input's initial order.

The classic violation:

```js
arr.sort(() => Math.random() - 0.5);   // ❌ NOT a fair shuffle
```

It is not stable (different result for the same pair), not reflexive, not
anti-symmetric and not transitive. The output is biased in a way that depends on the
engine's sort. Use a Fisher–Yates shuffle instead:

```js
for (let i = arr.length - 1; i > 0; i--) {
  const j = Math.floor(Math.random() * (i + 1));
  [arr[i], arr[j]] = [arr[j], arr[i]];
}
```

A subtler violation, and a common one:

```js
// ❌ not anti-symmetric: compare(a,b) and compare(b,a) are both 1 when neither is "x"
items.sort((a, b) => (a.type === "x" ? -1 : 1));
```

Every comparison returns `-1` or `1`, never `0`, and swapping the arguments does not
flip the sign. Write the full three-way comparison instead.

## Comparing strings

```js
["b", "a", "c"].sort();                     // works — this is what the default is for
names.sort((a, b) => a.localeCompare(b));   // human-language ordering
```

The default is fine for plain ASCII strings. It is **not** fine for human text: it
compares UTF-16 code units, so `"Z"` sorts before `"a"`, and accented characters sort
after every unaccented one.

`localeCompare` returns a negative/zero/positive number, so it plugs straight into the
comparator, and it handles case and accents according to locale rules. For sorting a
large list, build a `Intl.Collator` once and reuse its `compare` — creating one per
comparison is the wasteful shape.

## Multi-key sorting

The pattern worth memorising: **compare the first key; if it ties, fall through to the
next.**

```js
users.sort(
  (a, b) =>
    a.lastName.localeCompare(b.lastName) ||
    a.firstName.localeCompare(b.firstName) ||
    a.age - b.age,
);
```

`||` works because a tie returns `0`, which is falsy, so evaluation continues to the
next comparison. The first non-zero result wins. It reads top-to-bottom as the sort
priority, which is exactly right.

For a descending key inside an ascending sort, negate that one term:

```js
(a, b) => a.group.localeCompare(b.group) || b.score - a.score
```

## Sorting by a computed key

When the key is expensive to compute, computing it inside the comparator does it
O(n log n) times. Compute it once per element instead:

```js
const sorted = items
  .map((item) => ({ item, key: expensiveKey(item) }))
  .sort((a, b) => a.key - b.key)
  .map(({ item }) => item);
```

This is the decorate–sort–undecorate pattern. For a cheap key (`a.age - b.age`) it is
not worth the allocation; for anything involving parsing, normalising or a `Date`
construction it is.

Note the shape also protects you from a subtle correctness problem: a comparator that
computes a key with any variability (a `Date.now()`, a random tiebreak) violates the
*stable* requirement above.

## Gotchas

**Symptom:** `[1, 30, 4, 21, 100000].sort()` gives `[1, 100000, 21, 30, 4]`
**Cause:** The default sort converts to strings and compares UTF-16 code units.
**Fix:** `sort((a, b) => a - b)`.

**Symptom:** `sort(() => Math.random() - 0.5)` produces a biased shuffle
**Cause:** It violates every consistency requirement MDN lists — not stable, reflexive,
anti-symmetric or transitive. The result is implementation-defined.
**Fix:** Fisher–Yates.

**Symptom:** A sort returns a different order in different browsers
**Cause:** An inconsistent comparator. MDN's five requirements are not enforced, and
violating them yields implementation-defined behaviour.
**Fix:** Make the comparator a pure, total, three-way comparison. Check
anti-symmetry — the `a.type === "x" ? -1 : 1` shape is the usual offender.

**Symptom:** Sorting appears random and no error was thrown
**Cause:** The comparator returned `NaN` for some pairs — MDN treats `NaN` as *equal*.
Usually a subtraction involving `undefined`.
**Fix:** Guard the values, or use `??` to supply a default before comparing.

**Symptom:** Strings sort with all capitals before all lowercase
**Cause:** UTF-16 code-unit order — `"Z"` (90) precedes `"a"` (97).
**Fix:** `localeCompare`, or an `Intl.Collator` built once and reused.

**Symptom:** Sorting a large list by a derived key is slow
**Cause:** The key is recomputed on every comparison — O(n log n) times.
**Fix:** Decorate–sort–undecorate: `map` to `{item, key}`, sort on `key`, `map` back.

## Interview questions

**★ Why does `[1, 30, 4, 21, 100000].sort()` give `[1, 100000, 21, 30, 4]`?**
Because the default sort **converts elements to strings** and compares UTF-16 code
units, so `"100000"` precedes `"21"`. It is correctly sorted as strings. Always pass
`(a, b) => a - b` for numbers.

**★ What is the comparator contract?**
Return a **negative** number if `a` comes first, **positive** if `b` does, and **zero**
for equal — and MDN notes `NaN` is also treated as equal. Only the sign matters, which
is why `a - b` works.

**★ What makes a comparator well-formed?**
MDN lists five requirements: **pure**, **stable** (same result for the same pair),
**reflexive** (`f(a,a) === 0`), **anti-symmetric** (`f(a,b)` and `f(b,a)` have opposite
signs), and **transitive**. Violating them does not throw — it produces an
implementation-defined order.

**★ Why is `sort(() => Math.random() - 0.5)` a bad shuffle?**
It breaks every one of those requirements, so the result is biased and
engine-dependent rather than uniformly random. Use Fisher–Yates.

**How do you sort by two keys?**
Chain with `||`: `a.last.localeCompare(b.last) || a.first.localeCompare(b.first)`. A tie
returns `0`, which is falsy, so evaluation falls through to the next comparison. Negate
one term for a descending key.

**How do you sort human-readable text?**
`localeCompare`, or an `Intl.Collator` created once and reused for a large list. The
default is UTF-16 code-unit order, which puts every capital before every lowercase
letter and mis-sorts accented characters.

---

[Topic index](./README.md) · Next → [Stability, mutation and `toSorted`](./02-stability-and-mutation.md)
