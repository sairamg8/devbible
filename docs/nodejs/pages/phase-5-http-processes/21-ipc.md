---
title: "IPC between parent and child"
sidebar_label: "21 · IPC"
sidebar_position: 21
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-08 on **Node 24.19.0** (Active LTS).

**`fork` starts another Node process with a message channel already wired up.
`child.send()` and `process.send()` move JSON across it. It is how `cluster`
talks to its workers, and it is the cheapest way to run something in a separate
process you still need to control.**

## Both ends

```js
// parent.mjs
import { fork } from 'node:child_process';
const child = fork('./child.mjs');
child.on('message', (msg) => { /* … */ });
child.send({ cmd: 'work', payload: { n: 1 } });

// child.mjs
process.on('message', (msg) => process.send({ echo: msg, pid: process.pid }));
process.send({ ready: true });
```

```console
$ node parent-ipc.mjs
parent: forked pid 31976 | connected: true
  child: process.send available? function
parent: got {"ready":true}
  child: got {"cmd":"work","payload":{"n":1},"when":"2026-08-10T00:00:00.000Z"}
parent: got {"echo":{…},"pid":31976}
  child: got {"cmd":"stop"}
parent: child disconnected
parent: child exited 0
```

`process.send` exists **only** when the process was forked with an IPC channel —
it is `undefined` in a normally started process, so library code must check before
calling it.

## It is JSON, and that matters

Look at the `when` field above. A `Date` was sent; a **string** arrived. The
channel serialises with JSON semantics by default, so:

| Sent | Received |
|---|---|
| `Date` | ISO string |
| `Map` / `Set` | `{}` |
| `undefined` property | dropped |
| `BigInt` | throws |
| `Buffer` | `{ type: 'Buffer', data: [...] }` |
| circular reference | throws |

`fork(module, { serialization: 'advanced' })` switches to the structured clone
algorithm, which preserves `Date`, `Map`, `Set`, `BigInt` and typed arrays — at
some cost, and both ends must agree.

Messages are **copied**, never shared. A 50 MB payload is serialised, written
through a pipe and parsed at the other end; do that per request and the
serialisation dominates. Send handles or file paths, not data. Genuine shared
memory needs `SharedArrayBuffer` in worker threads
([page 25](25-shared-memory.md)), which child processes cannot use.

## Sending a server handle

The one genuinely special capability: a socket or server can travel across the
channel, and this is exactly how `cluster` distributes connections.

```js
// parent
const server = createServer(handler);
server.listen(3000, () => child.send('server', server));

// child
process.on('message', (msg, handle) => {
  if (msg === 'server') handle.on('connection', (socket) => { /* serve it here */ });
});
```

The second argument of `send` is the handle; the second argument of the
`'message'` listener receives it. Unless you are building your own load balancer,
use `cluster` ([page 23](23-cluster.md)), which is this with the bookkeeping done.

## Lifecycle

| Event / call | Meaning |
|---|---|
| `child.connected` | Whether the channel is open |
| `child.disconnect()` / `process.disconnect()` | Close the channel; the child can then exit naturally |
| `'disconnect'` | The channel closed — no more messages either way |
| `'exit'` | The child process ended, with `(code, signal)` |
| `'error'` | Spawn failed, or `send` failed |

**An open IPC channel keeps both processes alive**, because it is a referenced
handle. A child that has finished its work but never disconnects hangs forever.
`disconnect()` from either side is the clean way to end — the sequence above shows
`disconnect` then `exit 0`. `child.unref()` is the alternative when the parent
should not wait.

Backpressure exists here too: `child.send()` returns `false` when the channel
buffer is full. A tight loop that ignores it queues messages in memory until the
process dies.

## When to use it

Reasonable: a supervisor coordinating workers, a long-running helper process you
send jobs to, `cluster`, and anything needing genuine crash isolation — a child
that segfaults does not take the parent with it.

Usually wrong: **CPU work in JavaScript**, where a worker thread costs a fraction
of the memory and can share it instead of copying
([page 24](24-worker-threads.md)) — startup time is much the same, the difference
is per-instance cost and the serialisation you avoid; and **communication between
independent services**, which wants a real transport — HTTP, a queue — not a
parent/child relationship that dies with the parent.

## Gotchas

**Symptom:** `process.send is not a function`
**Cause:** The process was not forked with an IPC channel.
**Fix:** Guard with `if (process.send)`, or start it with `fork`.

**Symptom:** A `Date` arrives as a string; a `Map` arrives empty
**Cause:** Default JSON serialisation.
**Fix:** `serialization: 'advanced'`, or send plain data and rebuild.

**Symptom:** The parent never exits after the child finishes
**Cause:** The IPC channel keeps both alive.
**Fix:** `disconnect()`, or `child.unref()`.

**Symptom:** Memory climbs while sending many messages
**Cause:** `send()` returning `false` was ignored.
**Fix:** Respect the return value, or batch.

**Symptom:** Throughput collapses with large messages
**Cause:** Every message is serialised and copied across a pipe.
**Fix:** Send references; use worker threads with shared memory if the data must
be shared.

**Symptom:** Messages arrive after the child was told to stop
**Cause:** Messages already in flight when `disconnect` was called.
**Fix:** Acknowledge explicitly rather than assuming ordering with disconnect.

## Interview questions

**★ How do a forked child and its parent communicate?**
Over an IPC channel created by `fork`. Both ends call `send()` and listen for
`'message'`. `process.send` only exists in a process that was forked this way.

**★ What happens to a `Date` sent over IPC?**
It becomes an ISO string — verified above. The default serialisation is JSON, so
`Map`, `Set` and `undefined` properties are also lost and `BigInt` throws.
`serialization: 'advanced'` uses structured clone and preserves them.

**★ Why doesn't IPC share memory?**
Separate processes have separate address spaces, so every message is serialised,
written through a pipe and parsed again. That is why large payloads are expensive
and why worker threads exist for data-heavy work.

**★ Why won't a process exit after its child finishes?**
The open IPC channel is a referenced handle keeping the event loop alive.
`disconnect()` on either side, or `unref()`, releases it.

**What can you send besides plain data?**
A server or socket handle, as the second argument to `send`. That is the mechanism
`cluster` uses to hand accepted connections to workers.

**Child process or worker thread?**
Worker thread for JavaScript CPU work — roughly a tenth of the memory per
instance, shared memory, and transfers instead of copies. Startup is comparable,
so speed is not the argument. Child process for running another program, or when
crash isolation is the point.

---

← Prev: [Shell injection](20-shell-injection.md) · Next → [util.parseArgs](22-parseargs.md)
