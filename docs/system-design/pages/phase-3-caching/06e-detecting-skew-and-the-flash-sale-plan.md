---
title: "Hot keys are found by counting requests per key with a bounded sketch rather than by watching node averages, predictable ones should be declared before the event instead of detected during it, and the flash-sale SKU needs a layered plan in which every layer has a stated staleness and the purchase itself is cached nowhere"
sidebar_label: "06e · Detecting skew and the flash-sale plan"
sidebar_position: 6.4
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-10-14. Heavy-hitter counting (the Misra–Gries summary) is a published algorithm
> described here from memory as mechanism, with its guarantee derived in the text; its paper was
> **not fetched**. The Redis Cluster specification
> ([redis.io](https://redis.io/docs/latest/operate/oss_and_stack/reference/cluster-spec/),
> fetched 2026-10-14) is quoted for slot ownership. I **could not confirm** which built-in
> hot-key reporting tools any specific cache ships, and name none; check your cache's own
> documentation. The flash-sale plan is design practice stated as mechanism. Code was **not
> executed**. **No sandbox run.**

**You cannot defend a hot key you have not identified, and the identification has to be cheap,
bounded in memory, and — for the events you know are coming — unnecessary, because the
storefront's marketing calendar already knows which SKU will be hot.** This is the operational
close of the topic: [06](06-hot-keys-and-skew.md) named the skew, [06b](06b-the-l1s-price-and-what-it-cannot-fix.md),
[06c](06c-key-replication-and-request-splitting.md) and [06d](06d-write-hot-keys-and-sharded-stock.md)
built the defences, and this chunk is how you find the keys to defend, then the whole flash-sale
design put together with its staleness per layer.

The interviewer's follow-up to every defence is "how do you know which keys?" and the weak
answer is "monitor it". The strong answer separates **predictable** skew (a scheduled sale, a
launch, an influencer campaign — declare the hot list in advance) from **emergent** skew (a
post goes viral — detect it with a bounded counter and promote automatically), and states the
detection lag honestly.

## Reading the node-level signals

Node metrics are the cheap first signal. They tell you *that* there is skew and *where*, not
*which key*:

- **Spread, not average:** per-node command rate, CPU, network in and out, and connection count,
  compared as max against median. One outlier across all four is the signature.
- **Keys versus requests per node:** an even key count with an uneven request rate is popularity
  skew; an uneven key count points at arcs or tags
  ([05](05-consistent-hashing.md)).
- **Latency by node:** a hot node degrades the cold keys that share it. The slowest node sets
  the tail for any request that fans out across nodes, such as a multi-key read.
- **Slot-level view:** for a slot-based store, the specification's rule that a slot is served by
  one node means a hot key identifies a hot *slot*, and the slot-to-node table tells you the
  owner:

> *"When the cluster is stable, a single hash slot will be served by a single node"*

That narrows the search to the keys in one slot or one node. To name the key you need a per-key
count.

## Counting per key without counting every key

Counting every key's requests exactly needs memory proportional to the number of distinct keys,
which is the thing you are avoiding. A **heavy-hitters summary** keeps a fixed number of
counters and still finds every key above a frequency threshold. The Misra–Gries summary is the
simplest:

```js
// Misra–Gries: k counters; finds all keys with frequency > n/(k+1)
export class HeavyHitters {
  #k; #counts = new Map(); #n = 0;
  constructor(k) { this.#k = k; }

  observe(key) {
    this.#n++;
    const c = this.#counts.get(key);
    if (c !== undefined) { this.#counts.set(key, c + 1); return; }
    if (this.#counts.size < this.#k) { this.#counts.set(key, 1); return; }
    // table full and key unseen: decrement everyone, drop zeros
    for (const [kk, v] of this.#counts) { if (v === 1) this.#counts.delete(kk); else this.#counts.set(kk, v - 1); }
  }

  // candidates: keys that MAY exceed the threshold; counts are underestimates
  candidates() { return [...this.#counts].sort((a, b) => b[1] - a[1]); }
  get total() { return this.#n; }
}
```

The guarantee, derivable in a few lines: each decrement step removes one occurrence from `k+1`
distinct keys at once (the `k` stored plus the arriving one), so at most `n/(k+1)` such steps
happen across `n` observations; a key occurring more often than `n/(k+1)` therefore cannot be
fully cancelled and is still in the table at the end. The table's counts are **underestimates**
and may include false candidates, so you treat the result as a shortlist and confirm with the
real rate (for instance a second exact counter for just the shortlisted keys). With `k = 50`, any
key taking more than one fifty-first of the observed requests is guaranteed to be in the
summary: that is the arithmetic, and the memory is `k` counters regardless of how many keys exist.

Where to run it:

- **In each client or app instance**, on the keys it reads. Cheap and local; each sees only its
  share, so aggregate the shortlists centrally and sum.
- **At the proxy or gateway** that fronts the cache, which sees every request and so counts the
  fleet-wide rate directly ([phase 2 gateways](../phase-2-request-path/03-reverse-proxies-and-api-gateways.md)).
- **On a sampled stream** — one request in `m` — if observing every request is itself too
  costly; scale counts by `m` and widen the shortlist.

### From detection to action

A shortlist is only useful if it drives the defences automatically, with hysteresis so keys do not
flap in and out of the hot set:

```text
every window (seconds):
  shortlist = heavy-hitters.candidates() above PROMOTE_RATE
  for key in shortlist not in hot set:      promote → add to L1 admission, create copies (06c)
  for key in hot set below DEMOTE_RATE for D windows:  demote → drop copies, evict from L1
  publish hot set (versioned) to all instances
```

`PROMOTE_RATE` is above `DEMOTE_RATE` by a margin, and demotion requires several quiet windows —
the gap is what prevents oscillation. The hot set is *advisory*: an instance with a stale copy of
it still works, because every defence falls back to the canonical key.

## Predictable skew: declare it

A scheduled flash sale is hot on the first second; detection with a one-second window would be
reacting to the event it was meant to prevent. For events the business already knows about:

1. The marketing or merchandising system publishes the SKUs and start time as a **pre-declared
   hot list**, which the same mechanism consumes as if the detector had found them.
2. The hot-set machinery runs **before** the start: copies created, L1s primed by a synthetic
   read, the CDN primed for the anonymous page.
3. A rehearsal at the real instance count — because the L2 load is `instances / TTL`, a test on
   two instances proves nothing about fifty.

Pre-warming and the cold-start problem it solves are the subject of
**Warming and cold starts** *(not written yet)* in this phase; here it is enough that the
hot list is the input.

## The flash-sale plan, layer by layer

The storefront's flash-sale SKU, one product, the whole audience, one start time. The plan is a
table of layers, each with what it holds, how stale it may be, and what protects it:

| Layer | Holds | Staleness the layer is allowed | What protects it |
|---|---|---|---|
| **Edge / CDN** | the anonymous product page and images | a short TTL, or purge on change | cache key excludes cookies; purge on price change ([phase 2 CDNs](../phase-2-request-path/05-cdns.md)) |
| **Rate limit / queue** | admission to checkout | none — it is a gate | per-user and per-IP limits ([phase 2 rate limiting](../phase-2-request-path/07-rate-limiting.md)); abuse controls ([phase 2 abuse](../phase-2-request-path/18-abuse-at-the-edge.md)) |
| **L1 per instance** | product detail for the SKU | the L1 TTL, with jitter | bounded size; admission from the hot list |
| **L2, replicated** | product detail copies on distinct nodes | until all copies are updated | `pickSuffixes`; registry; canonical fall-back |
| **Stock display** | an approximate remaining figure from a sharded counter | a second or two, stated | labelled "low stock" rather than an exact number |
| **Stock decrement** | the authoritative quantity | none — it is the truth | conditional `UPDATE … WHERE qty > 0`, sharded rows if the single row is the contention |
| **Cart and session** | per-user state | not shared; not hot | per-user keys spread naturally |
| **Order write** | the order | none | transaction; idempotency key |

Three principles hold the table together. **Read paths may be stale by a declared amount; the
decision path may not be stale at all.** **Every shared layer has a fallback to the layer behind
it**, so a missing copy or a missing registry entry costs load, never correctness. **Every
defence is bounded in memory and time**, because a sale ends and the machinery must demote.

### What goes wrong at the start of a sale

- The first second is a synchronised miss at every layer — instances start with cold L1s, the CDN
  has not yet cached, copies expire together. Prime in advance and jitter.
- The owning node of the canonical key is the first to feel it. With copies in place the canonical
  key sees only fall-back traffic.
- The database sees the conditional updates for one SKU. If one row is the contention, shard the
  stock; if the database is the bottleneck even then, the gate in front (rate limit or queue)
  is what keeps the load inside what it can bear. Caches do not help writes.
- The cache node holding a copy fails mid-sale. Its keys miss, readers fall back to the canonical
  copy or the database, and single-flight stops the refill from being a stampede (see
  **Stampede and thundering herd** *(not written yet)*).

## Gotchas

**★ Symptom: the hot key is detected a minute into a thirty-second sale.** Cause: detection has a
lag of at least one window plus propagation, and the event is shorter than that. Fix: pre-declare
scheduled hot keys and run the defences before the start; reserve automatic detection for emergent
skew, and size its window and propagation delay against the shortest event you care about.

**★ Symptom: the heavy-hitters shortlist misses a key that is clearly hot.** Cause: each app
instance observed only its share, and the key was below the per-instance threshold everywhere
even though the fleet-wide total was above it. Fix: aggregate shortlists across instances before
thresholding, or count at a point that sees all traffic (the proxy), or lower the per-instance
threshold to the fleet threshold divided by the instance count.

**★ Symptom: keys flap in and out of the hot set and copies are created and deleted constantly.**
Cause: one threshold for promotion and demotion, and a rate that hovers around it. Fix: two
thresholds with a margin, demotion only after several quiet windows, and copies created with a
TTL so a missed demotion cleans itself up.

**★ Symptom: the summary's counts are lower than the real rates and the dashboard understates
the problem.** Cause: Misra–Gries counts are underestimates by construction (every decrement
step lowers them). Fix: use the summary to *find* candidates and a precise counter for those
few to *measure* them; never alert on the summary's raw count as if it were the rate.

**★ Symptom: a load test passed and the sale still melted a node.** Cause: the test drew keys
uniformly (or used two instances), so no key was hot and the L2 load formula was never exercised.
Fix: drive the test with a deliberately skewed key distribution that includes one dominant key,
at the production instance count, and watch max-over-median across nodes, not the mean.

**★ Symptom: the cache is healthy and the database row is on fire.** Cause: the hot key was
fixed at the cache layer but the *write* (stock decrement) still serialises on one row's lock.
Fix: shard the rows ([06d](06d-write-hot-keys-and-sharded-stock.md)) and place a gate in front;
caches cannot absorb writes.

**Symptom: the "viral" key is a bot hammering one SKU.** Cause: the skew is not organic demand.
Fix: apply abuse controls at the edge before spending cache capacity on it
([phase 2 abuse](../phase-2-request-path/18-abuse-at-the-edge.md)); a rate limit per client is a
skew defence too.

**Symptom: the hot-set publication is itself a hot key.** Cause: every instance polls one key
for the list each second. Fix: poll infrequently with jitter, push via a bus, and keep the list
small; the L1 mechanism applies to it as well.

**Symptom: promoted copies sit in the cache after the sale and nobody removes them.** Cause: no
demotion path, no TTL on the copies. Fix: copies carry a TTL; demotion deletes the registry
entry first so no reader picks a copy, then the copies.

## Interview questions

**★ How do you find hot keys in production?**
Node-level metrics first, as a max-over-median spread, to localise the node or slot; then
per-key counting with a bounded heavy-hitters summary (Misra–Gries, fixed `k` counters, finds
every key above `n/(k+1)` of traffic with counts that are underestimates) at the client, the
proxy or on a sample, aggregated across instances; then confirm shortlisted keys with an exact
counter. I could not confirm the built-in hot-key tools of a particular cache, so I would name
the technique, not a command.

**★ Walk me through the flash-sale SKU end to end.**
Edge page cached for anonymous users with a short TTL and a cookie-free key; a rate limit and
abuse gate in front of checkout; an L1 per instance with jitter and admission from a
pre-declared hot list; the product-detail key replicated under suffixed names on distinct nodes
with the canonical key as fallback; stock displayed from a sharded counter with a stated
staleness; the stock decrement a conditional database update, sharded across rows if one row is
the contention; and pre-warming plus a rehearsal at the real instance count. The sentence to say:
read paths may be stale by a declared amount, the decision path may not be.

**★ Predictable versus emergent hot keys — how do the designs differ?**
Predictable ones are declared by the business ahead of time and the defences are in place before
the first request, so detection lag never matters. Emergent ones need an automatic loop —
count, shortlist, promote, publish, demote — with hysteresis, and an honest statement of the
lag. A candidate who proposes only detection for a scheduled sale has missed the easy half.

**★ Why do you need hysteresis in promoting and demoting hot keys?**
A single threshold with a noisy rate flips the key repeatedly, and each flip creates or deletes
copies and invalidates L1 entries, adding load exactly when the key is hot. Two thresholds with
a margin and several quiet windows before demotion make the set stable.

**How do you load-test for skew?**
Use a skewed key distribution with a dominant key, the production instance count (the L2 load
for a hot key scales as `instances / TTL`), and judge by max-over-median node metrics. A uniform
test proves nothing about the failure.

**What happens when the node holding a hot key's copy fails mid-sale?**
Reads for that copy miss, fall back to the canonical key or the database, and the refill must be
single-flight so the miss does not become a stampede. Headroom per node and the fall-back path
are what matter, which is why the canonical key is never removed.

**Is a slot or a ring position the unit of skew?**
Neither is the cause: popularity is a property of the keys. The ring or the slot determines which
node bears it. In a slot-based store a hot key makes a hot slot and the slot's owner is the hot
node; in a ring the key's position does the same job.

{/* FOOTER */}
