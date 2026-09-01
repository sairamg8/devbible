---
title: "The bug where a stack trace is silently not printed, the bug where a password appears in output, and the bug where a correlation id is missing from half the lines are all invisible in code review, absent from every test suite, and discovered during an incident — which is a description of exactly the kind of defect a test is for"
sidebar_label: "13 · Testing your logging"
sidebar_position: 27
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-01 against the **Logback** `ListAppender` and `read`-side test support in
> `logback-core`'s test packages
> ([logback.qos.ch](https://logback.qos.ch/manual/appenders.html)); the **Spring Boot 4.1** test
> support for `@ExtendWith(OutputCaptureExtension.class)` and the `CapturedOutput` argument
> ([docs.spring.io](https://docs.spring.io/spring-boot/reference/testing/spring-boot-applications.html));
> the **SLF4J** API documentation for `MDC` and `Marker`
> ([slf4j.org](https://www.slf4j.org/apidocs/org/slf4j/MDC.html)); and **JUnit Jupiter 6.0.3** for
> the extension model ([junit.org](https://junit.org/junit5/docs/current/user-guide/)).
> JDK 25 · Spring Boot 4.1.0 / Spring Framework 7.0.8 · JUnit Jupiter 6.0.3.

**Most logging is not worth testing, and saying so first is what makes the rest of this page
credible. Asserting that a method logged "Processing order 42" couples a test to a message nobody
promised to keep, and it fails on every reword. But three categories of logging defect are real,
silent and expensive — a lost stack trace, a leaked secret, a missing correlation id — and all
three are mechanically detectable. The distinction is whether the log is *output* or whether it is
a *contract*.**

## When the log is a contract

Assert on logging when something downstream depends on it, which is more often than people expect:

- **An alert is built on it.** If a monitoring rule matches a message or a structured field, that
  message is an interface with a consumer, and changing it breaks the alert silently. This is the
  strongest case, and the one teams discover after an alert quietly stops firing.
- **A security property depends on it.** That a sensitive field never appears in output is a
  requirement, not a preference — [08](08-what-never-to-log.md).
- **An audit event must be emitted.** If audit records are produced through the logging pipeline
  at all, their emission is functional behaviour — [08b](08b-masking-and-the-audit-trail.md).
- **A structured field is consumed by a dashboard or a query.** The schema is an interface;
  renaming a field is a breaking change — [05c](05c-schema-and-field-naming.md).
- **Diagnosability is the feature.** A deliberately swallowed exception whose only trace is a log
  line is a case where the log *is* the error handling.

Everything else — the routine INFO narrative of a request — is output. Testing it produces brittle
tests, and brittle tests get deleted along with the ones that mattered.

## The two mechanisms

**Logback's `ListAppender`** attaches to a logger and collects `ILoggingEvent` objects, which is
the precise instrument: you get the level, the message template, the argument array, the MDC map
and the `Throwable`, as structured data rather than as rendered text.

```java
var logger = (ch.qos.logback.classic.Logger) LoggerFactory.getLogger(PaymentService.class);
var appender = new ListAppender<ILoggingEvent>();
appender.start();
logger.addAppender(appender);
try {
    service.pay(request);
    assertThat(appender.list)
        .anySatisfy(e -> {
            assertThat(e.getLevel()).isEqualTo(Level.ERROR);
            assertThat(e.getThrowableProxy()).isNotNull();   // the trace is actually attached
        });
} finally {
    logger.detachAppender(appender);   // 🔴 or it leaks into every later test
}
```

`getThrowableProxy()` being non-null is the assertion that catches
[09](09-exceptions-in-logs.md)'s silent bug — the one where a `{}` was supplied for the
`Throwable` and no trace is printed. Nothing else detects that, because the log line looks
populated.

**Spring Boot's `OutputCaptureExtension`** captures whatever was actually written to stdout and
stderr:

```java
@ExtendWith(OutputCaptureExtension.class)
class LoggingTest {
    @Test
    void neverLogsThePassword(CapturedOutput output) {
        service.authenticate(new LoginRequest("alice", "hunter2"));
        assertThat(output).doesNotContain("hunter2");
    }
}
```

That is the right instrument for the security assertion, precisely *because* it tests rendered
output — it catches disclosure through a `toString()`, through the encoder, through a framework
logger you did not write, and through anything else that ends up on the stream. `ListAppender`
attached to one logger would miss all of those.

**The two are for different questions.** `ListAppender` asserts on the event a specific logger
produced. `OutputCapture` asserts on what the process actually emitted. Choosing the wrong one
gives you a test that passes while the defect ships.

## The tests worth writing

There are about four, and they are generic rather than per-feature:

1. **No sensitive value reaches output.** Drive a request with a distinctive sentinel in every
   sensitive field and assert the sentinel is absent from captured output. One test, whole
   application, catches records' generated `toString()`, Lombok, framework loggers and encoder
   changes. This is the highest-value test on the page.
2. **Errors carry their traces.** For each place that logs an exception, assert
   `getThrowableProxy()` is non-null. Catches the `{}`-for-the-throwable bug that is invisible
   everywhere else.
3. **The correlation id is on every line.** Drive a request through the filter and assert every
   captured event's MDC contains the key — [07](07-correlation-ids.md). Catches the async-boundary
   loss from [06c](06c-mdc-across-async-and-virtual-threads.md), and it is one of the few tests
   that meaningfully covers a `TaskDecorator`.
4. **The MDC is clean afterwards.** Assert the MDC is empty at the end of a request on a pooled
   thread — [06b](06b-mdc-and-thread-pools.md). This is the leak that attaches one user's context
   to another user's request, so it is a correctness and a privacy test at once.

Note what they have in common: **each asserts a property that holds across the whole application,
rather than a message a particular method emits.** That is what keeps them from being brittle, and
it is the design rule for this kind of test.

## What makes these tests go wrong

- 🔴 **A `ListAppender` left attached leaks into every subsequent test** in the JVM. Detach in a
  `finally` or an `@AfterEach`. The symptom is a distant unrelated test failing because it sees
  events from an earlier one.
- **Log level in the test profile.** A test asserting on a DEBUG line passes locally and fails in
  CI if the profiles differ. Set the level explicitly in the test rather than inheriting it.
- **Parallel test execution and `OutputCapture`.** Captured output is process-wide; concurrent
  tests write into the same stream. JUnit's parallel execution and this extension need care, and
  the failures are intermittent and confusing.
- **The MDC is a `ThreadLocal`**, so a test that populates it and does not clear it affects
  whatever runs next on that thread — the test-suite version of exactly the production bug in
  [06b](06b-mdc-and-thread-pools.md).
- **Asserting on rendered strings couples you to the pattern.** Assert on the event's structure —
  level, MDC key, throwable presence — not on formatted text, except in the security test where
  rendered output is the point.

## The static half

Some of this is better caught before runtime, and it is worth pairing:

- A rule against constructing an exception message by concatenating a value that came from input.
- A check that classes with credential-shaped field names override `toString()` or exclude those
  fields.
- A rule against `catch`-log-rethrow in the same block — [09](09-exceptions-in-logs.md).
- A check that patterns do not reference `%line` or `%method` where an async appender is
  configured, since those render nothing — [10b2](10b2-what-it-costs-you.md).

Static analysis catches the pattern; the tests catch the instance. Neither subsumes the other.

## Gotchas

**★ A `ListAppender` left attached leaks into every later test in the JVM.**
Detach it in a `finally` or `@AfterEach`. The failure appears in an unrelated test that sees
events from a previous one, which is close to undiagnosable if you are not looking for it.

**★ `getThrowableProxy()` being non-null is the only assertion that catches the lost stack
trace.**
The `log.error("Failed: {}", e)` bug produces a populated-looking line with no trace. No
string-based assertion finds it; the event's structure does.

**★ `ListAppender` and `OutputCapture` answer different questions.**
One asserts what a specific logger produced, the other what the process emitted. A security
assertion needs the second, because disclosure can come through a `toString()`, an encoder or a
framework logger you never attached to.

**★ The sentinel test is the highest-value test on this page.**
One distinctive value in every sensitive field, one assertion that it never reaches output. It
covers records, Lombok, framework logging and encoder changes simultaneously, and it keeps working
as the code changes.

**★ Asserting on rendered message text couples the test to the pattern.**
A pattern change, an encoder change or an added MDC field breaks tests that had nothing to do with
any of them. Assert on structure — except where rendered output is precisely the property under
test.

**★ Captured output is process-wide, so parallel tests interfere.**
`OutputCaptureExtension` cannot isolate concurrent writers. The resulting failures are
intermittent, which is the worst kind, and they will be blamed on the code under test.

**★ Test-profile log levels silently invalidate assertions.**
A test asserting on a DEBUG line passes where DEBUG is enabled and fails where it is not. Set the
level in the test explicitly rather than depending on a profile.

**★ The MDC is a `ThreadLocal` in tests too.**
A test that populates it and does not clear it contaminates whatever runs next on that thread. It
is the same bug as [06b](06b-mdc-and-thread-pools.md), reproduced in your test suite.

**★ Testing routine INFO narrative produces brittle tests that get deleted with the good ones.**
When a suite acquires a reputation for breaking on harmless changes, the deletions are
indiscriminate. Over-testing logging is how the four tests that mattered get removed.

**★ An alert built on a log message makes that message an interface.**
Rewording it breaks the alert silently — nothing fails, the alert simply never fires again. If a
monitoring rule matches it, a test should assert it.

**★ Structured field names are an interface too.**
Renaming a field breaks every dashboard and query built on it, with no compile error and no test
failure unless one exists. This is the schema argument of
[05c](05c-schema-and-field-naming.md) with a test attached.

**★ Static analysis and tests catch different halves.**
A rule against concatenating input into an exception message catches the pattern everywhere; the
sentinel test catches the instance that got through. Neither makes the other redundant.

## Interview questions

**★ Should you test logging? Where do you draw the line?**
Mostly no, and the line is whether the log is output or a contract. Asserting that a service
logged "Processing order 42" couples a test to a message nobody promised to keep, breaks on every
reword, and contributes to a suite that people stop trusting — which is how the tests that
mattered get deleted too. But some logging has a consumer, and then it is an interface: a
monitoring rule matching a message or a structured field, a dashboard querying a field name, an
audit event that must be emitted, a security property that a value never appears in output, and
diagnosability where a swallowed exception's only trace is the log line. Those deserve assertions.
The design rule that keeps them from being brittle is to assert properties that hold across the
whole application — no sensitive value in output, every error carries a trace, every line has a
correlation id — rather than the specific text a particular method emits.

**★ How would you test that a stack trace is actually being logged?**
With Logback's `ListAppender` attached to the logger under test, asserting that the captured
`ILoggingEvent` has a non-null `getThrowableProxy()`. That is the only assertion that catches the
specific bug, which is `log.error("Payment failed: {}", e)` — supplying a placeholder for the
throwable makes SLF4J treat it as an ordinary parameter and format it with `toString()`, so no
stack trace is printed at all. The line looks entirely reasonable in review, the log looks
populated in normal operation, and the deficiency is discovered when someone needs the trace
during an incident. A string-based assertion will not find it either, because the rendered line
contains the exception's class and message and looks fine. It has to be an assertion on the
event's structure, which is exactly what `ListAppender` gives you — and the test must detach the
appender afterwards, or it collects events from every subsequent test in the JVM.

**★ Design a test that catches accidental disclosure of secrets in logs.**
A single sentinel test, using Spring Boot's `OutputCaptureExtension` rather than a `ListAppender`,
because the property is about what the *process* emits and disclosure can arrive through paths no
individual logger covers. Drive a representative request with a distinctive, unmistakable value in
every sensitive field — a password, a token, a card number — and assert the captured output does
not contain any of them. The reason this one test is worth more than a pile of targeted ones is
its coverage: it catches a record's generated `toString()`, a Lombok `@Data`, a framework logger
you never attached to, an encoder configuration change, and a field added to a DTO two years from
now by someone who has not read the guidance. It also keeps working as the code evolves, which
targeted assertions do not. The practical constraints are that captured output is process-wide, so
it does not coexist well with parallel test execution, and that the sentinel values must be
distinctive enough not to occur incidentally.

**★ When is a log message a breaking change?**
When something consumes it. An alert matching on message text is the clearest case: reword the
message and the alert never fires again, with no failure, no error and no notification — the
monitoring simply becomes decorative, and it can be months before anyone notices, usually because
an incident went unalerted. Structured field names are the same problem with a wider blast radius,
because dashboards, saved searches and downstream pipelines all bind to them, and a rename is
silently breaking for every one. The general point is that log output is an undeclared API with
consumers who never told you they existed, and the asymmetry is that adding a field is safe while
renaming or removing one is not. Which means the two defensible responses are to treat the
structured schema as a versioned interface — [05c](05c-schema-and-field-naming.md) — and to write
a test for any message or field that a monitoring rule depends on, so the coupling is at least
visible in the codebase.

**★ Why can over-testing logging make a codebase worse?**
Because brittle tests damage the credibility of the whole suite, and the damage is not confined to
the brittle ones. A test asserting on exact message text fails whenever anyone rewords a message,
adjusts a pattern, or adds an MDC field — all changes that are correct and harmless — so the suite
starts failing for reasons unrelated to behaviour. People respond by deleting the tests that keep
breaking, and that deletion is not surgical: the sentinel test that checks no password reaches
output looks like the same category of thing as the test asserting "Processing order 42", and goes
with it. So the cost of over-testing logging is not the maintenance of those tests, it is the loss
of the few that were genuinely protecting something. That is why the framing on this page is
restrictive by design — four generic property tests, not per-method assertions — and why the
argument for each of them is that it catches a defect no other mechanism catches.

**★ What logging defects are better caught statically than by tests?**
The ones that are patterns rather than instances. A rule against concatenating an input value into
an exception message catches the disclosure route from [08](08-what-never-to-log.md) everywhere in
the codebase at once, including in code nobody wrote a test for. A check that classes with
credential-shaped field names override `toString()` or exclude those fields catches the record and
Lombok problem at the point of definition, before any log line exists. A rule against
`catch`-log-rethrow in the same block enforces [09](09-exceptions-in-logs.md)'s rule mechanically,
which is far more reliable than review. And a check that a pattern does not reference `%line` or
`%method` where an async appender is configured catches the silent degradation from
[10b2](10b2-what-it-costs-you.md), which no test would ever look for. What static analysis cannot
do is tell you whether the specific value that reached output in a specific flow was sensitive —
that needs the sentinel test. The two are complementary and neither subsumes the other.

{/* FOOTER */}
