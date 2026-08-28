---
title: "Mockito ships a warning against its own partial-mock feature and repeats it verbatim in six javadoc entries — the reason it gives is diagnostic rather than moralistic, because a partial mock is what you need exactly when one object holds two responsibilities, and the one legitimate use of a spy that nobody warns you about is wrapping a fake to get verification"
sidebar_label: "08e · Partial mocks"
sidebar_position: 35
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-28 against the **Mockito 5.23.0** sources on GitHub (tag `v5.23.0`) —
> [`Mockito`](https://github.com/mockito/mockito/blob/v5.23.0/mockito-core/src/main/java/org/mockito/Mockito.java)
> §16 (*"Real partial mocks"*), §21 (the three annotations), §13, and the javadoc of
> `Mockito.spy(Class)`, `Mockito.doCallRealMethod`, `Mockito.CALLS_REAL_METHODS` and
> [`CallsRealMethods`](https://github.com/mockito/mockito/blob/v5.23.0/mockito-core/src/main/java/org/mockito/internal/stubbing/answers/CallsRealMethods.java).
> Version spine from `spring-boot-dependencies:4.1.0`: JDK 25, Spring Boot 4.1.0,
> **Mockito 5.23.0**, JUnit Jupiter 6.0.3. **No sandbox** — this page carries Java source and
> library source, never a fabricated test run.

**The previous four chunks are mechanics. This one is the argument, and it is Mockito's own: the
library documents partial mocks and then, in the same breath, tells you not to design code that
needs them. The warning is worth reading closely, because it is not a style preference — it is a
statement about what a partial mock proves about the object underneath it, and it comes with an
explicit list of the cases where it does not apply.**

## The three ways to make a partial mock

| Form | Object constructed? | Default for unstubbed methods |
|---|---|---|
| `spy(instance)` | by you | real |
| `spy(Class)` | by Mockito, real no-arg constructor | real |
| `mock(X.class, CALLS_REAL_METHODS)` | **no** | real |
| `mock(X.class)` + `doCallRealMethod().when(m).one()` | **no** | default value, except `one()` |

The first two are [08](08-spies.md) and [08c](08c-creating-a-spy-without-an-instance.md). The
bottom two share a defect that §16 states in a code comment:

```java
//you can create partial mock with spy() method:
List list = spy(new LinkedList());

//you can enable partial mock capabilities selectively on mocks:
Foo mock = mock(Foo.class);
//Be sure the real implementation is 'safe'.
//If real implementation throws exceptions or depends on specific state of the object then you're in trouble.
when(mock.someMethod()).thenCallRealMethod();
```

*"depends on specific state of the object"* is doing a lot of work there: a `mock(Foo.class)` has
no state at all, because no constructor ran. Every real method invoked on it executes against
`null` fields. That is why `doCallRealMethod`'s javadoc pushes you back one step:

> *"**Mockito.spy() is a recommended way of creating partial mocks.** The reason is it guarantees
> real methods are called against correctly constructed object because you're responsible for
> constructing the object passed to spy() method."*

And note that listing's own final line: `when(mock.someMethod()).thenCallRealMethod();` uses the
`when` form, which is safe **here** only because `mock(Foo.class)` is not yet a partial mock at
that point — nothing real runs. Repeat the same line against a spy and you are back in
[08d](08d-stubbing-a-spy.md).

## 🔴 The warning, verbatim, and what it actually claims

§16, in full — Mockito repeats this text on `spy(Object)`, `MockSettings.spiedInstance`,
`doCallRealMethod`, `CALLS_REAL_METHODS` and `CallsRealMethods`, with only trivial wording drift
between copies:

> *"As usual you are going to read **the partial mock warning**: Object oriented programming is
> more less tackling complexity by dividing the complexity into separate, specific, SRPy objects.
> How does partial mock fit into this paradigm? Well, it just doesn't... Partial mock usually
> means that the complexity has been moved to a different method on the same object. In most
> cases, this is not the way you want to design your application."*
>
> *"However, there are rare cases when partial mocks come handy: dealing with code you cannot
> change easily (3rd party interfaces, interim refactoring of legacy code etc.) However, I
> wouldn't use partial mocks for new, test-driven and well-designed code."*

Read the middle sentence as a **diagnosis**, not a scolding. It says something checkable: if you
need to replace method `b()` in order to test method `a()` on the same object, then `b()` is a
separate responsibility that happens to share a class with `a()`. The stub is the evidence. That
is exactly the argument [10c · The refactor that removes the need](10c-the-refactor-that-removes-the-need.md)
makes at length, and the spy is how you notice you need it.

`spy(Class)`'s javadoc adds the shortest version of the same point:

> *"Overusing spies hints at code design smells."*

And §21, on the combination that hides all of this behind two annotations:

> *"Note that @InjectMocks can also be used in combination with the @Spy annotation, it means that
> Mockito will inject mocks into the partial mock under test. **This complexity is another good
> reason why you should only use partial mocks as a last resort.** See point 16 about partial
> mocks."*

That combination — `@Spy @InjectMocks Sut sut;` — is [10](10-never-mock-the-class-under-test.md)'s
central target, and the injection half of it is [09 · @InjectMocks](09-injectmocks.md).

## What the refactor looks like when the spy is on the class under test

The shape is always the same, and it is worth seeing next to the spy it replaces:

```java
// Before: the SUT is a spy so that one of its own methods can be replaced
@Spy OrderService service = new OrderService(repository);

@Test
void confirming_charges_the_computed_total() {
    doReturn(Money.of("42.50")).when(service).computeTotal(order);   // its own method

    service.confirm(order);

    verify(repository).save(argThat(o -> o.total().equals(Money.of("42.50"))));
}
```

```java
// After: computeTotal became a collaborator, and there is no spy
class OrderService {
    private final PricingPolicy pricing;
    private final OrderRepository repository;
    OrderService(PricingPolicy pricing, OrderRepository repository) { … }
}

@Mock PricingPolicy pricing;
@Mock OrderRepository repository;

@Test
void confirming_charges_the_computed_total() {
    when(pricing.totalFor(order)).thenReturn(Money.of("42.50"));

    new OrderService(pricing, repository).confirm(order);

    verify(repository).save(argThat(o -> o.total().equals(Money.of("42.50"))));
}
```

Three things changed and only one of them is about Mockito. The `@Spy` is gone; the stub moved
from the object under test to a collaborator, so the test no longer asserts against a hybrid it
invented; and `TieredPricingPolicy` — previously reachable only through `OrderService` — becomes
directly testable with no doubles at all. That last file is the payoff and
[10c](10c-the-refactor-that-removes-the-need.md) writes it out.

## 🔴 The legitimate uses, including one nobody documents

Mockito names its own exceptions: *"code you cannot change easily (3rd party interfaces, interim
refactoring of legacy code etc.)"*. In practice that resolves to four situations, and the fourth
is not in any javadoc.

**1 · Legacy code you are actively refactoring, with the removal in the same PR.** A spy that
neutralises one I/O method so you can get a characterisation test around a 900-line class is a
scaffold. [10d · The honest exceptions](10d-the-honest-exceptions.md) is the discipline that
keeps it a scaffold: a comment naming the removal plan and the coverage hole, or it becomes
permanent.

**2 · A third-party abstract class you must extend.** `spy(SomeFrameworkBase.class)` with
`useConstructor()` when the framework's template method is the only way in, and the API is not
yours to change — [10b](10b-do-not-mock-types-you-do-not-own.md) applies to what you stub on it.

**3 · Spying an object solely to observe, stubbing nothing.** This is the classical spy from
[01b · Mock, stub, spy, fake](01b-mock-stub-spy-fake.md): real behaviour throughout, with
recording added. It carries none of §16's complaint, because nothing has been replaced. It is
still a design signal if you need it often — you are verifying an interaction you could have
asserted as an outcome — but it does not invent a hybrid object.

**4 · A spy wrapped around a fake, to get verification for free.**

```java
OrderRepository repository = spy(new InMemoryOrderRepository());

service.confirm(ORDER_ID);

assertThat(repository.findById(ORDER_ID)).map(Order::status).contains(CONFIRMED);  // outcome
verify(repository, never()).deleteById(any());                                     // interaction
```

Everything real still happens — the fake stores, reads back and enforces its own invariants, so
the sequence-of-operations bugs from [12 · Mocks vs fakes](12-mocks-vs-fakes.md) are still
caught — and you additionally get `verify` for the few assertions that genuinely are about
interactions. No method is stubbed, so §16's diagnosis does not apply: nothing has been replaced
and no hybrid exists. The cost is that the object under the spy is a copy of the fake, so keep
one reference (the spy) and never touch the original — [08](08-spies.md).

## When it is not one of the four

Then the spy is telling you the class has two responsibilities and you have found the seam. The
decision, in order:

1. **Extract the stubbed method into a collaborator** and inject it —
   [10c](10c-the-refactor-that-removes-the-need.md). Nearly always right.
2. **Test through the real method instead**, if the reason for the stub was speed rather than
   determinism, and measure before assuming it was slow.
3. **Keep the spy with a comment** naming what it stubs, why the refactor is not happening today,
   and what is consequently untested — [10d](10d-the-honest-exceptions.md).
4. **Do not** reach for `mock(X, CALLS_REAL_METHODS)` as a way to avoid the constructor. That is
   the worst of the options: a real method body executing against an object that was never
   constructed.

## Gotchas

**★ `mock(X.class, CALLS_REAL_METHODS)` on a class with state.**
No constructor ran, so every field is `null` or zero and real methods execute against an empty
object. §16: *"Be sure the real implementation is 'safe'. If real implementation throws exceptions
or depends on specific state of the object then you're in trouble."* `spy(new X(...))` is the
documented alternative.

**★ `CALLS_REAL_METHODS` on an abstract method.**
It returns the type default rather than calling anything — `CallsRealMethods.answer` checks
`Modifier.isAbstract` first. Concrete template methods then run against `null`s.
[08b](08b-what-a-spy-can-intercept.md).

**★ `@Spy @InjectMocks Sut sut;`**
Two annotations that each read as configuration and together produce a partial mock of the class
under test with mocked collaborators inside it. §21 calls the complexity *"another good reason
why you should only use partial mocks as a last resort"*.
[10](10-never-mock-the-class-under-test.md) is the full argument.

**★ Treating the partial-mock warning as an opinion you can decline.**
Its operative sentence is checkable: *"the complexity has been moved to a different method on the
same object."* If you stub `b()` to test `a()`, `b()` is a second responsibility. You can decide
not to act on that today, but it is a fact about the code, not a taste.

**★ A spy that stubs nothing, kept out of habit.**
Harmless mechanically, and a signal: you are verifying an interaction where an outcome assertion
would do. Fine on a fake (use 4 above); worth questioning on a real collaborator.

**★ Keeping a reference to the object you wrapped in a spy-over-fake.**
`InMemoryOrderRepository fake = new InMemoryOrderRepository(); var spy = spy(fake);` and then
asserting on `fake` — which is the *other* object. Assign the spy and forget the original.

**★ A `@Spy` on a legacy SUT with no comment and no removal date.**
It becomes permanent, and the coverage hole it creates is invisible to every coverage tool
because the method is "covered" by the stub. [10d](10d-the-honest-exceptions.md) is the
convention that stops this.

**★ Reaching for `CALLS_REAL_METHODS` to avoid writing a stub for each method of a large
interface.** That is a fake with extra steps and no invariants —
[12 · Mocks vs fakes](12-mocks-vs-fakes.md). Write the small implementation instead.

**★ Serialising a `CALLS_REAL_METHODS` mock.**
Note 2 of its javadoc: *"If the mock is serialized then deserialized, then this answer will not be
able to understand generics metadata."* Rare, but it is the documented limitation and there is no
workaround short of not doing it.

## Interview questions

**★ What is Mockito's own position on partial mocks, and what is the argument?**
That they do not fit object-oriented design: *"Partial mock usually means that the complexity has
been moved to a different method on the same object. In most cases, this is not the way you want
to design your application."* The argument is diagnostic — needing to replace `b()` to test `a()`
proves `b()` is a separate responsibility sharing a class with `a()`. Mockito allows the rare
case anyway: *"dealing with code you cannot change easily (3rd party interfaces, interim
refactoring of legacy code etc.)"*, and adds *"I wouldn't use partial mocks for new, test-driven
and well-designed code."*

**★ Name the ways to create a partial mock and rank them.**
`spy(instance)` — best, because you constructed the object. `spy(Class)` — good, Mockito runs the
real no-arg constructor. `mock(X, CALLS_REAL_METHODS)` and `doCallRealMethod()` on a plain mock —
worst, because no constructor ran and real code executes against `null` fields. Mockito's own
ranking is the same: *"Mockito.spy() is a recommended way of creating partial mocks… it guarantees
real methods are called against correctly constructed object."*

**★ Give a use of a spy that is not a design smell.**
Wrapping an in-memory fake: `spy(new InMemoryOrderRepository())`. Nothing is stubbed, so the real
implementation runs and the state-sequence bugs a fake catches are still caught; the spy only adds
`verify` for the assertions that genuinely are about interactions. §16's diagnosis does not apply
because no method was replaced. A pure observation spy — real behaviour, recording added — is the
same category, and it is the classical meaning of the word.

**★ Your team has a `@Spy` on the class under test that stubs one method. What do you do?**
Find out why. If the method does I/O or is non-deterministic, extract it into a collaborator and
inject it — the stub then moves one object outward and the extracted type gets its own
double-free test. If the class is legacy and the refactor is not happening this week, keep the
spy but attach a comment naming what is stubbed, why, and what is therefore untested, so the
exception cannot quietly become the rule.

**★ Why is `mock(X.class, CALLS_REAL_METHODS)` worse than `spy(new X())`?**
Construction. `mock(...)` instantiates without running any constructor — Objenesis or the inline
maker's native path — so every field is `null` or zero when the real body executes. `spy(new X())`
starts from an object you built and copies its fields. Mockito documents both halves: the warning
*"If real implementation throws exceptions or depends on specific state of the object then you're
in trouble"*, and the recommendation to use `spy()` instead.

**★ Why does `@Spy` combined with `@InjectMocks` draw a specific warning in the docs?**
Because it produces a partial mock of the class under test with mocked collaborators injected
into it, behind two annotations that individually look like configuration. §21: *"This complexity
is another good reason why you should only use partial mocks as a last resort."* The test then
asserts against an object that is part production code, part test fixture, and no reader can tell
which part a passing assertion exercised.

{/* FOOTER */}
