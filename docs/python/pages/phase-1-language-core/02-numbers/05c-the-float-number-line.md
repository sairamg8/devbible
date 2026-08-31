---
title: "Floats are spaced unevenly along the number line, so a single operation is off by at most half a local gap while a chain of them is bounded by nothing you can name in advance"
sidebar_label: "5c · The float number line"
sidebar_position: 52
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-31 against the Python 3.14 library reference for
> [`math`](https://docs.python.org/3.14/library/math.html)
> (`ulp`, `nextafter`, `isfinite`) and
> [`sys.float_info`](https://docs.python.org/3.14/library/sys.html#sys.float_info),
> plus the tutorial appendix
> [Floating-Point Arithmetic](https://docs.python.org/3.14/tutorial/floatingpoint.html).
> Version spine: **Python 3.14.7**; `math.ulp` and `math.nextafter` **added in
> 3.9**, `nextafter`'s `steps` argument **3.12**.

**The floats are not evenly spaced. Between 1 and 2 there are 2^52 of them;
between 2^52 and 2^53 there is exactly one per integer; above 2^53 there are
gaps that swallow whole integers, and below `sys.float_info.min` they thin out
again as the format trades precision for range. Every individual operation lands
on the nearest float and is therefore off by at most half a *local* gap — but
gaps scale with magnitude, and the output of one rounding is the input to the
next, so a chain of correctly rounded operations has no useful error bound at
all. This page is the geometry; [05d](05d-accurate-float-arithmetic.md) is the
repair kit.**

## The spacing, and how to ask for it

`math.ulp(x)` is the local grid spacing — "Unit in the Last Place":

> *"Return the value of the least significant bit of the float `x` […]
> Otherwise (`x` is a positive finite number), return the value of the least
> significant bit of `x`, such that the first float bigger than `x` is
> `x + ulp(x)`."*

The special cases matter:

> *"If `x` is a NaN (not a number), return `x`. If `x` is negative, return
> `ulp(-x)`. If `x` is a positive infinity, return `x`. If `x` is equal to zero,
> return the smallest positive **denormalized** representable float (smaller
> than the minimum positive normalized float, `sys.float_info.min`)."*

`sys.float_info.epsilon` is exactly `math.ulp(1.0)` — the `epsilon` row of the
`float_info` table points at `math.ulp()` for precisely this reason. Everywhere
else on the number line the two differ by whatever power of two the exponent
supplies.

`math.nextafter` walks the grid directly:

> *"Return the floating-point value `steps` steps after `x` towards `y`. If `x`
> is equal to `y`, return `y`, unless `steps` is zero."*

> *"`math.nextafter(x, math.inf)` goes up: towards positive infinity. […]
> `math.nextafter(x, math.copysign(math.inf, x))` goes away from zero."*

```python
import math

def neighbours(x: float) -> tuple[float, float]:
    """The float immediately below and immediately above x."""
    return math.nextafter(x, -math.inf), math.nextafter(x, math.inf)

def within_ulps(a: float, b: float, n: int = 4) -> bool:
    """True if b lies within n grid steps of a, in either direction."""
    lo = math.nextafter(a, -math.inf, steps=n)
    hi = math.nextafter(a, math.inf, steps=n)
    return lo <= b <= hi

def gap_ratio(x: float) -> float:
    """How much coarser the grid is at x than at 1.0."""
    return math.ulp(x) / math.ulp(1.0)
```

The `steps` argument (3.12) is what makes an "within N ulps" test writable
without bit-twiddling. Note that `within_ulps` above is written with ordered
comparisons and so returns `False` for any NaN argument — deliberately; see
[06](06-nan-inf-and-signed-zero.md).

## The three regions of the number line

**Above 2\*\*53: integers start disappearing.** With 53 bits of significand, the
integers 0 through 2\*\*53 are all exactly representable and consecutive. Just
above 2\*\*53 the spacing becomes 2, so only even integers exist; above 2\*\*54 only
multiples of 4, and so on upwards. This is the mechanism behind every "the ID
came back off by one" bug: a 64-bit database key or snowflake ID routed through
a JavaScript `Number` or a Python `float` loses its low bits. The defence is to
never let the value become a float — see
[01c](01c-identity-and-boundaries.md).

```python
BIG = 2 ** 53
assert float(BIG) == BIG            # exact
assert float(BIG + 1) == float(BIG) # the odd integer has no float; it rounds
```

The detection is easy, because cross-type comparison is exact: the language
reference says *"A comparison between numbers of different types behaves as
though the exact values of those numbers were being compared."* So
`float(n) == n` is `False` for `n = 2**53 + 1`, and a one-line guard at the
boundary catches the loss. What no guard catches is the conversion you never
wrote down — the one performed by a JSON parser, a driver, or an ORM column
typed `REAL`.

**Between `sys.float_info.min` and `sys.float_info.max`: normal operation.**
Roughly 2.2e-308 to 1.8e308 in magnitude, with 15 decimal digits guaranteed in
and 17 needed out, everywhere in the range. The *relative* precision is constant
here; the absolute precision emphatically is not.

**Below `sys.float_info.min`: subnormals, and precision bleeding away.** The
docs draw the boundary carefully — `float_info.min` is *"the minimum
representable positive **normalized** float"*, and *"Use `math.ulp(0.0)` to get
the smallest positive denormalized representable float"*. Below the normal
range, IEEE 754 keeps representing values by dropping the implicit leading bit,
losing one bit of significand per binary order of magnitude, until nothing is
left and the value flushes to zero. That is *gradual underflow*, and it buys one
property numerical code leans on hard: `a - b == 0.0` implies `a == b` even for
tiny values. It also means arithmetic that drifts into the subnormal range
loses precision with no error, no warning and no signal.

⚠️ The 3.14 `math` module exposes no predicates for these classes: there is no
`math.isnormal` and no `math.issubnormal`. Write the test yourself as
`0 < abs(x) < sys.float_info.min`.

## Every operation rounds once; a chain of them does not

`sys.float_info.rounds` reports the mode, documented as *"`1`: to nearest"*.
Under IEEE 754 that means each of `+`, `-`, `*`, `/` and `sqrt` computes the
exact mathematical result and rounds it once to the nearest float, ties to even.
A single operation is therefore off by at most half an ulp — the best any format
can do.

The trouble is that the result of that rounding is the input to the next
operation, and rounding is not associative:

```python
a, b, c = 1e16, -1e16, 1.0
left  = (a + b) + c    # (0.0) + 1.0
right = a + (b + c)    # 1e16 + (-1e16 + 1.0)
# left and right are not the same float
```

The second grouping asks for `-1e16 + 1`, which lands above 2\*\*53 in magnitude
where the grid spacing exceeds 1 — so the `1.0` is rounded away before the outer
addition ever runs. Nothing was computed incorrectly. Each step rounded
correctly, and the *order* decided which information survived.

Two consequences worth naming:

- **Addition is commutative but not associative.** `a + b == b + a` always: both
  round the same exact sum. `(a + b) + c == a + (b + c)` frequently not. A
  parallel, chunked or reordered reduction over floats is not guaranteed to
  match a serial one — "the threaded version gives a different total" is
  expected behaviour, not a race.
- **Catastrophic cancellation.** Subtracting two nearly equal floats gives a
  result whose leading digits cancel, promoting the accumulated error of both
  operands into the leading digits of the answer. The subtraction itself is
  exact — the difference of two nearby floats is representable — so the damage
  was done earlier and merely became visible here. Any formula containing
  `a - b` where `a ≈ b` should be algebraically rearranged before it is
  optimised.

Distributivity fails for the same reason: `a * (b + c)` and `a*b + a*c` round at
different points and are not required to agree.

## Gotchas

**★ `epsilon` is `ulp(1.0)` and nothing else.** Using it as a tolerance around
`1e6` is roughly 2^20 times too strict — the test essentially always fails.
Using it around `1e-10` is astronomically too loose — the test essentially
always passes. Scale to the magnitude with `math.isclose`'s `rel_tol`
(**07** *(not written yet)*) or with `math.ulp(x)`.

**★ `math.ulp(x)` for negative `x` returns `ulp(-x)`, so it is always
positive.** At an exponent boundary the gap *below* a float is half the gap
above it, so `x - math.ulp(x)` can skip a representable value. If you are
stepping the grid, use `nextafter` with an explicit direction; it handles the
boundary.

**★ `math.ulp` of a NaN returns the NaN, and of an infinity returns the
infinity.** So an ulp-scaled tolerance built as `n * math.ulp(x)` silently
becomes NaN or inf for non-finite `x`, and every comparison against it then
behaves in the way described in [06](06-nan-inf-and-signed-zero.md). Guard with
`math.isfinite` first.

**★ Subnormal arithmetic can be orders of magnitude slower.** On some hardware,
operations on denormalised values trap to microcode. A signal-processing or
decay loop whose values shrink towards zero can lose throughput with no change
in the code path and no change in the results. If the tiny values are
meaningless, flush them: `x = 0.0 if abs(x) < sys.float_info.min else x`.

**★ There is no `math.isnormal` or `math.issubnormal` in 3.14.** Do not reach
for them out of a C or NumPy habit. `0 < abs(x) < sys.float_info.min` is the
subnormal test; `math.isfinite(x)` is what validation code actually wants.

**★ Reordering a float reduction changes the answer, and it is not a bug to be
fixed.** Multiprocessing, `functools.reduce` with a different associativity, a
database `SUM()` over a different scan order and a serial Python loop can all
disagree in the last bits. Golden-value tests over float aggregates need a
tolerance or a canonical order — usually both.

**★ `x * 0.5` and `x / 2.0` are exact; `x * 0.1` and `x / 10.0` are neither
exact nor equal to each other.** Scaling by a power of two only adjusts the
exponent. Multiplying by the float nearest 0.1 is a genuine rounded multiply,
and dividing by the float nearest 10 rounds at a different point. Halving and
doubling are free; decimal scaling is not, and swapping `* 0.1` for `/ 10` in a
"cleanup" commit changes results.

**★ `while x != target: x += step` may never terminate.** `step` is inexact, so
`x` steps *over* `target` without ever landing on it. Count with an integer and
derive `x` from the counter: `x = start + i * step`. That also gives one
rounding per element instead of `i` accumulated ones.

**★ There is no float `range()`, and building one by repeated addition drifts
its endpoints.** `[start + i * step for i in range(n)]` is the correct
construction; a `while` loop that accumulates is not, and the last element is
where the difference shows.

## Interview questions

**★ Why is `2**53 + 1` not representable as a float, when much larger numbers
are?**
Because the significand is 53 bits. Up to 2\*\*53 the grid spacing is 1, so every
integer has a float. Just above it the spacing is 2, so only even integers do —
`2**53 + 1` falls in a gap and rounds to a neighbour. Larger values *are*
representable when they happen to be multiples of the local spacing; what is
lost above 2\*\*53 is not magnitude but resolution.

**★ Is floating-point addition associative? Commutative?**
Commutative yes: `a + b` and `b + a` round the same exact sum. Associative no.
`(a + b) + c` and `a + (b + c)` round at different points, and when one grouping
produces an intermediate large enough that the third operand falls below its
ulp, that operand's contribution vanishes completely. This is why parallel and
reordered reductions legitimately disagree with serial ones.

**★ A single operation is correctly rounded. Why can't I bound the error of a
whole calculation the same way?**
Because half an ulp is a *relative* bound, and the relevant magnitude changes at
every step. An intermediate that is large relative to the final answer carries an
absolute error that is large relative to the final answer, and a subsequent
cancellation exposes it in the leading digits. The bound on a chain depends on
the intermediates' magnitudes, not on the format, which is why numerical
analysis is a subject rather than a constant.

**★ What is catastrophic cancellation, and where is the error actually
introduced?**
It is the loss of significance when subtracting two nearly equal floats: the
agreeing leading digits cancel and the disagreeing trailing digits — which are
mostly accumulated rounding error — become the whole answer. The subtraction
itself is exact; the error was introduced when the operands were computed.
The fix is algebraic, such as rewriting `sqrt(x+1) - sqrt(x)` as
`1 / (sqrt(x+1) + sqrt(x))`, not a bigger tolerance.

**★ How do you write a tolerance that is correct at every magnitude?**
Make it relative, not absolute. `math.isclose(a, b, rel_tol=...)` scales with the
larger operand; `math.ulp(x)` gives the grid spacing at `x`, and
`math.nextafter(x, y, steps=n)` gives the value `n` grid steps away, which is
how an "within N ulps" test is written. An absolute tolerance is only correct
when you already know the magnitude — most importantly when comparing against
zero, where a relative tolerance is meaningless
(**07** *(not written yet)*).

**★ What is a subnormal, and why should an application developer care?**
A value below `sys.float_info.min` in magnitude, represented by dropping the
implicit leading significand bit and trading precision for range so that
underflow is gradual rather than abrupt. It matters for two reasons: precision
degrades silently as values shrink, with no error and no signal; and on some
hardware subnormal arithmetic is dramatically slower, so a decaying filter can
lose throughput with no visible change in the code.

**★ Two machines produce different results for the same float pipeline. What
are the plausible causes, in order?**
Different input (check `x.hex()` on both). Different reduction order —
threading, chunking, or a different library version reordering a sum. An
extended-precision intermediate on one platform's C library. A different
implementation of a transcendental function, which IEEE 754 does not require to
be correctly rounded. Actual differing arithmetic is last on the list and
essentially never the answer on mainstream hardware.

---

← Prev: [Inspecting and constructing floats](05b-inspecting-and-constructing-floats.md) · Index: [Numbers](README.md) · Next → [Accurate float arithmetic](05d-accurate-float-arithmetic.md)

{/* FOOTER */}
