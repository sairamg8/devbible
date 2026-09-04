---
title: "Mocking a value object is the one rule in this topic with no exception case at all, because the reason anyone reaches for it is always the same — the constructor is painful — and that is a request for a builder, not for a mock that quietly bypasses every invariant the type exists to enforce"
sidebar_label: "10g · Mocking value objects"
sidebar_position: 47
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-28 against the Mockito wiki
> [How to write good tests](https://github.com/mockito/mockito/wiki/How-to-write-good-tests)
> (*"Don't mock value objects"* and *"Don't mock everything, it's an anti-pattern"*), the
> **Mockito 5.23.0** sources on GitHub (tag `v5.23.0`) — the `Reporter` message text naming
> the methods that cannot be stubbed or verified — and section 39 (*"Mocking final types,
> enums and final methods"*) of
> [`Mockito`](https://github.com/mockito/mockito/blob/v5.23.0/mockito-core/src/main/java/org/mockito/Mockito.java).
> Version spine from `spring-boot-dependencies:4.1.1`: JDK 25, Spring Boot 4.1.1,
> **Mockito 5.23.0**, JUnit Jupiter 6.0.3. **No sandbox** — this page carries Java source,
> never a fabricated test run.

**[10b](10b-do-not-mock-types-you-do-not-own.md) and
[10f](10f-mocking-jdk-types.md) are about types you do not own. This one inverts that: a value
object is as owned as code gets, and mocking it is still always wrong — not as a style
preference but because the mock is an instance of the type with the type's defining behaviour
removed. Mockito's wiki spends four lines on it and one of them is the whole argument: the
reason people give is that instantiating the real thing is too painful, and *"not a valid
reason"* is the answer.**

## Value objects — the rule with no exceptions

The wiki is at its shortest here, which is telling:

> *"**Don't mock value objects.** Why one would even want to do that? … *Because instantiating
> the object is too painful !?* => not a valid reason."*

A value object has no collaborators, no I/O and no behaviour worth substituting. Mocking one
replaces data with fiction:

```java
// Wrong, and quietly so
Order order = mock(Order.class);
when(order.total()).thenReturn(Money.of("42.50"));
when(order.lines()).thenReturn(List.of());          // a total of 42.50 with no lines
```

That object cannot exist. Any invariant `Order` enforces in its constructor — that the total
equals the sum of the lines, that an order has at least one line — is bypassed, and the test
now proves the service works for orders the domain forbids. Worse, `order.equals(otherOrder)`
is unstubbable, so any assertion involving equality behaves by identity instead of by value.

The wiki's answer to the "too painful" objection is the one to actually implement:

> *"If it's too difficult to create new fixtures, it is a sign the code may need some serious
> refactoring. An alternative is to create builders for your value objects -- there are tools
> for that, including IDE plugins, Lombok, and others. One can also create meaningful factory
> methods in the test classpath."*

with its own example:

```java
final class CustomerCreations {
   private CustomerCreations() {}
   public static Customer customer_with_a_single_item_in_the_basket() {
	   // long init sequence
   }
}
```

That is an object mother, and the builder variant is the other half of the same technique.
Both belong to **08 · Test data patterns** *(not written yet)*; the point here is that "the
constructor is painful" is a request for a builder, never for a mock.

**Records make this sharper, not softer.** Mockito 5 can mock a record — it is a final class,
and the inline maker handles final classes. It is still a value object, and mocking it still
produces an instance whose `equals`, `hashCode` and `toString` are Mockito's rather than the
record's, which is the entire contract a record exists to provide.

## What to write instead, in code

Two techniques cover every case, and both are cheaper per test than a mock once there is more
than one test.

**A test data builder** — one class, defaults for everything, overrides for the one field the
test cares about:

```java
public final class OrderBuilder {
    private OrderId id = OrderId.of("ORD-1");
    private Customer customer = CustomerBuilder.aCustomer().build();
    private List<OrderLine> lines = List.of(new OrderLine(Sku.of("SKU-1"), 1, Money.of("9.99")));

    public static OrderBuilder anOrder()                { return new OrderBuilder(); }
    public OrderBuilder withCustomer(Customer c)        { this.customer = c;   return this; }
    public OrderBuilder withLines(OrderLine... l)       { this.lines = List.of(l); return this; }
    public Order build()                                { return new Order(id, customer, lines); }
}
```

```java
// The test names only what it cares about; everything else is a valid default.
Order order = anOrder().withCustomer(aCustomer().inTier(GOLD).build()).build();
```

**An object mother** — named, meaningful whole objects, which is the form Mockito's own wiki
shows:

```java
final class CustomerCreations {
   private CustomerCreations() {}
   public static Customer customer_with_a_single_item_in_the_basket() { /* … */ }
   public static Customer customer_whose_card_has_expired()           { /* … */ }
}
```

The two compose: the mother calls the builder. Which one to reach for, and how to stop either
from becoming a second domain model, is **08 · Test data patterns** *(not written yet)*.

The decisive property of both is that **they go through the real constructor**, so every object
a test uses is one the domain can actually produce. That is the property a mock destroys, and
it is why a builder written once removes the temptation permanently.

## Enums are value objects with a smaller state space

An enum constant is the most value-like thing Java has, and mocking one is the same mistake
with extra machinery. Mockito 5.22.0 added `mockSingleton(MyEnum.A)` for singletons *"for which
you don't control initialization, assignment, or access"* — which is a narrow legacy affordance,
not an invitation. If a test needs an enum to behave differently, the behaviour belongs in a
collaborator that takes the enum as input, not in the enum's mocked method. The API itself is
covered in [11d · Final, enums and the unmockable](11d-final-enums-and-the-unmockable.md).

Note also that section 39 says mocking enums is *"incompatible with mock settings like"*
`withSettings().serializable()` and `withSettings().extraInterfaces()`, and that abstract enums
(any enum with a constant-specific body, sealed since Java 15) cannot be mocked at all — the
source's own message is *"Sealed abstract enums can't be mocked. Since Java 15 abstract enums
are declared sealed, which prevents mocking. You can still return an existing enum literal from
a stubbed method call."* That last sentence is the advice: return the literal.

## The general form of the rule

> *"**Don't mock everything, it's an anti-pattern.** If everything is mocked, are we really
> testing the production code? Don't hesitate to **not** mock!"*

Read together with everything above, the decision reduces to two questions:

1. **Does this type have collaborators or I/O that make it non-deterministic?** If not, use the
   real one. Value objects, enums, collections, `Optional`, pure functions — all real.
2. **Do I define its contract?** If not, and it does have I/O, put an adapter in front of it
   ([10e](10e-the-anti-corruption-adapter.md)) and mock the adapter.

Everything the topic argues about mocking falls out of those two.

## Gotchas

**★ Mocking a value object and then asserting on equality.**
`equals` and `hashCode` cannot be stubbed — Mockito's own error text says so — so
`assertThat(result).isEqualTo(mockedOrder)` compares identity. The assertion passes or fails
for a reason unrelated to the values, and the failure message is unreadable.

**★ Mocking a record because it is final and Mockito 5 can.**
The inline mock maker will do it. What you get is an object with Mockito's `equals`,
`hashCode` and `toString` instead of the record's — that is, without the only three methods
the record was declared to obtain.

**★ Mocking an entity to bypass its constructor invariants.**
The invariants are the design. A mocked `Order` with a total that does not match its lines
tests the service against an order the domain cannot produce, so a green test says nothing
about production traffic. If the constructor is genuinely awkward, that is a builder request.

**★ Reaching for `mock(...)` because a test needs six fields set.**
The wiki's response is *"not a valid reason"*, and the concrete alternative is an object mother
or a builder in the test classpath. Six mocked getters is also six lines that must change
whenever the type does; a builder is one.


## Interview questions

**★ Why is mocking a value object always wrong?**
Because a value object is its data and its `equals`. Mocking it bypasses the constructor
invariants, so the test exercises states the domain forbids, and `equals`/`hashCode` cannot be
stubbed at all — Mockito's error text lists them among the methods that *"cannot be
stubbed/verified"* — so every value comparison in the test degrades to identity.

**★ Someone says the value object is too painful to construct. What do you offer?**
A builder or an object mother in the test classpath. The Mockito wiki calls the difficulty a
signal — *"If it's too difficult to create new fixtures, it is a sign the code may need some
serious refactoring"* — and names both remedies, including a static factory class of
meaningfully-named creations. The construction cost is paid once; a mock is paid in every test
that then encodes an impossible object.

**★ Can you mock a record?**
Technically yes, since the inline mock maker handles final classes. Doing so replaces the
record's `equals`, `hashCode` and `toString` with Mockito's, which is the entire set of
behaviour a record exists to give you, so the mock is a record with the record removed.

**★ Should an enum ever be mocked?**
No. An enum constant is a value, and Mockito's `mockSingleton` — added in 5.22.0 for singletons
*"for which you don't control initialization, assignment, or access"* — is a legacy affordance
for objects you cannot inject, not a general technique. If different behaviour is needed per
constant, put it in a collaborator that takes the enum as input. And enums with
constant-specific bodies are sealed abstract classes since Java 15 and cannot be mocked at all;
Mockito's own message says to *"return an existing enum literal from a stubbed method call"*
instead.

**★ How does a test data builder actually save effort compared with a mock?**
A mock of a value object costs one stubbing per field per test, and every one of them has to be
revisited when the type changes. A builder costs one class, has valid defaults for every field,
and lets each test name only the field it is about. It also constructs through the real
constructor, so no test can accidentally use an object the domain forbids — which is a
correctness property, not just an ergonomic one.

**★ Give the one-sentence rule that covers this whole page.**
If the type is deterministic and has no I/O, use the real one; if it is not deterministic and
you do not define its contract, put an adapter in front of it and mock the adapter. Mocking is
for boundaries you own, not for data and not for the standard library.


{/* FOOTER */}
