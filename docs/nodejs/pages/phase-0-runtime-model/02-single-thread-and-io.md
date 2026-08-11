---
title: "Single-threaded JavaScript, multi-threaded I/O"
sidebar_label: "02 · One thread, many I/O"
sidebar_position: 2
---

<span className="db-tier t-master">Master</span>

**Your JavaScript runs on exactly one thread. The waiting does not.**

That one sentence resolves most of the confusion around "Node is
single-threaded". Node is single-threaded where *your code* is concerned, and
happily multi-threaded underneath it.

## Why it exists

A traditional server gives every request its own thread. 10,000 connections
means 10,000 threads, each holding a megabyte of stack, most of them asleep
waiting for a database. Threads are expensive to create and to switch between.

Node made a different bet: **one thread, and never let it wait.** When your code
asks for a file or a database row, the request is handed off and the thread
immediately moves on to other work. The answer comes back later as a callback.

The trade-off: you get very cheap concurrency for I/O-heavy work, and you pay
for it with a hard rule — *never make that one thread do anything slow.*

## What "blocking" actually means

- **Blocking:** the call does not return until the answer is ready. The thread
  sits there, doing nothing, and nothing else in your program can run.
- **Non-blocking:** the call returns immediately. The answer arrives later
  through a callback or a promise.

```js
// blocking.js — the thread stops here
const fs = require('node:fs');

const data = fs.readFileSync('big-file.txt', 'utf8');   // nothing else runs
console.log(data.length);
console.log('after');
```

```js
// nonblocking.js — the thread keeps going
const fs = require('node:fs/promises');

fs.readFile('big-file.txt', 'utf8').then((data) => console.log(data.length));
console.log('after');   // prints FIRST — the read is still in progress
```

Same file, same result, completely different behaviour for everything else in
the process.

## The cook analogy

One cook in the kitchen. Orders arrive constantly.

- **Blocking cook:** puts a cake in the oven, then stands in front of the oven
  for 40 minutes. Everyone else waits. Ten orders, ten cakes, all day.
- **Non-blocking cook:** puts the cake in, sets a timer, and starts the next
  order. When a timer rings, they handle that cake. Ten cakes bake at once.

The ovens are the operating system. There are many of them. There is still only
one cook — so if the cook decides to chop onions for three minutes, every timer
that rings during those three minutes waits.

## Concurrency you get for free

```js
// parallel.js
import { setTimeout as sleep } from 'node:timers/promises';

// Stand-in for a database query that takes 300ms.
async function query(name) {
  await sleep(300);
  return `${name} done`;
}

console.time('sequential');
await query('users');
await query('orders');
await query('invoices');
console.timeEnd('sequential');

console.time('parallel');
await Promise.all([query('users'), query('orders'), query('invoices')]);
console.timeEnd('parallel');
```

```console
$ node parallel.js
sequential: 902.256ms
parallel: 301.172ms
```

Three queries, one thread, 300ms total. The thread was not busy during those
300ms — it was free the whole time. `await` does not mean "wait here"; it means
"let something else run until this is ready".

Sequential `await` in a loop is the single most common performance bug in Node
code. It is covered properly in Phase 2.

## Only one callback runs at a time

Because there is one thread, two of your functions can never execute
simultaneously. This is a real gift: no locks, no mutexes, no torn reads.

```js
// no-locks.js
let total = 0;

function addOneHundred() {
  for (let i = 0; i < 100; i++) total++;   // cannot be interrupted mid-loop
}

setTimeout(addOneHundred, 0);
setTimeout(addOneHundred, 0);
setImmediate(addOneHundred);

process.on('exit', () => console.log('total =', total));   // always 300
```

In Java or Go that program needs a lock to be correct. In Node it is correct as
written, every time.

The catch is that this guarantee stops at every `await`. A function pauses at
`await`, and other code runs in the gap — see the gotcha below.

## Who does the actual waiting

| Kind of work | Who handles it | Threads involved |
|---|---|---|
| Network: sockets, HTTP, TCP | The OS (`epoll` on Linux, `kqueue` on macOS, IOCP on Windows) | None — the OS notifies libuv when data is ready |
| Files, `dns.lookup`, some `crypto`, `zlib` | The libuv thread pool | 4 by default |
| Timers | libuv checks the clock each turn of the loop | None |
| Your JavaScript | The main thread | Exactly one |

Network I/O uses **no extra threads at all**. This surprises people who assume
the thread pool handles everything. Details in
[The libuv thread pool](04-libuv-thread-pool.md).

## Gotchas

**Symptom:** A counter or cache ends up with a wrong value even though "Node is
single-threaded, so I don't need a lock"
**Cause:** The read and the write sit on opposite sides of an `await`. The
function yields there, a second request runs the same code, and both write back
a value computed from the same stale read.
**Fix:** Read and write with no `await` between them, or make the store itself
atomic (a Redis `INCR`, a SQL `UPDATE ... SET n = n + 1`).

```js
// The bug — two concurrent calls both end up with 1, not 2
async function chargeOnce(userId) {
  const current = await db.getCredits(userId);   // yields here
  await db.setCredits(userId, current + 1);      // stale `current`
}
```

**Symptom:** One endpoint is slow and *every other endpoint* is slow too
**Cause:** Something on the main thread is blocking — a sync call, a huge
`JSON.parse`, a loop over 500,000 rows.
**Fix:** Find it and move it off the thread. See
[Blocking the event loop](03-blocking-the-event-loop.md).

**Symptom:** Adding more `await`s made a route dramatically slower
**Cause:** Independent work awaited one at a time, so the durations add up
instead of overlapping.
**Fix:** `Promise.all` for anything that does not depend on the previous result.
Keep sequential `await` only where step two genuinely needs step one's answer.

**Symptom:** CPU sits at 100% on one core while the other seven idle
**Cause:** Working as designed — one thread means one core.
**Fix:** Run one process per core with `node:cluster` or your orchestrator
(Phase 5 and Phase 11), or move the heavy computation to `worker_threads`.

## Interview questions

**★ Node is single-threaded — so how does it handle thousands of concurrent
requests?**
Only the JavaScript execution is single-threaded. Requests spend nearly all
their time waiting on I/O, and that waiting is done by the OS and by libuv's
thread pool, not by the JS thread. The one thread is only ever busy for the
microseconds it takes to run a callback, so it can service enormous numbers of
mostly-idle connections.

**★ What is the difference between blocking and non-blocking?**
A blocking call holds the thread until it completes. A non-blocking call returns
immediately and delivers the result later via a callback or promise. In Node the
distinction matters more than usual because there is only one thread to block.

**★ Why does a 3-second `for` loop stall every request, when a 3-second database
query does not?**
The loop runs *on* the JS thread, so nothing else can run for those 3 seconds.
The query runs somewhere else entirely — the thread hands it off and is free
again immediately. Blocking is about occupying the thread, not about elapsed
time.

**Do you need mutexes or locks in Node?**
Not between callbacks: a callback runs to completion without interruption, so a
plain `count++` is safe. You do need care around `await` — a function yields
there, and a read-modify-write spanning an `await` can interleave with another
request.

**If a process has 8 cores, how do you use them?**
Run 8 Node processes — `node:cluster`, a process manager, or 8 containers — each
with its own event loop. One process will never exceed one core for JavaScript.
`worker_threads` is the alternative when the work is CPU-heavy but must share
memory or stay in one process.

**Does network I/O use the libuv thread pool?**
No. Sockets are handled by the kernel's own notification mechanism (`epoll`,
`kqueue`, IOCP) with no extra threads. The pool is for filesystem work,
`dns.lookup`, parts of `crypto`, and `zlib`.

---

← Prev: [What Node.js is](01-what-node-is.md) · Next → [Blocking the event loop](03-blocking-the-event-loop.md)
