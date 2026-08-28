---
title: "A seven-column CSV table produces a seven-parameter test method, which is a signature nobody can read, so ArgumentsAccessor collapses the whole row into one parameter — and the price is that an aggregated parameter stops being an indexed parameter, which changes the ordering rules, the display name and what a custom provider can see"
sidebar_label: "08b · Aggregation"
sidebar_position: 17
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-27 against the JUnit 6.0.3 User Guide, "Argument Aggregation" and
> "Consuming Arguments"
> ([docs.junit.org](https://docs.junit.org/6.0.3/writing-tests/parameterized-classes-and-tests.html)),
> the `ArgumentsAccessor`
> ([javadoc](https://docs.junit.org/6.0.3/api/org.junit.jupiter.params/org/junit/jupiter/params/aggregator/ArgumentsAccessor.html))
> and `ParameterDeclarations`
> ([javadoc](https://docs.junit.org/6.0.3/api/org.junit.jupiter.params/org/junit/jupiter/params/support/ParameterDeclarations.html))
> pages. JDK 25, Spring Boot 4.1.0, JUnit Jupiter 6.0.3.

**Aggregation exists because of an arithmetic problem the documentation states plainly: one
argument, one parameter. Widen the table and you widen the signature, and at about five
columns the method declaration stops being readable and starts being a place to transpose two
`String` parameters. The fix is to collapse the row into one object — but an aggregated
parameter is a different *kind* of parameter, and almost every surprise in this chunk follows
from that one fact. This chunk is the built-in half — `ArgumentsAccessor`, injected for free.
Extracting the unpacking into a reusable class is [08i · custom
aggregators](08i-custom-aggregators.md).**

## The problem, in the documentation's words

> *"By default, each argument provided to a `@ParameterizedClass` or `@ParameterizedTest`
> corresponds to a single method parameter. Consequently, argument sources which are expected
> to supply a large number of arguments can lead to large constructor or method signatures,
> respectively."*
>
> *"In such cases, an `ArgumentsAccessor` can be used instead of multiple parameters. Using
> this API, you can access the provided arguments through a single argument passed to your test
> method. In addition, type conversion is supported as discussed in Implicit Conversion."*

## Two kinds of parameter, and the order they must appear in

This is the rule that makes everything else make sense:

> *"Zero or more indexed parameters must be declared first. Zero or more aggregators must be
> declared next. Zero or more arguments supplied by a `ParameterResolver` must be declared
> last."*
>
> *"In this context, an **indexed parameter** is an argument for a given index in the
> `Arguments` provided by an `ArgumentsProvider` that is passed as an argument to the
> parameterized method at the same index in the method's formal parameter list. An
> **aggregator** is any parameter of type `ArgumentsAccessor` or any parameter annotated with
> `@AggregateWith`."*

Three tiers, in a fixed order: indexed, aggregators, resolved. So this compiles and works —

```java
@ParameterizedTest
@CsvSource({ "Jane, Doe, F, 1990-05-20" })
void mixed(String firstName, ArgumentsAccessor rest, TestReporter reporter) { }
```

— and putting `reporter` before `rest`, or `rest` before `firstName`, does not. `TestReporter`
in first position is the classic version of this mistake ([01](01-one-test-many-cases.md)): the
engine tries to fill it from the argument source because position one is an indexed slot.

⚠️ Note what an accessor sees in that mixed form. The documentation does not say the accessor
is restricted to the arguments *after* the indexed ones — `ArgumentsAccessor` is defined as
aggregating *"a set of arguments for a given invocation"*. **I could not confirm from the
documentation whether index 0 on the accessor in a mixed signature is the first argument of the
row or the first unconsumed one.** Do not guess: either take the whole row through the
accessor, or use only indexed parameters. Mixed signatures are legal and their indexing is
underspecified.

A second consequence, from [06](06-argumentssource.md):

> *"Aggregators — parameters of type `ArgumentsAccessor` or parameters annotated with
> `@AggregateWith` — are not indexed and thus not included in the list of parameter
> declarations."*

So a custom `ArgumentsProvider` reading `ParameterDeclarations` cannot see the aggregated
parameter at all. A provider that infers what to supply from the method signature goes blind
the moment you aggregate.

## `ArgumentsAccessor`

> *"An instance of `ArgumentsAccessor` is automatically injected into any parameter of type
> `ArgumentsAccessor`."*

The guide's example:

```java
@ParameterizedTest
@CsvSource({
    "Jane, Doe, F, 1990-05-20",
    "John, Doe, M, 1990-10-22"
})
void testWithArgumentsAccessor(ArgumentsAccessor arguments) {
    Person person = new Person(
                                arguments.getString(0),
                                arguments.getString(1),
                                arguments.get(2, Gender.class),
                                arguments.get(3, LocalDate.class));
    // assertions against person
}
```

The whole API, from the javadoc:

| Method | Returns |
|---|---|
| `get(int index)` | `@Nullable Object` — the raw argument |
| `get(int index, Class<T> requiredType)` | the argument *"as an instance of the required type"* |
| `getString(int)`, `getBoolean(int)`, `getCharacter(int)` | typed, *"performing automatic type conversion as necessary"* |
| `getByte(int)`, `getShort(int)`, `getInteger(int)`, `getLong(int)`, `getFloat(int)`, `getDouble(int)` | as above |
| `size()` | *"the number of arguments in this accessor"* |
| `toArray()` | `@Nullable Object[]` |
| `toList()` | *"all arguments in this accessor as an immutable list"* |
| `getInvocationIndex()` | *"the index of the current invocation"* |

Two things to notice. **The typed getters run the same implicit conversion as a declared
parameter** ([08](08-conversion-and-aggregation.md)) — `get(2, Gender.class)` on the string
`"F"` produces the enum constant, and `get(3, LocalDate.class)` parses ISO-8601. So aggregation
does not cost you conversion.

And **every getter returns a nullable boxed type**. `getInteger(0)` on an empty CSV cell
returns `null`, not a conversion failure — the primitive-target rule that makes an `int`
parameter blow up does not apply, because the accessor's return type is `Integer`. That is a
real behavioural difference between `void test(int n)` and `arguments.getInteger(0)`, and it is
easy to unbox into an unhelpful `NullPointerException` inside the test body.

> *"Besides, you can retrieve the current test invocation index with
> `ArgumentsAccessor.getInvocationIndex()`."*

Useful for a message, dangerous for logic. A test whose behaviour branches on the invocation
index is a test that depends on the order of its own case table.

Out-of-range access is documented as a contract, not a convenience: each index parameter *"must
be greater than or equal to zero and less than `size()`"*, and the methods throw
`ArgumentAccessException`.

⚠️ `ArgumentsAccessor` is *"not intended to be implemented by clients."* Do not write a fake
one in a unit test of your own aggregator; call the aggregator through a parameterized test.

`toList()` is the one to reach for when the test is about the row as a collection rather than
as a record — *"all arguments in this accessor as an immutable list"*, so a defensive copy is
not needed and a mutation attempt is a failure rather than a corruption. `size()` plus
`toList()` also give you the honest way to assert that a table row has the width you expect,
which is the only protection an aggregated method has against a stale column
([08j](08j-argument-count-validation.md)).

## Aggregation and the report

From the display-name rules ([07](07-display-names.md)): each argument is preceded by its
parameter name *"unless the argument is only available via an `ArgumentsAccessor` or
`ArgumentAggregator`"*. An aggregated parameter has no name to print, so the default rendering
falls back to the raw source arguments. If the report matters — and it does
([07c](07c-naming-arguments.md)) — either set an explicit `name` pattern or supply
`argumentSet(...)` names from a `@MethodSource`.

## Gotchas

**★ Declaring the aggregator before an indexed parameter.** The order is fixed: indexed, then
aggregators, then `ParameterResolver`-supplied. Any other order fails, and the failure names
parameter resolution rather than your signature.

**★ Mixing indexed parameters and an accessor and assuming the accessor is offset.** The
documentation does not define the accessor's index base in a mixed signature and I could not
confirm it. Take the whole row or take none of it.

**★ Unboxing an accessor getter.** `getInteger(0)` returns `Integer`, and an empty CSV cell is
a `null`. `int n = arguments.getInteger(0);` turns a missing value into a
`NullPointerException` inside your test body rather than a conversion error at resolution time.

**★ Implementing `ArgumentsAccessor` yourself.** The javadoc says it *"is not intended to be
implemented by clients"*. Testing an aggregator in isolation by faking the accessor couples you
to an interface the project reserves the right to widen.

**★ Branching on `getInvocationIndex()`.** It makes the test's behaviour depend on the order of
rows in the table. Reordering the table then changes what is asserted, with nothing to signal
it.

**★ Aggregating and then wondering why the report got worse.** An aggregated argument has no
parameter name to print, so the default display name falls back to the raw arguments. Set a
`name` pattern, or name the argument sets at the source.

**★ Calling `get(int)` with an index at or past `size()`.** The javadoc states the contract —
the index *"must be greater than or equal to zero and less than `size()`"* — and the methods
throw `ArgumentAccessException`. An accessor written against a four-column table and pointed at
a three-column one fails here, at resolution, with a message about an index rather than about
your CSV.

**★ Mutating the list from `toList()`.** It is documented as immutable. Copy it if the test
needs to sort or filter destructively.

**★ Using an accessor to dodge a wide signature that should not exist.** Seven columns is a
signal about the test, not only about the signature. If four of them are constant across every
row they are setup, not parameters — see [09](09-when-not-to-parameterize.md).

## Interview questions

**★ What are the three kinds of parameter a parameterized test method can declare, and in what
order?**
Indexed parameters first — those matched positionally against the `Arguments` the source
supplied. Aggregators next — any parameter of type `ArgumentsAccessor` or annotated
`@AggregateWith`. Parameters resolved by a `ParameterResolver`, such as `TestInfo` or
`TestReporter`, last. The order is a documented rule, not a convention.

**★ Does aggregation lose you implicit type conversion?**
No. `ArgumentsAccessor.get(index, SomeType.class)` and the typed getters perform the same
automatic conversion a declared parameter would, so a CSV cell still becomes an enum constant
or a `LocalDate`. What it does lose is the primitive-target behaviour: the getters return boxed
nullable types, so a `null` cell comes back as `null` rather than failing conversion.

**★ How does aggregation interact with a custom `ArgumentsProvider`?**
It hides the parameter from it. `ParameterDeclarations` is documented as excluding aggregators
because they are not indexed, so a provider that adapts its output to the declared parameter
types sees nothing where the aggregated parameter is.

**★ How do you get an `ArgumentsAccessor` into a test?**
You declare a parameter of that type. The documentation says an instance *"is automatically
injected into any parameter of type `ArgumentsAccessor`"* — there is no annotation and nothing
to register. It must sit after any indexed parameters and before any `ParameterResolver`-supplied
ones.

**★ What happens if the accessor reads an index the row does not have?**
`ArgumentAccessException`. The index contract is documented as zero or greater and less than
`size()`. That is the failure mode aggregation trades for a compile error: a method with four
declared parameters cannot be fed a three-column row without the engine noticing, while an
accessor happily compiles and fails at run time.

**★ Can you get the invocation number inside the test body?**
Yes — `ArgumentsAccessor.getInvocationIndex()`. It is worth having for a message or a generated
filename. Branching test logic on it is not, because it couples the assertions to the order of
rows in the source table.

{/* FOOTER */}
