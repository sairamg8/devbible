---
title: "The boundaries that drop a traceback for you: an un-awaited task, an unexamined future, another process, another thread"
sidebar_label: "13b · Losing it across a boundary"
sidebar_position: 136
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09 against the Python 3.14 Library Reference
> [`concurrent.futures`](https://docs.python.org/3.14/library/concurrent.futures.html),
> [`threading.excepthook`](https://docs.python.org/3.14/library/threading.html#threading.excepthook),
> [`sys.tracebacklimit`](https://docs.python.org/3.14/library/sys.html#sys.tracebacklimit),
> [`traceback`](https://docs.python.org/3.14/library/traceback.html),
> [`logging`](https://docs.python.org/3.14/library/logging.html#logging.Logger.exception),
> and [Developing with asyncio](https://docs.python.org/3.14/library/asyncio-dev.html).
> Target: **CPython 3.14**.

[The first half](13-losing-the-traceback.md) is six things your own code does to
a failure. These six are different in kind: the exception is raised correctly,
handled correctly, and still never reaches you, because it has to cross a
boundary that does not carry it. Every one of them is a place where *nothing
raises in the frame that cares*, which is why they survive code review.

## 7 — A task nobody awaits

```python
async def main():
    asyncio.create_task(bug())          # nothing awaits it
```

The asyncio docs describe exactly what happens:

> If a `Future.set_exception()` is called but the Future object is never awaited
> on, the exception would never be propagated to the user code. In this case,
> asyncio would emit a log message when the Future object is garbage collected.

So the failure appears as *Task exception was never retrieved*, at garbage
collection time, detached from the request that caused it. And the traceback you
get is the coroutine's, not the site that spawned it — the docs' remedy is to
*"enable the debug mode to get the traceback where the task was created"*.

Fix: `await` it, gather it, or run it under
[`asyncio.TaskGroup`](08b-split-subgroup-and-subclasses.md), which raises the
failures into the awaiting frame as a group.

## 8 — A future nobody resolves

`concurrent.futures` is the same shape with different spelling. The exception
lives on the future until someone asks:

> If the call raised an exception, this method will raise the same exception.

`Future.result()` and `Future.exception()` are the only two places it surfaces.
`executor.submit(...)` and never looking at the returned future discards the
failure. `Executor.map` is the safer default because iterating it re-raises.

## 9 — A process boundary

`ProcessPoolExecutor` *"uses the `multiprocessing` module … which … means that
only picklable objects can be executed and returned"*. Exceptions cross by being
pickled, and the frames they came from cannot be.

⚠️ **The documentation does not state whether the traceback object survives that
boundary**, so do not rely on it either way: format the traceback **in the
worker** and return or log the text yourself if you need the remote frames.

```python
def work(item):
    try:
        return do(item)
    except Exception as exc:
        exc.add_note("".join(traceback.format_exc()))   # travels as a string
        raise
```

## 10 — A thread

An exception out of `Thread.run()` does not reach the code that started the
thread. It goes to `threading.excepthook`, whose default *"prints out on
`sys.stderr`"* — which in a container with a log collector reading stdout is
also a way to lose it. Fix: install `threading.excepthook`, or use
`concurrent.futures` and check the futures.

## 11 — Truncation

`sys.tracebacklimit` set to `0` or less means *"all traceback information is
suppressed and only the exception type and value are printed"*, and a
`limit=1` argument to a `traceback` function does the same locally. Both are
usually somebody reducing log volume without knowing what they are deleting.

## 12 — Catching too early

The deepest function that *can* catch is almost never the one that *should*:

```python
def parse_row(row):                     # 40 call sites, no context about any of them
    try:
        return Row(**row)
    except Exception:
        log.exception("bad row")        # logged here, decided nowhere
        return None
```

The frame that knows what to do — retry, skip the record, return a 400, fail the
batch — is the caller. Log where the decision is made, once, and let the
exception travel until then. Log-and-re-raise at three levels produces three
copies of the same traceback and a false impression of three failures.

## The checklist

| Symptom in the log | Cause | Fix |
|---|---|---|
| Message, no frames | `str(exc)` | `log.exception(...)` / `exc_info=exc` |
| Nothing at all | `except: pass` | `suppress(SpecificError)` or handle it |
| Message with a trailing colon | the exception has no message | log the type too: `%r` |
| "During handling of…" and both look wrong | the handler raised | fix the handler |
| No context on a wrapped error | raised outside the handler | `from exc` |
| `NoneType` errors far from the cause | sentinel return | raise |
| "Task exception was never retrieved" | un-awaited task | `await` / `TaskGroup` |
| Silence from a worker | unexamined future | `.result()` / `Executor.map` |
| One frame | `sys.tracebacklimit` / `limit=` | remove it |
| Three identical tracebacks | log-and-re-raise | log once, at the decision |
## Gotchas

**★ Symptom — "Task exception was never retrieved" appears in the log minutes
after the request that caused it, with no request id.** Cause: a fire-and-forget
`create_task`, reported only when the task object is collected. Fix: keep a
reference and await it, or use a `TaskGroup`; enable asyncio debug mode in
development to get the creation traceback.

**★ Symptom — a `ProcessPoolExecutor` job fails and the traceback points only
into the parent process.** Cause: the frames were in another process and cannot
be pickled. Fix: capture the traceback text in the worker — `add_note` with
`format_exc()`, or return a structured failure — since the docs do not promise
the traceback object crosses.

**★ Symptom — a worker thread stops doing work and nothing is logged.** Cause:
`Thread.run()` raised, `threading.excepthook` printed it to stderr, and stderr
is not where you are looking. Fix: install a `threading.excepthook` that routes
to `logging`, and clear `args.exc_value` afterwards — the docs warn that storing
it creates a reference cycle.

**★ Symptom — three copies of one traceback in the log, at three timestamps.**
Cause: log-and-re-raise at every layer. Fix: log at the layer that decides;
lower layers add `add_note` if they have something to contribute.

**★ Symptom — the traceback is one line long in production and full locally.**
Cause: `sys.tracebacklimit` set in the deployment environment, or a logging
formatter calling `format_exception(..., limit=1)`. Fix: remove the limit;
sample whole failures if volume is the issue.

**★ Symptom — an exception is logged with a traceback that stops at the
framework's dispatch function.** Cause: the framework caught it, logged it, and
raised its own error — so what you have is the frames of the *re-raise*, not of
the failure. Fix: find the framework's hook for the original exception
(`exc_info`, an error handler, a middleware) rather than the one for its wrapper.
**★ Symptom — the exception in the log came from a cleanup path, and the
failure that started it is nowhere.** Cause: `__exit__`, a `finally`, or a
`close()` raised while the real exception was propagating; the reference counts
all three as "handling", so the original is attached as `__context__` of the new
one rather than being the exception you see first. Fix: do not raise from
cleanup — see [cleanup patterns](03b-finally-cleanup-patterns.md) — and when
reading such a log, follow `__context__` down.

```python
finally:
    with contextlib.suppress(Exception):    # cleanup must not mask the failure
        conn.close()
```

## Interview questions

**★ Q: Where in the call stack should you log an exception?**
At the frame that decides what happens — retry, skip, return a 400, fail the
batch — and only there. Logging deeper produces duplicates and no decision;
logging shallower loses the local facts, which is what `add_note` is for. One
failure, one log record, with the exception object attached.

**★ Q: A background task fails and nothing appears in the logs until much
later. Why?**
Because nothing awaited it. The asyncio docs say an exception set on a future
that is never awaited is only reported when the future is garbage collected —
the "Task exception was never retrieved" message — so it arrives detached from
its cause. `TaskGroup` or an explicit `await` moves the failure back into the
frame that started the work.

**Q: What survives a process boundary?**
Only picklable objects, per the `concurrent.futures` docs, which is why the
exception arrives and the frames are questionable. The documentation does not
state whether the traceback object survives, so the safe design captures the
traceback as text in the worker — `format_exc()` into a note or a returned
failure object.

**Q: Someone sets `sys.tracebacklimit = 0` to reduce log noise. What do you
say?**
That it suppresses all traceback information and leaves only the type and value,
per the docs — which deletes the only part of a failure that cannot be
reconstructed later. Reduce volume by sampling whole tracebacks, aggregating by
type, or lowering the log level of what is noisy, never by truncating what is
useful.
**★ Q: A middleware logs an exception and the traceback ends inside the
framework. Where is the original?**
Usually in `__context__` or `__cause__` of what was logged — the framework
caught the failure and raised or re-raised its own error, so the frames you are
looking at belong to that second exception. Log with `exc_info` and the default
`chain=True`, which prints the whole history, and if a formatter was configured
with `chain=False`, that is the bug.

**Q: What is the common shape of all six?**
Nothing raises in the frame that cares. A task, a future, a worker process, a
thread and a truncating formatter all move the failure somewhere the caller is
not looking, and the deepest-handler mistake moves the *decision* away from the
frame with the context. The fix in every case is to arrange for the exception —
the object, not a string — to arrive where the decision is made.

---

← Prev: [Losing the traceback](13-losing-the-traceback.md) · Index: [Exceptions](README.md) · Next → **EAFP vs LBYL** *(not written yet)*
