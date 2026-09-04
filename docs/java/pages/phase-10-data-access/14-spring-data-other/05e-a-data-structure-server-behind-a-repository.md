---
title: "Redis is a data structure server, a `CrudRepository` can address exactly one of its structures, and choosing the structure is the entire design — which is the part the repository hides"
sidebar_label: "05e · A data-structure server behind a repository"
sidebar_position: 18
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-08 against the Redis documentation *Redis data types*
> ([redis.io/docs/latest/develop/data-types/](https://redis.io/docs/latest/develop/data-types/))
> and the Spring Data Redis 4.1 reference *Redis Repositories · Queries and Query Methods*
> ([docs.spring.io/spring-data/redis/reference/redis/redis-repositories/queries.html](https://docs.spring.io/spring-data/redis/reference/redis/redis-repositories/queries.html)).
> JDK 25, Spring Boot 4.1.1, Spring Data Redis 4.1.0, Redis 8.

**The Redis documentation opens with four words that decide this entire argument:**

> *"Redis is a data structure server."*

**Not a key-value store, not a cache — a server that holds named data structures and
executes their operations atomically. Choosing between a sorted set and a list is not an
implementation detail you can defer; it *is* the data model, the performance profile and the
concurrency story all at once. A `CrudRepository` addresses one structure — the hash — and
presents the other dozen as unavailable. That is not a bug in Spring Data. It is what
happens when you put an interface designed for tables and documents over a store whose whole
value proposition is that its structures are different from each other.**

## What is actually in there

Every one of these is a first-class type with its own commands and its own complexity
guarantees:

| Structure | Redis's own description |
|---|---|
| Strings | *"the most basic Redis data type, representing a sequence of bytes"* |
| Hashes | *"record types modeled as collections of field-value pairs"* |
| Lists | *"lists of strings sorted by insertion order"* |
| Sets | *"unordered collections of unique strings"*, with add, remove and membership in O(1) |
| Sorted sets | *"collections of unique strings that maintain order by each string's associated score"* |
| Streams | *"a data structure that acts like an append-only log"* |
| Bitmaps / bitfields | bitwise operations on strings; *"atomic get, set, and increment operations"* |
| Geospatial indexes | *"useful for finding locations within a given geographic radius or bounding box"* |
| HyperLogLog | *"probabilistic estimates of the cardinality … of large sets"* |
| Bloom / Cuckoo filters | presence or absence of an element in a set, approximately |
| Count-min sketch, t-digest, Top-K | frequency, percentile and ranking estimates over a stream |
| Time series | *"store and query timestamped data points"* |
| JSON | structured documents with element-level access |
| Vector sets | vector similarity search with HNSW |

A `CrudRepository` over `@RedisHash` uses **hashes** for entities and **sets** for its own
bookkeeping. Every other row in that table is reachable only through `RedisTemplate` or a
`RedisCallback`.

## Four problems people bring to Redis, and what the repository does with them

### A leaderboard

The structure is a sorted set. `ZADD` on score change, `ZREVRANGE 0 9` for the top ten,
`ZREVRANK` for one player's position — each one operating on data the server keeps ordered.

Through a repository: entities with a `score` property, `findAll(Sort.by("score"))`, and —
per the reference — a `Comparator` applied in your JVM after loading every player. The
repository turns an O(log N) server-side structure into a full load and an in-heap sort. It
is not a slower way to do the same thing; it is a different algorithm.

### A rate limiter

`INCR` on a per-window key, then `EXPIRE` on first use. `INCR` is atomic and returns the new
value, so the check and the increment cannot interleave.

Through a repository: load a counter entity, add one in Java, save it. Two requests, two
loads, two saves, one lost increment. The atomicity you needed was a property of the
*command*, and the repository chose a different command.

### A work queue

`LPUSH` and `BRPOP` on a list, or `XADD` and `XREADGROUP` on a stream with consumer groups
and acknowledgements. Both give you the blocking pop the problem requires.

Through a repository: there is no representation at all. A list of entities with a `claimed`
flag, polled by an index query, is a queue built out of the wrong primitives, with a race in
the middle of it.

### A cache

A string key holding a serialised value with a TTL, and preferably not written by hand at
all: `@Cacheable` and Spring's cache abstraction, which has a Redis implementation and is
the subject of [12 · The cache abstraction](../12-caching/02-the-cache-abstraction.md).

Through a repository: a keyspace with a TTL, a phantom copy doubling the memory, a listener
you must enable, and index sets you did not need — all the machinery from
[05d · Expiry and the phantom copy](05d-expiry-and-the-phantom-copy.md), in service of a
feature `SET key value EX 300` already had.

## Where the repository genuinely fits

It is not always the wrong tool. The shape it fits is specific:

- the unit of work is a **whole aggregate**, read and written together;
- the dominant access path is **by id**;
- there is at most a small number of **low-cardinality equality** lookups;
- the aggregate is **small enough that whole-hash rewrites are cheap**;
- and you would otherwise be hand-writing exactly the same `HGETALL`/`HMSET` plus a
  membership set.

A user session store is the canonical fit: fetch by session id, occasionally list a user's
sessions, expire on a timer, and no ordering. That is one entity type, one index, and a TTL
— and even there,
[05d · Expiry and the phantom copy](05d-expiry-and-the-phantom-copy.md) is required reading
before you ship it.

## The real cost: the command is the design

In a relational database you write SQL and the planner chooses the access path; you can be
wrong about physical design and still get a correct, sometimes even fast, answer. **In Redis
there is no planner. The command you send is the algorithm that runs**, and the complexity
class is a documented property of the command. `SMEMBERS` on a million-member set is O(N)
and blocks the server thread that runs it; `ZRANGEBYSCORE` with a limit is not.

An abstraction that hides which command runs therefore hides the only thing that determines
performance. That is the deepest objection to the repository idiom here, and it is
qualitatively different from the objection to an ORM over SQL — an ORM generates a query a
planner can still rescue, while a repository over Redis generates commands nothing can
rescue.

The honest position is a split one, and most mature codebases end up there: **entities that
are genuinely aggregates go through the repository; access paths that are structures go
through `RedisTemplate`**, deliberately, with the key names written down somewhere as a
contract. What you must not do is maintain a structure by hand *behind* a repository's back
— the index and TTL corruption in
[05c · Object-to-hash mapping and updates](05c-object-to-hash-mapping-and-updates.md) is
what that produces.

## Gotchas

**★ The repository can only produce hashes and sets.** Sorted sets, lists, streams,
bitmaps, HyperLogLogs and every probabilistic type are unreachable through it. If the right
answer is one of those, the repository is not a slower path to it — it is not a path to it.

**★ Ordering is the tell.** The moment a requirement contains "top", "latest", "rank" or
"range", the structure is a sorted set and the repository's in-JVM `Comparator` is the wrong
implementation of it.

**★ Atomicity is the second tell.** "Increment and check", "claim exactly one", "add if
absent" are single commands in Redis and read-modify-write races through a repository.

**★ Blocking is the third tell.** `BRPOP` and `XREADGROUP` let a consumer wait. A repository
gives you polling, which is a busy loop with a latency floor.

**★ A repository hides which command runs, and the command is the performance model.**
There is no planner to compensate for a bad access path, so an abstraction that conceals the
access path conceals everything.

**★ Using Redis as a cache through a repository is strictly worse than using the cache
abstraction.** You get expiry machinery, a duplicate copy and index bookkeeping in exchange
for features `@Cacheable` provides directly.

**★ Mixing the two without writing down the key format is how a keyspace becomes
unmaintainable.** The repository's key format is a convention derived from a class name; a
hand-written structure's format is whatever you typed. Two teams, two conventions, one flat
namespace.

**★ Maintaining a repository-owned key with raw commands corrupts the index and the TTL.**
The escape hatch is for keys the repository does not own. Reaching into one it does own is
the failure mode of the previous chunk.

**★ "It is just a cache" is how unrecoverable state ends up in Redis.** A repository makes
Redis feel like a database, and feeling like a database is how something that has no
durability guarantee acquires data nobody else has a copy of.

## Interview questions

**★ Why is "Redis is a data structure server" the sentence that matters here?**
Because it says the structures are not interchangeable. The choice between a hash, a list, a
sorted set and a stream is the design decision, and any abstraction that makes that choice
for you has made your design decision for you — in this case, always "hash".

**★ Which Redis structures can a Spring Data repository use?**
Hashes for entities and sets for its bookkeeping — the keyspace set, the secondary indexes,
and the per-entity index back-reference. Nothing else.

**★ How would you build a leaderboard, and why not with a repository?**
A sorted set: `ZADD` to update a score, `ZREVRANGE` to read the top N, `ZREVRANK` for a
player's position, all server-side and ordered. A repository would load every player and
sort them in the JVM, because Redis does not sort hashes and sets in flight.

**★ How would you build a rate limiter?**
`INCR` a per-window key and `EXPIRE` it on first use. The atomicity is in the command. A
load-add-save cycle through a repository loses increments under concurrency and no amount of
care in the Java code fixes that.

**★ When is a Redis repository the right choice?**
When the aggregate is read and written whole, the access is overwhelmingly by id, the
entity is small, and there are at most one or two low-cardinality indexed lookups. A session
store is the canonical example.

**★ Why is hiding the command worse here than hiding the SQL in an ORM?**
Because SQL is declarative and a planner stands between the query and the access path — a
poorly shaped query can still be executed well. A Redis command *is* the access path, with a
documented complexity class, and nothing intervenes.

**★ Can you mix the repository and `RedisTemplate` in one application?**
Yes, and most do. The rule is ownership: a key owned by a repository is written only through
the repository, because the hash rewrite, the TTL and the index sets are its invariants.
Structures you maintain yourself get their own key namespace and their own documented format.

**★ What is the argument for using neither, and just writing the commands?**
That the commands are the interesting part. Redis's API is small, well documented and
directly maps to what your feature needs; the abstraction's value is highest when it saves
you from repetitive `HGETALL`/`HMSET` code and lowest when the structure you want is not a
hash.

{/* FOOTER */}
