---
title: "ExitStack is what you reach for when the number of resources is not known until the program runs — it registers cleanups in a stack, unwinds them in reverse so the result is indistinguishable from nested with statements, and accepts three different kinds of registration for three different kinds of cleanup"
sidebar_label: "06zb · `ExitStack`"
sidebar_position: 158
---

<span className="db-tier t-understand">Master</span>

> Verified: 2026-09 against the Python 3.14 standard library —
> [`contextlib`](https://docs.python.org/3.14/library/contextlib.html) (`ExitStack` and its
> `enter_context` and `callback` methods, and the reverse-order paragraph).
> Target: **Python 3.14**. Documentation-validated; **no sandbox run**.

**A `with` statement, even a multi-item one, has its managers written into the source. That is a
compile-time list, and it is the one thing the construct cannot make variable: you cannot write a
`with` whose number of items depends on how many files the caller passed. `ExitStack` is the
escape hatch — a manager whose whole job is to hold other managers and cleanups registered while
the block runs, and to unwind them in reverse when it exits. The reverse order is what makes it
equivalent to nesting rather than merely similar to it, and it takes three kinds of registration
because there are three kinds of cleanup: a real context manager (`enter_context`), a plain
function call with no protocol at all (`callback`), and an `__exit__` you want on the stack
without invoking its `__enter__`. This page covers the first two and the ordering rule they share;
`push`, `pop_all`, and detaching a stack's lifetime from any block are
[06zc](06zc-push-pop-all-and-ownership-transfer.md).**

## What it is for

> *"A context manager that is designed to make it easy to programmatically combine other context
> managers and cleanup functions, especially those that are optional or otherwise driven by input
> data."*

Two phrases carry the selection rule. *"Programmatically combine"* — the set of managers is built
by running code, not by writing items in a statement. *"Optional or otherwise driven by input
data"* — the reason it is variable is usually a request, a config file or an argument list.

```python
from contextlib import ExitStack

def merge_reports(paths, out_path):
    with ExitStack() as stack:
        sources = [stack.enter_context(open(p, encoding="utf-8")) for p in paths]
        target = stack.enter_context(open(out_path, "w", encoding="utf-8"))
        for source in sources:
            shutil.copyfileobj(source, target)
```

Every file opened is closed, including on the run where the fourth of nine fails to open — the
first three are already on the stack, and the stack unwinds on the way out.

🔴 **If the number of managers *is* known in the source, do not use it.** `with A() as a, B() as
b:` states the same thing with less machinery, and 06p already showed that the multi-item form
nests. `ExitStack` earns its place only when a list, a condition or a loop decides the set.

## Reverse order is the guarantee

> *"Since registered callbacks are invoked in the reverse order of registration, this ends up
> behaving as if multiple nested `with` statements had been used with the registered set of
> callbacks."*

That sentence is the whole safety argument. Cleanups run last-registered-first, so a resource
derived from another is always released before the thing it came from — a cursor before its
connection, a file inside a temporary directory before the directory is removed. And because the
result is *"as if multiple nested `with` statements had been used"*, everything 06p establishes
about nesting transfers: a failure while acquiring the third resource happens inside the region
guarded by the first two, so they are cleaned up.

```python
with ExitStack() as stack:
    conn = stack.enter_context(pooled(ORDER_POOL))
    cursor = stack.enter_context(closing(conn.cursor()))
    workspace = stack.enter_context(temp_workspace())
    export(cursor, workspace)
    # unwind: workspace, then cursor, then conn — the reverse of acquisition
```

## `enter_context` — for something that is already a manager

> *"Enters a new context manager and adds its `__exit__()` method to the callback stack. The
> return value is the result of the context manager's own `__enter__()` method."*

> *"These context managers may suppress exceptions just as they normally would if used directly
> as part of a `with` statement."*

The second sentence matters and is easy to miss: a manager registered with `enter_context` keeps
its suppression powers. Registering `suppress(FileNotFoundError)` on a stack does not disarm it —
it will still swallow that class for the remainder of the stack's block, which is
[06z](06z-suppress.md)'s rest-of-the-block trap with an even larger block.

The value returned is what the `as` clause would have bound, which is why the assignment form
above reads naturally:

```python
sources = [stack.enter_context(open(p, encoding="utf-8")) for p in paths]
```

## `callback` — for cleanup that is not a manager at all

> *"Accepts an arbitrary callback function and arguments and adds it to the callback stack."*

> *"Unlike the other methods, callbacks added this way cannot suppress exceptions (as they are
> never passed the exception details)."*

> *"The passed in callback is returned from the function, allowing this method to be used as a
> function decorator."*

This is 06n's category — cleanup that is not an object's responsibility — given a home inside a
stack. Restoring a global, deleting a row you inserted for a test, decrementing a gauge,
unregistering a signal handler: none of those have a `close()` and none deserve a
`@contextmanager` of their own.

```python
def import_batch(conn, rows, gauge):
    with ExitStack() as stack:
        gauge.increment()
        stack.callback(gauge.decrement)

        previous_timeout = conn.statement_timeout
        conn.statement_timeout = IMPORT_TIMEOUT
        stack.callback(setattr, conn, "statement_timeout", previous_timeout)

        for row in rows:
            upsert_order(conn, row)
```

🔴 **The arguments belong to the registration, not to a closure.** `stack.callback(setattr, conn,
"statement_timeout", previous_timeout)` captures the values now. That is the point of the method
taking `*args` at all, and it is what makes it correct inside a loop where a `lambda` would close
over the loop variable and see only its final value.

Because callbacks *"cannot suppress exceptions (as they are never passed the exception details)"*,
a `callback` is strictly a cleanup — never a handler. If you need to see the exception, register a
real context manager instead.

## Gotchas

**★ Symptom: files opened inside a `with ExitStack()` block are never closed.** Cause: they were
opened, not *entered* — `ExitStack` has no way to know about a manager you did not register, and
`open(p)` on its own line simply produces an open file. Fix: every acquisition goes through
`enter_context`, and the return value is what you keep.

```python
with ExitStack() as stack:
    sources = [stack.enter_context(open(p, encoding="utf-8")) for p in paths]
    merge(sources)
```

**★ Symptom: a cleanup registered inside a loop restores the wrong value — the last one, for every
iteration.** Cause: it was registered as a `lambda` that closed over the loop variable, so all the
lambdas see the final binding. Fix: pass the callable and its arguments to `callback`, which is
exactly why the method accepts them.

```python
with ExitStack() as stack:
    for name, previous in overrides.items():
        stack.callback(settings.set, name, previous)   # values captured now
        settings.set(name, overrides[name])
```

**★ Symptom: an exception in the block is swallowed and the stack is blamed.** Cause: it was not
the stack — a manager registered with `enter_context` keeps its own behaviour, because such
managers *"may suppress exceptions just as they normally would if used directly as part of a
`with` statement"*. A `suppress(...)` on the stack suppresses for the rest of the stack's block.
Fix: do not register `suppress` on a long-lived stack; scope it to the statement it is meant to
guard.

```python
with ExitStack() as stack:
    conn = stack.enter_context(pooled(ORDER_POOL))
    with suppress(FileNotFoundError):          # scoped, not registered
        os.remove(stale_marker)
    export(conn)
```

**★ Symptom: a cleanup that needs to know whether the block failed always sees success.** Cause:
it was registered with `callback`, and such callbacks *"cannot suppress exceptions (as they are
never passed the exception details)"* — they receive nothing at all, so they cannot branch on the
outcome either. Fix: register a real context manager, whose `__exit__` is given the type, value
and traceback.

```python
@contextmanager
def audited(conn, batch_id):
    try:
        yield
    except Exception as exc:
        conn.execute(FAIL_SQL, batch_id, str(exc))
        raise
    else:
        conn.execute(SUCCEED_SQL, batch_id)

with ExitStack() as stack:
    stack.enter_context(audited(conn, batch_id))
    import_rows(conn, rows)
```

**★ Symptom: cleanups run in the order they were written, and a temporary directory is removed
while a file inside it is still open.** Cause: the acquisitions were registered in an order that
does not match their dependencies. Registration order is unwind order reversed —
*"registered callbacks are invoked in the reverse order of registration"* — so the dependency must
be acquired *first*, not merely acquired. Fix: register the container before its contents.

```python
with ExitStack() as stack:
    workspace = stack.enter_context(temp_workspace())     # removed last
    handle = stack.enter_context(open(workspace / "part.csv", "w"))  # closed first
    handle.write(payload)
```

**Symptom: `ExitStack` was introduced for two fixed resources and the reviewer objects.** Cause:
the construct is for sets decided at runtime — *"especially those that are optional or otherwise
driven by input data"*. Two known managers are a multi-item `with`, which states the nesting in
the syntax instead of building it. Fix: use the statement.

```python
with pooled(ORDER_POOL) as conn, closing(conn.cursor()) as cursor:
    export(cursor)
```

**Symptom: one failing cleanup does not stop the others, which was unexpected.** Cause: this is
correct and follows from the documented equivalence — the stack behaves *"as if multiple nested
`with` statements had been used"*, and in nested statements an inner `__exit__` that raises still
leaves the outer `__exit__` to run, with the new exception travelling outward. Fix: none required;
but if a cleanup is known to be flaky, contain it where it is registered rather than relying on
the unwind to be tidy.

```python
def release_quietly(pool, conn):
    try:
        pool.release(conn)
    except PoolError:
        log.warning("release failed", exc_info=True)

with ExitStack() as stack:
    conn = pool.acquire()
    stack.callback(release_quietly, pool, conn)
    export(conn)
```

## Interview questions

**★ When do you reach for `ExitStack` instead of a multi-item `with`?**
When the *set* of managers is decided at runtime — a list of files whose length comes from the
caller, a manager entered only when a flag is set, a resource per row of a config table. The docs
frame it exactly that way: it is for combining managers *"especially those that are optional or
otherwise driven by input data"*. If the managers are all visible in the source, the multi-item
`with` is better, because it states the nesting syntactically and needs no reader to reconstruct
it. The rule of thumb: if you would have to write a comprehension or a loop to produce the items,
you need the stack; if you could write them as items, write them as items.

**★ In what order does an `ExitStack` unwind, and why is that the interesting property?**
Reverse order of registration. The docs say so and then say what it buys: *"Since registered
callbacks are invoked in the reverse order of registration, this ends up behaving as if multiple
nested `with` statements had been used."* That equivalence is what makes the construct safe to
reason about — every property of nesting from 06p transfers, including that a failure while
acquiring the fifth resource is a failure inside the region guarded by the first four, so they are
released. It also means registration order is a dependency declaration: whatever is registered
first is released last, so a container must be entered before its contents.

**★ What is the difference between `enter_context` and `callback`, and when is each right?**
`enter_context` takes a real context manager, calls its `__enter__` (returning what the `as` clause
would have bound) and puts its `__exit__` on the stack — so it sees the exception details and
*"may suppress exceptions just as they normally would"*. `callback` takes any function plus
arguments and puts a call on the stack; it is never given the exception, and the docs are explicit
that such callbacks *"cannot suppress exceptions (as they are never passed the exception
details)"*. So: `enter_context` when the thing already implements the protocol or when the cleanup
must know how the block ended; `callback` for the plain undo — restore a global, decrement a
gauge, delete a scratch row — where writing a `@contextmanager` would be ceremony around a single
call.

**Why does `callback` take `*args` instead of leaving you to write a `lambda`?**
Because a `lambda` closes over names and a registration should capture *values*. Inside a loop,
`stack.callback(lambda: settings.set(name, previous))` registers N callables that all read the
final `name` and `previous`, and the bug appears only when more than one iteration runs — which is
rarely the case in the test. `stack.callback(settings.set, name, previous)` binds the arguments at
registration, which is what a cleanup almost always wants. The API taking arbitrary arguments is
not convenience; it is the correct-by-construction spelling of "undo *this*".

---

← Prev: [`nullcontext`](06za-nullcontext-the-manager-that-does-nothing.md) · Index: [EAFP vs LBYL](README.md) · Next → [`push`, `pop_all` and ownership transfer](06zc-push-pop-all-and-ownership-transfer.md)
