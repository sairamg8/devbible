---
title: "Logging done right: the log is a product with one reader at 03:00 who did not write the code — and almost every expensive defect in it is silent, because a discarded event, an unprinted stack trace and a leaked password all produce a log that looks complete"
sidebar_label: "Overview"
sidebar_position: 0
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-01 against the **SLF4J** API documentation
> ([slf4j.org](https://www.slf4j.org/apidocs/org/slf4j/Logger.html)); the **Logback** manual and
> its sources on `master` as of this date — `AsyncAppenderBase`, `AsyncAppender`,
> `OutputStreamAppender` and the rolling policies
> ([github.com/qos-ch/logback](https://github.com/qos-ch/logback)); the **Spring Boot 4.1**
> logging reference, structured-logging support, Actuator `loggers` API and
> `OutputCaptureExtension`
> ([docs.spring.io](https://docs.spring.io/spring-boot/reference/features/logging.html)); the JDK
> 25 API documentation for `Throwable` and the JDK 25 HotSpot sources at `jdk-25+36` for
> `OmitStackTraceInFastThrow`, `StackTraceInThrowable` and `MaxJavaStackTraceDepth`; the **OWASP
> Logging Cheat Sheet** and **A09:2021**; **PCI DSS v4.0** Requirements 3.3 and 10; and **GDPR**
> Articles 5 and 32.
> 🔴 **No sandbox.** No timing, throughput, volume or cost figure on these pages is a
> measurement. Every quoted string is from documentation or from source, and attributed.
> JDK 25 · Spring Boot 4.1.0 / Spring Framework 7.0.8.

**This is the phase's only <span className="db-tier t-master">Master</span> topic, and the reason
is that logging is the one production concern where the defects are silent by construction. A
collector that pauses too long shows up on a graph. A log that silently discarded a third of its
events, never printed a stack trace, and put a password in a search index looks exactly like a
healthy log — and each of those three is a documented default or a one-character mistake, not an
exotic failure.**

Three findings here contradict what most teams believe about their own configuration, and each is
read out of the source rather than asserted. **Logback's `AsyncAppender` holds 256 events, begins
silently discarding everything at INFO and below at 80% full, and blocks your application threads
when it is completely full** — all three are defaults. **Every appender write takes one unfair
lock across a write and a flush**, so logging serialises an otherwise parallel application and the
damage lands in the latency tail where mean-based dashboards cannot see it. And **the JVM stops
recording stack traces for exceptions it decides are hot**, so the trace disappears from your log
at exactly the point the failure became frequent enough to matter.

**28 chunks, ~7,275 lines, 435 gotchas and interview questions.** Read in order.
[14 · The checklist](14-the-checklist.md) is the page to keep.

| # | Chunk | Tier | What it argues |
|---|---|---|---|
| 1 | **[What a log line is for](01-what-a-log-line-is-for.md)** | <span className="db-tier t-master">Master</span> | One reader, at 03:00, who did not write the code |
| 2 | **[The facade and the backend](02-the-facade-and-the-backend.md)** | <span className="db-tier t-master">Master</span> | SLF4J is an API, Logback an implementation — why the split exists |
| 3 | **[The classpath problem](02b-the-classpath-problem.md)** | <span className="db-tier t-master">Master</span> | Multiple bindings, the bridges, and the exclusion list |
| 4 | **[The version you are running](02c-the-version-you-are-actually-running.md)** | <span className="db-tier t-master">Master</span> | Not the one in your `pom.xml` |
| 5 | **[Levels](03-levels.md)** | <span className="db-tier t-master">Master</span> | An actual definition for each of the five |
| 6 | **[The WARN nobody acts on](03b-the-warn-that-nobody-acts-on.md)** | <span className="db-tier t-master">Master</span> | Alert fatigue as a design failure of the log |
| 7 | **[Parameterised messages](04-parameterised-messages.md)** | <span className="db-tier t-master">Master</span> | `{}`, `isDebugEnabled`, and the cost of concatenation |
| 8 | **[The fluent API](04b-the-fluent-api.md)** | <span className="db-tier t-master">Master</span> | What it adds, and what it costs to adopt |
| 9 | **[Structured JSON](05-structured-json.md)** | <span className="db-tier t-master">Master</span> | Grep is not a query language; one event, one object |
| 10 | **[Wiring JSON in Spring Boot](05b-wiring-json-in-spring-boot.md)** | <span className="db-tier t-master">Master</span> | Boot's structured logging, and the alternatives |
| 11 | **[Schema and field naming](05c-schema-and-field-naming.md)** | <span className="db-tier t-master">Master</span> | ECS and OTel conventions; renaming a field is breaking |
| 12 | **[The encoder alternative](05d-the-encoder-alternative.md)** | <span className="db-tier t-master">Master</span> | When to reach past Boot's support |
| 13 | **[MDC](06-mdc.md)** | <span className="db-tier t-master">Master</span> | Context on every line without threading it through signatures |
| 14 | **[MDC and thread pools](06b-mdc-and-thread-pools.md)** | <span className="db-tier t-master">Master</span> | The leak: a `ThreadLocal` on a pooled thread |
| 15 | **[MDC across async](06c-mdc-across-async-and-virtual-threads.md)** | <span className="db-tier t-master">Master</span> | `TaskDecorator`, propagation, virtual threads |
| 16 | **[Correlation ids](07-correlation-ids.md)** | <span className="db-tier t-master">Master</span> | Request id, trace id, and not writing the filter yourself |
| 17 | **[What never to log](08-what-never-to-log.md)** | <span className="db-tier t-master">Master</span> | Six routes by which a password arrives unintentionally |
| 18 | **[Masking and the audit trail](08b-masking-and-the-audit-trail.md)** | <span className="db-tier t-master">Master</span> | A safety net, not a control — and audit is a different artefact |
| 19 | **[Exceptions in logs](09-exceptions-in-logs.md)** | <span className="db-tier t-master">Master</span> | Log it or rethrow it, never both |
| 20 | **[Stack traces that cost you](09b-stack-traces-that-cost-you.md)** | <span className="db-tier t-master">Master</span> | The trace vanishes when the failure becomes frequent |
| 21 | **[Appenders and where logs go](10-appenders-and-async.md)** | <span className="db-tier t-master">Master</span> | In a container the log is a stream, not a file |
| 22 | **[The async appender](10b-async-appender.md)** | <span className="db-tier t-master">Master</span> | 256 events, discard at 80%, block when full |
| 23 | **[What it costs you](10b2-what-it-costs-you.md)** | <span className="db-tier t-master">Master</span> | Caller data, and one second at shutdown |
| 24 | **[When logging is the bottleneck](10c-the-log-that-became-the-bottleneck.md)** | <span className="db-tier t-master">Master</span> | One lock, flat throughput, spare CPU, healthy database |
| 25 | **[Rolling, retention and cost](11-rolling-retention-and-cost.md)** | <span className="db-tier t-master">Master</span> | `maxHistory` counts periods, so it bounds nothing |
| 26 | **[Changing levels at runtime](12-changing-levels-at-runtime.md)** | <span className="db-tier t-master">Master</span> | DEBUG for one class, no restart — and `{}` to revert |
| 27 | **[Testing your logging](13-testing-your-logging.md)** | <span className="db-tier t-master">Master</span> | The four things that fail silently, and nothing else |
| 28 | **[The checklist](14-the-checklist.md)** | <span className="db-tier t-master">Master</span> | One for a line in review, one for the configuration |

## The ten things this topic is really about

1. **The expensive defects are silent.** A discarded INFO event, a stack trace that was never
   printed, and a password in a search index all produce a log that looks complete. "We have never
   had a problem with our logging" is close to uninformative, because the failures do not announce
   themselves.

2. **A log is a copy of your data with none of your data's protections.** Different permissions, a
   shipping pipeline, a search index many people can query, a backup with a retention nobody
   chose. Every control the original had must be rebuilt around the log or it is gone — which
   makes "what never to log" a design question, not a review checklist.

3. **Nobody logs a secret on purpose.** It arrives through a record's generated `toString()`,
   through an exception message that quoted the input it rejected, or through a DEBUG level
   enabled for one afternoon three years ago. All three look like ordinary good practice at the
   call site.

4. **Log an exception once, where you handle it.** Log-and-rethrow multiplies one failure by the
   depth of the call stack, and the cost is not volume — it is that "how many failures this hour"
   becomes unanswerable, so error-rate alerts get tuned to the duplication.

5. **A trailing `Throwable` with a `{}` for it prints no stack trace at all.** One character, no
   compiler warning, a log that looks populated, and the loss is discovered during the incident
   the trace would have solved.

6. **The async appender discards and blocks, by default.** 256 events; discarding starts at 80%
   full and drops everything at INFO and below with no exception, warning or counter; a full queue
   sends the application thread into an uninterruptible `put`. It was added to keep logging off the
   request path and under pressure it puts logging back on the request path.

7. **Logging serialises your application.** `OutputStreamAppender` holds one unfair
   `ReentrantLock` across a write *and* a flush. Adding cores adds contenders, not throughput, and
   because the lock is unfair the damage is in the tail — flat throughput, spare CPU, healthy
   dependencies, and an afternoon spent looking at the database.

8. **The level you are running is not the level in the file.** `effectiveLevel` includes
   inheritance from ancestor loggers; an inherited DEBUG appears in no configuration anywhere and
   is the usual explanation for a tenfold volume increase. Only the running application can answer
   it — and `{}`, not `INFO`, is how you revert a runtime change.

9. **Structure is what makes both querying and redaction exact.** Grep is not a query language,
   and a masking rule for a named field is precise where a regex over free text both misses and
   over-matches. The field names are then an interface with consumers who never told you they
   existed.

10. **Test the four things that fail silently and leave the rest alone.** No sensitive value in
    output, every error carries its trace, a correlation id on every line, a clean MDC afterwards.
    Asserting on message text produces brittle tests, and brittle tests get deleted along with the
    ones that mattered.

## Where this connects

- **[02 · GC in practice](../02-gc-in-practice/README.md)** — unparameterised logging is a
  significant allocator that appears in no code review as a performance concern, and a queue of
  unencoded log events is an unexpected contributor to the live set.
- **[05 · Thread dumps](../05-thread-dumps/README.md)** — the diagnosis for
  [24](10c-the-log-that-became-the-bottleneck.md) is a thread dump showing many threads BLOCKED on
  a `ch.qos.logback` frame across unrelated endpoints.
- **[06 · JFR and profiling](../06-jfr-and-profiling/README.md)** — logging contention is
  invisible in a CPU profile, because the threads are blocked rather than burning cycles. That
  instrument mismatch is most of why the diagnosis takes so long.
- **08 · Metrics with Micrometer** and **09 · Distributed tracing** *(neither closed yet)* own the
  other two signals. A timing in a log line is a metric in the wrong place; a trace id is what
  makes the correlation id of [16](07-correlation-ids.md) join up across services.
- **12 · Graceful shutdown** *(not written yet)* owns the window in which the async appender gets
  its one second to flush — two independent timers that people assume are one.
- **[Phase 5 · Exceptions and failure design](../../phase-5-exceptions/README.md)** owns the
  design argument; [20](09b-stack-traces-that-cost-you.md) is its production-cost evidence.
- **[Phase 9 · Spring Boot](../../phase-9-spring-boot/README.md)** introduced Actuator and Boot's
  logging configuration; here they are used, not re-taught.

{/* FOOTER */}
