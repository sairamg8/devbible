---
title: "The data-structure server"
sidebar_label: "01 · The data-structure server"
sidebar_position: 1
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-17 against the **Redis documentation** —
> [Redis data types](https://redis.io/docs/latest/develop/data-types/),
> [Compare data types](https://redis.io/docs/latest/develop/data-types/compare-data-types/),
> [Redis strings](https://redis.io/docs/latest/develop/data-types/strings/) and
> [Redis Open Source](https://redis.io/docs/latest/get-started/).
> Documentation-validated — **no console blocks**, because there is no Redis
> server on this machine and nothing was run.

**The Redis documentation opens with four words that most teams never read:
"Redis is a data structure server."** Not a cache. Not a key-value store. A
server whose product is the data structures themselves.

That sentence is the whole topic, and getting it wrong is the root of nearly
every Redis mistake in the rest of this track.

## What "data-structure server" actually means

You already have data structures. Your Node process has hashes, arrays, sets and
sorted collections, and they are fast because they are in your process's memory.

Redis's proposition is different: **the same structures, but shared, and outside
any one process.**

| | Your process's `Map` | A Redis hash |
|---|---|---|
| Who can see it | one process | every process, on every machine |
| Survives a restart | no | yes, subject to persistence |
| Survives a deploy | no | yes |
| Concurrent writers | one event loop | many, serialised by the server |
| Costs a network hop | no | yes |

The trade is a network round trip in exchange for **shared, concurrent,
process-independent state**. Everything Redis is good at follows from that one
exchange, and everything it is bad at follows from the cost of the hop.

## The inventory — what the types actually are

Redis Open Source implements these. The documentation splits them into
**general-purpose** and **highly specialized**, and the split is worth keeping in
your head because it tells you which ones you are expected to reach for daily.

### General-purpose

| Type | The docs' description | Reach for it when |
|---|---|---|
| **Strings** | "a sequence of bytes" — text or binary | one opaque value; counters; flags; bitmaps |
| **Hashes** | "record types modeled as collections of field-value pairs" | an object with a small number of flat fields |
| **Lists** | "lists of strings sorted by insertion order" | queues, stacks, logs — push/pop at the ends |
| **Sets** | "unordered collections of unique strings" | membership, and set algebra |
| **Sorted sets** | "unique strings that maintain order by each string's associated score" | anything ordered, ranked, or range-queried by score |
| **Streams** | "acts like an append-only log" | event logs with multiple consumers and at-least-once delivery |
| **JSON** | "structured, hierarchical arrays and key-value objects" | genuinely nested documents |
| **Arrays** | "sparse, index-addressable sequences of strings" | ring buffers, sensor readings, sparse indexed sequences |

### Highly specialized

| Type | For |
|---|---|
| **Geospatial indexes** | locations within a radius or bounding box |
| **Probabilistic** — Bloom, Cuckoo, Count-min sketch, HyperLogLog, t-digest, Top-K | approximate statistics over data too large to count exactly |
| **Time series** | timestamped data points |
| **Vector sets** | high-dimensional vectors with cosine-similarity search (HNSW) |

⚠️ **The specialized half is out of this bible's brief** — Search, JSON, time
series, vector sets and cluster administration are deliberately not taught here.
Knowing they exist *is* the Phase 0 requirement; see topic 06 for what the 8.x
line absorbed and why the module story changed.

## "The data types are the product" — why that phrasing

Take the docs at their word and a consequence falls out immediately: **a
leaderboard is not an algorithm you implement, it is a type you pick.**

| The problem | Not this | This |
|---|---|---|
| Top 10 players by score | fetch all, sort in Node | one sorted set |
| Has this user seen this post? | fetch the array, `.includes()` | one set, `SISMEMBER` |
| Process these jobs in order | fetch, shift, write back | one list, `LPUSH` / `BRPOP` |
| Count page views | read, add one, write back | one string, `INCR` |
| Everything in the last 15 minutes | fetch all, filter by timestamp | one sorted set, range by score |

The left column is what you write when you have decided Redis is "a cache that
holds strings." Every row of it is slower, longer, and — as the next chunk shows
— **racy**.

## "You could emulate any of them using just strings"

The documentation says this outright, and then immediately explains why you
should not:

> The general-purpose data types have some overlap among their features and
> indeed, you could probably emulate any of them using just strings and a little
> creativity. However, each data type provides different tradeoffs in terms of
> performance, memory usage, and functionality.

**That sentence is the trap and the escape in one.** Yes, you can keep a JSON
array in a string and treat it as a list. It will work in development. What you
gave up:

1. **Atomicity.** Two processes appending to the same JSON-in-a-string lose
   writes. `RPUSH` to a list cannot.
2. **Complexity class.** Appending to a list is O(1). Rewriting a serialised
   array is O(N) in the array's size, on every append — and it is N bytes over
   the network, twice.
3. **Partial access.** `HGET user:1 email` returns one field. A serialised JSON
   string returns the whole object so your application can throw most of it away.
4. **Server-side computation.** `SINTER` intersects two sets inside Redis.
   Two `GET`s and a JavaScript loop do not.
5. **Memory encoding.** Redis picks a compact internal encoding per type and per
   size — a small hash is not stored the way a large one is. A string gets none
   of that.

## The one sentence to keep

> **If you are only ever calling `GET` and `SET`, you are running a
> data-structure server as a string cache, and paying for a feature set you have
> switched off.**

That is not an argument against caching strings — cache-aside is real and Phase 7
is entirely about it. It is an argument against *stopping there*, because the
four patterns that make Redis load-bearing in a Node application — sessions,
rate limits, locks and queues — are each one data type plus one command, and
none of them are strings-only.

## Trade-off

**The network hop is the price of every single thing on this page.** An in-process
`Map` lookup is nanoseconds; a Redis command is a round trip, and Phase 0 topic 04
argues that the round trip — not Redis — is almost always your latency. So the
data-structure server only pays when the state genuinely needs to be *shared*.

Caching a value your process could have computed in 200 μs, behind a 1 ms
round trip, is a net loss dressed up as an optimisation. The type inventory above
is seductive precisely because it makes it so easy to move work to Redis that
never needed to leave.

**The second trade is coupling.** Choosing a Redis type is choosing a shape that
every service touching that key must agree on, forever, with no schema to enforce
it. A sorted set of user ids is an API. Changing it later is a migration you have
to write by hand, with no `ALTER TABLE` to help.

## Gotchas

**Treating Redis as "the fast database".**
*Symptom:* the team starts moving system-of-record data into Redis for speed.
*Cause:* "in-memory" was read as a performance tier rather than a durability
statement.
*Fix:* topic 05 is the whole answer. Redis holds cache and derived state; it does
not hold the only copy of anything.

**Storing JSON in a string when you only ever read one field.**
*Symptom:* every read pulls kilobytes to use twelve bytes.
*Cause:* the string type is the default reach when the mental model is "cache".
*Fix:* a hash, and `HGET` the field. The docs say this explicitly under
*Alternatives* on the strings page.

**Emulating a list with a serialised array.**
*Symptom:* items disappear under concurrent writes.
*Cause:* read-modify-write on a string is not atomic across clients.
*Fix:* use the list type; the append is one atomic server-side operation.

**Picking a sorted set for everything because it can do everything.**
*Symptom:* memory use far above the estimate.
*Cause:* the docs are explicit that sorted sets have the highest memory overhead
and processing cost of the collection types, then sets, then strings.
*Fix:* use the decision trees in chunk 03. A set is cheaper than a sorted set
when you never need order.

**Assuming a type exists because another database has it.**
*Symptom:* looking for a "queue type" or a "map of maps".
*Cause:* Redis's list is not a queue with delivery guarantees, and hashes do not
nest.
*Fix:* a queue is a list or a stream *plus a protocol* (Phase 5 and Phase 8);
nesting means JSON, or a flattened key naming scheme (Phase 1).

**Reading "Redis Open Source implements JSON / time series / vector sets" and
assuming your instance has them.**
*Symptom:* an unknown-command error in production against a managed provider.
*Cause:* the docs describe the current Redis Open Source distribution; your
provider may run an older version or a fork.
*Fix:* check the running version and the fork before designing on a type. Topic
06 covers the version and licence question.

**Thinking "data structure server" means the structures are free.**
*Symptom:* a million tiny keys costing far more RAM than the data in them.
*Cause:* every key carries per-key overhead on top of its value.
*Fix:* Phase 9 covers where the memory actually goes; the short version is that
one hash of a thousand fields is dramatically cheaper than a thousand keys.

## Interview questions

**★ What is Redis, in one sentence?**
An in-memory data-structure server: it holds native data types — strings,
hashes, lists, sets, sorted sets, streams and more — outside any single process,
with atomic operations defined on them. The documentation's own opening is
"Redis is a data structure server", and the distinction from "key-value cache"
is the point: the types *are* the product.

**★ Why is calling Redis a key-value store misleading?**
Because it describes only the addressing, not the values. Keys are strings, but a
value is a first-class data structure with its own command set and its own
complexity guarantees. Calling it a key-value store leads directly to
`GET`/`SET`-only usage, where every collection operation becomes a
read-modify-write round trip in application code.

**★ The docs say you could emulate any type with strings. Why not?**
You lose atomicity (read-modify-write across clients races), complexity class
(O(1) list append becomes O(N) array rewrite plus N bytes over the wire twice),
partial access (`HGET` one field versus fetching the whole object),
server-side computation (`SINTER` versus two `GET`s and a loop), and the compact
per-type memory encodings.

**★ Give four problems and the type each one is.**
Top-N ranking → sorted set. Membership test → set. FIFO work queue → list, or a
stream when you need consumer groups and at-least-once. Atomic counter → string
with `INCR`. Each is one type plus one command, which is the argument for
learning the inventory rather than reaching for strings.

**What is the difference between a Redis hash and a Redis key?**
Keys are the top-level namespace and are always strings. A hash is a *value* — a
collection of field-value pairs stored under one key. So `user:1` is a key whose
value may be a hash containing `name` and `email` fields, and `HGET user:1 email`
reads one field without transferring the rest.

**Which types are general-purpose and which are specialized?**
General-purpose: strings, arrays, hashes, JSON, lists, sets, sorted sets,
streams. Specialized: geospatial indexes, the probabilistic family (Bloom,
Cuckoo, Count-min sketch, HyperLogLog, t-digest, Top-K), time series, and vector
sets. The split matters because the general-purpose eight cover almost every
application problem.

**Does Redis support nested data?**
Not in hashes — a hash's field values are strings, and hashes do not nest. For
genuinely hierarchical data the JSON type exists, at a higher memory and
processing cost than hashes, which the docs state directly. The common
alternative is flattening the hierarchy into the key name.

**Why do the data types have different memory costs?**
Because Redis chooses an internal encoding per type and per size — small
collections use compact representations and switch to general ones as they grow.
The docs rank the collection types by overhead: sorted sets highest, then sets,
then strings; and for documents: JSON highest, then hashes, then strings. Phase 9
covers encodings properly.

**When is a data-structure server the wrong tool?**
When the state does not need to be shared. The entire value proposition is a
network round trip exchanged for cross-process visibility; if one process owns
the data and the data dies with it, an in-process structure is faster and simpler.
Also when the data is the system of record — that is topic 05.

---

Next: [02 · Operations happen where the data is](./02-operations-where-the-data-is.md) →
