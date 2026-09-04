---
title: "try/catch is invisible: exception handling is not a branch and does not increase complexity — JaCoCo says so in its own counter definitions — so the code most likely to be wrong in production is the code your branch-coverage gate cannot see"
sidebar_label: "06b · try/catch is invisible"
sidebar_position: 18
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-08-31 against **JaCoCo 0.8.15**'s `doc/counters.html`, with both statements
> quoted directly, and `doc/changes.html` for the `finally` filter. Version spine from
> `spring-boot-dependencies:4.1.1`: JDK 25, Spring Boot 4.1.1, JUnit Jupiter 6.0.3,
> Mockito 5.23.0, AssertJ 3.27.7.
> ⚠️ **No build and no test runs on this machine** — worked examples and documented definitions
> only, never report output.

**This is the strongest fact in the topic, and it is not an opinion or an inference: JaCoCo's own
counter documentation states that exception handling is not a branch, and that try/catch does not
increase cyclomatic complexity. Those two sentences mean a service can hold every one of its
decisions in catch blocks, exercise none of them, and post an excellent branch-coverage number
with a complexity report indistinguishable from a package of getters. Production failures cluster
in error handling. Your gate is blind to exactly that code.**

## The two sentences

From `doc/counters.html`, on branches:

> *"exception handling is not considered as branches in the context of this counter definition"*

And on complexity, following directly from it:

> *"try/catch blocks will also not increase complexity"*

Complexity is `v(G) = B - D + 1`, computed from branches — so if exception handling contributes no
branches, it contributes no complexity. The second statement is a consequence of the first, not an
independent decision.

## What it looks like

```java
public OrderResult place(Order order) {
    try {
        paymentGateway.charge(order.total());
    } catch (InsufficientFundsException e) {
        return OrderResult.declined(e.getMessage());
    } catch (GatewayTimeoutException e) {
        retryQueue.enqueue(order);
        return OrderResult.pending();
    } catch (GatewayException e) {
        alerting.raise("gateway", e);
        return OrderResult.failed();
    }
    inventory.reserve(order.lines());
    return OrderResult.confirmed(order.id());
}
```

Four distinct outcomes. Three of them are error handling with real, differing behaviour — one
enqueues a retry, one raises an alert, one returns a message to the customer. This is exactly the
code that decides whether an outage is a blip or an incident.

**Branch count: zero.** There is no `if` and no `switch`. **Cyclomatic complexity: 1.**

A single happy-path test — the gateway succeeds — gives you:

- **Branch coverage:** not applicable. There are no branches, so the class contributes nothing to
  the branch denominator, and a branch-coverage gate has no opinion about this method at all.
- **Complexity coverage:** 1 of 1. Fully covered.
- **Line coverage:** partial — the three catch bodies did not run.
- **Instruction coverage:** partial, similarly.

So the counter you were told to gate on ([chunk 03b](03b-branch-coverage-is-the-useful-one.md))
reports this method as **fully accounted for**, and the complexity report says it is as simple as
a getter. Only the weaker counters — line and instruction — notice anything at all, and they
notice it as a modest shortfall rather than as three untested failure modes.

## Why this is the worst place for a blind spot

Three reasons, and they compound:

1. **Error paths are where production bugs live.** Happy paths are exercised constantly, by
   every developer, in every manual test, in staging. Error paths run when something is already
   going wrong, under load, at 3am, and often for the first time.
2. **Error paths are the hardest to test**, so they are the ones most likely to be skipped. You
   need a mock that throws, or a container you can break, or a fault injection. The friction is
   real, and the metric offers no pressure to overcome it.
3. **The metric actively rewards not having them.** A method with three catch blocks and a method
   with none report the same branch coverage and the same complexity. Refactoring error handling
   *out* of a method — pushing it up to a handler, swallowing it — moves no number. Adding
   thorough error handling moves no number either.

That third point is the sharp end. The gate is not merely silent about error handling; it is
**exactly as satisfied** by code with no error handling at all.

## The `finally` corollary

`finally` blocks are also filtered — since 0.8.0, JaCoCo removes the compiler's duplication of the
`finally` body into each exit path ([chunk 05c](05c-what-jacoco-filters-for-free.md)). That filter
is correct and desirable; without it, resource-managing code would show permanently missed
instructions.

But combined with the branch rule, it means **the entire `try`/`catch`/`finally` construct is
close to invisible to the counters that matter**. Resource cleanup, retry logic, compensating
actions — the machinery of a system that fails safely — barely registers.

## What to do about it

There is no configuration that fixes this; the definition is the definition. Four things help:

**1 · Read line and instruction coverage on error-handling code specifically.** They are the
counters that see catch bodies. A class where lines are notably lower than branches is often one
with untested error paths — the inverse of the usual line-above-branch pattern, and a useful
signal precisely because it is unusual.

**2 · Make the error paths branch-visible where it is natural.** This is not "restructure code to
please a metric" — often the clearer code has the branch anyway:

```java
Result<Charge> result = paymentGateway.tryCharge(order.total());
if (result.isInsufficientFunds()) { return OrderResult.declined(result.message()); }
if (result.isTimeout())           { retryQueue.enqueue(order); return OrderResult.pending(); }
if (result.isFailure())           { alerting.raise("gateway", result.cause()); return OrderResult.failed(); }
```

Same behaviour, now six branch outcomes, and the gate can see it. ⚠️ **Do this because
result-typed error handling is clearer for expected failures, not because of coverage.**
Rewriting genuine exceptional conditions into return values to satisfy a counter is the tail
wagging the dog, and it produces worse code.

**3 · Require an error-path test by convention rather than by metric.** A review checklist item —
"which failure modes does this handle, and is each one tested?" — costs nothing and works where the
tool cannot. Topic 12's error-path scenarios are the practical version of this.

**4 · Use mutation testing on error-handling code.** It changes the code and asks whether a test
notices, which is entirely indifferent to whether the construct is a branch.
**11 · Mutation testing** *(not written yet)* is where that argument is made.

## Where this connects

- **[03 · The six counters](03-the-six-counters.md)** — where both quoted definitions live.
- **[03b · Branch coverage](03b-branch-coverage-is-the-useful-one.md)** — the counter this chunk
  is the caveat to.
- **[06 · What the number cannot say](06-what-the-number-cannot-say.md)** — this as question 3 of
  seven.
- **[05c · Filtered for free](05c-what-jacoco-filters-for-free.md)** — the `finally` filter.
- **[04b · The eighty percent ritual](04b-the-eighty-percent-ritual.md)** — pattern 3, the
  exception test that swallows, which now also fails to move the branch number.

## Gotchas

**★ A method whose only decisions are catch blocks has cyclomatic complexity 1.**
Quoted from JaCoCo: try/catch does not increase complexity, because exception handling is not
counted as branching. A complexity report is therefore not a map of where the risk is in a
service that handles failure through exceptions — which is most Java services.

**★ A branch-coverage gate is exactly as satisfied by code with no error handling as by code with thorough error handling.**
Neither contributes branches. So the gate creates no pressure to handle errors and no pressure to
test the handling, and it will not notice if someone deletes a catch block. This is the
uncomfortable version of the fact and the one worth stating in a review.

**★ Line coverage lower than branch coverage on a class is unusual and usually means untested error paths.**
The normal pattern is line above branch. When it inverts, it is often because catch bodies —
which have lines but no branches — went unexecuted. It is a cheap heuristic for finding exactly
the code this chunk is about.

**★ Testing a catch block raises lines and instructions, never branches.**
Which means someone trying to move a branch-coverage number by testing error paths will find the
number does not move, conclude their test did nothing, and possibly delete it. Worth knowing before
that conversation happens.

**★ `finally` is filtered too, so resource-management code is nearly invisible to every counter.**
The `finally` filter is correct in itself — the compiler duplicates that body into each exit path
and counting it would be meaningless — but combined with the branch rule it means try-with-resources
and cleanup logic barely register anywhere in the report.

**★ Rewriting exceptions as result types to raise branch coverage is the tail wagging the dog.**
Result types are a legitimate design choice for *expected* failures, and they do make the decisions
branch-visible. They are not a legitimate response to a metric, and applying them to genuinely
exceptional conditions produces worse code and a better number — which is the definition of
gaming, even when done sincerely.

**★ An exception thrown and never caught inside the method leaves the rest of the method uncovered, and this is easy to misread.**
A test that triggers a throw from line 3 leaves lines 4–20 uncovered, so the report looks as though
the method is barely tested when in fact a failure path was exercised deliberately. The shortfall
is real but it does not mean what it appears to.

**★ Multi-catch and rethrow patterns are equally invisible.**
`catch (AException | BException e)` is one handler, no branches, regardless of how differently the
two cases behave downstream. So is a catch that wraps and rethrows. Nothing in the exception
machinery contributes to the counter.

**★ This fact is the most useful thing to know in a discussion about coverage targets.**
It is checkable, quotable from the vendor's own documentation, and it demolishes the "high branch
coverage means well-tested" position without requiring anyone to accept a philosophical argument
about metrics.

## Interview questions

**★ Why doesn't try/catch affect branch coverage?**
Because JaCoCo's branch counter is defined over decision points in `if` and `switch`, and its
documentation states explicitly that exception handling is not considered a branch under that
definition. Cyclomatic complexity is computed from branches as `v(G) = B - D + 1`, so it follows —
and JaCoCo says so — that try/catch does not increase complexity either. A method with four catch
blocks and no conditionals has complexity 1 and contributes nothing to the branch denominator.

**★ What's the practical consequence for a team with a branch-coverage gate?**
That their gate is blind to error handling, which is where production bugs cluster. A method with
three untested catch blocks reports as fully accounted for by branch coverage and as trivially
simple by complexity. Worse, the gate is exactly as satisfied by code with no error handling at
all, so it creates no pressure either to write error handling or to test it, and it will not react
if someone removes a catch block.

**★ How would you find untested error paths given that the metric can't?**
Three ways. Read line and instruction coverage specifically on error-handling code, since those are
the counters that see catch bodies — and treat a class whose line coverage is *below* its branch
coverage as a strong signal, because that inversion is unusual and usually means unexecuted catch
blocks. Make it a review convention: which failure modes does this handle, and is each tested.
And run mutation testing on that code, since mutating a catch body and seeing whether a test
notices is indifferent to whether the construct counts as a branch.

**★ Should you rewrite exception handling as result types to get better coverage numbers?**
Not for that reason. Result types are a reasonable design choice for expected, recoverable failures
— a payment declining is arguably not exceptional — and where they are the right design they do
make the decisions visible to branch coverage as a side effect. But applying them to genuinely
exceptional conditions to move a number produces worse code and a better metric, which is precisely
the failure mode a coverage gate creates. Decide it on design grounds; take the coverage as a
bonus if it follows.

**★ A colleague argues that 90% branch coverage means the code is well tested. What's the strongest counter-argument?**
That branch coverage cannot see error handling at all, by JaCoCo's own definition — exception
handling is not counted as branching and try/catch does not increase complexity. So the 90% is
computed over the happy-path decisions only, and a service could have every one of its failure
modes untested while reporting that number. It is a checkable, documented fact rather than a
philosophical position, which is what makes it the argument to lead with.

{/* FOOTER */}
