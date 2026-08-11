---
title: "The libuv thread pool"
sidebar_label: "04 · The thread pool"
sidebar_position: 4
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 against libuv 1.x docs and Node 24.19.0.

**Some things cannot be done without blocking, so libuv keeps four spare threads
to block on your behalf.**

## Why it exists

The operating system has a proper non-blocking API for sockets — `epoll` on
Linux, `kqueue` on macOS, IOCP on Windows. Ask the kernel to watch 10,000
sockets and it will tell you the moment any of them has data. No threads needed.

There is no such API for reading a file. Portable filesystem calls block, full
stop. So libuv fakes non-blocking behaviour: it hands the blocking call to a
worker thread, lets that thread sit there, and posts the result back to the event
loop when it's done. Your main thread never notices.

## What actually uses it

| Uses the pool | Does **not** use the pool |
|---|---|
| Everything in `node:fs` (async form) | TCP, HTTP, HTTPS — all sockets |
| `dns.lookup()` | `dns.resolve()` and the rest of `node:dns` |
| `crypto.pbkdf2`, `scrypt`, `randomBytes`, `randomFill`, `generateKeyPair` | Hashing with `createHash` (synchronous, on the main thread) |
| `zlib` async methods — `gzip`, `brotliCompress`, … | Timers |
| `child_process` on some platforms | `worker_threads` (they get their own threads) |

The rule worth memorising: **network I/O uses no threads; file, DNS-lookup,
crypto and compression work does.**

## Watch it saturate

The pool holds four threads by default, so the fifth task has to wait for a free
one:

```js
// pool.js
const crypto = require('node:crypto');

const start = Date.now();

for (let i = 1; i <= 5; i++) {
  crypto.pbkdf2('password', 'salt', 400000, 64, 'sha512', () => {
    console.log(`task ${i} finished at ${Date.now() - start}ms`);
  });
}
```

```console
$ node pool.js
task 2 finished at 539ms
task 1 finished at 541ms
task 3 finished at 546ms
task 4 finished at 546ms
task 5 finished at 1084ms
```

Four finish together at ~540ms. The fifth finishes at ~1084ms — it did not start
until a thread came free. That is the queue, visible.

## Changing the size

```console
$ UV_THREADPOOL_SIZE=8 node pool.js
```

- **Default: 4.** Maximum: **1024** (raised from 128 in libuv 1.30.0).
- The pool is created **lazily, on first use, and its size is fixed from then
  on.** Setting `process.env.UV_THREADPOOL_SIZE` inside your code is a coin flip
  — any module that touched `fs` during import has already fixed the size.
  Set it in the environment, in your Dockerfile, or in your process manager.

Bigger is not automatically better:

- If the threads are **waiting on a slow disk or network filesystem**, more
  threads means more overlap and real gains.
- If they are **burning CPU** (`pbkdf2`, `gzip`), they compete for the same
  cores. Going past your core count adds context switching and makes each task
  slower, even though they all start sooner.

A sane starting point is the number of cores you have given the process
(`os.availableParallelism()`), then measure. Do not raise it blindly.

## The `dns.lookup` trap

`dns.lookup()` looks like a network call. It isn't — it calls the system's
`getaddrinfo`, which blocks, so it goes to the thread pool. And **every outbound
`fetch`, `http.request`, and database connection resolves its hostname through
`dns.lookup` by default.**

So a burst of outbound HTTP calls can saturate the pool and, as a side effect,
make unrelated `fs` reads slow. The symptom looks nothing like its cause.

```js
// dns-difference.js
const dns = require('node:dns');

dns.lookup('example.com', (err, address) => {
  console.log('lookup  (thread pool, uses /etc/hosts):', address);
});

dns.resolve4('example.com', (err, addresses) => {
  console.log('resolve4 (real DNS query, no threads):', addresses);
});
```

```console
$ node dns-difference.js
lookup  (thread pool, uses /etc/hosts): 172.66.147.243
resolve4 (real DNS query, no threads): [ '172.66.147.243', '104.20.23.154' ]
```

They are not interchangeable: `lookup` respects `/etc/hosts` and the system
resolver, `resolve4` talks to a DNS server directly and ignores both. Trading one
for the other changes behaviour — the usual fix for pool pressure is a DNS cache
in front of `lookup`, not swapping to `resolve`.

## Gotchas

**Symptom:** Filesystem reads get slower whenever traffic to an external API
increases
**Cause:** `dns.lookup` for the outbound requests is competing with `fs` for the
same four threads.
**Fix:** Cache DNS results (`cacheable-lookup`, or a resolver sidecar), reuse
connections with a keep-alive agent so lookups are rarer, and raise
`UV_THREADPOOL_SIZE`.

**Symptom:** `UV_THREADPOOL_SIZE` set in code has no effect
**Cause:** The pool was already created by an earlier `fs` or `dns` call, often
from a dependency at import time. The size is fixed at creation.
**Fix:** Set it in the environment before the process starts.

**Symptom:** Raising the pool size made throughput worse
**Cause:** The tasks are CPU-bound; more threads than cores means they fight over
the CPU and each one takes longer.
**Fix:** Size to available cores and move genuinely heavy computation to
`worker_threads` or out of the process.

**Symptom:** Async `crypto` still blocks everything
**Cause:** You are calling the `Sync` variant, or `createHash`, which is
synchronous by design and runs on the main thread regardless.
**Fix:** Use the callback/promise form of `pbkdf2`, `scrypt` or `randomBytes`.
For hashing large data, hash a stream rather than one big buffer.

## Interview questions

**★ Node is single-threaded — where do these four threads come from?**
From libuv, not from JavaScript. They exist to make blocking operations look
non-blocking. Your JavaScript still runs on one thread; the pool threads only run
C-level work like a filesystem read, and post the result back to the loop.

**★ Which Node operations use the thread pool, and which don't?**
Pool: `fs`, `dns.lookup`, `zlib`, and the async `crypto` key-derivation and
random functions. Not the pool: all socket I/O (TCP/HTTP/HTTPS), timers, and
`dns.resolve*`. Sockets use the kernel's own readiness notification instead.

**★ Why might heavy outbound HTTP traffic slow down file reads?**
Because every outbound connection resolves its hostname with `dns.lookup`, which
occupies a pool thread. Enough concurrent lookups and `fs` work queues behind
them.

**What is the default pool size, and how do you change it?**
4. Set the `UV_THREADPOOL_SIZE` environment variable before the process starts;
the maximum is 1024. The pool is created on first use and cannot be resized
afterwards.

**Should you set `UV_THREADPOOL_SIZE=128` to be safe?**
No. Threads doing CPU work compete for cores, so oversizing adds context
switching and memory for no throughput. Size near your available cores, then
measure. Large values only pay off when the threads are genuinely idle waiting on
slow storage.

**How is the thread pool different from `worker_threads`?**
The pool is internal, runs C/C++ operations only, and you never see it.
`worker_threads` are yours: each runs its own V8 isolate and its own JavaScript,
and you talk to them by passing messages. Use workers for *your* CPU-bound code;
the pool is not available to it.

---

← Prev: [Blocking the event loop](03-blocking-the-event-loop.md) · Next → [Node vs the browser](05-node-vs-browser.md)
