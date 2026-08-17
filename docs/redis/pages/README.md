---
title: "Redis — Pages"
sidebar_label: "Overview"
sidebar_position: 0
---

:::info 🔒 SPLIT THREE WAYS — chunks A, B and C, 2026-08-17

Redis is written by **three sessions in parallel**, one chunk each, **whole phases
only** — so no two ever write in the same phase directory or the same phase
`README.md`.

| Chunk | Phases | Topics | Start at | Claimed by |
|---|---|---|---|---|
| **A** | **0, 1, 2, 3** | **23** | 🚧 **1 written** — next: Phase 0 · 02 · Single-threaded execution | session `3bb1face`, 2026-08-17 |
| **B** | **4, 5, 6** | **21** | Phase 4 · 01 · Hashes | — unclaimed |
| **C** | **7, 8, 9, 10** | **30** | Phase 7 · 01 · Cache-aside | — unclaimed |

**A phase number settles which chunk you are:** 0/1/2/3 → A · 4/5/6 → B ·
7/8/9/10 → C.

**State: 1 of 74 topics written** — chunk A opened phase 0 on 2026-08-17.
Chunks B and C have not started.

⛔ **Cross-chunk links break the build.** Where a page needs a topic another chunk
owns, write it as **bold plain text with *(not written yet)*** until the target
exists on disk. Never `git add -A`; the single `redis` row in
`src/data/progress.js` is incremented by all three chunks, so re-read it before
editing and take the higher number if it moved.

Documentation-validated against the Redis docs under the no-new-sandboxes rule:
every claim names its source in a `> Verified:` line, and **no console block is
added unless a run actually produced it** — there is no Redis server on this
machine, so there never can be.

🔴 **The 300-line cap is a file-size rule, never a content budget.** Write the
topic to its full depth first — every gotcha, pitfall, example and interview
question it actually has — then split on concept boundaries into `NN-topic/`
chunks so no file passes 300.

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
| 🚧 **[0 — How Redis runs](./phase-0-how-redis-runs/README.md)** — **1/6** | In-memory data-structure server, single-threaded execution, O(N) commands, RESP, durability |
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
