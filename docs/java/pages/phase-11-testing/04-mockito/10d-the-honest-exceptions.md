---
title: "There are exactly three situations in which a partial mock of the class under test is defensible, all three are about code you cannot change yet rather than code you would rather not change, and what separates a defensible spy from a defect is not the situation but the comment above it"
sidebar_label: "10d · The honest exceptions"
sidebar_position: 44
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-28 against the **Mockito 5.23.0** sources on GitHub (tag `v5.23.0`) —
> the class javadoc of
> [`Mockito`](https://github.com/mockito/mockito/blob/v5.23.0/mockito-core/src/main/java/org/mockito/Mockito.java)
> sections 13 (*"Spying on real objects"*), 16 (*"Real partial mocks"*) and 30 (*"Spying or
> mocking abstract classes"*), the `Mockito.CALLS_REAL_METHODS` javadoc, and
> [`MockSettings#useConstructor`](https://github.com/mockito/mockito/blob/v5.23.0/mockito-core/src/main/java/org/mockito/MockSettings.java).
> Version spine from `spring-boot-dependencies:4.1.0`: JDK 25, Spring Boot 4.1.0,
> **Mockito 5.23.0**, JUnit Jupiter 6.0.3. **No sandbox** — this page carries Java source,
> never a fabricated test run.

**[10](10-never-mock-the-class-under-test.md) says never and
[10c](10c-the-refactor-that-removes-the-need.md) shows the way out. This page is the honest
remainder: Mockito's own escape clause, what it actually covers, and — the part that decides
whether the next reader is misled — exactly what has to be written above the `@Spy` so that a
green tick over the test class stops promising something it does not deliver.**

## The three situations Mockito's escape clause actually covers

Mockito's escape clause is *"code you cannot change easily (3rd party interfaces, interim
refactoring of legacy code etc.)"*. In practice that is three situations:

1. **A class you do not own and cannot subclass differently** — a framework base class whose
   `protected` hook you must neutralise to reach the logic you added.
2. **Legacy code mid-refactor**, where you are adding characterisation tests *first* so that
   the extract-collaborator move is safe to make. The spy is scaffolding with a demolition
   date.
3. **A method that is genuinely infrastructural on that class and cannot move yet** — a
   `protected` `now()` or `newId()` on a base class you inherited. (Both of those have proper
   answers — a `Clock` and an `IdGenerator` — and this is the interim.)

Read the clause narrowly. *"3rd party interfaces"* means a type whose source you cannot
edit — not a type in another team's module that you could raise a pull request against.
*"Interim refactoring of legacy code"* means a refactor that is in flight, with a ticket, not
one that is theoretically desirable. Nothing in the clause covers "the method is long",
"the setup is annoying" or "the other test already does it that way".

## The framework base class, in detail

Situation 1 is the only one that can be permanent, so it is worth being precise about. You
extend a framework class, you override one method with your logic, and the superclass's other
`protected` methods do things a unit test cannot survive — open a connection, read a servlet
context, call `System.exit`.

```java
// The situation: your logic is in process(), but the inherited connect() must not run.
public class NightlyExportJob extends VendorScheduledJob {
    @Override protected void process() { /* the logic you actually want to test */ }
    // connect(), lease(), heartbeat() all come from VendorScheduledJob and all do I/O
}
```

Two answers, in order of preference:

```java
// Preferred — wrap instead of extend. Your logic moves to a class you fully own,
// and the framework subclass becomes a three-line adapter with nothing to test.
public class NightlyExport {                       // no superclass, no framework
    public void run(ExportSink sink) { /* the logic — testable with plain mocks */ }
}

public class NightlyExportJob extends VendorScheduledJob {
    private final NightlyExport export = new NightlyExport();
    @Override protected void process() { export.run(sinkFrom(context())); }
}
```

```java
// Fallback, when the framework insists on constructing the object itself — and note
// that Mockito can build the partial mock without your having an instance at all:
VendorScheduledJob job = mock(NightlyExportJob.class, withSettings()
        .useConstructor()
        .defaultAnswer(CALLS_REAL_METHODS));
doNothing().when(job).connect();
```

Section 30 documents that second form and attaches its own warning in the first sentence:

> *"It is now possible to conveniently spy on abstract classes. Note that overusing spies hints
> at code design smells."*

`useConstructor()` matters here because the default instantiation path runs no constructor at
all — *"Mockito attempts to use constructor when creating instance of the mock"* is the opt-in,
and without it every field on the framework superclass is `null` while its real methods run.

## What the comment must say

What separates a defensible spy from an indefensible one is not the situation, it is the
comment. A spy on the SUT with no comment is a defect. With this comment, it is a plan:

```java
// PARTIAL MOCK OF THE SUT — deliberate, temporary.
// Why: LegacyBillingJob.computeTotal() reads a static ThreadLocal set by the servlet
//      filter, so it cannot run under a unit test until that dependency is injected.
// Removed by: extracting PricingPolicy (see ticket BILL-4471) — at which point this
//      spy becomes @Mock PricingPolicy and this test needs no change to its assertions.
// Until then: this test does NOT cover computeTotal. TieredPricingPolicyTest does not
//      exist yet. Coverage of the pricing rules is currently zero.
@Spy @InjectMocks LegacyBillingJob job;
```

The last two lines are the ones that matter. A reader six months later needs to know that the
green tick over `LegacyBillingJobTest` does not include the pricing rules — because nothing
else in the repository will tell them.

## What this rule is *not*

**Spying a collaborator is a different thing.** `spy(new InMemoryOrderRepository())` to
verify a call while keeping real behaviour is legal, occasionally useful, and governed by
[08e · Partial mocks](08e-partial-mocks.md) rather than by this page. The rule here is specifically about the
object whose behaviour the test claims to be establishing.

**Mocking a superclass's method is still mocking the SUT.** Inheritance does not put the
method on a different object; `this` is still one object at runtime. If the method you are
stubbing responds to a call on the SUT, this page applies.

**Constructing the SUT with real collaborators is not mocking it.** A test that news up
`OrderService` with a real `TieredPricingPolicy` and mocks only the gateway is doing the
right thing, and is often better than mocking the policy at all —
[12 · Mocks vs fakes](12-mocks-vs-fakes.md).

**Mocking an *abstract* class you are testing through is a judgement call, not this rule.**
If the abstract class is yours and the subclass under test is the SUT, `spy(Abstract.class)`
to fill in the abstract methods is a way of testing the template rather than the subject —
still worth avoiding, but it is a different argument from stubbing the subject's own
behaviour.

**Stubbing a method the SUT *inherits but does not call* is harmless and pointless.** It is
not this defect, because nothing in the exercised path goes through it; it is an unnecessary
stubbing, and [07 · Strictness](07-strictness.md) will tell you so.


## Making the exception expire

A spy with a good comment is still debt. Three cheap mechanisms keep it from becoming
permanent:

- **Put the ticket number in the comment**, not in a wiki page. Grep for `@Spy` in the test
  tree; every hit without a ticket is either a defect or a lie about the plan.
- **Name the test class for what it covers, not for the SUT.** `LegacyBillingJobWiringTest`
  is honest about a test that only checks the wiring; `LegacyBillingJobTest` implies coverage
  it does not have.
- **Let mutation testing hold the line.** A surviving mutant in `computeTotal` is the machine
  saying exactly what the comment says, on every build, without depending on anyone reading
  it. **11 · Mutation testing** *(not written yet)*.

## Gotchas

**★ A "characterisation test" spy that never gets removed.**
Situation 2 is legitimate only while the refactor is actually in flight. Without a ticket
number in the comment, "interim" becomes permanent, and the interim scaffolding is now the
documentation of how the class is tested.

**★ The comment explains the spy but not the coverage hole.**
A comment saying *"spying because connect() does I/O"* is half an explanation. The half that
matters to the next reader is *"therefore this test does not cover X, and nothing else does
either"* — because the alternative is that they trust a green tick that never checked X.

**★ Treating "3rd party" as "another team's code".**
Mockito's clause is about code you cannot change. A class in a module your organisation owns
is changeable; the cost is a pull request, not a partial mock. Spying it is a decision to buy
a permanently weaker test with an afternoon's saved effort.

**★ `spy(SomeAbstract.class)` used to test the abstract class's template method.**
Section 30 makes this convenient and warns in the same breath that *"overusing spies hints at
code design smells"*. Testing a template method through a spy means the subclass hooks are
whatever Mockito's default answer returns, which is rarely the behaviour any real subclass
has.

**★ `mock(Sut.class, CALLS_REAL_METHODS)` without `useConstructor()` on a framework subclass.**
The framework superclass's fields are all `null` because no constructor ran, and its real
methods are now executing against that. `withSettings().useConstructor()` is the documented
opt-in and is nearly always required in this shape.

**★ Extending the framework class *and* keeping the logic in it.**
The wrap-instead-of-extend answer only pays off if the subclass keeps nothing but delegation.
A subclass with three lines of adapter and forty of logic is still the original problem, and
the spy is still the only lever.

**★ Assuming the exception transfers to the next test class.**
A defensible spy in `LegacyBillingJobTest` is not a precedent for `NewPricingServiceTest`.
The clause is about a specific class you cannot change; a new class written this week does not
qualify, and Mockito is explicit: *"I wouldn't use partial mocks for new, test-driven and
well-designed code."*

## Interview questions

**★ When is a partial mock of the SUT acceptable?**
When the code cannot be changed yet: a third-party or framework base class, or legacy code
being characterised immediately before an extract-collaborator refactor. Mockito's own
wording is *"code you cannot change easily … I wouldn't use partial mocks for new,
test-driven and well-designed code."* And the spy has to carry a comment naming the reason,
the removal plan, and — most importantly — what the test consequently does *not* cover.

**★ What has to be in the comment above a deliberate spy on the SUT?**
Four things: that it is deliberate, why the method cannot run under test, what refactor will
remove it (with a ticket reference), and — the line people leave out — which behaviour is
therefore uncovered by this test and by anything else. Without the last line, the class's
green tick silently overstates what has been checked.

**★ You inherit from a framework class whose `protected` methods do I/O. How do you test your
override without spying the SUT?**
Move the logic out of the subclass into a class you fully own, and leave the subclass as a
delegating adapter with nothing worth testing. The framework then constructs whatever it
likes; your logic is exercised through an ordinary constructor with ordinary mocks. Only when
the framework insists on owning the object as well does the partial mock become the fallback,
and then `withSettings().useConstructor().defaultAnswer(CALLS_REAL_METHODS)` is the form to
use, because the default instantiation path runs no constructor at all.

**★ Is spying a collaborator the same defect?**
No. `spy(new InMemoryOrderRepository())` keeps real behaviour on an object that is not the
subject of the test, so nothing about the subject is replaced by a value the test invented.
It has its own hazards — `when` on a spy runs the real method, and the spy is a copy of the
instance rather than a wrapper around it — but they are hazards of the API, not of the
argument this series makes.

**★ How do you stop a temporary spy from becoming permanent?**
Put a ticket number in the comment so it is greppable, name the test class after what it
actually covers rather than after the SUT, and let mutation testing keep reporting the hole on
every build. The one thing that does not work is intent: an undated "TODO: refactor" is the
same as no plan.

{/* FOOTER */}
