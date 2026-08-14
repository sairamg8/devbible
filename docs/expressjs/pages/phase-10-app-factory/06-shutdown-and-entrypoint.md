---
title: "Shutdown and entrypoint"
sidebar_label: "06 · Shutdown · entry"
sidebar_position: 6
---

<span className="db-tier t-understand">Understand</span>

**Keep `server` from `listen`. On SIGTERM: stop accepting, drain, close pools (Node). `server.js` listens; `app.js` exports the factory.**

> Verified: 2026-08-14 — **no sandbox run**. The critical distinction is documented:
> `app.listen()` **returns an `http.Server`**
> ([application reference](https://expressjs.com/en/5x/api/application/)), and it is that
> object — not the Express `app` — that has `close()`. An Express app has no `close`
> method at all.
> `server.close()` semantics are Node's: it *"stops the server from accepting new
> connections and closes all connections connected to this server which are not sending a
> request or waiting for a response"*, and **the callback fires only once all connections
> have ended** ([`node:http`](https://nodejs.org/api/http.html)). Keep-alive connections
> are exactly why that can take a while — Node ≥ 18.2 adds `server.closeIdleConnections()`
> and `server.closeAllConnections()` for it.
> Signals, PID 1 in containers, pool draining and worker shutdown are
> [Node Phases 5 and 11](../../../nodejs/pages/phase-11-deployment/README.md).

```js
// server.js
const app = createApp(deps);
const server = app.listen(config.port);
process.on('SIGTERM', () => {
  server.close(() => deps.pool.end().then(() => process.exit(0)));
});
```

Feature flags and serverless adapters (`serverless-http`) are When Needed — see
[page 07](07-flags-and-serverless.md).

## The split: `app.js` exports, `server.js` listens

Two files, and the boundary is precise:

```js
// app.js — exports the factory. Imported by tests. Nothing happens on import.
export function createApp(deps) { /* … */ }

// server.js — the entrypoint. Everything with a side effect lives here.
const config = loadConfig();
const pool   = await createPool(config);
const server = createApp({pool, config}).listen(config.port);
process.on('SIGTERM', () => shutdown(server, pool));
```

**Anything with a side effect belongs in `server.js`**: connecting, listening,
signal handlers, metrics exporters, cron registration. `app.js` must be importable
by a test without doing any of it — which is the same rule as
[page 01](01-create-app.md), stated as a file boundary so it is enforceable by
looking at the diff.

## Shutdown is a sequence, and the order is the whole thing

```js
async function shutdown(server, pool) {
  ready = false;                       // 1. fail readiness FIRST
  await delay(config.drainDelayMs);    // 2. let the load balancer notice

  server.close(async () => {           // 3. stop accepting; wait for in-flight
    await pool.end();                  // 4. close dependencies AFTER requests finish
    process.exit(0);
  });

  setTimeout(() => process.exit(1), config.shutdownTimeoutMs).unref();  // 5. deadline
}
```

Each step exists because skipping it breaks something:

1. **Fail readiness before closing.** The orchestrator learns you are going away
   through the probe, not through connection errors.
2. **Wait.** This is the step everyone omits, and it causes the classic symptom:
   *"we do graceful shutdown and users still see 502s during deploys."* Load
   balancers poll; between your last successful probe and their next poll, they are
   still routing traffic to you. Closing immediately means those requests hit a
   closed port. A few seconds of deliberate delay while still serving is what
   actually makes a deploy invisible.
3. **`server.close()`** stops new connections and waits for in-flight requests.
4. **Close pools after**, never before — an in-flight request needs its database
   connection to finish.
5. **A hard deadline.** `close` can hang indefinitely on keep-alive connections;
   the timer guarantees the process eventually exits. `.unref()` so the timer
   itself does not keep the process alive.

On keep-alive: a browser holding an idle connection can delay `close`'s callback,
because the callback fires only once **all** connections have ended.
`server.closeIdleConnections()` (Node ≥ 18.2) releases the idle ones immediately
while letting active requests finish — the targeted fix for a shutdown that stalls
with no traffic in flight.

## Trade-off

Graceful shutdown makes deploys invisible to users, and every step above buys a
specific class of failed request. The cost is deploy latency — the drain delay plus
the in-flight wait, on every instance, on every release — and complexity in the one
code path that is hardest to test and only runs when it matters.

Skipping it is defensible for an internal tool with no traffic during deploys. For
anything user-facing it is the difference between a silent release and a burst of
502s that nobody can reproduce afterwards.

**Do not tune the timeout by feel.** The drain delay should exceed the load
balancer's health-check interval, and the hard deadline should exceed your slowest
legitimate request. Both are numbers you can look up.

## Gotchas

**Symptom:** `app.close is not a function`  
**Cause:** Calling `close` on the Express app  
**Fix:** Keep the return value of `listen` — it is the `http.Server`, and only it has
`close`

**Symptom:** 502s during every deploy despite graceful shutdown  
**Cause:** No drain delay — the load balancer had not noticed before the port closed  
**Fix:** Fail readiness, wait longer than the probe interval, *then* close

**Symptom:** Shutdown hangs with no requests in flight  
**Cause:** Idle keep-alive connections; `close`'s callback waits for all connections  
**Fix:** `server.closeIdleConnections()`, plus a hard exit deadline

**Symptom:** In-flight requests fail with connection errors during shutdown  
**Cause:** Pools closed before `server.close` finished  
**Fix:** Close dependencies inside the `close` callback, not alongside it

**Symptom:** The process never exits and the orchestrator SIGKILLs it  
**Cause:** No timeout, or a timer keeping the loop alive  
**Fix:** A deadline `setTimeout(..., ms).unref()`

**Symptom:** Importing `app.js` in a test opens a port or a database connection  
**Cause:** Side effects on the wrong side of the file boundary  
**Fix:** Everything with a side effect goes in `server.js`

**Symptom:** SIGTERM is ignored entirely in the container  
**Cause:** The process is PID 1 under a shell, or signals are not forwarded  
**Fix:** Node Phase 11 — an init process or `exec` form in the image

## Interview questions

**★ What object do you call close on?**  
The `http.Server`, not the Express `app`.

**★ Why do deploys still produce 502s even with `server.close()` on SIGTERM?**  
Because the load balancer has not noticed yet. Between your last successful probe and
its next poll, it is still routing traffic — and the port is already closed. Fail
readiness first, wait longer than the probe interval while still serving, then close.

**★ In what order do you close the server and the database pool?**  
Server first, pool inside its callback. In-flight requests still need their database
connections; closing the pool early fails the very requests you were draining.

**Why can `server.close()` hang with no requests in flight?**  
Its callback fires only once **all** connections have ended, and idle keep-alive
connections count. `server.closeIdleConnections()` releases those while letting active
requests finish — and a hard `setTimeout(...).unref()` deadline guarantees exit.

**What belongs in `server.js` rather than `app.js`?**  
Everything with a side effect: connecting, listening, signal handlers, metrics
exporters, schedulers. `app.js` must be importable by a test without doing any of it.

**How do you pick the drain delay and the shutdown timeout?**  
The drain delay from the load balancer's health-check interval; the hard deadline from
your slowest legitimate request. Both are values you look up, not tune by feel.


---

← Prev: [Health and boot](05-health-and-boot.md) · Index: [Phase 10](README.md)
