---
title: "Catching the sync-in-async seam in CI rather than in production — and the three asyncio traps that are not about the seam at all"
sidebar_label: "3c · Finding it, and the other traps"
sidebar_position: 6
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-08 against the Python 3.14
> [`asyncio` development guide](https://docs.python.org/3.14/library/asyncio-dev.html)
> and [`asyncio` task API](https://docs.python.org/3.14/library/asyncio-task.html), and
> the [Ruff rules index](https://docs.astral.sh/ruff/rules/) (`flake8-async`, `ASYNC`).
> Target: **Python 3.14.7**.

**A blocking call on the event loop is invisible in every ordinary signal — no exception,
no warning, no hot function in a CPU profile — which is exactly why it reaches production.
It is, however, trivially detectable by a linter that knows the sync/async seam, and by
`asyncio`'s own debug mode, which logs any callback that holds the loop too long. Turning
both on costs an afternoon and permanently removes the most expensive class of bug in a
Python backend. This chunk is that, plus the three `asyncio` hazards that have nothing to
do with blocking and still cost people days: a task the garbage collector eats, a loop
touched from the wrong thread, and a blocking call inside a library you did not write.**

This closes the arc that [chunk 3](03-python-model.md) and
[chunk 3b](03b-mixing-models.md) opened.

## Detecting it before production

```python
# 1. asyncio's own debug mode logs any callback that runs too long.
asyncio.run(main(), debug=True)          # or: PYTHONASYNCIODEBUG=1
```

```python
# 2. Lower the threshold to catch the merely-slow, not just the egregious.
loop = asyncio.get_running_loop()
loop.set_debug(True)
loop.slow_callback_duration = 0.05       # seconds; default is 0.1
```

```bash
# 3. A linter that knows the sync/async seam. flake8-async (formerly flake8-trio)
#    and ruff's ASYNC rules flag blocking calls inside async functions.
ruff check --select ASYNC .
```

The `ASYNC` rule family catches `open()`, `time.sleep()`, `subprocess.run()` and friends
inside an `async def`. Turning it on in CI is the cheapest possible insurance against this
entire class of bug, and it is the thing to say when an interviewer asks how you would
*prevent* it rather than find it.

Debug mode also does two other useful things, both of which catch real bugs on their own:
it warns about coroutines that were never awaited, and it warns when a task is destroyed
while still pending. Neither is a performance problem; both are correctness problems that
otherwise surface as "sometimes the email does not send".

The runtime tell, when it is already in production: **latency rises with concurrency while
CPU stays flat, and adding workers fixes it.** If more processes fix a latency problem
that more concurrency did not, you are serialised somewhere, and the loop is the first
place to look.

What will *not* find it, and it is worth knowing why:

| Tool | Why it misses a blocked loop |
|---|---|
| A CPU profiler (`py-spy`, `cProfile`) | It shows where CPU went. A loop blocked on a socket read is not burning CPU — it looks idle. |
| APM span timings | The span around the query looks normal; the damage is to every *other* request's queueing time, which no span covers. |
| Load tests at low concurrency | The bug only appears when requests overlap. One request at a time is exactly the case that works. |
| Unit tests | Each test awaits one thing at a time. Serialisation is invisible without concurrency. |

`py-spy dump --pid <pid>` is the exception worth naming: it prints every thread's Python
stack without stopping the process, so a loop stuck inside `psycopg2` or `requests` is
visible as a frame that has no business being on the loop thread.

## The three traps that are not about blocking

Everything above concerns the sync/async seam. These three are pure `asyncio` semantics,
and they produce bugs that are intermittent, which is worse.

## Gotchas

### A fire-and-forget task that gets garbage collected
**Symptom.** A background task silently never completes, intermittently, under load.
**Cause.** `asyncio.create_task()` returns a task the loop holds only a weak reference to.
If you do not keep a reference, it can be collected mid-flight. This is documented
behaviour, and it is a real production bug, not a theoretical one.
**Fix.** Keep the reference, or use a `TaskGroup`, which owns its tasks:

```python
_background = set()

def spawn(coro):
    t = asyncio.create_task(coro)
    _background.add(t)
    t.add_done_callback(_background.discard)
```

### Two event loops, or a loop used from the wrong thread
**Symptom.** `RuntimeError: There is no current event loop` or
`... attached to a different loop`.
**Cause.** Calling `asyncio.run()` twice, or touching a coroutine or an asyncio primitive
(a `Lock`, a `Queue`) from a thread that is not running that loop. `asyncio` objects are
**not** thread-safe.
**Fix.** One `asyncio.run()` at the top, and cross the thread boundary with the API built
for it:

```python
# From another thread, into the loop:
fut = asyncio.run_coroutine_threadsafe(coro, loop)
result = fut.result(timeout=5)

# From the loop, into a thread:
value = await asyncio.to_thread(blocking_fn, arg)
```

`loop.call_soon_threadsafe(callback)` is the lower-level version when you have no
coroutine to schedule — for instance, waking the loop from a signal handler or a
callback fired by a C library's own thread.

### A blocking call in a library you did not write
**Symptom.** The seam is not in your code at all — an SDK does a synchronous DNS lookup,
or reads a credentials file, on the first call.
**Cause.** "Async" libraries with a synchronous initialisation path, or a sync dependency
buried three levels down. The linter cannot see it, because your source is clean.
**Fix.** Warm it up outside the request path, at application startup, where blocking costs
nothing:

```python
@app.on_event("startup")
async def warm():
    await asyncio.to_thread(sdk_client.authenticate)   # pay the sync cost once, at boot
```

When it is not a one-off initialisation but every call, wrap the whole client:

```python
class AsyncWrapper:
    def __init__(self, client): self._c = client
    async def call(self, *a, **kw):
        return await asyncio.to_thread(self._c.call, *a, **kw)
```

That is `boto3` in an async service, and it is a perfectly respectable answer — the
alternative is adopting `aioboto3` and its separate maintenance story.

### `asyncio.run()` inside code that is already running a loop
**Symptom.** `RuntimeError: asyncio.run() cannot be called from a running event loop`,
typically from a library helper that tries to be usable from both worlds.
**Cause.** `asyncio.run` creates and closes a loop; there can only be one running per
thread.
**Fix.** From inside async code, await the coroutine directly. If a synchronous API must
be callable from an async context, run it on another thread:

```python
await asyncio.to_thread(sync_facade_that_calls_asyncio_run)
```

Jupyter and some test runners already have a loop running, which is why this error shows
up in notebooks so often; `nest_asyncio` is the usual hack and is worth avoiding in
production code.

### A cancelled task that swallows the cancellation
**Symptom.** A shutdown hangs, or a `TaskGroup` never exits after a sibling fails.
**Cause.** Cancellation is delivered as an exception. A bare `except Exception:` around
`await` does not catch it — `CancelledError` inherits from `BaseException` since 3.8 —
but `except BaseException:` or a `finally:` that itself awaits something long can swallow
or delay it.
**Fix.** Never catch `BaseException` around awaits, and keep cleanup in `finally` short
and non-blocking. If cleanup must await, shield exactly that:

```python
try:
    await do_work()
finally:
    await asyncio.shield(flush_metrics())   # survives the cancellation
```

## Interview questions

**Q. How would you *prevent* a blocking-call-in-async bug rather than find it?**
A. Turn on ruff's `ASYNC` rule family in CI, which flags blocking calls inside `async def`.
Run with `PYTHONASYNCIODEBUG=1` in development so the loop logs slow callbacks. And keep
the rule that a module is either sync or async, never both, so the seam is at a boundary
you chose rather than scattered through handlers.

**Q. Why does a CPU profiler not find a blocked event loop?**
A. Because a blocked loop is usually not burning CPU — it is sitting inside a synchronous
socket read, waiting. The profiler reports low CPU and no hot function, which reads as a
healthy process. `py-spy dump` is the right tool instead: it prints the live Python stack
of every thread, so you can see a driver frame on the loop thread where it does not
belong.

**Q. Why can a task disappear if you do not keep a reference to it?**
A. `asyncio.create_task` schedules the task, but the loop keeps only a weak reference, so
an unreferenced task can be garbage-collected before it finishes. Keep a strong reference
in a set and discard it in a done-callback, or use a `TaskGroup`, which owns its tasks for
the lifetime of the block.

**Q. You are told latency is high but CPU is at 15% and adding replicas fixes it. What is
your hypothesis?**
A. Something is serialising requests inside each process. In an async service, a blocking
call on the loop thread is the first candidate; in a threaded one, a global lock or a
connection pool sized at one. Adding replicas fixes it because each new process gets its
own serialised path — which is a workaround, not a fix, and it scales linearly in cost.

**Q. Are `asyncio` primitives thread-safe?**
A. No. `asyncio.Lock`, `Queue` and the rest assume single-threaded access from the loop's
own thread. To reach the loop from another thread, use
`asyncio.run_coroutine_threadsafe` or `loop.call_soon_threadsafe`. Mixing
`threading.Lock` and `asyncio.Lock` in the same code path is a good sign the design has
two concurrency models in it.

**Q. How does cancellation work, and how do people break it?**
A. Cancelling a task raises `CancelledError` at its next suspension point. Since 3.8 it
inherits from `BaseException` specifically so that `except Exception:` does not swallow
it. People break it by catching `BaseException`, or by doing long awaited work in a
`finally` block, which delays shutdown. `asyncio.shield` is the escape hatch for the one
piece of cleanup that genuinely must complete.

**Q. What does `asyncio` debug mode give you beyond slow-callback warnings?**
A. Warnings for coroutines that were never awaited and for tasks destroyed while still
pending — both correctness bugs that otherwise show up as work that intermittently does
not happen. It also enables more detailed task source-location tracking, at a cost that
makes it a development and staging setting rather than a production one.

---

← Prev: [Mixing two models](03b-mixing-models.md) · Index: [Python vs Node](README.md) · Next → [The typing story](04-typing.md)

{/* FOOTER */}
