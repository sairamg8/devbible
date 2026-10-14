---
title: "The storefront's description cache is easy because being wrong for a while costs nothing and its price cache is hard because being wrong costs a disputed charge — so the price needs event-driven invalidation from the database's own change log, version-checked cache writes, and a checkout that never trusts the cache at all"
sidebar_label: "03c · Price versus description"
sidebar_position: 3.2
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-10-14. The outbox pattern, change-data-capture-driven invalidation and
> version-checked cache writes are **common practice stated as mechanism**, not cited to a
> standard; the Lua script is Redis scripting source, not output. Quoted: the HTTP rules from
> [RFC 9111](https://www.rfc-editor.org/rfc/rfc9111.html) §4.4.2 and §4.2.4.2, and
> [MDN's `Cache-Control`](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Cache-Control)
> warning about personalised content. Atomicity guarantees of Redis scripts and of any CDC tool
> are described as mechanism; read the product's documentation for specifics. **No sandbox run.**

**A description and a price are both rows in the same table and call for opposite designs, because the cost of a wrong value differs by orders of magnitude and the number of places that value is read and acted on differs with it.** A description served five minutes stale is a typo nobody notices. A price served five minutes stale is a promise the business may or may not honour, shown in a listing, a search result, a recommendation card, an email, and a cart. This page works the case end to end, because "why is the price the hard one" is the interview question that tests whether the candidate has absorbed everything in [02](02-the-four-strategies.md), [03](03-invalidation.md) and [03b](03b-versioned-keys-and-tag-purge.md) or only the vocabulary.

## Why the description is easy

| Property | Description | Price |
|---|---|---|
| Cost of a stale value | cosmetic | a disputed charge, a legal question, a lost sale |
| Write frequency | rare, by a human | often: promotions, scheduled sales, repricing jobs, a flash-sale start |
| Who writes | the admin tool | the admin tool, a repricing service, a promotions engine, an import |
| Read amplification | one product page | the page, listings, search, recommendations, cart, email |
| Needs read-your-writes | the editor, once | every shopper at the instant a sale starts |
| Right design | TTL (long), delete on edit | event-driven, version-checked, never authoritative at checkout |

The description fits the "N is a minute or more" row of [03](03-invalidation.md): a long TTL, a delete on edit, done. Everything that follows is what the price needs *in addition*.

## The price's four problems

1. **Many copies in many shapes.** The unit price lives in the product detail, in every listing that shows the product, in search documents, in recommendation cards, in a cached cart's line items, and at the CDN for anonymous product pages. A price change must reach them all, and they are separate keys with separate lifetimes. A per-entity key delete reaches one of them.
2. **Many writers.** A repricing job, a promotions engine, an admin form, a bulk import. A write path that invalidates by remembering to call the cache works until the writer nobody remembered writes the column. The invalidation has to come from the data, not from each writer.
3. **Time-triggered change.** A sale starts at 12:00:00. No write happens at 12:00:00; the price changed because the clock passed a `valid_from`. A cache invalidated by writes never hears about it. The price must either be computed with the clock as an input (the cached unit is "price schedule", not "current price") or a job must publish the change at the boundary.
4. **The cache must never be the authority for money.** A price displayed from a cache is information. A price *charged* must be the database's. Everything below makes the cached price as fresh as practical; it is checkout's re-read that makes the system correct.

## Design: events from the change log, version-checked writes

### Step 1 — write the change and the event in one transaction (the outbox)

Do not have the repricing code call `redis.del`. Have it write the price **and** an outbox row in the same database transaction:

```sql
BEGIN;
UPDATE products SET price_cents = $2, version = version + 1 WHERE id = $1;
INSERT INTO cache_outbox (entity, entity_id, version, created_at)
VALUES ('product', $1, (SELECT version FROM products WHERE id = $1), now());
COMMIT;
```

Either both rows commit or neither does. There is no state in which the price changed and the event was lost, which is the failure of "update then call Redis" when the process dies in between. Any writer — the admin tool, the importer, a script — that goes through the table produces the event if the event is produced by a trigger or by the change stream instead of by application code. Where a trigger is unwelcome, change-data-capture reads the write-ahead log and emits the same fact without the writers' cooperation. Which of the two to use is an operational choice; the property that matters is *every committed change produces an event, from one place*.

### Step 2 — a relay publishes outbox rows

A small process polls the outbox (or the CDC stream delivers it), publishes to a durable queue or stream, and marks rows sent only after the publish is acknowledged. This is at-least-once: a crash after publish and before marking publishes again. The consumers are therefore idempotent, which deletes and version-checked writes both are.

### Step 3 — consumers invalidate every derived entry

Each consumer owns one cache: the product detail cache deletes `product:42`; the listing cache bumps `gen:category:{c}` or purges tag `product:42` ([03b](03b-versioned-keys-and-tag-purge.md)); the search indexer reindexes the document; the CDN consumer calls a purge for the surrogate key. One event, many independent consumers, each with its own retry. A slow search indexer does not delay the product cache.

### Step 4 — if you must write the price into the cache, check the version

When the consumer writes the new value instead of deleting (because the key is hot and a miss per change would be a stampede), a reordered or retried event could overwrite a newer value with an older one. The write must be a compare-and-set on the version, atomic in the cache. In Redis that is a script:

```lua
-- KEYS[1] = product:42   ARGV[1] = new version   ARGV[2] = serialized value   ARGV[3] = ttl
local cur = redis.call('HGET', KEYS[1], 'v')
if cur and tonumber(cur) >= tonumber(ARGV[1]) then
  return 0                                -- cache already holds this version or newer
end
redis.call('HSET', KEYS[1], 'v', ARGV[1], 'd', ARGV[2])
redis.call('EXPIRE', KEYS[1], ARGV[3])
return 1
```

The cached value is a hash holding a version and a payload. A script executes atomically with respect to other commands on that Redis instance, so the read-compare-write cannot interleave with another writer. In Node this is `redis.eval` or `defineCommand`; in Spring it is `RedisScript` executed through the template. The same guard fixes the reader-writer race from [02](02-the-four-strategies.md): a reader that loaded version 6 and arrives after version 7 was set is refused. The reader must have read the version with the row, which means the database read selects `version` alongside `price_cents`.

One residue: a *delete* leaves no version behind, so a late reader populating from an old row after the delete cannot be compared against anything. Two remedies: delete by writing a tombstone with the new version and a short TTL (so the late populate is rejected), or accept the TTL as the backstop for that window.

### Step 5 — handle time-triggered change

A scheduled price has a `valid_from`. Two workable designs:

- **Cache the schedule, compute at read.** The cached unit is the list of (price, `valid_from`, `valid_to`) intervals for the product. The reader picks the interval containing now. The cache entry is not wrong when the clock passes the boundary, because it contained the boundary. Invalidate only when the schedule is edited.
- **A scheduler publishes at the boundary.** A job emits the same outbox event at 12:00:00. This adds a time dependency (the job's lateness is the staleness) and is fragile at the exact moment a sale starts, which is when load is highest.

The first is more robust because it removes the event the second depends on, and the clock-skew caveat applies to both: the interval test uses the reader's clock.

### Step 6 — checkout re-reads, always

The cart holds product ids and quantities, never trusted prices. At the moment of checkout the order service reads the current price from the database (or from a cache entry whose version it verifies against the database in the same transaction) and the order records the price actually charged. If the price differs from what the shopper saw, the response says so and asks again; it does not silently charge either. This single rule makes the cache an optimisation of display and moves all of the correctness onto one read the system can afford.

## The CDN and the browser: the layers you cannot fully invalidate

A cacheable price on the product page reaches browsers and edges. RFC 9111's only guarantee is that a cache invalidates the *target URI* on a successful unsafe request through it. A purge API handles edges you operate; browsers can only be shortened. The design:

- Public product page HTML: short shared lifetime plus purge-by-surrogate-key on price events, and revalidation in the browser (MDN: *"`no-cache` allows caches to store a response but requires them to revalidate it before reuse."*).
- Anything personalised — the cart, "your price" for a logged-in tier — `private`. MDN: *"If you forget to add `private` to a response with personalized content, then that response can be stored in a shared cache and end up being reused for multiple users, which can cause personal information to leak."*
- The price shown on a listing is allowed to be a little behind; the price **added to the cart** and the price **charged** are not, and both are taken from the source.

The RFC also says when a cache may serve stale despite instructions: *"A cache MUST NOT generate a stale response if it is prohibited by an explicit in-protocol directive (e.g., by a no-cache response directive, a must-revalidate response directive, or an applicable s-maxage or proxy-revalidate response directive)."* — §4.2.4.2. For a price that must not be shown stale at all, `must-revalidate` or `no-cache` is the explicit prohibition; the cost is a validation request per view instead of a hit, and that cost is a decision, not a default.

## The flash-sale SKU

The flash-sale SKU has all four problems at once, plus a price that changes at a known instant and a stock number that changes on every request.

- **The price change is scheduled.** Cache the schedule; do not rely on an event at the first second. Warm the product page and the schedule before the start, so the first second is not a cold start (warming is **04 Stampede and thundering herd** *(not written yet)*).
- **The stock number is not cached for display accuracy.** Show a coarse "selling fast" indicator computed from a counter and refreshed on a short interval; the decision to allow a purchase is made against the authoritative decrement ([02c](02c-write-behind-and-choosing-per-data-type.md)).
- **The price is not allowed to change mid-sale without a version.** A version on the schedule means a late event cannot revert it.
- **The hot key is read by everyone.** One product key in one Redis shard receives the load of the whole sale; replicate reads or hold an in-process copy refreshed every second (**06 Hot keys and skew** *(not written yet)*), accepting that second as the staleness bound.

## Gotchas

**★ Symptom: the product page shows the new sale price and the listing, search results and recommendation cards still show the old one.** Cause: the price lives in several derived entries and the invalidation reached only the entity's key. Fix: one price-change event, many independent consumers, each invalidating its own cache by delete, generation bump or tag, plus a TTL on each as a bound.

**★ Symptom: the price in the cache is older than the database's although every price update calls the invalidator.** Cause: the invalidation was an application call after the update, and either the process died in between or a writer that does not call it (an import) changed the table. Fix: an outbox row in the same transaction as the update, or change-data-capture; invalidate from the data, not from the writers.

**★ Symptom: a sale starts and some users see the old price for minutes.** Cause: the price changed because the clock passed `valid_from`; no write occurred, so no event, so the cache was not invalidated. Fix: cache the interval schedule and choose the interval at read time, or publish an event at the boundary and also keep a TTL no longer than the tolerated delay.

**★ Symptom: a retried or reordered event overwrites a new price with an old one.** Cause: the consumer wrote the value instead of deleting it, and events are at-least-once and not ordered across partitions. Fix: delete in the consumer, or write with a compare-and-set on a row version in a Lua script, and key the stream by product id so one product's events are ordered.

**★ Symptom: a customer is charged a price that differs from the one they saw, or a price that no longer exists.** Cause: checkout trusted a price carried from the page or the cart or read from a cache. Fix: price is read from the database at order time inside the order transaction, recorded on the order line, and a difference from what the shopper last saw is surfaced for confirmation.

**★ Symptom: a logged-in tier price is shown to anonymous users or another tier.** Cause: a personalised response was stored in a shared cache (a missing `private`, or a cache key lacking the tier). Fix: `private` on personalised responses, the tier in the key of any shared price cache, or compute the tier price from the public price and the tier at read time instead of caching the combination.

**Symptom: the outbox table grows without bound and the relay lags.** Cause: processed rows are never deleted, or the relay polls with a scan. Fix: delete or archive sent rows, index by unsent state, and alert on the age of the oldest unsent row, which is the invalidation delay.

**Symptom: the invalidation consumer falls behind during a bulk repricing and prices lag for an hour.** Cause: a bulk update produced one event per row, and the consumers are slower than the producer. Fix: coalesce events per entity, bump a category generation for bulk edits rather than purging per product, and size the consumers from the bulk-edit rate rather than the normal one.

**Symptom: the tombstone TTL makes every product look missing for a moment.** Cause: a tombstone entry was treated as a hit by the read path. Fix: the read path treats tombstones as a miss that loads from the source while refusing lower-versioned writes.

## Interview questions

**★ Why is the price cache harder than the description cache?**
Being wrong costs a charge instead of a typo; the price is in many derived places and written by many writers; it can change by the clock with no write at all; and it is read at the moment a purchase decision is made. A description fits a long TTL and a delete on edit. A price needs invalidation driven by the data, version-checked writes, a schedule that includes time, and a checkout that does not rely on the cache.

**★ How do you guarantee a price change reaches every cache?**
You cannot guarantee delivery to a cache you do not control, so you build for at-least-once delivery and a bound. The change and an outbox row commit in one transaction, a relay publishes with retries, each consumer deletes or version-writes its own entries idempotently, and every entry has a TTL so a lost event costs at most that TTL. For the CDN, purge by surrogate key; for browsers, a short lifetime or revalidation, since they cannot be reached.

**★ Where does the outbox beat calling the cache from the write path?**
It removes the window between the database commit and the cache call. With a direct call, a crash, a timeout, or a different writer leaves the cache stale until the TTL; with an outbox the event is part of the transaction, so a change is never committed without its event, and the relay retries until the publish is acknowledged.

**★ How do version-checked writes fix the races?**
The cached value carries the row's version, and a compare-and-set refuses to replace it with a lower one. A delayed reader that loaded the old row, a retried event, and out-of-order delivery all become no-ops instead of overwrites. In Redis the compare and set must be one atomic operation — a script. The remaining gap is a deleted key, which has no version to compare, closed with a short-lived tombstone or accepted under the TTL.

**★ What is the rule for checkout and cached prices?**
The cache is never the authority for money. The order service reads the current price from the database in the order transaction, records the charged price on the order, and treats a mismatch with what the shopper saw as an event to confirm. The cached price is a display optimisation, and its staleness is bounded but not zero.

**How do you handle a price that changes at a scheduled time?**
Cache the schedule and choose the interval at read time, so passing the boundary needs no invalidation. The alternative, an event at the boundary, adds a time-dependent job at the busiest moment. Both depend on a clock, and a bounded skew between clocks is part of the staleness budget.

**What would you do differently for the flash-sale SKU?**
Warm the page and schedule before the start; treat the stock count as an atomic gate with the database as ledger; show only a coarse approximate stock number; give the hot product key an in-process or replicated read path with its refresh interval as the explicit staleness; and make the order transaction re-verify price and stock so no cache fault can oversell or misprice.

**A teammate says "just set the price TTL to five seconds". Your response?**
It bounds staleness at five seconds from the last load, plus the layers above; it also multiplies source reads for every price entry, synchronises expiries unless jittered, does nothing for the CDN and browser layers with their own lifetimes, and does not make checkout safe. It is a reasonable backstop under an event-driven design, not the design.

{/* FOOTER */}
