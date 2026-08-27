---
title: "An ArgumentsAccessor leaves the unpacking code inside every test method that uses it, so an ArgumentsAggregator extracts it once — and JUnit 6 changed the shape of that class, because @ParameterizedClass gave aggregators a second target and the interface grew a FieldContext method to match"
sidebar_label: "08i · Custom aggregators"
sidebar_position: 24
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-27 against the JUnit 6.0.3 User Guide, "Custom Aggregators"
> ([docs.junit.org](https://docs.junit.org/6.0.3/writing-tests/parameterized-classes-and-tests.html)),
> the `ArgumentsAggregator`
> ([javadoc](https://docs.junit.org/6.0.3/api/org.junit.jupiter.params/org/junit/jupiter/params/aggregator/ArgumentsAggregator.html)),
> `SimpleArgumentsAggregator`
> ([javadoc](https://docs.junit.org/6.0.3/api/org.junit.jupiter.params/org/junit/jupiter/params/aggregator/SimpleArgumentsAggregator.html)),
> `@AggregateWith`
> ([javadoc](https://docs.junit.org/6.0.3/api/org.junit.jupiter.params/org/junit/jupiter/params/aggregator/AggregateWith.html))
> and `ArgumentsAggregationException`
> ([javadoc](https://docs.junit.org/6.0.3/api/org.junit.jupiter.params/org/junit/jupiter/params/aggregator/ArgumentsAggregationException.html))
> pages. JDK 25, Spring Boot 4.1.0, JUnit Jupiter 6.0.3.

**[08b](08b-aggregation.md) solved the wide-signature problem with `ArgumentsAccessor`, at the
cost of putting four `get` calls at the top of the test method. If two tests read the same
table, both contain the same four calls. An `ArgumentsAggregator` moves them out once and turns
the row into a domain object the test can simply assert against — and the class you write for it
does not look the way it did in JUnit 5.**

## The shape

> *"To use a custom aggregator, implement the `ArgumentsAggregator` interface and register it
> via the `@AggregateWith` annotation on a compatible parameter of the `@ParameterizedClass` or
> `@ParameterizedTest`. The result of the aggregation will then be provided as an argument for
> the corresponding parameter when the parameterized test is invoked. Note that an
> implementation of `ArgumentsAggregator` must be declared as either a top-level class or as a
> `static` nested class."*

```java
@ParameterizedTest
@CsvSource({
    "Jane, Doe, F, 1990-05-20",
    "John, Doe, M, 1990-10-22"
})
void testWithArgumentsAggregator(@AggregateWith(PersonAggregator.class) Person person) {
    // perform assertions against person
}

public class PersonAggregator extends SimpleArgumentsAggregator {
    @Override
    protected Person aggregateArguments(ArgumentsAccessor arguments, Class<?> targetType,
            AnnotatedElementContext context, int parameterIndex) {
        return new Person(
                            arguments.getString(0),
                            arguments.getString(1),
                            arguments.get(2, Gender.class),
                            arguments.get(3, LocalDate.class));
    }
}
```

The test body is now assertions and nothing else, which is the whole return on the extra class.

## 🔴 `SimpleArgumentsAggregator` is the JUnit 6 shape

Every tutorial written before 2025 shows the other one. In 5.x you implemented
`ArgumentsAggregator` directly and overrode a single method taking a `ParameterContext`.
`@ParameterizedClass` added a second possible target — a `@Parameter`-annotated *field*
([08e](08e-parameterized-class-field-injection.md)) — so the interface now declares two:

> *"`@Nullable Object aggregateArguments(ArgumentsAccessor accessor, ParameterContext
> context)`"*
>
> *"`default @Nullable Object aggregateArguments(ArgumentsAccessor accessor, FieldContext
> context)`"*

and an abstract base class exists to spare you writing both:

> *"`SimpleArgumentsAggregator` is an abstract base class for `ArgumentsAggregator`
> implementations that do not need to distinguish between fields and method/constructor
> parameters."*

Its single abstract method is the four-argument one in the example above:
`aggregateArguments(ArgumentsAccessor, Class<?>, AnnotatedElementContext, int)`. Note the
parameter types — `AnnotatedElementContext` is the common supertype of `ParameterContext` and
`FieldContext`, which is exactly how it unifies the two.

**Implement the interface directly only when a field and a parameter genuinely need different
handling.** That is rare; `SimpleArgumentsAggregator` is what the current guide uses.

⚠️ The javadoc marks `SimpleArgumentsAggregator` `@API(status = EXPERIMENTAL, since = "6.0")`
while its `@since` tag reads `5.0`. **I could not reconcile those two.** The `@API` status is
the one that governs stability, so treat the class as experimental in 6.0.3 even though the
user guide's own example extends it.

## The contract nobody reads

> *"Implementations must provide a no-args constructor or a single unambiguous constructor to
> use parameter resolution. They should not make any assumptions regarding when they are
> instantiated or how often they are called. Since instances may potentially be cached and
> called from different threads, they should be thread-safe."*

**That settles the statefulness question directly.** An aggregator may be cached and called
concurrently, so a field accumulating anything across invocations is a race — a counter, a
lazily built parser, a reusable `StringBuilder`. Derive everything from the accessor.

The same sentence appears verbatim on `ArgumentConverter` ([08l](08l-explicit-conversion.md))
and notably **not** on `ArgumentsProvider`, which is why [06](06-argumentssource.md) had to
leave the equivalent question about providers open.

When aggregation fails, throw the documented type:

```java
throw new ArgumentsAggregationException(
        "Row " + arguments.getInvocationIndex() + " has no valid date of birth", cause);
```

`ArgumentsAggregationException` extends `JUnitException`, is `@API(status = STABLE, since =
"5.7")`, and takes a message with an optional cause. Throwing something else works, but this is
the type the framework's own aggregation path documents.

## A composed annotation

> *"If you find yourself repeatedly declaring `@AggregateWith(MyTypeAggregator.class)` for
> multiple parameterized classes or methods across your codebase, you may wish to create a
> custom composed annotation such as `@CsvToMyType` that is meta-annotated with
> `@AggregateWith(MyTypeAggregator.class)`."*

```java
@ParameterizedTest
@CsvSource({
    "Jane, Doe, F, 1990-05-20",
    "John, Doe, M, 1990-10-22"
})
void testWithCustomAggregatorAnnotation(@CsvToPerson Person person) {
    // perform assertions against person
}

@Retention(RetentionPolicy.RUNTIME)
@Target(ElementType.PARAMETER)
@AggregateWith(PersonAggregator.class)
public @interface CsvToPerson {
}
```

`@AggregateWith` is `@Target({ANNOTATION_TYPE, PARAMETER, FIELD})` and
`@API(status = STABLE, since = "5.7")`, which is why the composition works and why the same
aggregator can be attached to a `@Parameter` field on a `@ParameterizedClass`:

> *"This annotation may be applied to parameters of a `@ParameterizedClass` constructor or its
> `@Parameter`-annotated fields, or to parameters of a `@ParameterizedTest` method in order for
> an aggregated value to be resolved for the annotated parameter when the parameterized class or
> method is invoked."*

⚠️ The guide's `@CsvToPerson` is `@Target(ElementType.PARAMETER)` only. If you want the same
annotation usable on a `@Parameter` field, include `ElementType.FIELD` in your own target list —
`@AggregateWith` permits it, but your composed annotation is what the compiler checks.

## When an aggregator is not worth it

An aggregator costs a class, an annotation, an indirection, and the loss of the parameter name
in the report ([08b](08b-aggregation.md)). It pays for itself when:

- two or more test methods read the same table shape, or
- the aggregated type is a domain object the assertions are naturally written against, or
- the aggregation involves real logic — defaulting a column, combining two into one, parsing a
  format no implicit converter handles.

It does not pay for itself on a two- or three-column table with one reader. That is a
`@MethodSource` returning the object directly ([04](04-methodsource.md)), with no framework
machinery at all — and the factory method is easier to read than the aggregator, because it is
just Java.

## Gotchas

**★ Holding state in an aggregator.** The javadoc says instances *"may potentially be cached and
called from different threads"* and must be thread-safe. A counter field, a cached parser, a
mutable builder — all races, and all invisible until the suite runs in parallel.

**★ Two constructors on an aggregator.** The requirement is a no-args constructor *or a single
unambiguous constructor* whose parameters a `ParameterResolver` can supply. Two candidates is
not unambiguous.

**★ An aggregator as a non-`static` inner class.** Documented as unsupported — top-level or
`static` nested only. The same constraint as `ArgumentsProvider` and `ArgumentConverter`, for
the same reason: there is no enclosing instance to construct it against.

**★ Writing the 5.x `ArgumentsAggregator` shape and expecting the guide's examples to compile.**
5.x had one abstract method taking a `ParameterContext`. 6.0 has that plus a `FieldContext`
default, and `SimpleArgumentsAggregator` is the base class the current documentation uses.

**★ Treating `SimpleArgumentsAggregator` as stable.** It is `@API(status = EXPERIMENTAL,
since = "6.0")`, notwithstanding a `@since` tag of 5.0 that I could not reconcile with it. The
guide uses it; the annotation says it may still change.

**★ Aggregating a two-column table.** `@AggregateWith` costs a class, an annotation and a layer
of indirection. Two or three readable parameters are better than a `Person` nobody can see the
construction of. Aggregate when the signature is genuinely unreadable, not on principle.

**★ Composing an annotation with `@Target(PARAMETER)` and then using it on a field.** The
guide's example targets parameters only. `@AggregateWith` itself allows fields, but your
composed annotation's own `@Target` is what the compiler enforces.

**★ Forgetting `@Retention(RUNTIME)` on the composed annotation.** Without runtime retention the
engine cannot see it, and the parameter is treated as an ordinary indexed parameter — so the
failure is a type mismatch, not a missing annotation.

**★ Throwing a bare `RuntimeException` from an aggregator.** `ArgumentsAggregationException`
exists, is `STABLE`, extends `JUnitException` and takes a cause. Using it means the failure
reads as an aggregation failure rather than as a mystery in the test.

**★ Unit-testing the aggregator by implementing `ArgumentsAccessor`.** That interface is
documented as *"not intended to be implemented by clients"*. Exercise the aggregator through a
small parameterized test instead — which is also the only way to verify the annotation wiring.

**★ Putting business logic in an aggregator.** It runs during argument resolution, before the
test body, and a bug in it fails every row identically. Keep it to construction; anything that
computes an expectation belongs in the test or in the production code being tested.

## Interview questions

**★ When would you use `ArgumentsAccessor` over `@AggregateWith`?**
`ArgumentsAccessor` when one test method needs to unpack a wide row and no other test needs the
same unpacking — it costs nothing but a parameter. `@AggregateWith` when two or more methods
would otherwise repeat the same `get` calls, or when the aggregated type is a domain object
worth naming. The aggregator is the accessor's unpacking code, extracted and reused.

**★ Can an aggregator hold state?**
No. The javadoc requires implementations to be thread-safe and says they *"should not make any
assumptions regarding when they are instantiated or how often they are called"*, because
instances may be cached and called from multiple threads. Derive everything from the accessor
passed in.

**★ What changed about `ArgumentsAggregator` in JUnit 6?**
`@ParameterizedClass` introduced field injection, so the interface gained a second method taking
a `FieldContext` alongside the existing `ParameterContext` one.
`SimpleArgumentsAggregator` was added as the abstract base class for implementations that do not
need to tell the two apart, and its single abstract method takes an `AnnotatedElementContext` —
the common supertype — instead. It is what the 6.0 user guide's example extends.

**★ What are the structural constraints on an aggregator class?**
Top-level or `static` nested, with either a no-args constructor or a single unambiguous
constructor whose parameters a registered `ParameterResolver` can supply. The same two
constraints apply to `ArgumentsProvider` and `ArgumentConverter`.

**★ How do you make an aggregator reusable across a codebase?**
Wrap it in a composed annotation: an annotation with `@Retention(RUNTIME)`, an appropriate
`@Target`, and `@AggregateWith(YourAggregator.class)` on it. `@CsvToPerson Person person` then
reads like a built-in. Include `FIELD` in the target list if it should also work on a
`@Parameter` field of a parameterized class.

**★ When is an aggregator the wrong tool?**
When one test reads a narrow table. The aggregator costs a class and hides the construction of
the object the assertions run against; a `@MethodSource` factory that returns the object
directly says the same thing in plain Java and keeps the construction visible next to the cases.

{/* FOOTER */}
