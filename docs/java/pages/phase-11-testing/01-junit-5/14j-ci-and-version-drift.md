---
title: "The last family of flakes needs no change to your code at all — a different core count changes the interleavings, a shared agent is unevenly rather than uniformly slow, and a JDK upgrade once replaced the space before AM with a character no terminal will show you in a diff"
sidebar_label: "14j · CI and version drift"
sidebar_position: 59
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-28 against javadoc for `java.lang.Runtime`
> ([Runtime](https://docs.oracle.com/en/java/javase/25/docs/api/java.base/java/lang/Runtime.html));
> the OpenJDK quality outreach note on Unicode CLDR 42 in JDK 20–23
> ([inside.java](https://inside.java/2024/03/29/quality-heads-up/)); the Oracle JDK 23 release
> notes on the removal of the COMPAT locale provider, JDK-8174269
> ([23all-relnotes](https://www.oracle.com/java/technologies/javase/23all-relnotes.html));
> the JUnit 6.0.3 User Guide — "Parallel Execution"
> ([writing-tests/parallel-execution](https://docs.junit.org/6.0.3/writing-tests/parallel-execution.html)).
> JDK 25, Spring Boot 4.1.1, JUnit Jupiter 6.0.3, Spring Framework 7.0.9.

**[14i](14i-process-globals-and-drift.md) is the globals inside your process. This is everything
outside it: the machine the suite runs on, and the versions of the things it runs against. Both
produce failures with no commit to blame, which is why they are the last place anybody looks and
frequently where the answer was.**

## CI is not your laptop

Three specific differences, and [12f](12f-diagnosing-a-parallel-failure.md) argues them in the
parallel-execution context. Restated here as environment:

**Core count, and it is not a constant.** The `Runtime.availableProcessors()` javadoc:

> *"This value may change during a particular invocation of the virtual machine. Applications that
> are sensitive to the number of available processors should therefore occasionally poll this
> property and adjust their resource usage appropriately."*

Under a container CPU quota the JVM reports the quota, not the host's core count, so your
sixteen-core laptop and a two-CPU agent produce very different parallelism from the same
`dynamic` strategy ([12b](12b-parallelism-configuration.md)) — different interleavings, different
races exposed, and different wall-clock timings for anything you were foolish enough to assert on.

**Contention.** A shared agent runs your build beside other people's. Everything is slower and
*unevenly* slower, which is what breaks a tuned timeout rather than a uniform slowdown would.

**Cold everything.** No warm page cache, no JIT-compiled code, an empty dependency cache, a fresh
container image. The first execution of anything is dramatically slower than the tenth, and a
suite that only runs once never leaves that regime.

## Making a CI-only failure reproducible

"It only fails on CI" is a statement about which variables you have not copied yet. Copy them, one
at a time, in this order — each step is cheap and each one either reproduces the failure or
eliminates a hypothesis.

1. **The order.** Run the whole suite, not the class. Then run it with randomised method and class
   ordering and the seed logged ([11b](11b-random-order.md)). A large share of CI-only failures
   are order dependence that your IDE's stable ordering hides.
2. **The parallelism.** Set the same `junit.jupiter.execution.parallel.*` values CI uses — the
   fixed number, not the `dynamic` factor, because the factor resolves differently on your
   machine ([12b](12b-parallelism-configuration.md)).
3. **The core count.** Run the build inside a container with the agent's CPU limit. This is the
   only way to reproduce a `dynamic`-strategy difference honestly.
4. **The JVM arguments.** Copy the agent's `argLine` / `jvmArgs`, including `-Xmx` and the time
   zone and locale pins ([14i](14i-process-globals-and-drift.md)).
5. **The JDK.** Exact vendor and version, not "also 25".
6. **A clean checkout and a clean local repository.** This is what catches a test that depends on
   an artefact only your machine has built, or a file only your working tree contains.

If none of the six reproduces it, the remaining candidates are wall-clock timing under contention
and a genuine race — and at that point the tool is
`@RepeatedTest(value = N, failureThreshold = 1)` ([14](14-flaky-tests.md)) under the CI
configuration, not more staring at the code.

⚠️ **Check the tests actually ran.** A build tool that considers the test task up to date, or a
test filter left in a configuration file, produces a green build in which nothing executed. Read
the executed-test count, not the colour — a suite that "started passing" between two runs with no
change is this until proven otherwise.

## Version drift

The last category: the code did not change and the result did.

**The JDK.** The most instructive example is real and recent. JDK 20 updated to Unicode CLDR 42,
which introduced *"more sophisticated handling of spaces"* — replacing the ordinary space before
an AM/PM marker (and in some unit and Cyrillic date formats) with a non-breaking space ` ` or
a narrow non-breaking space ` `. Any test comparing a formatted time against a string literal
typed on a keyboard broke, and the diff is invisible in a terminal. The escape hatch
`-Djava.locale.providers=COMPAT` worked on JDK 20–22 and **was removed in JDK 23**, so on a JDK 25
stack it is not available: the fix is to stop asserting on locale-formatted strings, or to build
the expected value with the same `DateTimeFormatter` rather than by typing it.

The general rule follows from the specific one: **the JDK version is an input to your tests.**
Pin it with a build toolchain so the laptop and the agent agree, and treat a JDK upgrade as a
change that can legitimately turn tests red.

**Dependencies.** Version ranges, `-SNAPSHOT` dependencies and `:latest` container tags all mean
"whatever was published most recently", which makes your build a function of time. Boot's BOM
removes most of this for managed libraries; it does not cover what you pin yourself. Container
images used by tests should carry an explicit tag, and a digest if the tag is mutable.

**Your own build tool.** Fork configuration, argLine, parallelism settings and the working
directory differ between the IDE and the build, and between Maven and Gradle
([14](14-flaky-tests.md) covers forking). "Green in the IDE" is a different experiment from
"green in CI".

## Gotchas

**★ Believing `availableProcessors()` reports the host's cores.**
Under a container CPU quota it reports the quota, and the javadoc warns the value *"may change
during a particular invocation of the virtual machine."* Your parallelism, and therefore your
interleavings, differ between laptop and agent.

**★ Tuning a timeout against CI's *average* slowness.**
A shared agent is unevenly slow, not uniformly slow. The distribution's tail is what fires the
timeout, and the tail is set by co-tenants you cannot see.

**★ Asserting on a locale-formatted date or time string.**
CLDR data changes between JDK releases — JDK 20 replaced the space before AM/PM with a
non-breaking or narrow non-breaking space, a change no terminal will show you in a diff. Build the
expected value with the same formatter, or assert on the `TemporalAccessor` rather than on text.

**★ Expecting `-Djava.locale.providers=COMPAT` to rescue you.**
It was removed in JDK 23; on JDK 25 specifying it has no effect. There is no way back to the
pre-CLDR locale data.

**★ A `-SNAPSHOT` or a `:latest` tag anywhere near a test.**
The build becomes a function of the time it ran. A test that fails on a Tuesday and passes on a
Wednesday with no commit between them is this, until proven otherwise.

**★ Running a different JDK locally than CI does.**
Charset defaults, CLDR data, garbage collector defaults and JIT behaviour all differ. Use a build
toolchain so the version is declared in the repository rather than in whoever's shell.

**★ Reading the build's colour instead of its executed-test count.**
An up-to-date test task, a cached result or a stray test filter produces a green build in which no
test ran. "It passes now" with no change between runs is almost always this.

**★ Reproducing a CI-only failure by rerunning the single failing class.**
That removes the two most likely causes — the other tests and the parallelism — before you start.
Reproduce with the whole suite, randomised ordering, and the CI parallelism configuration.

**★ Copying CI's `dynamic` parallelism factor rather than its resulting thread count.**
`dynamic` multiplies `availableProcessors()`, which differs between your machine and a
CPU-limited agent, so the "same" configuration produces a different number of threads. Pin a fixed
parallelism when reproducing.

**★ Ignoring the agent's memory limit.**
Parallel execution multiplies peak heap. A suite that fits in your laptop's default heap can OOM
under a container memory limit, and an `OutOfMemoryError` in one thread surfaces as an unrelated
test failing.

## Interview questions

**★ A date-formatting test started failing after a JDK upgrade and the diff looks identical. What
happened?**
Almost certainly the CLDR data. JDK 20 moved to Unicode CLDR 42, which replaced the ordinary space
before an AM/PM marker with a non-breaking or narrow non-breaking space — a character that renders
identically and compares unequal. The `-Djava.locale.providers=COMPAT` workaround existed on JDK
20 to 22 and was removed in JDK 23, so on a modern JDK the fix is structural: build the expected
string with the same `DateTimeFormatter` the code uses, or assert on the parsed temporal value
rather than on formatted text.

**★ Why does the same suite behave differently on CI even with the same JDK?**
Core count and contention. Under a container CPU quota `availableProcessors()` reports the quota,
and the javadoc notes the value can even change during a run — so Jupiter's `dynamic` parallelism
factor produces a different thread count, which produces different interleavings and exposes
different races. On top of that a shared agent is unevenly slow, so any tuned timing assertion
fires on the tail of a distribution set by other people's builds. Cold caches and an uncompiled
JIT make the first run of everything the slowest one.

**★ Walk me through reproducing a failure that only happens on CI.**
Copy the variables in cheapness order. Run the whole suite rather than the failing class, because
running it alone deletes the two most likely causes. Then randomise method and class ordering with
the seed logged. Then match CI's parallelism configuration with a fixed thread count rather than
the `dynamic` factor, since the factor resolves against a different core count on your machine.
Then run inside a container with the agent's CPU and memory limits. Then match the JVM arguments,
including the time zone and locale pins and `-Xmx`. Then match the exact JDK build. If none of that
reproduces it, you are left with contention-driven timing or a genuine race, and the tool becomes
a high-count `@RepeatedTest` with `failureThreshold = 1` running under the CI configuration. And
before any of it, confirm the tests are actually executing — a cached or up-to-date test task is
green without running anything.

**★ What is your standing policy on version pinning for tests?**
The JDK version is declared in the repository through a build toolchain so the laptop and the
agent cannot disagree. Library versions come from a BOM, with no version ranges and no
`-SNAPSHOT` anywhere a CI build can reach. Container images used by tests carry explicit tags,
with digests where the tag is mutable. The rule behind all three: a test suite whose result
depends on *when* it ran is not a regression suite, and the "flake" it produces is really a
different program running.

{/* FOOTER */}
{/* FOOTER */}
