---
title: "Part 2 — The data types"
sidebar_label: "2 · Data types"
sidebar_position: 2
---

> Phases 3–5 · Strings, collections, and streams

**The data types are the whole point.** Redis used as a string-only cache is
Memcached with extra steps; the reason to run it is that a leaderboard, a rate
limiter, a queue and a session store are each one data type plus one command.

---

## Phase 3 — Strings, numbers and bitmaps

| Topic | Tier |
|---|---|
| **`SET` and its options** — `EX`, `PX`, `NX`, `XX`, `KEEPTTL`, `GET`; why one `SET` replaces a check-then-set | <span className="db-tier t-master">Master</span> |
| **`INCR` / `DECR` / `INCRBY`** — atomic counters, and why they need no transaction | <span className="db-tier t-master">Master</span> |
| `GETEX`, `GETDEL` — read-and-expire and read-and-remove in one round trip | <span className="db-tier t-understand">Understand</span> |
| `MGET` / `MSET` — batching reads, and the cluster caveat that ends the trick | <span className="db-tier t-understand">Understand</span> |
| Strings hold **bytes** — storing JSON, binary, and the size limit you will never hit | <span className="db-tier t-understand">Understand</span> |
| Bitmaps and `SETBIT`/`BITCOUNT` — dense boolean sets (daily-active users) at one bit per member | <span className="db-tier t-know">Know</span> |

---

## Phase 4 — Hashes, lists, sets and sorted sets

The four that cover almost every real problem.

| Topic | Tier |
|---|---|
| **Hashes** — `HSET`/`HGET`/`HGETALL`/`HDEL`, partial updates, and why a hash beats a serialised JSON string | <span className="db-tier t-master">Master</span> |
| **Per-field TTL on hashes** (`HEXPIRE`, Redis 7.4+) — what it changes about caching objects | <span className="db-tier t-know">Know</span> |
| **Lists** — `LPUSH`/`RPOP`, `LRANGE`, `LLEN`, and lists as a queue's naive form | <span className="db-tier t-master">Master</span> |
| **Blocking list ops** — `BLPOP`, `BRPOPLPUSH`/`LMOVE`; the reliable-queue pattern and its failure mode | <span className="db-tier t-understand">Understand</span> |
| **Sets** — membership, `SADD`/`SISMEMBER`/`SREM`, and set algebra (`SINTER`, `SUNION`, `SDIFF`) | <span className="db-tier t-master">Master</span> |
| **Sorted sets** — the type that makes Redis worth running: scores, `ZADD`, `ZRANGE`, `ZRANGEBYSCORE`, `ZRANK` | <span className="db-tier t-master">Master</span> |
| **Sorted sets as tools** — leaderboards, sliding-window rate limits, delay queues, time-ordered indexes | <span className="db-tier t-master">Master</span> |
| Choosing between them — the decision table, and the cost of choosing wrong | <span className="db-tier t-understand">Understand</span> |

**Gate — move on when:** given "top 10 players", "has this user seen this post",
"process these jobs in order" and "everything in the last 15 minutes", you pick
the right type for each without looking anything up.

---

## Phase 5 — Streams

The append-only log built into Redis, and the right answer when a list is not.

| Topic | Tier |
|---|---|
| **`XADD` and the entry id** — time-ordered ids, `*`, and why ids are not sequence numbers | <span className="db-tier t-understand">Understand</span> |
| **`XREAD` vs consumer groups** — fan-out reading versus work distribution | <span className="db-tier t-understand">Understand</span> |
| **Consumer groups** — `XGROUP`, `XREADGROUP`, `XACK`; at-least-once delivery and what you must make idempotent | <span className="db-tier t-understand">Understand</span> |
| **The pending entries list** — `XPENDING`, `XCLAIM`/`XAUTOCLAIM`, and recovering work from a dead consumer | <span className="db-tier t-understand">Understand</span> |
| Trimming — `MAXLEN`/`MINID`, approximate trimming, and why an untrimmed stream is a memory leak | <span className="db-tier t-understand">Understand</span> |
| **Streams vs Pub/Sub vs a list** — the honest comparison, and when none of them should be your queue | <span className="db-tier t-know">Know</span> |

**Gate — deliverable:** a consumer group that survives a consumer being killed
mid-message, with the work reclaimed rather than lost.

---

← Prev: [Part 1 — How Redis works](01-how-redis-works.md) · Next → [Part 3 — From Node](03-from-node.md)
