---
title: "jqwik generates a documented list of types out of the box and nothing else, every other type comes from an Arbitrary you build with a @Provide method, and the defaults you inherit without choosing them — strings and collections sized 0 to 255, decimals at scale 2, numbers biased toward the centre of their range — decide what your properties actually test"
sidebar_label: "05 · Generators"
sidebar_position: 19
---

<span className="db-tier t-when">When Needed</span>

> Verified: 2026-08-31 against the **jqwik 1.10.1 user guide**, sections *Default Parameter
> Generation*, *Arbitrary Provider Methods* (including the 1.8.0-to-1.9.2 return-type-matching
> caveat), *Arbitrary Suppliers*, *Providing Arbitraries for Embedded Types*, *Generation from
> a Type's Interface* and *Additional Modules*
> ([jqwik.net](https://jqwik.net/docs/current/user-guide.html)).
> Version spine: JDK 25, Spring Boot 4.1.0, Spring Framework 7.0.8, JUnit Jupiter 6.0.3,
> AssertJ 3.27.7. jqwik 1.10.1 — see
> [02b · The version collision](02b-the-version-collision.md).
> ⚠️ **No sandbox and no test run on this machine.** Every default and every method signature
> below is quoted or paraphrased from the guide; none of it is the output of a run here.

**A property is a claim about the inputs your generator produced, and nothing else. That
sentence is the whole reason this chunk is long. jqwik will generate a specific, documented
list of types for a bare `@ForAll`, and for everything else you supply an `Arbitrary` from a
`@Provide` method — but the part that quietly decides what your suite tests is neither of
those. It is the defaults: strings and collections between 0 and 255 elements, `BigDecimal`
at scale 2, numbers biased toward the centre of their range, `null` never generated at all.
Nobody chooses those, everybody inherits them, and a property is only as strong as the
distribution underneath it.**

## What a bare `@ForAll` generates

The guide is explicit that generation is opt-in per parameter — *"jqwik tries to generate
values for those property method parameters that are annotated with `@ForAll`"* — and that
without a `value` attribute it uses default generation for a fixed list of types:

`Object`; `String`; the integral types `Byte`, `byte`, `Short`, `short`, `Integer`, `int`,
`Long`, `long` and `BigInteger`; the floating types `Float`, `float`, `Double`, `double` and
`BigDecimal`; `Boolean`/`boolean`; `Character`/`char`; **all enum types**; `List<T>`, `Set<T>`
and `Stream<T>` *"as long as T can also be provided by default generation"*; `Iterable<T>` and
`Iterator<T>`; `Optional<T>`; arrays `T[]`; `Map<K, V>`, `HashMap<K, V>` and `Map.Entry<K, V>`;
`java.util.Random`; `Arbitrary<T>` itself; functional types; and *"most types of package
`java.time`"*, which are handled by the time module.

Two things follow that people get wrong. **Enums are free** — `@ForAll Currency currency` on
your own enum works with no configuration, which makes enums the cheapest possible property
parameter. And **your domain classes are not on the list**: `@ForAll Order order` fails at run
time with `CannotFindArbitraryException` unless you provide one, register a default provider,
or annotate with `@UseType`.

⚠️ The web and time modules that supply email addresses, domain names, `LocalDate`,
`LocalTime`, `Instant` and friends are, per the guide, *"part of jqwik's default
dependencies"* — you get them from the `net.jqwik:jqwik` aggregator without asking. Default
generation exists for `LocalDate`, `Year`, `YearMonth`, `DayOfWeek`, `MonthDay` and `Period`;
for `LocalTime`, `OffsetTime`, `ZoneOffset`, `TimeZone`, `ZoneId` and `Duration`; and for
`LocalDateTime`, `Instant`, `OffsetDateTime` and `ZonedDateTime`.

## `@Provide`: the method that supplies an arbitrary

For everything else, you write a method that returns an `Arbitrary` and name it from
`@ForAll`.

```java
class OrderPropertyTests {

    @Property
    void everyOrderHasANonNegativeTotal(@ForAll("orders") Order order) {
        assertThat(order.total()).isGreaterThanOrEqualTo(Money.ZERO);
    }

    @Provide
    Arbitrary<Order> orders() {
        Arbitrary<String> ids   = Arbitraries.strings().alpha().numeric().ofLength(12);
        Arbitrary<Integer> qty  = Arbitraries.integers().between(1, 40);
        Arbitrary<BigDecimal> unitPrice = Arbitraries.bigDecimals()
                .between(new BigDecimal("0.01"), new BigDecimal("999.99"))
                .ofScale(2);

        return Combinators.combine(ids, qty, unitPrice).as(Order::new);
    }

    @Provide("10 to 99")                       // the annotation's value is the reference
    Arbitrary<Integer> twoDigitNumbers() {
        return Arbitraries.integers().between(10, 99);
    }
}
```

The resolution rule, quoted:

> *"The String value of the `@ForAll` annotation serves as a reference to a method within the
> same class (or one of its superclasses or owning classes). This reference refers to either
> the method's name or the String value of the method's `@Provide` annotation."*

And the failure mode: *"If the return type cannot be matched, jqwik will throw a
`CannotFindArbitraryException`."* ⚠️ There is a version subtlety worth knowing because it
changes what compiles-and-runs. The guide records that between 1.8.0 and 1.9.1 return-type
matching was *"very strict"* — an `Arbitrary<?>` provider for an `int` parameter failed — and
that *"starting with version 1.9.2 return type matching is very loose again. The only enforced
constraint is that the return type must be a subtype of `Arbitrary`."* The trade-off is stated
in the same paragraph: *"If the arbitrary provided by the method will create an object of the
wrong type, there will be an `IllegalArgumentException` thrown when jqwik tries to execute the
property method."* So on 1.10.1 a mismatched provider is a run-time error, not a discovery
error.

### Three other ways to name a generator

**`@From` on an embedded type**, which is the only way to reach inside a generic parameter:

```java
@Property
boolean joiningListOfStrings(@ForAll List<@From("shortStrings") String> listOfStrings) { ... }
```

The guide's reason for the redundancy with `@ForAll("...")` is exactly that: *"`@From` becomes
a necessity when you want to provide the arbitrary of an embedded type parameter"* — the list
uses the default list arbitrary while its elements come from your method.

**`ArbitrarySupplier`**, a class rather than a method, which the guide recommends for two
concrete reasons: *"The IDE let's you directly navigate from the supplier attribute to the
implementing class"* and *"`ArbitrarySupplier` implementations can be shared across test
container classes."*

```java
class ShortStrings implements ArbitrarySupplier<String> {
    @Override public Arbitrary<String> get() {
        return Arbitraries.strings().withCharRange('a', 'z').ofMinLength(1).ofMaxLength(8);
    }
}

@Property
void aProperty(@ForAll(supplier = ShortStrings.class) String s) { ... }
```

**`@UseType`**, which builds instances from the class's own constructors and factories:
*"By default the framework will use all public constructors and all public, static factory
methods in the class in order to generate instances. Whenever there's an exception during
generation they will be ignored; that way you'll only get valid instances."* Recursion into
nested types is on by default and switchable with `@UseType(enableRecursion = false)`. It is
the fastest way to get *some* coverage of a data-holder class and the least controlled — see
the gotchas.
## The catalogue, and the defaults it carries

Every provider method above starts with a static call on `Arbitraries` and then configures it
fluently. That catalogue — which entry point produces what, which values cannot be shrunk, and
the defaults each one applies when you say nothing (0-to-255 sizes, scale 2, numbers biased
toward the centre of their range, never `null`) — is
[05a · The defaults nobody chooses](05a-the-defaults-you-inherit.md), and it is the half of
this subject that decides what a green property means.

## Where this connects

- The `Arbitraries` catalogue and the defaults every arbitrary inherits are
  [05a · The defaults nobody chooses](05a-the-defaults-you-inherit.md).
- The annotations that narrow generation — `@IntRange`, `@Size`, `@StringLength`,
  `@AlphaChars`, `@WithNull`, `@UniqueElements` — and why filtering is the wrong way to do the
  same job are [05b · Constraining generation](05b-constraining-generation.md).
- `map`, `flatMap`, `Combinators`, builders, `oneOf`, recursion and registering a default
  provider so that a bare `@ForAll Money` works everywhere are
  [05c · Composing arbitraries](05c-composing-arbitraries.md).
- Which of these arbitraries can be enumerated exhaustively, and the edge cases each one
  carries, are
  [08 · Edge cases, exhaustive generation and data](08-edge-cases-exhaustive-and-data.md).
- Proving the generator produces what you think is [09 · Statistics](09-statistics.md).
- Using an `Arbitrary` outside a property, which needs `JqwikSession`, is
  [02c2 · jqwik without its engine](02c2-jqwik-without-its-engine.md).
- What to generate *for* — the relations these values feed — is
  [04 · Finding properties](04-finding-properties.md).

## Gotchas

**★ `@ForAll` on your own domain class fails at run time, not at compile time, and the message names a missing arbitrary rather than a missing `@Provide`.**
`CannotFindArbitraryException` on `Order` reads like a tool problem the first time you see it.
It means exactly one thing: `Order` is not in the documented default list and you did not
supply a generator. The three fixes, in ascending order of control, are `@UseType`, a
`@Provide` method, and a registered `ArbitraryProvider`
([05c](05c-composing-arbitraries.md)).

**★ A `@Provide` method whose name you mistyped in `@ForAll` fails the same way as a missing generator, so the error points at the type rather than at the typo.**
`@ForAll("orders")` against `@Provide Arbitrary<Order> order()` — singular — throws
`CannotFindArbitraryException` for `Order`, and you go looking for a registration problem.
Prefer `@ForAll(supplier = Orders.class)` when the reference matters, because a class reference
is checked by the compiler and navigable in the IDE, which is precisely the reason the guide
gives for the feature.

**★ Since 1.9.2 a provider returning the wrong element type compiles, resolves, and fails as an `IllegalArgumentException` during execution.**
Return-type matching was tightened in 1.8.0 and loosened again in 1.9.2, and the guide states
the consequence plainly: a wrong-typed arbitrary now throws when the property runs. So
`@Provide Arbitrary<?> ids()` returning strings for an `int` parameter is a run-time surprise
whose message is about argument types, not about generation. Declare the precise
`Arbitrary<Integer>` return type even though the framework no longer forces you to.

**★ `@UseType` swallows exceptions during generation, which means a constructor that rejects most inputs produces a narrow, silent sample.**
The documented behaviour is that *"whenever there's an exception during generation they will be
ignored; that way you'll only get valid instances"*. On a class whose constructor validates
hard — an `Email` that accepts one string in ten thousand — this becomes an expensive filter
that either starves generation or produces a suspiciously uniform set of values. `@UseType` is a
starting point for data holders with permissive constructors, not a general solution.
**★ A `@Provide` method is looked up on the class, its superclasses and its owning classes — and nowhere else, so a shared generator in a utility class is invisible.**
The guide's wording is precise: *"a method within the same class (or one of its superclasses or
owning classes)"*. The reflex of putting all the generators in a `TestArbitraries` helper class
and referring to them by name from everywhere does not work; the reference resolves by method
name against the container's own hierarchy. The documented ways to share are an
`ArbitrarySupplier` class named in `@ForAll(supplier = ...)`, a registered `ArbitraryProvider`
([05c](05c-composing-arbitraries.md)), or a common superclass — and the first is usually the
right one.

**★ `@ForAll("orders")` and `@ForAll @From("orders")` are not interchangeable, and only one of them reaches inside a generic type.**
Both name the same provider method for a top-level parameter. Only `@From` can be applied to a
type argument — `List<@From("shortStrings") String>` — because an annotation on the parameter
itself configures the list, not its elements. Reaching for `@ForAll("...")` when you meant the
element type produces a provider that must return `Arbitrary<List<String>>`, and the resulting
type error is reported against the wrong thing.

**★ A provider method may itself take `@ForAll` parameters, which is implicit flat mapping, and it looks like a mistake to anyone who has not read that section of the guide.**
`@Provide Arbitrary<Tuple2<String, Integer>> stringWithEnd(@ForAll("simpleStrings") String s)`
is legal and documented: *"You simply add a `@ForAll` parameter to your provider method, the
value of which will be generated using standard parameter generation. Under the hood this uses
this parameter's arbitrary and call `flatMap` on it."* It is the readable alternative to nested
`flatMap`, and the reason it exists is in [05c](05c-composing-arbitraries.md). A provider that
takes a bare `TypeUsage` parameter is the other documented case, and it is how one provider
method serves several parameters with different annotations.

## Interview questions

**★ Which types does jqwik generate without any configuration, and why does the answer matter in review?**
The documented list is the primitives and their boxes, `String`, `BigInteger`, `BigDecimal`,
`Character`, `Boolean`, **all enums**, the common containers — `List`, `Set`, `Stream`,
`Iterable`, `Iterator`, `Optional`, arrays, `Map`, `Map.Entry` — provided their element types
are themselves default-generable, `java.util.Random`, functional interfaces, and the
`java.time` types via the bundled time module. What matters in review is the complement: your
domain classes are not on that list, so every `@ForAll YourType` in the codebase is backed by
either a `@Provide` method, an `@UseType`, or a registered provider, and *that* is the thing to
read. The property's strength is the generator's strength, so I review the generator before I
review the assertion — a property over an `Order` whose generator always produces one line item
and a positive quantity is testing a narrow slice and reads exactly like a property testing
everything.

**★ When would you use `@UseType` and when would you refuse to?**
I would use it for a data holder with a permissive constructor when I want a property quickly
and the exact distribution does not matter much — a DTO round-trip, for instance, where any
well-formed instance exercises the mapper. I would refuse it anywhere the constructor validates
seriously, because the documented behaviour is that generation exceptions are swallowed, so a
strict constructor turns into a silent filter: I get only the inputs that happened to pass,
with no report of how many were discarded and no control over which. I would also refuse it for
anything where I care about the distribution — money, dates, anything with a boundary — because
`@UseType` gives me the parameter types' defaults, and defaults are the thing this whole chunk
is warning about. In those cases a `@Provide` method that names each part is three lines longer
and says what it tests.

**★ How do you generate a value that must satisfy a relationship between two of its fields — say, a date range where the end is after the start?**
Not with a filter, and this is the distinction worth being explicit about. A filter over
independently generated pairs discards most of what it generates and runs into the documented
discard limits. The right tool is `flatMap` — generate the start date, then generate the end
from a range that begins at the start — or `Combinators.combine(...).as(...)` where the
combining function derives the second value from the first, for instance generating a start and
a positive duration and adding them. The rule of thumb is that dependence between generated
values is what `flatMap` is for, and independence is what `combine` is for; and where a
constructor already enforces the rule, `ignoreException(DateTimeException.class)` lets the
domain object be the validator. All three are [05c](05c-composing-arbitraries.md).
**★ You want the same `Arbitrary<Money>` in forty test classes. What are your options and which do you pick?**
Three documented options with quite different reach. A `@Provide` method on a shared superclass
works, because the guide says lookup covers superclasses, but it forces every property class to
extend something, which is a heavy coupling for a generator. An `ArbitrarySupplier`
implementation named with `@ForAll(supplier = MoneyValues.class)` is a plain class, shareable
anywhere, compiler-checked and navigable in the IDE — the guide names both of those as its
advantages, and it is what I would pick for a handful of types. The third is a registered
`ArbitraryProvider` via `META-INF/services`, which makes a bare `@ForAll Money` work in every
class with no annotation at all; that is the right answer once `Money` is a genuinely
first-class type in the domain, and the wrong answer while the generator is still being tuned,
because it becomes invisible infrastructure that people forget exists. Whichever I pick, the
generator gets a test of its own — a property asserting that it can produce the awkward values
we care about — because a shared generator's blind spot is now a blind spot in forty classes.

{/* FOOTER */}
