---
title: "A perfectly shaped try can still guard nothing, because whether a call raises at all is sometimes a property of the process rather than of the call — the decimal context is the one in the standard library you will meet first"
sidebar_label: "06j · Ambient state"
sidebar_position: 165
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-10 against [`decimal`](https://docs.python.org/3.14/library/decimal.html) —
> signals, flags and trap enablers, `DefaultContext` / `BasicContext` / `ExtendedContext`,
> `getcontext` / `setcontext` / `localcontext`, `Context.create_decimal`, and the per-signal
> "if not trapped, returns…" entries.
> Target: **Python 3.14** (docs build 3.14.7). Documentation-validated; **no sandbox run**.

**[06f](06f-whose-exception-is-it.md) through [06l](06l-the-else-you-cannot-write.md) are all
about the shape of the statement: which class, which lines, which clause. This chunk is the
case where the shape is perfect and the guard still does nothing, because whether the call
raises **at all** is decided by process-wide state the statement cannot see. It has one
signature in production: a handler that fires in one environment and not another, with
identical source. `decimal` is the standard library's clearest example — the same
`Decimal(raw)` raises or hands you `NaN` depending on a per-thread context object nobody in
the call stack mentions. The other ambient switch, the warnings filter, is
[06t](06t-warning-filters.md); the platform-level cases — `-O` deleting your `assert`, and a
filesystem that disagrees with `os.access` — are
[06m](06m-the-guard-the-platform-deletes.md).**

## `decimal`: whether it raises is a property of the context

First the class, because it is the part people get wrong first. `DecimalException` is
*"Base class for other signals and a subclass of `ArithmeticError`"* — a family of its own,
so `except ValueError` will never catch one however much "that string is not a number"
sounds like a `ValueError`. That much is [06c](06c-the-breadth-of-one-class.md)'s subject.

The width problem is the second half. Whether the constructor raises **at all** is ambient:

> *"The purpose of the context argument is determining what to do if value is a malformed
> string. If the context traps `InvalidOperation`, an exception is raised; otherwise, the
> constructor returns a new Decimal with the value of `NaN`."*

The default does trap it — `DefaultContext` carries *"enabled traps for `Overflow`,
`InvalidOperation`, and `DivisionByZero`"* — so the handler in
[06f](06f-whose-exception-is-it.md)'s receipt repair is correct for a process that has never
touched the context. A process that installed its own `Context` with a narrower `traps` list
gets `Decimal('NaN')` back, the handler never fires, and the `NaN` travels to the database.
**A correct guard, a correct class, and nothing raised.**

The repair is to stop inheriting and start declaring, at the boundary where you parse:

```python
import decimal
from decimal import Decimal, localcontext

def parse_total(raw: str) -> Decimal:
    with localcontext(traps={decimal.InvalidOperation: True}):
        try:
            return Decimal(raw)       # raises here regardless of the ambient context
        except decimal.InvalidOperation as exc:
            raise BadReceipt(f"unparseable total: {raw!r}") from exc
```

`localcontext(ctx=None, **kwargs)` *"Return[s] a context manager that will set the current
context for the active thread to a copy of ctx on entry to the with-statement and restore
the previous context when exiting"*, and *"The kwargs argument is used to set the attributes
of the new context"* — keyword arguments have been supported since 3.11, so the one-liner
above needs no `ctx.traps[...]` assignment.

### Every signal has a documented value it returns when it is not trapped

This is the part that makes the failure silent rather than loud. An untrapped signal is not
"nothing happened"; it is a documented substitute result that flows onward like any other
value. The reference gives the substitute per signal:

| Signal | Trapped in `DefaultContext`? | What the operation returns if **not** trapped |
|---|---|---|
| `InvalidOperation` | yes | *"If not trapped, returns `NaN`"* |
| `DivisionByZero` | yes | *"If this signal is not trapped, returns `Infinity` or `-Infinity` with the sign determined by the inputs"* |
| `Overflow` | yes | a rounded infinity or largest-magnitude result (also signals `Inexact` and `Rounded`) |
| `Inexact` | no | *"The rounded result is returned"* |
| `Rounded` | no | the rounded result |
| `FloatOperation` | no | the conversion or comparison simply succeeds |

So an untrapped `decimal` failure does not produce `None`, or an error return, or anything a type
checker can see. It produces a `Decimal` that compares unequal to itself and poisons every sum it
enters. `except` cannot help you; the substitute value is the whole problem.

`ExtendedContext` is the packaged version of that choice and the reference says so plainly —
*"No traps are enabled (so that exceptions are not raised during computations)"*, and it is
*"useful for applications that prefer to have result value of `NaN` or `Infinity` instead of
raising exceptions. This allows an application to complete a run in the presence of
conditions that would otherwise halt the program."* That is a legitimate design. It is also,
if a colleague installed it three modules away, the exact reason your handler is dead code.

## The context is per-thread, and that has two consequences

🔴 **"for the active thread" is load-bearing.** The docs say *"Each thread has its own
current context which is accessed or changed using the `getcontext()` and `setcontext()`
functions"* — so a `setcontext()` call at import time configures **the importing thread
only**. In a threaded server every worker gets a fresh copy of the default, and a trap you
set in `main` is simply not there when a request handler runs. The failure mode is the
nastiest kind, because a single-threaded test suite cannot see it.

There *is* a documented process-wide knob, and it comes with its own timing rule:

> `DefaultContext` — *"This context is used by the `Context` constructor as a prototype for
> new contexts."* … *"This context is most useful in multi-threaded environments. Changing
> one of the fields before threads are started has the effect of setting system-wide
> defaults. Changing the fields after threads have started is not recommended as it would
> require thread synchronization to prevent race conditions."*

So there are exactly two defensible positions, and "call `setcontext()` in `main`" is
neither of them:

```python
import decimal

# 1. Process-wide, and only legitimate BEFORE any thread starts.
decimal.DefaultContext.traps[decimal.InvalidOperation] = True
decimal.setcontext(decimal.DefaultContext.copy())   # this thread too

# 2. Per-operation, which is correct whichever thread ends up running it.
with decimal.localcontext(traps={decimal.InvalidOperation: True}):
    total = decimal.Decimal(raw)
```

For a parse at a trust boundary, prefer (2). It is local, it is visible in the diff next to the
`try` it protects, and it does not depend on import order or on which thread got there first.

## The flag you can read instead of the exception you did not get

`decimal` is unusual in giving you a documented way to detect the failure you chose not to
trap. Every signal has two switches:

> *"For each signal there is a flag and a trap enabler. When a signal is encountered, its
> flag is set to one, then, if the trap enabler is set to one, an exception is raised. Flags
> are sticky, so the user needs to reset them before monitoring a calculation."*

The flag is set **whether or not** the trap is enabled. So a batch job that must not abort on
one bad row can leave the trap off, do the work, and inspect afterwards — LBYL applied to the
outcome rather than to the input:

```python
with localcontext() as ctx:
    ctx.traps[decimal.InvalidOperation] = False
    ctx.clear_flags()                                 # documented reset; start clean
    totals = [Decimal(row.amount) for row in rows]    # bad rows become NaN, no exception
    if ctx.flags[decimal.InvalidOperation]:
        logger.warning("%d rows parsed, at least one malformed", len(totals))
```

⚠️ Reading a flag you did not reset tells you that a signal occurred at some point in this
thread's context, not that it occurred in your block — *"it is best to clear the flags before
each set of monitored computations by using the `clear_flags()` method."* Scoping with
`localcontext()` is what makes the reading meaningful, because entry copies the context and
exit restores the previous one.

## The constructor ignores the context; `create_decimal` obeys it

One more ambient asymmetry, and it catches people who have already learned the trap rule:

> `Context.create_decimal(num='0', /)` — *"Creates a new Decimal instance from num but using
> self as context. Unlike the `Decimal` constructor, the context precision, rounding method,
> flags, and traps are applied to the conversion."*

`Decimal("1.23456789012345678901234567890")` is **exact** — `prec` does not touch it, because the
constructor is not a computation. The same string through `ctx.create_decimal(...)` is rounded to
`ctx.prec` and can set `Inexact` and `Rounded`. Both are correct; they answer different questions.
If your ingest path assumes "the context governs everything decimal", half your pipeline is not
governed at all.

## Gotchas

**★ Symptom: `except decimal.InvalidOperation` never fires and totals arrive as `NaN`.**
Cause: the process installed a `Context` whose `traps` list omits `InvalidOperation`, so the
constructor *"returns a new Decimal with the value of `NaN`"* rather than raising. The guard
was correct and the leap simply did not fail. Fix: declare the trap at the parse boundary
instead of inheriting it.

```python
with localcontext(traps={decimal.InvalidOperation: True}):
    total = Decimal(raw)          # raises whatever the ambient context is
```

**★ Symptom: the decimal trap you set at startup works in tests and not under load.** Cause:
the current context is per-thread — *"Each thread has its own current context"* — so a
`setcontext()` in `main` never reaches the worker threads, and a single-threaded test suite
cannot see the difference. Fix: never configure decimals once from inside a request path;
either mutate `DefaultContext` *"before threads are started"*, or — better — scope the
context to the operation with `localcontext()`, which sets it *"for the active thread"*
whichever thread that turns out to be.

**★ Symptom: a division that used to raise now yields `Decimal('Infinity')` and the invoice
total is meaningless.** Cause: `DivisionByZero` untrapped is not an error, it is a value —
*"If this signal is not trapped, returns `Infinity` or `-Infinity`."* The docs' own
`ExtendedContext` example shows `Decimal(42) / Decimal(0)` evaluating to
`Decimal('Infinity')`. Fix: trap it where the arithmetic happens, or check the flag after,
but do not rely on an `except` clause alone.

```python
with localcontext(traps={decimal.DivisionByZero: True, decimal.InvalidOperation: True}):
    unit_price = total / quantity
```

**Symptom: a decimal flag reports a malformed row that was in a previous request.** Cause:
flags are sticky — *"Flags are sticky, so the user needs to reset them before monitoring a
calculation."* A set flag persists in the thread's context until cleared. Fix: scope with
`localcontext()` and clear on entry, so what you read is about your block.

```python
with localcontext() as ctx:
    ctx.clear_flags()
    totals = [Decimal(row.amount) for row in rows]
    if ctx.flags[decimal.InvalidOperation]:
        logger.warning("at least one malformed amount in this batch")
```

**Symptom: a `float` sneaked into a money calculation and nothing complained.** Cause:
`FloatOperation` is not in the default trap list, so mixing is silently allowed; the docs'
example enables `c.traps[FloatOperation] = True` precisely to make *"accidental mixing of
decimals and floats in constructors or ordering comparisons"* raise. ⚠️ Note the documented
asymmetry even when trapped: `Decimal('3.5') < 3.7` raises, but `Decimal('3.5') == 3.5`
is documented as `True`. Fix: trap `FloatOperation` in the money boundary rather than trying
to catch a `TypeError` that will never come.

**Symptom: `prec` is set to 9 and a 30-digit string round-trips at full precision anyway.**
Cause: you used the constructor. *"Unlike the `Decimal` constructor, the context precision,
rounding method, flags, and traps are applied"* — that sentence is about `create_decimal`,
which means the constructor applies none of them. Fix: use `getcontext().create_decimal(raw)`
when you want the context's precision and traps to govern the conversion, and keep the plain
constructor where exactness matters.

## Interview questions

**★ Is there a case where `Decimal("not a number")` raises nothing at all?**
Yes, and it is a configuration property rather than a code property. The constructor raises
only *"if the context traps `InvalidOperation`"*, and otherwise *"returns a new Decimal with
the value of `NaN`"*. The default context does trap it — `DefaultContext` carries *"enabled
traps for `Overflow`, `InvalidOperation`, and `DivisionByZero`"* — so the common case raises
and a handler naming `decimal.InvalidOperation` is correct. A process that installed
`ExtendedContext`, or its own narrower `Context`, gets a silent `NaN` instead, and a
perfectly correct handler never runs. If the parse is a trust boundary, set the trap in a
`localcontext()` rather than inheriting whatever the process happens to have.

**★ Why is a `decimal` trap set once at import time not enough in a threaded server?**
Because the current context is per-thread: *"Each thread has its own current context which is
accessed or changed using the `getcontext()` and `setcontext()` functions."* A `setcontext()`
in `main` configures the importing thread and nothing else, so every worker in the pool starts
from a copy of the default instead. The failure mode is the nastiest kind — it passes a
single-threaded test suite and changes behaviour only under concurrency. The documented
process-wide route is to mutate `DefaultContext` *"before threads are started"*, which the
docs warn is *"not recommended"* once they have; the route that always works is
`localcontext()`, defined as setting the context *"for the active thread"*, whichever thread
ends up running the parse.

**★ How do you detect a `decimal` signal you deliberately chose not to trap?**
Read the flag. The docs separate the two switches explicitly: *"For each signal there is a
flag and a trap enabler. When a signal is encountered, its flag is set to one, then, if the
trap enabler is set to one, an exception is raised."* The flag is set either way, so a batch
job can leave the trap off, process every row, and check `ctx.flags[decimal.InvalidOperation]`
afterwards to decide whether the batch is trustworthy. It is LBYL applied to the outcome
rather than to the input, and it is the right shape when aborting on the first bad row is
worse than finishing. The catch is that *"flags are sticky"* — so call `clear_flags()` on
entry and scope the whole thing with `localcontext()`, or you are reading history rather than
your own block.

**★ An untrapped decimal signal does not raise. What does it do instead, and why is that
worse than an exception?**
It substitutes a documented value and carries on: `InvalidOperation` *"returns `NaN`"*,
`DivisionByZero` *"returns `Infinity` or `-Infinity`"*, `Inexact` returns the rounded result.
That is worse than an exception for three reasons. The value has the right static type, so no
checker and no signature flags it. `NaN` propagates through arithmetic instead of stopping
it, so the corruption reaches persistence rather than the log. And it compares unequal to
itself, so an equality assertion downstream fails in a place that has nothing to do with the
parse. An exception is loud, local and has a traceback; a substitute value is silent,
travelling and stateless.

**Which is the better fix at a money boundary — `setcontext` at startup or `localcontext`
per operation?**
`localcontext`, in almost every case. The startup route depends on import order, on which
thread ran it, and on no library changing the context after you; the per-operation route is
none of those things and is visible in the same diff as the `try` it exists to make
meaningful. The one place the startup route is documented as correct is mutating
`DefaultContext` *"before threads are started"* to set *"system-wide defaults"* — a
deliberate, once-per-process act at the top of `main`, not a call buried in a module that
happens to get imported. The cost of `localcontext` is a context copy per operation; if that
matters in a hot loop, hoist it to the loop rather than to the process.

**Why does `except ValueError` feel right for `Decimal("abc")` and never work?**
Because the mental model is "string parsing", and Python's string-parsing failures — `int()`,
`float()`, `datetime.strptime` — really do raise `ValueError`. `decimal` is not modelling
string parsing; it is modelling IBM's General Decimal Arithmetic Specification, where a
malformed operand is an *arithmetic signal* like overflow or division by zero.
`DecimalException` is therefore *"a subclass of `ArithmeticError`"*, and the family sits
beside `ZeroDivisionError` and `OverflowError` rather than beside `ValueError`. Getting this
wrong costs you twice: the clause never matches, and because the default context traps the
signal, the exception you did not name propagates out of a `try` that looks handled.

---

← Prev: [What escapes an `except*`](06y-what-escapes-an-except-star.md) · Index: [EAFP vs LBYL](README.md) · Next → [Warning filters](06t-warning-filters.md)
