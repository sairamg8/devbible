---
title: "push registers an __exit__ without calling __enter__, which is how a half-built object cleans up after itself, and pop_all moves a whole callback stack to a new stack without running any of it — together they turn ExitStack into the commit/rollback primitive the language does not otherwise have"
sidebar_label: "06zc · `push`, `pop_all`, ownership"
sidebar_position: 159
---

<span className="db-tier t-understand">Master</span>

> Verified: 2026-09 against the Python 3.14 standard library —
> [`contextlib`](https://docs.python.org/3.14/library/contextlib.html) (`ExitStack.push`,
> `ExitStack.pop_all`, `ExitStack.close`). Target: **Python 3.14**. Documentation-validated;
> **no sandbox run**.

**[06zb](06zb-exitstack-the-stack-you-build-at-runtime.md) covered the two registrations you use
every day. The remaining two methods are the ones that make `ExitStack` more than a convenience,
because they decouple *when cleanups are registered* from *when they run*. `push` puts an
`__exit__` on the stack without invoking the matching `__enter__`, which is precisely what a
half-built object needs — it is the documented repair for 06p's leak, applied from inside
`__enter__` itself. `pop_all` moves the entire stack of registered cleanups into a fresh
`ExitStack` and runs none of them, so the block can end without unwinding: either because
ownership is being handed to a caller, or because the operation succeeded and the rollback should
be dropped rather than executed. Between them they are the all-or-nothing construction pattern —
build many resources, and on any failure release exactly the ones you took.**

## `push` — an `__exit__` without an `__enter__`

> *"Adds a context manager's `__exit__()` method to the callback stack."*

> *"As `__enter__` is *not* invoked, this method can be used to cover part of an `__enter__()`
> implementation with a context manager's own `__exit__()` method."*

> *"If passed an object that is not a context manager, this method assumes it is a callback with
> the same signature as a context manager's `__exit__()` method and adds it directly to the
> callback stack."*

> *"By returning true values, these callbacks can suppress exceptions the same way context manager
> `__exit__()` methods can."*

> *"The passed in object is returned from the function, allowing this method to be used as a
> function decorator."*

The second sentence names the use case exactly, and it is the one 06p left open. A manager that
acquires two things inside `__enter__` has no cleanup guarantee until `__enter__` returns, so it
must unwind by hand. `push` lets it do that with the same `__exit__` that would have run anyway:

```python
from contextlib import ExitStack

class ImportSession:
    def __init__(self, pool, root):
        self.pool = pool
        self.root = root

    def __enter__(self):
        with ExitStack() as stack:
            self.conn = self.pool.acquire()
            stack.callback(self.pool.release, self.conn)

            self.workspace = tempfile.mkdtemp(dir=self.root)
            stack.callback(shutil.rmtree, self.workspace, ignore_errors=True)

            self.conn.execute("BEGIN")            # any failure above or here unwinds
            stack.push(self)                      # 🔴 registers self.__exit__, does not re-enter
            self._stack = stack.pop_all()
        return self

    def __exit__(self, exc_type, exc, tb):
        if exc_type is None:
            self.conn.execute("COMMIT")
        else:
            self.conn.execute("ROLLBACK")
```

Read what that `__enter__` guarantees. If `tempfile.mkdtemp` raises, the connection is released.
If `BEGIN` raises, the workspace is removed *and* the connection released, in that order. If
everything succeeds, `pop_all` moves the whole stack onto `self._stack` and the local `with`
exits having nothing left to run — so the resources survive the constructor and are released by
`self._stack.close()` later.

⚠️ `push(self)` here registers this object's own `__exit__` — the transaction decision — so it
runs *after* the block, in the same reverse order as everything else. The alternative spelling,
registering a plain function with the three-argument `__exit__` signature, is what the third quoted
sentence allows.

## `pop_all` — move the stack, run nothing

> *"Transfers the callback stack to a fresh `ExitStack` instance and returns it. No callbacks are
> invoked by this operation - instead, they will now be invoked when the new stack is closed
> (either explicitly or implicitly at the end of a `with` statement)."*

🔴 **"No callbacks are invoked by this operation" is the entire mechanism.** After `pop_all()` the
original stack is empty, so when its `with` block ends it unwinds nothing. Two patterns follow.

**All-or-nothing construction.** A factory that opens many resources should open all of them or
none, and hand the caller a single thing to close:

```python
def open_all(paths):
    """Open every path or none. Returns the handles and the manager that closes them."""
    with ExitStack() as stack:
        handles = [stack.enter_context(open(p, encoding="utf-8")) for p in paths]
        closer = stack.pop_all()      # nothing is closed here
    return handles, closer

handles, closer = open_all(REPORT_PATHS)
with closer:
    merge(handles)
```

If the seventh `open` raises, `pop_all` is never reached, the `with` unwinds normally and the six
already-open files are closed. If all succeed, the caller receives them plus one manager that
closes them in reverse order.

**Dropping a rollback on success.** Register the undo first; delete it if you get to the end:

```python
from contextlib import contextmanager, ExitStack

@contextmanager
def transaction(conn):
    conn.execute("BEGIN")
    with ExitStack() as stack:
        stack.callback(conn.execute, "ROLLBACK")
        yield conn
        stack.pop_all()               # success: the rollback is moved to a stack
    conn.execute("COMMIT")            # that is never closed, so it never runs
```

The discarded stack is the point: its callbacks *"will now be invoked when the new stack is
closed"*, and nothing closes it, so `ROLLBACK` is never executed. Any exception from the block
propagates out of the `with ExitStack()` before `pop_all` runs, the rollback fires, and `COMMIT` is
never reached. This is the shape to reach for whenever cleanup means *undo* and success means
*forget the undo*.

## `close` — unwinding without a `with`

> *"Immediately unwinds the callback stack, invoking callbacks in the reverse order of
> registration. For any context managers and exit callbacks registered, the arguments passed in
> will indicate that no exception occurred."*

That second sentence is the sharp edge of the ownership-transfer pattern. An explicit `close()`
tells every registered `__exit__` that the block finished cleanly — three `None` arguments, in the
language of 06o's step 7 — even when you are calling it because something went wrong. Anything on
the stack that distinguishes success from failure will decide *success*.

## Gotchas

**★ Symptom: `pop_all()` was called and now nothing is ever cleaned up.** Cause: the returned stack
was discarded. The callbacks *"will now be invoked when the new stack is closed"* — if nobody
closes it, they never run at all. That is deliberate in the rollback pattern and a leak everywhere
else. Fix: return it, store it, or enter it; the caller needs exactly one thing to close.

```python
def open_all(paths):
    with ExitStack() as stack:
        handles = [stack.enter_context(open(p, encoding="utf-8")) for p in paths]
        return handles, stack.pop_all()   # the closer goes back to the caller
```

**★ Symptom: a resource registered with `push` was never acquired, and the `as` name is missing or
wrong.** Cause: `push` does not enter anything — *"As `__enter__` is not invoked"* — it only
schedules an `__exit__`. Anything the manager's `__enter__` was supposed to do has not happened.
Fix: `enter_context` when you want the manager entered; `push` only when the acquisition is
already done by other means.

```python
with ExitStack() as stack:
    conn = stack.enter_context(pooled(ORDER_POOL))    # entered, and its __exit__ registered
    stack.push(self)                                  # only __exit__, deliberately
```

**★ Symptom: `TypeError` during unwind, naming a cleanup function and complaining about
arguments.** Cause: a plain zero-argument function was given to `push` instead of `callback`.
`push` *"assumes it is a callback with the same signature as a context manager's `__exit__()`
method"*, so it calls it with three arguments. Fix: `callback` for a plain function; `push` only
for something with an `__exit__` signature.

```python
stack.callback(gauge.decrement)           # called with no arguments
stack.push(handle_exit)                   # called as handle_exit(exc_type, exc, tb)
```

**★ Symptom: a transaction commits after a failure, from a path that calls `stack.close()` in an
`except` block.** Cause: `close()` reports a clean exit — *"the arguments passed in will indicate
that no exception occurred"* — so an `__exit__` that chooses between commit and rollback chooses
commit. Fix: let the `with` statement's exit carry the exception, which is the whole reason
`ExitStack` is itself a context manager.

```python
with ExitStack() as stack:
    conn = stack.enter_context(transaction(pool))
    import_rows(conn, rows)          # a raise here reaches transaction.__exit__ as an error
```

**★ Symptom: a cleanup registered with `push` swallowed an exception.** Cause: it can — *"By
returning true values, these callbacks can suppress exceptions the same way context manager
`__exit__()` methods can"* — and a function whose last line happens to return something truthy
qualifies, which is 06o's `return self._close()` accident in a new place. Fix: return `None` from a
pushed callback unless suppression is the intent.

```python
def restore_timeout(exc_type, exc, tb):
    conn.statement_timeout = previous
    # no return: the exception propagates
```

**Symptom: an object built by a factory leaks whenever the caller forgets to close it.** Cause:
ownership was transferred with `pop_all` but the result was returned as a bare object rather than
as something the caller must manage. Fix: return the stack, or give the object `__enter__` and
`__exit__` so the type system of the language — the `with` statement — enforces it.

```python
class OpenReports:
    def __init__(self, handles, closer):
        self.handles = handles
        self._closer = closer

    def __enter__(self):
        return self.handles

    def __exit__(self, exc_type, exc, tb):
        self._closer.close()
```

## Interview questions

**★ What problem does `pop_all` solve, and how would you use it for commit/rollback?**
It separates registering a cleanup from running it: *"Transfers the callback stack to a fresh
`ExitStack` instance and returns it. No callbacks are invoked by this operation."* That gives you
an all-or-nothing block. Register the undo as soon as the thing to undo exists, so any failure
before the end unwinds it; then, at the very end, call `pop_all()` — the callbacks move to a new
stack, the current block ends having nothing to run, and if you simply drop the new stack the undo
never happens. For a transaction that means registering `ROLLBACK` as a callback, yielding, and
calling `pop_all()` on the success path before executing `COMMIT`. The alternative — a
`succeeded = True` flag checked in a `finally` — is the same logic written by hand, and it is
wrong the first time someone adds an early return.

**★ Why would you use `push` rather than `enter_context`?**
Because you want the cleanup without the acquisition. The docs say it plainly: *"As `__enter__` is
not invoked, this method can be used to cover part of an `__enter__()` implementation with a
context manager's own `__exit__()` method."* That is the answer to the leak 06p describes — a
manager acquiring several resources inside its own `__enter__` has no guarantee yet, so it opens a
local `ExitStack`, registers each undo as it goes, pushes its own `__exit__` for the final state,
and calls `pop_all()` once everything succeeded. Any failure part-way through unwinds exactly the
resources actually taken. `enter_context` would be wrong there because the object is mid-
construction; there is nothing to enter.

**★ Is calling `stack.close()` the same as letting the `with` block end?**
No, and the difference causes real bugs. `close()` *"immediately unwinds the callback stack"* but
reports a clean exit: *"For any context managers and exit callbacks registered, the arguments
passed in will indicate that no exception occurred."* So any registered manager that distinguishes
success from failure — a transaction, an audit row, a metric — sees success regardless of why you
called it. Letting the `with` end passes the real exception details through, which is the whole
value of the stack being a context manager. Reserve `close()` for a stack whose lifetime has been
detached from any block by `pop_all`, where by construction there is no exception to report.

**How do you write a factory that returns an object owning several resources, without leaking on
partial failure?**
Open a local `ExitStack`, acquire each resource through `enter_context` (or acquire it and register
its undo with `callback`), and end the block with `pop_all()`, storing the returned stack on the
object you are building. Partial failure then unwinds exactly what was taken, in reverse order,
because until `pop_all` runs the local stack still owns everything. Success transfers the whole
stack to the object, whose `close` — or better, whose `__exit__` — closes it. The reason to prefer
giving the object `__enter__` and `__exit__` over returning a bare handle plus a closer is that a
caller can forget to call a function, but a `with` statement cannot forget to call `__exit__`.

**Can a callback registered with `push` suppress an exception?**
Yes, and that is the difference between `push` and `callback`. A `callback` registration *"cannot
suppress exceptions (as they are never passed the exception details)"*, whereas a pushed object is
invoked with the full `__exit__` signature and *"by returning true values, these callbacks can
suppress exceptions the same way context manager `__exit__()` methods can"*. That makes `push` the
only `ExitStack` registration that can change control flow — and it inherits 06o's accident, where
a cleanup function ending in `return something()` suppresses everything by mistake. If you do not
want that power, use `callback`, which cannot have the bug.

---

← Prev: [`ExitStack` — the stack you build at runtime](06zb-exitstack-the-stack-you-build-at-runtime.md) · Index: [EAFP vs LBYL](README.md) · Next → [The jump that discards](06k-the-jump-that-discards.md)
