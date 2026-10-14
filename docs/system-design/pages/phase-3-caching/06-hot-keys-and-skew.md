---
title: "A hash balances keys, not requests, so one celebrity profile or one flash-sale SKU puts a whole fleet's worth of traffic on a single node that no amount of resharding can unload — and the first defence is a small, short-lived local cache in front of the distributed one"
sidebar_label: "06 · Hot keys and skew"
sidebar_position: 6
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-10-14 against the Redis Cluster specification
> ([redis.io](https://redis.io/docs/latest/operate/oss_and_stack/reference/cluster-spec/),
> fetched 2026-10-14), the Cassandra Dynamo-style architecture page
> ([cassandra.apache.org](https://cassandra.apache.org/doc/latest/cassandra/architecture/dynamo.html),
> banked 2026-09-08) and RFC 5861 ([rfc-editor.org](https://www.rfc-editor.org/rfc/rfc5861.html),
> banked 2026-09-08). Skew, local-tier caching, key replication and request splitting are
> **common practice stated as mechanism** — no source defines them, so no hit-ratio, traffic
> multiple or latency figure appears. The Caffeine behaviours named in the code are described
> from its documented API shape and were **not re-checked against the javadoc**. The code was
> **not executed**. **No sandbox run.**

**A hash function spreads *keys* evenly; traffic is not spread evenly across keys, so the node
that owns the most popular key is hot no matter how many nodes there are.** That is the whole
topic in one sentence, and it defeats the instinct the previous topic builds ("scale the fleet
by adding nodes") because [consistent hashing](05-consistent-hashing.md) puts a given key on
exactly one node, in a ring of three or of three hundred. The storefront's flash-sale SKU is the
clean case: ten thousand people reload one product page, every one of them reads the same cache
key, and one cache node serves all of it while its neighbours idle.

The interviewer is probing three things. Do you see that the cluster-average metric hides the
failure? Do you have a **layered** answer — local cache, replication, splitting — rather than
"shard more"? And do you know where each layer's staleness comes from, because every one of
them trades freshness for relief, and a flash sale is exactly where freshness (the stock
count) is the thing customers care about.

## Where skew comes from

"Hot key" is the loud case; the quieter forms have the same cure-or-not logic, so name them:

| Form | What is hot | Example in the storefront | Which defence applies |
|---|---|---|---|
| **Read-hot key** | one key, enormous read rate | the flash-sale SKU's product-detail entry | local tier, key replication |
| **Write-hot key** | one key, enormous write rate | the stock counter decremented on every order; a "views" counter | splitting the counter ([06d](06d-write-hot-keys-and-sharded-stock.md)) |
| **Hot slot or tag** | many keys forced onto one position by a shared tag | every key tagged `{sale-42}` in Redis Cluster | remove the tag, or split it |
| **Hot big value** | one key whose *value* is large, so bandwidth, not request rate, saturates | the full catalogue listing as one JSON blob | split the value, compress, move to the edge |
| **Hot shard by data shape** | a skewed partitioning attribute | all of one huge tenant's keys under one prefix on one node | re-key with a finer attribute |
| **Hot miss** | a key that is *absent* and requested constantly | an enumerated or deleted SKU everyone still asks for | negative caching *(see **Negative caching and penetration** *(not written yet)*)* |

Redis Cluster's specification states the structural fact behind the first row — a slot, hence a
key, is served by one node:

> *"When the cluster is stable, a single hash slot will be served by a single node (however the serving node can have one or more replicas that will replace it in the case of net splits or failures, and that can be used in order to scale read operations where reading stale data is acceptable)."*

Read that sentence for both halves. One node serves the slot: that is the ceiling. Replicas can
scale *reads* — **where reading stale data is acceptable**: that is the price, and it is the
same price every defence on this page charges.

## Why the average hides it

The failure signature is a **maximum**, not a mean. One node pegged on CPU or on its network
interface; its siblings at a fraction. The cluster's average utilisation looks healthy, the
capacity dashboard says there is headroom, and the on-call is told to add nodes. Adding a node
changes the mean and leaves the maximum untouched, because the hot key does not move.

Cassandra's documentation makes the general point about uneven ranges, which is the *key-count*
cousin of this problem:

> *"Cassandra seeks to avoid token imbalance because uneven token ranges lead to uneven request load."*

Token imbalance is fixable with virtual nodes. **Popularity imbalance is not**: it is a property
of the workload, not of the placement, so no placement algorithm can fix it. The rest of this
page is what you do about a workload that is skewed.

Practical consequences for monitoring, before any code:

- Alert on the **maximum** and the **spread** across nodes (max over median) for CPU, network
  throughput, command rate and connection count. A mean alert will not fire.
- Compare *keys per node* with *requests per node*. Even key counts with uneven request rates
  mean popularity skew; uneven key counts mean arc or tag skew
  ([05](05-consistent-hashing.md)).
- A hot node usually presents as **latency on every key that lives there**, not only the hot
  one — the cold keys sharing the node queue behind the hot key's traffic. The symptom reported
  by users is "some pages are slow", which is why it is mistaken for a database problem.

## The first defence: a local cache in front of the distributed one

The cheapest relief is to stop sending the hot key to the node at all. Each application
instance keeps a **small, in-process cache** (an L1) in front of the shared cache (the L2):

```text
request → L1 (in-process, per instance) → L2 (distributed cache, one owner per key) → database
```

If the hot key is requested ten thousand times a second across fifty instances, then with an L1
TTL of one second each instance asks the L2 for it at most about once per second, so the L2
sees on the order of fifty requests a second instead of ten thousand. That is arithmetic on the
instance count and the TTL, not a measured number: **the L2's load for a hot key becomes
`instances / TTL`, independent of the user request rate.** The hot key's cost has been converted
from "proportional to traffic" to "proportional to fleet size".

This is also why the L1 must be small. It is not a second copy of the cache; it holds only what
is hot, bounded by entry count, and it expires fast. See phase 3's chunk on where a cache can
live — **Where a cache can live** *(not written yet)* — for the placement ladder and
**In-process caches in Node and Java** *(not written yet)* for the eviction and drift mechanics.

### A bounded L1 with refresh-behind in Node

```js
const L1_TTL_MS = 1_000;
const L1_MAX = 5_000;

const l1 = new Map();         // key -> { value, expires }
const inflight = new Map();   // key -> Promise  (single-flight on L1 miss)

export async function get(key, loadFromL2) {
  const hit = l1.get(key);
  const now = Date.now();
  if (hit && hit.expires > now) return hit.value;

  // coalesce: concurrent misses on this key in THIS process share one L2 call
  if (inflight.has(key)) return inflight.get(key);
  const p = loadFromL2(key)
    .then((value) => {
      // jitter so instances do not all expire the same key in the same millisecond
      const ttl = L1_TTL_MS * (0.8 + Math.random() * 0.4);
      if (l1.size >= L1_MAX) l1.delete(l1.keys().next().value);   // crude FIFO bound
      l1.set(key, { value, expires: Date.now() + ttl });
      return value;
    })
    .finally(() => inflight.delete(key));
  inflight.set(key, p);
  return p;
}
```

Three things in that snippet are the design. The **bound** (`L1_MAX`) keeps the L1 from becoming
a memory problem. The **single-flight map** means that even within one process, a thousand
concurrent requests at the moment of expiry produce one L2 call, not a thousand. The **jitter**
means fifty instances do not all expire the key together and hit the owning node in the same
instant. The FIFO eviction is deliberately crude — a real L1 should use an admission-aware
policy (Caffeine's is quoted in **Eviction policies** *(not written yet)*).

### The same thing on the JVM

```java
LoadingCache<String, Product> l1 = Caffeine.newBuilder()
    .maximumSize(5_000)
    .expireAfterWrite(Duration.ofSeconds(1))
    .refreshAfterWrite(Duration.ofMillis(500))     // refresh behind the reader
    .build(key -> redisProduct.load(key));          // L2 call; concurrent loads for a key are coalesced
```

`expireAfterWrite` is the staleness cap; `refreshAfterWrite` reloads an entry in the background
after it has aged, so readers keep getting the current value while one load runs — the same
shape as the HTTP protocol's stale-while-revalidate, whose permission sentence is:

> *"caches MAY serve the response in which it appears after it becomes stale, up to the indicated number of seconds."* — RFC 5861 §3

As I recall its API, Caffeine's loading cache computes a missing value once per key while other
callers for the same key wait, which is the single-flight behaviour built by hand in the Node
version. I could not confirm that contract against the javadoc here, so verify it there before
depending on it for correctness.

Everything the L1 saves, it charges for in freshness. That bill — the staleness window, the
invalidation gap and the limits of the pattern — is [06b](06b-the-l1s-price-and-what-it-cannot-fix.md).

## Gotchas

**★ Symptom: the cache cluster shows 30 % average CPU and one node is at 100 %, and the
dashboard says there is headroom.** Cause: popularity skew — one key's traffic lands on one
owner and the mean averages it away. Adding a node leaves the maximum where it is. Fix: alert and
capacity-plan on the max and the max/median spread, identify the hot keys (see
[06e](06e-detecting-skew-and-the-flash-sale-plan.md)), then apply an L1, replication or
splitting; resharding is not on the list.

**★ Symptom: "we added three nodes and the slow product page is still slow."** Cause: the page's
key hashes to one position, so there is still exactly one owner; consistent hashing moved other
keys. Fix: same as above. The question to ask in the incident is "which key?", not "how many
nodes?".

**★ Symptom: every instance misses the hot key at the same instant and the owning node
spikes, repeatedly, on a regular beat.** Cause: all instances loaded the key at the same moment
(a deploy, or a purge) with the same TTL, so they expire together. Fix: jitter the L1 TTL as in
the code above, and use refresh-behind so readers are not the ones who pay for the reload.

**★ Symptom: an enormous single value saturates the node's network interface at modest request
rates.** Cause: hot-*big*-value skew — bandwidth, not command rate, is the limit; the catalogue
listing as one blob multiplies every read by its size. Fix: break the value into pages or
fragments that spread across keys, compress it, and serve genuinely public blobs from the edge
([phase 2 CDNs](../phase-2-request-path/05-cdns.md)) so they never reach the cache tier.

**Symptom: a hot key appears the moment a tag is introduced.** Cause: hash tags in Redis
Cluster hash only the section between the braces, so a tag on a whole population puts the
population in one slot (see [05b](05b-replica-placement-and-where-the-ring-is-used.md)). Fix:
remove the tag, or tag only small groups that need multi-key operations.

**Symptom: the L1 hides a hot key during testing and the production fleet is hit anyway.**
Cause: tests ran on one instance, whose L1 absorbed everything; production has fifty instances
and the L2 load is `instances / TTL`, not one. Fix: reason about the L2 load as that formula and
load-test with the real instance count.

**Symptom: a hot *missing* key is served from the database every time.** Cause: nothing was
cached for "not found", so the L1 and L2 both miss on every request. Fix: cache the absence with
a short TTL — **Negative caching and penetration** *(not written yet)*.


## Interview questions

**★ What is a hot key, and why does adding cache nodes not fix it?**
A key whose request rate is far above its peers'. Consistent hashing or slot hashing places each
key on exactly one node, so the traffic for that key lands on one node regardless of fleet size;
more nodes shrink only the *other* keys' share. The Redis specification states the underlying
rule: a hash slot is served by a single node, with replicas available for scaling reads where
stale data is acceptable. The cure is to change *how the key is served*, not how many nodes
exist.

**★ Why can the cluster's average utilisation look fine while the system is failing?**
Because the failure is a maximum. One node saturates and every request touching it — hot key and
cold neighbours alike — slows, while the mean across nodes stays low. Monitor the max and the
spread, and compare key counts against request counts per node to tell popularity skew from
arc skew.

**★ Describe the local-cache-in-front pattern and quantify its effect honestly.**
Each app instance holds a small, bounded, short-TTL in-process cache for hot keys. The L2's load
for a hot key becomes roughly the number of instances divided by the TTL, instead of the user
request rate — an argument from arithmetic, not a measurement, and the claim to make. Name the
costs: the staleness window equals the TTL per instance, instances disagree briefly, and
invalidation of the L2 does not reach the L1s.

**Why must the L1 be small and bounded?**
Because its job is the short list of keys hot enough to matter, and because it is
replicated in every instance: memory spent there is multiplied by the fleet size. An L1 that
grows toward the L2's key set duplicates the cache fifty times, evicts constantly and stops
protecting anything.

**What kinds of skew are there besides a popular read key?**
Write-hot keys (a counter), hot slots from shared tags, hot big values where bandwidth saturates
first, hot shards from a skewed partition attribute, and hot misses on absent keys. They share
the diagnosis (a maximum, not a mean) and differ in the cure.

**How does the L1 relate to HTTP stale-while-revalidate?**
It is the same idea implemented in process: serve the stale copy while one background load
refreshes, so no reader waits on the origin and only one request goes back. The RFC grants the
permission with a `MAY` — a cache *may* serve stale up to the indicated seconds — and it is
bounded: after that window it SHOULD NOT continue to be served stale. The L1's TTL plus refresh
window is the same two-number contract.

{/* FOOTER */}
