---
title: "The forty-line setup block: a test whose first forty lines build a customer, an address, three order lines and a payment method has hidden the one field it is actually about, and every reader after you pays to find it again"
sidebar_label: "01 · The forty-line setup"
sidebar_position: 1
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-31 against the **JUnit 5 / Jupiter 6.0.3** user guide
> ([docs.junit.org/6.0.3](https://docs.junit.org/6.0.3/user-guide/)) for test-instance
> lifecycle and `@BeforeEach` semantics, and the **Spring Framework 7.0.8** testing
> reference for what a test class inherits from a context.
> Version spine from `spring-boot-dependencies:4.1.0`: JDK 25, Spring Boot 4.1.0,
> Spring Framework 7.0.8, JUnit Jupiter 6.0.3, Mockito 5.23.0, AssertJ 3.27.7.
> ⚠️ **No sandbox and no test runs on this machine** — every page in this topic carries
> Java source and documented behaviour, never console output from a suite.

**Every codebase has one: a test class whose `@BeforeEach` is longer than any test in it.
It builds a `Customer`, an `Address`, three `OrderLine`s and a `PaymentMethod`, sets
fourteen fields that no assertion mentions, and ends with the one line that the test is
genuinely about — buried at position 31 where nobody will see it. The setup block is not
a style problem. It is a comprehension problem, a coupling problem and a maintenance
problem at once, and the three patterns in this topic (builders, object mothers, database
fixtures) are three different answers to it.**

## The block

Here is the shape, unexaggerated. This is a discount test.

```java
class DiscountPolicyTest {

    private Customer customer;
    private Order order;
    private DiscountPolicy policy;

    @BeforeEach
    void setUp() {
        Address address = new Address();
        address.setLine1("42 Sample Street");
        address.setLine2("Floor 3");
        address.setCity("Bristol");
        address.setPostcode("BS1 4ST");
        address.setCountry("GB");

        customer = new Customer();
        customer.setId(1L);
        customer.setEmail("test@example.com");
        customer.setFirstName("Test");
        customer.setLastName("User");
        customer.setBillingAddress(address);
        customer.setShippingAddress(address);
        customer.setCreatedAt(LocalDateTime.of(2024, 1, 1, 9, 0));
        customer.setStatus(CustomerStatus.ACTIVE);
        customer.setMarketingOptIn(false);
        customer.setLoyaltyTier(LoyaltyTier.GOLD);

        PaymentMethod card = new PaymentMethod();
        card.setType(PaymentType.CARD);
        card.setLast4("4242");
        card.setExpiry(YearMonth.of(2030, 12));

        order = new Order();
        order.setId(100L);
        order.setCustomer(customer);
        order.setPlacedAt(LocalDateTime.of(2024, 6, 1, 12, 0));
        order.setPaymentMethod(card);
        order.setCurrency(Currency.getInstance("GBP"));
        order.addLine(new OrderLine("SKU-1", 2, new BigDecimal("10.00")));
        order.addLine(new OrderLine("SKU-2", 1, new BigDecimal("30.00")));
        order.addLine(new OrderLine("SKU-3", 1, new BigDecimal("40.00")));

        policy = new DiscountPolicy();
    }

    @Test
    void goldCustomersGetTenPercentOff() {
        Money discount = policy.discountFor(order);
        assertThat(discount).isEqualTo(Money.gbp("9.00"));
    }
}
```

Now answer the question the test exists to answer: **why is the discount £9.00?**

You cannot, without reading all forty lines and doing arithmetic. The order total is
`2 × 10 + 30 + 40 = 90`, the customer is `GOLD`, gold is ten percent. Three facts, and
each of them is a single line hidden among thirty-seven that do not matter. `last4`,
`marketingOptIn`, `line2`, the shipping address, the placed-at timestamp — none of them
is read by `discountFor`, and nothing in the test says so.

The test that this topic is working towards says the same thing in three lines:

```java
@Test
void goldCustomersGetTenPercentOff() {
    Order order = anOrder().forCustomer(aCustomer().gold()).totalling("90.00").build();

    assertThat(policy.discountFor(order)).isEqualTo(Money.gbp("9.00"));
}
```

Every value on the screen is a value the assertion depends on. That is the entire target,
and the rest of the topic is the mechanics of reaching it without losing anything real.

## The four costs, which are different problems

It is worth separating these, because different patterns fix different ones and teams
routinely adopt a pattern that does not address the cost they actually have.

**1 · The relevant field is invisible.** This is the comprehension cost and it is paid on
every read, forever. A test is documentation of a behaviour; this one documents that
`discountFor` exists. The reader has to reconstruct the causal chain — *tier is GOLD,
lines sum to 90, therefore 9* — by elimination, from data that gives no hint about which
of its parts is load-bearing.

**2 · Changing one default breaks tests that never mentioned it.** This is the coupling
cost. Change the setup's `LoyaltyTier.GOLD` to `SILVER` because a *new* test needed a
silver customer, and every existing assertion that silently depended on gold now fails —
in a class where nothing said "gold" out loud. The setup block is shared mutable state
with the ergonomics of a global variable.

**3 · It states things that are not true.** This is the honesty cost, and it is the one
people miss. A reader is entitled to assume that data a test bothers to set is data the
test needs. Setting `marketingOptIn(false)` in a discount test asserts, in the only
language tests have, that marketing opt-in has something to do with discounts. When it
does not, the test has told the reader a lie that costs them ten minutes.

**4 · It only ever grows.** This is the ratchet. Adding a field to the setup is safe and
takes ten seconds; deleting one risks breaking a test you did not write, so nobody does
it. The block is monotonic. Six months of "just add the field it needs" is exactly how
forty lines happens, and no single commit in that history looks unreasonable.

Costs 1 and 3 are fixed by making the test name its own data — the builder in
**02 · The builder** *(not written yet)*. Cost 2 is fixed by giving each test its own
object rather than a shared one, which a builder also does, and which a `static` fixture
notably does not. Cost 4 is not fixed by any pattern: it is fixed by the block ceasing to
exist, because there is no longer a shared place for the ratchet to operate on.

## Why `@BeforeEach` makes it worse than a helper method would

JUnit's default lifecycle is `PER_METHOD`: the Jupiter user guide states that a **new test
instance is created for each test method**, and `@BeforeEach` runs before each one. So
every line of that block executes once per test in the class — including for the tests
that need none of it.

That has three consequences worth naming.

- **Blast radius.** A `NullPointerException` on line 12 of the setup fails every test in
  the class, including the three that never touch a `Customer`. The failure report names
  ten broken tests when one thing is broken, and the person triaging has to work out that
  they are one bug, not ten.
- **It is not opt-in.** A private helper method that a test *calls* is visible at the call
  site; a `@BeforeEach` that a test *inherits* is not. The dependency is real either way,
  but only one of them shows up where you are reading.
- **It runs for the tests that will throw it away.** A test whose first line is
  `order = anOrderWithNoLines()` — because that is the case it is about — still paid for
  the three order lines the setup built. Harmless per test; noticeable when the setup
  reaches a database, a Spring context or a container.

⚠️ Switching to `@TestInstance(Lifecycle.PER_CLASS)` does not fix any of this — it changes
who owns the instance and lets `@BeforeAll` be non-static, but the setup still runs per
method (that is `@BeforeEach`'s contract), and now the fields are genuinely shared across
methods, which turns cost 2 into a bleed-between-tests problem as well. See
**05b · Tests that depend on each other** *(not written yet)*.

## Where this connects

- The diagnostic that tells you how much of a given block is decoration, and the four
  "fixes" that are not fixes, are in
  [01b · What the fix is not](01b-what-the-fix-is-not.md).
- The pattern that fixes costs 1 and 3 directly — defaults live somewhere else, the test
  names only what it depends on — is **02 · The builder** *(not written yet)*.
- The pattern for when the *scenario* is the unit of reuse rather than the object is
  **03 · Object mothers** *(not written yet)*.
- The lifecycle rules this page leans on — `@BeforeEach`, `@BeforeAll`, `PER_METHOD` vs
  `PER_CLASS`, and execution order — belong to
  [01 · JUnit 5](../01-junit-5/README.md), which owns the engine.
- Where the *cases* rather than the *objects* are the repetitive part, the answer is
  [03 · Parameterized tests](../03-parameterized-tests/README.md), not a builder.

## Gotchas

**★ A setup block that grows by one field per pull request never looks unreasonable in any single review.**
This is why the pattern survives code review indefinitely. No reviewer sees "forty lines
of irrelevant data"; each sees "+3 lines to make the new test compile". The only place the
cost is visible is in the diff between the block today and the block a year ago, which
nobody reads. If you want to stop it, the check has to be on the class as a whole — a rule
like *setup may not exceed the longest test in the file* is arbitrary but it is at least
enforceable.

**★ Data set in a setup block is read as a claim that the data matters — even when it does not.**
Tests are the only documentation that is guaranteed to be true, so readers grant them
authority they do not grant comments. Setting `marketingOptIn(false)` in a discount test
tells the next person that opt-in affects discounts. They will not ask you; they will
assume it, and possibly preserve it in a refactor they otherwise would have simplified.

**★ Deleting a field from a shared setup is a breaking change with no compiler support.**
Adding is safe, removing is not — you cannot tell from the block which of the ten tests
below reads `loyaltyTier`, and the compiler will not tell you either, because they all
just call `policy.discountFor(order)`. This asymmetry is the entire mechanism of the
ratchet: safe in one direction, risky in the other, so the block only moves one way.

**★ `@BeforeEach` failures report as N broken tests, not one broken setup.**
A CI dashboard showing twelve red tests in one class almost always means one broken line
of shared setup. Read the stack traces before triaging: if they are identical and none of
the frames is in a test method, you have one bug. Teams that do not know this routinely
open a ticket per failing test.

**★ The forty-line block is usually a symptom of a constructor or an entity, not of the test.**
If `Customer` cannot be created without eleven fields, every test that needs a customer
pays for eleven fields. The test-side patterns here hide that cost; they do not remove it.
When the same block appears in fifty test classes, the honest read is that the domain type
has no small valid state, and that is a production design finding surfaced by tests.

**★ Copy-pasting the setup into a new test class doubles the maintenance cost invisibly.**
Nobody notices that the same forty lines now exist in nine files until a field is renamed
and nine files need editing. Grep for a distinctive literal — `"42 Sample Street"`,
`"4242"` — before assuming a setup block is local to one class. The literal is usually the
fastest way to find every copy.

**★ The block is where `null` gets normalised into the domain.**
Half of a long setup usually exists to stop a `NullPointerException` somewhere three calls
deep, not because the test needs the value. That means the setup is quietly documenting
which fields production code dereferences without checking — and the moment a new
dereference is added, every test class in the codebase needs another line. If adding a
field to a domain object forces edits across the test suite, the field is not optional in
practice and probably should not be nullable in the type.

**★ A setup that builds a graph is also asserting that the graph is legal, and nothing checks that.**
`customer.setBillingAddress(address); customer.setShippingAddress(address);` puts the *same*
`Address` instance in two places. If any production path mutates one of them, the test sees
both change and the aliasing is invisible in the source. Shared sub-objects inside a fixture
graph are a genuine source of tests that pass for the wrong reason.

## Interview questions

**★ What is actually wrong with a long `@BeforeEach`? Is it not just DRY?**
DRY is about knowledge, not keystrokes. A shared setup block deduplicates *typing* while
coupling every test in the class to one arrangement of data, and it removes from each test
the only thing a reader needs: which values this particular assertion depends on. The
concrete costs are four and they are separable — the relevant field becomes invisible;
changing a default breaks tests that never mentioned it; irrelevant data reads as relevant;
and the block only ever grows, because adding is safe and deleting is not. A builder gets
you the deduplication without any of the four, because the defaults live outside the test
and the test names only its own variable.

**★ Does `@TestInstance(PER_CLASS)` help with this?**
No, and it can hurt. `PER_CLASS` changes instance ownership — one instance for the whole
class, so `@BeforeAll` need not be static — but `@BeforeEach` still runs before every test,
so the setup cost is unchanged. What does change is that fields now persist across test
methods, so any mutation one test makes is visible to the next, which converts a
comprehension problem into an order-dependence problem. Use `PER_CLASS` when you have a
genuine reason (an expensive non-static `@BeforeAll`, or `@MethodSource` factories that
want to be instance methods), not as a fix for setup size.

**★ When is a big setup block the right answer?**
When the arrangement genuinely *is* the subject of every test in the class — an integration
test class where all six tests exercise the same fully-populated aggregate, and the
variation between them is which method is called rather than which data is present. Even
then, prefer a single named call (`order = anOrderWithThreeLines()`) so the *name* carries
the arrangement and the reader is not required to infer it from forty setters. The rule is
not "setup must be short", it is "a reader must be able to see what this test depends on".

**★ Your team's tests keep failing in CI but pass locally, and the failures move between classes on each run. Where do you look first?**
Shared mutable fixtures, in this order: `static` fields holding domain objects, a
`PER_CLASS` test instance whose fields carry state between methods, and a database whose
rows one test leaves behind for another to find. All three produce order-dependent
failures, and CI differs from a laptop precisely in execution order and parallelism. The
fastest confirmation is to run the suite with a different, deterministic order — JUnit's
class and method orderers exist for this — and see whether the failure follows the order
rather than the code.

**★ A reviewer asks you to justify the assertion `isEqualTo(Money.gbp("9.00"))` in the test at the top of this page. What is the honest answer?**
That you cannot justify it from the test alone, which is the finding. The number depends on
two facts — the tier is `GOLD` and the lines total 90 — that appear thirty lines apart in a
block the test does not reference. A test whose expected value cannot be derived from what
is visible in the test method is a test that will be *changed to match* the next time it
fails, rather than investigated. That is the failure mode worth naming in review: not
ugliness, but that the test has lost the ability to be wrong in a way anyone would notice.

{/* FOOTER */}
