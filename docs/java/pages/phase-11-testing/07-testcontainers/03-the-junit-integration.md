---
title: "The Testcontainers JUnit 5 extension is a separate artifact, one @ExtendWith annotation and an empty marker annotation whose only job is to find fields that implement Startable — which is why it manages a WireMock server exactly as happily as it manages Postgres"
sidebar_label: "03 · The JUnit integration"
sidebar_position: 13
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-31 against the **Testcontainers 2.0.5 sources** at
> [tag `2.0.5`](https://github.com/testcontainers/testcontainers-java/tree/2.0.5) —
> [`TestcontainersExtension`](https://github.com/testcontainers/testcontainers-java/blob/2.0.5/modules/junit-jupiter/src/main/java/org/testcontainers/junit/jupiter/TestcontainersExtension.java),
> [`Testcontainers`](https://github.com/testcontainers/testcontainers-java/blob/2.0.5/modules/junit-jupiter/src/main/java/org/testcontainers/junit/jupiter/Testcontainers.java),
> [`Container`](https://github.com/testcontainers/testcontainers-java/blob/2.0.5/modules/junit-jupiter/src/main/java/org/testcontainers/junit/jupiter/Container.java),
> `Startable`, `GenericContainer`, `ContainerState` and the module's own test classes — plus the
> [JUnit 5 integration doc](https://github.com/testcontainers/testcontainers-java/blob/2.0.5/docs/test_framework_integration/junit_5.md)
> at the same tag, the **JUnit 6.0.3 user guide**
> ([Registering Extensions](https://docs.junit.org/6.0.3/extensions/registering-extensions.html),
> [Relative Execution Order](https://docs.junit.org/6.0.3/extensions/relative-execution-order-of-user-code-and-extensions.html))
> and [`ExtensionContext`](https://github.com/junit-team/junit-framework/blob/r6.0.3/junit-jupiter-api/src/main/java/org/junit/jupiter/api/extension/ExtensionContext.java)
> at tag `r6.0.3`.
> Version spine: JDK 25, Spring Boot 4.1.0, **Testcontainers 2.0.5**, JUnit Jupiter 6.0.3.
> ⚠️ **No Docker and no sandbox on this machine.** Nothing here is a container log, a timing or a
> test run — only source that was read and documentation that was quoted.

**[02](02-what-testcontainers-is.md) said the JUnit integration is one optional module and moved
on. This chunk is that module: what you have to add to the build, what the two annotations actually
declare, and the interface — not the class — that decides what the extension will manage. It is
genuinely small, and reading it is what makes the rest of this run predictable. The field modifier
that decides how many containers you get is [03b](03b-static-versus-instance.md); how a container is
actually stopped and every message the extension can throw is
[03c](03c-the-store-and-the-messages.md); why Boot 4.1 now steers you away from all of it for
Spring tests is [03d](03d-the-lifecycle-argument.md); and the two attributes and the `@Nested`
limitation are [03e](03e-the-switches-and-the-limits.md) and
[03f](03f-parallelism-and-nested.md).**

## It is a separate artifact, and you do not get it with core

The core `org.testcontainers:testcontainers` dependency contains no JUnit code at all. The
extension ships on its own:

```xml
<dependency>
    <groupId>org.testcontainers</groupId>
    <artifactId>testcontainers-junit-jupiter</artifactId>
    <scope>test</scope>
</dependency>
```

> *"Note that Jupiter/JUnit 5 integration is packaged as a separate library JAR"*

🔴 **The artifact name changed in 2.0.** It was `org.testcontainers:junit-jupiter` in 1.x; every
module gained a `testcontainers-` prefix, so it is now `testcontainers-junit-jupiter`. On a
Spring Boot 4.1 project the version comes from the BOM, so you omit it — but the *artifactId* in
every pre-2026 sample is wrong and will simply not resolve.

Because it is optional, the natural reading of a compile error is "I need a dependency". The
natural reading of a `@Container` field that silently never starts is much harder, and that is what
you get if you have the annotations on the classpath through a transitive dependency but never
wrote `@Testcontainers`. The failure table in [03c](03c-the-store-and-the-messages.md) names that
one specifically.

## `@Testcontainers` is one line of `@ExtendWith` plus two switches

```java
@Target(ElementType.TYPE)
@Retention(RetentionPolicy.RUNTIME)
@ExtendWith(TestcontainersExtension.class)
@Inherited
public @interface Testcontainers {
    boolean disabledWithoutDocker() default false;
    boolean parallel() default false;
}
```

Four things follow directly from that declaration, and all four matter:

- **`@Target(TYPE)`** — class level only. There is no method-level `@Testcontainers`.
- **`@Inherited`** — put it on an abstract base class and every subclass gets it. The javadoc says
  so: *"The annotation `@Testcontainers` can be used on a superclass in the test hierarchy as well.
  All subclasses will automatically inherit support for the extension."*
- **It is just `@ExtendWith`.** The annotation carries no logic. `TestcontainersExtension` does all
  the work, and it implements five JUnit interfaces: `BeforeAllCallback`, `AfterAllCallback`,
  `BeforeEachCallback`, `AfterEachCallback` and `ExecutionCondition`.
- **Both attributes default to `false`.** Nothing is parallel and nothing is skipped unless you ask.
  `disabledWithoutDocker` is [03e](03e-the-switches-and-the-limits.md)'s subject and `parallel` is
  [03f](03f-parallelism-and-nested.md)'s.

## `@Container` is an empty marker — and a legal meta-annotation

```java
@Target({ ElementType.FIELD, ElementType.ANNOTATION_TYPE })
@Retention(RetentionPolicy.RUNTIME)
public @interface Container {
}
```

No attributes at all. Everything about the lifecycle is decided by the *modifier on the field*, not
by anything you write in the annotation. That is the single most consequential design decision in
this module, and it is why [03b](03b-static-versus-instance.md) exists.

`ANNOTATION_TYPE` in the target list is not decoration — the extension finds fields with
`AnnotationSupport.isAnnotated`, which is meta-annotation aware, so you can compose your own:

```java
@Container
@ServiceConnection
@Retention(RetentionPolicy.RUNTIME)
@Target(ElementType.FIELD)
public @interface ProjectPostgres {
}

@Testcontainers
@SpringBootTest
class OrderRepositoryTests {

    @ProjectPostgres
    static PostgreSQLContainer postgres = new PostgreSQLContainer("postgres:18-alpine");
}
```

The module's own `MetaAnnotationTest` does exactly this with a `@TcContainer` annotation, so it is
a supported and tested path, not a trick.

## It is not a "container" extension — it is a `Startable` extension

The field type check is against an interface, not a class:

```java
boolean isStartable = Startable.class.isAssignableFrom(field.getType());
```

and the interface is four methods:

```java
public interface Startable extends AutoCloseable {
    default Set<Startable> getDependencies() { return Collections.emptySet(); }
    void start();
    void stop();
    @Override default void close() { stop(); }
}
```

So `@Container` works on **anything** you implement `Startable` on — a `Network`, a wrapper that
starts an embedded process, a fixture that seeds an external service, a composite that starts three
things at once. Nothing in the extension knows what Docker is:

```java
class WireMockFixture implements Startable {

    private final WireMockServer server = new WireMockServer(options().dynamicPort());

    @Override public void start() { server.start(); }
    @Override public void stop()  { server.stop(); }

    int port() { return server.port(); }
}

@Testcontainers
class PaymentClientTests {

    @Container
    static WireMockFixture wiremock = new WireMockFixture();
}
```

`getDependencies()` is the hook `Startables.deepStart` walks, so a composite can declare what has to
be up before it. That is also how the `parallel()` switch keeps ordering —
[03f](03f-parallelism-and-nested.md).

### And a second, richer hook: `TestLifecycleAware`

If a container additionally implements `TestLifecycleAware`, the extension calls it around every
test:

```java
public interface TestLifecycleAware {
    default void beforeTest(TestDescription description) {}
    default void afterTest(TestDescription description, Optional<Throwable> throwable) {}
}
```

Note the `Optional<Throwable>` — the extension passes `context.getExecutionException()`, so the
container is told **whether the test failed**. This is how a browser container records video only
for failures, and it is available to your own `Startable` implementations for free. The extension
tracks these separately for shared and per-method containers, under the store keys
`sharedLifecycleAwareContainers` and `localLifecycleAwareContainers`.

The description it hands over is built from `context.getUniqueId()` and a filesystem-friendly name
derived from the display name, so a `TestLifecycleAware` implementation can name artefacts after
the test that produced them.

## Gotchas

**★ The artifact is `testcontainers-junit-jupiter`, not `junit-jupiter`.**
Every module gained a `testcontainers-` prefix in 2.0.0. A copied 1.x `pom.xml` fragment does not
resolve, and the failure is a dependency-resolution error that says nothing about Testcontainers.
Core carries no JUnit code, so there is no fallback.

**★ `@Container` without `@Testcontainers` does absolutely nothing, silently.**
`@Container` is an empty marker with no extension attached. `@Testcontainers` is the `@ExtendWith`
that registers `TestcontainersExtension`. Without the class-level annotation nothing scans the
field, nothing calls `start()`, and the first `getMappedPort` or `getJdbcUrl` trips a precondition —
see the message table in [03c](03c-the-store-and-the-messages.md). No warning precedes it.

**★ There is no method-level `@Testcontainers`.**
`@Target(ElementType.TYPE)`. You cannot enable the extension for one method of a class. If only one
method needs a container you either pay for the whole class or move that method to its own class —
which, given the extension's per-class lifecycle, is usually the honest answer anyway.

**★ `@Container` on a non-`Startable` field fails at class start, not at compile time.**
`@Target(FIELD)` accepts any field type; the check is `Startable.class.isAssignableFrom(...)` at
runtime, producing `FieldName: %s does not implement Startable`. The usual way in is annotating the
`DataSource` or the JDBC URL string you derived from the container instead of the container itself.

**★ `@Container` is meta-annotation aware, which can surprise you.**
Field discovery uses `AnnotationSupport.isAnnotated`, which follows meta-annotations. A team-wide
composed annotation that happens to be meta-annotated `@Container` turns every field carrying it
into a managed container, in classes whose author never typed `@Container`. That is a feature when
you meant it and an invisible cost when you inherited it.

**★ `Startable.close()` delegates to `stop()`, so try-with-resources destroys a reusable container.**
`Startable extends AutoCloseable` and its default `close()` calls `stop()`. Wrapping a container in
try-with-resources therefore terminates it, which is exactly what the reuse feature forbids — see
[05b · Reuse: the opt-in](05b-reuse.md). It is also why the extension's `StoreAdapter` can implement
both `CloseableResource` and `AutoCloseable` and mean the same thing by either.

**★ A `Startable` that does slow work in `start()` blocks the whole class.**
The extension calls `start()` synchronously from `beforeAll` (or `beforeEach`) and, in the parallel
case, joins on the `CompletableFuture`. There is no timeout applied by the extension. A fixture that
hangs in `start()` hangs the test class, and the stack trace points at JUnit, not at your fixture.

## Interview questions

**★ Is the JUnit integration part of the Testcontainers core dependency?**
No. It is a separate artifact — `org.testcontainers:testcontainers-junit-jupiter`, renamed in 2.0.0
from `org.testcontainers:junit-jupiter` when every module gained the `testcontainers-` prefix. The
docs say so explicitly: *"Jupiter/JUnit 5 integration is packaged as a separate library JAR"*. Core
has no JUnit code at all, which is why Testcontainers works fine from a `main` method, from Spock,
or from Spring's own bean lifecycle.

**★ What does `@Testcontainers` actually do?**
Nothing itself — it is `@ExtendWith(TestcontainersExtension.class)` plus two boolean attributes,
`disabledWithoutDocker()` and `parallel()`, both defaulting to `false`. It is `@Inherited` and
targets types only. All behaviour lives in `TestcontainersExtension`, which implements
`BeforeAllCallback`, `AfterAllCallback`, `BeforeEachCallback`, `AfterEachCallback` and
`ExecutionCondition`.

**★ Can `@Container` be used on something that is not a container?**
Yes, and this is the most underused thing in the module. The type check is
`Startable.class.isAssignableFrom(field.getType())`, so anything implementing
`org.testcontainers.lifecycle.Startable` — `start()`, `stop()`, an optional `getDependencies()` and a
default `close()` that delegates to `stop()` — is managed identically. A WireMock server, an embedded
broker, a composite fixture that brings up three things: none of them involve Docker and all of them
get the same lifecycle.

**★ What is `TestLifecycleAware` and why would you implement it?**
An optional interface with `beforeTest(TestDescription)` and
`afterTest(TestDescription, Optional<Throwable>)`. The extension calls both around every test for
any managed `Startable` that implements it, passing `context.getExecutionException()` as the
throwable — so the container is told whether the test failed. That is how a browser container decides
whether to keep a recording. The `TestDescription` is built from the test's unique id and a
filesystem-friendly display name, so artefacts can be named after the test that produced them.

**★ How would you write your own `@Container`-style annotation for your team?**
Meta-annotate it. `@Container` targets `ANNOTATION_TYPE` as well as `FIELD`, and discovery uses
`AnnotationSupport.isAnnotated`, which is meta-annotation aware. A `@ProjectPostgres` annotation that
carries `@Container` and `@ServiceConnection` together removes a whole class of copy-paste error. The
module's own `MetaAnnotationTest` proves the mechanism with a `@TcContainer` annotation.

**★ Why does the extension model the container as `Startable` rather than as `GenericContainer`?**
Because it lets the extension know nothing about Docker. `getDependencies()` on the interface is
what `Startables.deepStart` walks to build a start order, so a composite fixture can declare that it
needs another `Startable` up first, and the extension's parallel mode still honours it. Modelling on
a concrete container class would have made the extension untestable without a daemon and would have
excluded every non-Docker fixture.

{/* FOOTER */}
