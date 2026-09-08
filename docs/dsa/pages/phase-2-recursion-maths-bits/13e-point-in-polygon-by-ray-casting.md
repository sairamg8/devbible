---
title: "Ray casting is four lines long and the naive four lines are wrong: a ray that passes exactly through a vertex is counted twice or not at all, and the fix is a half-open rule in y that also disposes of horizontal edges for free"
sidebar_label: "13e · Point in polygon by ray casting"
sidebar_position: 13.4
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-09-08. The Jordan-curve parity argument, the half-open `(a.y > p.y) != (b.y >
> p.y)` edge rule and its case analysis, the exact integer reformulation using the cross product,
> the winding-number variant and the `O(log n)` convex case are **mathematics and standard
> practice**, derived and case-checked on this page rather than cited. **No sandbox run** — the
> case analysis below is an argument, not a test log. Version spine:
> **JDK 25 · MDN as fetched 2026-09-07**.

**Every "is this point inside this shape" question — a map region, a drawn selection, a geofence, a
hit test — reduces to one idea: walk from the point to infinity and count how many times you cross
the boundary. Odd means you started inside.** The idea is a one-liner and the implementation is a
minefield, because the ray you cast will, on the input an interviewer chooses, pass exactly through
a vertex or run along a horizontal edge, and the naive crossing test counts those cases twice, or
zero times, or divides by zero. There is a standard fix that handles all of them without a single
special case, and it is worth knowing exactly why it works rather than copying it.

## The parity argument

The Jordan curve theorem says a simple closed curve divides the plane into an inside and an
outside, and that any path from a point to infinity must cross the boundary an odd number of times
if the point is inside and an even number if it is outside. Crossing the boundary flips which side
you are on; you finish outside; so the parity of the crossings is the answer.

Choose the ray pointing in the `+x` direction — horizontally to the right from `p`. There is
nothing special about that direction; it is chosen because it makes the algebra a comparison in
`y` followed by a comparison in `x`, which is as simple as the algebra gets.

## Why the naive version is wrong

The obvious crossing test for an edge `a–b` is "does the ray's `y` lie between the endpoints' `y`",
written as `min(a.y, b.y) <= p.y && p.y <= max(a.y, b.y)`. Two inputs break it, and both are the
first thing anyone constructs by hand:

**A ray through a vertex is counted twice.** If `p.y` equals the `y` of some vertex `V`, then *both*
edges meeting at `V` satisfy an inclusive range test, so the single point where the ray meets the
boundary contributes two crossings. If the polygon genuinely crosses the ray at `V` — one edge
going up, one going down — the parity is now even and the answer is inverted.

**A horizontal edge at exactly `p.y` is a disaster.** Its two endpoints have the same `y`, so
`b.y − a.y` is zero and the intersection formula divides by zero, producing `Infinity` or `NaN` in
JavaScript and an `ArithmeticException` or a `NaN` in Java depending on the types involved. The
edge also has no single crossing point to speak of — it lies *along* the ray.

Both are the same underlying problem: the inclusive range test double-counts the shared endpoint of
two adjacent edges.

## The half-open rule

Treat each edge as covering the half-open `y` interval `[min, max)` — inclusive at the lower end,
exclusive at the upper. Then every horizontal level belongs to exactly one of the two edges meeting
at a vertex, and the double count disappears. Written as a single boolean:

```
(a.y > p.y) !== (b.y > p.y)
```

That is true exactly when one endpoint is **strictly above** the ray and the other is **at or
below** it. Check the cases, because this is the part to be able to defend:

| Vertex `V` at exactly `p.y`, neighbours `U` and `W` | Edge `U–V` | Edge `V–W` | Crossings | Correct? |
|---|---|---|---|---|
| `U` above, `W` below — boundary genuinely crosses | counts | skipped | 1 | ✅ odd, a real crossing |
| `U` above, `W` above — boundary touches and returns | counts | counts | 2 | ✅ even, a touch is not a crossing |
| `U` below, `W` below — touches from below | skipped | skipped | 0 | ✅ even |
| **Horizontal edge** (`a.y === b.y`) | both comparisons equal | — | 0 | ✅ skipped entirely, no division |
| **Zero-length edge** (repeated vertex) | both comparisons equal | — | 0 | ✅ skipped, harmless |

Four degeneracies, no special cases, one comparison. And because the test guarantees
`a.y !== b.y` whenever it passes, the division in the intersection formula can never be by zero.

## The implementation, twice

The textbook form computes where the edge meets the ray and compares `x`:

```ts
function pointInPolygon(p: Pt, poly: Pt[]): boolean {
  let inside = false;
  const n = poly.length;
  for (let i = 0, j = n - 1; i < n; j = i++) {   // j is the previous index, wrapping
    const a = poly[j], b = poly[i];
    if ((a.y > p.y) !== (b.y > p.y)) {
      const xCross = a.x + ((p.y - a.y) * (b.x - a.x)) / (b.y - a.y);
      if (p.x < xCross) inside = !inside;
    }
  }
  return inside;
}
```

That division is the only inexact operation in the whole topic, and it is avoidable. The
intersection is to the right of `p` exactly when `p` is on a particular side of the directed edge,
and "which side" is the cross product:

```ts
/** Exact for integer coordinates: no division anywhere. */
function pointInPolygonExact(p: Pt, poly: Pt[]): boolean {
  let inside = false;
  const n = poly.length;
  for (let i = 0, j = n - 1; i < n; j = i++) {
    const a = poly[j], b = poly[i];
    if ((a.y > p.y) !== (b.y > p.y)) {
      const c = cross(a, b, p);              // (b−a) × (p−a)
      // Upward edge: crossing is right of p iff p is strictly LEFT of a→b.
      // Downward edge: the sense reverses.
      if ((c > 0) === (b.y > a.y)) inside = !inside;
    }
  }
  return inside;
}
```

```java
static boolean pointInPolygon(Pt p, Pt[] poly) {
    boolean inside = false;
    int n = poly.length;
    for (int i = 0, j = n - 1; i < n; j = i++) {
        Pt a = poly[j], b = poly[i];
        if ((a.y() > p.y()) != (b.y() > p.y())) {
            long c = cross(a, b, p);
            if ((c > 0) == (b.y() > a.y())) inside = !inside;
        }
    }
    return inside;
}
```

The derivation of that sign flip is worth one line: the crossing lies right of `p` when
`(p.x − a.x)·(b.y − a.y) < (p.y − a.y)·(b.x − a.x)`, and the right-hand side minus the left-hand
side is precisely `cross(a, b, p)` — so the condition is `cross > 0`, with the inequality reversing
when `b.y − a.y` is negative, which is what comparing against `b.y > a.y` encodes. Multiplying
through by the denominator instead of dividing by it is the same move that removed the slope in
[13b](13b-the-cross-product.md), and it makes this predicate exact for integer input.

## The boundary is not decided by this algorithm

If `p` lies exactly **on** an edge, ray casting gives an answer, and which answer depends on which
edge and which direction — it is consistent but arbitrary, and the two implementations above can
disagree. That is not a bug to fix inside the loop; it is a specification to settle outside it:

```ts
const pointInPolygonInclusive = (p: Pt, poly: Pt[]): boolean => {
  const n = poly.length;
  for (let i = 0, j = n - 1; i < n; j = i++) {
    if (cross(poly[j], poly[i], p) === 0 && onSegment(poly[j], poly[i], p)) return true;
  }
  return pointInPolygonExact(p, poly);
};
```

That is `O(n)` extra work using the collinear-plus-`onSegment` pair from
[13c](13c-orientation-and-segment-intersection.md), and it makes the boundary rule explicit rather
than emergent. Ask which convention the problem wants; "is a point on the fence inside the
geofence" has a business answer, not a mathematical one.

## Even-odd versus non-zero winding

Parity is the **even-odd** fill rule. The alternative is the **winding number**: instead of
toggling, add `+1` for each upward crossing to the right and `−1` for each downward one; the point
is inside when the total is non-zero.

```ts
let wind = 0;
// inside the same loop, replacing the toggle:
if ((c > 0) === (b.y > a.y)) wind += b.y > a.y ? 1 : -1;
// inside iff wind !== 0
```

The two rules agree on every simple polygon and disagree on self-intersecting ones: the middle of a
pentagram is *outside* by even-odd and *inside* by non-zero winding. Both are legitimate; SVG and
Canvas expose the choice as a fill rule for exactly this reason. Know that the distinction exists
and that the answer changes, and say which one you are implementing.

## The convex special case

If the polygon is known convex and you have many queries against the same polygon, `O(n)` per query
is wasteful. Two better options:

- **`O(n)` with no ray at all:** for a convex polygon with known winding, `p` is inside iff it is on
  the same side of every directed edge — one `orient` call per edge, and an early exit on the first
  disagreement. Simpler than ray casting and easier to get right.
- **`O(log n)` after `O(n)` preprocessing:** fan the polygon from vertex `p₀` into `n − 2` wedges.
  Binary search for the wedge containing `p` by orientation against `p₀→pᵢ`, then a single
  orientation test against the far edge of that wedge decides. This is the standard answer to
  "10⁵ queries against one convex polygon", and it is only correct for convex input.

For many queries against a *non-convex* polygon, the answer is an index rather than a cleverer
predicate — a uniform grid, a quadtree, or a trapezoidal decomposition, each of which reduces the
number of edges any query must examine. [13k](13k-geometry-in-backend-work.md) is where that shows
up in practice.

## Gotchas

**★ `for (let i = 0, j = n − 1; i < n; j = i++)` is the idiom, and it is easy to mistype.** It pairs
each vertex with its predecessor and wraps on the first iteration, so every edge including the
closing one is visited exactly once. Writing `j = i - 1` without the wrap silently drops the
closing edge, which changes the answer for points whose ray crosses only that edge.

**★ Do not "fix" degeneracies by nudging the ray.** Perturbing `p.y` by a small epsilon, or casting
at a random angle, converts a deterministic wrong answer into a non-deterministic one and makes the
bug unreproducible. The half-open rule removes the degeneracy exactly; a nudge hides it.

**★ An epsilon in the `y` comparison breaks the parity invariant.** The half-open rule works because
`>` is a total, transitive, exact comparison, so every vertex belongs to exactly one of its two
edges. Replace it with `a.y > p.y + EPS` and a vertex can belong to both or neither, and the double
count is back — with the added charm of depending on the epsilon.
[13f](13f-floating-point-and-the-epsilon-decision.md) explains why that is a general phenomenon and
not a quirk of this algorithm.

**★ The strict `p.x < xCross` decides which side the ray points.** Using `<=` counts a point lying
exactly on a vertical-crossing boundary as a crossing, which changes the boundary convention. If
you want a boundary convention, set it explicitly with the inclusive wrapper above rather than by
adjusting a comparison here.

**★ A repeated closing vertex is harmless here and harmful elsewhere.** The half-open test skips
zero-length edges automatically. Convexity testing and hull construction do not — normalise the
input once, at the top, and every downstream algorithm gets the same shape.

**★ The winding-number and even-odd versions can be off by a sign under screen coordinates.** The
parity version is immune, because flipping `y` reverses which edges are "upward" but not how many
crossings there are. The winding version reports the negated winding number, so test `!== 0`
rather than `> 0`.

**★ This is `O(n)` per query, and people forget the `q` in `O(n·q)`.** With 10⁵ query points and a
10⁵-vertex polygon it is 10¹⁰ operations. If the problem gives you many queries, the intended
solution is not this loop, and saying so is more valuable than writing the loop faster.

## Interview questions

**★ How do you test whether a point is inside a polygon?**
Cast a ray from the point — conventionally straight along `+x` — and count how many polygon edges it
crosses; odd means inside, by the Jordan curve theorem, since each crossing flips inside/outside
and the ray ends outside. For each edge I test whether exactly one endpoint is strictly above the
ray's `y` using `(a.y > p.y) !== (b.y > p.y)`, which is a half-open rule in `y`, and if so I check
whether the crossing is to the right of the point using the sign of the cross product rather than
computing the crossing's `x`. That keeps everything in exact integers and handles vertices and
horizontal edges without a special case.

**★ What happens when the ray passes exactly through a vertex, and how do you fix it?**
With an inclusive range test the vertex is counted once for each of the two edges meeting there, so
a genuine crossing registers as two and the parity inverts. The fix is to make each edge half-open
in `y` — inclusive at its lower endpoint, exclusive at its upper — which is what the strict `>` on
both sides of the inequality achieves. Then a vertex belongs to exactly one of its two edges: if
the boundary really crosses the ray there, the count is one; if it touches the ray and turns back,
the count is two, which is even and correctly says "not a crossing". The same rule skips horizontal
edges entirely, since both endpoints compare equal, which also guarantees the denominator in the
intersection formula is non-zero.

**★ What does your function return for a point exactly on the boundary?**
Something consistent but arbitrary, which is why I would not rely on it. If the boundary matters, I
test it explicitly first: for each edge, a zero cross product plus a bounding-box containment check
proves the point lies on that edge, and I return the convention the problem asks for. The question
"does a point on the edge count as inside" is a specification question, and the right move is to
ask it rather than to inherit whichever answer the loop happens to produce.

**★ Even-odd or non-zero winding — which does your code implement, and when does it matter?**
The parity version implements even-odd. It matters only for self-intersecting polygons, where the
two rules genuinely disagree: the centre of a pentagram is outside under even-odd and inside under
non-zero winding. The winding version is the same loop with a signed counter instead of a toggle,
incrementing on upward crossings and decrementing on downward ones. For a simple polygon the two
always agree.

**★ One convex polygon, a million query points. What changes?**
Preprocess. For a convex polygon I fan it from one vertex into wedges and binary search each query
by orientation to find its wedge, then one more orientation test against that wedge's outer edge
decides — `O(log n)` per query after `O(n)` setup, or `O(n log n)` if the vertices need sorting into
convex order first. For a non-convex polygon there is no such structure, so the answer is a spatial
index: bucket the edges into a uniform grid or a quadtree so each query only tests the edges near
its own ray, and fall back to the linear scan inside the bucket.

**★ Why is the cross-product form preferable to computing the crossing's x coordinate?**
Because computing the crossing divides, and division takes exact integer input out of the integers.
The comparison `p.x < xCross` is equivalent to a comparison between two products — multiply both
sides by the denominator, reversing the inequality when the denominator is negative — and that
difference of products is exactly the cross product of the edge with the query point. Same
predicate, no division, exact for integer input, and no possibility of a `NaN` reaching the
comparison.

{/* FOOTER */}
