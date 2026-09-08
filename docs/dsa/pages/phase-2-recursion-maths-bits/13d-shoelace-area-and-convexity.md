---
title: "The shoelace formula is not a formula to memorise — it is the cross product summed around a closed loop, which is why its absolute value is the area, its sign is the winding direction, and why you must keep it doubled until the last line"
sidebar_label: "13d · Shoelace area and convexity"
sidebar_position: 13.3
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-09-08. The shoelace derivation by signed triangle fan, the proof that the anchor
> point is arbitrary, the winding interpretation of the sign, the centroid formula and the
> observation that the same-sign turn test accepts a pentagram are **mathematics**, derived or
> argued here rather than cited. The Java integer-division warning follows from the language's
> `/` on integral types, which is a language rule stated in prose, not quoted. **No sandbox
> run** — no code below has been executed and no area value is printed. Version spine:
> **JDK 25 · MDN as fetched 2026-09-07**.

**Give a polygon as an ordered list of vertices and two questions follow immediately: how big is it,
and which way round is it. One sum answers both.** The shoelace formula looks like an arbitrary
pattern of cross-multiplied coordinates when it is presented as a formula, and it looks inevitable
when it is derived — it is the cross product of [13b](13b-the-cross-product.md), summed once per
edge, and the two readings of the cross product survive the summation intact. Its magnitude is
twice the area; its sign is the direction of travel. Convexity is then the *same* cross product
read one triple at a time, with one caveat that the standard implementation gets wrong.

## Deriving the shoelace formula

Take any anchor point `O` and any polygon with vertices `p₀, p₁, …, p_{n−1}` in order. Fan
triangles from `O` to every edge: triangle `(O, p₀, p₁)`, then `(O, p₁, p₂)`, and so on round to
`(O, p_{n−1}, p₀)`. Each triangle has a **signed** doubled area `cross(O, pᵢ, pᵢ₊₁)`, positive when
the edge is traversed counter-clockwise as seen from `O` and negative when clockwise.

Sum them:

```
2A = Σ cross(O, pᵢ, pᵢ₊₁)          (indices mod n)
```

For a convex polygon with `O` inside, every triangle is positive and the fan tiles the interior —
the sum is obviously the doubled area. **The reason it also works for a non-convex polygon, and for
an anchor outside it, is the sign.** Where the fan sweeps over region that is not inside the
polygon, it sweeps over that region twice, once with each sign, and the two contributions cancel
exactly. Signed areas make the bookkeeping automatic; that cancellation is the whole trick.

**The anchor is arbitrary**, and that is worth proving because it is what lets you place `O` at the
origin to get the familiar formula, or at `p₀` to keep the numbers small. Replacing `O` by
`O + t` changes each term by a quantity that is linear in `t` by the bilinearity noted in
[13b](13b-the-cross-product.md), and summing that change around a **closed** loop telescopes: every
vertex appears once as the start of an edge and once as the end, with opposite sign, so the total
change is zero.

Put `O` at the origin and expand:

```
cross(O, pᵢ, pᵢ₊₁) = xᵢ·yᵢ₊₁ − xᵢ₊₁·yᵢ

2A = Σ (xᵢ·yᵢ₊₁ − xᵢ₊₁·yᵢ)          A = |2A| / 2
```

The cross-multiplied pattern of that sum — `x₀y₁ − x₁y₀`, `x₁y₂ − x₂y₁`, … — is what the laces of a
shoe look like when you write the coordinates in two columns, which is the whole of the name.

## The code, and the three things it is careful about

```ts
/** Returns TWICE the signed area. Positive = counter-clockwise (y-up convention). */
function shoelace2(poly: Pt[]): number {
  const n = poly.length;
  let sum = 0;
  for (let i = 0; i < n; i++) {
    const a = poly[i], b = poly[(i + 1) % n];   // the % n closes the loop
    sum += a.x * b.y - b.x * a.y;
  }
  return sum;
}

const polygonArea = (poly: Pt[]): number => Math.abs(shoelace2(poly)) / 2;
const isCounterClockwise = (poly: Pt[]): boolean => shoelace2(poly) > 0;
```

```java
/** Returns TWICE the signed area. Positive = counter-clockwise (y-up convention). */
static long shoelace2(Pt[] poly) {
    int n = poly.length;
    long sum = 0;
    for (int i = 0; i < n; i++) {
        Pt a = poly[i], b = poly[(i + 1) % n];
        sum += a.x() * b.y() - b.x() * a.y();
    }
    return sum;
}

static double polygonArea(Pt[] poly) {
    return Math.abs(shoelace2(poly)) / 2.0;   // 2.0, NOT 2 — see the gotchas
}
```

1. **It returns the doubled area.** The halving happens once, in the caller, in floating point —
   because a lattice polygon's area is a half-integer and truncating it is a silent off-by-a-half.
2. **The `% n` closes the loop.** The last edge runs from `p_{n−1}` back to `p₀` and contributes
   like any other. Dropping it loses a whole edge's worth of area, and the result still looks
   plausible.
3. **Nothing is divided or rooted inside the loop**, so for integer vertices the doubled area is an
   exact integer and equality comparisons on it are exact.

If the coordinates are large, anchor at `p₀` instead of the origin — `sum += cross(poly[0],
poly[i], poly[i+1])` for `i` from `1` to `n − 2` — which subtracts the polygon's own position out
of every product and can move the computation back inside a safe integer range. Same answer, by the
anchor-independence proof above.

## Reading the sign: winding

The sign of the shoelace sum is the **winding direction** of the vertex list, under the
mathematical convention that `x` increases to the right and `y` increases upward:

- **positive** → the vertices are listed counter-clockwise;
- **negative** → clockwise;
- **zero** → the polygon has no area: all vertices collinear, or a "polygon" that doubles back on
  itself so the signed regions cancel exactly.

This is more useful than it sounds. Convex-hull output, point-in-polygon conventions, and any
algorithm that assumes "interior is on the left of every edge" all require a known winding, and the
normalisation is one line: compute the sign, and reverse the array if it is negative. It is also
the cheapest way to answer "were these vertices given clockwise?" — one pass, no trigonometry.

🔴 **Under screen coordinates, with `y` increasing downward, every sign on this page inverts**, for
the reflection reason given in [13b](13b-the-cross-product.md). The magnitude is unaffected.

## The centroid, from the same sum

The area centroid of a simple polygon uses the same per-edge cross terms, weighted by the
coordinates:

```
Cx = (1 / (6A)) · Σ (xᵢ + xᵢ₊₁) · (xᵢ·yᵢ₊₁ − xᵢ₊₁·yᵢ)
Cy = (1 / (6A)) · Σ (yᵢ + yᵢ₊₁) · (xᵢ·yᵢ₊₁ − xᵢ₊₁·yᵢ)
```

with `A` the signed area, not the absolute one — the signs must agree between numerator and
denominator or the result is reflected. Note the extra factor of a coordinate inside the sum: the
numerator is on the order of the coordinate bound **cubed**, so this is the first formula on these
pages that overflows a `long` for coordinates a `long` handles comfortably elsewhere. It is also
undefined for a zero-area polygon, which is the degenerate case to guard.

## Convexity

A polygon is convex when every turn goes the same way. Walk the vertices and take the orientation
of each consecutive triple `(pᵢ₋₁, pᵢ, pᵢ₊₁)`; if no positive turn and no negative turn both occur,
the polygon is convex.

```ts
function isConvex(poly: Pt[]): boolean {
  const n = poly.length;
  if (n < 3) return false;                 // a segment or a point is not a polygon
  let sawPositive = false, sawNegative = false;
  for (let i = 0; i < n; i++) {
    const o = orient(poly[i], poly[(i + 1) % n], poly[(i + 2) % n]);
    if (o > 0) sawPositive = true;
    else if (o < 0) sawNegative = true;
    if (sawPositive && sawNegative) return false;
  }
  return true;                             // zeros (collinear vertices) tolerated
}
```

```java
static boolean isConvex(Pt[] poly) {
    int n = poly.length;
    if (n < 3) return false;
    boolean pos = false, neg = false;
    for (int i = 0; i < n; i++) {
        int o = orient(poly[i], poly[(i + 1) % n], poly[(i + 2) % n]);
        if (o > 0) pos = true;
        else if (o < 0) neg = true;
        if (pos && neg) return false;
    }
    return true;
}
```

🔴 **That test is valid only if you already know the polygon is simple** — that no two
non-adjacent edges cross. A pentagram traced as a five-point star turns the same way at every one
of its five vertices and passes this test, and it is emphatically not convex. The rigorous
statement is that the turns must agree *and* the total turning must be exactly one full revolution;
for a simple polygon the second condition is automatic, which is why the short version is usually
correct and why the assumption has to be stated rather than assumed. If the input might be a
self-intersecting vertex list, either check simplicity first
([13c](13c-orientation-and-segment-intersection.md)) or count the turning.

Whether **collinear vertices** — a zero orientation, three points in a row on one straight edge —
make a polygon non-convex is a definitional choice, not a mathematical one. The code above tolerates
them. If the problem wants strict convexity, treat a zero as a failure. Ask; do not guess.

## Gotchas

**★ In Java, `Math.abs(shoelace2(poly)) / 2` truncates.** Both operands are integral, so `/` is
integer division, and every polygon whose doubled area is odd loses exactly one half of a unit,
silently, with no warning and a plausible answer. Write `/ 2.0`, or better, return the doubled area
and let the caller decide. The same expression in TypeScript is fine because `/` is always
floating-point division — which is its own trap when you move code the other way.
[05f](05f-the-cross-language-trap.md) is the general form of this.

**★ Forgetting the closing edge loses area, quietly.** `for (i = 0; i < n − 1; i++)` with no wrap
computes the area of an open path, which is not a thing, and returns a number close enough to the
right one to pass a small test. The `% n` — or an explicit final term — is not optional.

**★ A repeated last vertex is the most common malformed input.** Many data sources (GeoJSON among
them) close a ring by repeating the first vertex at the end. Shoelace survives it: the duplicated
edge has zero length and contributes zero. **Convexity does not** — the zero-length edge makes an
orientation triple degenerate, so a real turn can be reported as collinear. A naive ray-casting
test that divides by `b.y − a.y` divides by zero on it, though the half-open form in
[13e](13e-point-in-polygon-by-ray-casting.md) skips it safely. Normalise on input: if the last
vertex equals the first, drop it.

**★ For a self-intersecting polygon, shoelace does not return the area.** It returns the sum of the
enclosed regions weighted by their winding numbers, so a figure-eight with equal lobes returns
zero. That is the correct answer to the question the formula asks, and the wrong answer to "how
much ink does this shape use". If self-intersection is possible, the geometric area is a
substantially harder problem, and the honest interview answer is to say so.

**★ Holes are handled by winding, not by a special case.** Trace the outer ring one way and each
hole the other, concatenate the sums, and the holes subtract themselves. This is the whole reason
GIS formats specify ring orientation, and it is why silently `Math.abs`-ing each ring before
summing gives the area of the outer ring plus the holes.

**★ The shoelace sum overflows before a single cross product does.** Each term is on the order of
the coordinate bound squared; there are `n` of them and they need not cancel. A `long`
accumulator with `int` coordinates is the right default —
[13g](13g-integer-exactness-and-where-it-ends.md) works the magnitudes out.

**★ `isConvex` on fewer than three vertices must be decided, not defaulted.** Two points are a
segment and one is a point; both are trivially "convex" as sets and neither is a polygon. Return
`false`, or throw, but do not let the loop run with a wraparound index on a two-element array and
return a meaningless `true`.

**★ The sign test on a polygon whose vertices are all collinear returns "convex" with area zero.**
Every orientation is zero, neither flag is set, and the function reports convex. Degenerate, and
usually harmless, but if the caller then feeds the "convex polygon" into an algorithm that assumes
a non-empty interior, it will not survive.

## Interview questions

**★ Derive the shoelace formula.**
Fan triangles from any anchor point to every edge of the polygon and add their **signed** doubled
areas, each of which is a cross product. Regions swept twice by the fan are swept once with each
sign and cancel, so the sum is twice the signed area for any polygon, convex or not, with the
anchor inside or outside. Putting the anchor at the origin turns each term into `xᵢ·yᵢ₊₁ −
xᵢ₊₁·yᵢ`, and the sum of those over the closed loop is the formula. The anchor is arbitrary because
moving it changes each term by an amount that telescopes to zero around a closed cycle.

**★ What does the sign of the shoelace sum tell you and what would you use it for?**
The winding direction of the vertex list: positive is counter-clockwise under a `y`-up convention,
negative is clockwise, zero is degenerate. I would use it to normalise input before any algorithm
that assumes "the interior lies to the left of each directed edge" — reverse the array when the
sign is negative — and to answer questions like "were these given clockwise" in one pass without
any trigonometry. Under screen coordinates with `y` downward, both signs invert.

**★ Why keep twice the area rather than the area?**
Because twice the area of a lattice polygon is an exact integer while the area itself is a
half-integer. Keeping it doubled means every intermediate comparison, sum and equality test is
exact integer arithmetic; halving once at the end is a power-of-two scaling, so it is exact in
floating point too. Halving inside the loop introduces a rounding question `n` times over, and in
Java it does something worse: integer division truncates, so half a unit disappears per odd term.

**★ How do you test convexity, and when does that test lie to you?**
Take the orientation of every consecutive triple around the cycle and check that positive and
negative turns do not both occur, tolerating zeros for collinear vertices. It lies when the input
is not a simple polygon: a pentagram turns consistently at all five vertices and passes. The
complete condition is same-sign turns plus a total turning of one revolution; for a simple polygon
the second holds automatically, so the short test is correct exactly when you can assume
simplicity, and stating that assumption is the difference between a right answer and a lucky one.

**★ Compute the area of a polygon with holes.**
One shoelace pass over the outer ring in one direction and one pass over each hole in the opposite
direction, then add the signed results and take the absolute value at the very end. The opposite
winding makes each hole contribute a negative area, so the subtraction happens for free. The bug to
avoid is taking the absolute value of each ring individually, which adds the holes instead of
removing them.

**★ Your polygon has 10⁵ vertices with coordinates up to 10⁹. What type is the accumulator?**
Each term is a difference of two products of coordinates, so it is on the order of 10¹⁸, and with
10⁵ terms that could reach 10²³ — past a `long` and past a JavaScript number's exact range. The
answer is to anchor the sum at `p₀` first, which replaces coordinates with coordinate
*differences*, and if the polygon's own extent is still that large, to accumulate in `BigInt` or
`BigInteger`. Recognising that the accumulator, not the term, is the overflow site is the point of
the question — [13g](13g-integer-exactness-and-where-it-ends.md) has the arithmetic.

---

← Prev: [13c · Orientation and segment intersection](13c-orientation-and-segment-intersection.md) · Index: [Phase 2 — Recursion, maths and bits](README.md) · Next → [13e · Point in polygon by ray casting](13e-point-in-polygon-by-ray-casting.md)
