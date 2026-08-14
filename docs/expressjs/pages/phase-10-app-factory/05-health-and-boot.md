---
title: "Health checks and boot order"
sidebar_label: "05 · Health · boot"
sidebar_position: 5
---

<span className="db-tier t-understand">Understand</span>

**Liveness is cheap. Readiness checks pool/redis. Boot: validate env → connect deps → createApp → listen → ready.**

> Verified: 2026-08-14 — **no sandbox run**. Health endpoints are ordinary routes; Express
> has no probe support. The one Express-level detail that matters is placement: probes
> must sit **above** the rate limiter and outside authentication, which is a mount-order
> consequence of middleware executing *"in the order they are defined"*
> ([using middleware](https://expressjs.com/en/guide/using-middleware.html)) — see
> [Phase 9](../phase-9-hardening/04-rate-limiting.md).
> `app.listen()` returns an `http.Server`
> ([application reference](https://expressjs.com/en/5x/api/application/)), which is the
> object the boot sequence and [page 06](06-shutdown-and-entrypoint.md) hold on to.
> Probe semantics, container PID 1 and signal handling are
> [Node Phases 10–11](../../../nodejs/pages/phase-11-deployment/README.md); the
> liveness/readiness distinction itself is Kubernetes-shaped and documented there.

```text
validate env → connect pool → createApp(deps) → server.listen → signal ready
```

Cross-link Node Phases 10–11 for probe semantics and container PID 1.

## The two probes answer different questions

Conflating them is the mistake, and the consequence is severe enough to state
plainly.

| | **Liveness** | **Readiness** |
|---|---|---|
| Asks | "Is this process broken?" | "Should I send it traffic?" |
| Checks | Nothing — the event loop answered, that is the check | Pool, cache, migrations, warm-up |
| On failure | **The process is killed and restarted** | Traffic is withheld; the process lives |
| Dependency down | **Must still pass** | Should fail |

```js
app.get('/health', (req, res) => res.sendStatus(200));      // liveness: cheap, always

app.get('/ready', async (req, res) => {                     // readiness: real checks
  const checks = await Promise.allSettled([
    pool.query('SELECT 1'),
    redis.ping(),
  ]);
  const ok = checks.every((c) => c.status === 'fulfilled');
  res.status(ok ? 200 : 503).json({ok, checks: summarise(checks)});
});
```

**🔴 A liveness probe that checks the database is a distributed outage generator.**
The database blips, liveness fails on every instance simultaneously, the
orchestrator kills them all, they restart into the same struggling database, and
the restart storm prevents recovery. Liveness must answer "my event loop is
responsive" and nothing more — which also means it must be **above the rate
limiter**, or a traffic spike restarts your fleet
([Phase 9](../phase-9-hardening/04-rate-limiting.md)).

Readiness failing is safe and useful: the instance stops receiving traffic,
recovers, and rejoins. That is the probe allowed to have an opinion about
dependencies.

## Boot order, and why every step is where it is

```js
const config = loadConfig();               // 1. validate env — fail before anything else
const pool   = await createPool(config);   // 2. connect dependencies
const app    = createApp({pool, config});  // 3. build the app (pure)
const server = app.listen(config.port);    // 4. accept traffic
ready = true;                              // 5. only now does /ready return 200
```

Each ordering has a failure it prevents:

1. **Config first** — a missing secret stops the deploy rather than producing 500s
   an hour later ([Phase 9](../phase-9-hardening/06-timeouts-and-secrets.md)).
2. **Connect before building** — the factory receives clients, not promises of them.
3. **Build before listening** — no request can arrive before the routes exist.
4. **Listen before ready** — the port must be open for the probe to be answerable.
5. **Ready last** — this is the flag that admits traffic.

The subtle one is 4-versus-5. **Listening and being ready are different events.**
An instance that is listening but not warmed up will accept requests and fail them
if `/ready` already returns 200. Keep a `ready` flag that flips after warm-up, and
let readiness report it.

**Fail the boot loudly.** A process that cannot reach its database at startup
should exit non-zero, not start and serve errors — a crash-looping container is a
visible, actionable signal; a running container serving 500s looks healthy on every
dashboard except the one nobody is watching.

## Trade-off

Deep readiness checks give an accurate answer and cost a query per probe, every few
seconds, per instance — which is real load on the very dependency you are checking.
They also propagate failure: one struggling replica marks every instance unready and
takes the whole service out of rotation, when partial capacity would have been better
than none.

Shallow checks are cheap and can lie — traffic keeps arriving at an instance that
cannot serve it.

The workable middle: **check dependencies you cannot function without, cache the
result for a few seconds, and give the check its own short timeout** so a slow
dependency produces a fast negative rather than a hanging probe.

## Gotchas

**Symptom:** A brief database outage restarts every instance and prevents recovery  
**Cause:** Liveness checking the database  
**Fix:** Liveness checks nothing. Dependencies belong in readiness

**Symptom:** Probes start failing under load and the orchestrator restarts pods  
**Cause:** Health endpoints below the rate limiter  
**Fix:** Mount them above it, and exclude them explicitly

**Symptom:** Requests arrive before the app can serve them  
**Cause:** `/ready` returning 200 as soon as the port is open  
**Fix:** A `ready` flag flipped after warm-up; listening and readiness are separate events

**Symptom:** The container starts, then serves 500s for every request  
**Cause:** A dependency failure swallowed at boot  
**Fix:** Exit non-zero. Crash-looping is a visible signal; running and broken is not

**Symptom:** The readiness endpoint hangs during an incident  
**Cause:** No timeout on the dependency check  
**Fix:** Give the check its own short timeout — a fast 503 beats a hanging probe

**Symptom:** Health checks are a measurable share of database load  
**Cause:** Deep checks every couple of seconds across many instances  
**Fix:** Cache the result briefly; probes do not need per-request freshness

## Interview questions

**★ Why split liveness and readiness?**  
Failing readiness stops new traffic; failing liveness restarts the process — conflating them causes restart storms.

**★ What exactly goes wrong if liveness checks the database?**  
A database blip fails liveness on every instance at once, the orchestrator kills them
all, and they restart into the same struggling database — a restart storm that prevents
recovery. Liveness answers "is my event loop responsive?" and nothing else.

**★ Why must listening and readiness be separate events?**  
Because the port opens before the process is warm. If readiness returns 200 the moment
`listen` succeeds, traffic arrives at an instance that cannot serve it yet. Flip a
`ready` flag after warm-up.

**What is the correct boot order and what does each step prevent?**  
Validate config (a missing secret fails the deploy, not the first login) → connect
dependencies (the factory gets clients, not promises) → build the app (routes exist
before requests) → listen → mark ready.

**Should a container that cannot reach its database start?**  
No — exit non-zero. A crash-looping container is a visible, actionable signal; one that
starts and serves 500s looks healthy on every dashboard.

**Why cache readiness results?**  
Because a deep check runs every few seconds on every instance, and that is real load on
the dependency you are testing. A few seconds of staleness costs nothing.


---

← Prev: [Auth in tests](04-auth-in-tests.md) · Next → [Shutdown and entrypoint](06-shutdown-and-entrypoint.md)
