---
title: "The single-document atomicity guarantee"
sidebar_label: "02 · Single-document atomicity"
sidebar_position: 2
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-14 against the **MongoDB Manual** —
> [Atomicity and Transactions](https://www.mongodb.com/docs/manual/core/write-operations-atomicity/)
> and [Transactions](https://www.mongodb.com/docs/manual/core/transactions/).

**This is the one guarantee you get for free, and every schema decision in
MongoDB reduces to whether you can stay inside it.**

## The guarantee, quoted

> "In MongoDB, write operations are atomic on the single-document level, even if
> modifying multiple values."
>
> — MongoDB Manual, *Atomicity and Transactions*

"Even if modifying multiple values" is the important half. A single document
includes its **embedded documents and arrays**, so this is atomic:

```js
db.orders.updateOne(
  { _id: orderId },
  {
    $set:  { status: "paid", "payment.reference": "ch_123" },
    $inc:  { version: 1 },
    $push: { events: { type: "paid", at: new Date() } }
  }
)
```

Four changes across three levels of nesting — one document, therefore atomic. No
reader ever sees the status updated but the event missing.

## What is *not* atomic

> "When a single write operation (e.g. `db.collection.updateMany()`) modifies
> multiple documents, the modification of each document is atomic, but the
> operation as a whole is not atomic."

So `updateMany` across a thousand documents is a thousand atomic writes, not one.
A concurrent reader can see some updated and some not. There is no isolation
boundary around the operation.

This is the fact that makes normalised modelling expensive here. Two documents
means two atomic writes, and something must handle the gap between them.

## Why this makes embedding the default

The reasoning chain is short and worth being able to reproduce:

1. Atomicity is free within a document and costly across documents.
2. Therefore data that must change **together** should live **together**.
3. Therefore an order and its line items belong in one document — you cannot have
   a line item added without the total updating.
4. Therefore the design question becomes: **"can this be one document?"**

That is the phase gate, and it is the sentence the whole syllabus is downstream
of.

Where the answer is no — because the data is unbounded, shared, or independently
updated — you need either a deliberate pattern (topic 04's modelling work) or a
transaction.

## Multi-document transactions exist, and are not the answer

> "For situations that require atomicity of reads and writes to multiple
> documents (in a single or multiple collections), MongoDB supports distributed
> transactions, including transactions on replica sets and sharded clusters."

But the manual is unusually direct about how to regard them:

> "In most cases, a distributed transaction incurs a greater performance cost
> over single document writes, and the availability of distributed transactions
> should not be a replacement for effective schema design."

Read that as written: **transactions are a correctness tool for the cases your
schema genuinely cannot absorb, not a licence to model relationally.** A codebase
that wraps most writes in transactions has usually modelled against the grain,
and is paying for it on every operation.

Transactions also require a **replica set** — which is why even a local
development instance should be a single-node replica set (topic 13), and why
`startSession()` fails on a bare standalone `mongod`.

## The comparison that makes it concrete

| | PostgreSQL | MongoDB |
|---|---|---|
| Atomic unit, free | one **statement**, and a `BEGIN…COMMIT` spans any number of rows | one **document** |
| Multi-entity atomicity | ordinary transactions, cheap and expected | distributed transactions, discouraged as a default |
| Consequence for modelling | normalise; joins reassemble | embed; keep what changes together, together |

Someone arriving from PostgreSQL usually models entities first and reaches for
transactions to glue them. That produces a MongoDB schema that is expensive on
every write. The inversion — **model the document your operation needs to be
atomic over** — is the actual adaptation.

## What "atomic" does not mean here

Three clarifications that catch people:

- **Not isolated across documents.** Another reader can observe your first write
  before your second.
- **Not durable by default in the strongest sense.** Atomicity is separate from
  the *write concern*, which decides how many nodes must acknowledge before the
  driver returns — topic 07.
- **Not a lock you can extend.** There is no way to hold document atomicity open
  across two operations; that is what a session and a transaction are for.

## Trade-off

**A free, always-on guarantee at one granularity, and nothing between that and a
distributed transaction.** PostgreSQL lets you scale the unit of atomicity
smoothly — one row, ten rows, a whole workflow — for roughly the same
conceptual cost. MongoDB gives you one document free and then a significant step
up, with no middle.

That cliff is what shapes MongoDB schemas, and it cuts both ways. It produces
excellent designs when the domain has natural aggregates — an order, a document,
a user profile — because the boundary the database rewards is the boundary the
domain already has. It produces bad ones when entities are genuinely many-to-many
and independently updated, because there is no shape that keeps the atomic
operations inside one document, and every option is a compromise.

The judgement to carry: **if you cannot name the document your operation is
atomic over, the model is not finished.**

## Gotchas

**`updateMany` is treated as one atomic operation.**
*Symptom:* a partial update is observed by a concurrent reader.
*Cause:* each document's modification is atomic; the operation is not.
*Fix:* a transaction if genuine cross-document atomicity is required — or a
schema where the change is one document.

**A two-write workflow leaves inconsistent state on failure.**
*Symptom:* the order says paid, the ledger has no entry.
*Cause:* two documents, two atomic writes, a gap between them.
*Fix:* embed if the data belongs together; otherwise a transaction, or an
idempotent retry with an outbox-style pattern.

**`startSession()` / transactions fail outright.**
*Symptom:* an error about transaction numbers or replica sets.
*Cause:* the deployment is a standalone `mongod`.
*Fix:* run even local development as a single-node replica set.

**Transactions are used for everything.**
*Symptom:* write throughput is poor and contention is high.
*Cause:* a relational model expressed in documents.
*Fix:* revisit the schema — the manual explicitly says transactions are not a
substitute for effective schema design.

**Atomic is confused with acknowledged.**
*Symptom:* data lost after a node failure despite "the write succeeded".
*Cause:* atomicity and write concern are different things.
*Fix:* choose a write concern deliberately — see topic 07.

## Interview questions

**★ What exactly is atomic in MongoDB?**
A write to a **single document**, even when it modifies multiple values across
embedded documents and arrays. An operation touching multiple documents — such as
`updateMany` — is atomic per document, but not as a whole.

**★ Why does this make embedding the default modelling choice?**
Because atomicity is free within a document and expensive across documents. Data
that must change together should therefore be stored together, which turns every
design question into "can this be one document?"

**★ Are multi-document transactions the answer to this limitation?**
Only for cases the schema genuinely cannot absorb. The manual states directly
that a distributed transaction costs more than a single-document write and
"should not be a replacement for effective schema design". Wrapping most writes
in transactions usually signals a relational model forced into documents.

**Why does a local development instance need to be a replica set?**
Because transactions and sessions require one. A standalone `mongod` cannot start
a transaction, so behaviour differs from production in exactly the area that is
hardest to test late.

**How does this compare with PostgreSQL's model?**
PostgreSQL gives atomicity over any set of rows inside a transaction, so entities
are normalised and reassembled with joins. MongoDB gives one document free and a
significant step to distributed transactions, so the schema is shaped around
keeping each atomic operation inside a single document.

**Does atomic mean the write is safe on disk?**
No. Atomicity is about the visibility of a partial change; durability is governed
by the write concern and journaling, which are separate settings.

---

← [01 · What MongoDB actually is](./01-what-mongodb-actually-is.md) · Next: [03 · BSON](./03-bson.md) →
