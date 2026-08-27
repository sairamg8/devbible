---
title: "@TestInstance(PER_CLASS) buys you non-static @BeforeAll and shared state between test methods, and it charges for both by removing the isolation guarantee and silently disabling parallel execution for that class"
sidebar_label: "03b · Per-class lifecycle"
sidebar_position: 5
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-27 against the JUnit 6.0.3 User Guide — "Test Instance Lifecycle"
> ([test-instance-lifecycle](https://docs.junit.org/6.0.3/writing-tests/test-instance-lifecycle.html))
> and "Parallel Execution"
> ([parallel-execution](https://docs.junit.org/6.0.3/writing-tests/parallel-execution.html));
> `@TestInstance` javadoc
> ([TestInstance](https://docs.junit.org/6.0.3/api/org.junit.jupiter.api/org/junit/jupiter/api/TestInstance.html));
> "Nested Tests"
> ([nested-tests](https://docs.junit.org/6.0.3/writing-tests/nested-tests.html)); and
> **JLS SE 25 §8.1.3** on `static` members in inner classes
> ([jls-8.html](https://docs.oracle.com/javase/specs/jls/se25/html/jls-8.html)).
> JDK 25, Spring Boot 4.1.0, JUnit Jupiter 6.0.3, Spring Framework 7.0.8.

**One annotation flips the default from "a new instance per test method" to "one instance
for the whole class". It is not a style preference. It changes what `static` means in the
class, what isolation you have, and — a fact almost nobody knows until it costs them a
suite runtime — whether that class is allowed to run in parallel.**

## What it does

```java
@TestInstance(TestInstance.Lifecycle.PER_CLASS)
class TariffTableTest {

    private final TariffTable table = TariffTable.load();   // built once for the class

    @BeforeAll
    void warmUp() {          // note: NOT static
        table.index();
    }

    @Test
    void findsTheStandardRate() { /* ... */ }

    @Test
    void findsTheReducedRate() { /* ... */ }
}
```

> *"If you would prefer that JUnit Jupiter execute all test methods on the same test
> instance, annotate your test class with `@TestInstance(Lifecycle.PER_CLASS)`. When using
> this mode, a new test instance will be created once per test class."*

And the warning attached to it in the same paragraph, which is the whole trade:

> *"Thus, if your test methods rely on state stored in instance variables, you may need to
> reset that state in `@BeforeEach` or `@AfterEach` methods."*

You have re-acquired, for instance fields, exactly the problem `static` fields have under
the default lifecycle. The difference is scope: shared across one class rather than the
whole JVM.

## The four things it enables

From the `@TestInstance` javadoc, `PER_CLASS` enables:

> *"Shared test instance state between test methods in a given test class as well as
> between non-static `@BeforeAll` and `@AfterAll` methods in the test class."*
>
> *"Declaration of non-static `@BeforeAll` and `@AfterAll` methods in top-level or
> `@Nested` test classes."*
>
> *"Declaration of `@BeforeAll` and `@AfterAll` on interface `default` methods."*
>
> *"Simplified declaration of non-static `@BeforeAll` and `@AfterAll` lifecycle methods as
> well as `@MethodSource` factory methods in test classes implemented with the Kotlin
> programming language."*

Item two used to be the one that mattered most in practice, and on JUnit 6 it no longer is.
⚠️ **The old rule — "a `@Nested` inner class cannot declare `@BeforeAll`, because
`@BeforeAll` must be `static` and an inner class cannot have `static` members" — expired at
Java SE 16.** JLS SE 25 §8.1.3 is explicit: *"an inner class may declare and inherit
`static` members … and declare static initializers, even though the inner class itself is
not `static`"*, with the historical note that *"prior to Java SE 16, an inner class could
not declare static initializers, and could only declare `static` members that were constant
variables"*. JUnit 6 baselines Java 17, so `static @BeforeAll` inside a `@Nested` class
compiles, and the guide's nested-tests page says inner classes are *"subject to full
lifecycle support, including `@BeforeAll` and `@AfterAll` methods on each level"*.

`PER_CLASS` on a nested class is therefore now a **preference**, not the only way out —
see [06b](06b-nested-tests.md). Every tutorial written before 2021 says otherwise.

Item four is why almost every Kotlin JUnit 5 example on the internet carries
`@TestInstance(PER_CLASS)`: Kotlin has no `static`, so `@BeforeAll` otherwise needs a
`companion object` with `@JvmStatic`. If you have copied that annotation into a Java
codebase from a Kotlin sample, you have taken on the costs for none of the benefit.

## 🔴 It disables parallel execution for that class

The javadoc, under "Parallel Execution":

> *"Using the `PER_CLASS` lifecycle mode disables parallel execution unless the test class
> or test method is annotated with `@Execution(CONCURRENT)`."*

The user guide says the same thing from the other direction:

> *"The default execution mode is applied to all nodes of the test tree with a few notable
> exceptions, namely test classes that use the `Lifecycle.PER_CLASS` mode or a
> `MethodOrderer`. In the former case, test authors have to ensure that the test class is
> thread-safe."*

This is a **silent** exclusion. You set
`junit.jupiter.execution.parallel.mode.default = concurrent`, the suite gets faster, and
every `PER_CLASS` class quietly keeps running its methods one at a time. Nothing warns
you. The engine is being conservative on your behalf, and it is right to — one instance
shared by concurrently executing methods is a data race by construction — but if you were
counting on parallelism to hit a build-time target, this is where the missing seconds went
([12](12-parallel-execution.md)).

Opting back in with `@Execution(CONCURRENT)` on a `PER_CLASS` class is a promise that
the shared instance is thread-safe. Make that promise deliberately or not at all.

## Inheritance and the default

`@TestInstance` is `@Inherited`, and the guide adds the rule for the implicit case:

> *"If `@TestInstance` is not explicitly declared on a test class or on a test interface
> implemented by a test class, the lifecycle mode will implicitly default to `PER_METHOD`.
> Note, however, that an explicit lifecycle mode is inherited within a test class
> hierarchy."*

So an abstract base test class annotated `PER_CLASS` imposes it on every subclass, and the
subclass author will not see the annotation in the file they are editing.

## Changing the default globally, and why not to

```properties
# src/test/resources/junit-platform.properties
junit.jupiter.testinstance.lifecycle.default = per_class
```

The guide's own warning is stronger than most warnings in that document:

> *"Changing the default test instance lifecycle mode can lead to unpredictable results
> and fragile builds if not applied consistently. For example, if the build configures
> 'per-class' semantics as the default but tests in the IDE are executed using
> 'per-method' semantics, that can make it difficult to debug errors that occur on the
> build server."*

⚠️ **If you do it anyway, do it in `junit-platform.properties`, never as a JVM system
property.** The guide's reasoning: the properties file *"can be checked into a version
control system along with your project and can therefore be used within IDEs and your
build software"*, so the IDE and CI agree. A `-D` flag in the Surefire configuration is
invisible to the IDE, which is exactly the divergence the warning describes.

## When it is genuinely the right call

Three cases, and they are narrower than the annotation's popularity suggests:

1. **A `@Nested` class that needs `@BeforeAll`.** There is no other way.
2. **A non-static `@MethodSource` factory** feeding a `@ParameterizedTest` in the same
   class — **topic 03** *(not written yet)* owns the detail, but the lifecycle requirement
   lands here.
3. **Kotlin**, where `PER_CLASS` replaces `companion object` + `@JvmStatic` boilerplate.

Notably *not* on the list: "the setup is expensive". Expensive shared setup is what
`static` + `@BeforeAll` is for under the default lifecycle, and it does not cost you the
isolation of every instance field in the class.

## Gotchas

**★ Adopting `PER_CLASS` to avoid writing `static`.**
The `static` keyword was the visible signal that the field is shared. `PER_CLASS` removes
the signal and keeps the sharing. Every instance field in the class is now suite state,
and nothing in the field declaration says so.

**★ Losing parallelism without being told.**
`PER_CLASS` classes are excluded from concurrent execution unless annotated
`@Execution(CONCURRENT)`. There is no warning, no log line and no report entry — just a
suite that is slower than the configuration suggests it should be.

**★ Not resetting state in `@BeforeEach`.**
The guide says you *"may need to reset that state"*. In practice: if a test mutates an
instance field, either reset it in `@BeforeEach` or the class is order-dependent, and
`MethodOrderer.Random` will find out ([11](11-execution-order.md)).

**★ Putting `PER_CLASS` on an abstract base class.**
It is `@Inherited`. Every subclass gets it, including the ones written two years later by
someone who never opened the base class.

**★ Setting `junit.jupiter.testinstance.lifecycle.default` as a `-D` in Surefire only.**
The IDE does not see it. Tests then behave differently locally and on CI, which the guide
names as the specific failure mode to avoid. Use the properties file.

**★ Mixing `PER_CLASS` with `@Execution(CONCURRENT)` without auditing the fields.**
You have overridden a safety default. One instance, several threads, shared mutable
fields: the classic race. If the class has only `final` immutable fields, fine — but then
ask why it needed `PER_CLASS`.

**★ Assuming `@BeforeAll` under `PER_CLASS` runs before the instance is created.**
It does not — that is the point. The instance is constructed first, then `@BeforeAll` runs
on it. Field initialisers therefore execute *before* `@BeforeAll`, not after.

**★ Copying `PER_CLASS` out of a Kotlin example into Java.**
Kotlin needs it because it has no `static`. Java does not. You inherited the isolation
loss and the parallelism block for nothing.

**★ Expecting `PER_CLASS` on an outer class to apply to a `@Nested` class.**
`@TestInstance` is `@Inherited` through *class hierarchies* — superclasses — and the
`@Nested` javadoc states that a nested class *"can be configured with its own
`TestInstance.Lifecycle` mode which may differ from that of an enclosing test class"*, and
that it *"cannot change the `TestInstance.Lifecycle` mode of an enclosing test class"*.
Nesting is not inheritance; annotate the nested class itself.

## Interview questions

**★ What does `@TestInstance(Lifecycle.PER_CLASS)` change?**
One instance of the test class is created for the whole class instead of one per test
method. That makes instance fields shared across tests, allows `@BeforeAll` and `@AfterAll`
to be non-static (including on interface default methods and inside `@Nested` classes),
and makes non-static `@MethodSource` factories usable.

**★ What does it cost?**
The isolation guarantee — the reason the per-method default exists — and, unless you
explicitly annotate `@Execution(CONCURRENT)`, the class's eligibility for parallel
execution. You also lose the `static` keyword as a visible marker of shared state.

**★ Can a `@Nested` class declare `@BeforeAll`, and has the answer changed?**
Yes, and yes. `@BeforeAll` must be `static` under the default lifecycle, and until Java SE
16 an inner class could not declare a non-constant `static` member — so on Java 8–15 a
`@Nested` class could not have one, and `@TestInstance(PER_CLASS)` was the only way out.
JLS SE 25 §8.1.3 now permits `static` members in inner classes, JUnit 6 baselines Java 17,
and the user guide describes full lifecycle support *"on each level"* of the nesting.
`PER_CLASS` still works and is still the tidier option if you also want non-static
`@MethodSource` factories; it is no longer a requirement. This is a good question to be
asked, because the pre-16 answer is what most published material still gives.

**★ Why do so many Kotlin examples use `PER_CLASS`?**
Kotlin has no `static`; a static method requires a `companion object` with `@JvmStatic`.
`PER_CLASS` lets `@BeforeAll` be an ordinary member function. The guide lists exactly this
as one of the mode's benefits. It is a Kotlin ergonomics fix, not general advice.

**★ You enable parallel execution and the suite barely speeds up. What do you check?**
Which classes are excluded from the default execution mode. The guide names two: classes
using `Lifecycle.PER_CLASS` and classes using a `MethodOrderer`. Both keep their methods on
one thread unless `@Execution(CONCURRENT)` is present, and neither produces any output
saying so.

**★ Would you set `per_class` as the project-wide default?**
No. The guide warns that changing the default *"can lead to unpredictable results and
fragile builds if not applied consistently"*, and the specific failure — CI using one mode
and the IDE another — is miserable to debug. If some classes need it, annotate those
classes.

**★ Under `PER_CLASS`, when do field initialisers run relative to `@BeforeAll`?**
Before. The single instance is constructed — running field initialisers and the
constructor — and `@BeforeAll` is then invoked on that instance. Under the default
lifecycle the relationship is the opposite: `@BeforeAll` runs before any instance exists.

{/* FOOTER */}
