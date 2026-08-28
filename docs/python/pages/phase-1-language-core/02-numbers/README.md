---
title: "Numbers: int never overflows, float is IEEE-754 and lies about 0.1, and division floors toward minus infinity"
sidebar_label: "02 · Numbers"
sidebar_position: 2
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-28 against the Python 3.14 library reference
> ([Numeric Types](https://docs.python.org/3.14/library/stdtypes.html#numeric-types-int-float-complex),
> [the integer string conversion limit](https://docs.python.org/3.14/library/stdtypes.html#integer-string-conversion-length-limitation),
> [`sys`](https://docs.python.org/3.14/library/sys.html),
> [`math`](https://docs.python.org/3.14/library/math.html),
> [`decimal`](https://docs.python.org/3.14/library/decimal.html),
> [`fractions`](https://docs.python.org/3.14/library/fractions.html),
> [`numbers`](https://docs.python.org/3.14/library/numbers.html)),
> the language reference
> ([numeric literals](https://docs.python.org/3.14/reference/lexical_analysis.html#numeric-literals),
> [binary arithmetic operations](https://docs.python.org/3.14/reference/expressions.html#binary-arithmetic-operations)),
> the tutorial appendix
> [Floating-Point Arithmetic: Issues and Limitations](https://docs.python.org/3.14/tutorial/floatingpoint.html),
> and [PEP 515](https://peps.python.org/pep-0515/) / [PEP 3141](https://peps.python.org/pep-3141/).
> Version spine: **Python 3.14.7**.

**Python's numeric model is unusually honest and unusually easy to half-learn.
`int` has no maximum — none, not a large one — so an entire class of overflow
bug simply cannot occur, and the only size limit anywhere is a 4300-digit cap
on *base-10 string conversion* that exists to stop a denial-of-service attack.
`float` is a plain IEEE-754 double, with every consequence that implies:
`0.1 + 0.1 + 0.1 == 0.3` is `False`, `float('nan') != float('nan')` is `True`,
and `repr` shows you the shortest decimal that round-trips rather than the
value actually stored. `Decimal` is what money needs, with a context, a
precision measured in *significant digits* rather than decimal places, and
`ROUND_HALF_EVEN` as its default — which is not what an accountant expects.
And division floors toward minus infinity, so `-7 // 2` is `-4` and `-7 % 2` is
`1`, which is the opposite of what Java, C and JavaScript do.**

🚧 **This topic is in flight** — the chunks below are the ones written so far.

| # | Chunk | Covers |
|---|---|---|
| 1 | **[`int` never overflows](01-int-never-overflows.md)** | Unlimited precision, the Java/C/JavaScript contrast, what arbitrary precision costs, and why `sys.maxsize` is not the maximum integer |
| 1b | **[Bitwise on an infinite width](01b-bitwise-operations.md)** | Two's complement with infinitely many sign bits, `~x == -(x+1)`, `>>` as floor division, and why every ported 32-bit hash needs a mask |
| 1c | **[Identity and boundaries](01c-identity-and-boundaries.md)** | The small-integer cache and why `is` is never right for numbers, numeric hashing, and every boundary where overflow comes back — starting with 64-bit IDs in JSON |
| 2 | **[The int↔str digit limit](02-the-int-str-conversion-limit.md)** | CVE-2020-10735, the 4300-digit default, which APIs are affected, and why the failure usually surfaces in a log line |
| 2b | **[Configuring and avoiding it](02b-configuring-and-avoiding-the-limit.md)** | `PYTHONINTMAXSTRDIGITS`, `-X`, `sys.set_int_max_str_digits`, why the scope is interpreter-wide, and the exempt conversions you should use instead |
| 3 | **[Numeric literals](03-numeric-literals.md)** | `0x`/`0o`/`0b`, the leading zero that is a `SyntaxError`, imaginary literals, and `1e6` being a `float` |
| 3b | **[Underscores and constructors](03b-underscores-and-constructors.md)** | PEP 515 placement rules, `_` as a format separator, and the strictly larger language `int()` and `float()` accept |

⚠️ **This topic is incomplete — it covers integers and is short its float half.**
Written: unlimited-precision `int`, bitwise on an infinite width, identity and the
int↔str digit limit, literals and constructors. **Not written:** `bool` as an `int`
subclass, `float` and IEEE-754, NaN/infinity/signed zero, comparing floats,
floor division and modulo, `round()` and banker's rounding, `Decimal` for money,
`Fraction`, conversions and precision loss, `complex` and the numeric tower, and
`math` versus the operators. The session was wound down at 97% weekly usage with
the fork mid-topic; it spent its last action on this index so nothing landed
unreachable. **Forward references to those chunks are plain bold text, not links** —
there is no dangling link in this topic.
## The four questions this topic exists to answer

> *Why is `-7 // 2` equal to `-4`?*

Because `//` is **floored**, not truncated. The language reference: *"the result
is that of mathematical division with the 'floor' function applied to the
result."* Java and C truncate toward zero and give `-3`. Python's choice keeps
the invariant `x == (x//y)*y + (x%y)` while also making `x % y` take the sign of
the **divisor**, which is what you want for clock arithmetic and circular
buffers and never what you get in C.

> *Why is `0.1 + 0.2` not `0.3`?*

Because a `float` is a base-2 fraction and `1/10` is not one. The tutorial
appendix: *"In base 2, 1/10 is the infinitely repeating fraction
`0.0001100110011001100110011001100110011001100110011...`"*, and the stored value
is *"`3602879701896397 / 2 ** 55` which is close to but not exactly equal to the
true value of 1/10."* `repr` hides this by printing the shortest decimal that
round-trips, which is why the display looks exact and the arithmetic is not.

> *What do I store money in?*

`Decimal`, or integer minor units. Never `float`. The `decimal` docs put the
case in one line: *"In decimal floating point, `0.1 + 0.1 + 0.1 - 0.3` is
exactly equal to zero. In binary floating point, the result is
`5.5511151231257827e-017`. […] For this reason, decimal is preferred in
accounting applications which have strict equality invariants."*

> *When is `Fraction` the right answer instead?*

When the exactness you need is *rational*, not *decimal* — repeated division by
three, unit conversions, tax splits that must sum back to the original. `Decimal`
cannot represent `1/3` exactly either; `Fraction` can.

## Where this connects

- **[Truthiness](../05-truthiness.md)** inherits `bool` being an `int`
  subclass: `True + True` is `2`, and `0`, `0.0`, `Decimal(0)` and
  `Fraction(0)` are all falsy.
- **[Comparisons](../06-comparisons.md)** is where NaN's refusal to equal
  itself stops being a curiosity and starts breaking `sort`, `in` and `max`.
- **Phase 6 — Typing** formalises the numeric tower shortcut: a parameter
  annotated `float` accepts an `int`, and one annotated `complex` accepts both.

---

← Prev: [Syntax and indentation](../01-syntax-and-indentation/README.md) · Index: [Phase 1 — Language core](../README.md) · Next → [Strings](../03-strings/README.md)
