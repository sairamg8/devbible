---
title: "The abstract base class is one of three shapes a singleton container can take, and the two alternatives — a holder class and an interface handed to @ImportTestcontainers — differ in what they cost you and in who ends up owning the lifecycle; then there is the wiring, and the NoClassDefFoundError wall a failed static initialiser leaves across the rest of the run"
sidebar_label: "05a · Holders, interfaces, wiring"
sidebar_position: 31
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-31 against the **Testcontainers 2.0.5 source tarball**
> ([tag `2.0.5`](https://github.com/testcontainers/testcontainers-java/tree/2.0.5)) and the
> **Spring Boot 4.1.1** sources at [tag `v4.1.0`](https://github.com/spring-projects/spring-boot/tree/v4.1.0) —
> `documentation/…/reference/pages/testing/testcontainers.adoc`, its `MyContainers` /
> `MyTestConfiguration` / `MyIntegrationTests` samples, and
> `core/spring-boot-testcontainers/src/main/java/org/springframework/boot/testcontainers/context/{ImportTestcontainers,ContainerFieldsImporter}.java`,
> all read directly. Class-initialisation semantics are quoted verbatim from **JLS SE 25 §12.4.2**
> ([docs.oracle.com](https://docs.oracle.com/javase/specs/jls/se25/html/jls-12.html)).
> Version spine from `spring-boot-dependencies:4.1.1`: JDK 25, Spring Boot 4.1.1,
> **Testcontainers 2.0.5**, JUnit Jupiter 6.0.3.
> ⚠️ **No Docker and no sandbox on this machine** — nothing below is a container log, a timing or a
> test run.

**[05](05-the-singleton-pattern.md) built the singleton as an abstract base class, which is the
form most codebases reach for and the form that quietly spends your one inheritance slot. This
chunk covers the two alternatives, the property wiring that any of them needs, and the failure mode
that makes a broken singleton so hard to read: one class reports the real cause and every other
class reports `NoClassDefFoundError`.**

## The holder class

Java gives you one superclass. Spending it on `AbstractPostgresIntegrationTest` means you cannot
also extend the abstract base your team uses for authentication fixtures, and it means every
integration test in the codebase is coupled to a class whose only job is holding a container. The
holder avoids all of that:

```java
public final class Containers {

    public static final PostgreSQLContainer POSTGRES =
            new PostgreSQLContainer("postgres:18-alpine");

    static {
        POSTGRES.start();
    }

    private Containers() {}
}
```

Initialisation still happens exactly once, on first *active use* of the class — and reading a
`static final` field whose type is a reference type is an active use, so `Containers.POSTGRES`
triggers `<clinit>`. (A `static final` field of a *primitive* type initialised with a compile-time
constant would not; that is the compile-time-constant rule, and it does not apply to a container
reference.)

The cost is that nothing forces a test to use it, so the coupling that inheritance made explicit
becomes a convention. In practice that is a good trade: tests that need Postgres reference
`Containers.POSTGRES` in their `@DynamicPropertySource`, and tests that do not, do not pay for it.

## The interface, and what Spring Boot does with one

Boot names this shape directly:

> *"A common pattern with Testcontainers is to declare the container instances as static fields in
> an interface."*

Its own sample, from `documentation/…/importingconfigurationinterfaces/MyContainers.java`:

```java
interface MyContainers {

    @Container
    MongoDBContainer mongoContainer = new MongoDBContainer("mongo:5.0");

    @Container
    Neo4jContainer neo4jContainer = new Neo4jContainer("neo4j:5");
}
```

Interface fields are implicitly `public static final`, so this is the same static-field idea with
less ceremony — and a test class can `implements MyContainers` to pull the names into scope without
spending its superclass.

🔴 **But an interface has no static initialiser**, so this form has nowhere to call `start()`. The
field initialiser can construct a container and nothing more. That is why Boot's version of the
pattern is not a singleton at all: it hands the declarations to Spring.

```java
@TestConfiguration(proxyBeanMethods = false)
@ImportTestcontainers(MyContainers.class)
class MyTestConfiguration {}
```

`@ImportTestcontainers`' own javadoc states exactly what it takes:

> *"Imports idiomatic Testcontainers declaration classes into the Spring `ApplicationContext`. The
> following elements will be considered from the imported classes: All static fields that declare
> `Container` values. All `@DynamicPropertySource` annotated methods."*

Reading `ContainerFieldsImporter` pins down the rules the javadoc summarises:

- a field qualifies if `Container.class.isAssignableFrom(candidate.getType())` — **the `@Container`
  annotation is not consulted at all.** Boot's sample carries it because the same interface can
  then also be used with the JUnit extension; `@ImportTestcontainers` ignores it;
- the field must be static: `Assert.state(Modifier.isStatic(...), "Container field 'x' must be
  static")`;
- the field must not be null: *"Container field 'x' must not have a null value"* — which it will be
  if you declared it without an initialiser;
- each field becomes a bean definition named
  `importTestContainer.<declaring class>.<field name>`;
- `@ImportTestcontainers` with no `value()` searches the annotating class itself.

Once the container is a bean, **Spring owns the lifecycle** — started before all other beans,
stopped after them, and tied to the cached application context rather than to the JVM. That is a
genuinely different design from the singleton, it is what Boot 4.1 recommends, and the reasons are
in [05a3](05a3-the-cost-of-sharing.md) and in [04 · @ServiceConnection](04-serviceconnection.md).

## Wiring any of them into Spring

A singleton is started before Spring is, so its host and mapped port already exist by the time the
context is built. The classic wiring is a static `@DynamicPropertySource` method next to the field:

```java
public abstract class AbstractPostgresIntegrationTest {

    protected static final PostgreSQLContainer POSTGRES =
            new PostgreSQLContainer("postgres:18-alpine");

    static {
        POSTGRES.start();
    }

    @DynamicPropertySource
    static void datasourceProperties(DynamicPropertyRegistry registry) {
        registry.add("spring.datasource.url", POSTGRES::getJdbcUrl);
        registry.add("spring.datasource.username", POSTGRES::getUsername);
        registry.add("spring.datasource.password", POSTGRES::getPassword);
    }
}
```

The method references are load-bearing. `getJdbcUrl()` is only correct **after** the container has
started, because the host port is assigned at start time; `registry.add` takes a `Supplier` so that
the read is deferred. With a singleton the eager form `registry.add(key, POSTGRES.getJdbcUrl())`
happens to work, because the static block has already run — which is worse than failing, because
the habit then gets copied into a test where the container is started by the extension and the
value is read too early.

Boot 4.1 also offers `DynamicPropertyRegistrar`, the `@Bean`-friendly form that does not require a
static method; the full comparison belongs to [04c · @DynamicPropertySource](04c-dynamicpropertysource.md).

⚠️ These properties become part of the context's merged configuration, so **every test class that
extends this base shares one context cache key** — which is exactly what you want, and is the thing
[05a3](05a3-the-cost-of-sharing.md) takes apart.

## What a failed static initialiser does to the rest of the suite

The JUnit extension has an escape hatch for a machine without Docker:
`@Testcontainers(disabledWithoutDocker = true)` registers an `ExecutionCondition` that returns
`ConditionEvaluationResult.disabled("disabledWithoutDocker is true and Docker is not available")`.
**A singleton registers no extension and therefore has no such hatch**, and the resulting failure is
much harder to read than it needs to be.

`POSTGRES.start()` inside a `static` block throws `ContainerLaunchException` when there is no
daemon to talk to. JLS SE 25 §12.4.2 step 11 then applies:

> *"If the class of E is not `Error` or one of its subclasses, then create a new instance of the
> class `ExceptionInInitializerError`, with E as the argument, and use this object in place of E in
> the following step."*

then step 12:

> *"Acquire `LC`, label the `Class` object for C as erroneous, notify all waiting threads, release
> `LC`, and complete this procedure abruptly with reason E …"*

and every later attempt hits step 5:

> *"If the `Class` object for C is in an erroneous state, then initialization is not possible.
> Release `LC` and throw a `NoClassDefFoundError`."*

So **exactly one** test class reports the real cause, wrapped in `ExceptionInInitializerError`, and
every other class that touches the base reports a bare `NoClassDefFoundError` naming your base
class and saying nothing about Docker. When you are handed a wall of *"Could not initialize class
AbstractPostgresIntegrationTest"*, the interesting exception is in the **first** failing class in
execution order, not the loudest or the last.

If you want skip-instead-of-fail behaviour with a singleton, you have to write the condition
yourself — a JUnit `ExecutionCondition` or an `@EnabledIf` on the base class — because the flag you
would have used lives on the annotation you deliberately did not apply.

## Gotchas

**★ An interface cannot have a static initialiser, so the interface form cannot start its own containers.**
Interface fields are implicitly `public static final` but there is no `<clinit>` you can write.
Either keep the declarations in a class, or hand the interface to `@ImportTestcontainers` and let
Spring start them — which is a different lifecycle, not a cosmetic change.

**★ `@Container` on an interface field does nothing for `@ImportTestcontainers`.**
`ContainerFieldsImporter.isContainerField` tests only `Container.class.isAssignableFrom(type)`.
The annotation in Boot's sample exists so the same interface can also be consumed by the JUnit
extension. Removing it does not break the import; adding it does not make the import happen.

**★ A `Container` field declared in an imported class without an initialiser fails at context build.**
`ContainerFieldsImporter` asserts *"Container field 'x' must not have a null value"*. A field you
meant to assign in a `@BeforeAll` is null when the registrar reads it, and you get a context
failure rather than a test failure.

**★ A non-static `Container` field in an imported class fails too, with a different message.**
*"Container field 'x' must be static"*. `@ImportTestcontainers` has no instance-field mode at all —
unlike the JUnit extension, which has one and starts it per test method.

**★ Capturing `getJdbcUrl()` eagerly instead of as a supplier.**
`registry.add("spring.datasource.url", POSTGRES.getJdbcUrl())` reads the value at method-invocation
time. With a singleton it is correct by accident, because the static block already ran — so the bug
travels to the next test you write and fails there instead. Always pass the method reference.

**★ Assuming the holder is initialised because it was imported.**
Class initialisation happens on first *active use*, not on import and not on class loading. If a
test only mentions `Containers` in a comment or in a type position that the compiler folds away,
nothing starts. Referencing `Containers.POSTGRES` in the `@DynamicPropertySource` is what triggers
it — which is the same statement that needs the container, so this rarely bites, but it is the
reason "I imported the holder and nothing happened" is not a paradox.

**★ Expecting `disabledWithoutDocker` to apply to a singleton.**
It is an attribute of `@Testcontainers`, evaluated by the extension you are not registering. Without
Docker the singleton fails in `<clinit>` and the class is permanently erroneous for that JVM.

**★ Reading the last `NoClassDefFoundError` in the log instead of the first failure.**
Only the first initialisation attempt carries the cause. Every subsequent one is JLS §12.4.2 step 5
throwing on an already-erroneous class, with no `cause` attached to explain it.

**★ Mixing `@ImportTestcontainers` with a static `start()` block on the same declarations.**
Then two owners exist: your static block and Spring's container-bean lifecycle. Spring will stop
the container when the context shuts down, and your static block will never run again, because
`<clinit>` runs once. Pick one owner.

## Interview questions

**★ What does the abstract-base-class singleton cost you, and what are the alternatives?**
It costs the single superclass slot and couples every integration test to a class whose job is
holding a container. The alternatives are a final holder class with a private constructor, which
tests reference by name, and an interface of static fields, which a test can `implements` or which
you can hand to Spring Boot's `@ImportTestcontainers`. The holder keeps the singleton lifecycle;
the interface plus `@ImportTestcontainers` gives the lifecycle to Spring.

**★ Why can the interface form not start its own container?**
Because an interface has no static initialiser. Its fields are implicitly `public static final` and
can be given a field initialiser, which constructs the container, but there is no block in which to
call `start()`. Boot's answer is `@ImportTestcontainers`, which registers each static `Container`
field as a bean so that Spring starts it.

**★ What exactly does `@ImportTestcontainers` import?**
Per its javadoc: all static fields declaring `Container` values, and all `@DynamicPropertySource`
annotated methods, from the classes named in `value()` — or from the annotated class itself if
`value()` is empty. Fields are matched on assignability to `org.testcontainers.containers.Container`,
not on the `@Container` annotation; they must be static and non-null, and each becomes a bean named
`importTestContainer.<declaring class>.<field name>`.

**★ Why does `@DynamicPropertySource` take suppliers rather than values?**
Because a container's mapped host port does not exist until it has started, and the registry is
populated while the context is being built. `registry.add(key, POSTGRES::getJdbcUrl)` defers the
read; `registry.add(key, POSTGRES.getJdbcUrl())` performs it immediately. With a singleton the eager
form works by accident because `<clinit>` already ran, which makes it a bug that only surfaces once
someone copies the line into an extension-managed test.

**★ Your CI run shows sixty `NoClassDefFoundError: Could not initialize class AbstractIntegrationTest` failures. Where do you look?**
At the first failing class in execution order. The base class's static initialiser threw once — most
likely `ContainerLaunchException` because no Docker daemon was reachable — and JLS §12.4.2 wrapped
it in `ExceptionInInitializerError`, marked the class erroneous, and made every later initialisation
attempt throw `NoClassDefFoundError` with no cause. Fifty-nine of those sixty failures carry no
information.

**★ Does `@Testcontainers(disabledWithoutDocker = true)` protect a singleton?**
No. It is an `ExecutionCondition` contributed by the Testcontainers JUnit extension, and the
singleton pattern exists precisely to avoid registering that extension. Without Docker the singleton
fails hard during class initialisation. If you need "skip rather than fail", you write the condition
yourself on the base class.

**★ When does a `static final` container field trigger class initialisation?**
On first active use of the declaring class, which includes reading that field, because its type is a
reference type. The compile-time-constant exemption that lets you read a `static final int` without
initialising the class does not apply to object references, so `Containers.POSTGRES` always
initialises `Containers`.

{/* FOOTER */}
