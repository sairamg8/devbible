---
title: "Closest pair is the standard interview vehicle for a divide and conquer whose combine step is not obvious — and the whole algorithm rests on one packing argument that bounds the strip scan at seven comparisons per point"
sidebar_label: "13h · Closest pair of points"
sidebar_position: 13.7
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-09-08. The divide-and-conquer construction, the packing argument bounding the
> strip scan, and the two recurrences are **standard algorithm and mathematics**, derived and
> argued on this page rather than cited; the recurrences are solved with the method on
> [Phase 1 · Recurrences and the master theorem](../phase-1-complexity/08-recurrences-and-the-master-theorem.md).
> ⚠️ `TreeSet.subSet` is named as the Java structure for the sweep variant; its javadoc was **not**
> fetched for this page, so no behavioural detail of it is asserted. **No sandbox run** — no code
> below has been executed and no running time here is a measurement. Version spine:
> **JDK 25 · MDN as fetched 2026-09-07**.

**Given `n` points, find the two that are closest. The quadratic answer is four lines and the
interviewer already knows you can write it; the question is whether the `O(n log n)` version's
combine step is something you can construct rather than recall.** It is the cleanest example in the
whole topic of a divide and conquer where splitting is trivial and merging is the entire problem —
and of the discipline this topic is really about, because the algorithm can be written end to end
without ever computing a square root.

## Start with the brute force, and say why

```ts
let best = Infinity;
for (let i = 0; i < n; i++)
  for (let j = i + 1; j < n; j++)
    best = Math.min(best, dist2(p[i], p[j]));    // squared, per 13
```

```java
long best = Long.MAX_VALUE;
for (int i = 0; i < n; i++)
    for (int j = i + 1; j < n; j++)
        best = Math.min(best, dist2(p[i], p[j]));
```

For `n` in the low thousands this is the correct engineering answer and the constraint will tell
you so — [Phase 0 · Reading the constraints](../phase-0-the-interview-and-practice/05-reading-the-constraints.md)
is the habit. Two thousand points is two million pairs. Two hundred thousand points is two times
ten to the tenth, and that is the signal to divide.

The one-dimensional warm-up is worth thirty seconds of thought before the plane version, because it
contains the whole idea in miniature: on a line, the closest pair are **adjacent after sorting**, so
the problem is a sort and a linear scan. The plane has no total order that makes that true, and
everything below is the price of that.

## The divide and conquer

1. **Sort by `x` once**, before any recursion. Sorting inside the recursion is the classic way to
   turn this into an `O(n log² n)` algorithm by accident.
2. **Split by index at the midpoint** of the sorted array — not by `x` *value*. This matters: if
   many points share an `x`, splitting on the value can put every point on one side and the
   recursion never shrinks.
3. **Recurse** into both halves and take `d² = min(dl², dr²)`.
4. **Combine** over the strip: the only pairs not yet considered straddle the split line, and any
   such pair closer than `d` has both endpoints within `d` of that line horizontally. Collect those
   points, order them by `y`, and compare each with the points that follow while the `y` gap is
   under `d`.

Base case: `n ≤ 3`, solved by brute force. This is exactly the template of
[02](02-divide-and-conquer.md), and it is the archetype
[02h](02h-solve-halves-combine-when-it-is-not-sorting.md) is about — the halves are easy and the
combine is the algorithm.

```ts
function closestPair(sortedByX: Pt[]): number {   // returns the SQUARED distance
  const n = sortedByX.length;
  if (n <= 3) {
    let best = Infinity;
    for (let i = 0; i < n; i++)
      for (let j = i + 1; j < n; j++) best = Math.min(best, dist2(sortedByX[i], sortedByX[j]));
    return best;
  }

  const mid = n >> 1;
  const xmid = sortedByX[mid].x;
  let d2 = Math.min(closestPair(sortedByX.slice(0, mid)), closestPair(sortedByX.slice(mid)));

  const strip = sortedByX
    .filter(p => (p.x - xmid) * (p.x - xmid) < d2)   // squared: no sqrt, still exact
    .sort((a, b) => a.y - b.y);

  for (let i = 0; i < strip.length; i++) {
    for (let j = i + 1; j < strip.length; j++) {
      const dy = strip[j].y - strip[i].y;
      if (dy * dy >= d2) break;                      // the packing bound, implemented
      d2 = Math.min(d2, dist2(strip[i], strip[j]));
    }
  }
  return d2;
}
```

Every comparison in that function is between squared quantities, so for integer input the whole
computation is exact integer arithmetic and the caller roots the result once, if it wants a
distance at all.

## Why the strip scan is a constant

This is the part interviewers ask you to prove, and it is the only non-obvious step.

**Claim:** inside the strip, in `y` order, each point needs to be compared with at most the next
seven.

**Proof.** Fix a strip point `p`. Any partner that beats `d` lies within `d` of `p` in every
direction, and in the strip, so it lies in the rectangle spanning `d` left and `d` right of the
split line and `d` upward from `p` — a `2d × d` rectangle. Cut that rectangle into eight squares of
side `d/2`. Two points inside one such square are at most its diagonal apart, which is
`d/√2 ≈ 0.707d`, strictly less than `d`. But both points of any such pair lie on the same side of
the split line, and the recursion has already guaranteed that every within-half pair is at least
`d` apart. Contradiction — so **each small square holds at most one point**. The rectangle holds at
most eight points, and excluding `p` itself that leaves seven.

Notice what the proof leans on: the inductive guarantee from the recursive calls. The bound is not
a property of points in a strip; it is a property of points in a strip *after* both halves have
been solved. That is why the algorithm cannot be reordered.

Write the loop with the `dy² ≥ d²` break rather than a literal `7`. The break implements the same
bound, it is correct even if you have misremembered the constant, and it is one fewer magic number
to defend.

## The two complexities, and which one you should implement

Sorting the strip by `y` inside each call:

```
T(n) = 2·T(n/2) + O(n log n)      →      O(n log² n)
```

Returning each half's points already sorted by `y` and **merging** them in the combine step — the
merge of [02c](02c-merge-sort.md), piggybacked on the same recursion — makes the combine linear:

```
T(n) = 2·T(n/2) + O(n)            →      O(n log n)
```

State both. Implement the first unless you have time to spare, because the piggybacked merge means
each call now returns a value *and* a sorted array, and getting that plumbing right under pressure
is where the mistakes are. An interviewer who wanted the second will ask for it.

## The sweep-line alternative

There is a much shorter `O(n log n)`: sweep left to right, keeping the points whose `x` is within
the current best `d` of the sweep position in a set ordered by `y`. For each new point, examine
only the set members whose `y` lies in `[y − d, y + d]`; the same packing argument bounds how many
of those there can be. Points falling behind the `d` window are removed as the sweep advances.

In Java, `TreeSet` with a `subSet` range query expresses this directly. ⚠️ Its javadoc was not
fetched for this page, so verify the exact bounds semantics before relying on inclusivity. In
JavaScript there is no built-in ordered set, which is why the divide and conquer is the version
usually written there — building a balanced tree from scratch costs more than the recursion does.
[13i](13i-convex-hull-and-the-sweep-line.md) covers the sweep-line pattern in general.

## Gotchas

**★ Splitting by `x` value instead of by index can fail to terminate.** If half the input shares one
`x` coordinate — a vertical line of points, which is a natural test — a value-based partition can
put all of them on one side, so the recursion recurses on the same set forever or degrades to
quadratic. Sort once and split the array at `n >> 1`.

**★ The strip filter must use the squared comparison.** `Math.abs(p.x − xmid) < d` needs the real
`d`, which needs a square root, which is what the whole page is avoiding. Compare
`(p.x − xmid)²` against `d²`.

**★ Duplicate points make the answer zero, and some implementations miss it.** Two identical points
have distance zero, which is the minimum possible; a brute-force base case finds it, but a variant
that skips pairs it considers "the same point" by coordinate rather than by index will not. Decide
whether duplicates are allowed and, if they are, return zero rather than treating it as degenerate.

**★ `best` has no `Infinity` in Java.** `Long.MAX_VALUE` is the sentinel, and anything that adds to
it wraps silently — see [05c](05c-javas-int-and-the-checked-arithmetic.md). Only ever `min` against
it, never arithmetic.

**★ Squared distances overflow on the same schedule as cross products.** `dist2` is bounded by
`8C²` for a coordinate bound `C`, identical to the orientation predicate's bound, so the type
analysis of [13g](13g-integer-exactness-and-where-it-ends.md) applies unchanged. It is easy to type
the cross product carefully and then write the distance accumulator as an `int` beside it.

**★ `slice` in the recursion allocates.** The TypeScript version above copies both halves at every
level, which is `O(n log n)` memory traffic on top of the algorithm. It is written that way for
clarity; the version to write when it matters passes `lo` and `hi` indices into the same array.
This is the same allocation-versus-indices decision as [02c](02c-merge-sort.md)'s merge buffer.

**★ Claiming `O(n log n)` while implementing `O(n log² n)` is a real error, not a rounding.** If the
strip is sorted inside each call, the bound is `O(n log² n)`. Interviewers check this by asking you
to write the recurrence, and the recurrence gives you away immediately.

**★ Returning the squared distance and forgetting to root it is the other half of the same
discipline.** Keep it squared throughout, and root exactly once, in the function the caller sees.
Name the internal function `closestPair2` if that helps you remember which one you are in.

## Interview questions

**★ Find the closest pair of points in better than quadratic time.**
Sort by `x` once, split the sorted array in half by index, and recurse; let `d` be the smaller of
the two answers. Any pair closer than `d` must straddle the split, so both of its points lie within
`d` of the split line — that is the strip. Sort the strip by `y` and, for each point, scan forward
while the `y` gap is less than `d`. That scan is bounded by a constant number of points, so the
combine is linear in the strip; sorting the strip in each call gives `O(n log² n)` and merging the
halves' `y`-sorted lists instead gives `O(n log n)`. Every comparison is on squared distances, so
the whole thing is exact for integer input and there is no square root until the final answer.

**★ Prove the strip scan is bounded.**
Take a strip point `p` and the `2d × d` rectangle covering everything within `d` of it in the
forward `y` direction. Cut it into eight `d/2` squares. Any two points in the same square are at
most `d/√2` apart, which is less than `d`; but two points in one square lie on the same side of the
split line, and the recursive calls have already established that no within-half pair is closer
than `d`. So each square holds at most one point, the rectangle holds at most eight, and `p` needs
at most seven comparisons. The proof depends on the inductive guarantee, which is why the strip
step cannot be done before the recursion.

**★ Why does splitting by index matter rather than splitting by x value?**
Because coordinates can repeat. A value split at the median `x` places every point with that
coordinate on one side, and if enough points share it the "halves" are the whole set and an empty
set — no progress, and the recursion either loops or degrades to quadratic. Splitting the sorted
array at the midpoint index always halves the count. The strip step does not care that points with
equal `x` ended up on different sides; it only cares that within-half pairs are at least `d` apart,
which the recursion still guarantees.

**★ Your input has 5,000 points. What do you write?**
The double loop. Twelve and a half million squared-distance evaluations is nothing, it takes four
lines, and it has no strip, no recursion and no packing argument to get wrong. I would say that out
loud, name the `O(n log n)` algorithm so the interviewer knows I have it, and ask whether they want
it implemented. Choosing the sophisticated algorithm when the constraint does not demand it is a
judgement error that costs you the rest of the time budget.

**★ How would you extend this to return the pair, not just the distance?**
Carry the pair alongside the distance in every comparison: the base case, the two recursive
returns, and the strip scan each update a `(d², a, b)` triple instead of a scalar. The only subtlety
is the ties — if two pairs share the minimum distance, decide whether any of them will do. It is
also worth noting that the value stays squared right up to the point of return, so the pair is
selected on exact integer comparisons.

**★ What changes in three dimensions?**
The structure survives: sort by `x`, split, recurse, and examine a **slab** of thickness `2d` rather
than a strip. The packing argument still applies but with cubes instead of squares, so the constant
is larger, and the slab must be searched in two dimensions rather than sorted along one — which is
why the naive extension gives `O(n log² n)` and the good bounds in higher dimensions get
progressively harder. The right answer in an interview is to describe the analogy and say that the
constant grows exponentially with the dimension.

**★ What does your algorithm return if the input contains duplicate points?**
Zero, which is correct — two coincident points are as close as points can be. It is worth checking
that the code actually produces it rather than assuming: the base case finds duplicates only if it
compares pairs by index rather than skipping pairs that "look like the same point", and the strip
scan finds them only if the `dy² ≥ d²` break is not triggered at `d² = 0`. Once the best is zero the
algorithm can stop entirely, which is a legitimate early exit.

**★ How does the algorithm change if you want the closest pair under Manhattan distance?**
The divide-and-conquer structure survives but the packing argument does not transfer unchanged: the
"ball" of radius `d` under L1 is a diamond rather than a circle, so the strip geometry and the
constant both change. The practical answer is that Manhattan closest pair has a neater solution —
rotate the coordinates by mapping `(x, y)` to `(x + y, x − y)`, which turns Manhattan distance into
Chebyshev distance, and Chebyshev closest pair reduces to comparisons on the transformed
coordinates. Recognising that the metric changes the algorithm rather than just the distance
function is the point of the question.

{/* FOOTER */}
