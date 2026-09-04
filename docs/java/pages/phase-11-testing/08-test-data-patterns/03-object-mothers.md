---
title: "The object mother names a situation rather than an object: when twenty tests all need \"a customer with three unpaid invoices and a suspended card\", the reusable unit is that sentence, and a builder cannot say it"
sidebar_label: "03 · Object mothers"
sidebar_position: 7
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-31 against the **JUnit 5 / Jupiter 6.0.3** user guide
> ([docs.junit.org/6.0.3](https://docs.junit.org/6.0.3/user-guide/)) for lifecycle and test
> instance semantics, and the **AssertJ 3.27.7** documentation for the assertion style used in
> the examples. The pattern itself predates all of these — it comes out of the early XP
> literature and has no specification; what follows is the version that survives contact with a
> large suite.
> Version spine from `spring-boot-dependencies:4.1.1`: JDK 25, Spring Boot 4.1.1,
> Spring Framework 7.0.9, JUnit Jupiter 6.0.3, Mockito 5.23.0, AssertJ 3.27.7.
> ⚠️ **No sandbox and no test runs on this machine** — Java source and documented behaviour
> only, never console output from a suite.

**A builder answers "how do I make one of these". An object mother answers "give me the
situation this test is about". They are not competitors — the mother is almost always
implemented *on top of* builders — and the distinction that matters is what gets a name. When
the reusable unit is a single object with one interesting field, name it with a builder method.
When it is an arrangement of several objects that the domain has a word for, name it with a
mother, because that name is the only place the arrangement's meaning can live.**

## The situation a builder cannot name

```java
@Test
void dunningStopsWhenTheCardIsSuspended() {
    Customer customer = aCustomer().gold().build();
    Invoice i1 = anInvoice().forCustomer(customer).unpaid().dueDaysAgo(45).build();
    Invoice i2 = anInvoice().forCustomer(customer).unpaid().dueDaysAgo(30).build();
    Invoice i3 = anInvoice().forCustomer(customer).unpaid().dueDaysAgo(15).build();
    PaymentMethod card = aCard().forCustomer(customer).suspended().build();

    DunningDecision decision = dunning.decide(customer, List.of(i1, i2, i3), card);

    assertThat(decision).isEqualTo(DunningDecision.HOLD);
}
```

Every line uses builders correctly and the test is still hard to read, for a reason chunk 02
cannot fix: **the subject of the test is the arrangement, not any one object.** The reader has to
assemble "a delinquent customer whose card has been suspended" from five statements, and the
next nineteen tests about dunning will assemble it again.

The mother names it:

```java
@Test
void dunningStopsWhenTheCardIsSuspended() {
    DunningCase delinquent = aDelinquentCustomerWithASuspendedCard();

    assertThat(dunning.decide(delinquent)).isEqualTo(DunningDecision.HOLD);
}
```

## What a mother is, mechanically

A class of static factory methods, each named for a scenario, each returning a fully-formed
object or small object graph — implemented with the builders from
[02 · The builder](02-the-builder.md):

```java
public final class Customers {

    private Customers() { }

    public static Customer aNewCustomer() {
        return aCustomer().build();
    }

    public static Customer aGoldCustomer() {
        return aCustomer().gold().build();
    }

    public static Customer aCustomerWhoHasNeverOrdered() {
        return aCustomer().withOrders(List.of()).build();
    }

    public static Customer aSuspendedCustomerWithAnOutstandingBalance() {
        return aCustomer().suspended().withBalance(Money.gbp("125.00")).build();
    }
}
```

Two things are doing the work, and both are worth naming explicitly:

- **The method name is documentation that the compiler keeps honest.** Rename the concept in the
  domain and the mother renames with it; every test that used the scenario updates in one place.
- **The knowledge of how to construct the situation is in one place.** A test author who does not
  know that "delinquent" means three invoices past 30 days does not have to; and when the rule
  changes to two invoices, one method changes.

## The rule that decides between mother and builder

> **A builder names an object. A mother names a situation. Give the name to whichever the tests
> actually repeat.**

In practice:

| Repeated thing | Pattern |
|---|---|
| "a customer" with one field varying per test | builder |
| "a gold customer" appearing in 20 tests | builder method (`gold()`) or a one-line mother |
| "a customer with three unpaid invoices and a suspended card" | **mother** |
| "an order that is inside / outside the return window" | mother, because the *rule* is the thing |
| twelve tax bands differing by two numbers | neither — `@ParameterizedTest` |

The third row is the one that matters: no builder method can express it, because it is not a
property of one object. Trying to force it in produces `aCustomer().delinquent()`, which lies —
it suggests delinquency is a customer attribute when it is a fact about invoices.

## The trick that keeps mothers flexible: return the builder

The classic failure of object mothers is combinatorial: a test needs "a delinquent customer, but
in EUR", and there is no method for that, so someone adds
`aDelinquentCustomerInEuros()`. Twenty scenarios later the class is unreadable. The fix is
mechanical — **have the mother return a builder, not a built object**:

```java
public static CustomerBuilder aDelinquentCustomer() {
    return aCustomer().gold().withInvoices(threeUnpaidInvoices());
}
```

```java
Customer c = aDelinquentCustomer().withCurrency(EUR).build();
```

Now the mother supplies the *scenario* and the test supplies the *variation*, which is exactly
the division of labour that keeps both readable. The cost is one extra `.build()` at every call
site; it is worth it, and it is the single most useful refinement to the pattern.

⚠️ Offer both where it helps: `aDelinquentCustomer()` returning a builder and
`aDelinquentCustomerBuilt()` — or an overload — for the many call sites that want no variation.
Do not make the plain-object version the *only* one, because that is how the combinatorial
explosion starts.

## Where mothers stop being the answer

- **When the name is vague.** `aValidCustomer()`, `aTestOrder()`, `standardSetup()`. A name that
  does not say what is true of the object is worse than the five builder lines it replaced,
  because it hides them behind a word that means nothing. If you cannot name the scenario in
  domain language, you do not have a scenario, you have an object — use a builder.
- **When the scenario is used once.** A mother is a shared vocabulary; a scenario with one caller
  is just indirection, and it will be read by exactly one person who has to jump to find it.
- **When the variation is the point.** Twelve tests each needing a slightly different arrangement
  are not twelve scenarios; that is a table, and it belongs to
  [03 · Parameterized tests](../03-parameterized-tests/README.md).
- **When it grows into a god object.** The failure mode is common enough and specific enough to
  get its own chunk: [03b · When a mother becomes a god object](03b-when-a-mother-becomes-a-god-object.md).

## Naming and placement, briefly

- **One mother class per aggregate**, named for the plural of the type — `Customers`, `Orders`,
  `Invoices` — with a private constructor. Static-import it in tests so call sites read as
  sentences.
- **Method names are full clauses, not labels.** `aCustomerWhoHasNeverOrdered()` beats
  `newCustomer()`. Length is not the enemy here; ambiguity is.
- **Name the state, not the intent.** `anExpiredCard()` says what is true.
  `aCardThatShouldBeDeclined()` states the expected outcome, which means the fixture is asserting
  the behaviour under test — and the test then cannot fail informatively when the rule changes.
- **Keep them beside the builders**, in test sources or the fixtures module —
  see [02c · Where builders live, and Lombok](02c-where-builders-live-and-lombok.md).

## Where this connects

- The object-level pattern that mothers are built from is [02 · The builder](02-the-builder.md).
- The failure mode of the pattern, and how to see it coming, is
  [03b · When a mother becomes a god object](03b-when-a-mother-becomes-a-god-object.md).
- Putting a scenario into a database rather than into variables is
  [04 · Fixtures in the database](04-fixtures-in-the-database.md).
- The setup block both patterns exist to remove is
  [01 · The forty-line setup](01-the-forty-line-setup.md).

## Gotchas

**★ A mother that names an outcome instead of a state pre-judges the test.**
`aCardThatShouldBeDeclined()` builds the expected behaviour into the fixture's name. When the
decline rule changes, the fixture's name becomes false while every test still passes, and the
name is now actively misleading. Name what is true of the object — `anExpiredCard()`,
`aCardWithNoFunds()` — and let the assertion say what should happen.

**★ `aValidCustomer()` is the most common mother name and one of the least useful.**
Valid according to what? Every object a builder produces should be valid, so the name adds
nothing except a place for undocumented assumptions to accumulate. The tell is that nobody can
say what would make it invalid. Rename it for the property tests actually depend on, or replace
it with the builder call.

**★ A mother returning a built object forces a new method for every variation.**
The combinatorial explosion is not a hazard of the pattern, it is a hazard of the return type.
`aDelinquentCustomer()` returning a `CustomerBuilder` lets one method serve every variation;
returning a `Customer` guarantees `aDelinquentCustomerInEuros()` and its fourteen cousins.

**★ Mothers hide the arrangement, so a test that breaks gives you less to go on.**
The trade is real and worth stating: when `aDelinquentCustomer()` changes, tests that never
mentioned invoices start failing. Mitigate it by keeping mothers small and named precisely, and
by resisting the urge to bundle unrelated state into a scenario "while we are here" — the
bundling is what makes a failure hard to attribute.

**★ Static-importing two mother classes with similar method names produces silent mistakes.**
`Customers.aGoldCustomer()` and `LegacyCustomers.aGoldCustomer()` static-imported into the same
test class is a compile error if both are imported, and — worse — a silent wrong choice if only
one is and nobody notices which. Keep one mother per aggregate, and let the class name
disambiguate when two are genuinely different.

**★ A mother that reaches into a database or a Spring context is not a mother any more.**
The pattern is about constructing objects. The moment `aDelinquentCustomer()` also saves rows,
it has become a fixture-loading routine with a misleading name, and unit tests that only wanted
an object now need a database. Keep persistence in a separate, obviously-named layer — see
[04 · Fixtures in the database](04-fixtures-in-the-database.md).

**★ Scenario knowledge in a mother can drift out of sync with the rule it encodes.**
`aDelinquentCustomer()` builds three invoices past 30 days because that was the policy when it
was written. The policy moves to two invoices past 45 days; production changes; the mother does
not. Every test using it still passes and none of them is testing delinquency any more. Where a
mother encodes a business rule, it should derive from the same constant production uses, not
restate the number.

**★ A test that overrides half of what the mother set is telling you the mother is wrong for it.**
`aDelinquentCustomer().withInvoices(...).withBalance(...).withStatus(...)` has kept the name and
discarded the scenario. Either the test wants a different scenario that deserves its own name,
or it wants a builder. Overriding one field is the pattern working; overriding four is a signal.

## Interview questions

**★ What is an object mother, and how is it different from a builder?**
A builder knows how to construct one object with sensible defaults and per-field overrides; an
object mother is a named factory for a *situation* — usually a small object graph — that the
domain has a word for. The distinction is what gets the name. "A gold customer" is a property of
one object and belongs on a builder; "a delinquent customer with a suspended card" is an
arrangement of a customer, three invoices and a payment method, and no builder method can express
it honestly. Mothers are normally implemented on top of builders rather than instead of them.

**★ How do you stop a mother class from exploding into a hundred nearly-identical methods?**
Return the builder rather than the built object. `aDelinquentCustomer()` returning a
`CustomerBuilder` lets one scenario method serve every variation, because the test appends
whatever it needs and calls `build()`. Returning a finished object is what forces
`aDelinquentCustomerInEuros()`, `aDelinquentCustomerWithNoEmail()` and so on, because each new
requirement has nowhere else to go. Offer a built-object convenience alongside it for the
majority of call sites that want no variation.

**★ What makes a good mother method name?**
A full clause in domain language that states what is *true* of the object, not what the test
expects to happen to it. `aCustomerWhoHasNeverOrdered()` is good; `aValidCustomer()` is nearly
meaningless, because everything a builder produces should be valid and nobody can say what would
make it invalid; and `aCardThatShouldBeDeclined()` is actively harmful, because it moves the
expected behaviour into the fixture, so when the decline rule changes the name silently becomes
a lie while the tests keep passing.

**★ What do you lose by using mothers?**
Locality. The arrangement is no longer visible in the test, so a failure gives the reader less to
work with, and a change to a shared scenario can break tests that never mentioned the fields
involved. That is a genuine trade against the gain — one place where the situation is defined,
in domain vocabulary, updated once when the rule changes. It is manageable when mothers are
small, precisely named, and never bundle unrelated state; it becomes unmanageable when one class
knows how to build everything, which is the god-object failure.

**★ When would you use neither a builder nor a mother?**
When the repetition is in the cases rather than the objects — twelve tax bands differing by two
numbers are a `@ParameterizedTest` table, and expressing them as twelve mother methods or twelve
builder chains buries the fact that they are one test. Also when the object is trivially
constructible and self-explanatory: a two-component record needs no scaffolding, and adding some
costs a reader a jump to find out that it does nothing.

**★ A scenario method encodes a business rule — three invoices over 30 days is "delinquent". What is the risk?**
That production's definition moves and the fixture's does not. Nothing links them, so the rule
changes in the service, the mother keeps building the old arrangement, and every test using it
still passes while no longer testing delinquency at all. It is the same drift as a stale comment,
with the added confidence that comes from being executable code. Where a mother encodes a rule,
derive it from the same constant or policy object production reads, so that changing the rule
either updates the fixture or breaks the compile.

{/* FOOTER */}
