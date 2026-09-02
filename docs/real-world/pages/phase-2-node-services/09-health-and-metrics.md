---
title: "The health and metrics kit"
sidebar_label: "09 · Health & metrics"
sidebar_position: 9
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 against the Node.js v24 docs (`perf_hooks`,
> `monitorEventLoopDelay`, `process.memoryUsage`). Concept home:
> [Node — health checks](../../../nodejs/pages/phase-10-observability/10-health-checks.md),
> [event loop lag](../../../nodejs/pages/phase-10-observability/09-event-loop-lag.md),
> [structured logging](../../../nodejs/pages/phase-10-observability/01-structured-logging.md).

## The problem

Both processes need to answer three different questions asked by three
different callers: *"should you be restarted?"* (liveness — the orchestrator),
*"should you receive traffic?"* (readiness — the load balancer), and *"what
is happening in there?"* (metrics — a human or Prometheus). Conflating the
first two causes restart loops
([the concept page's core warning](../../../nodejs/pages/phase-10-observability/10-health-checks.md));
this chapter builds the kit both processes share, with the storefront's
specific signals inside.

## The design choices

**Liveness is nearly unconditional.** `GET /livez` returns 200 if the event
loop can run the handler — that is the whole test. Checking the database in
liveness means a database outage *restarts every API instance*, turning one
incident into two.

**Readiness is a state machine plus cheap, time-boxed probes.** The boot
chapter's `markReady()`/`markDraining()` gates it; when ready, it verifies
the pool answers `select 1` within a short budget. The probe timeout is
**well inside** the checker's own timeout — a hung probe must fail fast, not
accumulate.

**Metrics are a snapshot endpoint, storefront-specific.** Beyond process
vitals (event-loop delay percentiles, heap, RSS), the numbers that describe
*this app's* actual failure modes: pool saturation, cache size, outbox
depth and age, dead letters, per-job last-run times. Text-exposition
Prometheus format is a formatting concern deferred until something scrapes;
JSON serves humans and tests today.

## The implementation

```js
// src/health.js — shared by API and worker (worker skips nothing but routes)
import {monitorEventLoopDelay} from 'node:perf_hooks';

export function createHealth() {
  const loopDelay = monitorEventLoopDelay({resolution: 20});
  loopDelay.enable();
  let state = 'starting';                 // starting -> ready -> draining

  return {
    markReady() { state = 'ready'; },
    markDraining() { state = 'draining'; },

    livez() { return {ok: true}; },       // reachable = alive

    async readyz({pool}) {
      if (state !== 'ready') return {ok: false, state};
      try {
        await Promise.race([
          pool.query('select 1'),
          new Promise((_, rej) =>
            setTimeout(() => rej(new Error('probe timeout')), 1_500).unref()),
        ]);
        return {ok: true, state};
      } catch (err) {
        return {ok: false, state, err: String(err)};
      }
    },

    async metrics({pool, cache}) {
      const mem = process.memoryUsage();
      const [outbox] = (await pool.query(
        `select count(*) filter (where processed_at is null
                                   and attempts < 8)          as due,
                count(*) filter (where processed_at is null
                                   and attempts >= 8)         as dead,
                extract(epoch from now() - min(created_at))
                  filter (where processed_at is null)         as oldest_s
           from outbox`,
      )).rows;
      return {
        state,
        loop_delay_ms: {
          p50: loopDelay.percentile(50) / 1e6,
          p99: loopDelay.percentile(99) / 1e6,
          max: loopDelay.max / 1e6,
        },
        heap_used_mb: Math.round(mem.heapUsed / 1e6),
        rss_mb: Math.round(mem.rss / 1e6),
        pool: {total: pool.totalCount, idle: pool.idleCount,
               waiting: pool.waitingCount},
        cache: cache?.stats() ?? null,
        outbox: {due: outbox.due, dead: outbox.dead,
                 oldest_unprocessed_s: outbox.oldest_s},
      };
    },
  };
}
```

Phase 3 mounts `/livez`, `/readyz` and `/metrics` (the last behind the admin
gate — pool counts and queue depths are reconnaissance for an attacker);
the worker exposes the same three on a tiny plain-`node:http` listener,
because a worker without readiness still deserves observability.

## The signals that pay rent, and what they mean

| Signal | Healthy | The story when it isn't |
|---|---|---|
| `loop_delay_ms.p99` | ~resolution | Something synchronous is eating the loop — [the blocking chapter's](../../../nodejs/pages/phase-0-runtime-model/03-blocking-the-event-loop.md) whole subject |
| `pool.waiting` | 0 | Queries queueing for clients — the [data layer's](02-the-data-layer.md) exhaustion gotcha, visible *before* timeouts |
| `outbox.due` | small, bursty | Rising steadily = worker down or a dependency failing — the `pending` pile-up the [dashboard chapter](../phase-1-database/09-dashboard-queries.md) cross-checks |
| `outbox.oldest_unprocessed_s` | < 60 | The *age* alarm — depth can look small while one poisoned row ages forever |
| `outbox.dead` | 0 | A human owes a `requeue` (chapter 10) after fixing the cause |
| `cache.size` | below cap | Pinned at cap + low hit rate = crawler churn ([chapter 08](08-the-cache-layer.md)) |

## Gotchas

- **Symptom:** every instance restarts in a loop during a database outage,
  and recovery takes longer than the outage. **Cause:** liveness checks the
  database. **Fix:** the split this chapter exists for — liveness tests the
  process, readiness tests the dependencies; an instance that cannot reach
  Postgres should *wait unready*, not die.
- **Symptom:** `/readyz` hangs and the balancer marks the instance down for
  the wrong reason. **Cause:** the probe query with no budget of its own,
  during pool exhaustion — the check joined the queue it should have been
  reporting on. **Fix:** the 1.5-second race above, and `pool.waiting` in
  metrics so exhaustion is diagnosed as itself.
- **Symptom:** metrics look healthy while users see errors. **Cause:** the
  kit measures the *process*, not the *product* — nothing here counts 500s.
  **Fix:** correct scope: request/error rates belong to the request path
  (Phase 3's logging middleware feeds them); this chapter's endpoint is the
  substrate view. Knowing which layer answers which question is the skill.

## Interview questions

1. **★ Why must liveness and readiness be different checks?** They trigger
   different remedies. Liveness failure → restart: correct for a wedged
   process, catastrophic for a healthy process waiting on a down database —
   restarting it fixes nothing and adds cold starts to an outage. Readiness
   failure → stop routing: correct for both. Conflate them and every
   dependency outage becomes a fleet-wide restart storm.
2. **★ Why does the readiness probe need its own timeout when the caller
   has one?** The caller's timeout marks the instance down without saying
   why; the probe's own budget converts "hung" into a fast, attributed
   failure (`probe timeout`), keeps the handler from stacking hung probes,
   and — with `pool.waiting` — distinguishes "database slow" from "pool
   exhausted", which have different fixes.
3. **Why is `oldest_unprocessed_s` a better outbox alarm than queue depth?**
   Depth is load-dependent — 200 due rows during a sale is normal, 5 rows
   from yesterday is an incident. Age measures the *contract* (side-effects
   happen promptly) rather than the workload, so its threshold survives
   traffic growth without retuning.
4. **Why gate `/metrics` behind auth when Prometheus needs to scrape it?**
   The numbers describe internal capacity and queue states — useful for
   tuning an attack. The scraper gets credentials or a network-level
   allowance; "metrics are public because scraping is convenient" is how
   internal topology leaks. (Liveness/readiness stay open: they return a
   bit, not a map.)

---

← Prev: [The cache layer](08-the-cache-layer.md) ·
Next → [The ops CLI](10-the-ops-cli.md)
