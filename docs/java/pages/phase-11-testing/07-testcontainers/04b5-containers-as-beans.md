---
title: "Boot 4.1 now tells you to stop declaring containers with the JUnit extension and declare them as Spring beans instead, because the extension stops a container when the test class ends while the TestContext framework keeps the cached context — and those two lifetimes disagree by exactly the length of the cache"
sidebar_label: "04b5 · Containers as Spring beans"
sidebar_position: 24
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-31 against the **Spring Boot 4.1.0** reference at tag `v4.1.0` —
> [`testing/testcontainers.adoc`](https://github.com/spring-projects/spring-boot/blob/v4.1.0/documentation/spring-boot-docs/src/docs/antora/modules/reference/pages/testing/testcontainers.adoc)
> ("Using Spring Beans", "Using the JUnit Extension", "Lifecycle of Managed Containers") and
> [`features/dev-services.adoc`](https://github.com/spring-projects/spring-boot/blob/v4.1.0/documentation/spring-boot-docs/src/docs/antora/modules/reference/pages/features/dev-services.adoc)
> ("Using Testcontainers at Development Time"), with all Java shown taken from those pages'
> `include-code` samples; plus the
> [`TestcontainersStartup`](https://github.com/spring-projects/spring-boot/blob/v4.1.0/core/spring-boot-testcontainers/src/main/java/org/springframework/boot/testcontainers/lifecycle/TestcontainersStartup.java)
> and [`ImportTestcontainers`](https://github.com/spring-projects/spring-boot/blob/v4.1.0/core/spring-boot-testcontainers/src/main/java/org/springframework/boot/testcontainers/context/ImportTestcontainers.java)
> sources at the same tag.
> Version spine: JDK 25, Spring Boot 4.1.0, **Testcontainers 2.0.5**, JUnit Jupiter 6.0.3.
> ⚠️ **No Docker and no sandbox on this machine.** Nothing here is a container log, a timing or a
> test run.

**Everything up to here put `@ServiceConnection` on a `static` field next to `@Container`. Boot 4.1
documents a reason not to do that, and it is not a style preference — it is a correctness argument
about two lifecycles that disagree. This chunk is that argument and the bean-based alternative;
[04b6](04b6-importing-and-development-time.md) is what that alternative unlocks.**

## The two ways to declare a container, and why Boot now prefers one

```java
// (a) Testcontainers owns the lifecycle
@Testcontainers
@SpringBootTest
class MyIntegrationTests {

    @Container
    @ServiceConnection
    static Neo4jContainer neo4j = new Neo4jContainer("neo4j:5");
}
```

```java
// (b) Spring owns the lifecycle
@TestConfiguration(proxyBeanMethods = false)
class MyTestConfiguration {

    @Bean
    @ServiceConnection
    Neo4jContainer neo4jContainer() {
        return new Neo4jContainer("neo4j:5");
    }
}

@SpringBootTest
@Import(MyTestConfiguration.class)
class MyIntegrationTests {

    @Autowired
    private Neo4jContainer neo4j;
}
```

Form (a) is what every tutorial shows. Boot 4.1's own paragraph on it is a warning:

> *"When using the JUnit extension, container instances are stopped after the test class has run
> (for static fields) or after each test method (for non-static fields). This can cause issues when
> used with Spring Boot tests, as Spring's TestContext Framework may cache the `ApplicationContext`
> beyond that point and reuse it for another test class or method with the same configuration. If
> the cached application context contains beans that depend on a container that has already been
> stopped, later tests or bean destruction callbacks may fail. **For this reason, you should prefer
> managing containers as Spring beans or importing container declarations when the application
> context should remain usable for as long as it is cached.**"*

That is the whole problem in one paragraph: **two components each believe they own when the
container stops, and they disagree by exactly the lifetime of the context cache.** JUnit's
extension stops the container when the test class finishes. The TestContext framework keeps the
context — and the `DataSource` pointing at that container — for the next class with the same
configuration. The next class inherits a live connection pool aimed at a stopped container.

Form (b) removes the disagreement by giving both jobs to one owner.

⚠️ **This reverses the advice in most Boot 3.1-era material**, which presented the `@Container`
`static` field as *the* idiom. It is still the idiom for a plain Testcontainers test with no Spring
context. It stops being the idiom the moment a cached `ApplicationContext` outlives the test class.

## What Spring guarantees when it owns the container

Two bullets, verbatim:

> *"Container beans are created and started before all other beans."*
>
> *"Container beans are stopped after the destruction of all other beans."*

> *"This process ensures that any beans, which rely on functionality provided by the containers, can
> use those functionalities. It also ensures that they are cleaned up whilst the container is still
> available."*

The second half of that is the part people forget. A `DataSource`'s destruction callback closes a
pool, which talks to the database. If the database went away first, the callback fails. Spring's
ordering is chosen so it does not.

The contrast is stated just as plainly:

> *"Having containers managed by Testcontainers instead of as Spring beans provides **no guarantee**
> of the order in which beans and containers will shutdown. It can happen that containers are
> shutdown before the beans relying on container functionality are cleaned up. This can lead to
> exceptions being thrown by client beans, for example, due to loss of connection."*

And the cardinality:

> *"Container beans are created and started **once per application context** managed by Spring's
> TestContext Framework."*
>
> *"Container beans are stopped as part of the TestContext Framework's standard application context
> shutdown process. When the application context gets shutdown, the containers are shutdown as
> well. This usually happens after all tests using that specific cached application context have
> finished executing. It may also happen earlier, depending on the caching behavior configured in
> the TestContext Framework."*
>
> *"A single test container instance can, and often is, retained across execution of tests from
> multiple test classes."*

## Which makes the container's lifetime the context cache's lifetime

Read those three quotes together and the rule is: **once per context, not once per class.** Ten
test classes that produce the same context key share one container. Change anything that changes
the key — a different `@ActiveProfiles`, a `@MockitoBean`, a different `@SpringBootTest` classes
attribute — and you get a second context and a second container, started from scratch.

That is why container startup cost is a *context cache* problem rather than a Testcontainers
problem, and why the lever that fixes a slow suite is usually "have fewer distinct context
configurations", not "make the container faster". The cache itself, what evicts it and how to see
how many contexts a suite builds is [05 · The context cache](../05-the-test-pyramid/05-the-context-cache.md)
and [05b · What evicts it](../05-the-test-pyramid/05b-what-evicts-it.md) — this topic does not
re-teach it. The complementary lever, one container for the whole JVM regardless of context count,
is **05 · The singleton pattern** *(not written yet)*.

## Starting several containers at once

```properties
spring.testcontainers.beans.startup=parallel
```

> *"You can use the `spring.testcontainers.beans.startup` property to change how containers are
> started. By default `sequential` startup is used, but you may also choose `parallel` if you wish
> to start multiple containers in parallel."*

The property name is a constant on the `TestcontainersStartup` enum, which has exactly two values:

```java
public enum TestcontainersStartup {

    SEQUENTIAL { void start(Collection<? extends Startable> startables) {
        startables.forEach(TestcontainersStartup::start); } },

    PARALLEL   { void start(Collection<? extends Startable> startables) {
        SingleStartables singleStartables = new SingleStartables();
        Startables.deepStart(startables.stream().map(singleStartables::getOrCreate)).join(); } };

    public static final String PROPERTY = "spring.testcontainers.beans.startup";
}
```

Three details from that source worth having:

- **Relaxed binding on the value.** `getCanonicalName` strips every non-alphanumeric character and
  lowercases, so `PARALLEL`, `parallel` and `par-allel` all resolve. A value that resolves to
  nothing throws `IllegalArgumentException` with the message
  `"Unknown 'spring.testcontainers.beans.startup' property value '...'"` — a typo fails the context
  rather than silently falling back to sequential.
- **`PARALLEL` uses Testcontainers' `Startables.deepStart`**, so container dependencies expressed
  through `dependsOn` are still respected. Parallel does not mean unordered.
- **`TestcontainersStartup.start(Startable)` skips a container that is already running**, guarded by
  a `try`/`catch` that treats any throwable from `isRunning()` as "not running". That is what makes
  a reused or externally-started container safe to hand to Spring.

Parallel startup only helps when a context genuinely has several containers. One database is one
database.

## Where this goes next

Declaring containers as beans is not only a test technique. The same `@TestConfiguration` can be
attached to the real application's `main` method, and container declarations you already have as
static fields on an interface can be imported rather than rewritten — both in
[04b6 · Importing declarations, and development time](04b6-importing-and-development-time.md).

## Gotchas

**★ `@Container` on a `static` field plus a cached context is a documented hazard, not a style nit.**
The extension stops the container when the class ends; the TestContext framework keeps the context
for the next class with the same key. Boot's own words are that later tests *"or bean destruction
callbacks may fail"*. Prefer container `@Bean` methods or `@ImportTestcontainers`.

**★ A non-static `@Container` field is stopped after every test method.**
Same problem, one order of magnitude worse — the container restarts per method, and any cached
context outlives it immediately.

**★ Container beans start before *every* other bean, including ones you would rather went first.**
"Before all other beans" is unqualified. If you have an expensive bean you wanted eagerly warmed in
parallel with the container pull, that is not what happens.

**★ One container per *context*, not per test class.**
Ten classes sharing a context key share one container; two classes differing by a single
`@MockitoBean` get two contexts and two containers. Container count is a function of context-key
diversity, which is [05b](../05-the-test-pyramid/05b-what-evicts-it.md)'s subject.

**★ `spring.testcontainers.beans.startup=parallel` does nothing for a single container.**
It parallelises the startup of the container beans in one context. One database is one database;
the property is for contexts that start a database, a broker and a cache together.

**★ A typo in that property fails the context.**
`TestcontainersStartup.get` throws `IllegalArgumentException` naming the property and the bad value.
It does not fall back to `SEQUENTIAL`. That is the desirable behaviour, but it surprises people who
expect relaxed binding to mean lenient.

## Interview questions

**★ Boot 4.1 tells you to prefer container `@Bean` methods over `@Container` static fields. Why?**
Because the two lifecycles disagree. The JUnit extension stops a container when the test class
finishes, but Spring's TestContext framework caches the `ApplicationContext` beyond that and reuses
it for the next class with the same key. The cached context still holds beans — a `DataSource`, a
driver — pointed at a container that no longer exists, so later tests or bean destruction callbacks
fail. Declaring the container as a Spring bean gives both jobs to one owner.

**★ What ordering does Spring guarantee for container beans?**
Container beans are created and started before all other beans, and stopped after the destruction
of all other beans. The second half matters as much as the first: a connection pool's `close()`
talks to the database, so the database has to still be there when it runs. Under the JUnit extension
there is no such guarantee at all, and the reference says so.

**★ How many times does a container start across a suite?**
Once per application context, not once per test class — and a single container instance is, in
Boot's words, *"often"* retained across tests from multiple test classes. So the count is driven by
how many distinct context cache keys your suite produces. Reducing container startups is usually a
matter of reducing context configurations.

**★ When does a container bean stop?**
When its application context is shut down, which is normally after every test using that cached
context has finished — but the reference notes it *"may also happen earlier, depending on the
caching behavior configured in the TestContext Framework"*, for example when the cache reaches its
maximum size and evicts, or when `@DirtiesContext` closes a context early.

**★ What does `spring.testcontainers.beans.startup=parallel` do, and when is it worth it?**
It switches `TestcontainersStartup` from `SEQUENTIAL` to `PARALLEL`, which uses Testcontainers'
`Startables.deepStart` to start the container beans concurrently while still honouring declared
dependencies. It is worth it when one context starts several independent containers. It does nothing
for a context with one container.

{/* FOOTER */}
