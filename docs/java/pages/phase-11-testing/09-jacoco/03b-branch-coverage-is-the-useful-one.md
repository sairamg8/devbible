---
title: "Branch coverage is the useful one: it is the only counter that asks whether you tested a decision rather than whether you visited it, it is the hardest to inflate without writing a real test, and it is the one almost nobody gates on"
sidebar_label: "03b · Branch coverage"
sidebar_position: 8
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-08-31 against **JaCoCo 0.8.15**'s `doc/counters.html` for the branch and
> complexity definitions, and `check-mojo.html` for the counter names accepted in rules.
> Version spine from `spring-boot-dependencies:4.1.1`: JDK 25, Spring Boot 4.1.1,
> JUnit Jupiter 6.0.3.
> ⚠️ **No build and no test runs on this machine** — worked examples and documented definitions
> only, never report output.

**If you are going to gate on one number, gate on branch coverage. Not because it is a good
measure of test quality — no coverage counter is — but because it is the only one whose cheapest
route to green requires writing a test that makes something different happen. Every other
counter can be lifted by calling a method. Branch coverage can only be lifted by exercising a
decision, and exercising a decision is at least adjacent to testing behaviour.**

## The argument in one example

```java
public BigDecimal priceFor(Customer customer, Order order) {
    BigDecimal total = order.total();
    if (customer.isVip()) {
        total = total.multiply(new BigDecimal("0.90"));
    }
    return total.setScale(2, RoundingMode.HALF_UP);
}
```

Test it once, with a non-VIP customer:

- **Line coverage:** three of four lines ran. The `if` line ran (the condition was evaluated),
  `total` was assigned, the return ran. Only the discount line did not. **75%.**
- **Branch coverage:** the `if` has two outcomes. One was taken. **50%.**
- **Instruction coverage:** higher than either — the untaken branch is one multiply.

Now add the VIP case. Line goes to 100%, branch goes to 100%. Fine — but notice what happened on
the way: **to move branch coverage you had to construct a VIP customer and call the method
again.** You could not move it by calling the method harder. That is the property, and it is the
whole argument.

Contrast a method with no branches at all:

```java
public String fullName() {
    return firstName + " " + lastName;
}
```

One call takes every counter to 100%. Branch coverage does not report 100% here — it reports
*no branches*, which the report renders as `n/a` or an empty bar rather than as success. **A
counter that declines to give you credit where there was nothing to test is behaving correctly**,
and it is the reason branch coverage across a codebase reads lower than everything else: the
trivial code that inflates other counters contributes nothing to it.

## Compound conditions, where it earns its keep

This is the case that separates branch coverage from line coverage completely.

```java
public boolean canCheckout(Cart cart, Customer customer) {
    if (cart.isNotEmpty() && customer.hasValidPayment() && !customer.isSuspended()) {
        return true;
    }
    return false;
}
```

That is **one source line** and **three decisions**, so six branch outcomes. Short-circuit
evaluation means each `&&` is a separate conditional jump in the bytecode.

A single happy-path test — non-empty cart, valid payment, not suspended — gives you:

- **Line coverage: 100% of the `if` line.** Every part of the condition evaluated.
- **Branch coverage: 3 of 6.** Only the true outcome of each of the three checks was taken.

The three untested outcomes are precisely the three ways a checkout should be refused. A
line-coverage gate is entirely satisfied. A branch-coverage gate is at 50% and is pointing
directly at the bugs.

⚠️ **Note the asymmetry with `||`.** In `if (a || b)`, a test where `a` is true never evaluates
`b` at all — the branch for `b` is not merely untaken, it is unreached. Branch coverage catches
this; line coverage marks the line green because `a`'s evaluation happened on it.

## What it still cannot do

Being the best of six weak counters is not the same as being good. Branch coverage is defeated by
all of the following, and a page arguing for it that did not say so would be dishonest:

- **Assertions are still invisible.** The [chunk 01](01-what-coverage-measures.md) example — two
  tests, both branches taken, no assertions — reports 100% branch coverage.
- 🔴 **Exception handling is not a branch.** JaCoCo's own definition excludes it. A method whose
  only real decisions are "did this throw" reports as branchless.
  [Chunk 06b](06b-try-catch-is-invisible.md) is the full treatment.
- **Branches taken in combination are not tracked.** Two independent `if`s give four possible
  paths; two tests can cover all four *branches* while walking only two of the four *paths*. This
  is what covered complexity approximates better, and what path coverage would measure if anyone
  computed it.
- **A `switch` with a `default` you added for safety** contributes a branch that a reasonable
  test suite may never take, permanently capping the number below 100% for a good reason.
- **`?:` and `Optional.orElse` are branches; `Optional.map` chains often are not** in the way you
  expect, because the decision moves inside library code you are not measuring. Rewriting a
  conditional in a functional style can raise branch coverage without changing what was tested.

That last one is worth dwelling on: **branch coverage can be gamed by changing style rather than
tests.** Replacing `if (x != null) { … }` with `Optional.ofNullable(x).map(…)` moves the null
decision into `Optional`, whose bytecode is not in your report. The number improves; nothing was
tested.

## Setting a branch threshold that survives contact

Two practical points, both of which follow from the above:

**Expect a lower number, and set the bar accordingly.** A codebase at 85% line coverage is
commonly in the 60s or low 70s on branches. Porting an 80% line-coverage gate across to branches
verbatim will fail the build on day one, and the usual response — lowering it until it passes —
teaches everyone that the number is arbitrary.

**Gate on branch, but do not delete the line report.** They answer different questions and the
gap between them is itself informative: a large line-to-branch gap means dense conditional logic
with shallow tests, which is exactly where to spend effort.

The Maven form, naming everything explicitly:

```xml
<rule>
  <element>BUNDLE</element>
  <limits>
    <limit>
      <counter>BRANCH</counter>
      <value>COVEREDRATIO</value>
      <minimum>0.70</minimum>
    </limit>
  </limits>
</rule>
```

[Chunk 04](04-thresholds.md) covers the rest of the rule syntax, including the per-class forms
that are usually more useful than a bundle-wide number.

## Where this connects

- **[03 · The six counters](03-the-six-counters.md)** — the definitions this chunk builds on.
- **[03c · Line coverage needs debug info](03c-line-coverage-needs-debug-info.md)** — the other
  counter you will report, and its two documented weaknesses.
- **[06b · try/catch is invisible](06b-try-catch-is-invisible.md)** — the hole in this counter,
  stated as strongly as the documentation supports.
- **[04 · Thresholds](04-thresholds.md)** — writing the rule.
- **11 · Mutation testing** *(not written yet)* — where "was the decision actually checked" gets
  a real answer rather than a proxy.

## Gotchas

**★ Branch coverage across a codebase reads much lower than line coverage, and that is correct.**
Trivial code — getters, constructors, DTOs, delegating methods — has no branches, so it inflates
every counter except this one. A 20-point gap between line and branch coverage is normal, not a
sign that something is broken, and porting a line threshold onto branches breaks the build.

**★ A compound condition is several branches on one line, so line coverage cannot see the gap.**
`if (a && b && c)` is six branch outcomes on one fully line-covered line. The three untaken ones
are usually the three ways the operation should be refused — the error cases. This single fact is
the strongest practical argument for branch coverage.

**★ With `||`, an untested operand is never even evaluated.**
`if (a || b)` tested only with `a` true means `b`'s branch is unreached, not merely untaken. If
`b` contains a method call with a side effect or a possible `NullPointerException`, no test has
ever run it, and line coverage on that line is green.

**★ Branch coverage can be raised by rewriting an `if` as an `Optional` chain, with no new test.**
The decision moves into library bytecode that is not in your report, so the branch disappears
from the denominator. The number improves and nothing was tested. Any counter can be gamed by
moving code out of scope; this is the form it takes for branches.

**★ `n/a` on a branchless class is not a failure and should not be treated as one.**
Reports show no branch bar for classes with no decisions. A per-class branch rule applied
indiscriminately can behave oddly on such classes, and a dashboard that renders `n/a` as 0
produces alarming, meaningless numbers for a package of value objects.

**★ Covering every branch is not covering every path.**
Two independent `if` statements have four paths and four branch outcomes; two tests can cover all
four outcomes while walking two of the four paths. If the bug lives in the *combination* — the
discount applied to an already-discounted order — full branch coverage will not find it, and no
counter in JaCoCo will.

**★ A defensive `default:` or an "impossible" `else` permanently caps the number.**
Code written for safety contains branches nobody should be able to reach. They count in the
denominator. A 100% branch target therefore pressures people to delete defensive code or write
tests that assert nothing about impossible states — both worse than the shortfall.

**★ A `switch` over an enum generates more branches than the cases you wrote.**
The compiler may add handling for values not covered, and for older switch forms a synthetic
switch-map class. The branch denominator exceeds the visible cases, and adding a value to the
enum silently lowers coverage on every switch over it, in files nobody touched.

**★ Ternaries hide branches inside expressions that read as data.**
`String label = count > 1 ? "items" : "item";` is a decision, and a line-covered one after a
single test. In a builder or a mapper full of ternaries, branch coverage can be dramatically
lower than line coverage on code that looks declarative.

## Interview questions

**★ Why is branch coverage a better gate than line coverage?**
Because the cheapest way to raise it is to exercise a decision, whereas line coverage can be
raised by calling a method once. On a compound condition like `if (a && b && c)`, one happy-path
test gives 100% line coverage of that line and 50% branch coverage, and the missing half is the
three ways the operation gets refused — usually the error handling. Branch coverage is also
unaffected by the trivial branchless code that inflates every other counter.

**★ Your project has 85% line coverage. Roughly what would you expect branch coverage to be, and why?**
Materially lower — commonly the 60s or low 70s, though it depends heavily on how conditional the
code is. The reason is that line coverage counts a line as covered if any instruction on it ran,
so compound conditions, ternaries and short-circuiting operators are fully line-covered by a
single test while most of their branch outcomes are untaken. Also, branchless code — getters,
DTOs, delegation — contributes to line coverage and contributes nothing to branch coverage.

**★ Can branch coverage be gamed?**
Yes, in two ways. First, it shares every counter's fundamental hole: assertions are invisible, so
tests that take both branches and check nothing report 100%. Second, and more specific: moving a
decision out of your code and into a library removes it from the denominator. Rewriting
`if (x != null)` as an `Optional.ofNullable(x).map(...)` chain raises branch coverage without a
single new test, because `Optional`'s branches are not in your report.

**★ Does full branch coverage mean every path through a method was tested?**
No. Branch coverage requires each decision outcome to be taken at least once; path coverage would
require each *combination* to be walked. Two independent `if` statements have four paths, and two
well-chosen tests can cover all four branch outcomes while exercising only two paths. Covered
complexity is a closer approximation of paths than branch coverage is, and neither is path
coverage — that is generally not computed because the count grows exponentially.

**★ Why does testing your catch block not improve branch coverage?**
Because JaCoCo does not treat exception handling as a branch — its counter documentation states
that exception handling is not considered a branch under that definition, and correspondingly
that try/catch does not increase cyclomatic complexity either. Executing the catch block raises
instruction and line coverage for the lines inside it, but adds no branch outcomes. A service
whose error handling is entirely try/catch reports as branchless and trivially simple, which is
the most important caveat to attach to any branch-coverage number.

{/* FOOTER */}
