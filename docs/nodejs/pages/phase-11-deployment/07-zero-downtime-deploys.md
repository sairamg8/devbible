---
title: "Zero-downtime deploys — rolling restarts, drain, readiness"
sidebar_label: "07 · Zero-downtime deploys"
sidebar_position: 7
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08. Orchestrator behaviour as implemented by Kubernetes-style rolling
> updates; Node side is readiness + graceful shutdown on **Node 24**.

**Zero downtime means new pods take traffic before old pods die, and old pods stop
receiving work before they exit. Readiness gates and SIGTERM drain are the Node half;
the platform half is maxUnavailable / maxSurge.**

## Rolling update (happy path)

1. Start new pod, run container  
2. Wait until **readiness** passes  
3. Add to Service endpoints  
4. Mark old pod not ready / send `SIGTERM`  
5. Old pod drains in-flight requests  
6. Old pod exits; removed  

If step 2 is wrong (ready too early), users hit 500s during the rollout
([page 02](./02-boot-sequence.md),
[Phase 10 health](../phase-10-observability/10-health-checks.md)).

## Node responsibilities

| Hook | Action |
|---|---|
| Boot | Ready only when deps + listen are good |
| `SIGTERM` | Ready false immediately; close server with timeout |
| In-flight | Finish or abort within grace period |
| Workers | Finish current job; do not claim new ones |

```js
// sketch — HTTP drain
process.on('SIGTERM', async () => {
  markNotReady();
  await new Promise((resolve) => server.close(resolve)); // stops new conns
  await pool.end();
  process.exit(0);
});
```

Keep-alive connections can hold `server.close` open — set headers/timeouts and track
open sockets if drain hangs
([Phase 5](../phase-5-http-processes/17-graceful-shutdown.md)).

## Platform knobs that matter

| Knob | Effect |
|---|---|
| `terminationGracePeriodSeconds` | How long SIGTERM has before SIGKILL |
| `maxUnavailable` / `maxSurge` | How many pods change at once |
| readiness `periodSeconds` / failures | How fast a bad pod is cut from traffic |
| preStop sleep | Extra delay after not-ready for slow LBs |

A 5s preStop sleep is a blunt tool for "LB still routing"; fix readiness first.

## Schema migrations

Zero-downtime **code** deploys still break if migrations are incompatible. Prefer
expand/contract:

1. Migrate forward compatible (add column nullable)  
2. Deploy code that writes both / reads new  
3. Backfill  
4. Remove old path later  

That is a Phase 6 concern; deploy tooling must order migrate-before or migrate-with
care.

## Gotchas

**Symptom:** Brief 502s every deploy
**Cause:** Pod removed before drain; or ready while still warming
**Fix:** Readiness + longer grace; fix boot order

**Symptom:** Deploy hangs
**Cause:** `server.close` waits forever on keep-alive
**Fix:** Track connections; destroy idle sockets after timeout

**Symptom:** Duplicate side effects every release
**Cause:** Workers killed mid-job without ack
**Fix:** Worker graceful close + idempotent jobs

**Symptom:** Only half the fleet on new code, stuck
**Cause:** New pods fail readiness (config, migrate)
**Fix:** Alert on rollout progress; fix before old pods expire

## Interview questions

**★ What does the app must do for a zero-downtime rolling deploy?**
Pass readiness only when truly ready; on SIGTERM fail readiness and drain before exit.

**Why is readiness not the same as liveness here?**
Failing readiness removes traffic without killing the pod mid-drain; liveness restarts.

**What platform setting bounds drain time?**
`terminationGracePeriodSeconds` (or equivalent) before SIGKILL.

**How do DB migrations interact with rolling deploys?**
Old and new code may run together — migrations must be compatible with both briefly.

**What is maxSurge for?**
Allowing extra new pods during rollout so capacity does not dip.

---

← Prev: [Reverse proxy](./06-reverse-proxy.md) · Next → [CI/CD](./08-cicd.md)
