---
title: "The fluent template API makes the difference between updating one document and all of them a word rather than a method name, and bulk writes are JDBC batching under another name"
sidebar_label: "03c · Fluent API and bulk writes"
sidebar_position: 9
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-08 against the Spring Data MongoDB 5.1 reference *Template CRUD
> operations* — the fluent template API sections (`query`, `update`, `insert`, `remove`)
> and the bulk-operations section, including its note that lifecycle event publishing is
> limited for bulk operations
> ([docs.spring.io/spring-data/mongodb/reference/mongodb/template-crud-operations.html](https://docs.spring.io/spring-data/mongodb/reference/mongodb/template-crud-operations.html)).
> JDK 25, Spring Boot 4.1.1, Spring Data MongoDB 5.1.0, MongoDB Java driver 5.8.0.

**`updateFirst` and `updateMulti` are two method names that differ by one word in the
middle, and one of them writes a single document while the other writes the whole
collection. The fluent API exists mostly to fix that: it makes the number of documents a
terminal method you have to type, rather than a suffix you have to notice. Bulk
operations sit alongside it and answer a different question — not how many documents one
operation touches, but how many operations fit in one round trip.**

## The fluent API

```java
mongo.update(Order.class)
     .matching(where("status").is("PENDING").and("placedAt").lt(cutoff))
     .apply(new Update().set("status", "EXPIRED"))
     .all();

mongo.query(Order.class)
     .matching(where("customerId").is(customerId))
     .as(OrderSummary.class)
     .all();

mongo.insert(Order.class).one(order);

mongo.remove(Order.class)
     .matching(where("status").is("CANCELLED"))
     .all();
```

`query`, `update`, `insert` and `remove` each open a small builder, and the **terminal
method is what says how many documents you meant**:

| Terminal | Meaning |
|---|---|
| `one()` | exactly one match expected; more than one is an error |
| `first()` | the first match, or empty |
| `all()` | every match |
| `oneValue()` / `firstValue()` | the value itself rather than an `Optional` |
| `count()` | how many match |
| `exists()` | whether any match |
| `findAndModify()` / `findAndReplace()` | the atomic read-and-write |
| `upsert()` | update or insert |
| `stream()` | a cursor you must close |
| `tail()` | a tailable cursor on a capped collection |

That is more than syntax sugar. `all()` next to `first()` is a deliberate word in a code
review diff; `updateMulti` next to `updateFirst` is two similar identifiers that the eye
merges. On an operation whose blast radius is "the entire collection", that difference is
worth something.

### `.as(…)` is a projection, not a cast

```java
mongo.query(Order.class)          // the collection and the mapping source
     .as(OrderSummary.class)      // what comes back, and what the server sends
     .matching(where("status").is("SHIPPED"))
     .all();
```

`inCollection("…")` overrides the collection name when it does not follow from the domain
type. `.as(…)` sets the target type, and Spring Data derives a field projection from it —
so the server sends only the fields `OrderSummary` declares, not the whole document and a
discard in Java. That is the same argument as DTO projections in
[08 · Projections and DTOs](../08-the-n-plus-1-problem/12-projections-and-dtos.md), and it
has the same payoff: less on the wire, less to deserialise, and a type that cannot
accidentally be saved back as a whole document.

## Bulk operations

```java
BulkOperations bulk = mongo.bulkOps(BulkOperations.BulkMode.UNORDERED, Order.class);

for (var change : changes) {
    bulk.updateOne(
        Query.query(where("_id").is(change.id())),
        new Update().set("status", change.status()));
}

BulkWriteResult result = bulk.execute();
```

`BulkOperations` accepts `insert`, `updateOne`, `updateMulti`, `upsert`, `remove` and
`replaceOne`, accumulates them, and sends them in as few round trips as the driver can
manage. `execute()` returns a `BulkWriteResult` with the inserted, matched, modified,
deleted and upserted counts.

**This is the MongoDB analogue of JDBC batching** from
[01 · Batch updates](../01-jdbc/19-batch-updates.md), and the reasoning there transfers
without change: the win comes from collapsing round trips, not from the server doing
anything cleverer, and it flattens out well before "all of them in one batch". The sizing
argument in [01 · Sizing a batch](../01-jdbc/19e-sizing-a-batch.md) applies here too — a
few hundred to a few thousand operations is the region where the curve stops improving,
and an unbounded batch is a memory problem before it is a throughput win.

### `ORDERED` versus `UNORDERED`

- **`ORDERED`** applies operations in the order given and **stops at the first failure**.
  Everything before it has been applied; everything after has not. You get one error.
- **`UNORDERED`** lets the server apply them in any order, **continues past failures**,
  and reports every one at the end.

`UNORDERED` is faster because the server can parallelise, and it is wrong the moment two
operations in the same batch touch the same document, because their relative order is
undefined. `ORDERED` is the safe default and `UNORDERED` is the one you choose knowingly.

Neither is a transaction. A partially-applied bulk write is a normal outcome, and there is
no rollback — see [04 · Transactions in MongoDB](04-transactions-in-mongo.md) for what it
takes to get one.

### The limitation the reference states outright

**Lifecycle event publishing is limited for bulk operations.** The callbacks and events
that the mapped save path fires — auditing, `@LastModifiedDate`, before-convert and
before-save entity callbacks — do not all run here. Anything you rely on being filled in
automatically has to be set explicitly in the `Update`, and `currentDate` is the operator
for a timestamp.

This is the same class of trap as JPA's bulk `UPDATE` bypassing the persistence context.
Bulk operations are fast because they skip the per-entity machinery, and skipping the
per-entity machinery is exactly what makes them surprising.

## Gotchas

**★ `all()` on a fluent `update` or `remove` with a permissive filter writes the whole
collection.** The fluent form makes it *readable*, not *safe*. It is still one word away
from a full-collection operation.

**★ `one()` throws when more than one document matches.** That is usually what you want,
but it means a query you believed was unique becomes a runtime failure the day the data
says otherwise. `first()` is the forgiving form and it hides the same problem.

**★ `.as(SomeDto.class)` derives the projection from the DTO's fields.** Add a field to
the DTO and the query silently starts fetching more. Remove one and it fetches less. The
wire format is coupled to a class nobody thinks of as a query.

**★ A projected type saved back as a document is the whole-document-replace trap.** The
fluent API makes projections easy, which makes it easier to reach the failure described
in [03 · MongoTemplate](03-mongotemplate.md).

**★ `stream()` holds a server-side cursor open and must be closed.** Try-with-resources or
an explicit close, and consumed before the session ends. Forgetting leaks on the server,
where local testing will never show it.

**★ `BulkMode.UNORDERED` can apply operations in any order.** Two updates to the same
document in one unordered bulk have no defined sequence. If order matters, `ORDERED` is
the mode, and it costs you the parallelism.

**★ A bulk write is not atomic and does not roll back.** A failure in the middle of an
`ORDERED` bulk leaves the earlier operations applied. Code that treats `execute()` as
all-or-nothing is wrong.

**★ Auditing fields are not populated by bulk operations.** `@LastModifiedDate` and
`@LastModifiedBy` come from the mapped save path. A bulk-updated document keeps its old
audit values, which makes the audit trail quietly untrue.

**★ `BulkWriteResult` counts are per operation type and easy to misread.** `getModifiedCount()`
excludes upserted inserts, which are in `getUpserts()`. A retry loop keyed on the wrong
counter loops forever.

**★ Accumulating an unbounded number of operations before `execute()` holds them all in
memory.** The batch is built client-side. Chunk the loop.

**★ `bulkOps` bound to a domain class maps property names; bound to a collection-name
`String` it does not.** Same trap as the update overloads, in a place where you are
usually iterating and less likely to notice.

**★ Mixing `insert` and `updateOne` for the same `_id` in one unordered bulk is a race
against yourself.** Use `upsert`, which has a defined outcome regardless of order.

## Interview questions

**★ What does the fluent template API give you over the positional overloads?**
The number of documents affected becomes a terminal method — `one()`, `first()`, `all()` —
instead of a suffix on the method name. On operations that can touch a whole collection,
making that explicit in the call is worth more than the readability.

**★ What does `.as(TargetType.class)` do?**
Sets the return type and derives a field projection from it, so the server sends only the
fields that type declares. It is a projection, not a cast — the reduction happens on the
wire, not in Java.

**★ Why is a projected object dangerous to save?**
Because `save` writes the whole document. An object that only carries some fields writes
the rest as absent or null. Projections and `save` are individually fine and lethal
together.

**★ What is `BulkOperations` the equivalent of, and what does it actually save?**
JDBC batching. It saves round trips, not server work. The throughput curve flattens well
before the batch is unbounded, and an unbounded batch is a client-side memory problem.

**★ `ORDERED` or `UNORDERED` — how do you choose?**
`UNORDERED` when the operations are independent and you want the server to parallelise
and report every failure. `ORDERED` when sequence matters or two operations touch the same
document. `ORDERED` is the safer default.

**★ Is a bulk write atomic?**
No. It is a batch of independent operations, each atomic on its own document. A failure
part-way through an `ORDERED` bulk leaves earlier operations applied and there is no
rollback.

**★ Your audit timestamps stopped updating after a change to bulk updates. Why?**
Lifecycle event publishing is limited for bulk operations, so the auditing callbacks that
normally populate `@LastModifiedDate` never run. Set the field explicitly with
`Update.currentDate(…)`.

**★ Why does that limitation exist at all?**
Because the per-entity machinery is the thing bulk operations skip in order to be fast.
The same trade appears in JPA, where a bulk `UPDATE` query bypasses the persistence
context and leaves loaded entities stale.

**★ A `stream()` result works in tests and leaks in production. What is the difference?**
Volume and lifetime. The cursor is real in both cases; locally it is closed by process
exit before anyone notices, and in production thousands of unclosed cursors accumulate on
the server.

{/* FOOTER */}
