---
title: "The container outlives the test class by design, so every test after the first one runs against a database somebody else has already written to — and what accumulates is not only rows, but sequence values, migration history and everything the engine does outside a transaction"
sidebar_label: "06c · Keeping tests independent"
sidebar_position: 41
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-31 against Spring Framework 7.0's **Transaction Management** testing reference
> ([docs.spring.io](https://docs.spring.io/spring-framework/reference/testing/testcontext-framework/tx.html))
> and Spring Boot 4.1's **Testcontainers** reference
> ([docs.spring.io](https://docs.spring.io/spring-boot/reference/testing/testcontainers.html)),
> from which the container-lifetime statements are quoted verbatim.
> Version spine from `spring-boot-dependencies:4.1.1`: JDK 25, Spring Boot 4.1.1,
> Spring Framework 7.0.9, Testcontainers 2.0.5, JUnit Jupiter 6.0.3.
> ⚠️ **No Docker and no sandbox on this machine.** Nothing here is a container log, a timing or a
> test run — the page carries Java source and documented configuration only.

**[06](06-schema-and-data.md) and [06b](06b-the-defaults-that-silently-stop.md) got a schema into
the container. This chunk is the problem that starts the moment the second test runs: the container
is still there, and so is everything the first test wrote. This is not a bug and it is not
something to configure away — it is the whole reason a container is fast enough to use at all. What
you have to choose is how each test gets a known starting state, and the four available answers
have very different costs. One of them is nearly free and quietly stops testing the thing you care
about — [06d](06d-the-rollback-strategy.md) is that one, in full.**


## Why the state is shared — this is Boot's design, stated plainly

Spring caches application contexts, and container beans live and die with the context, not with the
test class:

> *"Container beans are created and started once per application context managed by Spring's
> TestContext Framework."*

> *"Container beans are stopped as part of the TestContext Framework's standard application context
> shutdown process. When the application context gets shutdown, the containers are shutdown as
> well. This usually happens after all tests using that specific cached application context have
> finished executing."*

> 🔴 *"A single test container instance can, and often is, retained across execution of tests from
> multiple test classes."*

So one PostgreSQL serves your whole suite, which is exactly what you want — starting a container
per test class would put the container cost on every class, and **05 · The singleton pattern**
*(not written yet)* exists precisely to avoid that. The price is that isolation is now your
problem, not the runtime's.

## What actually accumulates

Not just rows. Four different kinds of leftover state, and only the first is obvious:

1. **Rows.** The orders test wrote three orders. The reporting test counts orders. It now counts
   three more than it inserted.
2. **Sequence values.** Even a rolled-back insert consumes a sequence number — PostgreSQL sequences
   are deliberately non-transactional so they do not serialise. Any test asserting `id == 1` is
   already broken; it is just broken later.
3. **Schema and migration history.** With container reuse (**05b · Reuse** *(not written yet)*),
   `flyway_schema_history` survives the JVM. A migration that ran yesterday will not run again
   today, so a test of a *new* migration can pass against a schema built by an *old* version of it.
4. **Everything the database does outside a transaction** — advisory locks, `LISTEN`/`NOTIFY`
   registrations, prepared statements in the pool, and anything a `@TransactionalEventListener`
   published.

## The four answers

| Strategy | Isolation | What it costs |
|---|---|---|
| **A · Roll back the test transaction** | strong, per method | 🔴 never commits, so it does not test the commit path |
| **B · Truncate between tests** | strong, per method | real commits; you must maintain the table list |
| **C · `@Sql` scripts before/after** | as strong as you write it | explicit, verbose, easy to get out of step with the schema |
| **D · Make every test use unique data** | none needed | no cleanup at all; fails when the assertion is a count |

None of these is the right answer everywhere. The mistake is picking one for the whole suite
because a template picked it for you.


## A, B, C and D — where each is written up

**A · roll back the test transaction** is [06d · The rollback strategy](06d-the-rollback-strategy.md),
because it has enough failure modes to need a page of its own.

If you want the commit path tested — and on a Testcontainers test you usually do — you need cleanup
that is not "never write anything". The three mechanical options are:

- **Truncate between tests**, which is the general answer;
- **`@Sql` scripts**, which is the declarative answer;
- **unique data per test**, which is the answer that needs no cleanup at all.

[06e · Truncating between tests](06e-truncating-between-tests.md) is the general answer — the
`TRUNCATE … RESTART IDENTITY CASCADE` form and generating the table list instead of maintaining it.
[06f · `@Sql` scripts and unique data](06f-sql-scripts-and-unique-data.md) is the other two —
`@Sql`'s four execution phases and its `ISOLATED` transaction mode, when unique-data-per-test is
the cheapest correct thing you can do, and a decision rule across all four.

## What `@DirtiesContext` is not

It is not a data-cleanup tool. It evicts the **application context** from the cache, which
throws away the container along with it and forces the next test class to start a new one — the
expensive thing the singleton pattern exists to avoid — while doing nothing whatsoever about rows
if you happen to be sharing a container outside the context's lifecycle. The context cache is
**05 · The test pyramid**'s subject, not this topic's:
[05 · The context cache](../05-the-test-pyramid/05-the-context-cache.md) and
[05b · What evicts it](../05-the-test-pyramid/05b-what-evicts-it.md).

## Where the fixtures themselves belong

Everything above is about *when state is removed*. What the fixture data should look like — object
mothers, builders, the argument against sharing one giant `data.sql` across a suite — belongs to
**08 · Test data patterns** *(not written yet)*, and this topic deliberately hands off rather than
half-covering it.


## Gotchas

**★ Sequence values are consumed even by a rolled-back transaction.**
PostgreSQL sequences are non-transactional on purpose, so a rollback does not give the number back.
Any assertion on a specific generated id is already wrong; a shared container just makes it fail
sooner.

**★ `flyway_schema_history` survives a reused container, so a new migration may never run.**
The schema is built by *yesterday's* version of the migration and the test passes against it. This
is the reuse-specific failure worth knowing about before you enable reuse.

**★ `@DirtiesContext` is not a way to reset data.**
It evicts the application context — throwing away the container and forcing the next class to start
one — and does nothing directly about rows. It is a context-cache tool, and an expensive one.

**★ Mixing strategies across a suite is worse than either strategy alone.**
Half the classes roll back and half commit, so whether a test sees a clean database depends on
execution order — which JUnit is explicitly free to change. Pick per test class, deliberately, and
say which in the class's name or a comment.

## Interview questions

**★ Your test suite uses one Testcontainers PostgreSQL for everything. How does each test get a
clean database?**
It does not, by default — *"a single test container instance can, and often is, retained across
execution of tests from multiple test classes"*, and container beans live as long as the cached
application context. You choose an isolation strategy: roll back the test transaction, truncate
between tests, run `@Sql` cleanup scripts, or give every test unique data so cleanup is unnecessary.

**★ A test asserts the generated id is 1 and it fails on the second run. What is going on?**
Sequences are deliberately non-transactional, so a rollback does not return the number. The
assertion was never valid — it happened to hold once, against a database nothing had written to yet.

**★ Is `@DirtiesContext` a reasonable way to reset the database between test classes?**
No. It evicts the application context, which discards the container and forces the next class to
start a fresh one — the exact cost the singleton pattern exists to avoid — and it is a statement
about the context, not about rows.

**★ You enabled container reuse and a test for a brand-new migration passes without the migration
having run. Why?**
Because `flyway_schema_history` persisted in the reused container from an earlier run, so Flyway
sees the version as already applied and skips it. The test then asserts against a schema built by
an older version of that migration.

{/* FOOTER */}

{/* FOOTER */}
