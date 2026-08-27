---
title: "Every repair for a stale persistence context is a call you make by hand — flush, refresh, detach or clear — and each of them fixes one problem by creating a smaller one you have to know about"
sidebar_label: "08e · Repairing the stale context"
sidebar_position: 30
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-08 against the Jakarta Persistence 3.2 `EntityManager` javadoc
> ([apidocs/…/EntityManager](https://jakarta.ee/specifications/persistence/3.2/apidocs/jakarta.persistence/jakarta/persistence/entitymanager)),
> the jOOQ 3.21 manual — *Using jOOQ with JPA* and *JPA entities*
> ([sql-execution/alternative-execution-models/using-jooq-with-jpa](https://www.jooq.org/doc/latest/manual/sql-execution/alternative-execution-models/using-jooq-with-jpa/),
> [using-jooq-with-jpa-entities](https://www.jooq.org/doc/latest/manual/sql-execution/alternative-execution-models/using-jooq-with-jpa/using-jooq-with-jpa-entities/))
> and the `@Modifying` behaviour recorded in
> [Topic 09 · 04b](../09-spring-data-jpa/04b-flush-clear-and-the-stale-context.md).
> jOOQ **3.21.7**, JDK 25, Spring Boot 4.1.0, Hibernate ORM 7.4.1, PostgreSQL 18.

**[08d](08d-the-stale-persistence-context.md) is the damage; this is the toolbox. Six entries,
ordered by how much you should prefer them: the first two are design decisions and the other four
are `EntityManager` calls you write by hand, at exactly the right line, every single time. Spring
Data has a declarative version of two of them for its own statements — and both of its flags
default to `false`. jOOQ has no version at all. Then there is a seventh option that dissolves the
problem rather than patching it: let JPA execute the query jOOQ built.**

## The repair kit, in order of preference

**1 · Do not do it.** Give the table one owner ([08c](08c-one-owner-per-table.md)). Everything below
is damage control.

**2 · Order the work so the two never overlap.** Run the jOOQ statement in a transaction of its own,
before or after the JPA unit of work. No persistence context exists to be wrong.

**3 · `flush()` before a jOOQ read.** `EntityManager.flush()` synchronises the persistence context
to the database: pending inserts and updates become statements, so the jOOQ query that follows can
see them. Cheap, precise, and the only fix for direction one. It changes *when* your inserts and
updates reach the database, which matters for constraint-violation timing and for lock duration
([Topic 06 · 15b · What triggers a flush](../06-jpa-hibernate-model/15b-what-triggers-a-flush.md)).

**4 · `refresh(entity)` after a jOOQ write**, for one known entity:

> *"Refresh the state of the given managed entity instance from the database, overwriting unflushed
> changes made to the entity, if any."*

⚠️ Read the second clause. `refresh` is not a merge — **it discards in-memory changes you have not
flushed**, including ones made by code that ran before yours. It also costs a `SELECT`.

**5 · `detach(entity)`** when you do not need the entity afterwards:

> *"Evict the given managed or removed entity from the persistence context, causing the entity to
> become immediately detached."*

The narrowest possible instrument: the stale object stops being managed, so it cannot be written
back. Its unflushed changes are discarded with it.

**6 · `clear()`** — the blunt one:

> *"Clear the persistence context, causing all managed entities to become detached."*

It fixes every stale entity at once and creates two new problems: **every pending, unflushed change
anywhere in the transaction is discarded**, and every entity any caller is still holding becomes
detached, so the next lazy access throws. Flush first if you mean to keep the pending work; and do
not call it from a helper method that does not own the transaction.

🔴 **Spring Data has a declarative version of steps 3 and 6 for its own modifying queries —
`@Modifying(flushAutomatically = true, clearAutomatically = true)`, both defaulting to `false`
([Topic 09 · 04b](../09-spring-data-jpa/04b-flush-clear-and-the-stale-context.md)). There is no jOOQ
equivalent.** No annotation, no listener, no setting. Every one of these calls is yours to write and
yours to remember.

## The escape hatch: build with jOOQ, execute with JPA

If what you want is jOOQ's query construction *and* managed entities, the manual documents exactly
that — running a jOOQ-built query through JPA's native query API:

```java
public static <E> List<E> nativeQuery(EntityManager em, org.jooq.Query query, Class<E> type) {
    Query result = em.createNativeQuery(query.getSQL(), type);
    List<Object> values = query.getBindValues();
    for (int i = 0; i < values.size(); i++)
        result.setParameter(i + 1, values.get(i));
    return result.getResultList();
}
```

Because JPA executes it, the results are **managed entities in the current persistence context**,
and this entire chunk stops applying: there is only one model.

**Three caveats the manual attaches:**

- **Bind parameters are 1-based** in `setParameter`, while `getBindValues()` is a 0-based list —
  hence `i + 1`.
- **Custom data types and bindings need more than this.** The manual's advanced version iterates
  `query.getParams().values()` and skips inlined parameters — *"if (!param.isInline())
  result.setParameter(i++, convertToDatabaseType(param));"* — converting each through its binding.
  A forced type or an ad-hoc converter ([02c](02c-shaping-the-generated-api.md),
  [04c](04c-record-mappers-and-converters.md)) will not apply itself.
- **jOOQ does not recommend it as a default.** The manual: *"Mostly, however, you're better off
  executing your queries directly with jOOQ, especially if you want to use jOOQ's more advanced
  features."*

⚠️ **And notice what you give up:** the result must map onto an entity, so `MULTISET`, ad-hoc
converters and `Records.mapping` are off the table, and the SQL is a string by the time JPA sees
it — so nothing checks it a second time. This is a bridge for a specific need, not an architecture.


## Gotchas

**★ There is no jOOQ equivalent of `clearAutomatically`, and there will not be one.** Spring Data's
`@Modifying(flushAutomatically = true, clearAutomatically = true)` works because Spring Data knows
it just issued a statement through the `EntityManager`. jOOQ never touches the `EntityManager`, so
nothing can hook the moment. Every repair on this page is a line of code somebody has to remember.

**★ `refresh()` throws away unflushed changes, including ones you did not make.** The javadoc says
*"overwriting unflushed changes made to the entity, if any"*. In a service method that calls three
collaborators, you may not know what was pending on that entity when you called it.

**★ `refresh()` costs a `SELECT` per entity.** In a loop that is an N+1 you introduced deliberately.
If more than a handful of entities are affected, `clear()` and re-read in bulk, or restructure so
the entities were never loaded.

**★ `clear()` detaches objects your caller is still holding.** The next lazy access on any of them
throws — [Topic 10 · The exception](../10-lazy-loading/02-the-exception.md). Never call it from a
helper method that does not own the transaction boundary.

**★ `clear()` silently discards pending inserts and updates.** It is not a synchronisation point; it
is an abandonment. `flush()` first if the pending work was meant to happen — and note that this is
exactly why Spring Data offers `flushAutomatically` *and* `clearAutomatically` as two flags.

**★ `flush()` moves your constraint violations earlier, which changes which `catch` block sees
them.** That is usually an improvement — a violation thrown at commit surfaces outside the method
that caused it — but it is a behaviour change, and a test asserting where the exception appears will
notice.

**★ `flush()` also moves your locks earlier.** The `UPDATE` now runs at the flush point instead of at
commit, so the row lock is held for the rest of the transaction. In a long method that is a real
contention change ([Topic 03 · 12 · Locking](../03-jdbc-transactions/12-locking-and-select-for-update.md)).

**★ `detach()` discards that entity's pending changes along with the entity.** It is the narrowest
tool here, and "narrow" does not mean "safe": anything the entity had accumulated before you
detached it is gone.

**★ A repair applied to the entity you can see misses the graph you cannot.** A jOOQ `UPDATE` on a
child table leaves every loaded parent's collection stale. `refresh(parent)` re-reads according to
the mapping's cascade and fetch rules, which may or may not include the collection you care about.

**★ In a batch loop, the standard `flush()` + `clear()` rhythm fixes this by accident.** Long-running
loops already flush and clear periodically to bound the persistence context; that same call happens
to discard the stale entities. It is why some codebases have this bug everywhere except in their
batch jobs — and why moving code *out* of a batch job can introduce it.

**★ `em.createNativeQuery(sql, Entity.class)` binds parameters from 1, while `getBindValues()` is a
0-based list.** The manual's helper writes `setParameter(i + 1, values.get(i))`. Get it wrong and
you bind the wrong values to the wrong placeholders, which is a data bug rather than an error.

**★ The JPA-native-query bridge does not apply your converters.** A forced type or an ad-hoc
converter is a jOOQ-side concept; `getBindValues()` hands you values that may still need converting
to the database representation. The manual's advanced helper iterates `query.getParams().values()`
and skips inlined parameters for exactly this reason.

**★ Through the bridge, the SQL is a string by the time JPA sees it.** Nothing checks the projection
against the entity, so a column the entity does not map is a runtime failure. You keep jOOQ's
compile-time check on query *construction* and lose it on the *result*.

**★ Executing through JPA gives up jOOQ's result-side features entirely.** `MULTISET`,
`Records.mapping`, `fetchInto` a Java record, `Cursor` streaming — none of them exist on that path,
because JPA is doing the fetching.

**★ Repairing is not a design.** Every tool here is a marker that a table has two owners. If you find
yourself adding a third `refresh()`, the answer is [08c](08c-one-owner-per-table.md), not a fourth.

## Interview questions

**★ What are the five repairs, in order of preference?** Give the table one owner; move the jOOQ
statement to its own transaction; `flush()` before a jOOQ read; `refresh()` or `detach()` the
affected entity after a jOOQ write; `clear()` the whole context as a last resort.

**★ What exactly does `refresh` do, and what is the catch?** It re-reads one managed entity from the
database — *"overwriting unflushed changes made to the entity, if any"*. The catch is in that
clause: it discards pending in-memory changes, possibly ones made by code you did not write, and it
costs a `SELECT` each time.

**★ When would you prefer `detach` over `refresh`?** When you do not need the entity afterwards.
`detach` evicts it — *"causing the entity to become immediately detached"* — so it can no longer be
written back at flush, and you avoid the extra `SELECT` that `refresh` would cost.

**★ What are the two dangers of `clear()`?** It discards every pending, unflushed change in the whole
transaction, and it detaches every entity every caller is still holding, so their next lazy access
throws. Flush first if the pending work mattered, and only call it where you own the transaction.

**★ Why does `flush()` fix the read direction but not the write direction?** Because it pushes
pending entity changes to the database so the jOOQ query can see them. It does nothing about the
opposite problem — a jOOQ statement the context never learned about — because there is nothing on
the entity side to push.

**★ What does `flush()` change besides visibility?** Timing. Constraint violations are raised at the
flush point rather than at commit, and row locks are taken earlier and held longer. Both are usually
improvements and both are behaviour changes.

**★ Spring Data has `flushAutomatically` and `clearAutomatically`. Why can jOOQ not have them?**
Because Spring Data issues its modifying query *through* the `EntityManager` and therefore knows
exactly when to act. jOOQ executes on the JDBC connection and never touches the `EntityManager`, so
there is no moment to hook. And note that even Spring Data's two flags default to `false`.

**★ How do you get managed entities out of a query built with jOOQ?** Execute it through JPA:
`em.createNativeQuery(query.getSQL(), Entity.class)`, then bind `query.getBindValues()` with 1-based
`setParameter` indexes. jOOQ documents the helper and then says *"mostly you're better off executing
your queries directly with jOOQ, especially if you want to use jOOQ's more advanced features."*

**★ What do you give up on that bridge?** The result side of jOOQ: `MULTISET`, `Records.mapping`,
ad-hoc converters, record projections and lazy `Cursor` fetching. You also lose any compile-time
check on the projection, because JPA receives a string and maps it onto the entity at runtime. And
custom bindings and converters must be applied by hand when binding parameters.

**★ When is that bridge actually the right answer?** When you genuinely need *managed* entities — you
are going to mutate what you loaded — and the query is beyond JPQL. That is a narrow case. Wanting
managed entities for reading is usually a sign the query should have returned a DTO.

**★ Your service has three `em.refresh` calls added over two years. What does that tell you?** That a
table has two owners and nobody has said so out loud. The refreshes are symptoms; the fix is to
decide the owner and remove the second mapping — [08c](08c-one-owner-per-table.md).

{/* FOOTER */}
