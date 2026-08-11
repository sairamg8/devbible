---
title: "cluster and sticky sessions"
sidebar_label: "23 · cluster"
sidebar_position: 23
---

<span className="db-tier t-understand">Understand</span> · sticky sessions are <span className="db-tier t-when">When Needed</span>

> Verified: 2026-08 on **Node 24.19.0** (Active LTS), 8-core Linux host.

**One Node process uses one core. `cluster` forks a worker per core, all sharing
one listening port, so a machine with eight cores can serve roughly eight times
the traffic. Whether you should use it — instead of running eight containers — is
a deployment question, not a code question.**

## The shape

```js
import cluster from 'node:cluster';
import { availableParallelism } from 'node:os';
import { createServer } from 'node:http';

if (cluster.isPrimary) {
  for (let i = 0; i < availableParallelism(); i++) cluster.fork();

  cluster.on('exit', (worker, code, signal) => {
    log.error({ pid: worker.process.pid, code, signal }, 'worker died, replacing');
    if (!shuttingDown) cluster.fork();
  });
} else {
  createServer(handler).listen(3000);
}
```

```console
$ node clu.mjs
availableParallelism(): 8 | cpus().length: 8
schedulingPolicy: 2 (SCHED_RR = 2, SCHED_NONE = 1)
```

Every worker calls `listen(3000)` and none of them fails with `EADDRINUSE`. The
primary owns the listening socket and hands accepted connections to workers over
IPC ([page 21](21-ipc.md)); the workers' `listen` is intercepted.

**`availableParallelism()`, not `cpus().length`.** The first respects the CPU
affinity and cgroup limits a container is given; the second reports the host's
cores — so on a 64-core node with a 2-core limit you would fork 64 workers
([Phase 4, page 11](../phase-4-filesystem/11-os.md)).

## Round-robin distributes *connections*, not requests

This is the result that surprises people:

```console
$ node clu2.mjs
keep-alive ON  (one connection reused) -> 1 of 4 workers served traffic {"35043":40}
keep-alive OFF (new connection each)   -> 4 of 4 workers served traffic {"35043":10,"35044":10,"35045":10,"35046":10}
```

Forty requests over one keep-alive connection all landed on **one** worker; the
other three idled. With keep-alive off the same forty spread perfectly, ten each.

`SCHED_RR` (the default everywhere except Windows) round-robins **accepts**. Since
HTTP keep-alive is the norm — and mandatory for performance
([page 07](07-keep-alive-and-agents.md)) — a small number of long-lived upstream
connections pins itself to a small number of workers. Behind a proxy that keeps a
handful of connections open, load can be badly skewed while every dashboard shows
"8 workers running".

Mitigations: many short-lived client connections spread naturally; a proxy
configured with a connection count comfortably above the worker count helps; and
bounding connection lifetime forces periodic redistribution.

## `cluster` or more containers?

| | `cluster` | N containers |
|---|---|---|
| Uses all cores of one machine | ✅ | ✅ |
| Scheduler sees real per-instance load | ❌ one pod, N processes | ✅ |
| Memory limits per worker | ❌ shared cgroup | ✅ |
| A crash affects | one worker | one pod |
| Rolling deploys, autoscaling | manual | native |
| Extra memory | ~50 MB per worker | ~50 MB per container |

**If you are on Kubernetes or any orchestrator, prefer more replicas.** One
process per container means the platform's health checks, restarts, autoscaling
and resource limits all operate on the unit they were designed for. `cluster`
earns its place on a plain VM or a single beefy host, where nothing above Node is
doing the scheduling.

The one thing `cluster` does that replicas cannot: **zero-downtime reload on one
machine**, by restarting workers one at a time while the port stays open. That is
what `pm2 reload` does.

## Shutdown, correctly

```js
if (cluster.isPrimary) {
  process.on('SIGTERM', () => {
    shuttingDown = true;
    for (const w of Object.values(cluster.workers)) w.process.kill('SIGTERM');
  });
}
```

The primary must **forward the signal** — it receives SIGTERM, the workers do not
automatically. Each worker then runs the drain from
[page 17](17-graceful-shutdown.md). And the `'exit'` handler must not re-fork
during shutdown, or the primary spawns replacements while trying to stop.

Guard against a crash loop too: a worker that dies instantly, replaced instantly,
burns a core doing nothing. Track restart timestamps and give up after N failures
in a window.

## Sticky sessions, and why to avoid them

Workers share nothing — separate heaps, separate module state. So anything in
process memory is invisible to the other seven:

- **In-memory sessions** — a user authenticated on worker 3 appears logged out on
  worker 5.
- **In-memory caches, rate-limit counters** — each worker has its own, so a "100
  requests/minute" limit is really 800.
- **WebSockets** — a message broadcast on worker 2 never reaches clients connected
  to worker 6 ([page 11](11-websockets.md)).

The bad fix is **sticky sessions**: routing a client to the same worker every
time, by IP hash or a cookie. It works, and it costs you the ability to scale.
Load becomes uneven and unfixable, one worker dying loses its users' state,
scaling out does not rebalance existing clients, and deploys drop everyone's
session.

**The right fix is to make workers stateless.** Sessions in Redis, rate limits in
Redis, WebSocket fan-out through Redis pub/sub, cache either shared or accepted as
per-worker. Then any worker can serve any request, `cluster` and replicas become
interchangeable, and nothing above needs to know your topology.

Sticky sessions remain legitimate in a narrow case: a genuinely stateful
long-lived connection — a collaborative editing session holding a CRDT in memory —
where moving the state costs more than the pinning does. That is a deliberate
architectural choice, not a workaround for session storage.

## Gotchas

**Symptom:** One worker at 100% CPU, the rest idle
**Cause:** Round-robin distributes connections; keep-alive means few connections.
**Fix:** Expect it behind a proxy; bound connection lifetime, or use replicas.

**Symptom:** 64 workers in a 2-core container, thrashing
**Cause:** `cpus().length` reports the host.
**Fix:** `availableParallelism()`.

**Symptom:** Users randomly logged out
**Cause:** In-memory sessions with no sticky routing.
**Fix:** Shared session store — not stickiness.

**Symptom:** Rate limiting allows N times the configured rate
**Cause:** Per-worker counters.
**Fix:** A shared counter in Redis.

**Symptom:** SIGTERM kills the primary and orphans workers
**Cause:** The primary did not forward the signal.
**Fix:** Forward it, and suppress re-forking during shutdown.

**Symptom:** A crashing worker is restarted forever
**Cause:** Unconditional re-fork on `'exit'`.
**Fix:** Rate-limit restarts and give up after repeated failures.

## Interview questions

**★ How can several workers listen on the same port?**
They do not. The primary creates the listening socket and passes accepted
connections — or the handle itself — to workers over IPC, intercepting their
`listen` call. `EADDRINUSE` never arises because only one process is bound.

**★ Why can load be uneven across cluster workers?**
Round-robin schedules **connections**, not requests. With HTTP keep-alive a client
reuses one connection for many requests, so they all reach one worker. Measured:
40 requests over a reused connection went entirely to a single worker of four,
while the same 40 without keep-alive spread ten each.

**★ `cluster` or more container replicas?**
Replicas, on any orchestrator — the platform's health checks, restarts, limits and
autoscaling all work per instance, which is what they were designed for.
`cluster` is right on a single VM, and for zero-downtime reloads on one machine.

**★ Why are sticky sessions a warning sign?**
They mean state lives in a worker's memory. Pinning fixes the symptom and
introduces uneven load, state loss when a worker dies, no rebalancing on scale-out,
and sessions dropped on every deploy. Moving the state to Redis removes the need.

**Why `availableParallelism()` over `cpus().length`?**
It respects cgroup CPU limits and affinity, so it reports what the container may
actually use. `cpus().length` reports the host and over-forks massively in a
constrained container.

**What must the primary do on SIGTERM?**
Forward it to every worker and stop replacing exited ones. It does not propagate
automatically, and the `'exit'` handler will otherwise fork replacements during
the shutdown.

---

← Prev: [util.parseArgs](22-parseargs.md) · Next → [worker_threads](24-worker-threads.md)
