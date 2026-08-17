---
title: "Phase 0 — How Redis runs"
sidebar_label: "Overview"
sidebar_position: 0
---

> Verified: 2026-08-17 against the **Redis documentation** (Redis Open Source
> 8.x). Sources named per page. **Documentation-validated** under the
> no-new-sandboxes rule — **no console blocks**, because there is no Redis
> server on this machine and nothing was run.

**🚧 1 of 6 topics written.** The mental model. Skipping it is why people are
surprised when one command freezes every client.

> **Chunk A** of the three-way Redis split — phases 0, 1, 2, 3.
> See [the pages index](../README.md) for who owns what.

| # | Page | Tier | State |
|---|---|---|---|
| 01 | [What Redis is](./01-what-redis-is/README.md) | <span className="db-tier t-master">Master</span> | ✅ written — 4 chunks |
| 02 | Single-threaded command execution | <span className="db-tier t-master">Master</span> | ⏳ next |
| 03 | O(N) commands block everyone | <span className="db-tier t-master">Master</span> | ⏳ |
| 04 | The RESP protocol and round trips | <span className="db-tier t-understand">Understand</span> | ⏳ |
| 05 | Redis is not durable by default | <span className="db-tier t-master">Master</span> | ⏳ |
| 06 | Versions and the 8.x line | <span className="db-tier t-know">Know</span> | ⏳ |

## Coverage

| | |
|---|---|
| Topics written | **1 of 6** |
| Pages on disk | **5** (topic 01 is a 4-chunk directory plus its index) |
| Evidence | the Redis documentation, named per page; **no console blocks** |
| Largest file | 285 lines — under the 300-line cap |

## The sentence everything follows from

> **Redis is a data structure server, it runs one command at a time, and it holds
> your data in memory.**

Those three clauses generate the whole phase. *Data structure server* is why a
leaderboard is a type and not an algorithm (topic 01). *One command at a time* is
why `INCR` is atomic without a lock (topic 02) — and why a single O(N) command
stalls every client (topic 03). *In memory* is why Redis is fast, why the network
is usually your latency (topic 04), and why it must not hold the only copy of
anything (topic 05).

## Phase gate

**Move on when** you can explain why `KEYS *` on a production instance is an
outage, and why `INCR` needs no lock.

## Where this connects

- **→ Phase 1 · Keys, expiry and the keyspace** — the layer everything else sits
  on, and the only index Redis gives you.
- **→ Phase 2 · `redis-cli`, mastered** — the tools that answer "why is Redis
  slow?", which are unreadable without this phase's model.
- **→ Phase 9 · Memory and persistence** — the full version of "not durable by
  default".
- **→ [PostgreSQL](../../../postgresql/README.md)** — the system of record Redis
  is *not*.

---

Next: [01 · What Redis is](./01-what-redis-is/README.md) →
