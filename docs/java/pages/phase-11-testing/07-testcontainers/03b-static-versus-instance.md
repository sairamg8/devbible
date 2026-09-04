---
title: "Whether a @Container field is static decides whether you start one container for the whole test class or one for every single test method, and the only thing that tells you which you chose is the modifier — no attribute, no warning, no log line"
sidebar_label: "03b · static vs instance"
sidebar_position: 14
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-31 against the **Testcontainers 2.0.5 sources** at
> [tag `2.0.5`](https://github.com/testcontainers/testcontainers-java/tree/2.0.5) —
> [`TestcontainersExtension`](https://github.com/testcontainers/testcontainers-java/blob/2.0.5/modules/junit-jupiter/src/main/java/org/testcontainers/junit/jupiter/TestcontainersExtension.java)
> and the module's own maintained tests
> ([`inheritance/AbstractTestBase`](https://github.com/testcontainers/testcontainers-java/blob/2.0.5/modules/junit-jupiter/src/test/java/org/testcontainers/junit/jupiter/inheritance/AbstractTestBase.java),
> [`inheritance/InheritedTests`](https://github.com/testcontainers/testcontainers-java/blob/2.0.5/modules/junit-jupiter/src/test/java/org/testcontainers/junit/jupiter/inheritance/InheritedTests.java)) —
> plus the [JUnit 5 integration doc](https://github.com/testcontainers/testcontainers-java/blob/2.0.5/docs/test_framework_integration/junit_5.md)
> at the same tag and the **JUnit 6.0.3 user guide**
> ([Relative Execution Order](https://docs.junit.org/6.0.3/extensions/relative-execution-order-of-user-code-and-extensions.html)).
> Version spine: JDK 25, Spring Boot 4.1.1, **Testcontainers 2.0.5**, JUnit Jupiter 6.0.3.
> ⚠️ **No Docker and no sandbox on this machine.** Nothing here is a container log, a timing or a
> test run — only source that was read and documentation that was quoted.

**[03](03-the-junit-integration.md) established that `@Container` has no attributes at all. This is
the consequence: the entire lifecycle configuration surface of the extension is the `static`
keyword. Get it right and a class starts one container. Get it wrong and the same class starts one
container per test method, and nothing anywhere tells you which happened.**

## 🔴 static versus instance — the whole mechanic, in one predicate

The extension's field selection is two lines:

```java
private Predicate<Field> isSharedContainer() {
    return isContainer().and(ModifierSupport::isStatic);
}

private Predicate<Field> isRestartContainer() {
    return isContainer().and(ModifierSupport::isNotStatic);
}
```

`isSharedContainer()` is used from `beforeAll`. `isRestartContainer()` is used from `beforeEach`.
That is the entire rule. The `@Testcontainers` javadoc states the consequence:

> *"Containers declared as static fields will be shared between test methods. They will be started
> only once before any test method is executed and stopped after the last test method has executed.
> Containers declared as instance fields will be started and stopped for every test method."*

### What each one costs

```java
@Testcontainers
class SharedTests {

    // ONE container. Started once before the first test, stopped after the last.
    // Every test method sees the same database, including everything the previous test wrote.
    @Container
    static PostgreSQLContainer postgres = new PostgreSQLContainer("postgres:18-alpine");
}
```

```java
@Testcontainers
class RestartedTests {

    // ONE CONTAINER PER TEST METHOD. Ten @Test methods means ten image starts,
    // ten schema migrations, ten teardowns. Perfect isolation, ruinous cost.
    @Container
    PostgreSQLContainer postgres = new PostgreSQLContainer("postgres:18-alpine");
}
```

The difference between those two files is the word `static`. There is no annotation attribute, no
log line at INFO, and no compiler warning. A refactor that moves a field into a base class and
drops `static` to make it "cleaner" silently converts a class that started one container into a
class that starts one per method.

### The maintained test that proves both at once

The Testcontainers project's own `inheritance` test package is the cleanest possible statement of
the semantics, and it is worth reading rather than paraphrasing:

```java
@Testcontainers
abstract class AbstractTestBase {

    @Container
    static RedisContainer redisPerClass = new RedisContainer();

    @Container
    RedisContainer redisPerTest = new RedisContainer();
}

class InheritedTests extends AbstractTestBase {

    @Container
    private RedisContainer myRedis = new RedisContainer();

    @Test
    void step1() {
        assertThat(redisPerClass.getJedis().incr("key")).isEqualTo(1);
        assertThat(redisPerTest.getJedis().incr("key")).isEqualTo(1);
    }

    @Test
    void step2() {
        assertThat(redisPerClass.getJedis().incr("key")).isEqualTo(2);
        assertThat(redisPerTest.getJedis().incr("key")).isEqualTo(1);
    }
}
```

`INCR` on a fresh Redis returns 1. The static container's counter reaches **2** in the second
method, because it is the same Redis with the same keyspace. The instance container's counter is
**1** again, because it is a different Redis that has never seen the key. The assertions are the
lifecycle.

Notice also what the base class demonstrates: `@Testcontainers` is inherited, and both a `static`
and a non-`static` `@Container` field declared on a superclass are found — the extension scans with
`HierarchyTraversalMode.TOP_DOWN`, so superclass fields are discovered and are ordered before the
subclass's own.

### Which one you actually want

**Almost always `static`**, and it is worth being blunt about why the per-method form is a trap
rather than a trade-off. A test suite needs *state* isolation between methods, not *process*
isolation. Restarting a container gives you state isolation as a side effect of throwing away the
entire process, which is the most expensive way to obtain it. A transaction rolled back after each
test, or a truncate, gives you the same isolation for a rounding error of the cost — that is
[06d · The rollback strategy](06d-the-rollback-strategy.md) and
[06e · Truncating between tests](06e-truncating-between-tests.md).

The one honest use for a non-static `@Container` is a test whose subject *is* the container's
startup — a migration that must run against a virgin database, a bootstrap path that only executes
once per process, a test asserting the initial state of a broker. That is a handful of methods in a
suite, not a default.

## Where the extension reads each kind of field

The two predicates are used from two different callbacks, and the callback is what fixes the
lifetime:

| Field | Found by | JUnit callback | Extension context | Lifetime |
|---|---|---|---|---|
| `static` | `findSharedContainers(testClass)` | `beforeAll` | class-level | started before the first test method, stopped when the class context ends |
| instance | `findRestartContainers(testInstance)` | `beforeEach` | method-level | started before every test method, stopped when that method's context ends |

Two details in `beforeEach` are easy to miss and both change behaviour:

- It scans **`collectParentTestInstances(context)`**, which is
  `context.getRequiredTestInstances().getAllInstances()` reversed into a `LinkedHashSet`. For a
  `@Nested` class that is the outer instance *and* the nested instance, so an instance `@Container`
  on the **enclosing** class is restarted for every nested test method too.
- It builds the list with `.parallelStream()`. That is field *discovery*, not container startup;
  startup is still sequential unless `parallel = true`.

## `@BeforeAll` runs after the container is already up

This one is documented and worth being certain about, because it is where people try to assign the
field. The JUnit user guide's table of the sixteen steps around a test class lists, in order:

> 1. *"interface `org.junit.jupiter.api.extension.BeforeAllCallback` — extension code executed
>    before all tests of the container are executed"*
> 2. *"annotation `org.junit.jupiter.api.BeforeAll` — user code executed before all tests of the
>    container are executed"*

and the same table puts `BeforeEachCallback` (step 5) before `@BeforeEach` (step 6). So a `static`
container is running by the time your `@BeforeAll` runs, and an instance container is running by
the time your `@BeforeEach` runs. You can read `getJdbcUrl()` in either.

The converse also holds and is the failure people actually hit: **you cannot create the container in
`@BeforeAll`**, because the extension has already read the field and found `null`. Assign it at the
declaration.

## Gotchas

**★ Dropping `static` converts one container per class into one container per method.**
That is the entire configuration surface: a modifier. There is no annotation attribute, no warning
and no log line distinguishing the two. A refactor that pulls a container field up into a base class
and "tidies" the modifier away multiplies your container starts by the number of test methods in
every subclass.

**★ A non-static `@Container` gives you isolation by destroying the process, which is the most
expensive way to get it.**
What a suite needs between methods is *state* isolation. Restarting a container throws away the
process to obtain it. A transaction rolled back after each test
([06d](06d-the-rollback-strategy.md)) or a truncate ([06e](06e-truncating-between-tests.md)) buys the
same isolation without paying for an image start, a wait strategy and a teardown per method.

**★ Both `@Container` fields on a base class are scanned — static and instance alike.**
The module's own `AbstractTestBase` declares one of each, and its subclass adds a third. If you
inherit from a shared test base you inherit its container costs, including a per-method one you did
not know was there. Read the base class before you extend it.

**★ A `static @Container` on a base class shared by several subclasses is not one container.**
`beforeAll` registers the container in the *class-level* extension context's store, and that store
closes when that class's context ends. Two subclasses are two class contexts, so the field is
started, stopped, and started again. `GenericContainer.stop()` nulls `containerId`, so the second
`start()` genuinely creates a new container. For one container across the JVM the mechanism is
[05 · The singleton pattern](05-the-singleton-pattern.md), not inheritance —
[03c](03c-the-store-and-the-messages.md) has the store mechanics.

**★ An instance `@Container` on the outer class restarts for every method of every `@Nested` class.**
`beforeEach` walks all test instances, outer first. That is what the module's
`TestcontainersNestedRestartedContainerTests` asserts — the outer container's id changes between
nested methods. A single instance-field container on an enclosing class therefore multiplies by the
total number of methods in the whole nest.

**★ Assigning the container inside `@BeforeAll` throws `needs to be initialized`.**
JUnit runs every `BeforeAllCallback` extension before user `@BeforeAll` code — steps 1 and 2 of the
documented order. The extension has already read the field and found `null`. Initialise at the
declaration; a `static` initialiser block also works, since it runs at class initialisation.

**★ A shared static container makes tests order-dependent, and that is on you, not on the extension.**
One container per class means every method sees what the previous method wrote. That is the correct
trade, but it means test isolation becomes a data concern. The extension does nothing to help; the
options are in [06c · Keeping tests independent](06c-keeping-tests-independent.md).

**★ `@TestInstance(PER_CLASS)` does not turn an instance field into a shared one.**
The predicate is `ModifierSupport::isNotStatic`, evaluated on the field, and the scan happens in
`beforeEach` regardless of the test-instance lifecycle. Even with a single test instance for the
whole class, a non-static `@Container` is still stopped and restarted around every method — the
adapter is stored in the *method-level* context, which closes after each method. `PER_CLASS` changes
who owns the instance, not which callback reads the field.

## Interview questions

**★ What is the difference between a `static` and a non-`static` `@Container` field?**
A `static` field is picked up by the extension's `beforeAll` and started once before the first test
method, then stopped after the last — one container shared by every method in the class. A
non-`static` field is picked up by `beforeEach` and started and stopped around **every test
method** — one container per method. The selection is literally
`isContainer().and(ModifierSupport::isStatic)` versus `isNotStatic`; there is no annotation attribute
controlling it, so the only signal is the modifier.

**★ Which should you use, and why is the other one almost always wrong?**
`static`, in nearly every case. The per-method form buys state isolation by discarding an entire
process, which is the most expensive way to obtain it; a rolled-back transaction or a truncate gives
the same isolation for a rounding error of the cost. The per-method form earns its keep only when
the thing under test *is* startup — a migration against a virgin database, a one-shot bootstrap path,
the initial state of a broker.

**★ How would you prove to yourself which mode a test is in, without a Docker daemon?**
Read the modifier — that is the whole answer, and it is the point. If you want an executable proof,
the project's own `inheritance` tests are it: a static Redis container's `INCR` returns 1 then 2
across two methods because it is the same keyspace; an instance container's `INCR` returns 1 both
times because it is a different Redis. The assertions *are* the lifecycle specification.

**★ Does `@Testcontainers` work on an abstract base class?**
Yes — it is `@Inherited`, and the javadoc says all subclasses automatically inherit support.
`@Container` fields on the base class are found too, because field scanning uses
`HierarchyTraversalMode.TOP_DOWN`, and both static and instance fields on the base are scanned. The
catch is that a `static` field on a base class shared by several subclasses is started and stopped
once *per subclass*, since each subclass has its own class-level extension context and store.

**★ Can you assign the container in a `@BeforeAll` method?**
No. JUnit's documented order runs every `BeforeAllCallback` extension *before* user `@BeforeAll`
code, so the extension reads the field first and throws
`ExtensionConfigurationException: Container <name> needs to be initialized`. The container must be
assigned at its declaration or in a static initialiser. The opposite direction is fine: by the time
your `@BeforeAll` runs, a static container is started and you can read its host and port.

**★ You have five test classes each with the same `static @Container` Postgres. How many containers start?**
Five, sequentially — one per class, each started in that class's `beforeAll` and stopped when that
class's extension context ends. Extracting the field into a shared abstract base class does not
change that number, because the store is per class context, not per field. Reducing it to one is the
singleton pattern, or moving the container into the Spring context so it is shared for as long as
the context cache holds it.

**★ Does `@TestInstance(Lifecycle.PER_CLASS)` make a non-static `@Container` behave like a static one?**
No. The extension selects on the field's modifier and scans from `beforeEach`, so a non-static field
is still started and stopped per test method even when one test instance serves the whole class. The
adapter is registered in the method-level extension context's store, which JUnit closes at the end of
each method regardless of the test-instance lifecycle.

{/* FOOTER */}
