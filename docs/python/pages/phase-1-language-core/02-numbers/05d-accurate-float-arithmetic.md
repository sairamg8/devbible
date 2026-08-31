---
title: "The standard library ships four accumulators that beat a += loop — sum() since 3.12, math.fsum, math.sumprod and math.fma — and switching to them is a free accuracy win"
sidebar_label: "5d · Accurate float arithmetic"
sidebar_position: 53
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-31 against the Python 3.14 library reference for
> [`math.fsum` / `math.sumprod` / `math.fma`](https://docs.python.org/3.14/library/math.html),
> [`sum()`](https://docs.python.org/3.14/library/functions.html#sum),
> [`time`](https://docs.python.org/3.14/library/time.html#time.time_ns),
> and the tutorial appendix
> [Floating-Point Arithmetic](https://docs.python.org/3.14/tutorial/floatingpoint.html).
> Version spine: **Python 3.14.7**; `math.fma` **added in 3.13**,
> `math.sumprod` and the improved float `sum()` **added in 3.12**.

**A `total = 0.0` loop with `total += x` is the worst float accumulator Python
offers, and almost every codebase is full of them. Since 3.12 the builtin
`sum()` uses extended precision for its intermediate steps, `math.fsum` tracks
every lost digit and rounds exactly once, `math.sumprod` does the same for dot
products, and `math.fma` collapses a multiply-add into a single rounding. All
four are faster to type than the loop they replace, three of them are faster to
run, and the documentation states the accuracy difference outright rather than
leaving it to folklore.**

## `sum()` — improved in 3.12, and free

> *"Changed in version 3.12: Summation of floats switched to an algorithm that
> gives higher accuracy and better commutativity on most builds."*

> *"Changed in version 3.14: Added specialization for summation of complexes,
> using same algorithm as for summation of floats."*

The tutorial demonstrates the difference with the plainest case available: the
ten-term chain `0.1 + 0.1 + ... + 0.1 == 1.0` is `False`, while
`sum([0.1] * 10) == 1.0` is `True`. Same values, same additions, different
accumulator. The tutorial explains why:

> *"It uses extended precision for intermediate rounding steps as values are
> added onto a running total. That can make a difference in overall accuracy so
> that the errors do not accumulate to the point where they affect the final
> total."*

🔴 **This is the highest-value line in the topic: replacing a `total = 0.0` /
`total += x` loop with `sum(values)` on 3.12+ is a free accuracy improvement
that also runs faster, because the loop moves into C.**

```python
# before
total = 0.0
for row in rows:
    total += row.amount

# after
total = sum(row.amount for row in rows)
```

## `math.fsum()` — exact, with a single rounding

> *"Return an accurate floating-point sum of values in the iterable. Avoids loss
> of precision by tracking multiple intermediate partial sums."*

The tutorial's framing is the one to remember:

> *"The `math.fsum()` goes further and tracks all of the 'lost digits' as values
> are added onto a running total so that the result has only a single rounding.
> This is slower than `sum()` but will be more accurate in uncommon cases where
> large magnitude inputs mostly cancel each other out leaving a final sum near
> zero."*

The appendix publishes a six-element array of values around ±1e14 that cancel
down to a result near 1e-13, on which `fsum` matches exact rational summation
while a straight `+=` loop — the tutorial's own comment — has *"no correct
digits"*. That is the shape of input `fsum` exists for: large magnitudes, heavy
cancellation, small answer. Residuals, least-squares terms, physics
conservation checks, ledger reconciliations that should net to zero.

The caveat is documented too:

> *"On some non-Windows builds, the underlying C library uses extended precision
> addition and may occasionally double-round an intermediate sum causing it to
> be off in its least significant bit."*

So `fsum` is "single rounding" as a design goal, not a last-bit cross-platform
guarantee. If you need a total that is *provably* exact, sum `Fraction` or
`Decimal` objects and convert at the end — which is exactly what the tutorial
does to produce the reference value in its example.

## `math.sumprod()` — dot products without the intermediate damage

> *"Return the sum of products of values from two iterables `p` and `q`. […]
> Raises `ValueError` if the inputs do not have the same length."*

> *"For float and mixed int/float inputs, the intermediate products and sums are
> computed with extended precision."*

> *"Roughly equivalent to: `sum(map(operator.mul, p, q, strict=True))`"*

Every weighted average, every inner product, every `sum(w * x for w, x in
zip(weights, values))` in a scoring or ranking function is a candidate. Two
wins, not one: better accuracy, and a `ValueError` on a length mismatch that the
generator-plus-`zip` version silently swallows by truncating to the shorter
input.

```python
import math

def weighted_mean(values: list[float], weights: list[float]) -> float:
    return math.sumprod(values, weights) / math.fsum(weights)
```

## `math.fma()` — one rounding for a multiply-add

> *"Fused multiply-add operation. Return `(x * y) + z`, computed as though with
> infinite precision and range followed by a single round to the `float` format.
> This operation often provides better accuracy than the direct expression
> `(x * y) + z`."*

> *"This function follows the specification of the fusedMultiplyAdd operation
> described in the IEEE 754 standard. The standard leaves one case
> implementation-defined, namely the result of `fma(0, inf, nan)` and
> `fma(inf, 0, nan)`. In these cases, `math.fma` returns a NaN, and does not
> raise any exception."*

It had to be a function: the expression `x * y + z` is *defined* to round twice,
and an interpreter is not free to fuse it, because fusing changes results.

```python
import math

def horner(coeffs: list[float], x: float) -> float:
    """Evaluate a polynomial with one rounding per term instead of two."""
    acc = 0.0
    for c in coeffs:
        acc = math.fma(acc, x, c)
    return acc
```

`fma` is also the standard building block for computing the exact error of a
multiplication: `err = math.fma(a, b, -(a * b))` is the part of the product that
the rounding discarded. That two-line trick is the foundation of
double-double arithmetic and of every "compensated" algorithm.

## Where the grid bites in ordinary application code

- **Loop accumulators.** `total += price` over ten thousand rows drifts. Use
  `sum()`, `math.fsum()`, or integer minor units.
- **Timestamps.** `time.time()` returns seconds as a float and the epoch is
  currently around 1.7e9, so the grid spacing there is a fraction of a
  microsecond and doubles at every power of two. The docs prescribe the fix for
  every clock in the module: *"Use `time_ns()` to avoid the precision loss
  caused by the `float` type."* Measure with `time.perf_counter_ns()` and
  subtract integers.
- **Money.** Not a float, ever. `Decimal` or integer minor units.
- **Percentages and scaling.** `x * 100 / 100` is not `x`; `x / 100 * 100` is
  not `x` either, and the two are not even the same wrong answer.
- **Averages of large, similar values.** `sum(xs) / len(xs)` on values clustered
  far from zero loses the variation you care about. `statistics.fmean` exists
  for exactly this and is documented to be both faster and to convert its input
  to float first.

## Gotchas

**★ `sum()` being accurate is version-dependent, and the docs hedge with "on
most builds".** On 3.11 and earlier, `sum([0.1] * 10) == 1.0` is not guaranteed.
A test that asserts a float total to the last bit is asserting the interpreter
version's accumulator strategy, not your code's correctness. Assert with a
tolerance (**07** *(not written yet)*).

**★ `math.fsum` returns a `float`, not an exact value.** It performs a single
correct rounding of the exact sum. If that exact sum is not representable you
still get the nearest float. `fsum` removes *accumulated* error, never
*representation* error. For a genuinely exact total, sum `Fraction` or `Decimal`
objects.

**★ `sum()` on `Decimal` or `Fraction` does not use the float algorithm.** The
3.12 improvement is a specialisation for floats (and in 3.14 for complexes).
With `Decimal` items you get ordinary `Decimal` addition under the current
context — exact for the addition itself, but subject to context precision and
rounding, which is a different set of rules and a different set of surprises.

**★ `sum()` starts at the integer `0`, so `sum([])` is `0`, not `0.0`.** A
function annotated `-> float` that returns `sum(values)` returns an `int` for an
empty input. Downstream code that does `f"{total:.2f}"` still works, but code
that does `total.is_integer()` or `total.hex()` raises `AttributeError`. Pass
`start=0.0` when the return type matters.

**★ `math.fsum` and `math.sumprod` consume an iterable exactly once, and
`fsum` needs all of it.** Neither is the constant-state reduction a `+=` loop
is: `fsum` is documented as *"tracking multiple intermediate partial sums"*, so
it carries state beyond a single accumulator. Treat it as a batch operation over
a finite iterable rather than a streaming reduction; for genuinely unbounded
streams, accumulate in integers or in `Decimal`.

**★ `math.sumprod` raising `ValueError` on length mismatch is a behaviour
change from the `zip` idiom it replaces.** `sum(w * x for w, x in zip(a, b))`
silently truncates to the shorter sequence; `sumprod` raises. That is an
improvement, but it will surface latent bugs the first time you switch, and the
failure will look like a regression in code you did not touch.

**★ `math.fma(0, inf, nan)` returns NaN and raises nothing.** The docs call out
that this case is implementation-defined in IEEE 754 and state Python's choice.
Do not write a check that depends on an exception here; check the operands with
`math.isfinite` if the distinction matters.

**★ Switching a `+=` loop to `sum()` changes results, including in your golden
tests.** It changes them for the better, but a snapshot test that captured
seventeen digits of an old total will fail. That failure is the change working;
replace the assertion with a tolerance rather than re-baselining to the new
seventeen digits, or the next accumulator improvement will break it again.

**★ `statistics.mean` and `sum()/len()` are not interchangeable.** `mean` goes
to some lengths to be accurate on exact input types; `fmean` converts to float
and is the fast path. Reaching for `sum(xs)/len(xs)` in a hot loop is defensible;
reaching for it in a statistics routine is how a variance comes out negative.

## Interview questions

**★ What changed about `sum()` in 3.12, and what should I do differently?**
*"Summation of floats switched to an algorithm that gives higher accuracy and
better commutativity on most builds."* Practically: replace `total = 0.0` /
`total += x` loops with `sum(values)`. It is both faster and more accurate. The
tutorial's demonstration is that the ten-term `+` chain of `0.1` does not equal
`1.0` while `sum([0.1] * 10)` does.

**★ When do you need `math.fsum` rather than `sum`?**
When the inputs span large magnitudes and mostly cancel, leaving a small result
— which is the docs' own framing. `fsum` tracks every lost digit and rounds once
at the end, so it is correct even when the partial sums are enormous relative to
the answer. It is slower than `sum`, and it carries a documented last-bit caveat
on builds whose C library uses extended-precision addition.

**★ Why does the tutorial's six-element example lose every digit under `+=` but
not under `fsum`?**
Because the array holds values around 1e14 that nearly cancel to a result around
1e-13. Each partial sum is rounded at the 1e14 scale, where the ulp is vastly
larger than the final answer, so the information that *constitutes* the answer
is rounded away before the cancellation can expose it. `fsum` keeps the partial
sums exactly and rounds once at the end, when the magnitude is small.

**★ What is `math.fma` for, and why did it need to be a function?**
It computes `x * y + z` with a single rounding rather than two, implementing the
IEEE 754 `fusedMultiplyAdd` operation. It had to be a function because the
expression `x * y + z` is defined to round twice and an implementation is not
free to fuse it — fusing changes results. It matters in polynomial evaluation,
dot products, and iterative refinement, where double rounding dominates the
error. It is also how you extract the exact rounding error of a product:
`math.fma(a, b, -(a * b))`.

**★ What does `math.sumprod` give you over a generator expression?**
Extended-precision intermediates for the products *and* the sum, a C-speed loop,
and a `ValueError` on length mismatch instead of `zip`'s silent truncation. It
is the correct default for any weighted sum.

**★ Your service records durations as `time.time()` deltas and the numbers look
quantised. Why, and what is the fix?**
The Unix epoch is around 1.7e9 seconds; at that magnitude the float grid spacing
is a fraction of a microsecond and doubles every time the epoch crosses a power
of two, so sub-microsecond durations quantise and will get worse over time. The
docs give the fix for every clock in the module: *"Use `time_ns()` to avoid the
precision loss caused by the `float` type."* Use `perf_counter_ns()` and
subtract integers.

**★ How would you sum a million floats and get a provably exact answer?**
Not with any float accumulator, including `fsum` — all of them end with a
rounding to binary64. Sum `Fraction` objects (exact rational arithmetic, slow,
denominators grow) or `Decimal` objects with a sufficient context precision, and
convert once at the end. That is precisely what the tutorial does to generate
the reference value it compares `fsum` against.

**★ Is `sum(reversed(xs))` the same as `sum(xs)`?**
Not necessarily, even on 3.12+ — "better commutativity" is not "guaranteed
order-independence". Extended-precision intermediates make disagreement much
rarer; they do not make it impossible. If your test compares two orderings, it
needs a tolerance.

---

← Prev: [The float number line](05c-the-float-number-line.md) · Index: [Numbers](README.md) · Next → [NaN, infinity and signed zero](06-nan-inf-and-signed-zero.md)

{/* FOOTER */}
