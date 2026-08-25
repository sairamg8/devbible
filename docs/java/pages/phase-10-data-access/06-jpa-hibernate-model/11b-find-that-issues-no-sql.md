---
title: "The first-level cache is a correctness feature that happens to save queries — treating it as a performance cache is how people end up surprised by stale data"
sidebar_label: "11b · The find that issues no SQL"
sidebar_position: 18
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 against the Hibernate ORM 7.4 *Introduction* §5.1 *Persistence
> contexts* and §5.4 *Operations on the persistence context*
> ([docs.hibernate.org/orm/7.4/introduction/...](https://docs.hibernate.org/orm/7.4/introduction/html_single/Hibernate_Introduction.html)),
> the Hibernate ORM 7.4 *User Guide* §6.5–§6.7 and §6.11 *Refresh entity state*
> ([docs.hibernate.org/orm/7.4/userguide/...](https://docs.hibernate.org/orm/7.4/userguide/html_single/Hibernate_User_Guide.html))
> and the Jakarta Persistence 3.2 specification §3.3.5 *Refreshing an Entity Instance*
> ([jakarta.ee/specifications/persistence/3.2/](https://jakarta.ee/specifications/persistence/3.2/jakarta-persistence-spec-3.2.html)).
> JDK 25, Spring Boot 4.1.0, Hibernate ORM 7.4.1, PostgreSQL 18.

**"Hibernate caches entities so repeated reads are free" is half true and the wrong half
to remember. The first-level cache exists to guarantee one instance per row; skipping a
query is a side effect. Getting this backwards leads to two opposite mistakes — expecting
it to speed up work it cannot touch, and being surprised when a second read does not see
a change someone else committed.**

## What is and is not in the cache

The identity map holds entities that have been **loaded by identifier** or **made
persistent** in this context. That is a narrow set, and the narrowness is the point.

| Operation | Consults the identity map first? |
|---|---|
| `find(Customer.class, 42L)` | **yes** — may issue no SQL at all |
| `getReference(Customer.class, 42L)` | **yes**, and issues no SQL either way |
| a JPQL/HQL query | **no** — the query always runs |
| a native SQL query | **no** |
| navigating an already-initialised association | **yes** (it is already in memory) |

The third row is the one people trip over. A query is sent to the database every time,
even for a row already sitting in the map. What the map *does* affect is what you get
back: if the result set contains row 42 and 42 is already managed, Hibernate returns the
existing managed instance — including any uncommitted modifications you have made to it
— rather than building a new object from the columns.

So a query is never "answered from cache", but its results are always *reconciled*
against the map. That is identity being preserved, not caching.

## `find` versus `getReference`

Both go through the map; they differ in what they do on a miss.

```java
Customer c1 = entityManager.find(Customer.class, 42L);          // SELECT if not present
Customer c2 = entityManager.getReference(Customer.class, 42L);  // no SELECT, ever
```

The Introduction's table of read operations makes the distinction: "except for
`getReference()`, the following operations all result in immediate access to the
database." `getReference` returns a proxy — an object that knows its identifier and
nothing else, and issues the SELECT the first time you ask it for anything else.

The classic use is assigning an association without loading the other side. The User
Guide's example:

```java
Book book = new Book();
book.setAuthor(entityManager.getReference(Person.class, personId));
```

You need the foreign key value, which is the id you already have. Loading the whole
`Person` to write one column is waste.

⚠️ **`getReference` does not check that the row exists.** The
`jakarta.persistence.EntityManager` javadoc: "If the requested instance does not exist in
the database, the `EntityNotFoundException` is thrown when the instance state is first
accessed. (The persistence provider runtime is permitted but not required to throw the
`EntityNotFoundException` when `getReference()` is called.)" So a bad id becomes an
exception at an unpredictable later point — or a foreign-key violation at flush.

A second trap in the same javadoc: "The application should not expect the instance state
to be available upon detachment, unless it was accessed by the application while the
entity manager was open." An uninitialised proxy that escapes the transaction is a
`LazyInitializationException` waiting to happen — **Topic 10 · Lazy-loading pitfalls**
*(not written yet)*.

## The cache does not see other transactions

This is the mistake that costs real money.

```java
@Transactional
public void process(Long id) {
    Order order = entityManager.find(Order.class, id);   // SELECT
    someSlowExternalCall();                              // another transaction commits a change
    Order again = entityManager.find(Order.class, id);   // no SELECT — same object, same values
}
```

The second `find` returns the object as it was read at the top. Hibernate is not being
stale by accident; it is honouring its guarantee. Handing you a fresh copy would mean two
instances for one row, and your uncommitted modifications to the first would be silently
discarded.

Two ways to see the current row, with different meanings:

**`refresh()`** overwrites the in-memory entity from the database. The spec §3.3.5: "the
state of X is refreshed from the database, **overwriting changes made to the entity, if
any**." That is a destructive operation, deliberately. The User Guide's stated use case:
"when it is known that the database state has changed since the data was read", or "when
database triggers are used to initialize some of the properties of the entity."

**Start a new transaction.** Usually the better answer. If the work depends on a value
that another transaction may change, a long transaction reading it twice is the wrong
shape; see the isolation discussion in
[Topic 04 · Spring `@Transactional`](../04-spring-transactional/README.md).

🔴 **Hibernate 7 changed `refresh` on a detached entity.** The User Guide: "Traditionally,
Hibernate allowed detached entities to be refreshed. However, Jakarta Persistence
prohibits this practice and specifies that an `IllegalArgumentException` should be thrown
instead. **This is the default behaviour from version 7.0 onwards.**" Code written
against Hibernate 5 that refreshed a detached entity now throws.

## What it can and cannot speed up

**It can** collapse repeated `find` calls for the same id inside one unit of work. That
is genuinely useful in code where several methods each look up the same aggregate root
defensively.

**It cannot** help across transactions, because it dies with them. It cannot help a
query, because queries always execute. And it cannot reduce the number of rows a query
returns.

Which is why it is not the answer to a query-count problem. When one query returns N rows
and N more queries follow, the identity map is not what is missing —
**Topic 08 · The N+1 problem** *(not written yet)* is, and every fix for it lives there.

The thing that caches *across* transactions is the second-level cache, configured per
entity and shared by the whole `SessionFactory`. It is a genuine cache with genuine
invalidation problems, and it is a separate decision from anything on this page.

## Gotchas

**A JPQL query is not served from the identity map.**
`select c from Customer c where c.id = :id` runs SQL even when `id` is already managed.
`find` is the operation that checks the map. If you want the map's behaviour, call `find`.

**But the query's *results* are reconciled with the map, which can look like stale data.**
A query returning row 42 gives you the managed instance with its pending in-memory
changes, not the columns just read. That is the guarantee working — but if you were
expecting a query to give you the database's current view, it does not.

**Modifying an entity and then querying can trigger a flush first.**
Because Hibernate will not let a query see a stale view of your own writes, an
overlapping query forces a flush. That is **15 · Flush** *(not written yet)*, and it is why a
read-looking line of code can emit an UPDATE.

**`getReference` on a non-existent id fails somewhere else entirely.**
Possibly at first access, possibly as a foreign-key violation at flush, possibly not at
all if you only ever store the reference. Use `find` when the id came from outside your
system.

**`refresh()` silently discards your unsaved changes.**
It is specified to overwrite. Calling it "to be safe" after modifying an entity throws
the modification away.

**`refresh()` on a detached entity now throws.**
Hibernate 7 aligned with the spec: `IllegalArgumentException`. Hibernate 5 tolerated it.

**Cascading `refresh` to a transient child throws `EntityNotFoundException`.**
The User Guide's §6.11.1 example shows exactly this: a new `Book` added to a managed
`Person` before `refresh(person)` cascades, and Hibernate "will not be able to locate the
`Book` entity in the database". Its own comment is worth remembering — "Beware when
cascading the refresh associations to transient entities!"

**Two `find` calls in two separate `@Transactional` methods are two contexts.**
No sharing, two SELECTs, two objects. Whether you get the cache depends entirely on where
your transaction boundary is.

## Interview questions

**★ Why can `find` return without issuing any SQL?**
Because the persistence context is an identity map keyed by identifier, and `find` checks
it first. If the row is already managed, the instance is returned directly. That is not
primarily a performance feature — it is how Hibernate guarantees one instance per row
within a unit of work. Handing back a second, freshly-loaded object would mean two
divergent copies of the same row in one transaction.

**★ Does a JPQL query use the first-level cache?**
No, in the sense that matters: the query is always sent to the database. But the results
are reconciled against the identity map, so a returned row whose entity is already managed
yields the existing instance, complete with any in-memory modifications, rather than a new
object built from the result set. So the cache does not save the query; it decides what
object you end up holding.

**★ What is the difference between `find` and `getReference`?**
`find` returns a fully-loaded entity, issuing a SELECT if the row is not already managed,
and returns `null` when the row does not exist. `getReference` returns a proxy that knows
only its identifier and issues no SQL at all; it loads on first access to any other
state, and throws `EntityNotFoundException` at that point if the row does not exist. Use
`getReference` when you only need the identity — typically to set an association without
loading the other side — and `find` when you need the data or when the id might be wrong.

**★ You read an entity, do slow work, and read it again in the same transaction. You do not see a change another transaction committed in between. Is that a bug?**
No — it is the guarantee. The second read returns the instance already in the identity
map, because returning a fresh one would create two objects for one row. If you genuinely
need the current database state, `refresh()` overwrites the instance from the database,
discarding your unsaved changes to it. But the better question is usually whether the unit
of work should be that long: a transaction that spans a slow external call is holding a
connection and possibly locks the whole time.

**★ What changed about `refresh` in Hibernate 7?**
Refreshing a detached entity now throws `IllegalArgumentException`, which is what the
Jakarta Persistence specification requires. Hibernate historically permitted it, so code
carried over from Hibernate 5 that refreshed a detached instance breaks on upgrade. The
User Guide states the change explicitly as the default from 7.0 onwards.

**★ Someone proposes fixing an N+1 query problem by relying on the first-level cache. What is wrong with that?**
Two things. The extra queries in an N+1 are usually association fetches for *different*
ids, so there is nothing already in the map to hit. And even where ids repeat, the fixes
that actually work operate at the query level — a fetch join, an entity graph, batch
fetching, or a projection — rather than at the identity level. The identity map does not
reduce the number of queries a query plan produces. All the real fixes are in
**Topic 08 · The N+1 problem** *(not written yet)*.

**★ How is the first-level cache different from the second-level cache?**
Scope and purpose. The first-level cache is the persistence context: one per unit of work,
never shared, and it exists to guarantee identity. The second-level cache belongs to the
`SessionFactory`, is shared by every session in the application, survives transactions,
and exists purely to avoid database reads. The first is always on and has no invalidation
problem because it dies with the transaction; the second is opt-in per entity and brings
every hard question about staleness and invalidation with it.

---

← Prev: [11 · The persistence context](11-the-persistence-context.md) · Index: [The JPA/Hibernate model](README.md) · Next → [12 · The four entity states](12-the-four-states.md)
