---
title: "Nine signals, each with a sticky flag and a trap enabler, are how decimal tells you an answer is not the answer — and only three of them stop you by default"
sidebar_label: "10d · Signals, flags and traps"
sidebar_position: 103
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-01 against the Python 3.14 library reference for
> [`decimal` — Signals](https://docs.python.org/3.14/library/decimal.html#signals),
> [Context objects](https://docs.python.org/3.14/library/decimal.html#context-objects)
> and the module introduction. Version spine: **Python 3.14.7**.

**Every exceptional condition in `decimal` has two independent switches: a flag
that records it happened, and a trap that turns it into a Python exception. Three
signals are trapped by default — `InvalidOperation`, `DivisionByZero`, `Overflow` —
because continuing past them produces a value with no arithmetic meaning. The
other six leave a usable result and only set a flag, which means the most
important fact about a money calculation, *"was anything rounded?"*, is available
and almost never read. Flags are sticky, so reading them without clearing them
first tells you nothing.**

## The nine signals

> *"Signals represent conditions that arise during computation. Each corresponds
> to one context flag and one context trap enabler. The context flag is set
> whenever the condition is encountered. After the computation, flags may be
> checked for informational purposes (for instance, to determine whether a
> computation was exact). After checking the flags, be sure to clear all flags
> before starting the next computation."*

| Signal | Documented meaning | Trapped by default |
|---|---|---|
| `Clamped` | *"Altered an exponent to fit representation constraints."* | no |
| `DivisionByZero` | *"Signals the division of a non-infinite number by zero."* Untrapped it returns a signed infinity. | **yes** |
| `Inexact` | *"Indicates that rounding occurred and the result is not exact."* | no |
| `InvalidOperation` | *"An invalid operation was performed."* Untrapped it returns `NaN`. | **yes** |
| `Overflow` | *"Indicates the exponent is larger than `Context.Emax` after rounding has occurred."* | **yes** |
| `Rounded` | *"Rounding occurred though possibly no information was lost"* — signalled *"even if those digits are zero (such as rounding `5.00` to `5.0`)"*. | no |
| `Subnormal` | *"Exponent was lower than `Emin` prior to rounding."* | no |
| `Underflow` | *"Numerical underflow with result rounded to zero."* | no |
| `FloatOperation` | *"Enable stricter semantics for mixing floats and Decimals."* ([10h](10h-decimal-and-the-other-numeric-types.md)) | no |

`InvalidOperation`'s documented causes are worth memorising, because each is a
`NaN` waiting to appear in a report: `Infinity - Infinity`, `0 * Infinity`,
`Infinity / Infinity`, `x % 0`, `Infinity % x`, `sqrt(-x)` for positive `x`,
`0 ** 0`, `x ** (non-integer)`, and `x ** Infinity`.

The hierarchy matters for `except` clauses:

```text
exceptions.ArithmeticError(exceptions.Exception)
    DecimalException
        Clamped
        DivisionByZero(DecimalException, exceptions.ZeroDivisionError)
        Inexact
            Overflow(Inexact, Rounded)
            Underflow(Inexact, Rounded, Subnormal)
        InvalidOperation
        Rounded
        Subnormal
        FloatOperation(DecimalException, exceptions.TypeError)
```

Three readings follow. `except ArithmeticError` catches every decimal signal, and
so does `except decimal.DecimalException`. `except ZeroDivisionError` catches
decimal division by zero — deliberately, so generic code keeps working. And
`except TypeError` catches `FloatOperation`, which is exactly what you want when
the alternative was a silent float contaminating a total.

## Flags are sticky; traps are exceptions

> *"For each signal there is a flag and a trap enabler. When a signal is
> encountered, its flag is set to one, then, if the trap enabler is set to one, an
> exception is raised. Flags are sticky, so the user needs to reset them before
> monitoring a calculation."*

Sticky means a flag set on line 3 is still set on line 3000. Any use of flags as
evidence requires clearing them first:

```python
from decimal import getcontext, Inexact, localcontext

ctx = getcontext()
ctx.clear_flags()                      # Context.clear_flags(): "Resets all of the flags to 0"
total = price * quantity
if ctx.flags[Inexact]:
    log.warning("total was rounded: %s", total)
```

The trap route turns the same condition into control flow, and is the documented
way to *enforce* exactness — the module intro calls it *"an option to enforce
exact arithmetic by using exceptions to block any inexact operations"*:

```python
with localcontext() as ctx:
    ctx.traps[Inexact] = True          # any rounding here is a bug, not a result
    total = subtotal + tax
```

`Context.clear_traps()` (3.3+) is the counterpart to `clear_flags()` when you
build a context by mutation rather than by constructor.

## The exponent-limit signals, and why money rarely sees them

`Clamped`, `Subnormal`, `Underflow` and `Overflow` are all about the exponent
running into `Emin`/`Emax`, and with the default context (`Emin=-999999`,
`Emax=999999`) money never gets near them. They become reachable the moment you
adopt a narrow context — an IEEE interchange format via `IEEEContext`, or
`BasicContext`/`ExtendedContext` with `prec=9`.

- **`Overflow`** is *"the exponent is larger than `Context.Emax` after rounding has
  occurred"*. Untrapped, *"the result depends on the rounding mode, either pulling
  inward to the largest representable finite number or rounding outward to
  `Infinity`. In either case, `Inexact` and `Rounded` are also signaled."* That is
  why `Overflow` subclasses both.
- **`Subnormal`** is *"Exponent was lower than `Emin` prior to rounding"* — a
  warning that you are in the range where precision is being lost to the exponent
  floor.
- **`Underflow`** is *"Numerical underflow with result rounded to zero"*, and
  *"`Inexact` and `Subnormal` are also signaled"*. Note the definition: it fires
  when a *subnormal* result is pushed to zero, which is why `quantize` — which
  documents that it *"never signals `Underflow`"* — is not covered by it
  ([10c](10c-quantize-and-fixed-point-discipline.md)).
- **`Clamped`** is *"Altered an exponent to fit representation constraints…
  If possible, the exponent is reduced to fit by adding zeros to the
  coefficient."* This is the `clamp=1` behaviour: the *value* is preserved and the
  *significance* is not, which for money means your two-place amount can come back
  with a different exponent under an interchange context.

## Reading flags as evidence

Because six of the nine are flag-only, the flags are the audit trail of a
calculation. The pattern is always: clear, compute, read.

```python
from decimal import getcontext, Inexact, Rounded, Clamped

def compute_with_audit(fn, *args):
    ctx = getcontext()
    ctx.clear_flags()
    result = fn(*args)
    return result, {
        "rounded": bool(ctx.flags[Rounded]),
        "inexact": bool(ctx.flags[Inexact]),
        "clamped": bool(ctx.flags[Clamped]),
    }
```

`Rounded` and `Inexact` are not the same question, and the difference is the one
people get wrong. `Rounded` is *"Rounding occurred though possibly no information
was lost… even if those digits are zero (such as rounding `5.00` to `5.0`)"*.
`Inexact` is *"rounding occurred and the result is not exact… Signals when
non-zero digits were discarded"*. So `Rounded` without `Inexact` means digits were
dropped but they were all zeros — a change in *significance*, not in value.
For money you usually want `Inexact`; for a system that treats significance as
meaningful, you want both.

## Choosing a trap policy

There are three defensible postures, and mixing them by accident is where trouble
starts.

1. **Default.** Stop on meaningless results, record everything else. Right for
   almost all application code.
2. **Strict, scoped.** `localcontext` with `Inexact` (and often `Rounded`) trapped
   around a block that must be exact — a reconciliation, an allocation check, a
   ledger posting. The module intro sells exactly this: *"an option to enforce
   exact arithmetic by using exceptions to block any inexact operations."*
3. **Permissive, deliberate.** `ExtendedContext`, where *"No traps are enabled (so
   that exceptions are not raised during computations)"* — *"Because the traps are
   disabled, this context is useful for applications that prefer to have result
   value of `NaN` or `Infinity` instead of raising exceptions. This allows an
   application to complete a run in the presence of conditions that would
   otherwise halt the program."* Right for a batch that must produce a row per
   input, with `NaN` marking the failures — and only if something downstream
   actually checks for `NaN`.

A fourth switch is orthogonal to all three: trapping `FloatOperation` so that
accidental float contact fails loudly. That belongs with float interoperation and
is worked through in [10h](10h-decimal-and-the-other-numeric-types.md).

`BasicContext` is the fourth posture and it is a debugging tool, not a deployment
target: *"All traps are enabled (treated as exceptions) except `Inexact`,
`Rounded`, and `Subnormal`. Because many of the traps are enabled, this context is
useful for debugging."*

## Gotchas

**★ `Rounded` fires when nothing was lost.** Rounding `5.00` to `5.0` sets
`Rounded` and not `Inexact`. Code that alerts on `Rounded` in the belief that it
means "we lost money" will fire on harmless changes of significance. Alert on
`Inexact`.

**★ Untrapped `InvalidOperation` returns `NaN`, and `NaN` propagates silently.**
*"If not trapped, returns `NaN`."* Every subsequent operation on it produces
another `NaN`, and every ordering comparison against it is `False` — including
both `x > 0` and `x <= 0`. If you disable the default traps for a batch job, you
must check `is_nan()` at the end, or the failures leave the building as zeros or
blanks.

**★ `ExtendedContext` disables *all* traps, including the three you wanted.**
Reaching for it to silence one noisy `Inexact` also switches off
`InvalidOperation`, `DivisionByZero` and `Overflow`. Build a context from
`getcontext().copy()` and clear the single trap you meant to clear.

**★ Trapped exceptions carry almost no message.** The signal classes are raised as
conditions, not as diagnostics — there is no "which operand" or "which operation"
in the exception. Wrap the arithmetic and re-raise with context of your own if the
traceback needs to name the invoice line.

**★ Sticky flags make an unclear flag check meaningless.** `ctx.flags[Inexact]`
being true tells you rounding happened *at some point since the flags were last
cleared* — possibly in an unrelated library, possibly at import time. Always
`clear_flags()` immediately before the block you are measuring.

**★ Setting a trap globally can break third-party code.** Trapping `Inexact`
application-wide means any library doing a division inside a `Decimal` raises.
Trap narrowly, inside `localcontext`, around the arithmetic you own.

**★ `DivisionByZero` is trapped by default, but `1/0` in `Decimal` is not the only
way to reach it.** The docs list *"division, modulo division, or when raising a
number to a negative power"*. `Decimal(0) ** -1` raises.

## Interview questions

**★ What is the difference between the `Rounded` and `Inexact` signals?**
`Rounded` says digits were discarded; `Inexact` says the discarded digits were not
all zero, so the value changed. Rounding `5.00` to `5.0` sets `Rounded` alone —
significance was lost, value was not. Rounding `5.05` to `5.0` sets both. For a
money audit you want `Inexact`, because that is the one that means the number is
no longer the number.

**★ Your batch job must not abort on a bad row. How do you configure `decimal`, and
what must you add?**
Switch that job to a permissive context — `ExtendedContext`, or a copy of the
default with the three traps cleared — so an invalid operation yields `NaN`
instead of raising. Then you must add the check that the traps were doing for you:
`is_nan()` (or `is_finite()`) on every result before it is written, plus a flag
read so you know the run was not clean. Without that second half you have not made
the job robust, you have made it silent.

**★ What is the difference between a flag and a trap?**
The flag is a record; the trap is a policy. When a condition arises the flag is
set unconditionally, and then, only if the trap enabler for that signal is on, a
Python exception is raised. Flags are sticky and must be cleared with
`clear_flags()` before they mean anything. So flags let you *audit* a computation
("was anything rounded?") and traps let you *forbid* one ("nothing here may
round").

**★ Which signals are trapped by default, and why those three?**
`InvalidOperation`, `DivisionByZero` and `Overflow`. They are the conditions where
continuing produces a value with no arithmetic meaning — `NaN`, a signed infinity,
or a magnitude outside the representable range — so the default is to stop.
`Inexact`, `Rounded`, `Subnormal`, `Underflow`, `Clamped` and `FloatOperation` all
leave a usable result behind, so they are recorded rather than raised.

**★ How would you prove that a particular block of money arithmetic was exact?**
Clear the flags, run the block, and check `Inexact` — or, better, trap it so the
proof is enforced rather than inspected:

```python
with localcontext() as ctx:
    ctx.traps[Inexact] = True
    ctx.traps[Rounded] = True
    result = compute()
```

Anything that rounds now raises. This is the module's documented mechanism for
"exact arithmetic": *"an option to enforce exact arithmetic by using exceptions to
block any inexact operations."*

**★ Why does `except ZeroDivisionError` catch a `Decimal` division by zero?**
Because `DivisionByZero` is declared as
`DivisionByZero(DecimalException, exceptions.ZeroDivisionError)` — deliberate
multiple inheritance so that generic numeric code, written before anyone thought
about `Decimal`, keeps working. The same trick makes `FloatOperation` a
`TypeError`, and makes `DecimalException` an `ArithmeticError` so a single
`except ArithmeticError` covers int, float and decimal failures alike.

---

← Prev: [quantize and fixed-point discipline](10c-quantize-and-fixed-point-discipline.md) · Index: [Numbers](README.md) · Next → [Rounding modes for money](10e-rounding-modes-for-money.md)

{/* FOOTER */}
