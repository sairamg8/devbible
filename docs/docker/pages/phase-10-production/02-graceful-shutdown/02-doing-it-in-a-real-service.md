---
title: "Doing it in a real service"
sidebar_label: "02 · Doing it in a real service"
sidebar_position: 2
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 against the Node.js [HTTP server API](https://nodejs.org/api/http.html)
> — `server.close()` (history: *v19.0.0 — the method closes idle connections before
> returning*), `server.closeIdleConnections()` and `server.closeAllConnections()` (both
> added in v18.2.0) — the [Node.js process signal events](https://nodejs.org/api/process.html#signal-events)
> documentation, the [Compose file reference](https://docs.docker.com/reference/compose-file/services/)
> and [docker container stop](https://docs.docker.com/reference/cli/docker/container/stop/).
> **No sandbox** — no console output on this page.

**Almost every failed graceful shutdown fails in the same place: the listener
closed, and the process still would not exit.** This chunk is the concrete
version of the four steps, in the runtime this track actually containerises, plus
the two resources that keep a process alive after the HTTP server is done with.

## The keep-alive problem, which is the whole problem

`server.close()` does not do what its name suggests. Node's documentation is
precise about it:

> Stops the server from accepting new connections and closes all connections
> connected to this server which are not sending a request or waiting for a
> response.

The server is finally closed — and the callback fires — only once every remaining
connection has ended. **A keep-alive connection that is sitting idle between
requests is a remaining connection.** It has no request in flight and no reason
to end, so before Node 19 it kept the process alive until its timeout expired,
which is longer than your grace period. That is the ten-second stop with a
correct-looking handler, and it is why "we call `server.close()`" is not the same
claim as "we shut down gracefully".

Two things changed that, both worth knowing because you will read code written on
either side of the line:

| Version | What `server.close()` does about idle keep-alive sockets |
|---|---|
| Node 18.2.0+ | Nothing — but `server.closeIdleConnections()` exists to do it explicitly |
| **Node 19.0.0+** | **Closes them itself before returning** — the documented history entry |

`server.closeAllConnections()`, also added in 18.2.0, is the harder hammer: it
closes established connections **including** ones that are mid-request. It is the
right call at the end of a drain deadline and the wrong one at the start of it.
Note that it does not destroy sockets upgraded to another protocol — WebSocket
and HTTP/2 connections need their own shutdown.

## The shape

```js
const server = app.listen(3000);
let shuttingDown = false;

app.get('/healthz', (_req, res) =>
  res.status(shuttingDown ? 503 : 200).send(shuttingDown ? 'draining' : 'ok'));

async function shutdown(signal) {
  if (shuttingDown) return;          // stops double-signal re-entry
  shuttingDown = true;
  console.log(JSON.stringify({msg: 'shutdown started', signal}));

  await sleep(READINESS_DRAIN_MS);   // step 1: let the balancer notice

  const forced = setTimeout(() => {  // the backstop, inside the grace period
    console.log(JSON.stringify({msg: 'drain timed out, forcing'}));
    server.closeAllConnections();
  }, DRAIN_DEADLINE_MS);
  forced.unref();

  await new Promise((res) => server.close(res));   // steps 2 and 3
  clearTimeout(forced);

  await pool.end();                  // step 4: release, in dependency order
  await metrics.flush();
  console.log(JSON.stringify({msg: 'shutdown complete'}));
  process.exit(0);
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT',  () => shutdown('SIGINT'));
```

Five details in there are load-bearing, and each corresponds to a way this goes
wrong in production:

- **The re-entry guard.** An impatient operator sends a second `SIGTERM`, or your
  supervisor does; without the guard you start two shutdowns and the second one
  closes a pool the first is still using.
- **`SIGINT` as well as `SIGTERM`.** `Ctrl-C` in an interactive `docker run` and
  a stop from an orchestrator should not take different code paths, or you will
  only ever test one of them.
- **The backstop timer, `unref`'d.** `unref()` means the timer itself never keeps
  the event loop alive — otherwise your safety net becomes the thing preventing
  exit. Set the deadline meaningfully **inside** the grace period: with 10 s to
  play with, a drain deadline around 5–7 s leaves room for the release step.
- **`process.exit(0)` at the end.** Deliberate, and the counterpart to the
  previous topic's warning: installing a `SIGTERM` listener removed Node's
  default exit behaviour, so exiting is now yours to do. Exit 0 is also what
  makes the shutdown visible in `docker inspect`.
- **Release order.** The database pool closes *after* the server, because
  in-flight requests are still using it. Reverse those two and the drain fails
  the requests it was supposed to protect.

## What else keeps a process alive

`server.close()` resolving is not the same as the event loop being empty. The
usual holders, in rough order of how often they are the culprit:

| Holder | What it needs |
|---|---|
| Database pool / client | `pool.end()`, `client.close()` — after the server, not before |
| Queue consumer | stop consuming first, then finish or `nack` the current message |
| `setInterval` timers | `clearInterval`, or `unref()` at creation for background ticks |
| Open WebSockets | closed explicitly; `closeAllConnections()` does not touch upgraded sockets |
| A file or stream being written | flush and close, or accept losing the tail |
| Metrics/tracing exporters | a final flush, otherwise the last window is silently lost |

⚠️ **The temptation is to skip all of this with a bare `process.exit(0)` in the
handler.** That is not graceful shutdown, it is a fast crash you chose — every
in-flight request is cut and unflushed buffers are lost. It is a legitimate
*fallback* after the drain deadline; it is not the first line of the handler.

## A worker with no HTTP server

Queue consumers and cron-ish workers are the other half of a real stack, and
their version is simpler but the ordering still matters:

1. Set the shutting-down flag so the consume loop stops pulling.
2. Let the message currently being handled finish, capped by the same kind of
   deadline.
3. If the cap expires, **`nack`/requeue rather than acknowledge** — the work goes
   back to the queue instead of being silently dropped.
4. Close the connection and exit 0.

The whole design assumes redelivery, which is the point made in the previous
chunk: shutdown that cannot finish must leave work *resumable*.

## Wiring the budget where the container runs

```yaml
services:
  api:
    stop_grace_period: 30s        # give the drain room, deliberately
    stop_signal: SIGTERM          # the default; set it when the app wants another
    healthcheck:
      test: ["CMD", "curl", "-fsS", "http://localhost:3000/healthz"]
      interval: 5s                # step 1's wait must exceed this
```

```bash
docker run --stop-timeout 30 --stop-signal SIGTERM myimage
docker stop -t 30 api
```

Under systemd — Quadlet or a unit around the engine — the same number is
`TimeoutStopSec`, defaulting to 90 s (Phase 11). **Set it in every place the
image runs**, because the mismatch between them is the bug, not any individual
value.

## The container-specific traps

Three of these belong to containers rather than to your language, and all three
have already been established elsewhere in this track:

- **PID 1 must be your process** or a real init, or the signal never arrives
  ([topic 01](../01-pid-1/README.md)). Exec form, and `exec "$@"` in entrypoint
  scripts.
- **Only PID 1 receives the signal.** Child processes your app spawned get
  nothing unless you forward it, or unless an init is doing that job for you.
- **Logs written during shutdown must go to stdout/stderr** to survive, because
  the container's filesystem goes away with it
  ([04 · Logs go to stdout and stderr](../04-logs-to-stdout/README.md)). A shutdown routine
  that logs to a file inside the container leaves no evidence of the failure you
  are trying to debug.

## Podman

Identical at the application level — the process sees the same signal and the
same deadline. The one difference to plan for is that under Quadlet the budget is
systemd's, so a routine that assumed ten seconds is suddenly given ninety, and
one that assumed ninety is truncated the moment somebody runs the image with
`podman stop`. Size for the smallest.

## Gotchas

**Symptom:** `server.close()` is called, its callback never fires, and the
container is `SIGKILL`ed at the deadline.
**Cause:** Idle keep-alive connections. Before Node 19 they are "connected", so
close waits for them.
**Fix:** Node 19+ handles it in `close()`; on 18.2+ call
`server.closeIdleConnections()`. Either way keep the backstop timer that calls
`closeAllConnections()`.

**Symptom:** Shutdown logs appear, exit code is still 143.
**Cause:** The process died of the signal before your asynchronous handler got
anywhere — usually a second `SIGTERM` arriving, or a handler registered after the
work that blocks the loop.
**Fix:** The re-entry guard, and register the handlers at startup before anything
long-running.

**Symptom:** In-flight requests fail with database errors *during* a graceful
shutdown.
**Cause:** The pool was closed before the server finished draining.
**Fix:** Close the pool in the `server.close()` callback, never alongside it.

**Symptom:** The service exits promptly and cleanly, and the last minute of
metrics is missing from every deploy.
**Cause:** The exporter's buffer was never flushed; `process.exit()` does not
wait for it.
**Fix:** Flush after the drain, before exit — and treat "the last window is
always missing" as the symptom of a missing flush rather than a collector
problem.

## Interview questions

**★ Why is calling `server.close()` not enough in Node?**
Because it stops new connections and waits for existing ones to end, and an idle
keep-alive connection does not end on its own. Before Node 19 it kept the process
alive past the grace period; from 19 `close()` closes idle connections itself,
and `closeAllConnections()` remains the deliberate hammer for the drain deadline.

**★ In what order do you close things during shutdown, and why?**
Readiness first, then the listener, then in-flight work, then dependencies —
pool, then buffers — then exit 0. Reversing the last two failure-modes the very
requests the drain exists to protect, and reversing the first two produces
connection-refused from an upstream that has not noticed yet.

**★ What is the backstop timer for, and why `unref()` it?**
It caps the drain so shutdown finishes inside the grace period instead of being
`SIGKILL`ed mid-way, forcing remaining connections closed when it fires.
`unref()` stops the timer itself from holding the event loop open, which would
otherwise make the safety net the reason the process cannot exit.

**How does shutdown differ for a queue worker with no HTTP server?**
Stop consuming, let the in-flight message finish under a cap, and on expiry
requeue rather than acknowledge so the work is redelivered. There is no readiness
step because nothing is routing traffic to it — the queue is the buffer.

**Your handler runs and the container still exits 137. Where do you look?**
At what is holding the event loop open after `server.close()` resolves: a pool
that was never ended, a `setInterval` still running, open WebSockets that the
HTTP close does not touch, or a drain with no deadline. The backstop timer is the
structural fix.

**Is `process.exit(0)` in the signal handler acceptable?**
As the last line, yes — after draining and flushing, and necessary because
installing the listener removed Node's default exit. As the *first* line it is a
fast crash by choice: every in-flight request is cut and every buffer is lost.

---

← [01 · The deadline](01-the-deadline.md) · [Topic index](README.md)
