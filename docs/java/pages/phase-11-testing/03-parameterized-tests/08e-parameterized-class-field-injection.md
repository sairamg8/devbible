---
title: "Field injection is what a parameterized class must use under PER_CLASS, and it trades the record's final fields and free ordering for a set of index bookkeeping rules that reach across the whole class hierarchy — including the rule that an aggregator field must carry no index at all"
sidebar_label: "08e · Field injection"
sidebar_position: 20
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-27 against the JUnit 6.0.3 User Guide, "Field Injection" and "Argument
> Conversion"
> ([docs.junit.org](https://docs.junit.org/6.0.3/writing-tests/parameterized-classes-and-tests.html)),
> the `@Parameter`
> ([javadoc](https://docs.junit.org/6.0.3/api/org.junit.jupiter.params/org/junit/jupiter/params/Parameter.html)),
> `@ParameterizedClass`
> ([javadoc](https://docs.junit.org/6.0.3/api/org.junit.jupiter.params/org/junit/jupiter/params/ParameterizedClass.html))
> and `@AggregateWith`
> ([javadoc](https://docs.junit.org/6.0.3/api/org.junit.jupiter.params/org/junit/jupiter/params/aggregator/AggregateWith.html))
> pages. JDK 25, Spring Boot 4.1.0, JUnit Jupiter 6.0.3.

**[08d](08d-parameterized-class-injection.md) covered the constructor route and the switch that
selects between them. This is the other route: `@Parameter` fields. It is mandatory under
`@TestInstance(PER_CLASS)`, it is what an abstract test base class has to use, and it replaces
the compiler's positional matching with a set of index rules that a reviewer has to check by
hand.**

## The rules, verbatim

> *"For field injection, the following rules apply for fields annotated with `@Parameter`.*
> *Zero or more **indexed parameters** may be declared; each must have a unique index specified
> in its `@Parameter(index)` annotation. The index may be omitted if there is only one indexed
> parameter. If there are at least two indexed parameter declarations, there must be
> declarations for all indexes from 0 to the largest declared index.*
> *Zero or more **aggregators** may be declared; each without specifying an index in its
> `@Parameter` annotation.*
> *Zero or more other fields may be declared as usual as long as they're not annotated with
> `@Parameter`."*

```java
@ParameterizedClass
@CsvSource({ "apple, 23", "banana, 42" })
class FruitTests {

    @Parameter(0)
    String fruit;

    @Parameter(1)
    int quantity;

    @Test
    void test() {
        assertFruit(fruit);
        assertQuantity(quantity);
    }

    @Test
    void anotherTest() {
        // ...
    }
}
```

And with a single parameter, the index is noise:

```java
@ParameterizedClass
@ValueSource(strings = { "racecar", "radar" })
class PalindromeTests {

    @Parameter
    String candidate;

    @Test void palindrome() { … }
}
```

## `UNSET_INDEX` and the aggregator rule

The `@Parameter` javadoc is where the sharp edges are:

> *"Returns the index of the parameter in the list of parameters. Must be `-1` (the default)
> for aggregators, that is any field of type `ArgumentsAccessor` or any field annotated with
> `@AggregateWith`. May be omitted if there's a single indexed parameter. Otherwise, must be
> unique among all indexed parameters of the parameterized class **and its superclasses**."*

`-1` is exposed as a constant — *"`UNSET_INDEX`: Constant that indicates that the index of the
parameter is unset."* — and it is the default value of `value()`. So the bare `@Parameter` on
an aggregator field is not an omission; it is the only legal form. Writing `@Parameter(0)` on
an `ArgumentsAccessor` field is a configuration error.

Read "and its superclasses" as the coupling it is. Indices are hierarchy-wide, so an abstract
base declaring `@Parameter(0) String tenant;` has reserved index 0 for every descendant, and a
subclass that innocently declares its own `@Parameter(0)` collides with a field it may not know
exists.

The declaration itself explains what `@Parameter` may be attached to:

```java
@Retention(RUNTIME)
@Target({ANNOTATION_TYPE, FIELD})
@Documented
@API(status = EXPERIMENTAL, since = "6.0")
public @interface Parameter
```

> *"`@Parameter` is used to signal that a field in a `@ParameterizedClass` constitutes a
> parameter and marks it for field injection."*
>
> *"`@Parameter` may also be used as a meta-annotation in order to create a custom composed
> annotation that inherits the semantics of `@Parameter`."*

`FIELD` and `ANNOTATION_TYPE` only. It has no meaning on a method parameter, because a method
parameter already has a position and needs no annotation to say what it is.

## Mutability is the price

Injection is an assignment performed after the instance exists, so a `@Parameter` field cannot
be `final`. That is a real loss relative to the record form
([08d](08d-parameterized-class-injection.md)): the field is writable for the whole life of the
instance, and nothing stops a test from assigning to it.

What such an assignment does depends on the lifecycle mode, and both outcomes are wrong:

- Under the default `PER_METHOD`, a fresh instance is created for each test method, so the
  write is discarded and the next test sees the injected value. The mutation was pointless.
- Under `PER_CLASS` — the mode that forced you into field injection in the first place — one
  instance serves every test method in the argument set, so the write leaks into every test
  that runs after it, in source-dependent order.

The second is a genuine cross-test dependency with no error message. Treat `@Parameter` fields
as read-only by convention, since the compiler will not.

## Conversion and aggregation on a field

> *"`@Parameter`-annotated fields or constructor parameters may be annotated with `@ConvertWith`
> or a corresponding composed annotation to specify an explicit `ArgumentConverter`. Otherwise,
> JUnit Jupiter will attempt to perform an implicit conversion to the target type
> automatically."*

So everything in [08](08-conversion-and-aggregation.md) and
[08j](08j-explicit-conversion.md) applies to a field exactly as it applies to a method
parameter — the *declared type of the field* selects the converter.

Aggregation works the same way, because `@AggregateWith` is
`@Target({ANNOTATION_TYPE, PARAMETER, FIELD})`:

```java
@ParameterizedClass
@CsvSource({ "Jane, Doe, F, 1990-05-20" })
class PersonTests {

    @Parameter
    @AggregateWith(PersonAggregator.class)
    Person person;

    @Test void hasName() { … }
    @Test void hasAge()  { … }
}
```

The `@AggregateWith` javadoc names both targets explicitly: *"This annotation may be applied to
parameters of a `@ParameterizedClass` constructor or its `@Parameter`-annotated fields, or to
parameters of a `@ParameterizedTest` method."* Supporting a field as well as a parameter is
exactly why `ArgumentsAggregator` grew a `FieldContext` overload in 6.0
([08g](08g-custom-aggregators.md)).

## Gotchas

**★ Declaring `@Parameter(0)` and `@Parameter(2)` and nothing at index 1.** With two or more
indexed declarations there must be declarations for every index from 0 to the largest. A gap is
a configuration error, not a skipped column — you cannot use the index to select columns out of
a wide row.

**★ Putting an index on an aggregator field.** `@Parameter` on an `ArgumentsAccessor` field or
an `@AggregateWith` field *must* be `-1`, which is the default. Write `@Parameter`, not
`@Parameter(0)`.

**★ Reusing an index that a superclass already declared.** Indices must be unique across the
class *and its superclasses*. An abstract base that claims index 0 has claimed it for every
descendant, and the subclass has no local evidence of the collision.

**★ Making a `@Parameter` field `final`.** Field injection assigns after construction, so the
field cannot be final. If immutability matters, use constructor injection or a record — which
means giving up `PER_CLASS`.

**★ Assigning to a `@Parameter` field inside a test.** Under `PER_CLASS` the write leaks into
every later test in the argument set; under `PER_METHOD` it is silently discarded. Neither is
what the author intended, and neither produces a message.

**★ Expecting `@Parameter` to work on a method parameter.** It is `@Target({ANNOTATION_TYPE,
FIELD})`. `@ParameterizedTest` method parameters are matched positionally and need no
annotation at all.

**★ Omitting the index when there are two indexed parameters.** The omission is allowed only
when there is exactly one. With two, both need explicit indices — the field declaration order in
the source file is not the rule.

**★ Reading a `@Parameter` field in `@BeforeAll`.** `@BeforeAll` runs once before all
invocations of the class, which is before any argument set exists
([08f](08f-parameterized-class-lifecycle.md)). The per-invocation hook is
`@BeforeParameterizedClassInvocation`.

**★ Making the field `private` and expecting Java's access rules to matter.** The documentation
does not restrict `@Parameter` fields by visibility, and I could not confirm from the
documentation whether a `private` field is injected. Package-private is what every example in
the guide uses; follow the examples rather than testing the boundary.

**★ Treating a `@Parameter` field like a Spring `@Autowired` field.** There is no proxy and no
lazy resolution: the value is assigned per invocation of the class template, and a field that
is `null` means the injection did not happen — usually because the class fell back to
constructor injection, or because an index does not line up with the source.

## Interview questions

**★ What are the indexing rules for `@Parameter` fields?**
Each indexed parameter needs an index that is unique across the class *and its superclasses*.
The index may be omitted when there is exactly one indexed parameter. With two or more, every
index from 0 to the largest declared must be present — no gaps. Aggregator fields, meaning
`ArgumentsAccessor` fields or fields annotated `@AggregateWith`, must carry the default `-1`,
which is exposed as `Parameter.UNSET_INDEX`.

**★ Why can a `@Parameter` field not be `final`?**
Because injection is an assignment performed after the instance exists, and a final field is
assigned at construction. If you want final fields, the class has to take its arguments through
the constructor — which a record does with no code at all — and that in turn rules out
`PER_CLASS`.

**★ Do converters and aggregators work on a parameterized class field?**
Yes. `@ConvertWith` and `@AggregateWith` both target fields as well as parameters, so a
`@Parameter` field can carry either, and implicit conversion applies to the field's declared
type just as it does to a method parameter's. Supporting fields is why `ArgumentsAggregator`
gained a `FieldContext` method in 6.0.

**★ Why does field injection exist at all, when constructor injection is tidier?**
Because constructor injection is documented as working only with the default `PER_METHOD`
lifecycle mode. Anything that needs `PER_CLASS` — a non-static `@BeforeAll`, a non-static
`@MethodSource` factory — has no other option. Field injection is also the only way for an
abstract base class to declare a parameter shared by its subclasses.

**★ What is the risk that field injection introduces and constructor injection does not?**
Mutable shared state. A `@Parameter` field is assignable for the life of the instance, and
under `PER_CLASS` that instance is shared by every test method in the argument set — so one
test writing to the field changes what the next test sees, with the outcome depending on method
execution order.

**★ Can `@Parameter` be used to build your own annotation?**
Yes. It is `@Target({ANNOTATION_TYPE, FIELD})` and the javadoc says it *"may also be used as a
meta-annotation in order to create a custom composed annotation that inherits the semantics of
`@Parameter`"* — the same composition pattern as `@AggregateWith` and `@ConvertWith`, so a
project can define `@TenantParameter` that means `@Parameter(0)` plus a converter.

{/* FOOTER */}
