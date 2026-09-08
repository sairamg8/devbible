---
title: "A finally clause has no width knob and no condition, so the only variable left is what you put in it — three questions decide, and cleanup that fails one of them is an object's lifetime pretending to be a statement's"
sidebar_label: "06n · What belongs in a `finally`"
sidebar_position: 149
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09 against the Python 3.14 Language Reference —
> [The `try` statement](https://docs.python.org/3.14/reference/compound_stmts.html#the-try-statement)
> (the saved-exception rule and the context rule) and
> [The `raise` statement](https://docs.python.org/3.14/reference/simple_stmts.html#the-raise-statement)
> (implicit chaining), plus
> [`sys.exception`](https://docs.python.org/3.14/library/sys.html#sys.exception) and
> [`sys.exc_info`](https://docs.python.org/3.14/library/sys.html#sys.exc_info) for the one
> question this page leaves open. Target: **Python 3.14**. Documentation-validated;
> **no sandbox run**.

**[06h](06h-finally-and-the-widest-handler.md) established the mechanics: `finally` runs
over `try`, `except` and `else` alike, carries none of `else`'s three conditions, and no
ordinary exit skips it. Every other exposure in this chapter has a lever — a wide `except`
can be split by class, a wide `try` can be shrunk by hoisting the leap. `finally` has none,
so the only variable left is its contents. Three questions decide whether a line may go in
one, and each of them corresponds to a real production failure: an unbound name, a cleanup
that raises, and a jump that discards. Anything that fails one of them is not a `finally`
that needs fixing — it is an object with a lifetime, and it belongs to a `with`
([06o](06o-with-is-the-sanctioned-form.md)).**

## What "temporarily saved" costs an outer handler

The saved-exception rule has a consequence that only shows up in nested code. The exception
is saved, `finally` runs, and it is *"re-raised at the end of the `finally` clause"* — so an
enclosing `except` does not see the exception until the inner cleanup has finished running.

```python
try:
    rows = fetch_with_retries(query)   # inner frame has its own try/finally
except TimeoutError:
    return cached(query)               # reached only after the inner finally completes
```

Two things follow, and both get diagnosed as mysteries. A slow cleanup — a socket close that
waits out a linger timeout, a lock the cleanup has to acquire, a flush to a disk that has
stopped answering — delays the outer recovery by exactly that long, even though the outer
handler has nothing to do with the resource it is waiting on. The fallback looks slow; the
fallback is not slow.

And if the inner `finally` raises, the outer handler is offered the *cleanup's* exception
instead, with the original demoted: the reference says the saved exception *"is set as the
context of the new exception"*. An `except TimeoutError` above a `finally` that raises
`OSError` catches nothing at all, and the timeout that actually happened is reachable only
through `__context__`. That failure mode is
[06i](06i-when-cleanup-raises-and-the-grammar-refuses.md)'s whole subject; here it is one of
the three reasons the rule exists.

## The three questions

Every line you are about to put in a `finally` has to answer yes to all three.

**1 · Is every name it touches bound before the `try` begins?** If the cleanup uses a name
that the `try` suite binds, there is a path — the one where the binding statement raised — on
which that name does not exist, and `finally` runs on it anyway.

**2 · Can it raise?** If it can, it will do so on the error path, where its exception
displaces the one that mattered and the original survives only as `__context__`.

**3 · Does it jump?** A `return`, `break` or `continue` in a `finally` discards the saved
exception outright, and 3.14 emits a `SyntaxWarning` for it —
[06k](06k-the-jump-that-discards.md).

What passes all three is a small, specific set: ending a span, decrementing a gauge,
restoring a module-level setting you changed, releasing something you already hold. The shape
that makes them safe is always the same — **acquire before the `try`**, so the cleanup cannot
name anything that might be missing:

```python
span = tracer.start_span("query")     # bound before the try; cleanup cannot be unbound
previous = sys.getrecursionlimit()
sys.setrecursionlimit(previous * 2)   # changed before the try, not inside it
try:
    return conn.execute(query)
finally:
    sys.setrecursionlimit(previous)   # restores a value captured before the try
    span.end()                        # ends a span that certainly exists
```

Read that against the three questions. Every name in the `finally` — `previous`, `span` — was
bound by a statement that ran before the `try`, so question 1 is answered by the layout
rather than by hope. Neither call is documented to raise for these arguments, so question 2
holds. Neither jumps, so question 3 holds. Nothing about it depends on which path the `try`
took, which is exactly the property `finally` demands and cannot enforce.

## The rule stated as its contrapositive

The useful form is the negative one, because it is the one you apply in review. **If the
cleanup needs a name the `try` suite created, it is not cleanup for this statement — it is
cleanup for an object.** Statements do not have lifetimes; objects do. A `with` cannot run
cleanup for something that was never constructed, because there is no `__exit__` to call
until `__enter__` has returned, and that single property removes question 1 entirely:

```python
# not this: the statement promises cleanup for a name the statement may not have
conn = None
try:
    conn = pool.acquire()
    return conn.execute(query)
finally:
    if conn is not None:              # the `if` is the tell — you are simulating a lifetime
        conn.release()

# this: the object owns its own cleanup, and the acquisition either happened or did not
with pool.acquire() as conn:
    return conn.execute(query)
```

The `if conn is not None:` guard in the first version is the diagnostic. Whenever a `finally`
needs to ask whether the thing it is cleaning up exists, the answer is that you have written
an object's lifetime out longhand and got the hard part — the failure of the acquisition
itself — wrong by default. [06o](06o-with-is-the-sanctioned-form.md) is what that becomes.

## Gotchas

**★ Symptom: the semaphore's permit count drifts upward until the limiter stops limiting.**
Cause: acquisition inside the `try`, release in the `finally`. When `acquire(timeout=...)`
returned false or raised, the release ran anyway and returned a permit that was never taken.
`finally` cannot tell those paths apart. Fix: acquire before the `try`, so that reaching the
statement at all proves the permit is held.

```python
sem.acquire(timeout=5)            # raises or blocks here; the try is not entered
try:
    return handler(request)
finally:
    sem.release()                 # unreachable unless the acquire succeeded
```

**★ Symptom: a setting is restored to a value it never had, and only on the error path.**
Cause: the `finally` restores state the `try` suite was supposed to have changed, but the
suite raised before it got there — `finally` is unconditional, so the restore ran anyway.
This is the unbound-name failure wearing a mutation instead of a `NameError`. Fix: capture
and change *before* the `try`, so the restore always has something true to restore.

```python
previous = decimal.getcontext().prec
decimal.getcontext().prec = 40    # changed before the try
try:
    return compute(values)
finally:
    decimal.getcontext().prec = previous
```

**Symptom: a `finally` was added to "make sure the file closes" and the function started
raising `NameError` on the error path.** Cause: `finally` is attached to the statement, and
the statement runs its cleanup whether or not the acquisition happened. Fix: if the cleanup
belongs to an object, it belongs in a `with`; keep `finally` for cleanup that is nobody's
`__exit__`.

```python
span = tracer.start_span("query")   # not an object with cleanup semantics of its own
try:
    return conn.execute(query)
finally:
    span.end()                      # safe: `span` is bound before the try
```

**Symptom: the outer handler catches something the inner code does not raise, and the real
failure is buried in `__context__`.** Cause: the inner `finally` raised while the original
exception was temporarily saved, and the reference says the saved exception *"is set as the
context of the new exception"* — so the caller is offered the cleanup's failure. Fix: make
the cleanup unable to raise, by handling its failure where it happens rather than letting it
travel.

```python
try:
    return conn.execute(query)
finally:
    try:
        conn.close()
    except OSError:
        log.warning("close failed", exc_info=True)   # does not displace the real error
```

**Symptom: a `finally` contains `if resource is not None:` and nobody can say which path
leaves it `None`.** Cause: the acquisition is inside the `try`, so the cleanup has to
simulate a lifetime the statement does not have. Fix: give the lifetime to an object and
delete the guard — the acquisition either returned a manager or raised, and there is no third
state to test for.

```python
with pool.acquire() as conn:      # no None case exists to check
    return conn.execute(query)
```

**Symptom: the fallback path is slow in production and fast in every test.** Cause: the
enclosing `except` cannot run until the inner `finally` has finished, because the exception
is *"temporarily saved"* and re-raised at the end of the cleanup. A close that waits out a
linger timeout against a dead peer therefore shows up as latency in the recovery, not in the
call that failed — and tests use a live loopback peer that closes instantly. Fix: bound the
cleanup, rather than the handler, when the cleanup is what can block.

```python
try:
    return sock.recv(4096)
finally:
    sock.settimeout(0.5)          # bound the close, not the caller's recovery
    sock.close()
```

## Interview questions

**★ Why is "only cleanup that cannot fail belongs in a `finally`" a rule rather than advice?**
Because the clause has no width knob and no condition. Every other exposure in this chapter
can be narrowed — a wide `except` can be split by class, a wide `try` can be shrunk by
hoisting the leap or moving the consumer into `else`. `finally` has neither lever: it runs
over `try`, `except` and `else` alike, on the exception path and on every early exit, and
there is no syntax that restricts it to a subset of those. So the only variable left is what
you put in it. That makes the constraint a property of the language rather than a style
preference, and it is why the correct fix for "my cleanup can fail" is never a better
`finally` — it is a context manager, whose cleanup is bound to an object that either exists
or does not.

**★ A reviewer sees `if conn is not None:` inside a `finally`. What should that tell them?**
That the acquisition is inside the `try` and the cleanup is simulating a lifetime. The guard
exists because there is a path — the one where `pool.acquire()` raised — on which the name is
either unbound or still `None`, and `finally` runs on that path like every other. The
simulation is also usually incomplete: the interesting failure is a partial acquisition, where
the object exists but is not usable, and a `None` check does not detect that at all. The
repair is not a better guard; it is to give the resource to a `with`, so that the only two
states are "acquired, and `__exit__` will run" and "the acquisition raised, and there is
nothing to clean up".

**You must close a socket, and the close itself can block for seconds. Where does that go?**
Not in a bare `finally`, because of question 2 — a close that can block is a close that can
raise, and on the error path its failure would displace the exception that matters while its
latency is charged to the enclosing handler's recovery rather than to the call that failed.
Two honest shapes. Either bound the operation before closing so its cost is capped, and wrap
the close in its own `try` / `except` that logs rather than propagates; or hand the socket to
a context manager whose `__exit__` does both, so every caller inherits the same bounded
behaviour instead of re-deriving it. What you do not do is leave the naked `sock.close()` in
the `finally` and treat the resulting mystery latency as a networking problem.

**★ Does a `finally` clause know which exception it is about to re-raise?**
The documentation does not settle this, and I would not assert it either way. The saved
exception is not bound to a name — there is no `finally … as exc` — and the two functions
that would tell you are documented in terms of handlers, not cleanup: `sys.exception()`
*"when called while an exception handler is executing (such as an `except` or `except*`
clause), returns the exception instance that was caught by this handler"*, and `exc_info()`
is defined in terms of the same "currently handled" exception. Neither entry mentions
`finally`. There is adjacent evidence pointing the other way — the `raise` statement's
description of implicit chaining says an exception *"may be handled when an `except` or
`finally` clause, or a `with` statement, is used"* — but that sentence is about what sets
`__context__`, not about what `sys.exception()` returns, so it does not settle the question
either. The design conclusion does not depend on resolving it: if the cleanup needs to know
what failed, that is an `except` clause, not a `finally` clause, and writing it as one also
gives you a name to log and a class to re-raise.

**Two functions both release a connection in a `finally`. One is correct and one is not.
What is the difference you look for first?**
Where the acquisition is. If `pool.acquire()` runs before the `try`, reaching the statement
proves the connection is held, and the release in `finally` is correct on every path by
construction. If it runs inside the `try`, the release is correct on some paths and wrong on
at least one, and no amount of reading the handlers will tell you which without tracing every
way the acquisition can fail. That single structural fact — acquisition inside or outside the
statement — decides it more reliably than reading the cleanup itself, which is why it is the
first thing to look at rather than the last.

---

← Prev: [Where `finally` sits](06h-finally-and-the-widest-handler.md) · Index: [EAFP vs LBYL](README.md) · Next → [`with` is the sanctioned form](06o-with-is-the-sanctioned-form.md)
