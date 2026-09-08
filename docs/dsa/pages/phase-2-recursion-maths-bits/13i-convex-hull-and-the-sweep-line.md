---
title: "Andrew's monotone chain is a sort plus a stack that pops while the turn is wrong, which makes the convex hull the orientation predicate's flagship application — and makes it the simplest instance of the sweep line, the pattern the harder plane problems are all built from"
sidebar_label: "13i · Convex hull and the sweep line"
sidebar_position: 13.8
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-09-08. Andrew's monotone chain, the amortised argument for its linear scan, the
> comparison with Graham scan and Jarvis march, rotating calipers and the sweep-line pattern are
> **standard algorithms and mathematics**, derived or argued on this page rather than cited; the
> amortised accounting is the method of
> [Phase 1 · Amortised analysis](../phase-1-complexity/03-amortised-analysis.md). The default
> string sort is quoted from MDN
> [`Array.prototype.sort`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/sort).
> ⚠️ Bentley–Ottmann is **named** as the sweep-line algorithm for segment intersection; no detail of
> it is asserted here. **No sandbox run** — no code below has been executed. Version spine:
> **JDK 25 · MDN as fetched 2026-09-07**.

**The convex hull is the smallest convex polygon containing every input point, and the reason it
appears in interviews as often as it does is that it exercises three things at once: a sort with a
correct comparator, the orientation predicate driven in a loop, and an amortised bound that is not
the obvious one.** Andrew's monotone chain is the version to know. It replaces the angular sort
that Graham scan needs with a lexicographic sort on coordinates, which removes both the pivot
choice and the trigonometry, and it is short enough to write from memory once you have understood
why the stack only ever needs its top two entries.

## Andrew's monotone chain

```ts
/** Counter-clockwise hull. Collinear points are DROPPED — see the note below. */
function convexHull(points: Pt[]): Pt[] {
  const p = [...points].sort((a, b) => a.x - b.x || a.y - b.y);
  if (p.length < 3) return p;

  const build = (pts: Pt[]): Pt[] => {
    const h: Pt[] = [];
    for (const q of pts) {
      while (h.length >= 2 && cross(h[h.length - 2], h[h.length - 1], q) <= 0) h.pop();
      h.push(q);
    }
    h.pop();                       // drop the last point: it starts the other chain
    return h;
  };

  const lower = build(p);
  const upper = build([...p].reverse());
  return [...lower, ...upper];
}
```

```java
static List<Pt> convexHull(List<Pt> points) {
    List<Pt> p = new ArrayList<>(points);
    p.sort(Comparator.comparingLong(Pt::x).thenComparingLong(Pt::y));
    if (p.size() < 3) return p;

    List<Pt> lower = build(p);
    Collections.reverse(p);
    List<Pt> upper = build(p);
    lower.addAll(upper);
    return lower;
}

private static List<Pt> build(List<Pt> pts) {
    List<Pt> h = new ArrayList<>();
    for (Pt q : pts) {
        while (h.size() >= 2 && cross(h.get(h.size() - 2), h.get(h.size() - 1), q) <= 0)
            h.remove(h.size() - 1);
        h.add(q);
    }
    h.remove(h.size() - 1);
    return h;
}
```

**Why it works.** Sorting by `x`, breaking ties by `y`, means the points arrive in a monotone order,
so the lower boundary of the hull can be grown as a stack. When a new point `q` arrives, the only
question is whether the current top of the stack is still on the hull: if `q` makes the last three
points turn the wrong way, the middle one is inside the triangle formed by its neighbours and `q`,
so it cannot be a hull vertex — pop it and re-ask. Running the identical procedure over the
reversed order builds the upper boundary. Each chain ends at the point where the other begins, so
one point is dropped from each before concatenation.

**Complexity is `O(n log n)`, entirely in the sort.** The scan looks like it could be quadratic
because one iteration can pop many points, but each point is pushed exactly once and popped at most
once, so the total pops across the whole loop are bounded by `n`. That is the accounting argument
of [Phase 1 · Amortised analysis](../phase-1-complexity/03-amortised-analysis.md) — the expensive
iterations are paid for by the cheap ones that pushed the points they remove.

**The `<=` versus `<` decision.** With `<= 0` the pop also fires on collinear triples, so points
lying *on* a hull edge are removed and the output is the minimal, strictly convex vertex set. With
`< 0` they are kept. Neither is more correct: "which trees end up on the fence" wants every
boundary point, "the convex hull polygon" usually wants the minimal set. Decide, and say which.

**The output winding** with the code above is counter-clockwise under the `y`-up convention. Rather
than trusting that from memory, verify it: run [13d](13d-shoelace-area-and-convexity.md)'s shoelace
over the result and read the sign. One line, and it settles the question for whichever convention
your input actually uses.

## The other hull algorithms, and when they win

| Algorithm | Bound | Reach for it when |
|---|---|---|
| **Monotone chain** | `O(n log n)` | default; no pivot, no angles, exact integer comparisons |
| **Graham scan** | `O(n log n)` | you already have the points sorted by angle; needs a pivot and careful collinear tie-breaking |
| **Jarvis march** (gift wrapping) | `O(n·h)`, `h` = hull size | `h` is tiny relative to `n` — a few hull vertices among a million points |
| **Quickhull** | `O(n log n)` average, `O(n²)` worst | rarely the interview answer; mentioned so you recognise the name |

Jarvis march is worth being able to describe in one sentence — start at the leftmost point and
repeatedly pick the point that is most counter-clockwise from the current one — because it is the
answer to "what if `h` is 3 and `n` is 10⁶", and because it is `O(n·h)` rather than `O(n log n)`,
which is *better* in that regime.

Two follow-ups come up often enough to name. The **diameter** of a point set — the farthest pair —
lies on the hull, and rotating calipers walks two antipodal pointers around it in `O(n)` after the
hull is built. The **minimum-area enclosing rectangle** always has a side flush with a hull edge,
which turns a search over angles into a scan over hull edges.

## The sweep line, as the general shape

Monotone chain is already a sweep: it processes points in `x` order and maintains a structure — the
stack — describing the part of the answer the sweep has passed. The general pattern is:

1. Turn the geometry into **events** — a point, a segment endpoint, a rectangle's left and right
   edge — and sort them along one axis.
2. Sweep an imaginary vertical line across, processing events in that order.
3. Maintain a **status structure** holding the objects the line currently intersects, ordered along
   the *other* axis.
4. Exploit the fact that only **neighbours in the status structure** can interact, so each event
   costs `O(log n)` instead of `O(n)`.

That pattern covers: detecting whether any two of `n` segments intersect (Bentley–Ottmann); the
area of a union of rectangles; the skyline problem; interval overlap and meeting-room counting; and
the closest pair variant in [13h](13h-closest-pair-of-points.md). The implementations differ mainly
in what the status structure is and what an event does to it, so recognising the shape is worth
more than memorising any one of them — which is exactly what a **Know**-tier page is for.

🔴 **The bug in every sweep is the tie-break at equal coordinates.** When two events share an `x`,
the order in which they are processed decides whether touching objects count as overlapping.
Closing before opening treats touching as disjoint; opening before closing treats it as
overlapping. Both are implementable, only one matches the specification, and the specification is
usually silent — so ask, and write the chosen rule into the comparator rather than leaving it to
the sort's tie-breaking.

## Gotchas

**★ `points.sort()` without a comparator is the default string sort.** MDN:

> *"If `compareFn` is not supplied, all non-`undefined` array elements are sorted by converting them to strings and comparing strings in UTF-16 code units order."*

The hull's very first line is a sort, so this is where that bug lands. A `[x, y]` pair stringifies
and sorts lexicographically, which puts `[10, 0]` before `[9, 0]` and produces a "hull" that is not
one.

**★ `a.x - b.x || a.y - b.y` is correct, and it is worth knowing why.** If the `x` difference is
`0` the expression is falsy and the `y` comparison runs. It is also correct when the difference is
`-0`, because `-0` is falsy too. That is an accident of JavaScript's truthiness that happens to
align with what you want; the same idiom in a comparator whose first term can return `NaN` does not
have that property.

**★ Duplicate points break the hull.** Two identical points give a zero-length edge whose cross
product is zero, so whether the loop makes progress depends on the `<=` versus `<` choice.
Deduplicate before sorting — one pass, and it removes an entire class of degenerate behaviour.

**★ All points collinear is the degenerate case both variants get wrong differently.** With `<= 0`
the hull collapses towards its two extremes and the chain-endpoint bookkeeping may return them
twice or lose one; with `< 0` every point appears in both chains. Detect it — the hull comes back
with fewer than three distinct points — and return the segment explicitly, with a stated
convention.

**★ Forgetting `h.pop()` at the end of each chain duplicates two vertices.** The polygon still plots
correctly and has two zero-length edges, which then breaks every downstream algorithm that assumes
distinct consecutive vertices: convexity checks, area, and point-in-polygon among them.

**★ The `h.length >= 2` guard is not optional, and TypeScript fails silently without it.** Indexing
`h[-1]` gives `undefined`, arithmetic on it gives `NaN`, and `NaN <= 0` is `false` — so the loop
does not pop, does not throw, and quietly builds a wrong hull. Java throws
`IndexOutOfBoundsException` instead, which is the friendlier failure.

**★ Cross products in the hull loop overflow on the usual schedule.** The pop condition is the
orientation predicate, so the coordinate bounds of
[13g](13g-integer-exactness-and-where-it-ends.md) apply verbatim. In Java, the sort comparator is
the other overflow site: `(a, b) -> (int)(a.x() - b.x())` narrows a `long` difference and can invert
the order. Use `Comparator.comparingLong`.

**★ A hull built with a floating-point orientation test can fail to be convex.** This is the
concrete cost of [13f](13f-floating-point-and-the-epsilon-decision.md): an epsilon that misclassifies
a small genuine turn pops a real vertex, and one that misclassifies a collinear triple keeps a
non-extreme one. Because the predicate is not consistent across argument orders, a loop that
re-checks after popping can also fail to terminate.

**★ Building a hull of an already-convex polygon is `O(n)`, not `O(n log n)`.** If the input is a
polygon whose vertices are already in convex order, the sort is unnecessary. Recognising that the
input is ordered rather than a point cloud is worth a log factor and is a common variant.

## Interview questions

**★ Compute the convex hull. Which algorithm, and why that one?**
Andrew's monotone chain. Sort the points by `x` then `y`, then sweep once building the lower hull as
a stack — pop while the last three points fail to turn left, then push — and sweep the reversed
order to build the upper hull. It is `O(n log n)` dominated by the sort, and the scan is amortised
linear because every point is pushed once and popped at most once. I prefer it to Graham scan
because it avoids the angular sort around a pivot, which needs a well-chosen pivot and careful
handling of collinear points; monotone chain's only ordering decision is a lexicographic comparison
of coordinates, which is exact for integer input.

**★ Why is the scan linear when a single iteration can pop many points?**
Amortised accounting. Each point enters the stack exactly once, and each pop removes a point that
was pushed earlier and never returns. So the total number of pops over the entire loop is bounded
by the number of pushes, which is `n`. An individual iteration can be expensive, but the expensive
iterations are paid for by the pushes that preceded them, and the total work across the loop is
linear.

**★ Should collinear points on a hull edge be included?**
That is a specification decision encoded in one character. Popping while the cross product is
`<= 0` removes them and yields the minimal set of hull vertices; popping only while it is `< 0`
keeps them. Problems phrased as "which of these trees are on the fence" want them; problems phrased
as "return the convex hull polygon" usually do not. I ask, and if there is no answer, I state which
I implemented and why.

**★ A million points and you expect the hull to have about ten vertices. What changes?**
Jarvis march becomes attractive. It is `O(n·h)` where `h` is the hull size, so with `h ≈ 10` it is
about ten linear passes — roughly `10⁷` operations, with no sort at all — against `O(n log n)` for
monotone chain, which is about `2 × 10⁷` plus the sort's constant and memory traffic. The trade
reverses as soon as `h` grows past `log n`, and the worst case for Jarvis is every point on the
hull, which is quadratic. Naming the crossover is the answer; picking the algorithm without naming
it is not.

**★ What is a sweep line and when do you reach for one?**
It is a pattern rather than an algorithm: convert the objects into events sorted along one axis,
move a line across them, and maintain a structure holding what the line currently intersects,
ordered along the other axis, so only adjacent items in that structure can interact. I reach for it
when a problem asks about relationships among many objects in the plane — do any of these segments
intersect, what is the area of the union of these rectangles, what is the skyline, how many
intervals overlap — because it converts an all-pairs question into a neighbours-only question and
takes `O(n²)` to `O(n log n)`. The detail I would raise unprompted is the tie-break rule when two
events share a coordinate, because that is where "does touching count" gets decided.

**★ How is the convex hull itself a sweep line?**
The points are the events, sorted by `x`; the stack is the status structure; and the invariant is
that the stack always holds the hull of everything the sweep has passed. The pop-while-wrong-turn
step is the event handler restoring that invariant. Seeing it that way is what makes the rectangle
union, the skyline and segment-intersection problems feel like the same problem rather than three
new ones.

**★ What is the convex hull actually used for, once you have it?**
Three things, mostly. It is the smallest convex container, so it answers "which points are extreme"
— the corners of a scatter, the outline of a shape, the boundary of a reachable region. It reduces
later work: the farthest pair, the smallest enclosing rectangle and the smallest enclosing circle
all have their answers on the hull, so an `O(n log n)` hull turns an `O(n²)` search into an
`O(h)` or `O(h log h)` one. And it is a cheap conservative bound in collision and culling — if two
hulls do not intersect, neither do the shapes inside them, which is the same broad-phase idea as a
bounding box but tighter.

**★ How would you maintain a hull under insertions?**
That is the dynamic convex hull problem, and the honest interview answer is to say the batch
algorithm does not extend cleanly: adding one point can delete an arbitrary number of hull vertices,
so a naive rebuild is `O(n log n)` per insertion. The structures that do better keep the upper and
lower hulls in balanced search trees ordered by `x` and splice out the deleted run in logarithmic
time. Unless the question is specifically about that, the practical answer is to rebuild in batches,
or to keep the points sorted so each rebuild is the linear scan without the sort.

{/* FOOTER */}
