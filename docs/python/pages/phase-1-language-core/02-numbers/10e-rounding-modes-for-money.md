---
title: "The default rounding mode is banker's rounding, which is not what your tax authority wrote down, and choosing among the eight is a policy decision you must make once and encode"
sidebar_label: "10e · Rounding modes for money"
sidebar_position: 104
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-01 against the Python 3.14 library reference for
> [`decimal` — Rounding modes](https://docs.python.org/3.14/library/decimal.html#rounding-modes),
> [`Decimal.quantize`](https://docs.python.org/3.14/library/decimal.html#decimal.Decimal.quantize),
> [rounding a `Decimal` with `round()`](https://docs.python.org/3.14/library/decimal.html#decimal.Decimal.__round__),
> [`Decimal.to_integral_exact`](https://docs.python.org/3.14/library/decimal.html#decimal.Decimal.to_integral_exact)
> and [Context objects](https://docs.python.org/3.14/library/decimal.html#context-objects).
> Version spine: **Python 3.14.7**.

**`decimal` ships eight rounding modes and defaults to `ROUND_HALF_EVEN` — banker's
rounding — because that is what IEEE 754 and the General Decimal Arithmetic
Specification default to. Almost no tax code, invoicing standard or card scheme
specifies it; most say "round half away from zero", which is `ROUND_HALF_UP`. So
the default is a *statistical* choice sitting where a *legal* one belongs, and it
is wrong silently: half-cent cases are rare enough to pass every test you write by
hand and frequent enough to appear a few thousand times a month in production.**

## The eight modes, and what each is for

| Mode | Documented behaviour | What it is for |
|---|---|---|
| `ROUND_HALF_EVEN` | *"Round to nearest with ties going to nearest even integer."* | The default. Ties split evenly between up and down, so a large population of roundings has no systematic bias. Statistical and scientific work; the IEEE 754 default. |
| `ROUND_HALF_UP` | *"Round to nearest with ties going away from zero."* | What "round to the nearest cent" means in ordinary speech and in most tax and invoicing rules. The mode most money code should be using. |
| `ROUND_HALF_DOWN` | *"Round to nearest with ties going towards zero."* | The mirror of `HALF_UP`; specified by a few schemes and rarely chosen otherwise. |
| `ROUND_UP` | *"Round away from zero."* | Always increase magnitude. Charges that must never under-bill: metered usage, fees where the rule is "any part of a unit is a unit". |
| `ROUND_DOWN` | *"Round towards zero."* | Truncation. Interest *paid to* a customer under a "no over-payment" rule; anything where an unearned fraction must not be granted. |
| `ROUND_CEILING` | *"Round towards Infinity."* | Sign-aware upward. Same as `ROUND_UP` for positives, but the *opposite* for negatives. |
| `ROUND_FLOOR` | *"Round towards -Infinity."* | Sign-aware downward, matching Python's `//` on ints and `math.floor`. |
| `ROUND_05UP` | *"Round away from zero if last digit after rounding towards zero would have been 0 or 5; otherwise round towards zero."* | Reserved-digit rounding, from the arithmetic specification: it keeps a shortened result from ever being an exact halfway value, so a later re-rounding of that result cannot double-round wrongly. It is a tool for multi-step arithmetic, not a business policy. |

The distinction that produces real bugs is **`UP`/`DOWN` versus
`CEILING`/`FLOOR`**. `ROUND_UP` increases *magnitude*: `-2.5` goes to `-3`.
`ROUND_CEILING` increases *value*: `-2.5` goes to `-2`. A refund is a negative
amount. A fee rule written as "always round in the house's favour" is
`ROUND_UP` on a positive charge and `ROUND_DOWN` on a negative one — it is not
`ROUND_CEILING`, and using `ROUND_CEILING` makes every refund a little too small.

## Where the mode comes from

`quantize` documents the resolution order precisely:

> *"the rounding mode is determined by the `rounding` argument if given, else by
> the given `context` argument; if neither argument is given the rounding mode of
> the current thread's context is used."*

```python
from decimal import Decimal, ROUND_HALF_UP, Context, localcontext

CENTS = Decimal('0.01')
amount = Decimal('2.675')

amount.quantize(CENTS, rounding=ROUND_HALF_UP)              # explicit, per call
amount.quantize(CENTS, context=Context(rounding=ROUND_HALF_UP))
with localcontext(rounding=ROUND_HALF_UP):                  # explicit, per block
    amount.quantize(CENTS)
```

Three places means three ways to disagree. In money code, put the mode where the
policy is: a `Money` type or a single `to_money()` function that always passes
`rounding=` explicitly. Relying on the thread context makes rounding depend on
*which thread ran the request* ([10j](10j-decimal-contexts-across-threads.md)) and
on whether some library changed the context first.

## Setting the policy once

```python
from decimal import Decimal, ROUND_HALF_UP, ROUND_HALF_EVEN

CENTS = Decimal('0.01')

# One place in the codebase names the policy, with the regulation in the comment.
ROUNDING = ROUND_HALF_UP        # e.g. VAT rounding per the invoicing rules we follow

def to_money(value: Decimal) -> Decimal:
    return value.quantize(CENTS, rounding=ROUNDING)
```

If different flows genuinely have different rules — VAT half-up, an interest
accrual truncated, a fee always rounded up — encode each as its own named
function. The failure mode to avoid is a call site that quantizes with no
`rounding=` and therefore inherits whatever the context happens to hold.

## Rounding to something that is not a power of ten

`quantize` can only target an exponent, so it cannot round to the nearest five
cents (cash rounding, used where the smallest coin is 5c). Scale, round, scale
back:

```python
from decimal import Decimal, ROUND_HALF_UP

NICKEL = Decimal('0.05')

def to_cash(amount: Decimal, step: Decimal = NICKEL) -> Decimal:
    return (amount / step).quantize(Decimal('1'), rounding=ROUND_HALF_UP) * step
```

Note that the result must still be quantized to two places afterwards if your
invariant demands exponent `-2`: `Decimal('1') * Decimal('0.05')` has exponent
`-2` here, but the same helper with a `step` of `Decimal('0.5')` would not.

## Rounding to an integer: `to_integral_value` and `to_integral_exact`

Two spellings, differing only in whether they tell you they did something:

> `to_integral_exact()`: *"Round to the nearest integer, signaling `Inexact` or
> `Rounded` as appropriate if rounding occurs."*

> `to_integral_value()`: *"Round to the nearest integer without signaling
> `Inexact` or `Rounded`."*

Both return a `Decimal`, not an `int`, and both take `rounding` and `context`
arguments. Use `to_integral_exact` when "was this already whole?" is a question
you want the flags to answer — converting a minor-unit amount to whole currency
units, for instance.

## `round()` versus `quantize()`

Both round a `Decimal`, and they do not obey the same rules.

> *"If ndigits is not given or `None`, returns the nearest `int` to number,
> rounding ties to even, and **ignoring the rounding mode of the `Decimal`
> context**. Raises `OverflowError` if number is an infinity or `ValueError` if it
> is a (quiet or signaling) `NaN`."*

> *"If ndigits is an `int`, the context's rounding mode is respected and a
> `Decimal` representing number rounded to the nearest multiple of
> `Decimal('1E-ndigits')` is returned; in this case, `round(number, ndigits)` is
> equivalent to `self.quantize(Decimal('1E-ndigits'))`."*

The documented demonstration, with the context set to `ROUND_DOWN`:

```python
getcontext().rounding = ROUND_DOWN
round(Decimal('3.75'))       # 4          — context rounding ignored, ties-to-even
round(Decimal('3.5'))        # 4          — round-ties-to-even
round(Decimal('3.75'), 0)    # Decimal('3')    — uses the context rounding
round(Decimal('3.75'), 1)    # Decimal('3.7')
round(Decimal('3.75'), -1)   # Decimal('0E+1')
```

So `round(d)` and `round(d, 0)` differ in *both* return type (`int` versus
`Decimal`) and rounding policy. And because the two-argument form is defined as
`quantize`, it inherits `quantize`'s exception: *"Raises `InvalidOperation` if
number is an infinity, a signaling NaN, or if the length of the coefficient after
the quantize operation would be greater than the current context's precision."*

Prefer `quantize` in money code. It states the target exponent as a value rather
than a digit count, it takes an explicit `rounding=` argument so the policy is at
the call site, and it does not change meaning between its one- and two-argument
forms.

## Gotchas

**★ The default is banker's rounding and your specification almost certainly is
not.** `ROUND_HALF_EVEN` sends `2.5` to `2` and `3.5` to `4`. It is defensible
statistically and indefensible when the invoice rule says "half rounds up". Nobody
notices in review because the halfway case is rare — and then it is a few thousand
rows a month. Set the mode explicitly at every money `quantize`, even when the
value you set matches the default, so the next reader can see that a decision was
made.

**★ `ROUND_UP` and `ROUND_CEILING` are the same until an amount goes negative.**
Refunds, credit notes, reversals and negative adjustments are where they diverge.
A fee policy of "always in our favour" implemented as `ROUND_CEILING` silently
shrinks every refund. Test every rounding rule with a negative input.

**★ `ROUND_05UP` is not a "round 5 up" mode.** The name reads like half-up and it
is unrelated: it rounds away from zero only when the truncated last digit would
have been 0 or 5, and otherwise truncates. It exists so that a shortened
intermediate can never sit exactly on a halfway point, protecting a later
rounding. Choosing it as a business policy produces results nobody can explain.

**★ A `quantize` without `rounding=` inherits thread state.** The mode comes from
the current thread's context, which any library — or an earlier request handled by
the same worker — may have changed. The same amount can then round differently on
two workers of the same service.

**★ `round(d)` ignores the context rounding mode; `round(d, 0)` does not.** They
also return different types. Code that sets `getcontext().rounding = ROUND_HALF_UP`
and then calls `round(amount)` gets banker's rounding anyway, silently.

**★ Quantizing at every step is not the same as quantizing at the end.** Each
`quantize` is a rounding, and rounding repeatedly compounds error — the
double-rounding problem from [09c](09c-double-rounding-and-policy.md). Compute the
chain at full precision, quantize once at the boundary where the number becomes a
recorded amount. The exception is when the intermediate *is* a recorded amount
(a posted line item), in which case rounding it is the correct behaviour.

## Interview questions

**★ Why is `ROUND_HALF_EVEN` the default, and why is it usually wrong for money?**
Because `decimal` implements IEEE 754 and the General Decimal Arithmetic
Specification, whose default is round-half-to-even: over a large population of
values it splits ties evenly and so introduces no systematic bias, which is the
right property for scientific and statistical work. Money is not governed by
statistics but by a written rule, and the written rule is nearly always "round
half away from zero" — `ROUND_HALF_UP`. Using the default means your rounding
policy was chosen by a standards committee for a different problem.

**★ Explain the difference between `ROUND_UP` and `ROUND_CEILING` with an example
that matters.**
`ROUND_UP` rounds away from zero — it always increases magnitude. `ROUND_CEILING`
rounds toward positive infinity — it increases *value*. For `2.5` at zero decimal
places both give `3`; for `-2.5`, `ROUND_UP` gives `-3` and `ROUND_CEILING` gives
`-2`. So on a refund of `-2.5`, `ROUND_UP` refunds more and `ROUND_CEILING` refunds
less. Any rule phrased in terms of "in whose favour" is a magnitude rule and wants
`ROUND_UP`/`ROUND_DOWN`; any rule phrased in terms of "never below/above this
value" is a value rule and wants `ROUND_FLOOR`/`ROUND_CEILING`.

**★ What is `ROUND_05UP` for?**
It is a reserved-digit mode from the arithmetic specification, used in multi-step
arithmetic rather than in business rules. It rounds away from zero only when
truncation would have left a last digit of 0 or 5, and truncates otherwise. The
effect is that a shortened intermediate value can never land exactly on a halfway
point, so a subsequent rounding of that intermediate cannot be pushed the wrong
way by the shortening — a defence against double rounding, implemented in the
rounding mode itself.

**★ How do you round to the nearest five cents?**
`quantize` targets an exponent, so it cannot express a step of `0.05` directly.
Divide by the step, quantize to an integer with your chosen mode, and multiply
back: `(amount / step).quantize(Decimal('1'), rounding=ROUND_HALF_UP) * step`.
Then re-quantize to your money scale if the multiplication did not land on it.

**★ Where should the rounding mode live in an application?**
In one named place per policy — a `Money` type, or a small set of functions like
`to_money`, `to_vat`, `to_fee` — each passing `rounding=` explicitly on every
`quantize`. Never in the ambient thread context, because that makes the result
depend on which worker served the request and on whether any library mutated the
context first, and never implicitly at a call site, because an implicit rounding
mode is a policy nobody reviewed.

**★ Is `round(amount, 2)` the same as `amount.quantize(Decimal('0.01'))`?**
For a `Decimal` the docs define the two-argument `round` as exactly
`self.quantize(Decimal('1E-ndigits'))`, so yes — same rounding mode from the
context, same `InvalidOperation` on precision overflow. The zero-argument form is
a different function: it returns an `int`, rounds ties to even, and *ignores* the
context's rounding mode entirely. Prefer `quantize` in money code because the
target exponent is explicit, the rounding mode can be passed at the call site, and
there is no arity-dependent change of meaning.

**★ Where should the `quantize` live: at every step, or once at the end?**
Once, at the boundary where the number becomes a recorded amount — a stored row, a
printed line, a payment instruction — because every rounding is an error and
repeated roundings compound. Between those boundaries, compute at full context
precision. The exception is when an intermediate genuinely is a recorded amount:
if each invoice line is posted to the ledger, each line rounds, and the invoice
total is the sum of the *rounded* lines, not the rounded sum.

---

← Prev: [Signals, flags and traps](10d-signals-flags-and-traps.md) · Index: [Numbers](README.md) · Next → [Allocating a total without losing a cent](10f-allocating-a-total-without-losing-a-cent.md)

{/* FOOTER */}
