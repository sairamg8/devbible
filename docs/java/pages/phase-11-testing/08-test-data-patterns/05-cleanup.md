---
title: "Cleaning up between tests is four different strategies with four different bills, and the one Spring Boot hands you by default — a transaction that is rolled back — is the cheapest, the most invisible, and the one that quietly changes what your test is able to prove"
sidebar_label: "05 · Cleanup"
sidebar_position: 27
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-31 against the **Spring Framework 7.0.x** testing reference,
> *Transaction Management*
> ([docs.spring.io](https://docs.spring.io/spring-framework/reference/testing/testcontext-framework/tx.html)),
> and the Spring Boot 4.1.0 javadoc for
> [`DataJpaTest`](https://docs.spring.io/spring-boot/api/java/org/springframework/boot/data/jpa/test/autoconfigure/DataJpaTest.html),
> [`JdbcTest`](https://docs.spring.io/spring-boot/api/java/org/springframework/boot/jdbc/test/autoconfigure/JdbcTest.html),
> [`DataJdbcTest`](https://docs.spring.io/spring-boot/api/java/org/springframework/boot/data/jdbc/test/autoconfigure/DataJdbcTest.html)
> and
> [`AutoConfigureTestDatabase`](https://docs.spring.io/spring-boot/api/java/org/springframework/boot/jdbc/test/autoconfigure/AutoConfigureTestDatabase.html).
> Version spine from `spring-boot-dependencies:4.1.0`: JDK 25, Spring Boot 4.1.0,
> Spring Framework 7.0.8, JUnit Jupiter 6.0.3, Testcontainers 2.0.5.
> ⚠️ **No database, no Docker and no sandbox on this machine** — Java source, SQL and
> documented behaviour only, never a test run, a timing or a log.

**A test that leaves rows behind is not a slightly untidy test; it is a test that has
changed the premise of every test after it. There are exactly four ways to stop that
happening, they cost wildly different amounts, and the default one — a transaction that is
rolled back at the end of the method — is free, invisible, and narrows what the test is
capable of proving. This chunk establishes what actually needs cleaning, sets out the four
strategies, and covers the rollback strategy's mechanism and Spring Boot's defaults;
[05a](05a-controlling-the-test-transaction.md) covers how to steer or switch off the test
transaction, and [05a2](05a2-what-rollback-breaks.md) is the list of things it breaks.**

## "Clean" is not one thing

Between two tests, more than rows can persist. Enumerate it, because a strategy that
handles one and not the others gives you a suite that is *almost* independent, which is the
worst kind:

| What accumulates | Rolled back? | Truncated away? | Survives a fresh schema? |
|---|---|---|---|
| Rows you inserted | yes | yes | no |
| **Sequence / identity values consumed** | **no** | only with `RESTART IDENTITY` | no |
| Schema changes (DDL) | on PostgreSQL, yes — DDL is transactional | no | no |
| The Flyway/Liquibase history table | yes, if written in the transaction | 🔴 **never truncate it** | recreated |
| Hibernate second-level cache / query cache | no | no | no — but it is per context |
| The Spring `ApplicationContext` itself | n/a | n/a | cached across classes by default |
| Files, temp directories, message queues | no | no | no |

The two rows in bold and red are the ones that turn "my cleanup works" into a bug report.
Sequence values are consumed outside the transaction and are never returned; the migration
history table is what tells Flyway the schema is already at version N, and emptying it makes
the next context re-run every migration against a database that already has the objects.

## The four strategies

**A · Roll the test's transaction back.** Annotate the test `@Transactional` — or use a
slice that does it for you — and Spring rolls back at the end of every method. Free, fast,
zero configuration, and it changes what the test can observe. The rest of this page.

**B · Delete or truncate between tests.** Explicit statements that empty the tables. The
test's writes are really committed, so the test can observe everything production would,
and you pay in table-ordering rules, sequence handling, and a list of tables that must not
go stale. [05a3 · Truncating and deleting](05a3-truncating-and-deleting.md).

**C · A fresh schema, database or container.** Correct by construction and the most
expensive thing in the list. There are places it is worth it.
[05a4 · A fresh schema per class](05a4-a-fresh-schema-per-class.md).

**D · Give every test its own data, and never clean up.** No shared rows means nothing to
clean. It is the cheapest correct answer and it breaks the moment somebody asserts on a
count — which is the subject of [05b](05b-tests-that-depend-on-each-other.md), and is
covered from the container side in
[07 · Testcontainers → 06f](../07-testcontainers/06f-sql-scripts-and-unique-data.md).

The decision rule that ties them together is at the end of
[05a4](05a4-a-fresh-schema-per-class.md), because it needs all four costs on the table
first.

## Strategy A · The transaction that is rolled back

The reference states the behaviour plainly: annotating a test method with `@Transactional`
causes the test to run within a transaction that is **automatically rolled back** after
completion, and a class-level `@Transactional` applies to every test method in the
hierarchy. The machinery is `TransactionalTestExecutionListener`, another of the default
listeners.

Boot's data slices switch it on for you. The wording is identical in all three javadocs:

> *"By default, tests annotated with `@DataJpaTest` are transactional and roll back at the
> end of each test. They also use an embedded in-memory database (replacing any explicit or
> usually auto-configured DataSource). The `@AutoConfigureTestDatabase` annotation can be
> used to override these settings."*

`@JdbcTest` and `@DataJdbcTest` say the same, and all three carry `@Transactional` and
`@AutoConfigureTestDatabase` as meta-annotations. So a `@DataJpaTest` you never configured
is doing two large things you did not ask for: running in a rolled-back transaction, and —
unless the data source looks like a test database — replacing your `DataSource` with an
embedded one.

⚠️ **The replacement rule changed and most material online is stale.** In Boot 4 the
`replace` attribute of `@AutoConfigureTestDatabase` defaults to `NON_TEST`, documented as
*"Replace the DataSource bean unless it is auto-configured and connecting to a test
database"*, where a test database is detected as any bean definition carrying
`ContainerImageMetadata` — which includes `@ServiceConnection`-annotated Testcontainers
databases and Docker Compose connections — any `spring.datasource.url` backed by a
`@DynamicPropertySource`, and any `spring.datasource.url` using the Testcontainers JDBC
syntax. The practical effect is that `@AutoConfigureTestDatabase(replace = Replace.NONE)`,
which every tutorial tells you to add next to a container, is usually unnecessary now. The
older `ANY` behaviour is still available if you want it.

`@SpringBootTest` is **not** transactional by default. Adding `@Transactional` to one is a
deliberate act with consequences that are larger than in a slice, because the code under
test is a service that probably manages its own transactions.

## Where this connects

- Switching the test transaction off, committing deliberately, and the hooks outside it:
  [05a · Controlling the test transaction](05a-controlling-the-test-transaction.md).
- Everything the rollback strategy breaks, with the mechanism for each:
  [05a2 · What rollback breaks](05a2-what-rollback-breaks.md).
- Strategy B, and `@Sql` cleanup scripts that need `transactionMode = ISOLATED`:
  [05a3 · Truncating and deleting](05a3-truncating-and-deleting.md).
- Strategy C and the decision rule:
  [05a4 · A fresh schema per class](05a4-a-fresh-schema-per-class.md).
- Strategy D's failure mode: [05b · Tests that depend on each other](05b-tests-that-depend-on-each-other.md).
- The same four choices argued from the container's point of view:
  [07 · Testcontainers → 06c](../07-testcontainers/06c-keeping-tests-independent.md).
- `@Transactional` itself — proxies, propagation, self-invocation:
  [Phase 10 → 04 Spring `@Transactional`](../../phase-10-data-access/04-spring-transactional/01-not-a-language-feature.md).

## Gotchas

**★ `@DataJpaTest`, `@JdbcTest` and `@DataJdbcTest` are transactional whether you wanted it
or not.**
All three carry `@Transactional` as a meta-annotation and all three javadocs say they *"are
transactional and roll back at the end of each test"*. Nothing in your test class mentions
it, so a reader has no local evidence that the writes are being undone — or that the test
cannot observe anything that requires a commit.

**★ In Boot 4, `@AutoConfigureTestDatabase(replace = …)` defaults to `NON_TEST`, not `ANY`.**
A data source that is auto-configured and connecting to a detected test database — a
`@ServiceConnection` container, a Docker Compose service, a `@DynamicPropertySource`-backed
URL, or a Testcontainers JDBC URL — is left alone. Every blog post that tells you to add
`replace = Replace.NONE` next to a container was written against the old default; the
annotation is usually unnecessary now, and adding it is harmless but misleading.

**★ Sequence values are consumed even by a transaction that is rolled back.**
Sequences are deliberately non-transactional. Nothing about the rollback strategy makes ids
deterministic, which is why "assert the id is 1" passes on a fresh database and never
again.

**★ "The database is clean between tests" is not the same as "the context is clean".**
The `ApplicationContext` is cached and shared across test classes, so a Hibernate
second-level cache, an in-memory `@Cacheable` store, a static field, or a mock configured
by a previous class survives every database strategy on this page. `@DirtiesContext`
addresses that and is not a data-reset mechanism.

**★ A transactional test on a Testcontainers database gives up most of the reason you
started a container.**
The point of a real engine is that the SQL really executes against it; a rolled-back test
never commits, so constraint checks deferred to commit time, `AFTER_COMMIT` behaviour and
anything observed on a second connection are all outside what the test can see. That is
argued in full in [07 → 06d](../07-testcontainers/06d-the-rollback-strategy.md).

## Interview questions

**★ What exactly does `@Transactional` on a test class do?**
`TransactionalTestExecutionListener` starts a transaction before each test method and rolls
it back afterwards, so the method's writes are undone. It is not the same annotation
behaviour as on a bean: only a subset of the attributes is honoured — `value` and
`transactionManager` yes, `propagation` only for `NOT_SUPPORTED` and `NEVER`, and
`isolation`, `timeout`, `readOnly`, `rollbackFor` and `noRollbackFor` not at all. It is
also inherited by every method in the class hierarchy, and `@BeforeEach` and `@AfterEach`
run inside the transaction, which is why cleanup written there does nothing.

**★ Is `@DataJpaTest` transactional? Is `@SpringBootTest`?**
`@DataJpaTest` is — its javadoc says tests annotated with it *"are transactional and roll
back at the end of each test"*, and it carries `@Transactional` as a meta-annotation, as do
`@JdbcTest` and `@DataJdbcTest`. `@SpringBootTest` is not; if you want the same behaviour
you add `@Transactional` explicitly, and you should think harder before doing so, because
the code under test in a full-context test usually manages its own transaction boundaries
and joining them to the test's is exactly how you stop testing them.

**★ What does `@AutoConfigureTestDatabase` do, and what is its default in Boot 4?**
It replaces the application's `DataSource` with an embedded one for the test. In Boot 4 the
`replace` attribute defaults to `NON_TEST`: replace the bean *unless* it is auto-configured
and connecting to something detected as a test database — a bean definition carrying
`ContainerImageMetadata`, which covers `@ServiceConnection` Testcontainers databases and
Docker Compose, a `spring.datasource.url` backed by `@DynamicPropertySource`, or a
Testcontainers JDBC URL. That is a change worth knowing, because the near-universal advice
to write `replace = Replace.NONE` alongside a container was correct against the old `ANY`
default and is usually redundant now.

**★ Name three things that are not cleaned up by any of the strategies on this page.**
Sequence and identity values, which are consumed non-transactionally and never returned;
anything held in the `ApplicationContext`, which is cached and shared across test classes —
a Hibernate second-level cache, a `@Cacheable` store, a static field, a stubbed bean; and
anything outside the database entirely, such as files, temp directories, message queues or
an external service's state. A suite that resets its rows perfectly and none of these is
still order-dependent, and the failures look identical.

{/* FOOTER */}
