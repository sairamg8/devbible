---
title: "Part 4 — Redis in production"
sidebar_label: "4 · Production"
sidebar_position: 4
---

> Phases 9–10 · Memory, durability, and the operational surface

Redis holds your data in RAM. Every production question reduces to two: **what
happens when memory runs out**, and **what happens when the process dies**. Know
both answers before you put anything in it that you would miss.

---

## Phase 9 — Memory, eviction and persistence

| Topic | Tier |
|---|---|
| **`maxmemory` and eviction policies** — `noeviction`, `allkeys-lru`, `volatile-lru`, `allkeys-lfu` and friends; the default is not what you want | <span className="db-tier t-master">Master</span> |
| **`noeviction` means writes start failing** — the failure mode of an unconfigured cache under pressure | <span className="db-tier t-master">Master</span> |
| **Eviction is not expiry** — two different mechanisms, and why a key with no TTL can vanish under `allkeys-lru` | <span className="db-tier t-understand">Understand</span> |
| **Where the memory actually goes** — per-key overhead, encodings (listpack vs hashtable), and why a million tiny keys costs more than you estimated | <span className="db-tier t-understand">Understand</span> |
| **RDB vs AOF** — snapshotting versus the append log, `appendfsync` settings, and the honest durability guarantee of each | <span className="db-tier t-understand">Understand</span> |
| **What Redis may hold**, given that guarantee — cache and derived state yes; the only copy of anything, no | <span className="db-tier t-master">Master</span> |
| Fork, copy-on-write and the memory spike during a save — why your instance needs headroom | <span className="db-tier t-know">Know</span> |

**Gate — move on when:** you can state your instance's eviction policy, what it
does when full, and which of your keys would survive a restart.

---

## Phase 10 — Operations

The surface a fullstack developer needs. Deep cluster administration is not in
this bible's brief — knowing what breaks when you scale is.

| Topic | Tier |
|---|---|
| **Replication** — async by default, what a replica lags behind by, and why reading from one can return stale data | <span className="db-tier t-understand">Understand</span> |
| **Sentinel and failover** — what promotes a replica, and what your client must do about it | <span className="db-tier t-know">Know</span> |
| **Cluster mode and hash slots** — the constraint that matters daily: **multi-key commands need the same slot**, and hash tags (`{user:1}`) are how you get it | <span className="db-tier t-understand">Understand</span> |
| **What breaks in cluster mode** — `MGET` across slots, `MULTI` across slots, numbered databases, `KEYS` | <span className="db-tier t-understand">Understand</span> |
| **Security** — Redis must never be internet-reachable; ACLs, `requirepass`, TLS, and renaming dangerous commands | <span className="db-tier t-master">Master</span> |
| **Observability** — the `INFO` fields worth alerting on: memory, evicted keys, hit rate, blocked clients, replication lag | <span className="db-tier t-understand">Understand</span> |
| Managed Redis — what a provider takes over, what it does not, and the licence question behind the forks | <span className="db-tier t-know">Know</span> |

**Gate — deliverable:** given an application using Redis for cache, sessions and
rate limits, you can say which parts survive a failover, which return stale data,
and which break the day the instance becomes a cluster.

---

## Counts

| Tier | Count |
|---|---|
| <span className="db-tier t-master">Master</span> | 24 |
| <span className="db-tier t-understand">Understand</span> | 34 |
| <span className="db-tier t-know">Know</span> | 16 |
| **Total** | **74** |

---

## Where this connects

| From | To |
|---|---|
| Phase 6 — the client | **Node Phase 6** — connection lifecycle, injection, pooling reasoning |
| Phase 8 — queues | **Node Phase 7** — jobs, outbox, idempotency, worker shutdown |
| Phase 8 — sessions and denylists | **Express Phase 8** — cookie/session wire-up, revocation surface |
| Phase 8 — rate limiting | **Express Phase 9** — why per-process counters are wrong |
| Phase 8 — idempotency keys | **Express Phase 6** — the atomic claim and the race it closes |
| Phase 9 — durability | **PostgreSQL** — the system of record Redis is *not* |

### Deliberately not here

| Topic | Why |
|---|---|
| Redis Search, JSON, time series, vector sets | Real, and out of this bible's fullstack brief — knowing they exist is Phase 0 |
| Lua scripting beyond the unlock script | One script earns its place; scripting as a subject does not |
| Cluster administration, resharding, migration | Infrastructure track, not application development |
| Building a queue by hand | Node Phase 7 uses BullMQ; reinventing it is a lesson in why not to |

---

← Prev: [Part 3 — From Node](03-from-node.md) · Index: [Redis](../README.md)
