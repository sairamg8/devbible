---
title: "The mother class that knows how to build everything: a fixture file with two hundred methods, a fan-in of the entire suite, and a second implementation of the domain rules that nothing keeps in step with the first"
sidebar_label: "03b · When a mother becomes a god object"
sidebar_position: 8
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-31 against the **JUnit 5 / Jupiter 6.0.3** user guide
> ([docs.junit.org/6.0.3](https://docs.junit.org/6.0.3/user-guide/)) for test lifecycle and
> execution semantics, and the **AssertJ 3.27.7** documentation for the assertion style shown.
> The pattern and its failure mode are design observations, not specified behaviour; the
> mechanics below are stated so they can be checked against your own suite.
> Version spine from `spring-boot-dependencies:4.1.1`: JDK 25, Spring Boot 4.1.1,
> Spring Framework 7.0.9, JUnit Jupiter 6.0.3, Mockito 5.23.0, AssertJ 3.27.7.
> ⚠️ **No sandbox and no test runs on this machine** — Java source and documented behaviour
> only, never console output from a suite.

**Object mothers fail in one characteristic way, and it is worth knowing the shape in advance
because by the time it is obvious it is expensive to undo. A single `TestData` class accretes
methods until it knows how to build every type in the system; every test in the suite depends on
it; nobody can change a method without a suite-wide risk; and — the part that actually costs
money — the class has become a second implementation of the domain rules, kept in step with the
first by nothing at all.**

## How it happens, which is not by anybody being careless

The mechanism is the ratchet from [chunk 01](01-the-forty-line-setup.md) operating on a shared
class instead of a shared block.

1. Someone creates `Customers` with four methods. It is good, and people use it.
2. A test needs an order. There is no `Orders` class yet, and `Customers` is already
   static-imported, so `aCustomerWithAnOrder()` goes in `Customers`.
3. The class is now about two aggregates, so its name stops constraining what belongs in it.
   Someone renames it `TestData`, which is the moment the boundary disappears entirely.
4. Adding a method is free and safe. Deleting one is neither, because the compiler will tell you
   about call sites but not about whether the deletion changes another test's meaning.
5. Eighteen months later: 200 methods, 2,000 lines, imported by 400 test classes.

No single step is wrong. That is what makes the failure mode worth naming — you do not catch it
by being careful, you catch it by watching for the tells.

## The tells, in the order they show up

**A name that does not constrain.** `TestData`, `Fixtures`, `TestUtils`, `TestHelper`. A class
named `Customers` rejects a method about invoices by its name alone; a class named `TestData`
rejects nothing. This is the earliest signal and the cheapest to act on.

**Methods spanning unrelated aggregates.** The import list is the evidence: when a fixture class
imports customers, invoices, shipments, tax rules and feature flags, its fan-in is the whole
suite and every change is a suite-wide change.

**Boolean parameters.** `aCustomer(boolean gold)` and then `aCustomer(boolean gold, boolean suspended)`.
A boolean parameter in a fixture is a merged pair of scenarios that should have stayed apart, and
at the call site `aCustomer(true, false)` communicates nothing at all.

**Conjunctions in method names.** `aCustomerWithInvoicesAndACardAndAnAddress()` is three
scenarios that were never separated. Each "and" is a variation that should have been a builder
call at the call site.

**Methods calling methods calling methods.** A mother whose implementation is three levels of
other mothers has become a build system for object graphs, and understanding what any test
actually receives requires reading all three levels.

**A parameter list that is a constructor again.** `anOrder(customer, lines, currency, placedAt, status)`
has reinvented the thing builders exist to replace, with the fields now positional.

**It needs a Spring context, or a database.** Once a fixture method autowires a repository, every
test that wanted a plain object is paying for infrastructure, and the class cannot be used from a
unit test at all.

## The cost that is not obvious: a second implementation of the domain

This is the part worth internalising. Constructing a *valid, meaningful* object graph requires
knowing the domain rules — what makes a customer delinquent, which invoice states are reachable,
what an order must contain to be shippable. A god-object mother, by definition, knows all of
them. So the codebase now contains two encodings of the same rules:

- the production one, which changes when the business changes;
- the fixture one, which changes when a test breaks.

They drift, and the drift is silent because tests compare production to the fixture's assumptions
rather than to reality. The symptom is a suite that is fully green while the fixture builds
arrangements the system can no longer produce — an invoice in a state the state machine no longer
allows, an order with a shape the validator would now reject. Nothing goes red, because nothing
ever asks the domain whether the fixture is still plausible.

The defence is the rule from [02b](02b-builder-design-rules.md), applied one level up:
**fixtures construct through production's own doors.** A mother that calls
`Customer.register(...)` and then the real `InvoiceService` to raise invoices cannot drift far,
because a rule change breaks it. A mother that assembles the graph field by field can drift
indefinitely.

## Seeing it coming: three checks you can actually run

```bash
# 1 · how many methods, and about how many aggregates?
grep -c 'public static' src/test/java/com/example/TestData.java

# 2 · what does it know about? the imports are the fan-out
grep '^import com.example' src/test/java/com/example/TestData.java | wc -l

# 3 · who depends on it? the fan-in is the blast radius of any change
grep -rl 'TestData\.' src/test/java | wc -l
```

There is no threshold that is right for every codebase, and quoting one would be false
precision. What is diagnostic is the **shape**: a fixture class whose fan-out spans several
aggregates and whose fan-in is most of the suite is a single point of failure regardless of its
line count, and the three numbers moving together over a few months is the trend to act on.

## Undoing it, without a big-bang refactor

The class cannot be rewritten in one commit — it is imported by hundreds of test classes and the
diff would be unreviewable over precisely the artefacts that catch regressions. The workable
sequence:

1. **Create the per-aggregate classes** — `Customers`, `Orders`, `Invoices` — and make them the
   only place new methods may go. This stops the growth immediately, which matters more than any
   cleanup.
2. **Move, do not rewrite.** Relocate methods one aggregate at a time, keeping the old method as
   a one-line delegate so no test changes in the same commit as a move.
3. **Convert built-object returns to builder returns** as you move them
   ([03 · Object mothers](03-object-mothers.md) has the reasoning), which lets you delete the
   `…InEuros` and `…WithNoEmail` variants rather than moving them.
4. **Delete the unused ones.** A god object always has them; the IDE's find-usages is the whole
   tool, and unused fixture methods are the safest deletion in a codebase.
5. **Inline the single-caller ones.** A scenario with one caller was never a shared vocabulary,
   and inlining it puts the arrangement back in front of the one reader who needs it.
6. **Retire the delegates last**, when the old class is an empty shell.

⚠️ Do not start at step 2. Moving methods while the class is still open for business means it
grows behind you, and the migration never finishes. Step 1 is the one that changes the trajectory.

## Where this connects

- The pattern this chunk is the failure mode of is
  [03 · Object mothers](03-object-mothers.md).
- The rule that keeps fixtures from drifting — construct through production's own doors — is
  Rule 4 in [02b · Builder design rules](02b-builder-design-rules.md).
- The same ratchet operating on a `@BeforeEach` instead of a class is
  [01 · The forty-line setup](01-the-forty-line-setup.md).
- Where the fixture classes should physically live is
  [02c · Where builders live, and Lombok](02c-where-builders-live-and-lombok.md).

## Gotchas

**★ Naming a fixture class `TestData` removes the only thing that was keeping it small.**
`Customers` refuses a method about invoices by its name; `TestData` refuses nothing, and a class
that refuses nothing accretes without limit. The rename usually happens as a small tidy-up when
a second aggregate arrives, and it is the single most consequential edit in the class's life.

**★ A boolean parameter in a fixture method is two scenarios that were merged by accident.**
`aCustomer(true, false)` tells the reader nothing, and the method's body is now a branch — which
means the fixture has behaviour, and behaviour in a fixture is untested code your tests depend
on. Split it into two named methods, or move the variation to a builder call at the call site.

**★ Every "and" in a mother's name is a variation that should have been the caller's business.**
`aCustomerWithInvoicesAndACardAndAnAddress()` is a scenario that was never factored. It is also
unshareable: the next test needs the same thing without the card, so it gets its own method, and
the two are now near-duplicates that drift apart.

**★ A fixture that builds objects field-by-field becomes a second implementation of the domain rules.**
This is the expensive failure. The production rule changes, the fixture does not, and the suite
stays green while building arrangements the system can no longer produce. Nothing detects it,
because the tests are comparing production against the fixture's assumptions rather than against
the domain. Construct through the same factories production uses and a rule change breaks the
fixture, which is what you want.

**★ A mother that autowires a repository can no longer be used from a unit test.**
Once fixture construction needs a Spring context, every test that wanted a plain object pays for
one, and the pyramid quietly inverts. Keep object construction and persistence in separate,
obviously-named places — the second one belongs to [04 · Fixtures in the database](04-fixtures-in-the-database.md).

**★ The fan-in is the blast radius, and it is invisible in the class itself.**
A fixture class imported by four hundred test classes cannot be changed cheaply, no matter how
tidy it looks. `grep -rl 'TestData\.' src/test/java | wc -l` is the number that tells you what a
one-line change actually risks, and it is worth knowing before you touch the file rather than
after.

**★ Deleting an unused fixture method feels risky and is the safest deletion available.**
People leave them because "something might use it", but find-usages is exhaustive for a static
method with no reflection involved. Unused scenario methods are pure cost: they are read during
every attempt to understand the class, and they are the ones most likely to encode a rule that
has since changed.

**★ Layered mothers make it impossible to know what a test actually received.**
`anEnterpriseAccount()` calls `aCorporateCustomer()` calls `aCustomerWithBillingProfile()`, and
answering "does this test have a payment method?" takes three file jumps. Depth is worse than
breadth here: a wide flat mother class is merely large, whereas a deep one is opaque.

**★ A god-object mother makes tests slower in a way that is hard to attribute.**
Scenario methods that build more than the test needs — because they were written for a fatter
test — cost construction time in every caller, and with a database or a context behind them the
cost compounds. It shows up as a suite that got slower with no obvious commit responsible,
because the cause is one fixture method gaining a line.

## Interview questions

**★ How does an object mother turn into a god object, and what is the first sign?**
By the same ratchet as the forty-line setup, applied to a class: adding a method is free and safe,
deleting one is neither, so it only grows. The first sign is the *name* — the moment `Customers`
becomes `TestData` or `Fixtures`, the class no longer refuses anything by its name, and methods
about unrelated aggregates start landing in it. After that the tells are boolean parameters,
conjunctions in method names, mothers calling mothers, and an import list that spans the domain.

**★ Why is a large fixture class worse than a large production class?**
Two reasons. Its fan-in is the whole test suite, so every change carries suite-wide risk with no
type system to constrain the blast radius — a fixture method's meaning is not in its signature.
And it encodes domain rules that nothing keeps in step with production: the tests compare
production to the fixture's assumptions, so when the two drift, everything stays green while the
fixture builds states the system can no longer reach. A production class at least has tests
watching it; a fixture class is what the tests are made of.

**★ How would you break up a `TestData` class that four hundred test classes import?**
Not in one commit. First create the per-aggregate classes and make them the only legal home for
*new* methods — that stops the growth, which matters more than any cleanup. Then move methods one
aggregate at a time, leaving the old method as a one-line delegate so no test changes in the same
commit as a move. Convert built-object returns to builder returns while moving, which lets you
delete the `…InEuros`-style variants instead of relocating them. Delete the unused methods, inline
the single-caller ones, and retire the delegates last. The sequencing matters: starting with the
moves means the class grows behind you and the migration never lands.

**★ A fixture method takes two booleans. What is wrong with that specifically?**
It is two scenarios merged, and it puts a branch inside the fixture — so the fixture now has
behaviour, which is untested code that every test depends on. At the call site `aCustomer(true, false)`
communicates nothing; a reader has to open the method to learn what the arguments mean. Named
methods or builder calls carry the same information in a form that reads at the call site, and
they do not multiply: three booleans is eight scenarios in one method body.

**★ Your suite is green but a production bug shipped in a state the tests supposedly covered. How could the fixtures be responsible?**
If the fixtures assemble object graphs field by field rather than through production's factories,
they can construct states the system can no longer produce — an invoice in a state the state
machine has since removed, an order shaped the way the validator used to allow. The tests then
exercise a domain that does not exist, pass, and prove nothing about the real one. The check is
to ask whether the fixture's construction path goes through the same constructors, factories and
services that production uses; if it does not, the suite is validating the fixture's model of the
domain rather than the domain.

**★ Is there a size at which a mother class is definitively too big?**
No, and quoting a number would be false precision — the diagnostic is shape, not size. What
matters is whether the class spans multiple aggregates (fan-out), how much of the suite depends
on it (fan-in), and whether the two are growing together. A three-hundred-line `Customers` used
by the customer tests is fine; a hundred-line `TestData` imported by every test in the codebase
is already a single point of failure. If you want a trigger to act on, use the name: when a
fixture class can no longer be named after one aggregate, split it that day.

{/* FOOTER */}
