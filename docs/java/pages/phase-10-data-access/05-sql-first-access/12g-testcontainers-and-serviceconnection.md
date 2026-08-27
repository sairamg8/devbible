---
title: "`@ServiceConnection` turns a running container into the `DataSource` the test uses, with no property named anywhere — and Boot's `Replace.NON_TEST` already knows to leave it alone"
sidebar_label: "12g · Testcontainers"
sidebar_position: 30
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 against the Spring Boot 4.1 reference *Testing → Testcontainers*
> ([docs.spring.io/spring-boot/reference/testing/testcontainers.html](https://docs.spring.io/spring-boot/reference/testing/testcontainers.html)),
> the `@ServiceConnection` javadoc — **@since 3.1.0**
> ([.../testcontainers/service/connection/ServiceConnection.html](https://docs.spring.io/spring-boot/api/java/org/springframework/boot/testcontainers/service/connection/ServiceConnection.html)),
> the `AutoConfigureTestDatabase.Replace` javadoc
> ([.../AutoConfigureTestDatabase.Replace.html](https://docs.spring.io/spring-boot/api/java/org/springframework/boot/jdbc/test/autoconfigure/AutoConfigureTestDatabase.Replace.html))
> and the Testcontainers JUnit 5 and JDBC module documentation
> ([junit_5](https://java.testcontainers.org/test_framework_integration/junit_5/),
> [jdbc](https://java.testcontainers.org/modules/databases/jdbc/)).
> JDK 25, Spring Boot 4.1.0, Spring Framework 7.0.8, PostgreSQL 18, Testcontainers 1.x.

**[Chunk 12f](12f-the-real-database.md) argued that the database under a SQL-first
repository test has to be PostgreSQL. This is how you get one, and the modern answer
is one annotation with no arguments. There are three shapes, one of them needs a
mandatory attribute that is easy to miss, and the whole thing has exactly one real
cost — Docker has to exist wherever the suite runs.**

## The modern shape: `@ServiceConnection`

Boot's Testcontainers support means there is no property plumbing at all. The
reference:

> "A service connection is a connection to any remote service. Spring Boot's
> auto-configuration can consume the details of a service connection and use them to
> establish a connection to a remote service. When doing so, **the connection details
> take precedence over any connection-related configuration properties.**"

and, for containers:

> "connection details can be automatically created for a service running in a
> container by annotating the container field in the test class."

```java
@Testcontainers
@JdbcTest
@ImportAutoConfiguration(FlywayAutoConfiguration.class)
@Import(OrderQueries.class)
class OrderQueriesRealDbTests {

    @Container
    @ServiceConnection
    static PostgreSQLContainer<?> postgres = new PostgreSQLContainer<>("postgres:18-alpine");

    @Autowired OrderQueries queries;
    @Autowired JdbcClient db;

    // … the tests, now against PostgreSQL 18
}
```

Three annotations are doing three separate jobs and it is worth keeping them apart.
`@Testcontainers` is Testcontainers' own JUnit 5 extension, which "finds all fields
that are annotated with `@Container` and calls their container lifecycle methods".
`@Container` marks the field. `@ServiceConnection` is Boot's, and it is what turns the
running container into a `JdbcConnectionDetails` bean — the reference says service
connection annotations "are processed by `ContainerConnectionDetailsFactory` classes
registered with `spring.factories`", and that by default "all applicable connection
details beans will be created for a given `Container`".

Note that `@AutoConfigureTestDatabase(replace = NONE)` is **absent**, and deliberately
so: `Replace.NON_TEST` already recognises a `@ServiceConnection` container as a test
database ([chunk 12e](12e-wiring-the-test.md)).

### What `@ServiceConnection` replaces

`@DynamicPropertySource`, which the reference describes as "a slightly more verbose
but also more flexible alternative to service connections":

```java
@DynamicPropertySource
static void datasourceProperties(DynamicPropertyRegistry registry) {
    registry.add("spring.datasource.url", postgres::getJdbcUrl);
    registry.add("spring.datasource.username", postgres::getUsername);
    registry.add("spring.datasource.password", postgres::getPassword);
}
```

Three lines that name three properties, versus one annotation that names none. The
flexibility the reference mentions is real — `@DynamicPropertySource` can set any
property from any source, including ones no `ConnectionDetails` type covers — so it
remains the tool when you need a property that is not part of a connection. For a
plain database it is the older, wordier way to say the same thing.

## The other two shapes

**A container as a `@Bean`,** which is how you share one across many test classes
through a `@TestConfiguration`:

```java
@TestConfiguration(proxyBeanMethods = false)
class ContainerConfig {

    @Bean
    @ServiceConnection("postgres")
    PostgreSQLContainer<?> postgres() {
        return new PostgreSQLContainer<>("postgres:18-alpine");
    }
}
```

🔴 The `value`/`name` attribute is **mandatory here**, and the javadoc says why:
"`Container` instances are *not* available early enough when the container is defined
as a `@Bean` method. All `@ServiceConnection` `@Bean` methods that need to match on
the connection name *must* declare this attribute." Omit it on a field and the
repository part of the image name is used; omit it on a `@Bean` and the matching has
nothing to work from.

**No Java at all** — the Testcontainers JDBC URL scheme,
`jdbc:tc:<database>:<version>:///<databasename>`:

```properties
spring.datasource.url=jdbc:tc:postgresql:18-alpine:///orders
```

Testcontainers' driver starts the container when the first connection is opened. It
also accepts `?TC_INITSCRIPT=schema/orders.sql` to run a classpath script on startup,
`?TC_INITFUNCTION=com.example.Init::run` to call a static method taking a
`Connection`, and `?TC_DAEMON=true` to keep the container alive after connections
close. And `Replace.NON_TEST` recognises this form too, so it survives a slice
untouched. It is the smallest possible setup and the least controllable one; use it
for a spike, not for a suite where you care when containers start and stop.

## Migrations belong in the container's life, not the test's

Once the database is real, the schema should come from the real migrations —
`@ImportAutoConfiguration(FlywayAutoConfiguration.class)` in a slice, or nothing at
all in a `@SpringBootTest` where Flyway auto-configures normally. See
[Flyway and schema migrations](../11-flyway-migrations/README.md).

The reason to prefer this over `TC_INITSCRIPT` or a `@Sql` schema is not tidiness. A
migration that fails — a `not null` added to a column with nulls, a constraint the
existing data violates — fails in the test run, before it fails in a deployment. The
migrations become the thing under test alongside the queries, which is exactly right,
because a repository is a contract between the two.


## Gotchas

**A static `@Container` starts once per class; an instance field starts once per
method.** Testcontainers' documentation is explicit: static fields "will be started
only once before any test method is executed and stopped after the last test method
has executed", instance fields "will be started and stopped for every test method".
An instance field turns a two-second suite into a two-minute one and it looks
identical in review.

**Spring caches contexts, so the container often outlives the class anyway.** A second
test class with identical configuration reuses the context — and therefore the same
`ConnectionDetails` and the same container. Anything a test committed is visible to
it. That is the price of the speed, and it is why the rollback default matters more
once the database is shared ([chunk 12e](12e-wiring-the-test.md)).

**The JUnit 5 extension is documented as untested under parallel execution.** "This
extension has only been tested with sequential test execution. Using it with parallel
test execution is unsupported and may have unintended side effects." A suite that
enables JUnit's parallel execution and container-based database tests together is
outside what the tool claims to support.

**No Docker means no tests, including on the machine of whoever is on call at 3am.**
A container-based repository suite needs a container runtime everywhere it runs: CI
agents, a colleague's laptop, a release pipeline. That is a genuine cost, and the
honest answer to it is not to make the tests weaker but to make them fewer — a small
number of real tests over the queries that use PostgreSQL, plus fast tests elsewhere.

**Pinning the image tag is not optional.** `postgres:18-alpine` moves;
`postgres:latest` moves faster. A repository test suite is a place where the database
version is part of the subject under test, so the tag belongs in one constant, matched
to the version you deploy, and changed deliberately.

**`@ServiceConnection` on a `@Bean` without a name silently fails to match.** The
javadoc's warning is easy to skim past, and the failure is not an exception at the
annotation — it is the auto-configuration falling back to properties, so the test
connects to whatever `spring.datasource.url` says, or to a replaced embedded database,
while the container sits there unused and the tests pass against the wrong engine.

**Connection details beat properties, which is convenient until it is confusing.**
"The connection details take precedence over any connection-related configuration
properties" — so a `spring.datasource.url` in `application-test.yml` is silently
ignored when a `@ServiceConnection` is present. Debugging "why is it not using my URL"
ends here, and the precedence is deliberate rather than a bug.

**A fresh container is a database with a superuser and none of your roles.** Anything
your production schema relies on — a restricted application role, row-level security,
default privileges, a `search_path` set on the role — is not reproduced unless a
migration creates it. A query that works in the test because the test user can see
every row is a real failure mode for row-level security in particular.

**The `TC_INITSCRIPT` route quietly bypasses your migration tool.** It is genuinely
convenient for a spike, and it creates a second schema definition, which is the drift
problem from [chunk 12d](12d-the-jdbctest-slice.md) with a different filename.

**Adding `@AutoConfigureTestDatabase(replace = NONE)` alongside `@ServiceConnection` is
harmless and misleading.** It does nothing on Boot 4 — the default already leaves a
container-backed `DataSource` alone — but it tells every future reader that something
about this test needed the escape hatch. Delete it when you find it, and understand
why it was there before you do.

**A container that fails to start produces a failure that names the container, not
your test.** Image pull failures, a Docker daemon that is not running, a port
exhaustion on a busy CI agent: all of these surface as Testcontainers exceptions
during context initialisation, before any test method runs, so the whole class errors
at once. Reading the *first* line of that stack rather than the last is what saves the
time.

**Reuse is a real feature and a real footgun.** Testcontainers can keep a container
alive between JVM runs when reuse is enabled, which makes a local edit-test loop much
faster and means the database is no longer fresh. Data from an earlier run — and an
earlier schema — is still there. It belongs in a developer's local configuration, not
in the repository's committed defaults.

## Interview questions

**★ What does `@ServiceConnection` do, and what does it replace?**
It turns a Testcontainers container into a `ConnectionDetails` bean that Boot's
auto-configuration consumes — for a `PostgreSQLContainer`, a `JdbcConnectionDetails`
carrying the URL, username and password that container ended up with. The reference
says those details "take precedence over any connection-related configuration
properties", so nothing in `application.yml` needs to change. What it replaces is
`@DynamicPropertySource`, where you wrote three `registry.add` calls naming
`spring.datasource.url`, `.username` and `.password` yourself. The docs describe that
as "a slightly more verbose but also more flexible alternative", and the flexibility is
the reason to keep it around: it can set any property, not only ones a
`ConnectionDetails` type models.

**★ Static or instance `@Container` field?**
Static, essentially always. Testcontainers' own documentation says a static container
is "started only once before any test method is executed and stopped after the last
test method has executed", whereas an instance field is "started and stopped for every
test method" — which for PostgreSQL is several seconds per test. The consequence of
static is shared state across the methods in that class, and because Spring caches
contexts, usually across classes too; the rollback default is what makes that safe,
and any test that opts out of rollback has to clean up after itself.

**★ Why must a `@ServiceConnection` `@Bean` method declare a name?**
Because the matching is done by name and the container is not available when the
matching happens. The javadoc says it directly: "`Container` instances are *not*
available early enough when the container is defined as a `@Bean` method. All
`@ServiceConnection` `@Bean` methods that need to match on the connection name *must*
declare this attribute." On a field the annotation can fall back to the repository part
of the Docker image name, because the field's value is there to inspect. On a `@Bean`
method there is nothing to inspect yet, so an unnamed one matches nothing and the
context quietly uses whatever the properties say instead.

**★ How does the schema get into the container?**
By running the real migrations. In a `@SpringBootTest` that happens automatically; in
a `@JdbcTest` on Boot 4 it needs
`@ImportAutoConfiguration(FlywayAutoConfiguration.class)`, because the slice no longer
includes Flyway. I prefer that to `TC_INITSCRIPT` or a `@Sql` schema for two reasons:
the schema under test is then guaranteed to be the one you deploy, and a migration
that cannot apply — a `not null` on a column with nulls, a constraint the seed data
violates — fails in the test run instead of in a deployment.

**★ What is the cost of container-based tests, and how do you keep it manageable?**
Docker has to exist everywhere the suite runs, and containers take seconds to start.
The way to keep it manageable is not to make the tests weaker but to be deliberate
about how many need a database at all: a small set of repository tests over the
queries that actually use PostgreSQL features, sharing one static container and one
cached context, plus ordinary fast tests for everything above the repository. And I
would pin the image tag to the version deployed, because with this style the database
version is part of what is being tested.

**★ Is there a setup with no Java at all?**
Yes — the Testcontainers JDBC URL scheme. Setting
`spring.datasource.url=jdbc:tc:postgresql:18-alpine:///orders` makes Testcontainers'
own driver start the container on the first connection, and the URL takes parameters:
`TC_INITSCRIPT` for a classpath script, `TC_INITFUNCTION` for a static method taking a
`Connection`, `TC_DAEMON=true` to keep it running. Boot's `Replace.NON_TEST` recognises
that URL form as a test database, so it survives a test slice untouched. It is the
smallest possible setup, and I would use it for a spike rather than a suite, because
you give up control over when containers start, stop and are shared.

---

← Prev: [12f · The real database](12f-the-real-database.md) · Index: [05 · SQL-first access](README.md) · Next → [12h · What to assert](12h-what-to-assert.md)
