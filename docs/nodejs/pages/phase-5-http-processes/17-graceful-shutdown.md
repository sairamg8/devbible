---
title: "Graceful shutdown"
sidebar_label: "17 · Graceful shutdown"
sidebar_position: 17
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 on **Node 24.19.0** (Active LTS).

**Stop accepting new work, finish what is in flight, close the pools, exit zero.
This is the thing that makes deploys stop dropping requests — and the naive
version does not work, because `server.close()` waits forever on idle keep-alive
connections.**

## Why the obvious version hangs

```js
process.on('SIGTERM', () => server.close(() => process.exit(0)));
```

One idle keep-alive socket and one in-flight request, three strategies:

```console
$ node shutdown.mjs naive
  100 ms mode=naive: calling server.close()
  655 ms in-flight request finished: slow done
 2101 ms still alive after 2 s — close() never completed

$ node shutdown.mjs idle
  102 ms mode=idle: calling server.close()
  658 ms in-flight request finished: slow done
 2103 ms still alive after 2 s — close() never completed

$ node shutdown.mjs all
  100 ms mode=all: calling server.close()
  102 ms server.close() callback — all connections gone
  108 ms in-flight request FAILED: UND_ERR_SOCKET
```

Three lessons, all of them load-bearing.

**`server.close()` stops accepting new connections and waits for every existing
one to end.** A client holding an idle keep-alive socket ([page
07](07-keep-alive-and-agents.md)) has no reason to close it, so the callback never
fires and the grace period expires into a SIGKILL.

**One call to `closeIdleConnections()` is not enough.** It closes the sockets that
are idle *at that instant*. The connection serving the slow request became idle at
655 ms, long after the single call, so it stayed open.

**`closeAllConnections()` is not graceful.** It destroys sockets immediately,
including the one mid-response — the dropped request you were trying to prevent.
It is the forced-exit backstop, not the strategy.

## The version that works

```js
import { createServer } from 'node:http';

const server = createServer(handler);
let shuttingDown = false;

server.on('request', (req, res) => {
  if (shuttingDown) res.setHeader('Connection', 'close');   // ask clients not to reuse
});

async function shutdown(reason) {
  if (shuttingDown) return;                                  // signals arrive twice
  shuttingDown = true;
  log.info({ reason }, 'shutting down');

  const closed = new Promise((resolve) => server.close(resolve));
  const sweep = setInterval(() => server.closeIdleConnections(), 50);   // repeat
  const force = setTimeout(() => {
    log.warn('grace period expired, forcing');
    server.closeAllConnections();
  }, 10_000).unref();

  await closed;
  clearInterval(sweep); clearTimeout(force);

  await Promise.allSettled([pool.end(), redis.quit(), queue.close()]);
  log.info('drained cleanly');
  process.exitCode = 0;
}

for (const sig of ['SIGTERM', 'SIGINT']) process.on(sig, () => shutdown(sig));
```

```console
$ node shutdown2.mjs
   49 ms one idle keep-alive socket is now parked
  102 ms shutdown: SIGTERM — draining
  657 ms in-flight request finished: slow done
  658 ms shutdown: all connections drained, closing pools
status=0
```

The in-flight request completed, the idle socket was swept, and the process exited
zero — with no client seeing an error.

## The order matters

1. **Flip the flag.** Health checks should start failing *now* so load balancers
   deregister you, and responses carry `Connection: close` so clients stop
   reusing sockets.
2. **`server.close()`** — refuse new connections, keep serving existing requests.
3. **Sweep idle connections** on an interval so keep-alive sockets do not hold you
   open as they fall idle.
4. **Wait for in-flight work** — HTTP requests, and background jobs already
   started.
5. **Close the pools**: database, Redis, message broker. Closing them earlier
   makes in-flight requests fail with connection errors.
6. **`process.exitCode = 0`** and let the loop end. `process.exit()` here can
   truncate the last log line ([page 15](15-process.md)).

Two guards the example includes deliberately. **The re-entry check** — SIGTERM
often arrives more than once, and a second pass through a half-finished shutdown
is chaos. And **the forced-exit backstop**, `unref`'d so it cannot itself keep the
process alive: your deadline must be comfortably shorter than the orchestrator's
grace period, because if the runtime's SIGKILL wins, nothing is cleaned up at all.

Ten seconds against a 30 second `terminationGracePeriodSeconds` leaves room. If
requests legitimately take longer than the grace period, raise the grace period —
do not extend your own timer past it.

## Health checks are part of this

```js
app.get('/health/ready', (req, res) => res.status(shuttingDown ? 503 : 200).end());
app.get('/health/live',  (req, res) => res.status(200).end());
```

**Readiness** answers "should I get traffic?" and must fail the moment shutdown
begins. **Liveness** answers "am I broken enough to restart?" and must keep
succeeding throughout — a liveness probe that fails during a graceful shutdown
gets you killed mid-drain, which is the exact opposite of the goal.

## Beyond HTTP

The same discipline applies to everything else holding work:

- **Job consumers** — stop pulling new messages first, then finish the current one.
  A job killed mid-flight is redelivered, so consumers must be idempotent anyway
  (Phase 7), but a clean stop avoids the duplicate.
- **WebSockets** — send a close frame with a code clients understand, so they
  reconnect with backoff instead of treating it as an error
  ([page 11](11-websockets.md)).
- **In-memory state** — anything not yet persisted is lost. If losing it matters,
  it should not have been only in memory.

## Gotchas

**Symptom:** The process hangs after SIGTERM and is SIGKILLed 30 s later
**Cause:** `server.close()` waiting on idle keep-alive connections.
**Fix:** Sweep with `closeIdleConnections()` on an interval, plus a forced backstop.

**Symptom:** In-flight requests fail during shutdown
**Cause:** `closeAllConnections()` called up front, or pools closed before requests
finished.
**Fix:** Force only after the grace deadline; close pools last.

**Symptom:** Requests arrive after shutdown began and are refused
**Cause:** The load balancer has not deregistered yet.
**Fix:** Keep serving while readiness fails, with a `preStop` delay
([page 16](16-signals.md)).

**Symptom:** The pod is killed halfway through a clean drain
**Cause:** The liveness probe fails once `shuttingDown` is set.
**Fix:** Only readiness reflects shutdown; liveness stays healthy.

**Symptom:** Shutdown runs twice and throws
**Cause:** Repeated SIGTERM, or SIGINT then SIGTERM.
**Fix:** The re-entry guard.

**Symptom:** The final log line is missing
**Cause:** `process.exit()` truncated a pending pipe write.
**Fix:** `process.exitCode`.

## Interview questions

**★ Why isn't `server.close()` enough?**
It stops new connections and waits for existing ones, but an idle keep-alive
connection never ends on its own, so the callback never fires. Verified: with one
parked idle socket, close never completed and the process would have been
SIGKILLed at the end of the grace period.

**★ Difference between `closeIdleConnections` and `closeAllConnections`?**
The first destroys only sockets not currently serving a request — safe, and the
right tool. The second destroys everything including in-flight responses, which
drops requests. Idle-sweeping is the strategy; closing all is the backstop after
the deadline.

**★ Why sweep idle connections repeatedly instead of once?**
Because connections become idle as their requests complete. A single call at the
start misses every socket that finishes afterwards — measured: the connection
serving a 600 ms request stayed open because it became idle after the one call.

**★ What is the correct order of operations?**
Fail readiness, stop accepting connections, sweep idle sockets, wait for in-flight
work, then close database and broker pools, then set `exitCode`. Closing pools
early makes the in-flight requests you were protecting fail.

**Why must liveness and readiness behave differently during shutdown?**
Readiness failing removes you from load balancing, which is what you want.
Liveness failing tells the orchestrator you are broken and triggers an immediate
kill, cutting the drain short.

**How long should the forced-exit timer be?**
Comfortably shorter than the orchestrator's grace period, so that your own forced
path runs instead of SIGKILL. If real requests need longer, raise the grace period
rather than the timer.

---

← Prev: [Signals](16-signals.md) · Next → [Crash handlers](18-crash-handlers.md)
