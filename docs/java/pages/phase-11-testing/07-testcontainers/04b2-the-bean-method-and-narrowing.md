---
title: "A @Bean method is matched on its return type and a static field is matched on its image name, so the same annotation on the same container fails in one place and works in the other — plus the two ways @ServiceConnection does nothing without telling you"
sidebar_label: "04b2 · The @Bean rule and narrowing"
sidebar_position: 21
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-31 against the **Spring Boot 4.1.1** reference at tag `v4.1.0`
> ([`testing/testcontainers.adoc`](https://github.com/spring-projects/spring-boot/blob/v4.1.0/documentation/spring-boot-docs/src/docs/antora/modules/reference/pages/testing/testcontainers.adoc)),
> its `MyRedisConfiguration` `include-code` sample, the
> [`ServiceConnection`](https://github.com/spring-projects/spring-boot/blob/v4.1.0/core/spring-boot-testcontainers/src/main/java/org/springframework/boot/testcontainers/service/connection/ServiceConnection.java)
> javadoc and the
> [`ConnectionDetailsRegistrar`](https://github.com/spring-projects/spring-boot/blob/v4.1.0/core/spring-boot-testcontainers/src/main/java/org/springframework/boot/testcontainers/service/connection/ConnectionDetailsRegistrar.java)
> and `ContainerConnectionSource` sources at the same tag.
> Version spine: JDK 25, Spring Boot 4.1.1, **Testcontainers 2.0.5**, JUnit Jupiter 6.0.3.
> ⚠️ **No Docker and no sandbox on this machine.** Nothing here is a container log, a timing or a
> test run.

**[04b](04b-how-the-match-is-made.md) showed the three gates. This chunk is about the one input to
those gates that is not always available — the container instance — and about what Boot does when
the answer is "no beans". Two of the outcomes are exceptions with a very specific hint in them; two
are complete silence. Knowing which is which is the difference between a five-minute fix and an
afternoon.**

## 🔴 A `@Bean` method is matched on its return type, not on its image

This is the single most surprising rule in the feature, and it has a reason:

> *"If you're using a `@Bean` method, Spring Boot won't call the bean method to get the Docker
> image name, **because this would cause eager initialization issues**. Instead, the return type of
> the bean method is used to find out which connection detail should be used. This works as long as
> you're using typed containers such as `Neo4jContainer` or `RabbitMQContainer`. This stops working
> if you're using `GenericContainer`."*

The annotation's own javadoc puts it as a rule rather than an observation:

> *"Note that `Container` instances are **not** available early enough when the container is
> defined as a `@Bean` method. All `@ServiceConnection` `@Bean` methods that need to match on the
> connection name **must** declare this attribute."*

So this fails:

```java
@TestConfiguration(proxyBeanMethods = false)
class BrokenRedisConfiguration {

    @Bean
    @ServiceConnection                                   // ❌ no image name, no type to match on
    GenericContainer<?> redisContainer() {
        return new GenericContainer<>("redis:7");
    }
}
```

Boot cannot call `redisContainer()` to read `"redis:7"` without instantiating the container during
bean-definition registration, so `containerImageName` is `null`, `connectionName` is `null`, and
the only remaining signal is the return type `GenericContainer` — which no factory claims. Nothing
matches, and `ConnectionDetailsRegistrar` throws rather than shrugging. When the source has no
connection name it appends a specific hint to the exception message before rethrowing:

```java
catch (ConnectionDetailsFactoryNotFoundException ex) {
    rethrowConnectionDetails(source, ex, ConnectionDetailsFactoryNotFoundException::new);
}
// ...
if (!StringUtils.hasText(source.getConnectionName())) {
    message.append(" You may need to add a 'name' to your @ServiceConnection annotation");
    throw exceptionFactory.apply(message.toString(), ex.getCause());
}
```

If you see *"You may need to add a 'name' to your @ServiceConnection annotation"*, this is the
paragraph it is about. The fix is Boot's own `MyRedisConfiguration` sample, verbatim from the
reference's `include-code`:

```java
@TestConfiguration(proxyBeanMethods = false)
public class MyRedisConfiguration {

    @Bean
    @ServiceConnection(name = "redis")                   // ✅ the hint the return type cannot give
    public GenericContainer<?> redisContainer() {
        return new GenericContainer<>("redis:7");
    }
}
```

> *"Spring Boot can't tell from `GenericContainer` which container image is used, so the `name`
> attribute from `@ServiceConnection` must be used to provide that hint."*

⚠️ **The same annotation on a `static` field would work without `name`**, because there the
instance exists and its image name can be read. The rule is a property of *how you declared the
container*, not of the annotation. That asymmetry is the thing people get wrong.

## One container produces every applicable details bean

> *"By default, with the exception of `RabbitStreamConnectionDetails`, **all applicable connection
> details beans will be created** for a given `Container`. For example, a `PostgreSQLContainer`
> will create both `JdbcConnectionDetails` and `R2dbcConnectionDetails`."*

That is usually free and occasionally not. If your test classpath has both `spring-boot-jdbc` and
`spring-boot-r2dbc` and you only meant to test the JDBC path, you now have an `R2dbcConnectionDetails`
bean that may switch on an auto-configuration you did not want. Narrow it:

```java
@Container
@ServiceConnection(type = JdbcConnectionDetails.class)
static PostgreSQLContainer postgres = new PostgreSQLContainer("postgres:18-alpine");
```

> *"If you want to create only a subset of the applicable types, you can use the `type` attribute
> of `@ServiceConnection`."*

`type` takes an array, so `type = { JdbcConnectionDetails.class, FlywayConnectionDetails.class }`
is how you keep two of three.

## An existing bean silently wins

This one is in the source and not in the reference, and it is worth knowing before it bites:

```java
String[] existingBeans = this.beanFactory.getBeanNamesForType(connectionDetailsType);
if (!ObjectUtils.isEmpty(existingBeans)) {
    logger.debug(LogMessage.of(() -> "Skipping registration of %s due to existing beans %s"
            .formatted(source, Arrays.asList(existingBeans))));
    return;
}
```

If any bean of the target `ConnectionDetails` type already exists — you wrote one, or a shared test
configuration did — `@ServiceConnection` **registers nothing for that type and does not complain**.
The test then talks to whatever that other bean points at. The evidence is a DEBUG line, not an
error.

Registered beans are named `<connectionDetailsShortName>For<beanNameSuffix>`, from `getBeanName`,
which is what you will see in a bean-definition dump.

## Seeing why it did not match

Every rejection in `ContainerConnectionSource.accepts` is logged at **TRACE** before returning
`false`. The three format strings, from source:

```
"%s not accepted as source connection name '%s' does not match required connection name '%s'"
"%s not accepted as source container type %s is not assignable from %s"
"%s not accepted as source connection details types %s has no element assignable from %s"
```

`%s` for the source resolves through `ContainerConnectionSource.toString()`, which is
`"@ServiceConnection source for %s".formatted(this.origin)` — the origin being the field or method
that carried the annotation. Turn it on in the test's properties:

```properties
logging.level.org.springframework.boot.testcontainers.service.connection=TRACE
```

That converts "the annotation does nothing" into a line naming which of the three gates closed. It
is the first thing to do and almost nobody does it.


## Gotchas

**★ `@ServiceConnection` on a `GenericContainer` `@Bean` method without `name` throws.**
Boot will not call the bean method to read the image — *"because this would cause eager
initialization issues"* — so the only signal is the return type, and `GenericContainer` names no
service. Add `@ServiceConnection(name = "redis")`. The exception message says so, in those words,
if you read past the first line.

**★ The same code as a `static` field works, which makes the `@Bean` failure look like a bug.**
On a field the instance exists, so `getDockerImageName().getRepository()` is available. On a `@Bean`
method it is not. Identical annotation, different information available — this is designed
behaviour, not a regression, and it is why moving a container from a test class into a shared
`@TestConfiguration` can break a suite that was passing.

**★ A *typed* container `@Bean` needs no `name`, so the rule looks inconsistent.**
`@Bean @ServiceConnection Neo4jContainer neo4j()` is fine — the return type carries the answer.
Only untyped containers, and typed containers running a custom image whose repository is not in the
catalogue, need the hint. The rule is "the return type must be enough", not "`@Bean` methods always
need `name`".

**★ A `ConnectionDetails` bean you already declared beats the container, with no error.**
`ConnectionDetailsRegistrar` checks `getBeanNamesForType` first and returns early, logging at
DEBUG. A shared `@TestConfiguration` that defines a `JdbcConnectionDetails` will quietly disable
every JDBC `@ServiceConnection` in the suite, and the test will connect to whatever that bean says.

**★ That early return is per `ConnectionDetails` type, not per container.**
So a hand-written `JdbcConnectionDetails` suppresses the JDBC bean while the `R2dbcConnectionDetails`
from the same `PostgreSQLContainer` is still registered. Half the wiring points at the container and
half does not, which is a genuinely confusing state to debug.

**★ One `PostgreSQLContainer` gives you an `R2dbcConnectionDetails` you may not want.**
All applicable types are created by default. On a classpath carrying both `spring-boot-jdbc` and
`spring-boot-r2dbc` that can activate an auto-configuration you were not testing. Narrow it with
`type = JdbcConnectionDetails.class`.

**★ `type` restricts; it does not select.**
The default `{}` means "no restriction", not "none". Setting it can only ever remove beans from the
set that would otherwise have been created — it cannot add one, and it cannot make an unmatched
container match.

**★ RabbitMQ Streams is the one entry that is opt-in, and it also needs a port.**
It is explicitly excluded from "all applicable connection details beans". You must both list
`RabbitStreamConnectionDetails` in `type` and expose container port 5552. Doing only one of the two
produces no bean and no complaint about the other.

**★ TRACE logging is the diagnostic, and it is on the source class, not the factory.**
The rejections are logged by `ContainerConnectionSource`, so the useful logger is
`org.springframework.boot.testcontainers.service.connection`. Setting DEBUG is not enough for the
gate messages — they are TRACE.

## Interview questions

**★ Why does a `@Bean` method behave differently from a `static` field?**
Because Boot refuses to invoke the bean method during bean-definition registration just to read an
image name — the reference says that *"would cause eager initialization issues"* — so it matches on
the method's declared return type instead. A typed container like `Neo4jContainer` carries enough
information in its type; a `GenericContainer` does not, so you must supply `name` explicitly.

**★ You put `@ServiceConnection` on a `GenericContainer` `@Bean` returning a Redis image and it fails. Why, and what is the fix?**
The return type is `GenericContainer`, which no factory claims, and the image name was never read
because the method was never called, so there is no name to match either. All three gates therefore
fail for every factory, and `ConnectionDetailsRegistrar` rethrows the
`ConnectionDetailsFactoryNotFoundException` with the appended hint *"You may need to add a 'name'
to your @ServiceConnection annotation"*. The fix is `@ServiceConnection(name = "redis")` — which is
literally the sample Boot ships in its reference documentation.

**★ What is the `type` attribute for?**
To narrow the set of `ConnectionDetails` beans created from one container. By default every
applicable type is created — a `PostgreSQLContainer` yields both `JdbcConnectionDetails` and
`R2dbcConnectionDetails` — which you may not want on a mixed classpath. It is also the only way to
get `RabbitStreamConnectionDetails`, which Boot excludes from the default set.

**★ You added `@ServiceConnection` and the test still connects to your local database. What do you check, in order?**
First whether `spring-boot-testcontainers` is a test dependency, because without it nothing
processes the annotation and there is no error. Then whether some other bean of that
`ConnectionDetails` type already exists — `ConnectionDetailsRegistrar` skips registration when
`getBeanNamesForType` is non-empty and only logs it at DEBUG. Then enable
`logging.level.org.springframework.boot.testcontainers.service.connection=TRACE`, which prints
which of the three gates rejected the source, naming the field or method it came from.

**★ Which `@ServiceConnection` failures are loud and which are silent?**
Loud: no factory matched at all, which throws `ConnectionDetailsFactoryNotFoundException` or
`ConnectionDetailsNotFoundException`, with the `name` hint appended when the source had no
connection name. Silent: an existing bean of the same `ConnectionDetails` type, which is a DEBUG
line; and a factory whose required classes are missing, which is a `null` return. The loud ones
tell you what to do; the silent ones need TRACE.

**★ How are the generated beans named?**
`ConnectionDetailsRegistrar.getBeanName` builds `<connectionDetailsShortName>For<beanNameSuffix>`,
capitalising each part and then uncapitalising the whole — so they are recognisable in a
bean-definition dump and one container can contribute several without colliding. The definitions
also carry an attribute keyed on `ServiceConnection.class.getName()`, which is what excludes them
from AOT processing.

**★ Does `@ServiceConnection` work with Spring Boot's Docker Compose support too?**
The `ConnectionDetails` abstraction is shared, but the matching is not: Docker Compose service
connections are matched purely on **image name**, never on a Java container type, because there is
no Java object involved. The two catalogues therefore differ — see
[04b3](04b3-the-supported-services.md).

{/* FOOTER */}
