---
title: "The error shape is part of your API"
sidebar_label: "1 · The shape is a contract"
sidebar_position: 1
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-19 against the Spring Boot reference — *Servlet Web
> Applications · Error Handling*
> (docs.spring.io/spring-boot/reference/web/servlet.html — the `/error` mapping,
> the whitelabel view, `ErrorController`, `ErrorAttributes`,
> `BasicErrorController`, `spring.mvc.problemdetails.enabled`) — and the Spring
> Framework reference *Exceptions*
> (docs.spring.io/spring-framework/reference/web/webmvc/mvc-servlet/exceptionhandlers.html
> — the container ERROR dispatch). Property renames confirmed against the
> **Spring Boot 4.0 Configuration Changelog** (GitHub wiki). Spring Boot 4.1.0,
> Spring Framework 7.0.x, JDK 25.

**Every response your service can produce is part of its published interface,
and that includes the ones it produces when something goes wrong. A client
writes code against your 404 exactly as much as against your 200 — so an error
body that differs per endpoint, per developer, and per week is a broken
contract that nobody wrote down. The whole of this topic is one move: decide
the error shape once, in one place, and make it impossible for an endpoint to
invent its own.**

## What happens today, with no error handling at all

Throw a `RuntimeException` out of a controller method in a stock Boot
application and the following happens, in order:

1. The `DispatcherServlet` offers the exception to each registered
   `HandlerExceptionResolver`. None of them claims it — there is no
   `@ExceptionHandler`, no `@ResponseStatus` on the exception class, and it is
   not one of Spring MVC's own exceptions.
2. The exception is allowed to propagate back out to the servlet container.
3. Boot has registered a global error page pointing at `/error`. The container
   makes an **`ERROR` dispatch** — a second, internal trip through the servlet
   pipeline to that path, carrying the original status, message and exception
   as request attributes.
4. Boot's `BasicErrorController` handles `/error`. The reference states the
   contract plainly: *"By default, Spring Boot provides an `/error` mapping that
   handles all errors in a sensible way, and it is registered as a 'global'
   error page in the servlet container. For machine clients, it produces a JSON
   response with details of the error, the HTTP status, and the exception
   message. For browser clients, there is a 'whitelabel' error view that renders
   the same data in HTML format."*

So you already have an error contract. You did not choose it, you did not write
it down, and its field set is decided by Boot's defaults and by which
`spring.web.error.include-*` properties happen to be set in each environment.
That last part is the sharp edge: **the same exception produces a different JSON
body in dev and in prod**, because `include-message` and `include-stacktrace`
are usually turned up locally. A client written against the dev shape breaks
against the prod one.

## The `ERROR` dispatch is a second request, and that matters

Step 3 above is not a detail. The `/error` handling is a **fresh dispatch
through the container**, not a continuation of the original one. Three
consequences that cost people days:

- Your filters run **again** for the `ERROR` dispatch — or do not run at all —
  depending on their declared dispatcher types. This is the single most common
  reason a request-id filter emits two ids for one request, or none on errors.
  Covered properly in
  [**the pipeline topic**](../10-the-request-pipeline/02-filters.md).
- Anything you stored in a `ThreadLocal` and cleaned up in a `finally` in the
  original dispatch is **gone** by the time `/error` runs. Your correlation id
  is not in the error body unless you put it somewhere the second dispatch can
  read — a request attribute, or a response header set before the throw.
- `/error` is a real URL. It is mapped, and unless you say otherwise it is
  reachable. Hitting it directly returns a 500-shaped body with no error behind
  it, which confuses monitoring more than it should.

## Why per-endpoint error JSON is the thing to delete

The natural first move, before anyone has read this page, is to catch in the
controller:

```java
@PostMapping("/orders")
public ResponseEntity<?> create(@RequestBody OrderRequest req) {
    try {
        return ResponseEntity.ok(orders.create(req));
    } catch (NoSuchCustomerException e) {
        return ResponseEntity.status(404).body(Map.of("error", "customer not found"));
    } catch (InsufficientStockException e) {
        return ResponseEntity.status(409).body(Map.of("message", e.getMessage(), "code", "STOCK"));
    }
}
```

This compiles, it works, and it is wrong for four separate reasons — none of
them stylistic.

**One: the shape drifts.** `{"error": ...}` in one branch, `{"message":...,
"code":...}` in the next, `{"errors":[...]}` in the validation handler
somebody adds next month. A client cannot write one error parser. It writes
five, or it writes one and guesses.

**Two: the happy path is now unreadable.** The method's job is "create an
order". Two thirds of it is HTTP translation of failures it cannot fix. The
business logic is the minority tenant in its own method.

**Three: it does not compose.** `orders.create` may throw
`NoSuchCustomerException` from three layers down, but so may six other
endpoints. Each of them repeats the same `catch`, and when the mapping changes
from 404 to 422 you change it in six places and miss the seventh.

**Four: it cannot catch what it never sees.** A malformed JSON body fails in
the `HttpMessageConverter` **before your method is entered**. A type mismatch on
a path variable fails in the argument resolver. A `@Valid` failure fails at
binding. None of those go anywhere near your `try`. So even a perfectly
disciplined per-endpoint handler covers only the exceptions your own code
throws, which is a minority of the errors your API actually emits.

## The one-sentence goal

> The controller throws a domain exception that knows nothing about HTTP. One
> global component translates every exception — yours and Spring's — into one
> documented media type. No endpoint constructs an error body.

Everything else in this topic is the machinery for that sentence and the places
where it leaks.

## The trade-off

Centralising errors buys a stable contract and costs you **locality**. Reading
a controller no longer tells you what a caller sees when it fails — you have to
know that a `@RestControllerAdvice` exists and go and read it. That is a real
cost for a newcomer, and it is why the advice class should be small, in an
obvious package, and should read as a table rather than as logic.

The second cost is **over-generalisation**. A single `handle(Exception ex)`
returning 500 is centralisation without translation: it makes every failure look
identical, including the ones the client could have fixed. Central handling is
only worth it if the mapping is deliberate per exception, which is
[chunk 11](11-mapping-domain-exceptions.md).

## Gotchas

**Symptom** — the error JSON has a `message` field locally and not in
production.
**Cause** — `spring.web.error.include-message` defaults to `never`, and a local
profile sets it to `always`. 🔴 **In Boot 4 this key moved**: the 4.0
Configuration Changelog records `server.error.include-message` →
`spring.web.error.include-message`, along with `include-stacktrace`,
`include-binding-errors`, `include-exception`, `include-path`, `path` and
`whitelabel.enabled`. Every tutorial online still shows the `server.error.*`
form.
**Fix** — stop depending on Boot's default body at all. Once a
`@RestControllerAdvice` produces `ProblemDetail` for everything, the
`include-*` properties only affect the residual `/error` path, and they should
be identical across environments.

**Symptom** — a `@ControllerAdvice` handler exists but the client still gets
Boot's default error body.
**Cause** — the exception did not reach the `DispatcherServlet`'s resolver
chain. It was thrown in a servlet `Filter`, or during response writing after
the status was committed.
**Fix** — see [chunk 15](15-the-gaps.md) for the filter case and
[chunk 19](19-committed-responses.md) for the committed one; both are outside
the advice's reach by construction, not by misconfiguration.

**Symptom** — `/error` returns a 500-shaped payload when a monitoring probe
hits it directly.
**Cause** — it is an ordinary mapped path with no error attributes set.
**Fix** — do not point a probe at it. Use the Actuator health endpoints
(**[Topic 13 — Actuator](../13-actuator/README.md)**) and, if the exposure bothers you,
change the path with `spring.web.error.path`.

**Symptom** — a browser hitting a broken endpoint gets HTML, an API client
gets JSON, and you only tested one of them.
**Cause** — the whitelabel view is content-negotiated; `BasicErrorController`
*"handle[s] `text/html` specifically and provide[s] a fallback for everything
else"*.
**Fix** — for a pure API, disable it with
`spring.web.error.whitelabel.enabled=false` and let content negotiation fail
loudly rather than silently returning a human page to a machine.

## Interview questions

**★ A controller method throws an exception nobody handles. Walk me through
what the client receives and why.**
The exception propagates out of the handler method, no `HandlerExceptionResolver`
claims it, and it escapes the `DispatcherServlet` to the container. Boot has
registered `/error` as the container's global error page, so the container
performs an `ERROR` dispatch to it. `BasicErrorController` builds a body from
`ErrorAttributes` — timestamp, status, error, path, and optionally message and
stack trace depending on the `spring.web.error.include-*` settings — and the
client gets JSON or the whitelabel HTML page depending on its `Accept` header.
The key point is that the response the client sees was produced by a **second
dispatch**, not by the original request.

**★ Why is "the error shape is part of the API" more than a slogan?**
Because clients branch on it. A frontend that shows "customer not found"
differently from "payment declined" is reading a field out of your error body,
and the moment that field's name or presence changes, the frontend breaks — with
no compiler, no schema check and usually no test, because error paths are the
least-tested part of most clients. Treating the error body as an incidental
detail means shipping breaking changes without a version bump, which is exactly
what versioning exists to prevent
([API versioning](../07-rest-controllers/12-api-versioning.md)).

**★ What is wrong with catching exceptions in the controller and returning
`ResponseEntity.status(...)`?**
Four things: the shape drifts between endpoints; the happy path is buried in
HTTP translation; the same mapping is duplicated everywhere the exception can
surface; and it structurally cannot catch the errors raised *before* the method
is entered — unreadable JSON, type mismatches, validation failures, unsupported
media types — which are most of what a real API returns 4xx for.

**★ Is there any legitimate case for handling an exception inside the
controller?**
Yes, when the handling is not error translation but **control flow**. If a
lookup miss means "fall back to the cache" or "return an empty page", catching
it locally is the right answer, because you are recovering rather than
reporting. The rule is: catch it locally if you can fix it; let it fly if the
only remaining move is to tell the client.

**★ Why does the `/error` dispatch break a correlation id implemented with a
`ThreadLocal`?**
The `ERROR` dispatch is a new pass through the container. If the id was stored
in a `ThreadLocal` and removed in a `finally` block during the original
dispatch — which it must be, or it leaks onto the next request on a pooled
thread — it no longer exists when `/error` runs. Storing it as a **request
attribute** or writing it into a response header at the start of the request
survives, because both belong to the request/response objects rather than the
thread. The `ThreadLocal` lifecycle problem is the same one covered in
[ThreadLocal and ScopedValue](../../phase-6-concurrency/12-threadlocal-scopedvalue/README.md).

---

← Index: [Error handling](README.md) · Phase: [Phase 9 — Spring Boot and the web](../README.md) · Next → [The resolver chain](02-the-resolver-chain.md)
