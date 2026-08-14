---
title: "Part 3 — Redis from Node"
sidebar_label: "3 · From Node"
sidebar_position: 3
---

> Phases 6–8 · The client, caching, and the four patterns you will actually build

This is the part the rest of the bible has been pointing at. **Node Phase 6**
sends you here for the client, **Node Phase 7** for queues and idempotency,
**Express Phase 8** for session stores, and **Express Phase 9** for a rate
limiter that survives more than one process.

---

## Phase 6 — The Node client, end to end

| Topic | Tier |
|---|---|
| **`node-redis` vs `ioredis`** — the honest comparison and how to choose; both are current | <span className="db-tier t-understand">Understand</span> |
| **Connecting once, injecting the client** — a module-level connection is the same import-time trap as a database pool (Express Phase 7) | <span className="db-tier t-master">Master</span> |
| **Reconnection and command buffering** — what the client does while disconnected, and why that can hide an outage | <span className="db-tier t-master">Master</span> |
| **Errors that must not crash the process** — the `error` event, and why an unhandled one takes the app down | <span className="db-tier t-master">Master</span> |
| **Pipelining and `MULTI`** — round trips versus atomicity; they are not the same thing | <span className="db-tier t-understand">Understand</span> |
| Timeouts and retries — command timeouts, and why a retried non-idempotent command is a bug | <span className="db-tier t-understand">Understand</span> |
| Graceful shutdown — `quit` versus `disconnect`, and closing after in-flight work (Express Phase 10) | <span className="db-tier t-know">Know</span> |

---

## Phase 7 — Caching, properly

The reason most teams install Redis, and the part they get subtly wrong.

| Topic | Tier |
|---|---|
| **Cache-aside** — read-through in application code, and why it is the default | <span className="db-tier t-master">Master</span> |
| **Invalidation** — write-through, delete-on-write, and why TTL alone is a bet, not a strategy | <span className="db-tier t-master">Master</span> |
| **What must never be cached** — authorisation decisions, and anything whose staleness is a security bug | <span className="db-tier t-master">Master</span> |
| **Stampede / thundering herd** — what happens when a hot key expires under load; locks, early recompute, jitter | <span className="db-tier t-understand">Understand</span> |
| **Cache penetration** — repeated misses for keys that do not exist, and negative caching | <span className="db-tier t-understand">Understand</span> |
| Key design and versioning — namespacing, and changing a cached shape without a flush | <span className="db-tier t-understand">Understand</span> |
| Measuring — hit rate, and why a 99% hit rate can still be a bad cache | <span className="db-tier t-understand">Understand</span> |
| **When not to cache** — the query that was fast, the data that changes every request, the correctness you traded for 2 ms | <span className="db-tier t-know">Know</span> |

**Gate — move on when:** you can explain what happens to your database the moment
a popular cached key expires, and how your design prevents it.

---

## Phase 8 — Sessions, rate limits, locks and queues

The four patterns the Node and Express tracks defer to this one.

| Topic | Tier |
|---|---|
| **Session store** — `connect-redis` wire-up, key shape, TTL and touch behaviour (Express Phase 8) | <span className="db-tier t-understand">Understand</span> |
| **Revocation and denylists** — the JWT logout problem, and why it reintroduces the state a token avoided | <span className="db-tier t-understand">Understand</span> |
| **Rate limiting** — fixed window with `INCR` + `EXPIRE`, sliding window with a sorted set, token bucket; the trade-offs | <span className="db-tier t-master">Master</span> |
| **Why the limiter must be shared** — per-process counters multiply by instance count (Express Phase 9) | <span className="db-tier t-master">Master</span> |
| **Distributed locks** — `SET key val NX PX`, the unlock-with-Lua requirement, and why a lock without a fencing token is not safe | <span className="db-tier t-understand">Understand</span> |
| **Redlock, honestly** — what it claims, what the criticism is, and when you should not be using Redis for this at all | <span className="db-tier t-know">Know</span> |
| **Idempotency-key storage** — the atomic claim from Express Phase 6, implemented on Redis | <span className="db-tier t-understand">Understand</span> |
| Queues — BullMQ as the answer, and what it is doing underneath (Node Phase 7) | <span className="db-tier t-know">Know</span> |

**Gate — deliverable:** a rate limiter correct across three instances, and a lock
you can explain the failure modes of without hand-waving.

---

← Prev: [Part 2 — Data types](02-data-types.md) · Next → [Part 4 — Production](04-production.md)
