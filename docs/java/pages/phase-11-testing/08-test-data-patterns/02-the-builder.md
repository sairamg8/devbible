---
title: "The test data builder: put the boring defaults in one place, let every test name only the field its assertion depends on, and hand each test its own object so that changing a default cannot break a test that never mentioned it"
sidebar_label: "02 · The builder"
sidebar_position: 3
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-31 against the **JUnit 5 / Jupiter 6.0.3** user guide
> ([docs.junit.org/6.0.3](https://docs.junit.org/6.0.3/user-guide/)) for lifecycle and
> test-instance semantics, and the **AssertJ 3.27.7** documentation for the assertion style
> used in the examples.
> Version spine from `spring-boot-dependencies:4.1.0`: JDK 25, Spring Boot 4.1.0,
> Spring Framework 7.0.8, JUnit Jupiter 6.0.3, Mockito 5.23.0, AssertJ 3.27.7.
> ⚠️ **No sandbox and no test runs on this machine** — Java source and documented behaviour
> only, never console output from a suite.

**A test data builder is a test-only class that knows how to make one valid domain object with
boring defaults, and lets a test override exactly the fields it cares about. That is the whole
idea. It is worth a chunk because the details decide whether it fixes the
[forty-line setup](01-the-forty-line-setup.md) or reproduces it one layer down: where the
defaults live, whether each call gets a fresh object, and whether the builder is allowed to
build things production cannot.**

## The shape

```java
public final class CustomerBuilder {

    private String  email        = "customer@example.com";
    private String  firstName    = "Test";
    private String  lastName     = "User";
    private LoyaltyTier tier     = LoyaltyTier.BRONZE;
    private CustomerStatus status = CustomerStatus.ACTIVE;
    private Address address       = anAddress().build();

    private CustomerBuilder() { }

    public static CustomerBuilder aCustomer() {
        return new CustomerBuilder();
    }

    public CustomerBuilder withEmail(String email) {
        this.email = email;
        return this;
    }

    public CustomerBuilder gold()      { this.tier = LoyaltyTier.GOLD;   return this; }
    public CustomerBuilder silver()    { this.tier = LoyaltyTier.SILVER; return this; }
    public CustomerBuilder suspended() { this.status = CustomerStatus.SUSPENDED; return this; }

    public Customer build() {
        return Customer.register(email, firstName, lastName, address)
                       .withTier(tier)
                       .withStatus(status);
    }
}
```

And the test from chunk 01 becomes:

```java
@Test
void goldCustomersGetTenPercentOff() {
    Order order = anOrder()
            .forCustomer(aCustomer().gold())
            .withLine("SKU-1", 2, "10.00")
            .withLine("SKU-2", 1, "70.00")
            .build();

    assertThat(policy.discountFor(order)).isEqualTo(Money.gbp("9.00"));
}
```

Three of the four costs from [chunk 01](01-the-forty-line-setup.md) are gone by construction:

- **Cost 1 — the relevant field is invisible.** Every value on screen is load-bearing. `gold()`
  and the two lines totalling 90 are exactly the facts that produce £9.
- **Cost 2 — a default change breaks unrelated tests.** Each test that depends on gold *says*
  gold. Changing the builder's default tier cannot silently change what this test asserts,
  because this test does not use the default.
- **Cost 3 — irrelevant data reads as relevant.** The address, the email and the name are not in
  the test, so the test makes no claim about them.

Cost 4 — the ratchet — is gone too, but for a different reason: there is no shared block for it
to operate on. The builder grows a method when a new field needs naming, which is additive and
harmless, because a new method changes nothing for existing callers.

## Rule 1 · Defaults must be valid, boring, and never the subject of a test

The default object should be the most ordinary member of its type — an active bronze customer
with a plausible email. Two properties matter and they pull in the same direction:

- **Valid.** `build()` must produce an object production would accept. A builder that can emit
  a `Customer` with a null email teaches tests to exercise states that cannot occur.
- **Uninteresting.** If the default tier were `GOLD`, every test that forgot to say `bronze()`
  would silently be a gold test — and you are back to cost 2, now hidden inside a class nobody
  reads. Defaults are the values no assertion should ever depend on.

There is a useful stronger version of this rule, worth adopting on a suite that has been bitten:
**make the defaults obviously fake.** `"customer@example.com"`, `"Test"`, `"AAAA-0000"`. When a
production bug report quotes `customer@example.com`, you know instantly that a test fixture
escaped into somewhere it should not have been.

⚠️ The one exception is a field whose *valid* range is narrow and whose default therefore
carries meaning anyway — a currency, a country, a tax jurisdiction. Those are not neutral; a
`GBP` default silently makes every unspecified test a UK test. Either name it in every test that
depends on it, or accept explicitly that the builder encodes a house currency and say so in a
comment on the field. This is one of the few comments in a test suite that earns its place.

## Rule 2 · One call, one object — never share a built instance

```java
// ⚠️ wrong: one Customer, three tests, mutation bleeds between them
private static final Customer GOLD = aCustomer().gold().build();
```

The builder's job includes handing each test its **own** object. A `static final` built instance
is the shared-mutable-fixture bug from
[01b · What the fix is not](01b-what-the-fix-is-not.md) wearing a builder's clothes: `final`
protects the reference, not the entity, and one `setStatus()` anywhere in the suite changes the
object every later test sees.

A `static` **method** is fine, because it returns a fresh object per call:

```java
public static Customer aGoldCustomer() {
    return aCustomer().gold().build();
}
```

⚠️ A subtler version of the same bug lives inside the builder: if a builder holds a mutable
collection and a test does `anOrder().withLines(sharedList)`, two orders can end up sharing one
list. Defensive-copy collections in `build()`, or hold an immutable list in the builder and
replace it rather than mutate it.

## Rule 3 · Name methods after the concept, not the field

`gold()` says something about the domain. `withLoyaltyTier(LoyaltyTier.GOLD)` says something
about the class layout, and it costs the reader a translation step every time.

The general form: a builder method should read as the *situation* the test is establishing.

| Field-shaped | Concept-shaped |
|---|---|
| `withStatus(SUSPENDED)` | `suspended()` |
| `withLines(List.of())` | `withNoLines()` |
| `withPlacedAt(now.minusDays(40))` | `placedOutsideTheReturnWindow()` |
| `withBalance(new BigDecimal("-5.00"))` | `overdrawn()` |

The right-hand column also survives refactoring: when "outside the return window" changes from
30 days to 45, one builder method changes and no test does. That is the point at which a builder
stops being a convenience and starts being where a rule is written down once.

⚠️ Keep both forms available. Concept methods are for the common situations; a raw
`withPlacedAt(Instant)` is still needed for the test that is specifically about a boundary. A
builder that only exposes concepts forces someone to add a new concept for every edge case, and
they will instead go around the builder entirely.

## Where this connects

- The problem this pattern solves, and its four separable costs, are in
  [01 · The forty-line setup](01-the-forty-line-setup.md).
- The design rules that decide whether a builder stays useful — where it lives, whether Lombok
  can generate it, and the "constructor with more typing" failure — are in
  [02b · Builder design rules](02b-builder-design-rules.md).
- Where the builder class lives in a multi-module build, and what Lombok's `@Builder` does to
  your defaults, are in
  [02c · Where builders live, and Lombok](02c-where-builders-live-and-lombok.md).
- What changes when the domain type is a `record` and there are no setters at all is in
  [02d · Builders and records](02d-builders-and-records.md).
- When the reusable unit is a *scenario* rather than an object, the pattern is
  **03 · Object mothers** *(not written yet)*.
- Getting the built object into a database, rather than into a variable, is
  **04 · Fixtures in the database** *(not written yet)*.
- When the repetition is in the *cases* rather than the objects, the answer is
  [03 · Parameterized tests](../03-parameterized-tests/README.md), not a builder.

## Gotchas

**★ A default that any test's assertion depends on is a bug waiting for someone to change it.**
The rule "defaults are values no assertion depends on" is checkable: for each default, ask
whether any test would go red if you changed it. If one would, that test is silently relying on
a value it never names, and the fix is to make the test say it out loud — not to freeze the
default with a comment.

**★ `private static final Customer GOLD = aCustomer().gold().build();` is the old bug with a new face.**
Using a builder does not make a shared instance safe; the sharing is the problem, not the
construction. A `static` *method* returning a fresh object is safe; a `static` *field* holding a
built entity is a suite-wide mutable singleton, and under parallel execution it is a data race.

**★ A mutable collection handed into a builder can end up shared between two built objects.**
`anOrder().withLines(lines)` followed by a second `anOrder().withLines(lines)` gives two orders
one list, and a mutation through either is visible through both. Copy on the way in or on the
way out; an immutable `List.copyOf` in `build()` costs nothing and removes the whole class of
bug.

**★ Builder defaults drift away from production defaults and nothing notices.**
A field gains a new default in the domain type; the builder keeps the old one. Now tests
describe a system that no longer exists, and the tests still pass because they only ever
compare the code to themselves. The cheapest guard is to have the builder call the same factory
production calls, so a default that lives in the factory is inherited rather than duplicated.

**★ A concept method whose meaning is ambiguous is worse than a field setter.**
`aCustomer().premium()` — does that mean the tier, the subscription, or the support plan? A
concept name has to correspond to a term the domain actually uses. If the team would ask "which
premium?", the method is not a concept, it is a shortcut, and it will be misread in a test
whose failure then makes no sense.

**★ Overusing the builder in *assertions* makes a test compare the code to itself.**
`assertThat(result).isEqualTo(aCustomer().gold().build())` looks tidy, and if the code under
test constructs its result the same way the builder does, the test can pass while both are
wrong. Assert on the specific fields the behaviour is about, or on a value object whose equality
you trust.

## Interview questions

**★ What is a test data builder and what problem does it actually solve?**
A test-only class holding the boring defaults for one domain type, with fluent methods letting a
test override just the fields its assertion depends on. It solves three separable problems at
once: the relevant field becomes visible (everything else is not in the test), a default change
can no longer break a test that never named the value (each test states what it depends on), and
irrelevant data stops reading as relevant. It also removes the ratchet, because there is no
longer a shared setup block for fields to accumulate in — a new field means a new builder method,
which changes nothing for existing callers.

**★ How do you choose the default values?**
Valid, boring, and never the subject of any assertion. Valid means `build()` produces an object
production would accept, so tests never exercise impossible states. Boring means the most
ordinary member of the type — an active bronze customer — so that a test which forgets to state
something is not silently testing an interesting case. The check is mechanical: for each
default, ask whether changing it would turn any test red. If yes, that test depends on a value
it never names, and the test should name it. Making defaults obviously fake
(`customer@example.com`) is a cheap bonus: fixture data becomes recognisable if it ever leaks.

**★ Why is `public static final Customer GOLD_CUSTOMER = aCustomer().gold().build();` a bad idea, given that it uses a builder?**
Because the problem was never how the object was constructed, it was that one instance is shared
across the suite. `final` freezes the reference, not the entity, so any test that mutates it —
legitimately, perhaps testing suspension — changes what every later test in that JVM sees. The
resulting failure is order-dependent, blames the reading test rather than the writing one, and
disappears on re-run. Under parallel execution it is a straightforward data race. A static
*method* returning a fresh object gives the same convenience with none of it.

**★ Should builder methods be named after fields or after domain concepts?**
Both, with concepts preferred for the common cases. `gold()` and `placedOutsideTheReturnWindow()`
say what situation the test is establishing; `withLoyaltyTier(GOLD)` says what the class looks
like and makes the reader translate. Concept methods also localise a rule: when "outside the
return window" changes from 30 to 45 days, one builder method changes and no test does. But keep
the raw setters available, because a test specifically about a boundary needs to state the exact
value, and a builder that only offers concepts pushes people to bypass it entirely.

{/* FOOTER */}
