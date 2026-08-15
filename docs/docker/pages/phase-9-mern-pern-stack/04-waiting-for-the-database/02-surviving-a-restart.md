---
title: "Surviving a restart"
sidebar_label: "02 · Surviving a restart"
sidebar_position: 2
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 against
> [the node-postgres `Pool` API](https://node-postgres.com/apis/pool),
> [the `depends_on` attribute](https://docs.docker.com/reference/compose-file/services/),
> [the Compose `restart` attribute](https://docs.docker.com/reference/compose-file/services/) and
> [`docker container run`](https://docs.docker.com/reference/cli/docker/container/run/).
> **No sandbox** — no console output on this page.

**The database will go away while your application is running.** A restart, a
failover, a `docker compose restart db`, a maintenance window. Compose has no
opinion about any of it, so this half lives entirely in your code — and it is the
half that makes the startup gate almost unnecessary.

## The pool is not a connection

`new Pool()` does not connect. It is a lazy, self-managing set of connections
with documented defaults worth knowing:

| Option | Default | What it means when the database is down |
|---|---|---|
| `max` | **10** clients | Ten failing connections, not one |
| `idleTimeoutMillis` | **10000** (10 s) | Idle clients are discarded and re-made — so an outage is re-discovered periodically |
| `connectionTimeoutMillis` | **0 — no timeout** | 🔴 A connection attempt can hang **indefinitely** unless you set this |

🔴 **`connectionTimeoutMillis: 0` is the default, and it is the wrong default for
a container.** A request that waits forever for a connection is worse than one
that fails in two seconds, because it holds a socket, a request handler and a slot
in your load balancer's queue. Set it.

```js
import pg from 'pg'

export const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  max: 10,
  idleTimeoutMillis: 10_000,
  connectionTimeoutMillis: 5_000,   // never inherit the 0 default
})
```

## 🔴 The pool `error` event that kills your process

This is the highest-value fact on the page. The node-postgres documentation says:
*"You probably want to add an event listener to the pool to catch background
errors!"* — because when the database goes away, *"all the idle, connected clients
in your application will emit an error through the pool's error event
emitter"*. The failed client is removed automatically, but:

> *"if a pool emits an `error` event and no listeners are added node will emit an
> uncaught error and potentially crash your node process."*

```js
pool.on('error', (err) => {
  console.error({ err }, 'idle client error — pool will recover')
  // do NOT process.exit() here: the pool discards the client and carries on
})
```

**Without those three lines, a database restart takes your API down**, and the
container then restarts, and the whole thing looks like an application bug rather
than a missing listener. Note what the handler must *not* do: exiting on a
background error converts a recoverable blip into a crash loop.

## Retry with backoff, on the paths that need it

Two places need retry logic, and they are not the same:

**At start-up** — prove the database is reachable before reporting ready:

```js
async function waitForDatabase({ attempts = 30, baseMs = 250, maxMs = 5_000 } = {}) {
  for (let i = 1; i <= attempts; i++) {
    try {
      await pool.query('select 1')
      return
    } catch (err) {
      if (i === attempts) throw err
      const backoff = Math.min(maxMs, baseMs * 2 ** (i - 1))
      const jitter = Math.floor(Math.random() * (backoff / 2))
      await new Promise((r) => setTimeout(r, backoff + jitter))
    }
  }
}
```

**Per request** — do not. A failed query should fail the request, quickly and
with a 503. Retrying inside a handler multiplies load on a database that is
already struggling, and turns a fast failure into a slow one. The exceptions are
narrow: an idempotent read, at most once, on a connection-level error.

Three properties that make the loop above worth copying:

- **Exponential**, so a long outage is not a busy-wait.
- **Capped**, so the delay stays useful rather than growing to minutes.
- 🔴 **Jittered**, because without it every replica retries in lockstep and the
  database is hit by a synchronised thundering herd exactly when it comes back.

## Readiness is not liveness

| | Question | Failing means |
|---|---|---|
| **Liveness** | Is the process wedged? | Restart it |
| **Readiness** | Can it serve *right now*? | Take it out of rotation, but leave it alone |

```js
app.get('/healthz', (_req, res) => res.status(200).send('ok'))   // liveness

app.get('/readyz', async (_req, res) => {                        // readiness
  try {
    await pool.query('select 1')
    res.status(200).send('ready')
  } catch {
    res.status(503).send('database unavailable')
  }
})
```

⚠️ **The container `HEALTHCHECK` should point at the liveness endpoint, not the
readiness one.** A healthcheck that fails because the *database* is down marks
every API replica unhealthy at once — one database blip becomes a stack-wide
outage, and under a supervisor that acts on health it becomes a stack-wide restart
storm. The rule from phase 8 restated: **check yourself, not your dependencies.**

## Where the restart policy fits

```yaml
    restart: unless-stopped
```

A restart policy is the backstop for the case the application cannot handle —
a genuine crash. It is **not** a reconnection strategy:

- It reacts to the process **exiting**, never to it being wedged or degraded.
- Docker's policy *"only takes effect after a container starts successfully"*,
  meaning up for at least **10 seconds** — so a container that dies during boot
  every time is a crash loop the policy will not smooth over
  ([Phase 1 · Restart policies](../../phase-1-running-containers/12-restart-policies.md)).
- 🔴 **Restart-as-reconnection is a design smell.** It works, in the sense that
  the process comes back and the second attempt succeeds, and it costs you every
  in-flight request, the connection pool, any warm cache, and the ability to
  distinguish "the database blipped" from "the code is broken".

## The order to build it

1. **Handle `pool.on('error')`.** Three lines; prevents the crash.
2. **Set `connectionTimeoutMillis`.** Prevents the hang.
3. **Retry at start-up with capped, jittered backoff.** Makes the boot robust
   without Compose.
4. **Split `/healthz` and `/readyz`.** Makes the failure visible without making it
   contagious.
5. **Then** add `depends_on: condition: service_healthy` — because it makes the
   first boot *tidy*, not because anything depends on it.

**Do it in that order and the startup gate becomes a nicety.** Do it in reverse
and you get a stack that only ever works on a clean `up`.

## Gotchas

**Symptom:** The API dies whenever the database restarts, with an unhandled error
in the logs.
**Cause:** No listener on the pool's `error` event, so an idle-client error
becomes an uncaught exception — the documentation warns this can crash the
process.
**Fix:** `pool.on('error', …)` that logs and returns. The pool removes the broken
client itself.

**Symptom:** Requests hang for minutes while the database is down.
**Cause:** `connectionTimeoutMillis` defaults to `0`, which means no timeout.
**Fix:** Set it to a few seconds and return 503. Fast failure is a feature.

**Symptom:** The database comes back and is immediately overwhelmed.
**Cause:** Every replica retried on the same fixed interval — a synchronised
herd.
**Fix:** Exponential backoff **with jitter**, and a cap. This is the whole reason
jitter exists.

**Symptom:** One database blip marks every API container unhealthy.
**Cause:** The container healthcheck tests the database instead of the process.
**Fix:** Point `HEALTHCHECK` at liveness. Keep the dependency check in a separate
readiness endpoint that your load balancer or platform reads.

## Interview questions

**★ A database restart takes your Node API down. Why, and what is the fix?**
Almost always the missing pool `error` listener. When the database goes away every
idle client emits an error through the pool's emitter, and node-postgres documents
that with no listener attached Node raises an uncaught error and can crash the
process. Adding a handler that logs and returns is the fix — the pool discards the
broken client and reconnects on demand. The handler must not call `process.exit()`,
which would reintroduce the crash it exists to prevent.

**★ Why is `depends_on: condition: service_healthy` not enough?**
Because it is evaluated once, at startup. It does nothing for a restart, a
failover or a network blip an hour later, and nothing removes an unhealthy
container from service. The application has to reconnect on its own; once it can,
the gate is a convenience that makes the first boot tidy rather than a correctness
mechanism.

**★ Where should retry live, and where should it not?**
At start-up and at the connection layer — capped exponential backoff with jitter,
so a long outage is not a busy-wait and a recovery is not a thundering herd. Not
inside request handlers: retrying there multiplies load on a database that is
already in trouble and turns a fast 503 into a slow one. A single retry on an
idempotent read after a connection-level error is the narrow exception.

**What is the difference between liveness and readiness here, and why does it
matter for `HEALTHCHECK`?**
Liveness asks whether the process is wedged — failing means restart it. Readiness
asks whether it can serve right now — failing means take it out of rotation and
leave it alone. The container healthcheck must test liveness, because a check that
queries the database marks every replica unhealthy simultaneously the moment the
database blips, converting one dependency's problem into a stack-wide one.

**Is a restart policy a reasonable way to handle a database outage?**
No, though it appears to work. It reacts only to the process exiting, it takes
effect only after the container has been up for about ten seconds, and every
restart costs in-flight requests, the pool and any warm state. It is a backstop
for genuine crashes; using it as reconnection also destroys your ability to tell a
transient dependency failure from a real bug.

---

← Prev: [The startup gate](01-the-startup-gate.md) · Index: [Waiting for the database](README.md) · Next → [Hot reload inside a container](../05-hot-reload/README.md)
