---
title: "A jOOQ statement is invisible to the persistence context in both directions — jOOQ reads do not see unflushed entity changes, and a managed entity will happily write its stale copy back over a jOOQ UPDATE at flush time"
sidebar_label: "08d · The stale context"
sidebar_position: 29
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-08 against the Hibernate 7 *Query Language* guide, on `update` and `delete` statements
> ([docs.hibernate.org/orm/7.0/querylanguage/](https://docs.hibernate.org/orm/7.0/querylanguage/html_single/Hibernate_Query_Language.html)),
> the Jakarta Persistence 3.2 specification — *Bulk Update and Delete Operations*
> ([jakarta.ee/specifications/persistence/3.2/](https://jakarta.ee/specifications/persistence/3.2/jakarta-persistence-spec-3.2.html)),
> the Jakarta Persistence 3.2 `EntityManager` javadoc
> ([apidocs/…/EntityManager](https://jakarta.ee/specifications/persistence/3.2/apidocs/jakarta.persistence/jakarta/persistence/entitymanager)),
> the Hibernate 7 `SynchronizeableQuery` javadoc
> ([docs.hibernate.org/orm/7.0/javadocs/…/SynchronizeableQuery.html](https://docs.hibernate.org/orm/7.0/javadocs/org/hibernate/query/SynchronizeableQuery.html))
> and the jOOQ 3.21 manual — *Using jOOQ with JPA*
> ([sql-execution/alternative-execution-models/using-jooq-with-jpa](https://www.jooq.org/doc/latest/manual/sql-execution/alternative-execution-models/using-jooq-with-jpa/)).
> jOOQ **3.21.7**, JDK 25, Spring Boot 4.1.1, Hibernate ORM 7.4.1, PostgreSQL 18.

**This is the failure mode that makes people say "we tried using both and it corrupted data". It is
one mechanism seen from two ends: Hibernate maintains an in-memory model of rows it believes it
knows, and a jOOQ statement changes those rows without telling it. In one direction that produces a
stale read, which is annoying. In the other it produces a stale *write* — dirty checking issuing an
`UPDATE` built from a snapshot taken before your jOOQ statement ran, silently undoing it. Nothing
throws. The test passes. This chunk is the mechanism and the damage;
[08e](08e-repairing-the-stale-context.md) is the repair kit.**

## The rule, from the documentation's own weaker case

Hibernate says this about **its own** HQL `update` and `delete` statements — statements it issues,
parses and fully understands:

> *"The effect of an `update` or `delete` statement is not reflected in the persistence context, nor
> in the state of entity objects held in memory at the time the statement is executed."*

> *"It's the responsibility of the client program to maintain synchronization of state held in
> memory with the database after execution of an `update` or `delete` statement."*

The Jakarta Persistence specification states the same rule for bulk operations:

> *"The persistence context is not synchronized with the result of a bulk update or delete
> operation."*

🔴 **Now apply the obvious inference.** If a statement Hibernate itself issued does not update the
persistence context, a statement issued by a library Hibernate has never heard of certainly does
not. jOOQ's `UPDATE` goes down the shared connection ([08b](08b-using-both.md)) without passing
through any Hibernate code at all. There is no event, no listener, no flag. **The persistence
context's model of that row simply becomes wrong.**

## Direction one: an unflushed entity change, then a jOOQ read

```java
@Transactional
public void applyDiscount(long orderId, int percent) {
    Order order = orders.findById(orderId).orElseThrow();
    order.setTotalCents(order.getTotalCents() * (100 - percent) / 100);   // in memory only

    BigDecimal booked = dsl.select(sum(ORDER.TOTAL_CENTS))
                           .from(ORDER)
                           .where(ORDER.CUSTOMER_ID.eq(order.getCustomerId()))
                           .fetchOne(0, BigDecimal.class);                // ← the OLD total
    ...
}
```

Nothing has been sent to the database yet. The change lives in the persistence context and will be
written at flush, which is usually at commit.

**And auto-flush cannot save you**, for a reason worth stating precisely. Hibernate's auto-flush is
selective: it flushes the *query spaces* a query touches, and the `SynchronizeableQuery` javadoc
describes the mechanism as

> *"force an auto-flush if any entity associated with the current session and mapped to the given
> query space has pending changes which have not yet been synchronized with the database"*

To do that, Hibernate must know which tables the query reads. For a jOOQ query it never sees the
query at all. This is the identical trap `JdbcClient` has, worked through in full in
[Topic 05 · 11b · The flush trap](../05-sql-first-access/11b-the-flush-ordering-trap.md) — and jOOQ
has no equivalent of Hibernate's `addSynchronizedQuerySpace` escape hatch, because there is no
Hibernate query object to call it on.

**The fix is one line and it must be deliberate:** `em.flush()` before the jOOQ read, or move the
jOOQ read before the entity mutation.

## Direction two: a jOOQ write, then a managed entity

This is the dangerous one, and it escalates in three stages.

### Stage 1 — the entity still holds the old value

```java
@Transactional
public void expedite(long orderId) {
    Order order = orders.findById(orderId).orElseThrow();   // status = PENDING, managed

    dsl.update(ORDER)
       .set(ORDER.STATUS, "EXPEDITED")
       .where(ORDER.ID.eq(orderId))
       .execute();                                          // the row is now EXPEDITED

    order.getStatus();   // still "PENDING"
}
```

**And re-reading does not help.** A JPQL query that returns row 42 when 42 is already managed
returns the *managed instance*, with its in-memory state, not a fresh object built from the result
set — the identity-map guarantee documented in
[Topic 06 · 11 · The persistence context](../06-jpa-hibernate-model/11-the-persistence-context.md).
Only `refresh()` re-reads.

### Stage 2 — dirty checking writes the stale copy back

```java
    order.setPriority(HIGH);   // any change at all makes the entity dirty
}   // flush at commit
```

At flush, Hibernate compares the entity against the snapshot it took at load time and issues an
`UPDATE`. And by default that `UPDATE` is not narrow — the Hibernate User Guide, quoted in
[Topic 06 · 14d · The shape of the UPDATE](../06-jpa-hibernate-model/14d-the-shape-of-the-update.md):

> *"By default, when you modify an entity, all columns but the identifier are being set during
> update."*

🔴 **So the statement sets `status = 'PENDING'` — the value from the snapshot — along with the
priority you actually changed. The jOOQ write is reverted, in the same transaction that made it,
by a statement nobody wrote.** No exception, no warning, no log line that looks wrong.

| Step | Database row | Persistence context | Snapshot |
|---|---|---|---|
| `findById` | PENDING | PENDING | PENDING |
| jOOQ `UPDATE` | **EXPEDITED** | PENDING | PENDING |
| `setPriority` | EXPEDITED | PENDING, dirty | PENDING |
| flush | **PENDING** ← reverted | PENDING | PENDING |

⚠️ **`@DynamicUpdate` changes the outcome but does not fix the problem.** With it, Hibernate writes
only the columns that changed relative to the snapshot, so `status` is left alone and the jOOQ write
survives. The entity is still stale, every read of it is still wrong, and you have made the bug
depend on an annotation on an unrelated class.

### Stage 3 — the version column decides how loud it is

If `ORDER` has a JPA `@Version` column and your jOOQ `UPDATE` ignores it:

- Hibernate's flush issues `update order set … where id = ? and version = ?` with the version it
  loaded. The row still carries that version, because jOOQ did not bump it. **The update matches,
  succeeds, and the overwrite is complete and silent.**

If the jOOQ `UPDATE` *does* bump it:

```java
dsl.update(ORDER)
   .set(ORDER.STATUS, "EXPEDITED")
   .set(ORDER.VERSION, ORDER.VERSION.plus(1))
   .where(ORDER.ID.eq(orderId))
   .execute();
```

- Hibernate's version-checked update now matches **zero rows**, and Hibernate raises an optimistic
  lock failure — [Topic 06 · 16b · When the version check fails](../06-jpa-hibernate-model/16b-when-the-version-check-fails.md).

🔴 **The second outcome is the one you want.** An exception at the boundary is enormously better
than a silent revert, and the rule follows directly: **any jOOQ statement that writes a table with
a JPA `@Version` column must increment that column.** Writing correct data and skipping the version
is the worst of both worlds — it disables optimistic locking for every concurrent JPA writer as
well.

## And nothing invalidates the caches

Hibernate's second-level and query caches are invalidated by entity state transitions Hibernate
observes. The `SynchronizeableQuery` javadoc describes the other half of a query space's job:

> *"if the result set of this query is cached, mark it for invalidation when any entity mapped to
> the given query space is synchronized with the database in any session"*

**"synchronized with the database" means by Hibernate.** A jOOQ write is not an entity
synchronisation in any session, so a cached entity or cached query result stays cached, and stays
wrong, until it expires on its own timer. On a cached reference table that jOOQ bulk-loads, that is
a stale-until-TTL bug spanning transactions, not just one — [Topic 12 · Caching is a
decision](../12-caching/01-caching-is-a-decision.md).

## What to do about it, in one line each

Full treatment, with the javadoc for every call, is [08e](08e-repairing-the-stale-context.md):
give the table one owner; failing that, move the jOOQ statement out of the transaction; failing
that, `flush()` before a jOOQ read and `refresh()`, `detach()` or `clear()` after a jOOQ write —
every one of them a call you write by hand, because nothing in either library does it for you.

## Gotchas

**★ The revert is silent, and the test that would catch it usually does not exist.** A test that
writes with jOOQ and asserts with jOOQ passes. A test that writes with jOOQ and asserts through a
repository *in the same transaction* also passes — it reads the stale managed entity. Only a test
that commits and re-reads in a new transaction sees the truth.

**★ Only a *dirty* entity reverts the write.** If nothing about the entity changed, no `UPDATE` is
issued and the jOOQ write survives — the entity is merely stale. That is why this defect surfaces
months after the jOOQ statement was added, on the day somebody sets an unrelated field.

**★ `@DynamicUpdate` hides the revert without fixing the staleness.** It narrows the `UPDATE` to
changed columns, so the jOOQ-written column survives. Every read of the entity is still wrong, and
the behaviour now depends on an annotation somebody may remove for unrelated performance reasons.

**★ A jOOQ `UPDATE` that ignores a `@Version` column defeats optimistic locking for everyone.**
Concurrent JPA writers check a version your statement did not move, so their checks pass when they
should have failed. Always `set(TABLE.VERSION, TABLE.VERSION.plus(1))`.

**★ A jOOQ `DELETE` leaves a managed entity pointing at a row that no longer exists.** The flush
then issues an `UPDATE` matching zero rows, which Hibernate reports as an optimistic-lock failure —
on a table you may not have thought was versioned at all.

**★ Re-querying does not refresh.** A JPQL or repository query that returns an already-managed row
gives you the managed instance with its stale state; the row from the result set is discarded.
`refresh()` is the only read that re-reads.

**★ The second-level cache stays wrong after the transaction ends.** Unlike the persistence context,
it outlives the request. A jOOQ write to a cached table produces stale reads for other users until
the entry expires on its own timer.

**★ Hibernate's SQL log and statistics do not show the jOOQ statements.** Turning on
`hibernate.show_sql` to debug this shows you exactly half the story, and the innocent half —
[Topic 06 · 18 · Seeing what Hibernate does](../06-jpa-hibernate-model/18-seeing-what-hibernate-does.md).
Log at the JDBC or database level instead.

**★ There is no `addSynchronizedQuerySpace` for jOOQ.** For its *own* native queries Hibernate lets
you declare which tables a raw statement reads, so auto-flush can cover it. A jOOQ query never
reaches Hibernate, so there is no query object to declare it on. `em.flush()` by hand is the entire
toolkit for direction one.

**★ `REQUIRES_NEW` changes the picture and not for the better.** A jOOQ write in a suspended-and-restarted
transaction commits immediately and is visible to everyone — but the outer context's entities are
still stale, and the write is now durable even if the outer transaction rolls back.

**★ The staleness is per persistence context, so a second request is not affected.** That is why
this bug is invisible in manual testing: refresh the page, the value is right, because a new
transaction built a new context. It is wrong only inside the transaction that caused it — and
permanently, if a flush reverted it.

**★ An entity graph loaded earlier in the transaction is stale too, not just the entity you can
see.** A jOOQ `UPDATE` on `order_line` leaves every already-loaded `Order`'s line collection
holding old values, and cascading dirty checks can write several of them back.

## Interview questions

**★ Why does the persistence context not see a jOOQ write?** Because Hibernate's model of a row is
built from statements Hibernate issued, and jOOQ's statement travels down the shared JDBC connection
without passing through Hibernate at all. The documentation states the weaker case explicitly — even
Hibernate's own HQL `update` is *"not reflected in the persistence context, nor in the state of
entity objects held in memory"*.

**★ Walk me through how a jOOQ `UPDATE` gets silently reverted.** Load the entity — the context takes
a snapshot. Run the jOOQ `UPDATE` — the row changes, the snapshot does not. Change any other field
on the entity — it is now dirty. At flush, Hibernate writes an `UPDATE` setting *all* columns but
the identifier from the entity's state, which for the jOOQ-written column is still the snapshot
value. The row is back where it started.

**★ What is the necessary condition for that revert?** The entity has to be dirty. A stale entity
nobody modifies produces wrong reads but issues no statement, which is why the defect appears long
after the code that caused it was written.

**★ Does `@DynamicUpdate` fix it?** No. It narrows the `UPDATE` to changed columns so the revert does
not happen, but the entity is still stale for every read, and correctness now depends on a
performance annotation somebody may remove.

**★ What must a jOOQ statement do on a table with a `@Version` column?** Increment the version. If it
does not, concurrent JPA writers pass a version check they should have failed — silent lost updates.
If it does, the JPA flush matches zero rows and raises an optimistic-lock failure, which is a loud
and correct answer.

**★ Why does a re-query not fix a stale entity?** Because the persistence context is an identity map:
a query returning an already-managed row hands back the managed instance with its in-memory state.
`refresh()` is the only operation that re-reads.

**★ Why does auto-flush not protect the read direction?** Auto-flush is driven by query spaces —
Hibernate flushes the tables touched by a query it can see. It never sees the jOOQ query, so it has
no reason to flush, and there is no `addSynchronizedQuerySpace` equivalent to tell it.

**★ What happens to the second-level cache?** Nothing, which is the problem. Invalidation happens
when an entity mapped to a query space *"is synchronized with the database"* by Hibernate. A jOOQ
write is not that, so cached entities and cached query results stay stale beyond the end of the
transaction, until they expire.

**★ How would you write a test that catches this class of bug?** Commit, then read in a new
transaction. Asserting inside the same transaction reads the stale managed entity and passes, which
is exactly why these defects reach production with green tests.

**★ Is this specific to jOOQ?** No — it is the general rule for any statement Hibernate did not
issue, and `JdbcTemplate`, `JdbcClient` and a native `Statement` all have it
([Topic 05 · 11b](../05-sql-first-access/11b-the-flush-ordering-trap.md)). What is specific to jOOQ
is that the statements are so pleasant to write that far more of them end up inside JPA
transactions.

**★ Which direction is worse, and why?** The write direction. A stale read gives you a wrong answer
you might notice; a stale write silently undoes a change that already succeeded, inside the same
transaction, with no exception anywhere.

{/* FOOTER */}
