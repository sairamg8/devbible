---
title: "The reason teams abandon container-backed tests is start-up time, and the three answers are not equivalent — the JDBC URL scheme trades control for brevity and destroys the database when the pool goes idle, container reuse is an experimental machine-local flag its own documentation says is unsuited to CI, and the context cache is the free one nobody configures"
sidebar_label: "11b2 · Making it fast"
sidebar_position: 39
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 against Testcontainers for Java's *JDBC support*
> ([java.testcontainers.org](https://java.testcontainers.org/modules/databases/jdbc/))
> and *Reusable Containers*
> ([java.testcontainers.org](https://java.testcontainers.org/features/reuse/)),
> Spring Boot 4.1's *Testcontainers* reference
> ([docs.spring.io](https://docs.spring.io/spring-boot/reference/testing/testcontainers.html)),
> Spring Boot 4.1's `FlywayProperties`
> ([github.com/spring-projects/spring-boot](https://github.com/spring-projects/spring-boot/tree/main/module/spring-boot-flyway))
> and Flyway 12's *cleanDisabled* setting
> ([documentation.red-gate.com](https://documentation.red-gate.com/flyway/reference/configuration/flyway-namespace/flyway-clean-disabled-setting)).
> JDK 25, Spring Boot 4.1.0, Flyway 12.4.0, PostgreSQL 18, Testcontainers 2.0.5.

**A PostgreSQL container per test class is what turns "we should test the migrations" into "the build
takes eleven minutes" into "we deleted that test". There are three ways to make it cheaper and they
are not interchangeable: one gives up control, one is explicitly not for CI, and one is free and
already switched on. This chunk is which is which, and the one place where making it faster and
[11](11-testing-migrations.md)'s test are in direct contradiction.**

## The free one first: the context cache

Spring's TestContext framework caches an `ApplicationContext` per distinct test configuration, and
Boot spells out what that means for containers:

> *"Container beans are created and started once per application context managed by Spring's
> TestContext Framework."*

> *"A single test container instance can, and often is, retained across execution of tests from
> multiple test classes."*

🔴 **So the first lever is not a Testcontainers feature at all — it is keeping the test configuration
identical.** One `@TestConfiguration` holding the container bean, imported by every integration test
class, with no per-class property overrides, gives you one context and therefore one container for the
entire suite. No flags, no experimental features, nothing committed that only works on one machine.

What forks the cache — and therefore starts another container — is any difference in the configuration
key: a `@DirtiesContext`, an extra `properties = {…}` entry, a different `@ActiveProfiles`, a
different set of `@MockitoBean` declarations, a different `@Import`. This is the usual explanation for
a suite that starts eight PostgreSQL containers when its author expected one.

⚠️ **`@DirtiesContext` on a container-backed test is expensive twice over.** It discards the context
*and* stops the container in it, so the next class pays a full container start. If a test needs a
clean database, cleaning the database is cheaper than discarding the context.

## The brief one: the JDBC URL scheme

Testcontainers can hide the container behind the URL entirely:

> *"As long as you have Testcontainers and the appropriate JDBC driver on your classpath, you can
> simply modify regular JDBC connection URLs to get a fresh containerized instance of the database
> each time your application starts up."*

```yaml
spring:
  datasource:
    url: jdbc:tc:postgresql:18-alpine:///migrationtest
    driver-class-name: org.testcontainers.jdbc.ContainerDatabaseDriver
```

Two properties of it surprise people. First:

> *"Note that the hostname, port and database name will be ignored; you can leave these as-is or set
> them to any value."*

and second, the one that produces the hard-to-diagnose failure:

> *"By default database container is being stopped as soon as last connection is closed."*

🔴 **A connection pool that goes idle and closes its last connection takes the database with it**, and
the next test gets a new, empty container with no schema. The symptom is "the tables disappeared
between two test classes". The fix is `?TC_DAEMON=true`:

```
jdbc:tc:postgresql:18-alpine:///migrationtest?TC_DAEMON=true
```

The URL form also supports `?TC_INITSCRIPT=somepath/init.sql` for a classpath script,
`?TC_INITSCRIPT=file:…` for a filesystem one, and `?TC_INITFUNCTION=com.example.Fixtures::seed` for a
static Java method. That last pair is occasionally the neatest way to get a database into a
*pre-migration* state, which [11d](11d-what-the-test-should-assert.md) needs for testing a data
migration's row effects.

⚠️ What the URL form has nowhere to put is a wait strategy, a `withCommand`, a `withCopyFileToContainer`
or anything else that needs the container object. It is genuinely the lowest-ceremony option and it
runs out of room quickly.

## The one with a warning label: reusable containers

> *"The *Reusable* feature keeps the containers running and next executions with the same container
> configuration will reuse it."*

Enabling it is deliberately awkward, because it is a property of a developer's machine rather than of
the repository:

- `testcontainers.reuse.enable=true` in `~/.testcontainers.properties`, or
- the `TESTCONTAINERS_REUSE_ENABLE=true` environment variable,
- and explicitly **not** through a classpath properties file — so nobody can commit it.

The container must also be started by calling `start()` manually and never stopped, directly or
through try-with-resources or the JUnit integration. The JDBC-URL equivalent is `?TC_REUSABLE=true`.

The documentation's own caveats are the part to read twice:

> *"Reusable containers are not suited for CI usage and as an experimental feature not all
> Testcontainers features are fully working (e.g., resource cleanup or networking)."*

> *"Those containers won't stop after all tests are finished."*

### Where reuse and this topic's test collide

🔴 **A reused container is not empty.** [11](11-testing-migrations.md)'s whole test is "apply every
migration to a database that has never seen any of them", and the second run against a reused
container applies nothing, finds every migration already in `flyway_schema_history`, and passes — for
the opposite of the reason you wanted.

The obvious escape is `clean`, and it is closed by default. Boot's `FlywayProperties` declares
`private boolean cleanDisabled = true;`, and Flyway's own reference explains the default:

> *"Whether to disable clean. This is especially useful for production environments where running
> clean can be a career limiting move. Set to `false` to allow `clean` to execute."*

So making a reused container empty again is a deliberate act:

```yaml
spring:
  flyway:
    clean-disabled: false     # test configuration ONLY
```

⚠️ **That setting must never reach a profile a real environment can load.** Flyway's own description
of `clean` is *"Drops all objects in the configured schemas"*, with *"Do not use against your
production DB!"* alongside it. A `clean-disabled: false` in a shared `application.yml` is one
misconfigured `SPRING_PROFILES_ACTIVE` away from being the worst incident in this topic.

The safer arrangement is to let the migrations-from-empty test be the one test that gets a fresh
container, and let everything else reuse.

## Choosing

| Lever | Cost | Where it fails |
|---|---|---|
| Context cache | None | Silently forked by `@DirtiesContext`, extra properties, differing mocks |
| JDBC URL scheme | Control | Container dies with the last connection unless `TC_DAEMON=true` |
| Reuse | Correctness, in CI | Not empty; experimental; cannot be committed; leaves containers running |

Do the first one properly before considering the third.

## Gotchas

**★ The real speed lever is context caching, not container reuse.** Spring keeps one context per
distinct configuration and container beans live in the context, so identical test configuration across
classes gives you one container for the whole suite with no experimental flags.

**★ A stray `@DirtiesContext`, an extra `properties = {…}`, or a different set of `@MockitoBean`
declarations forks the context cache.** Each distinct configuration is another context and therefore
another container. This is the usual reason a suite starts eight PostgreSQL containers.

**★ `@DirtiesContext` on a container-backed test costs a container start, not just a context.** The
container bean is destroyed with the context. Cleaning the data is almost always cheaper than
discarding the context.

**★ The JDBC URL form stops the container when the last connection closes.** An idle pool destroys the
database and the next connection gets a fresh empty one, so the symptom is "the schema disappeared
between two test classes". `?TC_DAEMON=true` prevents it.

**★ In the JDBC URL, host, port and database name are ignored.** They are decoration.
`jdbc:tc:postgresql:18-alpine:///anything` and `…:///migrationtest` are the same instruction, and
neither names where the container listens — which matters the first time somebody tries to connect a
`psql` to the URL in the config file.

**★ `TC_INITSCRIPT` runs before your migrations, which is either useful or confusing.** It is the
mechanism for seeding a pre-migration state; it is also a way to accidentally create objects that a
`V1` migration then fails to create.

**★ Container reuse is a machine setting, on purpose.** It cannot be enabled from a classpath
properties file, is documented as not suited to CI, is flagged experimental with resource-cleanup and
networking caveats, and leaves containers running after the suite ends.

**★ Reuse requires you to never stop the container.** Calling `stop()`, using try-with-resources, or
letting the JUnit integration manage it all defeat it — quietly, by starting a new container rather
than by failing.

**★ A reused container is not an empty one.** The migrations-from-empty test is the single test in
your suite that reuse fundamentally cannot serve, and it will *pass* against a reused container
without applying a single migration.

**★ `spring.flyway.clean-disabled` defaults to `true` in Spring Boot.** The obvious way to make a
reused container empty again is not available until you turn it off, and Flyway's own documentation
calls enabling clean in production *"a career limiting move"*.

**★ `clean-disabled: false` in a file a real environment can load is the most dangerous line in this
topic.** `clean` *"Drops all objects in the configured schemas"*. Keep it in a test-only
configuration source that no deployed profile can reach.

**★ Reuse leaves containers running on the developer's machine indefinitely.** That is the documented
behaviour, not a leak, and it is a surprise the first time somebody notices a PostgreSQL from last
Tuesday still holding a port.

## Interview questions

**★ The suite is slow because every test class starts a container. What is the first thing you fix?**
The context cache, not Testcontainers. Spring caches one `ApplicationContext` per distinct test
configuration, and Boot documents that container beans are created once per context and are often
retained across many test classes. So collapse the configuration: one `@TestConfiguration` with the
container bean, imported everywhere, and no per-class property overrides. That usually turns N
containers into one, for free.

**★ Your suite starts eight containers when you expected one. What happened?**
The cache key forked. Spring keys cached contexts on the whole test configuration, so a
`@DirtiesContext`, an extra `properties = {…}` entry, a different `@ActiveProfiles` or a different set
of `@MockitoBean` declarations produces a distinct context — and because the container is a bean *in*
that context, each one starts its own. Converging the test configuration collapses them back.

**★ What is the Testcontainers JDBC URL scheme, and what is its catch?**
Inserting `tc:` after `jdbc:` — `jdbc:tc:postgresql:18-alpine:///anything` — makes the driver start a
container and connect to it, with host, port and database name ignored. The catch is lifecycle: by
default the container stops as soon as the last connection closes, so an idle pool destroys the
database and the next test gets an empty one. `?TC_DAEMON=true` keeps it up. It is the lowest-ceremony
option and it has nowhere to configure wait strategies or container commands.

**★ Do you turn on container reuse?**
Not as the first move, and never in CI. It is documented as experimental and *"not suited for CI
usage"*, with caveats about resource cleanup and networking, and it can only be enabled from the
user's `~/.testcontainers.properties` or an environment variable — not from a classpath file —
specifically so it cannot be committed. It also leaves containers running after the suite finishes.

**★ What is the specific problem with reuse and a migrations test?**
The test's premise is a database that has never been migrated, and a reused container has been. The
second run finds every version already in `flyway_schema_history`, applies nothing, and passes — so
the test reports success having exercised none of the thing it exists to exercise. That is worse than
failing.

**★ Why not just run `flyway clean` between tests?**
Because Spring Boot disables it: `FlywayProperties` sets `cleanDisabled` to `true` by default, and
Flyway's own documentation explains why, calling clean in production *"a career limiting move"* since
it drops all objects in the configured schemas. You can enable it for tests, but the setting has to
live somewhere no deployed profile can load, because the blast radius of getting that wrong is the
entire database.

**★ What is the right arrangement for a suite that has both kinds of test?**
One shared context and one container for the tests that seed their own data, and a separate,
deliberately isolated test — its own configuration, its own fresh container — for the
migrations-from-empty assertion. The expensive test is one test, and buying its fidelity with one
container start is a trade that pays.

{/* FOOTER */}
