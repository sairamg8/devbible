---
title: "Infinity and NaN are ordinary float values with extraordinary rules: every ordered comparison with NaN is false, NaN is not equal to itself, and Python departs from IEEE 754 by raising on division by zero"
sidebar_label: "6 · NaN, infinity and signed zero"
sidebar_position: 60
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-31 against the Python 3.14 language reference
> [Value comparisons](https://docs.python.org/3.14/reference/expressions.html#value-comparisons),
> the library reference for
> [`math`](https://docs.python.org/3.14/library/math.html)
> (`inf`, `nan`, `isnan`, `isinf`, `isfinite`, `copysign`, and the CPython note
> on `ValueError`/`OverflowError`),
> [`float()`](https://docs.python.org/3.14/library/functions.html#float),
> [Hashing of numeric types](https://docs.python.org/3.14/library/stdtypes.html#hashing-of-numeric-types),
> and [`ZeroDivisionError`](https://docs.python.org/3.14/library/exceptions.html#ZeroDivisionError).
> Version spine: **Python 3.14.7**; `math.nan` *"always available"* since **3.11**.

**IEEE 754 defines three values that are not ordinary numbers: positive and
negative infinity, NaN, and negative zero. Python exposes all three as plain
`float` objects that flow through your code with no type marker, no warning and
no exception. NaN is the dangerous one, because it is the only value in the
language for which `x == x` is `False` — a fact the language reference states
outright, and which quietly breaks `in`, `sort`, `max`, deduplication, caching
and every range check ever written. Python also departs from IEEE 754 in one
significant place: `1.0 / 0.0` raises `ZeroDivisionError` rather than producing
an infinity, so infinities in Python code almost always arrive from parsing,
overflow, or another language's arithmetic. This chunk is the values and their
comparison rules; [06b](06b-detecting-nan-and-containers.md) is how to detect
them and what they do to your data structures, and
[06c](06c-signed-zero-and-serialisation.md) is negative zero and the
serialisation boundary.**

## The three special values, and where they come from

```python
import math

math.inf              # positive infinity
-math.inf             # negative infinity
math.nan              # a NaN
float("inf")          # same, from a string - and case-insensitive
float("-Infinity")    # also accepted
float("nan")          # a NaN, from a string, with no warning
-0.0                  # negative zero: a literal minus applied to a zero
```

`math.inf` and `math.nan` are documented as *"Equivalent to the output of
`float('inf')`"* and *"Equivalent to the output of `float('nan')`"*
respectively, and `math.nan` has been *"always available"* since 3.11.

The routes by which these values enter a real program, in rough order of
frequency:

1. **Parsing.** `float()` accepts `'inf'`, `'infinity'` and `'nan'` in any
   case, so any CSV importer, query-string parser, `argparse(type=float)` or
   JSON payload can inject one. This is the number one source and it is
   completely silent.
2. **Another runtime's arithmetic.** NumPy, pandas, a C extension, a GPU kernel
   or a JavaScript front end all follow IEEE 754 rather than Python's
   exception-raising conventions, so `0/0` and overflow there produce NaN and
   infinity that arrive in Python as ordinary floats.
3. **Arithmetic on values that are already special.** `inf - inf`, `inf / inf`
   and `0.0 * inf` are NaN under IEEE 754, and CPython inherits that from the C
   double operations.
4. **Overflow.** `math.exp(1000.0)` raises, but not every path does — see the
   warning below.

## Python is not IEEE 754 about division by zero

This is the single largest behavioural difference between Python floats and
those of C, Java, JavaScript, Go or SQL.

> *"`ZeroDivisionError`: Raised when the second argument of a division or modulo
> operation is zero."*

`1.0 / 0.0` raises. `0.0 / 0.0` raises. `1.0 % 0.0` raises. In C and JavaScript
those produce `+inf`, `NaN` and `NaN` respectively. So a numerical algorithm
ported line-by-line from C will start raising exceptions where the original
quietly propagated infinities — which is usually an improvement, and is always a
surprise.

The `math` module makes the same choice for domain errors, and documents it:

> *"The current implementation will raise `ValueError` for invalid operations
> like `sqrt(-1.0)` or `log(0.0)` (where C99 Annex F recommends signaling
> invalid operation or divide-by-zero), and `OverflowError` for results that
> overflow (for example, `exp(1000.0)`)."*

That parenthesis is the whole story: the C standard says *signal*, Python says
*raise*. Read together with `ZeroDivisionError`, it means that **Python's own
arithmetic and `math` module produce a NaN much more rarely than you would
expect**. Most NaNs in a Python process were manufactured somewhere else.

⚠️ **What the docs do not settle: whether plain operator overflow raises or
returns an infinity.** The specified rules are narrow — `math` functions raise
`OverflowError`, and `float()` raises `OverflowError` when *"the argument is
outside the range of a Python float"* for a **numeric** argument. The behaviour
of a float literal or string that exceeds the range, and of `*` or `**`
overflowing, is not stated in the reference. I could not confirm a documented
rule for those cases and will not guess at one. The engineering answer is the
same either way: do not build a program that depends on which it is. Check the
result with `math.isfinite()`.

## Infinity behaves, mostly

Infinities are well-ordered and comparable, which makes them genuinely useful:

```python
import math

best = math.inf                     # the classic minimisation sentinel
for cost in candidates:
    best = min(best, cost)

assert math.inf > 10 ** 1000        # bigger than any int, exactly
assert -math.inf < -10 ** 1000
assert math.inf == math.inf         # equal to itself, unlike NaN
```

The comparison against a huge `int` is exact, not a coincidence — the language
reference guarantees that *"A comparison between numbers of different types
behaves as though the exact values of those numbers were being compared."*
`math.inf` is genuinely larger than every finite number of every numeric type,
which is what makes it a correct sentinel where `sys.maxsize` is not.

Infinity hashes cleanly too:

> *"The particular values `sys.hash_info.inf` and `-sys.hash_info.inf` are used
> as hash values for positive infinity or negative infinity (respectively)."*

So `math.inf` is a perfectly good dict key and set member — unlike NaN.

The combinations that produce NaN are the IEEE ones: `inf - inf`, `inf / inf`,
`0.0 * inf` and `inf % anything`. Those are the arithmetic sinkholes: the moment
a sentinel infinity meets a subtraction, you have silently converted a
well-behaved sentinel into a value that breaks equality.

```python
timeout = math.inf                  # "no timeout"
remaining = timeout - elapsed       # NaN if elapsed is also inf -- and now
                                    # every comparison on `remaining` is False
```

## NaN: the value that is not equal to itself

The language reference states the rule and its consequence in consecutive
sentences, and both are worth memorising verbatim:

> *"The not-a-number values `float('NaN')` and `decimal.Decimal('NaN')` are
> special. Any ordered comparison of a number to a not-a-number value is
> false."*

> *"A counter-intuitive implication is that not-a-number values are not equal to
> themselves. For example, if `x = float('NaN')`, `3 < x`, `x < 3` and `x == x`
> are all false, while `x != x` is true. This behavior is compliant with IEEE
> 754."*

The `math.nan` entry says the same thing from the other direction:

> *"Due to the requirements of the IEEE-754 standard, `math.nan` and
> `float('nan')` are not considered to equal to any other numeric value,
> including themselves. To check whether a number is a NaN, use the `isnan()`
> function to test for NaNs instead of `is` or `==`."*

Note the explicit "instead of `is`". `x is math.nan` is `False` for a NaN that
came from anywhere else, because `math.nan` is one particular object and NaN-ness
is a property of the value, not the identity.

Two structural consequences follow, and they are the reason this matters beyond
trivia:

**Every range check silently changes meaning.** All four of these are `False`
when `x` is NaN:

```python
low <= x <= high        # False  -> "reject"
x < low or x > high     # False  -> "accept"
not (low <= x <= high)  # True   -> "reject"
x >= low                # False
```

So whether a NaN is accepted or rejected by your validator depends on whether
the author wrote the positive or the negative form of the test. Two validators
in the same codebase, written by two people, will disagree — and neither will
have a bug report, because neither will raise.

**NaN propagates.** Every arithmetic operation with a NaN operand produces a
NaN, so one bad value in one row turns an entire aggregate into NaN with no
traceback and no log line. The first visible symptom is usually a blank chart or
an alert that never fires.

## Gotchas

**★ `1.0 / 0.0` raises, so you cannot get an infinity the C way.** Everyone who
has written numerical code in another language reaches for division by zero to
produce infinity and gets `ZeroDivisionError` instead. Use `math.inf`. The
inverse trap is worse: code ported *from* Python into a NumPy vectorised form
stops raising and starts producing infinities, so a bug that used to crash
loudly begins returning plausible garbage.

**★ `float('nan')` from user input passes every validator you wrote as a range
check.** Or fails every one, depending on how the check was spelled. Neither is
a decision you made. Put `math.isfinite()` at the boundary — before the range
check, not after.

**★ `x is math.nan` is not a NaN test.** The `math.nan` docs say to use
`isnan()` *"instead of `is` or `==`"*. There are 2^52 - 1 distinct NaN bit
patterns and any number of distinct NaN objects; identity tests one specific
object. It will pass in the REPL where you typed `math.nan` yourself and fail
on the NaN that came from the API.

**★ `math.inf - math.inf` is NaN, so an infinite sentinel is only safe under
comparison, never under arithmetic.** `math.inf` as "no deadline" is fine while
you only ever compare it; the moment something computes `deadline - now`, the
sentinel becomes a NaN and every subsequent comparison is `False`. Branch on the
sentinel before doing arithmetic with it.

**★ `math.sqrt(-1)` raises `ValueError` rather than returning NaN, so "NaN
propagation" is not a strategy that works in Python.** Code that expects a NaN
to flow through a chain of `math` calls the way it would in C will get an
exception at the first domain error instead. That is better behaviour, but it
means porting requires reading, not translating.

**★ `math.isfinite(x)` is the check; `type(x) is float` is not.** A NaN is a
`float`. An infinity is a `float`. `isinstance(x, float)` tells you nothing
about whether the value is usable, and static type checkers will not help
either: `float` includes all of these in the type system.

## Interview questions

**★ Why is `float('nan') == float('nan')` `False`?**
Because IEEE 754 defines NaN as unordered with respect to every value including
itself, and Python implements that faithfully. The language reference states it
directly: *"Any ordered comparison of a number to a not-a-number value is
false"*, with the *"counter-intuitive implication […] that not-a-number values
are not equal to themselves."* NaN represents "the result of an invalid
operation", and two invalid operations having produced the same bit pattern does
not mean they produced the same number.

**★ How do you test whether a float is NaN, and why not `==`?**
`math.isnan(x)`. `==` cannot work because NaN compares unequal to everything
including itself, so `x == float('nan')` is always `False`. `is` cannot work
either because NaN-ness is a property of the value, not of an object identity,
and the docs say so explicitly.

**★ What does Python do differently from IEEE 754?**
Division and modulo by zero raise `ZeroDivisionError` instead of producing
infinity or NaN, and the `math` module raises `ValueError` for domain errors and
`OverflowError` for overflow, where C99 Annex F would signal and continue. The
docs state this as a CPython implementation note. The value semantics of the
floats themselves are unchanged — only the error handling differs.

**★ A validator does `if not (0 <= score <= 100): reject`. What does it do with
NaN?**
It rejects it. `0 <= nan` is `False`, so the chained comparison is `False`, and
the negation makes the branch fire. Now consider the sibling formulation
`if score < 0 or score > 100: reject`: both comparisons are `False`, so the
branch does not fire and the NaN is **accepted**. Two spellings of the same
intent, opposite outcomes, no error either way. That is the argument for
`math.isfinite` as a separate first check rather than trusting a range test.

**★ Where do NaNs actually come from in a Python program?**
Overwhelmingly from outside Python's own arithmetic: `float('nan')` parsed from
input, NumPy or pandas (where `0/0` does not raise), a C extension, a database
`NULL` mapped to NaN, or a JSON payload — `json` accepts `NaN` and `Infinity` by
default. Within pure Python, the main internal source is arithmetic on
infinities: `inf - inf`, `inf / inf`, `0.0 * inf`.

**★ Why is `math.inf` a better sentinel than `sys.maxsize` or a large
constant?**
Because it is genuinely larger than every finite number of every numeric type,
and cross-type comparison is exact — *"as though the exact values of those
numbers were being compared"*. `sys.maxsize` is just a large `int` and Python
integers are unbounded, so a real value can exceed it. The caveat is that
`math.inf` must never be fed into arithmetic, or it becomes NaN.

---

← Prev: [Accurate float arithmetic](05d-accurate-float-arithmetic.md) · Index: [Numbers](README.md) · Next → [Detecting NaN, and NaN inside containers](06b-detecting-nan-and-containers.md)

{/* FOOTER */}
