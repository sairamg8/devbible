---
title: "A replica set is a requirement, not a topology preference — and a standalone dev database removes three guarantees at once"
sidebar_label: "4b · The deployment requirement"
sidebar_position: 8
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-02 against the **MongoDB Manual (8.0)** —
> [Transactions](https://www.mongodb.com/docs/manual/core/transactions/)
> (read concern, write concern and read preference for transactions; the
> replica-set and sharded-cluster requirement),
> [Transactions in Applications](https://www.mongodb.com/docs/manual/core/transactions-in-applications/),
> [Production Considerations](https://www.mongodb.com/docs/manual/core/transactions-production-consideration/)
> (the modification guideline, the runtime limit, arbiters and the majority
> commit point),
> [Read Concern `"snapshot"`](https://www.mongodb.com/docs/manual/reference/read-concern-snapshot/),
> [Write Concern](https://www.mongodb.com/docs/manual/reference/write-concern/),
> [Replica Set Deployment Architectures](https://www.mongodb.com/docs/manual/core/replica-set-architectures/);
> the **Node driver** —
> [Transactions](https://www.mongodb.com/docs/drivers/node/current/crud/transactions/).
> `mongodb` is **not** installed in this repo's `node_modules`, so every driver
> claim here comes from its published docs and its source on GitHub, not from a
> local declaration file.
> Spine: **MongoDB 8.0** (8.2 minor) · driver **`mongodb` 7.5.0** · **Node 24 LTS**.

**Everything in [chunk 4](04-write-concern-and-deployment.md) was a choice. This
is not one. Multi-document transactions require a replica set or a sharded
cluster, because the mechanism is built on the oplog and a standalone `mongod`
has none — and the same requirement quietly governs two other things this
chapter's neighbours depend on. What follows is the development environment that
matches production, the production topology that can actually satisfy
`w: 'majority'`, and the sizing guideline that this checkout is already well
inside.**

## The deployment requirement

**Transactions require a replica set or a sharded cluster.** A standalone
`mongod` cannot run one, because the mechanism is built on the oplog and a
standalone has none. This is a hard requirement in the manual, not a
recommendation, and it is the reason the phase overview names three chapters
that share it: transactions (this chapter), change streams
(**chapter 06**, *not written yet*), and retryable writes everywhere.

The trap is what a standalone development database does to the *other* two.
Retryable writes — [chunk 1's](01-the-stock-decrement.md) exactly-once
guarantee for the unguarded `claimStock` — also need a replica set. So does
every change stream. A developer running a plain `mongod` on a laptop is not
testing a slightly weaker version of production; they have removed three
independent guarantees at once, and two of them fail silently rather than
loudly. Only the transaction raises an error.

The fix is a **single-node replica set**, which costs one flag and one command
and behaves like the real thing for every mechanism above:

```yaml
# docker-compose.yml — the dev database, matching the Phase 0 environment
services:
  mongo:
    image: mongo:8.0
    command: ["--replSet", "rs0", "--bind_ip_all"]
    ports: ["27017:27017"]
    healthcheck:
      test: ["CMD", "mongosh", "--quiet", "--eval", "db.adminCommand('ping')"]
      interval: 5s
      retries: 20
  mongo-init:
    image: mongo:8.0
    depends_on:
      mongo: {condition: service_healthy}
    restart: "no"
    command: >
      mongosh --host mongo --quiet --eval
      'try { rs.status() } catch (e) { rs.initiate({_id:"rs0",members:[{_id:0,host:"mongo:27017"}]}) }'
```

```
MONGODB_URI=mongodb://localhost:27017/storefront?replicaSet=rs0
```

A single-node set commits `w: 'majority'` instantly — one member is a majority
of one — so it exercises the code paths without exercising the latency. That is
the right trade for a laptop and the wrong assumption to carry into a load test.

## What production has to look like

**Three data-bearing members, no arbiter in the voting majority.** The manual's
architecture guidance is to prefer a three-member primary-secondary-secondary
set over primary-secondary-arbiter, and transactions are the sharpest reason.
In a PSA set, losing the one secondary leaves the arbiter unable to acknowledge
anything: `w: 'majority'` can no longer be satisfied, so every checkout commit
blocks until `maxCommitTimeMS` and the majority commit point stops advancing —
which the manual flags as a cache-pressure problem in its own right, because the
storage engine must retain history back to that point. An arbiter looks like a
cheap third vote until the day it is the only other vote.

**Keep transactions small.** Production Considerations gives the working number
as a guideline — **limit a transaction to around 1,000 document
modifications** — and this checkout is nowhere near it: one order, one write per
cart line, one cart clear, two outbox inserts. That is not an accident of scale;
it is what [chunk 1's](01-the-stock-decrement.md) argument bought. The vast
majority of this app's writes are single-document and never enter a transaction
at all, so the only path that pays these costs is the one that genuinely needs
them.

**Sharding is a later decision, and it changes the arithmetic.** A transaction
whose writes stay on one shard behaves as it does here. One that spans shards
runs a two-phase commit across them, which is materially more expensive and more
sensitive to a slow member. If this store ever shards, the shard key wants to
keep a single customer's checkout — their cart, their order — on one shard, and
`userId` is the obvious candidate for exactly that reason. Nothing in this
chapter needs to change to make that possible; it is a note for the day the
question arrives.

## Gotchas

**★ Developing against a standalone `mongod` removes three guarantees and warns
about one.** The transaction raises an error you cannot miss. Retryable writes
simply stop being retryable, and change streams simply cannot be opened — both
of which read as "we do not use that yet" rather than "the environment cannot
do it". Run the single-node replica set from the first day, not the day the
transaction chapter is implemented.

**★ A single-node replica set makes `w: 'majority'` free, and that is
misleading.** It is the correct development target because it exercises the
code, but any latency number measured against it is fiction: a majority of one
member is acknowledged locally. Performance conclusions about checkout need a
real three-member set, and the difference is not a constant factor — it is a
network round trip inside the request the customer is waiting on.

**★ `?replicaSet=rs0` against a member the client cannot resolve fails *after*
it connects.** This is the single most common way a containerised dev database
goes wrong. `rs.initiate` records the member as `mongo:27017` — correct inside
the compose network — and the driver, once it discovers the topology, tries to
reach the primary at exactly that host. From the laptop, `mongo` does not
resolve, so the initial connection to `localhost:27017` succeeds and every
subsequent operation times out with a server-selection error naming a host
nobody typed. Either initiate with a host both sides can reach
(`host: "localhost:27017"`, if only the host machine talks to it), or run the
app inside the same compose network so the recorded name is the right one.

**★ The transaction's runtime limit is on the server and does not care that your
callback is still working.** `transactionLifetimeLimitSeconds` defaults to 60
seconds and aborts the transaction regardless. It is a limit on the *attempt*,
so it interacts with the driver's budget in the way
[chunk 3b](03b-the-three-clocks.md) describes — and it is a good reason never to
put a slow external call inside a callback, quite apart from the fact that
[chunk 3c](03c-a-callback-that-can-run-twice.md) forbids it for correctness.

**★ Raising `transactionLifetimeLimitSeconds` to make a slow transaction fit is
a trade, not a fix.** The parameter exists and can be raised, and the cost is
paid by the storage engine, which must retain enough history to serve every open
snapshot. A cluster with a long limit and long transactions accumulates cache
pressure that shows up as degraded performance for queries that have nothing to
do with the transaction. If a checkout needs more than a second, the problem is
the checkout.

## Interview questions

**★ A developer reports that transactions "do not work" on their machine, and
the fix is a replica set. What two other things were also broken, and why did
nobody notice?** Retryable writes and change streams. Both require a replica
set, and neither fails loudly in the way a transaction does: a write that is not
retryable simply is not retried, so it looks like a normal error under a network
blip, and a change stream that cannot be opened is usually code nobody has
written yet. The transaction is the only one of the three that refuses in a way
that reaches a developer on day one, which is precisely why the environment
should be a single-node replica set from the start rather than at the point the
transaction chapter is implemented.

**★ You inherit a three-member replica set with an arbiter. What breaks first
under this checkout, and what is the fix?** The commit. With
primary-secondary-arbiter, the arbiter holds a vote but no data, so the moment
the secondary is unavailable there is no majority that can acknowledge a write:
every checkout commit waits out `maxCommitTimeMS` and returns
`UnknownTransactionCommitResult`, and the majority commit point stops advancing,
which the manual flags as a cache-pressure problem because the storage engine
must retain history back to it. The fix is architectural — replace the arbiter
with a data-bearing secondary — and the mitigation until then is that the
endpoint's 503 plus the idempotency key at least keeps the customer's retries
safe.

**★ Should this application's checkout run on a sharded cluster?** It can, and
the question is whether the transaction stays on one shard. A single-shard
transaction behaves as it does on a replica set; one that spans shards runs a
two-phase commit, which costs more and is more exposed to a slow member. Since
a checkout touches one user's cart, one user's order and a handful of products,
a shard key on `userId` keeps most of it co-located, with `products` as the
awkward collection — it is read by every checkout and shared by every customer.
The honest answer for this store is that it does not need sharding, and the
design note worth keeping is that if it ever does, the shard key must be chosen
to keep a checkout on one shard rather than to balance the catalog.

**★ Your app talks to the dev database happily without `?replicaSet=` in the
URI, but transactions fail. What is the difference the option makes?** Without
it the driver makes a *direct* connection to the one host in the URI and never
performs topology discovery — it does not learn that this `mongod` is a replica
set member, so it will not start a session with a transaction on it. With
`replicaSet=rs0` the driver discovers the set, identifies the primary from the
set's own configuration, and can therefore honour `readPreference: 'primary'`
and the majority write concern. This is also why the option turns a working
connection into a broken one when the recorded member host is unreachable: the
plain connection never had to resolve that name, and the discovered topology
does.

---

← Prev: [The four transaction options](04-write-concern-and-deployment.md) ·
Index: [Checkout with transactions](README.md) ·
Next → [The dashboard on the aggregation pipeline](../04-the-dashboard/README.md)
