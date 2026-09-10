---
title: "nullcontext exists so that optional does not mean duplicated — it turns the choice of context manager into a value, and its enter_result argument extends that from optional behaviour to optional ownership of a resource you must not close"
sidebar_label: "06za · `nullcontext`"
sidebar_position: 157
---

<span className="db-tier t-understand">Master</span>

> Verified: 2026-09 against the Python 3.14 standard library —
> [`contextlib`](https://docs.python.org/3.14/library/contextlib.html) (`nullcontext` and its
> published example). Target: **Python 3.14**. Documentation-validated; **no sandbox run**.

**Every other member of `contextlib` on the last four pages exists to make something happen at the
end of a block. `nullcontext` exists to make nothing happen, and that is a real requirement rather
than a joke: without it, "this block is sometimes managed and sometimes not" has to be written as
two copies of the block, one indented under a `with` and one not — and two copies drift. It turns
the *choice of manager* into an ordinary value that an `if` expression can produce, so the body is
written once. Its `enter_result` argument is what lifts it from optional behaviour to optional
ownership: `nullcontext(sys.stdout)` hands the stream to the block and closes nothing, which is
exactly the contract for a resource the caller owns and you merely borrow.**

## The definition, and the docs' own example

> *"Return a context manager that returns enter_result from `__enter__()`, but otherwise does
> nothing. It is intended to be used as a stand-in for an optional context manager"*

The example the documentation gives pairs it with `suppress`
([06z](06z-suppress.md)), which is the clearest possible statement of the pattern — the two
branches choose *behaviour*, and the body is written once:

```python
def myfunction(arg, ignore_exceptions=False):
    if ignore_exceptions:
        # Use suppress to ignore all exceptions.
        cm = contextlib.suppress(Exception)
    else:
        # Do not ignore any exceptions, cm has no effect.
        cm = contextlib.nullcontext()
    with cm:
        # Do something
```

Written without it, the same function has the body twice, and the day someone fixes a bug in one
copy is the day the two behaviours diverge for good.

## `enter_result` — optional *ownership*, not just optional behaviour

The parameter is what makes the pattern work for resources. A manager that opens a file must
close it; a caller-supplied stream must not be closed. Both can be the same block:

```python
import contextlib
import sys

def write_report(rows, path=None):
    cm = open(path, "w", encoding="utf-8") if path else contextlib.nullcontext(sys.stdout)
    with cm as out:
        for row in rows:
            out.write(f"{row.id}\t{row.total}\n")
```

`sys.stdout` is handed straight through by `__enter__` and is **not** closed on exit, because the
manager *"otherwise does nothing"*. The alternatives are all worse:
`with open(path) if path else sys.stdout` does not even mean anything, and wrapping `sys.stdout`
in `closing()` ([06x](06x-closing-a-close-method-is-enough.md)) would close the process's standard
output for every later `print`.

The same shape solves the commonest API design problem in a data-access layer — a function that
may be given a connection or may have to open its own, where only one of those two must be
returned to the pool:

```python
@contextmanager
def pooled(pool):
    conn = pool.acquire()
    try:
        yield conn
    finally:
        pool.release(conn)

def load_orders(customer_id, conn=None):
    cm = contextlib.nullcontext(conn) if conn is not None else pooled(ORDER_POOL)
    with cm as active:
        return active.query(ORDERS_SQL, customer_id)
```

A caller inside a transaction passes its connection and keeps it; a caller with nothing passes
nothing and the function borrows and returns one. The body does not know which happened, and
neither branch can leak, because the branch that acquires is also the branch that releases.

## What it does not do

It has no `__exit__` behaviour at all, so it cannot suppress, cannot close, and cannot roll back.
If the "off" branch of your choice needs to *do* something — even just log — `nullcontext` is not
that branch's manager; a two-line `@contextmanager` is
([06q](06q-contextlib-when-the-object-does-not-cooperate.md)). And it does not make the value it
yields optional: `nullcontext()` with no argument yields `None`, which is correct for the
behaviour case and a bug the moment the block uses the `as` name for anything.

## Gotchas

**★ Symptom: `sys.stdout` is closed and every later `print` in the process fails, or a
caller-supplied connection is returned to a pool it does not belong to.** Cause: the "already have
one" branch used a manager that closes — `closing()`, or the same helper as the acquiring branch —
instead of one that does nothing. Fix: `nullcontext(existing)`, whose entire contract is to hand
the value through and *"otherwise do nothing"*.

```python
cm = contextlib.nullcontext(conn) if conn is not None else pooled(ORDER_POOL)
with cm as active:
    active.query(ORDERS_SQL, customer_id)
```

**★ Symptom: `AttributeError: 'NoneType' object has no attribute …` on the name bound by `as`, on
one branch only.** Cause: `nullcontext()` was called with no argument, so `__enter__` returned the
default `enter_result` of `None` — correct when the manager exists only for its side effects,
wrong when the block needs a value. Fix: pass the thing the block should use.

```python
cm = contextlib.nullcontext(sys.stdout) if path is None else open(path, "w", encoding="utf-8")
with cm as out:
    out.write(payload)
```

**★ Symptom: the managed and unmanaged versions of a function have drifted, and a bug fixed last
month is still live on one path.** Cause: the "optional manager" was expressed as an `if` around
two copies of the block rather than as a choice of manager. Fix: one body, one `with`, and the
branch reduced to picking a manager.

```python
def write_report(rows, path=None):
    cm = open(path, "w", encoding="utf-8") if path else contextlib.nullcontext(sys.stdout)
    with cm as out:                       # the body exists exactly once
        for row in rows:
            out.write(f"{row.id}\t{row.total}\n")
```

**Symptom: the "disabled" branch was supposed to log that it was disabled, and nothing is
logged.** Cause: `nullcontext` has no behaviour to hook — it is not a manager with an empty body
you can extend, it is the absence of one. Fix: write the two-line generator; it is the same
pattern with a place to put the side effect.

```python
@contextmanager
def noop_but_noted(label):
    log.debug("%s: manager disabled", label)
    yield None
```

**Symptom: a manager is built for a branch that is not taken, and it acquires something.** Cause:
the conditional expression evaluates whichever side it selects, but a refactor that builds *both*
managers first and then chooses between them constructs the real one unconditionally — and
06p's guarantee does not cover an object that was constructed and never entered. Fix: keep the
construction inside the conditional, so only the chosen manager is built.

```python
cm = pooled(ORDER_POOL) if conn is None else contextlib.nullcontext(conn)   # one is built
```

## Interview questions

**★ What is `nullcontext` for, and why not just write the `if` around the `with`?**
Because the `if` around the `with` duplicates the body, and duplicated bodies drift — a fix lands
in one copy and not the other, and nothing in review makes the second copy visible.
`nullcontext` turns the *choice of manager* into a value, so the body is written once and the
branch shrinks to one line: the docs say it *"is intended to be used as a stand-in for an optional
context manager"*. The `enter_result` parameter extends the idea from optional behaviour to
optional ownership, which is the more valuable half: `nullcontext(sys.stdout)` yields the stream
and closes nothing, so a function can accept a caller's resource or open its own without the block
knowing which.

**★ A function takes an optional database connection. How do you write it so that it releases the
one it opened and never the one it was given?**
Choose the manager by whether the caller supplied one — `contextlib.nullcontext(conn)` when they
did, a real acquiring manager when they did not — and put the single body under one `with`. The
property that makes this correct is that the branch which acquires is the same branch which
releases: the acquiring manager's `__exit__` returns the connection to the pool, and
`nullcontext`'s does nothing at all. The alternative implementations all fail somewhere — a
boolean `opened_it_myself` flag checked in a `finally` is the same logic written by hand and gets
skipped on an early return, and closing unconditionally destroys a caller's transaction.

**Does `nullcontext` suppress exceptions, and would you use it to disable a `suppress`?**
It suppresses nothing — it *"otherwise does nothing"*, which includes doing nothing on the
exception path, so anything raised in the block propagates normally. And yes, "disabling a
suppress" is precisely the documented example: the docs' own snippet selects
`contextlib.suppress(Exception)` when errors are to be ignored and `contextlib.nullcontext()` when
they are not, with the comment *"Do not ignore any exceptions, cm has no effect."* That is the
cleanest way to make error-swallowing a *parameter* rather than a branch — though everything
[06z](06z-suppress.md) says about `suppress(Exception)` still applies to the branch that selects
it.

**Is `nullcontext` the right way to write "no manager" in a list of managers passed to
`ExitStack`?**
Usually not. `ExitStack` already handles the optional case directly — it exists to combine managers
*"especially those that are optional or otherwise driven by input data"* — so you simply do not
call `enter_context` for the ones you do not want, rather than entering a placeholder for them
([06zb](06zb-exitstack-the-stack-you-build-at-runtime.md)). `nullcontext` is for the case where a
single `with` statement needs *a* manager in a fixed position and the choice is binary; `ExitStack`
is for the case where the number of managers is itself variable. Reaching for `nullcontext` inside
an `ExitStack` is a sign the two constructs have been swapped.

---

← Prev: [`suppress`](06z-suppress.md) · Index: [EAFP vs LBYL](README.md) · Next → [`ExitStack` — the stack you build at runtime](06zb-exitstack-the-stack-you-build-at-runtime.md)
