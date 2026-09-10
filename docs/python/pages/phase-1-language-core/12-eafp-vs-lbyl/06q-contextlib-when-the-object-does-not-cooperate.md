---
title: "contextlib turns a function into a context manager, but @contextmanager hands you both halves of the protocol and neither of its guarantees — cleanup after the yield runs only inside a finally, and an exception you catch at the yield is suppressed unless you reraise it"
sidebar_label: "06q · `contextlib` when the object won't cooperate"
sidebar_position: 152
---

<span className="db-tier t-understand">Master</span>

> Verified: 2026-09 against the Python 3.14 standard library —
> [`contextlib`](https://docs.python.org/3.14/library/contextlib.html)
> (the `@contextmanager` description and its reraise paragraph) — and the Python 3.14 Language
> Reference,
> [The `with` statement](https://docs.python.org/3.14/reference/compound_stmts.html#the-with-statement)
> (the seven steps and step 7's three paragraphs, used here for what suppression means).
> Target: **Python 3.14**. Documentation-validated; **no sandbox run**.

**[06o](06o-with-is-the-sanctioned-form.md) established that `with` is the sanctioned form and
[06p](06p-the-guarantee-and-the-nesting.md) established that its guarantee is real — but both
assume an object that implements `__enter__` and `__exit__`. `contextlib` is the standard
library's answer to *the object does not cooperate*: a resource whose acquisition is a plain
function call and whose release is another (`@contextmanager`, this page and
[06v](06v-one-yield-and-one-use.md)), a third-party client with a `close()` and no
protocol ([06x](06x-closing-a-close-method-is-enough.md)), an exception you have genuinely
decided to swallow ([06z](06z-suppress.md)), and a number of resources not known
until runtime ([06zb](06zb-exitstack-the-stack-you-build-at-runtime.md)). The load-bearing fact
here is that `@contextmanager` gives you the protocol without either of the properties a
class-based manager gets for free: cleanup written after a `yield` runs only if you put it in a
`finally`, and an exception you catch at the `yield` is suppressed unless you reraise it
yourself.**

## `@contextmanager` — the two halves of the protocol, split by one `yield`

> *"This function is a decorator that can be used to define a factory function for `with`
> statement context managers, without needing to create a class or separate `__enter__()` and
> `__exit__()` methods."*

The generator's code before the `yield` is `__enter__`; the value it yields is what step 5 of
the `with` statement binds to the `as` target; the code after the `yield` is `__exit__`. The
contract on the yield itself is exact:

> *"This iterator must yield exactly one value, which will be bound to the targets in the
> `with` statement's `as` clause, if any."*

This is the right tool when acquisition and release are two function calls on something that is
not an object you own — a Postgres advisory lock, a feature flag you flip and restore, a
`SET LOCAL` you must undo, a signal handler you install for the duration of a block.

## The `try` / `finally` is the guarantee, and it is yours to write

Here is the whole mechanism, verbatim, and it is the paragraph the rest of this page unpacks:

> *"At the point where the generator yields, the block nested in the `with` statement is
> executed. The generator is then resumed after the block is exited. If an unhandled exception
> occurs in the block, it is reraised inside the generator at the point where the yield
> occurred. Thus, you can use a `try`…`except`…`finally` statement to trap the error (if any),
> or ensure that some cleanup takes place. If an exception is trapped merely in order to log it
> or to perform some action (rather than to suppress it entirely), the generator must reraise
> that exception. Otherwise the generator context manager will indicate to the `with` statement
> that the exception has been handled, and execution will resume with the statement immediately
> following the `with` statement."*

🔴 **"Reraised inside the generator at the point where the yield occurred" means the lines after
a bare `yield` are ordinary post-`yield` code — and an exception skips them.** This manager
releases its lock on the happy path and on no other:

```python
from contextlib import contextmanager

@contextmanager
def advisory_lock(conn, key):
    conn.execute("SELECT pg_advisory_lock(%s)", (key,))
    yield conn                                             # 🔴 the block's exception
                                                           #    is raised HERE
    conn.execute("SELECT pg_advisory_unlock(%s)", (key,))  # skipped on that path
```

A class-based manager cannot have this bug: `__exit__` is a separate method that step 7 invokes
unconditionally. A generator-based one has it by default, because "after the yield" is just the
next statement. The `finally` is what restores the class's behaviour:

```python
@contextmanager
def advisory_lock(conn, key):
    conn.execute("SELECT pg_advisory_lock(%s)", (key,))
    try:
        yield conn
    finally:
        conn.execute("SELECT pg_advisory_unlock(%s)", (key,))
```

The rule that falls out: **anything a `@contextmanager` does after the `yield` that is not
inside a `finally` is a success handler, not cleanup.** That is often exactly what you want —
recording a "completed" metric belongs on the success path — but it must be a decision, and the
two belong in different clauses:

```python
@contextmanager
def timed(metrics, label):
    start = time.perf_counter()
    try:
        yield
    finally:
        metrics.timing(f"{label}.duration_ms", (time.perf_counter() - start) * 1000)
    metrics.increment(f"{label}.success")     # deliberately NOT in the finally
```

## Catching at the `yield` suppresses unless you reraise

The same paragraph closes with the obligation, and it is the one that turns a logging statement
into a swallowed error:

> *"If an exception is trapped merely in order to log it or to perform some action (rather than
> to suppress it entirely), the generator must reraise that exception. Otherwise the generator
> context manager will indicate to the `with` statement that the exception has been handled,
> and execution will resume with the statement immediately following the `with` statement."*

This is the generator's route into step 7's second paragraph — the one 06o quoted, *"if the
return value was true, the exception is suppressed"*. You never write `return True` here;
**failing to reraise is the truthy return.**

```python
@contextmanager
def advisory_lock(conn, key):
    conn.execute("SELECT pg_advisory_lock(%s)", (key,))
    try:
        yield conn
    except OperationalError:
        log.warning("statement failed under advisory lock %s", key, exc_info=True)
        raise                                  # 🔴 without this the caller sees success
    finally:
        conn.execute("SELECT pg_advisory_unlock(%s)", (key,))
```

Delete that `raise` and every `OperationalError` inside every `with advisory_lock(...)` block in
the codebase disappears, silently, from a change that only meant to add a log line. Deliberate
suppression is written the same way with the `raise` left off *on purpose* and a comment saying
why — but for a named exception class and nothing else,
[06z](06z-suppress.md)'s `suppress` says it in one line and cannot be misread as
a logging bug.

## Gotchas

**★ Symptom: a `@contextmanager` releases its resource in every test and leaks it in every
production incident.** Cause: the cleanup sits after a bare `yield`, and *"if an unhandled
exception occurs in the block, it is reraised inside the generator at the point where the yield
occurred"* — so the following lines never execute. Tests exercise the happy path; incidents are
the other one. Fix: the cleanup goes in a `finally`, always.

```python
@contextmanager
def advisory_lock(conn, key):
    conn.execute("SELECT pg_advisory_lock(%s)", (key,))
    try:
        yield conn
    finally:
        conn.execute("SELECT pg_advisory_unlock(%s)", (key,))
```

**★ Symptom: adding a log line to a context manager made every failure in every caller
disappear.** Cause: the `except` at the `yield` trapped the exception and returned normally,
which is precisely how a generator-based manager signals suppression — *"the generator must
reraise that exception"*, or the `with` statement is told *"that the exception has been
handled"*. Fix: reraise; the bare `raise` preserves the original traceback.

```python
    try:
        yield conn
    except OperationalError:
        log.warning("failed under lock %s", key, exc_info=True)
        raise
```

**★ Symptom: a `@contextmanager` that acquires two things leaks the first when the second
fails.** Cause: everything before the `yield` is `__enter__`, and 06p's guarantee only starts
once `__enter__` *"returns without an error"* — a raise in the preamble means the generator
never reaches its `yield`, so the `finally` below it is unreachable. Fix: unwind inside the
preamble, exactly as a class-based `__enter__` must.

```python
@contextmanager
def cursor_under_lock(pool, key):
    conn = pool.acquire()
    try:
        conn.execute("SELECT pg_advisory_lock(%s)", (key,))
    except Exception:
        conn.release()                 # the finally below is unreachable from here
        raise
    try:
        yield conn.cursor()
    finally:
        conn.execute("SELECT pg_advisory_unlock(%s)", (key,))
        conn.release()
```

**Symptom: the name bound by `as` is `None` and every attribute access on it fails.** Cause: the
generator wrote a bare `yield`, and the value yielded is *"bound to the targets in the `with`
statement's `as` clause"* — a bare `yield` yields `None`. This is 06p's step-5 mistake reached
through a different door; cleanup still runs correctly, only the name is wrong. Fix: yield the
object the block needs.

```python
@contextmanager
def advisory_lock(conn, key):
    conn.execute("SELECT pg_advisory_lock(%s)", (key,))
    try:
        yield conn            # not a bare `yield`
    finally:
        conn.execute("SELECT pg_advisory_unlock(%s)", (key,))
```

**Symptom: calling the factory acquired nothing, and no error was raised.** Cause: calling a
`@contextmanager`-decorated function only builds a generator; nothing before the `yield` runs
until `__enter__` advances it at step 4. A manager assigned to a variable and never entered is
inert. Fix: enter it — or register it on an `ExitStack` with `enter_context`, which is what that
method exists for ([06zb](06zb-exitstack-the-stack-you-build-at-runtime.md)).

```python
lock = advisory_lock(conn, ORDER_LOCK_KEY)   # nothing has happened yet
with lock:                                   # step 4 runs the preamble
    conn.execute(insert_sql)
```

**Symptom: cleanup runs, but a "success" side effect runs after a failure too.** Cause: the
opposite mistake — everything was put in the `finally`, including the part that is only true
when the block completed. `finally` runs on both paths by definition. Fix: split the clauses;
`else` is the one that means "the block finished without raising".

```python
@contextmanager
def timed(metrics, label):
    start = time.perf_counter()
    try:
        yield
    except Exception:
        metrics.increment(f"{label}.failure")
        raise
    else:
        metrics.increment(f"{label}.success")
    finally:
        metrics.timing(f"{label}.duration_ms", (time.perf_counter() - start) * 1000)
```

## Interview questions

**★ Why does a `@contextmanager` body need `try` / `finally` when a class-based manager does
not?**
Because a class-based manager's cleanup is a *method* that step 7 of the `with` statement
invokes unconditionally, while a generator-based manager's cleanup is *the next statement after
the `yield`*. The docs say an unhandled exception in the block *"is reraised inside the generator
at the point where the yield occurred"*, so on the failure path control resumes by raising at
the `yield` — and ordinary statements below a raise do not run. `finally` is the only construct
that survives that, which is why the docs immediately suggest *"a `try`…`except`…`finally`
statement"*. Without it you have not written a context manager; you have written a function with
a success handler.

**★ Your `@contextmanager` catches the block's exception to log it. What else must it do, and
what is the symptom if it doesn't?**
It must `raise`. The docs are explicit: *"If an exception is trapped merely in order to log it or
to perform some action (rather than to suppress it entirely), the generator must reraise that
exception."* If it does not, the generator *"will indicate to the `with` statement that the
exception has been handled"*, which routes into step 7's rule that a true return suppresses — so
callers see the `with` block complete normally. The symptom is the nastiest kind: no traceback,
no failed request, a WARNING line nobody alerts on, and downstream code running on state that
was never written. Note that you never write `return True` in the generator; **failing to reraise
is the truthy return**, which is why this bug survives review — there is no suspicious-looking
line to spot, only a missing one.

**★ A `@contextmanager` factory acquires two resources before its `yield`. What breaks?**
The `with` statement's guarantee. Everything before the `yield` is `__enter__`, and 06p's note
promises cleanup only *"if the `__enter__()` method returns without an error"* — so a raise while
acquiring the second resource means the generator never reaches its `yield`, the `finally` below
it is unreachable, and the first resource is leaked with no clause anywhere that will release
it. The repairs are the two 06p gives for classes: unwind by hand in the preamble with
`try` / `except` / `raise`, or split into one manager per resource and let multi-item nesting or
an `ExitStack` sequence them. The generator form makes this easy to get wrong precisely because
the acquisition and the `finally` *look* like they are in the same `try`.

**Can a `@contextmanager` deliberately suppress an exception, and how would a reviewer tell it
apart from the logging bug?**
Yes — catch the class you mean and return normally, which is the documented signal. A reviewer
tells the two apart by whether the intent is written down: a deliberate suppressor catches a
*narrow, named* class, has a comment saying why continuing is correct, and catches nothing else;
the bug catches something broad, logs, and falls off the end of the `except`. In practice the
deliberate case usually should not be a hand-written generator at all —
`contextlib.suppress(FileNotFoundError)` states the same thing in one line that cannot be
mistaken for an oversight ([06z](06z-suppress.md)).

**Where does the `else` clause belong in a generator-based manager?**
Around the same `yield`, and it is the clause most people forget exists here. `finally` means
"on both paths" and `except` means "it raised"; `else` is the only one that means "the block
completed". A manager that increments a success counter in its `finally` reports success for
failed blocks, and one that increments it after the whole `try` statement reports nothing on the
failure path but also nothing if an `except` clause above reraised. Writing all four clauses —
`try` / `except` / `else` / `finally` — around a single `yield` is the fully explicit form, and
the shape of the manager then says exactly which side effects belong to which outcome.

---

← Prev: [The guarantee and the nesting](06p-the-guarantee-and-the-nesting.md) · Index: [EAFP vs LBYL](README.md) · Next → [One yield and one use](06v-one-yield-and-one-use.md)
