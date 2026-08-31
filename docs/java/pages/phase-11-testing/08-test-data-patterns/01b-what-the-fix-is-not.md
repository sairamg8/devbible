---
title: "Delete a line and see what breaks: the mechanical way to find out how much of a setup block is load-bearing, and the four fixes people reach for first that all leave the problem in place"
sidebar_label: "01b · What the fix is not"
sidebar_position: 2
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-31 against the **JUnit 5 / Jupiter 6.0.3** user guide
> ([docs.junit.org/6.0.3](https://docs.junit.org/6.0.3/user-guide/)) for test-instance
> lifecycle, `@BeforeEach` inheritance and execution order, and the **Spring Framework
> 7.0.8** testing reference for what a test class inherits from a superclass.
> Version spine from `spring-boot-dependencies:4.1.0`: JDK 25, Spring Boot 4.1.0,
> Spring Framework 7.0.8, JUnit Jupiter 6.0.3, Mockito 5.23.0, AssertJ 3.27.7.
> ⚠️ **No sandbox and no test runs on this machine** — Java source and documented
> behaviour only, never console output from a suite.

**[Chunk 01](01-the-forty-line-setup.md) named the four costs of a long setup block. Before
reaching for a pattern, two things are worth doing: measuring how much of the block is
actually load-bearing — which is mechanical, takes minutes, and is usually a surprise —
and knowing which four popular fixes are not fixes, because a team that adopts one of them
believes the problem is solved and stops looking.**

## The diagnostic: delete a line and see what happens

**Delete one line of the setup and run the class.** If nothing goes red, that line was not
load-bearing for any test in the class — it was there to satisfy a constructor, or it was
copied from another test, or it mattered once and stopped mattering.

Run the whole block through this and you typically find three tiers:

- **Tier 1 — lines an assertion depends on.** Usually one to three. Removing one turns a
  test red for a reason that names the behaviour.
- **Tier 2 — lines the object graph requires to exist at all.** A non-null `Customer` on
  an `Order`, a currency on a `Money`, an id because something downstream calls
  `getId().toString()`. Removing one turns a test red with a `NullPointerException` that
  names nothing.
- **Tier 3 — lines nothing needs.** Removing one changes nothing at all.

The tiers want three different treatments. **Tier 3 gets deleted.** **Tier 2 moves into a
builder's defaults**, where it exists but is not in front of the reader. **Tier 1 stays in
the test, visible**, and ideally becomes the only thing in the arrange step. That is the
whole objective of this topic, and it is worth stating as a target you can check:

> **Every value visible in a test should be a value that test's outcome depends on.**

⚠️ **The diagnostic has one false negative, and it matters.** A tier-1 line can look like
tier 3 when the expected value in the assertion is *also* wrong in a compensating way — the
classic case being a test whose expected total was updated to match a bug. Deleting the
line changes the computed value and the test still fails, so it looks load-bearing; keeping
it means the test still passes while proving nothing. The diagnostic tells you what the test
*depends on*, which is not the same as what it *should* depend on.

⚠️ **And one practical caveat:** do this on a branch, one line at a time, and do not batch
it. Deleting six lines at once and seeing two failures tells you almost nothing, because
you cannot attribute the failures. This is one of the rare cases where the slow, one-at-a-time
version is genuinely faster than being clever.

## Fix that is not a fix 1 · A comment

```java
// gold customer, £90 order, so 10% = £9
@BeforeEach
void setUp() { ... }
```

The comment is correct on the day it is written and is not checked by anything afterwards.
The first person to change `GOLD` to `SILVER` for a new test has no reason to scroll up
forty lines to a comment, and the codebase now contains a confident false statement in the
place a reader trusts most. An out-of-date comment is worse than no comment, because it
converts "I will have to work this out" into "I already know" — and the second one does not
send anybody to read the code.

The deeper objection: a comment explaining data is an admission that the data does not
explain itself. The fix is to make the data explain itself, and every pattern in this topic
is a way of doing that in code the compiler and the test runner keep honest.

## Fix that is not a fix 2 · More `@BeforeEach` methods, or a base class

Splitting forty lines into four inherited setup methods across a hierarchy of abstract test
base classes is the same problem with indirection added.

```java
abstract class AbstractServiceTest {
    @BeforeEach void setUpCustomer() { /* 14 lines */ }
}

abstract class AbstractOrderTest extends AbstractServiceTest {
    @BeforeEach void setUpOrder() { /* 18 lines */ }
}

class DiscountPolicyTest extends AbstractOrderTest {
    @BeforeEach void setUpPolicy() { /* 3 lines */ }
}
```

Jupiter runs superclass `@BeforeEach` methods **before** subclass ones, so this works. It
also means the reader of `DiscountPolicyTest` must open two more files to discover that the
customer is `GOLD`, and cannot tell from the subclass which superclass fields any test
depends on. Test-class inheritance is the most common way a visible forty-line setup becomes
an invisible eighty-line one.

There is a second-order cost that shows up later: base classes accrete for the *union* of
their subclasses' needs. `AbstractServiceTest` ends up building data for the six classes
that extend it, so every one of them pays for all six. Nobody can remove anything, because
removal requires proving that none of the subclasses — present or future — needed it.

⚠️ One legitimate use survives: a base class that carries *infrastructure* rather than
*data* — the container definition, `@AutoConfigureMockMvc`, a `@ServiceConnection` field.
That is configuration every subclass genuinely shares, it is not domain data, and no test's
assertion depends on its values. Keep the split on exactly that line.

## Fix that is not a fix 3 · One shared static fixture for the suite

```java
public final class TestData {
    public static final Customer GOLD_CUSTOMER = goldCustomer();   // ⚠️
}
```

This looks like deduplication and is a shared mutable singleton. `final` applies to the
reference, not to the object: any test that calls `GOLD_CUSTOMER.setStatus(SUSPENDED)` —
perhaps entirely legitimately, because it is testing suspension — has changed the fixture
for every test that runs later in that JVM.

The failure this produces is the worst kind available:

- It is **order-dependent**, so it reproduces on CI and not on the laptop, or vice versa.
- It **blames the wrong test** — the one that read the corrupted state, not the one that
  wrote it.
- It gets **"fixed"** by re-running the build, because a different order hides it again.

Immutable fixtures are safe (a record with no setters, a frozen value object), and so are
`static` *methods* that build a fresh object per call — which is what a builder or an object
mother is. The dangerous shape is specifically a static field holding a mutable domain
object.

⚠️ Parallel execution turns this from a rare annoyance into a constant one. Jupiter can run
tests in parallel within and across classes; a shared mutable fixture under parallel
execution is a data race in the test suite, and its symptom is a test that fails once in
thirty runs and cannot be reproduced on demand.

## Fix that is not a fix 4 · Inlining the setup into every test

The reaction to "shared setup is bad" is sometimes to delete the `@BeforeEach` and paste
its forty lines into each of the ten tests. This is worse than the original in every
dimension: the same noise multiplied tenfold, ten places to edit when a constructor gains
a parameter, and the tier-1 line is now buried in forty lines *inside* the test method
rather than above it.

The instinct behind it is sound, though, and it is worth keeping: the test should *own* its
data. What is wrong is the assumption that owning the data means writing the data. A builder
lets the test own its data in three lines by naming only the parts it cares about — which
is the whole idea of [02 · The builder](02-the-builder.md).

## What the actual fixes are, in one paragraph each

- **Builder** — defaults live in a builder class; the test names only what it depends on.
  Fixes costs 1, 2 and 3 from [chunk 01](01-the-forty-line-setup.md). This is the default
  answer and the rest of the topic assumes it.
- **Object mother** — named scenarios (`aCustomerWithNoOrders()`) when the *situation*
  rather than the object is what repeats across tests.
- **Database fixtures** (`@Sql`) — when the data must exist in a database before the code
  under test runs, because the code reads it through SQL rather than receiving it.
- **Deleting the test** — genuinely on the list. A test whose entire block is tiers 2 and 3
  with no tier 1 is asserting nothing about behaviour, and migrating it to a builder
  preserves a test that should not exist.

## Where this connects

- The four costs this page is reacting to are in
  [01 · The forty-line setup](01-the-forty-line-setup.md).
- The pattern that replaces the block is [02 · The builder](02-the-builder.md); the
  scenario-shaped variant is [03 · Object mothers](03-object-mothers.md).
- Order-dependence between tests, and why a shared row in a database is the same bug as a
  shared static field, is
  [05b · Tests that depend on each other](05b-tests-that-depend-on-each-other.md).
- `@BeforeEach` inheritance rules, execution order and parallel execution belong to
  [01 · JUnit 5](../01-junit-5/README.md).
- The slice-level version of "a base class that carries infrastructure" is in
  [05 · The test pyramid in Spring](../05-the-test-pyramid/README.md), which owns context
  configuration and the context cache.

## Gotchas

**★ A `static final` fixture is final in the reference, not in the object.**
`public static final Customer GOLD = ...` gives you a constant pointer to a mutable
customer. One `setStatus()` anywhere in the suite changes it for every subsequent test in
that JVM, and `final` gave you no protection at all. If you want a genuinely shared
constant, it must be an immutable type — a record with no mutable components, or a value
object — otherwise use a static *method* that returns a fresh instance.

**★ Test-class inheritance moves the setup out of sight without reducing it.**
`class DiscountPolicyTest extends AbstractServiceTest` converts a visible forty lines into
an invisible sixty spread over two or three superclasses, each shared by classes with
different needs. Every subsequent class either inherits data it does not need or adds an
override, and the override cannot be understood without reading the whole chain upward.
Base classes are for infrastructure, not for domain data.

**★ An object graph built by hand in a test can be in a state your production code can never produce.**
Hand-setting fields bypasses whatever invariants a factory method or constructor enforces —
an `Order` with `placedAt` set but no lines, a `Customer` with `GOLD` tier and no qualifying
spend. The test then verifies behaviour for a state that cannot occur, which either passes
meaninglessly or fails and sends someone chasing an impossible bug. Prefer building through
the same doors production uses.

**★ The delete-a-line diagnostic gives a false negative when the expected value is itself wrong.**
If a test's expected total was once "corrected" to match a bug, the setup line that feeds
that total is load-bearing for the *current* assertion while the assertion proves nothing.
The diagnostic answers "does this test depend on the line", not "should it". Pair it with
reading the assertion and asking whether you could derive the expected value by hand.

**★ Deleting setup lines in a batch teaches you nothing.**
Six deletions and two failures cannot be attributed, and the usual response — put them all
back — loses the information entirely. One line at a time is genuinely faster here, and it
is a mechanical job that takes minutes on a class you were about to modify anyway.

**★ A comment that explains a fixture is a bug report about the fixture.**
If someone had to write `// gold customer, £90 order` above a block, the block failed to say
it. The comment will also be the first thing to go stale, because nothing verifies it and
nothing points at it. Treat the presence of such a comment as the signal to convert the
block, not as documentation that makes conversion unnecessary.

**★ Under parallel execution, a shared mutable fixture stops being a rare flake and becomes a data race.**
Jupiter supports parallel execution within and across classes. A static domain object read
by one test while another mutates it is unsynchronised shared state, and the failure appears
in a test that did nothing wrong, at a frequency that depends on machine load. Teams usually
discover this on the day they enable parallelism, and blame parallelism.

**★ "The IDE folds it" is a statement about screen space, not about comprehension.**
Folding hides the block; the problem is that the information the reader needs is *inside*
the folded region and indistinguishable from the noise around it. The test for whether a
fixture is acceptable is not how much room it takes, it is whether a reader can answer why
the expected value is what it is without expanding anything.

**★ A base class shared by six test classes ends up building the union of six sets of data.**
This is the mechanism by which inherited setups become larger than the ones they replaced.
Nobody can delete from the union, because deletion requires proving no subclass needs it,
and the compiler cannot help — the subclasses just call the method under test. The union
only grows, exactly like the block in a single class, but now across files.

## Interview questions

**★ How do you find out how much of a setup block is dead weight?**
Delete a line and run the class. Nothing red means nothing depended on it. Doing this line
by line sorts the block into three tiers — values an assertion depends on, values the object
graph merely requires to exist, and values nothing needs. Tier three gets deleted; tier two
moves into a builder's defaults; tier one stays in the test, visible. It is mechanical
enough to do in a few minutes, and the result usually surprises people: the load-bearing
part of a forty-line block is typically one to three lines. The one caveat is that the
diagnostic reports what the test depends on, not what it should — a test whose expected
value was bent to match a bug will report a decorative line as load-bearing.

**★ A colleague says the setup block is fine because the IDE folds it. What is your response?**
Ask them the diagnostic question about a specific test in the class — "why is the expected
discount £9.00?" — and time how long the answer takes. If it requires expanding the fold,
reading thirty lines and doing arithmetic, the block is not fine. Folding addresses screen
space, and screen space was never the cost; the cost is that the reader cannot distinguish
the two or three load-bearing values from the thirty-seven that are noise, and folding
makes that easier to ignore rather than easier to fix.

**★ Your team pulls shared setup into an abstract base test class. What goes wrong, and when is it acceptable?**
It goes wrong because inheritance hides the data without shrinking it, and because a base
class accretes the union of its subclasses' needs — so every subclass pays for data six
other classes wanted, and nobody can delete anything without proving a negative. Jupiter
runs superclass `@BeforeEach` first, so it works mechanically; the problem is entirely
comprehension and coupling. It is acceptable when what is shared is *infrastructure* rather
than domain data — a container definition, slice annotations, a configured `MockMvc` — since
no assertion's value depends on those, and they genuinely are identical for every subclass.

**★ Why is a `public static final` test fixture dangerous when the field is final?**
Because `final` freezes the reference, not the object, and domain entities have setters.
Any test that mutates the shared instance changes it for every test that runs afterwards in
the same JVM, producing failures that are order-dependent, blame the reading test rather
than the writing one, and vanish when the suite is re-run in a different order. Under
parallel execution it is a straightforward data race. The safe forms are an immutable type,
or a static method returning a fresh object per call — which is exactly what a builder or
an object mother is.

**★ How would you introduce builders to a suite that has forty-line setups in fifty classes?**
Not with a mass rewrite: that produces an unreviewable diff over the artefacts that are
supposed to be catching regressions, and if the refactor has a bug you have no oracle left.
Add the builder alongside the existing setups, require it for all new tests, and convert an
existing class only when you are already editing it for another reason. The sequencing
detail that matters is that the builder's defaults must reproduce what the old setup
produced — otherwise the first conversion changes behaviour, the suite goes red for reasons
unrelated to the refactor, and the team concludes that builders break tests.

**★ When would you delete a test rather than migrate it to a builder?**
When the delete-a-line diagnostic finds no tier-1 line at all: every value in the block is
either graph-scaffolding or noise, and the assertion holds regardless of the data. That test
is asserting that the method runs without throwing, which is worth saying explicitly in one
line if it is worth saying at all — and it should not be preserved in a form that implies it
checks a business rule. Migrating it makes it cheaper to maintain a test that should not
exist, which is the more expensive mistake.

{/* FOOTER */}
