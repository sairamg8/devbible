---
title: "Builders.withBuilder is the composition mechanism with no arity limit and the only one that can decide not to set a field at all, which makes it the right tool for an aggregate with optional parts and the wrong tool for one whose seed object is invalid until every step has run"
sidebar_label: "05c2 · Builders and optional parts"
sidebar_position: 24
---

<span className="db-tier t-when">When Needed</span>

> Verified: 2026-09-01 against the **jqwik 1.10.1 user guide**, section *Combining Arbitraries
> with Builders* ([jqwik.net](https://jqwik.net/docs/current/user-guide.html)); and the **jqwik
> 1.10.1 javadoc** for `net.jqwik.api.Builders`, `Builders.BuilderCombinator` and
> `Builders.CombinableBuilder`
> ([jqwik.net](https://jqwik.net/docs/1.10.1/javadoc/net/jqwik/api/Builders.html)).
> Version spine: JDK 25, Spring Boot 4.1.0, Spring Framework 7.0.8, JUnit Jupiter 6.0.3,
> AssertJ 3.27.7. jqwik 1.10.1 — see
> [02b · The version collision](02b-the-version-collision.md).
> ⚠️ **No sandbox and no test run on this machine.** Every signature and contract below is
> quoted from the guide or the javadoc; none of it is the output of a run here.

**[05c](05c-composing-arbitraries.md) left two things unfinished: what to do when an aggregate
has more than eight independently-varying parts, and what to do when a part is genuinely
*optional* — present sometimes, absent sometimes, with a default in between.
`Builders.withBuilder` answers both, and it is the only jqwik composition mechanism that can
decide not to apply a step at all. That capability is also its trap: the guide's own example
seeds the builder with an object that is invalid until the steps have run, and
`withProbability` means some of them will not.**

## Builders: when the aggregate has optional parts

The third mechanism, for objects assembled through a builder:

```java
@Provide
Arbitrary<Person> validPeopleWithBuilder() {
    Arbitrary<String> names =
        Arbitraries.strings().withCharRange('a', 'z').ofMinLength(2).ofMaxLength(20);
    Arbitrary<Integer> ages = Arbitraries.integers().between(0, 130);
    return Builders.withBuilder(() -> new PersonBuilder())
        .use(names).in((builder, name) -> builder.withName(name))
        .use(ages).withProbability(0.5).in((builder, age) -> builder.withAge(age))
        .build(builder -> builder.build());
}
```

`withProbability(0.5)` is the feature worth the whole mechanism: that step is applied to *half*
the generated values, and the rest keep the builder's default. That is how you generate "an
order that may or may not have a discount applied" without a `@WithNull` on a field that is not
nullable. The javadoc constrains it — *"Must be between 0.0 and 1.0"* — and there is no arity
limit here, which is the guide's third escape from the eight-parameter ceiling.

Four API facts from the javadoc that decide how you write these:

| Call | Javadoc | When |
|---|---|---|
| `withBuilder(Supplier<B>)` | *"The supplier will be called freshly for each value generation. For exhaustive generation all supplied objects are supposed to be identical."* | Always the entry point. |
| `.in(BiFunction)` | *"Use the last provided arbitrary to change the builder object. Potentially create a different kind of builder."* | Fluent builders whose methods return a builder. |
| `.inSetter(BiConsumer)` | *"…and proceed with the same builder. The most common scenario is a builder the methods of which do not return a new builder."* | Void setters, i.e. a plain Java bean. |
| `.build()` vs `.build(Function)` | *"Create the final arbitrary if it's the builder itself"* vs *"Create the final arbitrary."* | The no-arg form when the builder **is** the value. |

If you have no builder, the same API drives a mutable object through setters:

```java
@Provide
Arbitrary<Person> validPeopleWithPersonAsBuilder() {
    Arbitrary<String> names =
        Arbitraries.strings().withCharRange('a', 'z').ofMinLength(3).ofMaxLength(21);
    Arbitrary<Integer> ages = Arbitraries.integers().between(0, 130);

    return Builders.withBuilder(() -> new Person(null, -1))
                   .use(names).inSetter(Person::setName)
                   .use(ages).withProbability(0.5).inSetter(Person::setAge)
                   .build();
}
```

⚠️ `withBuilder(() -> new Person(null, -1))` generates *invalid* objects part of the time, by
construction — the seed value has a `null` name and an age of `-1`, and `withProbability(0.5)`
means the age setter may not run. That is fine when the property is about the parts that were
set and dangerous when it is not. If your domain object cannot legally hold `null`, do not
build it through a broken seed instance; use `combine` and a constructor.


## Optional is three different things, and only one of them is `@WithNull`

Before reaching for `withProbability`, be precise about which of these your field is, because
the generator differs for each and so does the property you can write about it.

| The field is… | Model it as | Generator |
|---|---|---|
| Absent, and absence is a legal domain state | `Optional<Discount>` | `discounts().optional()` — jqwik generates `Optional.empty()` about one time in twenty by default ([05a](05a-the-defaults-you-inherit.md)) |
| Present, but with a domain default when unspecified | `Discount` with `Discount.NONE` | `withProbability` on a builder step, so unset means the default |
| Genuinely nullable because the schema allows it | `@Nullable Discount` | `@WithNull` — probability 0.1 by default ([05b](05b-constraining-generation.md)) |

The middle row is the one that has no other tool. `Combinators.combine` must supply a value for
every position, so modelling "sometimes the builder default" through `combine` forces you to
generate `Discount.NONE` as one of the possible values — which works, and quietly changes the
claim: you are now asserting that an explicitly-set `NONE` behaves like an unset field, and if
the builder has any logic on that path you have stopped testing it.

```java
@Provide
Arbitrary<Order> ordersWithOptionalParts() {
    Arbitrary<CustomerId> customers =
            Arbitraries.strings().numeric().ofLength(8).map(CustomerId::new);
    Arbitrary<Discount> discounts =
            Arbitraries.integers().between(1, 40).map(Discount::percent);
    Arbitrary<String> notes = Arbitraries.strings().alpha().ofMaxLength(120);
    Arbitrary<Instant> placedAt = Arbitraries.longs()
            .between(1_600_000_000L, 1_900_000_000L)
            .map(Instant::ofEpochSecond);

    return Builders.withBuilder(OrderBuilder::new)          // valid, complete defaults
            .use(customers).in(OrderBuilder::withCustomer)   // always
            .use(placedAt).in(OrderBuilder::withPlacedAt)    // always
            .use(discounts).withProbability(0.3).in(OrderBuilder::withDiscount)
            .use(notes).withProbability(0.2).in(OrderBuilder::withNotes)
            .build(OrderBuilder::build);
}
```

`OrderBuilder::new` here takes no arguments and produces a *valid* order — that is the whole
difference between this and the guide's `new Person(null, -1)` example. Every generated value is
a legal `Order`; the optional steps vary which parts were explicitly set.

⚠️ **One inference, flagged as one.** The javadoc documents `withProbability(double)` as *"Set
probability for using this arbitrary"* and says nothing about correlation between steps. If the
steps are independent — the natural reading, and what the API shape implies — then two optional
steps at 0.3 and 0.2 make "both present" arrive about six times in a hundred, and five optional
steps at 0.5 make "all present" about one time in thirty-two. I could not find documentation
confirming independence, so if a specific combination matters to you, **prove the distribution
with statistics** rather than trusting the arithmetic on this page.

## Where this connects

- `Combinators.combine`, the eight-parameter ceiling this page routes around, and filtering
  combinations are [05c · Composing arbitraries](05c-composing-arbitraries.md).
- The dependent case, where a part cannot be generated until another exists, is
  [05c3 · Dependent generation](05c3-dependent-generation.md).
- `@WithNull` and its default probability of 0.1 are
  [05b · Constraining generation](05b-constraining-generation.md); `Optional`'s one-in-twenty
  empty rate is [05a · The defaults nobody chooses](05a-the-defaults-you-inherit.md).
- Whether the optional combinations you care about actually arrive is a question for
  **statistics and coverage checking**, which the topic covers separately.
- Exhaustive generation, which the builder supplier's contract constrains, is
  [03c · Attributes and defaults](03c-attributes-and-defaults.md).
- Builders and object mothers for hand-written fixtures — the same idea outside jqwik — are
  [08 · Test data patterns](../08-test-data-patterns/README.md).

## Gotchas

**★ `Builders.withBuilder(() -> new Person(null, -1))` deliberately starts from an invalid object, and `withProbability` means it may stay invalid.**
The guide's mutable-POJO example seeds the builder with `null` and `-1` because those fields
are about to be set — except that `withProbability(0.5)` means the age is set only half the
time. If your property asserts anything about the whole object rather than about the fields
that happened to be set, a `null` name will surface as a `NullPointerException` inside your
domain code and look like a production bug. Seed the builder with valid defaults, or use
`combine` and a constructor that cannot produce a broken instance.

**★ The builder supplier is invoked per generated value, so a supplier that reads a clock, a counter or a static field breaks exhaustive generation.**
The javadoc is precise: *"The supplier will be called freshly for each value generation. For
exhaustive generation all supplied objects are supposed to be identical."* "Supposed to be" is
a contract you can violate without an exception — `withBuilder(() -> new OrderBuilder(Instant.now()))`
produces a different seed object every time, which is harmless under randomised generation and
quietly wrong when jqwik switches to `EXHAUSTIVE` because the space got small
([03c](03c-attributes-and-defaults.md)). Put anything time-dependent in an `Arbitrary` and
`use(...)` it.

**★ `.in(...)` and `.inSetter(...)` are not interchangeable, and using `.in(...)` with a void setter does not compile in a way that explains itself.**
`.in(BiFunction)` expects the lambda to *return* the builder; `.inSetter(BiConsumer)` expects it
to return nothing and keeps the same builder. Point `.in(...)` at `Person::setName` and you get a
"bad return type in method reference: void cannot be converted to Person", which tells you what
is wrong but not that a differently-named method exists three lines up in the same javadoc. The
rule from the javadoc: `inSetter` is for *"a builder the methods of which do not return a new
builder"*.

**★ `BuilderCombinator` overrides `equals` and `hashCode`, and the javadoc says why: *"Equality matters to allow memoization of resulting arbitraries"*.**
That is a hint about the whole API worth carrying: jqwik memoizes arbitraries, so building the
same generator twice may hand you a cached instance rather than a fresh one. It is harmless for
pure descriptions and it is the reason none of these builder steps may capture mutable state
that you expect to be re-read. Anything varying belongs in an `Arbitrary`, never in a captured
variable.

## Interview questions

**★ `withProbability` makes the *step* conditional, not the *value*, so an optional field that is never set is indistinguishable in the report from one whose generator produced the default.**
The shrunk sample shows you the final `Order`. If `discount` reads `NONE` you cannot tell from
the report whether `withDiscount` ran with a generated `NONE` or never ran at all. When that
distinction matters — and it does whenever the builder has behaviour on the set path — either
give the builder a `boolean discountWasSet` you can assert on, or split into two properties, one
with the step always applied and one with it never applied.

**★ A `withProbability` of 0.0 or 1.0 is legal, compiles, and turns a step into dead configuration.**
The javadoc's only constraint is *"Must be between 0.0 and 1.0"*, so `withProbability(0.0)` is
accepted and silently disables the step. That is an easy thing to leave behind after debugging,
and it produces a generator that has stopped exercising a field while still naming it in the
source. A value outside the range is where the javadoc's contract runs out and I could not
confirm what happens; do not find out.

**★ Nothing forces the builder's defaults to be legal values, and a builder written for production callers usually assumes those callers set the required fields.**
Production code paths call `withCustomer(...)` before `build()` because a human wrote them that
way. A generator with `withProbability` on the customer step does not. If `build()` does not
validate, you get an `Order` with a null customer and a failure deep inside the property; if it
does validate, you get a generation-time exception that jqwik reports as a broken generator
rather than as a finding. Decide which of those you want before you make a required step
probabilistic — the answer is usually "neither, that step is not optional."

**★ A generator built from your production builder inherits your production builder's bugs, and the property will not tell you which side is wrong.**
This is the deeper version of the point above and the reason `Builders.withBuilder` deserves a
moment's thought rather than being the default choice. If `OrderBuilder` silently coerces a
negative quantity to zero, every generated `Order` respects that coercion, and the property
"total is never negative" passes because the generator cannot produce the input that breaks it.
`Combinators.combine` with a constructor has the same risk to a lesser degree — a constructor
usually does less. Where the builder is the thing under test, generate its *inputs* and let the
property call it, rather than using it to build the fixture.

## Interview questions

**★ You need a generator for a domain object with eleven fields. What do you do?**
First I ask whether the object should have eleven fields, because `Combinators.combine` topping
out at eight is a fairly good smell detector and the guide's first suggested remedy is *"group
some parameters into an object of their own and change your design"*. Assuming the design is
fixed — a legacy DTO, say — I would use `Builders.withBuilder`, which has no arity limit, drives
the existing builder or setters, and gives me `withProbability` for the optional fields so that
some generated instances exercise the defaults. The alternative the guide also lists, combining
intermediate `Tuple`s in a second step, works but produces a generator nobody can read six
months later. What I would not do is nest eleven `flatMap` calls.

**★ What does `withProbability` on a builder step buy you that a `@WithNull` annotation does not?**
`@WithNull` makes the *value* null some fraction of the time; `withProbability` decides whether
the builder step *runs at all*, so the field keeps whatever default the builder gives it. That
difference matters for anything with a non-null default: an `Order` whose `discount` defaults to
`Discount.NONE` should sometimes be generated with the default and sometimes with a generated
discount, and there is no null anywhere in that sentence. Using `@WithNull` to model optionality
forces `null` into a domain object that may not legally hold it, and then you have a generator
producing values your production code could never see, which is the fastest way to a property
that fails for reasons nobody cares about.

**★ How would you generate an aggregate where three of nine fields are optional, and how do you know the interesting combinations actually got generated?**
`Builders.withBuilder` seeded with a builder whose defaults are already valid, six mandatory
steps with `.in(...)` or `.inSetter(...)`, and three steps carrying `withProbability`. That gets
past the eight-parameter ceiling on `Combinators.combine` and, more importantly, it is the only
mechanism that distinguishes "field left at its default" from "field explicitly set to the
default value" — which is a real distinction whenever the builder has logic on the set path.
Knowing the combinations arrived is a separate job and not one to take on faith: with three
independent optional steps there are eight combinations, and if each probability is 0.5 the
all-present and none-present corners are one in eight each, which at a thousand tries is plenty
— but at `tries = 20` on a slow property it is not. I would collect a classifier over which
optional fields are present and check the coverage, which is what jqwik's statistics support is
for.

**★ Your teammate builds every generated fixture out of the production builder. What is your concern?**
That the generator can only produce inputs the builder is willing to construct, so any defect in
the builder becomes invisible to every property that uses it. If the builder normalises, clamps,
defaults or validates — and production builders usually do at least one of those — then the
generated sample is the set of values that survive the builder, not the set of values the
domain object can hold, and a property over that sample cannot falsify anything the builder
already prevents. It is a real and often acceptable trade: using the builder is convenient and
keeps the generator honest about how objects are made in production. But where the builder or
its validation *is* the thing under test, the generator has to bypass it — generate the raw
field values, hand them to the builder inside the property, and assert on what comes out.

{/* FOOTER */}
