---
title: "A hand-picked epsilon is wrong at both ends of the number line, and the only unit that means something when testing arithmetic is the ULP"
sidebar_label: "7d · Epsilons and ULPs"
sidebar_position: 73
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-01 against the Python 3.14 library reference for
> [`math`](https://docs.python.org/3.14/library/math.html) (`ulp`, `nextafter`, `isfinite`),
> [`sys.float_info`](https://docs.python.org/3.14/library/sys.html#sys.float_info),
> [Value comparisons](https://docs.python.org/3.14/reference/expressions.html#value-comparisons),
> and [PEP 485](https://peps.python.org/pep-0485/).
> Version spine: **Python 3.14.7**; `math.ulp` and `math.nextafter` since **3.9**,
> `nextafter`'s `steps` argument since **3.12**.

**The reflex tolerance — `abs(a - b) < 1e-9` — is an absolute test wearing a
constant somebody picked once, and it is wrong in both directions at once: at `1e10`
the constant sits below the spacing of the floats themselves so the test can never
pass, and at `1e-15` it declares values a factor of five apart equal. Scaling it by
the operands to fix that just rebuilds `math.isclose` by hand, with more places to
get it wrong. The one situation where you should write your own comparison is when
the thing under test is the arithmetic — and there the unit is the ULP, the spacing
of the floats at the magnitude you are actually at, which `math.ulp` and
`math.nextafter` give you directly.**

## Ordering is not equality

`<` and `>` on floats are exact and total over the non-NaN values, and they do not
inherit equality's reputation. A threshold test needs no tolerance:

```python
if temperature > 100.0:      # correct as written
    ...
```

Adding a tolerance to a threshold does not make it robust — it moves the threshold,
by an amount nobody wrote down. If the boundary is genuinely uncertain, put that
uncertainty in the boundary value where a reader can see it. The one thing ordering
*does* inherit is NaN: every comparison involving a NaN is `False`, including `<=`,
so a NaN silently takes the `else` branch of both `x > t` and `x <= t`.

## Hand-rolled epsilons, and why they are usually wrong

The instinct is `abs(a - b) < 1e-9`. That is a pure **absolute** test with a constant
someone picked once, and it fails in both directions:

```python
abs(1e10 - 1.000_000_000_1e10) < 1e-9    # False — same to 10 digits, "not equal"
abs(1e-15 - 5e-15) < 1e-9                # True  — a factor of five apart, "equal"
```

At large magnitudes the constant sits below the spacing of the floats themselves, so
the test can never pass; at small magnitudes it swallows everything including real
errors. `sys.float_info.epsilon` is not a rescue either — it is the gap between `1.0`
and the next float up, so it is the right unit only near `1.0`. Scaling it by hand
(`eps * max(abs(a), abs(b))`) reconstructs the relative test, which is to say it
reconstructs `math.isclose` with more places to get it wrong.

## ULP comparison, for when you are testing the arithmetic itself

PEP 485 is explicit that `isclose` is not for *"rigorous numerical algorithm accuracy
validation"*, which *"typically requires careful error propagation analysis and ULP
comparisons"*. When the thing under test is a numerical routine, the unit that means
something is the spacing of the floats at that magnitude.

`math.nextafter(x, y, steps=1)` returns *"the floating-point value `steps` steps
after `x` towards `y`"*, with `steps` added in 3.12:

```python
def within_ulps(a: float, b: float, n: int = 2) -> bool:
    if a == b:
        return True
    lo = math.nextafter(a, -math.inf, steps=n)
    hi = math.nextafter(a, math.inf, steps=n)
    return lo <= b <= hi
```

`math.ulp(x)` gives the size of one step directly — *"the value of the least
significant bit of the float `x`"* — with `ulp(0.0)` documented as the smallest
positive denormal, `ulp(nan)` returning the NaN, and `ulp(inf)` returning infinity.
Both functions arrived in 3.9 and both are covered in
[The float number line](05c-the-float-number-line.md).

Use this only where it earns its keep. "Within 2 ULPs" is a meaningful claim about a
`sqrt` implementation and a meaningless one about a business calculation.

## The decision, in one table

| Situation | Comparison |
|---|---|
| Both sides exact (dyadic, ints under `2**53`) | `==` |
| Same expression, same inputs, same order | `==` |
| A round trip through `repr` / `hex` / `as_integer_ratio` | `==` |
| A sentinel or an exact constant | `==` |
| A threshold | `<` / `>`, no tolerance |
| Two independent computations of the same quantity | `math.isclose` |
| Either side may be zero | `math.isclose` with `abs_tol` |
| Testing a numerical routine's accuracy | ULP comparison |
| Money | `Decimal`, exact `==` after `quantize` |
| Grouping near values | quantise to a grid, then `==` |

## Gotchas

### `sys.float_info.epsilon` used as a general tolerance
**Symptom.** Comparisons that behave correctly around `1.0` and nonsensically at
`1e6` or `1e-6`.
**Cause.** `epsilon` is the gap between `1.0` and the next float — a constant tied to
one magnitude, not a scale-free unit.
**Fix.** Scale by the operands, which is `math.isclose`, or use `math.ulp(x)` to get
the spacing at the magnitude you are actually at.
```python
abs(a - b) <= 4 * math.ulp(max(abs(a), abs(b)))
```

### A threshold with a tolerance bolted on
**Symptom.** A limit check accepts values slightly over the limit, and nobody can say
by how much.
**Cause.** `x > limit - eps` moves the limit by `eps` while looking like robustness.
**Fix.** Put the real limit in the constant. If the boundary is uncertain, make the
uncertainty explicit and reviewable.

### NaN silently taking the wrong branch of a threshold
**Symptom.** Rows with a NaN measurement are classified as "within limits".
**Cause.** Every comparison with NaN is `False`, so `x > limit` is `False` and the
`else` branch runs.
**Fix.** Check finiteness before classifying.
```python
if not math.isfinite(x):
    return "unknown"
return "over" if x > limit else "within"
```

## Interview questions

**Why is `abs(a - b) < 1e-9` a bad default?**
It is absolute with a constant chosen for no particular magnitude. Near `1e10` the
constant is below the float spacing so it never passes; near `1e-15` it declares
values a factor of five apart equal.

**What is `sys.float_info.epsilon` and when is it the right unit?**
The difference between `1.0` and the next representable float. It is the right unit
only near `1.0`; elsewhere use `math.ulp(x)`, which gives the spacing at `x`.

**How would you assert a `sqrt` implementation is accurate?**
In ULPs, using `math.nextafter` or `math.ulp` to build the window, because that is
the unit correctness is specified in. PEP 485 says explicitly that `isclose` is not
for rigorous accuracy validation.

**Should a threshold test have a tolerance?**
No. Ordering comparisons on floats are exact and total over non-NaN values; adding
`eps` moves the threshold by an undocumented amount. Guard NaN separately, since
every comparison with it is `False`.

**Why is scaling `sys.float_info.epsilon` by the operands not an improvement?**
It is an improvement over the fixed constant, but what it produces is
`eps * max(abs(a), abs(b))` — the relative test `math.isclose` already implements,
reimplemented without the documented zero handling, the infinity special cases or the
NaN rule.

**When is a ULP comparison the wrong tool?**
Whenever the quantity is not the output of a numerical routine whose accuracy is
specified in ULPs. "Within 2 ULPs" is a meaningful claim about a `sqrt`
implementation and a meaningless one about an invoice total, where the right answer
is `Decimal` and exact equality.

**What does `math.ulp` return for the special values?**
`ulp(0.0)` is the smallest positive denormalised float, `ulp(nan)` returns the NaN,
and `ulp(inf)` returns infinity. For a negative `x` it returns `ulp(-x)`, so it is
always a magnitude.

---

← Prev: [When equality is exactly right](07c-when-equality-is-right.md) · Index: [Numbers](README.md) · Next → [Tolerance in tests](07e-tolerance-in-tests.md)
