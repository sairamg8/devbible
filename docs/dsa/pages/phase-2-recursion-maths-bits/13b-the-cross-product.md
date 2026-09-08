---
title: "One expression — (b−a) × (c−a) — answers three different questions at once: its sign is the turn direction, its magnitude is twice the triangle's area, and its zero is collinearity, which is why almost every plane-geometry primitive is this formula wearing a different name"
sidebar_label: "13b · The cross product"
sidebar_position: 13.1
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-09-08. The 2D scalar cross product, the identity
> `ux·vy − uy·vx = |u||v|·sin(β − α)`, the determinant-as-signed-area argument and Pick's theorem
> are **mathematics**, derived on this page rather than cited — there is no primary source to
> quote for them and none is claimed. No language-behaviour claim is made here that is not already
> quoted on [13](13-geometry-basics.md) or
> [13g](13g-integer-exactness-and-where-it-ends.md). **No sandbox run** — no expression below has
> been evaluated and no output is shown. Version spine: **JDK 25 · MDN as fetched 2026-09-07**.

**If you learn one thing from this topic, learn that the cross product is not a formula you apply
to area problems — it is the primitive that every other primitive on these pages is written in
terms of.** Point-side-of-line is its sign. Segment intersection is four of its signs. Convexity is
`n` of its signs. Polygon area is a sum of them. Convex hull is a loop that pops while its sign is
wrong. Collinearity is its zero. Learning the three readings of the one expression is cheaper than
memorising six algorithms, and it is also what lets you reconstruct any of the six when you have
forgotten the details, which under interview pressure is the realistic scenario.

## Deriving the scalar cross product in two dimensions

The cross product proper is defined on three-dimensional vectors and returns a **vector**. Embed
the plane in 3D by setting `z = 0` for both operands and turn the handle:

```
u = (ux, uy, 0)
v = (vx, vy, 0)

u × v = ( uy·0 − 0·vy ,  0·vx − ux·0 ,  ux·vy − uy·vx )
      = ( 0 , 0 , ux·vy − uy·vx )
```

Both x and y components vanish, so the result is a vector along `z` and all of its information is
in one number. **That number is what "the 2D cross product" means**, and it is a scalar:

```
cross(u, v) = ux·vy − uy·vx
```

It is also exactly the determinant of the 2×2 matrix whose columns are `u` and `v`, which is where
the area reading comes from.

### Why the magnitude is the area of the parallelogram

Write both vectors in polar form: `u = |u|·(cos α, sin α)` and `v = |v|·(cos β, sin β)`. Substitute:

```
cross(u, v) = |u|cos α · |v|sin β  −  |u|sin α · |v|cos β
            = |u||v| · (cos α sin β − sin α cos β)
            = |u||v| · sin(β − α)
```

using the sine subtraction identity. Now `β − α` is the signed angle from `u` to `v`, and
`|u||v|·sin θ` is base times height for the parallelogram spanned by `u` and `v` — `|u|` is the
base, and `|v|·sin θ` is the perpendicular height of the far corner above the line through `u`.
So:

- **`|cross(u, v)|` is the area of the parallelogram spanned by `u` and `v`.**
- A triangle is half a parallelogram, so **the triangle's area is `|cross| / 2`.**
- **The sign of `cross(u, v)` is the sign of `sin(β − α)`**, which is positive when the rotation
  from `u` to `v` is counter-clockwise by less than a half turn, negative when it is clockwise, and
  zero exactly when the two vectors are parallel or anti-parallel.

That is the whole derivation, and it takes ninety seconds on a whiteboard. It is worth being able
to produce, because an interviewer who asks "why does that tell you the turn direction?" is asking
whether you know the formula or the reason.

## The three-point form, which is the one you actually write

You almost never have two vectors; you have three points. Anchor at `a` and take the two
differences:

```
cross(a, b, c) = (b − a) × (c − a)
               = (b.x − a.x)·(c.y − a.y) − (b.y − a.y)·(c.x − a.x)
```

```ts
/** Twice the signed area of triangle (a, b, c). Positive = counter-clockwise. */
const cross = (a: Pt, b: Pt, c: Pt): number =>
  (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);

/** -1 clockwise, 0 collinear, +1 counter-clockwise. */
const orient = (a: Pt, b: Pt, c: Pt): -1 | 0 | 1 => {
  const v = cross(a, b, c);
  return v > 0 ? 1 : v < 0 ? -1 : 0;
};
```

```java
/** Twice the signed area of triangle (a, b, c). Positive = counter-clockwise. */
static long cross(Pt a, Pt b, Pt c) {
    return (b.x() - a.x()) * (c.y() - a.y()) - (b.y() - a.y()) * (c.x() - a.x());
}

/** -1 clockwise, 0 collinear, +1 counter-clockwise. */
static int orient(Pt a, Pt b, Pt c) {
    return Long.signum(cross(a, b, c));
}
```

Read the three answers off that one number:

| Reading | Value | Meaning |
|---|---|---|
| **Sign** | `> 0` | `a → b → c` turns **left** (counter-clockwise); `c` is on the left of the directed line `a→b` |
| | `< 0` | turns **right** (clockwise); `c` is on the right of `a→b` |
| | `= 0` | **collinear** — `c` lies on the infinite line through `a` and `b` |
| **Magnitude** | `\|cross\|` | **twice** the area of triangle `a b c` |
| **Zero** | `cross = 0` | the three points do not span a triangle — degenerate |

🔴 **Keep the doubled area.** `cross` is an exact integer for integer input; `cross / 2` is not,
because a lattice triangle's area is a half-integer. Sum doubled areas, compare doubled areas, and
divide by two exactly once, at the moment you print. [13d](13d-shoelace-area-and-convexity.md) does
this for polygons and it is the single reason the shoelace formula is written with a trailing
`/ 2`.

## The dot product, the other half of the pair

The cross product measures perpendicularity of position; the dot product measures alignment. They
answer complementary questions and you need both.

```ts
const dot = (a: Pt, b: Pt, c: Pt): number =>
  (b.x - a.x) * (c.x - a.x) + (b.y - a.y) * (c.y - a.y);
```

```java
static long dot(Pt a, Pt b, Pt c) {
    return (b.x() - a.x()) * (c.x() - a.x()) + (b.y() - a.y()) * (c.y() - a.y());
}
```

`dot(u, v) = |u||v|·cos θ`, by the same polar substitution with the cosine subtraction identity. So
its sign is positive for an acute angle, zero for perpendicular, negative for obtuse. The two are
related by a quarter turn: rotating `u` by 90° counter-clockwise gives `perp(u) = (−uy, ux)`, and
`dot(perp(u), v)` is `cross(u, v)`. That identity is why you can always convert a "which side"
question into a "which direction" question and back.

The place the dot product earns its keep on these pages is the **on-segment test**: once
`cross(a, b, c)` is zero you know `c` is on the infinite line, and the dot product tells you
whether it is *between* `a` and `b` rather than out past one end.
[13c](13c-orientation-and-segment-intersection.md) uses it exactly there.

## Algebraic properties you will use without noticing

- **Anti-symmetry:** `cross(u, v) = −cross(v, u)`. Swapping two of the three points flips the sign,
  so argument order is meaning, not convention.
- **`cross(u, u) = 0`**, and more generally the cross of any vector with a scalar multiple of
  itself is zero — that is collinearity restated.
- **Bilinearity:** `cross(u, v + w) = cross(u, v) + cross(u, w)`. This is what makes the shoelace
  telescoping work and what lets you anchor a polygon's area sum at any point, including the
  origin.
- **Translation invariance:** `cross(a, b, c)` depends only on `b − a` and `c − a`, so shifting all
  three points by the same offset changes nothing. Rotation preserves it too; a reflection negates
  it, which is why a mirrored polygon has the opposite winding.
- **Scaling:** multiplying every coordinate by `k` multiplies the cross product by `k²` — relevant
  when you scale decimal inputs up to integers, because the doubled area scales quadratically and
  the overflow headroom shrinks accordingly.

## Pick's theorem, for the lattice-polygon question

Occasionally a problem gives a polygon whose vertices are all lattice points and asks for the
number of integer points inside it. Pick's theorem relates that count to the area:

```
A = i + b/2 − 1
```

where `A` is the area, `i` the number of interior lattice points and `b` the number of lattice
points on the boundary. Rearranged, `i = A − b/2 + 1`. Compute `2A` with the shoelace sum, count
`b` by summing `gcd(|dx|, |dy|)` over each edge — the number of lattice points strictly between two
lattice points is `gcd(|dx|, |dy|) − 1`, which is [03b](03b-gcd-on-signed-and-wide-types.md)'s
`gcd` doing geometry — and the whole computation stays in integers if you keep everything doubled.

## Gotchas

**★ Screen coordinates flip the sign, and nothing warns you.** The derivation above assumes the
mathematical convention: `x` to the right, `y` **up**. Canvas, SVG, most UI toolkits and most image
formats put `y` **down**, which is a reflection, and a reflection negates every cross product. Your
"counter-clockwise" test then reports clockwise for everything. The code is not wrong; the label
is. Decide once which convention the input uses, write it in a comment, and if the answer is
"screen", either negate the predicate or negate every `y` on input.

**★ `cross(a, b, c)` and `cross(b, a, c)` are different questions.** Anti-symmetry means an
accidentally swapped argument silently inverts the answer. In a hull loop that shows up as a hull
traversed the wrong way round — which still looks like a hull — rather than as an exception.

**★ `= 0` means collinear, not "between".** Three collinear points have a zero cross in all six
orderings, so the cross product cannot tell you whether `c` sits between `a` and `b`, coincides
with `a`, or is a mile past `b`. Every algorithm that handles collinear input needs a second test,
and forgetting it is the single most common way a segment-intersection answer is wrong on exactly
the touching cases the interviewer will try.

**★ Reducing to `-1 / 0 / +1` too early throws away the area.** `orient` is the right primitive for
predicates and the wrong one for area, and calling it inside a shoelace loop produces a sum of
signs. Keep the raw `cross` where you need magnitude.

**★ The cross product is where the multiplication is, so it is where the overflow is.** Everything
up to this point has been additions and subtractions of coordinates; `cross` multiplies two
differences and then subtracts two such products, so its magnitude is on the order of the
coordinate bound *squared* times a small constant.
[13g](13g-integer-exactness-and-where-it-ends.md) turns that into a concrete coordinate limit for a
Java `int` and for a JavaScript number, and it is smaller than people expect.

**★ In JavaScript, never sanitise a cross product with a bitwise operator.** `cross | 0`,
`~~cross`, `cross >>> 0` and friends all coerce to 32 bits and discard the high bits, so a large
correct cross product becomes a small wrong one — and possibly one with the opposite sign. Use
`Math.sign`, or an explicit `> 0 / < 0` comparison.

**★ `Math.sign` returns `-0` for `-0`.** If your cross product is a float (because your input was
floats) and happens to be negative zero, `Math.sign` gives `-0`, which is `=== 0` and behaves as
zero in every comparison — so this is harmless in predicates, and only bites if you are using the
sign as a map key or serialising it. Mentioned because it looks alarming in a debugger and is not
the bug.

**★ "Cross product" in three dimensions returns a vector, and interviewers do ask.** If the problem
is genuinely 3D — a plane normal, a volume — the scalar shortcut does not apply and you need all
three components. Say "the 2D case is the z-component of the 3D cross with z set to zero" and you
have shown you know which one you are using.

## Interview questions

**★ Derive the orientation test from scratch.**
Take the two edge vectors out of the anchor: `u = b − a` and `v = c − a`. In polar form the
determinant `ux·vy − uy·vx` equals `|u||v|·sin(β − α)`, where `β − α` is the signed angle from `u`
to `v`. Since `|u|` and `|v|` are non-negative, the sign of the whole expression is the sign of
that sine, which is positive for a left turn, negative for a right turn and zero when the vectors
are parallel. That single number also has magnitude `|u||v|·|sin θ|`, which is base times height —
the parallelogram's area, so twice the triangle's. One expression, three answers.

**★ Why is the cross product better than comparing slopes?**
Because a slope is a division, and division is where exact input becomes inexact and where vertical
lines become a special case. `(c.y − a.y) / (c.x − a.x)` is undefined when the line is vertical, is
a rounded double whenever the coordinates are not conveniently divisible, and makes two
mathematically equal slopes compare unequal. Cross-multiplying to compare `dy1/dx1` against
`dy2/dx2` gives exactly `dy1·dx2 − dy2·dx1`, which is the cross product — so the cross product is
the slope comparison with the division removed. No special case, no rounding.
[13j](13j-max-points-on-a-line.md) is this argument applied to a whole problem.

**★ How do you compute the area of a triangle given three integer points, exactly?**
Compute `cross(a, b, c)`, take its absolute value, and that is **twice** the area — an exact
integer. If the answer must be the area, divide by two at the very end, and note that the result is
a half-integer, so it is either `k` or `k + 0.5`; printing it as `abs(cross) / 2.0` is exact for
any value inside the double's safe range because halving is a power-of-two scaling. Never compute
side lengths and use Heron's formula: that is three square roots and a catastrophic cancellation
for thin triangles, to produce a number the cross product gives you exactly.

**★ How would you sort points by angle around a centre without `atan2`?**
Split the plane into two halves — say, `y > 0`, or `y = 0 && x > 0` is the "upper" half and
everything else the "lower" — and use that half as the primary comparison key. Within a half, order
two points by the sign of `cross(u, v)`: if the cross is positive, `u` comes first. This is exact
in integers, has no trigonometry and no branch cut. The trap is that the cross comparator alone is
**not** a valid ordering over the full circle, because "u is clockwise from v" is not transitive
once the points span more than a half turn — the half-plane key is what restores transitivity, and
without it you have handed `Array.prototype.sort` a comparator whose behaviour the specification
declines to define. [13f](13f-floating-point-and-the-epsilon-decision.md) quotes that clause.

**★ What does a zero cross product tell you, and what does it not?**
It tells you the three points are collinear — that `c` lies somewhere on the infinite line through
`a` and `b`, including on the extensions beyond both ends, and including the cases where `c` equals
`a` or `b`, or where `a` equals `b` so there is no line at all. It tells you nothing about order or
betweenness. To get that you need the dot product, or a coordinate range check, and every algorithm
whose collinear branch you skip is an algorithm that is wrong on touching input.

**★ When would you use the dot product instead of the cross product?**
When the question is about alignment rather than side. The dot product is `|u||v|·cos θ`, so its
sign separates acute from obtuse and its zero means perpendicular — that is the tool for "is this
angle a right angle", for projecting one vector onto another, and, on these pages, for deciding
whether a point known to be collinear lies *between* two others. The cross product is
`|u||v|·sin θ`, so its sign separates left from right and its zero means parallel. Between them
they recover the full relative position of two vectors, and both are exact in integers because
neither divides.

**★ Two points are `(0, 0)` and `(4, 6)`. Is `(2, 3)` on the line through them, and how do you know
without dividing?**
`cross((0,0), (4,6), (2,3))` is `4·3 − 6·2`, which is `12 − 12 = 0`, so yes — the three points are
collinear. Nothing was divided and nothing was rounded: the answer is an integer identity, not an
approximation. Doing it by slope would mean comparing `6/4` against `3/2`, which happens to be
exact in binary here and would not be for a point like `(1, 1.5)` reached by the same reasoning.
The cross product is that comparison with the denominators multiplied out, which is why it has no
special cases.

---

← Prev: [13 · Geometry basics](13-geometry-basics.md) · Index: [Phase 2 — Recursion, maths and bits](README.md) · Next → [13c · Orientation and segment intersection](13c-orientation-and-segment-intersection.md)
