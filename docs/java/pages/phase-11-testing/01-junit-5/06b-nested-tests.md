---
title: "@Nested turns a flat list of test methods into a tree of circumstances, because the outer class's @BeforeEach runs before the inner one — and the rule that makes it work, inner class not static nested class, fails silently when you break it"
sidebar_label: "06b · Nested tests"
sidebar_position: 12
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-27 against the JUnit 6.0.3 User Guide — "Nested Tests"
> ([nested-tests](https://docs.junit.org/6.0.3/writing-tests/nested-tests.html)),
> "Annotations"
> ([annotations](https://docs.junit.org/6.0.3/writing-tests/annotations.html)) and
> "Test Instance Lifecycle"
> ([test-instance-lifecycle](https://docs.junit.org/6.0.3/writing-tests/test-instance-lifecycle.html));
> the `@Nested` javadoc
> ([Nested](https://docs.junit.org/6.0.3/api/org.junit.jupiter.api/org/junit/jupiter/api/Nested.html));
> and **JLS SE 25 §8.1.3** on `static` members in inner classes
> ([jls-8.html](https://docs.oracle.com/javase/specs/jls/se25/html/jls-8.html)).
> JDK 25, Spring Boot 4.1.0, JUnit Jupiter 6.0.3, Spring Framework 7.0.8.

**A test class with twenty methods, each of which starts by building the same object into a
slightly different state, is a class that has a structure and is hiding it. `@Nested` makes
the structure explicit: an inner class per circumstance, its `@BeforeEach` establishing that
circumstance, and the tests inside it asserting only what is true once you are there. The
guide's own framing is that it "give[s] the test writer more capabilities to express the
relationship among several groups of tests".**

## The mechanism, in one sentence

Lifecycle methods are **hierarchical**. Before a test in an inner class runs, every
`@BeforeEach` from the outermost class down to that inner class has already run, outermost
first. The guide:

> *"Preconditions from outer tests are used in inner tests by defining hierarchical
> lifecycle methods for the setup code."*

> *"The fact that setup code from outer tests is run before inner tests are executed gives
> you the ability to run all tests independently."*

That last clause is the point, and it is easy to skim past. Nesting expresses a
*dependency between circumstances*, not a dependency between tests. Each test still runs
against a freshly built world; what nesting removes is the repetition of building it.

## The canonical example

Straight from the user guide — worth reading as a document rather than as code:

```java
@DisplayName("A stack")
class TestingAStackDemo {

    @Test
    @DisplayName("is instantiated with new Stack()")
    void isInstantiatedWithNew() {
        new Stack<>();
    }

    @Nested
    @DisplayName("when new")
    class WhenNew {

        Stack<Object> stack;

        @BeforeEach
        void createNewStack() {
            stack = new Stack<>();
        }

        @Test
        @DisplayName("is empty")
        void isEmpty() {
            assertTrue(stack.isEmpty());
        }

        @Test
        @DisplayName("throws EmptyStackException when popped")
        void throwsExceptionWhenPopped() {
            assertThrows(EmptyStackException.class, stack::pop);
        }

        @Nested
        @DisplayName("after pushing an element")
        class AfterPushing {

            String anElement = "an element";

            @BeforeEach
            void pushAnElement() {
                stack.push(anElement);
            }

            @Test
            @DisplayName("it is no longer empty")
            void isNotEmpty() {
                assertFalse(stack.isEmpty());
            }

            @Test
            @DisplayName("returns the element when popped and is empty")
            void returnElementWhenPopped() {
                assertEquals(anElement, stack.pop());
                assertTrue(stack.isEmpty());
            }
        }
    }
}
```

Read the display names down the tree: *A stack → when new → after pushing an element → it
is no longer empty*. That is a specification, and the report prints it as one. The
`AfterPushing` tests never call `new Stack<>()` — `WhenNew.createNewStack` did it for them,
and `AfterPushing.pushAnElement` added exactly one fact on top.

Note also that `AfterPushing` reads `stack`, a field of the **enclosing instance**. That is
legal precisely because the nested class is an inner class, which brings us to the one hard
rule.

## The one hard rule: inner, not static

> *"Only non-static nested classes (i.e. inner classes) can serve as `@Nested` test
> classes."*

Write `static class WhenNew` and the tests inside it are not discovered. There is no error,
no warning, and no failure — the class is simply not a `@Nested` test class, and a suite
that used to run twelve tests quietly runs six. This is the single most common way to lose
tests with `@Nested`, and it is invisible in a green build.

The reason the rule exists is the one the example just showed: an inner class holds a
reference to its enclosing instance, and that reference is what lets the inner tests see
the outer class's fields. A `static` nested class has no enclosing instance to read from.

Depth is not limited:

> *"Nesting can be arbitrarily deep, and those inner classes are subject to full lifecycle
> support, including `@BeforeAll` and `@AfterAll` methods on each level."*

What each level of nesting may declare — `@BeforeAll` and the Java-16 rule that expired,
`@TestInstance`, tags, `@ParameterizedClass`, and how deep is too deep — is in
[06c · Nesting: lifecycle and limits](06c-nesting-lifecycle-and-limits.md).

## Gotchas

**★ `static class` instead of `class` — tests silently vanish.**
The guide's rule is absolute: only inner classes serve as `@Nested` test classes. A `static`
nested class annotated `@Nested` is discovered as nothing. No error, no skip, no report
entry — just a smaller test count that nobody notices. If an IDE auto-completes or a
"convert to static nested class" quick-fix fires, tests disappear from the build.

**★ Forgetting `@Nested` entirely.**
An unannotated inner class is not a test class either. Same silent outcome as above, and
it is the more common of the two, because an inner class without the annotation looks
perfectly reasonable.

**★ Sharing mutable state through an outer field without resetting it.**
The outer `@BeforeEach` runs before every inner test, so a field assigned there is fresh.
A field assigned in a **field initialiser** of the outer class is also fresh per test under
the default lifecycle — but a `static` field is not, and neither is anything under
`PER_CLASS`. Nesting makes shared state look more organised without making it any safer.

**★ Debugging a failure means reading upward, not just the method.**
The test body may be two lines. The world it runs against was built by every `@BeforeEach`
above it. This is nesting's real cost, and it is why the display names have to be good — the
report has to tell you the circumstance, because the method body will not.

## Interview questions

**★ What does `@Nested` actually give you that separate test classes do not?**
Hierarchical lifecycle. Every `@BeforeEach` from the outermost class inward runs before an
inner test, so each level adds one precondition to the world instead of restating all of
them. Separate classes would each have to rebuild the full state. The secondary gain is the
report: nested display names read as a specification.

**★ Why must a `@Nested` class be an inner class?**
Because it needs an enclosing instance. The whole mechanism depends on inner tests reading
state that the outer class's lifecycle methods built, and only a non-static nested class
holds a reference to the enclosing instance. The guide states the rule directly: *"Only
non-static nested classes (i.e. inner classes) can serve as `@Nested` test classes."*

**★ What happens if you mark a `@Nested` class `static`?**
Nothing visible, which is the problem. It is not discovered as a test class, its tests do
not run, and no error is reported. The suite simply gets smaller. The same happens if you
forget the `@Nested` annotation on an inner class.

**★ You add `@Nested` classes to an existing suite and the test count goes down. What
happened?**
Tests were moved into an inner class that is either `static` or missing the `@Nested`
annotation, so they are no longer discovered. Both failures are silent. Compare the test
count before and after, rather than trusting a green build — the build is green precisely
because the tests are not running.

{/* FOOTER */}
