---
title: "Serverless Node — cold starts, connection reuse, pooling"
sidebar_label: "14 · Serverless Node"
sidebar_position: 14
---

<span className="db-tier t-when">When Needed</span>

> Verified: 2026-08. Platform-agnostic constraints for Node on Lambda-style runtimes;
> pin provider docs when you implement.

**Serverless runs your handler in a short-lived isolate that may freeze between
invocations. Cold starts, connection limits, and "global" state that is not actually
per-request are the failure modes — not Express vs raw handlers.**

## Cold start

First invocation (or after scale-to-zero) pays:

- Runtime init  
- Your module graph import  
- First connection to DB/Redis  

Mitigations: smaller packages, lazy import of rare paths
([Phase 10 startup](../phase-10-observability/23-startup-time.md)), provisioned
concurrency where the bill allows, keep critical deps light.

## Connection reuse (and the trap)

```js
// pseudo-code — module scope may survive across warm invocations
let pool;

export async function handler(event) {
  if (!pool) pool = createPool(process.env.DATABASE_URL);
  const client = await pool.connect();
  try {
    return await work(client, event);
  } finally {
    client.release();
  }
}
```

**Warm reuse** is good. **Hundreds of concurrent isolates × pool size** exhausts
Postgres. Prefer:

- Serverless-friendly proxies (RDS Proxy, PgBouncer)  
- Tiny max pool per isolate (often 1)  
- Or HTTP data APIs that multiplex server-side  

## What not to assume

| Assumption | Reality |
|---|---|
| Process lives forever | Freezes / dies without SIGTERM you control |
| Background `setInterval` keeps running | May pause mid-tick |
| Write to local disk persists | Ephemeral |
| One global cache is shared fleet-wide | Per-isolate only |

Long work belongs on a **queue + worker**, not a 15-minute handler hope
([Phase 7](../phase-7-background-work/01-sync-vs-background.md)).

## Gotchas

**Symptom:** Intermittent `too many connections`
**Cause:** Pool per warm container × scale-out
**Fix:** Cap pool at 1; use a proxy; reduce concurrency

**Symptom:** Handler timeout on first request only
**Cause:** Cold start + DB connect inside the request budget
**Fix:** Shrink package; provisioned concurrency; connect strategy

**Symptom:** "Memory leak" across invocations
**Cause:** Global arrays caching every event
**Fix:** Bound caches; treat module scope as carefully as a long-lived process

**Symptom:** Scheduled work fires twice
**Cause:** At-least-once invocation + non-idempotent handler
**Fix:** Idempotency keys ([Phase 7](../phase-7-background-work/05-job-idempotency.md))

## Interview questions

**★ What is a cold start?**
A new isolate loading the runtime and your code before the first request runs — extra
latency.

**Why is connection pooling harder on Lambda-style platforms?**
Many concurrent isolates each open pools; databases see connection storms.

**Can you rely on setInterval for background work in serverless?**
No — the freeze model does not guarantee timers; use platform schedules or queues.

**How do you share a cache across all invocations?**
External store (Redis); module scope is only per warm isolate.

**When is serverless the wrong default for a Node API?**
Long-lived WebSockets, heavy steady CPU, or DB-heavy work without a pool proxy.

---

← Prev: [Blue/green and canary](./13-blue-green-canary.md) · Phase index: [Deployment and operations](./README.md)
