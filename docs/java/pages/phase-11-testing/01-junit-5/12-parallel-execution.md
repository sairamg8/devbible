---
title: "Setting junit.jupiter.execution.parallel.enabled to true changes nothing on its own — it is the first of two switches, and the second one is the execution mode, which is why most teams' first attempt at parallel tests produces a suite that is exactly as slow and exactly as green as before"
sidebar_label: "12 · Parallel execution"
sidebar_position: 41
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-28 against the JUnit 6.0.3 User Guide — "Parallel Execution"
> ([writing-tests/parallel-execution](https://docs.junit.org/6.0.3/writing-tests/parallel-execution.html))
> and the JUnit 6.0.0 release notes
> ([release-notes](https://docs.junit.org/6.0.3/release-notes.html)).
> JDK 25, Spring Boot 4.1.0, JUnit Jupiter 6.0.3, Spring Framework 7.0.8.

**Parallel execution in Jupiter is opt-in twice: once for the feature, once per node in the
test tree. The documentation says so in a sentence people read past, and the result is a
configuration parameter in `junit-platform.properties` that a team believes is speeding up
their build while it does nothing at all.**

The parallelism strategies and pool sizing are
[12b · parallelism configuration](12b-parallelism-configuration.md); `@ResourceLock` and
`@Isolated` are [12c · resource locks](12c-resource-locks.md); the catalogue of shared state
that breaks is
[12d · shared state under parallelism](12d-shared-state-under-parallelism.md).

## Two switches, not one

> *"By default, JUnit Jupiter tests are run sequentially in a single thread; however, running
> tests in parallel — for example, to speed up execution — is available as an opt-in feature.
> To enable parallel execution, set the `junit.jupiter.execution.parallel.enabled`
> configuration parameter to `true`."*

and immediately:

> *"Please note that enabling this property is only the first step required to execute tests
> in parallel. If enabled, test classes and methods will still be executed sequentially by
> default. Whether or not a node in the test tree is executed concurrently is controlled by
> its execution mode."*

🔴 **`enabled = true` alone runs everything sequentially.** The feature is armed; nothing is
concurrent. The second switch is the execution mode, and its default is `SAME_THREAD`.

The minimum working configuration is two lines:

```properties
junit.jupiter.execution.parallel.enabled = true
junit.jupiter.execution.parallel.mode.default = concurrent
```

## The two execution modes

> *"`SAME_THREAD` — Force execution in the same thread used by the parent. For example, when
> used on a test method, the test method will be executed in the same thread as any
> `@BeforeAll` or `@AfterAll` methods of the containing test class."*

> *"`CONCURRENT` — Execute concurrently unless a resource lock forces execution in the same
> thread."*

> *"By default, nodes in the test tree use the `SAME_THREAD` execution mode."*

Read `SAME_THREAD` carefully: it is **same thread as the parent**, not "some serialised
thread". That is what makes it the mode you need whenever anything is bound to a
`ThreadLocal` — a Spring transaction, a security context, a `MDC` logging context. If
`@BeforeAll` opened something thread-bound, only `SAME_THREAD` guarantees the test method sees
it ([13 · timeouts](13-timeouts.md) is the other place this bites, for the same reason).

And `CONCURRENT` is conditional — *"unless a resource lock forces execution in the same
thread"*. That escape hatch is [12c](12c-resource-locks.md).

## `@Execution`, per class and per method

> *"Alternatively, you can use the `@Execution` annotation to change the execution mode for the
> annotated element and its subelements (if any) which allows you to activate parallel
> execution for individual test classes, one by one."*

```java
@Execution(ExecutionMode.CONCURRENT)
class ExplicitExecutionModeDemo {

    @Test
    void testA() {
        // concurrent
    }

    @Test
    @Execution(ExecutionMode.SAME_THREAD)
    void testB() {
        // overrides to same_thread
    }

}
```

> *"This allows test classes or methods to opt in or out of concurrent execution regardless of
> the globally configured default."*

**"and its subelements"** is the important clause: `@Execution` on a class covers its methods
and its `@Nested` classes, and a method-level annotation overrides it. That gives you the
incremental adoption path — leave the global default at `same_thread`, annotate one class at
a time, and each annotation is a reviewable claim that *this* class is thread-safe.

That path is strictly better than flipping the global default and fixing the fallout, because
the annotation lives next to the code whose thread safety it asserts.

## The two classes of exception the default does not reach

> *"The default execution mode is applied to all nodes of the test tree with a few notable
> exceptions, namely test classes that use the `Lifecycle.PER_CLASS` mode or a
> `MethodOrderer`. In the former case, test authors have to ensure that the test class is
> thread-safe; in the latter, concurrent execution might conflict with the configured
> execution order. Thus, in both cases, test methods in such test classes are only executed
> concurrently if the `@Execution(CONCURRENT)` annotation is present on the test class or
> method."*

Two carve-outs, both defensible, both surprising the first time.

**`@TestInstance(PER_CLASS)`** shares one instance across methods
([03b](03b-per-class-lifecycle.md)), so concurrent methods would share its fields. Jupiter
refuses to make that decision for you: a `PER_CLASS` class stays sequential unless you
explicitly say `@Execution(CONCURRENT)`, and if you do, *"test authors have to ensure that the
test class is thread-safe"* — the guide is handing you the responsibility in writing.

**A `MethodOrderer`** — any of them ([11](11-execution-order.md)) — means you asked for an
order, and running concurrently would dissolve it. So an ordered class opts out too.

🔴 Note the consequence for [11b](11b-random-order.md): setting
`junit.jupiter.testmethod.order.default` to `MethodOrderer$Random` gives every test class a
`MethodOrderer`, which excludes **the whole suite** from the concurrent default. Randomised
ordering and default-on parallelism do not combine without per-class `@Execution(CONCURRENT)`.
That interaction is stated in the documentation but easy to walk into.

## Classes versus methods: the four combinations

There are two independent knobs, and the second one is the one people miss:

> *"In addition, you can configure the default execution mode for top-level classes by setting
> the `junit.jupiter.execution.parallel.mode.classes.default` configuration parameter."*

**Classes in parallel, methods within a class sequential** — the configuration most teams
actually want, because it parallelises across files while leaving each file's fixtures
undisturbed:

```properties
junit.jupiter.execution.parallel.enabled = true
junit.jupiter.execution.parallel.mode.default = same_thread
junit.jupiter.execution.parallel.mode.classes.default = concurrent
```

**Classes sequential, methods within a class in parallel** — the opposite, and rarely what you
want:

```properties
junit.jupiter.execution.parallel.enabled = true
junit.jupiter.execution.parallel.mode.default = concurrent
junit.jupiter.execution.parallel.mode.classes.default = same_thread
```

And the fallback rule:

> *"If the `junit.jupiter.execution.parallel.mode.classes.default` configuration parameter is
> not explicitly set, the value for `junit.jupiter.execution.parallel.mode.default` will be
> used instead."*

So setting only `mode.default = concurrent` makes **both** classes and methods concurrent —
the most aggressive of the four combinations, arrived at by writing the fewest lines. That is
why the first attempt at parallelism usually produces a flood of failures: the least-typing
configuration is the maximum-concurrency one.

Start with `classes.default = concurrent` and `mode.default = same_thread`. It is the
configuration with the best speed-to-risk ratio, because most shared state within a test class
is deliberate and most shared state between classes is accidental.

## Class ordering under parallelism is a hint, not a guarantee

> *"When parallel execution is enabled and a default `ClassOrderer` is registered, top-level
> test classes will initially be sorted accordingly and scheduled in that order. However, they
> are not guaranteed to be started in exactly that order since the threads they are executed
> on are not controlled directly by JUnit."*

That is the honest statement behind the "schedule longer tests first" optimisation
([11c](11c-class-order.md)): the orderer decides submission order, and the pool decides
start order. As an optimisation heuristic that is fine. As a correctness mechanism it is
nothing at all.

## ⚠️ Output capture is separate

> *"Please note that Capturing Standard Output/Error needs to be enabled separately."*

Under concurrency, `System.out` from several tests interleaves into one stream, and the first
thing you lose when you turn on parallelism is the ability to read the logs of the failures it
causes. The `junit.platform.output.capture.*` parameters and the one caveat that limits them
are in [12b](12b-parallelism-configuration.md).

## 🔴 JUnit 6: a typo in these parameters now fails the build

From the 6.0.0 release notes, under breaking changes:

> *"Setting an invalid value for one of the following enum-based configuration parameters now
> causes test discovery or execution to fail: `junit.jupiter.execution.parallel.mode.default`,
> `junit.jupiter.execution.parallel.mode.classes.default`, `junit.jupiter.execution.timeout.mode`,
> `junit.jupiter.execution.timeout.thread.mode.default`,
> `junit.jupiter.extensions.testinstantiation.extensioncontextscope.default`,
> `junit.jupiter.tempdir.cleanup.mode.default`, `junit.jupiter.testinstance.lifecycle.default`."*

This is unambiguously an improvement, and it is a **breaking** one. On JUnit 5, writing
`mode.default = CONCURRENT_MODE` or `concurent` was silently ignored and you got sequential
execution — a build that had been "parallel" for two years and never was. On JUnit 6 the same
file fails discovery. Expect that on upgrade, and read it as good news.

## Gotchas

**★ Setting `parallel.enabled = true` and nothing else.**
Everything still runs sequentially. The feature is enabled; every node's execution mode is
still `SAME_THREAD`. You need `mode.default` or `mode.classes.default` or `@Execution` as well.

**★ Setting only `mode.default = concurrent`.**
Because `mode.classes.default` falls back to `mode.default`, you have selected the maximum
concurrency configuration — classes *and* methods in parallel — with two lines. That is the
usual explanation for "we turned on parallelism and forty tests broke".

**★ Expecting a `PER_CLASS` class to obey the concurrent default.**
It does not. `@TestInstance(PER_CLASS)` classes are excluded and stay sequential unless
`@Execution(CONCURRENT)` is present, at which point thread safety is explicitly your problem.

**★ Enabling random method ordering and the concurrent default together.**
A class with any `MethodOrderer` is excluded from the concurrent default — and setting
`junit.jupiter.testmethod.order.default` globally gives *every* class an orderer. Your entire
suite silently opts out of parallelism.

**★ Reading `SAME_THREAD` as "serialised".**
It means the same thread as the parent node. That is what preserves `ThreadLocal`-bound state
across `@BeforeAll`, `@BeforeEach` and the test — a Spring transaction, a security context, an
`MDC`. "Runs one at a time" is a consequence, not the definition.

**★ Turning on parallelism without turning on output capture.**
Standard output from concurrent tests interleaves. The guide says capture must be enabled
separately, and without it the diagnostics for your new failures are unreadable.

**★ Relying on `ClassOrderer` for correctness once parallelism is on.**
Classes are *scheduled* in the ordered sequence, not *started* in it — the guide says the
threads are not controlled directly by JUnit. Ordering plus parallelism is an optimisation
only.

**★ Flipping the global default instead of annotating class by class.**
`@Execution(CONCURRENT)` on one class is a reviewable claim that sits next to the code it is
about. A global default is a claim about code nobody has read, made in a properties file.

**★ Assuming `@Execution` on a class does not reach `@Nested` classes.**
It applies to *"the annotated element and its subelements"*, so nested classes inherit it, and
a nested class needs its own `@Execution(SAME_THREAD)` to opt out.

**★ Carrying a JUnit 5 properties file forward with a typo in it.**
On 5 an invalid enum value was ignored and you ran sequentially. On 6 it fails discovery. If
your upgrade breaks here, the correct reaction is relief: the parallelism you thought you had
was never on.

## Interview questions

**★ What are the two things you must configure to actually run tests in parallel?**
`junit.jupiter.execution.parallel.enabled = true`, which arms the feature, and an execution
mode of `CONCURRENT` for the nodes you want parallel — via
`junit.jupiter.execution.parallel.mode.default`,
`junit.jupiter.execution.parallel.mode.classes.default`, or the `@Execution` annotation.
Enabling alone leaves everything on `SAME_THREAD`, which is the documented default for every
node.

**★ What is the difference between `mode.default` and `mode.classes.default`?**
`mode.classes.default` sets the execution mode of top-level classes — whether two classes may
run at the same time — and `mode.default` sets it for all other nodes, chiefly the methods
inside a class. Setting only `mode.default` makes classes inherit that value too, since
`mode.classes.default` falls back to it. The usual sensible pairing is classes `concurrent`,
methods `same_thread`.

**★ Which test classes are excluded from the concurrent default, and why?**
Classes with `@TestInstance(Lifecycle.PER_CLASS)` and classes with any `MethodOrderer`.
`PER_CLASS` shares one instance across methods, so concurrency would share its fields; a
`MethodOrderer` expresses an order that concurrency would dissolve. Both require an explicit
`@Execution(CONCURRENT)` to participate, and the guide states that thread safety then becomes
the author's responsibility.

**★ What exactly does `SAME_THREAD` guarantee?**
That the node runs on the same thread as its parent — a test method on the same thread as the
class's `@BeforeAll` and `@AfterAll`. That is a stronger and more useful statement than
"sequential", because it is what keeps `ThreadLocal`-bound state such as a Spring-managed
transaction or a security context visible from setup through to the assertion.

**★ How would you introduce parallelism to an existing suite?**
Enable the feature, leave `mode.default` at `same_thread`, set
`mode.classes.default = concurrent` so classes parallelise but each class's methods do not,
turn on output capture, and then move individual classes to `@Execution(CONCURRENT)` as their
thread safety is reviewed. The alternative — flipping the global default — produces failures in
code nobody has looked at, on a schedule nobody chose.

**★ What changed in JUnit 6 about the parallel configuration parameters?**
An invalid value for the enum-based parameters, including both parallel mode parameters, now
fails test discovery or execution rather than being ignored. On JUnit 5 a typo silently left
you running sequentially, so a suite could be nominally parallel for years without ever having
been. The upgrade surfaces that.

{/* FOOTER */}
