---
title: "Computational geometry in an interview is almost never about geometry — it is about whether you reach for floating point when the input was integers, and the single habit that fixes it is comparing squared distances and never calling sqrt"
sidebar_label: "13 · Geometry basics"
sidebar_position: 13
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-09-08. The geometry on this page — vectors as differences of points, the
> monotonicity argument that lets a squared distance stand in for a distance, the Manhattan and
> Chebyshev metrics — is **mathematics**, derived here rather than cited, because cross products
> and their relatives have no single primary source to cite. The **language behaviour** is quoted:
> [`Array.prototype.sort`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/sort)
> and
> [`Number.MAX_SAFE_INTEGER`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Number/MAX_SAFE_INTEGER)
> from MDN. ⚠️ `Math.hypot` and `Math.sqrt` javadoc/reference pages were **not** fetched for this
> page; nothing is asserted about them beyond what is derived here, and the one place they are
> mentioned says so. **No sandbox run** — no code on this page has been executed and no output is
> shown. Version spine: **JDK 25 · MDN as fetched 2026-09-07**.

**A geometry question is a trap laid in the first thirty seconds: the word "distance" appears, your
hand moves to `Math.sqrt`, and from that moment every comparison you make is a floating-point
comparison on data that was exact integers when it arrived.** The interviewer is rarely checking
whether you remember the formula for the area of a triangle. They are checking whether you notice
that the question — *which of these points is closest*, *do these two segments cross*, *is this
polygon convex* — is a question about **order and sign**, and that order and sign survive the
removal of every square root and every division. That removal is the whole skill. The catalogue of
algorithms is small and mostly memorisable; the discipline of keeping the arithmetic exact is what
separates an answer that is right from an answer that is right on the examples.

This chunk is the representation and the distance habit.
[13b](13b-the-cross-product.md) is the cross product, which is the engine every later chunk runs
on. [13c](13c-orientation-and-segment-intersection.md) is orientation and segment intersection,
[13d](13d-shoelace-area-and-convexity.md) is polygon area and convexity,
[13e](13e-point-in-polygon-by-ray-casting.md) is point-in-polygon and its degeneracies.
[13f](13f-floating-point-and-the-epsilon-decision.md) and
[13g](13g-integer-exactness-and-where-it-ends.md) are the precision material, which is the real
content of this topic. [13h](13h-closest-pair-of-points.md),
[13i](13i-convex-hull-and-the-sweep-line.md), [13j](13j-max-points-on-a-line.md) and
[13k](13k-geometry-in-backend-work.md) are the problem catalogue and where any of this shows up in
a job.

## Points, and the two representations

A point is an ordered pair. There are exactly two representations worth using and the choice is
about ergonomics, not correctness.

```ts
// Object form — readable, and what you want on a whiteboard.
type Pt = { x: number; y: number };

// Tuple form — what LeetCode-style inputs actually arrive as.
type PtArr = [number, number];          // p[0] is x, p[1] is y
```

```java
// Java 25: a record is the whole class. Immutable, has equals/hashCode, prints readably.
record Pt(long x, long y) {}

// Inputs usually arrive as int[][], where p[0] is x and p[1] is y.
```

Two decisions are already made in that Java snippet and both are deliberate.

**Use `long`, not `int`, for stored coordinates.** Not because the coordinates are large — because
every geometric primitive on the following pages *multiplies* two coordinate differences, and the
product is where an `int` dies. Storing as `long` means the promotion happens at the field access
rather than being something you have to remember at every arithmetic site.
[13g](13g-integer-exactness-and-where-it-ends.md) derives the exact coordinate magnitude at which
each type gives up.

**Use a record, not a `Point` with mutable fields.** Geometry code passes points around, puts them
in sets, and uses them as map keys. A record gives you value equality and a hash for free; a
hand-written class with public `x` and `y` and no `equals` silently makes "have I seen this point
before?" a reference comparison, and every duplicate-point problem then returns the wrong answer
for a reason that has nothing to do with geometry.

A **vector** is not a different type. It is a difference of two points, and the only reason to name
it separately is that a vector has a direction and a length while a point has a position.

```ts
const sub = (a: Pt, b: Pt): Pt => ({ x: a.x - b.x, y: a.y - b.y });
const add = (a: Pt, b: Pt): Pt => ({ x: a.x + b.x, y: a.y + b.y });
```

```java
static Pt sub(Pt a, Pt b) { return new Pt(a.x() - b.x(), a.y() - b.y()); }
static Pt add(Pt a, Pt b) { return new Pt(a.x() + b.x(), a.y() + b.y()); }
```

Everything from here — orientation, area, intersection, convexity — is a function of *differences*
of points, never of the points themselves. That is worth noticing early, because it means the
answers are translation-invariant: shifting every input point by the same offset cannot change any
of them, which is both a useful sanity check and a legitimate preprocessing trick when the
coordinates are large and you want them small.

## Integer coordinates, and why you should insist on them

If the input is integers, **keep them integers all the way to the output**. Every predicate on the
following pages — is this point left of that line, do these segments cross, is this polygon convex,
which pair is closest — is computed from additions, subtractions and multiplications of the
coordinates. Those three operations map integers to integers. The moment you divide or take a
square root you leave the integers, and a predicate that was a provable fact becomes a comparison
between two rounded doubles that happen to be close.

Read the constraints before you write a line —
[Phase 0 · Reading the constraints](../phase-0-the-interview-and-practice/05-reading-the-constraints.md)
is the habit — and specifically read the coordinate bound. A bound like `|x| ≤ 10^4` is not
decoration; it is the interviewer telling you that every intermediate product fits somewhere
specific, and [13g](13g-integer-exactness-and-where-it-ends.md) turns that bound into a type.

When the input genuinely is real-valued — a physics simulation, a map projection, sensor
readings — you do not get to insist, and then the epsilon material in
[13f](13f-floating-point-and-the-epsilon-decision.md) is not optional reading, it is the design
work. What you must not do is *convert* exact input into floating point because a formula you
half-remember was written with a division in it.

## Distance, and the habit that is most of this page

The Euclidean distance between two points is

```
d(a, b) = √((a.x − b.x)² + (a.y − b.y)²)
```

and the squared distance is that expression without the root:

```
d²(a, b) = (a.x − b.x)² + (a.y − b.y)²
```

**The square root is a strictly increasing function on the non-negative reals.** That is the entire
argument, and it is worth stating as a theorem because everything else follows from it: for
non-negative `u` and `v`, `u < v` if and only if `√u < √v`. Therefore any question phrased in terms
of *comparing* distances has an identical answer phrased in terms of comparing squared distances.
Which point is nearest, are these two pairs equidistant, is this point within radius `r` — all of
them, unchanged:

- nearest neighbour: `d²(p, a) < d²(p, b)` ⟺ `d(p, a) < d(p, b)`
- inside a circle: `d²(p, c) ≤ r²` ⟺ `d(p, c) ≤ r`, because both sides are non-negative
- equidistant: `d²(p, a) === d²(p, b)` ⟺ `d(p, a) === d(p, b)` — and the left-hand side is an
  **exact** integer comparison while the right-hand side is a comparison of two rounded doubles
  that has no business being written with `===` at all

```ts
const dist2 = (a: Pt, b: Pt): number => {
  const dx = a.x - b.x, dy = a.y - b.y;
  return dx * dx + dy * dy;            // exact for integer input inside the safe range
};

// Only when the DISTANCE ITSELF is the answer:
const dist = (a: Pt, b: Pt): number => Math.sqrt(dist2(a, b));
```

```java
static long dist2(Pt a, Pt b) {
    long dx = a.x() - b.x(), dy = a.y() - b.y();
    return dx * dx + dy * dy;          // long, because the squares are where int overflows
}

// Only when the DISTANCE ITSELF is the answer:
static double dist(Pt a, Pt b) { return Math.sqrt(dist2(a, b)); }
```

**When is the real distance actually required?** Three cases, and they are the only three:

1. **The distance is the output.** "Return the distance to the closest pair" — you must root it
   once, at the end, after the comparisons are all done in squared form.
2. **You are summing distances** — perimeter, path length, total travel. Squares do not add: the
   sum of the roots is not the root of the sum, so a perimeter cannot be computed in squared space.
   This is the one case that genuinely forces floating point mid-computation, and it is why
   perimeter problems are harder to keep exact than area problems.
3. **You are mixing distance with a non-squared quantity** — comparing a distance against a
   speed × time budget, or against a length that arrived as a decimal.

Everything else is a comparison, and comparisons do not need the root.

## The other two metrics, which are already exact

Interviews on grids use two more distances, and both are computed with no multiplication at all,
so both are exact in integers with far more headroom than the Euclidean one.

- **Manhattan (L1):** `|a.x − b.x| + |a.y − b.y|` — movement restricted to axis-aligned steps.
- **Chebyshev (L∞):** `max(|a.x − b.x|, |a.y − b.y|)` — movement including diagonals, which is why
  it is the number of king moves on a chessboard.

The rotation between them is a genuinely useful trick and worth recognising rather than deriving
under pressure: mapping each point `(x, y)` to `(x + y, x − y)` turns Chebyshev distance in the new
coordinates into Manhattan distance in the old, and the inverse map turns Manhattan into Chebyshev.
Problems that ask for the maximum Manhattan distance between any two of `n` points are solved by
that rotation plus a scan of the four `±x ±y` extremes, in linear time, with no pairwise loop.

## Gotchas

**★ `points.sort()` in JavaScript does not sort points.** It does not sort numbers either. MDN is
explicit about the default:

> *"If `compareFn` is not supplied, all non-`undefined` array elements are sorted by converting them to strings and comparing strings in UTF-16 code units order."*

An array of `[x, y]` pairs stringifies to `"3,4"`, so the sort is lexicographic on the rendered
text, and `[10, 0]` sorts before `[9, 0]`. Every geometry algorithm that begins "sort the points by
x" — the convex hull in [13i](13i-convex-hull-and-the-sweep-line.md), the closest-pair split,
the sweep line — begins with a comparator, always.

**★ Sorting by distance with a subtraction comparator is an overflow waiting to happen.** In Java a
comparator must return an `int`, so `(a, b) -> dist2(a, b0) - dist2(b, b0)` on `long` distances does
not even compile — and the "fix" people reach for is a cast, `(int)(...)`, which narrows a
difference of two values up to `8C²` into 32 bits and can invert the order it was asked to report.
That is the overflow-in-a-comparator bug of [05d](05d-the-three-silent-overflows.md). Write
`Long.compare(dist2(a, b0), dist2(b, b0))`, which is correct for every pair of inputs. In
TypeScript the subtraction is fine for values inside the safe range, but it returns a non-integer
the moment you subtract two *real* distances — legal, and a quiet sign that you rooted values you
did not need to.

**★ `dx * dx` overflows before the coordinates do.** A pair of `int` coordinates near the limit can
be stored happily and still produce a product that wraps. The squares and cross products are the
overflow site, not the inputs — that is the entire subject of
[13g](13g-integer-exactness-and-where-it-ends.md) and it applies to `dist2` as much as to the cross
product.

**★ `Math.pow(x, 2)` is a floating-point operation even when `x` is an integer.** In Java it takes
and returns `double`, so writing `Math.pow(dx, 2) + Math.pow(dy, 2)` throws away the exactness you
were trying to keep and re-introduces a rounding question into an integer computation. Write
`dx * dx`. The same applies to `x ** 2` in TypeScript once the values leave the safe integer range.

**★ Comparing a squared distance to a radius means squaring the radius, and the radius may not be
an integer.** `d² ≤ r²` is exact only if `r` is exact. A delivery radius of `4.5` km squared is
`20.25`, which is representable, but a radius of `0.1` is not representable at all — see
[13k](13k-geometry-in-backend-work.md) for the storefront version of this and the usual fix, which
is to hold the radius in the same integer unit as the coordinates (metres, not kilometres).

**★ `Math.hypot` exists in both languages and this page does not use it.** Its stated purpose is
computing `√(x² + y²)` while avoiding intermediate overflow and underflow, which matters for very
large or very small *floating-point* inputs. ⚠️ Its reference documentation was not fetched for
this page, so nothing about its accuracy or cost is asserted here. For integer interview
coordinates it solves a problem you do not have, and it is a square root, so the squared-distance
habit still applies first.

**★ Duplicate points break more algorithms than degenerate ones.** A closest-pair routine returns
zero, a convex hull can loop, an angular sort has no defined order. Decide early whether duplicates
are possible, and if the problem does not say, ask. Deduplication is one `Set` of stringified pairs
in TypeScript, or a `Set<Pt>` in Java given that `Pt` is a record with value equality.

## Interview questions

**★ Why do you compare squared distances instead of distances?**
Because `√` is strictly increasing on the non-negative reals, so it preserves order: `u < v` if and
only if `√u < √v`. Any question about which distance is smaller therefore has the same answer in
squared space. Two things are gained. First, exactness: for integer coordinates the squared
distance is an integer, so comparisons and equality tests are exact facts rather than
floating-point approximations. Second, the root is removed from the inner loop of an algorithm that
may perform it a quadratic number of times. The cost is that the value you are carrying is not a
distance, so if the problem asks for the distance you must root it once at the end — and if the
problem asks for a *sum* of distances you cannot use the trick at all, because roots do not add.

**★ When must you compute the actual distance?**
When the distance is the returned value, when you are summing or averaging distances (a perimeter,
a tour length), or when you must compare it against a quantity that is not itself a squared length.
In every one of those cases the root happens once, on the final value, after all comparisons are
done — never inside a loop that is only ranking things.

**★ What type would you store coordinates in, and why?**
`long` in Java and a plain `number` in TypeScript, with a check that the coordinate bound in the
constraints keeps every product inside the safe range. The reasoning is not about the coordinates,
which usually fit in an `int` comfortably — it is that every primitive multiplies two coordinate
*differences*, so the intermediate is on the order of the coordinate bound squared, times a small
constant. Choosing the type from the intermediate rather than the input is the whole point, and
[13g](13g-integer-exactness-and-where-it-ends.md) does that arithmetic.

**★ The problem gives you `n` points and asks for the `k` closest to the origin. What do you
write?**
A max-heap of size `k` keyed on the squared distance, or `nth_element`-style quickselect on the
squared distance if `k` is large relative to `n` — the same quickselect as
[02f](02f-quickselect.md), on a derived key. The squared distance is the key in both cases and no
square root is ever taken, because the output is the *points*, not the distances. If the problem
did ask for the distances too, root the `k` survivors at the end. Sorting the whole array is `O(n
log n)` and correct, but the heap is `O(n log k)` and the selection is `O(n)` on average, and
naming that trade-off is usually the point of the question.

**★ How do you tell a Manhattan-distance problem from a Euclidean one?**
Read the movement rules. If the entities move on a grid one axis-aligned step at a time, the metric
is Manhattan; if they may move diagonally at the same cost, it is Chebyshev; if they move freely in
the plane, it is Euclidean. Getting this wrong produces a solution that is internally consistent
and answers a different question. It also matters for exactness: Manhattan and Chebyshev involve no
multiplication, so they are exact in integers with far more headroom, and problems that use them
rarely have a precision component at all.

**★ Why is it worth noticing that every primitive uses differences of points?**
Because it makes every predicate translation-invariant, which gives you two things. A free sanity
check — if shifting all inputs by a constant changes your answer, your code is wrong. And a
preprocessing option: if the coordinates are large but the *spread* is small, subtracting the
minimum corner from every point shrinks the magnitudes before any multiplication happens, which can
move a computation back inside an exact integer range.

---

← Prev: [12e · Fast doubling, and not Binet](12e-fast-doubling-and-why-not-binet.md) · Index: [Phase 2 — Recursion, maths and bits](README.md) · Next → [13b · The cross product](13b-the-cross-product.md)
