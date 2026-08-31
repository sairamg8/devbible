---
title: "What the number cannot say: seven questions a coverage report is structurally incapable of answering, why each one is the question you actually had, and the honest thing to do about it"
sidebar_label: "06 · What it cannot say"
sidebar_position: 17
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-08-31 against **JaCoCo 0.8.15**'s `doc/counters.html` (the branch and complexity
> definitions, quoted), `doc/classids.html` and `doc/faq.html`. Version spine from
> `spring-boot-dependencies:4.1.0`: JDK 25, Spring Boot 4.1.0, JUnit Jupiter 6.0.3,
> Mockito 5.23.0, AssertJ 3.27.7.
> ⚠️ **No build and no test runs on this machine** — worked examples and documented definitions
> only, never report output.

**Every argument in this topic has been a specific case of one general fact: a coverage report
answers "did this run", and every question anyone actually wants answered is a different question.
This chunk collects them. Not as a complaint about the tool — the tool answers its question
accurately and cheaply — but because knowing precisely which questions are out of scope is what
lets you use the number without being misled by it, and tells you which tool to reach for instead.**

## 1 · "Was this code tested?"

The foundational one, from [chunk 01](01-what-coverage-measures.md). A probe records one bit:
reached, or not. There is no channel in the execution data for whether anything inspected the
result. Two tests that take both arms of an `if` and assert nothing produce a report identical to
two tests that assert exhaustively.

**What to use instead:** review, and mutation testing. **11 · Mutation testing** *(not written
yet)* is the tool that asks whether a change to the code would be noticed.

## 2 · "Would a bug here be caught?"

Related but distinct, and it is the question a coverage percentage is usually being asked to
stand in for. Coverage says a line executed; it cannot say the assertions are strong enough for a
wrong value to fail the suite.

A test asserting `assertThat(result).isNotNull()` covers exactly as much as one asserting
`isEqualTo(Money.gbp("9.00"))`, and only one of them would notice a pricing bug.

## 3 · "Are the error paths exercised?"

🔴 This is where the tool is not merely silent but actively misleading, and it comes from JaCoCo's
own definition:

> *"exception handling is not considered as branches in the context of this counter definition"*

and correspondingly *"try/catch blocks will also not increase complexity"*.

So a service whose decisions are all of the form "did this call throw" reports as **branchless
and trivially simple** — the same complexity as a getter — no matter how many failure modes it
handles. [Chunk 06b](06b-try-catch-is-invisible.md) is this argument in full, because it is the
strongest single fact in the topic.

## 4 · "Are the combinations tested?"

Branch coverage requires each decision outcome to be taken once. It does not require the
*combinations* to be walked.

```java
if (customer.isVip()) { total = total.multiply(VIP_RATE); }
if (order.isBulk())   { total = total.multiply(BULK_RATE); }
```

Two tests — one VIP non-bulk, one non-VIP bulk — take all four branch outcomes. **100% branch
coverage.** Neither test is a VIP bulk order, which is the case where two discounts compound and
where the bug is. No counter in JaCoCo will tell you that path was never walked; covered
complexity gets closest and still does not.

Path coverage would answer it, and is generally not computed because the number of paths grows
exponentially with the number of decisions.

## 5 · "Is this code correct?"

Obviously not, but it is worth stating because the number is routinely used as a proxy for
quality in reporting that goes to people who will not read this page. A module at 95% may be
wrong in every method. Coverage is orthogonal to correctness; it constrains only where a bug can
hide *from a suite that has assertions*.

## 6 · "Is this code needed?"

0% is a strong hint and not a conclusion. A class at 0% may be dead code, or it may be:

- reached only in production configuration your tests never activate;
- excluded at the agent rather than the report — which per JaCoCo's FAQ renders identically,
  because the generator *"cannot distinguish whether the class was excluded from instrumentation
  or not executed"*;
- a victim of a class id mismatch ([chunk 06c](06c-the-zero-percent-class.md));
- executing in a different JVM ([chunk 02d](02d-integration-tests-and-failsafe.md)).

The report cannot distinguish any of these, and deleting on the strength of a zero without
checking is how a production incident starts.

## 7 · "Is 78% good?"

There is no answer, and the question is asked constantly. The number depends on the counter
([chunk 03](03-the-six-counters.md)), the exclusion list ([chunk 05](05-exclusions.md)), the
JaCoCo version's filter set ([chunk 05c](05c-what-jacoco-filters-for-free.md)), whether
integration coverage is merged in ([chunk 02d](02d-integration-tests-and-failsafe.md)), and the
proportion of the codebase that is DTOs. Two services at 78% are not comparable, and the same
service at 78% this quarter and 78% last quarter may have changed a great deal.

The only comparisons that survive are **the same project, the same configuration, over time** —
and even that is broken by a JaCoCo upgrade.

## What the number CAN say

Short, and worth keeping in view, because a chunk this long risks reading as "the tool is
useless" and it is not:

- **This code was not reached by any test.** Sound, actionable, and the highest-value use.
- **This change added code that no test executed.** Sound, and the best form of the metric —
  [chunk 07b](07b-coverage-in-ci.md).
- **Coverage of this module has fallen since last week.** Sound, if the configuration is fixed,
  and exactly what a floor protects.

Three real capabilities. All of them read the low end of the scale or a delta. None of them is a
percentage on a dashboard.

## Where this connects

- **[06b · try/catch is invisible](06b-try-catch-is-invisible.md)** — question 3, in full.
- **[06c · The class that reads 0%](06c-the-zero-percent-class.md)** — question 6, in full.
- **[01 · What coverage measures](01-what-coverage-measures.md)** — where the one-directional
  argument was set up.
- **[07b · Coverage in CI](07b-coverage-in-ci.md)** — the form of the metric that survives all
  seven objections.
- **11 · Mutation testing** *(not written yet)* — the answer to questions 1 and 2, and the
  topic that follows this one.

## Gotchas

**★ A coverage percentage on a dashboard is read by people who will never see its caveats.**
The number travels; the counter, exclusion list and merge policy do not. Once "we're at 82%" is in
a slide, it has become a fact about quality in the reader's mind, and correcting it later costs
more than qualifying it at source. Publish the counter and the scope alongside the number or do
not publish the number.

**★ 100% branch coverage does not mean the combinations were tested.**
Two independent `if`s have four paths and four branch outcomes; two tests can cover every outcome
while walking half the paths. The compounding case — two discounts both applying — is exactly
where the bug is and exactly what no JaCoCo counter reports.

**★ Error paths are invisible to the counter you should be gating on.**
Exception handling is not a branch by definition and does not increase complexity. A codebase with
exemplary error handling and a codebase with none can report the same branch coverage and the same
complexity, which makes the number actively misleading rather than merely incomplete.

**★ Deleting a class because it reads 0% is how an incident starts.**
Four distinct causes render identically as 0%: genuinely untested, excluded at the agent, class id
mismatch, and executed in another JVM. JaCoCo's FAQ is explicit that the report cannot distinguish
the second from the first. Confirm with the Sessions page and with a grep for references before
deleting anything.

**★ Comparing coverage between two projects is meaningless and is done in every engineering review.**
Different counters, exclusions, filter sets, merge policies and code shapes. A service at 60%
branch coverage with no exclusions is very likely better tested than one at 90% instruction
coverage with generated code excluded, and the ranking presented will be the reverse.

**★ Comparing a project to itself over time breaks on a JaCoCo upgrade.**
Filters arrive in releases and change the denominator ([chunk 05c](05c-what-jacoco-filters-for-free.md)).
A trend line across an upgrade has a step in it that has nothing to do with testing, and trend
lines are exactly what get shown to management.

**★ A strong assertion and a weak one produce identical coverage.**
`isNotNull()` and `isEqualTo(expected)` cover the same lines and the same branches. The entire
difference in value between a suite that catches regressions and one that does not is invisible to
the instrument, which is the single best argument for mutation testing.

**★ "We need to get coverage up" is almost always a proxy for a question coverage cannot answer.**
The real concern is usually "I do not trust this suite" or "we keep shipping regressions in this
module". Both are better served by looking at what the tests assert, by per-change coverage, and by
mutation testing on the module in question, than by a global target.

**★ The three things coverage genuinely tells you are all at the low end or are deltas.**
Nothing was reached; this change was not covered; it fell since last week. If a proposed use of the
number is not one of those three, it is worth asking what question is really being asked.

## Interview questions

**★ What questions can a coverage report not answer?**
Whether anything was asserted; whether a bug would be caught; whether error paths were exercised,
since exception handling is not counted as a branch; whether combinations of decisions were walked,
since branch coverage is per-outcome and not per-path; whether the code is correct; whether code at
0% is dead or merely unreached by this configuration; and whether any given percentage is good. The
three it does answer well are all at the low end: this was never reached, this change was not
covered, and coverage fell since last week.

**★ You have 100% branch coverage on a class and a bug ships from it. Give three explanations that are consistent with both facts.**
The tests take both arms of every decision but assert weakly or not at all, so a wrong value passes.
The bug is in a *combination* of decisions — both branches individually covered, the path where
they interact never walked. Or the bug is on an error path: exception handling is not a branch, so
a catch block that does the wrong thing costs nothing in branch coverage and the counter reported
100% while that code was never exercised at all.

**★ Is 78% coverage good?**
There is no answer without the counter, the exclusion list, the JaCoCo version, whether integration
coverage is merged in, and the shape of the codebase. 78% instruction coverage with generated code
excluded is a very different claim from 78% branch coverage with nothing excluded. The only
defensible comparisons are the same project against itself with a fixed configuration — and even
that has a step in it whenever JaCoCo is upgraded and adds filters.

**★ A class reports 0% coverage. Can you delete it?**
Not on that basis alone. Four different situations render identically: no test reaches it; it was
excluded at the agent rather than the report, which JaCoCo's FAQ says the generator cannot
distinguish from non-execution; the class files changed between the run and the report so class ids
do not match; or it executes in a JVM that has no agent, such as inside a container. Confirm from
the report's Sessions page and from static references before deleting.

**★ Your manager wants a single quality number and coverage is what's available. What do you propose?**
That coverage be reported as two things it can support rather than one it cannot: the count of
classes at 0%, which is a real finding, and per-change coverage on pull requests, which answers
"did the new code get tested" and is not gameable by the usual patterns. If a single trend number
is unavoidable, use branch coverage with a fixed configuration, publish the counter and the
exclusion list next to it, and annotate the chart wherever JaCoCo was upgraded — because those
steps are filter changes, not team performance.

{/* FOOTER */}
