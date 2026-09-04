---
title: "Eight things an ORM was doing for you, now done by hand — and five problems that stop existing the moment you stop using one"
sidebar_label: "10b · What you give up"
sidebar_position: 21
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 against the Jakarta Persistence 3.2 specification API
> (`EntityManager`, `FlushModeType`, `@Version`)
> ([jakarta.ee/specifications/persistence/3.2/](https://jakarta.ee/specifications/persistence/3.2/apidocs/)),
> the Hibernate ORM 7.0 user guide
> ([docs.hibernate.org/orm/7.0/userguide/](https://docs.hibernate.org/orm/7.0/userguide/html_single/Hibernate_User_Guide.html))
> and the Spring Framework 7.0 reference *Data Access → JDBC Core Classes*
> ([docs.spring.io/.../jdbc/core.html](https://docs.spring.io/spring-framework/reference/data-access/jdbc/core.html)).
> JDK 25, Spring Framework 7.0.9, Hibernate ORM 7.4.1, Jakarta Persistence 3.2.

**A page arguing for SQL-first access owes you the other column of the ledger.
Everything a persistence context does is work, and if you are not using one you are
doing that work — or deciding you do not need it. The list is short and specific,
and the honest summary is that you give up automation and get back predictability.
Which side of that trade is better depends entirely on whether the code is changing
state or reading it.**

## The eight things you now do yourself

**1 · Dirty checking.** A persistence context remembers what a loaded object looked
like and, at flush, issues an `UPDATE` for whatever changed. Without one, `account
.setBalance(x)` changes a field in the heap and nothing else. Every write is a
statement you wrote.

**2 · The identity map.** Inside one persistence context, loading row 42 twice
returns the *same object*. Without one:

```java
var a = repo.findById(42L).orElseThrow();
var b = repo.findById(42L).orElseThrow();
a == b            // false — two queries, two objects
a.equals(b)       // true, if it is a record with equal components
```

Two consequences. Repeated lookups are repeated queries, because there is no
first-level cache. And a change made to `a` is invisible to `b`, so two parts of the
same request can disagree about the same row.

**3 · Cascading.** `orphanRemoval`, `CascadeType.ALL`, delete-a-parent-and-its-
children: all gone. Deleting an order means deleting its lines first, in an order
that respects the foreign keys, and getting that wrong is a
`DataIntegrityViolationException` at best. `ON DELETE CASCADE` in the schema is
often the better answer here, because it moves the rule to where the constraint is.

**4 · Lazy loading.** No `order.getLines()` that quietly runs a query. You fetch what
you fetch. This is a loss when a caller genuinely needs a related collection only
sometimes, and a gain the rest of the time — see the other list below.

**5 · Optimistic locking.** `@Version` is a field and an annotation; without it you
write the version column into the `WHERE` clause, increment it in the `SET`, check
the row count and throw. That is [chunk 8](08-writes-and-generated-keys.md) — about
eight lines, and eight lines you must remember on every write path.

**6 · Statement batching at flush.** Hibernate can collect the statements a
transaction produced and send them as a JDBC batch. `JdbcClient` sends each
`update()` when you call it. For a write path that touches many rows you have to
batch deliberately — [chunk 8b](08b-batches-and-bulk-writes.md).

**7 · A second-level cache.** Nothing caches anything. Every read is a query. For
reference data — country codes, feature flags, tariff tables — you are choosing
between a query per request and an application cache you manage yourself.

**8 · Database portability.** Every argument in [chunk 10](10-when-sql-first-beats-an-entity.md)
in favour of `ON CONFLICT`, `SKIP LOCKED` and `RETURNING` is an argument for
PostgreSQL syntax in your repository. That is usually fine — most services never
change database — but it should be a decision rather than a discovery.

## The five problems that stop existing

**1 · `LazyInitializationException`.** There is no proxy to initialise and no
session to have closed. The entire category — and the open-session-in-view argument
that surrounds it — evaporates. (**Topic 10 · Lazy-loading pitfalls**, *not written
yet*.)

**2 · Accidental N+1.** An N+1 happens when a getter runs a query. No getter runs a
query, so every statement your code sends is a statement you can see in the code.
You can still write a loop that queries per iteration — but you will see the query
inside the loop.

**3 · The `UPDATE` you never wrote.** A dirty-checked field mutated by some helper
deep in a call chain produces a write at commit time that appears in no repository.
Without a persistence context, the set of statements a transaction issues is exactly
the set of calls you made.

**4 · Flush-order surprises.** No flush, so no question of when it happens, what
triggers it, or whether a query sees pending changes. (Except at the boundary where
both are present, which is [chunk 11](11-mixing-both.md).)

**5 · The gap between the SQL you meant and the SQL that was generated.** The string
in your code is the string the server receives, modulo the named-parameter rewrite
of [chunk 5](05-named-parameters.md). Reading the query no longer requires turning
on SQL logging to find out what the framework decided.

## The cost that is easy to miss: no compile-time link to the schema

An entity mapping is checked, weakly, at startup — Hibernate will complain about a
mapped column that does not exist. A `RowMapper` is checked never.
`rs.getString("frist_name")` compiles, deploys, and throws at runtime on the first
row. A reflective mapper is worse: an unmatched column simply leaves the property
unset, silently ([chunk 3d](03d-automatic-mappers.md)).

There are three practical defences and you want all three:

1. **Records, not beans.** A record's constructor must be fully supplied, so a
   column that fails to bind is a failure rather than a `null`.
2. **A test per query that asserts on mapped values**, not merely on the row count.
   The compiler is not going to do it, so the test is the schema contract.
3. **Migrations and queries reviewed together.** A column rename is a two-file
   change and nothing enforces that.

## Gotchas

**"No identity map" bites hardest inside one request.** Loading the same row twice
in one service method and modifying one copy is a bug that produces a lost update
with no concurrency involved at all — the second write simply overwrites the first.
Load once and pass the object down.

**Deleting a parent without its children fails, and the error names the child
table.** The `DataIntegrityViolationException` mentions a foreign key constraint on
a table your delete never referenced, which reads as unrelated. Either delete in
dependency order, or put `ON DELETE CASCADE` on the constraint so the database
enforces the rule for everyone rather than for your code path only.

**Reference data queried per request is invisible until it is not.** A country-code
lookup on every request is a query that never appears in a slow-query log and costs
a round trip every time. Cache it in the application if it changes rarely, but cache
it deliberately — an accidental static `Map` that nobody invalidates is worse than
the query.

**Giving up an ORM does not give up the persistence context if one is still in the
application.** A codebase with both has both sets of behaviours, and the interaction
is not the union of the two — it is [chunk 11](11-mixing-both.md).

**"We will just write SQL" scales badly on the write side.** Reads are where the
argument is strongest. A rich write model — an aggregate with invariants, a graph of
children, cascading rules — is where dirty checking and cascade are genuinely saving
you code, and reimplementing them by hand is the one place SQL-first reliably loses.

**Portability is not binary.** Using `RETURNING` and `ON CONFLICT` does not make the
code unportable in the abstract; it makes those specific queries PostgreSQL-only. If
portability matters, isolate them behind a repository interface so the surface to
port is a known list rather than a search.

## Interview questions

**★ What do you lose by using `JdbcClient` instead of JPA?**
Everything the persistence context does. Dirty checking — no automatic `UPDATE` for
a changed field, so every write is a statement you wrote. The identity map, so
loading the same row twice gives two unrelated objects and there is no first-level
cache. Cascading, so deleting a parent means deleting children yourself in the right
order. Lazy loading. Automatic optimistic locking, which becomes a version column
you manage by hand. Statement batching at flush. A second-level cache. And database
portability, since the queries worth hand-writing tend to use vendor syntax. Most of
those are read-side irrelevancies and write-side real work, which is why the split
usually lands on reads versus writes.

**★ What do you gain?**
Predictability, mostly. `LazyInitializationException` cannot happen because there is
no proxy. An accidental N+1 cannot happen because no getter issues a query. There is
no `UPDATE` you did not write, because there is no dirty checking to produce one. No
flush ordering to reason about. And the SQL in the log is the SQL in the code, so
reading a query does not require enabling logging to discover what a query generator
decided. The set of statements a transaction sends is exactly the set of calls you
made, which makes performance work a matter of reading rather than of experiment.

**★ How do you handle optimistic locking without `@Version`?**
Keep the version column and do the work manually: include it in the `WHERE` clause,
increment it in the `SET`, and check the return value of `update()`. Zero rows
affected means somebody else wrote first, at which point you throw
`OptimisticLockingFailureException` so that it lands on Spring's
`ConcurrencyFailureException` branch and a retry policy keyed on
`TransientDataAccessException` can see it. It is about eight lines. The risk is not
difficulty, it is consistency: `@Version` is applied by the framework to every write
of the entity, whereas a hand-written check is applied only where somebody
remembered to write it.

**★ What is the identity map and why does its absence matter?**
Within one persistence context, JPA guarantees that a given database row maps to a
single object — load it twice and you get the same reference. Without one, two
lookups produce two independent objects. Two things follow. Repeated reads become
repeated queries, since the map also served as a first-level cache. And two parts of
the same request can hold divergent copies of the same row, so a change made through
one is invisible to the other and the second write silently overwrites the first —
a lost update with no concurrency involved. The discipline is to load once per unit
of work and pass the object down.

**★ How do you protect against a column rename breaking a `RowMapper`?**
Tests, because nothing else can. The link between `"first_name"` in a mapper and the
column in the schema is a runtime string comparison — there is no compile-time
relationship for a compiler or an IDE to check. So each query needs a test that
asserts on the mapped *values*, not just that a row came back, and it needs to run
against a real schema built from the same migrations as production. Records help,
because a record constructor must be fully supplied so an unbound column fails
loudly, whereas a bean setter that is never called leaves a silent `null`.

**★ Would you build a whole application without an ORM?**
It depends entirely on the write model. A service that is mostly reads with simple,
statement-shaped writes — an API over a reporting database, a read-heavy catalogue —
is comfortable without one, and probably faster to reason about. A rich domain with
aggregates, invariants and graphs of children that are saved together is where an
ORM is genuinely saving you code: dirty checking and cascade are a diffing algorithm
you would otherwise write, and hand-written diffing is where the bugs live. The
common, and I think correct, answer is both in one application, split by use case
rather than by module.

---

← Prev: [10 · When SQL wins](10-when-sql-first-beats-an-entity.md) · Index: [05 · SQL-first access](README.md) · Next → [11 · Mixing both](11-mixing-both.md)
