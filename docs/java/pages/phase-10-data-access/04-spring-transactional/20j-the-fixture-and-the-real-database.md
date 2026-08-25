---
title: "The fixture is a transactional decision too — and an in-memory database quietly removes every engine behaviour the test was written to check"
sidebar_label: "20j · The fixture and the real database"
sidebar_position: 61
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 against the Spring Framework 7.0 reference *Testing → TestContext
> Framework → Executing SQL scripts*
> ([docs.spring.io/spring-framework/reference/testing/testcontext-framework/executing-sql.html](https://docs.spring.io/spring-framework/reference/testing/testcontext-framework/executing-sql.html)),
> the `SqlConfig.TransactionMode` javadoc
> ([.../test/context/jdbc/SqlConfig.TransactionMode.html](https://docs.spring.io/spring-framework/docs/current/javadoc-api/org/springframework/test/context/jdbc/SqlConfig.TransactionMode.html))
> and the `@DataJpaTest` javadoc
> ([.../boot/data/jpa/test/autoconfigure/DataJpaTest.html](https://docs.spring.io/spring-boot/api/java/org/springframework/boot/data/jpa/test/autoconfigure/DataJpaTest.html)).
> JDK 25, Spring Framework 7.0.8, Spring Boot 4.1.0, PostgreSQL 18.

**Everything from [20d](20d-what-a-test-must-assert.md) onward has been about the
assertion. Two things upstream of it decide whether the assertion can mean anything at
all: whether the fixture was committed, and whether the database under the test is the
database you deploy. Both have a default that is convenient and quietly wrong for a
whole class of test.**

## The fixture is a decision, not a detail

`@Sql` runs scripts around a test, and its `transactionMode` decides whether the
fixture lands **inside** the test's transaction or **outside** it. Those are different
fixtures and they support different tests. `SqlConfig.TransactionMode` documents the
options:

| Mode | Javadoc |
|---|---|
| `INFERRED` | "the transaction mode to use when executing SQL scripts should be *inferred* using the rules listed below… the term '*available*' means that the bean for the data source or transaction manager is either explicitly specified via a corresponding annotation attribute in `@SqlConfig` or discoverable via conventions" |
| `ISOLATED` | "SQL scripts should always be executed in a new, *isolated* transaction that will be immediately committed. In contrast to `INFERRED`, this mode requires the presence of a transaction manager **and** a data source." |
| `DEFAULT` | "the *default* transaction mode should be used" — which resolves to `INFERRED` unless inherited from a global `@SqlConfig` |

The practical rule: **`INFERRED` gives you a fixture that the test's rollback removes;
`ISOLATED` gives you one that is committed and therefore survives, and which you must
delete yourself.** The reference's own example pairs them deliberately:

```java
@Test
@Sql(scripts = "create-test-data.sql",
     config = @SqlConfig(transactionMode = ISOLATED))
@Sql(scripts = "delete-test-data.sql",
     config = @SqlConfig(transactionMode = ISOLATED),
     executionPhase = AFTER_TEST_METHOD)
void userTest() {
    // run code that needs the test data to be committed
    // to the database outside of the test's transaction
}
```

Note that both halves are `ISOLATED` and the cleanup is declared as its own `@Sql` in
the `AFTER_TEST_METHOD` phase. That is the shape: committed fixture, committed
cleanup, both declarative so a failing test still cleans up.

`ISOLATED` is what you need when the code under test reads on a different connection —
anything using `REQUIRES_NEW`, a second datasource, or a real second thread — because
an uncommitted fixture is invisible to all of them.

### The script nobody declared

`@Sql` with no `scripts` attribute is not a no-op — it looks for a conventional file:

> **Class-level**: For `com.example.MyTest`, the default is
> `classpath:com/example/MyTest.sql`
>
> **Method-level**: For `testMethod()` in `com.example.MyTest`, the default is
> `classpath:com/example/MyTest.testMethod.sql`

Convenient, and occasionally baffling: a leftover file matching that name runs on
every test in the class, and nothing in the test source says so. If a fixture appears
that no `@Sql` declares, look for a `.sql` on the classpath named after the class.

### Merging, and the trap in the default

Method-level `@Sql` declarations **override** class-level ones by default, which is a
surprising default the first time it bites: a class-level schema script silently stops
running for any method that declares a `@Sql` of its own. `@SqlMergeMode(MERGE)` at
class level makes both run; `@SqlMergeMode(OVERRIDE)` at method level opts one method
back out.

The `BEFORE_TEST_CLASS` and `AFTER_TEST_CLASS` phases are the exception — they cannot
be overridden and run in addition to method-level scripts, which makes them the right
home for a schema that every method needs.

## What none of this can assert without a real database

State this plainly, because a suite that is scrupulous about everything above can
still be testing the wrong database. `@DataJpaTest`'s javadoc:

> By default, tests annotated with `@DataJpaTest` are transactional and roll back at
> the end of each test. They also use an embedded in-memory database (replacing any
> explicit or usually auto-configured `DataSource`).

Read the second sentence as what it is: **the default silently swaps your database
out.** Against an embedded in-memory engine, the following are untestable no matter
how correct the assertions are — every one of them is behaviour of the real engine:

- **Deferred constraints.** `DEFERRABLE INITIALLY DEFERRED` and the exact commit-time
  point at which the violation is raised.
- **Isolation-level behaviour.** Whether a `REPEATABLE READ` transaction raises a
  serialization failure, and PostgreSQL's `SQLSTATE 40001`.
- **Lock behaviour.** `FOR UPDATE`, `SKIP LOCKED`, `NOWAIT`, deadlock detection and
  the error the loser gets.
- **`statement_timeout`, `lock_timeout`, `idle_in_transaction_session_timeout`** and
  which of them a Spring `timeout` attribute does or does not correspond to.
- **Type and dialect behaviour** — `jsonb`, arrays, `citext`, sequence allocation,
  identity generation, and the exact SQL Hibernate emits for the real dialect.
- **Index and constraint names** in the error, which is what a `DataIntegrityViolationException`
  translation often keys on.

The fix is to run these particular tests against the real engine —
`@AutoConfigureTestDatabase(replace = NONE)` plus a real PostgreSQL 18 — and to accept
that they are slower and fewer. A suite of a hundred in-memory tests and three real
ones is a better trade than a hundred and three tests of an engine you do not deploy.

## Getting the real engine into the test

Two pieces. First, stop the replacement:

```java
@DataJpaTest
@AutoConfigureTestDatabase(replace = Replace.NONE)
class OrderRepositoryRealDbTests { ... }
```

Second, supply a real PostgreSQL. Boot's Testcontainers support wires the container's
address into the auto-configuration for you, so there is no property plumbing:

> A service connection is a connection to any remote service. Spring Boot's
> auto-configuration can consume the details of a service connection and use them to
> establish a connection to a remote service. When doing so, the connection details
> take precedence over any connection-related configuration properties.
>
> When using Testcontainers, connection details can be automatically created for a
> service running in a container by annotating the container field in the test class.

```java
@Testcontainers
@SpringBootTest
class OrderIntegrationTests {

    @Container
    @ServiceConnection
    static PostgreSQLContainer<?> postgres = new PostgreSQLContainer<>("postgres:18");

    // ... the tests from 20f–20i, now against the engine you deploy
}
```

`@ServiceConnection` lives in
`org.springframework.boot.testcontainers.service.connection`, and the container is
managed by Testcontainers' own JUnit extension — "The extension is activated by
applying the `@Testcontainers` annotation… You can then use the `@Container` annotation
on static container fields."

⚠️ **A reused container is shared state, and that interacts with everything above.**
The reference notes that "a single test container instance can, and often is, retained
across execution of tests from multiple test classes", because container beans are
created once per application context and contexts are cached. So anything that
genuinely commits — a `@Commit` test, an `ISOLATED` `@Sql` fixture, a `REQUIRES_NEW`
boundary — is visible to every later test class sharing that container. The rollback
default is what normally hides this; the moment you opt out of it, the blast radius is
the whole suite rather than the class.

## Gotchas

**⚠️ A class-level `@Sql` schema script that stops running**
**Symptom:** "table does not exist" in exactly the methods that declare their own
`@Sql`.
**Cause:** method-level `@Sql` overrides class-level by default.
**Fix:** `@SqlMergeMode(MERGE)` at class level, or move the schema to a
`BEFORE_TEST_CLASS` declaration, which cannot be overridden.

**⚠️ An `INFERRED` fixture for code that reads on another connection**
**Symptom:** the code under test sees an empty table.
**Cause:** the fixture ran inside the test's uncommitted transaction and is invisible
to any other connection — including a `REQUIRES_NEW` boundary in the service.
**Fix:** `@SqlConfig(transactionMode = ISOLATED)`, plus an `AFTER_TEST_METHOD` script
to delete it again.

**⚠️ Trusting an in-memory database for lock, isolation or constraint timing**
**Symptom:** a green suite and a production `40001`, deadlock or deferred-constraint
violation.
**Cause:** `@DataJpaTest` replaces the `DataSource` with an embedded in-memory database
by default; none of that behaviour is the real engine's.
**Fix:** `@AutoConfigureTestDatabase(replace = NONE)` against a real PostgreSQL for
the handful of tests where engine behaviour is the subject.

**⚠️ A stray `.sql` file named after the test class**
**Symptom:** fixture data appears that no annotation in the test declares.
**Cause:** `@Sql` with no `scripts` falls back to `classpath:<package>/<ClassName>.sql`,
or `<ClassName>.<methodName>.sql` at method level.
**Fix:** name fixture scripts something else, or declare them explicitly. When
debugging a phantom fixture, look for the conventional filename first.

**⚠️ Committed data crossing test classes through a shared container**
**Symptom:** a test fails only when the whole suite runs, and only after some other
class ran first.
**Cause:** a container instance is "often… retained across execution of tests from
multiple test classes", so an `ISOLATED` fixture or a `@Commit` test leaves rows behind
for every later class on that container.
**Fix:** delete what you commit, in an `AFTER_TEST_METHOD` script or an
`@AfterTransaction` method — not at the end of the test body.

**⚠️ `@DataJpaTest` plus `@AutoConfigureTestDatabase(replace = NONE)` and no container**
**Symptom:** the test connects to whatever `spring.datasource.url` resolves to —
possibly a developer's real database.
**Cause:** turning off the replacement restores the ordinary auto-configuration; it
does not supply a database.
**Fix:** pair `replace = NONE` with a container, always. The two annotations are one
decision.

## Interview questions

**★ What is the difference between an `INFERRED` and an `ISOLATED` `@Sql` fixture?**
Whether the fixture is committed. `INFERRED` runs the script in whatever transactional
context the listener infers — inside the test's transaction when there is one — so the
fixture is rolled back with the test and needs no cleanup. `ISOLATED` is documented as
executing "in a new, *isolated* transaction that will be immediately committed", so the
data is really there, survives the test, and you must delete it yourself. You need
`ISOLATED` whenever the code under test reads on a different connection — a
`REQUIRES_NEW` boundary, a second datasource, a real second thread — because an
uncommitted fixture is invisible to all of those. The reference's example pairs an
`ISOLATED` creation script with an `ISOLATED` deletion script in the
`AFTER_TEST_METHOD` phase, which is the shape to copy.

**★ A class-level `@Sql` schema script stops running for some tests. Why?**
Because method-level `@Sql` declarations override class-level ones by default, so any
method that declares its own `@Sql` silently loses the class-level schema. Two fixes,
and they differ in scope: `@SqlMergeMode(MERGE)` at class level makes both run for
every method — with `@SqlMergeMode(OVERRIDE)` available on individual methods to opt
back out — or move the schema to a class-level declaration with
`executionPhase = BEFORE_TEST_CLASS`, which cannot be overridden and runs in addition
to method-level scripts. The second is usually better for a schema, because a schema
does not need re-running per method.

**★ Your integration suite is scrupulous about all of this and still misses a
production failure. What class of thing did it miss?**
Anything that is behaviour of the real database engine, if the suite runs against an
embedded one — and `@DataJpaTest` does that by default: it is documented to "use an
embedded in-memory database (replacing any explicit or usually auto-configured
`DataSource`)". That silently removes deferred-constraint timing, real isolation-level
behaviour and the serialization failures it produces, `FOR UPDATE` / `SKIP LOCKED` /
`NOWAIT` semantics, deadlock detection, `statement_timeout` and its relatives, dialect
and type behaviour such as `jsonb` or sequence allocation, and the constraint names an
exception translator keys on. The remedy is not to make every test real: it is
`@AutoConfigureTestDatabase(replace = NONE)` against a real PostgreSQL for the small
number of tests whose subject *is* engine behaviour, and to be honest that the rest are
testing your mapping, not your database.

**★ You have exactly one integration test's worth of budget for a new service method.
What does it assert?**
That the boundary exists and that a failure leaves nothing behind — those two together,
in one non-transactional test. Drive the service the way a controller does, make the
operation fail partway through on a real database, and assert every table it touches is
empty afterwards. That single test catches the self-invocation, the dead annotation,
the missing rollback rule, the swallowed exception and the half-committed cascade —
which is the entire list of silent failures in this topic. The mapping assertions and
the flush discipline matter too, but they belong in cheaper tests; if only one test can
be real, make it the one that only a real transaction can answer.

**★ How do you actually get a real PostgreSQL under an integration test in Boot 4?**
Two annotations doing two different jobs. `@AutoConfigureTestDatabase(replace = NONE)`
stops `@DataJpaTest` swapping the `DataSource` for an embedded one — on its own that
just restores the ordinary auto-configuration, so it points at whatever
`spring.datasource.url` resolves to, which may be a developer's real database.
Testcontainers supplies the engine: a `static` `@Container` field annotated
`@ServiceConnection`, which makes Boot create the connection details for it, and those
details "take precedence over any connection-related configuration properties". Treat
the pair as a single decision — `replace = NONE` without a container is a footgun.

**★ Testcontainers reuses one container across test classes. Why does that matter for
transaction tests specifically?**
Because the rollback default is what normally makes a shared database safe, and every
technique in this chunk group that is worth using opts out of it somewhere. The
documentation is explicit that "a single test container instance can, and often is,
retained across execution of tests from multiple test classes" — container beans are
created once per application context, and contexts are cached. So an `ISOLATED` `@Sql`
fixture, a `@Commit` test or a `REQUIRES_NEW` service boundary leaves committed rows
visible to every later test class on that container. The blast radius of forgetting a
cleanup is the whole suite rather than the class, and the failure surfaces in a file
that has nothing to do with the mistake.

**★ A test class picks up fixture data and there is no `@Sql` naming a script. How?**
Almost certainly the default-detection convention: `@Sql` with no `scripts` attribute
resolves to `classpath:<package>/<ClassName>.sql` at class level, or
`classpath:<package>/<ClassName>.<methodName>.sql` at method level. A file left behind
from an earlier refactor, or one created to match a class that was later renamed, runs
silently. It is a nice convenience when it is deliberate and a genuinely confusing
thirty minutes when it is not — the tell is that the fixture appears for every method
in one class and nowhere else.

---

← Prev: [20i · Committing, and what participates](20i-committing-and-what-participates.md) · Index: [Spring @Transactional](README.md) · Next → [21 · What belongs in a transaction](21-what-belongs-in-a-transaction.md)
