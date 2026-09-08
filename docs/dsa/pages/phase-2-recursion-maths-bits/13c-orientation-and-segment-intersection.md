---
title: "Segment intersection is four orientation tests plus one branch almost everybody forgets — the collinear case, where a zero cross product proves the points share a line and says nothing at all about whether they overlap"
sidebar_label: "13c · Orientation and segment intersection"
sidebar_position: 13.2
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-09-08. The straddle argument, the four-orientation test, the on-segment predicate
> and the parametric intersection point are **mathematics and standard practice**, derived here
> rather than cited. The overflow warning about multiplying two cross products rests on the
> `Integer.MAX_VALUE` / `MIN_VALUE` constants quoted from the JDK 25
> [`Integer`](https://docs.oracle.com/en/java/javase/25/docs/api/java.base/java/lang/Integer.html)
> javadoc on [05c](05c-javas-int-and-the-checked-arithmetic.md) and on
> [13g](13g-integer-exactness-and-where-it-ends.md). **No sandbox run** — no code below has been
> executed. Version spine: **JDK 25 · MDN as fetched 2026-09-07**.

**"Do these two line segments intersect" is the most frequently asked geometry question that is not
about a polygon, and the version most people write is correct on random input and wrong on every
case an interviewer will hand-craft.** The core is four calls to the orientation predicate from
[13b](13b-the-cross-product.md), and that part is easy. The part that decides the answer is what
happens when one of those four returns zero — when a point lies exactly on the other segment's
line. A zero says the three points are collinear. It does not say they overlap, and the four-line
branch that resolves the difference is the entire content of this page.

## First: which side of a line is a point on?

This is the sign reading of the cross product with a name attached. Given a **directed** line
through `a` then `b`, and a query point `p`:

```ts
const side = (a: Pt, b: Pt, p: Pt): -1 | 0 | 1 => orient(a, b, p);
// +1 : p is strictly left of the ray a→b
//  0 : p is on the infinite line through a and b
// -1 : p is strictly right of it
```

Three things worth noticing before moving on.

**The line is infinite.** `side` knows nothing about the segment `a`–`b`; it partitions the whole
plane into two open half-planes and the line between them. Half of the mistakes on this page come
from forgetting that.

**The distance from `p` to the line is `|cross(a, b, p)| / |b − a|`** — the parallelogram area
divided by its base. You rarely want it. If you are comparing several points' distances *to the
same line*, the denominator is a positive constant, so `|cross|` alone ranks them correctly and the
division never has to happen. If you are comparing distances to *different* lines, compare
`cross² · len2(other)` against `otherCross² · len2(this)` — cross-multiplied, still exact,
still no division. Only convert to a real distance when it is the output.

**Convexity, hull and point-in-polygon are all this predicate iterated.** "All points on the same
side of every edge" is convexity; "pop while the turn is not left" is the hull; "count sign changes
along a ray" is point-in-polygon.

## The straddle argument

Two segments `p1–p2` and `p3–p4` cross in general position exactly when **each segment straddles
the other's line**. Compute four orientations:

```
d1 = orient(p1, p2, p3)      // where is p3 relative to line p1→p2?
d2 = orient(p1, p2, p4)      // where is p4 relative to line p1→p2?
d3 = orient(p3, p4, p1)      // where is p1 relative to line p3→p4?
d4 = orient(p3, p4, p2)      // where is p2 relative to line p3→p4?
```

If `d1` and `d2` have **opposite non-zero signs**, the endpoints of the second segment sit on
opposite sides of the first segment's line, so the second segment crosses that line somewhere. If
`d3` and `d4` also have opposite non-zero signs, the first segment crosses the second's line. Both
conditions together force the two crossing points to be the same point, which is the intersection.

**Why both tests are needed** is the question to be ready for: one straddle is not enough. Take a
long segment `p1–p2` and a short segment `p3–p4` that sits well beyond `p2` but is oriented so that
its two endpoints fall on opposite sides of the *infinite line* through `p1` and `p2`. Then `d1` and
`d2` have opposite signs and the first test passes — but the crossing happens off the end of
`p1–p2`, and the second test catches exactly that, because `p1` and `p2` are then both on the same
side of the line through `p3–p4`.

## The collinear branch, which is the actual content

When any `d` is zero, the straddle test says nothing useful, and the answer depends on **position
along the line**, which the cross product cannot see. The extra predicate is: *given that `p` is
known collinear with `a` and `b`, does `p` lie within the segment?*

```ts
/** Assumes cross(a, b, p) === 0. Bounding-box containment is then exactly betweenness. */
const onSegment = (a: Pt, b: Pt, p: Pt): boolean =>
  Math.min(a.x, b.x) <= p.x && p.x <= Math.max(a.x, b.x) &&
  Math.min(a.y, b.y) <= p.y && p.y <= Math.max(a.y, b.y);
```

```java
/** Assumes cross(a, b, p) == 0. */
static boolean onSegment(Pt a, Pt b, Pt p) {
    return Math.min(a.x(), b.x()) <= p.x() && p.x() <= Math.max(a.x(), b.x())
        && Math.min(a.y(), b.y()) <= p.y() && p.y() <= Math.max(a.y(), b.y());
}
```

The precondition matters. A bounding-box test *alone* is not an on-segment test — plenty of points
inside the box are off the line. It is only because collinearity has already been established that
the box degenerates to the segment. The alternative formulation, `dot(p, a, b) <= 0` (the vectors
from `p` to each endpoint point in opposite directions), is equivalent under the same precondition
and costs one multiplication instead of four comparisons; the box version is easier to defend out
loud, which is why it is written above.

## The whole predicate

```ts
function segmentsIntersect(p1: Pt, p2: Pt, p3: Pt, p4: Pt): boolean {
  const d1 = orient(p1, p2, p3);
  const d2 = orient(p1, p2, p4);
  const d3 = orient(p3, p4, p1);
  const d4 = orient(p3, p4, p2);

  // General case: each segment straddles the other's line.
  if (d1 !== d2 && d3 !== d4 && d1 !== 0 && d2 !== 0 && d3 !== 0 && d4 !== 0) return true;

  // Collinear / touching cases — one endpoint lying on the other segment.
  if (d1 === 0 && onSegment(p1, p2, p3)) return true;
  if (d2 === 0 && onSegment(p1, p2, p4)) return true;
  if (d3 === 0 && onSegment(p3, p4, p1)) return true;
  if (d4 === 0 && onSegment(p3, p4, p2)) return true;

  return false;
}
```

```java
static boolean segmentsIntersect(Pt p1, Pt p2, Pt p3, Pt p4) {
    int d1 = orient(p1, p2, p3), d2 = orient(p1, p2, p4);
    int d3 = orient(p3, p4, p1), d4 = orient(p3, p4, p2);

    if (d1 != d2 && d3 != d4 && d1 != 0 && d2 != 0 && d3 != 0 && d4 != 0) return true;

    if (d1 == 0 && onSegment(p1, p2, p3)) return true;
    if (d2 == 0 && onSegment(p1, p2, p4)) return true;
    if (d3 == 0 && onSegment(p3, p4, p1)) return true;
    if (d4 == 0 && onSegment(p3, p4, p2)) return true;

    return false;
}
```

Four properties of that code are worth stating explicitly, because each is a case an interviewer
can construct in one line of input.

**Overlapping collinear segments are handled.** If the two segments lie on the same line and share
any stretch, at least one endpoint of one lies inside the other, so one of the four collinear
branches fires. If they lie on the same line and are disjoint, all four `onSegment` calls fail and
the answer is correctly `false`.

**Touching at a single endpoint returns `true`.** That is a decision, not a fact — see the gotchas.

**A zero-length segment works.** If `p1 === p2` the "segment" is a point, `d1` and `d2` are both
zero because the cross product of a zero vector is zero, and the third and fourth branches ask
whether that point lies on `p3–p4`. Both segments degenerate to points reduces to an equality test,
which the first collinear branch performs via the bounding box.

**Nothing is divided and nothing is rooted.** Every value in that function is an exact integer for
integer input, so the result is a proof, not an estimate.

## When you need the intersection point itself

Parametrise the first segment as `p1 + t·(p2 − p1)` for `t` in `[0, 1]`. Substituting into the
second segment's line equation and solving gives

```
denom = cross(p2 − p1, p4 − p3)
t     = cross(p3 − p1, p4 − p3) / denom
```

with `denom === 0` meaning the segments are parallel — collinear if the numerator is zero too,
strictly parallel and non-intersecting otherwise. Both numerator and denominator are exact
integers, so the honest representation of the answer is **the fraction `numerator / denominator`,
reduced by their `gcd`** ([03b](03b-gcd-on-signed-and-wide-types.md)). Evaluating it as a double is
where the exactness of the whole page ends, and it is unavoidable if the required output is a
coordinate pair. Say that out loud when it happens: "the predicate is exact, the point is not, and
here is the fraction if you want it exact."

## Gotchas

**★ `d1 * d2 < 0` is a natural way to write "opposite signs" and it can overflow.** If you skip the
`orient` wrapper and multiply two raw cross products, you are multiplying two values that are each
already on the order of the coordinate bound squared — so the product is on the order of the bound
to the fourth power, which leaves the `long` range for coordinates that were comfortably safe.
Compare signs, never multiply them: `d1 != d2` on normalised `-1/0/+1` values, or
`(d1 > 0) != (d2 > 0)` after excluding zero.

**★ Omitting the collinear branch passes every random test.** Two segments with random real
coordinates are collinear with probability zero, so a generated test suite will never catch the
missing branch, and the interviewer's example — two segments sharing an endpoint, or one lying
along the other — catches it immediately. This is the single highest-value line of code on the
page.

**★ "Touching counts as intersecting" is a specification question, and you should ask it.** The
code above returns `true` when segments share an endpoint or when one endpoint grazes the other
segment. For *proper* intersection — crossing at an interior point of both — drop all four
collinear branches and require all four orientations to be non-zero. Polygon-simplicity checks
usually want the proper version for adjacent edges (which always share an endpoint) and the
inclusive version for everything else, and that distinction is exactly where a "is this polygon
simple" implementation goes wrong.

**★ A bounding-box test without the collinearity precondition is wrong.** `onSegment` is only valid
after a zero cross product has been established. Called on an arbitrary point it accepts everything
inside the rectangle spanned by `a` and `b`, which for a diagonal segment is most of the
neighbourhood.

**★ Using `<` instead of `<=` in `onSegment` silently excludes the endpoints.** Which then breaks
the shared-endpoint case that the branch exists to catch. Both comparisons in each pair are
inclusive.

**★ In JavaScript, `orient` must not return the raw cross product if callers compare it with
`!==`.** `d1 !== d2` on raw values is asking whether two areas are equal, not whether two turns
agree. Normalise to `-1 / 0 / 1` at the boundary — that is what the `orient` wrapper in
[13b](13b-the-cross-product.md) is for — or write the comparisons as sign tests.

**★ Floating-point coordinates make this predicate a coin flip on exactly the cases it exists to
decide.** Every branch here is keyed on `d === 0`, and an exact zero is the least likely outcome of
a floating-point subtraction of two nearly equal products.
[13f](13f-floating-point-and-the-epsilon-decision.md) is what to do when the input leaves you no
choice.

**★ Reusing this for rays or infinite lines needs different code, not a bigger constant.** A
common improvisation is to extend the segment endpoints "far enough" and reuse the segment test.
That multiplies the coordinate magnitudes, which multiplies the cross products quadratically, and
walks straight into the overflow of [13g](13g-integer-exactness-and-where-it-ends.md). For a ray,
drop the `t ≤ 1` half of the parameter check; for a line, drop both.

## Interview questions

**★ Walk me through testing whether two segments intersect.**
Compute four orientations: each endpoint of the second segment against the first segment's directed
line, and each endpoint of the first against the second's. If both pairs have opposite non-zero
signs, each segment straddles the other's line, and the crossings must coincide, so they intersect
— that is the general case. If any orientation is zero, the corresponding point is collinear with
the other segment, and I check whether it lies *within* that segment using a bounding-box
containment test, which is valid only because collinearity is already established. If none of those
fire, they do not intersect. Everything is integer arithmetic; no slopes, no divisions, no epsilon.

**★ Why are two straddle tests required rather than one?**
Because one test only proves that a segment crosses the other's infinite *line*, and the crossing
may be off the end of the other segment. The symmetric test rules that out. A concrete failure: a
short segment sitting past the far end of a long one, tilted so its endpoints fall either side of
the long segment's line — the first test passes, the segments do not meet, and the second test is
what reports it.

**★ Two collinear segments overlap along a stretch. Does your code return true, and why?**
Yes. If they overlap, at least one endpoint of one segment lies inside the other — there is no way
to have a shared stretch otherwise — so one of the four collinear branches finds it. And if they
are collinear but disjoint, all four containment tests fail and the result is false, which is also
right. The collinear branches are what make both of those cases correct; the straddle test alone
returns false for every collinear input, because a zero can never have an "opposite sign".

**★ The problem says segments touching only at an endpoint do not count. What changes?**
Remove the four collinear branches entirely and require all four orientations to be non-zero
alongside the two opposite-sign conditions. That is the *proper* intersection predicate: the
crossing must be interior to both segments. Be explicit that this now returns false for
fully-overlapping collinear segments too, which is usually not what anybody wants, so if the
specification is "no endpoint touching but overlap does count" you keep the collinear branches and
exclude only the cases where the intersection is a shared endpoint.

**★ How would you check whether a polygon is simple — that no two of its edges cross?**
The direct answer is all pairs of edges, `O(n²)` intersection tests, skipping the pairs that are
adjacent in the cycle since they legitimately share an endpoint — and skipping the first-and-last
pair, which people forget. The better answer is the Bentley–Ottmann sweep line, which reports
whether any pair intersects in `O(n log n)` by keeping the edges ordered by `y` in a balanced
structure along a sweep in `x` and only ever testing neighbours in that order.
[13i](13i-convex-hull-and-the-sweep-line.md) covers the sweep as a technique. In an interview,
state the `O(n²)` version, note the sweep exists, and implement the one you can get right.

**★ How do you return the intersection point exactly?**
You cannot, in general, in integers — the intersection of two segments with integer endpoints has
rational coordinates. What you can do is return them as reduced fractions: the parametric solution
gives `t = cross(p3 − p1, p4 − p3) / cross(p2 − p1, p4 − p3)`, both parts exact integers, and the
coordinates follow as `p1 + t·(p2 − p1)`. Reduce each fraction by its `gcd`. If the caller wants
doubles, convert at the boundary and say that this is the point where the computation stops being
exact.

---

← Prev: [13b · The cross product](13b-the-cross-product.md) · Index: [Phase 2 — Recursion, maths and bits](README.md) · Next → [13d · Shoelace area and convexity](13d-shoelace-area-and-convexity.md)
