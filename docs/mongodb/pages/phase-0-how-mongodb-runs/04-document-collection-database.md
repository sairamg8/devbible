---
title: "Document, collection, database"
sidebar_label: "04 · Document, collection, database"
sidebar_position: 4
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-14 against the **MongoDB Manual** —
> [Databases and Collections](https://www.mongodb.com/docs/manual/core/databases-and-collections/),
> [Schema Validation](https://www.mongodb.com/docs/manual/core/schema-validation/) and
> [Naming Restrictions](https://www.mongodb.com/docs/manual/reference/limits/#naming-restrictions).

**Three levels, and the important thing about each is what it does *not*
enforce.** Coming from SQL, the shapes look familiar and the guarantees are not.

## The three levels

| MongoDB | Rough SQL analogue | What it enforces |
|---|---|---|
| **Document** | row | its own 16 MiB limit; nothing about shape |
| **Collection** | table | nothing, unless you add a validator |
| **Database** | database/schema | nothing about shape; it is a namespace and a unit of auth |

The analogy is useful for orientation and misleading past that point. A table
enforces columns and types on every row; **a collection enforces nothing by
default.** Two documents in the same collection may share no fields at all.

## Everything is created implicitly

```js
db.orders.insertOne({ orderNumber: "A-1" })
```

If the database does not exist, it is created. If the collection does not exist,
it is created. No `CREATE DATABASE`, no `CREATE TABLE`, no error.

That is convenient and has one sharp consequence:

```js
db.oders.insertOne({ orderNumber: "A-2" })   // typo → a brand-new collection
```

No error, no warning. The write succeeds, and the document is somewhere your
reads will never look. `db.getCollectionNames()` is the check, and it is worth
running when data "disappears".

**Creating collections explicitly is the defence**, and it is where a validator
naturally goes:

```js
db.createCollection("orders", { validator: { $jsonSchema: { /* … */ } } })
```

An explicitly created collection with a validator gives you back roughly what a
table gave you — with the difference that you opted in.

## What a collection *does* own

Not shape, but several things that matter:

- **Indexes.** Defined per collection, including the mandatory `_id` index.
- **The validator**, if any, plus `validationLevel` and `validationAction`.
- **Write concern and read concern defaults**, if set.
- **Collation** — the default string comparison rules for the collection.
- **Options** such as capped size, time-series configuration, or a clustered
  index.

Several of these are **fixed at creation time**. A capped collection cannot be
made uncapped, and a time-series collection cannot be converted to a regular one.
Choosing them later means creating a new collection and migrating.

## `_id` — the one rule a collection does enforce

Every document has an `_id`, it is unique within the collection, and it is
immutable. If you do not supply one, the driver generates an `ObjectId`.

```js
db.orders.insertOne({ _id: "A-1", total: 100 })    // your own key is fine
db.orders.updateOne({ _id: "A-1" }, { $set: { _id: "A-2" } })   // ❌ error
```

The `_id` index is created automatically and **cannot be dropped**. It is the
only guarantee of uniqueness you get without asking.

Using a natural key as `_id` — an order number, an email — is legitimate and
saves an index, at the cost of the ObjectId's free timestamp and monotonic
insert behaviour (topic 03).

## Databases: namespace and security boundary

A database is where **users and roles** are scoped, which is its most practical
property. Splitting an application across databases is a security and
administrative decision more than a modelling one.

Two constraints worth knowing:

- **Transactions can span collections and databases** in a replica set, so a
  database boundary is not an atomicity boundary.
- **`$lookup` can join across collections but not across databases**, so a
  database boundary *is* a query boundary.

The namespace — `db.collection` — has a length limit, and names have
restrictions: no `$`, no null bytes, collection names cannot start with `system.`,
and database names are case-insensitive on some filesystems, which is a real
source of "works on Linux, fails on macOS" surprises.

## Dropping is not deleting

```js
db.orders.deleteMany({})   // removes documents; keeps indexes and the validator
db.orders.drop()           // removes the collection: documents, indexes, validator
```

`deleteMany({})` walks every document and is slow on a large collection.
`drop()` removes the namespace and is fast — and it destroys your index
definitions and validator with it, which is precisely what you do *not* want if
you were only clearing data between tests.

**For test teardown, `deleteMany({})` preserves the setup; `drop()` does not.**

## How many collections?

The relational instinct is one collection per entity. In MongoDB the question is
*"what is read together"* (topic 01), so the answer is often fewer collections
than a normalised schema would have — an order with its items is one collection,
not two.

The opposite mistake exists too: a single `documents` collection holding several
unrelated shapes distinguished by a `type` field. That defeats indexes, makes
validators impossible, and is usually a sign the model was never decided.

**Separate collections when the documents have different shapes, different access
patterns, or different lifetimes.**

## Trade-off

**Implicit creation removes ceremony and removes a safety net.** There is no
moment where the database asks you what this collection is for, which is exactly
the moment SQL uses to catch typos, force type decisions, and record intent. In
exchange, prototyping is genuinely faster and schema changes need no migration.

The deeper cost is that "the collection enforces nothing" pushes every invariant
into application code, and application code is not the only writer forever — a
migration script, an admin tool, or a second service will eventually write
directly. Whatever the collection does not enforce, those writers are free to
violate.

The workable position: **create collections explicitly, with a validator, for
anything that will outlive the code that created it.** Accept implicit creation
for scratch and test data. The cost is one `createCollection` call per collection,
paid once.

## Gotchas

**Data written successfully cannot be found.**
*Symptom:* inserts succeed, queries return nothing.
*Cause:* a typo created a new collection.
*Fix:* `db.getCollectionNames()`; create collections explicitly.

**A validator cannot be added later.**
*Symptom:* enabling validation rejects existing documents.
*Cause:* drift accumulated while the collection was unvalidated.
*Fix:* `validationAction: "warn"`, fix the data, then switch to `error`.

**Test teardown removed the indexes.**
*Symptom:* tests slow down or a unique constraint stops firing.
*Cause:* `drop()` removes indexes and the validator, not just documents.
*Fix:* `deleteMany({})` between tests.

**`$lookup` fails across databases.**
*Symptom:* an aggregation cannot join two collections.
*Cause:* `$lookup` is scoped to one database.
*Fix:* keep collections that must be joined in the same database.

**A collection option cannot be changed.**
*Symptom:* capped or time-series settings are immutable.
*Cause:* several options are fixed at creation.
*Fix:* create a new collection and migrate.

## Interview questions

**★ What does a collection enforce?**
By default, nothing about document shape — two documents may share no fields. It
does own indexes, the `_id` uniqueness guarantee, any validator you add,
collation, and creation-time options such as capped or time-series. Shape
enforcement is opt-in via JSON Schema validation.

**★ What happens if you insert into a collection name that does not exist?**
It is created, along with the database if necessary — no error. That is why a
misspelled collection name silently produces a new empty collection rather than
failing, and why explicit creation with a validator is worth the ceremony.

**★ What is the difference between `deleteMany({})` and `drop()`?**
`deleteMany({})` removes documents but keeps the collection, its indexes and its
validator. `drop()` removes the whole namespace including indexes and validator.
For test teardown you almost always want `deleteMany({})`.

**What rules apply to `_id`?**
Every document has one, it is unique within the collection, immutable, and
automatically indexed with an index that cannot be dropped. You may supply your
own value instead of letting the driver generate an `ObjectId`.

**Is a database boundary an atomicity boundary?**
No — transactions can span collections and databases within a replica set. It
*is* a query boundary, because `$lookup` cannot join across databases, and it is
the scope for users and roles.

**When should two things be separate collections?**
When they have different shapes, different access patterns, or different
lifetimes. Not simply because they are different entities — data read together
often belongs in one document.

---

← [03 · BSON](./03-bson.md) · Next: [05 · MongoDB vs PostgreSQL](./05-mongodb-vs-postgresql.md) →
