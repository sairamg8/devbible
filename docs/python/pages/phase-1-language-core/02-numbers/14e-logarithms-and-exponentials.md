---
title: "Logarithms and exponentials are the one corner where the math function beats the operator, and the two-argument math.log is three roundings where math.log2 is one"
sidebar_label: "14e · Logarithms and exponentials"
sidebar_position: 144
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-01 against the Python 3.14
> [`math`](https://docs.python.org/3.14/library/math.html) reference (`log`,
> `log2`, `log10`, `exp`, `expm1`, `log1p`, `e`, and the CPython
> implementation-detail note), and
> [`int.bit_length`](https://docs.python.org/3.14/library/stdtypes.html#int.bit_length).
> Version spine: **Python 3.14.7**; `math.log2` added in **3.3**;
> `math.expm1` added in **3.2**.

**Everywhere else in this chunk set the operator wins and the `math` function
narrows to a float. Logarithms and exponentials invert that: `math.exp(x)` is
documented as more accurate than `math.e ** x`, and `math.log2(x)` as more
accurate than `math.log(x, 2)` — because the two-argument `math.log` is defined
as `log(x)/log(base)`, three roundings where the dedicated function is one. The
same family carries `expm1` and `log1p`, which exist because `1 + x` for a small
`x` destroys the information before your function ever runs. And when the
argument is a large integer, the answer is not a logarithm at all: the docs
point at `int.bit_length()`.**

## Logarithms

> *"With one argument, return the natural logarithm of x (to base e). With two
> arguments, return the logarithm of x to the given base, calculated as
> `log(x)/log(base)`."*

> *"`log2(x)` — Return the base-2 logarithm of x. This is usually more accurate
> than `log(x, 2)`."*

> *"`log10(x)` — Return the base-10 logarithm of x. This is usually more
> accurate than `log(x, 10)`."*

The reason is in the two-argument definition: `log(x, 2)` is *two* rounded
logarithms and then a rounded division — three roundings where `log2` is one.
The classic symptom is `math.log(2**29, 2)` type expressions coming out a hair
below an integer, so that an `int()` or `math.floor()` around them returns one
less than the right answer. **If the base is 2 or 10, never spell it as the
two-argument form.**

For the base-2 magnitude of a large integer the docs point somewhere else
entirely, in a "See also" under `log2`:

> *"`int.bit_length()` returns the number of bits necessary to represent an
> integer in binary, excluding the sign and leading zeros."*

That is exact at any size and involves no float. Whether `math.log` itself
special-cases large integer arguments is not stated in the documentation and I
could not confirm it — so for a huge `int`, reach for `bit_length` rather than
finding out.

### `exp`, and the two functions for values near zero

> *"`exp(x)` — Return e raised to the power x… This is usually more accurate
> than `math.e ** x` or `pow(math.e, x)`."*

Another case where the documentation states the preference directly. And the
pair for small arguments:

> *"`expm1(x)` — Return e raised to the power x, minus 1… For small floats x,
> the subtraction in `exp(x) - 1` can result in a significant loss of precision;
> the `expm1()` function provides a way to compute this quantity to full
> precision"*

> *"`log1p(x)` — Return the natural logarithm of 1+x (base e). The result is
> calculated in a way which is accurate for x near zero."*

These two exist because `1 + x` for tiny `x` throws away the information you
care about before the function ever runs. Interest rates, growth factors,
half-lives and log-likelihood accumulations are exactly the places small
arguments appear — see [05c](05c-the-float-number-line.md) for why the loss
happens.

## Gotchas

**★ `math.log(x, 2)` is three roundings where `math.log2(x)` is one.** The docs
say `log2` *"is usually more accurate"* and define the two-argument form as
literally *"`log(x)/log(base)`"*. The visible symptom is a result a hair below
an integer, so `int(math.log(n, 2))` returns one less than expected for exact
powers of two — which silently corrupts bucketing, bit-width and
size-class code.

**★ `math.e ** x` is documented as less accurate than `math.exp(x)`, and it
looks more explicit.** Same for `pow(math.e, x)`. The `exp` entry says it *"is
usually more accurate than `math.e ** x` or `pow(math.e, x)`"*. This is the one
place in the whole `math`-versus-operators comparison where the function is the
right answer and the operator is the trap, which is why people get it backwards.

**★ `math.log1p` and `math.expm1` exist because `1 + x` destroys small `x`
before your function runs.** Writing `math.log(1 + rate)` for a small rate is
the bug; `math.log1p(rate)` is the fix. The docs describe `exp(x) - 1` as
capable of *"a significant loss of precision"* for small floats and offer
`expm1` as the remedy — see [05c](05c-the-float-number-line.md) for why the
addition is where the information goes.

**★ `math.log(0.0)` raises `ValueError`, it does not return `-inf`.** The
module's implementation note names this case explicitly: the current
implementation raises *"`ValueError` for invalid operations like `sqrt(-1.0)` or
`log(0.0)` (where C99 Annex F recommends signaling invalid operation or
divide-by-zero)"*. Code ported from C or from NumPy, both of which produce
`-inf` there, changes from "a very negative number flows onward" to "an
exception aborts the batch".

**★ `math.exp(1000.0)` raises `OverflowError`.** The same note gives it as the
worked example of an overflowing result. So an exponential in a softmax or a
likelihood is an exception waiting for one large input, and the standard defence
— subtract the maximum before exponentiating — is a numerical technique, not a
try/except.

**★ For the magnitude of a huge integer, do not use a logarithm at all.** The
`log2` entry's own "see also" points at `int.bit_length()`, which *"returns the
number of bits necessary to represent an integer in binary, excluding the sign
and leading zeros"* — exact, integer-only, and unbounded. Whether `math.log`
special-cases large integer arguments is **not stated in the documentation** and
I could not confirm it; treat `math.log` as narrowing, like the rest of the
module, and use `bit_length`.

**★ Counting decimal digits with `math.log10` is off by one on exact powers of
ten, and `len(str(n))` has its own limit.** `int(math.log10(1000)) + 1` depends
on `log10(1000)` landing at exactly `3.0`. `len(str(n))` is exact but raises
above the integer-to-string conversion limit for very large `n` — see
[02](02-the-int-str-conversion-limit.md). For a bounded, exact answer that never
raises, derive it from `bit_length` or set `sys.set_int_max_str_digits`
deliberately.

**★ The base argument of `math.log` is documented positionally, as
`log(x[, base])`.** Writing `math.log(x, base=2)` is not the documented calling
convention for this C-implemented function. Beyond style, the deeper point
stands: if you find yourself passing a base of 2 or 10 at all, the dedicated
function is both more accurate and shorter.

**★ Accuracy claims in this family are hedged with "usually".** The docs say
`log2` *"is usually more accurate than `log(x, 2)`"*, not always. `math` is a
thin wrapper over the platform C library, and the accuracy of its transcendental
functions is the platform's. Use the dedicated functions because they are never
*worse*, not because a specific bit is guaranteed.

## Interview questions

**★ Why do `math.log2` and `math.log10` exist when `math.log` takes a base?**
Because the two-argument form is documented as being *"calculated as
`log(x)/log(base)`"* — two rounded logarithms and a rounded division, three
opportunities to lose the last bits — while `log2` and `log10` are single
library operations. The docs say each *"is usually more accurate than"* the
general form. The practical symptom is `int(math.log(n, 2))` returning one less
than expected for exact powers of two, which is a nasty bug in bucketing and
bit-width code because it is correct for most inputs.

**★ Why does the `math` documentation recommend `math.exp(x)` over
`math.e ** x`?**
Because `math.e ** x` is two operations — round `e` to a float, then raise it —
and the error in the stored `e` is amplified by the exponentiation, whereas
`exp` is a single library routine designed to be accurate across its range. The
docs put it plainly: `exp` *"is usually more accurate than `math.e ** x` or
`pow(math.e, x)`"*. It is the one place where the `math` function beats the
operator, which is exactly why it gets written the wrong way round.

**★ Where does `math.log1p` belong in real code?**
Anywhere `1 + x` appears inside a logarithm with a small `x`: continuously
compounded interest, small growth rates, log-likelihood accumulation, and any
`log(1 + epsilon)` error analysis. The addition rounds the small value away
against the `1` before `log` ever sees it, and no amount of care inside the
logarithm recovers it. `math.expm1` is the same argument in reverse for
`exp(x) - 1`, and the docs say so explicitly, calling out the *"significant loss
of precision"*.

**★ What does `math.log(0.0)` do, and why does that surprise people coming from
other stacks?**
It raises `ValueError`. C99 Annex F recommends signalling divide-by-zero and
returning `-inf`, and NumPy follows that with a warning rather than an
exception. Python's `math` implementation note says it raises instead. So a
formula ported from C or vectorised code changes character completely: what was
"a very negative number flows downstream and gets filtered later" becomes "the
whole batch aborts on one zero".

**★ How do you get the number of bits, or the number of decimal digits, of a
2000-digit integer?**
Bits: `n.bit_length()`, which the `log2` documentation itself points at and
which is exact and unbounded. Decimal digits: `len(str(n))` is exact but is
subject to the integer-to-string conversion limit ([02](02-the-int-str-conversion-limit.md)),
so it can raise `ValueError` for very large `n` unless the limit is raised
deliberately. What you should *not* do is `int(math.log10(n)) + 1`, because
`math.log10` narrows to a float and the boundary cases at exact powers of ten
are precisely where the rounding decides the answer.

**★ Is `math.log2(x)` guaranteed to be more accurate than `math.log(x, 2)`?**
No — the docs say *"usually"*, and that hedge is doing real work, because
`math` is documented as *"mostly thin wrappers around the platform C math
library functions"* and the accuracy of transcendentals is the platform's. What
you can rely on is the structural argument: `log(x, 2)` is defined in the
documentation as `log(x)/log(base)`, which is three rounded operations, and
`log2` is one. It cannot be worse, and it is usually better, so it is the right
default without needing a guarantee.

---

← Prev: [Powers and roots](14d-powers-roots-and-logs.md) · Index: [Numbers](README.md) · Next → [Aggregation and the rest](14f-aggregation-and-the-rest.md)

{/* FOOTER */}
