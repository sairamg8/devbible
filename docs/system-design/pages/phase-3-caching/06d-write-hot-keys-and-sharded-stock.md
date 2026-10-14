---
title: "A write-hot key cannot be copied, only divided: counters become shards summed on read, stock becomes rows decremented by a conditional update, and the sum is never a snapshot so it may display a number but may never decide a sale"
sidebar_label: "06d · Write-hot keys and sharded stock"
sidebar_position: 6.3
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-10-14. Sharded counters, in-memory batching and sharded stock rows are **common
> practice stated as mechanism**, not cited; no source defines them and no shard count or
> contention figure is stated. The SQL is standard `UPDATE … WHERE … RETURNING` and was **not
> executed**; the row-lock behaviour it relies on is the database's documented concurrency
> control, named here as mechanism without a version-specific quotation. **No sandbox run.**

**Replication multiplies reads and would multiply writes, so a key that is written as hard as it
is read is divided rather than copied, and the discipline is knowing what the divided total can
and cannot be used for.** This chunk continues
[06c](06c-key-replication-and-request-splitting.md) with the write side of skew, ending in the
flash-sale stock decrement where a wrong answer is an oversold SKU.

## Write-hot keys: shard the counter

Replication multiplies *reads*. A key that is **written** at a high rate — a view counter, a
"people looking at this" gauge, the sale's units-sold counter — is bottlenecked on the single
owner of its one name, and copies would multiply the writes. Shard instead: `k` counters
`views:42:0 … views:42:(k-1)`; each writer increments a **random** shard; a reader sums them.

```js
const SHARDS = 8;     // a knob; the source gives no number and neither does this page

export const incrViews = (redis, sku) =>
  redis.incr(`views:${sku}:${Math.floor(Math.random() * SHARDS)}`);

export async function totalViews(redis, sku) {
  const keys = Array.from({ length: SHARDS }, (_, i) => `views:${sku}:${i}`);
  const parts = await redis.mget(keys);
  return parts.reduce((a, v) => a + Number(v ?? 0), 0);
}
```

The write load now divides across up to `k` owners. The read is `k` keys instead of one, so
reads of a sharded counter are more expensive, and the sum is **not a snapshot**: increments
land between the first and last shard read. For a displayed view count that is fine. Where the
total must be exact at a moment — stock — it is not, which is the next section.

A second write-hot technique is to **batch in memory**: each instance accumulates increments
locally and flushes the delta once per interval. It cuts the write rate to the cache by the
batching factor, and it loses the unflushed increments if the process dies — the write-behind
trade-off, appropriate for a vanity counter and never for money or stock.

### Inventory: shard the rows, not just the cache key

The storefront's stock decrement is write-hot and also *correctness-critical*. The cache can
display an approximation, but the decrement must be against the database, and a single stock row
becomes the hot spot there: concurrent updates to one row queue on its row lock. The conditional
update is what prevents overselling:

```sql
UPDATE inventory
SET    qty = qty - 1
WHERE  sku = $1 AND qty > 0
RETURNING qty;
```

Zero rows returned means sold out for that row; the `qty > 0` predicate is evaluated under the
row lock, so two buyers cannot both take the last unit. Sharding the **stock** across rows
spreads the lock contention:

```sql
-- one row per (sku, slot); slots hold the units allocated to them
UPDATE inventory_slot
SET    qty = qty - 1
WHERE  sku = $1 AND slot = $2 AND qty > 0
RETURNING qty;
```

The buyer tries a random slot and, on zero rows, tries the next. The cost is the sell-out edge:
the last few units can sit in slots a buyer did not try before giving up, so the application must
iterate all slots before declaring sold out, and the displayed "remaining" is the sum with the
same non-snapshot caveat. The design principle — cache the read, verify on the write — is the
subject of **What not to cache** *(not written yet)*; this chunk only shows why the write needs
its own scaling story.

## Choosing between the defences

| Defence | Fixes | Staleness | Cost | Fails when |
|---|---|---|---|---|
| L1 per instance | read-hot | up to the TTL, per instance | process memory × instances | the hot set is large; staleness is visible |
| Read replicas | read-hot | replica lag | extra nodes | replicas are lagging or absent |
| Key replication | read-hot | until all copies are updated | write fan-out, registry | copies diverge on partial failure |
| Counter sharding | write-hot | sum is not a snapshot | `k` reads per total | the total must be exact |
| Value splitting | hot big value | none | layout complexity | head/chunk consistency is broken |
| Edge / CDN | public read-hot | HTTP freshness rules | purge machinery | the content is per-user |

## Gotchas

**★ Symptom: the sharded view counter total is occasionally lower than a previous reading.**
Cause: the reader sums shards while writers increment them; there is no snapshot, so two sums can
observe different subsets of increments. Fix: this is acceptable for a display counter — say so
in the contract. If the number must be monotonic, cache the last reported total and show
`max(previous, current)`, or read through a single aggregator.

**★ Symptom: during a sale the site oversells or reports sold-out with units left.** Cause:
stock was decremented in a cache, or sharded rows were summed to decide sold-out, or the
`qty > 0` predicate was applied on a read before the write. Fix: the database conditional
`UPDATE` is the only decision; iterate all slots before declaring sold-out; treat any cached
figure as display only.

**Symptom: a flush-batched counter lost increments on a deploy.** Cause: unflushed deltas lived
only in process memory and the instance was terminated. Fix: flush on shutdown, accept loss for
vanity counters, and never batch anything that is money, stock or an audit trail.

## Interview questions

**★ How would you design the flash-sale stock counter?**
Display from a cache or sharded counter, decrement in the database with a conditional update
(`WHERE qty > 0`), and, if one row is the contention point, shard the stock across rows and try
slots until one succeeds, iterating all of them before declaring sold-out. The cache is never the
decision. The oversell protection is the predicate under the row lock.

**Why is a sharded counter's total not a snapshot, and when does that matter?**
Reading `k` shards takes `k` operations; increments interleave with them, so the sum reflects no
single instant. It does not matter for a view count. It matters when the number gates a decision
— stock — where the decision must be made by one atomic conditional write.

{/* FOOTER */}
