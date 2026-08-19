---
title: "Correlation ids and logging the part you hid"
sidebar_label: "14 · Correlation ids and logging"
sidebar_position: 14
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-19 against the Spring Boot reference — *Servlet Web
> Applications* (registering filters, `FilterRegistrationBean`, ordering with
> `@Order`/`Ordered`, docs.spring.io/spring-boot/reference/web/servlet.html) —
> the Spring Framework reference *Exceptions* for the container `ERROR`
> dispatch, and *Observability*
> (docs.spring.io/spring-framework/reference/integration/observability.html —
> `ServerHttpObservationFilter`, and the note that exceptions handled by
> `@ExceptionHandler` and `ProblemDetail` support are *not* recorded as errors
> by the observation). `OncePerRequestFilter` per the Spring Framework javadoc.
> Spring Boot 4.1.0, Spring Framework 7.0.x, JDK 25.

**Hiding detail from clients is only defensible if the detail still exists
somewhere joinable. A correlation id is that join: the client receives an opaque
token, the server keeps the full trace, and support can put the two together.
Without it, a service that reveals nothing is a service nobody can debug.**

## Where to put the id, in preference order

1. **An extension member** — `pd.setProperty("correlationId", id)`. Visible,
   copy-pasteable into a support ticket, and part of the documented body.
2. **A response header** — `X-Correlation-Id`. Survives even when the body is
   Boot's default `/error` shape rather than yours, because a filter can set it
   before anything is written.
3. **`instance`** — `URI.create("urn:uuid:" + id)`. Standards-clean, since
   `instance` is defined as identifying the specific occurrence. The cost is
   losing its default value, the request path, which is frequently what you
   actually wanted there.

**Do 1 and 2 at minimum**, because they fail in different places: the extension
member is absent whenever your advice did not run
([chunk 15](15-the-gaps.md)), and the header is set by a filter that runs for
essentially everything.

## The filter

Generation belongs in a filter, not an interceptor and not the advice, because a
filter sees requests that never reach a controller — a 404 for an unmapped path,
a request rejected by security, a request that dies in another filter.

```java
@Component
@Order(Ordered.HIGHEST_PRECEDENCE + 10)
public class CorrelationIdFilter extends OncePerRequestFilter {

    public static final String HEADER = "X-Correlation-Id";
    public static final String ATTRIBUTE = "correlationId";

    private static final Pattern UUID_SHAPE =
            Pattern.compile("[0-9a-fA-F-]{8,36}");

    @Override
    protected void doFilterInternal(HttpServletRequest req, HttpServletResponse res, FilterChain chain)
            throws ServletException, IOException {

        String inbound = req.getHeader(HEADER);
        String id = (inbound != null && UUID_SHAPE.matcher(inbound).matches())
                ? inbound
                : UUID.randomUUID().toString();

        req.setAttribute(ATTRIBUTE, id);      // survives the ERROR dispatch
        res.setHeader(HEADER, id);            // set BEFORE anything is written
        MDC.put(ATTRIBUTE, id);               // for the logging framework
        try {
            chain.doFilter(req, res);
        } finally {
            MDC.remove(ATTRIBUTE);            // pooled threads: always clean up
        }
    }
}
```

Five details in that filter earn their place, and each is a bug if omitted.

**`OncePerRequestFilter`.** The `/error` handling is a second `ERROR` dispatch
through the container, so a plain `Filter` mapped to all dispatcher types would
run twice and mint a second id for one request. What the base class actually
does, and when a filter needs to run on the `ERROR` dispatch anyway, is
[in the pipeline topic](../10-the-request-pipeline/02-filters.md).

**The request attribute, not just the MDC.** MDC is backed by a `ThreadLocal`,
and the `finally` clears it — correctly, because leaving it set poisons the next
request on a pooled thread
([ThreadLocal and ScopedValue](../../phase-6-concurrency/12-threadlocal-scopedvalue/README.md)).
An exception handler running during the `ERROR` dispatch, or any code on another
thread, can read the request attribute and cannot read the MDC.

**`res.setHeader` before `chain.doFilter`.** After the response is committed you
cannot add headers at all, so setting it late means it is missing exactly on the
errors raised during response writing — the ones you most want to trace.

**Validating the inbound header.** Accepting `X-Correlation-Id` from callers is
what makes tracing work across services, and it also lets an external caller
inject arbitrary text — including newlines that split your log lines — into your
logging pipeline. Validate the shape or generate your own.

**`HIGHEST_PRECEDENCE + 10`, not `HIGHEST_PRECEDENCE`.** The id filter should be
early, so almost everything downstream is covered, but leaving headroom above it
avoids fighting with filters that legitimately must be first. Boot's own advice
is to *"avoid configuring a filter that reads the request body at
`Ordered.HIGHEST_PRECEDENCE`"* — this one does not read the body, but the same
instinct applies: do not take the very top slot unless you need it.

## Logging discipline

- **Log the full exception, with its stack trace, exactly once** — at the
  boundary that turns it into a response, which is the advice. Logging at every
  layer as it propagates writes the same failure five times and makes the
  aggregator unusable.
- **Log level by status.** 5xx at `ERROR` — it is your bug. 4xx at `WARN` or
  `INFO` — the client's request was wrong, and a stack trace for a validation
  failure is noise that hides real errors. This one change usually cuts an
  application's `ERROR` volume by an order of magnitude and makes alerting on
  `ERROR` meaningful.
- **Put the correlation id on every line** via MDC, so one request's lines are
  one query.
- **Never log the request body wholesale.** It is the rejected-value problem from
  [chunk 13](13-never-reaches-the-client.md) at greater volume.
- **Log the resolved `type`, not just the message.** `type` is the stable
  identifier; grouping incidents by it works, grouping by free-text `detail`
  does not.

```java
@ExceptionHandler
ProblemDetail handle(Exception ex, HttpServletRequest request, HandlerMethod handlerMethod) {
    String id = (String) request.getAttribute(CorrelationIdFilter.ATTRIBUTE);
    log.error("Unhandled exception in {}#{} [correlationId={}]",
              handlerMethod.getBeanType().getSimpleName(),
              handlerMethod.getMethod().getName(), id, ex);
    ...
}
```

Reading the traces you kept is
[reading stack traces](../../phase-5-exceptions/05-reading-stack-traces/README.md).

## 🔴 Handled exceptions are not recorded as errors by observations

A fact that surprises people and matters for your dashboards. The Framework
reference, on `ServerHttpObservationFilter`:

> *"This will only record an observation as an error if the `Exception` has not
> been handled by the web framework and has bubbled up to the Servlet filter.
> Typically, all exceptions handled by Spring MVC's `@ExceptionHandler` and
> `ProblemDetail` support will not be recorded with the observation."*

So the moment you do the right thing and handle exceptions centrally, your
`http.server.requests` observations **stop attributing them as errors**. They
are still counted, and their `status` and `outcome` tags still reflect the 4xx
or 5xx you returned — but the exception dimension goes quiet.

Two consequences:

- **Do not alert on the observation's exception tag** for anything your advice
  handles. Alert on the status/outcome tags, which do reflect reality.
- **Emit your own signal from the advice** if you want per-problem-type
  metrics — a counter tagged with the `type` URI is the natural shape, and it is
  more useful than an exception class name because it is the same identifier the
  client sees.

`ServerHttpObservationFilter` and what else Spring gives you at each layer are
covered in
[what Spring already gives you](../10-the-request-pipeline/06-what-spring-gives-you.md).

## The trade-off

A correlation id costs you a filter, a header on every response, and an MDC
lifecycle you must get right — an MDC left set on a pooled thread attributes one
request's log lines to another, which is worse than having no id at all. It buys
support the ability to close a ticket and you the ability to hide detail without
becoming undebuggable. The per-line MDC overhead is negligible; the correctness
of the `finally` is not optional.

## Gotchas

**Symptom** — support cannot find the log line for the id a customer quoted.
**Cause** — the id is in the body but not the logs, or it is regenerated per
dispatch so the id the client saw never appears server-side.
**Fix** — one `OncePerRequestFilter`, MDC *and* request attribute *and* response
header, and the id logged on every line.

**Symptom** — the id is missing exactly on the errors you most want to trace.
**Cause** — those responses came from Boot's `/error` fallback rather than your
advice, so the extension member was never added.
**Fix** — rely on the response *header*, which the filter set before the chain
ran and which is therefore present regardless of who produced the body.

**Symptom** — log lines are attributed to the wrong request under load.
**Cause** — the MDC was not cleared in a `finally`, so a pooled thread carried
the previous request's id.
**Fix** — the `finally` in the filter above. This is the classic `ThreadLocal`
leak and it only shows up under concurrency.

**Symptom** — one request produces two different ids in the logs.
**Cause** — the filter is not a `OncePerRequestFilter` and is mapped to the
`ERROR` dispatch as well as `REQUEST`.
**Fix** — extend `OncePerRequestFilter`; it exists for exactly this.

**Symptom** — an external caller's `X-Correlation-Id` contains newlines and
splits your log lines into fake entries.
**Cause** — the inbound header was trusted verbatim.
**Fix** — validate the shape (UUID pattern, or cap length and strip control
characters) before it reaches a log line or the MDC.

**Symptom** — `ERROR`-level log volume is enormous and alerting on it is
useless.
**Cause** — 4xx responses are logged at `ERROR` with stack traces.
**Fix** — log level by status: 5xx at `ERROR`, 4xx at `WARN`/`INFO` and usually
without a trace.

**Symptom** — a dashboard's "exceptions" panel went empty after the advice was
introduced, while error rates stayed the same.
**Cause** — handled exceptions are not recorded as errors by
`ServerHttpObservationFilter`.
**Fix** — alert on status/outcome tags, and emit a counter from the advice tagged
by problem `type` if you want per-kind visibility.

**Symptom** — the same failure appears five times in the log with five stack
traces.
**Cause** — every layer logged the exception on its way up.
**Fix** — log at the boundary only. Layers below either handle it or let it
propagate silently; a `catch`-log-rethrow is the specific anti-pattern.

## Interview questions

**★ How do you keep errors debuggable while telling the client nothing?**
A correlation id: generated (or accepted and validated) in a filter, placed in
the MDC and in a request attribute, echoed as a response header and included as
an extension member in the problem body. The client quotes the id, the server log
holds the full trace, and support joins them.

**★ Why must that filter be a `OncePerRequestFilter`, and why set the header
before the chain runs?**
Because `/error` handling is a second `ERROR` dispatch through the container, so
a filter mapped to all dispatcher types would run twice and mint a second id for
one request. And headers cannot be added after the response is committed, so
setting it before the chain runs is what guarantees the client gets it even for
errors raised late in the response.

**★ Why put the id in a request attribute when you already have MDC?**
Because MDC is a `ThreadLocal` that must be cleared in a `finally` — otherwise it
poisons the next request on a pooled thread. Once cleared, code running on the
`ERROR` dispatch or on another thread cannot read it. The request attribute
belongs to the request object and outlives the thread's MDC scope.

**★ What log level does a 400 deserve?**
`WARN` or `INFO`, and usually without a stack trace: the client sent a bad
request and there is nothing for you to fix. Reserve `ERROR` for 5xx, which are
your bugs. This is what makes alerting on `ERROR` meaningful instead of noise.

**★ Why did the exception metrics go quiet after you introduced a
`@ControllerAdvice`?**
Because `ServerHttpObservationFilter` only records an observation as an error if
the exception was *not* handled and bubbled up to the filter — and the reference
states explicitly that exceptions handled by `@ExceptionHandler` and
`ProblemDetail` support typically are not. The status and outcome tags are still
correct; the exception dimension is not, so alert on the former and emit your own
per-`type` counter if you need the latter.

**★ Should you accept an inbound correlation id from callers?**
Yes for internal callers, because it is what makes a trace span services — and
only after validating it, because it is attacker-controlled text heading
straight into your log pipeline. Newlines in a log line create fabricated
entries; a length cap and a shape check cost nothing.

---

← Prev: [What must never reach the client](13-never-reaches-the-client.md) · Index: [Error handling](README.md) · Next → [The gaps](15-the-gaps.md)
