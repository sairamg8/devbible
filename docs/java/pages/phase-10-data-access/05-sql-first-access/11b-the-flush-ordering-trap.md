---
title: "A `JdbcClient` query inside a JPA transaction does not see unflushed entity changes — because Hibernate has no way to know the query exists"
sidebar_label: "11b · The flush trap"
sidebar_position: 23
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 against the Jakarta Persistence 3.2 `FlushModeType` javadoc
> ([jakarta.ee/specifications/persistence/3.2/](https://jakarta.ee/specifications/persistence/3.2/apidocs/jakarta.persistence/jakarta/persistence/flushmodetype)),
> the Hibernate ORM 7.0 `SynchronizeableQuery` javadoc
> ([docs.hibernate.org/orm/7.0/javadocs/org/hibernate/query/SynchronizeableQuery.html](https://docs.hibernate.org/orm/7.0/javadocs/org/hibernate/query/SynchronizeableQuery.html)),
> the Hibernate ORM 7.0 user guide *Flushing*
> ([docs.hibernate.org/orm/7.0/userguide/](https://docs.hibernate.org/orm/7.0/userguide/html_single/Hibernate_User_Guide.html))
> and the `JpaTransactionManager` javadoc
> ([docs.spring.io/.../orm/jpa/JpaTransactionManager.html](https://docs.spring.io/spring-framework/docs/current/javadoc-api/org/springframework/orm/jpa/JpaTransactionManager.html)).
> JDK 25, Spring Framework 7.0.8, Hibernate ORM 7.4.1, Jakarta Persistence 3.2.

**Save an entity, then run a `JdbcClient` count in the same transaction, and the
count is the old one. Nothing is broken. JPA's auto-flush is triggered by *queries
the persistence provider runs*, and a `JdbcClient` query is not one — the provider
never sees it, so it has no reason to flush. This is the one trap in mixing the two
styles, and it is symmetrical: SQL writes are equally invisible to entities already
loaded.**

## Direction one: entity write, then SQL read

```java
@Transactional
public void addLine(long orderId, NewLine line) {
    Order order = orders.findById(orderId).orElseThrow();
    order.addLine(line.toEntity());              // in the persistence context only

    int lines = jdbcClient
            .sql("select count(*) from order_line where order_id = :id")
            .param("id", orderId)
            .query(Integer.class)
            .single();                           // ← the OLD count

    if (lines > MAX_LINES) { … }                 // decision made on stale data
}
```

`order.addLine(...)` changes objects on the heap. Nothing has been sent to the
database. The `JdbcClient` query runs on the same connection, inside the same
transaction — but the row is not there, because no `INSERT` has been issued.

### Why auto-flush does not save you

The JPA specification defines `FlushModeType.AUTO` as flushing "to occur at query
execution", with the provider responsible for ensuring that entity updates which
could affect query results "are visible to the query processing". Read that phrase
carefully: **the query processing the provider performs.** JPQL, Criteria, and the
provider's own native query API are all query processing. A statement handed
directly to a JDBC template is not — the provider is not involved in it at any
point.

Hibernate's own mechanism makes the boundary even clearer. It works in **query
spaces**, described in the `SynchronizeableQuery` javadoc as "the abstract notion of
a query whose results are affected by the data stored in a given set of named query
spaces. A query space is usually, but not always, a relational database table". The
rule is:

> "When auto-flush is enabled, in-memory changes to every dirty entity whose state
> belongs to any query space which affects a given query must be flushed before the
> query is executed."

So Hibernate flushes *selectively*, based on which tables a query touches. To do
that it has to know the query. For its own **native SQL** queries it cannot infer
the tables, which is why it offers `addSynchronizedQuerySpace`,
`addSynchronizedEntityName` and `addSynchronizedEntityClass` — an explicit way to
say "this raw SQL reads these tables, please flush them first".

🔴 **A `JdbcClient` statement has no equivalent, because it never reaches
Hibernate.** It goes to `DataSourceUtils`, gets the connection, and executes. The
persistence context is not consulted, not notified, and not given the chance to
flush. There is no annotation, no property and no configuration that changes this.

## Direction two: SQL write, then entity read

The reverse is at least as dangerous, and it has two distinct failure modes.

```java
@Transactional
public void archiveAll(Instant cutoff) {
    Order order = orders.findById(42L).orElseThrow();     // now managed, status = COMPLETED

    jdbcClient.sql("update orders set status = 'ARCHIVED' where placed_at < :cutoff")
              .param("cutoff", cutoff)
              .update();                                  // row 42 is now ARCHIVED in the DB

    order.getStatus();      // still COMPLETED — the object was not told
    // …and at commit, dirty checking may write COMPLETED back over your update
}
```

**Failure one: stale reads.** The managed `order` still holds the pre-update state,
and because of the identity map, any subsequent `findById(42L)` in this transaction
returns that same stale object rather than re-reading the row.

**Failure two — the expensive one: your bulk update gets overwritten.** If anything
in the transaction marks that entity dirty, Hibernate flushes an `UPDATE` built from
the object's fields, and `status` goes back to `COMPLETED`. Your archive silently
un-archives one row. This is the same hazard JPQL bulk updates carry, and it is why
they come with the same warning.

## The three fixes, best first

**1 · Do not mix within one transaction.** Two transactions, two methods, one style
each — the shape in [chunk 11](11-mixing-both.md). Nothing to remember, nothing to
get wrong, and it is free unless the operation genuinely needs atomicity across
both.

**2 · Flush before reading, clear after writing.**

```java
@PersistenceContext private EntityManager em;

@Transactional
public void addLine(long orderId, NewLine line) {
    Order order = orders.findById(orderId).orElseThrow();
    order.addLine(line.toEntity());

    em.flush();                                   // ← push pending changes to the DB
    int lines = jdbcClient.sql(COUNT_LINES).param("id", orderId)
                          .query(Integer.class).single();
    …
}
```

```java
@Transactional
public void archiveAll(Instant cutoff) {
    jdbcClient.sql(ARCHIVE_SQL).param("cutoff", cutoff).update();
    em.clear();                                   // ← drop now-stale managed entities
}
```

`flush()` sends pending writes so the SQL sees them. `clear()` detaches everything,
so nothing stale is read and nothing dirty is flushed over your statement. Order
matters: **flush before an SQL read, clear after an SQL write.**

⚠️ `clear()` detaches *everything*, including entities the caller is still holding.
An object obtained before the `clear()` is now detached, and touching a lazy
association on it throws. Do the bulk write first, before loading anything, if you
can.

**3 · If you are using Hibernate's own native query API**, `addSynchronizedEntityClass`
tells it which query spaces the raw SQL touches, so auto-flush covers it. That
option exists only inside Hibernate — it is not available for a `JdbcClient` call —
but it is the right answer when the raw SQL is going through
`Session.createNativeQuery`.

## Gotchas

**A test with a single method call will not reproduce this.** If the entity write
and the SQL read are in different transactions — which is what happens when a test
calls one service method per test — the first has committed before the second runs.
The bug needs both in one transaction, which is exactly the case a
`@Transactional` test method creates. That is one of the ways a transaction test
lies, alongside
**[The false positives](../04-spring-transactional/20b-the-false-positives.md)**.

**`em.flush()` inside a loop turns one statement into many.** The fix for direction
one is a flush, and it is tempting to add one defensively before every JDBC call. In
a loop that is a flush per iteration, which destroys Hibernate's statement batching
and can be dramatically slower. Flush once, at the point the SQL needs to see the
data.

**`saveAndFlush` is not a general solution.** Spring Data's `saveAndFlush` flushes
the whole persistence context, not just that entity, so it has the same cost as
`em.flush()` and the same "in a loop it is terrible" caveat. It is also easy to read
as "save this one thing immediately", which is not what it does.

**`clear()` after a bulk update also throws away everything you loaded earlier.**
Detached entities do not track changes, and lazy associations on them throw. If the
method loaded an aggregate at the top and clears halfway down, the second half is
operating on detached objects. Structure the method so the bulk write comes first.

**The trap is invisible with `FlushModeType.COMMIT`, and that is not a fix.** Setting
the flush mode to `COMMIT` means nothing flushes until the end, so the JDBC read
misses the data in a more predictable way. It does not make the read correct; it
just removes the variation. The spec says query results under `COMMIT` are
"unspecified" with respect to prior updates, which is a fair description of what you
have signed up for.

**A read-only transaction changes the timing.** With `readOnly = true` Hibernate can
skip dirty checking and the flush entirely, so in such a transaction there are no
pending writes to be invisible — the trap does not arise. That makes read-only
query methods safe by construction, which is another reason for the split-by-method
shape in [chunk 11](11-mixing-both.md).

**Direction two is worse than direction one because it corrupts data.** A stale read
produces a wrong decision; a dirty-checking overwrite produces a wrong *database*.
If you can only remember one half of this chunk, remember to `clear()` after a bulk
SQL write.

## Interview questions

**★ Why does a `JdbcTemplate` query inside a JPA transaction not see changes you
just made to an entity?**
Because nothing has written them yet. JPA buffers changes in the persistence context
and sends them at flush time. `FlushModeType.AUTO` triggers a flush at query
execution — but that means queries the *persistence provider* executes, since it can
only flush for a query it knows about. A `JdbcClient` or `JdbcTemplate` statement
goes straight to the connection through `DataSourceUtils`; the provider is never
involved, gets no callback, and therefore never flushes. The two run on the same
connection and in the same transaction, so the visibility problem is not about
isolation — the rows genuinely are not there yet.

**★ How does Hibernate decide whether to auto-flush before a query?**
By query spaces. The `SynchronizeableQuery` javadoc defines a query space as
"usually, but not always, a relational database table", and states the rule:
"in-memory changes to every dirty entity whose state belongs to any query space
which affects a given query must be flushed before the query is executed". So it is
selective — a pending change to `customer` does not force a flush before a query
that only touches `product`. For its own native SQL queries it cannot work out the
spaces, which is why it exposes `addSynchronizedQuerySpace` and
`addSynchronizedEntityClass` so you can tell it. There is no equivalent for a query
issued outside Hibernate entirely.

**★ How do you fix it?**
Three options in order of preference. Best: do not mix within one transaction — put
the entity work and the SQL work in separate transactional methods, which makes the
problem structurally impossible. Second: call `EntityManager.flush()` before the JDBC
read, so pending changes are in the database when the statement runs — but once, at
the point of need, not inside a loop, because a flush per iteration destroys
statement batching. Third, if the raw SQL is going through Hibernate's own
`createNativeQuery`, register the tables with `addSynchronizedEntityClass` so
auto-flush covers it.

**★ What about the other direction — a bulk SQL update while entities are loaded?**
That one is worse, because it can corrupt data rather than merely producing a stale
read. The `UPDATE` changes rows in the database; the managed entities holding those
rows are not told, so they still carry the old field values. Two things follow. Any
further read of that row in the transaction returns the stale object, because the
identity map serves it. And if the entity is dirty for any reason, Hibernate flushes
an `UPDATE` built from the object's fields, writing the old value back over your
bulk change — for that row only, which makes it look like a partial failure. The fix
is `EntityManager.clear()` after the bulk statement, and ideally doing the bulk
statement before anything is loaded.

**★ Why does this never show up in tests?**
Because the two halves usually end up in different transactions. A test that calls
one service method and then asserts through a repository has committed in between,
so the SQL read sees everything. Reproducing it needs both operations inside one
transaction — which a `@Transactional` test method does create, and which is also
where a whole family of transaction tests give false positives for related reasons.
The reliable test is one that calls a single service method containing both
operations and asserts on the value the method computed, not on the database
afterwards.

**★ Does `@Transactional(readOnly = true)` avoid the problem?**
It sidesteps direction one, yes. With `readOnly = true` Hibernate can skip dirty
checking and the flush, so there are no pending entity writes for the SQL query to
miss. That is a real reason to mark query methods read-only beyond the performance
saving. It does not help with direction two — a write inside a read-only transaction
is a contradiction you should not be relying on anyway, since the flag is a hint
each layer may ignore.

**★ Is `FlushModeType.COMMIT` a workaround?**
No, it is a way to make the failure consistent. Under `COMMIT` nothing flushes until
the transaction ends, so the JDBC read reliably misses pending changes rather than
sometimes seeing them. The specification itself says that with `COMMIT` set, query
results "are unspecified" with respect to prior entity updates — which is an honest
description of a mode you would choose for performance in a read-heavy transaction,
not a correctness tool. The fix remains an explicit flush, or not mixing.

---

← Prev: [11 · Mixing both](11-mixing-both.md) · Index: [05 · SQL-first access](README.md) · Next → [12 · The repository shape](12-testing-and-the-shape-of-a-repository.md)
