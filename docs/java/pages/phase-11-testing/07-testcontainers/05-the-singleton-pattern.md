---
title: "The JUnit extension stops a static @Container when the test class ends and an instance @Container after every single test method, so a suite of twenty integration classes pays for twenty container starts — the singleton pattern is a plain static field that is started once, never stopped, and left to Ryuk"
sidebar_label: "05 · The singleton pattern"
sidebar_position: 40
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-31 against the **Testcontainers 2.0.5 source tarball**
> ([tag `2.0.5`](https://github.com/testcontainers/testcontainers-java/tree/2.0.5)) — read directly:
> `modules/junit-jupiter/src/main/java/org/testcontainers/junit/jupiter/TestcontainersExtension.java`
> and `Testcontainers.java` (whose javadoc is quoted verbatim), and
> `core/src/main/java/org/testcontainers/containers/GenericContainer.java`.
> Version spine from `spring-boot-dependencies:4.1.0`: JDK 25, Spring Boot 4.1.0,
> **Testcontainers 2.0.5**, JUnit Jupiter 6.0.3.
> ⚠️ **No Docker and no sandbox on this machine.** Nothing on this page is a container log, a
> startup timing or a test run. Every claim about lifecycle is read out of the source above.

**[02](02-what-testcontainers-is.md) described what a container gives you. This chunk is about how
many of them you accidentally start. The JUnit integration's lifecycle is not "one container for
the suite" and was never advertised as one — it is one container per test *class* for a static
field and one per test *method* for an instance field. The singleton pattern is the deliberate
refusal of that lifecycle: a `static` field the extension never sees, started in a static
initialiser, never stopped, and reaped by Ryuk when the JVM dies.**

## What the extension actually does with your field

`TestcontainersExtension` implements `BeforeAllCallback`, `BeforeEachCallback`, `AfterAllCallback`,
`AfterEachCallback` and `ExecutionCondition`. The two callbacks that start containers do it from
two different scans:

```java
// beforeAll  — "shared" containers
private Predicate<Field> isSharedContainer() {
    return isContainer().and(ModifierSupport::isStatic);
}

// beforeEach — "restart" containers
private Predicate<Field> isRestartContainer() {
    return isContainer().and(ModifierSupport::isNotStatic);
}
```

The names in the source are the whole story: a **static** `@Container` field is *shared*, a
**non-static** one is a *restart* container. Both are wrapped in a `StoreAdapter` and put into the
JUnit `ExtensionContext.Store` for the context that started them:

```java
store.getOrComputeIfAbsent(adapter.getKey(), k -> adapter.start());
```

`StoreAdapter`'s own javadoc says what happens next:

> *"An adapter for `Startable` that implement `CloseableResource` thereby letting the JUnit
> automatically stop containers once the current `ExtensionContext` is closed."*

```java
private StoreAdapter start() {
    container.start();
    return this;
}

@Override
public void close() {
    container.stop();
}
```

Nothing in `afterAll` or `afterEach` stops a container — those two callbacks only signal
`TestLifecycleAware` containers. **The stop is JUnit's store cleanup**, and it fires when the
owning context closes: the class-level context after the class, the method-level context after
each method. That is why the lifecycle is exactly what `@Testcontainers`' javadoc states:

> *"Containers declared as static fields will be shared between test methods. They will be started
> only once before any test method is executed and stopped after the last test method has
> executed. Containers declared as instance fields will be started and stopped for every test
> method."*

## The arithmetic, argued from that lifecycle rather than from a stopwatch

| Declaration | Started | Stopped | Container starts in a suite of `C` classes averaging `M` methods |
|---|---|---|---|
| `@Container` instance field | `beforeEach` | after each method | `C × M` |
| `@Container` static field | `beforeAll` | after the class | `C` |
| static field, no `@Container` | your static initialiser | never | **1 per JVM** |

Each start is a `docker create` plus a `docker start` plus a wait strategy that polls until the
service inside answers — the wait is the part you cannot skip, because a running container is not
a ready database ([02](02-what-testcontainers-is.md)). The image is pulled once and cached, so
what repeats is process startup and readiness, not download.

⚠️ **There is no Docker on this machine and this page gives you no seconds-per-start number.** You
do not need one to see the shape: a non-static `@Container` multiplies that cost by your method
count, and nothing about the test gets more correct in exchange. **If you take one thing from this
page: a `@Container` field should essentially always be `static`.** The instance form exists for
tests that genuinely need a pristine container per method, and those are rare enough that you
should be able to name the reason out loud.

## `start()` and `stop()` are guarded on `containerId` — which is why inheritance does not save you

The obvious move — put the static `@Container` on an abstract base class and extend it everywhere —
does not produce one container. `findSharedContainers` uses
`ReflectionSupport.findFields(testClass, isSharedContainer(), HierarchyTraversalMode.TOP_DOWN)`,
so the inherited field *is* found for every subclass. And `GenericContainer`'s two lifecycle
methods are guarded on a field that `stop()` clears:

```java
@Override
public void start() {
    if (containerId != null) {
        return;                       // already running: no-op
    }
    Startables.deepStart(dependencies).get();
    dockerClient.authConfig();
    doStart();
}

@Override
public void stop() {
    if (containerId == null) {
        return;
    }
    try {
        containerIsStopping(containerInfo);
        ResourceReaper.instance().stopAndRemoveContainer(containerId, imageName);
        containerIsStopped(containerInfo);
    } finally {
        containerId = null;           // <- the guard is reset
        containerInfo = null;
    }
}
```

So the sequence for class A then class B is: A's store starts it, A's store closes and stops it and
nulls `containerId`, B's store starts it **again** — a second container, from the same Java object.
The static field gave you a shared *reference*, not a shared *container*.

**The fix is to remove the annotation, not to move the field.** `@Container` is what enrols the
field in the extension's store; a static field without it is invisible to the extension and is
never stopped.

## The pattern itself

### The abstract base class

```java
public abstract class AbstractPostgresIntegrationTest {

    // deliberately NOT annotated with @Container, and the class is
    // deliberately NOT annotated with @Testcontainers
    protected static final PostgreSQLContainer POSTGRES =
            new PostgreSQLContainer("postgres:18-alpine")
                    .withDatabaseName("app")
                    .withUsername("app")
                    .withPassword("app");

    static {
        POSTGRES.start();   // once, when this class is first initialised
    }

    // there is no @AfterAll, and there is deliberately no stop()
}
```

Three things are load-bearing and all three are omissions:

1. **No `@Testcontainers`** — the extension is not registered, so nothing scans for fields.
2. **No `@Container`** — even if the extension were registered by some other base class, the field
   would not be enrolled.
3. **No `stop()`, no `close()`, no try-with-resources.** The container outlives every test class.

The `static` block is a class initialiser (`<clinit>`), which the JVM runs **once per class per
classloader**, under the JVM's own initialisation lock. That is the actual singleton guarantee —
you are not writing double-checked locking, you are letting class initialisation do it. Note that
Gradle's and Maven's forked test JVMs each get their own classloader and therefore their own
container; `forkEvery` and `maxParallelForks` multiply your singletons by the number of JVMs.

Note the 2.x constructor: `new PostgreSQLContainer("postgres:18-alpine")` with **no diamond**.
`org.testcontainers.postgresql.PostgreSQLContainer` is not generic in 2.0.5, and there is no
no-argument constructor — see [02](02-what-testcontainers-is.md).

## Where this goes next

This chunk covered the lifecycle and the base-class form. Three things it deliberately left out:

- **the other two shapes, the property wiring, and what a failed static initialiser does to the
  rest of the run** — [05a](05a-holders-interfaces-and-wiring.md);
- **why never calling `stop()` is not a leak** — [05a2](05a2-ryuk-and-cleanup.md);
- 🔴 **what a shared container costs you**, including the interaction with Spring's context cache
  that makes Boot 4.1 recommend a different approach entirely —
  [05a3](05a3-the-cost-of-sharing.md), and what changes when the suite runs in parallel —
  [05a4](05a4-parallel-execution.md).

The extension's own configuration errors, `@Nested` behaviour and `disabledWithoutDocker` belong to
**03 · The JUnit integration** *(not written yet)*.

## Gotchas

**★ A non-static `@Container` field starts a fresh container for every `@Test` method.**
The extension's own predicate is `isContainer().and(ModifierSupport::isNotStatic)` and it runs in
`beforeEach`. Twelve methods, twelve containers, sequentially. Making the field `static` is a
one-word change and is almost always right.

**★ Moving a static `@Container` onto an abstract base class does not give you one container.**
`findSharedContainers` walks the hierarchy `TOP_DOWN`, so each subclass's `beforeAll` finds the
inherited field, and each class's store close calls `stop()`, which nulls `containerId` and lets
the next `start()` create a new container. Drop `@Container` and `@Testcontainers` and start it in
a static block instead.

**★ `@Testcontainers` is `@Inherited`.**
Its declaration carries `@Inherited`, and the extension's `findTestcontainers` additionally walks
the `ExtensionContext` parents. So a base class you forgot about can re-enrol your fields. If you
mean to use the singleton pattern, grep the hierarchy for `@Testcontainers` before you conclude it
is not being applied.

**★ Forgetting `start()` in the singleton, and getting a confusing failure instead of a clear one.**
Without the extension nothing starts the container for you. `getJdbcUrl()` on an unstarted
`PostgreSQLContainer` has no mapped port to report. Keep the `static { … }` block adjacent to the
field so the two are read together.

**★ Leaving `@Container` on the field *and* starting it in a static block.**
`start()` is a no-op while `containerId != null`, so this looks fine — until the first class ends,
the store closes, `stop()` runs, and the second class silently gets a new container plus whatever
your `@DynamicPropertySource` captured from the old one. Pick one owner of the lifecycle.

**★ `forkEvery` / `maxParallelForks` multiply your singleton.**
A class initialiser runs once per classloader, and every forked test JVM has its own. Gradle's
`maxParallelForks = 4` gives you four Postgres containers, each perfectly valid, none shared. That
is usually acceptable; it is not "one container".

**★ `@Container` finds `private` fields too, so "it is private, the extension cannot see it" is wrong.**
`getContainerInstance` calls `field.setAccessible(true)` before reading. Visibility has no bearing
on enrolment; only the `@Container` annotation and the `static` modifier do.

**★ Reading the container field from a `@BeforeAll` is not what starts it.**
The static initialiser runs on first *active use* of the class — which for a subclass means the
superclass is initialised first. So the container is already up before any JUnit callback runs,
which is the property that makes `@DynamicPropertySource` on the same class safe.

**★ Two different `@Container` fields with the same name in different classes are not the same store entry.**
The store key is `declaringClass.getName() + "." + fieldName`, so name collisions across classes
are harmless. What is *not* harmless is the same declaring class being scanned by two contexts —
which is exactly the inherited-field case above.

## Interview questions

**★ How many containers does a `@Container` field start over a suite?**
It depends on one modifier. A non-static field is a "restart" container: the extension starts it in
`beforeEach` and JUnit's store cleanup stops it after each test method, so you pay one container per
test method. A static field is a "shared" container: started in `beforeAll`, stopped when the
class-level extension context closes, so you pay one per test class. Neither is one per suite.

**★ What actually stops the container — `afterAll`?**
No. `afterAll` and `afterEach` only signal `TestLifecycleAware` containers. The stop comes from
`StoreAdapter`, which the extension puts into the JUnit `ExtensionContext.Store` and which
implements `CloseableResource`/`AutoCloseable` with `close()` calling `container.stop()`. JUnit
closes store entries when the owning context closes, so the scope of the store entry — class-level
or method-level — is the scope of the container.

**★ Describe the singleton pattern and the three things it deliberately omits.**
A `static` container field, started once from a static initialiser, shared by every test class.
It omits `@Testcontainers` (so no extension is registered), `@Container` (so no field is enrolled)
and any call to `stop()` or `close()` (so nothing tears it down mid-suite). The container lives for
the life of the JVM and Ryuk removes it when the JVM exits.

**★ Why does putting the static `@Container` on a shared base class not achieve the same thing?**
Because the extension finds inherited fields — `findFields(..., HierarchyTraversalMode.TOP_DOWN)` —
so every subclass enrols it, and every subclass's store close calls `stop()`. `stop()` nulls
`containerId`, which is the guard `start()` checks, so the next class's `beforeAll` creates a brand
new container from the same Java object. You get one *reference*, not one *container*.

**★ What guarantees the container is started exactly once in the singleton pattern?**
JVM class initialisation. The `static { … }` block is `<clinit>`, which the JVM runs at most once
per class per classloader under its own initialisation lock. You are not writing synchronisation;
you are reusing the one the JVM already has. The caveat is that a forked test JVM has its own
classloader, so `forkEvery`/`maxParallelForks` gives you one container per fork.


**★ Does making the `@Container` field `private` stop the extension from managing it?**
No. The extension calls `field.setAccessible(true)` before reading the value. Enrolment depends on
the `@Container` annotation and on the `static` modifier, not on visibility.

**★ Why is the container guaranteed to be running before `@BeforeAll` in the singleton pattern?**
Because initialising a subclass initialises its superclass first, and JUnit must load and
initialise the test class before it can invoke anything on it. The `static` block therefore
completes before any JUnit callback, which is why a `@DynamicPropertySource` method on the same
class can rely on the mapped port existing.

{/* FOOTER */}
