---
title: "A derived delete loads the rows and removes them one by one so callbacks and cascades happen; a @Modifying delete issues one statement and skips all of it — the same method name can mean either, and the difference is invisible in the diff"
sidebar_label: "04c · Derived delete vs bulk delete"
sidebar_position: 24
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 against the Spring Data JPA 4.1 reference — "JPA Query
> Methods", section "Derived Delete Queries"
> ([query-methods.html](https://docs.spring.io/spring-data/jpa/reference/jpa/query-methods.html));
> the batch-delete warnings from the `JpaRepository` javadoc
> ([apidocs](https://docs.spring.io/spring-data/jpa/docs/current/api/org/springframework/data/jpa/repository/JpaRepository.html));
> Jakarta Persistence 3.2 §4.11.
> JDK 25, Spring Boot 4.1.0, Spring Data JPA 4.1.0, Hibernate ORM 7.4.1,
> PostgreSQL 18.

**Spring Data gives you two ways to delete a set of rows and they look almost
identical at the call site. One runs a select, materialises every matching
entity, and removes them individually so that cascades, orphan removal and
`@PreRemove` all happen. The other sends one `delete` statement and none of that
happens. The reference puts both on the same page precisely because the choice is
easy to make by accident — and the version that is faster is the version that
silently skips your model's rules.**

## The two methods, side by side

The reference's own example is the clearest statement of it:

```java
interface UserRepository extends Repository<User, Long> {

    void deleteByRoleId(long roleId);

    @Modifying
    @Query("delete from User u where u.role.id = ?1")
    void deleteInBulkByRoleId(long roleId);
}
```

> "Although the `deleteByRoleId(…)` method looks like it basically produces the
> same result as the `deleteInBulkByRoleId(…)`, there is an important difference
> between the two method declarations in terms of the way they are run."

**The bulk one** *"issues a single JPQL query (the one defined in the annotation)
against the database. This means even currently loaded instances of `User` do not
see lifecycle callbacks invoked."*

**The derived one** does the opposite, deliberately: *"To make sure lifecycle
queries are actually invoked, an invocation of `deleteByRoleId(…)` runs a query
and then deletes the returned instances one by one, so that the persistence
provider can actually invoke `@PreRemove` callbacks on those entities."*

And the implementation is stated outright, which is the sentence to remember:

> "In fact, a derived delete query is a shortcut for running the query and then
> calling `CrudRepository.delete(Iterable<User> users)` on the result and keeping
> behavior in sync with the implementations of other `delete(…)` methods in
> `CrudRepository`."

## What each one costs

The reference attaches an explicit warning to the derived form:

> "When deleting a lot of objects you will need to consider the performance
> implications to ensure sufficient memory availability. All resulting objects are
> loaded into memory before being deleted and are held in the session until
> flushing or completing the transaction."

So a derived `deleteByStatus(ARCHIVED)` over two million rows is: one select
returning two million entities, two million objects retained in the persistence
context, and two million `delete` statements. That is not a slow version of the
bulk statement — it is a different order of magnitude and a plausible
`OutOfMemoryError`.

The bulk form's cost is the one from
[04 · modifying queries](04-modifying-queries.md): no cascade, no callbacks, no
version handling, and a persistence context that still believes those rows exist.

| | Derived `deleteBy…` | `@Modifying` bulk `delete` |
|---|---|---|
| statements | 1 select + N deletes | 1 |
| memory | every matched entity | none |
| `@PreRemove` / `@PostRemove` | fire | do not fire |
| `cascade = REMOVE` | applies | does not apply |
| `orphanRemoval` | applies | does not apply |
| `@Version` | checked on each remove | bypassed entirely |
| persistence context | consistent afterwards | stale until cleared |
| suitable for | tens or hundreds of rows with real model rules | large sets with no dependent state |

## The third option, and its warning label

`JpaRepository` adds batch deletes that sit between the two —
`deleteAllInBatch()`, `deleteAllInBatch(Iterable)` and
`deleteAllByIdInBatch(Iterable)`. They issue a statement rather than looping, and
their javadoc says exactly what that costs:

> "leaves JPAs first level cache and the database out of sync. Consider flushing
> the `EntityManager` before calling this method. It will also NOT honor cascade
> semantics of JPA, nor will it emit JPA lifecycle events."

🔴 **So `deleteAll()` and `deleteAllInBatch()` are not two spellings of one
operation.** `deleteAll()` goes through the entity path with all its rules;
`deleteAllInBatch()` is a bulk statement wearing a `CrudRepository`-shaped name.
The names differ by one word and the semantics differ completely —
[01c · what `JpaRepository` adds](01c-what-jparepository-adds.md).

## How to choose

Ask three questions in this order.

**1. Does anything depend on the rows being removed through the model?** Orphan
removal, `cascade = REMOVE`, a `@PreRemove` that writes an audit row, a
denormalised counter maintained by a listener, a search index updated on removal.
If yes, the derived or entity-based path is not an optimisation opportunity — it
is the requirement.

**2. How many rows?** Tens or hundreds: the derived form's cost is irrelevant and
its safety is free. Tens of thousands: the derived form is a memory problem and a
statement storm, and the bulk form's consequences have to be handled explicitly.

**3. What happens to the children?** A bulk delete does not cascade, so the
foreign keys decide. Either the schema has `on delete cascade` — in which case the
database does the work and does it well — or the statement fails on a constraint
violation, which is at least loud. The unpleasant middle case is a nullable
foreign key with no cascade, where the children survive as orphans nobody notices.

⚠️ **The honest large-scale answer is often neither.** Deleting millions of rows
is a data-lifecycle operation: partition dropping, an archival job, or a
migration. A repository method that can delete a third of a table is a
production incident waiting for a bad parameter.

## Gotchas

**⚠️ Reading `deleteByX` as "issues a delete statement".**
It issues a select and then N deletes. On a large match set that is the whole
difference between a fast operation and an outage.

**⚠️ "Optimising" a derived delete into a `@Modifying` one.**
The diff shows a faster query; what actually changed is that cascades, orphan
removal, lifecycle callbacks and version checks stopped happening. Nothing in the
build or the tests necessarily notices, because the rows still disappear.

**⚠️ Assuming `deleteAllInBatch()` is just a faster `deleteAll()`.**
Its javadoc says it leaves the first-level cache and the database out of sync,
does not honour cascade semantics, and does not emit lifecycle events. Same
outcome for the rows, different outcome for everything else.

**⚠️ Forgetting to flush before a batch delete.**
The javadoc suggests flushing the `EntityManager` first. Pending inserts for rows
you are about to delete — or pending updates to them — are otherwise written
afterwards, in an order nobody intended.

**⚠️ Relying on `orphanRemoval` to tidy up after a bulk delete.**
Orphan removal is a persistence-context feature triggered by removing an entity
from a collection. A bulk statement never touches the collection, so nothing is
orphaned as far as JPA is concerned —
[07 · orphan removal](../07-relationships-fetch/09-orphan-removal.md).

**⚠️ Deleting parents in bulk without knowing the foreign keys.**
Either the constraint rejects the statement, or `on delete cascade` removes far
more than the statement mentions. Both are better than the third case: a nullable
child key set to `null`, leaving rows that belong to nothing.

**⚠️ Running a derived delete inside a loop.**
Each call is a select plus N deletes, and the entities accumulate in the same
persistence context across iterations. This is the shape that turns a nightly
cleanup into an unbounded heap.

**⚠️ Expecting the return value to be the same in both forms.**
A derived delete may return `void`, an `int` or a `List` of the removed entities;
a `@Modifying` query returns `int` from `executeUpdate()` or nothing. If you need
to know what was removed, only the derived form can tell you what the rows
*were*.

**⚠️ Assuming a bulk delete respects `@SQLDelete` or a soft-delete filter.**
Provider-level delete customisations belong to the entity-removal path. A bulk
`delete from …` is a statement against the table — the soft-delete convention your
codebase relies on may simply not apply, and rows will really go away.

**⚠️ Testing the derived version and shipping the bulk one.**
They fail differently: the derived one runs out of memory, the bulk one leaves the
context stale and skips callbacks. A test written against one tells you nothing
about the other, and neither is a drop-in replacement for the other.

**⚠️ Deleting through a `@Query` and forgetting `@Modifying`.**
Same failure as any other modifying query: it is executed as a select, and the
specification requires `IllegalStateException` for that on a `DELETE` statement.

**⚠️ Treating a mass delete as a repository concern at all.**
Beyond some scale it is a data-lifecycle operation — partition drop, archival job,
migration — and expressing it as a repository method mostly buys you a way to run
it accidentally with the wrong argument.

## Interview questions

**★ What is the difference between `deleteByStatus(…)` and a `@Modifying delete
from … where status = …`?**
The derived method runs a select and then removes the returned entities one by
one, so lifecycle callbacks, cascades and orphan removal all happen; the reference
describes it as a shortcut for running the query and calling
`CrudRepository.delete(Iterable)` on the result. The `@Modifying` version issues a
single statement and none of that occurs.

**★ Which is faster, and why is that the wrong question?**
The bulk statement, by a wide margin. It is the wrong question because the speed
comes from skipping the work — the callbacks, the cascade walk, the version
checks — and whether that work matters is a property of your model, not of your
performance target.

**★ What is the documented risk of the derived form?**
Memory. The reference warns that all resulting objects are loaded into memory
before being deleted and held in the session until flush or transaction
completion. On a large match set that is both a heap problem and a very long
transaction.

**★ Is `deleteAllInBatch()` the same as `deleteAll()`?**
No. Its javadoc says it leaves the first-level cache and the database out of
sync, does not honour cascade semantics, and does not emit lifecycle events. It
is a bulk statement with a `CrudRepository`-looking name, and the difference is
one word.

**★ Why does the javadoc suggest flushing before a batch delete?**
Because pending changes in the persistence context have not reached the database
yet. Without a flush, inserts or updates for the very rows you are deleting can be
written after the delete statement, in an order the code never intended.

**★ What happens to child rows in a bulk delete?**
Whatever the foreign keys say. JPA cascades do not apply, so either the database
cascades, or the constraint rejects the statement, or — the bad case — a nullable
key leaves orphaned children behind.

**★ Does a bulk delete honour a soft-delete convention?**
Not necessarily. Entity-level delete customisation applies to the removal path,
and a bulk `delete from …` is a statement against the table. If a codebase relies
on soft deletion, a bulk delete is a way to make rows genuinely disappear.

**★ How do you decide between them in review?**
Look for dependent behaviour first — orphan removal, `cascade = REMOVE`,
`@PreRemove`, listeners maintaining derived data. If any exists, the entity path
is required regardless of row count. If none does, the row count decides, and past
a few thousand the bulk statement is the only sane option.

**★ Someone changed a derived delete to a `@Modifying` one for speed. What do you
check?**
Whether anything relied on the callbacks; whether children are handled by the
schema rather than by cascades; whether the entity is versioned; whether the
persistence context holds affected entities at that point; and whether the method
still returns something the caller can assert on.

**★ What is the right tool for deleting millions of rows?**
Usually none of these. That is a data-lifecycle operation — dropping a partition,
an archival job, or a migration — done in batches with its own transaction
handling. A repository method that can remove a third of a table is a risk with a
convenient name.

{/* FOOTER */}
