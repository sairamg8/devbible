---
title: "Spring Boot 4.1 now tells you, in the reference documentation, to stop declaring containers with @Container for Spring tests — because the extension's Store closes at the end of the test class and the TestContext cache does not, and the page still shows you the @Container sample anyway"
sidebar_label: "03d · The lifecycle argument"
sidebar_position: 16
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-31 against the **Spring Boot 4.1.0** reference at tag `v4.1.0` —
> [`testing/testcontainers.adoc`](https://github.com/spring-projects/spring-boot/blob/v4.1.0/documentation/spring-boot-docs/src/docs/antora/modules/reference/pages/testing/testcontainers.adoc)
> ("Using the JUnit Extension") and its `include-code` sample
> [`junitextension/MyIntegrationTests.java`](https://github.com/spring-projects/spring-boot/blob/v4.1.0/documentation/spring-boot-docs/src/main/java/org/springframework/boot/docs/testing/testcontainers/junitextension/MyIntegrationTests.java);
> the **Spring Framework 7.0.8** reference
> [`dynamic-property-sources.adoc`](https://github.com/spring-projects/spring-framework/blob/v7.0.8/framework-docs/modules/ROOT/pages/testing/testcontext-framework/ctx-management/dynamic-property-sources.adoc);
> the **JUnit 6.0.3 user guide**
> ([Registering Extensions](https://docs.junit.org/6.0.3/extensions/registering-extensions.html),
> [Relative Execution Order](https://docs.junit.org/6.0.3/extensions/relative-execution-order-of-user-code-and-extensions.html));
> and the **Testcontainers 2.0.5** `TestcontainersExtension` source at
> [tag `2.0.5`](https://github.com/testcontainers/testcontainers-java/tree/2.0.5).
> Version spine: JDK 25, Spring Boot 4.1.0, **Testcontainers 2.0.5**, JUnit Jupiter 6.0.3.
> ⚠️ **No Docker and no sandbox on this machine.** Nothing here is a container log, a timing or a
> test run — only source that was read and documentation that was quoted.

**[03c](03c-the-store-and-the-messages.md) established the mechanism: the extension registers each
container in a JUnit `Store` and JUnit closes that store when the extension context ends. This chunk
is the consequence Spring Boot decided was serious enough to write into the reference manual — and
the honest counterweight, which is that the problem exists only because Spring caches contexts, so
for a test with no Spring context the extension is still exactly the right tool. The two attributes
on `@Testcontainers`, and the `@Nested` limitation, are
[03e](03e-the-switches-and-the-limits.md) and [03f](03f-parallelism-and-nested.md).**

## 🔴 What Boot 4.1 actually says

Boot's "Using the JUnit Extension" section shows the familiar sample and then, in the same section,
argues against it:

> *"When using the JUnit extension, container instances are stopped after the test class has run
> (for static fields) or after each test method (for non-static fields). This can cause issues when
> used with Spring Boot tests, as Spring's TestContext Framework may cache the `ApplicationContext`
> beyond that point and reuse it for another test class or method with the same configuration. If
> the cached application context contains beans that depend on a container that has already been
> stopped, later tests or bean destruction callbacks may fail. **For this reason, you should prefer
> managing containers as Spring beans or importing container declarations when the application
> context should remain usable for as long as it is cached.**"*

This is not a blog opinion or a community convention. It is the reference documentation for the
framework you are using, and it reverses the advice in essentially all Boot 3.1-era material, which
presented the `@Container` static field as *the* idiom.

Note also what the same section says about the field modifier — it does not present static and
instance as equal options at all:

> *"You can then use the `@Container` annotation on **static** container fields."*

## The concrete failure, step by step

Two test classes with identical configuration, therefore one context cache key:

```java
@Testcontainers
@SpringBootTest
class OrderRepositoryTests {

    @Container
    @ServiceConnection
    static PostgreSQLContainer postgres = new PostgreSQLContainer("postgres:18-alpine");

    @Test void findsOrders() { /* ... */ }
}

@SpringBootTest          // same configuration -> same context cache key
class InvoiceRepositoryTests {

    @Test void findsInvoices() { /* ... */ }
}
```

1. `OrderRepositoryTests` runs. The extension's `beforeAll` starts the container and registers it in
   the class-level `Store`. `@ServiceConnection` contributes a `JdbcConnectionDetails` built from the
   container's host and *randomly mapped* port, and the context is created with a `DataSource`
   holding that URL.
2. The class finishes. JUnit closes the class-level store, `StoreAdapter.close()` calls
   `container.stop()`, and `GenericContainer.stop()` removes the container and nulls `containerId`.
3. The `ApplicationContext` is **not** closed — the TestContext framework caches it.
4. `InvoiceRepositoryTests` produces the same cache key and gets that cached context back, complete
   with a connection pool aimed at a host port that nothing is listening on any more.

The failure surfaces as a connection error from the pool, or at JVM shutdown when the pool's
destruction callback tries to talk to a database that is gone — Boot's words are that *"later tests
or bean destruction callbacks may fail."* Nothing in the message mentions Testcontainers, JUnit or
the store, which is why this one costs an afternoon rather than a minute.

⚠️ **The `@Container` field being `static` is what makes this *survivable* rather than certain.** With
a static field the container at least lasts a whole class. With a non-static field it is stopped
after every method, while the cached context lives on — the same defect at one order of magnitude
worse.

### What to do instead — and this topic already covers it

Declare the container as a Spring bean, or import a container declaration, so one owner controls
both lifetimes. That is written up in full, with Boot's ordering guarantees quoted, in
**[04b5 · Containers as Spring beans](04b5-containers-as-beans.md)**, and the import route is
[04b6 · Importing, and dev time](04b6-importing-and-development-time.md). This page does not repeat
them; the point here is *why* the extension gets you into the situation, which is the store.

## Where the extension is still exactly right

The whole problem is "a cached `ApplicationContext` outlives the container". **A test with no
`ApplicationContext` has nothing that can outlive anything**, and for those the extension is the
simplest correct tool in the box — smaller than a `@TestConfiguration`, with no context to key, no
cache to reason about and no bean ordering to get wrong.

Three shapes where that is true:

```java
// 1 · A plain JDBC test — the SQL is the subject, Spring is not involved.
@Testcontainers
class OrderQuerySqlTests {

    @Container
    static PostgreSQLContainer postgres = new PostgreSQLContainer("postgres:18-alpine");

    @Test
    void windowFunctionRanksByTotal() throws Exception {
        try (Connection c = DriverManager.getConnection(
                postgres.getJdbcUrl(), postgres.getUsername(), postgres.getPassword())) {
            // exercise the statement directly
        }
    }
}
```

```java
// 2 · A migration tool driven directly — no context, and the point is a virgin database.
@Testcontainers
class MigrationTests {

    @Container
    PostgreSQLContainer postgres = new PostgreSQLContainer("postgres:18-alpine");  // per method, deliberately

    @Test
    void migratesFromEmpty() {
        Flyway.configure()
              .dataSource(postgres.getJdbcUrl(), postgres.getUsername(), postgres.getPassword())
              .load()
              .migrate();
    }
}
```

```java
// 3 · A client-library test — you are testing your wrapper around a driver, not your application.
@Testcontainers
class RedisClientAdapterTests {

    @Container
    static GenericContainer<?> redis =
        new GenericContainer<>("redis:7-alpine").withExposedPorts(6379);
}
```

Example 2 is also the one honest use of a non-static field: the subject *is* the empty database, so
paying for a container per method is buying exactly what the test asserts. Migration testing beyond
this is [11 · Testing migrations](../../phase-10-data-access/11-flyway-migrations/11-testing-migrations.md).

**The rule that falls out of this**: if the test class carries `@SpringBootTest`, `@DataJpaTest`,
`@SpringJUnitConfig` or any other context-loading annotation, prefer beans. If it carries none of
them, use `@Container` and stop thinking about it.

## Gotchas

**★ Boot 4.1 recommending against `@Container` is documentation, not opinion — and it is easy to miss.**
The recommendation sits in the same section that shows the `@Container` sample, two paragraphs below
it. Skimming the section and copying the code gets you exactly the arrangement the prose warns
about.

**★ The failure is delayed and lands in a different test class than the one that caused it.**
`OrderRepositoryTests` stops the container; `InvoiceRepositoryTests` fails. The stack trace names a
connection pool, not a container, not the extension and not the class that owned the field. If a
suite passes when classes are run individually and fails when run together, this is the first thing
to check.

**★ It can fail at JVM shutdown instead of in a test.**
The cached context's beans are destroyed when the cache is finally cleared. A `DataSource`'s
destruction callback closes a pool, which talks to the database. Boot's wording covers this
explicitly: *"later tests or bean destruction callbacks may fail."* A build that reports all tests
green and then fails is this.

**★ The port is what actually breaks, not the container name.**
Testcontainers publishes to a random host port. Restarting the container gives a different one, so
even if something else came up on the same image, the cached `DataSource` still points at a dead
port. This is also why "just restart it in `@BeforeEach`" is not a fix.

**★ A non-static `@Container` plus `@SpringBootTest` is the worst combination available.**
The container is stopped after every test method while the context is cached across classes. If you
must use the extension with Spring, at least keep the field `static` — Boot's own sample and prose
only ever show the static form.

**★ Do not read "prefer beans" as "the extension is deprecated".**
Nothing about the extension is deprecated, and for a test with no `ApplicationContext` the bean route
is strictly more machinery for no benefit. The recommendation is conditional and Boot states the
condition: *"when the application context should remain usable for as long as it is cached."*

**★ A `@DynamicPropertySource` in a base class can silently share stale values between subclasses.**
Spring's own reference warns about it: *"If you use `@DynamicPropertySource` in a base class and
discover that tests in subclasses fail because the dynamic properties change between subclasses, you
may need to annotate your base class with `@DirtiesContext`"*. With a `@Container` static field on
that base class, the container is restarted per subclass ([03c](03c-the-store-and-the-messages.md))
while the cached context keeps the first subclass's port — the same defect arriving by a second
route.

## Interview questions

**★ Spring Boot 4.1 tells you to prefer container `@Bean` methods over `@Container` static fields. Why?**
Because two components each believe they own when the container stops and they disagree by the
lifetime of the context cache. The JUnit extension registers the container in the class-level
`Store`, which JUnit closes when the test class ends. Spring's TestContext framework caches the
`ApplicationContext` beyond that and hands it to the next class with the same configuration — so the
next class inherits a `DataSource` aimed at a container that has been removed. Boot's own words are
that *"later tests or bean destruction callbacks may fail"*. Declaring the container as a Spring bean
gives both jobs to a single owner.

**★ Walk me through how that failure actually presents.**
Class A runs, starts a container, builds a context, finishes. JUnit closes A's store and the
container is removed. The context is cached, not closed. Class B has the same cache key, gets the
cached context, and its first query hits a connection pool pointed at a host port nothing is
listening on. Alternatively nothing fails until the cache is cleared and the pool's destruction
callback runs. Neither symptom mentions Testcontainers. The diagnostic signature is: passes when the
classes are run individually, fails when run together.

**★ Does that mean the JUnit extension is obsolete?**
No, and the recommendation is explicitly conditional — *"when the application context should remain
usable for as long as it is cached"*. The entire problem is a cached `ApplicationContext` outliving
the container. A test with no `ApplicationContext` has nothing to outlive: a plain JDBC test, a
Flyway migration driven directly, a test of your wrapper around a client library. For those the
extension is smaller and simpler than a `@TestConfiguration`, and there is no context key to reason
about.

**★ When is a non-static `@Container` genuinely the right choice?**
When the subject of the test is startup itself — a migration that must run against a virgin
database, a bootstrap path that executes once per process, the initial state of a broker. In those
cases the per-method container start is not overhead, it is the fixture. Everywhere else the cost is
paid for isolation you could have had from a rolled-back transaction.

**★ If you must use `@Container` with `@SpringBootTest`, what makes it least bad?**
Keep the field `static` so the container lasts a whole class rather than a method; keep the number of
distinct context configurations low so the cache does not hand a stale context to a class that starts
its own container; and consider `@DirtiesContext` on the class so the context is closed rather than
cached — accepting that this trades a correctness bug for a slow suite. The actual fix is to move the
container into the context as a bean.

**★ Your suite passes class by class in the IDE and fails in CI when everything runs together. Where do you look first?**
At anything whose lifetime is shorter than the context cache — a `@Container` static field being the
canonical example. Second at shared mutable state in a container that is now reused across classes.
Both are symptoms of the same thing: the context cache makes the unit of isolation the cache key, not
the test class, and every fixture whose lifetime is the test class is now mismatched.

{/* FOOTER */}
