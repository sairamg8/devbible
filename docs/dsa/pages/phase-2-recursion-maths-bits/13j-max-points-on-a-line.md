---
title: "Max points on a line is the problem that punishes a slope: a division turns exact integers into rounded doubles, makes vertical lines a special case and gives you a signed zero to hash — and the fix, a direction vector reduced by its gcd and given a canonical sign, is exact"
sidebar_label: "13j · Max points on a line"
sidebar_position: 13.9
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-09-08. The grouping argument, the reduced-direction normalisation and the
> complexity claims are **mathematics and standard practice**, derived here rather than cited; the
> `gcd` behaviour on zero and on negative operands is the subject of
> [03b](03b-gcd-on-signed-and-wide-types.md). ⚠️ The `Double` javadoc — which governs how `-0.0`
> and `NaN` behave as boxed map keys in Java — was **not** fetched for this page; the two places
> that touch it say so and give advice that does not depend on the detail. **No sandbox run** — no
> code below has been executed. Version spine: **JDK 25 · MDN as fetched 2026-09-07**.

**Given `n` points, how many at most lie on a single straight line? The algorithm is four lines of
thinking and the whole difficulty is choosing what to use as a hash key.** Choose the slope and you
have written a program that is wrong on vertical lines, wrong on horizontal lines pointing
backwards, wrong on any pair of points whose ratio is not exactly representable in binary, and
wrong in a way that passes every small test. Choose a direction vector reduced by its greatest
common divisor and normalised to a canonical sign, and every comparison is an exact integer
equality. This is the topic's precision argument compressed into one problem, which is why it gets
asked.

## The algorithm

A line is determined by a point and a direction. So: **fix an anchor, group every other point by
the direction from the anchor to it, and the largest group plus the anchor is the best line through
that anchor.** Repeat for every anchor and take the maximum.

```
for each anchor a:
    counts = empty map
    for each other point b:
        d = normalisedDirection(b − a)
        counts[d] += 1
    best = max(best, 1 + max(counts.values()))
```

Two things about that outer loop are worth being explicit about.

**The anchor is not optional.** A direction alone does not identify a line — every line parallel to
it shares that direction. Grouping all `n²` directions globally counts parallel lines together and
returns a number that is too large. It is the *pair* (anchor, direction) that identifies a line,
and iterating anchors is how you fix the first half of the pair.

**Every line with `k ≥ 2` points is found `k` times**, once from each of its points as anchor,
which is wasted work but not incorrect. It is also why the loop can stop early: if the current best
is `k`, an anchor with fewer than `k − 1` remaining points to its right cannot improve it.

## Why a slope is the wrong key

`slope = (b.y − a.y) / (b.x − a.x)` fails four separate ways, and each of them is a test case
somebody will write.

**It divides, so it rounds.** Two pairs that are genuinely collinear with the anchor have equal
slopes as *rationals*, but the division that produces them is two different roundings of two
different pairs of integers, and there is no guarantee the resulting doubles are bit-identical.
`1/3` has no exact binary representation; neither does most of the rest of them. Equal directions
can land in different buckets, and hash lookup is exact equality, so the group is silently split.
[13f](13f-floating-point-and-the-epsilon-decision.md) is the general form of this, and it is worse
here than usual because a hash map cannot be given a tolerance.

**Vertical lines have no slope.** `dx` is zero. In JavaScript that is `Infinity`, which at least
compares equal to itself, so the vertical case accidentally works — until `dy` is also zero, when it
is `NaN`, and `NaN` is not equal to itself, so a duplicate point never joins its own group. In Java,
integer division by zero throws `ArithmeticException` outright, and the "fix" of casting to `double`
first reproduces the JavaScript behaviour rather than removing the special case.

**Horizontal lines produce a signed zero.** `0 / -3` is `-0.0`. In JavaScript, `Map` keys use
SameValueZero so `-0` and `0` are the same key and the problem does not arise. ⚠️ In Java, a boxed
`Double` distinguishes them under `equals`, so `-0.0` and `0.0` are two different `HashMap` keys —
the `Double` javadoc was not fetched here, so confirm the detail before relying on it, and note
that the advice is the same either way: **do not use a floating-point value as a map key.**

**It is a lossy encoding of what you actually want.** The slope collapses a direction into one
number, and direction has two degrees of freedom. Keeping the pair is both more faithful and
cheaper.

## The right key: a reduced direction vector

Take the difference `(dx, dy)`, divide both components by their `gcd`, and then fix the sign so
that a direction and its opposite map to the same key — because `a → b` and `b → a` describe the
same line.

```ts
function directionKey(a: Pt, b: Pt): string {
  let dx = b.x - a.x, dy = b.y - a.y;
  if (dx === 0 && dy === 0) return "dup";              // duplicate point, handled separately

  const g = gcd(Math.abs(dx), Math.abs(dy));           // gcd(0, k) === k, so this is safe
  dx /= g; dy /= g;

  // Canonical sign: dx > 0, or dx === 0 with dy > 0.
  if (dx < 0 || (dx === 0 && dy < 0)) { dx = -dx; dy = -dy; }

  return `${dx},${dy}`;
}

function maxPoints(points: Pt[]): number {
  const n = points.length;
  if (n <= 2) return n;
  let best = 0;
  for (let i = 0; i < n; i++) {
    const counts = new Map<string, number>();
    let dups = 0, localBest = 0;
    for (let j = 0; j < n; j++) {
      if (i === j) continue;
      const k = directionKey(points[i], points[j]);
      if (k === "dup") { dups++; continue; }
      const c = (counts.get(k) ?? 0) + 1;
      counts.set(k, c);
      localBest = Math.max(localBest, c);
    }
    best = Math.max(best, localBest + dups + 1);        // + the anchor itself
  }
  return best;
}
```

```java
record Dir(long dx, long dy) {}    // a record, so equals/hashCode are by VALUE

static Dir directionKey(Pt a, Pt b) {
    long dx = b.x() - a.x(), dy = b.y() - a.y();
    long g = gcd(Math.abs(dx), Math.abs(dy));          // gcd(0, k) == k
    dx /= g; dy /= g;
    if (dx < 0 || (dx == 0 && dy < 0)) { dx = -dx; dy = -dy; }
    return new Dir(dx, dy);
}

static int maxPoints(Pt[] p) {
    int n = p.length;
    if (n <= 2) return n;
    int best = 0;
    for (int i = 0; i < n; i++) {
        Map<Dir, Integer> counts = new HashMap<>();
        int dups = 0, localBest = 0;
        for (int j = 0; j < n; j++) {
            if (i == j) continue;
            if (p[i].equals(p[j])) { dups++; continue; }
            int c = counts.merge(directionKey(p[i], p[j]), 1, Integer::sum);
            localBest = Math.max(localBest, c);
        }
        best = Math.max(best, localBest + dups + 1);
    }
    return best;
}
```

**Why the `gcd` makes it exact.** `(2, 6)` and `(1, 3)` and `(5, 15)` are the same direction; after
reduction all three are `(1, 3)`. The reduction is an integer division that is guaranteed to have
no remainder, so it never leaves the integers, and equality of reduced pairs is exactly equality of
directions. There is no tolerance, no rounding and no special case — `(0, 1)` is the vertical
direction and `(1, 0)` the horizontal, and they are keys like any other.

**Why the canonical sign is needed.** Without it, `a → b` gives `(1, 3)` and `b → a` gives
`(−1, −3)`, which are different keys for the same line. Since the anchor is fixed inside the inner
loop this does not actually change the answer for *this* problem — every direction is measured from
the same anchor, so the opposite direction means the point is on the other side of the anchor,
which is still the same line. It does matter, and the code above is written to be reusable for the
variants where it matters: counting distinct lines, or grouping directions across anchors.

**Complexity: `O(n²)` expected**, with `O(n)` extra space that is reset per anchor. The `gcd` is
`O(log C)` per pair, which is a factor most analyses fold into the constant. No sub-quadratic
algorithm for this problem is known in general — say so, rather than hunting for one, and note
that the `O(n²)` bound is the accepted answer.

## The alternative without hashing

For each anchor, sort the other points by direction using the cross-product comparator from
[13b](13b-the-cross-product.md) — with a half-plane primary key, so the comparator stays transitive
— and then count the longest run of equal directions, where "equal" is a zero cross product. That
is `O(n² log n)` and uses no hash map at all, which makes it attractive when the coordinate range
is enormous (so the `gcd` and the string keys get expensive) or when the language's default map
would box every key. It is also the version that generalises to counting collinear triples.

## Gotchas

**★ `gcd(0, 0)` is `0`, and dividing by it is the bug.** It happens exactly when the two points are
identical, so guard the duplicate case *before* the reduction rather than inside it. Every other
input has a non-zero `gcd`, because at least one component is non-zero and `gcd(0, k) = k`.

**★ Negative operands make some `gcd` implementations return a negative divisor.** Take absolute
values before calling it, and be aware that `Math.abs` of the most negative value of a signed type
is still negative — see [03b](03b-gcd-on-signed-and-wide-types.md) and
[13g](13g-integer-exactness-and-where-it-ends.md). Coordinate differences are bounded by twice the
coordinate bound, so this is only reachable with adversarial input, but it is reachable.

**★ 🔴 In Java, an array is never a usable map key.** `long[]{dx, dy}` as a `HashMap` key uses the
array's identity hash, so every entry is distinct and every lookup misses. The symptom is a result
of exactly `2` — every "group" has size one. Use a `record`, which gives value equality and a hash
for free, or `List.of(dx, dy)`, or a string.

**★ The same trap exists in TypeScript with object keys.** `new Map<Pt, number>()` keys on
reference identity, so two structurally identical direction objects are two entries. The string key
above is the reason; the cost is stringification per pair, which
[Phase 1 · Hash keys and the test for hidden loops](../phase-1-complexity/06b-hash-keys-and-the-test-for-hidden-loops.md)
is the general treatment of.

**★ Forgetting to reset the map per anchor merges parallel lines.** The map is per-anchor state. A
map hoisted out of the outer loop for "efficiency" counts every line parallel to a given direction
as one line and returns a number that can be far too large — and is still correct on inputs with no
parallel lines, which is most small tests.

**★ The `+ 1` for the anchor is easy to lose and easy to double.** The counts hold the *other*
points on the line; the anchor is not among them. Add exactly one, and add the duplicates of the
anchor separately, since they are on every line through it.

**★ `n ≤ 2` must return `n`.** Any two distinct points are collinear, and one point is a line with
one point on it, so the general loop's `+ 1` bookkeeping must not be trusted to produce that. Return
early.

**★ Packing the direction into one integer key is a trap unless you do the arithmetic.** `dx *
1_000_000 + dy` collides as soon as `|dy|` reaches the multiplier or `dy` is negative, and both are
routine. If you want a packed key, use a multiplier strictly greater than twice the coordinate
bound, add the bound as a bias so nothing is negative, and check the product against the type — or
just use a record and stop worrying about it.

**★ The reduced direction is exact but the pairwise loop is still `O(n²)`.** With `n = 10⁴` that is
`10⁸` `gcd` calls and string allocations, which is a different problem from correctness. If the
constraint is that large, the intended solution is not this one, and saying so beats optimising the
key.

## Interview questions

**★ How do you find the maximum number of points on a line?**
Fix each point as an anchor in turn, and for every other point compute the direction from the
anchor, normalised so that collinear directions are identical: divide `(dx, dy)` by their `gcd` and
force a canonical sign. Count the directions in a hash map; the largest count plus one for the
anchor, plus any duplicates of the anchor, is the best line through it. Take the maximum over all
anchors. It is `O(n²)` expected, and no better bound is known for the general problem.

**★ Why not just use the slope?**
Because a slope is a division and the input is integers. The division rounds, so two directions
that are mathematically identical can produce different doubles and land in different hash buckets;
vertical lines have no slope at all, which is either `Infinity` or an exception depending on the
language and the types; horizontal lines going backwards produce `-0.0`, which may or may not be
the same map key as `0.0`; and a duplicate point produces `NaN`, which is not equal to itself. The
reduced direction vector has none of those cases: it is an integer pair, it is exact, and vertical
and horizontal are ordinary keys.

**★ Why does the direction have to be measured from an anchor rather than globally?**
Because a direction identifies a *family* of parallel lines, not a line. Two disjoint lines with
the same slope would be merged into one group and the count would be the sum of both. A line is
determined by a point plus a direction, so fixing the anchor supplies the point and the grouping
supplies the direction. That is also why the algorithm is inherently quadratic: there are `n`
anchors and each needs a pass.

**★ What exactly does the `gcd` step do, and why is it safe?**
It reduces the direction vector to lowest terms, so every scalar multiple of the same direction
maps to one canonical pair — `(2, 6)`, `(1, 3)` and `(5, 15)` all become `(1, 3)`. It is safe
because the division has no remainder by construction, so the result stays an exact integer pair,
and because `gcd(0, k) = k` handles the axis-aligned directions without a special case. The only
input it cannot handle is `(0, 0)`, where the `gcd` is zero — that is a duplicate point, and it is
counted separately before the reduction runs.

**★ How do duplicate points affect the answer?**
A duplicate of the anchor lies on *every* line through the anchor, so it is added to whichever group
turns out to be largest rather than to any particular one — which is why the code counts duplicates
separately and adds them once at the end. Duplicates that are not the anchor need no special
treatment: they produce the same reduced direction as each other and land in the same group, which
is correct, since they really are on that line.

**★ Can you solve it without a hash map?**
Yes: for each anchor, sort the other points by direction using a cross-product comparator with a
half-plane primary key, then count the longest run of directions that give a zero cross product
with their neighbour. That is `O(n² log n)` — a log factor worse — but it uses only exact integer
comparisons and no hashing, which matters when the coordinates are large enough that the `gcd` and
the key construction dominate, or in a language where every map key would be boxed.

**★ How does this generalise to counting collinear triples, or to finding all the lines?**
The same per-anchor grouping does both. A group of size `k` at an anchor means `k` other points
share a direction with it, which contributes `C(k, 2)` collinear triples having that anchor as one
of its members — and since each triple is discovered three times, once per member as anchor, the
total is the sum of `C(k, 2)` over all groups divided by three. To enumerate the *lines* rather
than count points, the key must be the line itself rather than the direction: the anchor plus the
canonical direction, which is why the canonical-sign step matters even though this particular
problem does not need it.

{/* FOOTER */}
