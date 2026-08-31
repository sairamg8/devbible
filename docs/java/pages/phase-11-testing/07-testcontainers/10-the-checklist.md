---
title: "Reviewing a Testcontainers test — the questions that separate a test which proves something about your production database from one that merely takes longer to be wrong, in the order you should ask them"
sidebar_label: "10 · The checklist"
sidebar_position: 90
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-31 — every item here is a consequence of a fact established and cited in an
> earlier chunk of this topic, and links to the chunk that establishes it. Sources across the topic:
> the **Testcontainers 2.0.5** sources and documentation, **Spring Boot 4.1.0**'s Testcontainers and
> Database Initialization references, and **Spring Framework 7.0**'s transaction and SQL-script
> testing references.
> Version spine from `spring-boot-dependencies:4.1.0`: JDK 25, Spring Boot 4.1.0,
> Testcontainers 2.0.5, JUnit Jupiter 6.0.3, Flyway 12.4.0.
> ⚠️ **No Docker and no sandbox on this machine.** Nothing here is a container log, a timing or a
> test run.

**The failure this topic is about is not a test that goes red. It is a test that goes green while
proving nothing — and every one of the ways that happens has appeared somewhere in the preceding
chunks. This is those ways, arranged as questions to ask a diff. The first question is worth the
other twelve combined, and it is the one nobody asks.**

## 🔴 0 · Should this test use a container at all?

Ask it first, and ask it about the *assertion*, not the class under test.

- Does the assertion depend on **what the SQL actually returned**, on a constraint, on a mapping, on
  transaction or isolation behaviour? → **Yes, it needs the real engine.**
  [01b](01b-where-the-line-is.md)
- Is it about JSON shape, status codes, validation messages, service branching or domain rules?
  → **No.** It is a slice or a plain unit test, and Testcontainers' own documentation agrees: *"it's
  still important to have as few tests that hit the database as possible"*. [09](09-the-cost.md)

A suite's container cost is dominated by *how many tests need one*, not by how fast each one starts.
Everything below is secondary to getting this right.

## 1 · Is the schema the one you deploy?

- **Do the real migrations run?** If Flyway or Liquibase owns the schema in production, the test
  must run them. [06](06-schema-and-data.md)
- 🔴 **Is it a `@DataJpaTest`?** Then the migrations are almost certainly *not* running — the slice
  imports no Flyway auto-configuration, and Hibernate built the schema from the entities instead.
  That test compares Hibernate against Hibernate.
  [Phase 10 · 11c](../../phase-10-data-access/11-flyway-migrations/11c-the-slice-that-skips-your-migrations.md)
- **Is `ddl-auto` doing the work?** On a container it defaults to `none` — so if the schema exists,
  something built it, and you should know what. `validate` is the setting you want alongside real
  migrations. [06b](06b-the-defaults-that-silently-stop.md)
- **Is there a `schema.sql` in the test tree?** Either it is not running at all (the default only
  initialises embedded databases) or `spring.sql.init.mode=always` was set and you now have a second
  schema nobody maintains. [06b](06b-the-defaults-that-silently-stop.md)
- **Does an init script create tables?** That is a duplicate schema. Init scripts are for what has to
  exist before the app connects — extensions, roles, `search_path`. [06](06-schema-and-data.md)

## 2 · Is the image pinned, and is it the right one?

- **A specific tag, never `latest`.** An image is a dependency. [07c](07c-networks-and-image-names.md)
- **The same major version you deploy.** `postgres:18-alpine` if production is PostgreSQL 18. A test
  on a different major is a smaller version of the H2 mistake.
- **2.x class, not the 1.x shim.** `org.testcontainers.postgresql.PostgreSQLContainer`, written with
  **no `<>`**. If the diff has `` `PostgreSQLContainer<>` ``, it compiled against a deprecated class.
  [02](02-what-testcontainers-is.md)
- **The artifact is `testcontainers-<module>`**, and the import is `org.testcontainers.<module>`.
  [07](07-beyond-postgres.md)

## 3 · Does the test know when the container is ready?

- **Is it a first-party module?** Then this is answered for you, and that is most of what the module
  is worth.
- **Is it a `GenericContainer`?** Then the default is "the first mapped port is listening", which
  for most services is earlier than being able to serve a request. Look for an explicit
  `waitingFor(...)`. [07b](07b-genericcontainer-and-waiting.md)
- **Does the image declare a `HEALTHCHECK`?** Then `Wait.forHealthcheck()` beats anything you would
  infer from outside.
- **Is it waiting for HTTP 200 on a secured endpoint?** That waits forever; `401` is a perfectly good
  readiness signal.
- **Is `Wait.forLogMessage` matching a log line?** That couples the test to wording that is not an
  API. Acceptable as a last resort, worth a comment saying so.

## 4 · Is the wiring lazy, and does it use the mapped port?

- **No hardcoded ports**, anywhere. The mapping is random by design, so parallel runs do not collide.
  [07b](07b-genericcontainer-and-waiting.md)
- **No hardcoded `localhost`** — `getHost()`, because the daemon is not always local.
- **Nothing calls `getMappedPort` in a field initialiser.** The container must be running when it is
  called, so URLs are produced lazily — a service connection, a `@DynamicPropertySource` supplier, or
  a `@BeforeAll`.
- **Container-to-container traffic uses the network alias and the original port**, not the mapped
  one. [07c](07c-networks-and-image-names.md)

## 5 · Is the container's lifetime sane?

- **Is a container started per test class?** That is the cost the singleton pattern and container
  beans exist to remove. **05 · The singleton pattern** *(not written yet)*
- **Is `@Container` used with `@SpringBootTest`?** Boot 4.1 recommends against exactly this pairing —
  the extension stops the container after the test class while Spring caches the context beyond that
  point. Prefer container beans or `@ImportTestcontainers`. [04](04-serviceconnection.md)
- 🔴 **Is `@DirtiesContext` present?** It evicts the context, discards the container and forces the
  next class to start a new one. Every occurrence should be justified in a comment.
  [06c](06c-keeping-tests-independent.md)
- **Are there gratuitous `@MockitoBean`s or property overrides?** Each one can fragment the context
  cache and multiply container starts. This is the usual real cause of "Testcontainers is slow".
  [09](09-the-cost.md)

## 6 · How does this test get a clean database — and is that stated?

- **Is a strategy chosen at all**, or is the test relying on running first?
  [06c](06c-keeping-tests-independent.md)
- 🔴 **Is the class `@Transactional`?** Then ask what the test asserts. If it touches commit-time
  behaviour — deferred constraints, `AFTER` triggers, `AFTER_COMMIT` listeners, anything visible to a
  second connection, anything about isolation or locking — **the rollback has cancelled it**.
  [06d](06d-the-rollback-strategy.md)
- **Does a transactional test manipulate the persistence context and expect a database error?** It
  needs an explicit flush, or it is one of Spring's documented false positives.
  [06d](06d-the-rollback-strategy.md)
- **Is there an `@AfterEach` cleanup inside a transactional class?** It does nothing — after methods
  run inside the test-managed transaction. [06d](06d-the-rollback-strategy.md)
- **Does a truncation step exclude `flyway_schema_history`?** If not, the next context re-runs or
  fails to validate every migration. [06e](06e-truncating-between-tests.md)
- **Is the truncation table list hardcoded?** It is wrong from the next migration onwards; query
  `information_schema`. [06e](06e-truncating-between-tests.md)
- **Is a cleanup `@Sql` script missing `transactionMode = ISOLATED`?** Then it is rolled back with
  the test and cleans nothing. [06f](06f-sql-scripts-and-unique-data.md)
- **Does the class mix strategies?** Some methods committing and some rolling back makes execution
  order significant, which JUnit is free to change.

## 7 · Does the test assert on something a shared database can guarantee?

- **An assertion on a specific generated id** is wrong — sequences are non-transactional and do not
  give the number back on rollback. [06c](06c-keeping-tests-independent.md)
- **`count()`, `findAll()`, "the newest row"** assume the table holds only this test's data. Either
  truncate, or scope the query. [06f](06f-sql-scripts-and-unique-data.md)
- **For a broker**, none of the database strategies apply at all — committed offsets, created topics
  and consumer-group state all outlive the test. Unique topic or group per test.
  [07](07-beyond-postgres.md)

## 8 · Will this run on somebody else's machine, and in CI?

- **Is there a container runtime everywhere this suite runs?** Including the developers who never
  touch the backend. [09](09-the-cost.md)
- **Is `disabledWithoutDocker = true` in use?** Then some CI job that definitely has a runtime must
  be the one gating merges — otherwise the skip is a silent hole. [09](09-the-cost.md)
- **Is the image pre-pulled in CI?** If not, expect "fails only on the first run after the cache was
  cleared", diagnosed as flakiness. [09](09-the-cost.md)
- **Is CI mounting the Docker socket rather than nesting Docker?** And if it mounts, is the source at
  the same path inside and out? [09b](09b-ci-and-alternative-runtimes.md)
- **Is reuse enabled anywhere near CI?** It is documented as unsuited to it.
  **05b · Reuse** *(not written yet)*

## 9 · Is the claim the test makes actually true?

The last question, and the one that catches the subtle ones:

- **Does the test name promise more than it proves?** A `LocalStack` test named `enforcesIamPolicy`
  is claiming something an emulator cannot establish. [07](07-beyond-postgres.md)
- **Would this test still pass if the behaviour under test were removed?** If a rolled-back test
  asserts a side effect of an `AFTER_COMMIT` listener, it passes because the listener never ran.
- **Would it pass on H2?** If yes, ask why it needs a container — either the assertion is not
  engine-dependent and it should be a slice, or the assertion is too weak.

## Gotchas

**★ The checklist is worthless if item 0 is skipped.**
A meticulously reviewed suite of four hundred container tests is still the wrong suite. The question
"should this use a container at all" is the only one that changes the shape of the problem.

**★ "It passes" and "it proves something" are independent.**
Every item above describes a way to get the first without the second: a schema Hibernate invented, a
rollback that skipped the commit, a count over another test's rows, an emulator standing in for IAM.

**★ A test that would also pass on H2 is a test that did not need the container.**
Either the assertion is not engine-dependent — make it a slice and get the time back — or it is too
weak to catch what you were worried about.

**★ Reviewing the container configuration and not the assertion misses the real defects.**
The image tag, the wait strategy and the port handling are the easy half. Whether a rolled-back
transaction has silently cancelled what the test claims to check is the half that requires reading
the assertion.

**★ `@DirtiesContext` in a diff is always worth a question.**
It is occasionally correct and usually a workaround for state a cleanup strategy should have handled
— and it costs a container start for the next class.

**★ A green build with no runtime present is the most dangerous state on this list.**
`disabledWithoutDocker = true` produces it deliberately, and nothing in the output distinguishes
"integration tests passed" from "integration tests did not run".

## Interview questions

**★ You are reviewing a pull request with a new Testcontainers test. What do you look at first?**
Whether it needs a container at all — that is, whether the *assertion* depends on what the database
actually did. If it is about JSON shape, status codes or service branching, it is a slice, and
Testcontainers' own docs say to have as few database-hitting tests as possible. Everything else on
the checklist is secondary to that.

**★ A repository test uses `@DataJpaTest` with a container and passes. What is your first suspicion?**
That the migrations never ran. `@DataJpaTest` imports no Flyway auto-configuration, so Hibernate
built the schema from the entity classes — and the test is then comparing Hibernate's output against
Hibernate, with every migration defect invisible.

**★ The test class is annotated `@Transactional`. What do you check?**
What it asserts. If it touches deferred constraints, `AFTER` triggers, `AFTER_COMMIT` listeners,
anything visible only to a second connection, or isolation and locking behaviour, the rollback has
cancelled the thing the container was there to provide. And if it manipulates the persistence
context expecting a database error, it needs an explicit flush or it is a documented false positive.

**★ How can you tell a Testcontainers test is proving less than it claims?**
Ask whether it would still pass with the behaviour removed, and whether it would pass on H2. A
rolled-back test asserting a commit-phase side effect passes because the side effect never happened;
a test that passes on H2 either did not need the engine or is asserting too little.

**★ What in a diff tells you the code was copied from a pre-2.0 tutorial?**
`` `PostgreSQLContainer<>` `` with diamond brackets, an `org.testcontainers:postgresql` dependency
without the `testcontainers-` prefix, an `org.testcontainers.containers.PostgreSQLContainer` import,
a no-arg container constructor, or anything JUnit 4 and `@Rule`-based.

**★ What would make you question a `GenericContainer` in a review that you would not question in a
module container?**
The wait strategy. A module has already defined what ready means for that service; a
`GenericContainer` defaults to "the first mapped port is listening", which is usually earlier —
producing an intermittent failure that shows up worst on a loaded CI machine.

**★ A truncation helper is added to the test base class. What do you check?**
That it excludes `flyway_schema_history` and any other migration-owned table, that the table list is
queried rather than hardcoded, and that it runs *before* each test rather than after — so it still
works when the previous test crashed the JVM.

**★ What is the most dangerous green build in this topic?**
One where `disabledWithoutDocker = true` skipped every integration test because the machine had no
runtime. Nothing in the output distinguishes it from a build where they all passed.

**★ Why is "would this pass on H2?" a useful review question rather than a rhetorical one?**
Because it separates the two legitimate outcomes cleanly. If yes, either the test does not need the
container and should be a faster slice, or the assertion is too weak to catch the engine-specific
behaviour that motivated the container in the first place.

{/* FOOTER */}
