---
title: "int is arbitrary precision: there is no overflow, no long, and no wraparound — the only limits are memory and arithmetic time"
sidebar_label: "1 · int never overflows"
sidebar_position: 1
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-28 against the Python 3.14 library reference
> [Numeric Types — int, float, complex](https://docs.python.org/3.14/library/stdtypes.html#numeric-types-int-float-complex),
> [Integer string conversion length limitation](https://docs.python.org/3.14/library/stdtypes.html#integer-string-conversion-length-limitation),
> the [language reference on numeric literals](https://docs.python.org/3.14/reference/lexical_analysis.html#numeric-literals),
> [`sys.maxsize`](https://docs.python.org/3.14/library/sys.html#sys.maxsize) and
> [`sys.int_info`](https://docs.python.org/3.14/library/sys.html#sys.int_info),
> the [Java Language Specification §15.18.2](https://docs.oracle.com/javase/specs/jls/se21/html/jls-15.html#jls-15.18.2)
> and [ECMA-262 §21.1.2.6](https://262.ecma-international.org/15.0/index.html#sec-number.max_safe_integer).
> Version spine: **Python 3.14.7**.

**Python has exactly one integer type and it has no maximum value. Not a large
maximum — none. `2 ** 10000` is an ordinary `int`, arithmetic on it is exact,
and nothing wraps, saturates or silently becomes a float. Every habit you carry
from Java, C or JavaScript about picking a width, watching for overflow, or
switching to `BigInteger`/`BigInt` past some threshold is dead weight here.
What replaces those habits is a much shorter list: integer arithmetic costs
time proportional to the size of the numbers, every integer is a separately
allocated heap object, and base-10 string conversion is capped by default at
4300 digits.**

## The rule, from the reference

The library reference states it in four words, inside the sentence that
introduces the three numeric types:

> *"There are three distinct numeric types: integers, floating-point numbers,
> and complex numbers. In addition, Booleans are a subtype of integers.
> **Integers have unlimited precision.**"*

The lexical analysis chapter says the same thing about the literals you type:

> *"There is no limit for the length of integer literals apart from what can be
> stored in available memory."*

There is no `int` versus `long` distinction to learn. Python 2 had both;
Python 3 merged them into one type. Code that calls `long(x)` or reads
`sys.maxint` is Python 2 code.

```python
import math

n = 2 ** 1000                        # an ordinary int
n * n                                # exact, still an int
math.factorial(100)                  # 158 digits, exact
(2 ** 63) + 1                        # not special in any way
```

## What this replaces in Java, C and JavaScript

Hold the contrast precisely, because the failure modes in those languages are
exactly what Python's design deletes.

**Java.** `int` is 32-bit two's complement, `long` is 64-bit, and overflow is
silent. JLS §15.18.2:

> *"If an integer addition overflows, then the result is the low-order bits of
> the mathematical sum as represented in some sufficiently large
> two's-complement format. If overflow occurs, then the sign of the result is
> not the same as the sign of the mathematical sum of the two operand values."*

That is the mechanism behind the classic binary-search bug: `int mid = (low +
high) / 2;` overflows to a negative index for large arrays. In Python the same
expression is simply correct, for any size of list, forever. Exactness in Java
means opting in to `BigInteger`, with method-call arithmetic and allocation
cost — the thing Python gives you by default.

**JavaScript.** There is no integer type at all; `Number` is an IEEE-754
double. ECMA-262 on the boundary:

> *"Due to rounding behaviour necessitated by precision limitations of IEEE
> 754-2019, the Number value for every integer greater than
> `Number.MAX_SAFE_INTEGER` is shared with at least one other integer. Such
> large-magnitude integers are therefore not safe, and are not guaranteed to be
> exactly representable as Number values or even to be distinguishable from
> each other. For example, both 9007199254740992 and 9007199254740993 evaluate
> to the Number value 9007199254740992."*

`Number.MAX_SAFE_INTEGER` is `2**53 - 1`. JavaScript later bolted on `BigInt`
as a *separate* type with its own literal suffix and no implicit mixing with
`Number`. Python never needed the split.

**C.** Signed overflow is *undefined behaviour*, which is worse than wrapping:
the compiler is entitled to assume it cannot happen and to optimise on that
assumption.

## What arbitrary precision actually costs

Three real costs, and "overflow" is not among them.

**Memory.** An `int` is a heap object with a header plus a variable-length
array of digits. `sys.int_info` describes the internal base:

> *"The number of bits held in each digit. Python integers are stored
> internally in base `2**int_info.bits_per_digit`."*

A million-bit integer occupies roughly a million bits plus object overhead.
Fine for one; ruinous for a list of ten million small ones, each of which is
still a full object with a refcount and a type pointer.

**Time.** Arithmetic is not O(1). Addition is linear in the number of digits
and multiplication is worse, so a loop that repeatedly squares a growing value
is super-linear in a way that Java intuition will not predict. For ordinary
application integers this never matters; for cryptographic or combinatorial
code it dominates.

**Base-10 string conversion.** `str(n)` and `int(s)` for huge `n` are
sub-quadratic at best. The reference is blunt about it:

> *"There exists no algorithm that can convert a string to a binary integer or
> a binary integer to a string in linear time, unless the base is a power of 2.
> Even the best known algorithms for base 10 have sub-quadratic complexity."*

CPython therefore caps that conversion. It has its own chunk:
[the integer string conversion limit](02-the-int-str-conversion-limit.md).

## `sys.maxsize` is not the maximum integer

This is the most common false lead in the topic. `sys.maxsize` exists, it is
`2**63 - 1` on a 64-bit build, and it has nothing to do with the range of
`int`:

> *"An integer giving the maximum value a variable of type `Py_ssize_t` can
> take. It's usually `2**31 - 1` on a 32-bit platform and `2**63 - 1` on a
> 64-bit platform."*

`Py_ssize_t` is the C type CPython uses for container lengths and indices. So
`sys.maxsize` bounds how many elements a list may hold, not how large a number
may be. `sys.maxint` does not exist in Python 3 — it was removed along with the
`int`/`long` merge, and a `sys.maxint` `AttributeError` is a reliable sign of
Python 2 code.

## `/` is never integer division

Two operators, two return types, and only one of them is exact for large
values:

```python
10 ** 30 // 3        # exact int
10 ** 30 / 3         # float — 30 significant digits do not fit in 53 bits
```

The language reference:

> *"Division of integers yields a float, while floor division of integers
> results in an integer; the result is that of mathematical division with the
> 'floor' function applied to the result."*

So `/` on two `int`s silently leaves the exact world. On values below `2**53`
that is harmless; above it, the result is wrong in the low digits and nothing
warns you. The floor semantics of `//` are their own subject —
[floor division and modulo](08-floor-division-and-modulo.md).

## Gotchas

### `sys.maxsize` used as "the biggest int"
**Symptom.** A guard `if total > sys.maxsize: raise OverflowError(...)` never
fires; or `INF = sys.maxsize` is used as the initial value of a
minimum-cost search and a legitimate cost exceeds it, so the search returns the
sentinel.
**Cause.** `sys.maxsize` bounds `Py_ssize_t`, not `int`. Python integers sail
past it without comment.
**Fix.** Use `math.inf`, which compares greater than every finite number
including every arbitrarily large `int`:

```python
import math

best = math.inf
for cost in costs:
    best = min(best, cost)
```

### A "safe" integer range copied from another language
**Symptom.** Code defends against overflow that cannot happen —
`if abs(n) > 2**31 - 1: raise ValueError("too large")` — and rejects perfectly
valid data.
**Cause.** A width was imported from the Java or C version of the algorithm.
**Fix.** Delete the check, unless the value is about to *leave* Python (see
[boundaries](01c-identity-and-boundaries.md)), in which case bound
it against the receiving system's width, not an imagined Python one.

### Ten million integers in a list
**Symptom.** Memory blows up on data that "is only a few million numbers".
**Cause.** Every `int` is a separate heap object with a header. There is no
unboxed integer array in core Python; a `list` of `int` is a list of pointers.
**Fix.** `array.array("q", values)` for packed fixed-width storage, or NumPy —
accepting that both reintroduce overflow, which becomes your problem to bound:

```python
import array

packed = array.array("q", values)    # signed 64-bit, 8 bytes each, no per-item object
```

### `total / count` used for an integer quotient
**Symptom.** A count-based value comes back as `2.5`, or an exact large
quotient is off by a few units in its last digits.
**Cause.** `/` is true division and always produces a `float`, even for two
`int` operands, and a `float` carries only 53 bits of significand.
**Fix.** `//` when the answer is meant to be a whole number. For an exact
non-integer ratio of big integers, `fractions.Fraction(a, b)` — see
[`Fraction`](11-fraction.md).

### Timing a benchmark with numbers that keep growing
**Symptom.** A "constant work per iteration" loop gets steadily slower.
**Cause.** The integers themselves are growing, and bignum arithmetic is
linear-or-worse in digit count. `product *= i` inside a loop is not O(1) per
step.
**Fix.** Nothing to fix in the arithmetic — but do not report the result as if
each iteration did the same work, and do not conclude the interpreter is at
fault.

## Interview questions

**What is the maximum value of an `int` in Python?**
There isn't one. `int` has unlimited precision; the only bounds are available
memory and the time arithmetic takes on very large values. Python 3 has a
single integer type — the Python 2 `int`/`long` split was removed. An answer of
`sys.maxsize` confuses the container-index limit with the numeric range.

**Why does Python have no integer overflow, and what did it give up to get
that?**
It gave up constant-time arithmetic and compact storage. An `int` is a
variable-length bignum, so addition is O(digits), multiplication is worse, and
every value is a separately allocated heap object. In exchange, an entire class
of bug — silent wraparound, the `(low + high) / 2` binary-search overflow,
off-by-one at `2**31` — cannot occur in pure Python. For the kind of code
Python is used for, where integers are almost always small, that trade is
overwhelmingly favourable.

**Your service computes a checksum in a loop and the CPU profile is dominated
by one multiply. What might be going on?**
The value being multiplied may be growing without bound. In C the intermediate
would be truncated to a machine word; in Python it is not, so each iteration
multiplies larger and larger bignums and the loop is quadratic in the number of
iterations. The fix is to mask to the intended width on every step — covered in
[bitwise operations](01b-bitwise-operations.md).

**Is `10**30 / 3` exact?**
No. `/` always returns a `float`, and an IEEE-754 double has 53 bits of
significand — roughly 15–17 significant decimal digits. A 30-digit numerator
cannot survive. `10**30 // 3` is exact because floor division of two `int`s
returns an `int`, and `Fraction(10**30, 3)` is exact and non-truncating.

**How does Python's integer model compare to Java's and JavaScript's, in one
sentence each?**
Java: fixed widths with silent two's-complement wraparound, and an opt-in
`BigInteger` for exactness. JavaScript: no integer type at all — `Number` is a
double, exact only to `2**53 - 1`, with a separate non-interoperating `BigInt`
type added later. Python: one unbounded integer type, exact always, at the cost
of allocation and non-constant-time arithmetic.

---

← Prev: [Phase 1 — Language core](../README.md) · Index: [Numbers](README.md) · Next → [Bitwise on an infinite width](01b-bitwise-operations.md)
