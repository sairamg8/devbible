---
title: "There are ten timeout configuration parameters arranged in a specificity hierarchy, a value grammar that accepts \"42 ms\" and treats a bare number as seconds, and one mode parameter that turns every timeout off while you are in a debugger — which is the parameter that makes global timeouts practical at all"
sidebar_label: "13c · Timeout configuration"
sidebar_position: 49
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-28 against the JUnit 6.0.3 User Guide — "Timeouts"
> ([writing-tests/timeouts](https://docs.junit.org/6.0.3/writing-tests/timeouts.html))
> and the JUnit 6.0.0 release notes
> ([release-notes](https://docs.junit.org/6.0.3/release-notes.html)).
> JDK 25, Spring Boot 4.1.0, JUnit Jupiter 6.0.3, Spring Framework 7.0.8.

**A timeout on every test is a defensible policy — a hung suite blocks a pipeline and nobody is
watching at 3am. The reason teams do not adopt it is that a fixed timeout also fails every test
you step through in a debugger. Both halves of that problem have documented answers, and this
chunk is both.**

[13](13-timeouts.md) is the three tools; [13b](13b-thread-modes.md) is the thread question.

## The ten default-timeout parameters

> *"The following configuration parameters can be used to specify default timeouts for all
> methods of a certain category unless they or an enclosing test class is annotated with
> `@Timeout`."*

| Parameter | Applies to |
|---|---|
| `junit.jupiter.execution.timeout.default` | *"all testable and lifecycle methods"* |
| `junit.jupiter.execution.timeout.testable.method.default` | *"all testable methods"* |
| `junit.jupiter.execution.timeout.test.method.default` | *"`@Test` methods"* |
| `junit.jupiter.execution.timeout.testtemplate.method.default` | *"`@TestTemplate` methods"* |
| `junit.jupiter.execution.timeout.testfactory.method.default` | *"`@TestFactory` methods"* |
| `junit.jupiter.execution.timeout.lifecycle.method.default` | *"all lifecycle methods"* |
| `junit.jupiter.execution.timeout.beforeall.method.default` | `@BeforeAll` |
| `junit.jupiter.execution.timeout.beforeeach.method.default` | `@BeforeEach` |
| `junit.jupiter.execution.timeout.aftereach.method.default` | `@AfterEach` |
| `junit.jupiter.execution.timeout.afterall.method.default` | `@AfterAll` |

Note the shape: a root, two mid-level groupings (`testable` and `lifecycle`), and leaves for each
specific kind. `lifecycle.method.default` is the one that fills the hole left by class-level
`@Timeout` not covering lifecycle methods ([13](13-timeouts.md)).

### Precedence

> *"More specific configuration parameters override less specific ones. For example,
> `junit.jupiter.execution.timeout.test.method.default` overrides
> `junit.jupiter.execution.timeout.testable.method.default` which overrides
> `junit.jupiter.execution.timeout.default`."*

Three levels, most specific wins. And above all of them, the annotation:

> *"…unless they or an enclosing test class is annotated with `@Timeout`."*

**An explicit `@Timeout` beats every configuration parameter**, on the method or on an enclosing
class. So a slow-by-design integration test can carry `@Timeout(120)` and be unaffected by a
global default of five seconds — which is what makes a global default adoptable.

A configuration that works in practice:

```properties
junit.jupiter.execution.timeout.testable.method.default = 30 s
junit.jupiter.execution.timeout.lifecycle.method.default = 60 s
junit.jupiter.execution.timeout.mode = disabled_on_debug
```

Generous enough that no correct test hits it, tight enough that a hang is caught in a minute
rather than at the pipeline's own timeout, lifecycle given more room because that is where
containers start, and disabled while you debug.

## The value grammar

> *"The values of such configuration parameters must be in the following, case-insensitive
> format: `<number> [ns|μs|ms|s|m|h|d]`. The space between the number and the unit may be
> omitted. Specifying no unit is equivalent to using seconds."*

| Parameter value | Equivalent annotation |
|---|---|
| `42` | `@Timeout(42)` |
| `42 ns` | `@Timeout(value = 42, unit = NANOSECONDS)` |
| `42 μs` | `@Timeout(value = 42, unit = MICROSECONDS)` |
| `42 ms` | `@Timeout(value = 42, unit = MILLISECONDS)` |
| `42 s` | `@Timeout(value = 42, unit = SECONDS)` |
| `42 m` | `@Timeout(value = 42, unit = MINUTES)` |
| `42 h` | `@Timeout(value = 42, unit = HOURS)` |
| `42 d` | `@Timeout(value = 42, unit = DAYS)` |

**A bare number is seconds**, matching `@Timeout`'s own default unit. And note `m` is minutes
while `ms` is milliseconds — a single character between "half a second" and "half an hour", in a
properties file with no compiler to check it. `μs` is a genuine micro sign, which is one more
reason to write `ms` or `s` and nothing else.

## `junit.jupiter.execution.timeout.mode` — the parameter that makes this practical

> *"When stepping through your code in a debug session, a fixed timeout limit may influence the
> result of the test, e.g. mark the test as failed although all assertions were met."*

> *"JUnit Jupiter supports the `junit.jupiter.execution.timeout.mode` configuration parameter to
> configure when timeouts are applied. There are three modes: `enabled`, `disabled`, and
> `disabled_on_debug`. The default mode is `enabled`. A VM runtime is considered to run in debug
> mode when one of its input parameters starts with `-agentlib:jdwp` or `-Xrunjdwp`. This
> heuristic is queried by the `disabled_on_debug` mode."*

`disabled_on_debug` is the setting that removes the only real objection to global timeouts.
Without it, every breakpoint inside a timed method eventually produces a spurious failure and the
team turns the timeouts off.

The heuristic is worth knowing exactly: it inspects the JVM's **input arguments** for
`-agentlib:jdwp` or `-Xrunjdwp`. That is how an IDE attaches a debugger, so it works for the case
it was designed for. It says nothing about whether a debugger is *currently attached* or whether
you are actually paused — a JVM started with the agent has timeouts disabled for the whole run
even if nobody connects.

⚠️ Which means: if your CI ever starts the test JVM with a JDWP argument — some remote-debug or
profiling setups do — `disabled_on_debug` silently switches your timeout policy off in CI. Worth
checking once.

`disabled` unconditionally turns off every timeout, annotation and configuration alike. It is a
reasonable temporary flag on a local run and has no place in a committed configuration.

## Diagnosing a timeout: the thread dump

> *"JUnit registers a default implementation of the Pre-Interrupt Callback extension point that
> dumps the stacks of all threads to `System.out` if enabled by setting the
> `junit.jupiter.execution.timeout.threaddump.enabled` configuration parameter to `true`."*

**Turn this on in CI.** A timeout failure without a stack tells you a method took too long; a
timeout failure with a thread dump tells you where it was stuck and what else was running. The
cost is nothing until a timeout actually fires.

⚠️ It writes to `System.out`, so under parallel execution it is subject to the output-capture
caveat in [12b](12b-parallelism-configuration.md) — and it dumps *all* threads, which is exactly
the output that capture will not attribute cleanly.

## `PreInterruptCallback`

> *"Registered Pre-Interrupt Callback extensions are called prior to invoking
> `Thread.interrupt()` on the thread that is executing the timed out method. This allows to
> inspect the application state and output additional information that might be helpful for
> diagnosing the cause of a timeout."*

The extension point from the catalogue in [10](10-extensions.md), and the built-in thread dump is
an implementation of it. Your own implementation gets the last moment before the interrupt — the
place to capture a queue depth, a connection-pool census, an in-flight request id. It is the only
hook that runs while the stuck code is still stuck.

## Gotchas

**★ Writing `m` when you meant `ms`.**
`42 m` is forty-two minutes and `42 ms` is forty-two milliseconds. One character, in a properties
file, with no compilation step to catch it. The wrong direction is silent: an over-long timeout
protects nothing and nothing fails.

**★ Assuming a bare number is milliseconds.**
`junit.jupiter.execution.timeout.default = 30` is thirty seconds. The grammar says no unit means
seconds, consistent with `@Timeout`'s own default.

**★ Setting `junit.jupiter.execution.timeout.default` and expecting it to be the last word.**
It is the least specific parameter. `testable.method.default` and `lifecycle.method.default`
override it, the per-kind parameters override those, and any `@Timeout` annotation on the method
or an enclosing class overrides all of them.

**★ Adopting a global timeout without `disabled_on_debug`.**
The first developer to set a breakpoint inside a timed method gets a spurious failure, and the
policy is removed within a week. Set the mode parameter at the same time as the default.

**★ Assuming `disabled_on_debug` detects an attached debugger.**
It inspects the JVM's input arguments for `-agentlib:jdwp` or `-Xrunjdwp`. A JVM launched with
those arguments has timeouts disabled for the entire run, connected or not — including in CI, if
anything there starts the test JVM that way.

**★ Committing `junit.jupiter.execution.timeout.mode = disabled`.**
It turns off every timeout, annotation included, everywhere. As a local override for an afternoon,
fine; in version control it silently removes a safety net that a future hang will need.

**★ Leaving `threaddump.enabled` off in CI.**
The one time it matters is the one time you cannot reproduce the failure. It costs nothing until
a timeout fires and it is the only diagnostic you will get.

**★ Reading a thread dump in a parallel run without accounting for capture.**
It goes to `System.out` and covers every thread, while output capture only records the executing
thread's output. Expect the dump to be awkward to attribute and plan for reading the raw log.

**★ Giving lifecycle methods the same budget as tests.**
A `@BeforeAll` that starts a container legitimately takes far longer than any test.
`lifecycle.method.default` exists precisely so the two can differ; using only
`timeout.default` forces one number to cover both and it will be the wrong number for one of
them.

**★ Setting a global default and never revisiting the outliers.**
Tests that carry `@Timeout(300)` to escape the global default are a list of your slowest tests,
written down. That list is useful; treat the annotations as a to-do, not as a resolution.

## Interview questions

**★ What is the precedence between the timeout configuration parameters?**
Most specific wins: the per-kind parameters such as `timeout.test.method.default` override the
grouping parameters `testable.method.default` and `lifecycle.method.default`, which override the
root `timeout.default`. Above all of them, an explicit `@Timeout` annotation on the method or an
enclosing class wins outright — which is what makes a global default adoptable, because slow tests
can opt out visibly.

**★ How would you apply a timeout to every test in a large suite without breaking debugging?**
Set `junit.jupiter.execution.timeout.testable.method.default` to a generous value, give lifecycle
methods their own larger budget with `lifecycle.method.default`, and set
`junit.jupiter.execution.timeout.mode = disabled_on_debug` so a debug JVM is exempt. Then annotate
the handful of genuinely slow tests with an explicit `@Timeout`, which overrides the default and
documents them.

**★ How does `disabled_on_debug` decide it is in a debug session?**
It checks whether one of the JVM's input arguments starts with `-agentlib:jdwp` or `-Xrunjdwp`.
That is a heuristic about how the JVM was launched, not about whether a debugger is attached or
paused, so a JVM started with those arguments has timeouts disabled for the whole run — worth
verifying that nothing in CI launches the test JVM that way.

**★ A timeout fires in CI and you cannot reproduce it. What should already have been configured?**
`junit.jupiter.execution.timeout.threaddump.enabled = true`, which registers Jupiter's built-in
`PreInterruptCallback` implementation to dump every thread's stack to `System.out` immediately
before the interrupt. It costs nothing until a timeout fires and it is the difference between
"this method was slow" and knowing what it was blocked on.

**★ What is `PreInterruptCallback` and when would you write one?**
An extension point invoked just before `Thread.interrupt()` is called on the timed-out method's
thread — the only hook that runs while the stuck code is still stuck. Jupiter's own thread dump is
an implementation of it. You would write one to capture application state that a stack trace does
not show: queue depths, connection-pool usage, the in-flight request id.

**★ What does `42 m` mean in a timeout parameter, and why is that dangerous?**
Forty-two minutes. `m` is minutes and `ms` is milliseconds, so a single missing character turns a
tight timeout into an effectively absent one, in a properties file that nothing type-checks and
whose error mode is silence — the test simply never times out and nobody notices.

{/* FOOTER */}
