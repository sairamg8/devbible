---
title: "Cleanup that survives `finally`: acquire outside, never let the cleanup raise, and prefer `with` when an object owns the release"
sidebar_label: "3b · Cleanup patterns"
sidebar_position: 113
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09 against the Python 3.14 Language Reference
> [The `try` statement — `finally` clause](https://docs.python.org/3.14/reference/compound_stmts.html#finally-clause),
> the Tutorial
> [Defining Clean-up Actions](https://docs.python.org/3.14/tutorial/errors.html#defining-clean-up-actions)
> and [Predefined Clean-up Actions](https://docs.python.org/3.14/tutorial/errors.html#predefined-clean-up-actions),
> and the Library Reference
> [`contextlib`](https://docs.python.org/3.14/library/contextlib.html).
> Target: **CPython 3.14**.

**Knowing that `finally` always runs is the easy half. The hard half is writing a
`finally` body that is correct on every route — including the route where the
resource was never acquired and the route where the cleanup itself fails. Three
rules cover most of it: acquire *before* the `try`, never let the cleanup raise,
and if an object knows how to release itself, use `with` and delete the `try`
entirely. Ownership transfer and state restoration are the two remaining cases,
and they are [03c](03c-cleanup-ownership-and-state.md).**

## Rule 1 — acquire before the `try`

```python
# WRONG
try:
    conn = pool.acquire()      # if this raises...
    use(conn)
finally:
    conn.release()             # ...this raises NameError, masking the real error
```

The `finally` runs even when the acquisition failed, and then `conn` was never
bound. The `NameError` becomes the propagating exception; the real
`PoolExhausted` survives only as `__context__`, and any upstream `except
PoolExhausted:` stops matching.

```python
# RIGHT — the name is guaranteed bound before the finally can run
conn = pool.acquire()
try:
    use(conn)
finally:
    conn.release()
```

The pattern generalises: **whatever the `finally` touches must be bound before
the `try` starts.** If you cannot arrange that, initialise to a sentinel and
guard:

```python
conn = None
try:
    conn = pool.acquire()
    use(conn)
finally:
    if conn is not None:
        conn.release()
```

That version is correct but noisier, and the noise is a signal: it usually means
a context manager wants to exist.

## Rule 2 — a `finally` must not raise

The reference: *"If the `finally` clause raises another exception, the saved
exception is set as the context of the new exception."*

```python
try:
    raise ValueError("the real problem")
finally:
    conn.close()          # if close() raises, THAT is what propagates
```

Nothing is lost — the original appears in the traceback above *"During handling
of the above exception, another exception occurred"* — but the **type** that
propagates is now the cleanup's. Every handler upstream matched on `ValueError`
stops firing, retry logic stops retrying, and the error your monitoring groups on
changes.

Fallible cleanup should be explicitly allowed to fail:

```python
try:
    do_work()
finally:
    with contextlib.suppress(OSError):
        conn.close()
```

`contextlib.suppress` documents the intent in a way `try: ... except OSError:
pass` does not — see
**11 · `suppress`, warnings and the explicit ignore** *(not written yet)*.
If the cleanup failure is worth knowing about but must not replace the original:

```python
finally:
    try:
        conn.close()
    except Exception:
        logger.exception("failed to close connection")
```

`logger.exception` records the cleanup failure with its own traceback and the
handler completes normally, so the parked exception is re-raised unchanged.

## Rule 3 — if the object owns its release, use `with`

The tutorial calls these *"predefined clean-up actions"*:

> *"After the statement is executed, the file `f` is always closed, even if a
> problem was encountered while processing the lines. Objects which, like files,
> provide predefined clean-up actions will indicate this in their
> documentation."*

```python
# equivalent in effect
f = open(path)
try:
    process(f)
finally:
    f.close()

with open(path) as f:
    process(f)
```

The `with` form is better for reasons that are not stylistic:

- The acquisition is *inside* the construct, so rule 1 is enforced by the
  grammar — there is no window between acquiring and entering the guarded region.
- The cleanup lives with the object, so every caller gets it right instead of
  every caller re-deriving it.
- `contextlib.ExitStack` composes an unknown number of them without nesting.
- `contextlib.closing(thing)` retrofits `with` onto anything with `.close()`.

Reach for `try`/`finally` when there is no object to hang the cleanup on —
restoring a global, resetting a flag, popping a context variable, emitting a
metric — or when you are writing the context manager itself.

## Nested `finally` clauses unwind inside-out

```python
try:
    try:
        raise ValueError("boom")
    finally:
        print("inner")
finally:
    print("outer")
```

The inner `finally` runs first, then the outer, then the `ValueError` continues
outward. This is ordinary stack unwinding — each `finally` runs as the exception
passes through its frame — and it is what makes cleanup composable across call
boundaries: you never have to reason about a cleanup that belongs to a different
`try`.

The same ordering applies to nested `with` statements, and to `ExitStack`, which
unwinds its callbacks in reverse registration order.

## Gotchas

**★ Symptom — an unrelated error from a cleanup call replaces the real failure,
and the retry logic upstream stops working.** Cause: an exception raised inside
`finally` supersedes the parked one; the original survives only as `__context__`,
so the *type* that propagates changed. Fix: wrap fallible cleanup in
`contextlib.suppress(...)`, or in its own `try`/`except` that logs.

**★ Symptom — the traceback shows `NameError` from the cleanup line and the real
error is buried underneath.** Cause: the acquisition inside the `try` failed, so
the name the `finally` releases was never bound. Fix: acquire before the `try`,
or initialise to `None` and guard.

**Symptom — cleanup happens in the wrong order across nested blocks.** Cause: it
does not; `finally` unwinds inside-out, and the surprise is usually that the
*acquisitions* were in the wrong order. Fix: acquire in the order you want to
release in reverse, or use `ExitStack` and let registration order drive it.

**Symptom — an `except Exception:` inside a `finally` swallows a
`KeyboardInterrupt`-driven unwind.** Cause: it does not swallow the
`KeyboardInterrupt` itself (that is `BaseException`), but a broad handler inside
a `finally` catching an unrelated `Exception` can loop or block and make Ctrl-C
appear dead. Fix: cleanup bodies stay short, specific, and non-blocking.

## Interview questions

**★ Q: What happens if the `finally` block itself raises?**
The new exception propagates and the parked one becomes its `__context__` — both
appear in the traceback, joined by *"During handling of the above exception,
another exception occurred"*. Nothing is lost, but the exception *type* reaching
callers has changed, so handlers and retries matched on the original type stop
firing. Fallible cleanup should be wrapped in `suppress` or its own handler.

**★ Q: Why acquire a resource *before* the `try` rather than as its first line?**
Because the `finally` runs even when the acquisition failed, and then the name it
releases was never bound — you get a `NameError` from cleanup that masks the real
failure. Binding before the `try` makes the `finally` unconditionally valid.

**★ Q: `try`/`finally` versus `with` — when do you use each?**
`with` whenever the resource has a context manager: acquisition and release are
bound together, there is no gap, and `ExitStack` composes them. `try`/`finally`
for ad-hoc cleanup with no object to hang it on — restoring a global, resetting a
flag, emitting a metric — or when writing the context manager itself.

**Q: In what order do nested `finally` clauses run?**
Inside-out, as the exception unwinds through each frame. The innermost cleanup
completes before the next one starts.

---

← Prev: [`finally` and its guarantees](03-finally-and-its-guarantees.md) · Index: [Exceptions](README.md) · Next → [Ownership and state restoration](03c-cleanup-ownership-and-state.md)
