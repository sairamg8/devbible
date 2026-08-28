---
title: "There are exactly four honest things to do with a flaky test — fix it, make it deterministic, quarantine it with an owner and a date, or delete it — and the reason the third is so rarely done properly is that a quarantine without a date is deletion with extra steps, plus the cost of pretending otherwise"
sidebar_label: "14k · Fix, quarantine or delete"
sidebar_position: 61
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-28 against the JUnit 6.0.3 User Guide — "Tagging and Filtering"
> ([writing-tests/tagging-and-filtering](https://docs.junit.org/6.0.3/writing-tests/tagging-and-filtering.html));
> the JUnit Pioneer `@RetryingTest` documentation
> ([junit-pioneer.org](https://junit-pioneer.org/docs/retrying-test/)) and the Pioneer release
> history ([junit-pioneer releases](https://github.com/junit-pioneer/junit-pioneer/releases));
> the Maven Surefire "Rerun failing tests" page
> ([maven.apache.org](https://maven.apache.org/surefire/maven-surefire-plugin/examples/rerun-failing-tests.html));
> the Develocity flaky-test detection guide
> ([docs.gradle.com](https://docs.gradle.com/develocity/2026.1/guides/flaky-test-detection-guide/)).
> JDK 25, Spring Boot 4.1.0, JUnit Jupiter 6.0.3, Spring Framework 7.0.8.

**[14e](14e-retry-is-not-a-fix.md) argues why retry is not an answer. This is the list of answers
that are, in the order you should try them, and an honest accounting of the retry tooling that
exists — because "never retry" is a slogan, and the useful version of the rule is about whether
the retry produces a record somebody is accountable for reducing.**

## The four honest options, in order

### 1 · Fix it

Find the actual cause with the taxonomy — state ([14](14-flaky-tests.md)), time
([14b](14b-time-and-determinism.md)), waiting ([14c](14c-timing-and-concurrency.md)), concurrency
([14f](14f-concurrency-you-cannot-wait-out.md)), leaks
([14g](14g-leaked-threads-and-executors.md)), environment
([14d](14d-environment.md), [14h](14h-ports-network-and-the-database.md),
[14i](14i-process-globals-and-drift.md), [14j](14j-ci-and-version-drift.md)) — and remove it.
Reproduce with `@RepeatedTest(value = N, failureThreshold = 1)` or randomised ordering
([11b](11b-random-order.md)) so you can tell when you have succeeded.

Most of the time the fix is small: an injected `Clock`, a latch instead of a sleep, a `@TempDir`
instead of a path, an instance field instead of a `static` one.

### 2 · Make it deterministic even if you cannot fix the cause

Sometimes the underlying system is genuinely nondeterministic and the *test* can still be made a
claim. Assert on the invariant rather than on the incidental: that the set of results is correct
rather than its order, that the id resolves rather than that it equals `1`, that the operation
completed rather than that it took under 200 ms. A weaker assertion that always holds is worth
more than a stronger one that holds most of the time — because the stronger one is not being
enforced anyway, it is being rerun.

### 3 · Quarantine — with an owner and a date

Move the test out of the gating build so it stops damaging the signal, while keeping it visible
and keeping someone accountable. Jupiter's tagging is the mechanism
([06d](06d-tagging.md), [06e](06e-tag-expressions-and-filtering.md)):

```java
@Test
@Tag("quarantine")
@DisplayName("payment webhook is idempotent — QUARANTINED 2026-08-28, owner @asmith, "
        + "tracked in PAY-4412, delete or fix by 2026-09-30")
void webhookIsIdempotent() { … }
```

with the gating build excluding the tag and a second, non-gating job running only that tag so the
failures stay visible:

```
# gating build
-Djunit.jupiter.excludeTags=quarantine
# the quarantine job, non-gating
-Djunit.jupiter.includeTags=quarantine
```

🔴 **A quarantine without a date is deletion with extra steps — and worse than deletion**, because
it still consumes CI time, still appears in the coverage number, and still tells a reader of the
codebase that this behaviour is tested when it is not. If nobody will own it and nobody will pick
a date, you have already decided; go to option 4 and be honest about it.

⚠️ `@Disabled("flaky")` is *not* quarantine. A disabled test never runs anywhere, so it never
tells you it has started passing, and it rots silently against a changing codebase. If you use
`@Disabled` it must carry a reason and a tracking reference ([07](07-disabling-and-conditions.md))
— and it is still the weaker option.

### 4 · Delete it

Legitimate, and underused. A test that cannot be made deterministic, that nobody will own, and
that has never caught a defect, is a liability: it costs runtime, it costs attention, and its
green is meaningless. Deleting it makes the coverage number honest and the suite faster. Write the
reason in the commit message so the next person does not resurrect it.

## The third-party options, named honestly

If you are going to do it anyway, do it at the *build* level with the flake recorded, never at the
test level where it disappears.

**JUnit Pioneer `@RetryingTest`** — a `@TestTemplate`-based extension. *"Some tests, e.g. those
depending on external systems, may fail through no fault of the code under test."* Attributes:
`maxAttempts`, `minSuccess` (require N successes, not just one), `suspendForMs`, `onExceptions`
(retry only on named exceptions; by default everything except `TestAbortedException`). Failed
attempts are reported as aborted rather than failed. **Cost:** it is opt-in per test, which is its
best property, and 🔴 **as of 2026-08-28 Pioneer's latest release is 2.3.0 (October 2024),
targeting JUnit 5, with a JUnit-6-compatible 3.0 an open question on its tracker.** On a Boot 4.1
spine it is not currently an option ([14i](14i-process-globals-and-drift.md)).

**Maven Surefire `rerunFailingTestsCount`** — build-level, documented for *"JUnit 4.x (4.12+),
JUnit 5.x, and TestNG"*. The docs are explicit about the intent — *"During development, you may
re-run failing tests because they are flaky"* — and about the reporting: a test that passes on a
rerun is counted as a flake and the summary line gains a `Flakes` count, while *"the running time
of a flaky test will be the running time of the last successful run"*. **Cost:** global, so it
applies to every test including the deterministic ones, and the `Flakes` number is on a green
build, which nobody reads.

**Gradle's test-retry plugin / Develocity** — `org.gradle.test-retry`, whose functionality is
integrated into the Develocity Gradle plugin from version 3.12. **Cost and benefit:** the number
of retries is global, but you can restrict which tests are retried by annotation or class-name
pattern, and — this is the part that makes it defensible — Develocity records the flaky outcome in
the build scan and a tests dashboard, so the flake is *data* rather than a discarded event. A
retry with a dashboard and a flaky-test budget is a managed liability; a retry without one is a
cover-up.

**rerunner-jupiter** — an older `@TestTemplate` extension named in the JUnit issue thread. Its
repository's last push was in March 2022; treat it as unmaintained and verify before adopting.

**The rule that separates the defensible from the indefensible:** does the retry produce a durable
record that someone is accountable for reducing? If yes, it is a stopgap with a feedback loop. If
no, it is a green light wired to nothing.

## Making the decision actually happen

The four options are easy to agree with and hard to execute, because the default behaviour of a
busy team is to do none of them and rerun the build. These are conventions rather than anything
the documentation mandates — but they are the ones that make the difference between a policy and
a wish.

- **A flake gets a ticket the first time it is seen, not the third.** The information — which
  build, which agent, which seed, the stack trace — exists only on the day it fails, and by the
  third occurrence it has been reruns away.
- **The quarantine list has a maximum size.** A cap forces a decision when the next test wants in:
  something must be fixed or deleted to make room. Without a cap, quarantine is an append-only
  log.
- **The quarantine job is somebody's, and it is read.** A non-gating job nobody looks at is
  identical to `@Disabled`.
- **A quarantined test past its date is deleted, not extended.** The date has to be enforced by
  something, or it is a comment.
- **The person who quarantines is the owner by default.** Ownership assigned to a team is
  ownership assigned to nobody.

The measurement worth having is not "how many flakes do we have" but **"how long does a flake live
from first observation to resolution"**, because the first number can be reduced by ignoring
things and the second cannot.

## Gotchas

**★ Configuring a build-level retry globally and forgetting it.**
It now applies to every test in the repository, so the next real one-in-three race is retried into
production. If you must, scope it — Develocity's annotation and class-name filters exist for this.

**★ Treating a "flaky" count on a green build as monitoring.**
Nobody reads a green build. A number is monitoring when something is accountable for reducing it:
a dashboard, a budget, an owner. Otherwise it is a comment.

**★ `@Disabled("flaky")` called quarantine.**
A disabled test runs nowhere, so it never reports that it has started passing and it rots against
a changing codebase. Quarantine means excluded from the gating build and still executed somewhere
visible.

**★ Quarantine with no date and no owner.**
It keeps consuming CI time, keeps inflating the coverage number, and keeps telling readers the
behaviour is tested. That is strictly worse than deleting the test, which at least makes the gap
visible.

**★ Adding Pioneer's `@RetryingTest` to a JUnit 6 project.**
Check the release first: as of 2026-08-28 the newest Pioneer release targets JUnit 5 and there is
no 6-compatible release.

**★ A quarantine list that only ever grows.**
Without a cap, adding a test to quarantine costs nothing, so it becomes the default action and the
list becomes an append-only log of untested behaviour. A maximum size forces the next addition to
displace something.

**★ Waiting for the third occurrence before opening a ticket.**
The build log, the agent, the seed and the stack trace exist on the day it failed. By the third
occurrence the earlier evidence has been discarded by whatever ran the reruns.

**★ Assigning a quarantined test to "the team".**
Nobody's calendar contains it. The person who quarantined it is the owner unless someone else
explicitly accepts it.

**★ Refusing to delete a test on principle.**
A test that cannot be made deterministic, that nobody owns, and that has never caught a defect
costs runtime and attention while asserting nothing. Deleting it is a legitimate engineering
decision; leaving it in the suite to be rerun is not.

## Interview questions

**★ What are the honest options for a flaky test, in order?**
Fix it — diagnose the actual cause and remove it, which is usually a small change: an injected
`Clock`, a latch instead of a sleep, a `@TempDir` instead of a fixed path. Failing that, make the
test deterministic by asserting the invariant rather than the incidental: the set rather than its
order, that the id resolves rather than that it equals one. Failing that, quarantine it out of the
gating build with a tag, an owner and a date, and run it in a visible non-gating job. Failing
that, delete it. Retrying is not one of the four, and quarantine without a date collapses into
deletion anyway, with the extra cost of pretending otherwise.

**★ What makes a quarantine legitimate rather than a way of ignoring the problem?**
Three things: it is out of the gating build so it stops damaging the signal; it still runs
somewhere visible so you find out if it starts passing or gets worse; and it carries a named owner
and a date. Without the date nothing forces the decision, so the test sits there consuming CI time
and inflating the coverage number while telling every reader that a behaviour is tested when it is
not. That is worse than deleting it, because deleting it at least makes the gap honest.

**★ How would you get a team out of a suite that everybody reruns?**
Stop the inflow first: any newly flaky test gets a ticket the day it is first observed, while the
build log, the agent and the seed still exist. Then cap the quarantine list, so that adding the
next test forces something to be fixed or deleted rather than accumulating. Then make the
quarantine job somebody's job and enforce the dates, deleting rather than extending. And measure
the right thing — not the count of flaky tests, which falls when people stop looking, but the time
from a flake's first observation to its resolution, which does not. The order matters: fixing the
backlog while the inflow continues is how teams conclude the problem is unfixable.

**★ When, if ever, is a build-level retry defensible?**
When it produces a durable record that someone is accountable for reducing. Develocity's model —
retry, but record the flaky outcome in the build scan and a tests dashboard, with a budget — turns
each flake into data and each retry into a countdown rather than an ending. What is never
defensible is a retry whose only trace is a number in a green build's summary, or a retry
configured globally and forgotten, because that is a mechanism for shipping real races.

{/* FOOTER */}
