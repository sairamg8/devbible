---
title: "A retry does not fix a flaky test, it converts a signal into silence — and the JUnit maintainers' own reason for declining to build one is the whole argument: rerunning a test does not reset the static state and the leaked threads that made it flaky in the first place"
sidebar_label: "14e · Retry is not a fix"
sidebar_position: 60
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-28 against the JUnit 6.0.3 User Guide — "Repeated Tests"
> ([writing-tests/repeated-tests](https://docs.junit.org/6.0.3/writing-tests/repeated-tests.html));
> javadoc for `InvocationInterceptor`
> ([InvocationInterceptor](https://docs.junit.org/6.0.3/api/org.junit.jupiter.api/org/junit/jupiter/api/extension/InvocationInterceptor.html));
> junit-team/junit-framework issue #1558, *"Introduce support for retrying failed flaky tests"*,
> opened 2018-08-20 and still open
> ([issue 1558](https://github.com/junit-team/junit5/issues/1558)); the JUnit Pioneer
> `@RetryingTest` documentation ([junit-pioneer.org](https://junit-pioneer.org/docs/retrying-test/));
> the Maven Surefire "Rerun failing tests" page
> ([maven.apache.org](https://maven.apache.org/surefire/maven-surefire-plugin/examples/rerun-failing-tests.html));
> the Develocity flaky-test detection guide
> ([docs.gradle.com](https://docs.gradle.com/develocity/2026.1/guides/flaky-test-detection-guide/)).
> JDK 25, Spring Boot 4.1.1, JUnit Jupiter 6.0.3, Spring Framework 7.0.9.

**Everything from [14](14-flaky-tests.md) to [14j](14j-ci-and-version-drift.md) is diagnosis. This
chunk is the argument against the answer everybody reaches for first: "Retry it" is not on the
list of honest options — not because retrying is inelegant, but because it removes the only
evidence you had while leaving the defect in production.** The four answers that *are* honest, and
the third-party retry tools named with their costs, are
[14k](14k-fix-quarantine-or-delete.md).

## What a retry actually does

It reruns the test method. That is the entire mechanism. It does not reset the `static` field
another test mutated, does not stop the executor a previous test leaked, does not roll back the
row, does not clear the `ThreadLocal` on the pooled thread, and does not change the interleaving
that lost the race.

You do not have to take that from me. It is the JUnit maintainers' own stated reason for not
shipping the feature — Marc Philipp on issue #1558, 2021-05-13:

> *"It would be relatively easy to implement this in the platform. However, it might not satisfy
> the needs of all users since static state, threads that leaked from prior tests and might have
> caused the flakiness doesn't get reset."*

Read that against [14](14-flaky-tests.md) and [14g](14g-leaked-threads-and-executors.md): the two
things it names are the two largest categories of flake in the taxonomy. A retry is a mechanism
that is structurally incapable of addressing the majority of the cases it is deployed against.
Where it does "work", it works by drawing the coin again.

## Why it is worse than doing nothing

**It destroys the failure, which was the only artefact you had.** A flake that fails once a week
gives you, once a week, a stack trace and a report. A retried flake gives you a green build. You
have traded the one input to the diagnosis for the appearance of health.

**A pass-after-retry is reported as a pass.** Whatever count of "flaky" your build tool prints is
a number in a summary nobody reads on a green build. Green builds are not read; that is what
green means.

**It generalises.** The retry is configured once, usually globally, and then applies to every
test. The next genuine, deterministic, one-in-three failure — a real race that would have been
caught in the pull request — is retried too, and ships.

**It teaches the habit, and the habit is the real cost.** [14](14-flaky-tests.md) makes this
argument: one tolerated flake trains the team to treat red as noise, and that reflex is then
applied to genuine failures. An automated retry does the same thing without even requiring a human
to form the habit. Every deterministic test in the repository is collateral damage.

**It hides a production bug.** This is the one people forget. A test that races is very often
racing because *the code* races ([14f](14f-concurrency-you-cannot-wait-out.md)). Retrying until
green means shipping a system that fails one request in a thousand, discovered by a customer
instead of by CI.

## 🔴 `@RepeatedTest` is not a retry mechanism

They are frequently confused and they are opposites.

| | `@RepeatedTest` | A retry |
|---|---|---|
| Runs | exactly N times | until it passes, up to N |
| A failure in one run | is reported as a failure | is discarded if a later run passes |
| Purpose | *"repeat a test a specified number of times"* | make a failing test report as passing |
| Effect on signal | multiplies it | removes it |

The guide's own words:

> *"JUnit Jupiter provides the ability to repeat a test a specified number of times by annotating
> a method with `@RepeatedTest` and specifying the total number of repetitions desired."*

Every repetition is reported independently, and one failing repetition fails the build. The
`failureThreshold` attribute does not forgive failures either — it *skips the remaining
repetitions* once the threshold is reached, which is the opposite of forgiveness: it exists so a
flake hunt can stop at the first reproduction ([14](14-flaky-tests.md)).

So `@RepeatedTest` is a tool for **proving** flakiness. If someone shows you
`@RepeatedTest(3)` presented as a retry, it is not one; it has tripled the chance the build goes
red.

## What JUnit itself offers, and why

**Nothing.** Jupiter has no retry annotation and no built-in rerun. The request is
[issue #1558](https://github.com/junit-team/junit5/issues/1558), opened on 2018-08-20 and still
open at the time of writing with no milestone, labelled `type: new feature` and
`status: waiting-for-interest`. (⚠️ The project does not publish a description for that label, so
I am reporting the label and not interpreting it.)

The thread is worth reading because it contains a genuine disagreement inside the team rather than
a policy statement. Sam Brannen, the day after it was filed:

> *"No, to my knowledge there are not currently any plans to implement such a feature. But… I
> think it's a very good idea."*

Christian Stein, the same day:

> *"I don't like flaky tests (read: checks). Who does? I don't like the idea of "fixing" flaky
> tests by (naiv, smart, conditional, [what|for]-ever) re-execution. I don't want to support that
> in Jupiter."*

And the team's recorded decision, 2018-09-07:

> *"**Team Decision:** As a first step, we think this should be maintained externally as an
> extension based on `@TestTemplate`. We might potentially introduce support for rerunning flaky
> tests in core, but then it should support all kinds of testable methods, including
> `@ParameterizedTests`. We'd be happy to provide guidance and review such an extension, whether
> in the rerunner project, junit-pioneer or another project."*

### Why you cannot bolt one on with an interceptor

People reach for `InvocationInterceptor` and discover the contract forbids it:

> *"Each method in this class must call `InvocationInterceptor.Invocation.proceed()` or
> `InvocationInterceptor.Invocation.skip()` exactly once on the supplied invocation. Otherwise,
> the enclosing test or container will be reported as failed."*

Exactly once — so you cannot invoke the test a second time. Marc Philipp, on the same issue:

> *"Implementing this using `InvocationInterceptor` is very limited since it does not provide the
> option to repeat the previous lifecycle steps."*

That is why every real retry extension is built on `@TestTemplate`, which can produce multiple
invocation contexts and therefore re-run `@BeforeEach` and friends. It is also why a retry written
in an afternoon usually retries the test method without its setup, which is a *different* test.

## So what do you do instead

Four answers, in order: fix it, make it deterministic, quarantine it with an owner and a date, or
delete it. Each of them, what it means concretely, and the third-party retry tooling named with
what it actually costs, is [14k](14k-fix-quarantine-or-delete.md).

## Gotchas

**★ Believing a retry addresses the cause.**
It reruns the method. The JUnit maintainers' own objection: *"static state, threads that leaked
from prior tests and might have caused the flakiness doesn't get reset."* The two things it names
are the two biggest categories in the taxonomy.

**★ Using `@RepeatedTest(3)` as a retry.**
It runs three times and reports all three; one failure fails the build. It is the opposite of a
retry, and someone who adds it expecting forgiveness has just tripled their red-build rate.

**★ Reading `failureThreshold` as "allowed failures".**
It skips the *remaining repetitions* after N failures. It is a stop condition for a flake hunt,
not an allowance.

**★ Writing a retry extension with `InvocationInterceptor`.**
The javadoc forbids it: each method *"must call… `proceed()` or… `skip()` exactly once… Otherwise,
the enclosing test or container will be reported as failed."* Real retry extensions use
`@TestTemplate`.

**★ A hand-rolled retry that reruns the method without the lifecycle.**
`@BeforeEach` does not run again, so the second attempt executes against the first attempt's
mutated fixture. That is a different test, and it can pass for reasons the real one never would.

**★ Retrying a test whose flake is a race in production code.**
The green build ships a system that fails a fraction of real requests. The test was the cheapest
place you were ever going to find that ([14f](14f-concurrency-you-cannot-wait-out.md)).

## Interview questions

**★ Why not just add a retry extension?**
Because a retry does not touch the cause. It reruns the method; it does not reset the `static`
field a previous test mutated, stop a leaked executor, roll back a row, or change the interleaving
that lost the race — which is precisely the objection the JUnit maintainers give on issue #1558
for not shipping one. So on the majority of flake categories it is structurally incapable of
helping, and where it appears to help it is drawing the coin again. Meanwhile it consumes the
only artefact you had (the failure), it reports a pass, and once configured globally it will
silently retry a genuine one-in-three race into production.

**★ Does JUnit have built-in retry support, and what is the project's position?**
No. The feature request is issue #1558, open since August 2018 with no milestone. The thread
records a real split: Sam Brannen said there were no plans but that he thought it a good idea;
Christian Stein wrote *"I don't like the idea of 'fixing' flaky tests by… re-execution. I don't
want to support that in Jupiter."* The recorded team decision was that it *"should be maintained
externally as an extension based on `@TestTemplate`"*, with the caveat that a core implementation
would have to cover all testable methods including parameterized ones. Nothing in the 6.0.x
release notes changes that.

**★ Is `@RepeatedTest` a retry mechanism?**
No — it is the opposite. `@RepeatedTest(N)` runs the test exactly N times and reports every
repetition; a single failing repetition fails the build. It multiplies the signal rather than
suppressing it, which is why it is the right tool for *reproducing* a flake, especially with
`failureThreshold = 1` so the run stops at the first failure. Anyone using `@RepeatedTest` hoping
a later pass will excuse an earlier failure has increased their red-build rate.

**★ How would you write a retry extension if you had to, and what would go wrong?**
It has to be a `@TestTemplate` provider, not an `InvocationInterceptor` — the interceptor javadoc
requires each method to call `proceed()` or `skip()` *exactly once*, so a second invocation is
forbidden, and Marc Philipp notes on the issue that the interceptor also cannot repeat the
preceding lifecycle steps. That last point is the trap in most hand-rolled attempts: they rerun
the test method without rerunning `@BeforeEach`, so the retry executes against the fixture the
failed attempt already mutated. It is then not a rerun of the same test at all, and it can pass
for reasons that have nothing to do with the behaviour under test.

{/* FOOTER */}
