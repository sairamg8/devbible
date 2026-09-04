---
title: "on Boot 4 the annotation everybody adds to get a real database under a test is not only unnecessary, it removes the check that would have caught a missing container"
sidebar_label: "20k · Getting the real engine in"
sidebar_position: 63
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 against the `AutoConfigureTestDatabase` javadoc and its `Replace`
> enum
> ([.../boot/jdbc/test/autoconfigure/AutoConfigureTestDatabase.Replace.html](https://docs.spring.io/spring-boot/api/java/org/springframework/boot/jdbc/test/autoconfigure/AutoConfigureTestDatabase.Replace.html)),
> the Spring Boot generated *Test Auto-configuration Classes* appendix
> ([docs.spring.io/spring-boot/appendix/test-auto-configuration/slices.html](https://docs.spring.io/spring-boot/appendix/test-auto-configuration/slices.html))
> and the Spring Boot reference *Testing → Testcontainers* and *Service Connections*
> sections. JDK 25, Spring Framework 7.0.9, Spring Boot 4.1, PostgreSQL 18.

**[20j](20j-the-fixture-and-the-real-database.md) argued that an in-memory database
removes the engine behaviour a transaction test exists to check. Getting the real engine
back is two pieces — and on Boot 4 one of them is already done for you, which most
advice on the subject has not caught up with.**

## Getting the real engine into the test

The first piece is that Boot must not swap your `DataSource` for an embedded one. On
Boot 4 it already will not, provided the database is one it recognises as a test
database. `@AutoConfigureTestDatabase`'s `replace` attribute defaults to
`Replace.NON_TEST`, documented as replacing the bean *"unless it is auto-configured and
connecting to a test database"*, and the javadoc lists exactly what counts:

- any bean definition carrying `ContainerImageMetadata` — which includes
  `@ServiceConnection`-annotated Testcontainers databases and connections created by
  Docker Compose;
- any connection whose `spring.datasource.url` is backed by `@DynamicPropertySource`;
- any connection whose `spring.datasource.url` uses the Testcontainers JDBC syntax.

So with a `@ServiceConnection` container in the class, the annotation need not appear at
all:

```java
@DataJpaTest
class OrderRepositoryRealDbTests { ... }   // the container below is not replaced
```

⛔ **`@AutoConfigureTestDatabase(replace = NONE)` is not a safer spelling of that**, and
it is what almost every example online still adds. `NONE` means *"don't replace the
application default `DataSource`"* — unconditionally, with no test-database check. On
the day the container is missing, misconfigured, or the annotation is dropped in a
refactor, `NONE` cheerfully connects the test to whatever `spring.datasource.url`
resolves to, which in a developer's environment is often a real database. The default
would have swapped in an embedded one and failed the test honestly instead.

The second piece is supplying the engine. Boot's Testcontainers support wires the
container's address into the auto-configuration, so there is no property plumbing:

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

## What the container does not give you

A container is an engine, not a database. It starts empty, and the slice around it
decides whether anything creates a schema. On Boot 4.1 the `@JdbcTest` slice imports
`DataSourceAutoConfiguration`, the transaction manager, `JdbcTemplate`, `JdbcClient`,
`TestDatabaseAutoConfiguration` and the optional `ServiceConnectionAutoConfiguration` —
and neither Flyway nor Liquibase nor `SqlInitializationAutoConfiguration`. A test that
used to find its tables will report that the relation does not exist.

⚠️ The honest version of this claim: the appendix is generated per release and is the
authority for the version you are on. Read it for your own Boot version rather than
trusting any list, this one included.

## A reused container is shared state

The reference notes that "a single test container instance can, and often is, retained
across execution of tests from multiple test classes", because container beans are
created once per application context and contexts are cached. So anything that
genuinely commits — a `@Commit` test, an `ISOLATED` `@Sql` fixture, a `REQUIRES_NEW`
boundary — is visible to every later test class sharing that container. The rollback
default is what normally hides this; the moment you opt out of it, the blast radius is
the whole suite rather than the class.

## Gotchas

**⚠️ Committed data crossing test classes through a shared container**
**Symptom:** a test fails only when the whole suite runs, and only after some other
class ran first.
**Cause:** a container instance is "often… retained across execution of tests from
multiple test classes", so an `ISOLATED` fixture or a `@Commit` test leaves rows behind
for every later class on that container.
**Fix:** delete what you commit, in an `AFTER_TEST_METHOD` script or an
`@AfterTransaction` method — not at the end of the test body.

**⚠️ Reaching for `replace = NONE` because every tutorial says to**
**Symptom:** nothing, most days. Then one day the container is not there and the test
connects to whatever `spring.datasource.url` resolves to — possibly a developer's real
database.
**Cause:** `NONE` is documented as *"Don't replace the application default
`DataSource`"* — unconditionally. It does not supply a database, and it switches off
the very check that would have caught the container's absence.
**Fix:** on Boot 4, say nothing about `replace` at all. The `NON_TEST` default already
leaves a `@ServiceConnection` container alone, and still swaps in an embedded database
when no test database is present.

**⚠️ A non-`static` container field**
**Symptom:** a fresh container per test method, and a suite that takes minutes.
**Cause:** Testcontainers' JUnit extension ties an instance field's lifecycle to the
method and a static field's to the class.
**Fix:** `static`, always, for a shared engine. The reference's own example is static.

**⚠️ `@Container` with no `@Testcontainers`**
**Symptom:** the container is never started, and the test fails to connect.
**Cause:** `@Container` is inert on its own — "the extension is activated by applying
the `@Testcontainers` annotation".
**Fix:** both annotations, together. This is a pair, not a preference.

**⚠️ Expecting the slice to build the schema**
**Symptom:** "relation does not exist" against a container that is plainly running.
**Cause:** the Boot 4.1 `@JdbcTest` slice imports neither Flyway nor Liquibase nor
`SqlInitializationAutoConfiguration` — nothing in it creates a schema. A container
starts empty.
**Fix:** run migrations yourself, or use a slice that imports them, or an `@Sql`
schema script in the `BEFORE_TEST_CLASS` phase. ⚠️ Check the generated
auto-configuration appendix for **your** Boot version rather than trusting a tutorial:
the import list is version-specific and changed between 3.5 and 4.1.

**⚠️ Assuming `NON_TEST` recognises your container**
**Symptom:** an embedded database appears under a test that clearly starts a container.
**Cause:** `NON_TEST` recognises three specific things as a test database — a bean
definition carrying `ContainerImageMetadata` (which `@ServiceConnection` and Docker
Compose produce), a `spring.datasource.url` backed by `@DynamicPropertySource`, and a
`spring.datasource.url` in the Testcontainers JDBC syntax. A container wired up any
other way is not on that list.
**Fix:** use one of the three. Hand-plumbed properties are the case where you genuinely
do need to say `replace = NONE`.

## Interview questions

**★ How do you actually get a real PostgreSQL under an integration test in Boot 4?**
A `static` container field annotated `@Container` and `@ServiceConnection`, with
`@Testcontainers` on the class — and, on Boot 4, nothing else. `@ServiceConnection`
makes Boot derive the connection details from the running container, and those details
"take precedence over any connection-related configuration properties", so there is no
property plumbing. The part that has changed is the annotation everyone adds next:
`@AutoConfigureTestDatabase(replace = NONE)` is no longer needed, because `replace`
already defaults to `NON_TEST`, which is documented to replace the `DataSource` *unless*
it is "connecting to a test database" — and a `@ServiceConnection` Testcontainers
database is explicitly one of those. Adding `NONE` does not make it safer; it makes it
less safe, because `NONE` also stops the fallback that would otherwise catch a missing
container.

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

**★ When would you still write `replace = Replace.NONE` on Boot 4?**
When the real database is not one of the three shapes `NON_TEST` recognises — most
commonly a connection configured by hand through ordinary properties, or one supplied
by infrastructure the test does not start. There `NON_TEST` sees an ordinary
auto-configured `DataSource`, decides it is not a test database, and replaces it, which
is exactly what you do not want. `NONE` is the right answer to that narrow question. It
is the wrong answer to "how do I use Testcontainers", which is what it is usually
reaching for.

**★ What is the difference between `ANY` and `AUTO_CONFIGURED`?**
Whether a hand-defined bean is protected. `AUTO_CONFIGURED` is documented as "only
replace the `DataSource` if it was auto-configured", so a `DataSource` you declared in a
`@TestConfiguration` survives. `ANY` replaces it "whether it was auto-configured or
manually defined" — which is occasionally what you want when a shared test
configuration defines one you would rather ignore, and is otherwise a good way to be
confused about why your own bean is not being used.

**★ Why does the choice of slice matter more than usual once a container is involved?**
Because the slice decides what else is auto-configured around the connection, and the
container only supplies the connection. A slice that does not import migration support
gives you a real engine with no schema, which fails in a way that looks like a
connection problem and is not. The general habit worth having: when a test behaves
unexpectedly, read the generated auto-configuration appendix for your Boot version and
find out what the slice actually imports, rather than reasoning from what it imported
in the version the tutorial was written against.

**★ Two test classes both start a PostgreSQL container. How many containers run?**
It depends on whether they share an application context, not on how many classes there
are. Container beans are created once per context and contexts are cached, so classes
whose context configuration matches share one container — which is why the reference
warns that an instance "can, and often is, retained across execution of tests from
multiple test classes". Anything that changes the cache key — a different property, a
different set of overridden beans, `@DirtiesContext` — gives you a second context and a
second container, along with the startup cost. This is the same cache that makes a
carelessly-placed mock double a suite's runtime.

---

← Prev: [20j · The fixture and the real database](20j-the-fixture-and-the-real-database.md) · Index: [04 · Spring @Transactional](README.md) · Next → [21 · What belongs in a transaction](21-what-belongs-in-a-transaction.md)
