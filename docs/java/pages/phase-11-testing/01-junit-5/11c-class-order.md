---
title: "Class ordering is asymmetric in a way the annotation names hide — @TestClassOrder orders only @Nested classes, and the only way to order top-level classes is a global configuration parameter, which is why the interesting uses of ClassOrderer are all build-time optimisations rather than correctness fixes"
sidebar_label: "11c · Class order"
sidebar_position: 39
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-28 against the JUnit 6.0.3 User Guide — "Test Execution Order"
> ([writing-tests/test-execution-order](https://docs.junit.org/6.0.3/writing-tests/test-execution-order.html))
> and the JUnit 6.0.0 release notes
> ([release-notes](https://docs.junit.org/6.0.3/release-notes.html));
> javadoc for `@Order`
> ([Order](https://docs.junit.org/6.0.3/api/org.junit.jupiter.api/org/junit/jupiter/api/Order.html)).
> JDK 25, Spring Boot 4.1.1, JUnit Jupiter 6.0.3, Spring Framework 7.0.9.

**Method ordering ([11](11-execution-order.md)) is usually a symptom. Class ordering is
usually an optimisation — the guide's own motivating examples are "fail fast" and "schedule
longer tests first", not correctness. The mechanism has one asymmetry worth knowing before
you go looking for an annotation that does not exist.**

## The same default, restated for classes

> *"By default, test classes and methods will be ordered using an algorithm that is
> deterministic but intentionally nonobvious."*

Classes and methods, one sentence, one policy. Everything [11](11-execution-order.md) argues
about method order applies unchanged to class order.

> *"Although test classes typically should not rely on the order in which they are executed,
> there are times when it is desirable to enforce a specific test class execution order."*

## The guide's own reasons, which are not about correctness

> *"You may wish to execute test classes in a random order to ensure there are no accidental
> dependencies between test classes, or you may wish to order test classes to optimize build
> time as outlined in the following scenarios. Run previously failing tests and faster tests
> first: 'fail fast' mode. With parallel execution enabled, schedule longer tests first:
> 'shortest test plan execution duration' mode. Various other use cases."*

Read the list: **detect dependencies**, **fail fast**, **pack the parallel schedule**. Not one
of them is "my tests need to run in this order". That is the difference in intent between
`ClassOrderer` and `MethodOrderer`, and it is why a custom `ClassOrderer` reading last run's
timings is a legitimate piece of build engineering while a custom `MethodOrderer` doing
anything similar would be alarming.

"Schedule longer tests first" is the classic longest-processing-time-first heuristic: under
`CONCURRENT` execution ([12 · parallel execution](12-parallel-execution.md)) the wall-clock
time of the run is bounded below by the longest single class, so starting the long ones
earliest leaves the short ones to fill the tail.

## The four built-in `ClassOrderer`s

| Orderer | What it sorts on |
|---|---|
| `ClassOrderer.ClassName` | *"sorts test classes alphanumerically based on their fully qualified class names"* |
| `ClassOrderer.DisplayName` | *"sorts test classes alphanumerically based on their display names"* |
| `ClassOrderer.OrderAnnotation` | *"sorts test classes numerically based on values specified via the `@Order` annotation"* |
| `ClassOrderer.Random` | *"orders test classes pseudo-randomly and supports configuration of a custom seed"* |

Plus `ClassOrderer.Default`, the way back to the built-in algorithm — a **type that is new in
JUnit 6.0**, per the release notes: *"New `MethodOrderer.Default` and `ClassOrderer.Default`
types for reverting back to default ordering on a `@Nested` class and its `@Nested` inner
classes when an enclosing class specifies a different orderer via `@TestMethodOrder` or
`@TestClassOrder`, respectively."* On JUnit 5 there was no supported way to opt a nested class
out. The seed for `ClassOrderer.Random` is the same
`junit.jupiter.execution.order.random.seed` parameter that `MethodOrderer.Random` uses
([11b](11b-random-order.md)).

## 🔴 The asymmetry: there is no class-level annotation for top-level classes

For methods you annotate the class. For *classes*, the two mechanisms do different jobs:

> *"To configure test class execution order globally for the entire test suite, use the
> `junit.jupiter.testclass.order.default` configuration parameter to specify the fully
> qualified class name of the `ClassOrderer` you would like to use."*

> *"To configure test class execution order locally for `@Nested` test classes, declare the
> `@TestClassOrder` annotation on the enclosing class for the `@Nested` test classes you want
> to order."*

**`@TestClassOrder` orders `@Nested` classes only.** There is no annotation you can put
anywhere to order two top-level test classes relative to each other — the configuration
parameter is the only lever, and it is suite-wide.

That is a deliberate shape. Ordering top-level classes is a build-level policy, so it lives in
build-level configuration; ordering nested classes is a local statement about one file, so it
lives in the file. If you find yourself wanting to say "class A before class B", the tool is
telling you something.

```properties
junit.jupiter.testclass.order.default = \
    org.junit.jupiter.api.ClassOrderer$OrderAnnotation
```

Same two traps as the method parameter: the `$` for the nested class, and the trailing
backslash for a continued `.properties` line.

## What the configured orderer applies to

> *"The configured `ClassOrderer` will be applied to all top-level test classes (including
> static nested test classes) and `@Nested` test classes."*

> *"Top-level test classes will be ordered relative to each other; whereas, `@Nested` test
> classes will be ordered relative to other `@Nested` test classes sharing the same enclosing
> class."*

Two separate sorts, not one flat list. `@Nested` classes never mingle with top-level classes in
the ordering — a nested class is ordered only against its siblings under the same enclosing
class, which is the only thing that could make sense given the nesting semantics
([06c](06c-nesting-lifecycle-and-limits.md)).

Note also that **`static` nested test classes count as top-level** for this purpose. A
`static` nested class is a separate test class, not a `@Nested` one — the distinction
[06b](06b-nested-tests.md) makes about the missing `static` keyword resurfaces here, with a
second observable consequence.

## `@TestClassOrder`, and the precedence rule

```java
import org.junit.jupiter.api.ClassOrderer;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Order;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestClassOrder;

@TestClassOrder(ClassOrderer.OrderAnnotation.class)
class OrderedNestedTestClassesDemo {

    @Nested
    @Order(1)
    class PrimaryTests {

        @Test
        void test1() {
        }
    }

    @Nested
    @Order(2)
    class SecondaryTests {

        @Test
        void test2() {
        }
    }
}
```

The recursion and the opt-out mirror `@TestMethodOrder`:

> *"The configured `ClassOrderer` will be applied recursively to `@Nested` test classes and
> their `@Nested` test classes. If you want to avoid that a `@Nested` test class uses the same
> `ClassOrderer` as its enclosing class, you can specify `ClassOrderer.Default` together with
> `@TestClassOrder`."*

And the precedence, stated once and clearly:

> *"Note that a local `@TestClassOrder` declaration always overrides an inherited
> `@TestClassOrder` declaration or a `ClassOrderer` configured globally via the
> `junit.jupiter.testclass.order.default` configuration parameter."*

**Local always wins** — over an inherited annotation and over the global parameter. So a suite
running `ClassOrderer$Random` globally will still execute a `@TestClassOrder`-annotated file's
nested classes in the annotated order, and your randomisation experiment has a hole in it
exactly where somebody previously felt the need to impose an order. That is worth knowing when
you interpret a clean randomised run.

## Gotchas

**★ Looking for an annotation to order two top-level test classes.**
There is not one. `@TestClassOrder` orders `@Nested` classes; top-level ordering is only the
suite-wide `junit.jupiter.testclass.order.default` parameter. Wanting per-file control over
top-level class order is a design signal, not a missing feature.

**★ `@Order` on a `@Nested` class with no `@TestClassOrder` on the enclosing class.**
Inert, exactly as `@Order` on a method is inert without `@TestMethodOrder`
([11](11-execution-order.md)). No error, no warning.

**★ Expecting a global `ClassOrderer` to override a local `@TestClassOrder`.**
It is the other way round: *"a local `@TestClassOrder` declaration always overrides … a
`ClassOrderer` configured globally"*. Your global randomisation does not reach into annotated
files.

**★ Assuming `@Nested` classes are ordered against top-level classes.**
They are not. Top-level classes are ordered relative to each other; `@Nested` classes are
ordered relative to siblings sharing the same enclosing class. Two independent sorts.

**★ Forgetting that a `static` nested test class is ordered as a top-level class.**
The guide says so explicitly — *"all top-level test classes (including static nested test
classes)"*. If you wrote `static class` where you meant `@Nested class`
([06b](06b-nested-tests.md)), the ordering behaviour is one more way that mistake shows up.

**★ Using `ClassOrderer.DisplayName` on classes with sentence display names.**
Same problem as the method equivalent: execution order becomes alphabetised prose, and a
copy-edit reorders the build.

**★ Ordering classes for build time and then not measuring.**
"Longest first" and "previously failing first" are optimisations, and an optimisation you have
not measured is a guess with extra configuration. The guide names the strategies; it does not
implement them — a custom `ClassOrderer` that reads last run's timings is code you own and must
justify.

**★ Ordering classes to work around a shared-fixture problem.**
If class B only passes after class A has run, you have cross-class shared state, and pinning
the order preserves the defect while hiding the symptom
([11d · when order is a smell](11d-when-order-is-a-smell.md)).

## Interview questions

**★ How do you make two top-level test classes run in a specific order?**
Through the `junit.jupiter.testclass.order.default` configuration parameter with
`ClassOrderer.OrderAnnotation`, plus `@Order` on the classes — and that parameter is suite-wide,
because there is no per-file annotation for top-level class order. `@TestClassOrder` only
orders `@Nested` classes. The absence of a local annotation is a design statement.

**★ What are the legitimate reasons to order test classes?**
The ones the guide itself lists: randomising to detect accidental dependencies between
classes; running previously failing and faster classes first for a fail-fast build; and, with
parallel execution enabled, scheduling the longest classes first so the tail of the run packs
tightly. All three are build-engineering concerns, none is "my tests need this order".

**★ A `@Nested` class has `@Order(1)` and nothing happens. Why?**
`@Order` needs an orderer that reads it. For nested classes that means
`@TestClassOrder(ClassOrderer.OrderAnnotation.class)` on the *enclosing* class, or the global
`junit.jupiter.testclass.order.default` parameter set to that orderer. Without one, the
annotation is silently ignored.

**★ You set `ClassOrderer$Random` globally to hunt for dependencies, and the run is green. What
have you not tested?**
Any file that declares its own `@TestClassOrder`, because a local declaration always overrides
the global parameter — and those files are disproportionately likely to be the ones with an
ordering dependence, since somebody once cared enough to annotate them. You have also only
sampled one order ([11b](11b-random-order.md)).

**★ How are `@Nested` classes ordered relative to top-level classes?**
They are not compared. Top-level classes — including `static` nested test classes — are ordered
relative to each other, and `@Nested` classes are ordered relative to other `@Nested` classes
sharing the same enclosing class. A configured `ClassOrderer` is applied to both groups, but as
two separate sorts.

{/* FOOTER */}
