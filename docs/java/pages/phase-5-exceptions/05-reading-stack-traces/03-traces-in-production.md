---
title: "Traces in production"
sidebar_label: "3 · Traces in production"
sidebar_position: 3
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-18 against the JDK 25 Javadoc for `Throwable`, the
> HotSpot `-XX:-OmitStackTraceInFastThrow` behaviour as documented in the
> JDK bug tracker (JDK-4292742 and successors) and release notes, and the
> documented behaviour of common log frameworks (SLF4J/Logback) for
> throwable rendering.

**On your machine a trace is a block of text in a terminal. In production
it is dozens of log *lines* that a pipeline may shuffle, an aggregator
groups by fingerprint, and the JVM itself may decline to produce at all
once an exception gets hot. Reading traces in production is partly the
chunk-1 skill and partly knowing what the machinery between the JVM and
your screen does to them — and setting up that machinery so the trace you
need at 3 a.m. actually exists.**

## Line-splitting: the multiline problem

`printStackTrace`-style output is inherently multi-line, but most log
pipelines are line-oriented. Ship a trace through a naive pipeline and each
`at …` line becomes its own log event — interleaved with other threads'
lines, sorted by timestamp ties, impossible to reassemble by eye.

The fixes, in ascending order of robustness:

- **Multiline-aware shippers** — tail agents configured to join
  continuation lines (indentation, `at `/`Caused by:` prefixes) back onto
  their event. Fragile: any format drift breaks the join.
- **Structured logging** — the application logs JSON (or another framed
  format) with the *whole throwable chain in one field* (`stack_trace`,
  `exception.stacktrace`). One event, no reassembly. This is the standard
  answer; every mainstream Java log framework has a JSON encoder.
- **Pass the exception object to the logger** — `log.error("msg", e)`, not
  `log.error("msg " + e)` and never `e.getMessage()` alone. String
  concatenation renders `toString()` (type + message, *no trace*, *no
  causes*); the two-arg form is what lets the encoder capture the chain.

## How aggregators group, and why it matters

Error trackers deduplicate ("one issue, 4,102 events") by fingerprinting —
typically exception type + selected frames of the innermost cause. That
grouping is what pages you, so it pays to know how your choices affect it:

- **Cause dropped** (chunk 2's pathology 1) → the fingerprint is computed
  from your bland wrapper at its `throw` site → *unrelated failures merge
  into one issue*, and the real regression hides inside an old issue's
  event stream.
- **Generic exceptions everywhere** (`RuntimeException("failed")`) → same
  merging. Distinct exception types per failure case
  ([topic 04](../04-custom-exceptions-translation.md)) keep dashboard
  groups aligned with real defects.
- **Messages with unique data** (IDs, timestamps) are fine — fingerprints
  favour type + frames precisely so message variance doesn't split groups.

## `-XX:-OmitStackTraceInFastThrow`: the vanishing trace

HotSpot has a documented optimization: when certain implicit exceptions
(`NullPointerException`, `ArrayIndexOutOfBoundsException`,
`ArithmeticException`, `ClassCastException`, `ArrayStoreException`) are
thrown repeatedly from the same hot compiled site, the JIT may switch to a
**preallocated exception with no message and no stack trace** — the throw
gets fast, and the log gets useless: the same NPE, thousands of times,
zero frames.

What to know before it bites:

- **Signature:** early occurrences of the failure *have* traces; later ones
  are empty. The forensics exist — at the *start* of the incident window.
  Scroll back.
- **The flag** `-XX:-OmitStackTraceInFastThrow` disables the optimization;
  traces are always filled. Many services run with it off precisely for
  supportability; the cost is that genuinely hot throw paths stay slow —
  which [topic 07](../07-exceptions-as-control-flow.md) argues is a design
  smell to fix, not to optimize.
- An exception thrown that hot is itself the finding: something is using
  exceptions as control flow on a hot path.

## Correlation: connecting trace to request

A trace names code, not context: *which* request, user, order? Production
logging attaches that separately:

- **Correlation/trace IDs** — an ID generated at the edge, carried through
  MDC (mapped diagnostic context) so every log line — including the error
  event with the trace — shares it. The 500 response carries the same ID,
  so a user report → one grep → the full story.
- **MDC does not cross threads by itself** — async work needs the context
  copied into the task (executor wrappers, or a context-propagation
  library); otherwise the error event logs with an empty ID, exactly when
  you need it (chunk 2's async gap, again).
- **Log the IDs in the exception message too** where natural
  ([topic 04](../04-custom-exceptions-translation.md)'s message craft) —
  aggregator events survive log retention; MDC fields sometimes don't.

## What to log at each layer — the summary discipline

Combining this topic with topic 04's translation chain:

| Layer | On failure it… | Logs? |
|---|---|---|
| Repository / client | translates to domain exception, cause attached | no |
| Service | translates/enriches, cause attached | no |
| Global boundary | maps type → response, correlation ID both ways | **yes — once, full chain** |
| Background task boundary | marks run failed | **yes — once, full chain** |

"No" means *no error-level logging of the exception object* — a
debug-level breadcrumb is fine. One failure, one ERROR event, full chain,
correlation ID: that invariant is what makes both dashboards and 3 a.m.
greps trustworthy.

## Gotchas

**Symptom:** the aggregator shows one NPE issue whose event count spikes, but every recent event has an empty stack trace
**Cause:** `OmitStackTraceInFastThrow` engaged after the throw site got hot
**Fix:** read the *earliest* events in the window (they carry frames); consider `-XX:-OmitStackTraceInFastThrow`; fix the hot throw itself

**Symptom:** Kibana shows `at com.shop…` lines as separate hits, unrelated log lines interleaved between them
**Cause:** multiline trace shipped through a line-oriented pipeline without joining
**Fix:** structured logging with the throwable in one field; until then, a multiline join rule keyed on indentation/`at `/`Caused by:`

**Symptom:** log shows `OrderPlacementException: order 7f3a could not be placed` and nothing else — no frames, no causes
**Cause:** `log.error("… " + e)` or `log.error(e.getMessage())` — the throwable was stringified, not passed
**Fix:** always the two-arg form `log.error("context", e)`; lint for concatenated throwables

**Symptom:** distinct bugs (timeout, constraint violation, mapping error) all land in one aggregator issue
**Cause:** all were wrapped into one generic exception type with the cause dropped — identical fingerprints
**Fix:** typed exceptions per case worth distinguishing, causes always attached; the aggregator regroups on the next occurrence

**Symptom:** error event has no correlation ID exactly for async failures
**Cause:** MDC is thread-local; the pool thread never had the request's context
**Fix:** context-propagating executor wrappers; assert in staging that async error logs carry IDs

**Symptom:** support cannot find the log for a user-reported 500
**Cause:** the response didn't echo the correlation ID, or the edge never set one
**Fix:** generate at the edge, put it in the error response body/header and in MDC — the pairing is the whole point

## Interview questions

**★ Your NPE dashboard issue has thousands of events but the recent ones have no stack trace. What happened and what do you do?**
HotSpot's fast-throw optimization replaced the hot implicit exception with
a preallocated, trace-less instance. Read the earliest events in the window
for the real frames; optionally run with `-XX:-OmitStackTraceInFastThrow`;
and treat "an NPE thrown hot enough to trigger this" as the actual bug.

**★ Why is `log.error("failed: " + e)` an incident-response bug, not a style nit?**
It renders only type + message — no frames, no cause chain. The one
artifact that locates the failure never reaches the log. The two-arg form
passes the throwable to the encoder, which serializes the full chain.

**★ How does dropping a cause corrupt error-tracker grouping?**
Fingerprints key on the innermost exception's type and frames. A wrapper
without a cause makes *your translation site* the innermost frame for every
underlying failure — timeouts, constraint violations and driver bugs all
fingerprint identically and merge into one meaningless issue.

**★ Design the logging for a failure that crosses repository → service → controller.**
Repository and service translate with causes attached and do not log at
error level; the global handler logs once — full chain, correlation ID —
and returns a safe message carrying the same ID. One failure, one ERROR
event, findable from the user's report.

**★ Why do async failures so often log without a correlation ID, and what's the fix?**
The ID lives in thread-local MDC; the pool thread that runs the task never
inherited it. Wrap task submission to capture and restore the context (or
use a context-propagation mechanism) so the error event carries the
request's ID.

**★ Structured logging aside, what makes multiline traces fundamentally hostile to log pipelines?**
Line-oriented transport treats each frame as an event: interleaving from
concurrent threads, per-line timestamps, and grep hits with no enclosing
context. Joining heuristics patch it; putting the whole chain in one field
of one event removes the problem.

---

← Prev: [The pathologies](02-the-pathologies.md) · Index: [Reading a stack trace fast](README.md) · Next → [Checked exceptions inside lambdas](../06-checked-exceptions-lambdas.md)
