---
title: "A parameterized class takes its arguments through the constructor or through @Parameter fields, and you do not choose between them with a setting — the presence of one annotated field anywhere in the class hierarchy throws the switch, silently, for every subclass"
sidebar_label: "08d · Constructor injection"
sidebar_position: 19
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-27 against the JUnit 6.0.3 User Guide, "Consuming Arguments" →
> "Parameterized Classes", "Constructor Injection" and "Field Injection"
> ([docs.junit.org](https://docs.junit.org/6.0.3/writing-tests/parameterized-classes-and-tests.html)),
> the `@ParameterizedClass`
> ([javadoc](https://docs.junit.org/6.0.3/api/org.junit.jupiter.params/org/junit/jupiter/params/ParameterizedClass.html))
> and `@Parameter`
> ([javadoc](https://docs.junit.org/6.0.3/api/org.junit.jupiter.params/org/junit/jupiter/params/Parameter.html))
> pages, and the 6.0.1 release notes
> ([docs.junit.org](https://docs.junit.org/6.0.3/release-notes/index.html)).
> JDK 25, Spring Boot 4.1.1, JUnit Jupiter 6.0.3.

**[08c](08c-parameterized-classes.md) established what a parameterized class is. This chunk is
the mechanism that gets the row into the instance, and it has one genuinely surprising rule:
the injection style is not configured, it is *detected*. Adding a `@Parameter` field to an
abstract base class rewrites how every subclass receives its arguments, and the resulting
failure does not mention inheritance. This chunk is the constructor route and the switch itself;
the field route and the `@Parameter` rules are
[08e](08e-parameterized-class-field-injection.md).**

## The two routes

> *"Parameterized classes consume arguments directly from the configured source; either via
> their unique constructor or via field injection."*

Note "unique". A parameterized class has one constructor to inject into — the documentation
does not describe constructor selection, because there is nothing to select.

## Constructor injection

```java
@ParameterizedClass
@CsvSource({ "apple, 23", "banana, 42" })
class FruitTests {

    final String fruit;
    final int quantity;

    FruitTests(String fruit, int quantity) {
        this.fruit = fruit;
        this.quantity = quantity;
    }

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

> *"For constructor injection, the same rules apply as defined for parameterized tests above."*

That is the three-tier rule from [08b](08b-aggregation.md), restated by the javadoc for
constructors:

> *"Zero or more **indexed parameters** must be declared first. Zero or more **aggregators**
> must be declared next. Zero or more parameters supplied by other `ParameterResolver`
> implementations must be declared last."*

So a `TestInfo` constructor parameter goes at the end, after the arguments and after any
`ArgumentsAccessor`.

🔴 One hard constraint:

> *"Constructor injection can only be used with the (default) `PER_METHOD` test instance
> lifecycle mode. Please use [field injection](08e-parameterized-class-field-injection.md) with
> the `PER_CLASS` mode instead."*

`@TestInstance(Lifecycle.PER_CLASS)` means one instance for all the methods, so there is no
per-invocation construction to inject into. If you need `PER_CLASS` — usually for a non-static
`@BeforeAll`, or for a non-static `@MethodSource` factory ([04](04-methodsource.md)) — the
injection style is decided for you.

**Records remove the boilerplate**, and the guide says so explicitly:

```java
@ParameterizedClass
@CsvSource({ "apple, 23", "banana, 42" })
record FruitTests(String fruit, int quantity) {

    @Test
    void test() {
        assertFruit(fruit);
        assertQuantity(quantity);
    }
}
```

> *"You may use records to implement parameterized classes that avoid the boilerplate code of
> declaring a test class constructor."*

This is the most pleasant form the feature has and worth reaching for first: the canonical
constructor is the injection point, the components are the parameters, the fields are final,
and there is nothing to keep in sync.

## Which style wins — the detected switch

> *"If a `@Parameter`-annotated field is declared in the parameterized class **or one of its
> superclasses**, field injection will be used. Otherwise, constructor injection will be
> used."*

Not a preference — a switch, thrown by the *presence of an annotation anywhere in the
hierarchy*. And the consequence is stated plainly:

> *"If field injection is used, no constructor parameters will be resolved with arguments from
> the source. Other `ParameterResolver` extensions may resolve constructor parameters as usual,
> though."*

So adding one `@Parameter` field to a shared base class silently disables source-driven
constructor injection in every subclass that had it. The subclass constructor still exists and
is still called; its parameters are simply no longer filled from the argument source, and other
resolvers keep working, which makes the failure look partial rather than structural. 6.0.1
acknowledges how confusing this class of failure is:

> *"Improve error message when `@ParameterizedClass` is used with field injection without
> providing enough arguments."*

**Pick one style per hierarchy and write it down.** The mixed case is legal, silent and
unpleasant.

One more asymmetry worth naming: the switch is thrown by an annotation on a *field*, but its
effect is on the *constructor*. Nothing in the constructor's declaration changes, nothing is
removed, and no compiler warning fires. It is the only place in `junit-jupiter-params` where
adding a declaration in one file changes the meaning of an unrelated declaration in another,
which is why it is worth a comment in the base class rather than trusting anyone to remember.

## Gotchas

**★ Adding a `@Parameter` field to a shared base class.** It switches every subclass in the
hierarchy from constructor injection to field injection, and the subclass constructors then
receive nothing from the argument source. The failure looks like missing arguments, not like an
inheritance problem.

**★ Combining constructor injection with `@TestInstance(PER_CLASS)`.** Documented as
unsupported — `PER_CLASS` constructs once, so there is no per-invocation constructor call to
inject into. `PER_CLASS` requires field injection.

**★ Declaring more than one constructor.** The documentation speaks of the *unique* constructor
of a parameterized class. Overloads leave nothing to select and no documented rule for
selecting.

**★ Forgetting that other `ParameterResolver` extensions still fill constructor parameters
under field injection.** They do — the documentation says so. That is why a constructor taking
`TestInfo` keeps working while the constructor's *argument* parameters silently stop being
filled, which is the most confusing possible version of the failure.

## Interview questions

**★ How does a parameterized class receive its arguments?**
Either through its unique constructor or through field injection into `@Parameter`-annotated
fields. The choice is not yours to declare: if a `@Parameter` field exists in the class or any
superclass, field injection is used; otherwise constructor injection is. Records are the tidiest
constructor-injection form, because the canonical constructor is the injection point and the
fields are final.

**★ When can you not use constructor injection?**
Under `@TestInstance(Lifecycle.PER_CLASS)`. The documentation says constructor injection works
only with the default `PER_METHOD` mode and directs `PER_CLASS` users to field injection —
because a single shared instance is constructed once, not once per argument set.

**★ Someone adds a `@Parameter` field to an abstract test base class and a dozen subclasses
break. Why?**
Because the presence of a `@Parameter`-annotated field anywhere in the hierarchy switches the
whole hierarchy to field injection, and the documentation states that under field injection no
constructor parameters will be resolved with arguments from the source. The subclass
constructors still run and other `ParameterResolver` extensions still fill their parameters;
only the source-driven ones stop. 6.0.1 improved the error message for exactly this scenario.

**★ What is the effect of `@ParameterizedClass` having exactly one constructor?**
There is no constructor selection to reason about: the documentation refers to *the* unique
constructor. That keeps the injection rule simple — indexed parameters, then aggregators, then
`ParameterResolver`-supplied parameters, in that order — and it means overloading the
constructor of a parameterized class leaves the engine with no documented way to choose.

**★ Which form would you reach for by default?**
A record with constructor injection, unless something forces field injection. It gives immutable
fields, no boilerplate, no index bookkeeping and no hierarchy-wide switch to reason about. Field
injection earns its place under `PER_CLASS`, when a base class needs to declare a shared
parameter, or when an aggregator field reads better than an aggregator constructor parameter.

{/* FOOTER */}
