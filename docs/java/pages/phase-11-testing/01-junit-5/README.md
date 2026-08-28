---
title: "JUnit gives you exactly one failure mechanism — an exception escaping your method — and every other feature in the framework is about controlling when that method runs, what surrounds it, and what the report says when it does not return"
sidebar_label: "Overview"
sidebar_position: 0
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-27 → 2026-08-28 against the **JUnit 6.0.3 User Guide**
> ([docs.junit.org/6.0.3](https://docs.junit.org/6.0.3/)) and the Jupiter/Platform javadocs;
> version spine read from `spring-boot-dependencies:4.1.0`
> ([POM on Maven Central](https://repo1.maven.org/maven2/org/springframework/boot/spring-boot-dependencies/4.1.0/spring-boot-dependencies-4.1.0.pom)).
> JDK 25, Spring Boot 4.1.0, **JUnit Jupiter 6.0.3**, Spring Framework 7.0.8.
> **No sandbox** — every claim on these pages is sourced from the guide, the javadoc or the
> Jupiter sources, never from a fabricated test run.

**There is no "pass" API. Jupiter invokes your method, and if the method returns normally the
test passed; it fails when an exception escapes — an `AssertionError` from an assertion or a
`NullPointerException` from a bug, and the framework does not distinguish between them.
Everything else in this topic is a consequence: *when* the method is invoked (lifecycle,
ordering, parallelism), *what* is standing around it when it runs (extensions, conditions,
temporary directories), and *what a stranger reads* when it does not return (display names,
assertion messages, aggregated failures).**

The second half of the topic is about a different failure: a test that is green for a reason
unrelated to the behaviour, or red for a reason unrelated to the code. A suite whose red builds
sometimes mean nothing has disarmed every other test in it, which is why flakiness gets eleven
chunks here rather than a footnote.

🔴 **A note on the version, because it will confuse you.** Spring Boot 4.1 resolves **JUnit
Jupiter 6.0.3** while every tutorial, this directory's own name, and most of the ecosystem still
say "JUnit 5". The Jupiter *programming model* is the same — `@Test`, `@BeforeEach`, `Assertions`
— so "JUnit 5" remains the accurate name for what you write. What changed is the baseline, the
version numbering and a list of removals: see **[02b · What JUnit 6 changed](02b-what-junit-6-changed.md)**,
which is the page to read before upgrading anything.

**62 chunks, ~14,500 lines.** Read in order; each chunk links to the next.

| # | Chunk | Tier | What it argues |
|---|---|---|---|
| 1 | **[What a test is for](01-what-a-test-is-for.md)** | <span className="db-tier t-master">Master</span> | The only failure mechanism is an uncaught exception; a `throws` clause asserts nothing |
| 2 | **[The architecture](02-the-architecture.md)** | <span className="db-tier t-master">Master</span> | Platform, Jupiter, Vintage — the split behind every dependency mistake |
| 3 | **[What JUnit 6 changed](02b-what-junit-6-changed.md)** | <span className="db-tier t-master">Master</span> | Not a rewrite: a Java 17 floor, one version number, and a list of removals |
| 4 | **[The lifecycle](03-the-lifecycle.md)** | <span className="db-tier t-master">Master</span> | A fresh instance per test method, and everything that follows from it |
| 5 | **[Per-class lifecycle](03b-per-class-lifecycle.md)** | <span className="db-tier t-master">Master</span> | `PER_CLASS` buys shared state and silently disables parallelism for that class |
| 6 | **[Ordering, wrapping, inheritance](03c-inheritance-and-wrapping.md)** | <span className="db-tier t-master">Master</span> | Two guaranteed orderings — and the one everybody assumes is not guaranteed |
| 7 | **[Assertions](04-assertions.md)** | <span className="db-tier t-master">Master</span> | The message is the **last** parameter, and JUnit's own docs point elsewhere |
| 8 | **[assertAll](04b-assertall.md)** | <span className="db-tier t-master">Master</span> | Every executable runs; failures aggregate into one `MultipleFailuresError` |
| 9 | **[assertThrows](05-assertthrows.md)** | <span className="db-tier t-master">Master</span> | It accepts subclasses and returns the exception; `assertThrowsExactly` does neither |
| 10 | **[What not to assert](05b-what-not-to-assert.md)** | <span className="db-tier t-master">Master</span> | Asserting a message string is a test a copy-editor can break |
| 11 | **[Naming and display names](06-naming-and-display-names.md)** | <span className="db-tier t-master">Master</span> | The report should read as a specification; the precedence rules decide what it says |
| 12 | **[Nested tests](06b-nested-tests.md)** | <span className="db-tier t-master">Master</span> | A tree of circumstances — and inner-not-static fails silently |
| 13 | **[Nesting: lifecycle and limits](06c-nesting-lifecycle-and-limits.md)** | <span className="db-tier t-master">Master</span> | Each level gets its own lifecycle, and inherits neither `@BeforeAll` nor the mode |
| 14 | **[Tagging](06d-tagging.md)** | <span className="db-tier t-master">Master</span> | An invalid tag is a log warning, not a build failure |
| 15 | **[Tag expressions and filtering](06e-tag-expressions-and-filtering.md)** | <span className="db-tier t-master">Master</span> | Excluded tests vanish from the report — every exclusion needs an including job |
| 16 | **[Disabling and conditions](07-disabling-and-conditions.md)** | <span className="db-tier t-master">Master</span> | `@Disabled` is just an `ExecutionCondition`; the reason string is the only durable part |
| 17 | **[The built-in conditions](07b-the-built-in-conditions.md)** | <span className="db-tier t-master">Master</span> | They narrow, never widen; never inherited; silently ignored when declared twice |
| 18 | **[Environment conditions](07c-environment-conditions.md)** | <span className="db-tier t-master">Master</span> | Absent means disabled — a condition nobody sets is a test nobody runs |
| 19 | **[Custom conditions](07d-custom-conditions.md)** | <span className="db-tier t-master">Master</span> | `@EnabledIf` by `String` vs thirty lines of real code, decided by the report |
| 20 | **[ExecutionCondition and deactivation](07e-executioncondition-and-deactivation.md)** | <span className="db-tier t-master">Master</span> | One config parameter turns a graveyard of `@Disabled` tests back into information |
| 21 | **[Assumptions](08-assumptions.md)** | <span className="db-tier t-master">Master</span> | A third outcome, `ABORTED` — and the discipline is stopping people reading it as a pass |
| 22 | **[@TempDir](09-tempdir-and-resources.md)** | <span className="db-tier t-master">Master</span> | One directory per declaration is the rule that makes isolation real |
| 23 | **[@TempDir cleanup](09b-tempdir-cleanup.md)** | <span className="db-tier t-master">Master</span> | The default deletes the evidence; `ON_SUCCESS` is the fix; Windows fails alone |
| 24 | **[TempDirFactory](09c-tempdirfactory-and-autoclose.md)** | <span className="db-tier t-master">Master</span> | In-memory file systems and named directories — and what the contract forbids |
| 25 | **[@AutoClose](09d-autoclose.md)** | <span className="db-tier t-master">Master</span> | When it fires depends on the instance lifecycle; close order is deliberately nonobvious |
| 26 | **[The extension model](10-extensions.md)** | <span className="db-tier t-master">Master</span> | One marker interface, ~20 sub-interfaces; which one you implement decides whether it runs |
| 27 | **[Writing one](10b-writing-one.md)** | <span className="db-tier t-master">Master</span> | Three interfaces in one class, and the three parts that go wrong |
| 28 | **[Resolving parameters](10c-resolving-parameters.md)** | <span className="db-tier t-master">Master</span> | Two resolvers claiming one type, and a JDK annotation-lookup bug inside `@Nested` |
| 29 | **[Registering extensions](10d-registering-extensions.md)** | <span className="db-tier t-master">Master</span> | An extension that does nothing is usually registered where its callbacks are not honoured |
| 30 | **[@RegisterExtension](10e-registerextension.md)** | <span className="db-tier t-master">Master</span> | A non-static field silently drops four callbacks |
| 31 | **[Registration order](10f-registration-order.md)** | <span className="db-tier t-master">Master</span> | Default `@Order` is `MAX_VALUE / 2`, so one annotation on one field is enough |
| 32 | **[Automatic registration](10g-automatic-registration.md)** | <span className="db-tier t-master">Master</span> | Right for a reporter, wrong for anything that changes what a test means |
| 33 | **[Keeping state](10h-keeping-state.md)** | <span className="db-tier t-master">Master</span> | One instance serves every test and every thread; the `Store` replaces the field |
| 34 | **[The store hierarchy](10i-the-store-hierarchy.md)** | <span className="db-tier t-master">Master</span> | Reads walk up, writes do not — and JUnit 6 renamed the whole compute-if-absent family |
| 35 | **[Store cleanup](10j-store-cleanup.md)** | <span className="db-tier t-master">Master</span> | Closing is inverse-order, so *which* context you stored in decides *when* it shuts down |
| 36 | **[StoreScope](10k-storescope.md)** | <span className="db-tier t-master">Master</span> | The supported replacement for the static singleton and its shutdown hook — and `EXPERIMENTAL` |
| 37 | **[Execution order](11-execution-order.md)** | <span className="db-tier t-master">Master</span> | "Deterministic but intentionally nonobvious" is a design position, not an accident |
| 38 | **[Random order](11b-random-order.md)** | <span className="db-tier t-master">Master</span> | The one orderer that is a diagnostic — and the seed logs below the default threshold |
| 39 | **[Class order](11c-class-order.md)** | <span className="db-tier t-master">Master</span> | `@TestClassOrder` orders only `@Nested`; top-level order is a global parameter |
| 40 | **[When order is a smell](11d-when-order-is-a-smell.md)** | <span className="db-tier t-master">Master</span> | `@Order` fixes neither cause; it stops you noticing which one you have |
| 41 | **[Parallel execution](12-parallel-execution.md)** | <span className="db-tier t-master">Master</span> | `enabled=true` alone changes nothing — there are two switches |
| 42 | **[Parallelism configuration](12b-parallelism-configuration.md)** | <span className="db-tier t-master">Master</span> | A `ForkJoinPool` spawns extra threads: your number is a target, not a ceiling |
| 43 | **[Resource locks](12c-resource-locks.md)** | <span className="db-tier t-master">Master</span> | `READ` vs `READ_WRITE`, and a class-level lock quietly serialises the whole class |
| 44 | **[Dynamic locks and isolation](12d-dynamic-locks-and-isolation.md)** | <span className="db-tier t-master">Master</span> | Locking as convention, and `@Isolated` giving up on naming the resource |
| 45 | **[Shared state under parallelism](12e-shared-state-under-parallelism.md)** | <span className="db-tier t-master">Master</span> | Parallelism reveals bugs rather than creating them — the full catalogue and real fixes |
| 46 | **[Diagnosing a parallel failure](12f-diagnosing-a-parallel-failure.md)** | <span className="db-tier t-master">Master</span> | "It passed locally" is a diagnosis: three differences between a laptop and an agent |
| 47 | **[Timeouts](13-timeouts.md)** | <span className="db-tier t-master">Master</span> | Which thread runs your code, and whether anything actually stops it |
| 48 | **[Thread modes](13b-thread-modes.md)** | <span className="db-tier t-master">Master</span> | `SAME_THREAD` exists for `ThreadLocal` frameworks; `SEPARATE_THREAD` can commit to your DB |
| 49 | **[Timeout configuration](13c-timeout-configuration.md)** | <span className="db-tier t-master">Master</span> | Ten parameters, a `"42 ms"` grammar, and the switch that saves you in a debugger |
| 50 | **[What a timeout is for](13d-what-a-timeout-is-for.md)** | <span className="db-tier t-master">Master</span> | It can only say "too slow", never "wrong" — its one job is stopping a hang |
| 51 | **[Flaky tests](14-flaky-tests.md)** | <span className="db-tier t-master">Master</span> | A flake has stopped making a claim, and it disarms every other test in the suite |
| 52 | **[Time and determinism](14b-time-and-determinism.md)** | <span className="db-tier t-master">Master</span> | The clock, zone, locale, charset and `HashMap` order your code reads without asking |
| 53 | **[Timing and concurrency](14c-timing-and-concurrency.md)** | <span className="db-tier t-master">Master</span> | The JLS gives `Thread.sleep` no synchronization semantics — the tuned number buys nothing |
| 54 | **[Concurrency you cannot wait out](14f-concurrency-you-cannot-wait-out.md)** | <span className="db-tier t-master">Master</span> | You cannot wait your way to proving an absence |
| 55 | **[Leaked threads and executors](14g-leaked-threads-and-executors.md)** | <span className="db-tier t-master">Master</span> | The test that turns red is never the test that caused it |
| 56 | **[Environment](14d-environment.md)** | <span className="db-tier t-master">Master</span> | A path, a port, a table: the test assumes it is the only thing in the world |
| 57 | **[Ports, network and the database](14h-ports-network-and-the-database.md)** | <span className="db-tier t-master">Master</span> | Bind port zero and ask what you got; never assert a value the database chose |
| 58 | **[Process globals and drift](14i-process-globals-and-drift.md)** | <span className="db-tier t-master">Master</span> | System properties and env vars are shared with every test in the fork |
| 59 | **[CI and version drift](14j-ci-and-version-drift.md)** | <span className="db-tier t-master">Master</span> | A core count, an uneven agent, and a CLDR release that moved a space character |
| 60 | **[Retry is not a fix](14e-retry-is-not-a-fix.md)** | <span className="db-tier t-master">Master</span> | A rerun does not reset the static state and the leaked threads that caused it |
| 61 | **[Fix, quarantine or delete](14k-fix-quarantine-or-delete.md)** | <span className="db-tier t-master">Master</span> | Four honest options — and a quarantine without a date is deletion with extra steps |
| 62 | **[The checklist](15-the-checklist.md)** | <span className="db-tier t-master">Master</span> | A test that is wrong still passes, so "is this correct" is the wrong review question |

## The six things this topic is really about

1. **There is no pass API.** The method returns or it does not. `throws IOException` is a note
   to the compiler, never an expectation — the test still fails if one is thrown
   ([01](01-what-a-test-is-for.md)).
2. **A new instance per test method is the axiom.** Static fields, `@BeforeAll`, why your field
   assignments do not leak, and why `PER_CLASS` costs you parallelism all fall out of it
   ([03](03-the-lifecycle.md), [03b](03b-per-class-lifecycle.md)).
3. **The report is the deliverable.** Display names, the message-is-the-last-parameter trap, and
   `assertAll` turning five build cycles into one all serve the person reading a red build who
   did not write the code ([04](04-assertions.md), [06](06-naming-and-display-names.md)).
4. **Silent no-ops are the framework's characteristic failure.** An invalid tag, a duplicated
   condition, a non-static `@RegisterExtension` field, a condition on an unset variable, an
   extension registered where its callback is not honoured — none of these fail the build; they
   just stop doing anything ([06d](06d-tagging.md), [07b](07b-the-built-in-conditions.md),
   [10d](10d-registering-extensions.md), [10e](10e-registerextension.md)).
5. **Order and parallelism reveal bugs rather than cause them.** A test that needs an order is a
   test sharing state or a test chopped in half; `@Order` hides both. Turning on parallelism
   surfaces what was already there ([11d](11d-when-order-is-a-smell.md),
   [12e](12e-shared-state-under-parallelism.md)).
6. **A flaky test has stopped making a claim.** Its real cost is not the failing build — it is
   teaching the team that red might mean nothing, which disarms the whole suite. Retry converts
   the signal into silence ([14](14-flaky-tests.md), [14e](14e-retry-is-not-a-fix.md)).

## Where this connects

- **[02 · AssertJ](../02-assertj/README.md)** owns assertion *style* and failure messages. This
  topic owns the engine; [04 · Assertions](04-assertions.md) explains why JUnit's own guide sends
  you there.
- **[03 · Parameterized tests](../03-parameterized-tests/README.md)** owns `@ParameterizedTest`
  and every argument source. This topic names it and hands off.
- **[04 · Mockito](../04-mockito/01-what-a-mock-is-for.md)** owns mocking. Verification is not
  assertion, and the two are easy to confuse.
- **05 · The test pyramid** *(not written yet)* owns slice choice, the Spring context cache and
  `@MockitoBean` — the reason a suite is slow is usually there, not here.
- **Phase 10 · Data access** carries the persistence-side testing this topic's flakiness chunks
  keep pointing at — see [10 · Lazy loading](../../phase-10-data-access/10-lazy-loading/README.md).

{/* FOOTER */}
