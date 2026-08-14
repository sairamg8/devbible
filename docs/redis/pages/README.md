---
title: "Redis — Pages"
sidebar_label: "Overview"
sidebar_position: 0
---

:::info 🔒 Claimed — session `8679dc8c`, 2026-08-14

All of `docs/redis/` is claimed. Picked up on finishing
[Express](../../expressjs/pages/README.md), which — together with
[Node](../../nodejs/pages/README.md) — defers to this track on **39 pages**.

**State: syllabus complete (11 phases, 74 topics), no explanation pages yet.**
Next unit: **Phase 0 · How Redis runs (6 topics)**.

Documentation-validated against the Redis docs under the no-new-sandboxes rule:
every claim names its source in a `> Verified:` line, and **no console block is
added unless a run actually produced it**.

:::

> **Target: Redis Open Source 8.x** — 8.10 is current as of August 2026, and the
> 8.x line ships fast. Pages name the version a behaviour was confirmed on rather
> than assuming yours matches.

The explanations behind the [Redis syllabus](../README.md).

import Progress from '@site/src/components/Progress';

<Progress lang="redis" />

## What each phase will cover

| Phase | Covers |
|---|---|
| **0 — How Redis runs** | In-memory data-structure server, single-threaded execution, O(N) commands, RESP, durability |
| **1 — Keys, expiry, keyspace** | Key naming as schema, TTL, how expiry really happens, `SCAN` over `KEYS`, `UNLINK` |
| **2 — `redis-cli`, mastered** | `MONITOR`, `SLOWLOG`, `INFO`, `--bigkeys`/`--hotkeys`, `OBJECT ENCODING` |
| **3 — Strings, numbers, bitmaps** | `SET` options, atomic counters, `GETEX`/`GETDEL`, `MGET`, bitmaps |
| **4 — Hashes, lists, sets, sorted sets** | The four workhorses, per-field TTL, blocking list ops, sorted sets as tools |
| **5 — Streams** | `XADD`, consumer groups, the pending entries list, trimming, streams vs pub/sub |
| **6 — The Node client** | `node-redis` vs `ioredis`, injection, reconnection, error events, pipelining vs `MULTI` |
| **7 — Caching, properly** | Cache-aside, invalidation, stampede, penetration, what must never be cached |
| **8 — Sessions, limits, locks, queues** | Session stores, denylists, rate limiters, distributed locks, idempotency keys |
| **9 — Memory and persistence** | `maxmemory`, eviction policies, encodings, RDB vs AOF, what Redis may hold |
| **10 — Operations** | Replication lag, Sentinel, cluster hash slots, security, the `INFO` fields worth alerting on |

The inventory these follow starts at
[Part 1 — How Redis works](../syllabus/01-how-redis-works.md).
