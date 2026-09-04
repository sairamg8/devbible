---
title: "Four statuses mean the run misbehaved and all four count as detected, so the worse a pitest run goes the better the score looks: TIMED_OUT is decided by a wall-clock comparison on a shared machine, RUN_ERROR is the fallback branch of an exit-code switch, MEMORY_ERROR can be caused by the run rather than the mutant, and NON_VIABLE means the JVM refused to load a class you are being credited for detecting"
sidebar_label: "04d · Not findings"
sidebar_position: 29
---

<span className="db-tier t-when">When Needed</span>

> Verified: 2026-09-01 against pitest's
> [Basic concepts](https://pitest.org/quickstart/basic_concepts/) page — the definitions of *Timed Out*,
> *Non viable*, *Memory error* and *Run error* and the sentence *"Under normal circumstances you should
> see no non viable mutations or run errors"*, quoted verbatim — the
> [FAQ](https://pitest.org/faq/) entries *"I'm seeing a lot of timeouts, what's going on?"* and
> *"My tests normally run green but PIT says the suite isn't green"*, the
> [Maven quick start](https://pitest.org/quickstart/maven/) entries for `jvmArgs`, `timeoutFactor` and
> `timeoutConstant`, and pitest 1.30.0 source read at the `1.30.0` tag:
> `org.pitest.mutationtest.DetectionStatus` (constructor arguments, javadocs and
> `getForErrorExitCode`), `MutationStatusMap`, `build/MutationTestUnit` and
> `pitest-html-report/.../ConfidenceMap.java`.
> Version spine from `spring-boot-dependencies:4.1.1`: JDK 25, Spring Boot 4.1.1, JUnit Jupiter 6.0.3,
> Testcontainers 2.0.5.
> ⚠️ **No sandbox and no build on this machine.** Status semantics are read from published source and
> documentation. **No status count, score or timing on this page came from a run.**

**[04](04-reading-a-report.md) sorted the ten statuses into findings and not-findings. This chunk is the
not-findings, and they matter more than their name suggests, because all four carry `detected = true` —
which produces the most dangerous property mutation testing has: the worse a run goes, the better the
score looks. A shared CI agent manufactures timeouts; a bad `jvmArgs` line manufactures run errors; an
under-provisioned minion manufactures memory errors, and each of them lands in the numerator. Looking at
these four counts before quoting a score is the difference between a measurement and a number.**

## The four, and where each comes from

Three of the four are decided by how a minion process ended, in one switch:

```java
public static DetectionStatus getForErrorExitCode(final ExitCode exitCode) {
  if (exitCode.equals(ExitCode.OUT_OF_MEMORY)) {
    return DetectionStatus.MEMORY_ERROR;
  } else if (exitCode.equals(ExitCode.TIMEOUT)) {
    return DetectionStatus.TIMED_OUT;
  } else {
    return DetectionStatus.RUN_ERROR;
  }
}
```

`RUN_ERROR` is the **`else` branch** — whatever killed the child JVM that was not an out-of-memory and
not a timeout. That is worth internalising: it is not a diagnosis, it is the absence of one.

## `TIMED_OUT` — a wall-clock comparison, classified as a kill

```java
/**
 * A test took a long time to run when mutation was present, might indicate an
 * that the mutation caused an infinite loop but we don't know for sure.
 */
TIMED_OUT(true),
```

*"we don't know for sure"*, and counted as detected anyway. The comparison is
`normal time * timeoutFactor + timeoutConstant` — 1.25 and 4000 ms by default — between two measurements
taken minutes apart, with pitest running a different subset of tests in a different order for every
mutant ([02c](02c-timeouts-and-determinism.md)).

There is a legitimate case: `INCREMENTS` removing a loop counter's step really does hang, and no
assertion could "kill" a test that never returns. Pitest filters most of those before they run —
`FINFINC`, `FFLOOP` and `FINFIT` ([03d2d](03d2d-remove-increments.md)) — which is exactly why a run
producing *many* timeouts is usually producing spurious ones.

**The rule:** read the `TIMED_OUT` count against the `KILLED` count before quoting a score. If timeouts are a meaningful fraction, the number is partly a measurement of your build agent's load, and it will be highest on the busiest agent.

## `RUN_ERROR` — the status that means "look at your configuration"

Pitest's documentation is direct:

> *"A run error means something went wrong when trying to test the mutation. Certain types of non viable
> mutation can currently result in an run error. If you see a large number of run errors this is
> probably be an indication that something went wrong."*

and, of this status together with `NON_VIABLE`:

> *"Under normal circumstances you should see no non viable mutations or run errors."*

Since it is the fallback branch of an exit-code switch, the causes are open-ended, but they cluster:

- **`jvmArgs` the minions cannot honour** — a flag valid on the parent JVM and not on the child, or one
  removed in the JDK you upgraded to.
- **An agent that does not survive being forked** — a profiler, a coverage agent, an APM agent attached
  via `argLine`. Note that the Maven plugin copies surefire's `argLine` by default
  ([05 · Wiring it up](05-wiring-it-up.md)), so an agent you configured for surefire is attached to every
  minion whether you meant it or not.
- **A classpath problem that only manifests in the child process** — the shape of the stale JUnit
  Platform plugin case in [01b](01b-the-tool-and-its-versions.md).
- **A test framework or runner pitest cannot drive.** The FAQ warns about this under a different
  heading: *"If you are using an unusual or custom JUnit runner this can also sometimes cause problems.
  To make things fast PIT does some tricky stuff to split your tests into small independent units."*

All of those are configuration failures, and every one of them **raises your mutation score**, because
`RUN_ERROR(true)`. A run in which every minion dies immediately reports an excellent number.

## `MEMORY_ERROR` — sometimes about the mutant, sometimes about the run

```java
/**
 * JVM ran out of memory while processing a mutation. Might indicate that the
 * mutation increases memory usage but we don't know for sure.
 */
MEMORY_ERROR(true),
```

The documentation names both causes:

> *"A memory error might occur as a result of a mutation that increases the amount of memory used by the
> system, or may be the result of the additional memory overhead required to repeatedly run your tests
> in the presence of mutations. If you see a large number of memory errors consider configuring more
> heap and permgen space for the tests."*

So it is not necessarily a statement about the mutated code at all. The documented remedy is heap for the
**child** JVMs:

```xml
<configuration>
  <jvmArgs>
    <jvmArg>-Xmx2g</jvmArg>
  </jvmArgs>
</configuration>
```

⚠️ `jvmArgs` are the minions' arguments, not the Maven JVM's. On Gradle the distinction is explicit and
easy to get wrong in the other direction: `jvmArgs` is for the mutation-testing processes and
`mainProcessJvmArgs` for the PIT process itself ([05b · Gradle](05b-gradle.md)).

This status is also one of the two places a Spring codebase gets hit hardest, for the same reason as
timeouts: a minion that builds an application context has a much larger footprint than one running a
plain unit test, and pitest runs a different subset of tests per mutant so the context cache behaves
differently from a normal `mvn test` ([05 · The test pyramid](../05-the-test-pyramid/README.md)).

## `NON_VIABLE` — the JVM refused it, and you are credited with detecting it

```java
/**
 * Mutation could not be loaded into the jvm. Should never happen.
 */
NON_VIABLE(true),
```

*"Should never happen"* is the javadoc, and the docs agree — *"PIT tries to minimise the number of
non-viable mutations that it creates."* The `INLINE_CONSTS` integer rules are that effort made visible:
the reason a `0` is only ever replaced with a `1` is that the JVM represents small integers and booleans
identically, and a wider substitution would produce a class the verifier rejects
([03d2c](03d2c-inline-constants.md)).

Counting it as detected is the least bad option, and the reasoning is worth having ready: no test could
ever have run against a class that would not load, so scoring it as *survived* would penalise a suite for
a mutant that never existed as a runnable program, and a third category would have to be understood by
every consumer of the number. But note what it does in the HTML report: `ConfidenceMap` puts `NON_VIABLE`
in the **high-confidence** set, so it renders as `killed` — the same green as a real kill
([04a](04a-the-html-report.md)).

A cluster of non-viable mutants is a signal about the operator set or a plugin, not about the tests.

## The `EQUIVALENT` constant, and its missing code path

```java
/**
 * Mutation is equivalent to the un-mutated code. Treated as detected
 * although by definition it cannot be.
 */
EQUIVALENT(true);
```

⚠️ **I could not find any code path in pitest's 1.30.0 open-source engine that assigns this status.**
`MutationStatusMap` assigns `NOT_STARTED` and `NO_COVERAGE`; `MutationTestUnit` initialises to
`NOT_STARTED` and applies what comes back from minions. The likeliest reading is that it exists for
plugins — arcmutate's equivalence detection is the obvious candidate — but pitest's documentation does
not say so and I am not going to state it as fact. What the javadoc does establish is the intended
policy: a mutant *known* to be equivalent counts as detected, because it is not a failure of the tests
([04b](04b-equivalent-mutants.md)).

The two internal states, `NOT_STARTED(false)` and `STARTED(false)`, are documented as *"For internal use only"* and should never appear in output. If they do, the run did not finish.

## Where this connects

- **[04 · Reading a report](04-reading-a-report.md)** — the full status table, and the two statuses that are findings.
- **[04a · The HTML report](04a-the-html-report.md)** — the blue-grey `uncertain` class, which is exactly these statuses minus `NON_VIABLE`.
- **[04c · The score arithmetic](04c-the-score-arithmetic.md)** — the numerator these four inflate.
- **[02c · Timeouts and determinism](02c-timeouts-and-determinism.md)** — the timeout formula and why it misfires on a Spring stack.
- **[03d2d · `REMOVE_INCREMENTS`](03d2d-remove-increments.md)** — the shape-based filters that remove genuine loop-hanging mutants before they can time out.
- **[05 · Wiring it up](05-wiring-it-up.md)** — `jvmArgs`, and the surefire `argLine` that pitest copies into every minion.
- **[01b · The tool and its versions](01b-the-tool-and-its-versions.md)** — the configuration failure that presents as a test-quality finding.

## Gotchas

**★ A high `TIMED_OUT` count makes the score go up, and it goes up more on a loaded machine.**
`TIMED_OUT(true)` with a javadoc saying *"we don't know for sure"*. Timeouts are decided by comparing
wall-clock durations against `normal time * 1.25 + 4000ms`, so a busy CI agent manufactures them. If your
mutation score is quietly higher in CI than on a laptop, count the timeouts before celebrating.

**★ A large `RUN_ERROR` count is a broken configuration, not a test-quality finding — and it inflates the score.**
`RUN_ERROR` is the fallback branch of `getForErrorExitCode`: whatever killed the minion that was not a
timeout or an out-of-memory. Pitest's own docs say a large number *"is probably be an indication that
something went wrong"*. Because it counts as detected, a run where every minion dies immediately can
report an excellent score.

**★ `MEMORY_ERROR` can be caused by the run rather than by the mutant.**
The docs attribute it both to a mutation that increases memory use *and* to *"the additional memory
overhead required to repeatedly run your tests in the presence of mutations"*. So it is not necessarily a
statement about the mutated code at all. The documented response is more heap for the child JVMs via
`jvmArgs`, not a change to any test.

**★ `jvmArgs` configures the minions, not the build's JVM.**
Raising Maven's own heap does nothing for a `MEMORY_ERROR`, because the failure is in a forked child.
The Gradle plugin makes the distinction explicit with a second property, `mainProcessJvmArgs`, and its
own documentation notes that *"PIT itself launches another Java processes for mutation testing
execution"* — which is exactly the confusion the two names exist to prevent.

**★ An agent attached through surefire's `argLine` is attached to every pitest minion.**
The Maven plugin's `parseSurefireArgLine` defaults to `true`, so a coverage, profiling or APM agent
configured for surefire is inherited by the child JVMs. If that agent does not tolerate being attached
hundreds of times to short-lived processes, the result is a wall of `RUN_ERROR` — a configuration failure
that reports as a high mutation score.

**★ `NON_VIABLE` renders green in the HTML report.**
`ConfidenceMap`'s high-confidence set is `KILLED`, `SURVIVED`, `NO_COVERAGE` and `NON_VIABLE`, and
`LineStyle` maps anything detected-and-high-confidence to the `killed` class. So a mutant the JVM refused
to load is the same colour as one a test killed. The per-mutant list underneath is where the real status
is.

**★ The blue-grey `uncertain` colour is your fastest check that a run misbehaved.**
`TIMED_OUT`, `MEMORY_ERROR`, `RUN_ERROR` and `EQUIVALENT` all render as `uncertain`. Scanning a few
source pages for blue-grey takes seconds and tells you whether the numbers are worth reading at all —
which is a better first move than opening the summary.

**★ `EQUIVALENT` appears to have no assigning code path in the open-source engine.**
Its javadoc says *"Treated as detected although by definition it cannot be."* I could not find where
1.30.0 sets it. Treat a report containing `EQUIVALENT` entries as evidence that a plugin is installed,
and find out which one before trusting the number it produced.

**★ The four not-findings are the reason a mutation score should never be read without its breakdown.**
Every one of them is `detected = true`, and every one of them corresponds to something going wrong. That
is a metric whose failure mode is to *improve* under adverse conditions — the opposite of what people
assume — and it is the strongest argument in this topic for treating the per-status counts as the real
output and the percentage as a summary.

## Interview questions

**★ Why does a pitest run that goes badly report a better mutation score?**
Because four of the statuses that mean "something went wrong" are classified as detected. `TIMED_OUT`,
`RUN_ERROR`, `MEMORY_ERROR` and `NON_VIABLE` all carry `detected = true` in `DetectionStatus`, so each
one lands in the numerator. A loaded CI agent stretches mutated tests past `normal time * 1.25 + 4000ms`
and produces timeouts; a `jvmArgs` flag the child JVM cannot honour, or an agent inherited from
surefire's `argLine`, kills minions and produces run errors; an under-provisioned minion produces memory
errors. The enum's own `isDetected` javadoc concedes it *"ignores the slight ambiguity of some of the
statuses"*. It is why the per-status counts are the real output of a run and the percentage is a summary
you should not quote without them.

**★ You inherit a build whose pitest report shows 40% run errors. What is your first move?**
Not looking at the tests. `RUN_ERROR` is the `else` branch of pitest's exit-code switch — everything that
killed a minion and was not a timeout or an out-of-memory — and pitest's docs say a large number *"is
probably be an indication that something went wrong"* and that normally you should see none. I would look
at, in order: `jvmArgs` and anything inherited from surefire's `argLine`, because the Maven plugin copies
it by default and any agent in there is attached to every minion; the test-plugin situation, since a
mismatched JUnit Platform plugin produces exactly this shape of failure; and any custom runner, which the
FAQ warns about because pitest splits tests into small independent units. And I would note that the
reported mutation score is meaningless until it is fixed, since every one of those run errors is counted
as a kill.

**★ How do you tell a real timeout from a spurious one?**
By what produced it and how many there are. A real one comes from a mutant that genuinely makes the code
loop forever — the canonical case is removing a loop counter's increment — and pitest filters most of
those before dispatch with `FINFINC`, `FFLOOP` and `FINFIT`, which match on the *shape* of the mutated
bytecode rather than on the operator name. So on idiomatic code, real timeouts are rare, and a run with
many of them is producing spurious ones. Spurious timeouts come from the formula itself: it compares
wall-clock durations taken minutes apart, and pitest runs a different subset of tests in a different
order per mutant, so class-loading and Spring context-building costs land on different tests than they
did during the coverage pass. The tell is a wave of them concentrated in classes covered by slice or
container-backed tests, and a score that is higher in CI than locally.

**★ Why is `NON_VIABLE` counted as detected, and why does it show green in the report?**
Counted as detected because the alternative is worse: the class would not load, so no test could ever
have run against it, and scoring it as survived would penalise a suite for a mutant that never existed as
a runnable program. Green in the report because `ConfidenceMap`'s high-confidence set contains
`KILLED`, `SURVIVED`, `NO_COVERAGE` and `NON_VIABLE` — "high confidence" there means pitest is sure of
the outcome, not that a test did anything — and `LineStyle` renders anything detected-and-high-confidence
with the `killed` class. It is tolerable because pitest works hard to produce almost none of them; its
javadoc literally says *"Should never happen"*, and the documentation says you should normally see none.
A cluster of them is a signal about your operator set or a plugin.

**★ A colleague reports a mutation score that improved after a CI upgrade with no test changes. What do you check?**
The per-status counts, in this order. Timeouts first, because `TIMED_OUT` counts as detected and is
decided by a wall-clock comparison — a slower or busier agent produces more of them and therefore a higher
score. Then run errors and memory errors, which are also classified as detected and which a changed JVM,
changed heap settings or a changed agent can start producing in bulk. Then the operator set and the
pitest version, since either changes the denominator. Only when all of those are unchanged is an
improvement in the score evidence of anything about the tests — and even then I would want to see which
survivors disappeared.

{/* FOOTER */}
