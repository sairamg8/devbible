---
title: "A cleanup that can fail is a width defect dressed as hygiene — it overwrites the class every handler upstack is matching on, demoting the real failure to __context__ where no except clause can see it"
sidebar_label: "06i · When cleanup raises"
sidebar_position: 150
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09 against the Python 3.14 Language Reference —
> [The `try` statement](https://docs.python.org/3.14/reference/compound_stmts.html#the-try-statement)
> (the saved-exception/context rule) and
> [The `raise` statement](https://docs.python.org/3.14/reference/simple_stmts.html#the-raise-statement)
> (`__cause__`, `__context__`, `from None`, `__suppress_context__`, and both traceback
> separators, quoted from the reference's own worked examples).
> Target: **Python 3.14**. Documentation-validated; **no sandbox run**.

**[06k](06k-the-jump-that-discards.md) covered the `finally` that jumps. This is the
`finally` that *raises* — the quieter defect, because nothing is discarded and the traceback
looks complete. What actually happens is a substitution: the original failure is demoted to
`__context__` and the class the caller matches on becomes the cleanup's. Every `except`
clause upstack is now being asked about the wrong failure, which is the same width defect as
[06f](06f-whose-exception-is-it.md)'s, arriving from the opposite direction — and with no
handler written anywhere in sight. The mechanism is the language's implicit chaining, which
is worth understanding on its own terms, because `__context__` and `__cause__` mean
different things and only one of them is yours to set.**

## When `finally` itself raises

The last sentence of the execution paragraph is the one that decides what your on-call
engineer sees:

> *"If the `finally` clause raises another exception, the saved exception is set as the
> context of the new exception."*

So the original failure is not lost — but the **class the caller matches on** is the
cleanup's. A retry policy keyed on `ConnectionError` will not fire for a `ConnectionError`
that got overwritten by an `OSError` from a close:

```python
# 🔴 A failing close rewrites the class of a failing request.
conn = pool.acquire()
try:
    return conn.execute(query)
finally:
    conn.close()                      # if this raises, that is what the caller sees
```

Note how little this looks like an error-handling bug. There is no handler in it at all.
The repair is to make cleanup unable to fail, or to make its failure explicitly secondary:

```python
conn = pool.acquire()
try:
    return conn.execute(query)
finally:
    try:
        conn.close()
    except Exception:                 # cleanup failure must not outrank the real one
        logger.exception("connection close failed")
```

That nested `try` looks ugly and is correct. The general rule: **a `finally` clause should
contain only operations you are willing to have replace the exception in flight.** Anything
else needs its own guard, exactly as the `try` suite does — the width discipline from
[06g](06g-width-at-a-boundary.md) applies to cleanup too, and almost nobody applies it there.

## What `__context__` actually is, and who sets it

The substitution above is not special-cased for `finally`. It is the language's implicit
chaining, and the `raise` statement documents it in general terms:

> *"A similar mechanism works implicitly if a new exception is raised when an exception is
> already being handled. An exception may be handled when an `except` or `finally` clause,
> or a `with` statement, is used. The previous exception is then attached as the new
> exception's `__context__` attribute."*

That sentence names all three places cleanup lives, `finally` included. The visible
consequence is the traceback separator:

> *"During handling of the above exception, another exception occurred:"*

which is different from the `from`-clause separator:

> *"The above exception was the direct cause of the following exception:"*

Two attributes, two meanings, and only one of them is yours to set:

| Attribute | Set by | Means |
|---|---|---|
| `__context__` | the interpreter, implicitly | something was already in flight when this was raised — possibly a coincidence |
| `__cause__` | you, via `raise X from exc` | this exception exists *because* of that one |

⚠️ The interpreter's implicit chaining is a fact about timing, not about causation, which is
why the separator hedges with *"during handling of"*. A cleanup failure that overwrites a
request failure is chained implicitly and reads as if the two were related — they usually are
not. `raise … from exc` is how you assert the relationship you actually mean; the full
treatment is [06b · Exception chaining](../11-exceptions/06b-exception-chaining.md).

You can also delete the chain:

> *"Exception chaining can be explicitly suppressed by specifying `None` in the `from`
> clause."*

`raise BadReceipt("unparseable total") from None` produces a traceback with no *"During
handling"* section at all — the reference notes the `__suppress_context__` attribute exists
*"to suppress automatic display of the exception context"*. That is right at an API boundary
where the internal cause would leak implementation detail, and wrong everywhere else,
because the thing you are deleting is the only record of what actually failed.

## Surfacing both failures instead of picking one

When the cleanup failure and the original failure are both real — a write failed *and* the
transaction would not roll back — neither should win. There are three honest shapes, in
increasing order of ceremony:

```python
# 1. Log the secondary, propagate the primary. The default; almost always right.
try:
    return conn.execute(query)
finally:
    try:
        conn.close()
    except Exception:
        logger.exception("connection close failed")

# 2. Chain explicitly, when the cleanup failure is the more actionable one.
try:
    return conn.execute(query)
except OperationalError as exc:
    try:
        conn.rollback()
    except Exception as cleanup_exc:
        raise RollbackFailed(query) from cleanup_exc   # names the real emergency
    raise

# 3. Raise both, when a caller genuinely has to handle each.
errors = []
try:
    result = conn.execute(query)
except OperationalError as exc:
    errors.append(exc)
    result = None
try:
    conn.close()
except Exception as exc:
    errors.append(exc)
if errors:
    raise ExceptionGroup("query and cleanup both failed", errors)
```

Shape 3 is what [08 · Exception groups](../11-exceptions/08-exception-groups.md) is for, and
it is the only one where nothing is demoted. It is also the most work for the caller, so
reach for it when both failures need separate handling — not by default.

## Gotchas

**★ Symptom: a retry policy keyed on `ConnectionError` stopped firing after a pool
upgrade.** Cause: a `finally: conn.close()` began raising, and *"if the `finally` clause
raises another exception, the saved exception is set as the context of the new exception"* —
the request's `ConnectionError` is still there as `__context__`, but the class the caller
matches on is the close's. Fix: make cleanup failures explicitly secondary.

```python
try:
    return conn.execute(query)
finally:
    try:
        conn.close()
    except Exception:
        logger.exception("connection close failed")
```

**★ Symptom: the on-call engineer debugged a connection-close bug for an hour; the actual
outage was a bad query.** Cause: implicit chaining prints the original **first** and the
overwriting exception **last**, under *"During handling of the above exception, another
exception occurred"* — and the last line of a traceback is what alerting extracts and what a
human reads first. Fix: do not let cleanup overwrite; if it must be visible, log it under
its own message so it is a separate event rather than the headline.

**★ Symptom: a `finally` that logs is fine in tests and breaks in production.** Cause: the
logging call is an operation like any other — a broken handler, a full disk or a formatting
`__repr__` that raises makes the log line the thing that replaces your exception. Fix: the
same rule as everywhere else on this page — if it can fail, guard it; a `finally` should
hold only what you are willing to have replace the exception in flight.

```python
finally:
    try:
        logger.info("query finished", extra={"sql": sql})
    except Exception:
        pass                       # a deliberate, narrow, documented swallow
```

**Symptom: `raise … from None` in a wrapper made a production bug undiagnosable.** Cause:
*"Exception chaining can be explicitly suppressed by specifying `None` in the `from`
clause"* — the traceback then has no *"During handling"* section and the original failure is
gone from the output entirely. Fix: reserve `from None` for boundaries where the cause is
genuinely an implementation detail the caller must not see, and log the cause before
suppressing it.

```python
except psycopg.OperationalError as exc:
    logger.exception("database unavailable")     # the cause survives in the log
    raise ServiceUnavailable() from None         # ...but not in the public traceback
```

**Symptom: both the write and the rollback failed, and only one appears anywhere.** Cause:
whichever raised last won, and the other became `__context__` on it — visible in a
traceback, invisible to every `except` clause. Fix: when a caller genuinely has to handle
each, raise both.

```python
if errors:
    raise ExceptionGroup("query and cleanup both failed", errors)
```

**Symptom: a wrapper's own exception class arrives with a `__context__` chain three deep and
nobody can tell which link was the real fault.** Cause: each layer caught, did cleanup that
raised, and re-raised — implicit chaining records every one, because it records *timing* and
timing always exists. Fix: convert the link you actually understand into a `__cause__` with
`raise … from exc`, so the chain has one asserted causal edge among the coincidental ones.

```python
except psycopg.OperationalError as exc:
    raise QueryFailed(query) from exc   # this edge is a claim, not a coincidence
```

## Interview questions

**★ If a `finally` clause raises, what happens to the exception that was already in flight?**
It survives, but demoted. *"If the `finally` clause raises another exception, the saved
exception is set as the context of the new exception."* So the original is reachable as
`__context__` on whatever the cleanup raised, and it is printed in the traceback under
*"During handling of the above exception, another exception occurred"*. What it is not, any
more, is the thing the caller's `except` clauses are matching against — which is why a
cleanup that can fail is a width defect dressed as hygiene. The exception the program acts
on has been substituted without anything looking like a handler being written.

**★ What is the difference between `__cause__` and `__context__`?**
`__context__` is set by the interpreter and records *timing*: *"A similar mechanism works
implicitly if a new exception is raised when an exception is already being handled … The
previous exception is then attached as the new exception's `__context__` attribute."* It
says something was in flight, not that the two are related. `__cause__` is set by you, with
`raise X from exc`, and asserts causation — the tracebacks even use different words,
*"During handling of the above exception"* versus *"The above exception was the direct cause
of the following exception"*. The practical upshot: a cleanup failure chained implicitly
*looks* causally related in the traceback and usually is not, so if you mean causation, say
it.

**★ Why does the width discipline from 06g apply to a `finally` clause as well?**
Because a `finally` clause is a block of code that can raise, sitting where its exception
will replace whatever was in flight. Every argument for "the `try` suite should contain one
expression" applies to it with more force, not less: the `try` suite's excess width merely
mis-attributes a failure to a handler, while the `finally` suite's excess width
*substitutes* the failure the whole program will act on. The practical form of the rule is a
single question about every line in a `finally`: am I willing to have this replace the
exception in flight? If the answer is no, it needs its own `try`.

**Why does the traceback print the original failure first and the overwriting one last, and
why does that matter operationally?**
Because that is the order they happened in, and the reference's own example shows it — the
`ZeroDivisionError` block, then *"During handling of the above exception, another exception
occurred:"*, then the `RuntimeError`. Chronological order is the right choice for reading a
traceback top to bottom. It is the wrong shape for tooling: every alerting pipeline extracts
the *last* line as the error, so the exception that gets paged on, grouped by and counted is
the one that happened last, which in a cleanup-overwrite is the least interesting of the
two. That asymmetry is the whole operational cost of letting cleanup raise — the diagnosis
is present in the traceback and absent from every dashboard.

**When is `raise … from None` right, and what does it cost?**
It is right at an API boundary where the internal cause would leak an implementation detail
the caller must never depend on — a driver class, an internal HTTP status. The reference
notes chaining *"can be explicitly suppressed by specifying `None` in the `from` clause"*,
and that `__suppress_context__` exists *"to suppress automatic display of the exception
context"*. The cost is total: the traceback loses the *"During handling"* section, so the
original failure is not in the output at all. The rule that makes it safe is to log the
cause immediately before suppressing it — the caller gets a clean exception and you keep the
diagnosis.

**How do you surface both a cleanup failure and the original failure without picking one?**
Three shapes, and the choice is about who has to handle what. Log the cleanup failure and
let the original propagate — the default, because cleanup failures are usually diagnostic
rather than actionable. Chain explicitly with `raise … from cleanup_exc` when the cleanup
failure is the more actionable of the two, for instance a rollback that did not happen. Or
raise an `ExceptionGroup` containing both, which is the only shape where nothing is demoted
and every `except*` clause upstack can match what it cares about — at the cost of making
every caller deal with a group. Picking silently is the one thing that is never right.

---

← Prev: [The jump that discards](06k-the-jump-that-discards.md) · Index: [EAFP vs LBYL](README.md) · Next → [The `else` you cannot write](06l-the-else-you-cannot-write.md)
