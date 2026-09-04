---
title: "Spring Boot already generates, propagates and prints a correlation id, so the hand-written `X-Request-Id` filter almost every codebase contains is usually a second, incompatible identifier that nobody downstream can join on"
sidebar_label: "07 · Correlation ids"
sidebar_position: 16
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-01 against the **Spring Boot 4.1.1 source** for `CorrelationIdFormatter`
> (`DEFAULT = CorrelationIdFormatter.of("traceId(32),spanId(16)")`, W3C-based)
> ([github.com/spring-projects/spring-boot](https://github.com/spring-projects/spring-boot/blob/v4.1.0/core/spring-boot/src/main/java/org/springframework/boot/logging/CorrelationIdFormatter.java))
> and for `logback/defaults.xml`, which registers the `correlationId` conversion word and uses
> `LOG_CORRELATION_PATTERN` in both console and file patterns
> ([github.com/spring-projects/spring-boot](https://github.com/spring-projects/spring-boot/blob/v4.1.0/core/spring-boot/src/main/resources/org/springframework/boot/logging/logback/defaults.xml)),
> the **Spring Boot 4.1 reference, "Logging"**, which lists a *"Correlation ID (if tracing is
> enabled)"* in the default log format
> ([docs.spring.io](https://docs.spring.io/spring-boot/reference/features/logging.html)), the
> **Spring Boot 4.1 configuration-properties appendix** for `logging.pattern.correlation` and
> `management.tracing.baggage.correlation.*`
> ([docs.spring.io](https://docs.spring.io/spring-boot/appendix/application-properties/index.html)),
> and the **W3C Trace Context** recommendation
> ([w3.org](https://www.w3.org/TR/trace-context/)).
> 🔴 **No sandbox.** JDK 25 · Spring Boot 4.1.1 · Logback 1.5.34.
> **Span propagation, sampling and the tracing backend belong to 09 · Distributed tracing**
> *(not written yet)*; this chunk owns only the logging half.

**Every service that has been through an incident grows a filter that reads `X-Request-Id`,
generates a UUID if absent, puts it in MDC and clears it in a `finally`. It is fifteen lines,
everyone has written it, and on Spring Boot it is usually the wrong answer — because Boot's tracing
integration already puts `traceId` and `spanId` into the MDC and prints them, using an identifier
format the rest of the world can join on.**

## What Boot already does

Read straight out of `defaults.xml`, Boot registers a conversion word:

```xml
<conversionRule conversionWord="correlationId"
                class="org.springframework.boot.logging.logback.CorrelationIdConverter"/>
```

and both the console and file patterns interpolate `${LOG_CORRELATION_PATTERN:-}` — empty by
default, populated when tracing is active. The reference lists *"Correlation ID (if tracing is
enabled)"* among the default format's components.

The formatter behind it is `CorrelationIdFormatter`, whose javadoc says it formats an identifier
*"based on W3C recommendations"* and whose default is:

```java
public static final CorrelationIdFormatter DEFAULT =
        CorrelationIdFormatter.of("traceId(32),spanId(16)");
```

It reads those two names out of the MDC, formats them as *"dash separated strings surrounded in
square brackets"* with *"fixed width and with trailing space"*, and — per the same javadoc —
*"Dashes are omitted if none of the named items can be resolved."*

🔴 **The fixed width is the detail that makes it usable.** Every line is the same length in that
region whether or not the ids are present, so a log with tracing off and a log with tracing on
still align in a terminal. That is why the empty case is a run of spaces rather than nothing.

The spec configuring it is `logging.pattern.correlation`, described in the appendix as *"Appender
pattern for log correlation. Its default value varies according to the logging system."* The
`"name(length)"` syntax comes from the formatter's own javadoc:

> *"The formatter can be configured with a comma-separated list of names and the expected length of
> their resolved value. Each item should be specified in the form `"<name>(length)"`. For example,
> `"traceId(32),spanId(16)"` specifies the names `"traceId"` and `"spanId"` with expected lengths of
> `32` and `16` respectively."*

## Why 32 and 16

Those are not arbitrary. **W3C Trace Context** defines `traceparent` as four hyphen-separated
fields — version, trace-id, parent-id, trace-flags — with the trace-id as 16 bytes rendered as
**32 hex characters** and the parent (span) id as 8 bytes rendered as **16 hex characters**.

🔴 **This is the whole argument for using it instead of a UUID.** A W3C trace id is what every other
participant in the request already speaks: the ingress, the service mesh, the next service's
instrumentation, the tracing backend. A locally generated UUID in `X-Request-Id` is understood by
your service and nothing else, so the log cannot be joined to the trace, and a downstream team
looking at the same request sees a different identifier.

## The three identifiers, and why you probably want two

| Identifier | Scope | Who generates it |
|---|---|---|
| **Trace id** | The whole distributed request, across services | The first instrumented participant |
| **Span id** | One operation within the trace | Each instrumented component |
| **Business id** | Order, payment, account | Your domain |

**Trace id plus a business id is the pair that matters.** Trace id answers "show me everything about
this request"; the business id answers "show me everything that ever happened to order 8891",
which spans many traces over days and is the question support actually asks.

A separate `requestId` **in addition to** a trace id is usually redundant. A separate `requestId`
**instead of** one is the mistake.

## When you do still need your own

Three honest cases:

1. **Tracing is not enabled.** No `micrometer-tracing` bridge, no exporter — the MDC keys are never
   populated and the correlation pattern renders blank.
2. **An inbound id you must honour.** A gateway or partner sends a correlation header that support
   quotes back to you. That value must appear in the log even though it is not a trace id.
3. **Non-HTTP entry points.** A message consumer, a scheduled job, a batch step. Boot's tracing
   instruments many of these, but not everything.

**In all three, put it in the MDC and add it to the pattern — do not repurpose `traceId`.**

```java
@Component
@Order(Ordered.HIGHEST_PRECEDENCE)
public class RequestIdFilter extends OncePerRequestFilter {

    private static final String HEADER = "X-Request-Id";

    @Override
    protected void doFilterInternal(HttpServletRequest req, HttpServletResponse res,
                                    FilterChain chain) throws ServletException, IOException {
        String id = sanitise(req.getHeader(HEADER));
        if (id == null) { id = UUID.randomUUID().toString(); }
        res.setHeader(HEADER, id);                       // echo it back
        try (var ignored = MDC.putCloseable("requestId", id)) {
            chain.doFilter(req, res);
        }
    }

    private static String sanitise(String raw) {
        if (raw == null || raw.isBlank() || raw.length() > 64) { return null; }
        return raw.chars().allMatch(c -> c == '-' || Character.isLetterOrDigit(c)) ? raw : null;
    }
}
```

🔴 **`sanitise` is not optional and is the part every hand-written version omits.** The value is
attacker-controlled: it goes into your log (newline injection, forging fake log lines), into a
response header (header injection), and potentially into a file path if anything uses
`SiftingAppender` ([02c](02c-the-version-you-are-actually-running.md)). Length-bound it and restrict
the alphabet at the boundary.

## Baggage: carrying a business id across services

Micrometer Tracing's baggage is the supported way to propagate a value beyond your own process and
have it appear in logs. Boot's properties:

- `management.tracing.baggage.enabled` — *"Whether to enable Micrometer Tracing baggage
  propagation"* (default true)
- `management.tracing.baggage.correlation.enabled` — *"Whether to enable correlation of the baggage
  context with logging contexts"* (default true)
- `management.tracing.baggage.correlation.fields` — *"List of fields that should be correlated with
  the logging context. That means that these fields would end up as key-value pairs in e.g. MDC."*
- `management.tracing.baggage.remote-fields` — fields referenced the same in-process and on the wire
- `management.tracing.baggage.local-fields` — *"accessible within the JVM process but not propagated
  over the wire"*

```properties
management.tracing.baggage.remote-fields=tenantId
management.tracing.baggage.correlation.fields=tenantId
```

⚠️ **Baggage is propagated on every downstream call, so it is a per-request network cost and a data
exposure.** A tenant id is defensible; a customer email address travelling in a header to every
service you call is not. The propagation mechanics are **09 · Distributed tracing**
*(not written yet)*; the property that lands it in your MDC is here.

## Making the id reach the caller

A correlation id nobody outside the system can see is only half useful. Two habits pay for
themselves:

**Echo it in the response.** A support ticket that quotes the id turns a fishing expedition into a
single query.

**Put it in the error body.** An error response containing the correlation id is the shortest path
from "a user reported a failure" to "here are the exact log lines". Phase 9's error handling owns
the response shape.

## Gotchas

**★ Writing your own `X-Request-Id` filter when tracing is already enabled creates a second,
non-joinable identifier.**
Boot already puts `traceId` and `spanId` in the MDC and prints them. A parallel UUID means the log
and the trace cannot be correlated and downstream teams see a different id for the same request.

**★ A UUID is not a W3C trace id.**
The trace id is 16 bytes as 32 hex characters and the span id 8 bytes as 16 hex characters, which is
what `traceId(32),spanId(16)` encodes. A UUID with hyphens does not match that shape and will not be
accepted as a `traceparent` field by anything that validates it.

**★ An unsanitised inbound correlation header is a log-injection vector.**
It reaches your log (a newline forges a fake line), a response header (header injection) and
possibly a file path via `SiftingAppender`. Bound the length and restrict the alphabet where it
enters, not where it is used.

**★ `logging.pattern.correlation` renders blank when tracing is not configured.**
The correlation region of the default pattern is fixed width and empty. Nothing warns you; the line
just has a gap where the ids should be. If you expected ids and see spaces, the question is whether
a tracing bridge is on the classpath.

**★ The correlation converter reads MDC keys — it does not create them.**
`CorrelationIdConverter` resolves `traceId` and `spanId` from the MDC. If something clears the MDC
mid-request ([06b](06b-mdc-and-thread-pools.md)) the ids disappear from subsequent lines even though
tracing is working perfectly.

**★ Baggage is not free.**
`remote-fields` are serialised onto every outbound call. That is per-request bandwidth on every hop
and an exposure of the value to every service in the path. It is the right mechanism for a tenant
id and the wrong one for personal data.

**★ A correlation id that never leaves the system halves its value.**
If the user cannot quote it and the error response does not contain it, support still has to find
the request by timestamp and endpoint. Echo it in a response header and include it in error bodies.

**★ Only the logging half of correlation lives here.**
Sampling decisions, span lifecycle and exporter configuration are separate concerns, and a trace id
appearing in the log does not imply the trace was sampled or exported.

## Interview questions

**★ Spring Boot already provides a correlation id. What is it and where does it come from?**
When tracing is enabled, Micrometer Tracing puts `traceId` and `spanId` into the MDC, and Boot's
`defaults.xml` registers a `correlationId` conversion word backed by `CorrelationIdFormatter`,
whose default spec is `traceId(32),spanId(16)`. Both the console and file patterns interpolate
`LOG_CORRELATION_PATTERN`, so the ids appear in square brackets at fixed width — blank-padded when
absent so lines still align. It is configured by `logging.pattern.correlation` and it formats
identifiers based on W3C recommendations.

**★ Why 32 and 16 characters?**
Because W3C Trace Context defines the trace id as 16 bytes rendered as 32 hex characters and the
parent (span) id as 8 bytes rendered as 16 hex characters. Those lengths are what the `traceparent`
header carries, so an id in that shape is the same identifier every other participant in the
request already has — the ingress, the mesh, the next service, the tracing backend. That
interoperability is the entire argument against generating your own UUID.

**★ When is a hand-written correlation-id filter still justified?**
When tracing is not enabled at all, so the MDC keys are never populated; when an upstream gateway or
partner sends a correlation header that support quotes back to you and which must therefore appear
in your log; and for entry points that tracing does not instrument in your setup, such as some
message consumers or batch steps. In every case the value goes in the MDC under its own key and is
added to the pattern — it does not overwrite `traceId`, because that would put a non-conforming
value where downstream tools expect a W3C trace id.

**★ What is the security consideration with an inbound correlation header?**
It is attacker-controlled input that ends up in several sinks. In the log, an embedded newline lets
an attacker forge log lines, which matters if logs are evidence. In a response header, unvalidated
content is header injection. And if any appender derives a destination from MDC — `SiftingAppender`
does exactly that — it becomes part of a file path, which is the shape behind CVE-2026-19880. The
answer is to sanitise where it enters: bound the length and restrict to an alphabet, rejecting
rather than escaping.

**★ What is baggage, and what does it cost?**
Baggage is context propagated alongside the trace across service boundaries. Boot exposes it
through `management.tracing.baggage.*`: `remote-fields` are carried on the wire, `local-fields` are
in-process only, and `correlation.fields` are the ones that *"end up as key-value pairs in e.g.
MDC"*, which is what makes them appear in your logs. The cost is that every remote field is
serialised onto every outbound call — per-request bandwidth on every hop, and exposure of the value
to every service in the path. A tenant id is a reasonable use; personal data is not.

**★ You have a trace id. Do you still need a business identifier in the log?**
Yes, and it answers a different question. A trace id answers "show me everything about this one
request", which is what you want during an incident. A business identifier — order id, payment id —
answers "show me everything that ever happened to this order", which spans many traces over days
and is what support and finance actually ask. The trace id is ephemeral and the business id is
durable, so you want both and they are not substitutes.

{/* FOOTER */}
