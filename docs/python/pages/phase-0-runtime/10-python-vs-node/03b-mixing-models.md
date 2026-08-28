---
title: "The most expensive Python backend bug is a synchronous call inside an async def — a server that reads as concurrent and serves one request at a time"
sidebar_label: "3b · Mixing two models"
sidebar_position: 5
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-08 against the Python 3.14
> [`asyncio` developing guide](https://docs.python.org/3.14/library/asyncio-dev.html),
> [`asyncio` task API](https://docs.python.org/3.14/library/asyncio-task.html) and
> [`concurrent.futures`](https://docs.python.org/3.14/library/concurrent.futures.html)
> documentation, and the
> [FastAPI concurrency guide](https://fastapi.tiangolo.com/async/).
> Target: **Python 3.14.7**.

**Having four concurrency models is only a problem when you use two of them in one call
stack without noticing. The canonical form is a synchronous database driver called from
an `async def` handler: the coroutine never yields, the single event-loop thread is held
for the whole query, and requests queue up behind each other while CPU sits near zero and
every metric in your dashboard says the service is idle. It is the Python equivalent of
Node's `readFileSync` in a handler, except far easier to do by accident, because the
synchronous library is the one that comes up first in every search result.**

This is the second half of [chunk 3](03-python-model.md), which laid out the four models.
Here is what happens when two of them meet.

## The bug, in six lines

```python
# ❌ Every line says async. The server is sequential.
@app.get("/user/{uid}")
async def get_user(uid: int):
    row = psycopg_sync_conn.execute("SELECT ...", (uid,)).fetchone()   # BLOCKS THE LOOP
    return row
```

Under load, request 2 waits for request 1's database round trip, request 3 waits for
both, and throughput is one request at a time. Nothing errors. Nothing warns. The
`async` and the `await` keywords are all present and all useless, because `await` only
yields when what it awaits is actually pending — and there is no `await` on that line at
all.

The same shape, in the forms it actually ships in:

```python
async def handler():
    r = requests.get(url)                    # ❌ sync HTTP client
    time.sleep(0.2)                          # ❌ sync sleep
    data = open("big.json").read()           # ❌ sync file read
    img = PIL.Image.open(f).resize((64, 64)) # ❌ CPU work, no I/O at all
    hash = bcrypt.hashpw(pw, salt)           # ❌ deliberately expensive CPU work
```

The last two are worth separating out: they are not blocking *I/O*, they are blocking
*CPU*. No async driver exists to fix them, because the problem is not the library. They
have to move off the loop thread entirely.

## The three fixes, and when each is right

```python
# ✅ Option A — an async-native driver. Best when the ecosystem has one.
row = await async_conn.fetchrow("SELECT ...", uid)
```

Right when a mature async driver exists — `asyncpg`, `psycopg` 3 in async mode,
`httpx.AsyncClient`, `aioboto3`, SQLAlchemy 2.x's async engine. This is the answer for
new code in an async service.

```python
# ✅ Option B — keep the sync library, get it off the loop thread.
row = await asyncio.to_thread(sync_conn.execute, "SELECT ...", (uid,))
```

Right when the library you need has no async version and never will — a vendor SDK, a
legacy internal client, `boto3`. `to_thread` hands the call to the loop's default
`ThreadPoolExecutor` (`min(32, os.cpu_count() + 4)` workers) and awaits the result
properly. For **CPU-bound** work, use a process pool instead, because a thread will not
help pure-Python computation:

```python
loop = asyncio.get_running_loop()
with ProcessPoolExecutor() as pool:
    thumb = await loop.run_in_executor(pool, resize_image, blob)
```

```python
# ✅ Option C — do not use asyncio at all.
@app.get("/user/{uid}")
def get_user(uid: int):          # note: def, not async def
    return sync_conn.execute("SELECT ...", (uid,)).fetchone()
```

**Option C is the one people talk themselves out of, and it is frequently the right
answer.** FastAPI, Starlette and Litestar all run a plain `def` endpoint in a threadpool,
so a fully synchronous handler is still concurrent and still correct. Choosing `async def`
and then calling blocking code inside it is strictly worse than never having written
`async` at all — you get the sequential behaviour *and* the complexity.

The decision rule is short: **if your handler's libraries are synchronous, write `def`.
If they are async, write `async def`. Never write `async def` around a synchronous
call.**

## The one Node does not have: function colour

Python's `async` split is the same "coloured functions" problem JavaScript has — an
`async` function can only be awaited from another `async` function — but Python feels it
more sharply for one reason: **the synchronous half of Python's ecosystem is enormous and
mature**, so there are two parallel worlds of libraries, and a decade of excellent
synchronous code that predates `asyncio`. JavaScript went async-by-default early enough
that the split never fully formed.

The practical consequence is that Python teams end up maintaining both — a sync
`requests` path in the batch jobs and an async `httpx` path in the API — and the bug in
this chunk is what happens at the seam. Node teams simply do not have a synchronous
`fetch` to reach for.

## Gotchas

### `async def` around a blocking call
**Symptom.** Throughput of roughly one request at a time, flat CPU, and no error anywhere.
**Cause.** A synchronous library — `requests`, `psycopg2`, `time.sleep`, a file read —
called from a coroutine. `await` never yields because nothing awaitable is involved.
**Fix.** An async-native library, `asyncio.to_thread`, or a plain `def` handler:

```python
await asyncio.sleep(1)                       # ✅ yields
await asyncio.to_thread(time.sleep, 1)       # ✅ yields, blocking happens on a thread
time.sleep(1)                                # ❌ stalls the whole loop
```

### `asyncio.gather` with no limit
**Symptom.** 5,000 concurrent connections, an exhausted connection pool, or a 429 from
the upstream API.
**Cause.** Same as Node's `Promise.all`: `gather` is a join, not a pool.
**Fix.** A semaphore, and prefer `TaskGroup` so a failure cancels the siblings:

```python
sem = asyncio.Semaphore(10)

async def one(u):
    async with sem:
        return await client.get(u)

async with asyncio.TaskGroup() as tg:
    tasks = [tg.create_task(one(u)) for u in urls]
```

### `asyncio.to_thread` for CPU-bound work
**Symptom.** You dutifully moved the image resize to `to_thread` and the loop still
stalls, or the resize gets slower under load.
**Cause.** `to_thread` moves the call to another *thread*, and on a default build the GIL
still serialises pure-Python bytecode. If the work is not in a C library that releases
the GIL, you have moved the stall, not removed it.
**Fix.** A process pool for pure-Python CPU work:

```python
loop = asyncio.get_running_loop()
with ProcessPoolExecutor() as pool:
    result = await loop.run_in_executor(pool, cpu_heavy, payload)
```

If the work *is* in a GIL-releasing C library — Pillow-SIMD, NumPy, `hashlib` — then
`to_thread` is correct and a process pool would only add pickling cost.

## Interview questions

**Q. What is the most common performance bug in an async Python service?**
A. A blocking call inside a coroutine — a synchronous driver, `requests`, `time.sleep`, a
file read. It serialises the whole server while every line still reads as concurrent. The
tells are flat CPU with rising latency and throughput that does not improve with
concurrency. Fix with an async driver, `asyncio.to_thread`, or a plain `def` handler in a
framework that thread-pools those.

**Q. `asyncio.gather` versus `asyncio.TaskGroup`?**
A. `gather` waits for everything and, on a failure, leaves the other tasks running unless
you pass `return_exceptions`. `TaskGroup` is structured concurrency: no task outlives the
block, a failure cancels the siblings, and errors surface as an `ExceptionGroup`. Use
`TaskGroup` by default. Node has no built-in equivalent — `Promise.allSettled` waits, but
nothing cancels the siblings.

**Q. When is `async def` the wrong choice for an endpoint?**
A. Whenever the work inside it is synchronous. FastAPI and Starlette run a plain `def`
endpoint in a threadpool, so a sync handler is concurrent and correct. `async def` around
blocking code is the worst of both: sequential execution plus async complexity.

**Q. `asyncio.to_thread` versus `run_in_executor` with a process pool — how do you
choose?**
A. By what the work is. Blocking I/O, or CPU work inside a C library that releases the
GIL: a thread, so `to_thread`. Pure-Python CPU work: a process pool via
`run_in_executor`, because a thread cannot escape the GIL on a default build. The cost of
the process pool is pickling the arguments and the result, so it only pays when the
computation is substantially larger than the copy.

**Q. Is Python's "coloured functions" problem worse than JavaScript's?**
A. In practice yes, for an ecosystem reason rather than a language one. Python has a huge,
mature *synchronous* library ecosystem that predates `asyncio`, so most problems have both
a sync and an async solution and teams end up maintaining both. JavaScript standardised on
callbacks and then promises early enough that there is no synchronous `fetch` to reach
for by mistake.


---

← Prev: [Python's four models](03-python-model.md) · Index: [Python vs Node](README.md) · Next → [Finding it, and the other asyncio traps](03c-finding-it.md)

{/* FOOTER */}
