---
title: "Decimal precision is significant digits applied to results and never to inputs, which is why adding zero can change your answer"
sidebar_label: "10b · Contexts, precision, signals"
sidebar_position: 101
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-01 against the Python 3.14 library reference for
> [`decimal` — Context objects](https://docs.python.org/3.14/library/decimal.html#context-objects),
> [Signals](https://docs.python.org/3.14/library/decimal.html#signals),
> [Constants](https://docs.python.org/3.14/library/decimal.html#constants),
> [Mitigating round-off error](https://docs.python.org/3.14/library/decimal.html#mitigating-round-off-error-with-increased-precision)
> and the [`decimal` FAQ](https://docs.python.org/3.14/library/decimal.html#decimal-faq).
> Version spine: **Python 3.14.7**.

**A `Decimal` carries its own exact value; the context decides what happens to the
*results* of arithmetic on it. Two consequences trip up everyone once. First,
`prec` is a count of **significant digits in the whole number**, not of decimal
places — at `prec=28` a nine-figure amount has nineteen places after the point,
and a twenty-nine-figure one has none. Second, because inputs are never rounded
and results always are, addition stops being associative: adding an explicit zero
in the middle of a sum can change the answer. The context is also where the
module's error handling lives: `flags` and `traps` are context attributes indexing
nine signals, taken apart in [10d](10d-signals-flags-and-traps.md).**

## The context is a per-thread object you can read, replace, or borrow

```python
from decimal import getcontext, setcontext, localcontext, Context, ROUND_HALF_UP

getcontext()              # the current thread's context, created on demand
getcontext().prec = 12    # mutates it in place — global to this thread
setcontext(Context(prec=12, rounding=ROUND_HALF_UP))   # replaces it wholesale
```

> *"Contexts are environments for arithmetic operations. They govern precision,
> set rules for rounding, determine which signals are treated as exceptions, and
> limit the range for exponents."*

Mutating `getcontext()` at import time is the standard way an application sets its
policy, and it is also the standard way a library breaks its host: the context is
per-thread global state, so a library that sets `getcontext().prec = 6` has
silently changed the arithmetic of every other `Decimal` user in that thread. A
library must use `localcontext`:

```python
from decimal import localcontext

with localcontext() as ctx:
    ctx.prec = 42                 # Perform a high precision calculation
    s = calculate_something()
s = +s                            # Round the final result back to the default precision
```

Since 3.11 the attributes can go in the call — *"Changed in version 3.11:
`localcontext()` now supports setting context attributes through the use of
keyword arguments"*:

```python
with localcontext(prec=42) as ctx:
    s = calculate_something()
s = +s
```

Two details in that documented snippet are easy to skim past. `localcontext`
*"will set the current context for the active thread to a **copy** of ctx"* — so
mutating `ctx` inside the block cannot leak out. And the trailing `s = +s` is not
decoration: the value computed at `prec=42` still carries 42 digits after the
block ends, and unary plus is what re-rounds it to the restored context. Skipping
that line is the most common way a "temporary high precision" block leaks high
precision into the rest of the program.

Bad keywords fail loudly: *"Raises `TypeError` if kwargs supplies an attribute
that `Context` doesn't support. Raises either `TypeError` or `ValueError` if
kwargs supplies an invalid value for an attribute."*

## `prec` is significant digits, and it applies after the computation

This is the single most misread attribute in the module. The FAQ:

> *"**Q: When does rounding occur in a computation?** A: It occurs *after* the
> computation. The philosophy of the decimal specification is that numbers are
> considered exact and are created independent of the current context. They can
> even have greater precision than current context. Computations process with
> those exact inputs and then rounding (or other context operations) is applied to
> the *result* of the computation"*

The documented demonstration, at `prec = 5`:

```python
getcontext().prec = 5
pi = Decimal('3.1415926535')   # More than 5 digits
pi                             # Decimal('3.1415926535') — all digits are retained
pi + 0                         # Decimal('3.1416')       — rounded after an addition
pi - Decimal('0.00005')        # Decimal('3.1415')       — subtract unrounded, then round
```

**Significant digits, not decimal places.** `prec=28` does not mean 28 places
after the point; it means 28 digits in total, counted from the leading non-zero
digit. For money this is a real limit, not a theoretical one: a balance in the
hundreds of millions with two places uses eleven of your digits, and an
intermediate product of two such balances uses twenty-two. Interest accrual over
a long amortisation schedule, or a currency with no minor unit and very large
nominal values (an amount in old Turkish lira, Zimbabwean dollars, Iranian rials),
can walk into the ceiling. Set `prec` from the widest intermediate you can
produce, not from the width of the numbers you store.

### The trap: addition is not associative

> *"**Q: I noticed that context precision is applied to the results of operations
> but not to the inputs. Is there anything to watch out for when mixing values of
> different precisions?** A: Yes. The principle is that all values are considered
> to be exact and so is the arithmetic on those values. Only the results are
> rounded. The advantage for inputs is that 'what you type is what you get'. A
> disadvantage is that the results can look odd if you forget that the inputs
> haven't been rounded"*

```python
getcontext().prec = 3
Decimal('3.104') + Decimal('2.104')                     # Decimal('5.21')
Decimal('3.104') + Decimal('0.000') + Decimal('2.104')  # Decimal('5.20')
```

Both are correct. The first rounds `5.208` once, to `5.21`. The second rounds
`3.104` to `3.10` on the first addition — the *result* of `3.104 + 0.000` is
`3.104`, rounded to three significant digits — and then `3.10 + 2.104` rounds
`5.204` to `5.20`. Adding zero was a rounding step.

That means **the order in which you sum a ledger can change the total**, and so
can a `+ Decimal(0)` that someone added as a "no-op" to force a type. The
`Context.create_decimal` docs make the same point from the other side, with
`prec=3`: `Decimal('3.4445') + Decimal('1.0023')` is `Decimal('4.45')`, but
`Decimal('3.4445') + Decimal(0) + Decimal('1.0023')` is `Decimal('4.44')`.

### The two fixes, both documented

**Round the inputs on the way in.** Unary plus applies the context to a value
without changing it otherwise:

```python
getcontext().prec = 3
+Decimal('1.23456789')      # Decimal('1.23') — unary plus triggers rounding
```

**Or construct through the context**, which is what `Context.create_decimal` is
for — *"Unlike the `Decimal` constructor, the context precision, rounding method,
flags, and traps are applied to the conversion"*:

```python
Context(prec=5, rounding=ROUND_DOWN).create_decimal('1.2345678')  # Decimal('1.2345')
```

The docs give the reason plainly: *"This is useful because constants are often
given to a greater precision than is needed by the application. Another benefit is
that rounding immediately eliminates unintended effects from digits beyond the
current precision."* `create_decimal_from_float` is the same thing for a float
input.

The third fix, and usually the right one for money, is not to rely on `prec` at
all: keep `prec` generously large and pin the *scale* with `quantize`
([10c](10c-quantize-and-fixed-point-discipline.md)).

### Increasing precision is a real mitigation

The module documents Knuth's demonstration that insufficient precision breaks
associativity and distributivity outright, at `prec = 8`:

```python
getcontext().prec = 8
u, v, w = Decimal(11111113), Decimal(-11111111), Decimal('7.51111111')
(u + v) + w      # Decimal('9.5111111')
u + (v + w)      # Decimal('10')
```

The documented cure is simply more digits — at `prec = 20` both orderings agree.
This is why the default is 28 rather than 9: it buys enough headroom that
cancellation between nearly equal quantities does not destroy the answer.

## The other context attributes

| Attribute | Documented meaning |
|---|---|
| `prec` | *"An integer in the range [1, `MAX_PREC`] that sets the precision for arithmetic operations in the context."* |
| `rounding` | One of the eight rounding modes ([10e](10e-rounding-modes-for-money.md)). |
| `Emin`, `Emax` | *"Integers specifying the outer limits allowable for exponents."* |
| `capitals` | *"Either 0 or 1 (the default). If set to 1, exponents are printed with a capital `E`; otherwise, a lowercase `e` is used."* |
| `clamp` | *"Either 0 (the default) or 1."* At 1, the exponent is confined to the IEEE interchange range and *"a large normal number will, where possible, have its exponent reduced and a corresponding number of zeros added to its coefficient"*. |
| `flags` | Sticky record of every signal raised ([10d](10d-signals-flags-and-traps.md)). |
| `traps` | Which signals raise a Python exception instead ([10d](10d-signals-flags-and-traps.md)). |

`capitals` looks trivial and is not: it changes `str()` output for any value that
prints in exponential form, so it is a *serialisation* setting. If one service
writes `1E+9` and another writes `1e+9`, a string comparison, a checksum or a
database unique index over the text will disagree.

`Etiny()` and `Etop()` derive from the pair: *"Returns a value equal to
`Emin - prec + 1` which is the minimum exponent value for subnormal results"* and
*"Returns a value equal to `Emax - prec + 1`"*. The default `Emin=-999999` /
`Emax=999999` are far outside anything money reaches; the signals those limits
raise — `Overflow`, `Underflow`, `Subnormal`, `Clamped` — are in
[10d](10d-signals-flags-and-traps.md).

### The four contexts you are given

- **`DefaultContext`** — the prototype the `Context` constructor copies from.
  *"The default values are `Context.prec=28`, `Context.rounding=ROUND_HALF_EVEN`,
  and enabled traps for `Overflow`, `InvalidOperation`, and `DivisionByZero`."*
- **`BasicContext`** — *"Precision is set to nine. Rounding is set to
  `ROUND_HALF_UP`. All flags are cleared. All traps are enabled (treated as
  exceptions) except `Inexact`, `Rounded`, and `Subnormal`. Because many of the
  traps are enabled, this context is useful for debugging."*
- **`ExtendedContext`** — *"Precision is set to nine. Rounding is set to
  `ROUND_HALF_EVEN`. All flags are cleared. No traps are enabled (so that
  exceptions are not raised during computations)."* Useful when you would rather
  finish the run with `NaN` in a cell than abort.
- **`IEEEContext(bits)`** (new in 3.14) — *"Return a context object initialized to
  the proper values for one of the IEEE interchange formats. The argument must be
  a multiple of 32 and less than `IEEE_CONTEXT_MAX_BITS`."* That constant is 256
  on 32-bit builds and 512 on 64-bit. `IEEEContext(128)` gives `decimal128`
  semantics — 34 digits — and `IEEEContext(64)` gives `decimal64`, which is
  **16** digits, considerably *less* than the default.

## Gotchas

**★ `prec` counts significant digits, not decimal places.** Every developer reads
`prec=28` as "28 decimal places" once. `Decimal('123456789.12') * Decimal('1.05')`
consumes digits from the left; the places you have left after the point are
`prec` minus the integer digits. On a system holding large nominal values, raise
`prec` or switch to `quantize`-pinned fixed point — do not assume the default is
generous because 28 is a big number.

**★ Adding `Decimal(0)` is a rounding operation.** `x + 0` is not a no-op: it is
"round `x` to the current context". People add it to normalise a type, or write
`sum(values)` whose `start=0` does exactly this on the first term. Under a reduced
`prec` that changes results. If you want the coercion without the rounding, use
`Decimal(x)`; if you want the rounding, write `+x` so the intent is visible.

**★ `sum()` on `Decimal` starts from `int` 0 and rounds at every step.** Each
partial sum is rounded to `prec`, so a long ledger accumulates rounding *and*
depends on the iteration order. At the default `prec=28` this is invisible for
realistic money; under a small `prec` it is not. If order-independence matters,
raise the precision for the summation with `localcontext` and quantize once at the
end.

**★ Forgetting `s = +s` after a high-precision block leaks the precision.** The
context is restored on exit, but the *value* keeps the digits it was computed
with, and `Decimal` values carry their own significance regardless of context.
The documented pattern ends with unary plus for exactly this reason.

**★ `Context(...)` copies unspecified fields from `DefaultContext`, not from the
current context.** *"If a field is not specified or is `None`, the default values
are copied from the `DefaultContext`."* So `Context(prec=6)` inside a block where
you carefully set `rounding=ROUND_HALF_UP` silently gets `ROUND_HALF_EVEN` back.
To derive from what you have, use `getcontext().copy()` and mutate.

## Interview questions

**★ What does the `context` argument to the `Decimal` constructor do — and what does
it *not* do?**
It decides one thing only: what happens if `value` is a malformed string. If that
context traps `InvalidOperation` you get an exception; otherwise you get
`Decimal('NaN')`. It does **not** apply `prec` or `rounding` to the conversion —
the constructor stores exactly the digits it was given. The call that *does* apply
the context to a conversion is `Context.create_decimal` (or
`create_decimal_from_float` for a float).

**★ Explain why `Decimal('3.104') + Decimal('0.000') + Decimal('2.104')` differs from
the same sum without the zero.**
Because precision applies to results, never to inputs. At `prec=3`, the two-term
sum computes `5.208` exactly and rounds once, to `5.21`. The three-term version
first computes `3.104 + 0.000`, whose exact result `3.104` is rounded to `3.10`,
and then adds `2.104` to get `5.204`, which rounds to `5.20`. Adding zero
introduced a rounding step, and rounding twice is not rounding once. Fix it by
raising the precision, by forcing input rounding with unary plus or
`create_decimal`, or by not relying on `prec` for scale at all.

**★ What exactly is `prec`, and how would you choose it for a payments system?**
It is the maximum number of significant digits in the *result* of an arithmetic
operation — total digits, counted from the first non-zero one, not digits after
the decimal point. Choose it from the widest intermediate value the system can
produce, not from the stored amounts: a product of two large balances, or an
accrual multiplied by a long day-count fraction, is where the digits go. Then stop
depending on it: pin the scale of every stored amount with `quantize` so the
context's precision is headroom rather than policy.

**★ What is `IEEEContext` and when is it the right choice?**
New in 3.14: it builds a context matching an IEEE 754 decimal interchange format —
`IEEEContext(32)`, `(64)`, `(128)` and so on, the argument being a multiple of 32
below `IEEE_CONTEXT_MAX_BITS` (256 or 512 depending on build). It is right when
you must reproduce another system's arithmetic bit for bit: a `decimal128` column,
a hardware decimal unit, a mainframe feed. It is wrong as a general money context,
because interchange formats also set `clamp=1` and narrow exponent limits, and
because `IEEEContext(64)` is 16 significant digits — fewer than the default 28.

---

← Prev: [Decimal for money](10-decimal-for-money.md) · Index: [Numbers](README.md) · Next → [quantize and fixed-point discipline](10c-quantize-and-fixed-point-discipline.md)

{/* FOOTER */}
