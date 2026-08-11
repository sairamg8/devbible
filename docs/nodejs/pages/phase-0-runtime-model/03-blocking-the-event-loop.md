---
title: "Blocking the event loop"
sidebar_label: "03 · Blocking the loop"
sidebar_position: 3
---

<span className="db-tier t-master">Master</span>

**One slow function does not slow down one request. It slows down every request.**

This is the failure mode that makes people say "Node doesn't scale". It is
almost always a single blocking line.

## Why it matters

There is one thread running your JavaScript. While it is inside your function, it
cannot accept a connection, cannot fire a timer, cannot resolve a promise, cannot
answer a health check. Everything queues up behind you.

The users who suffer are not the ones who called the slow endpoint. They are
everyone else.

## See it happen

```js
// blocked-server.js
const http = require('node:http');

function blockFor(ms) {
  const end = Date.now() + ms;
  while (Date.now() < end) {}      // busy loop — owns the thread
}

http.createServer((req, res) => {
  if (req.url === '/slow') {
    blockFor(3000);
    res.end('slow done\n');
  } else {
    res.end('pong\n');
  }
}).listen(3010, () => console.log('listening on 3010'));
```

Measure `/ping` on its own, then measure it again while `/slow` is running:

```console
$ curl -s -o /dev/null -w '%{time_total}s\n' http://localhost:3010/ping
0.009947s

$ curl -s http://localhost:3010/slow &        # start the slow one
$ curl -s -o /dev/null -w '%{time_total}s\n' http://localhost:3010/ping
2.702326s
```

`/ping` does no work at all and still took 2.7 seconds. It was not slow — it was
**not running**. It sat in the OS accept queue until the thread came free.

Now change `blockFor(3000)` to `await sleep(3000)` from `node:timers/promises`.
`/slow` still takes 3 seconds. `/ping` goes back to 10ms. Same wall-clock delay,
completely different blast radius.

## The usual suspects

Anything that runs long *on the thread*:

| Culprit | Better move |
|---|---|
| `fs.readFileSync`, `fs.writeFileSync` in a request handler | `node:fs/promises` |
| `JSON.parse` / `JSON.stringify` on multi-megabyte payloads | Cap the body size; stream it; move it off-thread |
| `crypto.pbkdf2Sync`, `bcrypt.hashSync`, `scryptSync` | The async version — it uses the thread pool |
| `zlib.gzipSync` | `zlib.gzip` |
| A regex with catastrophic backtracking on user input | Rewrite the pattern; bound the input length |
| Looping or sorting over 100k+ rows in memory | Do it in the database, or chunk it |
| `child_process.execSync` | `execFile` with a callback or promise |

The tell is the suffix: **`Sync` in a request path is nearly always a bug.**
`Sync` is fine at startup — reading a config file before the server listens
blocks nothing, because nothing else is running yet.

## Measure it, don't guess

Node ships a histogram of exactly how late the loop is running:

```js
// lag.js
const { monitorEventLoopDelay } = require('node:perf_hooks');

const h = monitorEventLoopDelay({ resolution: 20 });
h.enable();

function blockFor(ms) {
  const end = Date.now() + ms;
  while (Date.now() < end) {}
}

setTimeout(() => blockFor(500), 200);

setTimeout(() => {
  h.disable();
  console.log('mean ', (h.mean / 1e6).toFixed(1), 'ms');
  console.log('max  ', (h.max / 1e6).toFixed(1), 'ms');
  console.log('p99  ', (h.percentile(99) / 1e6).toFixed(1), 'ms');
}, 1000);
```

```console
$ node lag.js
mean  41.0 ms
max   518.5 ms
p99   518.5 ms
```

The 500ms block shows up as a 518ms maximum. Values are in **nanoseconds** —
divide by `1e6` for milliseconds.

Rules of thumb for a healthy web process: mean delay under a few milliseconds,
p99 under ~50ms. Export those numbers as a metric and alert on them; they warn
you before latency graphs do. Full treatment in Phase 10.

## The four fixes

**1. Use the async version.** Most blocking calls have one. This is the fix 90%
of the time.

**2. Chunk the work.** If you must do it in-process, hand the loop back
periodically so other callbacks can run:

```js
// chunked.js — process 1,000,000 items without freezing the server
async function processAll(items, handle) {
  const CHUNK = 1000;
  for (let i = 0; i < items.length; i += CHUNK) {
    for (const item of items.slice(i, i + CHUNK)) handle(item);
    await new Promise((resolve) => setImmediate(resolve));   // yield
  }
}
```

Total work is slightly slower; the process stays responsive throughout. That is
the trade.

**3. Move it to a worker thread.** Real CPU work — image resizing, PDF
generation, big crypto — belongs on `worker_threads`, off the main thread
entirely. Phase 5.

**4. Move it out of the request.** Queue it and answer immediately. The user gets
a `202 Accepted` and a job id instead of a 30-second wait. Phase 7.

## Gotchas

**Symptom:** Health checks fail and the orchestrator restarts a container that is
otherwise fine
**Cause:** The health endpoint could not be served during a long block, so the
probe timed out.
**Fix:** Fix the block. Raising the probe timeout hides a real outage — during
that window every user was affected too.

**Symptom:** Latency is fine in development, terrible in production
**Cause:** Development has one user. Blocking costs nothing until requests
overlap; with 50 concurrent users a 200ms block becomes 10 seconds of queue.
**Fix:** Load-test with concurrency, and watch event-loop delay rather than
average response time.

**Symptom:** `p50` latency looks great, `p99` is catastrophic
**Cause:** Classic blocking signature — most requests sail through, the ones
unlucky enough to land behind the block wait for all of it.
**Fix:** Correlate the p99 spikes with event-loop delay. If they line up, you
have found it.

**Symptom:** Someone "fixed" the block by wrapping it in an `async` function and
nothing improved
**Cause:** `async` does not move code off the thread. A function is only
non-blocking if it actually awaits something that yields — a promise backed by
I/O, a timer, or a worker.
**Fix:** `await sleep(0)` or `setImmediate` between chunks, or move the work to a
worker. Marking a busy loop `async` changes nothing.

**Symptom:** A route is slow only for certain user input
**Cause:** Frequently a regex backtracking blow-up (ReDoS) — a pattern that is
instant on normal strings and exponential on a crafted one.
**Fix:** Simplify the pattern, anchor it, and limit input length. This is a
security issue as much as a performance one; see Phase 8.

## Interview questions

**★ Why does a 3-second `for` loop stall every incoming request, but a 3-second
database query does not?**
The loop executes on the single JS thread, so for those 3 seconds no other
callback can run — connections queue in the kernel. The query is handed to the
driver's socket and the thread returns to the event loop immediately, free to
serve everyone else. What matters is whether the thread is *occupied*, not how
long the operation takes.

**★ How do you detect a blocked event loop in production?**
`monitorEventLoopDelay` from `node:perf_hooks`, exported as a metric and
alerted on. Symptomatically: p99 latency spikes with a healthy p50, failing
health checks, and slowness that hits unrelated endpoints at the same instant.

**★ Where is `readFileSync` acceptable?**
At startup, before the server accepts connections — loading config, certificates,
a template. There is nothing to block. In a request handler it is a bug.

**You must process a 500,000-row export in the API process. How?**
Preferably not in the request: queue it and return `202` with a job id. If it
must stay in-process, chunk it and yield with `setImmediate` between chunks, or
run it on a worker thread. Never a single tight loop over the whole array.

**Does wrapping blocking code in `async`/`await` unblock it?**
No. `async` only changes how the function returns a value. Unless you await
something that genuinely yields — I/O, a timer, a worker message — the code still
runs to completion on the main thread.

**Why can blocking be a security problem, not just a performance one?**
Because it turns a single crafted request into a denial of service. A ReDoS
pattern or an unbounded JSON body lets one attacker freeze the whole process for
every user.

## Phase gate

You are done with Phase 0's core when you can explain, out loud, why the
`for` loop above stalls every request and the database query does not — and
name three ways to fix it.

---

← Prev: [One thread, many I/O](02-single-thread-and-io.md) · Next → [The libuv thread pool](04-libuv-thread-pool.md)
