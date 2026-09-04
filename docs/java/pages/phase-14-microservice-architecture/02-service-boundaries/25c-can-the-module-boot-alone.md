---
title: "A module that passes ApplicationModules.verify() has a legal dependency graph, which is not the same as being extractable — the question that decides extraction is whether it boots on its own, and @ApplicationModuleTest is the one that asks it"
sidebar_label: "25c · Can the module boot alone?"
sidebar_position: 40
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-04 against the Spring Modulith reference, *Integration Testing Application
> Modules* ([docs.spring.io](https://docs.spring.io/spring-modulith/reference/testing.html)) and
> *Verifying Application Module Structure*
> ([docs.spring.io](https://docs.spring.io/spring-modulith/reference/verification.html)).
> Version spine: **JDK 25 · Spring Boot 4.1.1 / Framework 7.0.9 · Spring Cloud train 2025.1.x "Oakwood" (components 5.0.x) · Spring Modulith 2.1.1**. Documentation-validated; **no sandbox run**.

**[25 · Verifying the boundary](25-verifying-the-boundary.md) proves the dependency graph is legal. That is a statement about imports, and a module can have a perfectly legal import graph and still be impossible to extract, because extraction is not a question about imports — it is a question about whether the thing starts up, does its job and is testable with everything on the other side of the line switched off. `@ApplicationModuleTest` asks exactly that question, and its three bootstrap modes are a sliding scale of how much of the rest of the application you are still leaning on. The number of `@MockitoBean` declarations you need to make a module boot alone is the most honest coupling metric available in a monolith, and the Modulith reference says so itself.**

## The question `verify()` does not ask

`verify()` reads bytecode. It answers *"does anything in module A refer to a type it may not refer
to?"* — a static question with a static answer. Extraction asks a different one:

**If the rest of this application disappeared tomorrow, would this module still start?**

Those come apart in both directions. A module can have a spotless dependency graph and refuse to
boot alone because its `@Configuration` reaches for a bean another module contributes. A module can
carry a handful of legal, declared dependencies and still boot alone perfectly well, because those
dependencies are event listeners with nothing on the other side at startup. Neither situation is
visible in a verification report.

`@ApplicationModuleTest` replaces `@SpringBootTest` and *"bootstrap limited to specific application
modules"* — so the test itself is the experiment. You start the module and nothing else, and see
what breaks.

```java
package com.retailer.order;

import org.springframework.modulith.test.ApplicationModuleTest;

@ApplicationModuleTest
class OrderModuleTests {
    // The order module boots. Nothing else does.
}
```

## The three bootstrap modes are a coupling scale

The reference names three, and the choice you are forced into is the measurement:

| Mode | What boots, verbatim | What choosing it admits |
|---|---|---|
| `STANDALONE` *(default)* | *"Runs the current module only."* | 🔴 The module is extractable today |
| `DIRECT_DEPENDENCIES` | *"Runs the current module as well as all modules the current one directly depends on."* | It needs its immediate neighbours present to start |
| `ALL_DEPENDENCIES` | *"Runs the current module and the entire tree of modules depended on."* | It needs a transitive closure — this is a monolith slice, not a service |

**Read the mode you had to settle for as the finding.** A module you can test `STANDALONE` is a
module you can lift into its own deployable, because you have just demonstrated that its Spring
context closes without help. A module that only comes up under `ALL_DEPENDENCIES` has told you that
extracting it means extracting its whole subtree with it — which is worth knowing *before* the
project is planned around extracting one service.

```java
package com.retailer.shipping;

import org.springframework.modulith.test.ApplicationModuleTest;
import org.springframework.modulith.test.ApplicationModuleTest.BootstrapMode;

// Recording the finding in the test: shipping cannot yet start without inventory.
@ApplicationModuleTest(BootstrapMode.DIRECT_DEPENDENCIES)
class ShippingModuleTests {
}
```

## Counting mocks is the coupling metric

When the module under test holds beans that reference other modules, you supply them yourself:

```java
package com.retailer.inventory;

import org.springframework.modulith.test.ApplicationModuleTest;
import org.springframework.test.context.bean.override.mockito.MockitoBean;

@ApplicationModuleTest
class InventoryIntegrationTests {

    @MockitoBean SomeOtherComponent someOtherComponent;
}
```

That is the documented mechanism, and the documentation immediately draws the architectural
conclusion from it:

> *"High coupling requiring many mocked beans suggests reviewing dependencies for replacement with
> domain events."*

🔴 **This is the sentence worth taking away from the whole page.** The mock count is not test
boilerplate — it is the number of synchronous, start-up-time dependencies the module has on the rest
of the system, and each one is a service call you will be making across a network after extraction.
Two mocks is a module with a couple of collaborators. Eleven mocks is a module that is not a module.

**And the fix the docs point at is a boundary fix, not a testing fix.** Replacing a bean dependency
with a published domain event removes the mock *and* removes the start-up coupling *and* removes the
synchronous network call the extracted service would have made — the same change paying three times.
That is the mechanism [08b · The answer, in code](08b-the-answer-in-code.md) arrives at from the
domain side; this page is the same conclusion reached from the test harness.

## Verifying behaviour that crosses the boundary asynchronously

Once collaboration is events rather than calls, the assertions get harder: the thing you want to
assert happens on another thread, after the transaction commits. The `Scenario` abstraction exists
for that case and is injected as a test method parameter:

```java
package com.retailer.order;

import org.junit.jupiter.api.Test;
import org.springframework.modulith.test.ApplicationModuleTest;
import org.springframework.modulith.test.Scenario;

@ApplicationModuleTest
class OrderEventTests {

    @Test
    void placingAnOrderAnnouncesItToWhoeverIsListening(Scenario scenario) {
        scenario.publish(new OrderPlacedEvent(orderId, customerId, totalAmount))
            .andWaitForEventOfType(StockReservedEvent.class)
            .matching(event -> event.orderId().equals(orderId))
            .toArriveAndVerify(event -> assertThat(event.reservedItems()).hasSize(2));
    }
}
```

A scenario can start from a bean call rather than an event —
`scenario.stimulate(() -> someBean.someMethod(…))` — and can wait on a state change rather than an
event, with `andWaitForStateChange(…).andVerify(…)`. One default is worth knowing before it
surprises you: *"Non-`null` values and non-empty `Optional`s are considered conclusive state
changes by default."* A method that returns an empty list is therefore a *conclusive* change and the
wait ends immediately, while one returning an empty `Optional` is not and the wait continues.

## Gotchas

**★ Symptom: `@ApplicationModuleTest` boots far more of the application than the module you named.**
Cause: the test class's own package decides which module is under test — the annotation takes the
module from where the test lives, not from an argument. A test class parked in the root test package
selects nothing useful.
Fix: put the test in the module's package. `src/test/java/com/retailer/order/OrderModuleTests.java`
tests the `order` module; the same class in `com.retailer` does not.

**★ Symptom: the module boots `STANDALONE` in the test and fails at application start-up in production.**
Cause: the test proved the module's own context closes. It did not prove the module is reachable —
the web layer, the scheduler and the message listeners that drive it may all live elsewhere.
Fix: treat a green `STANDALONE` test as a necessary condition for extraction, not a sufficient one.
The extraction checklist is [45 · The checklist](45-the-checklist.md); this test clears one line of it.

**★ Symptom: eleven `@MockitoBean` declarations, and the team reads it as "this module is hard to test".**
Cause: it is being read as a testing problem. It is a coupling measurement that happens to surface in
a test file.
Fix: count them, write the number down next to the module in the ownership register, and treat any
module in double digits as a boundary finding rather than a test-tooling finding. Then attack the
count the way the documentation says — replace the bean dependencies with domain events, one at a
time, and watch the number fall.

**★ Symptom: a `Scenario` test hangs, then fails on timeout, and the event was definitely published.**
Cause: the publication happened but the transaction never committed, or the listener is
transactional and bound to a phase the test never reaches. `@ApplicationModuleListener` handlers run
after commit; a test that rolls back never triggers them.
Fix: make sure the stimulus actually commits rather than running inside a rolled-back test
transaction, and assert on the event the listener *produces* rather than on a database row it writes,
so the assertion is not racing the commit.

**★ Symptom: a `Scenario` waiting on a state change returns instantly and the assertion passes against nothing.**
Cause: the default conclusiveness rule. A supplier returning an empty list, an empty string or a zero
is a non-`null` value, and therefore a conclusive state change — the wait is satisfied before
anything happened.
Fix: return an `Optional` that is empty until the state actually changes, or supply a predicate that
tests for the change you mean rather than for the presence of a value.

**★ Symptom: two modules each boot `STANDALONE`, and extracting either one still breaks the other.**
Cause: the coupling is in the data, not in the context. Both modules boot because neither needs a
bean from the other; both break on extraction because they read the same table.
Fix: a bootstrap test is a code-boundary test. Pair it with the data-boundary check —
[10 · Who owns the data](10-who-owns-the-data.md) — and do not let a green `STANDALONE` stand in for
one that was never run.

## Interview questions

**★ A module passes `ApplicationModules.verify()`. What has that actually proved, and what has it not?**
It has proved the dependency graph is legal: no cycles, no reaching into another module's internals,
nothing outside the declared allow-list. All of that is derived from compile-time type references in
bytecode. It has not proved the module can start on its own, that its configuration does not depend
on a bean another module contributes, or that it does not share a database table with the module next
door. The first is a `@ApplicationModuleTest` question and the second is an ownership question; a
green `verify()` speaks to neither.

**★ What do the three bootstrap modes tell you about a boundary?**
They are a coupling scale you are forced to read honestly, because the mode you settle for is the
mode the module actually needs. `STANDALONE` boots the module alone and means it is extractable
today. `DIRECT_DEPENDENCIES` boots its immediate neighbours too, and means extraction takes the
neighbours along or replaces them with network calls. `ALL_DEPENDENCIES` boots the whole transitive
tree, and means what you have is a slice of a monolith rather than a candidate service. Recording the
mode in the annotation makes the finding permanent instead of a thing somebody once noticed.

**★ Why is the number of mocked beans in a module test an architectural metric rather than a testing detail?**
Because each mock stands for a start-up-time dependency on a bean the module does not own, and after
extraction each of those becomes a synchronous call to another service. The Modulith reference makes
the inference explicitly — *"High coupling requiring many mocked beans suggests reviewing
dependencies for replacement with domain events"* — and the fix it points at is a design change, not
a test change. Replacing one bean dependency with a published event removes the mock, removes the
start-up coupling, and removes the future network call in a single edit.

**★ Why would you use the `Scenario` API instead of just asserting on the database after calling a method?**
Because the interesting behaviour crosses the module boundary asynchronously and after commit, so a
direct assertion is racing it. `Scenario` gives the test the same shape as the production flow: apply
a stimulus, wait for the event the other side is supposed to emit, then assert on that event. It also
keeps the assertion on the *contract* — the published event — rather than on another module's table,
which is the thing you are trying to stop code from doing in the first place.

**★ Your module needs eleven mocks to boot. What is the sequence of changes that gets it to zero?**
Not "delete the mocks". Take them one at a time and ask what the collaboration is actually for. If
the module is *reading* state to make a decision, that is usually a missing piece of its own model or
a genuine query dependency that will survive as a synchronous call — keep it and record it. If the
module is *telling* another module that something happened, that is an event, and inverting it
removes the dependency entirely: the other module listens for the published record instead of being
called. Most double-digit mock counts are dominated by the second kind, which is why the count falls
quickly once the exercise starts.

---

← [Named interfaces](25b-named-interfaces.md) · [Topic index](README.md) · Next → [ArchUnit rules](26-archunit-rules.md)
