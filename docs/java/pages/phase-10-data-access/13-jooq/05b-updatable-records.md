---
title: "UpdatableRecord gives you store, insert, update, delete and refresh on a single row, which is the most ORM-like thing in jOOQ and the place where jOOQ's guarantees are weakest"
sidebar_label: "05b · UpdatableRecords"
sidebar_position: 19
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-08 against the jOOQ 3.21 manual — *CRUD with UpdatableRecords*
> ([crud-with-updatablerecords](https://www.jooq.org/doc/latest/manual/sql-execution/crud-with-updatablerecords/))
> and *Code generation — Records*
> ([codegen-records](https://www.jooq.org/doc/latest/manual/code-generation/codegen-object-types/codegen-records/)).
> jOOQ **3.21.7**, JDK 25, Spring Boot 4.1.0, PostgreSQL 18.

**The manual is candid that this API exists to do what an ORM does: *"jOOQ facilitates CRUD using
a specific API involving `org.jooq.UpdatableRecord` types"*, reducing the boilerplate of
single-row work. It is genuinely convenient, and it is the one corner of jOOQ where you are
manipulating an object and hoping the right statement comes out — which is the exact property the
rest of the library was designed to remove. Knowing where that trade is worth taking is the point
of this page.**

## Which records are updatable

From **[02 · Code generation](02-code-generation.md)**: every table and view generates a
`TableRecord` implementation, *"or `org.jooq.UpdatableRecord` if there's a primary key"*.

**No primary key, no `UpdatableRecord`** — and therefore no `store()`, `update()`, `delete()` or
`refresh()`, because there is no way to address the row. That is a schema fact showing up as a
Java API difference, which is exactly the sort of thing generated code is good at surfacing.

## The five methods

```java
OrderRecord order = create.selectFrom(ORDER).where(ORDER.ID.eq(id)).fetchOne();
order.setStatus("SHIPPED");
order.store();
```

| Method | What it does |
|---|---|
| `store()` | `INSERT` or `UPDATE`, depending on where the record came from |
| `insert()` | always an `INSERT` |
| `update()` | always an `UPDATE` |
| `delete()` | `DELETE` |
| `refresh()` | reload the row from the database |

🔴 **`store()` picks its statement from the record's origin, not from its contents.** The manual:
a record *fetched* from the database and then modified is `UPDATE`d; a record *created in memory*
is `INSERT`ed. Two records with identical field values can produce different statements, and the
difference is invisible in the values.

`create.newRecord(ORDER)` makes an empty one; `create.newRecord(ORDER, myPojo)` builds one from
your own object — the reverse direction of **[04 · Mapping results](04-mapping-results.md)**.

## Dirty tracking, and how it differs from an ORM's

jOOQ keeps **changed flags** per column, and only the changed columns go into the generated
statement. That has two consequences worth separating:

- **The `UPDATE` names only the columns you touched.** Two concurrent updates to different columns
  of the same row do not overwrite each other's work — a real advantage over writing every column
  back.
- **It is per-record and immediate, not a unit of work.** There is no persistence context, no
  flush ordering, no cascade and no automatic detection at transaction commit. `store()` writes
  now, and nothing writes if you do not call it.

⚠️ **That second point is the whole difference from JPA's dirty checking**, which
**[Topic 06 · The JPA/Hibernate model](../06-jpa-hibernate-model/README.md)** covers in depth. In
JPA, mutating a managed entity is enough. Here, mutating a record is a local change to an object
until you store it.

## When this API is the right one

It is a narrow but real set of cases:

- **Load one row, change a couple of fields, save it.** A settings page, an admin edit, a status
  transition. The statement API would need the column list twice.
- **Building a row from a POJO** with `newRecord(TABLE, pojo)`, then `store()`.
- **Refreshing after a write** that had database-side defaults or triggers — `refresh()` re-reads,
  rather than guessing what the database did.

## When it is the wrong one

- **Anything set-based.** One `UPDATE … WHERE` beats fetching a thousand records and storing each.
  This is the mistake to watch for, because the record API makes the loop easy to write.
- **When you want an explicit statement in review.** `order.store()` in a diff does not tell a
  reader whether an insert or an update happens. `create.update(ORDER)…` does.
- **When the write must be conditional.** A status transition guarded by
  `and(ORDER.STATUS.eq("PENDING"))` is expressible as a statement and is not expressible as
  `store()` — see **[05 · Writes](05-writes.md)**.

**The house style worth adopting:** statements by default, records for genuine single-row edit
flows. That keeps the property jOOQ was chosen for — you can read the SQL off the Java — in the
places where it matters.

## Gotchas

**★ A table with no primary key generates a `TableRecord`, not an `UpdatableRecord`.** So
`store()` does not exist and the compile error is about a missing method rather than about a
missing key. The fix is in the schema, not in the code.

**★ `store()` on a record you built by hand always inserts — even if the row exists.** The record
does not know it corresponds to an existing row, so you get a unique-constraint violation, not an
update. `newRecord(TABLE, pojo)` with a populated id is exactly this trap.

**★ `attach()` matters for a record that arrived without a `Configuration`.** A record deserialised
or constructed outside a `DSLContext` has nothing to execute against, and the failure is at
`store()` time, not at construction.

**★ Only changed columns are written, which is usually what you want and occasionally not.**
Deliberately writing an unchanged value back — to bump a trigger, to touch a row — requires
marking the field changed explicitly, because jOOQ correctly decides there is nothing to do.

**★ Setting a field to the value it already holds still marks it changed.** The flag tracks
assignment, not difference. That is the opposite surprise to the previous one, and both bite.

**★ `refresh()` throws if the row is gone.** It is a re-read by primary key; a deleted row has no
result. Code that calls `refresh()` in a retry loop needs to handle that.

**★ There is no cascade.** Storing a parent record does nothing to any child. Nothing in jOOQ
mirrors JPA's `CascadeType`, and expecting it produces orphans silently.

**★ `store()` inside a loop over a collection is an N+1 write.** The record API makes it read
naturally. `batchStore()` exists, and a single set-based statement is usually better than either.

**★ The record holds a reference to a `Configuration`, so it holds a data source.** Passing records
up into higher layers hands those layers the ability to write to the database, which is a design
problem long before it is a bug.

**★ `insert()` and `update()` bypass `store()`'s origin logic — including when that logic was
right.** Calling `update()` on a record that was never fetched updates a row you never read, using
whatever primary key the record happens to hold.

**★ A record fetched with a partial projection cannot be stored safely.**
`select(ORDER.ID, ORDER.STATUS).from(ORDER)` does not give you an `OrderRecord` with every column
populated; storing something assembled from a subset is how a column gets written with a default
it never had.

**★ Records are mutable, so sharing one across threads is exactly as dangerous as it sounds.** They
look like DTOs and are not; the changed flags alone make them stateful.

## Interview questions

**★ What makes a generated record an `UpdatableRecord`?** A primary key on the table. Without one
jOOQ generates a `TableRecord`, which has no `store()`, `update()`, `delete()` or `refresh()`,
because there is no way to address a single row.

**★ How does `store()` decide between `INSERT` and `UPDATE`?** By the record's origin: a record
fetched from the database and then modified is updated; a record created in memory is inserted.
Not by whether the primary key is populated, and not by the field values.

**★ You built a record from a POJO with a populated id and called `store()`. What happens?** An
`INSERT`, because the record was created in memory. If the row exists you get a unique-constraint
violation rather than the update you expected.

**★ What is jOOQ's dirty tracking, and how does it differ from JPA's?** jOOQ keeps changed flags
per column, so only assigned columns appear in the `UPDATE`. Unlike JPA there is no persistence
context, no flush at commit, no cascade — mutating a record changes an object, and nothing reaches
the database until you call `store()`.

**★ Why is "only changed columns are written" a real advantage?** Because two concurrent updates
touching different columns of the same row do not clobber each other. Writing the whole row back —
what a naive DTO-based update does — makes the last writer win on every column.

**★ When would you deliberately use the record API rather than a statement?** Single-row edit
flows: load, change two fields, save. And building a row from a POJO. Anything set-based or
conditional belongs in a statement.

**★ Why can a record with a partial projection be dangerous to store?** Because the columns you did
not select are not populated, and storing it can write defaults over real data. Records are for
rows you fetched whole.

**★ Does storing a parent record store its children?** No. jOOQ has no cascade of any kind. Each
row is written by an explicit call, which is either the reassurance or the boilerplate, depending
on what you are used to.

**★ What is the risk of passing `Record` objects out of the repository layer?** They are mutable,
they carry changed flags, and they hold a `Configuration` — so the layer that receives one can
write to the database. It also spreads jOOQ's types through the application, which is the coupling
argument from [04 · Mapping results](04-mapping-results.md).

**★ How do you force jOOQ to write a column whose value did not change?** Mark the field as changed
explicitly. jOOQ's default — writing nothing when nothing was assigned — is correct, and the
override exists for the trigger-touching case.

**★ What does `refresh()` do and when does it fail?** It re-reads the row by primary key, which is
the honest way to pick up database-side defaults and trigger effects. It fails when the row no
longer exists.

**★ You are updating ten thousand rows. Why is the record API the wrong tool?** Because it is one
statement per row, plus the fetch that produced each record. A single `UPDATE … WHERE` does the
same work in one round trip and never brings a row to Java.

{/* FOOTER */}
