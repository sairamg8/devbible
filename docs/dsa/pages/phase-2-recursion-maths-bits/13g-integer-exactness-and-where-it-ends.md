---
title: "Integer coordinates make every geometric predicate a proof rather than an estimate — until the cross product, which is a multiplication, and the coordinate magnitude at which a Java int and a JavaScript number each stop being safe is smaller and far more specific than people assume"
sidebar_label: "13g · Integer exactness, and where it ends"
sidebar_position: 13.6
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-09-08. `Integer.MAX_VALUE` (*"2^31-1"*), `Integer.MIN_VALUE` (*"-2^31"*) and the
> `Math.addExact` / `multiplyExact` / `toIntExact` contracts are quoted from the JDK 25
> [`Integer`](https://docs.oracle.com/en/java/javase/25/docs/api/java.base/java/lang/Integer.html)
> and [`Math`](https://docs.oracle.com/en/java/javase/25/docs/api/java.base/java/lang/Math.html)
> javadoc; the safe-integer range, the mantissa sentence and the
> `MAX_SAFE_INTEGER + 1 === MAX_SAFE_INTEGER + 2` example from MDN
> [`Number.MAX_SAFE_INTEGER`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Number/MAX_SAFE_INTEGER);
> the `BigInt` mixing rule from MDN
> [`BigInt`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/BigInt);
> the 32-bit truncation of bitwise operators from MDN
> [Bitwise AND](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/Bitwise_AND).
> **Every coordinate bound below is arithmetic derived from those quoted constants on this page**,
> step by step — none is asserted and none is measured. **No sandbox run.** Version spine:
> **JDK 25 · MDN as fetched 2026-09-07**.

**Integers buy you exactness in geometry because the three operations every predicate uses —
addition, subtraction, multiplication — map integers to integers. The bill arrives at the
multiplication.** A cross product multiplies two coordinate *differences* and then subtracts two
such products, so its magnitude is on the order of the coordinate bound **squared**, times a small
constant. That is a quadratic amplification between what you store and what you compute, and it is
why the type that comfortably holds your input is routinely the wrong type for the intermediate.
This page does that arithmetic explicitly, from the constants both platforms document, and gives
the coordinate magnitude at which each one stops being safe.

## Which operations keep you exact

| Operation | Integer-exact? | Where it appears |
|---|---|---|
| `+`, `−` on coordinates | ✅ | vector differences, translation |
| `×` of two differences | ✅ **in value**, ⚠️ subject to the range below | cross product, dot product, squared distance |
| comparison, `abs`, `min`, `max` | ✅ | every predicate |
| `/` | ❌ leaves the integers | intersection point, slope, centroid, halving an area |
| `sqrt` | ❌ | actual distances, circle radii |
| `atan2`, `sin`, `cos` | ❌ | angular sorting done the wrong way |

So orientation, segment intersection, the shoelace *doubled* area, squared distances, rectangle
overlap and point-in-polygon in the cross-product form are all exact. Intersection **points**,
perimeters, centroids and real distances are not. The design rule follows: push everything inexact
to the output boundary, and there is usually only one of them.

## The bound, derived once

Let every input coordinate satisfy `|coord| ≤ C`. Then:

```
|b.x − a.x|                      ≤ 2C          a difference of two coordinates
|(b.x − a.x) · (c.y − a.y)|      ≤ 4C²         a product of two differences
|cross(a, b, c)|                 ≤ 8C²         a difference of two such products
|dist2(a, b)| = dx² + dy²        ≤ 8C²         the same bound, by the same route
```

**`8C²` is the number that decides your type.** It is a worst case and it is attainable in
principle — two products of maximal magnitude with opposite signs — so it is the bound to design
against, not an estimate to hope about.

If the coordinates are known non-negative, `0 ≤ coord ≤ C`, the differences are bounded by `C`
rather than `2C`, each product by `C²`, and the cross product by `2C²` — a factor of four more
headroom, which is worth taking when the problem guarantees it.

## Java `int`

The javadoc gives the constant:

> *"A constant holding the maximum value an `int` can have, 2^31-1."*

Solve `8C² ≤ 2^31 − 1`. Since `2^31 / 8 = 2^28`, the boundary is `C = 2^14 = 16384` — and that
value is *not* safe, because `8 · 16384² = 2^31`, exactly one more than `Integer.MAX_VALUE`. So the
guaranteed-safe symmetric bound is

```
|coord| ≤ 16383            2·16383 = 32766,   32766² = 1 073 610 756
                           2 × 1 073 610 756 = 2 147 221 512  ≤  2 147 483 647  ✅
```

and for non-negative coordinates, solving `2C² ≤ 2^31 − 1` gives `C ≤ 32767`
(`2 · 32767² = 2 147 352 578`, which fits).

🔴 **A coordinate bound of `|x| ≤ 10^4`, which is what problem statements most often state, sits
inside that: `8 · (10^4)² = 8 × 10^8`, comfortably under `2.1 × 10^9`.** A bound of `10^5` does
not: `8 × 10^10` overflows an `int` by a factor of about forty, and Java will not tell you.
`Math.multiplyExact` is the opt-in that would:

> *"Returns the product of the arguments, throwing an exception if the result overflows an `int`."*

## Java `long`

`Long.MAX_VALUE` is `2^63 − 1`. Solving `8C² ≤ 2^63 − 1` gives `C² ≤ 2^60`, so `C ≤ 2^30`, and by
the same off-by-one at the boundary the guaranteed-safe bound is

```
|coord| ≤ 2^30 − 1 = 1 073 741 823        ≈ 1.07 × 10^9
```

which covers the common `|x| ≤ 10^9` constraint with room to spare (`8 × 10^18` against
`9.22 × 10^18`). **This is why the `Pt` record on [13](13-geometry-basics.md) stores `long`.** Past
`10^9` coordinates you are into `BigInteger` or into translating the coordinates first.

## JavaScript `number`

MDN gives the range and its meaning:

> *"Double precision floating point format only has 52 bits to represent the mantissa, so it can only safely represent integers between -(2^53 – 1) and 2^53 – 1. 'Safe' in this context refers to the ability to represent integers exactly and to compare them correctly."*

Solving `8C² ≤ 2^53 − 1` gives `C² ≤ 2^50`, so `C ≤ 2^25`, and the boundary value again overshoots
by one, leaving

```
|coord| ≤ 2^25 − 1 = 33 554 431           ≈ 3.35 × 10^7
```

The intermediate products are safe too at that bound: each is at most `4C² ≤ 2^52`, which is inside
the exactly-representable integers, and the difference of two exact integers within the safe range
is itself exact. So a JavaScript number is fine for coordinates up to about `3 × 10^7` and **not**
fine at `10^8`, where `8 × 10^16` is nearly an order of magnitude past `2^53`.

🔴 **And crossing that line does not throw.** MDN's own example is the whole failure mode:

> *"For example, `Number.MAX_SAFE_INTEGER + 1 === Number.MAX_SAFE_INTEGER + 2` will evaluate to true, which is mathematically incorrect."*

An orientation test above the safe range returns a rounded value that is still a finite number and
still has a sign — just not necessarily the right one. There is no `NaN`, no exception, and no
symptom other than a wrong answer on large coordinates.

## The summary table

| Type | Documented limit | Safe `\|coord\|` for a cross product | Comfortable with |
|---|---|---|---|
| Java `int` | `2^31 − 1` | **16 383** (32 767 if non-negative) | `\|x\| ≤ 10^4` |
| Java `long` | `2^63 − 1` | **2^30 − 1 ≈ 1.07 × 10^9** | `\|x\| ≤ 10^9` |
| JS `number` | `2^53 − 1` safe integers | **2^25 − 1 ≈ 3.35 × 10^7** | `\|x\| ≤ 10^7` |
| `BigInt` / `BigInteger` | none | unbounded | anything, at a cost |

## Sums, and the third power

The per-operation bound is not the whole story, because two computations on these pages accumulate.

**The shoelace sum** ([13d](13d-shoelace-area-and-convexity.md)) adds `n` terms, each on the order
of `2C²` when anchored at the origin, and they need not cancel. The bound is `2nC²`. With
`n = 10^5` and `C = 10^9` that is `2 × 10^23` — past a `long` and past `2^53` by orders of
magnitude. Two fixes, in order: **anchor the sum at `p₀`**, which replaces every coordinate by a
coordinate *difference* so `C` becomes the polygon's own extent rather than its distance from the
origin; and if the extent is genuinely that large, accumulate in `BigInt` or `BigInteger`.

**The centroid** multiplies each cross term by a coordinate, so its bound is cubic in `C`. It is
the first formula in this topic that overflows a `long` for coordinates a `long` handles everywhere
else, and it needs the wide type or the translation trick unconditionally.

## Writing it exactly when you have to

```ts
// BigInt cross product — exact for any magnitude.
const crossBig = (a: Pt, b: Pt, c: Pt): bigint =>
  (BigInt(b.x) - BigInt(a.x)) * (BigInt(c.y) - BigInt(a.y)) -
  (BigInt(b.y) - BigInt(a.y)) * (BigInt(c.x) - BigInt(a.x));

const orientBig = (a: Pt, b: Pt, c: Pt): -1 | 0 | 1 => {
  const v = crossBig(a, b, c);
  return v > 0n ? 1 : v < 0n ? -1 : 0;     // 0n, not 0 — see the gotchas
};
```

```java
// Checked cross product — throws instead of wrapping. Use while developing;
// the unchecked long version is what ships once the bound is proven.
static long crossChecked(Pt a, Pt b, Pt c) {
    long t1 = Math.multiplyExact(b.x() - a.x(), c.y() - a.y());
    long t2 = Math.multiplyExact(b.y() - a.y(), c.x() - a.x());
    return Math.subtractExact(t1, t2);
}
```

The Java version relies on the documented behaviour that these methods throw rather than wrap:

> *"Returns the product of the arguments, throwing an exception if the result overflows an `int`."* — Throws: *"`ArithmeticException` - if the result overflows an int"*

[05c](05c-javas-int-and-the-checked-arithmetic.md) is the full treatment of the checked family, and
[05d](05d-the-three-silent-overflows.md) is the general pattern of an intermediate that is larger
than both its inputs and its output.

## Gotchas

**★ 🔴 In Java, `long c = (b.x - a.x) * (c.y - a.y);` with `int` coordinates overflows *before* the
assignment.** The multiplication is performed in `int` because both operands are `int`; the widening
to `long` happens to the already-wrapped result. Declaring the variable `long` fixes nothing. Either
store the coordinates as `long` in the first place — which is why the record on
[13](13-geometry-basics.md) does — or cast one operand: `(long)(b.x - a.x) * (c.y - a.y)`. This is
the most common geometry overflow in Java and it is invisible in review because the declared type
looks right.

**★ Multiplying two cross products to test "opposite signs" is a fourth-power expression.** `d1 * d2
< 0` on raw cross products has magnitude up to `64C⁴`, which for `C = 10^4` is `6.4 × 10^17` —
inside a `long` but well outside an `int`, and for `C = 10^5` outside a `long` too. Compare
normalised signs instead; [13c](13c-orientation-and-segment-intersection.md) says the same thing
from the algorithm's side.

**★ `Math.abs(Integer.MIN_VALUE)` is still negative.** `MIN_VALUE` is documented as `-2^31` and
`MAX_VALUE` as `2^31-1`, so the negation of the minimum has no representation and wraps back to
itself. A cross product that overflows to exactly `MIN_VALUE` therefore survives an `abs` unchanged
and can be compared as if it were a huge positive magnitude. This is the arithmetic consequence of
the two documented constants, not a separately quoted rule.

**★ In JavaScript, a bitwise operator on a cross product destroys it.** MDN: *"Numbers with more
than 32 bits get their most significant bits discarded."* So `cross | 0`, `~~cross` and
`cross >>> 0` silently truncate a value whose whole purpose is to be large enough to have a
reliable sign — and truncation can invert that sign. There is no reason to apply one; use
`Math.sign` or a direct comparison.

**★ `BigInt` will not mix with `number`.** MDN: *"A BigInt value cannot be used with methods in the
built-in `Math` object and cannot be mixed with a Number value in operations; they must be coerced
to the same type."* So `Math.abs(crossBig(...))` is out, and `crossBig(...) === 0` is `false` even for
a zero result, because *"A BigInt value is not strictly equal to a Number value, but it is loosely
so"* — MDN's documented examples being that `0n === 0` is `false` while `0n == 0` is `true`. Keep
every comparison in `BigInt`: test against `0n`, and never let a `number` literal into the
expression.

**★ `BigInt` division truncates.** MDN: *"Division (`/`) truncates fractional components towards
zero, since BigInt is unable to represent fractional quantities."* So computing an area as
`crossBig / 2n` silently drops the half. Keep the doubled value, as
[13d](13d-shoelace-area-and-convexity.md) insists.

**★ Translating the points to shrink them changes nothing about the answer and everything about the
range.** Every predicate here is translation-invariant, so subtracting the bounding box's minimum
corner from every point is free — and it converts a coordinate bound of "distance from the origin"
into a bound of "extent of the data", which for clustered real-world coordinates can be many orders
of magnitude smaller. Do it as a preprocessing step whenever the input is large and clustered.

**★ Reading the constraint is the cheapest correctness check you will do.** `|x| ≤ 10^4` in the
problem statement is the interviewer telling you an `int` is safe; `|x| ≤ 10^9` is them telling you
it is not. Stating "so the cross product reaches 8 × 10^18 and I need a `long`" out loud, before
writing code, is a large part of what the question is grading.

## Interview questions

**★ Coordinates are bounded by 10⁹. What type do you use for the orientation test, and show the
arithmetic.**
Differences reach `2 × 10⁹`, each product reaches `4 × 10¹⁸`, and the cross product is a difference
of two of them, so it reaches `8 × 10¹⁸`. `Integer.MAX_VALUE` is about `2.1 × 10⁹`, so an `int` is
out by nine orders of magnitude. `Long.MAX_VALUE` is `2^63 − 1 ≈ 9.22 × 10¹⁸`, which is above
`8 × 10¹⁸`, so a `long` holds it — barely, with about fifteen percent of headroom. In JavaScript,
`2^53 − 1 ≈ 9 × 10¹⁵` is far below `8 × 10¹⁸`, so plain numbers are wrong here and I would use
`BigInt`, or translate the coordinates first if the data's extent is small.

**★ At what coordinate magnitude does a Java `int` stop being safe for a cross product?**
`8C² ≤ 2^31 − 1` gives `C ≤ 2^14`, and the boundary value `16384` produces exactly `2^31`, one past
the maximum — so `16383` is the largest guaranteed-safe symmetric bound, or `32767` if the
coordinates are known non-negative, since the differences are then bounded by `C` rather than `2C`.
That is a much smaller number than the `int` range suggests, and the reason is that the predicate is
quadratic in the input.

**★ And a JavaScript number?**
Integers are exact up to `2^53 − 1`, so `8C² ≤ 2^53` gives `C ≤ 2^25`, about `3.35 × 10^7`. Below
that, every product and the final difference are exactly representable, so the orientation test is
a proof. Above it, the arithmetic silently rounds — MDN's own example is that
`MAX_SAFE_INTEGER + 1` and `MAX_SAFE_INTEGER + 2` compare equal — so the sign can be wrong with no
exception and no `NaN` to catch.

**★ Why is the squared distance subject to the same bound as the cross product?**
Because it has the same shape: two coordinate differences, each up to `2C`, squared to `4C²`, and
two of those combined — added rather than subtracted, but the magnitude bound is the same `8C²`. It
is worth noticing because people type-check the cross product carefully and then write `dist2` with
`int` accumulators next to it.

**★ Your `long` cross product returns a plausible but wrong value in Java. Where do you look
first?**
At the types of the operands, not the result. If the coordinates are `int`, then `(b.x - a.x) *
(c.y - a.y)` is evaluated entirely in `int` arithmetic and wraps, and assigning it to a `long`
preserves the wrapped value. The fix is to widen an operand — `(long)(b.x - a.x) * (c.y - a.y)` —
or to store coordinates as `long` from the start. While debugging, `Math.multiplyExact` converts the
silent wrap into an `ArithmeticException`, which turns a wrong answer into a stack trace.

**★ How do you keep a shoelace sum exact for a large polygon?**
Anchor the sum at the polygon's first vertex instead of the origin, which is legitimate because the
shoelace sum is anchor-independent, and which replaces each coordinate by a difference so the
effective bound becomes the polygon's extent rather than its distance from the origin. Then check
`2nC²` against the type: with 10⁵ vertices and an extent of 10⁴ that is `2 × 10¹³`, fine in a
`long`; with an extent of 10⁹ it is `2 × 10²³` and needs `BigInteger`. The mistake is checking the
per-term bound and forgetting that `n` terms accumulate.

{/* FOOTER */}
