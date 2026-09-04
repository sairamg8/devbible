---
title: "A perfectly shaped try can still guard nothing, because whether a call raises at all is sometimes a property of the process rather than of the call — decimal contexts and warning filters are the two in the standard library you will meet first"
sidebar_label: "06j · Ambient state"
sidebar_position: 153
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09 against
> [`decimal`](https://docs.python.org/3.14/library/decimal.html) (signals, flags and traps,
> `DefaultContext`, `localcontext`, the per-thread context) and
> [`warnings`](https://docs.python.org/3.14/library/warnings.html) (the `"error"` filter
> action, the default filter list, the `action:message:category:module:line` spec,
> `simplefilter`, `catch_warnings` and its thread-safety note).
> Target: **Python 3.14**. Documentation-validated; **no sandbox run**.

**[06f](06f-whose-exception-is-it.md) through [06l](06l-the-else-you-cannot-write.md) are all
about the shape of the statement: which class, which lines, which clause. This chunk is the
case where the shape is perfect and the guard still does nothing, because whether the call
raises **at all** is decided by process-wide state the statement cannot see. It has one
signature in production: a handler that fires in one environment and not another, with
identical source. A `decimal` context decides whether a malformed string raises or returns
`NaN`; a warning filter decides whether a deprecation is an exception. The platform-level
cases — `-O` deleting your `assert`, and a filesystem that disagrees with `os.access` — are
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

🔴 **"for the active thread" is load-bearing.** The docs say *"Each thread has its own
current context which is accessed or changed using the `getcontext()` and `setcontext()`
functions"* — so a `setcontext()` call at import time configures **the importing thread
only**. In a threaded server every worker gets a fresh copy of `DefaultContext`, and a trap
you set in `main` is simply not there when a request handler runs. Setting the trap
per-operation, as above, is the only version that survives a thread pool — and the failure
mode is the nastiest kind, because a single-threaded test suite cannot see it.

### The flag you can read instead of the exception you did not get

`decimal` is unusual in giving you a documented way to detect the failure you chose not to
trap. Every signal has two switches:

> *"For each signal there is a flag and a trap enabler. When a signal is encountered, its
> flag is set to one, then, if the trap enabler is set to one, an exception is raised."*

The flag is set **whether or not** the trap is enabled. So a batch job that must not abort on
one bad row can leave the trap off, do the work, and inspect afterwards — LBYL applied to the
outcome rather than to the input:

```python
with localcontext() as ctx:
    ctx.traps[decimal.InvalidOperation] = False
    ctx.flags[decimal.InvalidOperation] = False       # start clean
    totals = [Decimal(row.amount) for row in rows]    # bad rows become NaN, no exception
    if ctx.flags[decimal.InvalidOperation]:
        logger.warning("%d rows parsed, at least one malformed", len(totals))
```

⚠️ Flags are **sticky** — the docs advise that *"Generally, new contexts should only set
traps and leave the flags clear"*, precisely because a flag stays set until something clears
it. Reading a flag you did not reset tells you that a signal occurred at some point in this
thread's context, not that it occurred in your block. Scoping with `localcontext()` is what
makes the reading meaningful, because entry copies the context and exit restores the
previous one.

## Warning filters: the call that raises only in CI

The same shape, one module over. A `warnings.warn()` call normally prints and continues — but
the filter action `"error"` is documented as *"turn matching warnings into exceptions"*, and
`warn()` itself *"raises an exception if the particular warning issued is changed into an
error by the warnings filter"*.

So `-W error` in CI, or a `simplefilter("error")` in a test fixture, converts a library's
`DeprecationWarning` into a raise at a call site whose `try` names something else entirely:

```python
# 🔴 Fine locally. In CI under `-W error`, the DeprecationWarning raises and nothing
#    here catches it — the handler names the wrong thing because it was written
#    against a process where warnings did not raise.
try:
    parsed = legacy_parse(payload)        # emits DeprecationWarning internally
except ValueError:
    return None
```

The repair is not to widen the clause; it is to decide, deliberately, what warnings mean in
this process, and to scope the decision:

```python
import warnings

with warnings.catch_warnings():
    warnings.simplefilter("ignore", DeprecationWarning)   # scoped, explicit, documented
    parsed = legacy_parse(payload)
```

### Why you never saw the warning in the first place

The reason this lands as a surprise rather than a known risk is that Python hides most
deprecations from you by default. The documented filter list, *"in order of precedence"*:

```text
default::DeprecationWarning:__main__
ignore::DeprecationWarning
ignore::PendingDeprecationWarning
ignore::ImportWarning
ignore::ResourceWarning
```

🔴 Read the first two lines together: a `DeprecationWarning` is shown **only when it is
triggered in `__main__`**, and ignored everywhere else. So a deprecation raised inside a
library — which is where they nearly all come from — is invisible during ordinary
development and becomes an exception the moment CI runs under `-W error`. That is the whole
mechanism behind "it works on my machine and fails in the pipeline", and it is a default
rather than a misconfiguration. (In a debug build *"the list of default warning filters is
empty"*, which is a third behaviour again.)

The filter format is worth knowing because it is what you will type into CI:

> *"Individual warnings filters are specified as a sequence of fields separated by colons:
> `action:message:category:module:line`"* — and when several are listed on one line, as in
> `PYTHONWARNINGS`, *"the filters listed later take precedence over those listed before
> them"*.

So `-W error -W default::DeprecationWarning:third_party` promotes everything to an error
except the dependency you have not migrated yet — a far better position than widening a
handler to absorb whatever CI throws.

⚠️ `catch_warnings` is *"A context manager that copies and, upon exit, restores the warnings
filter and the `showwarning()` function"* — and it carries a thread-safety caveat that is
easy to miss: *"If the `context_aware_warnings` flag is false, then `catch_warnings` will
modify the global attributes of the `warnings` module. This is not safe if used within a
concurrent program (using multiple threads or using asyncio coroutines)."* Same lesson as
`decimal`'s per-thread context, arriving from the opposite direction: there, state was more
local than you expected; here it may be more global.

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
cannot see the difference. Fix: never configure decimals once, globally; scope the context to
the operation with `localcontext()`, which sets it *"for the active thread"* whichever thread
that turns out to be.

**★ Symptom: a test suite fails with an exception the production code has no handler for,
and the source is identical.** Cause: the suite runs under `-W error` or a
`simplefilter("error")` fixture, and the filter action `"error"` is documented as
*"turn matching warnings into exceptions"* — so a `DeprecationWarning` from a dependency is a
raise in CI and a log line in production. Fix: decide what the warning means and scope the
decision, rather than widening a handler to absorb it.

```python
with warnings.catch_warnings():
    warnings.simplefilter("ignore", DeprecationWarning)
    parsed = legacy_parse(payload)
```

**★ Symptom: a deprecation you have never seen locally breaks the build the week the
dependency ships it.** Cause: the default filter list is `default::DeprecationWarning:__main__`
followed by `ignore::DeprecationWarning` — the warning is shown only when triggered in
`__main__`, so every deprecation originating inside a library is silent during development.
Fix: turn them on in development, where you can act on them, and keep the escape hatch
narrow.

```bash
python -W default::DeprecationWarning -m pytest          # see them while developing
python -W error -W default::DeprecationWarning:legacy_pkg -m pytest   # fail on all but one
```

**Symptom: a decimal flag reports a malformed row that was in a previous request.** Cause:
flags are sticky — the docs advise that *"new contexts should only set traps and leave the
flags clear"* because a set flag persists in the thread's context until cleared. Fix: scope
with `localcontext()` and clear the flag on entry, so what you read is about your block.

```python
with localcontext() as ctx:
    ctx.flags[decimal.InvalidOperation] = False
    totals = [Decimal(row.amount) for row in rows]
    if ctx.flags[decimal.InvalidOperation]:
        logger.warning("at least one malformed amount in this batch")
```

**Symptom: `catch_warnings` in a threaded test run produced flaky, order-dependent
results.** Cause: the documented caveat — *"if the `context_aware_warnings` flag is false,
then `catch_warnings` will modify the global attributes of the `warnings` module. This is not
safe if used within a concurrent program (using multiple threads or using asyncio
coroutines)."* One test's filter leaks into another's thread. Fix: set the filter once for
the process (`-W`, or `filterwarnings` in the test configuration) rather than per-test inside
concurrent code.

## Interview questions

**★ Is there a case where `Decimal("not a number")` raises nothing at all?**
Yes, and it is a configuration property rather than a code property. The constructor raises
only *"if the context traps `InvalidOperation`"*, and otherwise *"returns a new Decimal with
the value of `NaN`"*. The default context does trap it — `DefaultContext` carries *"enabled
traps for `Overflow`, `InvalidOperation`, and `DivisionByZero`"* — so the common case raises
and a handler naming `decimal.InvalidOperation` is correct. A process that installed its own
`Context` with a narrower `traps` list gets a silent `NaN` instead, and a perfectly correct
handler never runs. If the parse is a trust boundary, set the trap in a `localcontext()`
rather than inheriting whatever the process happens to have.

**★ Why is a `decimal` trap set once at import time not enough in a threaded server?**
Because the current context is per-thread: *"Each thread has its own current context which is
accessed or changed using the `getcontext()` and `setcontext()` functions."* A `setcontext()`
in `main` configures the importing thread and nothing else, so every worker in the pool starts
from a copy of `DefaultContext` instead. The failure mode is the nastiest kind — it passes a
single-threaded test suite and changes behaviour only under concurrency. Scope the context to
the operation with `localcontext()`, which the docs define as setting the context *"for the
active thread"*, whichever thread ends up running the parse.

**★ How do you detect a `decimal` signal you deliberately chose not to trap?**
Read the flag. The docs separate the two switches explicitly: *"For each signal there is a
flag and a trap enabler. When a signal is encountered, its flag is set to one, then, if the
trap enabler is set to one, an exception is raised."* The flag is set either way, so a batch
job can leave the trap off, process every row, and check `ctx.flags[decimal.InvalidOperation]`
afterwards to decide whether the batch is trustworthy. It is LBYL applied to the outcome
rather than to the input, and it is the right shape when aborting on the first bad row is
worse than finishing. The catch is that flags are sticky — the docs advise leaving them clear
in new contexts — so clear the flag on entry and scope the whole thing with `localcontext()`,
or you are reading history rather than your own block.

**★ Your narrow `try` fires in CI and never in production, with identical source. Where do
you look?** At everything that is a property of the process rather than of the code. The
warning filter first — `"error"` is documented as *"turn matching warnings into exceptions"*,
so `-W error` in CI makes a dependency's `DeprecationWarning` a raise. Then any library with
an ambient context — `decimal` being the standard-library example, where the same call raises
or returns `NaN` depending on a per-thread `traps` list. Then the interpreter flags and the
platform, which are [06m](06m-the-guard-the-platform-deletes.md). Environment variables and
the config file are where people look first and are the least likely cause, because those
usually change *what* the code does rather than *whether it raises*.

**★ Why have you probably never seen a `DeprecationWarning` from one of your dependencies?**
Because the default filters hide it. The documented list begins
`default::DeprecationWarning:__main__` and then `ignore::DeprecationWarning`, which together
mean: show it if it was triggered in the `__main__` module, ignore it otherwise. Nearly every
deprecation you care about is triggered inside library code, so it is silenced by default.
The consequence is that deprecations arrive as a cliff rather than a slope — invisible for a
year, then an exception the day CI adds `-W error` or the day the dependency turns the
warning into a removal. The fix is to run development and tests with
`-W default::DeprecationWarning` so the slope is visible, and to narrow rather than disable
when one dependency is not ready.

**How do you promote warnings to errors without breaking on a dependency you cannot fix
today?** Use the filter spec's precedence rather than an exception handler. Filters are
`action:message:category:module:line`, and when several are given *"the filters listed later
take precedence over those listed before them"*, so `-W error` followed by a narrower `-W
default::DeprecationWarning:legacy_pkg` promotes everything except that one module. That
keeps the guarantee — any *new* deprecation fails the build — while parking the known one in
a place a reader can see and delete later. Wrapping the call site in a wider `except` clause
does the opposite: it hides the new ones too, and it is exactly the width defect the rest of
this topic is about.

---

← Prev: [The `else` you cannot write](06l-the-else-you-cannot-write.md) · Index: [EAFP vs LBYL](README.md) · Next → [The guard the platform deletes](06m-the-guard-the-platform-deletes.md)
