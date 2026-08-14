---
title: "MongoDB vs PostgreSQL — the actual trade"
sidebar_label: "05 · MongoDB vs PostgreSQL"
sidebar_position: 5
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-14 against the **MongoDB Manual** —
> [Atomicity and Transactions](https://www.mongodb.com/docs/manual/core/write-operations-atomicity/),
> [Schema Validation](https://www.mongodb.com/docs/manual/core/schema-validation/),
> [`$lookup`](https://www.mongodb.com/docs/manual/reference/operator/aggregation/lookup/) —
> and this repository's **completed PostgreSQL phases**, which are not re-argued here.

**Both databases are excellent and they optimise for different questions.** This
page is a decision procedure, not a verdict — and the honest answer for most
fullstack applications is "PostgreSQL unless you can name why not".

## The three real differences

Everything else follows from these.

### 1. Locality vs joins

| | PostgreSQL | MongoDB |
|---|---|---|
| Related data | normalised, reassembled with **joins** | embedded, read with **one lookup** |
| Cost of reading an aggregate | a join per relation | none |
| Cost of updating shared data | one row, everywhere | every document that embedded it |

MongoDB does have `$lookup`, so joins are *possible* — but it is a
left-outer-join in an aggregation pipeline, it cannot cross databases, and using
it as the default access pattern means you have built a relational schema in a
database that does not optimise for one.

### 2. Document atomicity vs transactions

Covered in [02](./02-single-document-atomicity.md). MongoDB gives atomicity over
**one document** for free and charges meaningfully for more. PostgreSQL gives
atomicity over **any set of rows** inside an ordinary transaction, at a cost so
low that nobody designs around it.

This is the difference that shapes the schema. In PostgreSQL you model entities
and let transactions handle consistency. In MongoDB you model the *document your
operation must be atomic over*, because the transaction is the expensive path.

### 3. Where the schema is enforced

| | PostgreSQL | MongoDB |
|---|---|---|
| Types | declared, enforced always | per-document, whatever was written |
| Required fields | `NOT NULL` | only with a validator |
| Referential integrity | **foreign keys** | **none — no equivalent exists** |
| Constraints | `CHECK`, `UNIQUE`, exclusion | unique indexes; JSON Schema validation |
| Default | enforcement on | enforcement off |

The row that matters most is **referential integrity**. MongoDB has no foreign
keys and no `ON DELETE CASCADE`. A document referencing a deleted document is a
normal, unremarkable state that the server will never prevent or report. If your
data has real referential constraints, either they live in application code —
where every writer must implement them — or they do not exist.

## When MongoDB is genuinely the better choice

- **The aggregate is the unit of work.** An order, a CMS page, a device's
  readings — read and written whole, with a natural document boundary.
- **The shape varies legitimately** across records — product catalogues with
  per-category attributes, event payloads, third-party API responses.
- **Write throughput on independent documents** matters more than cross-entity
  consistency.
- **Horizontal sharding is a near-term requirement**, not a hypothetical. Sharding
  is built in rather than bolted on.

## When PostgreSQL is the better choice

- **The data is relational** — many-to-many, entities updated independently, and
  invariants that span them.
- **Reporting and ad-hoc queries** matter. SQL and a mature planner beat an
  aggregation pipeline for queries nobody anticipated.
- **Multiple services write the same data.** Enforcement must live in the
  database, because "the application" is no longer singular.
- **Correctness across entities is the domain** — money movement, inventory,
  bookings.

And the modern point that changes the comparison: **PostgreSQL's `jsonb` covers a
large share of the flexibility argument.** You can store a document, index inside
it with GIN, and query it — while keeping foreign keys and transactions for the
relational parts. "We need flexible fields" is no longer a reason to leave
PostgreSQL; "our entire access pattern is document-shaped" still might be.

## The decision procedure

1. **Can you name the document your writes must be atomic over?** No → PostgreSQL.
2. **Do you have real referential constraints?** Yes, and multiple writers →
   PostgreSQL.
3. **Is the access pattern one aggregate at a time, read whole?** Yes → MongoDB
   is a strong fit.
4. **Do you need ad-hoc reporting?** Yes → PostgreSQL, or a warehouse alongside.
5. **Is it only flexible fields you want?** → PostgreSQL with `jsonb`.

## Two arguments that are no longer true

Worth retiring explicitly, because both are still repeated:

- **"MongoDB is faster."** Not as a general claim. It is faster at reading an
  embedded aggregate in one lookup and slower at things PostgreSQL indexes and
  joins well. Benchmarks that show a large gap usually compare a document read
  against an unindexed join.
- **"MongoDB doesn't do transactions."** It has done since 4.0, across replica
  sets and sharded clusters. The caveat is not capability but cost, and the
  manual's own advice that they should not replace good schema design.

## Trade-off

**The honest summary is that MongoDB moves work from the database into the
application, and whether that is a good trade depends on how long the application
stays singular.** Schema enforcement, referential integrity and cross-entity
consistency all become code you write and maintain. With one service and a
document-shaped domain, that code is small and the locality win is real.

The failure mode is organisational rather than technical: a second writer
appears — a migration script, an analytics job, another team's service — and none
of those invariants apply to it. PostgreSQL's constraints hold regardless of who
connects; MongoDB's hold only for code that remembers them.

**Default to PostgreSQL for a fullstack application** unless you can name the
aggregate boundary and defend it. That is not a slight on MongoDB — it is that
the default case in this stack has relational data, and the cost of discovering
that late is a migration.

## Gotchas

**A reference points at a deleted document.**
*Symptom:* an order references a customer that no longer exists.
*Cause:* no foreign keys; nothing prevents or reports it.
*Fix:* enforce in application code, or reconsider whether the data should be
embedded.

**`$lookup` is used everywhere.**
*Symptom:* most queries are aggregation pipelines with joins.
*Cause:* a relational model in a document database.
*Fix:* revisit the schema — or the database choice.

**Flexible fields were the whole reason.**
*Symptom:* MongoDB was chosen for schema flexibility alone.
*Cause:* an outdated comparison — `jsonb` gives the same flexibility with
constraints intact.
*Fix:* PostgreSQL with `jsonb` for the variable parts.

**Reporting is painful.**
*Symptom:* analysts cannot answer questions without engineering help.
*Cause:* no SQL, and aggregation pipelines are not an ad-hoc query language.
*Fix:* a replica into a warehouse, or PostgreSQL from the start.

**Cross-document consistency bugs appear under load.**
*Symptom:* rare inconsistent states between two collections.
*Cause:* two atomic writes with a gap, no transaction.
*Fix:* embed, or use a transaction, or make the operation idempotent.

## Interview questions

**★ What is the actual trade between MongoDB and PostgreSQL?**
Three things: locality versus joins (embedding reads an aggregate in one lookup
but duplicates shared data), document atomicity versus general transactions
(MongoDB gives one document free and charges for more), and where the schema is
enforced (server-side and always in PostgreSQL, application-side by default in
MongoDB). Everything else follows from those.

**★ Which is faster?**
Neither, as a general claim. MongoDB is faster at reading an embedded aggregate
in a single lookup; PostgreSQL is faster at queries its planner and indexes are
built for. Benchmarks showing a big gap usually compare a document read against
an unindexed join.

**★ What does MongoDB have no equivalent for?**
Referential integrity. There are no foreign keys and no cascading deletes — a
dangling reference is a normal state the server never prevents or reports. Those
invariants must live in application code, which only works while there is one
writer.

**When is MongoDB clearly the right choice?**
When the aggregate is the unit of work and is read whole, when record shape
legitimately varies, when independent-document write throughput matters more than
cross-entity consistency, or when sharding is a near-term requirement.

**Does "we need flexible fields" justify MongoDB?**
Not on its own any more. PostgreSQL's `jsonb` stores and indexes documents while
keeping foreign keys and transactions. A document-shaped *access pattern* is a
better reason than flexible fields.

**Is it true MongoDB does not support transactions?**
No — multi-document transactions have existed since 4.0 across replica sets and
sharded clusters. The real caveat is cost, and the manual's own guidance that
they should not substitute for effective schema design.

---

← [04 · Document, collection, database](./04-document-collection-database.md) · Back to [Phase 0 overview](./README.md)
