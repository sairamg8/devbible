---
title: "What Redis is"
sidebar_label: "Overview"
sidebar_position: 0
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-17 against the **Redis documentation** —
> [Redis data types](https://redis.io/docs/latest/develop/data-types/),
> [Compare data types](https://redis.io/docs/latest/develop/data-types/compare-data-types/),
> [Redis strings](https://redis.io/docs/latest/develop/data-types/strings/) and
> [Redis Open Source](https://redis.io/docs/latest/get-started/).
> Documentation-validated under the no-new-sandboxes rule — **no console
> blocks**, because there is no Redis server on this machine.

**"Redis is a data structure server."** That is the documentation's own opening
sentence, and it is the claim this whole track is downstream of. Not a cache. Not
a key-value store. A server whose product is the data structures themselves.

## Chunks

| # | Chunk | Covers |
|---|---|---|
| 01 | [The data-structure server](./01-the-data-structure-server.md) | What the phrase means; the full type inventory, general-purpose vs specialized; why "the data types are the product"; the five things you lose emulating a type with strings |
| 02 | [Operations happen where the data is](./02-operations-where-the-data-is.md) | The read-modify-write race; the docs' own `INCR` atomicity wording; the check-then-act table; server-side computation; round-trip arithmetic; why a per-process counter multiplies by instance count |
| 03 | [Choosing the type](./03-choosing-the-type.md) | The docs' three decision trees — documents, collections, sequences; the two memory orderings; the auxiliary-hash pattern; what choosing wrong costs when there is no `ALTER TABLE` |
| 04 | [What Redis is not](./04-what-redis-is-not.md) | Not a system of record, not relational, not a queue with guarantees by default, not free of blocking, not a lock service; when not to reach for Redis at all |

## The sentence everything follows from

> **The types are the product, and the operation runs next to the data.**

Because the operation runs server-side, it is atomic without a lock — which is
why `INCR` needs no transaction and why `SET … NX` is a lock and `EXISTS`-then-
`SET` is a race. Because the types are first-class, a leaderboard is not an
algorithm you implement but a type you pick.

And because Redis runs **one command at a time** to make that atomicity possible,
a single O(N) command stalls every client — which is topic 03, and the reason
"Redis is fast" is a dangerous thing to believe without qualification.

## Phase gate

You can explain, without notes:

- why `KEYS *` on a production instance is an outage rather than a slow query;
- why `INCR` needs no lock;
- and what you would lose by storing a list as a serialised JSON string.

## Where this connects

- **→ Topic 02 · Single-threaded command execution** — *why* the atomicity in
  chunk 02 is free, and what it costs.
- **→ Topic 03 · O(N) commands block everyone** — the operational consequence of
  that same execution model.
- **→ Topic 05 · Redis is not durable by default** — the full version of chunk
  04's "not a system of record".
- **→ Topic 06 · Versions and the 8.x line** — what Redis 8 absorbed, and why the
  type inventory depends on the version you actually run.
- **→ Phase 1 · Keys, expiry and the keyspace** — key naming as a schema, which
  is the only index Redis will give you.
- **→ Phase 3 and Phase 4** — the types themselves, in depth.
- **→ [PostgreSQL](../../../../postgresql/README.md)** — the system of record
  Redis is *not*.

---

Start: [01 · The data-structure server](./01-the-data-structure-server.md) →
