---
title: "A partial update writes one field instead of a whole document, and `findAndModify` is the atomic read-and-write that a query followed by a save can never be"
sidebar_label: "03b · Partial updates"
sidebar_position: 8
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-08 against the Spring Data MongoDB 5.1 reference *Template CRUD
> operations* — the `updateFirst`/`updateMulti`/`upsert` sections, the `Update` modifier
> list, `AggregationUpdate`, `findAndModify` and `findAndReplace`
> ([docs.spring.io/spring-data/mongodb/reference/mongodb/template-crud-operations.html](https://docs.spring.io/spring-data/mongodb/reference/mongodb/template-crud-operations.html)).
> JDK 25, Spring Boot 4.1.0, Spring Data MongoDB 5.1.0, MongoDB Java driver 5.8.0.

**Everything wrong with `save` in the previous chunk comes from writing a document you
loaded. The fix is to stop loading it. A partial update sends the server a filter and a
set of modifiers, and the document is changed in place — no read, no in-memory copy, no
window in which someone else's write can be lost. This is not an optimisation; it is the
correct default for any write that changes less than the whole document.**

## `updateFirst`, `updateMulti` and `upsert`

```java
mongo.updateFirst(
        Query.query(where("_id").is(id)),
        new Update().set("status", "SHIPPED").currentDate("shippedAt"),
        Order.class);

mongo.updateMulti(
        Query.query(where("status").is("PENDING").and("placedAt").lt(cutoff)),
        new Update().set("status", "EXPIRED"),
        Order.class);

mongo.upsert(
        Query.query(where("customerId").is(customerId)),
        new Update().inc("orderCount", 1).setOnInsert("createdAt", Instant.now()),
        CustomerStats.class);
```

- **`updateFirst`** updates the first matching document. On a query by `_id` that is the
  only matching document, which is the common case.
- **`updateMulti`** updates every match, in one server-side operation. This is the
  MongoDB equivalent of a bulk `UPDATE … WHERE`, and it is a genuine reason to reach for
  the template: the repository cannot express it at all, and doing it by loading and
  saving each document is slower, racy, and proportional to the result size.
- **`upsert`** updates if a match exists and inserts if none does. The reference
  describes the inserted document precisely: **"The document that is inserted is a
  combination of the query document and the update document"** — which is why
  `where("customerId").is(customerId)` matters twice, once as the filter and once as a
  field of the created document. `setOnInsert` adds fields that apply only on the insert
  branch.

All three take the domain class, which is what lets the mapping layer translate property
names and convert values inside the query and update documents. There are overloads
taking a collection name as a `String` instead; those skip mapping entirely.

Each returns an `UpdateResult` carrying the matched count, the modified count and the
upserted id. **Matched and modified are different numbers** — a `$set` writing the value a
field already holds matches but does not modify. Checking the wrong one is how an
idempotent retry gets reported as a failure.

## The `Update` modifiers

`Update` is a fluent builder over MongoDB's update operators, and knowing the list is
most of knowing what a partial update can do:

| Method | Operator | What it is for |
|---|---|---|
| `set` | `$set` | write a field |
| `unset` | `$unset` | remove a field entirely |
| `inc` | `$inc` | atomic numeric increment |
| `multiply` | `$mul` | atomic multiply |
| `min` / `max` | `$min` / `$max` | write only if lower / higher |
| `currentDate` | `$currentDate` | server-side timestamp |
| `rename` | `$rename` | rename a field in place |
| `setOnInsert` | `$setOnInsert` | applies only on an upsert's insert branch |
| `push` / `addToSet` | `$push` / `$addToSet` | append to an array, with or without duplicates |
| `pull` / `pullAll` | `$pull` / `$pullAll` | remove matching array elements |
| `pop` | `$pop` | remove the first or last array element |

`inc`, `min`, `max` and `addToSet` deserve calling out, because they solve concurrency
problems no amount of careful application code solves. `inc("stock", -1)` is atomic at the
server; a read-modify-write of the same field is not. `addToSet` appends without a read,
so two concurrent appends both land — where two `save` calls on a loaded list would lose
one. `max("highScore", n)` is a compare-and-set with no compare in your code.

`currentDate` is the one to remember for auditing, because a server-side timestamp is
immune to clock skew between application instances.

## `AggregationUpdate` — an update that computes from the document

When the new value depends on the document's current contents, a plain `$set` cannot
express it. MongoDB accepts a pipeline as the update, and Spring Data exposes it as
`AggregationUpdate`:

```java
AggregationUpdate update = AggregationUpdate.update()
        .set("total").toValue(ArithmeticOperators.valueOf("subtotal").add("shipping"))
        .set("updatedAt").toValue(SystemVariable.NOW);

mongo.updateFirst(Query.query(where("_id").is(id)), update, Order.class);
```

Its stages are the pipeline-update subset — `set`/`addFields`, `unset` and `replaceWith`
— not the full aggregation vocabulary. It is worth knowing exists, because the
alternative is a read, a computation in Java and a write: three round trips and a race,
replaced by one atomic operation.

## `findAndModify` and `findAndReplace`

```java
Order shipped = mongo.findAndModify(
        Query.query(where("_id").is(id).and("status").is("PENDING")),
        new Update().set("status", "SHIPPED"),
        FindAndModifyOptions.options().returnNew(true),
        Order.class);
```

One round trip, atomic at the server, and it hands back the document. `returnNew(true)`
returns the post-update state; the default returns the pre-update state, which is the form
you want when you need to know what you replaced. `upsert(true)` is also available on the
options.

Note the `and("status").is("PENDING")` in the filter. That is the whole trick: **the
precondition is part of the query, not a check in Java.** If another worker has already
flipped the status, the filter matches nothing, the method returns `null`, and you know
you lost the race — instead of both workers believing they won.

This is the primitive behind every job-queue-in-MongoDB: match a pending item, flip it to
in-progress, and receive it, with no window in which another worker could claim the same
one. It is the same reasoning as `SELECT … FOR UPDATE SKIP LOCKED` in
[03 · Locking and `SELECT FOR UPDATE`](../03-jdbc-transactions/12-locking-and-select-for-update.md),
reached by a completely different mechanism — MongoDB gives you atomicity on a single
document for free, so a queue built on one document per job needs no locking at all.

`findAndReplace` swaps the whole document rather than applying modifiers.

⚠️ The replacement object **must not carry an `_id`**. `_id` is immutable at the server,
so a replacement that includes one is rejected; the id comes from the matched document.

## Gotchas

**★ `upsert`'s inserted document is the query document plus the update document.** A
field you filtered on ends up stored, and a field you assumed would be set is not unless
the update sets it. Read the created document's shape off both halves.

**★ `updateFirst` bypasses `@Version` entirely.** The optimistic-locking check lives on
the mapped save path. A template update writes whatever the query matches, version field
untouched — so mixing `save` and `updateFirst` on the same document gives you a version
number that no longer means anything.

**★ `updateMulti` publishes no per-document lifecycle events and runs no per-document
callbacks.** Auditing annotations like `@LastModifiedDate` are applied by the mapped save
path, not by a server-side bulk update. Set the timestamp yourself with `currentDate`.

**★ A `null` value in `Update.set` writes a null field, it does not skip it.** Building an
`Update` in a loop from a partially-populated DTO is how a PATCH endpoint blanks fields
nobody asked to change. Skip nulls explicitly, or use a representation that distinguishes
absent from null.

**★ `matchedCount` and `modifiedCount` are different, and code usually checks the wrong
one.** Setting a field to the value it already holds matches without modifying, so an
idempotent write reports zero modifications and looks like a failure.

**★ `$inc` on a field that does not exist creates it; `$inc` on a string field errors.**
The first is convenient and the second is a runtime failure on a document written by an
older version of your schema.

**★ `findAndReplace` with an `_id` on the replacement is rejected.** `_id` is immutable at
the server, and the replacement is a document body, not an update.

**★ `findAndModify` with default options returns the document as it was *before* the
update.** Reading the returned object to confirm your change succeeded gives you the old
value, which looks like the update silently failed.

**★ `findAndModify` returning `null` means the filter matched nothing, which is usually
your answer, not an error.** Treating it as a failure and retrying is how a job queue
double-processes.

**★ The template's `Query` and `Update` are mapped against the domain class only when you
pass one.** The overloads taking a collection name as a `String` skip property-name
translation, so `@Field`-renamed properties must be spelled with their stored names.

**★ `Query` with no criteria matches everything.** `mongo.updateMulti(new Query(), …)` is
a full-collection write, and there is nothing between you and it — no planner, no
confirmation prompt, no `WHERE` clause a reviewer's eye is trained to look for.

**★ `updateMulti` is not atomic across documents.** Each document is updated atomically;
the operation as a whole is not. A reader can observe a half-applied bulk update unless
it runs inside a transaction — see
[04 · Transactions in MongoDB](04-transactions-in-mongo.md).

**★ `push` on an unbounded array grows the document towards the 16 MB limit.** Arrays that
only ever grow are a modelling mistake that partial updates make very easy to commit,
because each individual append is cheap and invisible.

## Interview questions

**★ What is the actual argument for a partial update over `save`?**
It removes the read. There is no in-memory copy of the document, so there is nothing to
be stale, nothing to overwrite, and no window between the read and the write. It is
correctness first and a round trip saved second.

**★ Does `updateFirst` respect `@Version`?**
No. Optimistic locking is applied by the mapped save path. A template update writes what
the query matches and does not touch the version — so a document written by both routes
has a version field that no longer reflects reality.

**★ What document does an `upsert` create when nothing matches?**
A combination of the query document and the update document. Equality criteria from the
query become fields of the new document, and `setOnInsert` adds fields that apply only on
that branch.

**★ When would you use `findAndModify` over a query followed by a save?**
Whenever the read and the write must be atomic — claiming a job from a queue, decrementing
stock, flipping a state machine. It is one round trip with no window for another worker to
interleave, and the precondition lives in the filter rather than in an `if` statement.

**★ How do you build a work queue on MongoDB without locking?**
`findAndModify` with the pending state in the filter and the claimed state in the update.
Single-document operations are atomic, so exactly one worker's filter matches; the losers
get `null` back and move on. No `FOR UPDATE`, no advisory lock, no lease table.

**★ What is `AggregationUpdate` for?**
Updates whose new value is computed from the document's existing fields. It sends a
pipeline as the update instead of a set of modifiers, replacing a read-compute-write
sequence with a single server-side operation.

**★ Which `Update` modifiers solve concurrency problems that application code cannot?**
`inc`, `multiply`, `min`, `max` and `addToSet` — each is atomic at the server. Their
read-modify-write equivalents in Java are races, and no amount of careful ordering fixes
that.

**★ Your PATCH endpoint builds an `Update` from a DTO and starts blanking fields. Why?**
Unset fields in the DTO are `null`, and `Update.set(field, null)` writes a null rather
than skipping the field. The endpoint has to distinguish "absent" from "explicitly null",
which is a representation problem before it is a MongoDB one.

**★ A write reports `modifiedCount` of zero but the data is correct. What happened?**
The update set fields to values they already held. `matchedCount` is the number you
wanted; `modifiedCount` counts documents whose contents actually changed. This is normal
on a retry and normal on an idempotent write.

**★ Is `updateMulti` atomic?**
Per document, yes; across documents, no. A concurrent reader can see some documents
updated and others not. Making the whole operation atomic requires a multi-document
transaction, which has its own preconditions.

{/* FOOTER */}
