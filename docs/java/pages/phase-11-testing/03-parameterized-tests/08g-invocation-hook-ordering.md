---
title: "Two invocation hooks in one class run in an order the documentation calls intentionally non-obvious, before-hooks and after-hooks are explicitly not paired, and — unlike every other teardown hook in Jupiter — an @AfterParameterizedClassInvocation method in a superclass runs before the subclass's, not after"
sidebar_label: "08g · Invocation hook ordering"
sidebar_position: 22
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-27 against the `@BeforeParameterizedClassInvocation`
> ([javadoc](https://docs.junit.org/6.0.3/api/org.junit.jupiter.params/org/junit/jupiter/params/BeforeParameterizedClassInvocation.html)),
> `@AfterParameterizedClassInvocation`
> ([javadoc](https://docs.junit.org/6.0.3/api/org.junit.jupiter.params/org/junit/jupiter/params/AfterParameterizedClassInvocation.html))
> and `@AfterEach`
> ([javadoc](https://docs.junit.org/6.0.3/api/org.junit.jupiter.api/org/junit/jupiter/api/AfterEach.html))
> pages, and the JUnit 6.0.3 User Guide, "Lifecycle and Interoperability"
> ([docs.junit.org](https://docs.junit.org/6.0.3/writing-tests/parameterized-classes-and-tests.html)).
> JDK 25, Spring Boot 4.1.1, JUnit Jupiter 6.0.3.

**[08f](08f-parameterized-class-lifecycle.md) covered declaring one invocation hook. Declaring
more than one, or inheriting one, is a separate subject with three documented rules — and the
third contradicts an instinct every Jupiter user has, because the teardown hook for a
parameterized class invocation does *not* run in reverse inheritance order the way `@AfterEach`
and `@AfterAll` do.**

## Inheritance: outside-in, both ways

For the setup hook, this reads exactly as expected:

> *"`@BeforeParameterizedClassInvocation` methods are inherited from superclasses as long as
> they are not overridden according to the visibility rules of the Java language. Furthermore,
> `@BeforeParameterizedClassInvocation` methods from superclasses will be executed before
> `@BeforeParameterizedClassInvocation` methods in subclasses."*
>
> *"Similarly, `@BeforeParameterizedClassInvocation` methods declared in an interface are
> inherited as long as they are not overridden, and `@BeforeParameterizedClassInvocation`
> methods from an interface will be executed before `@BeforeParameterizedClassInvocation`
> methods in the class that implements the interface."*

🔴 Now read the teardown hook's javadoc, which is word-for-word the same rule:

> *"`@AfterParameterizedClassInvocation` methods are inherited from superclasses as long as they
> are not overridden according to the visibility rules of the Java language. Furthermore,
> `@AfterParameterizedClassInvocation` methods from superclasses will be executed **before**
> `@AfterParameterizedClassInvocation` methods in subclasses."*

Compare with `@AfterEach`, whose javadoc says the opposite:

> *"`@AfterEach` methods are inherited from superclasses as long as they are not overridden
> according to the visibility rules of the Java language. Furthermore, `@AfterEach` methods from
> superclasses will be executed **after** `@AfterEach` methods in subclasses."*

| Hook | Superclass method runs |
|---|---|
| `@BeforeEach`, `@BeforeAll`, `@BeforeParameterizedClassInvocation` | before the subclass's |
| `@AfterEach`, `@AfterAll` | **after** the subclass's |
| `@AfterParameterizedClassInvocation` | **before** the subclass's |

Every other teardown in Jupiter unwinds bottom-up, the way nested `try`/`finally` blocks do.
This one does not. A base class that tears down a shared resource in
`@AfterParameterizedClassInvocation` therefore releases it *before* the subclass's teardown has
run, and the subclass's teardown finds it gone.

⚠️ I am reporting the javadoc as written; I have no way to execute a test to observe it. The
sentence is unambiguous and it is stated identically on the annotation's own page, so it is not
a transcription slip on my part — but if this matters to your design, the safe move is not to
inherit teardown hooks at all.

## Within one class, the order is deliberately undefined

> *"JUnit Jupiter does not guarantee the execution order of multiple
> `@BeforeParameterizedClassInvocation` methods that are declared within a single parameterized
> test class or test interface. While it may at times appear that these methods are invoked in
> alphabetical order, they are in fact sorted using an algorithm that is deterministic but
> intentionally non-obvious."*

"Deterministic but intentionally non-obvious" is the JUnit team's standard phrasing for *do not
depend on this*. It is deterministic so that a suite is reproducible; it is non-obvious so that
nobody encodes an ordering assumption by naming methods `a_setUp` and `b_setUp` — a trick that
worked in JUnit 4 and that Jupiter deliberately defeats.

## Before and after are not paired

🔴 This is the rule that catches experienced people, because every other resource-management API
they use does pair:

> *"`@BeforeParameterizedClassInvocation` methods are in no way linked to
> `@AfterParameterizedClassInvocation` methods. Consequently, there are no guarantees with
> regard to their wrapping behavior. For example, given two
> `@BeforeParameterizedClassInvocation` methods `createA()` and `createB()` as well as two
> `@AfterParameterizedClassInvocation` methods `destroyA()` and `destroyB()`, the order in which
> the `@BeforeParameterizedClassInvocation` methods are executed (e.g. `createA()` before
> `createB()`) does not imply any order for the seemingly corresponding
> `@AfterParameterizedClassInvocation` methods. In other words, `destroyA()` might be called
> before or after `destroyB()`."*

The naming convention creates the illusion of a pair. The framework does not read names.

> *"The JUnit Team therefore recommends that developers declare at most one
> `@BeforeParameterizedClassInvocation` method and at most one
> `@AfterParameterizedClassInvocation` method per test class or test interface unless there are
> no dependencies between the `@BeforeParameterizedClassInvocation` methods or between the
> `@AfterParameterizedClassInvocation` methods."*

## What to do instead

One hook each, with the ordering expressed in Java where the language can enforce it:

```java
@ParameterizedClass
@MethodSource("scenarios")
class OrderPipelineTests {

    @Parameter
    Scenario scenario;

    @BeforeParameterizedClassInvocation
    static void setUp(Scenario scenario) throws Exception {
        scenario.database = openDatabase();        // 1
        scenario.queue    = openQueue(scenario.database);   // 2 — depends on 1
    }

    @AfterParameterizedClassInvocation
    static void tearDown(Scenario scenario) throws Exception {
        closeQuietly(scenario.queue);              // reverse of setUp, in one method
        closeQuietly(scenario.database);
    }
}
```

Two statements in one method have a defined order; two annotated methods do not. That is the
whole technique, and it applies unchanged to `@BeforeAll`/`@BeforeEach` for the same documented
reason.

If the resource genuinely implements `AutoCloseable`, consider not writing a teardown at all —
arguments implementing it are closed for you ([08h](08h-argument-lifetime.md)).

## Composition

> *"`@BeforeParameterizedClassInvocation` may be used as a meta-annotation in order to create a
> custom composed annotation that inherits the semantics of
> `@BeforeParameterizedClassInvocation`."*

Both hooks are `@Target({ANNOTATION_TYPE, METHOD})` and `@API(status = EXPERIMENTAL,
since = "6.0")` with `@since 5.13` — the same status as `@ParameterizedClass` itself
([08c](08c-parameterized-classes.md)). A composed annotation such as `@SeedTheDatabase` reads
better at the call site and, more usefully, gives you one place to change if the experimental
API moves.

## Gotchas

**★ Declaring two `@BeforeParameterizedClassInvocation` methods and assuming alphabetical
order.** Order within a single class is documented as deterministic but *intentionally
non-obvious*. Naming them `a_` and `b_` does not work and was never meant to.

**★ Assuming `createA`/`destroyA` wrap each other.** They do not. The before and after hooks are
explicitly unlinked, so `destroyA()` may run before or after `destroyB()` regardless of the
order the setups ran in. One hook doing both halves is the only way to guarantee ordering.

**★ Inheriting an `@AfterParameterizedClassInvocation` method and expecting bottom-up
teardown.** The javadoc says superclass teardown runs *before* subclass teardown — the opposite
of `@AfterEach` and `@AfterAll`. A base class that closes a shared resource pulls it out from
under the subclass's teardown.

**★ Overriding an inherited hook to change its behaviour and forgetting the visibility rule.**
Inheritance holds *"as long as they are not overridden according to the visibility rules of the
Java language"*. A `private` hook in a superclass cannot be overridden — a same-named method in
the subclass is a second, independent hook, and now you have two with undefined ordering.

**★ Declaring a hook in an interface and one in the class, expecting the class's to win.** They
both run. The interface's runs first for both `@Before…` and `@After…`. Interface default
methods are inherited unless overridden, and overriding is what replaces rather than adds.

**★ Reaching for the ordering rules at all.** If your test needs two hooks whose order matters,
the design has already gone wrong. The documentation's recommendation — at most one of each — is
not a limitation of the framework, it is advice about test structure.

## Interview questions

**★ Two before-hooks and two after-hooks in one parameterized class. What order do they run
in?**
Unspecified within the class. The documentation says the order is deterministic but
intentionally non-obvious, and it explicitly warns that before- and after-hooks are not paired,
so the after methods may run in any order relative to each other regardless of how the setups
ran. Across a hierarchy the order is defined — interfaces and superclasses first — and the
team's recommendation is at most one of each per class.

**★ What is unusual about `@AfterParameterizedClassInvocation` inheritance?**
It does not reverse. `@AfterEach` and `@AfterAll` run the subclass's method first and the
superclass's afterwards, unwinding like nested `try`/`finally` blocks.
`@AfterParameterizedClassInvocation` is documented as running the superclass's method *before*
the subclass's — the same direction as the setup hook. A base class teardown therefore fires
while the subclass still expects its resources to exist.

**★ How do you guarantee that two setup steps are torn down in reverse order?**
Put both steps in a single `@BeforeParameterizedClassInvocation` method and both teardowns, in
reverse, in a single `@AfterParameterizedClassInvocation` method. Statements inside one method
have a language-defined order; separate annotated methods do not. This is the same advice that
applies to `@BeforeEach` and `@BeforeAll`.

**★ Why does JUnit deliberately make the within-class order non-obvious?**
To stop people encoding an ordering dependency into method names. JUnit 4's alphabetical-looking
behaviour let teams write `a_setUpDatabase` and `b_setUpQueue` and get away with it; Jupiter
sorts deterministically — so runs are reproducible — but by an algorithm chosen not to match any
naming convention, so the dependency has to be expressed in code instead.

**★ Can you build your own annotation on top of these hooks?**
Yes. Both are `@Target({ANNOTATION_TYPE, METHOD})` and both javadocs state they may be used as
meta-annotations to create composed annotations that inherit their semantics. Given that they
are still `@API(status = EXPERIMENTAL)`, wrapping them in a project-owned annotation also gives
you a single place to absorb a future API change.

{/* FOOTER */}
