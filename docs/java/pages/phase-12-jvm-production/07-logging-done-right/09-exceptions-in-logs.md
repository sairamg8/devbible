---
title: "Log it or rethrow it, never both — the double-logged stack trace is the most common defect in production logging, it multiplies your log volume by the depth of your call stack, and it makes the one question an incident actually asks (how many times did this fail?) unanswerable"
sidebar_label: "09 · Exceptions in logs"
sidebar_position: 19
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-01 against the **SLF4J API documentation** for the `Throwable`-last overload
> resolution and the parameterised-message rules
> ([slf4j.org](https://www.slf4j.org/apidocs/org/slf4j/Logger.html)); the **JDK 25 API
> documentation** for `Throwable.addSuppressed`, `getSuppressed` and `Throwable`'s
> writable-stack-trace constructor
> ([docs.oracle.com](https://docs.oracle.com/en/java/javase/25/docs/api/java.base/java/lang/Throwable.html));
> and the **Spring Framework 7.0** documentation for `@ExceptionHandler` /
> `ResponseEntityExceptionHandler` ([docs.spring.io](https://docs.spring.io/spring-framework/reference/web/webmvc/mvc-controller/ann-exceptionhandler.html)).
> JDK 25 · Spring Boot 4.1.1 / Spring Framework 7.0.9.

**An exception carries a complete account of what went wrong and where. A log records it once, at
the place that decided what to do about it. Almost every production log breaks that rule — the
same failure is recorded three, four or five times as it travels up the stack, each copy with a
slightly different message and an identical trace — and the cost is not merely volume. It is that
nobody can tell how many distinct failures occurred, which is the first question anyone asks.**

## The rule

**Handle it, or propagate it. Log it only where you handle it.**

If you catch an exception and can do something about it — retry, fall back, return a default —
that is the place to log, because that is the place that knows the outcome. If you cannot do
anything about it, let it propagate. Adding a log line on the way past is not error handling; it
is a copy.

The three defensible exceptions to the rule, and they are narrow:

- **A boundary that will not propagate further** — a top-level handler, a message-listener
  container, an executor's uncaught-exception handler. Something must log there, because nothing
  above it will.
- **Adding genuinely new context that will be lost.** Wrapping in a domain exception with the
  identifiers you have is the better version of this — the context travels *with* the exception
  rather than in a separate line the reader has to correlate.
- **A deliberately swallowed exception**, which must be logged precisely because the alternative is
  silence. An empty `catch` block is worse than a double log by a wide margin.

## What the double log actually costs

It is not just noise, and enumerating the costs is what makes the argument persuasive:

- **Volume multiplied by stack depth.** One failure at five layers is five stack traces, each of
  which may be dozens of lines. This is frequently the largest single line item in a logging bill
  — [11 · Rolling, retention and cost](11-rolling-retention-and-cost.md).
- **Counting becomes impossible.** "How many payment failures in the last hour?" has no answer if
  each failure appears a variable number of times depending on which layer caught it. Alerts built
  on error counts inherit the same defect, so thresholds get tuned to the duplication rather than
  to reality.
- **The reader cannot tell duplicates from recurrences.** Five traces for one request and five
  traces for five requests look nearly identical, and distinguishing them is exactly what a
  correlation id is for — [07](07-correlation-ids.md) — which is one of the strongest practical
  arguments for having one.
- **The first trace is usually the informative one and is furthest up the file.** Readers land on
  the last copy, which is the least specific.

## Logging an exception correctly

SLF4J's rule is mechanical and worth stating exactly, because getting it wrong is common:

```java
// Right: the Throwable is the last argument, with no placeholder for it.
log.error("Payment failed for order {}", orderId, e);

// Wrong: the exception is formatted as a string. No stack trace at all.
log.error("Payment failed for order {}: {}", orderId, e);

// Wrong: message and trace both, needlessly, and the trace is the useful half.
log.error("Payment failed: " + e.getMessage(), e);
```

The rule: **a trailing `Throwable` argument with no corresponding `{}` is treated as the
exception**, and the full trace is printed. Give it a placeholder and it becomes just another
parameter, rendered with `toString()` — message only, no trace, no cause chain. This is the
single most common exception-logging bug, it produces a log that looks fine until the day you
need it, and it is the reason [13 · Testing your logging](13-testing-your-logging.md) is worth
the effort.

`e.getMessage()` in the message text is redundant when the exception is also passed — the trace's
first line already contains it — and actively harmful when the exception is *not* passed, because
a `NullPointerException` frequently has a helpful message and no indication of where it came from.

## The cause chain, and where it gets lost

`Caused by:` sections are the useful part of most traces, and two idioms destroy them:

```java
// Loses everything: the original type, its message, its trace.
catch (SQLException e) {
    throw new ServiceException("Database error");
}

// Keeps it all.
catch (SQLException e) {
    throw new ServiceException("Loading customer " + id, e);
}
```

Wrapping without the cause is worse than not wrapping at all, because it produces a trace that
looks complete and points only at your own code. It is also invisible in review unless someone is
looking for it specifically.

**Suppressed exceptions** are the other half. `try`-with-resources attaches an exception thrown by
`close()` to the primary exception via `addSuppressed`, and standard formatters print those as
`Suppressed:` entries. A custom formatter or a JSON encoder that renders only `getMessage()` and
`getStackTrace()` drops them silently — and the suppressed one is often the interesting one, since
a failing `close()` frequently indicates the connection or transaction problem that caused
everything else.

## Exceptions in structured logs

JSON output makes exceptions genuinely harder, and it is worth deciding rather than defaulting:

- The trace is multi-line inside a single-line format, so it must be a string field with embedded
  newlines, or an array of frames, or both. All three are done in practice and they are not
  interchangeable for querying.
- **Exception type and message deserve to be their own fields.** That is what makes "count
  distinct exception types by endpoint" a query rather than a text search, and it is the main
  reward for the trouble.
- The trace is frequently the largest field in the document, which interacts with index costs and
  with per-line size limits in shippers — a truncated JSON line is invalid JSON, so a size limit
  turns into dropped events rather than shortened ones.

## Where the boundary handler belongs

Spring gives you the boundary explicitly: `@ExceptionHandler` and `ResponseEntityExceptionHandler`
are the top-level catch for a web request, and they are the right place to log. That has a
corollary people miss — **once you have one, controller and service layers must stop logging**,
because they now sit below a handler that will. Introducing a global handler without removing the
per-layer logging is how services acquire double logging in the first place.

Asynchronous work has its own boundaries, and they are the ones most often left unhandled: an
executor's `UncaughtExceptionHandler`, a message listener's error handler, a
`CompletableFuture`'s `exceptionally` or `whenComplete`. A failure in a `CompletableFuture` with
no such stage attached is not logged anywhere at all — it is silent, which is the failure mode
this page's rule is protecting against.

## Gotchas

**★ A trailing `Throwable` with a `{}` for it loses the entire stack trace.**
`log.error("Failed: {}", e)` renders `e.toString()` and prints no trace. It looks correct in
review and in normal running, and the loss is only discovered when someone needs the trace.

**★ Log or rethrow, never both.**
Every intermediate `catch`-log-rethrow multiplies the record of one failure by the depth of the
stack. It is the most common defect in production logging and the easiest to review for.

**★ Wrapping without the cause is worse than not wrapping.**
`throw new ServiceException("Database error")` discards the original type, message and trace, and
produces a plausible-looking trace that points only at your own code. Always pass the cause.

**★ `e.getMessage()` in the message text is redundant or misleading.**
Redundant when the exception is also passed, since the trace's first line has it. Misleading when
it is not, because a message without a trace often cannot be located — the classic case being an
NPE whose message is helpful and whose origin is unknowable.

**★ Suppressed exceptions vanish in custom formatters.**
`try`-with-resources attaches `close()` failures via `addSuppressed`. A JSON encoder rendering
only message and frames drops them — and the failing `close()` is often the actual cause.

**★ Adding a global `@ExceptionHandler` without removing per-layer logging creates the double
log.**
The handler is a new bottom for the propagation path. Everything below it that still logs is now
duplicating, and the change that introduced the duplication looks like an improvement.

**★ A `CompletableFuture` failure with no `exceptionally` or `whenComplete` is logged nowhere.**
It is not an unhandled exception in the thread sense, so no default handler sees it. Silence is
the failure mode, and it is worse than the double log this page is mostly about.

**★ Error-count alerts inherit the duplication.**
Thresholds get tuned to a number that includes the multiplier, so they break when someone
correctly removes a redundant log line. The alert then appears to have been fixed by the bug.

**★ The most useful trace is the first one written and the last one anybody reads.**
Readers scroll to the most recent copy, which is the one furthest from the failure and the least
specific about it.

**★ A truncated JSON log line is invalid JSON, so size limits drop events rather than shorten
them.**
Stack traces are usually the largest field. A shipper's per-line limit therefore turns "this
exception was verbose" into "this exception was not recorded", which is the opposite of the
intent.

**★ An empty `catch` block is worse than any amount of double logging.**
The whole argument here is about reducing duplication, and it must never be read as an argument
for silence. A deliberately ignored exception needs a log line *and* a comment saying why.

**★ Exception type and message belong in their own structured fields.**
Otherwise "which exception types are we seeing, by endpoint" is a text search over traces rather
than an aggregation, and that query is most of the value of structured logging for errors.

## Interview questions

**★ What is wrong with `catch (Exception e) { log.error("Failed", e); throw e; }`?**
It logs and rethrows, so the same failure will be recorded again by whatever catches it next, and
again above that. One failure becomes a stack trace per layer — volume multiplied by call depth,
which is often the largest single item in a logging bill. Worse than the volume is what it does to
counting: "how many payment failures this hour" has no answer when each failure appears a variable
number of times depending on where it was caught, so error-rate alerts get tuned to the
duplication rather than to reality and break when someone removes a redundant line. And it makes
duplicates indistinguishable from recurrences for a human reader, which is precisely what a
correlation id has to solve afterwards. The rule is to log where you handle: if this layer can do
something about the failure, handle and log it; if it cannot, let it propagate and let the
boundary — a global `@ExceptionHandler`, a listener's error handler — record it once, with the
full trace intact.

**★ `log.error("Payment failed: {}", e)` — what actually gets logged?**
The exception's `toString()`, and no stack trace at all. SLF4J treats a trailing `Throwable` as
the exception to be printed *only when there is no placeholder for it*; supplying `{}` makes it an
ordinary parameter, formatted as a string. So the log gets the class name and message and loses
the frames, the cause chain and any suppressed exceptions — which is to say it loses everything
that would let you locate the failure. The correct form is
`log.error("Payment failed for order {}", orderId, e)` — placeholders for the real parameters,
the throwable last with no placeholder.
This is worth knowing precisely because it fails silently — the line looks reasonable in review,
the log looks populated in normal operation, and the deficiency is discovered at the worst
possible moment. It is also the strongest single argument for asserting on log output in a test.

**★ Why is wrapping an exception without passing the cause worse than not wrapping at all?**
Because it produces a trace that looks complete and is not. Without the cause, the new exception's
stack trace starts at the point of wrapping, so every frame below — the JDBC driver, the socket,
the actual constraint violation — is gone, along with the original exception's type and message.
A reader gets `ServiceException: Database error` and a trace through your own service classes, and
there is nothing to indicate that anything was discarded. If you had not caught it at all, the
original trace would have propagated intact and been more useful. The correct form passes the
cause as the second constructor argument, which produces the `Caused by:` chain that is usually
the informative part of the whole trace. It is also nearly invisible in code review unless
somebody is specifically looking for a constructor call that drops its `e`, which is a good
argument for a static analysis rule.

**★ How do you represent an exception in a structured JSON log?**
Deliberately, because there are three defensible encodings and they are not equivalent. The
exception type and the message should be their own fields — that is what turns "which exception
types are we seeing, by endpoint" into an aggregation instead of a text search, and it is most of
the reward for the extra work. The trace itself is either a single string field with embedded
newlines, which is compact and readable but opaque to queries, or an array of structured frames,
which is queryable and considerably larger, and some pipelines carry both. Two practical
constraints shape the choice: the trace is normally the largest field in the document, so it
drives index cost; and a shipper enforcing a maximum line size will produce truncated JSON, which
is invalid JSON, so the event is dropped entirely rather than shortened. That last point is the
one that catches people, because it converts "our exceptions are verbose" into "our exceptions are
missing" with no error anywhere.

**★ Which failures end up logged nowhere at all?**
Asynchronous ones without a terminal stage or handler. A `CompletableFuture` that completes
exceptionally with no `exceptionally`, `handle` or `whenComplete` attached simply holds the
exception — nothing is thrown on any thread, so no uncaught-exception handler fires, and the
failure is silent until somebody notices missing data. The same applies to a task submitted to an
`ExecutorService` via `submit` rather than `execute`: the exception is captured in the `Future`,
and if nobody calls `get()`, nobody ever sees it. Message listeners without a configured error
handler and scheduled tasks that throw are the other common cases. It is worth raising in any
discussion about double logging, because the two problems have opposite shapes and the same
root — nobody decided where the boundary was — and silence is the more dangerous of the two by a
long way.

**★ You introduce a global exception handler and log volume does not drop. Why?**
Because the per-layer logging that existed before the handler is still there. A global
`@ExceptionHandler` adds a new, correct bottom to the propagation path, but it does not remove the
`catch`-log-rethrow blocks in the services and repositories below it — so each failure is now
logged by every one of those *plus* the handler, and the change that was supposed to consolidate
logging has added one more copy. This is the usual origin of double logging in a mature codebase:
nobody wrote it deliberately, it accumulated, and the improvement that should have fixed it was
applied without the corresponding deletions. The remediation is to treat the handler's
introduction as a two-part change — add the boundary, remove every log-and-rethrow beneath it —
and afterwards to enforce it, either by review convention or by a static analysis rule against
logging an exception in a block that also rethrows.

{/* FOOTER */}
