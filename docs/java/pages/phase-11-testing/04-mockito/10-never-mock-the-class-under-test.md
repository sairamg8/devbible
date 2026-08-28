---
title: "The moment you spy or partially mock the class under test, the test stops asserting against your production code and starts asserting against a hybrid the test itself invented — and Mockito's own documentation says so more bluntly than most reviewers dare to"
sidebar_label: "10 · Never mock the SUT"
sidebar_position: 50
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-28 against the **Mockito 5.23.0** sources on GitHub (tag `v5.23.0`) —
> the class javadoc of
> [`Mockito`](https://github.com/mockito/mockito/blob/v5.23.0/mockito-core/src/main/java/org/mockito/Mockito.java)
> sections 13 (*"Spying on real objects"*) and 16 (*"Real partial mocks"*), the
> `Mockito.CALLS_REAL_METHODS` and `Mockito.spy(T)` javadocs, the
> [`@InjectMocks`](https://github.com/mockito/mockito/blob/v5.23.0/mockito-core/src/main/java/org/mockito/InjectMocks.java)
> javadoc, and the Mockito wiki
> [FAQ](https://github.com/mockito/mockito/wiki/FAQ) and
> [Mockito And Private Methods](https://github.com/mockito/mockito/wiki/Mockito-And-Private-Methods).
> Version spine from `spring-boot-dependencies:4.1.0`: JDK 25, Spring Boot 4.1.0,
> **Mockito 5.23.0**, JUnit Jupiter 6.0.3. **No sandbox** — this page carries Java source,
> never a fabricated test run.

**Every other rule in this topic is about the doubles around the class under test. This one
is about the class under test itself, and it is the only rule in the topic that changes what
a green test *means* rather than how expensive it is to maintain. A test that stubs a method
on the object it is testing has replaced part of its own subject. Whatever it proves, it does
not prove that the shipped class works — because the shipped class is not what ran. This page
is the diagnosis; the cure — the extract-a-collaborator refactor, and the two situations where
you honestly cannot apply it yet — is
[10c · The refactor that removes the need](10c-the-refactor-that-removes-the-need.md).**

## The three shapes it takes

They look different and they are the same mistake.

```java
// Shape 1 — spy the SUT, stub one of its own methods
OrderService service = spy(new OrderService(repository, gateway, notifier));
doReturn(Money.of("42.50")).when(service).computeTotal(any());

// Shape 2 — a mock that calls real methods, with one method overridden
OrderService service = mock(OrderService.class, CALLS_REAL_METHODS);
doReturn(Money.of("42.50")).when(service).computeTotal(any());

// Shape 3 — the annotation form, which hides it best
@Mock  OrderRepository repository;
@Mock  PaymentGateway  gateway;
@Spy @InjectMocks OrderService service;      // <- the SUT is now a spy
```

Shape 3 is the one that survives code review, because `@InjectMocks` reads as "wire up the
SUT" and `@Spy` reads as noise next to it. It is documented and it works — the `@InjectMocks`
javadoc says so in one sentence:

> *"Elements annotated with this annotation can also be spied upon by also adding the
> `@Spy` annotation to the element."*

That sentence is a capability statement, not an endorsement. The endorsement is elsewhere,
and it is negative.

## 🔴 Mockito's own position

Mockito calls this out twice, in nearly identical words, in the javadoc for
`CALLS_REAL_METHODS` and in section 16 of the class javadoc. It is the only place in the
whole API documentation that has a name for itself — **the partial mock warning**:

> *"As usual, you are going to read **the partial mock warning**: Object oriented programming
> is more-or-less tackling complexity by dividing the complexity into separate, specific,
> SRPy objects. How does partial mock fit into this paradigm? Well, it just doesn't… Partial
> mock usually means that the complexity has been moved to a different method on the same
> object. In most cases, this is not the way you want to design your application."*

And the escape clause, which is narrower than people remember:

> *"However, there are rare cases when partial mocks come handy: dealing with code you cannot
> change easily (3rd party interfaces, interim refactoring of legacy code etc.) However, I
> wouldn't use partial mocks for new, test-driven and well-designed code."*

Section 13 says the same thing about spies generally:

> *"Real spies should be used **carefully and occasionally**, for example when dealing with
> legacy code."*

Note what is *not* on that list: "the method is slow", "the method needs a lot of setup",
"the method is hard to reach from this test". Those are the three reasons people actually
give, and all three are descriptions of the design problem, not exceptions to the rule.

## What the test is actually asserting now

Take a service with two public methods where one calls the other:

```java
public class OrderService {

    public Receipt confirm(OrderId id) {
        Order order = repository.findById(id).orElseThrow();
        Money total = computeTotal(order);              // self-call
        gateway.charge(order.customer(), total);
        notifier.orderConfirmed(order, total);
        return new Receipt(id, total);
    }

    public Money computeTotal(Order order) {
        Money subtotal = order.lines().stream()
                .map(l -> l.unitPrice().times(l.quantity()))
                .reduce(Money.ZERO, Money::plus);
        Money discount = order.customer().tier().discountOn(subtotal);
        return subtotal.minus(discount).plus(taxOn(subtotal.minus(discount)));
    }
}
```

The test spies the service and stubs `computeTotal` to return `Money.of("42.50")`, then
asserts that the gateway was charged `42.50`. Write out what that test now establishes:

- `confirm` passes whatever `computeTotal` returns to `gateway.charge`. **True, and trivial.**
- `computeTotal` produces `42.50` for this order. **Not tested — the test asserted it into
  existence.**
- The two fit together. **Not tested — the seam between them was replaced by a stub.**

The test's subject is `confirm`-with-a-hole. The hole is filled with a literal the test
author chose, which means the number `42.50` appears twice in the test — once as the stub and
once as the expectation — and the assertion compares the test to itself. That is a tautology
in the same family as the one Mockito's own wiki warns about under *"Avoid coding a
tautology"*, only harder to see because a framework is standing between the two halves.

### 🔴 The delete test

There is one check that settles the argument in every review, and it takes ten seconds.

**Replace the body of the stubbed method with `throw new UnsupportedOperationException()`
and run the test.** If it still passes, the test does not test that method — and every other
test in the class that also stubs it does not either. If `computeTotal` is stubbed in all
nine tests of `OrderServiceTest`, then `OrderServiceTest` has zero coverage of the pricing
rules while the file name promises otherwise.

This is exactly the question mutation testing automates: change the code, see whether a test
notices. A partial mock of the SUT is a permanently surviving mutant with a test suite built
around it. **11 · Mutation testing** *(not written yet)*.

The one tool that already tells you the truth here is the coverage report, which will show
the stubbed method as unexecuted — because it *was* unexecuted. Read that as the signal it
is rather than as a gap to be papered over with another spy-based test.
**09 · JaCoCo** *(not written yet)*.

## "I only mocked the one private-ish helper"

This is the sentence that identifies the problem rather than excusing it. Three things are
true at once when someone says it.

**First, Mockito cannot mock a private method at all**, and the project has a considered
position on why:

> *"Firstly, we are not dogmatic about mocking private methods. We just don't care about
> private methods because from the standpoint of testing, private methods don't exist."*

**Second, the workaround the wiki lists is the smell.** It offers, as reason (2) for not
implementing private-method mocking, that

> *"It is very easy to work around - just change the visibility of method from `private` to
> package-protected (or `protected`)."*

Widening a method's visibility so a *test* can stub it is a change to production API made for
the test's benefit. The method is now callable by anything in the package, permanently,
because of a test.

**Third, the wiki names the real diagnosis** in its fourth reason:

> *"Finally… Mocking private methods is a hint that there is something wrong with Object
> Oriented understanding. In OO you want objects (or roles) to collaborate, not methods."*

Read the three together and the tell is precise: **a method you want to stub out is a method
whose result the rest of the class merely consumes.** Consuming a result is what you do with
a collaborator. The class has two responsibilities and one of them is trying to leave.

## Gotchas

**★ `@Spy @InjectMocks` on the SUT, with no comment, is the single most common form of this
defect.**
It is documented, it compiles, it reads like configuration, and reviewers skim it. Grep the
test tree for `@Spy` on a field whose type is a production service class; every hit needs
either a comment naming the removal plan or a refactor.

**★ `when(spy.method())` on the SUT executes the real method during setup.**
The javadoc's first spy gotcha is explicit — *"Impossible: real method is called"* — and on a
half-configured SUT the real method runs against whatever state the test has built so far,
which is usually nothing. That is why the shapes above use `doReturn(...).when(service)`. The
mechanism is [08 · Spies](08-spies.md); the point here is that the workaround makes the
mistake *quieter*, not smaller.

**★ `spy(realObject)` copies the object; it does not delegate to it.**
Verbatim: *"Mockito **does not** delegate calls to the passed real instance, instead it
actually creates a copy of it."* So if you build the SUT, spy it, and then mutate the
original — a common shape when a test helper hands you the real instance — the spy never sees
it. Two objects, one name in your head.

**★ `mock(Sut.class, CALLS_REAL_METHODS)` never runs the SUT's constructor.**
Mockito instantiates mocks with Objenesis, not with a constructor; that is exactly why
`MockSettings.useConstructor(...)` exists (*"Mockito attempts to use constructor when creating
instance of the mock"*). So every `final` field on the SUT is `null`, and the real methods you
are calling run against an object that no constructor ever validated. The failure surfaces
inside production code, far from the mock declaration.

**★ Stubbing a `final` method on a spied SUT does nothing, silently, on some paths.**
Section 13, gotcha 3: *"Mockito doesn't mock final methods so the bottom line is: when you spy
on real objects + you try to stub a final method = trouble. Also you won't be able to verify
those method as well."* Mockito 5's inline maker mocks final methods on *mocks*, but the
combination of spying and final has been a documented trouble spot for long enough that the
warning is still in the current javadoc — treat a `final` method you want to stub as a signal
to move it, not as a mock-maker configuration problem.

**★ Strict stubbing will not catch it.**
`STRICT_STUBS` reports stubs that were never used. A stub of the SUT's own method is used —
that is the whole point — so strictness passes it without comment. The strictness machinery
in [07 · Strictness](07-strictness.md) protects you from dead stubs, not from stubbing the
wrong object.

**★ Verifying that the SUT called its own method.**
`verify(service).computeTotal(order)` asserts on an internal call. Inline the method, or
change it to a `switch` expression, and the test fails while the behaviour is identical. This
is [05d · Verifying too much](05d-verifying-too-much.md) at its most extreme: the interaction
being verified is not even between two objects.

**★ A fully mocked SUT, producing a test that is a tautology.**
`OrderService service = mock(OrderService.class); service.confirm(id);
verify(service).confirm(id);` passes and asserts nothing. It arrives by copy-paste from a
test where `OrderService` really was a collaborator. Any test whose `verify` target is the
same object the test just called directly is this.

**★ The `@InjectMocks` failure is silent, and a spy hides it further.**
The javadoc: *"If any of the following strategy fail, then Mockito **won't report failure**"*.
On a plain `@InjectMocks` SUT a missing dependency surfaces as a `NullPointerException` in the
first test. On a `@Spy @InjectMocks` SUT, the method that would have touched the null field is
often the one you stubbed — so the null stays invisible until a later test removes the stub.

## Interview questions

**★ Why is it wrong to spy on the class under test?**
Because the object the test exercises is no longer the object that ships. A stubbed method is
replaced by a value the test chose, so the assertion downstream of it compares the test to
itself, and the stubbed method plus its seam with the rest of the class are both untested.
Mockito's own javadoc calls this out under the name *the partial mock warning* and says
partial mocking *"just doesn't"* fit object-oriented design, because it usually means
complexity was moved to a different method on the same object rather than to a different
object.

**★ How do you prove, in a review, that a partially mocked test is not testing what its name
claims?**
Replace the body of the stubbed method with a thrown `UnsupportedOperationException` and run
the suite. Any test that still passes was never exercising that method. It is the manual form
of a mutation test, and it takes seconds.

**★ Can Mockito mock private methods, and what does the answer imply?**
No, and deliberately so: *"from the standpoint of testing, private methods don't exist."*
The implication is that if a test needs to control a private method, the design — not the
framework — is the thing to change, because the alternative documented workaround is to widen
the method's visibility, which is a permanent production API change made for a test.

**★ What does `@Spy` combined with `@InjectMocks` actually do?**
Mockito injects the declared mocks into the object and then wraps it in a spy, so the field is
a partial mock of the SUT with mocked collaborators inside it. The `@InjectMocks` javadoc
documents the combination: *"Elements annotated with this annotation can also be spied upon by
also adding the `@Spy` annotation to the element."* It works; it is also the least visible way
to introduce the defect this page is about.

**★ Does `spy(new Sut(...))` wrap the object you passed in?**
No. Mockito *"does not delegate calls to the passed real instance, instead it actually creates
a copy of it"*. You now hold two objects. Anything the test does to the original after that
line is invisible to the spy, and anything the spy's unstubbed methods do to its own state is
invisible to the original.

**★ Why does `mock(Sut.class, CALLS_REAL_METHODS)` behave strangely on a class with final
fields?**
Because the mock is instantiated without running any constructor — Mockito uses Objenesis,
and `MockSettings.useConstructor(...)` exists precisely as the opt-in for the other behaviour.
Real methods then execute against an object whose fields were never assigned, so the failures
appear deep inside production code with no obvious link to the mock declaration.

**★ Strict stubbing is on. Will it flag a stub of the SUT's own method?**
No. Strictness reports *unnecessary* stubbings — stubs that were never used. A stub of the
SUT's own method is used by definition, which is why this defect survives in codebases that
are otherwise well disciplined about strictness.

{/* FOOTER */}
