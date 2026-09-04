---
title: "@Testcontainers(parallel = true) starts several containers concurrently inside one test class, which is not remotely the same thing as JUnit parallel execution — the extension's own javadoc calls that combination unsupported — and the docs' reason for banning shared containers in @Nested classes stopped being true at Java SE 16"
sidebar_label: "03f · Parallelism and @Nested"
sidebar_position: 18
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-31 against the **Testcontainers 2.0.5 sources** at
> [tag `2.0.5`](https://github.com/testcontainers/testcontainers-java/tree/2.0.5) —
> [`Testcontainers`](https://github.com/testcontainers/testcontainers-java/blob/2.0.5/modules/junit-jupiter/src/main/java/org/testcontainers/junit/jupiter/Testcontainers.java)
> (the javadoc's "Note" is quoted verbatim),
> [`TestcontainersExtension`](https://github.com/testcontainers/testcontainers-java/blob/2.0.5/modules/junit-jupiter/src/main/java/org/testcontainers/junit/jupiter/TestcontainersExtension.java),
> [`Startables`](https://github.com/testcontainers/testcontainers-java/blob/2.0.5/core/src/main/java/org/testcontainers/lifecycle/Startables.java),
> and the module's maintained
> [`TestcontainersNestedSharedContainerTests`](https://github.com/testcontainers/testcontainers-java/blob/2.0.5/modules/junit-jupiter/src/test/java/org/testcontainers/junit/jupiter/TestcontainersNestedSharedContainerTests.java)
> and [`TestcontainersNestedRestartedContainerTests`](https://github.com/testcontainers/testcontainers-java/blob/2.0.5/modules/junit-jupiter/src/test/java/org/testcontainers/junit/jupiter/TestcontainersNestedRestartedContainerTests.java);
> the [JUnit 5 integration doc](https://github.com/testcontainers/testcontainers-java/blob/2.0.5/docs/test_framework_integration/junit_5.md)
> at the same tag; and the **JUnit 6.0.3 user guide**
> ([Parallel Execution](https://docs.junit.org/6.0.3/writing-tests/parallel-execution.html)).
> Version spine: JDK 25, Spring Boot 4.1.1, **Testcontainers 2.0.5**, JUnit Jupiter 6.0.3.
> ⚠️ **No Docker and no sandbox on this machine.** Nothing here is a container log, a timing or a
> test run — only source that was read and documentation that was quoted.

**[03e](03e-the-switches-and-the-limits.md) covered the first of `@Testcontainers`' two attributes.
This is the second — and the two words in its name are responsible for more confusion than anything
else in the module, because `parallel` describes container *startup* and everybody reads it as test
execution. Then the one genuine limitation left: `@Nested`, where the documented behaviour is right,
the documented reason is six Java releases out of date, and the honest answer to the interesting
question is "I could not confirm it".**

## `parallel()` — it starts containers in parallel, and nothing else

```java
@Testcontainers(parallel = true)
class MultiServiceTests {

    @Container
    static PostgreSQLContainer postgres = new PostgreSQLContainer("postgres:18-alpine");

    @Container
    static KafkaContainer kafka = new KafkaContainer("apache/kafka:4.0.0");
}
```

The branch it selects inside `startContainers` is:

```java
if (isParallelExecutionEnabled(context)) {
    Stream<Startable> startables = storeAdapters
        .stream()
        .map(storeAdapter -> {
            store.getOrComputeIfAbsent(storeAdapter.getKey(), k -> storeAdapter);
            return storeAdapter.container;
        });
    Startables.deepStart(startables).join();
} else {
    storeAdapters.forEach(adapter -> store.getOrComputeIfAbsent(adapter.getKey(), k -> adapter.start()));
}
```

Four facts from `Startables` that decide whether this is worth switching on:

- **It is `deepStart`, so declared dependencies are still honoured.** Each `Startable`'s
  `getDependencies()` is resolved first, and the javadoc spells out the scheduling: for a graph where
  `b` depends on `a` and `e` depends on `b`, `c` and `d`, *"'a', 'c' and 'd' will resolve in parallel,
  then 'b'"*. Parallel does not mean unordered.
- **The executor is a cached pool of daemon threads** named `testcontainers-lifecycle-N`. Daemon
  threads will not keep a JVM alive, which is what you want and also means a hung start does not
  block shutdown in the way a non-daemon thread would.
- **It fails fast.** `allOfFailfast` completes the aggregate future exceptionally as soon as *any*
  container fails, rather than waiting for the rest.
- **`beforeAll` blocks on `.join()`.** The method does not return until every container is up, so
  from your test's point of view nothing about the contract changed.

It is worth switching on only when one class starts **several independent containers**. One database
is one database, and the flag does nothing. The Spring-side equivalent for container beans is
`spring.testcontainers.beans.startup=parallel`, covered in
[04b5 · Containers as Spring beans](04b5-containers-as-beans.md).

## `parallel()` is not JUnit parallel execution — and that combination is unsupported

This is the most commonly-confused pair of concepts in the module, and the project states its
position in two places. From the `@Testcontainers` javadoc:

> *"**Note:** This extension has only been tested with sequential test execution. Using it with
> parallel test execution is unsupported and may have unintended side effects."*

and the documentation page repeats it verbatim under a heading called "Limitations".

The two things are unrelated:

| | `@Testcontainers(parallel = true)` | JUnit parallel execution |
|---|---|---|
| Configured by | an annotation attribute | `junit.jupiter.execution.parallel.enabled = true` plus `junit.jupiter.execution.parallel.mode.default = concurrent` |
| What runs concurrently | the `start()` calls of several containers in **one** class | test methods and test classes |
| Supported with this extension | yes, it is the extension's own feature | **no** — *"unsupported and may have unintended side effects"* |

JUnit's own defaults make this easy to trip into slowly: enabling the property alone changes nothing,
because *"By default, nodes in the test tree use the `SAME_THREAD` execution mode"*. It is the second
property — or one `@Execution(CONCURRENT)` — that turns it on, and that is often added months later
by somebody speeding up a different part of the suite.

**Why it is unsupported is not mysterious.** A `static @Container` is one shared, stateful service.
Run two methods of that class concurrently and they share a database with no isolation between them;
run two *classes* concurrently and both call `beforeAll`, so both compete over field initialisation
and over the same store keys. The extension has no locking anywhere in it. If you need concurrency
across classes, the mechanism is a shared container you control plus JUnit resource locks, which is
[05a4 · Parallel execution](05a4-parallel-execution.md).

## `@Nested` classes — and the reason the docs give, which expired

The Testcontainers JUnit 5 page still says:

> *"Shared containers are defined as static fields in a top level test class and have to be annotated
> with `@Container`. Note that shared containers can't be declared inside nested test classes. This
> is because nested test classes have to be defined non-static and can't therefore have static
> fields."*

🔴 **The stated reason is out of date.** Java SE 16 lifted the restriction on static members in inner
classes; an inner class has been able to declare static fields since then. Spring's own framework
source carries a comment acknowledging exactly this — *"Beginning with Java 16, inner classes may
contain static members"* — and `@Nested` with `@BeforeAll` works for the same reason.

⚠️ **What I can and cannot tell you.** I could not confirm whether the extension still has the
limitation, and I did not run anything. The honest position:

- **A `static @Container` on the *enclosing* class is visible and running inside a `@Nested` class,
  and it is not restarted.** The module's maintained `TestcontainersNestedSharedContainerTests`
  asserts both `isRunning()` and that `getContainerId()` is unchanged inside the nested class.
- **An instance `@Container` on the enclosing class *is* restarted for every nested test method.**
  `TestcontainersNestedRestartedContainerTests` asserts the outer container's id changes, with the
  comment *"top level container is restarted for nested methods"* — because `beforeEach` walks all
  test instances, outer first.
- **`@Testcontainers` does not need repeating on the nested class.** The extension's
  `findTestcontainers` walks the `ExtensionContext` parent chain, so the enclosing class's annotation
  is found.
- **Whether a `static @Container` declared *inside* a `@Nested` class is picked up, I do not know.**
  The field predicate is `isContainer().and(ModifierSupport::isStatic)` applied to the nested class,
  and Java permits the field now, so there is no obvious mechanism by which it would fail — but there
  is no test for it in the module and the documentation says it cannot be done. Do not rely on it.

**Never repeat the docs' rationale.** "Nested classes cannot have static fields" has been false since
Java 16, and repeating it teaches a reader a language rule that is wrong.

## Gotchas

**★ `parallel = true` does nothing for a class with one container.**
It parallelises the `start()` calls of the containers found in one `beforeAll` (or `beforeEach`). One
container is one `start()`. The flag is for a class that brings up a database, a broker and a cache
together.

**★ `parallel = true` and JUnit parallel execution are unrelated, and only one of them is supported.**
The javadoc is explicit that *"using it with parallel test execution is unsupported and may have
unintended side effects."* Enabling `junit.jupiter.execution.parallel.enabled` does not make the
extension parallel, and setting `parallel = true` does not make your tests run concurrently.

**★ Turning on JUnit parallel execution months later breaks container-based tests that used to pass.**
Enabling the property alone is a no-op because nodes default to `SAME_THREAD`; it is
`mode.default = concurrent`, or one `@Execution(CONCURRENT)`, that flips it. The person who does that
is usually optimising an unrelated part of the suite and has no idea a shared stateful container is
in scope.

**★ With `parallel = true` the container is registered in the store *before* it is started.**
The parallel branch does `store.getOrComputeIfAbsent(key, k -> storeAdapter)` and only then calls
`Startables.deepStart(...)`; the sequential branch does `k -> adapter.start()`. So a container whose
`start()` fails is already registered, and its `close()` will run at store close — harmlessly, because
`GenericContainer.stop()` returns immediately while `containerId` is null. Do not read a `stop()` on a
container that never started as evidence it did.

**★ `parallel` is read from the annotation found by walking the context chain, so a `@Nested` class inherits it.**
`isParallelExecutionEnabled` calls the same `findTestcontainers` that walks `getParent()` up to the
enclosing class. You cannot set `parallel = true` on an outer class and `false` on a nested one —
`@Testcontainers` targets types, and the nested class's own annotation would be the one found only if
you put it there.

**★ An instance `@Container` on an enclosing class multiplies across the whole nest.**
`beforeEach` collects all test instances, outer first, so an outer non-static container restarts for
every method of every `@Nested` class as well as for the outer class's own methods. This is asserted
by the module's own nested-restart test; it is behaviour, not a bug.

**★ Never repeat "nested classes cannot have static fields".**
The Testcontainers docs still give that as the reason shared containers cannot live in a `@Nested`
class. Java SE 16 removed the restriction. Whether the extension still has the limitation is a
separate, unverified question — but the reason given for it is simply wrong, and quoting it teaches a
false language rule.

## Interview questions

**★ What does `parallel = true` do?**
It switches container startup in `beforeAll`/`beforeEach` from a sequential loop to
`Startables.deepStart(...).join()`. Dependencies declared through `getDependencies()` are still
resolved first — the javadoc's own example has independent nodes resolving concurrently and the
dependent one after — the executor is a cached pool of daemon threads named
`testcontainers-lifecycle-N`, and it fails fast when any container fails. It only helps a class that
starts several independent containers.

**★ Can you run tests in parallel with the Testcontainers extension?**
Not supportedly. The `@Testcontainers` javadoc and the documentation both say *"This extension has
only been tested with sequential test execution. Using it with parallel test execution is unsupported
and may have unintended side effects."* And the reason is structural: a `static @Container` is one
shared stateful service with no locking anywhere in the extension, so concurrent methods share a
database with no isolation and concurrent classes race on `beforeAll`. `parallel = true` is a
different feature — it parallelises container *startup* within one class.

**★ How would you actually get concurrency in a container-backed suite, then?**
Take the container's lifecycle away from the extension — a container you start once and share for the
JVM, or one owned by the Spring context — and then use JUnit's resource locks so that tests touching
the same data do not run concurrently. That is a deliberate design, not a flag.
[05a4 · Parallel execution](05a4-parallel-execution.md) is that design.

**★ Does `deepStart` guarantee anything about the order containers come up in?**
Only what dependencies say. It resolves each `Startable`'s `getDependencies()` first and starts
independent nodes concurrently — the javadoc's worked example is a graph where *"'a', 'c' and 'd' will
resolve in parallel, then 'b'"*. Two containers with no declared relationship have no ordering at all,
which is fine for a database and a broker and wrong for a service that needs the broker's topic to
exist first. Express that with `dependsOn`, not with field order.

**★ What actually breaks if you run a class with a `static @Container` under `@Execution(CONCURRENT)`?**
Nothing structural in the extension — it has no locking, so it simply does not intervene. What breaks
is your data: every concurrent method shares one database with no isolation, so any test that writes
can be observed by any other. Across classes it is worse, because two classes' `beforeAll` calls race
over the same static fields and store keys. That is what *"may have unintended side effects"* means in
practice, and it is why the fix is a container you own plus resource locks rather than a flag.

**★ Can you declare a container inside a `@Nested` test class?**
An instance `@Container` field, yes — the module has a maintained test for it, and it restarts per
nested test method. A `static @Container` inside a `@Nested` class is where I would not commit: the
documentation says it cannot be done, but the *reason* it gives — that inner classes cannot have
static fields — stopped being true at Java SE 16, and I could not verify whether the limitation
itself survives. What is certain is that a `static @Container` on the *enclosing* class is visible
and still running inside the nested class, with the same container id, and that `@Testcontainers`
does not need repeating on the nested class because the extension walks the context parent chain.

**★ Why does the Testcontainers documentation say nested classes cannot have static fields?**
Because it predates Java SE 16, which lifted that restriction. It is a stale rationale in current
documentation, and it is worth recognising as such: `@Nested` with `@BeforeAll` also works now for
exactly the same reason, and Spring's own test-context source carries a comment noting that from
Java 16 inner classes may contain static members.

{/* FOOTER */}