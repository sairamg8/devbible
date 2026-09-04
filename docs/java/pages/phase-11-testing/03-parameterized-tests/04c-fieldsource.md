---
title: "@FieldSource says the same thing as @MethodSource with a constant instead of a call — and its one hard rule, that a field may not be a Stream or an Iterator unless wrapped in a Supplier, is a direct consequence of what single-use means"
sidebar_label: "04c · @FieldSource"
sidebar_position: 9
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-27 against the JUnit 6.0.3 User Guide, "@FieldSource"
> ([docs.junit.org](https://docs.junit.org/6.0.3/writing-tests/parameterized-classes-and-tests.html))
> and the `@FieldSource` javadoc
> ([docs.junit.org](https://docs.junit.org/6.0.3/api/org.junit.jupiter.params/org/junit/jupiter/params/provider/FieldSource.html)).
> JDK 25, Spring Boot 4.1.1, JUnit Jupiter 6.0.3.

**When a factory method's entire body is `return List.of(...)`, the method is ceremony.
`@FieldSource` points at the constant directly. It is the newest of the built-in sources —
added in 5.11 — and most tutorials predate it, so it is routinely missing from codebases that
would read better with it.**

## The shape

```java
@ParameterizedTest
@FieldSource("listOfFruits")
void singleFieldSource(String fruit) {
    assertFruit(fruit);
}

static final List<String> listOfFruits = Arrays.asList("apple", "banana");
```

And by convention, with no name at all:

```java
@ParameterizedTest
@FieldSource
void arrayOfFruits(String fruit) {
    assertFruit(fruit);
}

static final String[] arrayOfFruits = { "apple", "banana" };
```

> *"For a `@ParameterizedClass`, providing a field name via `@FieldSource` is mandatory. For a
> `@ParameterizedTest`, if you do not explicitly provide a field name, JUnit Jupiter will
> search in the test class for a field that has the same name as the current
> `@ParameterizedTest` method by convention."*

Multiple names concatenate:

```java
@ParameterizedTest
@FieldSource({ "listOfFruits", "additionalFruits" })
void multipleFieldSources(String fruit) {
    assertFruit(fruit);
}

static final Collection<String> additionalFruits = Arrays.asList("cherry", "dewberry");
```

> *"Consequently, this parameterized test method will be invoked four times: with the values
> `\"apple\"`, `\"banana\"`, `\"cherry\"`, and `\"dewberry\"`."*

External fields use the same `#` syntax as `@MethodSource`:
`@FieldSource("example.FruitUtils#tropicalFruits")`.

## `static`, with the same escape

> *"Fields within the test class must be `static` unless the test class is annotated with
> `@TestInstance(Lifecycle.PER_CLASS)`; whereas, fields in external classes must always be
> `static`."*

Identical rule, identical reasoning, identical trap: `PER_CLASS` is a class-wide lifecycle
change, not a keyword-avoidance device — see [04](04-methodsource.md).

## The rule that makes this source different

> *"In contrast to the supported return types for `@MethodSource` factory methods, the value
> of a `@FieldSource` field cannot be an instance of `Stream`, `DoubleStream`, `LongStream`,
> `IntStream`, or `Iterator`, since the values of such types are consumed the first time they
> are processed. However, if you wish to use one of these types, you can wrap it in a
> `Supplier` — for example, `Supplier<IntStream>`."*

This is not an arbitrary restriction, it is the only coherent design. A method can be called
again and hand back a fresh stream; a field holds one object forever. A `Stream`-typed field
would work exactly once per JVM and then quietly produce nothing — which is the worst possible
failure mode for a test source. Requiring a `Supplier` restores the "fresh each time"
property that a factory method had for free.

```java
static final Supplier<Stream<Arguments>> namedArgumentsSupplier = () -> Stream.of(
    arguments(named("Apple", "apple")),
    arguments(named("Banana", "banana"))
);
```

And the closing guarantee survives the wrapper:

> *"If the `Supplier` return type is `Stream` or one of the primitive streams, JUnit will
> properly close it by calling `BaseStream.close()`, making it safe to use a resource such as
> `Files.lines()`."*

## What a field may hold

> *"Generally speaking this translates to a `Collection`, an `Iterable`, a `Supplier` of a
> stream (`Stream`, `DoubleStream`, `LongStream`, or `IntStream`), a `Supplier` of an
> `Iterator`, an array of objects or primitives, or any type that provides an
> `iterator(): Iterator` method."*

Each element follows the same rules as `@MethodSource`: an `Arguments`, an object array, or a
bare value for a single-parameter method — **including the array-spreading rule**:

> *"Please note that a one-dimensional array of objects supplied as a set of \"arguments\" will
> be handled differently than other types of arguments. Specifically, all the elements of a
> one-dimensional array of objects will be passed as individual physical arguments."*

Multi-parameter tests take a collection of `Arguments`:

```java
@ParameterizedTest
@FieldSource("stringIntAndListArguments")
void testWithMultiArgFieldSource(String str, int num, List<String> list) { }

static List<Arguments> stringIntAndListArguments = Arrays.asList(
    arguments("apple", 1, Arrays.asList("a", "b")),
    arguments("lemon", 2, Arrays.asList("x", "y"))
);
```

## Where it earns its place

A `static final List<Arguments>` reads as *data*. A `static Stream<Arguments> cases()` reads as
*code that produces data*, and a reader has to check whether it does anything else. When the
cases are genuinely constant — a rounding table, a permission matrix, a list of malformed
inputs collected from incidents — the field form removes a layer of indirection and lets the
constant be declared next to the other constants it belongs with.

It is also the natural home for named argument sets, because a name attached to a constant is
documentation that survives:

```java
static List<Arguments> argumentSets = Arrays.asList(
    argumentSet("Important files", new File("path1"), new File("path2")),
    argumentSet("Other files", new File("path3"), new File("path4"))
);
```

`argumentSet` and `named` are covered in [07 · display names](07-display-names.md).

## Gotchas

**★ Declaring the field as `Stream<Arguments>`.** Explicitly unsupported. The value would be
consumed once and every later use would see an empty stream. Wrap it:
`Supplier<Stream<Arguments>>`.

**★ Declaring it as `Iterator`.** Same restriction, same reason, same fix — a `Supplier` of an
`Iterator` is supported, a bare `Iterator` is not.

**★ A mutable collection as a field.** Unlike a factory method, the field holds one instance for
the life of the JVM. If a test mutates an element, the next invocation and the next *test class
run* see the mutation. Declare the field `final` and populate it with an immutable collection.

**★ Forgetting `static` outside `PER_CLASS`.** Same rule as `@MethodSource`, and external
fields have no escape at all.

**★ Renaming the field.** The reference is a string. Renaming with an IDE refactor leaves the
annotation pointing at nothing, and the failure arrives at discovery.

**★ Naming a field the same as the test method and forgetting you did.** The convention form
picks it up silently. That is usually the intent, but it means adding an unrelated field with
a colliding name changes which data a test runs on.

**★ Assuming a one-dimensional `Object[]` element is one argument.** It is spread across the
parameter list, exactly as with `@MethodSource`.

**★ Reaching for `@FieldSource` when the data is not constant.** If the value has to be
computed, a method says so and a field pretends otherwise. Static initialisers that do real
work are worse than a factory method, not better.

**★ Expecting it in a JUnit 5.9-era codebase.** `@FieldSource` arrived in 5.11. On the version
Boot 4.1.0 manages — 6.0.3 — it is present and stable; on an older pinned Jupiter it may
simply not exist.

## Interview questions

**★ What is `@FieldSource` and when would you prefer it to `@MethodSource`?**
It points a parameterized test at a field instead of a factory method. Prefer it when the cases
are genuinely constant — a fixed table of `Arguments`, a list of malformed inputs — because a
`static final List` declares itself as data, where a method has to be read to confirm it does
nothing else.

**★ Why can a `@FieldSource` field not be a `Stream`?**
Because a field holds one object for the lifetime of the class and a stream can be consumed
once. The first use would drain it and every subsequent use would silently see nothing. The
documented workaround is a `Supplier` of the stream, which restores the "produce a fresh one
each time" property a method had naturally.

**★ Does JUnit still close a stream supplied that way?**
Yes. The guarantee is stated for the `Supplier` form as well: if the supplier's return type is
`Stream` or a primitive stream, JUnit closes it via `BaseStream.close()`.

**★ What types can the field be?**
A `Collection`, an `Iterable`, an array of objects or primitives, any type with an `iterator()`
method, a `Supplier` of a stream, or a `Supplier` of an `Iterator`. Elements are `Arguments`,
object arrays, or bare values for a single-parameter test.

**★ What are the `static` rules?**
The same as `@MethodSource`: fields in the test class must be `static` unless the class uses
`@TestInstance(Lifecycle.PER_CLASS)`; fields in external classes must always be `static`.

**★ What is the specific hazard of a field over a method?**
Shared mutable state. A method builds a new collection on each call; a field is one object
forever, so anything that mutates an argument leaks into later invocations and later tests.
`final` plus an immutable collection removes the hazard.

{/* FOOTER */}
