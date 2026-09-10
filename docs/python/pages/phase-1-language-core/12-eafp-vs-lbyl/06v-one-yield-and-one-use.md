---
title: "A generator-based context manager must yield exactly once on every path and may be entered exactly once, which makes the factory — never the manager — the only thing you are allowed to keep, and puts every @contextmanager result in the narrowest of the standard library's three lifetime classes"
sidebar_label: "06v · One yield and one use"
sidebar_position: 153
---

<span className="db-tier t-understand">Master</span>

> Verified: 2026-09 against the Python 3.14 standard library —
> [`contextlib`](https://docs.python.org/3.14/library/contextlib.html)
> (`@contextmanager`'s single-use paragraph and the *Reentrant context managers* /
> *Reusable context managers* sections). Target: **Python 3.14**.
> Documentation-validated; **no sandbox run**.

**[06q](06q-contextlib-when-the-object-does-not-cooperate.md) covered what happens *inside* one
`with` block that uses a generator-based manager. This page covers its lifetime: how many times
it may yield, and how many times it may be entered. Both answers are "exactly one", and both are
enforced by the same underlying fact — the manager *is* a generator, and a generator that has run
to completion is exhausted. That single fact produces two errors that look completely different
(a branch that forgets to yield, and a manager stored in a variable and reused), gives the
standard library its three-way taxonomy of single-use, reusable and reentrant managers, and
explains why the only thing you are allowed to hold onto is the factory. The compensation for
never holding a manager is [06w](06w-the-decorator-form.md): the same factory can be spelled
with an `@` on a function, and then the caller holds nothing at all.**

## Exactly one yield, on every path

A generator that reaches the end without yielding cannot enter — `__enter__` advances it looking
for a value and finds the generator finished instead. The docs name the failure in passing, in
the single-use paragraph:

> *"Context managers created using `@contextmanager` are also single use context managers, and
> will complain about the underlying generator failing to yield if an attempt is made to use
> them a second time"*

— and the message the docs show for that complaint is `RuntimeError: generator didn't yield`.
The same error appears on the *first* use whenever a branch skips the `yield`, which is the more
common version of the bug and does not look like a context-manager problem at all:

```python
@contextmanager
def maybe_transaction(conn, enabled):
    if not enabled:
        return                                 # 🔴 no yield on this path
    conn.execute("BEGIN")
    try:
        yield conn
    except Exception:
        conn.execute("ROLLBACK")
        raise
    else:
        conn.execute("COMMIT")
```

Every path through the generator must reach exactly one `yield`. The "do nothing" branch yields
anyway, and the manager is entered, inert, and exited:

```python
@contextmanager
def maybe_transaction(conn, enabled):
    if not enabled:
        yield conn                             # entered, does nothing, exits cleanly
        return
    conn.execute("BEGIN")
    try:
        yield conn
    except Exception:
        conn.execute("ROLLBACK")
        raise
    else:
        conn.execute("COMMIT")
```

⚠️ **What a generator that yields a *second* time raises is not stated on the `contextlib` page
I verified against.** The documented contract is *"must yield exactly one value"*, and a second
yield is rejected rather than ignored — but I could not confirm the exception type or the message
from the 3.14 documentation, so do not write a test that asserts on either. Treat "yields twice"
as a bug your reviewer catches, not as a behaviour you rely on.

## Single use: the manager is the generator

`advisory_lock(conn, 42)` does not acquire a lock. It builds a generator, and each call builds a
new one. Reusing one is exactly the failure the docs name:

```python
lock = advisory_lock(conn, ORDER_LOCK_KEY)
with lock:
    conn.execute(insert_sql)
with lock:                    # 🔴 RuntimeError: generator didn't yield — the generator
    conn.execute(update_sql)  #    ran to completion in the first statement
```

The fix is to keep the *factory*, never the manager:

```python
with advisory_lock(conn, ORDER_LOCK_KEY):
    conn.execute(insert_sql)
with advisory_lock(conn, ORDER_LOCK_KEY):   # a fresh generator per statement
    conn.execute(update_sql)
```

This is why a module-level `LOCK = advisory_lock(conn, 42)` or a `self._tx = transaction(conn)`
cached on a service object is always wrong, and why the wrongness is invisible on the first
request and total on the second.

## The three classes the docs define, and which one you are in

The standard library distinguishes three lifetimes, and a `@contextmanager` result sits in the
narrowest.

**Reusable** — enterable many times, but not while already entered:

> *"These context managers support being used multiple times, but will fail (or otherwise not
> work correctly) if the specific context manager instance has already been used in a containing
> with statement."*

> *"`threading.Lock` is an example of a reusable, but not reentrant, context manager (for a
> reentrant lock, it is necessary to use `threading.RLock` instead)."*

**Reentrant** — enterable while already entered, which is strictly stronger:

> *"These context managers can not only be used in multiple `with` statements, but may also be
> used *inside* a `with` statement that is already using the same context manager."*

> *"`threading.RLock` is an example of a reentrant context manager, as are `suppress()`,
> `redirect_stdout()`, and `chdir()`."*

**Single use** — enterable once, full stop. That is where every `@contextmanager` result lands,
because it is a generator. So a generator-based manager is not reusable *and* not reentrant, and
the two failures are separate: reusing it across two sequential `with` statements fails, and
nesting it inside itself fails as well.

🔴 **The taxonomy is about the manager *object*, never about the factory.** `suppress()` is
listed as reentrant, and `suppress(OSError)` called twice gives you two objects anyway. A
codebase that calls its factories at the point of use never has to think about any of this; a
codebase that hoards manager objects in attributes has to know exactly which of the three classes
each one is in.

## Gotchas

**★ Symptom: `RuntimeError: generator didn't yield` on a manager that worked a moment ago.**
Cause: the manager object was stored and entered twice. Managers built by `@contextmanager` are
*"single use context managers, and will complain about the underlying generator failing to yield
if an attempt is made to use them a second time"*. Fix: store a callable that builds one, not the
one you built.

```python
def order_lock(conn):
    return advisory_lock(conn, ORDER_LOCK_KEY)

with order_lock(conn):
    conn.execute(insert_sql)
with order_lock(conn):
    conn.execute(update_sql)
```

**★ Symptom: `RuntimeError: generator didn't yield` the very first time, on one branch only.**
Cause: an early `return`, or a conditional that skips the `yield`. The iterator *"must yield
exactly one value"*, on every path — including the path that is supposed to do nothing. Fix:
yield on the disabled branch too; an entered-but-inert manager is the shape the library itself
uses for optional behaviour.

```python
@contextmanager
def maybe_transaction(conn, enabled):
    if not enabled:
        yield conn
        return
    conn.execute("BEGIN")
    try:
        yield conn
    except Exception:
        conn.execute("ROLLBACK")
        raise
    else:
        conn.execute("COMMIT")
```

**★ Symptom: a service works for one request and fails for every request after it.** Cause: the
manager was built once — in `__init__`, at import time, or as a default argument — and entered
per request. The first request exhausts the generator. Fix: build it per use; if the
configuration is what you want to keep, keep a `partial` or a small method, not a manager.

```python
class OrderService:
    def __init__(self, conn):
        self.conn = conn                       # not: self.tx = transaction(conn)

    def _tx(self):
        return maybe_transaction(self.conn, enabled=True)

    def place(self, order):
        with self._tx() as conn:
            insert_order(conn, order)
```

**★ Symptom: a manager that works standalone fails when a helper it calls opens the same
manager.** Cause: the same manager *object* was passed down and entered again inside its own
block. A `@contextmanager` result is single use, so it is neither reusable nor reentrant — the
docs reserve reentrancy for managers that *"may also be used inside a `with` statement that is
already using the same context manager"*, and list `threading.RLock`, `suppress()`,
`redirect_stdout()` and `chdir()`, not this. Fix: pass the factory (or the already-entered
resource), never the manager.

```python
def place(conn):
    with maybe_transaction(conn, enabled=True) as tx_conn:
        insert_order(tx_conn, order)
        record_audit(tx_conn)                  # takes the entered resource, not the manager

def record_audit(tx_conn):
    tx_conn.execute(audit_sql)                 # does not re-enter anything
```

**Symptom: a manager built in a list comprehension and entered in a loop fails after the first
item.** Cause: same single-use rule, hidden by the collection — `[transaction(c) for c in conns]`
builds managers eagerly, and any retry or second pass over the list re-enters exhausted ones.
Fix: build the list of *arguments*, and construct the manager at the point of entry — or hand the
whole set to an `ExitStack`, which enters each exactly once
([06zb](06zb-exitstack-the-stack-you-build-at-runtime.md)).

```python
for conn in connections:
    with maybe_transaction(conn, enabled=True) as tx_conn:
        insert_order(tx_conn, order)
```

## Interview questions

**★ Why is a `@contextmanager` result single use, and what does the failure look like?**
Because the manager *is* the generator object, and the generator runs to completion when the
`with` block exits. Entering it a second time advances an exhausted generator, so `__enter__`
asks for a value and gets `StopIteration` — the docs describe these as *"single use context
managers"* that *"will complain about the underlying generator failing to yield if an attempt is
made to use them a second time"*, and the message shown is `RuntimeError: generator didn't
yield`. The confusing part is that the same message appears for the unrelated first-use bug where
a branch forgets to yield, so the error text alone does not tell you which of the two you have —
look at whether the manager came from a variable or from a call.

**★ What is the difference between a single-use, a reusable and a reentrant context manager?**
Three widening lifetimes. Single use may be entered once. Reusable *"support[s] being used
multiple times, but will fail (or otherwise not work correctly) if the specific context manager
instance has already been used in a containing with statement"* — `threading.Lock` is the docs'
example, and the failure mode there is a deadlock rather than an exception. Reentrant is stronger
again: such managers *"may also be used inside a `with` statement that is already using the same
context manager"*, and the docs name `threading.RLock`, `suppress()`, `redirect_stdout()` and
`chdir()`. Every `@contextmanager` result is in the narrowest class. The practical consequence is
that the distinction only matters if you keep manager objects around; a codebase that calls its
factory at each `with` never enters the taxonomy at all.

**★ You need a manager that can be entered many times. How do you write it?**
Not as a generator. Either write a class whose `__enter__` acquires and whose `__exit__`
releases — the object then holds no per-use state, so each entry is independent — or, far more
often, keep the `@contextmanager` and pass the *factory* around instead of the manager. The
second is nearly always the right answer, because "a manager you can enter many times" is usually
just "a manager you construct many times", and constructing is free until `__enter__` advances
the generator. If you genuinely need reentrancy — entering while already inside — you are asking
for the `RLock` shape, and you need explicit depth counting in the class, because nothing in
`contextlib` provides it for you.

**A colleague keeps a manager on `self` "to avoid reallocating it". What do you tell them?**
That there is nothing to reallocate. Calling a `@contextmanager` factory only constructs a
generator; nothing before the `yield` executes until `__enter__` advances it, so the object being
saved is not holding a connection, a lock or a file — it is holding a suspended function. The
saving is nil and the cost is a class of bug that passes every test that exercises one request
and fails in production on the second, with an error message (`generator didn't yield`) that
points at the generator rather than at the attribute assignment that caused it. If the goal is to
avoid repeating configuration, keep a bound method or a `functools.partial` that builds the
manager.

---

← Prev: [`contextlib` when the object won't cooperate](06q-contextlib-when-the-object-does-not-cooperate.md) · Index: [EAFP vs LBYL](README.md) · Next → [The decorator form](06w-the-decorator-form.md)
