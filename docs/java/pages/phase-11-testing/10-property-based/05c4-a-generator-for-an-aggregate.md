---
title: "A generator for a real domain aggregate is one flatMap for the one dependency that is real and combine for everything else, and reviewing one is a mechanical checklist — count the flatMaps, check every default that was left alone, and ask what the constraint is protecting"
sidebar_label: "05c4 · A generator for an aggregate"
sidebar_position: 26
---

<span className="db-tier t-when">When Needed</span>

> Verified: 2026-09-01 against the **jqwik 1.10.1 user guide**, sections *Combining Arbitraries
> with combine*, *Combining Arbitraries vs Flat Mapping*, *Flat Mapping*, *Uniqueness
> Constraints*, *Collection Sizes* and *Default Parameter Generation*
> ([jqwik.net](https://jqwik.net/docs/current/user-guide.html)).
> Version spine: JDK 25, Spring Boot 4.1.0, Spring Framework 7.0.8, JUnit Jupiter 6.0.3,
> AssertJ 3.27.7. jqwik 1.10.1 — see
> [02b · The version collision](02b-the-version-collision.md).
> ⚠️ **No sandbox and no test run on this machine.** The code below is source, not a run;
> nothing here reports what jqwik generated.

**Four pages of operators is not a generator. This one assembles them into a single `@Provide`
method for a real aggregate — an `Order` with a currency, a customer, a list of lines and a
timestamp — and then turns the result into the thing you actually need on a Tuesday afternoon:
a checklist for reviewing somebody else's. Every line of the generator below is a decision, and
every decision has a default it overrode or deliberately kept.**

## The generator

Everything from [05c](05c-composing-arbitraries.md) and [05c3](05c3-dependent-generation.md), on an aggregate with
independent parts and exactly one real dependency.

```java
class OrderProperties {

    @Property
    void totalEqualsTheSumOfLineTotals(@ForAll("orders") Order order) {
        Money expected = order.lines().stream()
                .map(OrderLine::lineTotal)
                .reduce(Money.zero(order.currency()), Money::plus);
        assertThat(order.total()).isEqualTo(expected);
    }

    @Provide
    Arbitrary<Order> orders() {
        Arbitrary<CustomerId> customers =
                Arbitraries.strings().numeric().ofLength(8).map(CustomerId::new);
        Arbitrary<Currency> currencies =
                Arbitraries.of(Currency.getInstance("EUR"), Currency.getInstance("JPY"));

        //  REAL DEPENDENCY: line amounts must be in the order's currency, and JPY has zero
        //  minor units where EUR has two. The *scale of the arbitrary* follows from the
        //  currency, so the currency has to be generated first. This is what flatMap is for.
        return currencies.flatMap(currency ->
                Combinators.combine(customers, lines(currency), placedAt())
                           .as((customer, lines, placedAt) ->
                                   new Order(customer, currency, lines, placedAt)));
    }

    private Arbitrary<List<OrderLine>> lines(Currency currency) {
        Arbitrary<Sku> skus = Arbitraries.strings().alpha().ofLength(6).map(Sku::new);
        Arbitrary<Integer> quantities = Arbitraries.integers().between(1, 50);
        Arbitrary<Money> prices = Arbitraries.bigDecimals()
                .between(BigDecimal.ONE, new BigDecimal("999.99"))
                .ofScale(currency.getDefaultFractionDigits())
                .map(amount -> new Money(amount, currency));

        //  No dependency between sku, quantity and price: combine, so all three shrink
        //  independently when a line turns out to be the problem.
        return Combinators.combine(skus, quantities, prices)
                          .as(OrderLine::new)
                          .list().ofMinSize(1).ofMaxSize(8)
                          .uniqueElements(OrderLine::sku);
    }

    private Arbitrary<Instant> placedAt() {
        return Arbitraries.longs()
                .between(1_600_000_000L, 1_900_000_000L)
                .map(Instant::ofEpochSecond);
    }
}
```

Read the shape rather than the details:

- **One** `flatMap`, for the one dependency that is real, with a comment saying what it is.
- `combine` everywhere else — three parts of an order, three parts of a line.
- The currency-dependent scale is expressed by passing the currency into a helper that
  *returns an arbitrary*. That is what a `flatMap` lambda is for, and pulling it into a named
  private method keeps the nesting at one level.
- `ofMinSize(1)`, because "total equals the sum of the lines" is not interesting on an empty
  order and the default lower bound of 0 would have wasted part of the sample
  ([05a](05a-the-defaults-you-inherit.md)).
- `uniqueElements(OrderLine::sku)` — a constraint that is part of the aggregate's invariant, not
  a filter bolted on afterwards.


## Every line is a decision, including the ones you did not write

The generator above overrides seven defaults and keeps several others. Both halves matter,
because a default you kept is a test-design decision you made silently.

| Line | Default it overrode | Why |
|---|---|---|
| `ofLength(8)` on the customer id | strings 0–255 chars | Ids have a fixed width; generating a 200-character one tests string handling, not orders |
| `numeric()` | the full default character set | An id that can contain a noncharacter is not an id |
| `of(EUR, JPY)` | no default for `Currency` at all | Two currencies with *different* minor units, chosen so the scale dependency is actually exercised |
| `between(1, 50)` on quantity | `int` across its whole range | Negative and `Integer.MAX_VALUE` quantities are a different property, deliberately not this one |
| `ofScale(...)` | `BigDecimal` at scale 2 | The scale is currency-dependent; scale 2 is right for EUR and wrong for JPY |
| `ofMinSize(1)` | collections 0–255 | An empty order makes the summation claim vacuous |
| `ofMaxSize(8)` | collections 0–255 | 255 lines per order is not a domain state; it is a runtime bill |
| `uniqueElements(OrderLine::sku)` | duplicates allowed | Two lines with the same SKU is an aggregate invariant violation, not an interesting input |

And the defaults deliberately kept: no `@WithNull` anywhere, because none of these fields is
nullable; no `shrinkTowards`, because zero is a sensible shrinking target for a quantity; the
default distribution on `between(1, 50)`, which is biased toward the middle and therefore tests
quantity 1 and quantity 50 less often than a uniform draw would ([05a](05a-the-defaults-you-inherit.md)).

⚠️ **The line worth arguing about is `between(1, 50)`.** It excludes zero and negatives, and a
reviewer should ask whether that is a domain fact or a convenience. If `OrderLine` rejects a
non-positive quantity in its constructor, the constraint is correct and merely mirrors the
domain. If it does not, the constraint has just hidden the question of what a zero-quantity
line does to the total — and that question deserves its own property rather than a range that
makes it unaskable. This is the distinction [05b](05b-constraining-generation.md) makes between
constraining for meaning and constraining for green.

## Reviewing somebody else's `@Provide` method

A checklist, in the order that finds problems fastest.

1. **Count the `flatMap` calls, including the disguised ones.** A `@Provide` method with `@ForAll`
   parameters is a `flatMap`; a private helper taking a generated value and returning an
   `Arbitrary` is a `flatMap`. For each one, ask the author to state what depends on what. Every
   one that cannot be stated is a `combine` waiting to happen and a worse minimal failing case
   until it is.
2. **Find every default that was left alone.** Unconstrained `@ForAll String`, a bare `.list()`,
   a `bigDecimals()` with no `ofScale` — each is a decision nobody made. Some are fine. The
   question is whether the author knows what the default is.
3. **For every constraint, ask what it is protecting.** A range that mirrors a domain rule is
   good. A range that exists because the property went red without it is a bug with a lid on.
   The two are indistinguishable in a diff, which is why this has to be asked out loud.
4. **Look for `filter` and `Assume.that`.** Both discard generated work, both have thresholds,
   and both are usually rewritable as a `map` or a tighter arbitrary
   ([05b2](05b2-filtering-assumptions-and-discards.md)). A filter with a low acceptance rate is
   a latent intermittent failure, not a style issue.
5. **Check that the generator cannot produce an object the domain forbids.** A generator that
   emits illegal aggregates produces failures nobody will act on, and the team learns to ignore
   the property.
6. **Check that it *can* produce the objects the domain permits and the code fears.** Empty
   collections, the boundary of every range, both currencies, the maximum size. If the property
   is the only test for a code path, the generator has to reach it.
7. **Ask how the author knows.** Points 5 and 6 are claims about a distribution, and a claim
   about a distribution is checkable rather than arguable — jqwik's **statistics and coverage
   checking** exist for precisely this and turn the review from opinion into a number.

## Where this connects

- The operators used above — `combine`, filtering combinations, `flatAs` — are
  [05c · Composing arbitraries](05c-composing-arbitraries.md).
- The single `flatMap` and the test for whether a dependency is real are
  [05c3 · Dependent generation](05c3-dependent-generation.md).
- Aggregates with optional parts, which this one does not have, are
  [05c2 · Builders and optional parts](05c2-builders-and-optional-parts.md).
- The defaults the table above overrides are
  [05a · The defaults nobody chooses](05a-the-defaults-you-inherit.md); the annotations that do
  the same job declaratively are [05b · Constraining generation](05b-constraining-generation.md).
- Sum types and recursive structures, which a richer aggregate will need, are
  [05c5 · Choosing among arbitraries](05c5-choosing-among-arbitraries.md); the recursive case is
  [05c6 · Recursive arbitraries](05c6-recursive-arbitraries.md).
- How to prove the distribution claims in steps 5 to 7 is the topic's **statistics** material.
- What the property this generator feeds should actually assert is
  [04 · Finding properties](04-finding-properties.md).

## Gotchas

**★ Passing a generated value into a helper *method* that returns an arbitrary is still a `flatMap` — extracting the method changes the readability, not the semantics.**
`currencies.flatMap(currency -> ... lines(currency) ...)` in the worked example above looks
tidier than an inline lambda and is exactly as dependent. That is fine here because the
dependency is real. The risk is that extraction makes chains *look* like plain composition, so
a generator with five private helpers each taking a generated value is five levels of flat
mapping wearing a disguise. Count the `flatMap` calls, not the indentation.

**★ Everything the outer arbitrary generates is regenerated when the inner one changes, so an expensive outer generator is paid for on every inner variation.**
This is the runtime face of the same coupling. If the outer value is expensive to produce — a
large list, a parsed structure — a chain that flat-maps three times on top of it multiplies that
cost across the run and across every shrink attempt. Where the expensive value does not actually
constrain the inner generator, hoisting it into a `combine` position removes the multiplication
as well as improving the shrink.

**★ A generator that mirrors the domain's validation cannot falsify the domain's validation, and this is the most common way a property suite becomes decorative.**
`between(1, 50)` on a quantity, `ofLength(8)` on an id, `uniqueElements` on the SKUs — each of
those encodes a rule that the aggregate itself is supposed to enforce. If the aggregate's
constructor is the thing under test, the generator has quietly removed every input that could
break it, and a thousand green tries mean nothing. Keep two families of generators: one that
produces only legal aggregates, for properties about behaviour, and one that produces raw field
values for properties about *construction*, where an illegal combination is the point.

**★ `Arbitraries.of(EUR, JPY)` shrinks toward the first argument, so every minimal failing case will be in EUR unless the defect is JPY-specific.**
The guide documents `of(U... values)` as *"Choose randomly from a list of values. Shrink towards
the first one."* That is usually what you want and occasionally misleading: a currency-rounding
defect that affects both currencies will always be reported in EUR, and a reader who assumes the
shrunk sample is representative may conclude the bug is EUR-only. Put the *least* interesting
value first on purpose, and remember that the shrunk sample answers "what is smallest", never
"what is typical".

**★ The `Currency` values above come from `Currency.getInstance(...)`, which reads the JVM's currency data, so the generator's domain is JDK-version-dependent.**
`getDefaultFractionDigits()` for a given currency comes from the platform, not from your code.
That is fine and correct — it is exactly the coupling the property is testing around — but it
means a generator whose behaviour depends on it is one more thing that can differ between a
laptop and a CI image on a different JDK. Where the money rules are yours, encode them in your
own type; where they are the platform's, know that you have taken a dependency on it.

## Interview questions

**★ Your aggregate has a field whose valid range depends on another field. Walk me through the generator.**
One `flatMap` on the determining field, and `combine` for everything else inside the lambda —
that is the shape in the worked `Order` example, where the currency determines the decimal scale
of every money amount. Concretely: generate the currency, then inside the lambda build the line
arbitrary with `ofScale(currency.getDefaultFractionDigits())` and combine it with the parts that
do not care. Two things I would insist on in review. First, a comment on the `flatMap` naming the
dependency, because that comment is the only thing standing between this generator and a
maintainer adding a second `flatMap` out of symmetry. Second, that the dependent construction
lives in a named private method returning an `Arbitrary`, so the nesting stays at one level and
the method signature — `Arbitrary<List<OrderLine>> lines(Currency currency)` — states the
dependency in types.

**★ Walk me through how you would review a `@Provide` method you have never seen.**
I go through it in a fixed order because the expensive problems are not the visible ones. First
I count the `flatMap` calls, including the two disguised forms — a provider method with `@ForAll`
parameters, and a private helper that takes a generated value and returns an `Arbitrary` — and
for each one I ask the author to say out loud what depends on what. Anything that cannot be
stated is a `combine` waiting to happen, and until it is, every failure of that property produces
a worse minimal case than it needed to. Second, I look for the defaults nobody overrode: a bare
`.list()` is 0 to 255 elements, an unconstrained `bigDecimals()` is scale 2, an unconstrained
`String` is 0 to 255 characters of a specific alphabet. Some of those are fine; the question is
whether the author knew. Third — and this is the one that actually finds bugs — for every
constraint I ask what it is protecting, because a range that mirrors a domain rule and a range
that was added to make a red property go green look identical in a diff and mean opposite
things. Then filters and assumptions, because those are latent intermittent failures rather
than style. And finally the two distribution claims: can it produce anything illegal, and does
it reach the cases the code is afraid of. Those last two are not matters of opinion — I would
ask for a statistics block rather than argue about them.

**★ You inherit a property whose generator produces only valid aggregates, and the bug report you are chasing is about invalid input reaching the aggregate. What do you do?**
Write a second generator, and probably a second property class. The existing generator is doing
its job: it produces legal orders so that properties about order *behaviour* — totals, currency
arithmetic, line ordering — are not drowned in constructor exceptions. What it cannot do is test
construction, because it never produces anything a constructor would reject. So the new
generator produces the raw parts — an unconstrained quantity, a possibly-empty line list, a
scale that does not match the currency — and the property asserts on the *outcome of
constructing*: either a well-formed aggregate or a specific, documented exception, never a
`NullPointerException` and never a silently coerced value. That is a different claim from the
first property and it deserves its own name; folding the two together produces a generator
constrained in the middle, which tests neither.

**★ Someone argues the generator should just be `Arbitraries.forType(Order.class)` and be done with it. What is the counter-argument?**
That `@UseType`-style generation gives you a sample shaped by whatever the constructors happen
to accept, not by the domain, and it does so silently. The guide notes that type-based
generation swallows exceptions during creation, so a constructor that rejects most inputs
produces a narrow sample and no warning — you end up with a property that runs a thousand tries
over a handful of distinct shapes. It also throws away every decision in the table above: the
scale that depends on the currency, the SKU uniqueness that is an aggregate invariant, the
minimum size that makes the claim non-vacuous. `forType` is genuinely useful for a quick smoke
property over a DTO with no invariants. For an aggregate that has invariants, it generates the
wrong distribution and hides that it did.

{/* FOOTER */}
