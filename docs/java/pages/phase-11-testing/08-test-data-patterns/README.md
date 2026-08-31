---
title: "Test data patterns: every test arranges data before it asserts, and the arrangement is where suites go wrong — forty-line setup blocks that hide the one field that matters, fixtures shared until the suite is order-dependent, and clocks that make a green build a matter of what time it is"
sidebar_label: "Overview"
sidebar_position: 0
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-31 against the **Spring Framework 7.0.8** testing reference and javadocs
> (`@Sql`, `@SqlConfig`, `@SqlGroup`, `@SqlMergeMode`, `ScriptUtils`, test-managed
> transactions), the **Spring Boot 4.1.0** javadocs for the test slices and
> `@AutoConfigureTestDatabase`, the **JUnit Jupiter 6.0.3** user guide and javadocs
> (lifecycle, `MethodOrderer`, `ClassOrderer`, parallel execution), the **JDK 25** javadocs for
> `java.time` and `java.util.random`, **Project Lombok**'s `@Builder` documentation, the
> **Gradle** user manual's *Java test fixtures* section, **Awaitility 4.3.0** and
> **Datafaker**.
> Version spine from `spring-boot-dependencies:4.1.0`: JDK 25, Spring Boot 4.1.0,
> Spring Framework 7.0.8, JUnit Jupiter 6.0.3, Mockito 5.23.0, AssertJ 3.27.7,
> Testcontainers 2.0.5, Awaitility 4.3.0.
> ⚠️ **No Docker, no database and no sandbox on this machine.** Every page carries Java source,
> SQL and documented configuration — never a test run, a container log or a timing.

**Every test arranges data before it acts and asserts, and the arrangement is where large suites
rot. This topic is about the arrangement: how a test says what it depends on without saying
forty other things, where the defaults live, how data gets into a database and out again, and
why a test that reads the system clock or generates a random id is a failure scheduled for a
date nobody chose.**

Three failure modes run through all 34 chunks, and they are the same failure wearing
different clothes:

1. **The test states things it does not depend on**, so a reader cannot tell which value produced
   the expected result — the forty-line setup block, and the `TestData` class that grew out of it.
2. **Two tests share something mutable** — a `static` fixture, a database row, a sequence — so
   the suite passes in one order and fails in another, and CI is where you find out.
3. **The test depends on something it did not choose** — the wall clock, a random id, a
   generated name — so a build that is green today is green because of the date.

**34 chunks, ~8,999 lines, 450 gotchas and interview questions.** Read in order; each chunk
links to the next.

| # | Chunk | Tier | What it argues |
|---|---|---|---|
| 1 | **[01 · The forty-line setup](01-the-forty-line-setup.md)** | <span className="db-tier t-understand">Understand</span> | The forty-line setup block |
| 2 | **[01b · What the fix is not](01b-what-the-fix-is-not.md)** | <span className="db-tier t-understand">Understand</span> | Delete a line and see what breaks |
| 3 | **[02 · The builder](02-the-builder.md)** | <span className="db-tier t-understand">Understand</span> | The test data builder |
| 4 | **[02b · Builder design rules](02b-builder-design-rules.md)** | <span className="db-tier t-understand">Understand</span> | The three rules that decide whether a builder stays correct as the code moves |
| 5 | **[02c · Where builders live, and Lombok](02c-where-builders-live-and-lombok.md)** | <span className="db-tier t-understand">Understand</span> | Where the builder class lives once three modules want it |
| 6 | **[02d · Builders and records](02d-builders-and-records.md)** | <span className="db-tier t-understand">Understand</span> | When the domain type is a record |
| 7 | **[03 · Object mothers](03-object-mothers.md)** | <span className="db-tier t-understand">Understand</span> | The object mother names a situation rather than an object |
| 8 | **[03b · When a mother becomes a god object](03b-when-a-mother-becomes-a-god-object.md)** | <span className="db-tier t-understand">Understand</span> | The mother class that knows how to build everything |
| 9 | **[04 · Fixtures in the database](04-fixtures-in-the-database.md)** | <span className="db-tier t-understand">Understand</span> | A fixture that lives in a .sql file is a claim about rows rather than about objects, and @Sql i… |
| 10 | **[04b · Phases and the lifecycle](04b-phases-and-the-lifecycle.md)** | <span className="db-tier t-understand">Understand</span> | @Sql scripts do not run where you think they do relative to @BeforeEach and @AfterEach, there a… |
| 11 | **[04b2 · Groups and merge mode](04b2-groups-and-merge-mode.md)** | <span className="db-tier t-understand">Understand</span> | @Sql is repeatable, its declarations run in source order, and |
| 12 | **[04c · @SqlConfig and the parser](04c-sqlconfig-and-the-parser.md)** | <span className="db-tier t-understand">Understand</span> | Spring parses your fixture script itself before the database ever sees it |
| 13 | **[04c2 · Error modes and half-failed scripts](04c2-error-modes-and-half-failed-scripts.md)** | <span className="db-tier t-understand">Understand</span> | There is no per-script atomicity |
| 14 | **[04d · SQL versus repository fixtures](04d-sql-versus-repository-fixtures.md)** | <span className="db-tier t-understand">Understand</span> | A SQL fixture is honest about what is in the database and blind to refactoring; a fixture inser… |
| 15 | **[04d2 · The columns SQL has to fill](04d2-the-columns-sql-has-to-fill.md)** | <span className="db-tier t-understand">Understand</span> | A hand-written INSERT has to satisfy the schema rather than the entity, so it must fill every c… |
| 16 | **[05 · Cleanup](05-cleanup.md)** | <span className="db-tier t-understand">Understand</span> | Cleaning up between tests is four different strategies with four different bills, and the one S… |
| 17 | **[05a · Controlling the test transaction](05a-controlling-the-test-transaction.md)** | <span className="db-tier t-understand">Understand</span> | Most of @Transactional's attributes do nothing on a test and fail silently, @BeforeEach and @Af… |
| 18 | **[05a2 · What rollback breaks](05a2-what-rollback-breaks.md)** | <span className="db-tier t-understand">Understand</span> | The rollback strategy is free because it never commits, and everything it breaks is a consequen… |
| 19 | **[05a3 · Truncating and deleting](05a3-truncating-and-deleting.md)** | <span className="db-tier t-understand">Understand</span> | Emptying the tables between tests is the strategy that lets a test commit, and it costs three t… |
| 20 | **[05a4 · A fresh schema per class](05a4-a-fresh-schema-per-class.md)** | <span className="db-tier t-understand">Understand</span> | A fresh schema or a fresh container is the only strategy that is correct by construction, and i… |
| 21 | **[05b · Tests that depend on each other](05b-tests-that-depend-on-each-other.md)** | <span className="db-tier t-understand">Understand</span> | One shared row turns a suite into a program whose tests are statements, and the single most com… |
| 22 | **[05b2 · Finding order dependence](05b2-finding-order-dependence.md)** | <span className="db-tier t-understand">Understand</span> | Order dependence is not a bug you wait for |
| 23 | **[06 · Random and time](06-random-and-time.md)** | <span className="db-tier t-understand">Understand</span> | A method that calls LocalDate.now() has hard-coded its clock |
| 24 | **[06b · What to inject](06b-what-to-inject.md)** | <span className="db-tier t-understand">Understand</span> | The parameter's type is a claim about the class |
| 25 | **[06c · The clocks a test passes](06c-the-clocks-a-test-passes.md)** | <span className="db-tier t-understand">Understand</span> | The JDK ships three real clock implementations |
| 26 | **[06d · The two mocks that are not the fix](06d-the-two-mocks-that-are-not-the-fix.md)** | <span className="db-tier t-understand">Understand</span> | Both shortcuts around injecting a clock are mocks |
| 27 | **[06e · The clock bean](06e-the-clock-bean.md)** | <span className="db-tier t-understand">Understand</span> | Spring Boot does not auto-configure a Clock bean and the request for one was closed as not plan… |
| 28 | **[06f · Overriding the clock in a slice](06f-overriding-the-clock-in-a-slice.md)** | <span className="db-tier t-understand">Understand</span> | Replacing the clock in a Spring slice is a bean-override decision, and the reflex answer is the… |
| 29 | **[06g · The clocks you do not own](06g-the-clocks-you-do-not-own.md)** | <span className="db-tier t-understand">Understand</span> | Your Clock bean governs the timestamps your Java code writes and nothing else |
| 30 | **[06h · Asserting on a timestamp you did not choose](06h-asserting-on-a-timestamp-you-did-not-choose.md)** | <span className="db-tier t-understand">Understand</span> | When the timestamp really does come from a clock you cannot control, the fix is not a wider tol… |
| 31 | **[07 · Faker and generated data](07-faker-and-generated-data.md)** | <span className="db-tier t-understand">Understand</span> | Generated data earns its place in exactly one region of a fixture |
| 32 | **[07b · The seed discipline](07b-the-seed-discipline.md)** | <span className="db-tier t-understand">Understand</span> | A seed you did not print is a failure you cannot reproduce, and a seed you hard-coded is a fixe… |
| 33 | **[07c · Generated ids](07c-generated-ids.md)** | <span className="db-tier t-understand">Understand</span> | UUID.randomUUID() is the right tool for uniqueness and a defect in an assertion, and the deeper… |
| 34 | **[07d · Seeded randomness in the JDK](07d-seeded-randomness-in-the-jdk.md)** | <span className="db-tier t-understand">Understand</span> | ThreadLocalRandom's javadoc says outright that its seed may not be modified and setSeed throws,… |

## Where this topic sits

- The engine, lifecycle and ordering APIs belong to
  [01 · JUnit 5](../01-junit-5/README.md); assertion style to
  [02 · AssertJ](../02-assertj/README.md).
- When the repetition is in the **cases** rather than the objects, the answer is
  [03 · Parameterized tests](../03-parameterized-tests/README.md), not a builder.
- Mocking a collaborator is [04 · Mockito](../04-mockito/README.md); choosing a slice is
  [05 · The test pyramid in Spring](../05-the-test-pyramid/README.md).
- The real database these fixtures load into is
  [07 · Testcontainers](../07-testcontainers/README.md).

{/* FOOTER */}
