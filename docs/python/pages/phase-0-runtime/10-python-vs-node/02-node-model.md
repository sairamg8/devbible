---
title: "Node has exactly one concurrency model, and a four-thread pool you did not know you were sharing"
sidebar_label: "2 · Node's model"
sidebar_position: 2
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-08 against the Node.js
> [Event Loop guide](https://nodejs.org/en/learn/asynchronous-work/event-loop-timers-and-nexttick),
> the [`fs`](https://nodejs.org/api/fs.html) and [`dns`](https://nodejs.org/api/dns.html)
> documentation, and the
> [libuv threadpool](https://docs.libuv.org/en/v1.x/threadpool.html) reference.
> Target: **Node.js 24 "Krypton" (Active LTS)**.

**Node's whole design is one thread running your JavaScript, with the operating system's
own event notification underneath it, and a small fixed thread pool — four threads by
default — for the handful of operations the OS will not do asynchronously. That single
constraint is why Node is so hard to get wrong for I/O and so easy to bring to its knees
with a `for` loop: there is no other thread to take the next request while yours is busy.
Understanding it is what makes the Python comparison honest, because Python's `asyncio`
is the same design and inherits the same failure mode.**

You need this chunk before [Python's four models](03-python-model.md), because the most
useful sentence in the whole comparison is: *Python's `asyncio` and Node are the same
architecture; the difference is that Python also offers three others.*

## The event loop, precisely enough

One thread runs your JavaScript. It also runs the event loop, which cycles through
phases, and in each phase drains a queue of callbacks whose I/O has completed:

```text
   ┌──────────────────────────────┐
   │           timers             │  setTimeout / setInterval callbacks
   ├──────────────────────────────┤
   │      pending callbacks       │  some system operations' deferred callbacks
   ├──────────────────────────────┤
   │        idle, prepare         │  internal
   ├──────────────────────────────┤
   │             poll             │  ← where it waits: new I/O events arrive here
   ├──────────────────────────────┤
   │            check             │  setImmediate callbacks
   ├──────────────────────────────┤
   │       close callbacks        │  'close' events on sockets and handles
   └──────────────────────────────┘
```

Between every callback, Node drains the microtask queue — resolved promises (`await`
continuations) and `queueMicrotask` — and `process.nextTick` callbacks run before even
those. The rule that matters: **a callback runs to completion.** Nothing preempts it. The
loop cannot move on, and no other request can be served, until your function returns or
hits an `await` that actually yields.

That is the entire model, and it is genuinely a good one. There is no shared mutable
state to race on, because there is one thread. There are no locks. There is no
`ConcurrentModificationException` equivalent. The cost is paid in exactly one place.

## The failure mode: blocking the loop

```js
// A single request that does this stops the entire process serving anyone.
app.get('/report', (req, res) => {
  let total = 0;
  for (let i = 0; i < 5_000_000_000; i++) total += i;   // seconds of pure CPU
  res.json({ total });
});
```

While that loop runs, every other connection sits unserved: no timers fire, no health
check is answered, and your orchestrator may well kill the container for failing its
liveness probe. The same is true of the sneakier versions:

```js
JSON.parse(hugeString);                              // synchronous, no matter how big
fs.readFileSync('/var/log/app.log');                 // synchronous by name
crypto.pbkdf2Sync(pw, salt, 600000, 32, 'sha512');   // deliberately expensive, and Sync
zlib.gunzipSync(bigBuffer);
new RegExp(userSupplied).test(input);                // backtracking = a CPU hang
```

**Fix — never do CPU work on the loop thread.** The three escapes, in the order you
should reach for them:

```js
// 1. Use the async variant if one exists. Most crypto/zlib APIs have one,
//    and it runs on the libuv threadpool, not the loop thread.
crypto.pbkdf2(pw, salt, 600000, 32, 'sha512', (err, key) => { /* ... */ });

// 2. Move genuinely CPU-bound JavaScript to a worker thread. See chunk 2b.
import { Worker } from 'node:worker_threads';
const worker = new Worker('./report.js', { workerData: { userId } });

// 3. Chunk the work and yield between chunks, if it must stay on the loop.
async function sumInChunks(n) {
  let total = 0;
  for (let i = 0; i < n; i++) {
    total += i;
    if ((i & 0xffff) === 0) await new Promise(setImmediate);  // let the loop breathe
  }
  return total;
}
```

Option 3 is the one people forget exists, and for "slightly too long" work — a few
hundred milliseconds — it is often the right answer, because it costs no serialisation.

## The four threads you are sharing without knowing

Node's asynchronous I/O is not uniformly asynchronous. **Sockets are genuinely
event-driven** at the OS level (`epoll` on Linux, `kqueue` on BSD and macOS, IOCP on
Windows). But some operations have no portable asynchronous OS interface, so libuv runs
them on a real thread pool:

> "This thread pool is internally used to run all file system operations, as well as
> `getaddrinfo` and `getnameinfo` requests."
> — [libuv, Thread pool work scheduling](https://docs.libuv.org/en/v1.x/threadpool.html)

**The pool defaults to four threads.** It is sized at startup from `UV_THREADPOOL_SIZE`,
and the documented maximum is 1024 (raised from 128 in libuv 1.30.0). Node's own `crypto`
and `zlib` async APIs also queue work onto it.

The consequences are specific and they bite in production:

```text
fs.readFile      → threadpool  (4 slots, shared process-wide)
dns.lookup       → threadpool  (4 slots, shared)   ← getaddrinfo, the default resolver
crypto.pbkdf2    → threadpool  (4 slots, shared)
zlib.gzip        → threadpool  (4 slots, shared)
net / http / tls → epoll/kqueue/IOCP, NOT the threadpool — effectively unbounded
dns.resolve*     → not the threadpool (c-ares, real async DNS)
```

So five concurrent `pbkdf2` hashes will make your *file reads* and your *DNS lookups*
wait, in a process whose CPU is mostly idle, and nothing in the stack trace will tell you
why. This is one of the genuinely non-obvious pieces of Node operational knowledge, and
it is a good interview answer.

```bash
# Raise it before the process starts — it is read once, at startup.
UV_THREADPOOL_SIZE=16 node server.js
```

## The one line that carries into the Python comparison

Python has the same *concept* — a default `ThreadPoolExecutor` sitting behind
`asyncio.to_thread()` — but it is visible in your own code, its default size is
`min(32, cpu_count + 4)`, and you can construct your own and hand it to the loop with
`loop.set_default_executor()`. Node's is a process-wide, environment-variable-configured,
four-slot resource that nothing in your source mentions. **Same idea; one of them is a
variable you can see.**

## Gotchas

### `UV_THREADPOOL_SIZE` set too late does nothing
**Symptom.** You set `process.env.UV_THREADPOOL_SIZE = '64'` in your app entry point and
file I/O throughput does not change.
**Cause.** libuv reads the variable when it initialises the pool — the first time
threadpool work is queued. If any imported module has already triggered that, your value
is ignored, silently, with no warning.
**Fix.** Set it in the environment, outside the process:

```bash
UV_THREADPOOL_SIZE=32 node server.js
```
```dockerfile
ENV UV_THREADPOOL_SIZE=32
```

### `dns.lookup` starving on four threads
**Symptom.** Under load, outbound HTTP calls to a hostname get slow, with the delay
*before* the connection is made, while CPU sits idle.
**Cause.** `dns.lookup` — which `http.request` uses by default — calls `getaddrinfo` on
the libuv pool. Four concurrent lookups is the ceiling, and any `fs` or `crypto` work
shares those slots.
**Fix.** Use the real asynchronous resolver, which does not touch the pool:

```js
import { Resolver } from 'node:dns/promises';
const resolver = new Resolver();          // c-ares, real async DNS, no threadpool
const [addr] = await resolver.resolve4('api.example.com');
```

In practice most teams reach for `cacheable-lookup` and hand it to an `http.Agent`, which
removes the lookup from the hot path entirely.

### `readFileSync` at module scope is fine; in a handler it is not
**Symptom.** Latency spikes correlated with request rate rather than with data size.
**Cause.** Module-scope synchronous I/O happens once, at startup, when nothing is being
served. The same call inside a request handler blocks the loop on every request.
**Fix.** Load configuration and templates at module scope; use `fs/promises` in handlers.

```js
import { readFileSync } from 'node:fs';
const template = readFileSync('./email.html', 'utf8');   // ✅ once, at boot

import { readFile } from 'node:fs/promises';
app.get('/doc/:id', async (req, res) => {
  res.send(await readFile(`./docs/${req.params.id}.html`, 'utf8'));  // ✅ async
});
```

### `Promise.all` is not a concurrency limit
**Symptom.** A batch job opens 5,000 sockets or 5,000 file handles and hits `EMFILE`, or
hammers an upstream API into rate-limiting you.
**Cause.** `Promise.all` starts *everything at once*. It is a join, not a pool.
**Fix.** Bound it — `p-limit`, a queue, or a manual chunk loop:

```js
import pLimit from 'p-limit';
const limit = pLimit(10);
const results = await Promise.all(ids.map((id) => limit(() => fetchOne(id))));
```

Python's `asyncio.gather` has exactly the same trap with exactly the same fix
(`asyncio.Semaphore`). Worth knowing that this is a property of the *model*, not of
either language.

### An `await` on something that is not actually async yields nothing
**Symptom.** Code is full of `async`/`await` and the loop still stalls.
**Cause.** `await` only yields when the awaited thing is a pending promise. `await
someSyncFunction()` runs the function to completion first, then schedules a microtask —
the CPU cost was still paid on the loop thread.
**Fix.** `async` is not a performance annotation. Find the synchronous CPU work and move
it (chunk 2b) or chunk it. The identical mistake in Python is `async def` around a
`requests.get()` call.

## Interview questions

**Q. What is the Node event loop, in one paragraph?**
A. A single thread that repeatedly polls the operating system for completed I/O and runs
the callbacks for whatever finished, in phases — timers, poll, check, close — draining
promise microtasks between every callback. Your JavaScript never runs in parallel with
itself, so there is no shared-state concurrency to get wrong, and a callback that does
not return blocks everything.

**Q. Node is "non-blocking I/O" — is all of its I/O actually non-blocking?**
A. No. Sockets are, via `epoll`/`kqueue`/IOCP. But filesystem operations, `getaddrinfo`
DNS lookups, and the async `crypto` and `zlib` APIs run on libuv's thread pool, which
defaults to four threads and is shared process-wide. So "async" `fs` calls are really
"handed to one of four threads", and they queue when all four are busy.

**Q. What is `UV_THREADPOOL_SIZE`, and when would you change it?**
A. The environment variable that sizes libuv's pool at process start; default 4,
documented maximum 1024. You raise it for workloads doing a lot of concurrent filesystem
work or `getaddrinfo`. It must be set in the environment before the process starts —
setting `process.env` from inside the app usually runs too late to have any effect.

**Q. A Node service's p99 latency spikes but CPU is at 20%. Where do you look?**
A. Threadpool starvation first — concurrent `fs`, `dns.lookup`, `crypto` or `zlib` work
queueing behind four slots. Then event-loop blocking from a synchronous call or a large
`JSON.parse`. Both look like "slow with idle CPU", and neither shows up as a hot function
in a CPU profile.

**Q. How is this different from Python's `asyncio`?**
A. Architecturally it is not — one thread, one loop, cooperative scheduling, and the same
"a blocking call stalls everything" failure. The differences are that Python makes the
escape hatch explicit (`asyncio.to_thread`, a `ProcessPoolExecutor`), threads are a
normal alternative in Python rather than a discouraged one, and Python's equivalent
hidden thread pool is a `ThreadPoolExecutor` you can see, size and replace.

**Q. Why does `setImmediate` help a long computation when `setTimeout(fn, 0)` is roughly
the same idea?**
A. Both return control to the loop, which is the point — the loop gets to drain pending
I/O callbacks between your chunks. `setImmediate` fires in the check phase of the current
iteration rather than being subject to timer clamping, so it is the conventional choice
for "yield now and continue". Either way, the work is still on one thread; you have
traded throughput for responsiveness, which is usually the right trade for a server.

---

← Prev: [The real question](01-the-real-question.md) · Index: [Python vs Node](README.md) · Next → [Node's parallelism escape hatches](02b-node-parallelism.md)

{/* FOOTER */}
