---
title: "A twenty-minute Spring suite is almost never a collection of slow tests — it is a small number of contexts multiplied by a build setting nobody remembers making, and the fix order matters because the first two steps can each undo the value of everything after them"
sidebar_label: "09 · The twenty-minute suite"
sidebar_position: 20
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-28 against the Spring Framework 7.0.x reference *Testing → TestContext
> Framework → Context Caching*
> ([caching](https://docs.spring.io/spring-framework/reference/testing/testcontext-framework/ctx-management/caching.html))
> and the Spring Boot 4.1.1 reference *Testing*
> ([spring-boot-applications](https://docs.spring.io/spring-boot/reference/testing/spring-boot-applications.html));
> the claims about caching, forking and the cache statistics are the ones already sourced in
> [05](05-the-context-cache.md).
> Version spine from `spring-boot-dependencies:4.1.1`: JDK 25, Spring Boot 4.1.1,
> Spring Framework 7.0.9, JUnit Jupiter 6.0.3.
> ⚠️ **No sandbox, no suite was run, and there are no timings on this page.** Every number below
> is arithmetic on quantities you measure yourself, not a measurement of ours.

**This chunk assembles the rest of the topic into a procedure. It exists because the instinct when
a suite is slow — open the slowest test and optimise it — is almost always wasted effort in a
Spring codebase, and because the steps have an order: doing step 4 before step 1 can leave you
having carefully consolidated contexts in a build that starts a fresh JVM for each one.**

## Where the time actually is

Three quantities, and only three:

```text
suite time  ≈  (contexts started × context startup)      ← nearly all of it
             + (tests × test execution)                  ← usually a rounding error
             + fixed build overhead                      ← compile, download, report
```

**Context startup** is seconds: a connection pool, a Hibernate `SessionFactory` with metadata
scanning, every bean in your application, plus any embedded server. **Test execution** for a unit
test is sub-millisecond and for a slice test is milliseconds.

So the lever is the **first** term, and specifically the count — the number of *distinct* contexts
your suite starts. That count is what [05](05-the-context-cache.md) is about, and it is set by
things that do not look like performance decisions: a field name, a space in a property string, a
mock.

## The procedure

### 0 · Measure before touching anything

```properties
logging.level.org.springframework.test.context.cache=DEBUG
```

Read the **miss count**. That is how many contexts your suite starts. Compare it with your
test-class count:

- **Miss count ≈ 1–5, class count 300** → contexts are not your problem. Go look at the tests.
- **Miss count ≈ class count** → nothing is being shared. This page is your whole afternoon.
- **Miss count > 32** → you are also thrashing the LRU cache and paying for some contexts twice.

Everything below is worthless without this number. It is one line of configuration and it converts
an argument into a measurement.

### 1 · Check whether the build forks

If Surefire is configured with `forkMode` of `always` or `pertest`, or a `forkCount` with a low
`reuseForks`, then *"the static cache is cleared between each test execution, which effectively
disables the caching mechanism"* — every class starts its own context, and no amount of
consolidation helps.

🔴 **Do this first.** It is usually a setting added years ago to work around static state that has
since been fixed, and removing it can be the entire fix. If tests then fail, that is information:
you have found real cross-test pollution, which is a correctness problem you were paying for
anyway.

### 2 · Find what varies

Group your test classes by the ten cache-key components. In practice the answer is nearly always
one of three:

- **Bean overrides** — `@MockitoBean`, `@MockitoSpyBean`, `@TestBean`, including their **field
  names** ([06b](06b-overriding-changes-the-cache-key.md))
- **Inlined properties** — compared as exact strings, so whitespace splits contexts
  ([07](07-test-properties-and-profiles.md))
- **`@DynamicPropertySource` methods** repeated per class ([07b](07b-profiles-and-dynamic-properties.md))

with `@ActiveProfiles` applied unevenly a distant fourth, and hand-written
`@SpringBootTest(classes = …)` lists a fifth ([04](04-springboottest.md)).

### 3 · Consolidate

In rough order of value returned per hour spent:

1. **One shared base class** carrying the common `@SpringBootTest`, `@ActiveProfiles`, overrides
   and `@DynamicPropertySource`. Every subclass produces the identical key and they all share one
   context.
2. **One test profile** — `application-test.yml` plus `@ActiveProfiles("test")` — instead of
   inlined properties scattered across classes.
3. **A singleton container / `@ServiceConnection`** instead of a per-class
   `@DynamicPropertySource` ([topic 07](../07-testcontainers/01-passed-on-h2-proves-nothing.md)).
4. **Consistent mock field names**, project-wide. Free, and it removes an entire class of
   accidental fragmentation.
5. **Shared test doubles via `@TestBean` and a cross-class factory** instead of per-class mocks
   ([06d](06d-testbean.md)).

### 4 · Move tests down the pyramid

Only now. A `@SpringBootTest` that mocks five collaborators is a slow unit test — it starts an
entire application in order to test one class's logic in isolation. Those become
[level-zero tests](02-a-unit-test-needs-no-spring.md) with `new`, and the suite loses a context
*and* a class's worth of startup.

Similarly, a `@SpringBootTest` asserting on JSON shape is a `@JsonTest`; one asserting on a
handler is a `@WebMvcTest` ([03c](03c-the-slice-catalogue.md)).

### 5 · Parallelise — last, and only after the above

JUnit's parallel execution ([topic 01 · 12](../01-junit-5/12-parallel-execution.md)) multiplies
throughput, and it also multiplies your problems if the suite still has shared-state defects. It is
a genuine win on a consolidated suite and a source of intermittent failures on a fragmented one,
because parallel classes now compete for the same cached contexts and the same database rows.

## The arithmetic, so the priorities are obvious

Suppose 300 test classes, a context that takes 4 seconds to start, and tests that are effectively
free.

| Situation | Contexts | Startup cost |
|---|---|---|
| Forking per class | 300 | 300 × 4s = 20 minutes |
| No forking, heavily fragmented | 45 (with eviction, ~55 starts) | ~3.7 minutes |
| Consolidated | 4 | 16 seconds |

Same tests. Same assertions. The difference is entirely configuration, and steps 1 and 2 account
for nearly all of it — which is why "optimise the slow test" is such a poor first move.

⚠️ Those numbers are illustrative arithmetic to show the *shape* of the problem, not a measurement.
Your context startup time is the one number you must measure yourself.

## What not to do

- **Raising `spring.test.context.cache.maxSize`.** Stops the thrashing, leaves the count. A
  stopgap, never a fix.
- **`@DirtiesContext` to "clean up".** It rebuilds contexts on purpose, which is the opposite of
  the goal ([05b](05b-what-evicts-it.md)).
- **Deleting tests.** Tempting and occasionally correct — a duplicated test at the wrong level is
  worth deleting — but do it because the test is redundant, never because the suite is slow.
- **`@Disabled` on the slow ones.** That is deleting them with extra steps and none of the honesty
  ([topic 01 · 14k](../01-junit-5/14k-fix-quarantine-or-delete.md)).

## Gotchas and pitfalls

**★ Optimising test bodies before counting contexts.**
Test execution is a rounding error next to context startup. Measure the miss count first.

**★ Consolidating contexts in a build that forks.**
The cache is cleared between processes, so the consolidation buys nothing. Check the build first.

**★ Removing forking and finding tests now fail.**
That is not a regression — it is the cross-test pollution the forking was hiding, and you were
paying for the concealment on every run. Fix the shared state.

**★ Hoisting overrides to a base class and still getting many contexts.**
Check the field names and property spellings in the subclasses. One divergent character is one
extra context.

**★ Parallelising a fragmented suite.**
More contexts alive at once, more memory, more contention, and any latent shared-state defect now
surfaces intermittently. Consolidate first.

**★ Assuming a slice is always cheaper than `@SpringBootTest`.**
A slice is cheaper *per context*, but five carelessly-configured slice types can produce more
contexts than one shared full context. Count, do not assume.

**★ Believing a fast suite is the goal.**
The goal is a suite people trust and run. Speed serves that; so does not having flaky tests, and
[topic 01 · 14](../01-junit-5/14-flaky-tests.md) argues the flakiness half is the more damaging of
the two.

## Interview questions

**★ Your Spring test suite takes twenty minutes. What is the first thing you do?**
Turn on `org.springframework.test.context.cache` at `DEBUG` and read the cache statistics. The miss
count is the number of contexts started, and it tells you immediately whether this is a context
problem or a test problem. Optimising anything before that number exists is guesswork.

**★ The miss count equals the number of test classes. What does that mean?**
Nothing is being shared. Either the build forks a JVM per class — which clears the static cache and
disables caching entirely — or every class has a distinct cache key, usually through per-class bean
overrides, inconsistently spelled inlined properties, or a per-class `@DynamicPropertySource`.

**★ Why check the build before consolidating contexts?**
Because if tests run in separate processes the static cache is cleared between them, so every
consolidation you make is worth nothing. It is also frequently the whole fix on its own — the
forking is usually a years-old workaround for static state.

**★ What is the highest-value consolidation?**
A single shared base class carrying the `@SpringBootTest` configuration, active profiles, bean
overrides and dynamic properties, so that every subclass produces an identical cache key and they
all share one context.

**★ Where does parallel execution belong in this order?**
Last. It multiplies throughput on a consolidated suite and multiplies failures on a fragmented
one — more contexts alive at once, more contention for the same rows, and any latent shared-state
defect turning intermittent.

**★ Is deleting slow tests a valid optimisation?**
Only if they were redundant anyway — a duplicated assertion at the wrong level is worth removing
on its own merits. Deleting a test because the suite is slow trades coverage for a number, and
`@Disabled` is the same trade with the decision hidden.

**★ When is the answer "the tests really are slow"?**
When the miss count is low — a handful of contexts — and the suite still takes too long. Then the
time genuinely is in execution: real HTTP round trips, `Thread.sleep`, container startup per class,
or tests doing work that belongs in one setup step. That is a different investigation, and this
page's job is to tell you when to start it.

{/* FOOTER */}
