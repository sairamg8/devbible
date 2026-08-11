---
title: "Scaling — vertical vs horizontal, cluster vs replicas"
sidebar_label: "11 · Scaling"
sidebar_position: 11
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-08. Scaling rules for Node's single-threaded event loop model on
> **Node 24**; cluster measured behaviour lives in Phase 5.

**Vertical scaling buys one process more CPU/RAM. Horizontal scaling buys more
processes. Node is single-threaded for JS — one process uses one core well for
concurrent I/O, not eight cores, unless you add processes.**

## Vertical first questions

| Symptom | Vertical helps? |
|---|---|
| CPU pegged on one core, lag high | Maybe — or you need another process / less sync work |
| RSS near limit, no leak | Larger memory limit / heap flag |
| Downstream DB saturated | **No** — scale the dependency or cut queries |
| Idle CPU, high latency | **No** — I/O / timeouts ([Phase 10](../phase-10-observability/15-finding-the-bottleneck.md)) |

Raising `--max-old-space-size` without fixing a leak only delays OOM
([Phase 10 GC](../phase-10-observability/21-gc-basics.md)).

## Horizontal replicas

Multiple pods behind a load balancer:

- More aggregate event-loop capacity  
- Need **stateless** request handling or shared session store  
- Connection pools multiply — watch DB `max_connections`  
  ([Phase 6](../phase-6-data-access/01-connection-pooling.md))  

## cluster vs more pods

| Approach | Where workers live | Prefer when |
|---|---|---|
| **`node:cluster`** | Same machine | One VM, many cores, no orchestrator |
| **More replicas** | Across the fleet | Kubernetes/ECS already schedules |

Inside K8s, **prefer replicas** (or a Deployment scale) over nesting `cluster` in each
pod — you already pay for scheduling and health checks. Cluster mode still matters on
single large VMs ([Phase 5](../phase-5-http-processes/23-cluster.md)).

Sticky sessions: if you need them, prefer shared stores over sticky LB when you can —
stickiness complicates drain and scale-in.

## Autoscale signals

Scale on **saturation and lag**, not only CPU:

- Event loop lag max/p99  
- Request concurrency / queue depth  
- Pool wait time  

CPU-only HPA misses I/O-bound APIs that are "slow but idle CPU".

## Gotchas

**Symptom:** Scaled to 10 pods, database falls over
**Cause:** 10 × pool size connections
**Fix:** Right-size pools; PgBouncer; shared limits

**Symptom:** cluster workers on one pod, still one replica
**Cause:** Confused vertical packing with horizontal HA
**Fix:** Replicas across nodes for failure domains

**Symptom:** In-memory sessions disappear on scale-out
**Cause:** Process-local state
**Fix:** Redis/session store ([Phase 8 sessions](../phase-8-security/02-sessions-vs-jwt.md))

## Interview questions

**★ Why does one Node process not use all 8 cores for JS?**
One main thread runs JS; libuv handles I/O. Extra cores need more processes or workers.

**When do you choose cluster over more Kubernetes replicas?**
When packing cores on a single VM without an orchestrator; not usually inside each pod.

**What breaks when you scale horizontally without thinking?**
Session affinity, in-memory caches, and database connection counts.

**What metric should autoscale a Node API?**
Lag/saturation and request load — not CPU alone for I/O-bound services.

**Vertical vs horizontal in one line?**
Bigger machine vs more machines; Node often needs more processes either way for multi-core.

---

← Prev: [Process managers](./10-process-managers.md) · Next → [Semantic release](./12-semantic-release.md)
