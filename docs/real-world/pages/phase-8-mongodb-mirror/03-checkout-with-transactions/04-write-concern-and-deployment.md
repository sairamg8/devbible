---
title: "Every field of TXN_OPTIONS justified: what the transaction sees, what committed means, who answers, and for how long"
sidebar_label: "4 · The four transaction options"
sidebar_position: 7
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

**[Chunk 2](02-the-transaction.md) declared `TXN_OPTIONS` with a comment saying
this chunk would justify every field, and it has four fields because there are
four independent decisions to make: what the transaction can see, what
"it committed" means, which member answers, and how long the commit may take.
Getting any of them wrong produces a checkout that passes every test and loses
orders in production — a `w: 1` commit vanishes in a failover, a `secondary`
read preference is rejected outright, and an unset `maxCommitTimeMS` lets a
degraded replica set hold an HTTP request open for as long as it likes.
[Chunk 4b](04b-the-deployment-requirement.md) takes the part that is not a
tuning choice at all: the deployment this chapter cannot run without.**

```js
export const TXN_OPTIONS = {
  readConcern: {level: 'snapshot'},   // what the callback can see
  writeConcern: {w: 'majority'},      // what "committed" means
  readPreference: 'primary',          // which member answers
  maxCommitTimeMS: 5_000,             // how long the commit may take
};
```

## `readConcern: {level: 'snapshot'}` — what the callback can see

A transaction reads from a single point-in-time view of majority-committed data,
and every read in the callback sees the same one. That is the property
[chunk 2b](02b-what-each-part-is-doing.md) leaned on when it argued that
`found[i].priceCents` and `cart.items` are consistent with each other: they are
not two reads that raced, they are two reads of one snapshot.

The two alternatives are both worse here, for opposite reasons.

**`local`** reads the member's most recent data whether or not it is
majority-committed, which means the callback can build an order from data that
a subsequent failover rolls back — an order whose line prices never existed.
It is also the *only* level under which a transaction may implicitly or
explicitly create a collection, which is why chunk 2's gotcha insists every
collection this path touches already exists from the migration.

**`majority`** inside a transaction guarantees each read sees
majority-committed data but does not by itself pin all the reads to one moment;
`snapshot` is the level that adds "and the same moment for all of them".

The cost is honest and chunk 2b stated it: a snapshot is **stale by
construction**. The manual is explicit that reads inside a transaction *"can
return old data"* and are *"not guaranteed to see writes performed by other
committed transactions"*. That is exactly right for a price snapshot and exactly
wrong for a stock check — which is why stock is claimed by a guarded write in
[chunk 1](01-the-stock-decrement.md) and never decided by a read.

## `writeConcern: {w: 'majority'}` — what "committed" means

This is set **once, on the transaction**, and it applies to the commit. It is
not a durability nicety; it is the difference between an order that exists and
an order that used to exist.

With `w: 1` the commit is acknowledged as soon as the primary has applied it. If
that primary steps down before the change replicates, the new primary does not
have it, and the old one rolls it back when it rejoins. The customer has a 201,
an order id and a confirmation email — the outbox document was in the same
transaction, so it rolled back too, but the relay may already have sent — and
the order is gone. `w: 'majority'` means the commit is acknowledged only once a
majority of voting members have it, which is precisely the condition under which
no failover can discard it.

This is also the reason `UnknownTransactionCommitResult` exists as a distinct
label in [chunk 3](03-failure-retries-and-the-callback.md): waiting for a
majority is a wait that can time out or be interrupted, and a commit whose
majority acknowledgement never arrived is a commit whose outcome is genuinely
unknown rather than known-failed.

**Do not set write concern on the individual operations inside the callback.**
The manual is direct about this — write concern belongs to the transaction, not
to its operations — and the driver rejects an operation inside a transaction
that carries its own. It reads as harmless defensive code and it is an error at
runtime; the correct place is the third argument to `withTransaction`, where
chunk 2 puts it.

## `readPreference: 'primary'` — which member answers

Not a preference. The manual states the requirement:

> *"Multi-document transactions that contain read operations must use read
> preference `primary`. All operations in a given transaction must route to the
> same member."*
> — [Transactions](https://www.mongodb.com/docs/manual/core/transactions/)

Setting it explicitly in `TXN_OPTIONS` is documentation rather than
configuration — `primary` is already the default — but it is documentation that
pays for itself the day someone sets a cluster-wide
`readPreference=secondaryPreferred` in the connection string to take load off
the primary. Every plain catalog read follows it happily; the checkout
transaction fails, and the explicit option in this object is the thing that
says why. It is also the reason the "read the dashboard from a secondary"
optimisation of **chapter 04** *(not written yet)* cannot be applied here: the checkout
must be answered by the primary, whatever the rest of the app does.

## `maxCommitTimeMS: 5_000` — how long the commit may take

The commit is where the majority wait happens, so it is the one phase whose
duration depends on the health of members this process cannot see. Without a
cap, a replica set that has lost a member holds the commit — and the HTTP
request behind it — until the wait resolves or a network layer gives up. Five
seconds is chosen against the API's own timeout budget, not against a database
metric: it must be short enough that the endpoint can answer 503 and let the
client replay with the same idempotency key, which is a strictly better outcome
than a socket that closes with nothing decided.

On driver 6 and later, `timeoutMS` supersedes this field and covers the whole
operation including retries — [chunk 3b](03b-the-three-clocks.md) has the
comparison, and the two are mutually exclusive on the same transaction.

## Gotchas

**★ `w: 1` passes every test you are likely to write.** Durability failures do
not reproduce on a laptop, in CI, or in a staging environment that never elects
a new primary. The symptom appears once, in production, as an order the customer
has a receipt for and the database has never heard of — and by then the evidence
is gone, because the rollback is exactly the absence of a record. Treat the
write concern as part of the schema, not part of the tuning: it belongs in
`TXN_OPTIONS` in source control, not in a connection string an operator can
edit.

**★ A write concern on an operation inside the transaction is an error, not an
override.** `updateOne(filter, update, {session, writeConcern: {w: 'majority'}})`
inside the callback looks like belt and braces and is rejected. The transaction
owns the write concern; the operations inherit it. This is worth knowing as a
review rule because the failure is at runtime, on a path that only executes
under checkout.

**★ A cluster-wide `readPreference` in the connection string breaks checkout and
nothing else.** `?readPreference=secondaryPreferred` is a normal, sensible thing
to add when read load becomes a problem, and every other query in the app gets
faster. The checkout transaction starts failing, in production, for a change
that was reviewed as a performance tweak. The explicit `readPreference:
'primary'` in `TXN_OPTIONS` overrides it at the transaction level and turns the
incident into a non-event.

**★ `readConcern: 'snapshot'` forbids implicit collection creation, and a fresh
environment is where you find out.** Chunk 2's gotcha states the rule; the
deployment consequence is that a newly provisioned database whose migration did
not run — no `outbox` collection, say — fails at the first checkout rather than
creating the collection on the fly. That is the correct behaviour and it is
worth knowing it is coming, because the error names a collection rather than a
migration.

## Interview questions

**★ Why must a transaction's reads use `primary` when the rest of the app is
free to read secondaries?** Because a transaction is state held on one member.
The session, its snapshot and its uncommitted writes live on the primary that
started it, and every operation in the transaction has to route to that same
member for the transaction to mean anything — the manual states both halves as
requirements. A secondary has no knowledge of the in-progress transaction and
could not serve a read consistent with it. The practical consequence is that
read scaling and transactions are separate conversations: the catalog can be
served from secondaries, the checkout cannot.

**★ What exactly does `w: 'majority'` buy at commit, and what is the failure it
prevents?** It delays the acknowledgement until a majority of voting members
have the commit, which makes the commit survivable across an election. Without
it, the acknowledgement means only "the primary applied it", and a primary that
steps down before replicating takes the transaction with it — the new primary
never had it, and the old one rolls it back on rejoin. The failure it prevents
is therefore not data corruption but an order that the customer was told
succeeded and that the database subsequently does not contain, with no error
anywhere to correlate against.

**★ Why is per-operation write concern rejected inside a transaction rather than
merged?** Because the operations do not commit — the transaction does. Interior
writes are provisional until `commitTransaction`, so there is no per-operation
acknowledgement for a write concern to describe; the only durability decision in
the whole unit is the one made at commit. Allowing the option would mean
accepting a setting that could not be honoured, so the API rejects it. This is
the same fact, from the other side, as
[chunk 3's](03-failure-retries-and-the-callback.md) point that individual writes
inside a transaction are not retryable: the unit of everything — durability,
retry, visibility — moved up to the transaction.

**★ Why is `maxCommitTimeMS` chosen against the API's timeout rather than the
database's latency?** Because its job is to decide who gives up first. The
commit's duration depends on the health of members this process cannot observe,
so there is no database-side number that is "correct"; what matters is that the
database abandons the commit while the endpoint can still turn it into a 503
with `Retry-After`. If the socket closes first, the client has no answer and no
instruction, and the transaction may still commit afterwards — which the
idempotency key survives, but only by luck rather than by design. Five seconds
under a thirty-second gateway timeout leaves room for the 503 and the client's
replay.

---

← Prev: [A callback that can run twice](03c-a-callback-that-can-run-twice.md) ·
Index: [Checkout with transactions](README.md) ·
Next → [The deployment requirement](04b-the-deployment-requirement.md)
