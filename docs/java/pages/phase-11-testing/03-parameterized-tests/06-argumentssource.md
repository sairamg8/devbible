---
title: "@ArgumentsSource is not an exotic escape hatch — every built-in source is one, and writing your own is the only way to get a source that reads a domain format, computes a combination, or answers to an annotation of your own"
sidebar_label: "06 · @ArgumentsSource"
sidebar_position: 11
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-27 against the JUnit 6.0.3 User Guide, "@ArgumentsSource"
> ([docs.junit.org](https://docs.junit.org/6.0.3/writing-tests/parameterized-classes-and-tests.html)),
> the `ArgumentsProvider`
> ([javadoc](https://docs.junit.org/6.0.3/api/org.junit.jupiter.params/org/junit/jupiter/params/provider/ArgumentsProvider.html))
> and `ParameterDeclarations`
> ([javadoc](https://docs.junit.org/6.0.3/api/org.junit.jupiter.params/org/junit/jupiter/params/support/ParameterDeclarations.html))
> pages. JDK 25, Spring Boot 4.1.0, JUnit Jupiter 6.0.3.

**`@ValueSource`, `@CsvSource`, `@EnumSource`, `@MethodSource`, `@NullSource` — every one of
them is declared `@ArgumentsSource(SomeProvider.class)`. There is one extension point and eight
prepackaged uses of it. Writing the ninth is a twenty-line class, and it is the right answer
whenever the *shape* of your cases is a rule rather than a list.**

## The interface

```java
@ParameterizedTest
@ArgumentsSource(MyArgumentsProvider.class)
void testWithArgumentsSource(String argument) {
    assertNotNull(argument);
}

public class MyArgumentsProvider implements ArgumentsProvider {

    @Override
    public Stream<? extends Arguments> provideArguments(ParameterDeclarations parameters,
            ExtensionContext context) {
        return Stream.of("apple", "banana").map(Arguments::of);
    }
}
```

Two structural requirements, both stated in the documentation:

> *"Note that an implementation of `ArgumentsProvider` must be declared as either a top-level
> class or as a static nested class."*

> *"Implementations must provide a no-args constructor or a single unambiguous constructor to
> use parameter resolution."*

An inner (non-`static`) class cannot be instantiated without an enclosing instance, and there
is none — the same reason `@MethodSource` factories must be `static`.

## 🔴 The signature changed — this is the JUnit 6 trap

Every tutorial written before mid-2025 shows this:

```java
// Deprecated since 5.13. Still compiles on 6.0.3; do not write new code against it.
Stream<? extends Arguments> provideArguments(ExtensionContext context)
```

The current method takes a `ParameterDeclarations` first:

```java
Stream<? extends Arguments> provideArguments(ParameterDeclarations parameters,
                                             ExtensionContext context)
```

Both are `default` methods on the interface, which is why an old implementation still compiles
— you are overriding a deprecated default rather than failing to implement an abstract method.
The javadoc marks the single-argument form `@Deprecated(since = "5.13")` with
`@API(status = DEPRECATED)`, and the two-argument form `@API(status = MAINTAINED, since =
"6.0.2")`. Write the two-argument one.

## What `ParameterDeclarations` gives you

It is the reason the signature changed: a provider can now see what the test method actually
declares.

> *"`ParameterDeclarations` encapsulates the combined declarations of all indexed parameters
> for a `@ParameterizedClass` or `@ParameterizedTest`. For a `@ParameterizedTest`, the
> parameter declarations are derived from the method signature. For a `@ParameterizedClass`,
> they may be derived from the constructor or `@Parameter`-annotated fields."*

> *"Aggregators — parameters of type `ArgumentsAccessor` or parameters annotated with
> `@AggregateWith` — are not indexed and thus not included in the list of parameter
> declarations."*

The API is small: `getAll()`, `getFirst()`, `get(int)`, `getSourceElement()` and
`getSourceElementDescription()`. That is enough to build a provider that adapts to the
parameter types it is feeding — the mechanism behind `@EnumSource`'s ability to infer its enum
type from the first parameter, and behind `@EmptySource` producing a `List` for a `List`
parameter and `""` for a `String` one.

## Worked example: the cartesian product nobody ships

Nothing in `junit-jupiter-params` produces a cross product — stacked source annotations
concatenate. When you genuinely need "every payment method against every currency", that rule
is a provider:

```java
public class PaymentMatrixProvider implements ArgumentsProvider {

    @Override
    public Stream<? extends Arguments> provideArguments(ParameterDeclarations parameters,
            ExtensionContext context) {
        return Arrays.stream(PaymentMethod.values())
            .flatMap(method -> Stream.of("EUR", "USD", "GBP")
                .map(currency -> Arguments.of(method, currency)));
    }
}

@ParameterizedTest
@ArgumentsSource(PaymentMatrixProvider.class)
void everyMethodQuotesInEveryCurrency(PaymentMethod method, String currency) {
    assertThat(quoteService.quote(method, currency)).isNotNull();
}
```

Twelve invocations from six lines, and — the part that matters — adding a `PaymentMethod`
constant adds three more cases without anyone editing the test. That is the `@EnumSource`
`EXCLUDE` argument ([05](05-enumsource.md)) generalised: *express the rule, not the
enumeration*.

⚠️ A cross product grows multiplicatively. Four methods × three currencies × two locales is
twenty-four full test invocations with twenty-four lifecycles. Build the matrix at the cheapest
layer that can express it.

## Your own annotation

A provider referenced by class is fine once. When the same source is used across a codebase,
give it an annotation:

```java
@Retention(RetentionPolicy.RUNTIME)
@Target(ElementType.METHOD)
@ArgumentsSource(PaymentMatrixProvider.class)
public @interface PaymentMatrixSource { }
```

`@ParameterizedTest @PaymentMatrixSource` now reads like a built-in, because it is built the
same way the built-ins are. If the annotation needs attributes, the provider must read them:

> *"If you wish to implement a custom `ArgumentsProvider` that also consumes an annotation
> (like built-in providers such as `ValueArgumentsProvider` or `CsvArgumentsProvider`), you
> have the possibility to extend the `AnnotationBasedArgumentsProvider` class."*

## Providers can be injected

> *"Moreover, `ArgumentsProvider` implementations may declare constructor parameters in case
> they need to be resolved by a registered `ParameterResolver`."*

```java
public class MyArgumentsProviderWithConstructorInjection implements ArgumentsProvider {

    private final TestInfo testInfo;

    public MyArgumentsProviderWithConstructorInjection(TestInfo testInfo) {
        this.testInfo = testInfo;
    }

    @Override
    public Stream<? extends Arguments> provideArguments(ParameterDeclarations parameters,
            ExtensionContext context) {
        return Stream.of(Arguments.of(testInfo.getDisplayName()));
    }
}
```

This is also where a provider can reach the `ExtensionContext` — the test class, the tags, the
store — to vary its cases. Which is powerful and worth being suspicious of: a test whose case
list depends on the environment is a test that proves different things in different places.

## Repeatable, like the rest

`@ArgumentsSource` is `@Repeatable(ArgumentsSources.class)`, so a custom provider composes with
the built-ins:

```java
@ParameterizedTest
@NullAndEmptySource
@ArgumentsSource(MalformedIbanProvider.class)
void rejectsBadIbans(String iban) { }
```

Arguments concatenate in declaration order, as always.

## Gotchas

**★ Implementing the deprecated single-argument `provideArguments(ExtensionContext)`.** It
still compiles on 6.0.3 because both forms are `default` methods — so the compiler will not tell
you. Deprecated since 5.13; write the `ParameterDeclarations` overload.

**★ Declaring the provider as a non-`static` inner class.** Documented as unsupported: it must
be top-level or a `static` nested class. There is no enclosing instance for JUnit to use.

**★ Giving the provider two constructors.** The requirement is a no-args constructor *or a
single unambiguous constructor* for parameter resolution. Two candidates is not unambiguous.

**★ Holding state in the provider across invocations.** The documentation does not specify the
instantiation lifecycle of a provider — **I could not confirm whether one instance is reused**
— so treat the provider as stateless and derive everything from its inputs.

**★ Building a cross product without counting it.** Multiplication is fast. Three sources of
five, four and three values is sixty invocations of the full test lifecycle, which is a
different conversation if the test is a `@SpringBootTest`.

**★ Reading the filesystem or a database inside a provider.** The case list becomes
environment-dependent and the failure at discovery time does not look like a test failure. If
the data must come from a file, `@CsvFileSource` at least fails with a message about a file.

**★ Varying the cases by `ExtensionContext`.** A provider that returns different cases for
different tags produces a suite that is green locally and red in CI for reasons nobody can see
in the test method. Use it for genuinely context-derived data, never for skipping.

**★ Writing a provider when a `@MethodSource` would do.** A provider is worth the class when it
is reused, parameterised by its own annotation, or driven by `ParameterDeclarations`. For one
test's cases, a factory method is less machinery.

**★ Forgetting the annotation needs `@Retention(RUNTIME)`.** A composed source annotation
without runtime retention is invisible to the engine, and the test fails as though it had no
source at all.

**★ Reaching for a provider to generate random inputs.** A provider that produces random values
makes failures unreproducible and gives you none of the shrinking that makes generated input
useful. That job belongs to **topic 10 · jqwik** *(not written yet)*, which does it with a
recorded seed and a minimised counterexample.

## Interview questions

**★ How do the built-in argument sources relate to `@ArgumentsSource`?**
They *are* `@ArgumentsSource` uses. `@ValueSource` is meta-annotated
`@ArgumentsSource(ValueArgumentsProvider.class)`, `@CsvSource` with `CsvArgumentsProvider`, and
so on. There is one extension point; the built-ins are prepackaged providers plus an annotation
to configure each.

**★ What is the current `ArgumentsProvider` signature, and what changed?**
`Stream<? extends Arguments> provideArguments(ParameterDeclarations parameters,
ExtensionContext context)`. The older single-argument form taking only the `ExtensionContext`
has been deprecated since 5.13. Both are `default` methods, so an old implementation still
compiles against 6.0.3 without any error — which is exactly why stale code survives the
upgrade.

**★ What does `ParameterDeclarations` let a provider do?**
See what the test actually declares: all indexed parameter declarations in order, the first
one, one by index, and the annotated source element. Aggregators are deliberately excluded
because they are not indexed. It is what lets a provider produce arguments appropriate to the
declared types — the mechanism behind `@EnumSource` inferring its enum type from the first
parameter.

**★ What are the constraints on the provider class?**
It must be a top-level class or a `static` nested class, and it must have either a no-args
constructor or a single unambiguous constructor whose parameters a registered
`ParameterResolver` can supply.

**★ How would you produce a cartesian product of two sets of values?**
With a custom provider — nothing built in does it, because stacked source annotations
concatenate rather than combine. A `flatMap` over the two sets returning `Arguments.of(a, b)`
is the whole implementation, and it has the same virtue as `@EnumSource` with `EXCLUDE`: adding
a value to either set adds cases without editing the test.

**★ How do you turn a provider into a reusable annotation?**
Declare an annotation with `@Retention(RUNTIME)`, an appropriate `@Target`, and
`@ArgumentsSource(YourProvider.class)` on it. If the annotation carries attributes the provider
needs to read, extend `AnnotationBasedArgumentsProvider` rather than implementing the interface
directly.

**★ When is a custom provider the wrong choice?**
When it is one test's data — a `@MethodSource` factory says the same thing with less
machinery — and when it would make the case list depend on the environment. A source whose
output varies with the machine, the clock or the active profile turns a deterministic suite
into a flaky one.

{/* FOOTER */}
