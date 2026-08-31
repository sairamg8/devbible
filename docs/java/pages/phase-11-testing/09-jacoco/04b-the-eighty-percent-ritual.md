---
title: "The eighty percent ritual: what a coverage target actually produces, shown as code — the assertion-free test, the getter test, the exception-swallowing test, the reflection test and the exclusion, five patterns that raise the number and lower the value of the suite"
sidebar_label: "04b · The 80% ritual"
sidebar_position: 12
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-08-31 against **JaCoCo 0.8.15**'s `doc/counters.html` for what each pattern does
> to which counter, and `check-mojo.html` for the rule syntax the last pattern exploits.
> Version spine from `spring-boot-dependencies:4.1.0`: JDK 25, Spring Boot 4.1.0,
> JUnit Jupiter 6.0.3, Mockito 5.23.0, AssertJ 3.27.7.
> ⚠️ **No build and no test runs on this machine.** Every claim about what a pattern does to a
> counter follows from the documented counter definitions, not from a measured run.

**[Chunk 04a](04a-floor-or-target.md) argued that a coverage target buys assertion-free tests.
That is easy to assert and easy to dismiss, so this chunk shows the code. These five patterns are
not strawmen — they are what appears in a pull request when a number has to move by Friday, they
all pass review because each one is individually defensible, and together they can take a module
from 55% to 85% without testing anything. Knowing them by sight is a reviewing skill.**

## Pattern 1 · The test with no assertion

```java
@Test
void calculatesDiscount() {
    discountService.calculate(order, customer);
}
```

It executes the method, every line inside it, and — depending on the data — most of its branches.
It asserts nothing. If `calculate` returns the wrong number, throws away the customer, or has its
body replaced with `return null`, this test stays green.

**The tell in review:** a test method with no `assert`, no `assertThat`, no `verify`, and no
`assertThrows`. It is trivially greppable and worth a lint rule.

**The defence you will hear:** "it's a smoke test, it checks it doesn't throw." Sometimes that is
genuinely the intent — but then it should say so, with `assertThatNoException().isThrownBy(...)`,
which makes the claim explicit and reviewable rather than implied by absence.

## Pattern 2 · Testing the getters

```java
@Test
void gettersAndSetters() {
    Customer c = new Customer();
    c.setName("Test");
    c.setEmail("t@example.com");
    c.setTier(GOLD);
    assertThat(c.getName()).isEqualTo("Test");
    assertThat(c.getEmail()).isEqualTo("t@example.com");
    assertThat(c.getTier()).isEqualTo(GOLD);
}
```

This one *has* assertions, which is why it survives review. It still tests nothing: it verifies
that the language assigns fields, and it will never fail for any reason other than someone
deleting a field.

It is extraordinarily efficient at moving the number, though, and that is the point. DTOs and
entities are usually the largest class of instructions and lines in a service and the smallest
class of behaviour. A single test like this across a package of entities can move a module's line
coverage by several points.

**Note what it does to each counter.** Lines and instructions: a lot. Branches: nothing at all,
because there are none. This is the clearest practical demonstration of why branch coverage is
the harder number to game — [chunk 03b](03b-branch-coverage-is-the-useful-one.md).

## Pattern 3 · The exception path that swallows

Error handling is the hardest coverage to earn honestly, so it attracts the most inventive
shortcuts:

```java
@Test
void handlesFailure() {
    when(paymentGateway.charge(any())).thenThrow(new GatewayException("boom"));
    try {
        checkout.complete(order);
    } catch (Exception ignored) {
        // covered!
    }
}
```

The catch block in the code under test executes. Instruction and line coverage inside it rise. The
test asserts nothing about what happened — whether the order was left in a sane state, whether a
compensating action ran, whether the right exception type surfaced to the caller.

⚠️ Worse, this test **cannot fail**. The `catch (Exception ignored)` swallows the assertion-free
outcome and also any assertion error you might later add inside the `try`. It is a test-shaped
object that is structurally incapable of going red.

**And recall from [chunk 03](03-the-six-counters.md)** that the catch block contributed no
branches, because JaCoCo does not count exception handling as branching. So this pattern buys
lines and instructions only — it does not even move the counter you should be gating on.

The honest version states what should happen:

```java
@Test
void leavesOrderUnpaidWhenGatewayFails() {
    when(paymentGateway.charge(any())).thenThrow(new GatewayException("boom"));

    assertThatThrownBy(() -> checkout.complete(order))
            .isInstanceOf(CheckoutFailedException.class);

    assertThat(order.status()).isEqualTo(UNPAID);
    verify(inventory).release(order.id());
}
```

## Pattern 4 · Reaching for reflection

When a class has genuinely unreachable code — a private constructor on a utility class, a
defensive `default:` branch, a method only invoked by a framework — the number can be moved by
invoking it artificially:

```java
@Test
void privateConstructor() throws Exception {
    Constructor<StringUtils> c = StringUtils.class.getDeclaredConstructor();
    c.setAccessible(true);
    c.newInstance();
}
```

This exists in real codebases, purely to close a coverage gap. It tests nothing and it couples a
test to a private member, so an ordinary refactor breaks it.

⚠️ The specific irony: **JaCoCo already filters private empty constructors** — it has since
0.8.0. So on a current version this test is closing a gap that no longer exists, and its presence
is usually a fossil from an older JaCoCo. [Chunk 05c](05c-what-jacoco-filters-for-free.md) lists
what you get for free, and checking that list first is often cheaper than any of this.

## Pattern 5 · Moving the goalposts

The fastest of all, and the one that leaves the least trace:

```xml
<excludes>
  <exclude>com/example/service/**/*.class</exclude>
</excludes>
```

One line in a config file, reviewed as "build config", and an entire package leaves the
denominator. The number goes up immediately, no test was written, and six months later nobody
remembers why `service` is excluded.

This is why any team with a threshold needs to review the exclusion list with the same seriousness
as the threshold itself. [Chunk 05](05-exclusions.md) is about excluding honestly and how to tell
the difference.

## What all five have in common

Every one of them is a **rational response to the incentive that was set**. None of the engineers
writing them is behaving badly; they were asked to move a number, and these are the cheapest legal
ways to move it. The fault is in the instrument and in the request, not in the response.

This matters for how you talk about it. "Stop writing bad tests" does not work, because the tests
are a correct answer to the question that was asked. Changing the question does work: ask for
coverage **on the change** rather than on the codebase ([chunk 07b](07b-coverage-in-ci.md)), gate
on a **floor** rather than a target ([chunk 04a](04a-floor-or-target.md)), and when what you
actually want to know is "would a bug here be caught", use the tool that answers it — mutation
testing, which kills all five of these patterns outright.

## Where this connects

- **[04a · Floor or target](04a-floor-or-target.md)** — the policy argument this chunk
  illustrates.
- **[01 · What coverage measures](01-what-coverage-measures.md)** — why assertions are invisible
  to the instrument in the first place.
- **[05 · Exclusions](05-exclusions.md)** — pattern 5, taken seriously.
- **[05c · What JaCoCo filters for free](05c-what-jacoco-filters-for-free.md)** — why pattern 4 is
  usually solving a problem that no longer exists.
- **11 · Mutation testing** *(not written yet)* — the tool that fails every pattern on this page.

## Gotchas

**★ A test with no assertion is greppable, and most teams never grep for it.**
No `assert`, no `assertThat`, no `verify`, no `assertThrows` in a test method body is a mechanical
check that costs nothing to automate and catches pattern 1 outright. Several static-analysis rules
exist for it. It is the highest-value lint you can add to a suite with a coverage target.

**★ Getter tests move line and instruction coverage a long way and branch coverage not at all.**
Data classes are where most of a service's lines live and where none of its decisions live. This
is the clearest reason to gate on branches: the single most effective number-gaming pattern is
completely invisible to that counter.

**★ `catch (Exception ignored)` in a test makes the test incapable of failing, forever.**
It swallows not just the current absence of assertions but any assertion you add inside the `try`
later. This is strictly worse than no test, because the file's existence suggests the path is
covered and a future engineer will not look again.

**★ Testing the catch block does not raise branch coverage, so pattern 3 does not even work as intended.**
JaCoCo does not count exception handling as branching. The pattern buys instructions and lines
only. Someone gaming a branch-coverage gate this way will be confused about why the number will
not move — which is a small mercy.

**★ A reflection test for a private constructor is usually a fossil.**
JaCoCo has filtered private empty constructors since 0.8.0. Such tests were written against an
older version and have outlived the gap they closed. Before writing any test whose only purpose is
coverage, check the filter list — the answer is often that no gap exists.

**★ An exclusion is a one-line diff in a file reviewers skim.**
It is the fastest way to raise coverage and the hardest to spot in review, because it is in build
configuration rather than in code. Treat the exclusion list as a reviewed artifact with a
rationale per entry, or it will grow silently.

**★ These patterns are not written by bad engineers; they are written under deadline by good ones.**
Framing it as a quality problem produces defensiveness and no change. Framing it as an incentive
problem — the metric asked for executed instructions and got them — leads to the actual fix, which
is changing what is asked for.

**★ Coverage that jumps sharply without a proportional jump in test count is worth a look.**
Real testing work moves the number gradually. A ten-point jump in one pull request is either a
large exclusion, a getter sweep, or a deleted module — all three worth knowing about, and all
three visible from the diff of the coverage report rather than its headline.

**★ Assertion-free tests are slower to spot in a suite that uses `verify` heavily.**
A test that ends in `verify(mock).someCall()` has an assertion in the mechanical sense but may
still assert nothing about the result of the code under test. Mock verification is a claim about
an interaction, not about an outcome, and a suite made entirely of it can be as inert as one with
no assertions at all.

## Interview questions

**★ Give three ways to raise coverage without improving a test suite.**
Tests that call methods and assert nothing; tests for getters and setters, which move line and
instruction coverage a great deal and branch coverage not at all; and exclusions, which remove
code from the denominator in a one-line config change. Two more: `try { … } catch (Exception
ignored) {}` around a failure path, which executes the catch block in the code under test while
making the test incapable of failing; and reflective invocation of otherwise-unreachable members
like private constructors.

**★ How would you detect assertion-free tests in a codebase?**
Statically. A test method with no `assert*`, `assertThat`, `assertThrows` or `verify` call in its
body is a mechanical pattern, and several static-analysis rules implement exactly that check. It is
worth adding before any coverage gate, because a gate without it creates the incentive and removes
the detection at the same time. The residual case a lint cannot catch is a test whose assertions
are all mock verifications, which asserts about interactions rather than outcomes.

**★ Why does testing an exception path not improve branch coverage?**
Because JaCoCo does not treat exception handling as a branch — its counter documentation says so
explicitly, and correspondingly that try/catch does not increase cyclomatic complexity. Executing a
catch block raises instruction and line coverage for the lines within it and adds no branch
outcomes. So a team gaming a branch-coverage gate by testing error paths will find the number
barely moves, and a team with genuinely thorough error handling will find that thoroughness
invisible to the counter.

**★ Your team's coverage went from 58% to 84% in one sprint. What do you look at?**
The diff of the exclusion configuration first, since that is the cheapest way to produce that jump
and the least visible. Then the test count and the shape of the new tests: a large number of small
tests over data classes, or tests with no assertions, indicate the number moved rather than the
suite improving. Then branch coverage specifically — if line coverage jumped 26 points and branch
coverage moved two, the work went into branchless code, which tells you exactly what happened
without anyone having to admit it.

**★ A reviewer sees a new test with no assertions. What should they say?**
Ask what the test would catch if it failed. If the honest answer is "it checks the method doesn't
throw", the test should say that explicitly — `assertThatNoException().isThrownBy(...)` — which
turns an implied claim into a reviewable one. If the honest answer is "it was for coverage", that
is the conversation to have, and it is about the gate rather than about the author.

{/* FOOTER */}
