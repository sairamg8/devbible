---
title: "@MethodSource is the source with no type limits, and it pays for that with a static requirement whose only escape rewrites your whole class lifecycle, and a factory reference that is a string the compiler never checks"
sidebar_label: "04 · @MethodSource"
sidebar_position: 7
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-27 against the JUnit 6.0.3 User Guide, "@MethodSource"
> ([docs.junit.org](https://docs.junit.org/6.0.3/writing-tests/parameterized-classes-and-tests.html)),
> the `@MethodSource`
> ([javadoc](https://docs.junit.org/6.0.3/api/org.junit.jupiter.params/org/junit/jupiter/params/provider/MethodSource.html))
> and `Arguments`
> ([javadoc](https://docs.junit.org/6.0.3/api/org.junit.jupiter.params/org/junit/jupiter/params/provider/Arguments.html))
> pages, and the 6.0.0 release notes
> ([docs.junit.org](https://docs.junit.org/6.0.3/release-notes/index.html)).
> JDK 25, Spring Boot 4.1.1, JUnit Jupiter 6.0.3.

**Every other source encodes cases as literals in an annotation. `@MethodSource` runs Java, so
a case can be a constructed aggregate, a value computed from another value, or anything with
no string form at all. Two things about it are not obvious and both are covered here: the
factory must be `static` unless you change the test-instance lifecycle for the whole class,
and the reference to it is a `String` that no compiler and no refactoring tool will verify.
The return-type contract — which is wider and stranger than it looks — is
[04b](04b-methodsource-return-types.md).**

## The shape

```java
@ParameterizedTest
@MethodSource("stringIntAndListProvider")
void testWithMultiArgMethodSource(String str, int num, List<String> list) {
    assertEquals(5, str.length());
    assertTrue(num >= 1 && num <= 2);
    assertEquals(2, list.size());
}

static Stream<Arguments> stringIntAndListProvider() {
    return Stream.of(
        arguments("apple", 1, Arrays.asList("a", "b")),
        arguments("lemon", 2, Arrays.asList("x", "y"))
    );
}
```

`arguments(Object...)` and `Arguments.of(Object...)` are the same thing —
*"`Arguments.of(Object…)` may be used as an alternative to `arguments(Object…)`"* — the
former reads better statically imported. Each `Arguments` instance is one invocation; its
elements map positionally onto the method's indexed parameters.

For a single-parameter method you can skip `Arguments` entirely:

```java
static Stream<String> stringProvider() {
    return Stream.of("apple", "banana");
}
```

## The `static` requirement and its one escape

> *"Factory methods within the test class must be `static` unless the test class is annotated
> with `@TestInstance(Lifecycle.PER_CLASS)`; whereas, factory methods in external classes must
> always be `static`."*

The reason is ordering: the factory is consulted to build the invocation contexts, and under
the default `PER_METHOD` lifecycle there is no test-class instance yet to call an instance
method on. `@TestInstance(PER_CLASS)` creates one instance for the whole class, which makes an
instance factory possible.

⚠️ **`PER_CLASS` is not a local change.** It also makes `@BeforeAll`/`@AfterAll` non-`static`,
and — the part that costs you — it means every test method in the class shares one instance,
so a field mutated by one test is visible to the next. Adopting it purely to avoid typing
`static` on a factory trades a keyword for a class-wide state hazard. The lifecycle modes
themselves belong to [01 · JUnit 5](../01-junit-5/README.md).

## Naming the factory

**By convention.** If you name no method, the factory is the one with the test method's own
name:

```java
@ParameterizedTest
@MethodSource
void testWithDefaultLocalMethodSource(String argument) { }

static Stream<String> testWithDefaultLocalMethodSource() {
    return Stream.of("apple", "banana");
}
```

> *"For a `@ParameterizedClass`, providing a factory method name via `@MethodSource` is
> mandatory. For a `@ParameterizedTest`, if you do not explicitly provide a factory method
> name, JUnit Jupiter will search for a factory method with the same name as the current
> `@ParameterizedTest` method by convention."*

**Externally**, by fully qualified name — and note the `$` for a nested class:

> *"Factory methods in external classes must be referenced by fully qualified method name — for
> example, `\"com.example.StringsProviders#blankStrings\"` or
> `\"com.example.TopLevelClass$NestedClass#classMethod\"` for a factory method in a static
> nested class."*

**Disambiguated**, when the name is overloaded:

> *"If a factory method accepts arguments that are provided by a `ParameterResolver`, you can
> supply the formal parameter list in the qualified method name to disambiguate between
> overloaded variants of the factory method. For example, `\"blankStrings(int)\"` for a local
> qualified method name or `\"com.example.StringsProviders#blankStrings(int)\"` for a fully
> qualified method name."*

🔴 **All three forms are strings.** Rename the factory with an IDE refactor and the annotation
is not updated; the failure arrives at test-discovery time, not compile time. This is the
single biggest practical cost of `@MethodSource` and the reason to prefer the
same-name convention where you can — a rename of the test method then breaks the pairing
loudly, in the same file, on the next line.

## Gotchas

**★ A non-`static` factory without `@TestInstance(PER_CLASS)`.** There is no instance to call
it on. Adding `PER_CLASS` fixes it and simultaneously makes every test in the class share one
instance and every `@BeforeAll` non-`static` — a much larger change than it looks.

**★ Reaching for `PER_CLASS` to avoid one keyword.** The shared instance is the point of that
mode, not a side effect. A field mutated by test 3 is visible to test 4, and the failure shows
up as order dependence weeks later. Type `static`.

**★ Renaming the factory with an IDE refactor.** The annotation holds a `String`; refactoring
tools generally do not rewrite it, and nothing fails until discovery. Prefer the
same-name-as-the-test convention, which at least breaks in the same file.

**★ Moving the factory to a shared `TestData` class and forgetting it must now be `static`
regardless.** External factories have no PER_CLASS escape — the rule is unconditional.

**★ A `.` instead of `$` in a nested-class reference.** The documented form is
`com.example.TopLevelClass$NestedClass#classMethod`. A dot yields "no such method" at
discovery, which reads like a classpath problem.

**★ Omitting the `#` in a fully qualified reference.** `com.example.Providers.tinyStrings` is
not a method reference in this syntax; the class and method are separated by `#`.

**★ Overloading the factory name.** Legal, but the annotation then needs the formal parameter
list — `"blankStrings(int)"` — to pick one. Easier not to overload.

**★ Doing real work in the factory.** Reading a database or standing a fixture up inside a
`@MethodSource` runs outside the test's own lifecycle, and the documentation does not define
when relative to `@BeforeAll` it happens — I could not confirm the ordering, so do not depend
on it. Keep factories to pure data construction.

**★ Using `@MethodSource` for a table of literals.** If every element of every `Arguments` is
a constant, you have written a CSV in Java with more punctuation. `@CsvSource` with a text
block displays that table better ([03b](03b-csv-text-blocks.md)).

**★ Building the same entities in every factory in the codebase.** That is what builders and
object mothers are for — **topic 08 · test data patterns** *(not written yet)*. A factory
method should assemble cases, not construct entities from scratch.

**★ Forgetting the arguments never reach `@BeforeEach`.** A `@MethodSource` supplying a
fully-built aggregate does not change that rule; only a
[`@ParameterizedClass`](08c-parameterized-classes.md) has invocation-scoped lifecycle hooks.

## Interview questions

**★ Why must a `@MethodSource` factory be `static`?**
Because the arguments are needed to build the test template's invocation contexts, and under
the default `PER_METHOD` test-instance lifecycle no instance of the test class exists at that
point. `@TestInstance(Lifecycle.PER_CLASS)` creates a single instance for the whole class,
which is why it lifts the requirement — for factories in the test class itself. Factories in
external classes must always be `static`.

**★ Is `PER_CLASS` a good way to avoid `static`?**
Rarely. It changes the lifecycle for the entire class: one shared instance across all test
methods, so mutable fields leak between tests, and `@BeforeAll`/`@AfterAll` become instance
methods. It is the right choice when you want that sharing, and a poor trade when you only
wanted to drop a keyword.

**★ How does JUnit find the factory if you do not name one?**
By convention it looks for a method in the test class with the same name as the
`@ParameterizedTest` method. That convention is not available to `@ParameterizedClass`, where
a name must always be given explicitly.

**★ How do you reference a factory in another class?**
By fully qualified method name: `com.example.StringsProviders#blankStrings`, with `$` for a
nested class. That method must be `static` regardless of the test class's lifecycle. If the
name is overloaded, append the formal parameter list — `#blankStrings(int)`.

**★ What is the main risk of `@MethodSource` compared with `@CsvSource`?**
The reference is an unchecked string, so renames and moves break it silently until discovery
time, and the cases are no longer visible as a table — a reader has to hold the factory and
the test method in their head at once. Use it when the cases are objects; use CSV when they
are literals.

{/* FOOTER */}
