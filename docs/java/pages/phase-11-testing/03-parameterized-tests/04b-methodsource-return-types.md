---
title: "The @MethodSource return-type contract accepts almost anything iterable, spreads a one-dimensional object array into separate parameters but not a primitive one, and closes your stream for you — three rules that decide whether your factory compiles into the test you meant"
sidebar_label: "04b · @MethodSource return types"
sidebar_position: 8
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
> JDK 25, Spring Boot 4.1.0, JUnit Jupiter 6.0.3.

**"Returns `Stream<Arguments>`" is the summary, not the contract. The contract accepts a dozen
shapes, and two of its rules are asymmetric in a way that produces a method which compiles,
runs, and passes the wrong arguments: a one-dimensional array of objects is spread across your
parameters, a one-dimensional array of primitives is not. Getting [04](04-methodsource.md)'s
plumbing right and then getting this wrong is the usual way a `@MethodSource` goes bad.**

## The return-type contract is wide

> *"Generally speaking this translates to a `Stream` of `Arguments` (i.e.,
> `Stream<Arguments>`); however, the actual concrete return type can take on many forms. In
> this context, a \"stream\" is anything that JUnit can reliably convert into a `Stream`, such
> as `Stream`, `DoubleStream`, `LongStream`, `IntStream`, `Collection`, `Iterator`,
> `Iterable`, an array of objects or primitives, or any type that provides an
> `iterator(): Iterator` method (such as, for example, a `kotlin.sequences.Sequence`)."*

And each element may be an `Arguments`, an object array, or a bare value for a single-parameter
method. The javadoc's compatibility table is the reference:

| Test method | Factory method |
|---|---|
| `void test(int)` | `static int[] factory()` |
| `void test(int)` | `static IntStream factory()` |
| `void test(String)` | `static String[] factory()` |
| `void test(String)` | `static List<String> factory()` |
| `void test(String)` | `static Stream<String> factory()` |
| `void test(String, String)` | `static String[][] factory()` |
| `void test(String, int)` | `static Object[][] factory()` |
| `void test(String, int)` | `static Stream<Object[]> factory()` |
| `void test(String, int)` | `static Stream<Arguments> factory()` |
| `void test(int[])` | `static int[][] factory()` |
| `void test(int[])` | `static Stream<int[]> factory()` |
| `void test(int[][])` | `static Stream<int[][]> factory()` |
| `void test(Object[][])` | `static Stream<Object[][]> factory()` |

### The array-spreading rule

Rows 6–8 and 10–13 encode a rule that catches everyone once:

> *"Please note that a one-dimensional array of objects supplied as a set of \"arguments\" will
> be handled differently than other types of arguments. Specifically, all of the elements of a
> one-dimensional array of objects will be passed as individual physical arguments to the
> `@ParameterizedTest` method. In contrast, any multidimensional array supplied as a set of
> \"arguments\" will be passed as a single physical argument to the `@ParameterizedTest`
> method."*

So `Stream<Object[]>` feeds `test(String, int)` — the array is *spread*. If you actually want a
single `Object[]` parameter, you need an extra dimension, or wrap it:
`arguments((Object) myArray)`. A test method taking `String[] permissions` with a factory
returning `Stream<String[]>` will not do what it looks like.

Note the asymmetry in rows 10–11: a one-dimensional array of *primitives* (`int[]`) is not
spread — the spreading rule is about object arrays.

## Streams are closed for you

> *"If the return type is `Stream` or one of the primitive streams, JUnit will properly close
> it by calling `BaseStream.close()`, making it safe to use a resource such as
> `Files.lines()`."*

```java
static Stream<String> ibansFromSpec() throws IOException {
    return Files.lines(Path.of("src/test/resources/ibans.txt"));
}
```

That is a documented guarantee, not an inference. It is also the reason a factory should return
a fresh stream every call rather than a stored one — a consumed stream cannot be re-consumed,
which is exactly the constraint that makes [`@FieldSource`](04c-fieldsource.md) require a
`Supplier` wrapper.

## The factory can take arguments of its own

> *"Factory methods can declare parameters, which will be provided by registered
> implementations of the `ParameterResolver` extension API."*

```java
static Stream<Arguments> factoryMethodWithArguments(int quantity) {
    return Stream.of(
        arguments(quantity + " apples"),
        arguments(quantity + " lemons")
    );
}
```

This is how a factory reaches a resolver-supplied value — a `TestInfo`, or something a custom
extension provides. It is also why the overload-disambiguation syntax exists.

## Repeatable, and one 6.0 note

`@MethodSource` is `@Repeatable`, so two factories can feed one test and their arguments
concatenate:

```java
@ParameterizedTest
@MethodSource("someProvider")
@MethodSource("otherProvider")
void testWithRepeatedAnnotation(String argument) { }
```

And in 6.0: *"The `Arguments` interface for parameterized tests is now officially a
`@FunctionalInterface`."* A lambda returning the argument array is now a legal `Arguments` —
rarely useful directly, but it means `Arguments` can be produced by a method reference in
stream code.

## Gotchas

**★ Returning `Stream<Object[]>` and expecting one `Object[]` parameter.** One-dimensional
object arrays are spread into individual physical arguments. Wrap with
`arguments((Object) arr)` or return `Stream<Object[][]>`.

**★ Assuming primitive arrays spread too.** They do not — `Stream<int[]>` feeds a single
`int[]` parameter. The spreading rule is specific to object arrays, and the asymmetry is the
part people misremember.

**★ A test method taking `String[] roles` fed by `Stream<String[]>`.** This is the spread
trap in its most common disguise: each `String[]` is scattered across the parameter list, so a
two-element array looks like a two-parameter call and a three-element one fails. Use
`Stream<String[][]>` or wrap each array as a single argument.

**★ Storing the stream in a field and returning it.** A stream is single-use; a second
invocation, or a repeated annotation referencing the same factory twice, has nothing left to
consume. Build a new stream on every call. (That same constraint is why `@FieldSource`
requires a `Supplier` — [04c](04c-fieldsource.md).)

**★ Closing the stream yourself in a `try`-with-resources inside the factory.** You would be
returning a closed stream. JUnit closes it after consuming it; that is the documented
contract.

**★ Returning an `Iterator`.** Accepted, and single-use for the same reason a stream is. A
`Collection` or a fresh `Stream` is the safer default.

**★ Producing more elements per `Arguments` than the method has parameters.** By default the
extras are silently ignored, which is precisely how a factory drifts out of sync with the
method it feeds. Turn on strict `argumentCountValidation` — [08b](08b-aggregation.md).

**★ Producing fewer.** That is a failure, not a silent `null`; the engine has no argument for
the parameter.

**★ Two repeated `@MethodSource` annotations whose factories return different arities.** The
arguments concatenate, so invocation 1 may supply two values and invocation 4 supply three,
against one fixed parameter list. Repeated sources must agree on shape.

**★ Expecting a `ParameterResolver`-supplied factory parameter to be the test's argument.** A
factory's own parameters are resolved by registered extensions — a `TestInfo`, something a
custom extension provides. They are not the parameterized test's arguments; those do not exist
yet when the factory runs.

**★ Relying on `Arguments` being a lambda target before 6.0.** `Arguments` only became an
official `@FunctionalInterface` in JUnit 6.0. On 5.x the same lambda may not compile.

## Interview questions

**★ What return types does `@MethodSource` accept?**
Anything JUnit can reliably turn into a stream: `Stream` and the primitive streams
(`IntStream`, `LongStream`, `DoubleStream`), `Collection`, `Iterator`, `Iterable`, arrays of
objects or primitives, or any type exposing an `iterator()` method — a Kotlin `Sequence`, for
instance. Each element may be an `Arguments`, an object array, or a bare value when the test
takes a single parameter.

**★ What is the difference between `Stream<Object[]>` and `Stream<int[]>` as a return type?**
A one-dimensional *object* array is spread — its elements become separate physical arguments —
so `Stream<Object[]>` feeds a multi-parameter method. A primitive array is not spread, so
`Stream<int[]>` feeds a single `int[]` parameter. Multidimensional arrays of either kind are
passed whole, as one argument.

**★ How do you pass an object array as a single argument?**
Give it another dimension (`Stream<Object[][]>`), or defeat the varargs spread explicitly with
a cast: `arguments((Object) myArray)`. Without one of those, the array's elements are
distributed across the parameter list.

**★ Who closes a stream returned by a factory?**
JUnit does. The documentation guarantees that a returned `Stream` or primitive stream is
closed via `BaseStream.close()`, which is what makes returning `Files.lines()` directly safe.
Do not close it yourself.

**★ Why must a factory return a fresh stream each time?**
Because a stream can be consumed once. The factory may be invoked more than once — repeated
`@MethodSource` annotations can name it twice — and a cached, already-consumed stream yields
nothing. This is the exact constraint that makes `@FieldSource` reject a `Stream`-typed field
and require a `Supplier` of one.

**★ Can a factory method take parameters?**
Yes — they are resolved by registered `ParameterResolver` extensions, which is how a factory
reaches a `TestInfo` or an extension-supplied value. It is also why the annotation supports a
formal parameter list in the reference, so overloaded factories can be disambiguated.

**★ What is `arguments(...)` and how does it differ from `Arguments.of(...)`?**
Nothing but readability. Both are static factory methods on the `Arguments` interface producing
the same thing; `arguments` reads better statically imported. As of JUnit 6.0 `Arguments` is
also an official `@FunctionalInterface`, so a lambda returning the argument array is a valid
implementation.

{/* FOOTER */}
