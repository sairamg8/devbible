---
title: "Where does this concern belong?"
sidebar_label: "5 · The decision table"
sidebar_position: 5
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-20 against the Spring Framework 7.0 reference — *Interception*
> (docs.spring.io/spring-framework/reference/web/webmvc/mvc-servlet/handlermapping-interceptor.html,
> for the security warning), *CORS*
> (docs.spring.io/spring-framework/reference/web/webmvc-cors.html) and *Filters*
> (`web/webmvc/filters.html`) — the Spring Security 7 reference
> *Servlet Applications → Architecture*, and the Spring Boot 4.1 reference on
> `server.compression.*`. Spring Boot 4.1.1, Spring Framework 7.0.x, JDK 25.

**Do not choose a mechanism by how comfortable it is to write. Choose it by
answering three questions in order, because each one eliminates layers and the
first "no" usually settles it: (1) must this run for requests that never reach a
handler? (2) does it need to replace or re-read the request or response bytes?
(3) does its rule refer to your domain types rather than to HTTP? A yes to (1)
or (2) means a filter and nothing else. A no to both, plus a need to know which
handler is running, means an interceptor. A rule written in domain terms means
an aspect.**

## The three questions, and why they are in that order

**1 · Does it have to run when no handler matched?**
Interceptors come from the `HandlerExecutionChain`, which only exists once a
handler has been found. AOP advice runs only when a method is invoked. So a 404,
a 405, a request blocked by security, or a probe for `/wp-admin` is seen by
**filters only**. Any concern that must be complete — a request counter, an
access log, an authentication check, a global body-size limit — fails this test
at any other depth.

**2 · Does it need the bytes, or need to swap the request or response object?**
Wrapping is a filter-exclusive power; the Servlet javadoc's `doFilter` contract
is literally built around it. Nothing further down can hand the layers above it a
different `HttpServletRequest`. Re-reading a body, buffering a response,
transcoding, compressing — filter.

**3 · Is the rule expressed in domain terms?**
If you would state the rule using your own types — "every completed transfer",
"any read of another tenant's `Account`" — then the layer that has those types is
the aspect, and the layers above would have to re-parse the body to reconstruct
them.

If none of the three applies but the concern still needs to know *which endpoint
is running*, that is the interceptor's one distinguishing power and the right
place for it.

⚠️ **A fourth question overrides all three: is it already built?** Most of the
rows below have a Spring or Boot implementation you should be configuring rather
than writing. That is [chunk 6](06-what-spring-gives-you.md), and it is the
chunk that actually saves you code.

## The table

| Concern | Belongs in | Why — the reason, not the verdict |
|---|---|---|
| **Authentication / authorization** | **Filter** (in practice: Spring Security's chain) | Must reject requests that never match a handler, and must run before routing. The reference warns interceptors are "not ideally suited as a security layer due to the potential for a mismatch with annotated controller path matching" |
| **CORS** | **Framework support** — `CorsRegistry` or `@CrossOrigin`; a `CorsFilter` when Security or ordering demands it | Preflight is an `OPTIONS` request with no body that must be answered before the handler; `HandlerMapping` handles it after matching the handler, which is why `@CrossOrigin` can live on the controller. With Spring Security in play a filter is the reliable position — see [chunk 6](06-what-spring-gives-you.md) |
| **Correlation / trace IDs** | **Filter** — and prefer Micrometer's built-in tracing to a hand-written one | Must be on *every* log line including the ones from failed routing and the error path, so nothing narrower has full coverage |
| **Request logging (with bodies)** | **Filter**, with a wrapper | The body is a once-only stream; replaying it needs a request wrapper, which only a filter can install. Harder than it looks — [chunk 9](09-wrapping-and-request-logging.md) |
| **Metrics / timing** | **Built-in observation filter**; a filter if you must write it | Must cover unmatched requests to be trustworthy, and must tag by URI *pattern* to avoid unbounded cardinality. `ServerHttpObservationFilter` already does both |
| **Rate limiting** | **Filter** for a global or per-client budget; **interceptor** for a per-endpoint budget | Global budgets must include requests that 404 (that is how scanners are absorbed). Per-endpoint budgets need the `HandlerMethod` and its annotation, which only an interceptor has |
| **Multi-tenancy context** | **Filter** to establish it, cleared in a `finally` | Everything downstream — security, data access, logging — depends on it, so it must be set before routing and torn down on every exit path. Propagation beyond the request thread is [chunk 10](10-threads-scope-and-async.md) |
| **Response compression** | **Neither — container configuration** (`server.compression.enabled`) | The embedded container already does it, negotiating `Accept-Encoding` and honouring a minimum size. A hand-written compressing filter must wrap the response, get the negotiation right, and not fight the container |
| **Input sanitising** | **Nowhere as a blanket layer.** Validate at binding; encode at output | A filter that rewrites request bytes corrupts legitimate payloads and gives false assurance. Constraints belong on the DTO (**[Topic 08 — Validation](../08-validation/README.md)**), parameterised queries defeat SQL injection, and escaping is the renderer's job |
| **Auditing a domain action** | **AOP** | The rule is in domain terms and needs the typed arguments and return value. It must also fire for the same action triggered by a scheduled job or a message listener, which no web layer can see |
| **Transactions** | **AOP** (`@Transactional`) | A transaction's boundary is a service method, not a request. Tying it to the request would open one for every 404 and would not cover non-HTTP callers |
| **Enforcing a custom `@RequiresFeature` on endpoints** | **Interceptor** | It needs `HandlerMethod.getMethodAnnotation(...)` — the one thing the interceptor layer exists to give you |
| **Adding a response header to every response** | **Filter**, before `chain.doFilter` | The response commits inside the `HandlerAdapter`, so `postHandle` is too late. A `ResponseBodyAdvice` also works when only handler responses need it |

## The "does it see a 404" test, worked

Take a naive global request counter written as an interceptor:

```java
// WRONG for a global counter
@Override
public boolean preHandle(HttpServletRequest req, HttpServletResponse res, Object handler) {
    counter.increment();      // never runs for unmatched paths
    return true;
}
```

On a service under scanner traffic, most requests are unmatched paths. This
counter reports a fraction of real load, and the fraction changes with the
attack. The same code as a filter counts everything:

```java
@Component
class RequestCountFilter extends OncePerRequestFilter {
    @Override
    protected void doFilterInternal(HttpServletRequest req, HttpServletResponse res,
                                    FilterChain chain) throws ServletException, IOException {
        try {
            chain.doFilter(req, res);
        } finally {
            counter.increment(res.getStatus());   // includes 404, 405, 401
        }
    }
}
```

— and the built-in `http.server.requests` observation already does exactly this,
tagging unmatched requests `NOT_FOUND` rather than by their raw path, which is
what stops the metric from exploding in cardinality.

## Two rows that are usually decided wrongly

**Rate limiting is two different concerns wearing one name.** "No client may
exceed 1,000 requests a minute" is transport policy: it must count the requests
that 404, because absorbing junk traffic is the point, so it is a filter.
"This report endpoint may be called twice a minute" is endpoint policy expressed
as an annotation on the handler, so it is an interceptor — the example in
[chunk 3](03-interceptors.md). Implementing the second as a filter forces you to
re-derive routing from the raw path, which is the mismatch the reference warns
about for security, reappearing in a new costume.

**Input sanitising is the row people most want to be a filter, and it is the one
row where a filter is actively harmful.** A filter that strips `<script>` from
request bodies gives a real defence against nothing and corrupts every legitimate
payload that contains the characters — code snippets, product descriptions,
mathematical text. Injection is defeated where the value is *used*: parameterised
queries for SQL, contextual escaping at render time, a constraint on the DTO
where the value is genuinely constrained. A blanket rewriting filter mostly
converts a visible failure into silent data corruption.

## Gotchas

**⚠️ Choosing a filter because "it runs first"**
**Symptom:** the filter parses the path to work out which controller will handle
it, and drifts out of sync with the mappings.
**Cause:** the concern actually needed the handler, not earliness.
**Fix:** if the code contains a second copy of your routing rules, it belongs in
an interceptor.

**⚠️ Choosing AOP because the code reads nicely**
**Symptom:** the aspect calls `RequestContextHolder`, and breaks in tests, jobs
and message listeners.
**Cause:** the rule was an HTTP rule, and the aspect had to reach out of its
layer for HTTP.
**Fix:** move it up. An aspect that needs the request is an interceptor written
in the wrong place — see [chunk 4](04-aop-at-the-web-boundary.md).

**⚠️ Splitting one concern across two layers**
**Symptom:** a tenant is set in a filter and cleared in an interceptor's
`afterCompletion`; on a 404 it is set and never cleared, and the next request on
that thread inherits it.
**Cause:** the two layers have different coverage.
**Fix:** set up and tear down at the same depth, in a `finally`.

**⚠️ Writing any of these before checking what is already registered**
**Symptom:** duplicated CORS headers, double encoding, two metrics for one
request.
**Cause:** Boot and Framework register a set of filters by default and most
hand-written ones re-implement one.
**Fix:** [chunk 6](06-what-spring-gives-you.md), before you write anything.

## Interview questions

**★ Give me a concern that genuinely has to be a filter, and one that only looks like it does.**
Genuinely a filter: anything that must cover requests which never reach a handler
— authentication, a global request counter, correlation IDs, a body-size limit —
plus anything that needs to wrap the request or response, since that is a power
no other layer has. Only looks like it: "log the controller method and its
arguments", which a filter cannot do at all because it does not know which
handler will run, and which is trivial for an interceptor or an aspect.

**★ Why does the Servlet specification's own list of example filters — compression, encryption, image conversion — argue against putting business rules in one?**
Because every example is a transformation of the *transport*: bytes in, bytes
out, with no knowledge of what the bytes mean. That is the shape the API was
designed for, which is why a filter is handed an `HttpServletRequest` and never
your DTO. A filter that needs to know an order's total is reaching past its own
abstraction — it ends up parsing the body, breaking the once-only stream, and
duplicating validation the handler already performs.

**★ Rate limiting: filter or interceptor?**
Both, for different rules. A global or per-client budget is a filter, because it
has to count requests that never match a handler — that is exactly the traffic a
limiter exists to absorb. A per-endpoint budget declared as an annotation on the
handler is an interceptor, because reading that annotation requires the
`HandlerMethod`. Writing the second as a filter means re-deriving routing from
the raw path, which will eventually disagree with the real mapping.

**★ Should you sanitise input in a filter?**
No. Rewriting request bytes globally corrupts legitimate content and defends
against nothing specific, because injection is a property of how a value is
*used*, not of how it arrived. Use parameterised queries, escape at render time,
and put real constraints on the DTO. The one legitimate filter-level input
control is a *limit* rather than a rewrite — maximum body size, maximum header
count — because that is a transport rule.

**★ How would you decide where to put a "block requests from this tenant" rule?**
Ask the three questions. It must apply to every request from that tenant,
including ones that 404 or hit an endpoint that does not exist yet, so question
one already says filter. It also needs to run before anything expensive, and its
input is a header or a token claim rather than a domain object. In practice it
belongs in the Spring Security chain, next to authentication, rather than as a
separate hand-written filter — which is question four.

---

← Prev: [AOP at the web boundary](04-aop-at-the-web-boundary.md) · Index: [Phase 9 — Spring Boot and the web](../README.md) · Next → [What Spring already gives you](06-what-spring-gives-you.md)
