---
title: "Redis — Syllabus"
sidebar_label: "Overview"
sidebar_position: 0
---

> Verified: 2026-08-14 against [redis.io's release index](https://redis.io/docs/latest/develop/whats-new/)
> and the npm registry. **No sandbox run** — this is an inventory, not an explanation.

The topic inventory for Redis, scoped to **what a fullstack MERN/PERN developer
actually needs**. 11 phases, 74 topics, split into 4 parts.

This track exists because the rest of the bible keeps deferring to it. Node and
Express between them reference Redis on **39 pages** — session stores, shared
rate-limiter state, JWT denylists, idempotency-key storage, job queues — and each
time they say the mechanism belongs here.

## Version facts

| | |
|---|---|
| Latest Redis Open Source | **8.10** (Q3 2026), following 8.8 (Q2 2026) and 8.6 / 8.4 (Q1 2026) |
| What Redis 8 absorbed | Search, JSON, time series, and the probabilistic types — the separate modules are no longer needed |
| Node clients | **`node-redis` 6.2.1** · **`ioredis` 6.0.0** (both checked on npm, 2026-08-14) |
| Build against | Whatever your managed provider runs — **check it**, because 8.x moves quickly |

**A caution this syllabus takes seriously:** the 8.x line has shipped four
feature releases in under a year, so a version-specific claim ages fast. Pages in
this track name the version a behaviour was confirmed on.

## Parts

| # | Part | Covers | Phases |
|---|---|---|---|
| 1 | **[How Redis works](syllabus/01-how-redis-works.md)** | Execution model, the keyspace, the CLI | 0–2 |
| 2 | **[The data types](syllabus/02-data-types.md)** | Strings, hashes, lists, sets, sorted sets, streams | 3–5 |
| 3 | **[Redis from Node](syllabus/03-from-node.md)** | The client, caching, sessions, rate limits, locks | 6–8 |
| 4 | **[Redis in production](syllabus/04-production.md)** | Memory, eviction, persistence, replication, security | 9–10 |

## Explanations

Not written yet. When they are, they will live in
**[Explanations](pages/README.md)** — one page per topic, with code, gotchas and
interview questions.

import Progress from '@site/src/components/Progress';

<Progress lang="redis" compact />

## Tier legend

| Badge | Meaning |
|---|---|
| <span className="db-tier t-master">Master</span> | Use confidently with no documentation open |
| <span className="db-tier t-understand">Understand</span> | Know how it works; look up signatures freely |
| <span className="db-tier t-know">Know</span> | Know what/why/when; details on demand |

## Tier distribution

| Tier | Topics | Share |
|---|---|---|
| <span className="db-tier t-master">Master</span> | 24 | 32% |
| <span className="db-tier t-understand">Understand</span> | 34 | 46% |
| <span className="db-tier t-know">Know</span> | 16 | 22% |
| **Total** | **74** | |

No <span className="db-tier t-when">When Needed</span> tier here. The scope was
cut to the critical path instead — Redis Search, JSON, time series, vector sets,
Lua as a subject and cluster administration are all real and all **out of
brief**, listed under "Deliberately not here" in
[Part 4](syllabus/04-production.md).

## Prerequisites

**Node through Phase 6 (data access).** The client, connection lifetime and
injection arguments all assume it. You can read Parts 1 and 2 earlier — they are
about Redis itself and need nothing but a terminal.

## Reading order

Parts 1 and 2 are sequential and load-bearing: the data types are the reason to
run Redis, and Part 3 assumes you know which type solves which problem. Part 3 is
where the Node and Express cross-links land. Part 4 can be read the day you
deploy, and should be read before then.

**Do not start at Part 3.** Cache-aside is four lines of code and a dozen ways to
be wrong; the wrongness lives in Parts 1 and 2.

## Sources

- [Redis documentation](https://redis.io/docs/latest/) · [What's new](https://redis.io/docs/latest/develop/whats-new/)
- [Data types](https://redis.io/docs/latest/develop/data-types/) · [Key eviction](https://redis.io/docs/latest/develop/reference/eviction) · [Persistence](https://redis.io/docs/latest/operate/oss_and_stack/management/persistence/)
- [Client libraries](https://redis.io/docs/latest/develop/clients/) · [Distributed locks](https://redis.io/docs/latest/develop/clients/patterns/distributed-locks)
