---
title: "A fresh schema or a fresh container is the only strategy that is correct by construction, and it is priced accordingly — which makes the real question not which strategy is best but which one each test can afford, and that has a short decision rule"
sidebar_label: "05a4 · A fresh schema per class"
sidebar_position: 31
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-31 against the **Spring Framework 7.0.x** testing reference,
> *Executing SQL Scripts* and *Transaction Management*
> ([docs.spring.io](https://docs.spring.io/spring-framework/reference/testing/testcontext-framework/tx.html)),
> the Spring Boot 4.1.0 javadoc for
> [`AutoConfigureTestDatabase`](https://docs.spring.io/spring-boot/api/java/org/springframework/boot/jdbc/test/autoconfigure/AutoConfigureTestDatabase.html),
> and the Testcontainers 2.0.5 database-module documentation
> ([java.testcontainers.org](https://java.testcontainers.org/modules/databases/)).
> Version spine from `spring-boot-dependencies:4.1.0`: JDK 25, Spring Boot 4.1.0,
> Spring Framework 7.0.8, JUnit Jupiter 6.0.3, Testcontainers 2.0.5.
> ⚠️ **No Docker, no database and no sandbox on this machine** — no timings, no container
> logs, no measured startup costs appear on this page. Where cost is discussed it is
> discussed as structure (what has to happen), never as a number.

**The third strategy is the one that cannot be got wrong: give the tests a database that
nothing has touched. It is correct by construction and it is the most expensive option in
the topic, and the interesting question is not whether it is better but where its price is
worth paying. This chunk covers the three granularities it comes in, the one that is
usually the right answer, why a fresh context is not a fresh database, and — with all four
strategies now costed — the decision rule.**

## Three granularities, not one

"Fresh database" hides three quite different things.

**A fresh container per class.** The heaviest: a new database process for every test class.
The container has to start, the engine has to initialise, and the migrations have to run,
every time. The reason it is heavy is structural rather than incidental — you are paying
process startup plus schema construction per class — and it is why the Testcontainers
documentation and everything in [07 · Testcontainers](../07-testcontainers/README.md)
pushes towards one shared container for the whole run.

**A fresh schema per class, inside one shared container.** One container, and each test
class gets its own schema — `CREATE SCHEMA test_<something>`, migrations into it, a data
source whose `search_path` or default schema points at it. You pay the migrations per
class, not the process startup. This is the version that is usually worth it.

**A fresh database per class inside one container.** Between the two: `CREATE DATABASE`,
which on PostgreSQL can copy an existing database as a template, so the migrations run once
and each class gets a copy. Structurally attractive; operationally it means each class has
its own connection pool, and template copying requires no other session connected to the
template.

The template trick is worth knowing about: create one database, migrate it once, then use
it as the template for a per-class copy. That converts "run all migrations per class" into
"copy a small database per class", which is a much better shape as the migration set grows.

## Why a fresh context is not a fresh database

The most common wrong turn here is `@DirtiesContext`. It evicts the Spring
`ApplicationContext` from the cache so the next class builds a new one. It does **not**
reset any data, because the container, the schema and the rows outlive the context —
`@DirtiesContext` closes the context, and the database sitting on the other end of the
connection string could not care less.

It is also the most expensive thing you can do to a suite for a non-reason: every eviction
means another context build for the next class, which is the dominant cost in most Spring
test suites. Use it when the *context* is dirty — a mutated singleton, a stubbed bean, an
altered property source — and never as a data-reset mechanism.

The inverse mistake is assuming a shared context implies a shared database. It does not
either: two classes sharing a context also share a `DataSource`, and therefore the same
rows, which is precisely why the cleanup question exists at all. See
[07 → 06c](../07-testcontainers/06c-keeping-tests-independent.md) for how Boot's context
cache produces that sharing.

## What "fresh" buys that truncation does not

Truncation empties tables. A fresh schema also resets:

- **schema changes made by a test.** A test that runs DDL — creating a temporary table,
  adding an index, testing a migration — leaves objects truncation will never remove,
  because truncation only knows about the tables that existed when the list was built;
- **sequences**, without needing `RESTART IDENTITY`;
- **anything a test added that nobody enumerated**: a new table, a view, a function, a
  trigger, an enum type, a role, an extension;
- **the migration history**, correctly, because it is rebuilt rather than emptied.

So the fresh-schema strategy is the right one for exactly one category above all others:
**tests whose subject is the schema itself.** A test that a migration applies cleanly, a
test of a DDL-generating feature, a test of a multi-tenant schema-per-tenant scheme —
none of these can be cleaned up by deleting rows, because rows are not what they created.

## The decision rule

With all four costed, the rule is short. Ask what the test needs to be able to observe.

1. **The test never touches a database.** Then it should not have one. This is most tests,
   and the biggest single win in any suite is moving tests out of this section.
2. **The test needs a database but nothing it asserts depends on a commit.** Use the
   rollback strategy. It is free, it is the default in Boot's data slices, and its
   restrictions do not bind. Most repository query tests are here.
3. **The test asserts on something that only happens at or after commit** — a deferred
   constraint, an `AFTER_COMMIT` listener, a second connection, a real HTTP request against
   `RANDOM_PORT`, or the transactional behaviour itself. Then it cannot be transactional:
   commit, and truncate before each test.
4. **The test changes the schema, or the suite runs in parallel against one database.**
   Then rows are not the unit of cleanup. Use a schema per class (or per worker), inside one
   shared container.
5. **Nothing shares anything.** If you can give every test its own data — unique keys,
   unique tenant, unique account number — you need no cleanup at all, and the suite is
   parallel-safe for free. The condition is that no assertion counts rows globally, which is
   the subject of [05b](05b-tests-that-depend-on-each-other.md).

Two rules about the rules, both learned the hard way:

**Do not mix strategies within a class**, and preferably not within a module. A suite where
some classes roll back and some commit-and-truncate is one where a truncating class runs
after a committing one and destroys data a third class was relying on. If you must mix, mix
at the module or tag boundary, not at the class boundary.

**Choose once, write it down, and enforce it with a base class or a JUnit extension** — not
with a convention. Cleanup strategy is exactly the sort of decision each new test copies
from whichever neighbour it was pasted from.

## Where this connects

- The strategy this one is more expensive than:
  [05a3 · Truncating and deleting](05a3-truncating-and-deleting.md).
- Why you might have left the rollback strategy at all:
  [05a2 · What rollback breaks](05a2-what-rollback-breaks.md).
- The four strategies and what accumulates between tests: [05 · Cleanup](05-cleanup.md).
- Sharing one container across a run, and what that costs:
  [07 · Testcontainers → 05](../07-testcontainers/05-the-singleton-pattern.md) and
  [07 → 05a3](../07-testcontainers/05a3-the-cost-of-sharing.md).
- Parallel execution against one database:
  [07 → 05a4](../07-testcontainers/05a4-parallel-execution.md).
- The strategy that needs no cleanup, and how it fails:
  [05b · Tests that depend on each other](05b-tests-that-depend-on-each-other.md).

## Gotchas

**★ `@DirtiesContext` is not a way to reset the database.**
It evicts the `ApplicationContext`, not the rows. The container, the schema and the data
survive it untouched, and you have paid for a context rebuild — the most expensive event in
a Spring test suite — in exchange for nothing.

**★ A fresh container per class is almost never the right granularity.**
You pay process startup plus the full migration set for every class. A shared container with
a schema per class gets the same isolation for the schema-construction cost alone.

**★ A shared `ApplicationContext` means a shared `DataSource`, and therefore shared rows.**
Two test classes with identical context configuration get the *same* context from Boot's
cache. Nothing announces this, and it is why two classes that each pass alone can fail
together.

**★ Truncation cannot clean up DDL a test performed.**
A temporary table, an index, a function or an enum type created by a test is invisible to a
table-emptying strategy, because the table list was built before it existed. Tests that
create objects need a fresh schema.

**★ `CREATE DATABASE … TEMPLATE` requires no other session connected to the template.**
So a pooled connection left open against the template database makes the copy fail, and the
error is about the template rather than about your pool. Keep the template database out of
the application's data source entirely.

**★ A schema per class does not isolate anything the schema does not contain.**
Roles, extensions installed at database level, and any global setting are still shared. A
test that installs an extension or alters a role affects every schema in the container.

**★ Mixing strategies across a suite is worse than either strategy alone.**
A committing class followed by a truncating class removes data a third class expected, and
the failure is attributed to whichever test happens to run next. Pick one per module and
enforce it in a base class.

**★ Per-class isolation does not give you per-method isolation.**
A fresh schema for the class still leaves the class's ten methods sharing it, which is
where the shared row of [05b](05b-tests-that-depend-on-each-other.md) lives. Fresh-schema
strategies must still say what happens *between methods*.

**★ The migrations become part of the per-class cost, so they grow with the project.**
A schema-per-class strategy that is affordable at 40 migrations may not be at 400. The
template-database trick — migrate once, copy per class — is the escape, and it is worth
setting up before the number gets large rather than after.

## Interview questions

**★ Is `@DirtiesContext` a reasonable way to reset the database between test classes?**
No. It evicts the cached `ApplicationContext`, which has nothing to do with the data — the
container and its rows outlive the context entirely. What it does buy you is a context
rebuild for the next class, which is typically the single most expensive event in a Spring
test suite, so it is the worst possible trade: maximum cost, zero effect on the problem.
`@DirtiesContext` is for a context that is genuinely dirty — a mutated singleton, a bean
replaced at runtime, an altered property source.

**★ When is a fresh schema per test class worth the cost?**
When rows are not the unit of contamination. Tests that run DDL — a migration test, a
schema-per-tenant feature, anything creating temporary objects — cannot be cleaned by
emptying tables, because the tables are not what they created. The other case is
parallelism: if several workers run against one database, giving each a schema removes the
locking and interference that truncation would cause. Outside those two, truncation gets
you the same isolation for much less.

**★ Two test classes pass individually and fail when run together. What is your first hypothesis?**
That they share an `ApplicationContext` and therefore a `DataSource`, and one of them is
leaving data behind. Boot caches contexts by configuration, so two classes with the same
annotations get the same context and the same database without anything in either class
saying so. I would confirm it by running the pair in both orders and by checking whether
either class commits — `@Commit`, a `REQUIRES_NEW`, a `RANDOM_PORT` web environment, or a
`@Sql` script running outside a transaction.

**★ Give me your decision rule for cleanup strategy.**
If the test does not need a database, it should not have one. If it needs one but nothing it
asserts depends on a commit, use the rollback strategy — free, default, sufficient. If it
asserts on something that only exists after commit — a deferred constraint, an
`AFTER_COMMIT` listener, a second connection, a real HTTP call — it must commit, so truncate
before each test instead. If it changes the schema, or the suite is parallel against one
database, give it a fresh schema. And if you can give every test unique data, do that and
clean up nothing. The rule that goes with all of them: do not mix strategies inside a
module, because a truncating class running after a committing one destroys a third class's
premise.

**★ How would you get schema isolation without paying migration cost per class?**
Migrate one database once, then use it as a template and create a copy per class —
`CREATE DATABASE x TEMPLATE y` on PostgreSQL — so each class pays a copy rather than the
whole migration set. It requires that nothing else is connected to the template, which
means keeping the template out of the application's own data source. It is worth doing
before the migration count gets large, because the alternative is a strategy that quietly
degrades as the project grows and then gets abandoned for the wrong reason.

**★ Your suite runs in parallel and started failing intermittently after you added truncation. Why?**
Because `TRUNCATE` takes an exclusive lock on each table and, more importantly, one worker's
cleanup empties the tables another worker is mid-test against. Truncation assumes a single
writer; parallel tests against one shared database break that assumption completely. The
answers are a schema per worker, unique data per test with no cleanup at all, or giving up
the parallelism for the database-touching subset of the suite while keeping it for the rest.

{/* FOOTER */}
