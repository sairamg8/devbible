---
title: "Python gives you four concurrency models where Node gives you one, and the workload picks between them"
sidebar_label: "3 · Python's four models"
sidebar_position: 4
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-08 against the Python 3.14
> [`asyncio`](https://docs.python.org/3.14/library/asyncio.html),
> [`threading`](https://docs.python.org/3.14/library/threading.html),
> [`multiprocessing`](https://docs.python.org/3.14/library/multiprocessing.html),
> [`concurrent.futures`](https://docs.python.org/3.14/library/concurrent.futures.html) and
> [`concurrent.interpreters`](https://docs.python.org/3.14/library/concurrent.interpreters.html)
> documentation, plus [What's New in 3.14](https://docs.python.org/3.14/whatsnew/3.14.html),
> [PEP 779](https://peps.python.org/pep-0779/) and [PEP 734](https://peps.python.org/pep-0734/).
> Target: **Python 3.14.7**.

**Node hands you an event loop and says "this is how concurrency works here". Python
hands you threads, an event loop, processes, and — as of 3.14 — free-threaded builds and
multiple interpreters in one process, then asks you to choose. That is genuinely more
power and genuinely more rope. This chunk is the menu and the one question that picks
between the four — whether the work is waiting or computing, and if it is computing,
whether it computes in Python bytecode or in C. The failure that comes from getting this
wrong is not slowness; it is a server that looks concurrent in every line of source and
serves one request at a time, which is [chunk 3b](03b-mixing-models.md).**

[Chunk 2](02-node-model.md) established Node's single loop. This chunk is the Python
half, and the framing that makes it tractable is: **`asyncio` *is* the Node model.**
Everything else is a capability Node does not have an equivalent of.

## The four models, and the one question that picks between them

```text
                    Is the work waiting, or computing?

        WAITING (network, disk, database)          COMPUTING (in Python bytecode)
                     │                                        │
      ┌──────────────┴──────────────┐            ┌────────────┴────────────┐
      │                             │            │                         │
  thousands of                 dozens of      pure Python              already in C
  concurrent waits             waits, or      (a parser, a loop)       (NumPy, hashlib,
      │                        a sync lib          │                    orjson, a driver)
      │                             │              │                         │
   asyncio                     threading      multiprocessing            threading
                                              (or free-threading,        works — the GIL
                                               3.14+)                    is released
```

That diagram is the whole decision, and it is worth being able to draw from memory. The
right-hand branch is the one that surprises people: **threads speed up threaded `sha256`
just fine**, because `hashlib` releases the GIL for inputs above a small threshold. It is
only *pure Python* CPU work that threads cannot parallelise on a default build. See
[02 · The GIL](../02-the-gil/README.md) for the mechanism in full — this chunk assumes it.

### 1. `asyncio` — the Node model, spelled out

```python
import asyncio, httpx

async def fetch_all(urls: list[str]) -> list[str]:
    async with httpx.AsyncClient() as client:
        results = await asyncio.gather(*(client.get(u) for u in urls))
    return [r.text for r in results]

asyncio.run(fetch_all(urls))
```

One thread, one loop, cooperative scheduling, `await` as the yield point. Everything true
of Node's loop is true here: a callback runs to completion, CPU work stalls every other
request, and `asyncio.gather` starts everything at once with no concurrency limit.

Two things Python adds that Node does not have, and both are real:

```python
# 1. An explicit, sized escape hatch to a thread for a blocking call.
row = await asyncio.to_thread(legacy_sync_driver.query, sql)

# 2. A structured-concurrency primitive: the group cancels its siblings on failure
#    and cannot leak a task past the block. Node has no built-in equivalent.
async with asyncio.TaskGroup() as tg:
    a = tg.create_task(fetch_user(uid))
    b = tg.create_task(fetch_orders(uid))
# both are guaranteed finished or cancelled here; errors arrive as an ExceptionGroup
```

`TaskGroup` (3.11+) is the one to name in an interview. `asyncio.gather` leaves a failed
sibling running; `TaskGroup` cancels the rest and raises an `ExceptionGroup`, which is
the behaviour you almost always wanted.

### 2. `threading` — a normal choice, not a workaround

This is the biggest single difference in *idiom* between the two languages. In Node,
threads are the escape hatch of last resort. In Python, threads are an ordinary,
recommended way to do concurrent I/O — because **the GIL is released around every
blocking call**.

```python
from concurrent.futures import ThreadPoolExecutor

with ThreadPoolExecutor(max_workers=16) as pool:
    pages = list(pool.map(requests.get, urls))   # genuinely concurrent I/O
```

That code has no `async`, no coloured functions, and no need for an async-native library.
For a few dozen concurrent operations it is simpler, faster to write, and easier to debug
than the `asyncio` version, and it works with every synchronous library ever published.
The ceiling is memory: each thread costs a real OS stack, so thousands of them is where
you switch to `asyncio`.

The default pool size, when you do not pass `max_workers`, is `min(32, os.cpu_count() + 4)`
— which is also the pool behind `asyncio.to_thread()`.

### 3. `multiprocessing` — real cores, real copies

```python
from concurrent.futures import ProcessPoolExecutor

with ProcessPoolExecutor() as pool:
    results = list(pool.map(cpu_heavy_pure_python, chunks))
```

Separate interpreters in separate processes, so no GIL is shared and every core is
usable. The costs are the ones you would expect: arguments and results are **pickled**,
process startup is expensive, and anything unpicklable (a lambda, an open socket, a
database connection) cannot cross the boundary. This is the direct analogue of Node's
`cluster` and `child_process`, with the same trade-offs.

Two 3.14 facts to have straight:

- **On Unix other than macOS, the default start method is now `forkserver`, not `fork`.**
  This was changed because `fork` in a process with threads is unsafe. macOS and Windows
  remain `spawn`.
- Both `forkserver` and `spawn` re-import your `__main__` module in the child, which is
  precisely why [`if __name__ == "__main__"`](../09-name-main/README.md) is not optional
  when you use `multiprocessing`.

### 4. Free-threading and subinterpreters — the 3.14 additions

**PEP 779 made free-threaded CPython officially supported in 3.14**, a phase-two status
that follows its experimental debut in 3.13. In a free-threaded build there is no GIL, so
threads execute Python bytecode in parallel on separate cores, sharing objects directly
in one heap — the thing Node's `worker_threads` structurally cannot do.

The honest caveats, and you should state them unprompted:

- It is a **separate build** (`python3.14t`), not a runtime flag. Your dependency set has
  to have free-threaded wheels, and C extensions must have been adapted.
- Single-threaded code pays a performance penalty on that build — What's New in 3.14
  reports it reduced to roughly 5–10%, with the specialising adaptive interpreter now
  enabled there.
- Removing the GIL removes a coarse lock that was accidentally protecting a great deal of
  code. Your data races were always there; they were merely improbable. Now they are not.

**PEP 734 added `concurrent.interpreters`**, which runs multiple isolated interpreters in
one process. Each has its own GIL, so this gives multi-core parallelism without the
process boundary — the documentation positions it as more efficient than
`multiprocessing` and more isolated than threading. It is the closest thing Python has to
Node's `worker_threads` model, arriving from the opposite direction: Node started with
isolation and is inching toward sharing; Python started with sharing and is adding
isolation.

## Gotchas

### Threads for pure-Python CPU work
**Symptom.** Four threads on four cores, and the job takes exactly as long as one thread —
or slightly longer.
**Cause.** The GIL. Only one thread executes Python bytecode at a time on a default build,
and the switching adds overhead.
**Fix.** `ProcessPoolExecutor`, a library that releases the GIL (NumPy, `hashlib`,
`orjson`, `re` on large inputs), or a free-threaded build. Slightly longer is the correct
expectation, not a measurement error.

### `multiprocessing` without the `__main__` guard
**Symptom.** On macOS or Windows — and now on Linux, since 3.14 defaults to `forkserver` —
a `RuntimeError` about the current process's bootstrapping phase, or an infinite fork bomb.
**Cause.** `spawn` and `forkserver` re-import your `__main__` module in the child, so
top-level code that starts processes runs again in every child.
**Fix.** The guard, every time:

```python
if __name__ == "__main__":
    with ProcessPoolExecutor() as pool:
        ...
```

This is covered fully in [09 · `if __name__ == "__main__"`](../09-name-main/README.md).

### Expecting `python3.14t` to be a flag
**Symptom.** `python3.14 -X gil=0` on a standard build does not remove the GIL.
**Cause.** Free-threading is a build configuration (`--disable-gil`), shipped as a
separate `t`-suffixed interpreter. The `-X gil` switch only selects between the modes a
free-threaded build already supports.
**Fix.** Install the free-threaded variant explicitly and verify at runtime:

```python
import sys, sysconfig
print(sysconfig.get_config_var("Py_GIL_DISABLED"))   # 1 on a free-threaded build
print(sys._is_gil_enabled())                         # False when it is actually off
```

### One thread's exception is invisible
**Symptom.** A background thread dies and the program carries on as if nothing happened.
**Cause.** An exception in a thread does not propagate to the main thread; it goes to
`threading.excepthook` and, by default, prints. A `ThreadPoolExecutor` future holds it
until you call `.result()` — and if you never do, you never see it.
**Fix.** Always consume futures, and prefer `TaskGroup` semantics where you can:

```python
for fut in as_completed(futures):
    fut.result()      # re-raises here, which is the whole point
```

Node's model has the opposite bias — an unhandled rejection is fatal by default — which
is louder and, for a server, arguably safer.

## Interview questions

**Q. Python has four concurrency models. Name them and say when each is right.**
A. `asyncio` for thousands of concurrent waits, when the libraries are async-native.
Threads for concurrent I/O at smaller scale or when the library is synchronous — the GIL
is released around blocking calls, so they genuinely overlap. Processes for pure-Python
CPU work. And since 3.14, free-threaded builds for CPU work with shared objects in one
process, plus `concurrent.interpreters` for isolated interpreters in one process.

**Q. Node has one concurrency model and Python has four. Is that an advantage?**
A. Both. Node's single model is nearly impossible to misconfigure and its ceiling is one
core per process. Python's menu lets you match the model to the workload — threads for a
synchronous driver, processes for CPU, asyncio for scale — but mixing two of them badly
is a class of bug Node simply cannot have. For a junior team I would call Node's
constraint a feature.

**Q. What did Python 3.14 change about this?**
A. Two things. PEP 779 made free-threaded CPython officially supported rather than
experimental, so threads can execute Python bytecode in parallel on a `python3.14t`
build. And PEP 734 added `concurrent.interpreters`, multiple isolated interpreters in one
process — multi-core parallelism without a process boundary. Also, `multiprocessing` now
defaults to `forkserver` on Unix except macOS, because forking a threaded process is
unsafe.

**Q. Do threads help a threaded `sha256` in Python?**
A. Yes. `hashlib` releases the GIL for inputs over a couple of kilobytes, so threaded
hashing scales across cores. The same is true of `zlib`, NumPy and most well-written C
extensions. The thing threads cannot parallelise is a *pure-Python* loop. Getting this
distinction right is what separates a real answer from "the GIL means no parallelism".

**Q. Why does a Python backend need `if __name__ == "__main__"` when a Node one does not?**
A. Because `multiprocessing` on `spawn` or `forkserver` re-imports the `__main__` module
in each child, so unguarded top-level code that starts processes runs again in every
child. Node's `child_process` and `cluster` re-execute a *file you name*, not the current
module's top level, so the hazard does not arise in the same form.

---

← Prev: [Node's parallelism](02b-node-parallelism.md) · Index: [Python vs Node](README.md) · Next → [Mixing two models](03b-mixing-models.md)

{/* FOOTER */}
