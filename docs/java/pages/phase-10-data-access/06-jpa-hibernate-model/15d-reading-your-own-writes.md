---
title: "A bulk update writes rows the persistence context has never heard of, so every entity you already loaded is now silently stale — and the fix is not another query"
sidebar_label: "15d · Reading your own writes"
sidebar_position: 32
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 against the Jakarta Persistence 3.2 specification §4.11 *Bulk Update
> and Delete Operations*
> ([jakarta.ee/specifications/persistence/3.2/](https://jakarta.ee/specifications/persistence/3.2/jakarta-persistence-spec-3.2.html)),
> the Hibernate ORM 7.4 *User Guide* §7.1 *AUTO flush* and §13.3 *Hibernate Query Language
> for DML*
> ([docs.hibernate.org/orm/7.4/userguide/html_single/](https://docs.hibernate.org/orm/7.4/userguide/html_single/)),
> the Hibernate ORM 7.4 *Introduction* §8.14
> ([docs.hibernate.org/orm/7.4/introduction/html_single/](https://docs.hibernate.org/orm/7.4/introduction/html_single/))
> and the Spring Data JPA `@Modifying` javadoc
> ([docs.spring.io/spring-data/jpa/docs/current/api/](https://docs.spring.io/spring-data/jpa/docs/current/api/org/springframework/data/jpa/repository/Modifying.html)).
> JDK 25, Spring Boot 4.1.0, Spring Data JPA 4.1.0, Hibernate ORM 7.4.1,
> Jakarta Persistence 3.2.

**Auto-flush protects one direction: your unflushed changes cannot make a JPQL query lie to
you. Nothing protects the other direction. A bulk `update` or `delete` statement, a native
`INSERT`, a stored procedure — anything that changes rows without going through the
persistence context — leaves every already-loaded entity holding values that are no longer
in the database, and the persistence context will keep handing you that stale object for the
rest of the transaction.**

## The asymmetry

[15b · What triggers a flush](15b-what-triggers-a-flush.md) established the protection you
do get: before a JPQL query that overlaps pending changes, Hibernate flushes so the query
sees them.

The reverse has no equivalent. Once a statement has changed rows behind the context's back,
there is no mechanism that notices. And the identity map makes it worse rather than better:
`find` will return the cached instance without going to the database at all —
[11b · The find that issues no SQL](11b-find-that-issues-no-sql.md) — so "just load it
again" does not help.

## Bulk JPQL

```java
int rows = entityManager
        .createQuery("update Order o set o.status = :closed where o.status = :open")
        .setParameter("open", Status.OPEN)
        .setParameter("closed", Status.CLOSED)
        .executeUpdate();
```

This is the right tool when you need to change many rows: one statement, no entities
loaded, no snapshots, no per-row round trip. The *Introduction* recommends exactly this —
"The very best way to avoid having too many entities pinned in the session cache is to not
load them from the database in the first place. […] To update many entities at once, use an
update statement."

What it does not do is update anything in memory. The Jakarta Persistence specification's
§4.11 is explicit that bulk operations are executed directly against the database without
the persistence context being synchronised with their result, and recommends caution — up
to running such operations in a separate transaction — precisely because in-memory entities
can be left inconsistent with the rows.

So this sequence is wrong and does not look wrong:

```java
Order order = orderRepository.findById(id).orElseThrow();   // status = OPEN, snapshot taken
closeAllOpenOrders();                                        // bulk update: the row is now CLOSED
order.getStatus();                                           // OPEN — the object was never touched
order.setNote("closed in bulk");                             // dirty checking writes the WHOLE row
```

That last line is the real damage. The `UPDATE` produced by dirty checking writes every
column from the in-memory object, including `status = 'OPEN'` — so the bulk change is
reverted for that row, by a statement nothing in the code asked for. (`@DynamicUpdate`
narrows the statement and would avoid this particular reversal; relying on that is relying
on the shape of generated SQL —
[14d · The shape of the UPDATE](14d-the-shape-of-the-update.md).)

Two more consequences the specification names:

- **Version columns are not incremented** by a bulk update. Optimistic locking is bypassed,
  so a concurrent modification is neither detected nor prevented. See
  [16 · `@Version` and optimistic locking](16-version-and-optimistic-locking.md).
- **The second-level cache is not necessarily updated.** A provider is not required to
  refresh it for a bulk operation, so stale data can outlive the transaction.

Bulk statements also have real syntactic limits, which push people back towards loading
entities: the User Guide notes the `FROM` clause "can only refer to a single entity" and
that "joins, either implicit or explicit, are prohibited in a bulk HQL query" — sub-queries
in the `WHERE` clause are the way around that.

⚠️ And the return value is not a row count in the way you expect: `executeUpdate()` returns
"the number of entities affected by the operation. **This may or may not correlate to the
number of rows affected in the database**" — a joined-subclass delete can touch several
tables per entity.

## The rule, and the two mechanical fixes

> **A bulk statement and a loaded entity for the same row must not coexist in one
> persistence context.**

**Fix one — flush first, clear after.**

```java
entityManager.flush();     // your pending changes reach the database before the bulk statement
bulkUpdate();
entityManager.clear();     // every entity is detached; nothing stale survives
```

The order matters both ways. Flushing first stops the bulk statement from operating on rows
whose pending changes have not landed. Clearing afterwards throws away every instance whose
values might now be wrong — including their snapshots, so the next `find` genuinely reads
the database.

**Fix two — do not have entities loaded.** Run the bulk statement at the start of the unit
of work, before anything is loaded, or in its own transaction. The specification's own
advice is the separate transaction.

`refresh` on the specific affected entity is a third option and is usually the wrong one:
it is one round trip per entity, and it discards any unflushed changes on that instance —
[13c · `remove`, `refresh`, `detach`, `clear`](13c-remove-refresh-detach-clear.md).

## Spring Data: `@Modifying` does neither by default

Spring Data JPA gives you both hooks on the annotation, and **both default to `false`**:

```java
@Modifying(flushAutomatically = true, clearAutomatically = true)
@Query("update Order o set o.status = :closed where o.status = :open")
int closeAllOpen(@Param("open") Status open, @Param("closed") Status closed);
```

- `flushAutomatically` — "Defines whether we should flush the underlying persistence
  context before executing the modifying query." Default `false`.
- `clearAutomatically` — "Defines whether we should clear the underlying persistence context
  after executing the modifying query." Default `false`.

A bare `@Modifying` is therefore the unsafe form. It is also the form in every tutorial.

⚠️ `clearAutomatically = true` detaches *everything*, not just the affected rows. Any entity
the caller was still holding becomes detached mid-method, and further changes to it are
silently lost — which is the failure mode of
[12 · The four entity states](12-the-four-states.md), introduced by a repository method the
caller cannot see into. That is an argument for fix two: run the bulk statement somewhere
that owns the whole unit of work.

Note also that `@Modifying` "is only considered if used on query methods defined through a
`@Query` annotation" — a derived `deleteByStatus(...)` is not a bulk statement at all. It
loads the entities and removes them one at a time, which puts `EntityDeleteAction`s on the
queue and brings [15c · Flush operation order](15c-flush-operation-order.md) into play
instead.

## Native SQL and stored procedures

Everything above applies, and one thing more: Hibernate cannot analyse the statement, so it
does not even know which tables were touched. Registering the affected entities with
`addSynchronizedEntityClass` makes the *flush before* precise; it does not make the
*context after* correct. The `clear()` is still yours to do.

## Plain JDBC in the same transaction

`JdbcTemplate` and `JdbcClient` participate in the same transaction and the same connection,
so their writes are real and their reads see the database — but Hibernate never learns
either happened. That is a page of its own:
[topic 05 · 11b · The flush trap](../05-sql-first-access/11b-the-flush-ordering-trap.md).

## Gotchas

**★ A bulk update does not update entities you already loaded — and dirty checking may
write the old values back.** The reversal is silent and comes from a statement nothing in
your code requested.

**★ `find` after a bulk update returns the stale cached instance, not the database row.**
The identity map is doing exactly what it promises. `clear()` or `refresh` is the only way
through it.

**★ Bulk updates do not increment `@Version`.** Optimistic locking is bypassed for those
rows, so a concurrent editor's check will pass against a version the bulk statement did not
move.

**★ Bulk operations may not update the second-level cache.** The specification does not
require a provider to, so stale data can survive the transaction that caused it.

**★ Bare `@Modifying` flushes nothing and clears nothing.** Both attributes default to
`false`. The safe form is longer than the one in the examples you copied.

**★ `clearAutomatically = true` detaches the caller's entities too.** A repository method
quietly invalidates every managed instance in the transaction, and the caller's subsequent
mutations vanish.

**★ `executeUpdate()`'s return value counts entities, not necessarily rows.** For a
joined-subclass hierarchy one entity can be several rows in several tables.

**★ Bulk HQL cannot join.** Single entity in the `FROM`, no implicit or explicit joins; put
the join in a sub-query in the `WHERE` clause.

**★ A derived `deleteBy…` is not a bulk delete.** It loads and removes entities, so it has
the flush-ordering behaviour instead of the staleness behaviour. The two failure modes are
easy to confuse because the method names look alike.

**★ Running the bulk statement "at the end, to be safe" is the worst placement.** By then
the context is at its fullest, so the maximum number of entities go stale.

## Interview questions

**★ Why does a bulk JPQL `update` leave the persistence context inconsistent?**
Because it is translated straight to a SQL statement and executed against the database. It
does not go through the entities, so the specification does not require — and providers do
not perform — any synchronisation of already-managed instances with the result.

**★ What is the worst consequence of that?**
Not the stale read. It is that dirty checking may then write the stale in-memory values
back over the bulk change, because the default `UPDATE` sets every column from the object.

**★ How do you use a bulk statement safely?**
Flush before it so your pending changes land first, clear after it so nothing stale
survives — or, better, run it where no entities are loaded, which the specification
suggests can mean a separate transaction.

**★ Why does re-loading the entity not fix it?**
Because `find` is served from the persistence context's identity map when the entity is
already there, and no SQL is issued. You have to detach it first — `clear()`, `detach()` —
or force the read with `refresh`.

**★ What do `flushAutomatically` and `clearAutomatically` on `@Modifying` do, and what are
their defaults?**
They flush the persistence context before the query and clear it after. Both default to
`false`, so the annotation as usually written provides neither protection.

**★ What is the risk of `clearAutomatically = true`?**
It detaches every managed entity in the persistence context, not just the ones the
statement touched. Anything the caller was holding becomes detached, and further changes to
it are silently discarded.

**★ Do bulk operations respect optimistic locking?**
No. Version columns are not incremented by a bulk update, so concurrent modifications are
neither detected nor prevented for those rows. If the data is versioned for a reason, a
bulk update is a decision to bypass that reason.

**★ Is a Spring Data derived `deleteByStatus(...)` a bulk delete?**
No. Derived delete queries load the matching entities and remove them individually, so they
produce entity delete actions on the flush queue. `@Modifying` with an explicit
`@Query("delete from …")` is the bulk form.

**★ When is a bulk statement clearly the right tool?**
When the number of rows is large, the change is uniform, no lifecycle callbacks or cascades
need to run, and optimistic locking is not load-bearing for that operation — for example a
scheduled state transition or a data-repair job.

---

← Prev: [15c · Flush operation order](15c-flush-operation-order.md) · Index: [06 · The JPA/Hibernate model](README.md) · Next → [16 · @Version and optimistic locking](16-version-and-optimistic-locking.md)
