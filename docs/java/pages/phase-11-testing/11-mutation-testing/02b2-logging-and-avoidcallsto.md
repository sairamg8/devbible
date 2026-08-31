---
title: "PIT skips any line containing a call to one of four hard-coded logging packages, and the list is Log4j 1.x rather than Log4j 2, is replaced rather than extended when you configure it, and exempts the whole line rather than the logging call — three details that decide whether your mutation report is signal or a wall of log.debug survivors"
sidebar_label: "02b2 · Logging and avoidCallsTo"
sidebar_position: 5
---

<span className="db-tier t-when">When Needed</span>

> Verified: 2026-08-31 against pitest's
> [Basic concepts](https://pitest.org/quickstart/basic_concepts/) (the *Equivalent Mutations*
> section) and the [Maven quick start](https://pitest.org/quickstart/maven/) entry for
> `avoidCallsTo`, plus the `Feature.named("FLOGCALL")` declaration in pitest 1.30.0's
> `org.pitest.mutationtest.build.intercept.logging.LoggingCallsFilterFactory`.
> Version spine from `spring-boot-dependencies:4.1.0`: JDK 25, Spring Boot 4.1.0, Spring Framework
> 7.0.8, JUnit Jupiter 6.0.3.
> ⚠️ **No sandbox and no build on this machine.** Configuration and documented behaviour only.

**Of all pitest's filters this is the only one with a user-editable list, it is the only one whose
default list is wrong for a large slice of the Java ecosystem, and it is the only one that exempts
a whole source line rather than a specific construct. Those three facts together decide whether a
mutation report on a service with heavy logging is readable. This chunk is about `FLOGCALL`, the
`avoidCallsTo` package list, and what to do when the thing you log is the thing the business
cares about.**

## Why logging is excluded at all

Pitest's *Equivalent Mutations* section frames it as a special case of the
[equivalent mutant problem](04b-equivalent-mutants.md):

> *"The resulting mutant behaves differently but in a way that is outside the scope of testing. A
> common example are mutations to code related to logging or debug. Most teams are not interested
> in testing these. PIT avoids generating this type of equivalent mutation by not generating
> mutations for lines that contain a call to common logging frameworks (this list of frameworks is
> configurable, to enable mutation of logging statements disable the feature FLOGCALL)."*

Note the honesty: a mutant that deletes a `log.debug(...)` call is **not** equivalent in the formal
sense. The program genuinely behaves differently — the log line is gone. It is equivalent
*operationally*, because nobody is going to write

```java
assertThat(logCaptor.getDebugMessages()).contains("computing rate for order 42");
```

and if they did, the assertion would be a maintenance liability rather than a test. Pitest is
making a judgement call on your behalf, and it names the feature so you can reverse it.

The feature's own description, from `LoggingCallsFilterFactory`:

> *"Filters mutations in code that makes calls to logging frameworks"*

It is on by default.

## The four packages, and the one that is missing

From the `avoidCallsTo` documentation:

> *"List of packages and classes which are to be considered outside the scope of mutation. Any
> lines of code containing calls to these classes will not be mutated. If a list is not explicitly
> supplied then PIT will default to a list of common logging packages as follows"*

```
java.util.logging
org.apache.log4j
org.slf4j
org.apache.commons.logging
```

🔴 **`org.apache.log4j` is Log4j 1.x.** Log4j 2's API is `org.apache.logging.log4j` — a different
package, one segment longer, and it does not match. Log4j 1.x reached end of life in 2015. So the
default list covers a logging framework almost nobody uses directly and misses the one that
replaced it.

In practice this bites less often than it sounds, because Spring Boot's `spring-boot-starter-logging`
routes application code through **SLF4J** (`org.slf4j`), which *is* on the list, with Logback
underneath. Code that calls `org.slf4j.Logger` is covered whatever the backend. The gap opens when:

- application code uses the Log4j 2 API directly (`org.apache.logging.log4j.Logger`, or
  `LogManager.getLogger()`), which happens in codebases that adopted Log4j 2 before or instead of
  SLF4J;
- there is a custom logging or audit facade — `AuditLogger`, `MetricsRecorder`, `EventPublisher` —
  which pitest has no way to recognise;
- code calls `System.out` or `System.err`, which are on nobody's list.

## Configuring it: the list is replaced, not extended

The documentation's own example is the tell — it repeats all four defaults verbatim before you add
anything:

> *"So, the configuration section must look like:"*

```xml
<avoidCallsTo>
    <avoidCallsTo>java.util.logging</avoidCallsTo>
    <avoidCallsTo>org.apache.log4j</avoidCallsTo>
    <avoidCallsTo>org.slf4j</avoidCallsTo>
    <avoidCallsTo>org.apache.commons.logging</avoidCallsTo>
</avoidCallsTo>
```

A realistic Boot 4 configuration therefore looks like this — the four defaults, plus Log4j 2, plus
whatever your own facades are:

```xml
<plugin>
  <groupId>org.pitest</groupId>
  <artifactId>pitest-maven</artifactId>
  <version>1.30.0</version>
  <configuration>
    <avoidCallsTo>
      <avoidCallsTo>java.util.logging</avoidCallsTo>
      <avoidCallsTo>org.apache.log4j</avoidCallsTo>
      <avoidCallsTo>org.slf4j</avoidCallsTo>
      <avoidCallsTo>org.apache.commons.logging</avoidCallsTo>
      <avoidCallsTo>org.apache.logging.log4j</avoidCallsTo>
      <avoidCallsTo>io.micrometer.core.instrument</avoidCallsTo>
    </avoidCallsTo>
  </configuration>
</plugin>
```

`io.micrometer.core.instrument` is worth considering on the same grounds as logging: a mutant that
deletes a `Counter.increment()` call is real, and nobody is asserting on it in a unit test.

⚠️ And one dependency between the two settings, stated in the docs:

> *"If the feature FLOGCALL is disabled, this parameter is ignored and logging calls are also
> mutated."*

So `-flogcall` overrides everything in `avoidCallsTo`. Configuring the list carefully and then
disabling the feature is a contradiction pitest resolves in favour of the feature flag, silently.

## The granularity is the line

Read the sentence again: *"not generating mutations for lines that contain a call to common logging
frameworks"* and *"Any lines of code containing calls to these classes will not be mutated"*.

**Line**, not expression. So this:

```java
BigDecimal rate = base.multiply(multiplier);
log.debug("rate for {} is {}", order.id(), rate);
```

leaves the `multiply` mutable, and this:

```java
log.debug("rate for {} is {}", order.id(), rate = base.multiply(multiplier));
```

does not. The same applies to the more common accidental version — a guard and a log on one line:

```java
if (total.compareTo(LIMIT) > 0) log.warn("over limit");
```

Here the `>` comparison shares a line with a logging call and is therefore exempt, so a genuine
boundary bug in that condition will never be surfaced by mutation testing. This is a real,
quantifiable cost to the one-line `if` style, and it is invisible: the mutants are simply not
generated, so nothing in the report tells you the line was skipped.

## When logging *is* the product

Audit trails, regulatory event logs and anything a downstream system parses are behaviour, and you
do want mutants there. Do **not** solve this by disabling `FLOGCALL` — that turns debug logging
back on for the whole codebase. Solve it by making the auditable calls not look like logging:

```java
// Not this: pitest sees org.slf4j on the line and skips it.
public void recordTransfer(Transfer t) {
    log.info("AUDIT transfer {} from {} to {} amount {}",
             t.id(), t.from(), t.to(), t.amount());
}
```

```java
// This: the audit call is a domain operation with a return value and a test.
public void recordTransfer(Transfer t) {
    auditTrail.record(AuditEvent.transfer(t.id(), t.from(), t.to(), t.amount()));
}
```

The second form gets mutated — `AuditEvent.transfer`'s arguments, the `void` call itself — and can
be asserted on with a captor ([04 · Mockito](../04-mockito/README.md)'s argument captors) or with
an in-memory `AuditTrail` fake. The refactoring is worth doing on its own merits; the mutation
report is what makes the case concrete.

## Where this connects

- **[02b3 · The filter inventory](02b3-the-filter-inventory.md)** — every other filter, and the
  `+`/`-` feature syntax used to switch `FLOGCALL`.
- **[04b · Equivalent mutants](04b-equivalent-mutants.md)** — logging is the documented example of
  a mutant that is "outside the scope of testing" rather than formally equivalent.
- **[04 · Mockito](../04-mockito/README.md)** — argument captors are how you assert on an audit
  call once you have stopped writing it as a log statement.

## Gotchas

**★ Log4j 2 is not in the default `avoidCallsTo` list.**
The four defaults are `java.util.logging`, `org.apache.log4j`, `org.slf4j` and
`org.apache.commons.logging`. Log4j 2's API lives at `org.apache.logging.log4j` and does not match
any of them — the package names differ by one segment and it is easy to read the list as covering
both. A codebase that logs through Log4j 2 directly gets mutants inside its logging statements,
which are pure noise. Boot's default SLF4J routing hides this for most projects and not for the
ones that adopted Log4j 2's API directly.

**★ Setting `avoidCallsTo` replaces the defaults rather than extending them.**
The documented example lists all four defaults explicitly next to the custom entry, which is the
tell. Adding only your audit-log package turns logging mutation back on for SLF4J everywhere else,
and the extra mutants will look like a real regression in mutation score between two runs where
nothing about the tests changed.

**★ `FLOGCALL` shields the whole line, not just the logging call.**
The documentation says pitest skips *"lines that contain a call to common logging frameworks"*. A
line that computes something and logs it in one statement has the computation exempted too. The
sharpest version is a single-line `if` with a `log.warn` body: the condition itself becomes
unmutatable, so a boundary bug on that line is permanently invisible to the technique.

**★ Nothing in the report tells you a line was skipped for logging.**
A filtered mutant is not generated, so it does not appear as any status — not as survived, not as
"filtered". A class whose interesting decisions all sit on lines that also log will show a small
mutant count and a flattering score. The only way to notice is to look at the mutant count per
class and ask whether it is plausible.

**★ Disabling `FLOGCALL` silently voids your `avoidCallsTo` configuration.**
The documentation states that if the feature is disabled the parameter is ignored. So a build that
carefully lists six packages and then sets `-flogcall` for an experiment mutates all six. The two
settings are not independent and only one of them is obviously named.

**★ `System.out` and `System.err` are not logging as far as pitest is concerned.**
They are not in the default list and there is no framework to detect. Legacy code that prints
diagnostics gets those lines mutated. Adding `java.io.PrintStream` to `avoidCallsTo` works but is
blunt — it exempts every line that touches any `PrintStream`, which may include code you care
about.

**★ Metrics calls have the same problem as logging and no default handling.**
`meterRegistry.counter(...).increment()` produces mutants nobody will kill, exactly like a
`log.debug`. Micrometer is not on the default list. Adding `io.micrometer.core.instrument` is
usually right, and is the same judgement call pitest already made for logging.

## Interview questions

**★ Why doesn't PIT mutate logging statements, and when should you make it?**
Because those mutants are "outside the scope of testing" in pitest's own wording — deleting a
`log.debug` call does change behaviour, but no team wants a test asserting on debug output, so the
mutant would sit in the report forever as an unactionable survivor. Pitest skips any line
containing a call to one of four recognised logging packages, controlled by the `FLOGCALL` feature
and the `avoidCallsTo` list. You would turn it off only if logging *is* the product — a regulated
audit trail, say — and even then the better move is to keep `FLOGCALL` on and refactor the
auditable calls behind a domain type that is not on the list, so the audit behaviour is mutated and
asserted while debug logging stays exempt.

**★ A team on Log4j 2 complains their mutation report is full of survivors in logging code. What happened?**
The default `avoidCallsTo` list contains `org.apache.log4j`, which is Log4j **1.x**. Log4j 2's API
is `org.apache.logging.log4j` and does not match, so `FLOGCALL` never fires on those lines and every
logging call generates `VOID_METHOD_CALLS` mutants that nothing kills. The fix is to set
`avoidCallsTo` explicitly — and to remember that setting it replaces the default list, so all four
defaults have to be repeated alongside the new entry.

**★ Is there a downside to the way PIT excludes logging?**
Yes, and it is under-appreciated: the exclusion is per source line, not per expression. Any code
sharing a line with a logging call is exempt too. On a codebase that writes single-line `if`
statements with logging bodies, or that assigns inside a log argument, real conditions and real
arithmetic become unmutatable. Nothing reports this — the mutants are never generated, so there is
no "filtered" status to notice — and the class comes out looking well tested with a suspiciously
small mutant count.

**★ How would you make an audit log testable by mutation testing?**
Stop calling it logging. A `log.info("AUDIT …")` sits on a line pitest exempts and is asserted, if
at all, by a log-capturing extension that breaks whenever the message text changes. Replacing it
with a domain call — `auditTrail.record(AuditEvent.transfer(...))` — gives you something pitest
mutates (the `void` call, the argument expressions) and something a test can assert on with an
argument captor or an in-memory fake. The mutation report then tells you whether anyone checks that
the right audit event is emitted, which is the thing the auditor actually asked about.

{/* FOOTER */}
