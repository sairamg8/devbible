---
title: "@BeforeAll runs once for the whole parameterized class and @BeforeEach runs once per test method, which leaves a gap exactly where the arguments live — so 5.13 added @BeforeParameterizedClassInvocation and @AfterParameterizedClassInvocation, the only hooks that see the argument set they are setting up for"
sidebar_label: "08f · Parameterized class lifecycle"
sidebar_position: 21
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-27 against the JUnit 6.0.3 User Guide, "Lifecycle and Interoperability" →
> "Parameterized Classes"
> ([docs.junit.org](https://docs.junit.org/6.0.3/writing-tests/parameterized-classes-and-tests.html)),
> the `@BeforeParameterizedClassInvocation`
> ([javadoc](https://docs.junit.org/6.0.3/api/org.junit.jupiter.params/org/junit/jupiter/params/BeforeParameterizedClassInvocation.html))
> and `@ParameterizedClass`
> ([javadoc](https://docs.junit.org/6.0.3/api/org.junit.jupiter.params/org/junit/jupiter/params/ParameterizedClass.html))
> pages. JDK 25, Spring Boot 4.1.1, JUnit Jupiter 6.0.3.

**A parameterized class has three nested scopes — the class, the invocation, the test method —
and Jupiter's original two hooks only cover the outer and inner ones. `@BeforeAll` fires once
before any argument set exists; `@BeforeEach` fires per test method and cannot tell you which
argument set it is inside. The invocation scope in the middle is where "write this row's file
to disk before the tests read it" belongs, and it needed two new annotations.**

## What the existing hooks do

> *"Each invocation of a parameterized class has the same lifecycle as a regular test class.
> For example, `@BeforeAll` methods will be executed once before all invocations and
> `@BeforeEach` methods will be executed before each test method invocation."*

Read that carefully, because the sentence contains both scopes:

| Hook | Runs |
|---|---|
| `@BeforeAll` | **once**, before *all* invocations of the class |
| `@BeforeParameterizedClassInvocation` | once per argument set |
| `@BeforeEach` | before each test method, inside each argument set |

So a class with 3 argument sets and 2 test methods runs `@BeforeAll` once,
`@BeforeParameterizedClassInvocation` three times and `@BeforeEach` six times.

And the constraint that makes the middle hook necessary:

> *"You may use `ParameterResolver` extensions with `@ParameterizedClass` constructors.
> However, if constructor injection is used, constructor parameters that are resolved by
> argument sources need to come first in the parameter list. Values from argument sources are
> not resolved for regular lifecycle methods (e.g. `@BeforeEach`)."*

`@BeforeEach void setUp(String fruit)` does not work, for the same reason it does not work on a
`@ParameterizedTest` ([01](01-one-test-many-cases.md)): a lifecycle method is shared with
everything else in the class and there is no argument to give it.

## The invocation hooks

> *"In addition to regular lifecycle methods, parameterized classes may declare
> `@BeforeParameterizedClassInvocation` and `@AfterParameterizedClassInvocation` lifecycle
> methods that are called once before/after each invocation of the parameterized class. These
> methods must be `static` unless the parameterized class is configured to use
> `@TestInstance(Lifecycle.PER_CLASS)`."*

The javadoc is stricter still:

> *"`@BeforeParameterizedClassInvocation` methods must have a `void` return type, must not be
> `private`, and must be `static` unless the test class is annotated with
> `@TestInstance(Lifecycle.PER_CLASS)`."*
>
> *"Declaring `@BeforeParameterizedClassInvocation` methods in a regular, non-parameterized test
> class has no effect and will be ignored."*

⚠️ That second sentence is the quiet one. Move a hook into a shared base class that some
subclasses do not parameterize and it silently stops running for those. No warning, no failure —
the setup just does not happen.

## The signature rules

This is the only lifecycle hook in Jupiter that receives the arguments, and the rules are
precise:

> *"If `injectArguments()` is set to `false`, the parameters must be resolved by other
> registered `ParameterResolvers`."*
>
> *"If `injectArguments()` is set to `true` (the default), the method must declare the same
> parameters, in the same order, as the indexed parameters of the parameterized test class. It
> may declare a subset of the indexed parameters **starting from the first argument**.
> Additionally, the method may declare custom aggregator parameters at the end of its parameter
> list. If the method declares additional parameters after these aggregator parameters, or more
> parameters than the class has indexed parameters, they may be resolved by other
> `ParameterResolvers`."*

The javadoc then lists every legal shape for a class whose indexed parameters are `int` and
`String`:

```java
@BeforeParameterizedClassInvocation
void beforeInvocation() { ... }

@BeforeParameterizedClassInvocation
void beforeInvocation(int number) { ... }

@BeforeParameterizedClassInvocation
void beforeInvocation(int number, String text) { ... }

@BeforeParameterizedClassInvocation
void beforeInvocation(int number, String text, TestInfo testInfo) { ... }

@BeforeParameterizedClassInvocation
void beforeInvocation(ArgumentsAccessor accessor) { ... }

@BeforeParameterizedClassInvocation
void beforeInvocation(ArgumentsAccessor accessor, TestInfo testInfo) { ... }

@BeforeParameterizedClassInvocation
void beforeInvocation(int number, String text, ArgumentsAccessor accessor) { ... }

@BeforeParameterizedClassInvocation
void beforeInvocation(int number, String text, ArgumentsAccessor accessor, TestInfo testInfo) { ... }
```

**"A subset starting from the first argument" is the rule to remember.** You may take the first
one, or the first two, or none — you may not take only the second. If the row's second column is
what your setup needs, take both and ignore the first, or take an `ArgumentsAccessor`.

Note that this is the same three-tier ordering as everywhere else in this topic
([08b](08b-aggregation.md)): indexed, then aggregators, then resolver-supplied.

What happens when a class, a superclass and an interface each declare one of these hooks — and
why the JUnit team recommends declaring at most one — is
[08g](08g-invocation-hook-ordering.md).

## The worked example from the guide

```java
@ParameterizedClass
@MethodSource("textFiles")
class TextFileTests {

    static List<TextFile> textFiles() {
        return List.of(
            new TextFile("file1", "first content"),
            new TextFile("file2", "second content")
        );
    }

    @Parameter
    TextFile textFile;

    @BeforeParameterizedClassInvocation
    static void beforeInvocation(TextFile textFile, @TempDir Path tempDir) throws Exception {
        var filePath = tempDir.resolve(textFile.fileName);   // initialise the argument
        textFile.path = Files.writeString(filePath, textFile.content);
    }

    @AfterParameterizedClassInvocation
    static void afterInvocation(TextFile textFile) throws Exception {
        var actualContent = Files.readString(textFile.path); // validate and clean up
        assertEquals(textFile.content, actualContent, "Content must not have changed");
    }

    @Test
    void test() {
        assertTrue(Files.exists(textFile.path));             // use it
    }

    @Test
    void anotherTest() {
        // ...
    }

    static class TextFile {
        final String fileName;
        final String content;
        Path path;

        TextFile(String fileName, String content) { … }

        @Override
        public String toString() { return fileName; }
    }
}
```

The guide's own annotation of that listing: *"Initialization of the argument before each
invocation of the parameterized class"*, *"Usage of the previously initialized argument in a
test method"*, *"Validation and cleanup of the argument after each invocation of the
parameterized class"*.

Three things this example teaches beyond the hook itself. The hook is `static` while the
`@Parameter` field is not — the hook receives the argument as a *parameter*, the tests read it
from the *field*, and both refer to the same object. `@TempDir` is resolved by an ordinary
`ParameterResolver`, so it goes last. And the `TextFile` class defines `toString()` returning
the file name, which is what makes the display name readable
([07c](07c-naming-arguments.md)) — the guide is quietly demonstrating that too.

⚠️ The pattern here is *mutating the argument object* (`textFile.path = …`). That works because
each argument set is used for exactly one invocation, but it means the objects your
`@MethodSource` returns are not immutable value objects. What happens to those objects once the
invocation ends — including the fact that an `AutoCloseable` one is closed for you — is
[08h · argument lifetime](08h-argument-lifetime.md).

## Gotchas

**★ Expecting `@BeforeAll` to see the arguments.** It runs once, before any invocation, so
there is no argument set yet. A `@Parameter` field read from `@BeforeAll` has not been injected.
The per-invocation hook is the one that receives arguments.

**★ Declaring a parameter on `@BeforeEach`.** Values from argument sources are documented as not
resolved for regular lifecycle methods. The method is shared with everything else in the class,
including non-parameterized tests, so there is nothing to inject.

**★ A non-`static` invocation hook without `PER_CLASS`.** The javadoc requires `static` unless
the class is `@TestInstance(Lifecycle.PER_CLASS)`. It must also be `void` and non-`private`.

**★ Taking the second indexed parameter but not the first.** A subset is allowed only *starting
from the first argument*. Take both and ignore one, or take an `ArgumentsAccessor`.

**★ Putting `TestInfo` before the indexed parameters.** The same three-tier order applies here
as everywhere: indexed, aggregators, resolver-supplied. Resolver parameters go last.

**★ Moving an invocation hook into a base class that some subclasses do not parameterize.**
Documented behaviour: in a regular, non-parameterized test class the annotation *"has no effect
and will be ignored"*. Silent.

**★ Setting `injectArguments = false` and then declaring an argument-shaped parameter.** With
the flag off, *every* parameter must be resolvable by a registered `ParameterResolver`. A
`String` parameter with no resolver for it is a failure, not a fallback to the arguments.

## Interview questions

**★ How many lifecycle scopes does a parameterized class have?**
Three. `@BeforeAll` and `@AfterAll` bracket the whole class, running once regardless of how many
argument sets there are. `@BeforeParameterizedClassInvocation` and
`@AfterParameterizedClassInvocation` bracket one argument set. `@BeforeEach` and `@AfterEach`
bracket one test method inside one argument set. A class with three argument sets and two tests
runs the outer pair once, the middle pair three times and the inner pair six times.

**★ Why can't `@BeforeEach` take the argument?**
Because lifecycle methods are shared by the whole class — including ordinary `@Test` methods
that have no arguments — so the documentation states that values from argument sources are not
resolved for them. The invocation hooks exist precisely to fill that gap, and they are the only
lifecycle methods that receive arguments.

**★ What are the signature rules for `@BeforeParameterizedClassInvocation`?**
`void`, non-`private`, and `static` unless the class uses `PER_CLASS`. With `injectArguments`
at its default of `true`, the parameters must be the class's indexed parameters in the same
order — optionally a prefix of them, starting from the first — then optional aggregator
parameters, then anything a `ParameterResolver` can supply. With `injectArguments = false`,
every parameter must come from a `ParameterResolver`.

**★ In the guide's `TextFileTests` example, why is the hook `static` while the field is not?**
Because the hook must be `static` under the default `PER_METHOD` lifecycle, and it does not need
the instance: it receives the argument object as a parameter and mutates it. The tests then read
the same object from the injected `@Parameter` field. The two views are of one object, which is
what makes the "initialise then use" pattern work at all.

{/* FOOTER */}
