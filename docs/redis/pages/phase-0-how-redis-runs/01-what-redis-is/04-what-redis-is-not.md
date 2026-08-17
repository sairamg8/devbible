---
title: "What Redis is not"
sidebar_label: "04 · What Redis is not"
sidebar_position: 4
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-17 against the **Redis documentation** —
> [Redis Open Source](https://redis.io/docs/latest/get-started/),
> [Redis data types](https://redis.io/docs/latest/develop/data-types/),
> [Redis streams](https://redis.io/docs/latest/develop/data-types/streams/) and
> [Persistence](https://redis.io/docs/latest/operate/oss_and_stack/management/persistence/).
> Documentation-validated — **no console blocks**.

The docs describe Redis as being used *"as a cache, vector database, document
database, streaming engine, and message broker"*. Every one of those is true and
every one of them is a half-truth if you stop reading there.

**This chunk is the negative space** — the five things Redis is routinely
believed to be, and what each belief costs. Getting these right is what stops
Phase 7 and Phase 8 from being a list of outages.

## 1. It is not a system of record

The single most expensive misreading, and it has its own topic (05) because the
mechanics deserve one.

The position, stated once: **Redis holds cache and derived state. It does not
hold the only copy of anything you would miss.**

"In-memory" is a *durability* statement that people read as a *performance*
statement. Redis does offer on-disk persistence — RDB snapshots and the AOF
append log, both covered in Phase 9 — but the guarantee each provides is
configurable, bounded, and weaker than a relational database's default. Designing
as though it were the same is how a restart becomes a data-loss incident.

The practical test: **for every key, ask what breaks if it disappears right now.**
If the answer is "a slow request" you are fine. If the answer is "we cannot bill
that customer", it is in the wrong place.

## 2. It is not a relational database

Redis has no joins, no foreign keys, no query planner, and — without Redis
Search, which is out of this track's brief — **no secondary indexes**.

That last one surprises people, so it is worth being concrete. In PostgreSQL you
write the row and add an index; the database maintains it. In Redis, "find all
orders for customer 42" means **you** maintain a set called `customer:42:orders`,
you `SADD` to it in the same code path that writes the order, and you `SREM` from
it when the order is deleted. There is no mechanism that notices you forgot.

| You want | PostgreSQL | Redis |
|---|---|---|
| Look up by a non-key field | `CREATE INDEX` | build and maintain a set or sorted set yourself |
| Join two entities | `JOIN` | two round trips, or denormalise |
| "All rows where X" | `WHERE` | there is no `WHERE`; you must have built the index |
| Keep the index correct | the database does it | your application does it, on every write path |

**The consequence for design:** in Redis you do not model entities and then query
them. You enumerate the questions you will ask, and create a key for each answer.
That is the same inversion MongoDB forces for a different reason, and it is why
Phase 1's "key naming as a schema" is a Master-tier topic rather than a
convention note.

## 3. It is not a message queue with delivery guarantees — by default

"Message broker" is in the docs' own description, and it is doing a lot of work.
There are three mechanisms and they make three different promises:

| Mechanism | Promise | Miss a message when… |
|---|---|---|
| **Pub/Sub** | delivered to subscribers **connected right now** | the subscriber was disconnected, restarting, or deploying |
| **List** (`LPUSH`/`BRPOP`) | one consumer gets each element | the worker dies after popping and before finishing |
| **Streams** + consumer groups | **at-least-once**, with unacknowledged entries recoverable | — this is the one with a real guarantee |

⚠️ **Pub/Sub has no persistence and no replay.** A subscriber that is down misses
everything sent while it was down, and there is no way to ask for it afterwards.
That is not a bug; it is the design. It makes Pub/Sub excellent for cache
invalidation fan-out and wrong for anything you must not lose.

⚠️ **At-least-once means duplicates.** Streams will redeliver an entry whose
consumer died before acknowledging, which is the whole point — and it means
**your handler must be idempotent**. Phase 5 covers the mechanics; Phase 8 covers
idempotency keys; the Express and Node tracks both defer here for exactly this.

**And none of the three is a job queue.** A job queue also needs retries with
backoff, scheduling, priorities, dead-letter handling and observability. That is
BullMQ, which is built on Redis and is the recommendation — Phase 8 covers what
it is doing underneath rather than teaching you to rebuild it.

## 4. It is not free of blocking

Redis executes one command at a time. That is what makes `INCR` atomic without a
lock (chunk 02), and it is also why **one badly chosen command stalls every
client on the server**.

`KEYS *` on a production keyspace is the canonical example, and it is an outage,
not a slow query. `FLUSHALL`, an unbounded `LRANGE`, and `SMEMBERS` on a large
set are the same shape of mistake.

This gets a whole topic — 03 — because the operational consequence is severe and
because the fix (`SCAN`, bounded ranges) is not obvious from the command
reference. The reason it belongs *here* is that "Redis is fast" is the belief
that makes people comfortable running those commands.

## 5. It is not a distributed lock service

`SET key val NX PX <ms>` gives you something lock-shaped in one atomic command,
and for a great many use cases that is genuinely enough.

It is not enough when correctness depends on it. A lock that can expire while its
holder is still working is not mutual exclusion — it is an optimisation with a
race in it. Releasing a lock you no longer own is the classic failure, which is
why the unlock must be conditional on ownership.

The Redlock algorithm exists to strengthen this across multiple instances, and it
has a substantial published criticism. **Phase 8 presents both sides and does not
resolve them by fiat** — the honest position is that if losing the lock is
unacceptable, Redis is likely the wrong tool, and a database transaction or a
fencing token is the right one.

## When not to reach for Redis at all

Five cases, all common:

1. **The state does not need to be shared.** One process owns it, it dies with the
   process, and an in-process `Map` is faster and simpler with no operational
   surface.
2. **The query was already fast.** Caching a 200 μs query behind a 1 ms round trip
   is a net loss and a new correctness problem. Phase 7's "when not to cache" is
   the long version.
3. **The data changes on every request.** A cache with a ~0% hit rate is pure
   overhead, plus a staleness bug waiting to be discovered.
4. **Staleness is a security bug.** Authorisation decisions, permission checks,
   revocation state. Phase 7 is explicit that these must never be cached
   naively.
5. **It is the only copy.** Back to point 1 of this chunk.

## Trade-off

**Redis's versatility is the risk.** Because it can be made to do all of these
jobs, it accumulates them — cache, then sessions, then rate limits, then a queue,
then "just this one bit of state that has nowhere else to live". Each addition is
individually reasonable and the aggregate is a single process, holding data of
five different criticalities, with one eviction policy and one durability
setting covering all of them.

That is the real architectural failure mode, and it does not announce itself. The
eviction policy chosen for the cache will also evict the session store; the
persistence setting adequate for derived state is not adequate for the one key
someone quietly made load-bearing.

**The counter-pressure is per-key discipline** — knowing, for every key, what
breaks when it vanishes — and, when the answers genuinely diverge, separate
instances or at minimum separate databases with the trade-offs Phase 2 and Phase
10 describe. The cost is more infrastructure to run, which is precisely why teams
do not do it until an incident makes them.

## Gotchas

**"We'll put it in Redis for now."**
*Symptom:* two years later it is the only copy of something.
*Cause:* no per-key answer to "what breaks if this vanishes".
*Fix:* answer that question at write time, not at incident time.

**Expecting Pub/Sub messages to be waiting after a restart.**
*Symptom:* events lost across every deploy, in a way that looks intermittent.
*Cause:* Pub/Sub delivers only to currently-connected subscribers, with no
persistence or replay.
*Fix:* streams with consumer groups if the message matters; keep Pub/Sub for
fan-out where a miss is tolerable, like cache invalidation.

**A stream consumer that is not idempotent.**
*Symptom:* duplicate charges, duplicate emails, doubled counters after a worker
crash.
*Cause:* at-least-once delivery redelivers unacknowledged entries — as designed.
*Fix:* idempotency keys (Phase 8), or a natural idempotent operation.

**Building a secondary index and forgetting one write path.**
*Symptom:* an entity missing from a listing, but present when fetched directly.
*Cause:* nothing maintains the index but your code, and a second code path
writes the entity.
*Fix:* one function owns the write, updating entity and index together; and
prefer a periodic reconciliation job over trusting that every path was found.

**Deleting an entity without cleaning up its index entries.**
*Symptom:* ids in sets that resolve to nothing; listings with holes.
*Cause:* no foreign keys and no cascade.
*Fix:* the delete path removes from every index too — which means the indexes
have to be documented somewhere a human can find.

**A cache eviction policy quietly applied to session data.**
*Symptom:* users randomly logged out under memory pressure.
*Cause:* one instance, one `maxmemory-policy`, mixed criticality — and
`allkeys-lru` will evict a key that has a TTL and one that does not alike.
*Fix:* separate the concerns, or choose a policy that only evicts volatile keys,
understanding what that does when memory fills. Phase 9.

**Treating "message broker" in the docs as a delivery guarantee.**
*Symptom:* a queue built on Pub/Sub or a bare list, losing work.
*Cause:* the phrase covers three mechanisms with three very different promises.
*Fix:* pick by the promise you need, and use BullMQ rather than hand-rolling the
retry, scheduling and dead-letter layers.

**Assuming a `WHERE`-style query exists somewhere.**
*Symptom:* a `SCAN` with a `MATCH` pattern used as a query, in a request path.
*Cause:* no secondary indexes without Redis Search, and `SCAN` looks like the
answer.
*Fix:* `SCAN` is for maintenance, not for queries. Build the index set at write
time. Phase 1 covers why `SCAN` is not `KEYS` and still is not a query engine.

## Interview questions

**★ Can Redis be your primary database?**
It can be made to persist, but the honest answer for a fullstack application is
no: it holds cache and derived state, not the only copy of anything you would
miss. The durability guarantees from RDB and AOF are configurable and bounded,
and are weaker than a relational default. The test is per key — what breaks if
this disappears right now.

**★ How do you query Redis by something other than the key?**
You do not, without Redis Search. You build the index yourself: maintain a set or
sorted set whose members are the ids matching that attribute, updating it in the
same code path that writes the entity, and removing from it on delete. Nothing
notices if you forget, which is why write paths must be centralised.

**★ Redis Pub/Sub versus streams — when do you use which?**
Pub/Sub delivers only to subscribers connected at that moment, with no
persistence and no replay, so it fits fan-out where a miss is acceptable — cache
invalidation being the standard example. Streams persist entries, support
consumer groups, and give at-least-once delivery with unacknowledged entries
recoverable from the pending entries list. If losing the message matters, it is
a stream.

**★ What does at-least-once delivery require of your code?**
Idempotency. The consumer will sometimes see the same entry twice — that is the
guarantee working, not failing, because an entry unacknowledged by a dead
consumer must be redelivered. The handler has to produce the same end state on a
second run, usually via an idempotency key or a naturally idempotent write.

**★ Is `SET key val NX PX` a safe distributed lock?**
It is atomic and it is a reasonable optimisation, but it is not mutual exclusion
under all conditions: the lock can expire while the holder is still working, and
a naive release can free a lock someone else now owns, so the unlock must be
conditional on ownership. Redlock strengthens this across instances and is itself
contested. If correctness depends on the lock, a database transaction or a
fencing token is the sounder choice.

**Why does one Redis instance holding cache, sessions and rate limits worry
you?**
Because one eviction policy and one persistence setting cover data of three
different criticalities. The policy chosen for the cache also evicts sessions;
the durability adequate for derived state is not adequate for a key someone made
load-bearing. Versatility causes accumulation, and accumulation flattens
distinctions that matter.

**When would you tell someone not to add Redis?**
When the state is not shared across processes, when the query being cached was
already fast, when the data changes every request, when staleness would be a
security bug, or when Redis would hold the only copy. In-process memory is faster
and has no operational surface; adding a network hop needs a reason.

**Why is `KEYS *` an outage rather than a slow query?**
Because Redis runs one command at a time. `KEYS` is O(N) over the entire keyspace
and, while it runs, every other client waits — so a single diagnostic command
stalls the whole application. `SCAN` exists to iterate without that, and topic 03
and Phase 1 cover the cursor contract.

**The docs call Redis a document database and a vector database. Is that
marketing?**
No — Redis Open Source genuinely implements JSON, vector sets with HNSW
similarity search, time series and the probabilistic types. It is incomplete as a
description, because those capabilities depend on the version you actually run
and on the fork, and because they are out of a fullstack brief's scope. Knowing
they exist is the Phase 0 requirement; topic 06 covers the version question.

---

← Prev: [03 · Choosing the type](./03-choosing-the-type.md) ·
Back to: [Topic index](./README.md)
