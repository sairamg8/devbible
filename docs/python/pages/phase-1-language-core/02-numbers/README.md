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
| 4 | **[`bool` is an `int`](04-bool-is-an-int.md)** | The subclass promise, the idioms it buys, `&`/`\|`/`^` staying `bool` only when both operands are, `~` deprecated and gone in 3.16, and why a format spec prints `1` |
| 4b | **[Identity traps](04b-bool-identity-traps.md)** | `{1: "a", True: "b"}` is one key, the `isinstance(x, int)` hole, `match`/`case` arm ordering, and `singledispatch` walking the MRO |
| 4c | **[`is True` and `== True`](04c-is-true-and-the-type-system.md)** | The three checks and which one to delete, the tri-state pattern, `assertTrue` vs `assertIs`, and E712 |
| 4d | **[Booleans and the type system](04d-booleans-and-the-type-system.md)** | `bool` assignable to `int`, `-> bool` annotations that lie, `Literal[True]` overloads, and `TypeGuard` vs `TypeIs` |
| 4e | **[Writing a `bool` out](04e-booleans-at-a-boundary.md)** | `json` keeps values and coerces keys, and `sqlite3` has no boolean storage class at all |
| 4f | **[Reading a `bool` in](04f-reading-a-bool-in.md)** | `bool()` is a truth test, not a parser — `argparse` `type=bool`, `os.environ`, and what an unrecognised value should do |
| 5 | **[`float` and IEEE-754](05-float-and-ieee-754.md)** | The binary64 layout, `sys.float_info`, why 1/10 is not representable, and `repr` as a display convention |
| 5b | **[Inspecting and constructing floats](05b-inspecting-and-constructing-floats.md)** | `as_integer_ratio()`, `Decimal(x)`, `.hex()`, the 17-digit round trip, and 3.14's `float.from_number()` |
| 5c | **[The float number line](05c-the-float-number-line.md)** | `math.ulp`, `nextafter`, the regions of the number line, correct rounding, non-associativity and cancellation |
| 5d | **[Accurate float arithmetic](05d-accurate-float-arithmetic.md)** | `sum()`'s 3.12 change, `math.fsum`, `math.sumprod` and `math.fma` |
| 6 | **[NaN, infinity and signed zero](06-nan-inf-and-signed-zero.md)** | The values, where they come from, and the comparison rules that make NaN unequal to itself |
| 6b | **[Detecting NaN, and containers](06b-detecting-nan-and-containers.md)** | Identity-first membership, 3.10 identity hashing, and what NaN does to sets, dicts, sorting and `lru_cache` |
| 7 | **[Comparing floats](07-comparing-floats.md)** | The documented `isclose` formula, `rel_tol` as a fraction of the larger operand, PEP 485's weak symmetric test, and why comparing to `0.0` needs `abs_tol` |
| 7b | **[isclose edge cases](07b-isclose-edge-cases.md)** | NaN and the special-cased infinities, `cmath.isclose` on the modulus, why `Decimal` needs no tolerance function, and non-transitivity ruling out dicts, dedup and sorting |
| 7c | **[When `==` is exactly right](07c-when-equality-is-right.md)** | The five cases where float equality is exact — ints under `2**53`, dyadic values, the identical computation, round trips, and sentinels |
| 7d | **[Epsilons and ULPs](07d-epsilons-and-ulps.md)** | Why a hand-picked epsilon fails at both ends, ordering needing no tolerance, `math.ulp`/`nextafter`, and the comparison decision table |
| 7e | **[Tolerance in tests](07e-tolerance-in-tests.md)** | `assertAlmostEqual`'s decimal-places model and its `delta`, `pytest.approx`'s asymmetry and absolute floor, and where the three disagree |
| 8 | **[Floor division and modulo](08-floor-division-and-modulo.md)** | `//` floors rather than truncates, `%` takes the sign of the divisor, and the invariant that ties them together |
| 8b | **[Ceiling division and integer edges](08b-ceiling-division-and-integer-edges.md)** | `-(-a // b)`, `divmod`, and the edges where the arithmetic stops matching intuition |
| 8c | **[Zero divisors and the operator protocol](08c-zero-divisors-and-the-operator-protocol.md)** | `ZeroDivisionError`, `__floordiv__`/`__mod__`/`__divmod__` and their reflected forms |
| 8d | **[Modulo on floats and Decimals](08d-modulo-on-floats-and-decimals.md)** | Where `Decimal`'s `//` truncates toward zero while `int`'s floors, and what that does to a money calculation |
| 8e | **[Float modulo, `fmod` and `remainder`](08e-float-modulo-fmod-and-remainder.md)** | Why `%` and `math.fmod` disagree on sign, the documented roundoff case, and which to reach for |
| 9 | **[`round()` and banker's rounding](09-round-and-bankers-rounding.md)** | Round-half-to-even, the `round(2.675, 2)` note the docs call "not a bug", and the return type with and without `ndigits` |
| 9b | **[`round()` per type, and double rounding](09b-round-per-type-and-double-rounding.md)** | `__round__`, how each numeric type rounds, and the double-rounding trap |
| 9c | **[Double rounding and policy](09c-double-rounding-and-policy.md)** | Why rounding twice is not rounding once, and choosing a rounding policy deliberately rather than inheriting one |
| 10 | **[`Decimal` for money](10-decimal-for-money.md)** | Why `float` is disqualified, what `Decimal` guarantees, constructing from strings, and `Decimal` vs integer minor units as the two defensible representations |
| 10b | **[Contexts, precision and signals](10b-contexts-precision-and-signals.md)** | `getcontext`/`localcontext`, precision as significant digits applied to *results*, the `prec=3` associativity trap, and 3.14's `IEEEContext` |
| 10c | **[Quantize and fixed-point discipline](10c-quantize-and-fixed-point-discipline.md)** | `quantize` as how you hold two places, its unique InvalidOperation rule, the `traps=[Inexact]` validation idiom, and which operations preserve a fixed point |
| 10d | **[Signals, flags and traps](10d-signals-flags-and-traps.md)** | The nine signals, which are trapped by default, the exception hierarchy, and flags being sticky until `clear_flags()` |
| 10e | **[Rounding modes for money](10e-rounding-modes-for-money.md)** | All eight modes with what each is *for*, and why `ROUND_HALF_EVEN` is a default an accountant does not expect |
| 10f | **[Allocating a total](10f-allocating-a-total-without-losing-a-cent.md)** | Splitting a sum across N shares so the parts add back exactly, and where the remainder cent goes |
| 10g | **[Tax, percentages and minor units](10g-tax-percentages-and-minor-units.md)** | Percentage arithmetic that survives audit, currency exponents, and working in minor units |
| 10h | **[`Decimal` and the other numeric types](10h-decimal-and-the-other-numeric-types.md)** | Mixing with `int` and `float`, the `FloatOperation` trap, and comparisons being supported where arithmetic is refused |
| 10i | **[Special values and stdlib interop](10i-special-values-and-stdlib-interop.md)** | `Decimal` NaN and infinity, `compare`/`compare_signal`, `number_class()`, `is_signed()`, and `Decimal.max` differing from builtin `max` |
| 10j | **[Contexts across threads](10j-decimal-contexts-across-threads.md)** | `getcontext()` being per-thread, `thread_inherit_context`, `DefaultContext` before threads start, and the contextvar build option |
| 10k | **[JSON and the wire format](10k-json-and-the-wire-format.md)** | `parse_float=Decimal` receiving the original text, `dumps` needing `default=`, and why a decimal belongs on the wire as a string |
| 10l | **[SQL storage for `Decimal`](10l-sql-storage-for-decimal.md)** | PostgreSQL `numeric` and `money`, precision-versus-scale overflow, and `sqlite3` having no decimal storage class |
| 10m | **[`Decimal` versus integer minor units](10m-decimal-versus-integer-minor-units.md)** | The two representations argued out, and which one a given system should pick |
| 11 | **[`Fraction`](11-fraction.md)** | Exact about rationals where `Decimal` is only exact about decimals, the three constructors, why `Fraction(1.1)` is a power-of-two denominator, and normalisation to lowest terms |
| 11b | **[Inspecting and constructing](11b-inspecting-and-constructing.md)** | `as_integer_ratio()` as the shared exact-value protocol, `is_integer()`, hashability and dict keys, and 3.14's `from_number` |
| 11c | **[Approximation and cost](11c-limit-denominator-and-cost.md)** | `limit_denominator` recovering `11/10` and `355/113`, denominator growth as the price of never rounding, and when not to reach for the type |
| 11d | **[Rounding and formatting](11d-rounding-and-formatting.md)** | Half-to-even `__round__`, `floor`/`ceil`/`int()` disagreeing on negatives, the float presentation types, `'#'`, and no zero-fill |
| 12 | **[Conversions and precision loss](12-conversions-and-precision-loss.md)** | Mixed comparisons using exact values while conversions do not, the conversion matrix, `int()` truncating, and 3.14 dropping the `__trunc__` delegation |
| 12b | **[Exact and lossy conversions](12b-exact-and-lossy-conversions.md)** | `Decimal(0.1)`'s exact binary expansion, `Fraction(1.1)`'s power-of-two denominator, the `FloatOperation` trap, and why `Decimal + float` raises |
| 12c | **[Silent loss and boundaries](12c-silent-loss-and-boundaries.md)** | `json`'s `parse_float`, SQLite having no decimal type, `NUMERIC(p,s)` rounding on scale and raising on precision, and `float` annotations accepting `int` |
| 12d | **[Strings and binary formats](12d-strings-and-binary-formats.md)** | The parsing language being larger than the literal one, `float('inf')` from user input, and `struct`'s `'f'` discarding half a float's precision in silence |
| 13 | **[`complex`](13-complex-and-the-numeric-tower.md)** | An imaginary literal, the constructor's string grammar, no ordering and no `//`, mixed-type widening, and 3.14's deprecation and `from_number` |
| 13b | **[`cmath`](13b-cmath.md)** | Why two modules exist, the always-complex return, `phase`/`polar`/`rect`, `isfinite` vs `isinf`, and branch cuts via signed zero |
| 13c | **[The numeric tower](13c-the-numeric-tower.md)** | The `numbers` ABCs rung by rung, `Decimal` deliberately excluded by PEP 3141, `bool` as `Integral`, and annotate-with-builtins-check-with-ABCs |

⚠️ **This topic is incomplete, and these chunks are genuinely missing.** They are
named in the prose above as plain bold ***(not written yet)*** text rather than as
links, so this topic carries no dangling link to them:

| Planned | Position | Covers |
|---|---|---|
| `06c-signed-zero-and-serialisation.md` | 62 | `math.copysign` as the only way to detect `-0.0`, `0.0`/`-0.0` collapsing to one dict key, and `json`'s `allow_nan` / `parse_constant` |
| `14-math-vs-the-operators.md` | 140 | Where `math` and the operators disagree, and which to reach for |

🔴 **`sidebar_position` runs on a ×10 scheme from chunk 4 onward** — the chunks
written first hold 1–7, then `04` is 40, `05` is 50, `06` is 60, and split siblings
take the next integer. That is what leaves room for a split without renumbering
anything already committed.

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

- **Truthiness** *(not written yet)* inherits `bool` being an `int`
  subclass: `True + True` is `2`, and `0`, `0.0`, `Decimal(0)` and
  `Fraction(0)` are all falsy.
- **Comparisons** *(not written yet)* is where NaN's refusal to equal
  itself stops being a curiosity and starts breaking `sort`, `in` and `max`.
- **Phase 6 — Typing** formalises the numeric tower shortcut: a parameter
  annotated `float` accepts an `int`, and one annotated `complex` accepts both.

---

← Prev: [Syntax and indentation](../01-syntax-and-indentation/README.md) · Index: [Phase 1 — Language core](../README.md) · Next → [Strings](../03-strings/README.md)
