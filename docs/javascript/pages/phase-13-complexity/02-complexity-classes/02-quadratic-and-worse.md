---
title: "02.2 · O(n²) and worse"
sidebar_label: "02 · O(n²) and worse"
sidebar_position: 2
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-14 against MDN — [`Array.prototype.includes()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/includes), [`Set`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Set), [`Array.prototype.flat()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/flat). Documentation-validated; **no timings**.

**These are the classes that end features.** The distinction that matters is not "slow" versus
"fast" — it is **survivable growth** versus **a wall**, and the wall arrives sooner than
intuition suggests.

## O(n²) — quadratic

Every element compared against every element.

```js
// the honest version — you can see it
for (const a of items)
  for (const b of items)
    if (a.id !== b.id && overlaps(a, b)) conflicts.push([a, b]);
```

```js
// the hidden version — one method call
const dupes = items.filter((x, i) => items.indexOf(x) !== i);
```

🔴 **The hidden version is the one that ships.** `indexOf` inside `filter` is a scan inside a
scan; the code reads as a single linear pass. Every accidental quadratic in application code has
this shape — see the full table in
[01 · 02 · Reading a bound](../01-big-o/02-reading-a-bound.md).

**Where quadratic is genuinely fine:** small, bounded n. Comparing 20 calendar events pairwise is
400 operations and instant. The failure mode is not writing it — it is writing it where n is
user-controlled, because *n grows and the code does not change*. A quadratic over "the items in
one order" is fine until someone imports a CSV.

**The escape is almost always a lookup structure:**

```js
// ❌ O(n²)
const dupes = items.filter((x, i) => items.indexOf(x) !== i);

// ✅ O(n)
const seen = new Set();
const dupes = items.filter((x) => (seen.has(x) ? true : (seen.add(x), false)));
```

**or a sort.** Sorting first turns "compare every pair" into "compare neighbours" for a large
family of problems — overlapping intervals, nearest values, duplicate detection on a sortable
key. O(n log n) beats O(n²) decisively, and the transformation is mechanical enough to recognise:
*if the property you are checking only involves elements that would be adjacent when sorted, sort
and scan.*

## O(n³) and the polynomial middle

Three nested loops — matrix multiplication, all-pairs-shortest-path, or (in practice) a
triple-nested lookup over related collections in a report generator. Rare in application code, and
when it appears it is almost always three scans that should be two `Map`s and a loop.

## O(2ⁿ) — exponential

Each additional element **doubles** the work.

```js
function subsets(items) {                        // 2ⁿ subsets exist
  if (!items.length) return [[]];
  const [first, ...rest] = items;
  const without = subsets(rest);
  return [...without, ...without.map((s) => [first, ...s])];
}

function fib(n) {                                // O(2ⁿ) — recomputes the same values
  return n < 2 ? n : fib(n - 1) + fib(n - 2);
}
```

🔴 **The wall:** 2⁴⁰ is about a trillion. At n = 40 an exponential algorithm is not slow, it is
**never going to finish**. There is no machine that fixes it, and no micro-optimisation that
matters — a 100× faster constant buys you seven more elements.

**Two different situations wear this shape, and they have different answers:**

- **Recomputation** — `fib` above recalculates the same subproblems repeatedly. **Memoise**, and
  it collapses to O(n). This is the entire premise of dynamic programming
  (**Phase 16 · Dynamic programming**, *not written yet*), and the giveaway is a recursion whose
  arguments repeat.
- **Genuinely exponential output** — there really are 2ⁿ subsets, and enumerating them cannot be
  cheaper than the number of things enumerated. Here the answer is not a better algorithm; it is
  **not enumerating them** — prune, bound, approximate, or change the question.

Telling these apart is the useful skill: **look at whether the recursion revisits states**. If it
does, memoisation is the fix. If every leaf is a distinct output, the algorithm is optimal and the
requirement is wrong.

## O(n!) — factorial

Every permutation.

```js
function permutations(items) {                   // n! results
  if (items.length <= 1) return [items];
  return items.flatMap((item, i) =>
    permutations([...items.slice(0, i), ...items.slice(i + 1)])
      .map((perm) => [item, ...perm]),
  );
}
```

10! is 3.6 million and manageable; **13! is over 6 billion and is not**. Anything asking for "the
best ordering" — travelling salesman, task scheduling with arbitrary constraints — is in this
family, and the practical answer is always a heuristic, a greedy approximation, or a solver, never
the exhaustive search.

## The growth table, and where each dies

| n | O(n) | O(n log n) | O(n²) | O(2ⁿ) | O(n!) |
|---|---|---|---|---|---|
| 10 | 10 | 33 | 100 | 1,024 | 3,628,800 |
| 20 | 20 | 86 | 400 | ~1 million | ~2.4 × 10¹⁸ |
| 100 | 100 | 664 | 10,000 | ~10³⁰ | beyond counting |
| 10,000 | 10,000 | ~133,000 | **100,000,000** | — | — |

🔴 **Read the O(n²) column, not the exponential ones.** Exponential algorithms announce
themselves — they hang in testing. **Quadratic is the dangerous class**, because it is fine with
100 rows in development and catastrophic with 10,000 in production, and the code that fails is
the code that passed review.

## The escape ladder

When you have identified a bound you cannot afford, in the order to try:

1. **Replace a scan with a lookup** — `Set`/`Map` built before the loop. O(n²) → O(n).
2. **Sort, then exploit adjacency** — O(n²) → O(n log n) for pair-wise properties.
3. **Memoise** — exponential → polynomial, when subproblems repeat.
4. **Prune** — abandon branches that cannot beat the best answer so far. Does not change the
   worst-case bound; frequently changes whether it finishes.
5. **Change the question** — approximate, sample, paginate, or push the work to a system built
   for it (a database index is someone else's B-tree).
6. **Bound n** — cap the input, and say so in the API. A documented limit beats a timeout.

## Gotchas

**Symptom:** Fine in development, unusable in production
**Cause:** Quadratic behaviour with a small development dataset.
**Fix:** Test with production-scale n; look for scans inside loops.

**Symptom:** `items.filter((x, i) => items.indexOf(x) !== i)` is slow
**Cause:** A scan inside a scan — O(n²) written as one line.
**Fix:** A `Set` for seen values.

**Symptom:** A recursive solution hangs at n = 40
**Cause:** Exponential recomputation of the same subproblems.
**Fix:** Memoise. If the recursion revisits states, it collapses to polynomial.

**Symptom:** Memoising an exponential algorithm changes nothing
**Cause:** The output really is exponential — no subproblem repeats.
**Fix:** Do not enumerate. Prune, approximate, or change the requirement.

**Symptom:** "It is only 13 items" and it never returns
**Cause:** Factorial — 13! is over 6 billion.
**Fix:** A heuristic or a solver; exhaustive permutation is not an option above ~10.

**Symptom:** A quadratic is "fixed" by micro-optimising the inner loop
**Cause:** Attacking the constant instead of the shape.
**Fix:** Change the algorithm; a 100× constant buys nothing against growth.

**Symptom:** Nested loops over related collections in a report
**Cause:** Repeated scans where an index would do.
**Fix:** Build `Map`s keyed by the join field before iterating.

## Interview questions

**★ Which complexity class causes the most production incidents, and why?**
O(n²). Exponential algorithms hang in testing and get caught; quadratic ones are fine with 100
development rows and catastrophic with 10,000 production rows. The code that fails is code that
passed review.

**★ Turn `items.filter((x, i) => items.indexOf(x) !== i)` into a linear solution.**
Track seen values in a `Set` and test membership in one pass. `indexOf` inside `filter` is a scan
inside a scan.

**★ When does sorting help a quadratic problem?**
When the property you are checking only relates elements that would be adjacent once sorted —
overlapping intervals, nearest values, duplicates on a sortable key. Sorting is O(n log n) and the
scan afterwards is O(n).

**★ A recursive function is O(2ⁿ). How do you know whether memoisation will help?**
Look at whether the recursion revisits the same arguments. Repeated subproblems (like `fib`)
collapse to polynomial with memoisation. If every leaf is a distinct output — enumerating all 2ⁿ
subsets — the cost is inherent and the requirement has to change.

**★ Why can't a faster machine rescue an exponential algorithm?**
Because a constant-factor speedup translates into a constant number of extra elements. A 100×
faster machine buys about seven more items at 2ⁿ. The growth, not the constant, is the problem.

**★ You have identified an O(n²) you cannot afford. What is your order of attack?**
Replace the scan with a lookup; then sort and exploit adjacency; then memoise if subproblems
repeat; then prune; then change the question — paginate, approximate, or let a database index do
it. Bounding n and documenting the limit is a legitimate last option.

**Is quadratic ever acceptable?**
Yes, when n is small **and bounded by something other than user input**. Twenty calendar events
pairwise is 400 operations. The danger is the same code where n is a CSV import.

---

← [01 · O(1) to O(n log n)](./01-constant-to-linearithmic.md) · [Topic index](./README.md) ·
Next → [Phase index](../README.md)
