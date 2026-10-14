---
title: "Replicas on a ring are the next distinct physical nodes clockwise, which doubles as the failover order, and the ring is the right tool wherever membership changes while data is costly to rebuild and the wrong one where fixed slots or a static set will do"
sidebar_label: "05b · Replicas and where rings are used"
sidebar_position: 5.1
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-10-14 against the Cassandra Dynamo-style architecture page
> ([cassandra.apache.org](https://cassandra.apache.org/doc/latest/cassandra/architecture/dynamo.html),
> banked 2026-09-08), Dynamo §4.6 as quoted in the phase-0 research bank, and the Redis Cluster
> specification ([redis.io](https://redis.io/docs/latest/operate/oss_and_stack/reference/cluster-spec/),
> fetched 2026-10-14) for the slot count. Which systems use a ring beyond those three sources is
> **common practice stated as mechanism**, not cited. **No sandbox run.**

**A ring answers "who owns this key" with one node; replication and failover turn that into an
ordered list, and the discipline that matters is that the list must be made of distinct
machines.** This chunk continues [05](05-consistent-hashing.md) after virtual nodes: how the
preference list is built, why it is also the failover order, and the honest map of where rings
are used in real systems and where something simpler won. The code that implements all of it
is [05c](05c-consistent-hashing-in-code-and-its-alternatives.md).

## Replication: walking until you have enough distinct nodes

For a store that keeps `R` copies — and for a cache with a hot replica or a failover target —
the owner is the first of an ordered **preference list**. Cassandra's definition:

> *"if we have an eight node cluster with evenly spaced tokens, and a replication factor (RF) of 3, then to find the owning nodes for a key we first hash that key to generate a token (which is just the hash of the key), and then we 'walk' the ring in a clockwise fashion until we encounter three distinct nodes."*

The word that matters is **distinct**. With virtual nodes the next three positions can all be
the same machine; counting positions instead of machines silently puts all three replicas on one
host. The Dynamo paper's sloppy-quorum section ties the lineage together — operations go to the
first `N` *healthy* nodes of the preference list, which is why the "walking the ring" order is
also the **failover order**:

> *"all read and write operations are performed on the first N healthy nodes from the preference list, which may not always be the first N nodes encountered while walking the consistent hashing ring."* — Dynamo, §4.6

A cache client that, on a primary's death, simply tries the next distinct node on the ring is
using exactly this preference-list idea; it is also what produces the stale-return problem in
the gotchas.

## Where it is, and is not, used

| System | Placement | Ring? |
|---|---|---|
| Memcached with a client-side library | the *client* hashes onto a ring of server addresses; the servers do not know each other | yes — this is the classic use |
| Dynamo-style stores (Dynamo, Cassandra) | tokens on a ring, with virtual nodes and a preference list | yes |
| Redis Cluster | a fixed space of **16384 hash slots**, each owned by one master; resharding moves slots | no ring — fixed slots (see the section below) |
| A layer-7 load balancer with `hash` affinity | hash of a request attribute onto a ring of backends, so one customer or one URL keeps landing on the same backend and its warm local cache | yes — see [phase 2 load balancing](../phase-2-request-path/02-load-balancing-layer-4-vs-layer-7.md) |
| CDN edge / shield selection | commonly hash of the URL to choose which cache in a tier holds it, so the tier holds each object once | common practice, stated as mechanism |

The load-balancer row is worth dwelling on: the reason to use a hash-affinity balancer is to
make each backend's **in-process cache** hold a disjoint slice of the keyspace, so the fleet's
combined memory acts as one cache rather than `N` duplicated ones. Consistent hashing is what
keeps that arrangement from collapsing when a backend is added during a deploy.

## A worked preference list by hand

Three machines, two virtual nodes each, positions chosen small so the arithmetic is visible
(this is a constructed example, not output from any run). Walking clockwise the positions are:

| Position | 10 | 25 | 40 | 55 | 70 | 90 |
|---|---|---|---|---|---|---|
| Machine | `A` | `B` | `A` | `C` | `B` | `C` |

A key hashing to 38 starts at position 40. For `R = 3`: take 40 → `A`; next is 55 → `C`; next
is 70 → `B`. Three distinct machines, preference list `[A, C, B]`. Now a key hashing to 8
starts at 10 → `A`, next 25 → `B`, next 40 → `A` again — **skip it, it is a machine already
in the list** — then 55 → `C`. The list is `[A, B, C]`. A naive "next three positions" would
have yielded `[A, B, A]` for that second key, two copies on machine `A`, and `A` dying would
have taken out two thirds of the key's redundancy.

The same list is the failover order. If `A` is down, the first healthy entry serves; the key at
position 38 goes to `C`, the one at 8 goes to `B`. That is a deterministic, client-computed
answer — no coordinator is consulted, which is why every client must agree on the ring.

## Failure domains: distinct machines are not always enough

Distinct machines can share a rack, a power feed or an availability zone. Dynamo-style
deployments commonly extend "skip positions on the same node" to "skip positions in the same
failure domain" until each replica is in a different one. For a cache fleet this matters in one
specific scenario: a zone outage removes every node in that zone from the ring at once, and
whether the survivors can absorb the load is determined by how evenly the arcs interleave the
zones. This is mechanism, not a sourced figure; the sizing consequence is that capacity must be
planned for the loss of a *zone*, not of a *node*.

## Fixed slots instead of a ring: Redis Cluster

Redis Cluster takes a different route to the same goal — bounded movement — by fixing the
granularity up front. The key space is split into a constant number of slots, and a slot, not a
key, is the unit that moves:

> *"The cluster's key space is split into 16384 slots, effectively setting an upper limit for the cluster size of 16384 master nodes"*

> *"HASH_SLOT = CRC16(key) mod 16384"*

> *"Adding or removing a node is abstracted into the same operation: moving a hash slot from one node to another."*

Compare with the modulo problem in [05](05-consistent-hashing.md): the modulus here is *fixed*
at 16384, so it never changes when nodes come and go; what changes is the **table** mapping each
slot to a node. Adding a node means moving some slots to it, and only the keys in those slots
move. The cost is that the slot table is shared state the cluster must agree on and that clients
must cache and refresh (the specification covers `-MOVED` and `-ASK` redirections for this); the
benefit is that the mapping is explicit, inspectable and hand-tunable, with no hash-position
arithmetic and no vnode-count decision. The mechanics are the Redis track's to teach — see
[the Redis track](../../../redis/README.md) — and this page only needs the contrast: a ring
computes ownership from positions, slots look it up from a table.

The specification also defines **hash tags**: if a key contains a non-empty `{...}` section,
*"only what is between the first occurrence of `{` and the following first occurrence of `}` is hashed"*.
That lets related keys share a slot for multi-key operations — and it lets a careless tag
concentrate load, which is the next chunk's concern ([06](06-hot-keys-and-skew.md)).

## What the storefront gets from it

The PERN storefront caches product detail, catalogue pages and session-adjacent data in a
fleet of cache nodes behind a thin client. The catalogue key space is large and mostly cold;
the flash-sale SKU is one key. Consistent hashing is what lets that fleet scale from, say, four
nodes to five before a sale without cold-starting the catalogue — only the new node's slice is
cold. It does nothing for the flash-sale SKU: **one key hashes to one position and therefore to
one node, however many nodes there are.** That is the seam to [06](06-hot-keys-and-skew.md).

## Gotchas

**★ Symptom: adding a node at peak causes a database spike.** Cause: consistent hashing
minimises movement but does not eliminate it — the new node's slice (about `1/(N+1)` of the
keys) starts empty, so every key in it misses once. The keys that moved are also *the ones the
old owner still holds, now unreachable*, so nothing is lost but nothing is warm either. Fix:
add nodes off-peak, warm the new node before it takes traffic (or route reads to old-then-new
for the migrating slice), and protect the database with single-flight so the first miss on each
moved key does not become `W` concurrent queries — that is the stampede topic.

**★ Symptom: a key returns an old value after a node "recovers".** Cause: while the node was
considered dead, the client wrote the key to its successor and updated it there; the node
returns with its pre-failure copy still in memory and the ring routes the key back to it. The
update is lost to readers. Fix: restart returning nodes empty (a cache can afford to), or give
every entry a TTL shorter than the longest outage you tolerate, or never silently readmit a
node that was ejected for longer than the TTL without flushing it.

**★ Symptom: replicas on "different nodes" turn out to be on the same machine.** Cause: the
preference list was built by taking the next `R` ring *positions*, and with virtual nodes
adjacent positions often belong to one physical host. Fix: walk until you have collected `R`
**distinct physical nodes**, which is exactly Cassandra's rule, and in rack- or zone-aware
deployments skip positions in an already-used failure domain too.

**Symptom: membership flaps and the ring is rebuilt dozens of times.** Cause: ejecting a node
on a single timeout redistributes its arc, readmitting redistributes it back, and each flip
moves keys (and loses data) twice. Fix: eject only after several consecutive failures, readmit
with a delay, and prefer a membership source of truth (service discovery) over each client's own
failure detector — see [phase 2 service discovery](../phase-2-request-path/12-service-discovery.md).

**Symptom: the ring is derived from node IP addresses and every autoscale event reshuffles
it.** Cause: addresses changed when instances were replaced, so "the same node" has new
positions and its keys all move. Fix: hash a stable logical name (`cache-3`), not the address,
so a replacement inherits the identity and therefore the arc.

**★ Symptom: a zone outage empties the cache for a third of the keyspace and the database
buckles.** Cause: the fleet was sized for losing one node and the ring was not zone-aware, so the
outage removed many nodes whose arcs together were a large contiguous share of requests.
Fix: size and test for the loss of a whole failure domain, interleave virtual nodes across
zones, and keep the database protected by single-flight and admission limits rather than
assuming the cache is always there.

**Symptom: related keys in Redis Cluster all land on one node and that node runs hot.** Cause:
a hash tag such as `{store:1}` on every key forces them into one slot by design (the
specification introduces tags so multi-key operations can work), so a "tag per tenant" or "tag
per sale" funnels the whole group through one master. Fix: tag only the small groups that
genuinely need multi-key atomicity, never a high-volume population.

## Interview questions

**★ A node dies. What happens to its keys and its traffic?**
The ring reassigns its arc to the next positions clockwise. With virtual nodes those are spread
across many survivors, so each takes a small share of the traffic — Cassandra says query load is
evenly distributed across many other nodes. The keys it held are gone from the cache (a cache is
not the system of record) so those reads miss and refill from the database; the right defence is
headroom plus single-flight on the refill. Without virtual nodes it all lands on one neighbour.

**How does a ring-based cache client cope with replicas and failover?**
It builds a preference list by walking clockwise until it has `R` distinct physical nodes, then
reads or writes the first healthy entries — the Dynamo idea of using the first healthy nodes of
the preference list. For a cache the "replica" is more often a failover than a copy: if the
primary is down, the next distinct node serves and fills lazily. The risk is the stale return in
the gotchas.

**Where would you actually use consistent hashing, and where would you not?**
Use it where membership changes while data is expensive to move or rebuild: client-sharded
Memcached, Dynamo-style stores, hash-affinity load balancing to keep per-backend local caches
warm, tiered CDN caches. Do not reach for it when the node set is static and small, or when a
fixed-slot scheme is simpler — Redis Cluster deliberately uses 16384 slots rather than a ring.
Name the Redis Cluster counter-example; it shows you know it is a family of ideas, not one
algorithm.
**★ Ring versus fixed slots — what is actually different?**
Both bound movement. A ring computes ownership from the ordered positions of nodes, so
membership alone defines the mapping and clients can compute it independently. Fixed slots hash
the key into a constant number of slots (16384 in Redis Cluster) and keep an explicit
slot-to-node table; adding a node means reassigning slots, and the table must be shared and
refreshed by clients through redirections. A ring is stateless and needs virtual nodes for
evenness; slots are explicit and tunable and need a coordinated table. Neither helps a single
hot key.

**How do you size a cache fleet when the ring is zone-aware?**
For the loss of the biggest failure domain, not the biggest node: survivors must absorb the
domain's traffic with headroom, and the refills must not exceed what the database can take. The
documentation gives no numbers and neither should the answer; the method is "remove a zone from
the ring on paper, compute each survivor's new arc share, compare with its capacity".

{/* FOOTER */}
