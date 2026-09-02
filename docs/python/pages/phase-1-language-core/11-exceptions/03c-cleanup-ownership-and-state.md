---
title: "Do not release what you are handing back, make releases idempotent, and let a context manager own the shape when you write it twice"
sidebar_label: "3c · Ownership and state"
sidebar_position: 114
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09 against the Python 3.14 Language Reference
> [The `with` statement](https://docs.python.org/3.14/reference/compound_stmts.html#the-with-statement)
> and [The `try` statement](https://docs.python.org/3.14/reference/compound_stmts.html#the-try-statement),
> the Library Reference
> [`contextlib.closing`](https://docs.python.org/3.14/library/contextlib.html#contextlib.closing),
> [`contextlib.ExitStack`](https://docs.python.org/3.14/library/contextlib.html#contextlib.ExitStack),
> [`contextlib.contextmanager`](https://docs.python.org/3.14/library/contextlib.html#contextlib.contextmanager),
> and the Tutorial
> [Predefined Clean-up Actions](https://docs.python.org/3.14/tutorial/errors.html#predefined-clean-up-actions).
> Target: **CPython 3.14**.

**Two cleanup bugs survive every rule in [03b](03b-finally-cleanup-patterns.md),
because both look correct in isolation. The first is releasing a resource the
caller was supposed to receive — `finally` fires on the success route too, so a
function that *returns* something derived from a resource must not clean it up
unconditionally. The second is a release that is not idempotent, running twice
because two routes both took responsibility. The fix for both is the same:
decide who owns the resource, and make ownership transfer explicit with a
context manager — the library tools for which are
[03d](03d-context-managers-as-cleanup.md).**

## Do not close what you are handing back

```python
def get_cursor(dsn):
    conn = connect(dsn)
    try:
        return conn.cursor()
    finally:
        conn.close()          # the cursor is dead before the caller sees it
```

Nothing here is wrong by the rules in 03b: `conn` is bound before the `try`, the
cleanup is unlikely to raise, and it runs on every route. It is still broken,
because the success route is one of those routes and on the success route the
caller wanted that connection alive.

Cleanup belongs on the failure route only, when the function transfers ownership:

```python
def get_cursor(dsn):
    conn = connect(dsn)
    try:
        return conn.cursor()
    except Exception:
        conn.close()          # only if we are NOT handing it out
        raise
```

Read the `except Exception: cleanup; raise` shape as **"I acquired it, I failed
before I could hand it over, so I still own it."** The bare `raise` is essential
— without it you have converted a failure into a `None` return.

Better still, make the transfer explicit:

```python
@contextlib.contextmanager
def cursor(dsn):
    conn = connect(dsn)
    try:
        yield conn.cursor()
    finally:
        conn.close()
```

Now the caller's `with` block bounds the lifetime, and the `finally` is correct
again because the generator only resumes past the `yield` when the caller's block
has ended. The function no longer has to guess.

## The ownership question, stated once

For any resource, exactly one of three things is true, and the code shape follows
from which:

| Who owns it after the function returns | Cleanup shape |
|---|---|
| The function (it is done with it) | `try: ... finally: release()` |
| The caller (it is being handed over) | `try: ... except Exception: release(); raise` |
| The caller, for a bounded region | `@contextmanager` with `yield` inside `try`/`finally` |

Almost every "connection closed too early" and "file handle leaked" bug is a
mismatch between the row that is true and the shape that was written.

## Idempotent cleanup

Because `finally` fires on routes you did not enumerate, cleanup can run when a
previous route already ran it — most often when someone adds an explicit
`release()` on the success path and does not notice the `finally` is still there.
Make releases idempotent when the underlying object does not guarantee it:

```python
released = False
try:
    ...
finally:
    if not released:
        handle.release()
        released = True
```

`file.close()` is already idempotent — closing a closed file does nothing.
`threading.Lock.release()` is **not**: releasing an unlocked lock raises
`RuntimeError`, from inside the `finally`, which then replaces whatever exception
was in flight — 03b's rule 2 failure mode arriving through the back door.
`with lock:` removes the question entirely, and that is the right answer.

## Restoring state rather than releasing resources

The strongest case for a hand-written `try`/`finally` is temporary state, because
there is no object to hang a context manager on:

```python
old = sys.getrecursionlimit()
sys.setrecursionlimit(10_000)
try:
    parse(deeply_nested)
finally:
    sys.setrecursionlimit(old)
```

Read the shape: capture the old value, set the new one, `try`, restore. The
capture is before the `try` so the restore is always valid; the restore cannot
raise; the restore is idempotent.

The same shape covers a swapped `sys.stdout`, a monkeypatched attribute, a
`decimal` context, an environment variable, a `ContextVar` token. And the moment
you write it twice, it wants to be:

```python
@contextlib.contextmanager
def recursion_limit(n):
    old = sys.getrecursionlimit()
    sys.setrecursionlimit(n)
    try:
        yield
    finally:
        sys.setrecursionlimit(old)
```

## Gotchas

**★ Symptom — "connection already closed" in the caller, immediately after a
factory function returned successfully.** Cause: the factory used `finally:
conn.close()`, and `finally` runs on the success route too. Fix: `except
Exception: conn.close(); raise` when transferring ownership, or make the factory
a `@contextmanager`.

**★ Symptom — `RuntimeError: release unlocked lock` raised from a `finally`,
masking the real error.** Cause: the release ran on two routes; `Lock.release()`
is not idempotent. Fix: `with lock:`. If you must hand-roll, guard with a flag.

**Symptom — a function returns `None` instead of raising when its cleanup path
runs.** Cause: an `except Exception: cleanup` with no `raise` at the end. Fix:
always re-raise after failure-route cleanup; the missing `raise` is the most
common single-character bug in this shape.

**Symptom — a temporary state change leaks after an exception, so later, unrelated
tests fail.** Cause: the restore was written after the block rather than in a
`finally`, so an exception skipped it. Fix: the capture/set/`try`/restore shape,
or a `@contextmanager`. This is why test fixtures that monkeypatch must use
teardown rather than trailing statements.

## Interview questions

**★ Q: A function opens a connection and returns a cursor from it, with
`finally: conn.close()`. What is wrong?**
`finally` runs on the success route too, so the connection is closed before the
caller uses the cursor. The function is transferring ownership, so cleanup
belongs on the failure route only — `except Exception: conn.close(); raise` — or
the function should be a `@contextmanager` so the caller's `with` bounds the
lifetime.

**★ Q: When is `except Exception: cleanup(); raise` better than `finally:
cleanup()`?**
When the function hands the resource to its caller on success. `finally` cannot
distinguish "I finished with it" from "I am giving it away"; the `except` form
says cleanup happens *only* because we failed. The trailing bare `raise` is
mandatory — without it the failure becomes a silent `None` return.

**Q: Is `close()` safe to call twice in a `finally`?**
For files, yes — closing a closed file does nothing. For `threading.Lock`, no —
releasing an unlocked lock raises `RuntimeError` from inside the `finally`, which
replaces whatever exception was in flight. Check per type, or use `with`.

**Q: How would you make a temporary global change exception-safe?**
Capture the old value before the `try`, set the new one, do the work in `try`,
restore in `finally`. The capture must be outside the `try` so the restore is
always valid, and the restore must not be able to raise. Written twice, it wants
to be a `@contextlib.contextmanager`.

---

← Prev: [Cleanup patterns](03b-finally-cleanup-patterns.md) · Index: [Exceptions](README.md) · Next → [Context managers as the cleanup tool](03d-context-managers-as-cleanup.md)
