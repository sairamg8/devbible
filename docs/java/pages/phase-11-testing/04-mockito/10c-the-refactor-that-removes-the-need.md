---
title: "Every reason anyone gives for spying the class under test — and most of the reasons for mocking a library type — dissolve under the same one-line refactor: the thing you wanted to stub becomes a type, the type becomes a constructor parameter, and the stub moves one object outward"
sidebar_label: "10c · The refactor that removes the need"
sidebar_position: 52
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-28 against the **Mockito 5.23.0** sources on GitHub (tag `v5.23.0`) —
> the class javadoc of
> [`Mockito`](https://github.com/mockito/mockito/blob/v5.23.0/mockito-core/src/main/java/org/mockito/Mockito.java)
> section 16 (*"Real partial mocks"*) and the
> [`@InjectMocks`](https://github.com/mockito/mockito/blob/v5.23.0/mockito-core/src/main/java/org/mockito/InjectMocks.java)
> javadoc (the three injection strategies), and the Mockito wiki
> [How to write good tests](https://github.com/mockito/mockito/wiki/How-to-write-good-tests).
> Version spine from `spring-boot-dependencies:4.1.0`: JDK 25, Spring Boot 4.1.0,
> **Mockito 5.23.0**, JUnit Jupiter 6.0.3. **No sandbox** — this page carries Java source,
> never a fabricated test run.

**[10](10-never-mock-the-class-under-test.md) is the diagnosis and
[10b](10b-do-not-mock-types-you-do-not-own.md) is its sibling diagnosis; this is the single
cure that serves both. Both defects have the same root — something the code under test needs
is *inside* it rather than *beside* it, so the only lever the test can reach is a partial mock
or a mock of a library class. Extract it into a collaborator and the lever becomes an ordinary
constructor parameter. This page shows the move in full, before and after, including the test
that could not exist before the refactor and is the actual point of doing it.**

## The move, in full

The whole problem is `computeTotal` living on `OrderService`. Move it.

**Before** — one class, two responsibilities, and a test that has to spy:

```java
public class OrderService {
    private final OrderRepository repository;
    private final PaymentGateway gateway;
    private final Notifier notifier;

    public Receipt confirm(OrderId id) {
        Order order = repository.findById(id).orElseThrow();
        Money total = computeTotal(order);
        gateway.charge(order.customer(), total);
        notifier.orderConfirmed(order, total);
        return new Receipt(id, total);
    }

    public Money computeTotal(Order order) { /* tiers, discounts, tax */ }
}
```

```java
// Before — the only way to control the total is to stub the SUT
@Test
void confirming_charges_the_total() {
    OrderService service = spy(new OrderService(repository, gateway, notifier));
    when(repository.findById(ORDER_ID)).thenReturn(Optional.of(order));
    doReturn(Money.of("42.50")).when(service).computeTotal(order);

    service.confirm(ORDER_ID);

    verify(gateway).charge(order.customer(), Money.of("42.50"));
}
```

**After** — the responsibility becomes a role, and the role becomes a constructor parameter:

```java
public interface PricingPolicy {
    Money totalFor(Order order);
}

public class TieredPricingPolicy implements PricingPolicy {
    @Override public Money totalFor(Order order) { /* tiers, discounts, tax */ }
}

public class OrderService {
    private final OrderRepository repository;
    private final PricingPolicy pricing;          // <- was a method on this class
    private final PaymentGateway gateway;
    private final Notifier notifier;

    public OrderService(OrderRepository repository, PricingPolicy pricing,
                        PaymentGateway gateway, Notifier notifier) { /* assign */ }

    public Receipt confirm(OrderId id) {
        Order order = repository.findById(id).orElseThrow();
        Money total = pricing.totalFor(order);
        gateway.charge(order.customer(), total);
        notifier.orderConfirmed(order, total);
        return new Receipt(id, total);
    }
}
```

```java
// After — no spy, and the SUT is entirely production code
@ExtendWith(MockitoExtension.class)
class OrderServiceTest {
    @Mock OrderRepository repository;
    @Mock PricingPolicy   pricing;
    @Mock PaymentGateway  gateway;
    @Mock Notifier        notifier;
    @InjectMocks OrderService service;

    @Test
    void confirming_charges_the_total_from_the_pricing_policy() {
        when(repository.findById(ORDER_ID)).thenReturn(Optional.of(order));
        when(pricing.totalFor(order)).thenReturn(Money.of("42.50"));

        service.confirm(ORDER_ID);

        verify(gateway).charge(order.customer(), Money.of("42.50"));
    }
}
```

```java
// And the extracted responsibility gets the test it never had — with no doubles at all
class TieredPricingPolicyTest {
    private final PricingPolicy pricing = new TieredPricingPolicy();

    @Test
    void gold_tier_takes_ten_percent_off_before_tax() {
        Money total = pricing.totalFor(orderFor(GOLD, line("19.99", 2)));
        assertThat(total).isEqualTo(Money.of("38.98"));
    }
}
```

Count what changed. The `@Spy` is gone; the stub moved from the SUT to a collaborator; the
`42.50` in the test now describes a *contract with another object* rather than a hole in this
one; and the pricing rules — previously untested in either file — got a test with no mocks in
it, which is the cheapest and most durable test in the codebase. That last file is the real
payoff, and it is the file that could not exist before.

**The refactor is always the same move:** the thing you wanted to stub becomes a type, the
type becomes a constructor parameter, and the stub moves one object outward. If you have
[09 · @InjectMocks](09-injectmocks.md) reading as noise, note that constructor injection is
what made the `@InjectMocks` above unambiguous too.

## The same move, applied outward

Everything above turns a *self-call* into a collaborator. Point the identical move outward and
it turns a *library call* into one: the third-party client the SUT talks to directly becomes an
interface you own, and the mock in the test is a mock of your interface rather than of someone
else's API. That is the whole argument of
[10b · Do not mock types you do not own](10b-do-not-mock-types-you-do-not-own.md), and the
before/after for it is written out there. The shape is the same — a responsibility welded into
the class becomes a named type, the type becomes a constructor parameter — only the direction
of the seam changes.

## What to extract into

The extracted type should be named after the **role**, not after the implementation.
`PricingPolicy`, not `TaxAndDiscountCalculator`; `ExchangeRates`, not
`HttpExchangeRateClient`. The role name is the one the SUT reads best with, and it is the one
that survives when the implementation is replaced.

Three practical rules:

- **One reason to change per extracted type.** If the extraction still has two methods that
  nothing calls together, you have moved the problem rather than solved it.
- **The extracted type is an interface only if you need substitutability**, which — for a
  role you intend to mock — you do. A `final class` with one public method is a perfectly good
  extraction when the test uses the real one, and Mockito 5 can mock it anyway; but an
  interface documents that substitution is intended.
- **The extracted implementation gets its own test, with no doubles in it.** That test is the
  deliverable. If the refactor does not produce one, nothing was actually gained: you moved a
  stub from one object to another and left the logic untested in both.

## Constructor injection is what makes the after-picture work

The `@InjectMocks` javadoc lists three strategies in order — constructor, property setter,
field — and the first one has a property the other two do not:

> *"**Constructor injection**; the biggest constructor is chosen, then arguments are resolved
> with mocks declared in the test only. If the object is successfully created with the
> constructor, then **Mockito won't try the other strategies**."*

A SUT with a single explicit constructor cannot be half-wired. Field injection can, and it
does so silently, because *"If any of the following strategy fail, then Mockito **won't report
failure**"*. That is the same silence that made the spy in
[10](10-never-mock-the-class-under-test.md) so hard to see. The mechanics of all three
strategies are [09 · @InjectMocks](09-injectmocks.md); the design point here is that
extracting a collaborator only pays off if the collaborator arrives through the constructor.

And once it does, `@InjectMocks` itself becomes optional — `new OrderService(repository,
pricing, gateway, notifier)` in the test is four more words and zero reflection.

## Gotchas

**★ "The method is slow, so I stubbed it" is a description of a design problem.**
A slow method on the SUT is doing I/O, sleeping, or computing something large. All three are
responsibilities that belong to a collaborator you can substitute — which is this refactor,
arrived at from a different direction.

**★ Extracting the collaborator but keeping the old method as a delegating wrapper.**
`public Money computeTotal(Order o) { return pricing.totalFor(o); }` left on `OrderService`
means the spy-based tests still compile and still stub the SUT. The wrapper has to go, or the
refactor bought nothing but a second name for the same trap.

**★ Extracting the type but never writing its test.**
The refactor's whole return on investment is `TieredPricingPolicyTest` — a fast test with no
doubles that covers the rules nothing covered before. Extract without writing it and you have
performed a rename: the pricing logic is still untested, and now it is untested in a file
nobody is looking at.

**★ Extracting a "collaborator" that takes the SUT as a parameter.**
`pricing.totalFor(order, orderService)` is not an extraction; it is the same object split
across two files with a circular reference. If the extracted method needs the SUT, you split
on the wrong seam — cut where the data flows one way.

**★ One interface per method, mechanically.**
The opposite failure. Extracting `TotalComputer`, `DiscountApplier` and `TaxAdder` because
each was a private method produces three types that are always used together and a test that
mocks all three. The seam is where a *responsibility* ends, not where a method does.

**★ Making the extracted type `static` to avoid the constructor parameter.**
`PricingPolicy.totalFor(order)` as a static utility is the refactor undone: the SUT now has an
undeclared dependency that no test can substitute, and the only lever left is
[11 · Static and final](11-static-and-final.md). If you moved the code to another class but
not to another *object*, nothing was injected.

**★ Extracting to a package-private class and then discovering the test cannot see it.**
Not a real obstacle — the test lives in the same package — but it becomes one the moment the
extracted type needs to be used from another package, and the reflex fix is to widen
visibility rather than to move the class. Decide the package by where the role belongs, not by
where the test happens to sit.

**★ Adding the parameter to the constructor but reading a field set elsewhere.**
A half-done extraction where `pricing` is a constructor parameter *and* `computeTotal` is
still called in one branch is worse than either state: the test now has a mock that is
sometimes bypassed, and the bypass is invisible unless strict stubbing happens to flag the
unused stub. See [07 · Strictness](07-strictness.md).

## Interview questions

**★ A colleague says they had to spy the SUT because one method is slow. What do you say?**
That the slowness is the finding. A method slow enough to need stubbing is doing I/O, waiting,
or heavy computation — all of which are collaborator responsibilities. Extract it to a type,
inject the type, mock the type. The test then stubs a collaborator instead of the subject, and
the extracted class gets its own fast, double-free test.

**★ What is the tell that a class has two responsibilities?**
That one of its methods is a method you want to stub. Wanting to stub a method means the rest
of the class only consumes its result — which is the relationship you have with a
collaborator, not with your own internals. Mockito's wiki puts the same idea as *"In OO you
want objects (or roles) to collaborate, not methods."*

**★ Walk me through the extract-a-collaborator refactor.**
Take the method the test wants to stub. Give its responsibility a role name and declare that
as a type. Move the method body into an implementation of that type. Add the type as a
constructor parameter of the original class and replace the self-call with a call on the
parameter. Delete the old method — do not leave a delegating wrapper. Then write a test for
the new implementation with no test doubles in it. The original test loses its `@Spy` and
gains an ordinary `@Mock`; the new test is the part that did not exist before.

**★ How do you know you cut on the right seam?**
Data flows one way across it. The extracted type takes values in and returns a value out, and
it never needs a reference back to the class it came from. If the extraction wants the
original object as a parameter, the seam was wrong.

**★ Should the extracted collaborator be an interface?**
If the test is going to substitute it, yes — an interface states that substitution is
intended, and it is the cheapest thing Mockito can mock (the proxy mock maker can handle it
with no code generation at all, per section 50 of the class javadoc). If the test uses the
real implementation, a class is fine; Mockito 5 mocks final classes anyway, so "mockability"
is no longer the deciding argument it was.

**★ Why does this refactor make `@InjectMocks` less risky rather than more?**
Because it pushes the dependency into the constructor, and constructor injection is the one
strategy that cannot half-succeed: *"If the object is successfully created with the
constructor, then Mockito won't try the other strategies."* Field and setter injection fail
silently — the javadoc says Mockito *"won't report failure"* — and a silently unwired
dependency is a `NullPointerException` some tests away from where it was introduced.

**★ You extracted the collaborator and the test suite got slower. What went wrong?**
Almost certainly nothing to do with the extraction: the new implementation test is doing real
work the old suite never did, because the old suite stubbed that work out. That is the cost of
actually testing the logic, and it is the point. If the *original* test got slower, check that
you replaced the self-call rather than adding a second path to it.

{/* FOOTER */}
