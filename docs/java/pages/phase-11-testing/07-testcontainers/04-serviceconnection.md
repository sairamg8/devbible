---
title: "@ServiceConnection never writes a property — it registers ConnectionDetails beans that outrank every property you could have written, and once you see that the whole feature stops being magic and starts being a bean lookup"
sidebar_label: "04 · @ServiceConnection"
sidebar_position: 19
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-31 against the **Spring Boot 4.1.0** reference at tag `v4.1.0` —
> [`testing/testcontainers.adoc`](https://github.com/spring-projects/spring-boot/blob/v4.1.0/documentation/spring-boot-docs/src/docs/antora/modules/reference/pages/testing/testcontainers.adoc)
> and its `include-code` Java samples — and the **`spring-boot-testcontainers` sources** at the
> same tag (`ServiceConnection`, `ContainerConnectionSource`, `ContainerConnectionDetailsFactory`,
> `ConnectionDetailsRegistrar`), read directly.
> Version spine from `spring-boot-dependencies:4.1.0`: JDK 25, Spring Boot 4.1.0,
> **Testcontainers 2.0.5**, JUnit Jupiter 6.0.3.
> ⚠️ **No Docker and no sandbox on this machine.** Nothing here is a container log, a timing or a
> test run — Java source and documented configuration only.

**[02](02-what-testcontainers-is.md) established that Testcontainers hands you a host and a
randomly-mapped port. Something has to carry those two values into Spring's auto-configuration.
The obvious answer is "set the properties", and for two years that is what everyone did. Boot's
answer since 3.1 is better than that and differently shaped: `@ServiceConnection` does not set
`spring.datasource.url` at all. It registers a `ConnectionDetails` bean that the auto-configuration
consults *instead of* the properties. Understanding that difference is the difference between the
annotation working and you staring at a stack trace asking why your `application-test.yml` is
being ignored.**

## The line you stop writing

The pre-`@ServiceConnection` idiom, still correct and still needed for the cases the annotation
does not cover ([04c](04c-dynamicpropertysource.md)):

```java
@Container
static PostgreSQLContainer postgres = new PostgreSQLContainer("postgres:18-alpine");

@DynamicPropertySource
static void datasourceProperties(DynamicPropertyRegistry registry) {
    registry.add("spring.datasource.url", postgres::getJdbcUrl);
    registry.add("spring.datasource.username", postgres::getUsername);
    registry.add("spring.datasource.password", postgres::getPassword);
}
```

Three property names you have to know, spelled correctly, for one container. The modern form:

```java
@Container
@ServiceConnection
static PostgreSQLContainer postgres = new PostgreSQLContainer("postgres:18-alpine");
```

No property names. Not "the property names are written for you somewhere else" — **no properties
at all.**

## What it actually registers

Boot's own definition, which is worth reading twice because the last clause is the whole design:

> *"A service connection is a connection to any remote service. Spring Boot's auto-configuration
> can consume the details of a service connection and use them to establish a connection to a
> remote service. When doing so, **the connection details take precedence over any
> connection-related configuration properties**."*

And on the Neo4j sample the reference ships:

> *"Thanks to `@ServiceConnection`, the above configuration allows Neo4j-related beans in the
> application to communicate with Neo4j running inside the Testcontainers-managed Docker
> container. This is done by automatically defining a `Neo4jConnectionDetails` bean which is then
> used by the Neo4j auto-configuration, overriding any connection-related configuration
> properties."*

So the mechanism is: **annotation → `ConnectionDetails` bean → auto-configuration reads the bean
and ignores the properties.** `JdbcConnectionDetails`, `Neo4jConnectionDetails`,
`KafkaConnectionDetails` and the rest are ordinary interfaces with ordinary bean definitions; the
Testcontainers integration is one producer of them, Boot's Docker Compose support is another, and
a hand-written `@Bean` is a third.

You need one test dependency for any of it:

> *"You'll need to add the `spring-boot-testcontainers` module as a test dependency in order to
> use service connections with Testcontainers."*

```xml
<dependency>
    <groupId>org.springframework.boot</groupId>
    <artifactId>spring-boot-testcontainers</artifactId>
    <scope>test</scope>
</dependency>
```

## The annotation, in full

From `ServiceConnection.java` at `v4.1.0` — it has exactly three attributes and two of them are
aliases of each other:

```java
@Retention(RetentionPolicy.RUNTIME)
@Target({ ElementType.FIELD, ElementType.METHOD, ElementType.ANNOTATION_TYPE })
public @interface ServiceConnection {

    @AliasFor("name")  String value() default "";

    @AliasFor("value") String name() default "";

    Class<? extends ConnectionDetails>[] type() default {};
}
```

Three things fall out of that signature:

- `@ServiceConnection("redis")` and `@ServiceConnection(name = "redis")` are the same thing.
- `ElementType.ANNOTATION_TYPE` is in the target list, so you can meta-annotate: a project-local
  `@OurRedis` composed annotation is legal.
- `type()` is documented as *"A restriction to types of `ConnectionDetails` that can be created
  from this connection. The default value does not restrict the types that can be created."*
  Restriction, not selection — the default is "everything applicable".


## Where the rest of this lives

The three files after this one take the mechanism apart in the order you meet it:

- [04b · How the match is made](04b-how-the-match-is-made.md) — the three gates that decide which
  `ConnectionDetails` beans get registered, and where the connection name comes from.
- [04b2 · The `@Bean` method rule and narrowing](04b2-the-bean-method-and-narrowing.md) — why a
  `@Bean` method behaves differently from a `static` field, `type`, and the two silent failures.
- [04b3 · What is actually supported](04b3-the-supported-services.md) — the Boot 4.1 catalogue and
  the entries that are not what they look like.
- [04b4 · SSL, and the other catalogue](04b4-ssl-and-the-other-catalogue.md) — the SSL annotations
  that sit beside it, and how Boot's Docker Compose support differs.
- [04b5 · Containers as Spring beans](04b5-containers-as-beans.md) — the lifecycle argument Boot 4.1
  now makes against the `@Container` static field.
- [04b6 · Importing, and development time](04b6-importing-and-development-time.md) —
  `@ImportTestcontainers`, and running your application against containers with no test involved.

The predecessor it replaced — still required for everything the catalogue does not cover — is
[04c · @DynamicPropertySource](04c-dynamicpropertysource.md), continued in
[04c2](04c2-precedence-and-when-to-use-it.md), [04c3](04c3-the-registrar.md) and
[04c4](04c4-dynamic-properties-and-the-cache.md).

Phase 10 already applies `@ServiceConnection` to a concrete SQL-first repository test at
[12g · Testcontainers and @ServiceConnection](../../phase-10-data-access/05-sql-first-access/12g-testcontainers-and-serviceconnection.md).
⚠️ That page predates Testcontainers 2.0 and its container declarations use the 1.x generic form,
which now resolves only against a deprecated shim — read it for the shape of the test, not for the
container syntax, and see [02](02-what-testcontainers-is.md) for what changed.

## Gotchas

**★ `@ServiceConnection` does not set `spring.datasource.url`, so do not go looking for it.**
It registers a `ConnectionDetails` bean, and Boot's own words are that *"the connection details
take precedence over any connection-related configuration properties"*. Printing the `Environment`
will not show you a container URL, and a `spring.datasource.url` you set in `application-test.yml`
is not being merged with it — it is being outranked.

**★ Which means a property you set in `application-test.yml` is silently ignored.**
This is the mirror of the previous gotcha and it is the one that wastes an afternoon. If a test
needs to point at something other than the container, remove the `@ServiceConnection`; you cannot
override it with a property. There is no ordering knob, because there is no ordering — the
auto-configuration reads the bean when one exists and the properties only when none does.

**★ Forgetting `spring-boot-testcontainers` gives you an annotation that does nothing.**
It is a separate artifact from both `spring-boot-starter-test` and `org.testcontainers:testcontainers`.
Without it there is no `ContainerConnectionDetailsFactory` registered anywhere, so the annotation
is inert — the test starts, the container starts, and the application connects to whatever your
default configuration says.

**★ `@ServiceConnection` and `@Container` are unrelated annotations that happen to sit together.**
`@Container` is Testcontainers' JUnit extension telling it to manage the lifecycle;
`@ServiceConnection` is Boot telling its auto-configuration where to point. Neither implies the
other. A field with only `@ServiceConnection` is never started; a field with only `@Container` is
started and then ignored by Boot.

**★ `@ServiceConnection("redis")` and `@ServiceConnection(name = "redis")` are identical.**
`value()` is declared `@AliasFor("name")`. Reviewers occasionally "fix" one into the other as
though it changed behaviour. It does not.

## Interview questions

**★ What does `@ServiceConnection` actually do?**
It marks a container field, `@Bean` method or composed annotation as a `ContainerConnectionSource`.
Boot's registered `ContainerConnectionDetailsFactory` implementations each try to accept that
source, and the ones that do register a `ConnectionDetails` bean — `JdbcConnectionDetails`,
`Neo4jConnectionDetails`, and so on. The auto-configuration then reads that bean instead of the
connection properties. No property is ever written.

**★ Why does it beat what you put in `application-test.yml`?**
Because Boot's design is that *"the connection details take precedence over any connection-related
configuration properties"*. The auto-configuration is written to prefer a `ConnectionDetails` bean
when one exists and to fall back to properties only when none does. So the two are not merged and
the property does not win a tie — there is no tie, and no property precedence rule is involved.

**★ What is the difference between `@Container` and `@ServiceConnection`?**
`@Container` belongs to Testcontainers' JUnit Jupiter extension and controls the container's
lifecycle — when it starts and when it stops. `@ServiceConnection` belongs to Spring Boot and
controls what the application connects to. You normally want both on a `static` field in a test
class, but each is meaningful without the other, and neither activates the other.

**★ Which dependency do you need, and is it in `spring-boot-starter-test`?**
You need `org.springframework.boot:spring-boot-testcontainers` at test scope, and no, it is not
pulled in by `spring-boot-starter-test`. You also need the Testcontainers module for the technology
itself — on 2.x that artifact is prefixed, so PostgreSQL is
`org.testcontainers:testcontainers-postgresql`.

**★ Can you put `@ServiceConnection` on your own annotation?**
Yes. Its `@Target` includes `ElementType.ANNOTATION_TYPE`, so a project-local composed annotation
carrying `@ServiceConnection(name = "redis")` plus whatever else your team wants — an `@Ssl`, a
`@Container`, a marker — is supported and is the tidy way to stop repeating a `name` hint across a
suite.

{/* FOOTER */}
