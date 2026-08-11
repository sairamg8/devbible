---
title: "Health checks — liveness vs readiness"
sidebar_label: "10 · Health checks"
sidebar_position: 10
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 on **Node 24.19.0**. Behaviour below is the contract your
> orchestrator enforces; the code patterns run on this runtime.

**Liveness answers "should this process be killed?" Readiness answers "should this
process receive traffic?" Conflating them is how a temporary dependency blip becomes
a restart storm.**

Kubernetes (and most mesh / load-balancer health systems) will restart a pod that
fails liveness. They will only remove a pod from the service endpoints when readiness
fails. Those are different failure modes and need different endpoints.

## Two endpoints, two meanings

| Probe | Question | On failure | Must depend on |
|---|---|---|---|
| **Liveness** | Is the process hopelessly stuck? | Restart the container | Almost nothing — process up, loop alive |
| **Readiness** | Can I serve *this* request successfully? | Stop sending traffic | DB pool, required caches, "accepted traffic" flag |
| **Startup** (optional) | Has boot finished? | Wait; do not kill yet | Same as readiness, but only during boot |

```js
// health.mjs — minimal shape; wire into node:http or your framework
import http from 'node:http';
import {monitorEventLoopDelay} from 'node:perf_hooks';

const lag = monitorEventLoopDelay({resolution: 10});
lag.enable();

let acceptingTraffic = false;
let pool; // set after connect

export function markReady(dbPool) {
  pool = dbPool;
  acceptingTraffic = true;
}

export function markDraining() {
  acceptingTraffic = false; // deploy / SIGTERM — see Phase 7 graceful shutdown
}

const server = http.createServer(async (req, res) => {
  if (req.url === '/healthz/live') {
    const maxMs = lag.max / 1e6;
    // stuck event loop → fail liveness so the orchestrator restarts us
    if (maxMs > 5000) {
      res.writeHead(503).end('loop stalled');
      return;
    }
    res.writeHead(200).end('ok');
    return;
  }

  if (req.url === '/healthz/ready') {
    if (!acceptingTraffic) {
      res.writeHead(503).end('not accepting');
      return;
    }
    try {
      await pool.query('select 1');
      res.writeHead(200).end('ready');
    } catch {
      res.writeHead(503).end('db down');
    }
    return;
  }

  res.writeHead(404).end();
});
```

**Liveness stays dumb on purpose.** If `/live` checks the database and the database
blips, every pod restarts at once — thundering herd on the DB, longer outage, worse
than serving 503s until it recovers.

**Readiness is allowed to be strict.** A pod that cannot reach Postgres should not
get checkout traffic. Failing readiness is temporary and reversible without a kill.

## Boot order and probes

Accept traffic only after dependencies exist:

1. Validate config  
2. Connect pools  
3. `listen`  
4. **Then** flip readiness true  

If readiness is true before the pool exists, the first requests fail for a reason
health already "passed". Phase 11's boot sequence page owns the full ritual; this
page owns why the probe split matters.

## Drain on shutdown

On `SIGTERM`: set readiness false → wait for in-flight requests → close server →
exit. The load balancer stops new traffic because readiness failed, not because the
process vanished mid-request ([Phase 7](../phase-7-background-work/11-graceful-shutdown.md)).

## Gotchas

**Symptom:** Restart loop whenever Postgres flaps
**Cause:** Liveness checks the database
**Fix:** Move dependency checks to readiness only

**Symptom:** Pod receives traffic before it can serve
**Cause:** Readiness true at process start, not after `listen` + pool connect
**Fix:** Gate on an explicit `acceptingTraffic` flag set at the end of boot

**Symptom:** Deploy drops in-flight requests
**Cause:** No readiness drain; process exits while still in the endpoints list
**Fix:** Fail readiness first, sleep for `terminationGracePeriod`, then exit

**Symptom:** Liveness never fails but the process is wedged
**Cause:** Health handler shares a blocked event loop and never runs — or the probe
  is too generous
**Fix:** Separate concerns carefully; extreme lag can still fail live (threshold
  high); prefer external watchdog metrics too (page 09)

**Symptom:** Cascading failure when one dependency is slow
**Cause:** Readiness does a full user-path query with a long timeout
**Fix:** Cheap checks (`select 1`) with short timeouts; deep checks as separate metrics

## Interview questions

**★ Liveness vs readiness in one sentence each?**
Liveness: kill me if I am stuck. Readiness: stop sending me traffic if I cannot serve.

**★ Why must the database check not live on the liveness probe?**
A dependency outage would restart every pod, amplifying load and extending the outage.
Readiness removes traffic without destroying process state.

**What should happen on SIGTERM before the process exits?**
Fail readiness, drain connections, then exit — so the balancer stops new work first.

**Can a single `/health` endpoint ever be enough?**
Only for toy deploys. The moment you have rolling restarts or a dependency, one
endpoint forces you to choose between restart storms and serving on a broken pod.

**How does event loop lag relate to health?**
Severe sustained lag can justify failing liveness (process is not making progress).
Ordinary dependency latency should not.

---

← Prev: Event loop lag · Next → Golden signals
