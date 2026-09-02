---
title: "The five ways a `finally` block never executes, and why none of them are bugs in `finally`"
sidebar_label: "3g · When `finally` does not run"
sidebar_position: 118
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09 against the Python 3.14 Language Reference
> [`object.__del__`](https://docs.python.org/3.14/reference/datamodel.html#object.__del__)
> and [Generator-iterator methods](https://docs.python.org/3.14/reference/expressions.html#generator.close),
> the Library Reference
> [`sys.exit`](https://docs.python.org/3.14/library/sys.html#sys.exit),
> [`threading` — Thread objects](https://docs.python.org/3.14/library/threading.html#thread-objects),
> and the `os._exit` / `os.abort` docstrings shipped with CPython 3.14.4.
> Target: **CPython 3.14**.

**"`finally` always runs" is a statement about the Python *evaluation model*, and
it is exactly true within that model. It is not a statement about the process.
There are five ways execution can stop without unwinding the stack — and because
each of them stops the interpreter rather than raising through it, `finally` gets
no opportunity to run. Knowing them is the difference between designing cleanup
you can rely on and designing cleanup that quietly does not happen in production
containers.**

## 1 · The process dies without unwinding

`os._exit()` terminates immediately. Its docstring in CPython 3.14.4:

> *"Exit to the system with specified status, without normal exit processing."*

"Normal exit processing" is everything: `finally` blocks, `atexit` handlers,
buffered `stdout` flushes, `__del__` methods. Nothing on the Python stack runs.
That is the entire point — it exists for the child of a `fork()` that must not
re-run the parent's cleanup, and for a process that has decided its own state is
too corrupt to unwind safely.

`os.abort()` is harder still:

> *"Abort the interpreter immediately. This function 'dumps core' or otherwise
> fails in the hardest way possible on the hosting operating system. This
> function never returns."*

Contrast `sys.exit()`, which is not in this category at all — it raises
`SystemExit`, so *"cleanup actions specified by finally clauses of `try`
statements are honored"*. If you want cleanup, `sys.exit()`. If you explicitly do
not, `os._exit()`.

The same applies from outside the process: `SIGKILL` (`kill -9`), an OOM kill, a
container runtime's `docker kill`, a Kubernetes node eviction, a hardware fault.
The kernel does not consult your `finally` blocks. This is why "the `finally`
releases the lock" is not a distributed-systems answer — locks that must survive
process death need a lease with a TTL, not a cleanup handler.

`SIGTERM` is the opposite case and worth separating: Python's default handler
raises `KeyboardInterrupt` only for `SIGINT`; `SIGTERM` by default terminates
without running Python-level cleanup **unless** you install a handler that raises
or sets a flag. A container that only ever receives `SIGTERM` on shutdown runs no
`finally` at all until you wire one up.

## 2 · The interpreter crashes

A segfault in a C extension, a stack overflow that the recursion limit did not
catch, an unhandled fatal error in the runtime. The interpreter is gone; there is
no stack to unwind. Nothing to design around except keeping the blast radius of
C extensions small.

## 3 · A daemon thread at interpreter shutdown

The `threading` documentation is blunt:

> *"Daemon threads are abruptly stopped at shutdown. Their resources (such as
> open files, database transactions, etc.) may not be released properly. If you
> want your threads to stop gracefully, make them non-daemonic and use a suitable
> signalling mechanism such as an `Event`."*

A worker thread sitting inside a `try` block when the main thread finishes is
simply killed. Its `finally` does not run. This is the most common *real*
occurrence of the whole list, because `daemon=True` is what people reach for to
stop a background thread from blocking exit.

The fix the docs prescribe is structural: non-daemonic threads plus an `Event`
the worker checks, and a `join()` on the way out. `concurrent.futures`
executors and `asyncio` task groups implement that pattern for you.

## 4 · A suspended generator that is never finalized

A `yield` inside a `try` is legal, and the reference tells you what normally
happens:

> *"Yield expressions are allowed anywhere in a `try` construct. If the generator
> is not resumed before it is finalized (by reaching a zero reference count or by
> being garbage collected), the generator-iterator's `close()` method will be
> called, allowing any pending `finally` clauses to execute."*

So in the ordinary case a dropped generator *does* run its `finally`, via
`close()` throwing `GeneratorExit` in at the suspended `yield`. Two things break
that:

- **The generator is still referenced.** A generator held in a list, or captured
  by a closure, or kept alive by a reference cycle, is not finalized — its
  `finally` waits indefinitely.
- **The program ends while it is suspended.** Finalization at shutdown depends on
  the object being collected, and the datamodel is explicit that this is not
  guaranteed: *"It is not guaranteed that `__del__()` methods are called for
  objects that still exist when the interpreter exits."* The generator
  finalization path is the same class of best-effort cleanup, so a generator
  suspended in a `try` at exit may never run its `finally`. I have not found a
  documentation sentence that states the generator case as explicitly as the
  `__del__` one, so treat the details as implementation behaviour rather than a
  guarantee — the practical rule is the same either way.

The deterministic fix is to close it yourself:

```python
gen = producer()
with contextlib.closing(gen):
    for item in gen:
        if enough(item):
            break            # closing() calls gen.close() -> runs the finally
```

## 5 · The `try` block never ends

An infinite loop, a deadlocked `acquire()`, a socket read with no timeout. This
is not really an exception to the rule — the statement has not exited, so of
course its cleanup has not run — but it produces exactly the same operational
symptom: a resource held forever by code whose `finally` looks correct. Every
blocking call in a `try` whose `finally` matters should have a timeout.

## What runs during a normal interpreter shutdown, and what it can see

On a normal exit the stack *does* unwind, so `finally` blocks on the main
thread's stack run. But they run in a hostile environment. The datamodel's
warning about `__del__` describes the same conditions a late `finally` faces:

> *"`__del__()` can be executed during interpreter shutdown. As a consequence,
> the global variables it needs to access (including other modules) may already
> have been deleted or set to `None`. Python guarantees that globals whose name
> begins with a single underscore are deleted from their module before other
> globals are deleted."*

The practical consequence for cleanup code: a `finally` that calls
`logging.info(...)` or `json.dumps(...)` during shutdown may find the module
object gone and raise `AttributeError` or `NameError` — replacing whatever
exception was unwinding, per
[03b's rule 2](03b-finally-cleanup-patterns.md). Late cleanup should touch as few
module globals as possible, or bind what it needs as a default argument at
definition time.

## Designing for it

The honest summary: **`finally` is a language-level guarantee, not a durability
guarantee.** If the cost of the cleanup not happening is a leaked temp file, a
`finally` is the right tool. If the cost is a stuck distributed lock, an
un-refunded payment or a corrupted database, the cleanup must be recoverable
from outside the process — a lease with a TTL, an idempotent retry, a
reconciliation job, a database transaction that the server rolls back when the
connection drops.

## Gotchas

**★ Symptom — background worker cleanup never runs when the service shuts
down.** Cause: the worker is a daemon thread, and *"daemon threads are abruptly
stopped at shutdown"*. Fix: non-daemonic thread plus an `Event` and a `join()`,
or use `concurrent.futures` / `asyncio` task groups which implement that.

**★ Symptom — a lock or lease held by a crashed process is never released, and
the whole fleet stalls.** Cause: `finally` cannot run when the process is
`SIGKILL`ed, OOM-killed or evicted. Fix: the lock needs a TTL and renewal, not a
cleanup handler. Treat `finally` as a fast path and external expiry as the
correctness mechanism.

**★ Symptom — a `finally` inside a generator never runs when the consumer breaks
out early.** Cause: the generator stays suspended for as long as something
references it; finalization is what triggers `close()`, and it may be delayed
indefinitely or skipped at shutdown. Fix: `with contextlib.closing(gen):` or an
explicit `gen.close()` — or restructure so the resource lives in the consumer.

**Symptom — cleanup runs in development but not in the container.** Cause: the
container sends `SIGTERM`, which by default terminates the process without
raising a Python exception, so nothing unwinds. Fix: install a `SIGTERM` handler
that raises or sets a shutdown `Event`; `SIGINT`/Ctrl-C works out of the box
because Python's default handler raises `KeyboardInterrupt`.

**Symptom — a `finally` running at shutdown raises `AttributeError: 'NoneType'
object has no attribute ...`.** Cause: module globals are torn down during
shutdown, so the names the cleanup uses may already be `None`. Fix: keep late
cleanup free of module lookups — bind what it needs as a default argument, or
register with `atexit` where the ordering is defined.

**Symptom — `os._exit()` in a `fork()` child loses buffered output.** Cause:
it exits *"without normal exit processing"*, and that includes flushing stdio
buffers. Fix: `sys.stdout.flush()` explicitly before `os._exit()` — this is the
usual reason a forked child's prints vanish while the parent's appear.

**Symptom — a resource is held forever and the `finally` looks perfect.** Cause:
the `try` block never terminated — a blocking read with no timeout, or a
deadlock. Fix: every blocking call inside a `try` whose `finally` matters gets a
timeout; there is no cleanup for a statement that has not exited.

**Symptom — `sys.exit()` in an `atexit` handler or `__del__` does nothing
useful.** Cause: it raises `SystemExit`, which at that point has nowhere
meaningful to propagate. Fix: decide the exit status before shutdown starts, or
use `os._exit()` if you genuinely mean to bypass everything.

## Interview questions

**★ Q: Is it true that `finally` always runs?**
Within the language's evaluation model, yes — every route out of the `try`
statement passes through it. It is not true of the process. `os._exit()`,
`os.abort()`, a `SIGKILL`, an interpreter crash, a daemon thread being stopped at
shutdown, and a generator that is never finalized all stop execution without
unwinding, so the `finally` never gets its turn. And a `try` block that never
terminates never reaches its `finally` at all.

**★ Q: Why is `finally` not a safe place to release a distributed lock?**
Because it is a language guarantee, not a durability guarantee: a `kill -9`, an
OOM kill or a node eviction skips it entirely, and the lock stays held forever.
The correct mechanism is a lease with a TTL that the holder renews, so that
process death expires the lock without anyone having to run code.

**★ Q: What is the difference between `sys.exit()` and `os._exit()`?**
`sys.exit()` raises `SystemExit`: the stack unwinds, `finally` blocks and
`atexit` handlers run, buffers flush, and an outer handler can even intercept it.
`os._exit()` exits *"without normal exit processing"* — nothing runs. Use
`sys.exit()` unless you are in a `fork()` child that must not re-run the parent's
cleanup, and flush your streams first if you do.

**Q: A background thread has a `try`/`finally` that closes a file. The program
exits and the file is truncated. Why?**
The thread is almost certainly a daemon thread, and daemon threads are *"abruptly
stopped at shutdown"* with resources *"not released properly"*. Make it
non-daemonic and signal it with an `Event`, then `join()`.

**Q: Does a `finally` inside a generator run if the consumer stops iterating
early?**
Usually — the reference says a generator that is finalized has `close()` called,
which throws `GeneratorExit` at the suspended `yield` and lets pending `finally`
clauses execute. But that depends on finalization actually happening: a
still-referenced generator waits indefinitely, and finalization at interpreter
exit is not guaranteed. Use `contextlib.closing` or an explicit `close()` if the
cleanup matters.

**Q: Why might cleanup that works locally not work in a container?**
`SIGINT` (Ctrl-C) raises `KeyboardInterrupt`, which unwinds the stack and runs
every `finally`. `SIGTERM`, which is what an orchestrator sends, does not — the
default disposition terminates the process without a Python-level exception.
Install a `SIGTERM` handler.

**Q: Why can a `finally` fail with `AttributeError` only during shutdown?**
Because module globals are being torn down; the datamodel warns that globals a
late-running `__del__` needs *"may already have been deleted or set to `None`"*,
and a `finally` on a still-unwinding stack faces the same conditions. Keep late
cleanup independent of module lookups.

---

← Prev: [Finding `finally` jumps](03f-finding-and-fixing-finally-jumps.md) · Index: [Exceptions](README.md) · Next → [The exception hierarchy](04-the-exception-hierarchy.md)
