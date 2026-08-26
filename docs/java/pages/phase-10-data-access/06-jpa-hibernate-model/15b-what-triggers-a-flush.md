---
title: "AUTO flushes before a query only when the query overlaps the pending changes — and a native query overlaps nothing, because Hibernate cannot read your SQL"
sidebar_label: "15b · What triggers a flush"
sidebar_position: 30
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 against the Hibernate ORM 7.4 *User Guide* §7.1 *AUTO flush*,
> §7.1.1–§7.1.3, §7.2 *COMMIT flush* and §7.3 *ALWAYS flush*
> ([docs.hibernate.org/orm/7.4/userguide/html_single/](https://docs.hibernate.org/orm/7.4/userguide/html_single/)),
> the Hibernate ORM 7.4 *Introduction* §5.10 and §6.3 *Auto-flush*
> ([docs.hibernate.org/orm/7.4/introduction/html_single/](https://docs.hibernate.org/orm/7.4/introduction/html_single/))
> and the `SynchronizeableQuery` javadoc
> ([docs.hibernate.org/orm/7.4/javadocs/org/hibernate/query/SynchronizeableQuery.html](https://docs.hibernate.org/orm/7.4/javadocs/org/hibernate/query/SynchronizeableQuery.html)).
> JDK 25, Spring Boot 4.1.0, Hibernate ORM 7.4.1, Jakarta Persistence 3.2.

**Auto-flush exists so that a query cannot return results that contradict what you already
did in this unit of work. To decide whether that risk exists, Hibernate compares the tables
a query reads against the tables its queued actions would write. For JPQL and HQL it knows
both. For a native SQL string it knows neither — so it either flushes everything, or
nothing, depending on which API you used, and neither default is what you would guess.**

## The three triggers, verbatim

The User Guide's §7.1 lists them, and the list is short enough to memorise:

> By default, Hibernate uses the `AUTO` flush mode which triggers a flush in the following
> circumstances:
>
> - prior to committing a `Transaction`
> - prior to executing a JPQL/HQL query that **overlaps with the queued entity actions**
> - before executing any native SQL query that **has no registered synchronization**

The *Introduction* adds the fourth, which is not automatic at all: "when the program
directly calls `flush()`".

## Overlap, made concrete

The User Guide's own example is the clearest statement of the rule, so here it is in
substance. Two unrelated entities, `Person` and `Advertisement`. A `Person` is persisted
and not yet flushed. Then:

```java
entityManager.persist(person);

entityManager.createQuery("select a from Advertisement a").getResultList();  // no flush
entityManager.createQuery("select p from Person p").getResultList();         // flush first
```

The guide's explanation: "The reason why the `Advertisement` entity query didn't trigger a
flush is that there's no overlapping between the `Advertisement` and the `Person` tables."
And for the second: "the flush was triggered by a JPQL query because the pending entity
persisting action overlaps with the query being executed."

So the granularity is **tables**, not entities and not rows. A pending change to any
`Person` forces a flush before any query that reads the `person` table, regardless of which
`Person` you changed or whether the query could possibly select it.

The *Introduction* gives the reasoning rather than the mechanism:

> By default, Hibernate dirty checks entities in the persistence context before executing a
> query, in order to determine if there are changes which have not yet been flushed to the
> database, but which might affect the results of the query. If there are unflushed
> changes, then Hibernate goes ahead and executes an automatic flush before executing the
> query. That way, the query won't return stale results which fail to reflect changes made
> to data within the current unit of work.

⚠️ Note what that costs: **the dirty check itself runs before the overlap decision can be
useful**, which is why the same passage ends "But if there are many entities associated with
the persistence context, then this can be an expensive operation." That is
[14e · What dirty checking costs](14e-what-dirty-checking-costs.md).

## Native queries: Hibernate cannot read your SQL

A JPQL query is parsed, so Hibernate knows which entities — and therefore which tables — it
touches. A native query is an opaque string. Hibernate has no idea whether
`select count(*) from person` reads the `person` table, and it will not parse SQL to find
out.

Its response is the conservative one, and §7.1's third bullet is the rule: **flush before
any native query that has no registered synchronization.** Under the `EntityManager` API,
§7.1.3 states it as an absolute:

> When executing a native SQL query, a flush is always triggered when using the
> `EntityManager` API.

So a native query in the middle of a method flushes *everything* pending — every dirty
entity in the context, whether or not it has anything to do with the tables in your SQL.
This is easy to miss and can move a constraint violation to a surprising line.

### Telling Hibernate what your SQL touches

The escape hatch is to register the affected entities on the query. Hibernate's
`SynchronizeableQuery` — which the native query implements — takes them:

```java
Session session = entityManager.unwrap(Session.class);

Number count = session
        .createNativeQuery("select count(*) from person", Number.class)
        .addSynchronizedEntityClass(Person.class)
        .uniqueResult();
```

There are three forms — `addSynchronizedEntityClass(Class)`,
`addSynchronizedEntityName(String)` and `addSynchronizedQuerySpace(String)` for a raw table
name. Registering spaces does two things at once: it makes auto-flush precise instead of
unconditional, and it tells Hibernate which query-cache regions the query invalidates.

🔴 **The 7.4 documentation contradicts itself here, and I could not resolve it.** §7.1.3
says in prose: *"If you bootstrap Hibernate natively, and not through Jakarta Persistence,
by default, the `Session` API will trigger a flush automatically when executing a native
query."* Its own Example 7.6, immediately below, persists a `Person` and then asserts the
native count is still **0** — that is, no flush happened. The §7.1 bullet ("no registered
synchronization") agrees with the example, not with the prose. **Do not rely on the
`Session`-API case either way. Register the synchronization explicitly, or call `flush()`,
and the question stops mattering.**

## `COMMIT`, `ALWAYS` and per-query overrides

Under `FlushModeType.COMMIT`, a JPQL query does not flush — but §7.2 notes a native query
still does: "Because Jakarta Persistence doesn't impose a strict rule on delaying flushing,
when executing a native SQL query, the persistence context is going to be flushed."

`ALWAYS` flushes before every query, and §7.3 is explicit that "the `ALWAYS` is only
available with the native `Session` API".

Per query, there are two spellings and they are not identical:

```java
query.setFlushMode(FlushModeType.COMMIT);                  // JPA
query.setQueryFlushMode(QueryFlushMode.NO_FLUSH);          // Hibernate 7
```

The *Introduction* presents `NO_FLUSH` first and `FlushModeType.COMMIT` as the alternative
"especially if you're using JPA-standard APIs", then warns about the whole family together:
"Setting the flush mode to `NO_FLUSH`, `COMMIT`, or `MANUAL` might cause the query to return
stale results."

## What is *not* a trigger

- **A `JdbcTemplate` or `JdbcClient` query.** Hibernate never sees it, so it cannot flush
  for it. This is the most common read-your-own-writes failure in a mixed codebase, and it
  is [topic 05 · 11b · The flush trap](../05-sql-first-access/11b-the-flush-ordering-trap.md).
- **`find` by identifier.** It is not a query in this sense; it is served from the
  persistence context if the entity is there at all —
  [11b · The find that issues no SQL](11b-find-that-issues-no-sql.md).
- **A getter that initialises a lazy proxy.** ⚠️ I could not confirm from the 7.4
  documentation whether lazy initialisation participates in auto-flush. Do not assume
  either way; if ordering matters, flush explicitly.
- **Reaching the end of the method.** The flush comes from the *commit*, which Spring
  performs afterwards.

## Gotchas

**★ A native query flushes everything, not just the tables it names.** Under the
`EntityManager` API this is unconditional. A single `createNativeQuery` in the middle of a
long method can move every pending write — and every constraint violation — to that line.

**★ Overlap is decided per table, not per row.** Changing one `Person` forces a flush
before any query that reads `person`, even one that selects by an unrelated identifier.

**★ `addSynchronizedEntityClass` is on the Hibernate `Query`, not the JPA one.** You have to
`unwrap(Session.class)` — or accept the unconditional flush.

**★ Registering synchronization is also a cache-invalidation statement.** It tells Hibernate
which query spaces the statement touches, which affects the query cache as well as the
flush. Registering the wrong ones is worse than registering none.

**★ Under `COMMIT` flush mode, a native query still flushes.** The delay you asked for
applies to JPQL, not to SQL Hibernate cannot analyse.

**★ Auto-flush costs the full dirty check even when it decides not to flush.** The
comparison runs; the overlap test only decides whether statements come out of it.

**★ `ALWAYS` is a Hibernate-only mode and it is rarely what you want.** It flushes before
every query, which in a read-heavy method is the worst of both worlds.

**★ Moving a repository call earlier or later in a method can change where an exception is
thrown.** Because it changes where the flush happens. If a `DataIntegrityViolationException`
starts appearing on a different line after an innocuous reorder, this is why.

**★ A query with `setQueryFlushMode(NO_FLUSH)` can read a row you just deleted.** The
`DELETE` has not been sent. That is the documented "might return stale results", and it is
the correct behaviour for what you asked for.

## Interview questions

**★ When does Hibernate flush automatically?**
Before committing the transaction; before a JPQL/HQL query that overlaps with the queued
entity actions; and before any native SQL query that has no registered synchronization.
Plus whenever the application calls `flush()`.

**★ What does "overlaps" mean?**
That the tables the query reads intersect the tables the pending actions would write.
Hibernate can determine this for JPQL because it parses the query and knows the entities'
table mappings. It is a table-level test, not a row-level one.

**★ Why does a native query behave differently?**
Because Hibernate cannot analyse an arbitrary SQL string and does not try. Without a
registered synchronization it has no idea what the statement touches, so under the
`EntityManager` API it flushes everything.

**★ How do you make a native query flush precisely?**
Unwrap to `org.hibernate.Session`, and register what the SQL touches with
`addSynchronizedEntityClass`, `addSynchronizedEntityName` or `addSynchronizedQuerySpace`.
That narrows the auto-flush and tells the query cache what to invalidate.

**★ You persist an entity, then run a `JdbcClient` count in the same transaction, and the
count is stale. Why?**
Because auto-flush is triggered by queries the *persistence provider* executes. A
`JdbcClient` query goes straight to the connection; Hibernate never learns it happened and
has no reason to flush.

**★ Does auto-flush cost anything when nothing is dirty?**
Yes. The dirty check over the whole persistence context runs first; only then is there
anything to compare against the query's tables. The saving from a non-overlapping query is
the statements, not the walk.

**★ Under `FlushModeType.COMMIT`, will a native query see your pending insert?**
Yes — the User Guide states that a native SQL query flushes the persistence context even
under `COMMIT`, because the specification does not impose a strict rule on delaying
flushing.

**★ The Hibernate documentation says one thing about native queries on the `Session` API
and its example shows another. What do you do?**
Do not depend on the default. §7.1's rule and the example agree that a native query with no
registered synchronization on the `Session` API does not necessarily flush; the surrounding
prose says it does. Register the synchronization or flush explicitly, and the ambiguity
becomes irrelevant.

---

← Prev: [15 · Flush](15-flush.md) · Index: [06 · The JPA/Hibernate model](README.md) · Next → [15c · Flush operation order](15c-flush-operation-order.md)
