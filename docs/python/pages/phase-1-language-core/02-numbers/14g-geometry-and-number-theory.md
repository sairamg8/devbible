---
title: "math.hypot and math.dist exist because squaring overflows long before the norm does, and math.gcd, math.lcm and math.comb are integer-exact functions with no operator equivalent at all"
sidebar_label: "14g · Geometry and number theory"
sidebar_position: 146
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-01 against the Python 3.14
> [`math`](https://docs.python.org/3.14/library/math.html) reference (`hypot`,
> `dist`, `gcd`, `lcm`, `factorial`, `comb`, `perm`).
> Version spine: **Python 3.14.7**; `dist` and `comb`/`perm` added in **3.8**,
> `lcm` in **3.9**, n-dimensional `hypot` in **3.8** with an accuracy
> improvement in **3.10**, `factorial` stopped accepting integral floats in
> **3.10**.

**The last group of `math` functions are the ones with no operator equivalent at
all, and they divide cleanly in two. `hypot` and `dist` are float functions that
beat the formula you would write, because squaring each coordinate leaves the
float range long before the norm does. `gcd`, `lcm`, `factorial`, `comb` and
`perm` are integer-exact functions that never convert to float and never lose a
digit — and `comb` in particular is not merely a convenience over the factorial
formula, it is the difference between a computation that finishes and one that
allocates an integer with tens of thousands of digits. This chunk closes the set
with the decision table for all of it.**

## `math.hypot` and `math.dist` versus the formula you would write

> *"`hypot(*coordinates)` — Return the Euclidean norm,
> `sqrt(sum(x**2 for x in coordinates))`. This is the length of the vector from
> the origin to the point given by the coordinates."*

> *"Changed in version 3.10: Improved the algorithm's accuracy so that the
> maximum error is under 1 ulp (unit in the last place). More typically, the
> result is almost always correctly rounded to within 1/2 ulp."*

> *"`dist(p, q)` — Return the Euclidean distance between two points p and q,
> each given as a sequence (or iterable) of coordinates. The two points must
> have the same dimension."* … *"Roughly equivalent to:
> `sqrt(sum((px - qx) ** 2.0 for px, qx in zip(p, q)))`"*

Both documentation entries give the "roughly equivalent" expression, and both
say *roughly* for the same reason: the naive expression squares each coordinate
first, and squaring is exactly the operation that overflows and underflows
soonest. A vector whose components are around 1e200 has a norm that is
representable and a sum of squares that is not — the naive formula gives `inf`
where `hypot` gives the answer. At the other end, components around 1e-200
square to zero and the naive formula returns `0.0`.

The 3.10 accuracy note is the second reason: `hypot` is now within 1 ulp, where
the naive expression accumulates a rounding per square, one for the sum and one
for the square root.

```python
math.hypot(dx, dy)                 # n-dimensional since 3.8
math.dist(p, q)                    # the same, for two points
math.sqrt(dx*dx + dy*dy)           # overflows and underflows sooner, less accurate
```

## `math.gcd` and `math.lcm`

These are integer-exact and have no operator equivalent at all.

> *"`gcd(*integers)` — Return the greatest common divisor of the specified
> integer arguments. If any of the arguments is nonzero, then the returned value
> is the largest positive integer that is a divisor of all arguments. If all
> arguments are zero, then the returned value is `0`. `gcd()` without arguments
> returns `0`."*

> *"`lcm(*integers)` — Return the least common multiple of the specified integer
> arguments. If all arguments are nonzero, then the returned value is the
> smallest positive integer that is a multiple of all arguments. If any of the
> arguments is zero, then the returned value is `0`. `lcm()` without arguments
> returns `1`."*

Read the empty-argument cases carefully: `gcd()` is `0` and `lcm()` is `1`, and
those are the correct identity elements, so `functools.reduce(math.gcd, xs)`
over an empty list behaves. `gcd` accepts an arbitrary number of arguments since
3.9; before that it took exactly two, which is why older code is full of
`reduce(gcd, ...)` that no longer needs to be.

## `factorial`, `comb` and `perm`

Also integer-exact, also with no operator form, and all three are strict about
types:

> *"`factorial(n)` — Return factorial of the nonnegative integer n."*
> *"Changed in version 3.10: Floats with integral values (like `5.0`) are no
> longer accepted."*

> *"`comb(n, k)` — … Evaluates to `n! / (k! * (n - k)!)` when `k <= n` and
> evaluates to zero when `k > n`. … Raises `TypeError` if either of the
> arguments are not integers. Raises `ValueError` if either of the arguments are
> negative."*

`math.comb(n, k)` is not merely more convenient than the factorial expression —
it avoids materialising `n!`, which for `n` in the thousands is an integer with
tens of thousands of digits. The literal translation of the formula is
correct and unusable, in the same way `(base ** exp) % mod` is
([14d](14d-powers-roots-and-logs.md)).

## The decision table for the whole set

| You want | Use | Not |
|---|---|---|
| Exact integer power | `a ** b` | `math.pow` |
| Modular power or inverse | `pow(a, b, m)` | anything in `math` |
| IEEE float power with special cases | `math.pow` | `**` |
| Integer square root | `math.isqrt` | `int(math.sqrt(n))` |
| Square root of a possibly-negative value | `cmath.sqrt` | `math.sqrt` |
| Floor of an integer quotient | `a // b` | `math.floor(a / b)` |
| Ceiling of an integer quotient | `-(-a // b)` | `math.ceil(a / b)` |
| Float remainder | `math.fmod` | `%` |
| Integer remainder | `%` | `math.fmod` |
| Angle reduction | `math.remainder` | `%` |
| Base-2 or base-10 log | `math.log2`, `math.log10` | `math.log(x, 2)` |
| Bits in a huge int | `n.bit_length()` | `math.log2(n)` |
| `e ** x` | `math.exp(x)` | `math.e ** x` |
| `log(1 + x)` for small `x` | `math.log1p(x)` | `math.log(1 + x)` |
| Accurate float sum | `math.fsum` | `sum` |
| Dot product | `math.sumprod` | `sum(a*b for …)` |
| Product of ints | `math.prod` | a `for` loop |
| Absolute value | `abs` | `math.fabs` |
| Vector length | `math.hypot` | `math.sqrt(x*x + y*y)` |
| Binomial coefficient | `math.comb` | the factorial formula |

## Gotchas

**★ `math.sqrt(x*x + y*y)` overflows where `math.hypot(x, y)` does not.**
Squaring is the operation that leaves the float range soonest, so a vector with
components around 1e200 has a perfectly representable norm and an
unrepresentable sum of squares — the naive formula returns `inf`. The same
argument runs at the small end: components around 1e-200 square to zero and the
formula returns `0.0` for a nonzero vector.

**★ `math.hypot`'s accuracy improved in 3.10, so a golden-file test pinned on
3.9 output can fail on upgrade.** The docs record the change: maximum error now
*"under 1 ulp"*, and typically correctly rounded to within 1/2 ulp. That is a
better answer, not a regression — and it is still a different string in your
approval file, which is the kind of failure that gets misdiagnosed as a bug in
the change under review.

**★ `math.dist` requires equal dimensions and says so; `zip` would not.** The
docs state that *"the two points must have the same dimension"*. A hand-rolled
`sqrt(sum((a - b)**2 for a, b in zip(p, q)))` silently truncates to the shorter
sequence and returns a distance in fewer dimensions, which is a plausible number
and a wrong one.

**★ `gcd()` with no arguments is `0` and `lcm()` with no arguments is `1`.**
Those are the correct identity elements, so folding over an empty sequence gives
the mathematically right answer rather than an exception. It is easy to get
backwards when writing a validation that "an empty input should be rejected" —
the function will not do that for you, and `lcm()` returning `1` looks like a
successful computation.

**★ `gcd` and `lcm` took exactly two arguments before 3.9.** Code written
against older versions is full of `functools.reduce(math.gcd, values)` that no
longer needs to be, and mixed-version code that assumes the variadic form breaks
on an old interpreter with a `TypeError` rather than a clear message.

**★ `math.factorial` stopped accepting integral floats in 3.10.**
`factorial(5.0)` used to work and now raises. Code that computed its argument
with `/` instead of `//` used to be silently rescued by that acceptance and now
fails loudly — an improvement, but it fails at the call site, so an untested
branch can carry it into production.

**★ The literal binomial formula is correct and unusable.**
`math.factorial(n) // (math.factorial(k) * math.factorial(n - k))` materialises
`n!`, which for `n` in the low thousands is an integer with tens of thousands of
digits, allocated and then divided away. `math.comb` computes the same value
without it, and it also raises `ValueError` on negative arguments where the
formula would have produced nonsense.

**★ `math.comb` and `math.perm` raise `TypeError` on non-integers, including
integral floats.** The docs are explicit: *"Raises `TypeError` if either of the
arguments are not integers."* This is deliberate strictness in the whole
number-theoretic family, and it is the opposite of the rest of `math`, which
accepts anything convertible to a float. Do not generalise "the `math` module is
permissive about types" from one half of it to the other.

**★ `math.perm(n)` with `k` omitted is `n!`, which is easy to write by
accident.** The docs say *"if k is not specified or is None, then k defaults to
n and the function returns n!"*. A missing second argument therefore does not
raise; it returns a very different and very large number.

## Interview questions

**★ Why does `math.hypot` exist when `sqrt(x*x + y*y)` is one line?**
Two reasons, both documented. Range: squaring overflows and underflows far
sooner than the norm does, so the naive formula returns `inf` for vectors whose
length is perfectly representable and `0.0` for vectors that are merely small.
Accuracy: since 3.10 `hypot`'s *"maximum error is under 1 ulp"*, typically
correctly rounded to within half an ulp, where the naive expression rounds once
per square, once for the sum and once for the root. The docs give the naive
expression as *"roughly equivalent"*, and "roughly" is carrying the whole
argument.

**★ Why is `math.comb(n, k)` better than the factorial formula?**
Because the formula materialises `n!`. For `n` around 5000 that is an integer
with more than sixteen thousand digits, allocated and then divided away. `comb`
computes the same value directly. It is also stricter: the docs say it *"raises
`ValueError` if either of the arguments are negative"* and `TypeError` if either
is not an integer, so bad inputs fail immediately instead of producing a
plausible-looking number.

**★ `math.gcd()` returns `0` and `math.lcm()` returns `1`. Is that a bug?**
No — they are the identity elements for the respective operations, which is
what makes folding work. `gcd(a, 0)` is `a` for any `a`, so `0` is the right
starting value for a running greatest common divisor; `lcm(a, 1)` is `a`, so `1`
is the right starting value for a running least common multiple. Both choices
mean `functools.reduce(math.gcd, values)` over an empty sequence gives the
mathematically correct answer rather than raising, which is usually what you
want and occasionally exactly what you do not.

**★ Which `math` functions never touch a float?**
`floor`, `ceil` and `trunc`, which delegate to `__floor__`, `__ceil__` and
`__trunc__` rather than converting; `isqrt`; `gcd` and `lcm`; and `factorial`,
`comb` and `perm`. `prod` joins them when every element is an `int`, because
integer multiplication is exact. That list is worth memorising, because it is
precisely the set that is safe on the unbounded integers Python gives you by
default — everything else in the module narrows to 53 bits at the door.

**★ Give the one-line decision rule for each family in this chunk set.**
Powers: `**` for exact integers, `math.pow` for IEEE float semantics,
three-argument `pow` for anything modular. Roots: `math.isqrt` for integers,
`cmath.sqrt` when negatives are legitimate, `math.sqrt` when they are a bug.
Rounding to whole numbers: `//` to keep the type, `math.floor`/`ceil`/`trunc`
to get an `int`, and remember `Decimal`'s `//` truncates. Logs: never the
two-argument `math.log` for base 2 or 10, and `bit_length` for huge integers.
Aggregation: `fsum`, `sumprod`, `prod` and `fma` instead of a loop. Absolute
value: always `abs`. Geometry and number theory: always the `math` function,
because there is no operator to compete with it.

---

← Prev: [Aggregation and abs](14f-aggregation-and-the-rest.md) · Index: [Numbers](README.md) · Next → [Strings](../03-strings/README.md)

{/* FOOTER */}
