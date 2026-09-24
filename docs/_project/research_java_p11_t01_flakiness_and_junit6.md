---
name: research-java-p11-t01-flakiness-and-junit6
description: Verified JUnit 6.0.3-vs-6.1 gap, JUnit's own position on test retries, Awaitility 4.3.0 and JDK locale drift, from devbible Java Phase 11 topic 01. The 6.0/6.1 finding affects topics 05 and 06 too.
metadata:
  type: project
---

# Java P11 T01 · flakiness + JUnit 6 research — verified 2026-08-28

Topic 01 is **content-complete at 62 chunks**; only its `README.md` index is owed. This is the
research behind the `14`-series that a later session would otherwise redo.

## 🔴 THE MOST VALUABLE FINDING — the JUnit 6.0 / 6.1 gap. It will bite topics 05 and 06 too.

**JUnit 6.1.0 shipped built-in `@ClearSystemProperty`, `@SetSystemProperty`,
`@RestoreSystemProperties`, `@ReadsSystemProperty`, `@WritesSystemProperty`, `@DefaultLocale`,
`@DefaultTimeZone`** (+ `@Reads/WritesDefaultLocale/TimeZone`), all taking resource locks so
annotated tests never run in parallel.

**The 6.0.3 built-in-extensions page has NONE of them**, and `spring-boot-dependencies:4.1.0`
manages **6.0.3**. Verify at `docs.junit.org/6.1.0/writing-tests/built-in-extensions.html`
against `.../6.0.3/...` before writing any page that reaches for them.

There is **no environment-variable extension** in either version — the JVM has no way to set one.

**JUnit Pioneer is NOT available on this stack.** Latest release v2.3.0 (2024-10-06), targets
JUnit 5. Open issue #881 (2026-08-17) asks when a JUnit-6-compatible 3.0 ships; #873/#874
confirm Pioneer intends to **delete** its Locale/TimeZone/SystemProperty extensions once it
upgrades, because 6.1 absorbed them. **Any advice to "add Pioneer" is currently wrong for Boot 4.1.**

## JUnit's own position on retries — issue #1558, `junit-team/junit-framework`

Open since 2018-08-20, no milestone, labels `type: new feature` + `status: waiting-for-interest`.
**JUnit 6 has no built-in retry** and the 6.0.x release notes change nothing. Three quotes:

- **marcphilipp, 2021-05-13:** *"It would be relatively easy to implement this in the platform.
  However, it might not satisfy the needs of all users since static state, threads that leaked
  from prior tests and might have caused the flakiness doesn't get reset."*
- **sormuras, 2018-08-21:** *"I don't like the idea of \"fixing\" flaky tests by (naiv, smart,
  conditional, [what|for]-ever) re-execution. I don't want to support that in Jupiter."*
- **Team Decision, 2018-09-07:** *"As a first step, we think this should be maintained
  externally as an extension based on `@TestTemplate`."*

**`InvocationInterceptor` cannot implement a retry** — javadoc verbatim: *"Each method in this
class must call `InvocationInterceptor.Invocation.proceed()` or
`InvocationInterceptor.Invocation.skip()` exactly once on the supplied invocation. Otherwise,
the enclosing test or container will be reported as failed."* That is why every retry extension
is `@TestTemplate`-based.

⚠️ JUnit publishes no description for the `status: waiting-for-interest` label, so the page
reports the label and explicitly declines to interpret it.

## Parallelism / locking: nothing changed 5.x → 6.0.3

One 6.0.2 fix only: *"Allow using `@ResourceLock` on classes annotated with `@ClassTemplate`
(or `@ParameterizedClass`)."* All 5.x locking guidance is current. `Resources` constants
verified: `SYSTEM_PROPERTIES` = `"java.lang.System.properties"`, plus `SYSTEM_OUT`,
`SYSTEM_ERR`, `LOCALE`, `TIME_ZONE`, `GLOBAL`.

## Awaitility 4.3.0 — from the javadoc, not the version-agnostic wiki

- `pollInSameThread()` — *"Instructs Awaitility to execute the polling of the condition from
  the same as the test"*. **Needed for `ThreadLocal`-bound conditions**: Spring transactions,
  `SecurityContext`, MDC.
- `catchUncaughtExceptionsByDefault()` — *"…Default is `true`"* · `during(Duration)` ·
  `failFast(...)` in three overloads · `dontCatchUncaughtExceptions()`.

⚠️ **Unsettled and stated as such in `14c`:** the 4.3.0 javadoc **contradicts itself** on
`failFast(Callable<Boolean>)` polarity — *"If the supplied `Callable` ever returns false…"* then
*"Throws a `TerminalFailureException` if fail fast condition evaluates to `true`."* The page
recommends the unambiguous `ThrowingRunnable` overload instead.

## The citations that carry the anti-`Thread.sleep` argument

**JLS SE 25 §17.3:** *"It is important to note that neither `Thread.sleep` nor `Thread.yield`
have any synchronization semantics."* The spec's own "(broken) code fragment" is a
`while (!this.done) Thread.sleep(1000);` polling loop.

**`System.getProperties()` apiNote** kills `System.setProperty("user.timezone", …)` in
`@BeforeAll`: *"Property values may be cached during initialization or on first use. Setting a
standard property after initialization … may not have the desired effect."*

**`TestSocketUtils` (Framework 7.0.x javadoc)** on find-a-free-port: *"…these utilities make no
guarantee about the subsequent availability of a given port and are therefore unreliable."*
`SocketUtils` was **removed** in Framework 6.0.

## JDK version drift, verified

**CLDR 42 in JDK 20** replaced the space before AM/PM with NBSP/NNBSP.
`-Djava.locale.providers=COMPAT` worked on JDK 20–22 and was **removed in JDK 23**
(JDK-8174269) — so **on JDK 25 there is no escape hatch**.

Other verbatim spine: `DirectoryStream` — *"The elements returned by the iterator are in no
specific order."* · `Runtime.availableProcessors()` — *"This value may change during a
particular invocation of the virtual machine."* · `ExecutorService.close()` (since 19) waits
**with no bound** · `Executors.defaultThreadFactory()` creates **non-daemon** threads named
`pool-N-thread-M` · `Thread` — *"Virtual threads are daemon threads and so do not prevent the
shutdown sequence from beginning."*

## ⚠️ A pre-existing broken link, found not fixed

`01-junit-5/06c-nesting-lifecycle-and-limits.md` links `../08-test-data-patterns/README.md`,
which does not exist (topic 08 has only `_category_.json` and `_plan.md`). It should become
bold plain text + *(not written yet)* until topic 08 has an index.
