---
title: "The /error floor: what Boot returns when nothing you wrote ran"
sidebar_label: "16 · The /error floor"
sidebar_position: 16
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-20 against the Spring Boot reference *Error Handling*
> (docs.spring.io/spring-boot/reference/web/servlet.html — the `/error`
> mapping, the whitelabel view, `ErrorController`, `ErrorAttributes`,
> `BasicErrorController`, custom error pages, `ErrorViewResolver`,
> `ErrorPageRegistrar`, the `FilterRegistrationBean` dispatcher-type note, and
> error handling in a WAR deployment); the Spring Framework reference
> *Exceptions* — **Container Error Page**
> (docs.spring.io/spring-framework/reference/web/webmvc/mvc-servlet/exceptionhandlers.html);
> and the `ResponseEntityExceptionHandler` javadoc for the
> `NoHandlerFoundException` / `NoResourceFoundException` handlers
> (docs.spring.io/spring-framework/docs/current/javadoc-api).
> `ExceptionHandlerExceptionResolver`'s behaviour when a handler method itself
> throws is cited from the Framework **source**. Spring Boot 4.1.0, Spring
> Framework 7.0.x, JDK 25.

**`/error` is the floor of your error contract: the shape a client receives when
nothing you wrote had a chance to run. Most teams never look at it, which means
most teams ship a second, undocumented error format that appears only when
things are already going badly — differing between browsers and API clients,
and between dev and production, on exactly the responses nobody tests.**

## Everything that escapes lands in one place

The Framework reference states the trigger precisely: *"If an exception remains
unresolved by any `HandlerExceptionResolver` and is, therefore, left to
propagate or if the response status is set to an error status (that is, 4xx,
5xx), Servlet containers can render a default error page in HTML."* Boot
replaces that default with its own, and the Boot reference describes what it
does:

> *"By default, Spring Boot provides an `/error` mapping that handles all errors
> in a sensible way, and it is registered as a 'global' error page in the
> servlet container. For machine clients, it produces a JSON response with
> details of the error, the HTTP status, and the exception message. For browser
> clients, there is a 'whitelabel' error view that renders the same data in HTML
> format."*

Four routes reach it, and they are worth separating because the fixes differ:

1. **An exception escaped the resolver chain** — nobody wrote a handler, or the
   throw was in a filter ([chunk 15](15-the-gaps.md)).
2. **Something called `sendError`** — Spring Security's entry points, a filter,
   or your own code. `sendError` is *defined* to prefer a registered error page.
3. **A request that never mapped to anything** — the 404 for a mistyped URL.
4. **Your own `@ExceptionHandler` threw** — the last section of this chunk.

The HTML/JSON split is content negotiation, not two systems:
`BasicErrorController`'s default *"is to handle `text/html` specifically and
provide a fallback for everything else"*. A browser and an API client get
renderings of the **same** `ErrorAttributes` model, so if you have only ever
tested with `curl` you have never seen half of your own error surface.

## Furnishing the floor: three extension points

| You want | Do this |
|---|---|
| The same fields, different values — add a correlation id, drop a field | A bean of type `ErrorAttributes`: *"add a bean of type `ErrorAttributes` to use the existing mechanism but replace the contents"* |
| An extra content type served from `/error` | *"extend `BasicErrorController`, add a public method with a `@RequestMapping` that has a `produces` attribute, and create a bean of your new type"* |
| To own the fallback entirely | *"implement `ErrorController` and register a bean definition of that type"* |
| A custom HTML page per status, for a browser app | A file under `/error` named for the status or a series mask — `404.html`, `5xx.ftlh` — or an `ErrorViewResolver` bean |

The first is the interesting one for a JSON API, because it is how you make the
floor resemble the contract:

```java
@Component
class ProblemErrorAttributes extends DefaultErrorAttributes {

    @Override
    public Map<String, Object> getErrorAttributes(WebRequest request, ErrorAttributeOptions options) {
        Map<String, Object> attrs = super.getErrorAttributes(request, options);

        Map<String, Object> problem = new LinkedHashMap<>();
        problem.put("type", "https://api.example.com/problems/unexpected");
        problem.put("title", attrs.get("error"));      // e.g. "Not Found"
        problem.put("status", attrs.get("status"));
        problem.put("detail", "An unexpected error occurred.");
        problem.put("instance", attrs.get("path"));

        Object id = request.getAttribute(CorrelationIdFilter.ATTRIBUTE, RequestAttributes.SCOPE_REQUEST);
        if (id != null) {
            problem.put("correlationId", id);
        }
        return problem;
    }
}
```

⚠️ **Read the correlation id from the request attribute, not the MDC.** The
`/error` handling is a second `ERROR` dispatch, and the MDC was cleared in the
original filter's `finally` — that is exactly why
[chunk 14](14-correlation-ids-and-logging.md) insists on storing it in both
places.

⚠️ **The media type is still `application/json`, not
`application/problem+json`.** `BasicErrorController` returns a `Map`, so it is
serialised as ordinary JSON; the problem media type in
[chunk 6](06-problemdetail-and-rfc-9457.md) comes from returning a
`ProblemDetail`, which this route does not. Shaping the attributes gets you the
right *fields*; the right *content type* on the fallback needs a custom
`ErrorController` with a `produces` attribute. Say which of the two you did — a
client switching on the content type will notice, and claiming RFC 9457
compliance for a path that does not send the media type is a lie you will be
held to.

**The `include-*` properties govern this path and only this path.** Once a
`@RestControllerAdvice` handles everything you throw,
`spring.web.error.include-message`, `include-stacktrace`, `include-exception`,
`include-binding-errors` and `include-path` affect the residual `/error`
responses alone — which is precisely the set of responses this chunk is about,
so setting them identically across environments is not optional
([chunk 13](13-never-reaches-the-client.md)). 🔴 They are `spring.web.error.*`
in Boot 4; every pre-2026 sample says `server.error.*`.

## Two mechanisms behind the floor worth knowing exist

**`ErrorPageRegistrar`** is what registers error pages with the container, and
the reference notes it *"works directly with the underlying embedded servlet
container and works even if you do not have a Spring MVC `DispatcherServlet`"*.
That is the machinery under everything above, and the escape hatch if you are
serving something that is not Spring MVC.

**In a WAR deployment there is a filter doing it.** *"When deployed to a servlet
container, Spring Boot uses its error page filter to forward a request with an
error status to the appropriate error page. This is necessary as the servlet
specification does not provide an API for registering error pages."* And the
sentence that matters: *"The error page filter can only forward the request to
the correct error page if the response has not already been committed."* The
floor itself has a floor, and it is commitment —
[chunk 19](19-committed-responses.md).

## The unmapped path is not a settled question

Whether a request to a path nothing maps ever reaches your advice depends on
your Boot version and on whether the static-resource handler claims the path
first. What you can rely on is that `ResponseEntityExceptionHandler` carries
handlers for **both** `NoHandlerFoundException` and `NoResourceFoundException`,
which tells you both can reach the chain when they are raised. Check the default
of `spring.mvc.throw-exception-if-no-handler-found` for your version rather than
reciting one — this is a claim to confirm, not to assume, and its default has
moved across releases.

The practical consequence stands whatever the default is: **test a 404 for a
mistyped URL as part of your error-contract test suite**, because it is the one
error every client hits and the one most likely to come from the floor rather
than from your advice.

## The fourth route to the floor: your own handler failing

A fourth route, and it belongs here because its symptom is silence.
`ExceptionHandlerExceptionResolver` invokes your `@ExceptionHandler` method
inside a `try`. If that method throws something other than the original
exception or one of its causes, the Framework source logs
`logger.warn("Failure in @ExceptionHandler " + exceptionHandlerMethod, ...)` and
returns `null` — which means *unresolved*, so the **original** exception carries
on down the remaining resolvers and, failing those, out to `/error`.

Stated plainly: **a bug in your error handler does not produce a visible error
about your error handler.** It produces a generic 500 for the original problem
plus a `WARN` nobody has an alert on. Error-handling code therefore deserves the
same care as the code it wraps — a null-safe `getMessage()`, a `type` URI that
is a constant rather than a lookup, no database call to enrich the body — and
the `Failure in @ExceptionHandler` string deserves an alert. Treat the exact
wording as version-specific.

## The trade-off

Furnishing the floor costs you a third place where error shaping lives — the
advice, possibly a filter, and now `ErrorAttributes` — and a Boot component you
own across upgrades if you go as far as a custom `ErrorController`. Leaving it
at the defaults costs you a second error format that appears only in the worst
cases, differs between browsers and clients, and differs between environments
whenever the `include-*` properties do.

The middle path most services should take: **leave `BasicErrorController` in
place, override `ErrorAttributes` to add the correlation id and remove anything
revealing, pin the `include-*` properties in the base configuration, and
document that the fallback is `application/json` rather than
`application/problem+json`.** That is a few hours of work and it converts an
unknown into a known.

## Gotchas

**⚠️ The whitelabel page reaching an API client**
**Symptom:** a monitoring agent, an SSR frontend or a browser tab receives HTML
from a JSON API.
**Cause:** it sent `Accept: text/html`, and `BasicErrorController` handles that
specifically.
**Fix:** `spring.web.error.whitelabel.enabled=false` for a pure API, so
negotiation fails loudly instead of quietly serving a human page to a machine.

**⚠️ The filter does not run on the error dispatch, or runs twice**
**Symptom:** a header the filter sets is missing on error responses; or a
counter increments twice for one failed request.
**Cause:** *"the default `FilterRegistrationBean` does not include the `ERROR`
dispatcher type"*, so a filter registered that way is absent from the `/error`
pass — while a filter registered for all dispatcher types without extending
`OncePerRequestFilter` runs on both.
**Fix:** decide which you want, extend `OncePerRequestFilter`, and set the
dispatcher types deliberately. The mechanics belong to [Topic 10 — the request
pipeline](../10-the-request-pipeline/README.md).

**⚠️ Order-dependent invisibility**
**Symptom:** the same exception is shaped correctly in one environment and not
in another.
**Cause:** two filters whose relative order differs between configurations — the
one that translates sits before the one that throws in one and after it in the
other.
**Fix:** pin the order explicitly with `@Order` or `FilterRegistrationBean`
rather than relying on discovery order, and assert it in a test.

**⚠️ The correlation id is null in the fallback body**
**Symptom:** `correlationId` is present on advice-produced errors and absent on
`/error` ones.
**Cause:** the `ErrorAttributes` implementation read the MDC, which was cleared
by the originating filter's `finally` before the `ERROR` dispatch ran.
**Fix:** read the **request attribute**, as in the code above, and keep setting
the response header so it is present regardless of who built the body.

**⚠️ Probing `/error` directly**
**Symptom:** a health check pointed at `/error` reports a 500 with no error
behind it, and pollutes your error rate.
**Cause:** `/error` is an ordinary mapped path; hitting it with no error
attributes set produces a 500-shaped body.
**Fix:** point probes at the Actuator health endpoints instead
(**Topic 13 — Actuator** *(not written yet)*). Changing
`spring.web.error.path` hides it rather than fixing it.

## Interview questions

**★ What is `/error` and when does it run?**
It is the mapping Boot registers as the servlet container's global error page.
The container performs an `ERROR` dispatch to it when an exception has escaped
everything, when `sendError` was called, or when a request never mapped, and
`BasicErrorController` builds a body from `ErrorAttributes`. It is the floor of
your error contract — the shape returned when nothing you wrote had a chance to
run — which is exactly why leaving it at its defaults is a decision, not an
omission.

**★ Why does the same broken endpoint return HTML in a browser and JSON from
`curl`?**
Content negotiation inside `BasicErrorController`, which handles `text/html`
specifically and falls back to JSON for everything else. It is one
`ErrorAttributes` model rendered two ways, not two mechanisms — which means the
whitelabel page is part of your published error surface whether or not you have
ever looked at it.

**★ I want a correlation id in the fallback error body. Where does it go?**
A bean of type `ErrorAttributes` — the reference's phrasing is to add one *"to
use the existing mechanism but replace the contents"*. Extend
`DefaultErrorAttributes`, call `super`, and read the id from the **request
attribute** rather than the MDC, because `/error` is a second dispatch and the
MDC was cleared in the originating filter's `finally`. Keep setting the response
header too, since that survives regardless of who builds the body.

**★ Does an `ErrorAttributes` bean make `/error` RFC 9457 compliant?**
No — it makes the *fields* right, not the media type. `BasicErrorController`
returns a `Map`, which serialises as `application/json`; the
`application/problem+json` type comes from returning a `ProblemDetail`. If
compliance matters on the fallback you need a custom `ErrorController` with a
`produces` attribute. Otherwise, document the discrepancy rather than claiming
compliance you do not have.

**★ Which Boot properties still matter once you have a `@ControllerAdvice`, and
which stop mattering?**
The `spring.web.error.include-*` properties stop affecting anything your advice
handles — you are building that body yourself — and continue to govern the
`/error` fallback, which is the exact set of responses you have least control
over. So they matter *more* after centralisation, not less, and they belong in
the base configuration where no profile can forget to override them.
🔴 They were `server.error.*` before Boot 4.

**★ A request to a path that maps to nothing — does your advice see it?**
It depends on the version and on whether the resource handler claims the path,
which is why the honest answer is "test it rather than assume". What is
documented is that `ResponseEntityExceptionHandler` handles both
`NoHandlerFoundException` and `NoResourceFoundException`, so both can reach the
chain. If neither is raised, the 404 comes from the container and is rendered by
`/error` — which is a good reason to have furnished it.

**★ Where does `sendError` fit into all this?**
It is the deliberate way to invoke the floor. The Servlet contract says it
clears the buffer and prefers a registered error-page declaration, so in a Boot
application it routes to `/error` and discards anything you had prepared. That
makes it correct for a component that has no error contract of its own and wrong
for anything that was about to write a `ProblemDetail`
([chunk 15](15-the-gaps.md)).

---

← Prev: [The gaps](15-the-gaps.md) · Index: [Error handling](README.md) · Next → [Async requests](17-async-requests.md)
