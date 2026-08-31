---
title: "A dynamic property outranks @TestPropertySource, the OS environment and system properties, and that ordinary property precedence — not a bean lookup — is exactly why it can do four things @ServiceConnection structurally cannot"
sidebar_label: "04c2 · Precedence, and choosing"
sidebar_position: 27
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-31 against the **Spring Framework 7.0.8** reference —
> [Context Configuration with Dynamic Property Sources](https://github.com/spring-projects/spring-framework/blob/v7.0.8/framework-docs/modules/ROOT/pages/testing/testcontext-framework/ctx-management/dynamic-property-sources.adoc)
> (the "Precedence" section, quoted verbatim) — and the
> [`DynamicPropertyRegistrar`](https://github.com/spring-projects/spring-framework/blob/v7.0.8/spring-test/src/main/java/org/springframework/test/context/DynamicPropertyRegistrar.java)
> javadoc at the same tag, which repeats the precedence rule; plus the **Spring Boot 4.1.0**
> reference at `v4.1.0` for the service-connection comparison.
> Version spine: JDK 25, Spring Boot 4.1.0 / Spring Framework 7.0.8, **Testcontainers 2.0.5**,
> JUnit Jupiter 6.0.3.
> ⚠️ **No Docker and no sandbox on this machine.** Nothing here is a container log, a timing or a
> test run.

**[04c](04c-dynamicpropertysource.md) is the mechanism. This chunk answers the question a reviewer
will actually ask you: given that `@ServiceConnection` exists, when is writing a
`@DynamicPropertySource` the right call rather than the lazy one? The answer turns on a single
structural difference — one mechanism puts a value in the `Environment` and the other does not — and
that difference produces four cases where the older annotation is not a fallback but the only
option.**

## Precedence: it outranks nearly everything

> *"Dynamic properties have higher precedence than those loaded from `@TestPropertySource`, the
> operating system's environment, Java system properties, or property sources added by the
> application declaratively by using `@PropertySource` or programmatically. Thus, dynamic properties
> can be used to selectively override properties loaded via `@TestPropertySource`, system property
> sources, and application property sources."*

That is a stronger guarantee than `@ServiceConnection` gives, and it is a different *kind* of
guarantee. `@ServiceConnection` wins because the auto-configuration prefers a `ConnectionDetails`
bean over properties — a bean-lookup rule.  `@DynamicPropertySource` wins because
`DynamicValuesPropertySource` is inserted at the front of the `Environment` — an ordinary property
precedence rule. Which means: a dynamic property **can** be seen by `@Value`, by
`Environment.getProperty`, by `@ConfigurationProperties` and by anything else that reads the
`Environment`, whereas a `ConnectionDetails` bean cannot be seen by any of them.

That difference is the strongest practical reason the older mechanism survives.

## What it is still the right tool for

Four cases, and none of them is "I prefer the old way".

**1 · A service `@ServiceConnection` does not cover.** LocalStack, WireMock, a vendor image, an
internal service with a bespoke client. There is no factory, so there is no bean, so properties are
the only channel.

```java
@Container
static GenericContainer<?> localstack =
        new GenericContainer<>("localstack/localstack:3").withExposedPorts(4566);

@DynamicPropertySource
static void awsProperties(DynamicPropertyRegistry registry) {
    registry.add("app.aws.endpoint",
            () -> "http://" + localstack.getHost() + ":" + localstack.getMappedPort(4566));
}
```

**2 · A property that is not a connection detail.** `ConnectionDetails` interfaces expose exactly
what their auto-configuration needs — a URL, credentials, a host and port. Your application's own
`app.storage.bucket`, a feature flag that must match the container's configuration, a timeout scaled
to a slow container: none of those are connection details and none of them will ever have a
factory.

**3 · A computed value.** Anything that is a function of two containers, or of a container and a
random port, or a string built from both. The example above builds a URL from a host and a mapped
port; no annotation composes values.

**4 · Your own property names.** If the application reads `app.neo4j.uri` rather than
`spring.neo4j.uri`, no `ConnectionDetails` bean helps you — Neo4j's auto-configuration is not the
consumer. A dynamic property is.

## What it is *not* the right tool for

Writing `spring.datasource.url` by hand when a `@ServiceConnection` would do. Three property names
you must spell correctly, that change between Boot versions, for a container that Boot already
recognises. If the container is in [04b3](04b3-the-supported-services.md)'s catalogue, use the
annotation.

## The decision, as a table

| Situation | Reach for |
|---|---|
| Container is in [04b3](04b3-the-supported-services.md)'s catalogue and only Spring's own auto-configuration needs it | `@ServiceConnection` |
| Container is a `JdbcDatabaseContainer` and you also run Flyway or Liquibase | `@ServiceConnection` — one annotation covers all three |
| Your own code reads the value via `@Value` or `@ConfigurationProperties` | `@DynamicPropertySource` / `DynamicPropertyRegistrar` |
| The property name is yours, not Spring's | `@DynamicPropertySource` / `DynamicPropertyRegistrar` |
| Value is computed from more than one container, or from a container plus something else | `@DynamicPropertySource` / `DynamicPropertyRegistrar` |
| Service has no factory at all — LocalStack, WireMock, an internal image | `@DynamicPropertySource` / `DynamicPropertyRegistrar` |
| You need both: Spring wiring *and* a value your code reads | both, on the same container |
| Containers are declared as `@Bean` methods | `DynamicPropertyRegistrar`, not `@DynamicPropertySource` — [04c3](04c3-the-registrar.md) |

The last row is the one people miss. `@DynamicPropertySource` requires a static method, which
requires static state, which is exactly what a `@Bean`-managed container is not. Reaching for the
registrar there is not a stylistic upgrade; it is the form that fits.

## Both mechanisms on one container is normal

There is nothing clever about this and nothing wrong with it:

```java
@Container
@ServiceConnection
static PostgreSQLContainer postgres = new PostgreSQLContainer("postgres:18-alpine");

@DynamicPropertySource
static void ourOwnProperties(DynamicPropertyRegistry registry) {
    // Not a connection detail — our code reads this one directly.
    registry.add("app.reporting.jdbc-url", postgres::getJdbcUrl);
}
```

`@ServiceConnection` gives Boot's `DataSource`, Flyway and Liquibase auto-configuration what they
need through a `JdbcConnectionDetails` bean. The dynamic property gives *your* code a value it can
read from the `Environment`. Neither can do the other's job, and they do not interfere: the
`ConnectionDetails` bean is not a property, and the property is not a bean.

## Gotchas

**★ Dynamic properties beat `@TestPropertySource`, which is the opposite of what people assume.**
`@TestPropertySource` looks more specific and more "test-y", so people expect it to win. It does
not. If a `@DynamicPropertySource` registers the same key, the dynamic value is used.

**★ A dynamic property is visible to `@Value` and `@ConfigurationProperties`; a `ConnectionDetails` bean is not.**
This is the real functional difference between the two mechanisms and it decides which you need. If
your own code reads the value out of the `Environment`, `@ServiceConnection` cannot help you no
matter how well supported the container is.

**★ Using it for a container `@ServiceConnection` already covers is a net loss.**
You take on three or four property names that are version-sensitive, and you lose the Flyway and
Liquibase wiring that a single `JdbcDatabaseContainer` match would have given you for free — see
[04b3](04b3-the-supported-services.md).

**★ `@ServiceConnection` and `@DynamicPropertySource` on the same container do not conflict; they compete.**
Both can be present. The `ConnectionDetails` bean wins for the auto-configuration that consults it,
and the dynamic property wins for anything reading the `Environment`. Having both point at the same
container is harmless and having them point at different ones is a very confusing afternoon.

**★ Boot's `@ImportTestcontainers` carries `@DynamicPropertySource` methods across too.**
Its javadoc lists *"All `@DynamicPropertySource` annotated methods"* alongside the container fields.
Importing a declaration class for its containers imports its property registrations as well —
[04b6](04b6-importing-and-development-time.md).

**★ "It is more flexible" is not a reason to prefer it.**
Boot's phrase is *"a slightly more verbose but also more flexible alternative"* — and verbosity here
means property names you own and must keep correct across Boot upgrades. Flexibility you are not
using is cost.

**★ `@DynamicPropertySource` cannot be used with a `@Bean`-managed container.**
The method must be static, so it cannot see a bean. This is not a limitation you work around with a
static holder field — that reintroduces exactly the shared mutable state the bean form removed. Use
a `DynamicPropertyRegistrar`, which takes the container as a method parameter.

**★ Overriding a `@ServiceConnection` with a dynamic property does not work.**
They act on different channels. Registering `spring.datasource.url` next to a
`@ServiceConnection`-annotated Postgres container leaves the `DataSource` pointed at the container,
because its auto-configuration reads the `JdbcConnectionDetails` bean and never looks at the
property. If you need to point Spring's own wiring elsewhere, remove the annotation.

**★ Dynamic properties beating system properties can mask a CI override.**
A CI job that sets `-Dspring.datasource.url=...` expecting to redirect a test is silently outranked
by any `@DynamicPropertySource` registering that key. The Framework documents this as intended
behaviour, which does not make the CI job's author less confused.

## Interview questions

**★ How does its precedence compare to `@TestPropertySource`?**
Dynamic properties win. The Framework states they have higher precedence than `@TestPropertySource`,
the OS environment, Java system properties and any `@PropertySource` the application declares. They
are intended to be used to selectively override those.

**★ `@ServiceConnection` also "wins" over properties. Is that the same thing?**
No, and the difference matters. `@ServiceConnection` wins because auto-configuration prefers a
`ConnectionDetails` bean over reading properties at all — nothing is added to the `Environment`.
`@DynamicPropertySource` wins because its property source is placed ahead of the others in the
`Environment`. So a dynamic property is readable by `@Value`, `Environment.getProperty` and
`@ConfigurationProperties`, and a `ConnectionDetails` bean is readable by none of them.

**★ Where in the `Environment` do dynamic properties sit?**
In a `DynamicValuesPropertySource` that `DynamicPropertiesContextCustomizer` obtains or creates on
the context's `ConfigurableEnvironment`, ahead of the other sources. That is why the precedence rule
is an ordinary property-source precedence rule rather than anything special — and why
`@DynamicPropertySource` methods and `DynamicPropertyRegistrar` beans, which both write into the
same registry, cannot outrank each other.

**★ Can you use both `@ServiceConnection` and `@DynamicPropertySource` on one container?**
Yes, and it is a normal thing to do. The annotation feeds Spring's auto-configuration through a
`ConnectionDetails` bean; the dynamic property feeds your own code through the `Environment`. They
occupy different channels, so they neither conflict nor override one another — which also means a
dynamic property cannot be used to redirect something `@ServiceConnection` has already wired.

**★ When would you still write a `@DynamicPropertySource` in 2026?**
When the service has no entry in Boot's catalogue — LocalStack, WireMock, an internal image. When
the property is not a connection detail, such as one of your own application's settings that must
agree with the container's configuration. When the value has to be computed from more than one
source. And when your application reads its own property name rather than the Spring one, so no
`ConnectionDetails` bean is consulted.

{/* FOOTER */}
