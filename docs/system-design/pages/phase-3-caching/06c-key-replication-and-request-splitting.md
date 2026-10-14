---
title: "When a local tier is not enough, make the hot key several keys — copies for reads, shards for writes — so the ring places the pieces on different nodes, and accept that the price is a fan-out on every write and a bookkeeping problem about which keys are hot"
sidebar_label: "06c · Key replication and request splitting"
sidebar_position: 6.2
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-10-14 against the Redis Cluster specification
> ([redis.io](https://redis.io/docs/latest/operate/oss_and_stack/reference/cluster-spec/),
> fetched 2026-10-14) for the replica-reads sentence, and the Cassandra Dynamo-style page
> ([cassandra.apache.org](https://cassandra.apache.org/doc/latest/cassandra/architecture/dynamo.html),
> banked 2026-09-08) for ring placement. Hot-key replication, request splitting, sharded counters
> and sharded stock rows are **common practice stated as mechanism**, not cited; the SQL is
> standard and was **not executed**. No copy count, shard count or speedup is stated.
> **No sandbox run.**

**The ring puts one key on one node, so if one key is too hot for one node, make it not one key:
copies of a read-hot value under suffixed names, shards of a write-hot counter under suffixed
names, and let the hash place the pieces on different nodes.** That is the whole trick, and it
costs a write fan-out, a registry of which keys are split, and a consistency story. This chunk
continues [06](06-hot-keys-and-skew.md) and [06b](06b-the-l1s-price-and-what-it-cannot-fix.md)
for the case where an L1 cannot carry the load: the hot set is too big for process memory, the
staleness is too visible, or the key is written as hard as it is read.

The interviewer is checking whether you can distinguish three different things that all get
called "splitting": **replicating** a read-hot key, **sharding** a write-hot key, and
**splitting a big value**. They have different consistency properties and different failure
modes, and the wrong one on the wrong problem makes it worse.

This chunk covers the first and third; the write-hot case is [06d](06d-write-hot-keys-and-sharded-stock.md).

## Replicating a read-hot key

Store the same value under `c` names, `product:42#0 … product:42#(c-1)`. Each name hashes to its
own ring position, so each copy lives on its own owner. A read picks one copy; a write updates
all of them.

```js
const COPIES = new Map([['product:42', 4]]);       // hot-key registry: key -> copy count

function copyName(key, i) { return `${key}#${i}`; }

export async function readHot(cache, key, pick = () => Math.random()) {
  const c = COPIES.get(key);
  if (!c) return cache.get(key);                    // the normal path: not split
  const i = Math.floor(pick() * c);
  const v = await cache.get(copyName(key, i));
  return v ?? cache.get(key);                       // fall back to the canonical key
}

export async function writeHot(cache, key, value, ttlSeconds) {
  const c = COPIES.get(key);
  await cache.set(key, value, ttlSeconds);          // canonical
  if (c) await Promise.all(Array.from({ length: c }, (_, i) => cache.set(copyName(key, i), value, ttlSeconds)));
}
```

The canonical (unsuffixed) key stays the source for the non-split path, so a copy missing from
its node falls back rather than hitting the database. A delete or purge must remove **every**
copy; the registry is the list of names that need it.

### Making sure the copies land on different nodes

Suffixes are hashed independently, so `c` copies on `N` nodes can collide on one node by chance.
The chance is the birthday problem: that `c` independent uniform placements are all distinct is
`(N-1)/N · (N-2)/N · … · (N-c+1)/N`, which is below one for any `c > 1` and gets worse as `c`
approaches `N`. Do not leave it to luck. Because the ring is deterministic, you can **choose
suffixes whose owners are distinct**:

```js
export function pickSuffixes(ring, key, copies, maxTries = 64) {
  const used = new Set(), out = [];
  for (let i = 0; out.length < copies && i < maxTries; i++) {
    const owner = ring.owner(`${key}#${i}`);      // Ring from 05c
    if (!used.has(owner)) { used.add(owner); out.push(i); }
  }
  return out;                                     // suffix indexes to use, in order
}
```

This reuses the ring from [05c](05c-consistent-hashing-in-code-and-its-alternatives.md); it only
works if the client and the registry agree on the ring, so a membership change can break the
placement and the suffix list should be recomputed on a ring swap.

### Read replicas as the built-in version

Redis Cluster already offers a form of this at the node level. The specification's sentence,
quoted in [06](06-hot-keys-and-skew.md), says a slot's serving node *"can have one or more
replicas"* that *"can be used in order to scale read operations where reading stale data is
acceptable"*. Reading from replicas spreads a hot slot's reads over the master and its replicas
without touching key names at all, and you pay with replica lag. Key-suffix replication is the
tool when replicas are not enough, not available, or when you want the copies spread over
independent *slots* rather than behind one slot.

## Request splitting: choosing which copy a request reads

Which suffix a request reads is a policy with consequences:

| Policy | Mechanism | Property |
|---|---|---|
| **Random** | `Math.random()` per request | best load spread; one user can see two values on consecutive reads while copies are being updated |
| **Sticky by user** | `hash(userId) % c` | a user always reads the same copy, so their view is monotonic; spread is as even as users are |
| **Sticky by instance** | `instanceId % c` | fewest distinct reads of each copy; but instance populations are small and uneven |
| **Round-robin** | per-process counter | even spread; same cross-copy anomaly as random |

During a write, the copies are updated one after another, so for a short window some copies hold
the new value and some the old. With random selection one user can read new then old. If that
matters for the key — the stock indicator is the obvious case — use sticky-by-user, which makes
each user's sequence of reads consistent even if different users disagree.

Splitting the *requests* is also what an L1 does, at the process level. The difference worth
stating in an interview is where the copies live: an L1 puts `I` copies in application memory,
replication puts `c` copies in the cache tier on `c` nodes. L1 is cheaper and staler;
replication is a network hop slower and fresher.

## Splitting a big value

If the hot thing is bandwidth — one huge value — splitting the *value* is the cure, not
replicating it. Store the listing as pages or as a head record plus chunk keys, so a reader
fetches only what it renders, and chunks hash to different nodes. A reader needs the head to
learn the chunk names, and a writer must replace the head last so a reader never sees a head
pointing at chunks that have not been written. This is a layout change, not a replication one,
and it is the right fix for the "whole catalogue as one JSON blob" form of skew.

## Gotchas

**★ Symptom: after a product update, some users see the new value and some the old for longer
than expected.** Cause: replicated copies are written in sequence, one write failed or timed
out, and that copy keeps the old value until its TTL. Fix: write the copies in parallel, treat a
failed copy write as a reason to delete that copy (so reads fall back to the canonical key),
and give copies a TTL no longer than the staleness the key tolerates.

**★ Symptom: a purge of a replicated key "did not work" for some users.** Cause: only the
canonical key was deleted; the suffixed copies remained. Fix: purge by registry — deleting a
key must delete `key` and every `key#i` — and put that logic in the client, never in callers.

**★ Symptom: the "replicated" hot key is still hot on one node.** Cause: the copy names hashed
to the same node by chance (the birthday collision) or after a ring change moved them together.
Fix: choose suffixes by owner as in `pickSuffixes`, and recompute when the ring is swapped.

**★ Symptom: memory climbs on every node after promoting a handful of keys.** Cause: each copy
is a full copy of the value, `c` of them, and an over-generous registry keeps copies of keys that
are no longer hot. Fix: promote only measured hot keys, demote by deleting copies, and let
copy TTLs expire so a forgotten demotion cannot hold memory indefinitely.

**★ Symptom: a user sees the price go up then down within a session.** Cause: random copy
selection while copies are being updated returns new then old. Fix: choose the copy by
`hash(userId) % c` so a user's reads are consistent, accepting that different users may briefly
disagree.

**Symptom: the hot-key registry is stale and a key is promoted on some instances and not
others.** Cause: the registry is distributed by config or pub/sub and instances apply it at
different times. Fix: the canonical key must always work (fall back to it), so a missing
registry entry costs only load, never correctness; keep the registry itself small and
version it.

**Symptom: a split value is read as a head pointing at chunks that do not exist yet.** Cause:
the head was written before the chunks. Fix: write chunks first, head last, and make the head
carry a version so a reader detects mismatched chunks and retries.

## Interview questions

**★ How do you handle a key too hot for one node when an L1 will not do?**
Replicate it under suffixed names so the ring places copies on different nodes; reads pick a
copy, writes update all, and a registry says which keys are split. Choose the suffixes so their
owners are distinct rather than hoping, keep the canonical key as a fall-back, and decide the
selection policy by how much read consistency the key needs. Name the costs: write fan-out,
extra memory times the copy count, purge by registry, and divergence on partial failure.

**★ Replication or sharding — which for which?**
Replication is for a read-hot key: the value is the same and reads can go to any copy. Sharding
is for a write-hot key: each write goes to one shard and a reader aggregates. Replicating a
write-hot key multiplies the writes; sharding a read-hot key makes every read a gather. Say that
sentence and you have shown the distinction most candidates blur.

**★ What consistency can a reader expect from replicated copies?**
No cross-copy atomicity: during a write, copies are updated in turn, so readers may see either
value. With random selection one reader can go backwards; with sticky-by-user selection each
user's reads are monotonic. Stronger guarantees would need the write to coordinate across copies,
which defeats the purpose of splitting the load.

**How many copies should a hot key have?**
There is no documented number and a reasoned answer starts from the per-node ceiling: enough
copies that `U / c` per node is within a node's capacity, with headroom, and no more because each
copy costs memory and write fan-out. Measure the hot key's rate, divide, and re-check as traffic
changes — a number invented in advance is the wrong answer.

**How do read replicas compare with key suffixing?**
Replicas are built in: a slot's node can have replicas that scale reads where stale data is
acceptable, no key renaming required, at the price of replica lag, and all of them back the same
slot. Suffixing makes independent keys in independent slots, which spreads beyond one slot's
group and works with systems without replicas, at the price of application-side bookkeeping.

**How do you split a large hot value?**
By layout: a head record listing chunk keys and the chunks themselves, written chunks-first and
head-last, so a reader fetches only the parts it renders and the parts spread across nodes.
Compress and serve public blobs from the edge too.

{/* FOOTER */}
