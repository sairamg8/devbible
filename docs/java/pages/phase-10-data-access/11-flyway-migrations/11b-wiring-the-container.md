---
title: "@ServiceConnection is not a shortcut for setting spring.datasource.url — it contributes a ConnectionDetails bean that outranks every property, which is why it silently wins arguments with your test configuration and why it points Flyway at the container as well as the DataSource"
sidebar_label: "11b · Wiring the container"
sidebar_position: 38
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 against Spring Boot 4.1's *Testcontainers* reference
> ([docs.spring.io](https://docs.spring.io/spring-boot/reference/testing/testcontainers.html))
> and *Managed Dependency Coordinates*
> ([docs.spring.io](https://docs.spring.io/spring-boot/appendix/dependency-versions/coordinates.html)),
> Testcontainers 2.0.5's `PostgreSQLContainer`
> ([github.com/testcontainers](https://github.com/testcontainers/testcontainers-java/blob/main/modules/postgresql/src/main/java/org/testcontainers/postgresql/PostgreSQLContainer.java))
> and Spring Boot's `FlywayContainerConnectionDetailsFactory`
> ([github.com/spring-projects](https://github.com/spring-projects/spring-boot/blob/main/module/spring-boot-flyway/src/main/java/org/springframework/boot/flyway/testcontainers/FlywayContainerConnectionDetailsFactory.java)).
> JDK 25, Spring Boot 4.1.0, Flyway 12.4.0, PostgreSQL 18, Testcontainers 2.0.5.

**[11](11-testing-migrations.md) argued that the migrations test needs a real PostgreSQL. Getting one
into a Spring Boot test is three lines of code and two decisions, and both decisions have a failure
mode that produces a test which passes for the wrong reason — a container that stops mid-suite, or a
`spring.datasource.url` in `src/test/resources` that is being silently ignored. This chunk is the
wiring and the precedence rule that explains most of the confusion.
[11b2](11b2-making-it-fast.md) is the shortcuts and the accelerator.**

## The dependencies

Boot 4.1 manages Testcontainers **2.0.5**, and the artifacts are per-module:

```groovy
testImplementation "org.springframework.boot:spring-boot-testcontainers"
testImplementation "org.testcontainers:testcontainers-postgresql"
testImplementation "org.testcontainers:testcontainers-junit-jupiter"
```

Boot's reference is explicit about the first: *"You'll need to add the `spring-boot-testcontainers`
module as a test dependency in order to use service connections with Testcontainers."* Without it the
container starts and nothing connects to it.

⚠️ **`PostgreSQLContainer` moved in Testcontainers 2.** The class is now
`org.testcontainers.postgresql.PostgreSQLContainer`; the old
`org.testcontainers.containers.PostgreSQLContainer<SELF>` is deprecated in favour of it. The new class
is also **not generic**, so the `new PostgreSQLContainer<>(…)` diamond that every 1.x example uses
does not carry over unchanged.

## `@ServiceConnection`, and the precedence rule

```java
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.testcontainers.service.connection.ServiceConnection;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import org.testcontainers.postgresql.PostgreSQLContainer;

@Testcontainers
@SpringBootTest
class MigrationsApplyFromEmptyTests {

    @Container
    @ServiceConnection
    static PostgreSQLContainer postgres = new PostgreSQLContainer("postgres:18-alpine");

    // the assertions live in 11d
}
```

What the annotation does, in Boot's words:

> *"A service connection is a connection to any remote service. Spring Boot's auto-configuration can
> consume the details of a service connection and use them to establish a connection to a remote
> service. When doing so, the connection details take precedence over any connection-related
> configuration properties."*

🔴 **"Take precedence over any connection-related configuration properties" is the load-bearing
clause.** Your `application.yml` under `src/test/resources` can name whatever URL it likes; the
container wins, and nothing warns you. This is also why `@ServiceConnection` replaced the older
`@DynamicPropertySource` boilerplate — it is not setting properties at all, it is contributing a
`ConnectionDetails` bean that the auto-configuration prefers to properties.

### Flyway gets its own connection details

Boot's table of factories lists `FlywayConnectionDetails` as matched on *"Containers of type
`JdbcDatabaseContainer`"*, next to `JdbcConnectionDetails` and `R2dbcConnectionDetails`. The reference
then says:

> *"By default, with the exception of `RabbitStreamConnectionDetails`, all applicable connection
> details beans will be created for a given `Container`. For example, a `PostgreSQLContainer` will
> create both `JdbcConnectionDetails` and `R2dbcConnectionDetails`."*

`FlywayContainerConnectionDetailsFactory` supplies the URL, username, password and driver class name
straight off the container, so **Flyway is pointed at the container even if `spring.flyway.url` says
otherwise**. That is almost always what you want, and it is worth knowing on the day a test insists on
a database you did not configure.

⚠️ If you want only some of the applicable types, `@ServiceConnection` has a `type` attribute. It is
rarely needed for a JDBC container, and it is the escape hatch when a test deliberately needs Flyway
pointed somewhere other than the application's `DataSource` — a second schema, say
([09c](09c-what-the-lock-does-not-cover.md)).

## Container as a bean, or `@Container` field?

Boot has a warning about the JUnit extension that decides this for most codebases:

> *"When using the JUnit extension, container instances are stopped after the test class has run (for
> static fields) or after each test method (for non-static fields). This can cause issues when used
> with Spring Boot tests, as Spring's TestContext Framework may cache the `ApplicationContext` beyond
> that point and reuse it for another test class or method with the same configuration. If the cached
> application context contains beans that depend on a container that has already been stopped, later
> tests or bean destruction callbacks may fail."*

and the recommendation that follows:

> *"For this reason, you should prefer managing containers as Spring beans or importing container
> declarations when the application context should remain usable for as long as it is cached."*

```java
@TestConfiguration(proxyBeanMethods = false)
class ContainerConfig {

    @Bean
    @ServiceConnection
    PostgreSQLContainer postgres() {
        return new PostgreSQLContainer("postgres:18-alpine");
    }
}
```

```java
@SpringBootTest
@Import(ContainerConfig.class)
class MigrationsApplyFromEmptyTests { /* … */ }
```

Container beans then follow Spring's lifecycle rather than JUnit's:

> *"Container beans are created and started before all other beans. Container beans are stopped after
> the destruction of all other beans."*

which is exactly the ordering Flyway's migration initializer needs — the database is up before the
`DataSource` bean is created, and it survives until after the context is torn down.

⚠️ **In a `@Bean` method the *return type* selects the factory, not the image name.** Boot documents
that it *"won't call the bean method to get the Docker image name, because this would cause eager
initialization issues"*. `PostgreSQLContainer` is a typed container so this works; a
`GenericContainer` carries no such information and needs `@ServiceConnection(name = "…")`.

The third documented option is `@ImportTestcontainers` over an interface holding the container
declarations, which is worth knowing when several test classes share a fixed set of containers.

## Gotchas

**★ `@ServiceConnection` overrides your properties, not the other way round.** Boot's wording is that
connection details *"take precedence over any connection-related configuration properties"*, so a
`spring.datasource.url` in `src/test/resources` is ignored, silently. Confusing exactly once, and
usually for an afternoon.

**★ Without `spring-boot-testcontainers` on the test classpath, `@ServiceConnection` does nothing.**
The container still starts, because that is Testcontainers' own JUnit extension; nothing connects to
it, because the factory that would have produced the connection details is not there.

**★ A `PostgreSQLContainer` also produces `FlywayConnectionDetails`.** Boot creates every applicable
connection-details bean for a container, so Flyway is pointed at the container even if
`spring.flyway.url` says something else.

**★ The JUnit `@Container` extension and Spring's context cache disagree about lifetimes.** Boot's
reference warns that the context may be cached past the container being stopped, and that later tests
or destruction callbacks then fail against a dead container. Managing the container as a `@Bean` is
the documented fix, and the symptom it fixes — a connection failure in a test class that passes when
run alone — is otherwise attributed to flakiness.

**★ A non-static `@Container` field is stopped after *every test method*.** In a Spring test that is
almost always wrong, and it is a single missing keyword away from the correct version.

**★ In a `@Bean` method the return type selects the connection-details factory.** Boot will not call
the method to read the image name, because that would force eager initialization.
`PostgreSQLContainer` is fine; `GenericContainer` needs `@ServiceConnection(name = "…")`.

**★ `PostgreSQLContainer` moved package and lost its type parameter in Testcontainers 2.** Copying a
1.x snippet gives you a deprecated import and a diamond that no longer fits — and the deprecated class
still works, so the compiler warning is the only signal.

**★ Pin the image tag to the PostgreSQL you actually run.** `postgres:18-alpine` tests PostgreSQL 18.
A stale or floating tag tests a different database, which is the same category of error as testing
against H2 ([11](11-testing-migrations.md)) — just better disguised, because nothing in the output
names the version.

**★ The container is not configured like your production server.** Testcontainers' `PostgreSQLContainer`
starts the server with `fsync=off`. A sensible default for a disposable database, and a reason not to
draw any conclusion about durability or write throughput from it.

**★ Docker has to exist wherever the test runs.** Every developer's machine and every CI agent. It is
the real cost of this approach, and it belongs in the decision rather than being discovered in a
pipeline.

## Interview questions

**★ What does `@ServiceConnection` do that setting properties does not?**
It contributes a `ConnectionDetails` bean rather than a property, and Boot documents connection details
as taking precedence over any connection-related configuration property. So it cannot be accidentally
overridden by a test `application.yml`, and it serves every applicable client at once — a
`JdbcDatabaseContainer` yields `JdbcConnectionDetails`, `R2dbcConnectionDetails` *and*
`FlywayConnectionDetails` — with no `@DynamicPropertySource` plumbing to maintain.

**★ Your test has `spring.datasource.url` pointing at a local database and it is being ignored. Why?**
Because a `@ServiceConnection`-annotated container is in the context and connection details outrank
properties. That is documented behaviour, not a bug, and it is the same mechanism that makes the
annotation useful. Remove the annotation or remove the container if you genuinely want the property to
win.

**★ Does the container also configure Flyway, or only the `DataSource`?**
Both. Boot registers every applicable connection-details factory for a container, and there is a
`FlywayConnectionDetails` factory matched on `JdbcDatabaseContainer` that reads the URL, username,
password and driver class name off the container. So a `spring.flyway.url` in your test configuration
loses to the container in exactly the same way `spring.datasource.url` does.

**★ When would you manage the container as a Spring bean rather than with `@Container`?**
Whenever the application context outlives the test class, which is most of the time. Boot's reference
warns that the JUnit extension stops static-field containers after the class runs, while Spring's
TestContext framework may keep the cached context alive and reuse it — so later tests or destruction
callbacks fail against a stopped container. A container `@Bean` is started before all other beans and
stopped after they are destroyed, which matches the context's lifetime exactly.

**★ A test class passes on its own and fails in the suite with a connection error. Where do you look?**
At container lifetime versus context lifetime. The classic cause is a `@Container` static field: JUnit
stopped it when its declaring class finished, Spring cached the context, and a later class with the
same configuration got the cached context pointing at a dead container. Moving the container into a
`@Bean` in a shared `@TestConfiguration` makes the two lifetimes agree.

**★ Why does the image tag matter?**
Because the tag *is* the database. `postgres:18-alpine` tests PostgreSQL 18; a stale or floating tag
tests something else. Given that the entire argument for a container is fidelity to production,
running a different major version is the H2 mistake wearing a better disguise — and it is worse in one
respect, because nothing in the test output tells you which version you got.

**★ Is the container a fair place to measure a migration's cost?**
No, for two independent reasons. It has no production data, so anything row-proportional is
instantaneous, and Testcontainers starts PostgreSQL with `fsync=off`, so its write path is not your
write path. It is a fidelity tool for *behaviour* — does this statement parse, does this lock level
exist, does this PL/pgSQL block run — not for performance.

{/* FOOTER */}
