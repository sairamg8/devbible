---
title: "Write-behind turns the cache into the place a write is acknowledged and the database into something that catches up, which buys write throughput by spending durability — so it belongs to data you can lose or rebuild, and the storefront's choice is made per data type, never per system"
sidebar_label: "02c · Write-behind and choosing per data type"
sidebar_position: 2.2
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-10-14. Write-behind and the per-data-type decision are **common practice stated
> as mechanism**, not cited. Quoted: the `noeviction` sentence from the Redis
> [key-eviction documentation](https://redis.io/docs/latest/develop/reference/eviction/), and
> [RFC 9110](https://www.rfc-editor.org/rfc/rfc9110.html) §9.2.2 on idempotence, which is what
> makes a retried flush safe. No durability guarantee of any specific product is claimed: where a
> product's `fsync` or replication behaviour matters, the page says to read that product's
> documentation. **No sandbox run.**

**Write-behind acknowledges a write as soon as the cache has it and persists to the database afterwards, so the caller's latency and the database's write load are decoupled from the database's speed — and the price is that between acknowledgement and flush the cache is the only copy of the data.** That sentence is the whole decision. Everything else on this page is the machinery that makes the window small, the flush correct, and the loss survivable for the few data types where the trade is right, and the table at the end that says which data types those are for a storefront.

Cache-aside and its race analysis are in [02](02-the-four-strategies.md); read-through and write-through are in [02b](02b-read-through-and-write-through.md).

## The mechanism

```
write(k, v):
  1. put v in the cache, mark k dirty
  2. append (k, v) to a write queue
  3. return success                        // database not yet touched

flusher (async, batched):
  4. drain the queue
  5. coalesce: keep only the last value per key
  6. write the batch to the database in one statement or transaction
  7. on success, mark keys clean; on failure, retry with backoff
```

Three things happen at step 5–6 that are the actual benefits:

- **Coalescing.** A counter incremented one thousand times between flushes is one `UPDATE` carrying the final value, not a thousand statements. A product's stock written five times in a second is one write.
- **Batching.** Many keys flush in a single multi-row statement or one transaction, replacing many round trips and many commits with one.
- **Write smoothing.** A spike of writes is absorbed by the queue and drained at the database's pace. This is a buffer, and like every buffer it converts a latency spike into a backlog, and a backlog into data at risk.

```js
// view counter: write-behind to Postgres, Node + ioredis
async function recordView(productId) {
  await redis.hincrby('views:pending', productId, 1);      // acknowledged here
}

setInterval(async () => {
  const batch = await redis.eval(DRAIN_AND_RESET, 1, 'views:pending'); // atomic read+clear in Lua
  if (!batch.length) return;
  await pg.query(
    `UPDATE products p SET views = p.views + v.n
       FROM (SELECT unnest($1::int[]) AS id, unnest($2::int[]) AS n) v
      WHERE p.id = v.id`, [ids(batch), counts(batch)]);
}, 5_000);
```

Look at what this snippet does not say: it does not say what happens when the `UPDATE` fails after the Lua script already cleared the pending hash. As written, those counts are gone. A correct flusher moves the batch to a *processing* key (rename), applies it, and deletes the processing key afterwards, and handles a crash that leaves a processing key behind by replaying it — which is only safe if the apply is idempotent. An `UPDATE ... SET views = views + n` is *not* idempotent, so a replay double-counts. The usual answers are to apply with a batch id recorded in the same transaction (skip if seen), or to accept the double-count for a metric where it does not matter, and to say that on the design doc rather than discover it.

## What write-behind costs

**Durability.** Until the flush, the data exists in the cache and nowhere else. If the cache is Redis, whether the data survives a restart depends on the persistence configuration of that Redis (append-only file with which fsync policy, RDB snapshots, replication to a replica that may itself be behind) and that is the documentation of the product, not a property of the pattern. If the cache is in process memory, a process crash loses everything unflushed, and a rolling deploy loses it too unless the process drains on `SIGTERM`. The honest statement: write-behind's durability is at most the durability of the buffer, and the buffer is usually weaker than the database it fronts.

**Read-your-writes across the database.** A reader that bypasses the cache — a report, an admin query, another service reading the table — sees the database, which lags. Two views of the same data now disagree by design. Any consumer that must be exact has to read the cache, flush first, or read the database knowing it is behind.

**Ordering.** Coalescing keeps the last value per key and so discards intermediate states. That is correct for "set stock to 17" and wrong for anything where the history is the data (a ledger of payments, an audit trail). Batching across keys can also reorder writes relative to arrival; if two keys have a foreign-key relationship, the flusher has to write the parent first.

**Failure of the flush.** The database rejects a row (constraint violation, deadlock, an enum the schema no longer has). The caller was told success a minute ago. A poison record at the head of the queue blocks everything behind it, or, if skipped, is silently dropped. A dead-letter path, an alert on queue depth and age, and a deliberate decision about whether a rejected write is retried, parked or discarded are part of the pattern, not extras.

**Backlog is the metric.** The cost of write-behind is the *age of the oldest unflushed write*. Alert on that, not on the queue length: a queue of ten items that has been stuck for an hour is worse than a queue of ten thousand that drains in two seconds.

**Shutdown.** The process must flush on `SIGTERM` before exiting, with a deadline shorter than the orchestrator's grace period. A deployment that kills the process with entries pending is a small outage of acknowledged writes.

**The failure surfaces a long time after the cause.** With cache-aside a bad write fails in the request that made it. With write-behind it fails in a flusher, minutes later, with no caller to tell. Nothing in the request path will tell you that writes are being lost.

## The cache is the system of record, briefly

The logical conclusion of write-behind is that for some keys the cache *is* the primary store and the database is a slowly updated archive. This is a legitimate design — a rate limiter's counters, a session store, a leaderboard — but it is a different decision from "caching", and it should be named: the data's durability requirement is the cache's durability, and a cache that is configured to evict (see the eviction topic, **09 Eviction policies** *(not written yet)*) is not allowed to evict it. The Redis documentation states what happens when such a store fills with no eviction: *"Keys are not evicted but the server will return an error when you try to execute commands that cache new data."* A write-behind buffer that hits `maxmemory` under an evicting policy loses unflushed writes silently; under `noeviction` it rejects new ones loudly. The second is the safer failure for a buffer and the wrong one for a cache, which is why a buffer and a cache should not share an instance or a keyspace's eviction policy.

## Choosing per data type — the storefront

The decision is a function of four properties of the data, not of the technology:

1. **Can the data be lost?** (A view count can; an order cannot.)
2. **How soon must a write be visible, and to whom?** (The buyer's own cart immediately; a catalogue edit to the public within a minute.)
3. **How read-heavy is it, and how write-hot?** (A product page: reads dominate. A flash-sale stock counter: writes and reads on one key.)
4. **How expensive is a wrong answer?** (A stale description: a typo. A stale price: a disputed charge.)

| Data | Strategy | Why | Invalidation / flush | Cache failure |
|---|---|---|---|---|
| Product description, images metadata | cache-aside or read-through, long TTL | read-heavy, rarely written, wrongness cheap | TTL plus delete on edit | fail open to database |
| Catalogue listing page | cache-aside, short TTL | derived from many rows; invalidating per row is impractical | TTL, with tag or version bump on bulk edits ([03b](03b-versioned-keys-and-tag-purge.md)) | fail open, with single-flight |
| Price | cache-aside with delete-on-write after commit, version-checked | wrongness is expensive; reads are many; writes are rare | event-driven from the write ([03c](03c-price-versus-description-the-hard-case.md)); checkout re-reads the database | fail open; checkout never trusts the cache |
| Cart | the cache is the store (session-style), or write-through to a durable store | read-your-writes for the owner | write-through on every change | losing it loses a cart: define whether that is acceptable |
| Order, payment | **no cache on the write path**; database is the record | cannot be lost or reordered | n/a | n/a |
| Product reviews list | cache-aside, short TTL | stale by minutes is fine; high read volume | TTL; delete on new review | fail open |
| Search results | cache-aside on the query, short TTL | expensive to compute, many distinct keys | TTL only | fail open |
| View counters, "recently viewed" | **write-behind**, coalesced | loss of a few counts is acceptable | batched flush on a timer | accept loss or fall back to counting less |
| Flash-sale remaining stock | the atomic counter is the authority during the sale; database reconciles | decrement must be atomic on one key; database cannot take the rate | explicit flush/reconcile; oversell guarded at order commit | fail closed: stop selling rather than oversell |

Three observations the table forces:

- **No row says "write-through".** That is typical. Write-through earns its place only where a write must be immediately visible *through the cache* and the extra write latency is affordable; for most read-mostly data, delete-on-write cache-aside gives the same visible behaviour at lower cost.
- **The flash-sale row is the only place write-behind is dangerous for money.** A stock counter held in the cache and flushed to the database later is correct only if the cache decrement is the authority for the *sale decision* and the database is the authority for the *order*; the order insert must still check the database so a lost or duplicated counter cannot create an oversell. The counter is a gate, not the ledger.
- **A system uses three strategies at once.** The right answer to "which strategy do you use" is a table with a row per data type, and an interviewer hearing a single name has learned the candidate did not think about the price.

## Gotchas

**★ Symptom: acknowledged writes vanish after a deploy or a crash and nothing logged an error.** Cause: write-behind's window — the entries were in the buffer, not the database, and the process or cache instance went away. Fix: flush on `SIGTERM` within the grace period, run the buffer on storage whose persistence matches the loss you accept (read that product's documentation, do not assume), alert on the age of the oldest unflushed write, and keep un-losable data out of the pattern.

**★ Symptom: counters are double-counted after a flusher crash.** Cause: the flusher retries a batch that had already been applied, and the apply (`views = views + n`) is not idempotent. Fix: record the batch id in the same transaction as the apply and skip if seen, or write absolute values rather than increments; [RFC 9110](https://www.rfc-editor.org/rfc/rfc9110.html) defines the property the retry needs: *"the intended effect on the server of multiple identical requests with that method is the same as the effect for a single such request."*

**★ Symptom: the database and the cache disagree for minutes and a report is wrong.** Cause: a consumer reads the table directly while the cache is the authority and the flush lags. Fix: decide and document which store each consumer reads; reports of write-behind data say "as of the last flush" and carry the watermark.

**★ Symptom: the flusher is stuck and the queue grows until the cache is full.** Cause: a poison record (constraint violation) at the head of a strictly ordered queue. Fix: a dead-letter list, a retry limit, an alert on oldest-entry age, and flushing keys independently where order between keys does not matter.

**★ Symptom: the stock counter is correct in the cache and the sale oversold.** Cause: the sale decision trusted a cache value that was flushed, restored, reset or double-applied, and the order commit did not check the database. Fix: the cache counter gates entry; the order insert re-validates stock in the database in the same transaction (a conditional `UPDATE ... WHERE stock > 0` and a row-count check).

**Symptom: when the cache fills, buffered writes disappear without an error.** Cause: the buffer shares an instance with evictable cache data under an evicting policy. Fix: separate instances or databases for buffers and caches; a buffer runs with a policy that rejects rather than discards.

**Symptom: a rolling restart drops pending writes in the instances that restart first.** Cause: no drain on shutdown, or a drain longer than the platform's termination grace. Fix: stop accepting, flush with a deadline below the grace period, and confirm in the shutdown hook that the queue is empty before exiting.

**Symptom: rows reference a parent that has not been flushed and the batch fails on a foreign key.** Cause: batching reordered writes across related keys. Fix: order the flush by dependency, or write the aggregate as one unit.

**Symptom: "we made it write-behind for speed" and the database is no less loaded.** Cause: the writes did not coalesce — every key is written once, so the flusher issues the same number of statements, only later. Fix: write-behind pays only where the same key is written repeatedly or batching beats single statements; measure the coalescing ratio before adopting it, and without a measurement do not claim a number.

## Interview questions

**★ What is write-behind, and what are you giving up to use it?**
The cache acknowledges the write and a background flusher persists it later, usually coalesced and batched. You give up durability in the window (the buffer is the only copy), consistency between the cache and any reader of the database, and the property that a failed write is reported to the caller who made it. In return, write latency stops depending on the database and repeated writes to one key collapse into one. It suits data you can lose a little of or reconstruct — counters, recently viewed, telemetry — and is wrong for orders, payments and anything audited.

**★ Your write-behind flusher applies a batch and crashes before acknowledging it. What happens on restart?**
If the batch is replayed and the apply is not idempotent, it is double-applied. Idempotence has to be designed in: record a batch identifier atomically with the apply, or write absolute values. The pending-to-processing rename gives you "at least once", and an idempotent apply turns at-least-once into effectively-once.

**★ How do you pick a strategy for the price of a product?**
Reads dominate and writes are rare, so a cache is right; being wrong is expensive, so the invalidation must be event-driven rather than TTL-only, and the cache must never be the authority at checkout. Cache-aside with delete after commit, a version on the cached value, a short TTL as the backstop, and checkout re-reading the database. Not write-behind: a price must not exist only in a buffer. Not write-through for its own sake: delete-on-write gives the same read-your-writes with less write latency.

**★ How would you hold the remaining stock of a flash-sale SKU?**
The write-hot single key defeats the database, so an atomic decrement in the cache decides whether a request may proceed, and the database remains the ledger: the order insert re-checks stock transactionally, so any divergence of the counter becomes a rejected order instead of an oversell. If the cache is unavailable the system fails closed — stops selling — because letting every request through is what the counter was protecting the database from. The counter is flushed or reconciled to the database; where the number can drift (a restarted instance), reconcile it from the ledger before reopening the sale.

**What would you alert on for a write-behind queue?**
The age of the oldest unflushed entry, because that is the data-at-risk window, plus flush error rate and the dead-letter count. Queue length alone is misleading: a long queue that drains quickly is healthy and a short one that has not moved is not.

**When is cache-aside with delete-on-write a better choice than write-through?**
Most of the time. It makes writes cheaper (no cache write), avoids filling the cache with data nobody reads, is order-independent, and gives the same user-visible behaviour for the next read. Write-through wins when the next read must be a hit — a hot key where one miss per write is a stampede — and the extra write latency is acceptable.

**Why shouldn't a write buffer share a Redis with a cache?**
Because a cache is expected to evict and a buffer is expected not to. Under an evicting policy a full instance discards buffered writes silently; under `noeviction` it rejects writes, which protects the buffer and breaks the cache's own `SET` calls. They want different eviction policies, different persistence, and different alerts.

**A colleague proposes write-behind for the orders table "to handle Black Friday". Response?**
Orders are neither losable nor reorderable and are read by money-moving code; acknowledging an order that exists only in a buffer is a promise the system cannot yet keep. Handle the spike by queueing the *request* ahead of the order service (the order is then not acknowledged as placed until committed), by making the order insert cheap, and by caching the reads around it — not by caching the write.

{/* FOOTER */}
