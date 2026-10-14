---
title: "A ring is a sorted array plus a binary search, and the bugs live in what surrounds it — determinism across clients, immutable swaps on membership change, multi-key fan-out — while rendezvous hashing, jump hashing and bounded loads each beat it on one axis and lose on another"
sidebar_label: "05c · The ring in code, and its alternatives"
sidebar_position: 5.2
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-10-14. The ring structure follows the mechanism described in the Cassandra
> Dynamo-style architecture page ([cassandra.apache.org](https://cassandra.apache.org/doc/latest/cassandra/architecture/dynamo.html),
> banked 2026-09-08). Rendezvous hashing, jump consistent hashing and consistent hashing with
> bounded loads are **named from memory as published algorithms and described as mechanism; their
> papers were not fetched**, and no performance or balance figure is attributed to any of them.
> The code is original and **was not executed**. **No sandbox run.**

**The ring is about twenty lines; what makes it production-grade is making every client build
the byte-identical ring, swapping it atomically when membership changes, and grouping multi-key
reads by owner.** After the structure in [05](05-consistent-hashing.md) and the replica rules in
[05b](05b-replica-placement-and-where-the-ring-is-used.md), this chunk is the implementation in
Node and in Java, the three alternative algorithms and what each trades away, and the
operational failure list.

## The ring in Node

```js
import { createHash } from 'node:crypto';

// Contract shared with every other client: UTF-8 input, MD5, first 4 bytes, big-endian, unsigned.
const h32 = (s) => createHash('md5').update(s, 'utf8').digest().readUInt32BE(0);

export class Ring {
  #pos;    // Uint32Array of sorted positions
  #owner;  // parallel array: index into #nodes
  #nodes;

  constructor(nodes, vnodes) {
    // sort first: a hash collision between two labels must resolve the same way everywhere
    this.#nodes = [...nodes].sort();
    const pts = [];
    this.#nodes.forEach((n, i) => {
      for (let v = 0; v < vnodes; v++) pts.push([h32(`${n}#${v}`), i]);
    });
    pts.sort((a, b) => a[0] - b[0] || a[1] - b[1]);       // total order, deterministic
    this.#pos = Uint32Array.from(pts, (p) => p[0]);
    this.#owner = pts.map((p) => p[1]);
  }

  #first(k) {                                              // first position >= k, wrapping
    let lo = 0, hi = this.#pos.length;
    while (lo < hi) { const mid = (lo + hi) >>> 1; this.#pos[mid] < k ? (lo = mid + 1) : (hi = mid); }
    return lo === this.#pos.length ? 0 : lo;
  }

  owner(key) { return this.#nodes[this.#owner[this.#first(h32(key))]]; }

  // preference list: walk until r DISTINCT machines
  preference(key, r) {
    const out = new Set();
    const n = this.#pos.length;
    for (let i = this.#first(h32(key)), seen = 0; out.size < Math.min(r, this.#nodes.length) && seen < n; i = (i + 1) % n, seen++) {
      out.add(this.#nodes[this.#owner[i]]);
    }
    return [...out];
  }
}
```

Three details carry the weight. The constructor **sorts the node list** and breaks position ties
by node index, so two clients given the same set in different orders build identical rings. The
lookup returns index `0` when the search runs off the end, which is the wrap. `preference` bounds
its walk by the total number of positions and by the node count, so asking for `r` larger than
the fleet terminates instead of looping.

## The ring in Java

```java
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.*;

public final class Ring {
    private final NavigableMap<Long, String> ring = new TreeMap<>();
    private final int distinct;

    public Ring(Collection<String> nodes, int vnodes) {
        List<String> sorted = new ArrayList<>(nodes);
        Collections.sort(sorted);                            // deterministic on collisions
        this.distinct = sorted.size();
        for (String n : sorted)
            for (int v = 0; v < vnodes; v++)
                ring.putIfAbsent(h32(n + "#" + v), n);       // first writer wins, order is fixed
    }

    // same contract as the Node client: MD5, first 4 bytes, big-endian, as UNSIGNED
    static long h32(String s) {
        try {
            byte[] d = MessageDigest.getInstance("MD5").digest(s.getBytes(StandardCharsets.UTF_8));
            return ((d[0] & 0xFFL) << 24) | ((d[1] & 0xFFL) << 16) | ((d[2] & 0xFFL) << 8) | (d[3] & 0xFFL);
        } catch (java.security.NoSuchAlgorithmException e) { throw new IllegalStateException(e); }
    }

    public String owner(String key) {
        Map.Entry<Long, String> e = ring.ceilingEntry(h32(key));
        return (e != null ? e : ring.firstEntry()).getValue();
    }

    public List<String> preference(String key, int r) {
        LinkedHashSet<String> out = new LinkedHashSet<>();
        long start = h32(key);
        for (Map.Entry<Long, String> e : ring.tailMap(start, true).entrySet()) {
            out.add(e.getValue()); if (out.size() == Math.min(r, distinct)) return new ArrayList<>(out);
        }
        for (Map.Entry<Long, String> e : ring.entrySet()) {          // wrap around
            out.add(e.getValue()); if (out.size() == Math.min(r, distinct)) break;
        }
        return new ArrayList<>(out);
    }
}
```

The two classes agree only because both use the unsigned 32-bit value of the first four MD5
bytes and the same `name#index` label. Java's `byte` is signed, so the `& 0xFF` masks and the
`long` are not decoration: a signed `int` here would sort negative positions *before* zero and
build a different ring from Node's. `TreeMap` is not thread-safe — see the gotchas for how the
ring is shared.

### Using it for a multi-key read

A `mget` for twenty product keys cannot be sent to one node. Group by owner, issue one request
per owner concurrently, and merge:

```js
async function mget(ring, clients, keys) {
  const byNode = Map.groupBy(keys, (k) => ring.owner(k));
  const parts = await Promise.all([...byNode].map(([node, ks]) => clients[node].mget(ks)));
  const out = new Map();
  [...byNode.values()].forEach((ks, i) => ks.forEach((k, j) => out.set(k, parts[i][j])));
  return out;
}
```

The fan-out is bounded by the number of distinct owners, not the number of keys, which is why a
ring-sharded client with a catalogue-page `mget` still costs a handful of round trips — and why
the slowest of those nodes sets the page's latency (see [06](06-hot-keys-and-skew.md)).

## Swapping the ring when membership changes

The ring is **immutable once built**. Membership changes build a new one and replace the
reference in a single assignment; readers that already hold the old one finish on it.

```java
private volatile Ring ring = new Ring(initialNodes, VNODES);

void onMembershipChange(Collection<String> nodes) {
    this.ring = new Ring(nodes, VNODES);     // build off to the side, publish atomically
}
```

Mutating a `TreeMap` while a request thread iterates it can throw or return a half-updated
view; building off to the side and publishing a `volatile` reference removes the whole class of
bug. In Node the single-threaded event loop avoids the data race but not the logic race of a
membership change landing between a `preference` call and its use.

## Alternatives, and what each gives up

**Rendezvous (highest-random-weight) hashing.** For each key, compute `score(key, node)` — a
hash of the pair — for every node and pick the highest. Removing a node moves exactly the keys
that scored highest on it, and they spread across all remaining nodes in proportion; adding a
node takes the keys on which it now scores highest. There is no ring, no virtual nodes and no
imbalance knob: evenness comes from the hash. The price is `O(N)` hashes per lookup instead of
`O(log M)`, which is trivial for a dozen cache nodes and awkward for thousands of backends.
Weighted variants exist; the mechanism is still "score every node".

**Jump consistent hash.** A tiny function mapping a 64-bit key and a bucket count to a bucket
number in `[0, n)` with no memory and near-perfect evenness, moving only about `1/(n+1)` of keys
when `n` grows by one. The restriction is structural: buckets are **numbered**, and you can only
add or remove at the *end*. It fits sharded data whose shards are numbered and replaced rather
than removed from the middle; it does not fit "cache-7 died, drop it".

**Consistent hashing with bounded loads.** The published variant caps each node at a multiple of
the average load (a configured ratio above 1); when a key's owner is full, the key walks on
clockwise to the next node with room. This bounds *key or connection count* skew across nodes —
useful for load-balancer affinity where one backend must not accumulate everything — at the cost
of **state**: the balancer must track current load per node, and a key's owner now depends on
what else happened to be assigned first. It bounds count imbalance; it does not bound the
traffic of one hot key.

| Algorithm | Lookup cost | Needs vnodes | Arbitrary node removal | State beyond the node list |
|---|---|---|---|---|
| Ring | `O(log M)` | yes, for evenness | yes | none |
| Rendezvous | `O(N)` | no | yes | none |
| Jump hash | fast, no table | no | no — end only | the bucket count |
| Bounded loads | ring walk | yes | yes | per-node load |
| Fixed slots (Redis Cluster) | table lookup | n/a | yes, by moving slots | the slot table |

## Gotchas

**★ Symptom: a `TreeMap` ring throws `ConcurrentModificationException` or returns wrong owners
under load.** Cause: the ring was mutated in place while request threads were reading it, and
`TreeMap` is unsynchronised. Fix: never mutate; build a new `Ring` and publish it through a
`volatile` (or `AtomicReference`) field, as shown above.

**★ Symptom: the Java and Node clients disagree on some keys and only those.** Cause: signed
versus unsigned arithmetic — a Java `int` hash sorts half the positions below zero, or a
`readInt32BE` was used instead of `readUInt32BE`. Fix: compute positions as unsigned (a `long`
masked with `0xFFFFFFFFL` in Java, `readUInt32BE` in Node) and commit shared test vectors of
keys and expected owners to both repositories.

**★ Symptom: two nodes whose labels collide at the same position make ownership depend on
startup order.** Cause: `Map.put` or a stable sort that is not total — whichever label is
inserted first wins, and clients enumerate nodes in different orders. Fix: sort the node list
before building and break position ties by a total order (node index or name), as both
implementations do.

**★ Symptom: `mget` of a product page got slower after sharding.** Cause: the keys were sent
one at a time, or a sequential loop awaited each node in turn; with a ring, keys for one page
scatter over most nodes. Fix: group by owner and issue the per-node requests concurrently, so
latency is the slowest owner rather than the sum — and accept that the slowest owner sets the
tail, which is a reason to keep page-level keys coarse.

**★ Symptom: a node was removed from the list and a few seconds later some requests still go to
it.** Cause: in-flight requests hold the old ring, connection pools to the dead node still
exist, or a second source of membership (a static config) re-adds it. Fix: one membership
source, atomic ring swap, and drain the old pool after the swap rather than before.

**Symptom: bounded-loads balancing behaves differently on two balancer instances.** Cause: the
owner depends on current per-node load, which each instance tracks locally, so identical keys
can land differently. Fix: use it only where affinity is a preference rather than a correctness
requirement, or share the load table; it is the wrong tool for a cache whose clients must agree.

**Symptom: jump hash was chosen and now one failed cache node cannot be dropped.** Cause: jump
hash only supports resizing at the end of the bucket range; removing bucket 3 of 8 would
renumber 4–7. Fix: if arbitrary removal matters, use a ring, rendezvous or slots; if you keep
jump hash, replace the dead bucket's backend in place so the numbering does not change.

**Symptom: rendezvous hashing was fine at 10 nodes and is a CPU line item at 2,000.** Cause:
`O(N)` score computations per lookup, per request. Fix: switch to a ring or slots at that
scale, or hash to a bounded group first and run rendezvous inside it.

**Symptom: every lookup allocates and the ring is rebuilt on a hot path.** Cause: the
constructor was called per request or per membership *poll* even when the list had not changed.
Fix: compare the sorted node list with the current one and rebuild only on a real change.

**Symptom: tests pass yet the fleet is lopsided.** Cause: tests checked that lookup returns
*a* node, never how many of a large sample of keys each node gets. Fix: assert key counts per
node on a large sample within a tolerance you pick, and assert movement on a join — roughly
`1/(N+1)` of keys, with no key moving between two pre-existing nodes.

## Interview questions

**★ Implement a consistent hash ring.**
Sorted array of `(position, node)` pairs built from `V` labels per node, a binary search for the
first position at or after the key's hash, wrap to element zero past the end. Mention
determinism (sort nodes, total order on ties, fixed hash and encoding), `O(log M)` lookup and
immutability with an atomic swap. If asked for replicas, walk until `R` distinct physical nodes.
The mistakes interviewers listen for are forgetting the wrap and forgetting "distinct".

**★ When would you pick rendezvous hashing over a ring?**
When the node set is small enough that scoring every node per lookup is cheap, and you want no
virtual-node tuning: evenness comes from the hash, removal spreads load across survivors in
proportion, and weighting is a multiplier on the score. At large `N` the linear scan is the
reason to prefer a ring or slots.

**★ What is the limitation of jump consistent hash?**
Buckets are numbered `0..n-1`, so you can grow or shrink only at the end. It has near-ideal
evenness and minimal movement with no table, which suits numbered, replaceable shards, but it
cannot express "remove the node in the middle", the normal failure case for a cache fleet.

**★ What problem do bounded loads solve, and what do they cost?**
They stop a ring from overloading one node with *count* by capping each node at a multiple of
the average and spilling to the next clockwise node. The cost is statefulness: the owner of a key
depends on current load, so independent clients can disagree. It does not help one hot key — a
spilled hot key is just a hot key on a second node.

**How do you test that a ring implementation is correct?**
Four checks: determinism (shuffled input, identical owners); balance (key counts per node within
a chosen tolerance); minimal movement (on a join only about `1/(N+1)` of keys change owner and
none moves between two old nodes; on a leave only the dead node's keys move); and cross-language
vectors (fixed keys with committed expected owners in every client).

**What changes for a ring that fronts a data store with real data rather than a cache?**
Movement is no longer free: a join means streaming ranges, a leave means re-replicating, so
vnode count, replica placement and failure domains stop being tuning and become correctness and
operations. Cassandra's own documentation is about exactly that regime. A cache can simply let
misses refill.

{/* FOOTER */}
