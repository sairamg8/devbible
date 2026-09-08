---
title: "Orientation is a predicate with three answers, computed by a subtraction that floating point is worst at — and an epsilon does not repair that, it redefines collinearity as a relation that is not transitive, which is enough to make a convex hull come out non-convex"
sidebar_label: "13f · Floating point and the epsilon decision"
sidebar_position: 13.5
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-09-08. The 52-bit mantissa, the definition of "safe" and the
> `MAX_SAFE_INTEGER + 1 === MAX_SAFE_INTEGER + 2` example are quoted verbatim from MDN
> [`Number.MAX_SAFE_INTEGER`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Number/MAX_SAFE_INTEGER);
> the five comparator properties and the "not well-defined" clause are quoted verbatim from MDN
> [`Array.prototype.sort`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/sort).
> The ulp spacing `2^(e−52)`, the cancellation error bound and the non-transitivity argument are
> **arithmetic derived from the quoted mantissa width**, not cited. ⚠️ Java's `Arrays.sort` /
> `List.sort` contract-violation exception and `Double.compare`'s treatment of `-0.0` were **not**
> fetched for this page and are flagged as unverified where they appear. **No sandbox run** — no
> epsilon here has been measured and no expression has been evaluated. Version spine:
> **JDK 25 · MDN as fetched 2026-09-07**.

**Every geometric predicate on the preceding pages asks for one of three discrete answers — left,
right, or exactly on — and computes it by subtracting two products of nearly equal size. That
subtraction is the single operation floating point is worst at, and the case it is worst at is
exactly the case the predicate exists to detect.** This is not a matter of accumulating a little
error and being slightly off. When the true cross product is near zero, the computed cross product's
*sign* — the only bit you asked for — can be determined entirely by rounding. An epsilon
threshold does not fix that. It replaces one problem, an unreliable answer, with a different and
more insidious one: a definition of "collinear" that is not transitive, which quietly invalidates
every algorithm that assumes its own predicate is consistent with itself.

## Why the sign is the least reliable part

Start from what a double is. MDN states the mantissa width directly:

> *"Double precision floating point format only has 52 bits to represent the mantissa, so it can only safely represent integers between -(2^53 – 1) and 2^53 – 1. 'Safe' in this context refers to the ability to represent integers exactly and to compare them correctly."*

and gives the consequence of leaving that range:

> *"For example, `Number.MAX_SAFE_INTEGER + 1 === Number.MAX_SAFE_INTEGER + 2` will evaluate to true, which is mathematically incorrect."*

From the 52 stored bits, the spacing between adjacent representable doubles near a value `x` in
`[2^e, 2^(e+1))` is `2^(e−52)` — the mantissa's last bit, scaled by the exponent. **The spacing is
relative to the magnitude, not absolute.** That single fact drives everything below.

Now the cross product. It is `P − Q`, where `P = (b.x − a.x)·(c.y − a.y)` and
`Q = (b.y − a.y)·(c.x − a.x)`. Each product is computed and rounded, so each carries an error of
roughly half a spacing at its own magnitude — an error proportional to `|P|` and `|Q|`
respectively. The subtraction of two nearby values is itself exact in IEEE-754, but the errors
already in `P` and `Q` are carried into the difference **undiminished**:

```
|computed − true|  ≲  ε · (|P| + |Q|)        with ε ≈ 2^-53
```

The error scales with the size of the *operands*. The result, when the three points are nearly
collinear, is much smaller than either operand. So the error can be larger than the result — and
when it is, the sign of the computed value is arbitrary. This is **catastrophic cancellation**: the
leading digits agree and cancel, and what remains is the noise that was sitting underneath them.

Two consequences follow that are worth stating as facts, not warnings:

1. **Nearly-collinear input makes orientation a coin flip.** Not "slightly wrong" — the answer
   flips between left, right and zero depending on rounding you cannot see.
2. **Algebraically identical expressions give different signs.** `cross(a, b, c)`,
   `cross(b, c, a)` and `cross(c, a, b)` are the same number in exact arithmetic, by the cyclic
   symmetry of the determinant. Evaluated in floating point they are three different sequences of
   roundings and can disagree. An algorithm that calls the predicate with rotated arguments in
   different places can therefore hold two contradictory beliefs about the same triple at once.

## What an epsilon actually does

The reflex is:

```ts
const orientEps = (a: Pt, b: Pt, c: Pt): -1 | 0 | 1 => {
  const v = cross(a, b, c);
  if (Math.abs(v) < EPS) return 0;      // "close enough to collinear"
  return v > 0 ? 1 : -1;
};
```

Read that honestly. It does not detect collinearity. It **declares** that any triple whose cross
product is within `EPS` of zero shall be treated as collinear. That is a modelling decision with
consequences, and there are four.

**It is not transitive, so "collinear" stops being an equivalence relation.** If `a`, `b`, `c` are
within `EPS` and `b`, `c`, `d` are within `EPS`, nothing prevents `a`, `c`, `d` from being outside
it. Approximate equality never partitions a set. Every algorithm that assumes collinear points form
groups — merging collinear hull edges, deduplicating directions, grouping points on a line — is
built on a relation that does not have the property it needs.

**It makes comparators ill-formed, and the specification declines to define what happens.** Sorting
points by angle with an epsilon comparator is the canonical case. MDN lists the required properties
and one of them is transitivity:

> *"If `compareFn(a, b)` and `compareFn(b, c)` are both positive, zero, or negative, then `compareFn(a, c)` has the same positivity as the previous two."*

and states the consequence of breaking any of them:

> *"If a comparing function does not satisfy all of purity, stability, reflexivity, anti-symmetry, and transitivity rules, as explained in the description, the program's behavior is not well-defined."*

An epsilon comparator reports "equal" for pairs that are not equal, in a way that is not
transitive — so the sort's output is not merely in an unexpected order; per the specification it is
undefined. ⚠️ Java's sort implementations are able to detect some contract violations and fail
rather than return garbage, but the relevant javadoc was **not** fetched for this page, so treat
the exception's existence and its message as unverified here.

**An absolute epsilon does not mean the same thing at two different scales.** Because double
spacing is `2^(e−52)`, a threshold of `1e-9` is enormous relative to the noise for coordinates near
`1`, and *below* the noise floor for coordinates near `10^9`, where consecutive doubles are already
further apart than that. A copied `EPS = 1e-9` therefore silences real distinctions on small input
and does nothing at all on large input. If you must threshold, threshold **relatively**, against
the magnitude of the operands the cancellation came from:

```ts
const orientRel = (a: Pt, b: Pt, c: Pt): -1 | 0 | 1 => {
  const p = (b.x - a.x) * (c.y - a.y);
  const q = (b.y - a.y) * (c.x - a.x);
  const v = p - q;
  const scale = Math.abs(p) + Math.abs(q);
  if (Math.abs(v) <= 1e-12 * scale) return 0;   // 1e-12 is a POLICY, not a fact
  return v > 0 ? 1 : -1;
};
```

That form at least tracks the error bound derived above. The constant in front is still a policy
choice that depends on how much accumulated error your input carries, and no value of it makes the
relation transitive.

**It converts a wrong answer into an unreproducible one.** Nudging coordinates, jittering a ray
direction, or "trying a slightly bigger epsilon until the test passes" all move the failure rather
than removing it, and they make the failure input-dependent in a way that no longer reproduces.

## What to do instead, in order

1. **Keep the input in integers.** Every predicate on these pages is exact in integers. This is the
   answer in the overwhelming majority of interview problems and in a fair number of real ones.
   [13g](13g-integer-exactness-and-where-it-ends.md) is where that exactness runs out.

2. **Scale decimals to integers.** If coordinates arrive with at most `k` decimal places — prices,
   fixed-precision GPS, a UI grid — multiply by `10^k` and round once, on input. Every subsequent
   operation is exact. The cost is magnitude: scaling by `10^6` multiplies your coordinate bound by
   `10^6` and the cross product's bound by `10^12`, so do the type arithmetic afterwards.

3. **Quantise, then compare exactly.** Snapping every coordinate to a grid *is* the epsilon idea,
   made transitive: after rounding to a grid, two points are either identical or they are not, and
   equality is once again an equivalence relation with real classes.

   ```ts
   const snap = (v: number, grid: number): number => Math.round(v / grid);  // integer key
   ```

   The decision — how coarse the grid is — is the same decision as choosing an epsilon, but it is
   made **once, on input**, rather than re-made inconsistently at every predicate call. That is the
   whole difference, and it is the difference between a defensible design and a pile of thresholds.

4. **Use exact arithmetic where the predicate is the answer.** `BigInt` in JavaScript or
   `BigInteger` in Java for the cross product, or rational arithmetic if you need intersection
   points. Slower, and correct. MDN's guidance for when to reach for the first is quoted on
   [05b](05b-bigint-and-when-to-reach-for-it.md).

5. **Adaptive exact predicates**, if you are building something real. The standard technique is to
   evaluate in floating point along with a bound on the error, and only fall back to exact
   arithmetic when the computed value is inside that bound — so the expensive path runs only on the
   near-degenerate inputs, which are rare. Named here so you recognise it; this page documents no
   library's implementation of it.

6. **Only then, a documented relative epsilon**, together with the acknowledgement that downstream
   algorithms must not assume the predicate is self-consistent.

## Gotchas

**★ `NaN` makes every comparison false, so it takes a branch you did not consider.** If a division
by a zero-length edge produces `NaN`, then both `x < xCross` and `x >= xCross` are false, the
crossing counter is never touched, and point-in-polygon reports "outside" with no error anywhere.
Floating-point failures in geometry surface as wrong answers, not exceptions.

**★ `Infinity` from a slope is not a usable sentinel.** `dy / 0` gives `Infinity` in JavaScript, and
`Infinity === Infinity` is true — so two different vertical lines compare equal by slope, which is
correct by accident, while `0 / 0` gives `NaN` and `NaN !== NaN`, so a degenerate direction never
matches itself. Two different behaviours from the same expression is why
[13j](13j-max-points-on-a-line.md) refuses to key anything on a slope.

**★ Java's `/` on two integral operands is not the division you meant.** Mixing an integer
coordinate computation with a floating-point one by writing `/ 2` instead of `/ 2.0` silently
truncates, and the result still type-checks as the `double` the caller expects.
[05f](05f-the-cross-language-trap.md) collects these.

**★ Do not use an epsilon-compared value as a map key or a set member.** Hashing requires exact
equality: two values that your epsilon calls equal will hash to different buckets, so the "equal"
relation your code believes in and the one your `Map` implements are different relations. Quantise
to an integer key first, or do not use a hash.

**★ Repeated epsilon comparisons in a loop accumulate a decision, not an error.** Each `< EPS` is a
fresh, independent classification. Two points can be classified differently on two passes if the
values they are compared against changed slightly — so an algorithm that classifies a point during
the build phase and re-classifies it during the verify phase can produce a structure that fails its
own assertion.

**★ ⚠️ `-0.0` and `0.0` compare equal with `==` but may not order equally.** Java's
`Double.compare` is documented to impose a total order that distinguishes them; that javadoc was
**not** fetched for this page, so confirm before relying on it. The practical advice does not
depend on the detail: never let a signed zero reach a comparator or a key.

**★ "It works on the sample input" is the expected outcome of a broken predicate.** Randomly
generated points are almost never collinear, so the degenerate branch is almost never taken. The
test that finds the bug is the hand-written one with three points on a line, and that is exactly
the test an interviewer writes.

## Interview questions

**★ Why is floating point especially dangerous for orientation tests specifically?**
Because orientation is a *sign* query on a difference of two products of similar magnitude. Each
product carries a rounding error proportional to its own size, and subtracting them cancels the
leading digits without cancelling the errors — so the absolute error in the result is proportional
to the size of the operands while the result itself, in the interesting case, is near zero. That is
catastrophic cancellation, and it means the computed sign is unreliable precisely when the three
points are close to collinear, which is the case the predicate exists to identify. For distances or
areas an error of one part in 2^53 is irrelevant; for a three-way sign decision it is the whole
answer.

**★ Someone adds `if (Math.abs(cross) < 1e-9) return 0`. What have they actually changed?**
They have changed the definition of collinearity from an exact geometric property into a tolerance
band, and in doing so given up transitivity: `a~b` and `b~c` no longer imply `a~c`, so collinearity
no longer partitions anything. Any comparator built on it breaks the ordering contract — MDN says
the behaviour of `Array.prototype.sort` with such a comparator is not well-defined — and any
algorithm that assumes its own predicate answers consistently can now be fed two contradictory
answers about overlapping triples. They have also picked an absolute threshold, which means
something different at coordinate scale 1 than at scale 10⁹, because double spacing is relative to
magnitude.

**★ How does a bad epsilon break a convex hull, concretely?**
The monotone chain pops the last hull point while the last three points do not turn the right way.
If the epsilon declares a genuine small turn to be collinear, the point is popped and the hull
loses a real vertex, so the output is not the hull. If it declares a collinear triple to be a turn,
the point stays and the "hull" has a vertex that is not extreme — the output polygon is not convex.
Worse, because the predicate is not consistent across argument orders, the loop can pop a point
under one comparison and want it back under another, and a hull implementation that re-checks after
popping can then fail to terminate. The failure is not a slightly wrong shape; it is a violated
invariant.

**★ How would you choose an epsilon if you genuinely had to?**
Relatively, not absolutely: compare the magnitude of the result against the sum of the magnitudes
of the two products it came from, since that is what the error bound is proportional to. Then pick
the constant from the input's own error budget — how many operations the coordinates have already
been through, and how much error each contributed — not from a number copied out of another
codebase. And I would say out loud that this is a policy, that it does not restore transitivity,
and that the algorithms consuming the predicate must be written not to assume consistency.

**★ The input is decimal coordinates with three decimal places. What do you do?**
Multiply every coordinate by 1000 and round to an integer, once, on input. From that point every
predicate is exact and the epsilon question does not arise. The follow-up is the type: scaling by
10³ scales the cross product's magnitude by 10⁶, so I re-check the coordinate bound against the
safe range for whichever type I am in before I write anything else.

**★ What is the difference between quantising coordinates and using an epsilon?**
Quantising makes the approximation once, at the boundary, and produces exact values afterwards, so
equality is transitive and hashable and every downstream predicate is a proof. An epsilon makes the
approximation repeatedly, at every predicate call, on values that differ each time — so the
relation it implements is not transitive, cannot be hashed, and can give inconsistent answers about
the same three points. The information lost is comparable; the difference is that one loss is
controlled and stated, and the other is spread through the code.

**★ How would you test geometry code for precision bugs?**
Not with random points, because random points are never degenerate — that is precisely why a broken
predicate passes a generated suite. I would write the degenerate cases by hand: three collinear
points, two segments meeting at a shared endpoint, a zero-length segment, duplicate points, a
polygon with a repeated closing vertex, a point exactly on an edge, and a point exactly on a
vertex. Then I would add near-degenerate cases: collinear points perturbed by one unit in the last
place, and coordinates near the type's safe bound. A test suite that contains only the first group
proves the branches exist; adding the second proves they are reached for the right reason.

**★ Is there any situation where floating point is the right choice for a geometric predicate?**
Yes — when the input is genuinely real-valued and no exact representation exists: sensor readings,
a physics simulation, the output of a projection or a rotation. In that case the exactness was
never available, so there is nothing to preserve, and the design question becomes how much error
the input already carries and whether the algorithm downstream tolerates an inconsistent predicate.
What is never right is *creating* the problem — converting exact integer input to floating point
because a remembered formula contained a division, when multiplying the division out would have
kept the whole computation exact.

---

← Prev: [13e · Point in polygon by ray casting](13e-point-in-polygon-by-ray-casting.md) · Index: [Phase 2 — Recursion, maths and bits](README.md) · Next → [13g · Integer exactness, and where it ends](13g-integer-exactness-and-where-it-ends.md)
