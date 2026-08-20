---
title: "Filters: outside the framework, and that is the whole point"
sidebar_label: "2 · Filters"
sidebar_position: 2
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-20 against the Jakarta Servlet 6.1 javadoc for
> `jakarta.servlet.Filter`
> (jakarta.ee/specifications/servlet/6.1/apidocs/jakarta.servlet/jakarta/servlet/filter
> — the `doFilter` contract and the specification's list of example filters),
> the Spring Framework 7.0 reference *Web MVC → DispatcherServlet → Processing*
> (docs.spring.io/spring-framework/reference/web/webmvc/mvc-servlet/sequence.html
> — "the `HandlerExceptionResolver` beans declared in the `WebApplicationContext`
> are used to resolve exceptions thrown during request processing"), the
> `OncePerRequestFilter` javadoc, and the Spring Boot 4.1 Actuator *Tracing*
> reference for `logging.pattern.correlation` and the baggage properties.
> Spring Boot 4.1.0, Spring Framework 7.0.x, JDK 25.

**A filter is the only layer that runs for every request the container accepts —
including the ones that 404, the ones with a malformed body, and the ones your
security rejects before a controller exists. It is also the only layer that can
replace the request and response objects everything else will see. Those two
powers are why filters still matter in a framework full of nicer tools, and they
come with one matching cost that surprises everybody exactly once: a filter is
outside `DispatcherServlet`, so `@ControllerAdvice` cannot catch what it
throws.**

## The contract, and the sentence people misread

The Servlet specification describes a filter as "an object that performs
filtering tasks on either the request to a resource (a servlet or static
content), or on the response from a resource, or both". The javadoc gives the
intended shape of `doFilter` as: examine the request; optionally wrap the
request with a custom implementation to filter content or headers; optionally
wrap the response the same way; either invoke the next entity in the chain or
block processing; and optionally set headers on the response after invoking the
next entity.

```java
@Component
class BoundaryFilter implements Filter {

    @Override
    public void doFilter(ServletRequest req, ServletResponse res, FilterChain chain)
            throws IOException, ServletException {
        before();
        try {
            chain.doFilter(req, res);   // ← a CALL. The whole application runs inside it.
        } finally {
            after();                    // ← runs even when the controller threw
        }
    }
}
```

`chain.doFilter(...)` is not "hand it on and return". It is a synchronous call
whose stack frame contains the servlet, the controller, the service and the
database round trip. Everything written after it is *unwinding* code, and it
belongs in a `finally` unless you genuinely want it skipped on failure. The most
common filter bug in existence is `MDC.remove(...)` or `sample.stop(...)` sitting
after the call with no `finally`, so it silently stops running for exactly the
requests you were trying to observe.

In practice you rarely implement `Filter` directly. `OncePerRequestFilter` gives
you typed `HttpServletRequest` and `HttpServletResponse` arguments and, in its
javadoc's words, guarantees "a single execution per request dispatch, on any
servlet container" — which matters because one HTTP request can pass through the
chain several times. Why that happens, and how a filter is registered and
ordered, is [chunk 8](08-registration-and-ordering.md).

The specification's own list of example filters reads as a scope statement:
authentication, logging and auditing, image conversion, data compression,
encryption, tokenising, resource access event triggers, XSL/T processing,
MIME-type chaining. Every one of them is about **bytes and transport**. None of
them is about your domain. When a filter you are writing starts needing to know
what an `Order` is, you are at the wrong depth — see
[chunk 5](05-the-decision-table.md).

## 🔴 The gap: a filter's exception never reaches `@ControllerAdvice`

This is the most consequential fact in the topic, and it follows entirely from
the stack in [chunk 1](01-the-full-path.md). `@ControllerAdvice`'s
`@ExceptionHandler` methods are reached through `HandlerExceptionResolver`, and
the reference is precise about who consults those: they are beans "declared in
the `WebApplicationContext`" that `DispatcherServlet` uses "to resolve exceptions
thrown during request processing". A filter that throws before
`chain.doFilter(...)` never enters that servlet. A filter that throws after it
has already left. Either way the exception goes to the container, which performs
its own `ERROR` dispatch — in Boot, to the `/error` endpoint and its default
representation.

The damage is not the stack trace. It is that your API quietly grows a **second,
inconsistent error shape** that appears only under authentication and parsing
failures — the paths clients hit most while integrating. They get `ProblemDetail`
for domain errors and something else entirely for a bad token.

There is no ordering or configuration that closes the gap; the advice is
structurally inside a component the exception bypassed. The fix is to catch it in
the filter and produce the same representation yourself:

```java
@Component
@Order(Ordered.HIGHEST_PRECEDENCE + 20)
class TokenFilter extends OncePerRequestFilter {

    private final HttpMessageConverter<Object> jsonConverter;  // injected

    @Override
    protected void doFilterInternal(HttpServletRequest request,
                                    HttpServletResponse response,
                                    FilterChain chain)
            throws ServletException, IOException {
        try {
            authenticate(request);
            chain.doFilter(request, response);
        } catch (InvalidTokenException ex) {
            var problem = ProblemDetail.forStatusAndDetail(
                    HttpStatus.UNAUTHORIZED, "The bearer token could not be verified.");
            problem.setType(URI.create("https://example.com/problems/invalid-token"));
            problem.setInstance(URI.create(request.getRequestURI()));

            response.setStatus(HttpStatus.UNAUTHORIZED.value());
            jsonConverter.write(problem, MediaType.APPLICATION_PROBLEM_JSON,
                    new ServletServerHttpResponse(response));
        }
    }
}
```

Two details make that work rather than merely compile. It writes
`application/problem+json`, so the body matches the contract
**Topic 09 — Error handling** *(not written yet)* defines for every other
failure. And it serialises through an injected `HttpMessageConverter` rather than
string concatenation, so the JSON is produced by the same Jackson configuration
as the rest of the API — field naming, null inclusion, date format and all.

⚠️ **The better answer, when the concern is authentication, is not to write this
filter.** Spring Security already occupies this position in the chain and
already has an `AuthenticationEntryPoint` for precisely this failure. See
[chunk 6](06-what-spring-gives-you.md) and
[Topic 11 — Spring Security](../11-spring-security/README.md).

## Correlation IDs: the canonical filter, and why it must be one

A correlation ID has to appear on *every* log line written while handling a
request — including lines written before a handler is chosen, and lines written
on the error path where no handler is ever chosen. That requirement is the
definition of "this must be a filter": nothing else has complete coverage.

```java
@Component
@Order(Ordered.HIGHEST_PRECEDENCE + 10)
class CorrelationIdFilter extends OncePerRequestFilter {

    static final String HEADER = "X-Correlation-Id";
    static final String MDC_KEY = "correlationId";

    @Override
    protected void doFilterInternal(HttpServletRequest request,
                                    HttpServletResponse response,
                                    FilterChain chain)
            throws ServletException, IOException {

        String id = Optional.ofNullable(request.getHeader(HEADER))
                .filter(CorrelationIdFilter::isPlausible)  // never trust it raw
                .orElseGet(() -> UUID.randomUUID().toString());

        MDC.put(MDC_KEY, id);
        response.setHeader(HEADER, id);      // BEFORE the chain: not yet committed
        try {
            chain.doFilter(request, response);
        } finally {
            MDC.remove(MDC_KEY);             // the thread outlives the request
        }
    }

    @Override
    protected boolean shouldNotFilterAsyncDispatch() {
        return false;                        // the async thread needs the MDC too
    }

    private static boolean isPlausible(String value) {
        return value.length() <= 64 && value.chars().allMatch(
                c -> Character.isLetterOrDigit(c) || c == '-');
    }
}
```

Five decisions in there matter, and each is a defect if reversed:

- **The header is set before `chain.doFilter`.** Afterwards the response is
  committed and `setHeader` does nothing at all — no exception, no log line.
- **The inbound header is validated, not trusted.** It will be written into every
  log line and echoed to the caller; an unbounded, unfiltered client string in a
  log file is a log-injection vector, and in a response header it is a place to
  smuggle content.
- **A missing header generates an ID rather than skipping.** Half-populated logs
  are worse than consistently populated ones, because you cannot tell "not set"
  from "lost".
- **`MDC.remove` is in a `finally`, and removes one key rather than calling
  `clear()`.** The thread — pooled platform thread or virtual thread — is not
  yours to leave dirty, and `clear()` would also wipe keys other components own.
- **`shouldNotFilterAsyncDispatch()` returns `false`.** The async dispatch runs
  on a *different thread* with an empty MDC; without this the ID vanishes from
  exactly the long-running requests you most want to trace.

⚠️ **Check whether you need this filter before writing it.** With Micrometer
Tracing on the classpath, Boot already puts `traceId` and `spanId` into the MDC
and into the log pattern, configurable through `logging.pattern.correlation`, and
propagates them outbound through the auto-configured `RestClient.Builder` and
`WebClient.Builder`. A hand-rolled ID then sits *alongside* those, and your
operators have to correlate two identifiers by hand. If what you actually want is
a business key — tenant, order number — the mechanism is baggage, configured with
`management.tracing.baggage.remote-fields` and
`management.tracing.baggage.correlation.fields`. That is
[chunk 6](06-what-spring-gives-you.md); what happens to the MDC when work leaves
the request thread is [chunk 10](10-threads-scope-and-async.md).

## Gotchas

**⚠️ The unwinding code is not in a `finally`**
**Symptom:** metrics, MDC cleanup and timing stop happening for failed requests —
the ones you were measuring.
**Cause:** `chain.doFilter` throws and everything below it is skipped.
**Fix:** `try { chain.doFilter(req, res); } finally { cleanup(); }`, without
exception.

**⚠️ Setting a response header after the chain call**
**Symptom:** the header is simply absent, with nothing logged.
**Cause:** the response committed when the message converter wrote the body.
**Fix:** set it before `chain.doFilter`; if the value is only known afterwards,
buffer the response so you control the flush — see
[chunk 9](09-wrapping-and-request-logging.md).

**⚠️ `MDC.clear()` instead of `MDC.remove(key)`**
**Symptom:** trace IDs, tenant keys or a library's own context disappear from
logs downstream of your filter.
**Cause:** `clear()` removes every key on the thread, not just yours.
**Fix:** remove the specific keys you put, in a `finally`.

**⚠️ Trusting an inbound correlation header**
**Symptom:** log files contain newlines, ANSI escapes or 8 KB of attacker-chosen
text; log search breaks.
**Cause:** the header went from the wire into the MDC unvalidated.
**Fix:** bound length and character set, as in the filter above, and generate a
fresh ID when validation fails rather than propagating the bad one.

## Interview questions

**★ Why is `chain.doFilter(request, response)` the most misunderstood line in Spring web code?**
Because it reads like "forward the request" and behaves like "call the rest of
the application". The filter's frame stays on the stack for the whole request,
so code after that line runs *after* the controller has returned or thrown, with
the response usually already committed. Once you read it as a call, the `finally`
requirement, the response-committed rule and the reverse unwinding order all stop
being surprises.

**★ My filter throws and the client gets Boot's default error JSON instead of my `ProblemDetail`. Why, and how do you fix it?**
`@ControllerAdvice` is reached through `HandlerExceptionResolver`, and those
resolvers are consulted by `DispatcherServlet` while it processes a request. A
filter throwing means the servlet was never entered or has already returned, so
the container performs an error dispatch instead. No ordering change helps. You
either catch it in the filter and write the same `ProblemDetail` through an
injected `HttpMessageConverter`, or you move the concern to something that
already does that — Spring Security's `AuthenticationEntryPoint`, for example.

**★ Where does a correlation ID come from, and what do you do with a client-supplied one?**
Take it from an inbound header when present, so a trace survives across service
boundaries; generate one otherwise. Never use the client's value unvalidated:
bound its length and character set, because it goes into every log line and is
usually echoed back in a response header. Put it in the MDC before the chain
call, remove that one key in a `finally`, and set the response header before the
chain call so it is not dropped by a committed response.

**★ Should you write a correlation-ID filter at all in Boot 4?**
Usually not. With Micrometer Tracing present, Boot populates `traceId` and
`spanId` in the MDC, formats them into logs through `logging.pattern.correlation`,
and propagates them on outbound calls made with the auto-configured builders. A
hand-rolled ID becomes a second identifier nobody joins on. If you need a
business key rather than a technical one, use baggage —
`management.tracing.baggage.remote-fields` for the wire and
`management.tracing.baggage.correlation.fields` for the MDC.

**★ Why does the correlation filter override `shouldNotFilterAsyncDispatch()` to return `false`?**
Because an async dispatch is a separate dispatch, usually on a different thread,
and thread-bound state like the MDC does not travel with it. If the filter only
runs on the original `REQUEST` dispatch, everything logged after the async
re-dispatch has no correlation ID — which is precisely the slow, interesting
requests. Returning `false` says "run me once on that dispatch too", which is
what any filter setting up thread state needs.

---

← Prev: [The full path](01-the-full-path.md) · Index: [Phase 9 — Spring Boot and the web](../README.md) · Next → [Interceptors](03-interceptors.md)
