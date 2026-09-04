---
title: "A surviving returns mutant says the method's entire result is unconstrained, and which of the five survived names the missing assertion precisely — an EMPTY_RETURNS survivor is a list nobody looked inside, and exactly one of the TRUE/FALSE pair surviving means the predicate is asserted in one direction only"
sidebar_label: "03c2 · Reading a returns survivor"
sidebar_position: 12
---

<span className="db-tier t-when">When Needed</span>

> Verified: 2026-08-31 against pitest's
> [Mutation operators](https://pitest.org/quickstart/mutators/) page — the *Empty returns*,
> *False returns*, *True returns*, *Null returns* and *Primitive returns* sections — and pitest
> 1.30.0 source at the `1.30.0` tag (`mutators/returns/`,
> `build/intercept/equivalent/EmptyReturnsFilter.java`). Assertion APIs from the **AssertJ 3.27.7**
> javadoc as managed by Spring Boot 4.1.1.
> Version spine from `spring-boot-dependencies:4.1.1`: JDK 25, Spring Boot 4.1.1, Spring Framework
> 7.0.8, JUnit Jupiter 6.0.3, Mockito 5.23.0, AssertJ 3.27.7.
> ⚠️ **No sandbox and no build on this machine.** Mutator behaviour is quoted from pitest's docs and
> read from its source; the Java on this page is illustrative source, never a run.

**[03c](03c-the-returns-mutators.md) established which of the five returns operators fires on which
method. This chunk is the payoff: what it means when one of them lives. A surviving returns mutant is
the bluntest finding pitest produces — the method can be replaced by a constant and your suite stays
green — and unlike most static findings it names the missing assertion almost exactly. Reading which
operator survived, and in the boolean case reading *which one of a pair* survived, is the difference
between "write a better test for this" and "add a case for the ineligible customer".**

## `EMPTY_RETURNS` survived — nobody looked inside the collection

A method that computes a collection, string or `Optional` can return nothing at all and no test
notices. This is the highest-value survivor in the group, because "returns empty" is the exact shape
of a real production bug — a filter predicate inverted, a join that matched nothing, a repository
query with the wrong parameter bound.

```java
// Does not kill it: an empty list is not null and contains no nulls.
assertThat(service.overdueInvoices(today)).isNotNull().doesNotContainNull();

// Also does not kill it: an empty list satisfies "all elements are overdue" vacuously.
assertThat(service.overdueInvoices(today)).allMatch(Invoice::isOverdue);

// Kills it: the assertion names what should be in the list.
assertThat(service.overdueInvoices(today))
    .extracting(Invoice::reference)
    .containsExactly("INV-1001", "INV-1004");
```

🔴 **The second line above is the one that catches people out.** Every `allMatch`, `allSatisfy`,
`filteredOn(...).allMatch` and `noneMatch` assertion is trivially true of the empty collection. A
test suite built out of universally-quantified assertions has a systematic `EMPTY_RETURNS` blind
spot, and mutation testing is the only tool that will point at it — the code is covered, the
assertions look strong, and they constrain nothing about size. The remedy is one extra assertion:

```java
assertThat(service.overdueInvoices(today))
    .hasSize(2)                         // this is what kills the mutant
    .allMatch(Invoice::isOverdue);      // this is what you wanted to say
```

For `Optional`, the same shape:

```java
// Does not kill it: orElse(Money.ZERO) hides the difference when the expected value is ZERO.
assertThat(service.discountFor(order).orElse(Money.ZERO)).isEqualTo(Money.ZERO);

// Kills it: the value must be present AND equal.
assertThat(service.discountFor(order)).contains(Money.gbp("5.00"));
```

An `EMPTY_RETURNS` survivor on an `Optional`-returning method usually means the only test is the
*absent* case. That mutant is genuinely equivalent for the absent input, so no amount of
strengthening that test kills it; you need a test where the value is present.

## `NULL_RETURNS` survived — the result is never touched

The mutant makes a reference result `null`. It dies the moment anything dereferences it, so a
survivor means one of two things: nothing in the covering tests uses the returned object at all, or
the only use goes through a helper that tolerates `null`.

```java
// Survives: the return value is discarded; the test asserts on a side effect instead.
@Test
void loadsTheCustomer() {
    service.load(CUSTOMER_ID);
    verify(auditTrail).recordAccess(CUSTOMER_ID);
}

// Kills it: the returned object is asserted on.
@Test
void loadsTheCustomer() {
    assertThat(service.load(CUSTOMER_ID))
        .extracting(Customer::reference)
        .isEqualTo("CUST-77");
}
```

This is the easiest of the five to kill and therefore the most damning when it survives. On a method
that returns something, a `NULL_RETURNS` survivor is close to a proof that the return value is not
part of what the test checks.

Watch for the helper case, which is subtler:

```java
private static String referenceOf(Customer c) {
    return c == null ? "" : c.reference();       // null-tolerant helper hides the mutant
}
```

A test-support method written defensively will absorb the mutant and keep the assertion green. That
is a good reason for test helpers to be as strict as production code.

## `TRUE_RETURNS` and `FALSE_RETURNS` — read the pair, not the entry

A predicate's answer is not asserted. The classic case is an `isEligible`/`canX` method covered only
through a caller tested for its happy path:

```java
// Kills neither mutant — the boolean is used, never asserted.
@Test
void placesTheOrder() {
    service.place(anOrder());
    verify(orderRepository).save(any());
}
```

```java
// Kills both: the two answers are pinned to opposite inputs.
@Test
void eligibleWhenBalanceCoversTheOrder() {
    assertThat(policy.isEligible(customerWithBalance("100.00"), orderTotalling("40.00"))).isTrue();
}

@Test
void notEligibleWhenBalanceIsShort() {
    assertThat(policy.isEligible(customerWithBalance("10.00"), orderTotalling("40.00"))).isFalse();
}
```

🔴 **You need both directions, and the report tells you which one you are missing.** A test asserting
`isTrue()` kills `FALSE_RETURNS` and leaves `TRUE_RETURNS` alive; a test asserting `isFalse()` does
the reverse. So:

| What you see | What it means | What to write |
|---|---|---|
| Both killed | The predicate is asserted in both directions | Nothing |
| `TRUE_RETURNS` survived, `FALSE_RETURNS` killed | Only the `true` case is asserted | A test for the `false` case |
| `FALSE_RETURNS` survived, `TRUE_RETURNS` killed | Only the `false` case is asserted | A test for the `true` case |
| Both survived | The predicate's answer is never asserted at all | Both |

That is a strictly more precise diagnostic than branch coverage, which shows both branches taken as
soon as any caller exercises them, and says nothing about whether the answer was checked.

## `PRIMITIVE_RETURNS` survived — the number is not pinned

A numeric result can become `0` and nothing fails. The usual cause is the weak-assertion family from
[03b](03b-arithmetic-mutators.md) — `isNotNull`, `isGreaterThanOrEqualTo(0)`, `isCloseTo` with a
tolerance wider than the value itself.

```java
// Survives: 0 is a non-negative int.
assertThat(basket.itemCount()).isNotNegative();

// Kills it.
assertThat(basket.itemCount()).isEqualTo(3);
```

⚠️ **If the expected value genuinely is zero, the mutant is equivalent and cannot be killed.** An
empty basket's `itemCount()` is `0` with or without the mutant. Pitest filters the *hard-coded*
`return 0` case, not the case where your fixture makes the computed value zero. The fix is a fixture
that is not degenerate, which is the same advice as for `MATH` and for the same reason — see
[04b · Equivalent mutants](04b-equivalent-mutants.md) for when to stop trying.

## Where this connects

- **[03c · The returns mutators](03c-the-returns-mutators.md)** — which operator fires where, the
  fourteen-entry table, and the `@NotNull` suppression.
- **[03b · Arithmetic mutators](03b-arithmetic-mutators.md)** — the weak-assertion family that
  produces `PRIMITIVE_RETURNS` survivors is the same one that produces `MATH` survivors.
- **[02 · AssertJ](../02-assertj/README.md)** — `containsExactly`, `hasSize`, `singleElement`,
  `extracting` and `contains` on `Optional` are the instruments that turn these survivors into kills.
- **[03 · Parameterized tests](../03-parameterized-tests/README.md)** — the two-row table that kills
  a `TRUE_RETURNS`/`FALSE_RETURNS` pair is a parameterised test wanting to happen.
- **[04b · Equivalent mutants](04b-equivalent-mutants.md)** — the returns survivors you should stop
  trying to kill.

## Gotchas

**★ Every `allMatch`/`allSatisfy`/`noneMatch` assertion is vacuously true of an empty collection.**
Universally-quantified assertions cannot kill an `EMPTY_RETURNS` mutant, no matter how strong the
predicate inside them is. A suite written mostly in that style has a systematic blind spot on every
collection-returning method. Pair every one of them with a `hasSize`, `isNotEmpty` or
`containsExactly`.

**★ `assertThat(optional.orElse(default))` cannot kill an `EMPTY_RETURNS` mutant when the expected value equals the default.**
`orElse` erases exactly the distinction the mutant introduces. Assert on the `Optional` itself —
`contains(...)`, `hasValueSatisfying(...)`, `isPresent()` — rather than unwrapping it and then
asserting.

**★ Exactly one of `TRUE_RETURNS`/`FALSE_RETURNS` surviving is a finding, not a rounding error.**
It names which case you have not tested. Two survivors means the predicate is not asserted at all.
This is one of the few places a mutation report tells you the specific test to write rather than the
area to look at.

**★ `PRIMITIVE_RETURNS` is equivalent whenever the expected value is zero.**
`return 0;`'s mutant is `return 0;`. An empty basket, a customer with no orders, a discount of zero —
all of them make the mutant indistinguishable. This is not a missing assertion and no assertion will
fix it; it is a fixture whose values do not discriminate. Change the fixture or accept the survivor.

**★ Null-tolerant test helpers absorb `NULL_RETURNS` mutants.**
A private helper in the test class that returns a default when handed `null` will keep the assertion
green while the production method returns nothing. Test-support code written defensively costs you
measurement. Let it throw.

**★ A returns survivor on a method whose result the test discards is not a test-strength finding — it is a test-target finding.**
If the covering tests never use the return value, the method is being exercised as a side effect of
testing something else. The action is not "strengthen that test"; it is "this method has no test of
its own". Mutation testing distinguishes those two situations and coverage does not.

**★ A method with several `return` statements produces one mutant per return, and they are not equivalent to each other.**
Killing the mutant on the early-exit `return Optional.empty()` says nothing about the one on the
main path. On a method with three returns you will see three entries on three different lines, and a
report that shows two killed and one survived is telling you exactly which path is unasserted.

## Interview questions

**★ Your `Optional`-returning method has an `EMPTY_RETURNS` survivor. What is the test missing?**
An assertion on the contents of the present case. The mutant replaces the returned `Optional` with
`Optional.empty()`, so anything that only checks `isNotNull()`, or that calls `orElse(default)` and
asserts on a value the default also satisfies, passes either way. The killing assertion is
`assertThat(result).contains(expected)` or `hasValueSatisfying(...)` on an input where the value
genuinely is present. If your only test is the not-found case, the mutant is equivalent for that
input and no strengthening of that test will kill it — you need a second test.

**★ You see `TRUE_RETURNS` killed and `FALSE_RETURNS` surviving on the same method. What does that tell you?**
That the method is asserted to be `true` somewhere and never asserted to be `false`. The
`FALSE_RETURNS` mutant forces it to `false`, which breaks the test asserting `true`, so that one
dies. Nothing pins the negative case, so forcing it to `true` everywhere changes nothing observable.
Concretely: there is a test for the eligible customer and none for the ineligible one. Branch
coverage would show this method fully covered, because a caller exercises both branches; the
mutation report is what distinguishes "executed" from "checked".

**★ A team's collection-returning methods are all covered by tests using `allSatisfy`, and their mutation score on those methods is poor. Diagnose it.**
`allSatisfy` and every other universally-quantified assertion is true of the empty collection, so the
`EMPTY_RETURNS` mutant survives every one of them. The tests are asserting a genuine property — each
element satisfies the invariant — but they are silent about how many elements there should be, which
is precisely the thing the mutant changes. The one-line fix is to add a cardinality assertion:
`hasSize(n)`, `isNotEmpty()`, or better `containsExactly(...)` naming the expected elements. It is a
good example of mutation testing finding a class of weakness that reviewers routinely miss, because
the tests look thorough.

**★ Which of the five returns mutators produces the weakest evidence when killed, and why does that matter?**
`NULL_RETURNS`. Its mutant makes the result `null`, which almost any use of the value detects, so a
kill only proves that something touched the result — not that the result was checked for
correctness. Since `NULL_RETURNS` is the fallback operator for every reference type not in
`EMPTY_RETURNS`'s fourteen-entry table, that includes essentially every domain type in your codebase.
So a high score on a package of domain objects is weaker evidence than the same score on a package
whose methods return `List` and `Optional`. Reading the per-mutator breakdown rather than the
headline percentage is the only way to see this.

**★ Is there anything a returns mutant can tell you that a well-written unit test could not?**
Not in principle — a test that asserts the exact expected value kills every returns mutant on that
method. In practice the value is that it audits assertions you already believed were strong. The
`allSatisfy`-on-empty case and the `orElse`-erases-the-difference case are both assertions that read
as rigorous, pass review, and constrain nothing about the thing the mutant changes. Mutation testing
is the only automated check that distinguishes an assertion that could fail from one that could not.

{/* FOOTER */}
