---
title: "Consistent hashing exists because taking a hash modulo the node count remaps almost every key when the count changes, while a ring remaps only the arc a node gains or loses — and the ring is only as even as the number of virtual nodes you give it"
sidebar_label: "05 · Consistent hashing"
sidebar_position: 5
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-10-14 against the Cassandra Dynamo-style architecture page
> ([cassandra.apache.org](https://cassandra.apache.org/doc/latest/cassandra/architecture/dynamo.html),
> banked 2026-09-08) and the Dynamo paper §4.6 as quoted in the phase-0 research bank. The
> ring mathematics (the `N/(N+1)` remap fraction, arc-length imbalance) is **derived on the
> page, not cited** — no single authority states it. Cassandra is a data store, not a cache;
> it is quoted for the ring mechanics only. No node count, vnode count, movement fraction or
> variance bound is stated beyond what the derivation proves. **No sandbox run.**

**Consistent hashing is the answer to one question: when the set of cache nodes changes, how
many keys change owner? With `hash(key) % N` the answer is nearly all of them; with a ring the
answer is roughly one node's worth.** In a cache that difference is not a rebalancing detail —
every key that changes owner is a miss, and a miss on a cache in front of the storefront's
database is a query. Resize a modulo-sharded fleet at peak and you have turned a capacity
change into a cold start of the entire cache, and the database learns about it all at once.

The interviewer is rarely probing whether you can draw a circle. They are probing whether you
know *why* the circle needs virtual nodes, what a node leaving does to its neighbour, why the
algorithm still does nothing about a hot key (that is [06](06-hot-keys-and-skew.md)), and
whether you can say where it is used without claiming it is used where it is not. This page is
the mechanism and the derivation up to virtual nodes;
[05b](05b-replica-placement-and-where-the-ring-is-used.md) is replica placement and where rings
are and are not used, and [05c](05c-consistent-hashing-in-code-and-its-alternatives.md) is the
code, the variants that beat it in particular niches, and the operational failures.

## The problem: modulo remaps almost everything

The naive placement is `node = nodes[hash(key) % N]`. It is perfectly even and costs one
division. Its flaw appears the moment `N` changes. Cassandra's documentation states it in two
sentences:

> *"In naive data hashing, you typically allocate keys to buckets by taking a hash of the key modulo the number of buckets... adding a single node might invalidate almost all of the mappings."*

"Almost all" can be made exact. Take a uniform hash `h` and grow from `N` to `N+1` nodes. A key
keeps its node only if `h mod N == h mod (N+1)`. Over one full period of `N(N+1)` consecutive
hash values, that equality holds exactly when `h mod N(N+1)` is one of `0, 1, …, N-1` — that is
`N` values out of `N(N+1)`. So the fraction of keys that **stay** is `1/(N+1)` and the fraction
that **move** is `N/(N+1)`.

| Going from | Fraction of keys that stay | Fraction that move |
|---|---|---|
| `N` to `N+1` | `1/(N+1)` | `N/(N+1)` |

The more nodes you already have, the closer to "everything" the movement gets, which is
precisely backwards from what you want: the bigger the fleet, the more it hurts to add one.
The same arithmetic applies to *removing* a node, including the removal you did not choose when
one crashes and the client library drops it from the list.

The ideal is the minimum possible: when one of `N+1` nodes is added, the new node must take
`1/(N+1)` of the keys (it has to own *something*), and nobody else needs to lose anything
except to hand those keys over. With `K` keys that is `K/(N+1)` moved, versus `K·N/(N+1)` for
modulo. Cassandra states the goal:

> *"The main difference of consistent hashing to naive data hashing is that when the number of nodes (buckets) to hash into changes, consistent hashing only has to move a small fraction of the keys."*

"A small fraction" is the strongest claim the source makes; `K/(N+1)` is the mathematical
bound, and it is derived above rather than quoted.

## The ring

Take the output space of the hash function — say 32 bits, `0 … 2³²−1` — and bend it into a
circle so that the largest value is adjacent to zero. Now place **both** things on that circle
with the *same* hash function:

1. Each **node** is hashed (by a stable name, not by a transient address) to one or more
   positions on the ring. Cassandra calls these positions *tokens*.
2. Each **key** is hashed to a position on the ring.

A key belongs to the first node you meet walking clockwise from the key's position, wrapping
past the top back to zero. Cassandra's phrasing:

> *"Cassandra instead maps every node to one or more tokens on a continuous hash ring, and defines ownership by hashing a key onto the ring and then 'walking' the ring in one direction."*

Each node therefore owns the **arc** between its predecessor's position (exclusive) and its own
(inclusive). Ownership is a function of the *ordered set of positions* and nothing else; there
is no table of key-to-node assignments to maintain, which is the property that makes it usable
in a stateless client library.

```text
        positions (hash space, clockwise)         key → owner (first node clockwise)
        0 ──── A ──── B ──── C ──── (wrap)        k1 between 0 and A    → A
                                                  k2 between A and B    → B
                                                  k3 between C and wrap → A  (wraps)
```

### Lookup is a sorted-array search

Keep the node positions in a sorted array. To find a key's owner, hash the key and binary-search
for the first position greater than or equal to it; if the search runs off the end, take element
zero. That is `O(log M)` for `M` positions (nodes times virtual nodes), with no per-key state.
The code is in [05c](05c-consistent-hashing-in-code-and-its-alternatives.md); the point here is
that the whole data structure is a sorted list of integers and a back-pointer from each integer
to a node name.

### Adding a node

Insert node `D` at a position between `B` and `C`. The keys that were on the arc `(B, C]` used
to walk clockwise to `C`. Now the portion of that arc up to `D` walks to `D` instead. **Nothing
else changes:** keys owned by `A` and `B`, and the remainder of `C`'s arc, are untouched. Only
one existing node (`C`, the successor) loses keys, and all the lost keys go to the one new node.

### Removing a node

Delete `C`. The keys on `(B, C]` now walk further clockwise to whatever is next — `A` in the
three-node diagram. Again nothing else moves. This is the property that makes it safe against a
*crash*: the surviving nodes' data is not reshuffled, only the dead node's arc is reassigned.

The same fact carries a sharp edge, which is the first gotcha: **the entire load of the dead
node lands on one neighbour**, not spread across the fleet. That is what virtual nodes fix.

## Why one position per node is not enough

Place `N` nodes at positions given by a hash of their names and the arcs between adjacent
positions are the gaps between `N` uniformly random points on a circle. Those gaps are very
unequal. A well-known result for uniformly random points is that the largest gap is on the
order of `ln N / N` of the circle while the average gap is `1/N` — so the unluckiest node owns
on the order of `ln N` times its fair share, and that factor grows (slowly) with fleet size. You
do not need the constant; you need the shape: **random placement of one point per node gives
some node a multiple of its share, and that node is also the one your capacity planning did
not budget for.**

Cassandra names the consequence plainly:

> *"Cassandra seeks to avoid token imbalance because uneven token ranges lead to uneven request load."*

For a cache this is not an abstract unfairness. An arc twice as long receives twice the keys,
twice the traffic, twice the memory demand and twice the evictions, and the node serving it is
the one whose eviction rate looks like a different workload from its siblings' (see
**Eviction policies** *(not written yet)*).

## Virtual nodes

The fix is to give each physical node **many** positions on the ring — `V` virtual nodes — by
hashing derived labels (`"cache-3#0"`, `"cache-3#1"`, …). Cassandra's statement:

> *"Virtual nodes solve the problem by assigning multiple tokens in the token ring to each physical node."*

Two effects follow, both pure mathematics:

- **The load evens out.** A node's share becomes the sum of `V` small arcs rather than one large
  one. A sum of many independent pieces concentrates around its mean, and the relative spread
  shrinks as `V` grows — roughly with the square root of `V`. The source gives no number for
  how many virtual nodes are enough; this page will not invent one. It is a tuning knob with
  diminishing returns, and the cost side (below) is real.
- **Joins and leaves spread across the fleet.** The new node's `V` positions land in `V`
  different places and each takes a slice from a *different* neighbour. The dead node's `V`
  arcs are inherited by `V` different successors. In Cassandra's words:

> *"When a new node is added it accepts approximately equal amounts of data from other nodes in the ring, resulting in equal distribution."*

> *"When a node is decommissioned, it loses data roughly equally to other members of the ring."*

> *"If a node becomes unavailable, query load is evenly distributed across many other nodes."*

The third quote answers gotcha one directly. Virtual nodes are also the lever for
**heterogeneous hardware**: give a machine with twice the memory twice the virtual nodes and it
owns twice the arc. Weighting is nothing more than the count of positions.

### What virtual nodes cost

- **Memory and lookup structure.** The sorted array holds `nodes × V` entries in every client.
  That is small for a cache fleet, but it is rebuilt on every membership change and it is the
  thing you must keep identical across clients.
- **Lookup time** grows only logarithmically with the array size, so it is not the constraint.
- **Replica placement gets subtler.** With virtual nodes, "the next position clockwise" may
  belong to the *same physical node* as the current one; replication must skip those (below).
- **Membership changes touch many ranges.** Each of the `V` slices that moves is a separate
  range to stream in a data store. For a pure cache that is irrelevant — misses refill lazily —
  but it is why stores with real data choose `V` carefully.


## Gotchas

**★ Symptom: a node crashes and its neighbour falls over a few minutes later.** Cause: with a
single position per node (or a small `V`) the dead node's whole arc is inherited by exactly one
successor, which now carries its own load plus all of the dead node's; if it was running near
capacity it saturates, misses spike, the database absorbs the misses, and the next failure
cascades around the ring in clockwise order. Fix: use enough virtual nodes that a node's arc is
scattered, so each survivor inherits a sliver — and still budget headroom per node for one
node's absence, because spreading the load evenly does not make the sum smaller.

**★ Symptom: one cache node is permanently hotter, fuller or evicting more than its siblings,
and it is not a hot key.** Cause: arc-length imbalance — one point per node leaves the largest
arc a multiple of the average, and a node with a longer arc owns proportionally more keys.
Fix: raise the virtual-node count and, for mixed hardware, weight by giving bigger machines more
positions. Confirm it is arcs and not a key by comparing key counts per node against requests
per node — see [06](06-hot-keys-and-skew.md) for the other cause.

**★ Symptom: after a deploy, some keys are never found even though they were just written.**
Cause: two clients disagree on the ring — a different hash function, a different byte encoding
of the node name, a different label scheme for virtual nodes (`name#0` versus `name-0`), or a
different node list. Each client is internally consistent and they place the same key on
different nodes. This bites hardest in a **polyglot fleet** where a Node service and a Spring
service share one cache. Fix: pin the hash function, the encoding (UTF-8 bytes), the label
format and the key-to-integer reduction in a shared contract, and test with a fixed set of
keys whose expected owners are committed to both codebases.

**★ Symptom: keys are badly distributed even with many virtual nodes.** Cause: a weak or
low-entropy hash — Java's `String.hashCode()` is a 32-bit polynomial with strong correlation on
similar strings, and labels such as `cache-1#0`, `cache-1#1` differ in one trailing character.
Positions then cluster instead of spreading. Fix: use a hash with good avalanche behaviour
(a cryptographic digest truncated to 32 or 64 bits, or MurmurHash-class), applied to the full
label, and verify distribution by counting keys per node in a unit test with a large sample.

**Symptom: the cache still "scales" but p99 for one product never improves.** Cause: consistent
hashing balances **keys**, not **requests**; a single key lives on a single node regardless of
the ring. Fix: this is [06](06-hot-keys-and-skew.md), not a ring problem.

## Interview questions

**★ Why not just `hash(key) % N`, and exactly how bad is it?**
It is perfectly even but not *stable*: when `N` becomes `N+1` a key keeps its node only if
`h mod N` equals `h mod (N+1)`, which for a uniform hash is true of `1/(N+1)` of keys, so
`N/(N+1)` of them move. For a cache each moved key is a miss; for a fleet of ten, adding one
node sends about nine tenths of the keyspace to the database. Consistent hashing bounds
movement to the keys the new node must own, about `1/(N+1)`. Say the derivation, not just "it
reshuffles everything".

**★ Walk me through a ring lookup and what happens when a node joins.**
Hash nodes and keys onto the same circular space; a key belongs to the first node position at or
after it going clockwise, wrapping at the top. Implemented as a sorted array and a binary
search. A joining node inserts its position(s); the keys between its predecessor and itself now
resolve to it instead of its successor, and nothing else changes. A leaving node's arc is
absorbed by its successor.

**★ Why do we need virtual nodes?**
Two reasons. Evenness: one random point per node gives arcs of very unequal length, so some node
owns a multiple of its share; many points per node average that out. Failure and join behaviour:
with one point, a dead node's whole arc goes to one neighbour (a cascade risk) and a new node
steals from one neighbour; with many points the movement is spread across the fleet. Virtual
nodes also give you weighting for free — more positions, bigger share. Do not quote a magic
count; the documentation does not give one and the right value depends on fleet size and
tolerated imbalance.

**★ Does consistent hashing solve hot keys?**
No, and saying so unprompted is a strong signal. It balances the *number of keys* per node. One
key is one position and one owner, so a celebrity profile or the flash-sale SKU puts all its
traffic on a single node however many nodes exist; adding nodes shrinks nothing about that
key's load. Hot keys need replication, a local tier or request splitting —
[06](06-hot-keys-and-skew.md).

**How would two services in different languages share a ring safely?**
By treating the ring construction as a wire contract: the same hash function, UTF-8 encoding of
labels, label format for virtual nodes, reduction to an unsigned integer, and tie-break on equal
positions. Commit a table of sample keys and expected owners and run it in both test suites. A
mismatch is silent — nothing errors, keys just go to different places.

{/* FOOTER */}
