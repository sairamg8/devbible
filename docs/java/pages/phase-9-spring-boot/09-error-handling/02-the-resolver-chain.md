---
title: "The resolver chain, @ResponseStatus and ResponseStatusException"
sidebar_label: "2 · The resolver chain"
sidebar_position: 2
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-19 against the Spring Framework reference — *Exceptions*
> (docs.spring.io/spring-framework/reference/web/webmvc/mvc-servlet/exceptionhandlers.html
> — the four `HandlerExceptionResolver` implementations, the chain and its
> `order` property, the `ModelAndView`/empty/`null` return contract, and the
> container `ERROR` dispatch) — and the `ResponseStatusException` javadoc
> (docs.spring.io/spring-framework/docs/current/javadoc-api/org/springframework/web/server/ResponseStatusException.html
> — subclass of `ErrorResponseException`, implements `ErrorResponse`, the
> "reason" mapping to `detail`). Spring Boot 4.1.1, Spring Framework 7.0.x,
> JDK 25.

**`@ExceptionHandler` is not a special language feature — it is one
implementation of one interface in a chain the `DispatcherServlet` walks after a
handler throws. Learning the chain rather than the annotation is what lets you
predict which of three plausible mechanisms wins, and why a handler you wrote
is being ignored.**

## Where the chain sits

The `DispatcherServlet` invokes the handler inside a `try`. If the handler — or
any argument resolver, message converter or interceptor invoked on its behalf —
throws, the exception is offered to each configured
`HandlerExceptionResolver` in turn.

The contract of a resolver is three-valued, and the reference spells it out. A
resolver returns:

- **a `ModelAndView` pointing at an error view** — handled, render this;
- **an empty `ModelAndView`** — handled, and the resolver has already written
  the response itself (this is what the `@ExceptionHandler` machinery returns
  for a `@ResponseBody` handler);
- **`null`** — *"the exception remains unresolved, for subsequent resolvers to
  try, and, if the exception remains at the end, it is allowed to bubble up to
  the Servlet container"*.

That last clause is the whole of [chunk 1](01-the-error-shape-is-a-contract.md)'s
default behaviour: falling off the end of the chain is what triggers the
container's `ERROR` dispatch to `/error`.

## The four implementations

The reference lists exactly these:

| Resolver | What it does |
|---|---|
| `ExceptionHandlerExceptionResolver` | *"Resolves exceptions by invoking an `@ExceptionHandler` method in a `@Controller` or a `@ControllerAdvice` class."* |
| `ResponseStatusExceptionResolver` | *"Resolves exceptions with the `@ResponseStatus` annotation and maps them to HTTP status codes based on the value in the annotation."* |
| `DefaultHandlerExceptionResolver` | *"Resolves exceptions raised by Spring MVC and maps them to HTTP status codes."* |
| `SimpleMappingExceptionResolver` | *"A mapping between exception class names and error view names. Useful for rendering error pages in a browser application."* — view-based, not for APIs |

The MVC config *"automatically declares built-in resolvers for default Spring
MVC exceptions, for `@ResponseStatus` annotated exceptions, and for support of
`@ExceptionHandler` methods"* — so in a Boot application the first three are
present with no configuration from you. `SimpleMappingExceptionResolver` is
opt-in and belongs to server-rendered applications.

## The order, and why it is the order

The reference states the mechanism: *"You can form an exception resolver chain
by declaring multiple `HandlerExceptionResolver` beans in your Spring
configuration and setting their `order` properties as needed. The higher the
order property, the later the exception resolver is positioned."*

The registered order in an MVC application runs:

1. **`ExceptionHandlerExceptionResolver`** — your code first.
2. **`ResponseStatusExceptionResolver`** — declarative status next.
3. **`DefaultHandlerExceptionResolver`** — Spring's own fallback last.

This ordering is the answer to a question people ask constantly: *"I put
`@ResponseStatus(NOT_FOUND)` on my exception AND wrote an `@ExceptionHandler`
for it — which wins?"* The `@ExceptionHandler` wins, because its resolver is
first and it returns a non-null result, so the chain stops. The
`@ResponseStatus` annotation is still on the class, still documented in your
IDE, and completely inert. That silent shadowing is worth knowing before you
spend an afternoon on it.

It also explains the reverse case. If your `@ExceptionHandler` **rethrows** the
exception it received, the reference notes it *"can rethrow the exception in its
original form to back out, allowing propagation through the remaining
resolution chain"* — so control falls through to the resolvers behind it. That
is a genuine escape hatch: handle the subset you care about, rethrow the rest,
and let Spring's defaults deal with them.

## `@ResponseStatus` on an exception class

```java
@ResponseStatus(value = HttpStatus.NOT_FOUND, reason = "Order not found")
public class OrderNotFoundException extends RuntimeException {
    public OrderNotFoundException(String id) {
        super("no order " + id);
    }
}
```

Throw it anywhere in the call stack and the client gets a 404. Nothing else is
needed.

**What this buys.** Zero ceremony, and the mapping is visible on the exception
itself — you read the class and you know its HTTP meaning. For a small service
with a handful of exception types and no need for a structured body, it is
genuinely enough.

**What it costs, and this is the deciding argument.** The status is
**hard-coded into the exception type**, which means the exception now knows
about HTTP. A domain exception thrown by a service class that is also called
from a scheduled job, a message consumer or a CLI has an
`org.springframework.http` annotation on it for the benefit of one caller. It
also gives you no control over the body — you get Boot's default error shape,
not your `ProblemDetail`. And `reason`, if you set it, is committed to the
response as the error message; it is a **static** string, so it cannot name the
id that was missing.

## `ResponseStatusException` thrown inline

```java
@GetMapping("/orders/{id}")
Order find(@PathVariable String id) {
    return repo.findById(id)
        .orElseThrow(() -> new ResponseStatusException(
                HttpStatus.NOT_FOUND, "No order with id " + id));
}
```

Same result, opposite trade. Nothing is annotated, the status is chosen at the
throw site, and the reason can interpolate real data.

The javadoc detail that matters: `ResponseStatusException` is a **subclass of
`ErrorResponseException`** and implements **`ErrorResponse`**, and the "reason"
*"by default maps that to the `detail` of the `ProblemDetail`"*. So it is not a
second-class citizen next to RFC 9457 — it produces a `ProblemDetail` body
already, which is why it composes cleanly with everything in
[chunk 6](06-problemdetail-and-rfc-9457.md).

**What it costs.** The controller now imports `HttpStatus`. That is fine in a
controller — a controller is an HTTP adapter, that is its job — and it is
**wrong in a service**, because a service throwing `ResponseStatusException` has
made an HTTP decision in a layer that should not have one.

## Choosing between the three mechanisms

| You want | Use | Because |
|---|---|---|
| A domain exception with one obvious status, small app, default body acceptable | `@ResponseStatus` on the exception | Least machinery; the mapping is where you read the exception |
| A one-off status decision inside a controller, with a dynamic message | `ResponseStatusException` at the throw site | No new class, message can carry data, already an `ErrorResponse` |
| A stable body shape, several exception types, mapping shared across many controllers | `@ExceptionHandler` in a `@RestControllerAdvice` | The only one that controls the body and centralises the table |
| Your exception must stay HTTP-free but still map | `@ExceptionHandler` in the advice | Keeps `org.springframework.http` out of the domain entirely |

For any service that will live longer than a sprint, the third row wins, and
the first two become the exceptions to it rather than the rule. The reason is
in the last row: **a domain exception should be throwable from a message
consumer with no HTTP anywhere near it.**

## The trade-off

The chain is extensible — you can add your own `HandlerExceptionResolver` bean
with an `order` and slot it anywhere. You almost never should. A custom
resolver operates below the annotation model, so it does not see
`@ControllerAdvice` scoping, does not participate in content negotiation, and
has to construct the response by hand. The legitimate uses are narrow: adapting
a third-party framework's exceptions before they reach your advice, or
instrumenting the chain. Everything else is an `@ExceptionHandler` written in
the wrong place.

## Gotchas

**Symptom** — an exception annotated `@ResponseStatus` returns the right status
but the `reason` never appears in the body.
**Cause** — the message is only surfaced if the error attributes include it,
and `spring.web.error.include-message` defaults to `never` (🔴 the key was
`server.error.include-message` before Boot 4).
**Fix** — do not rely on it. Produce the body yourself from an advice; `reason`
is a static string and cannot carry the id anyway.

**Symptom** — an `@ExceptionHandler` for a custom exception never fires, and
the client gets a 500.
**Cause** — the throw happened outside the `DispatcherServlet`'s try block: in
a `Filter`, in an `@Async` method whose result nobody waits on, or during
response writing after commit.
**Fix** — [chunk 15](15-the-gaps.md) covers the filter case,
[chunk 18](18-timeouts-and-async.md) the `@Async` one, and
[chunk 19](19-committed-responses.md) the committed response.

**Symptom** — a `@ResponseStatus` exception is thrown from inside a
`@Transactional` service method and the transaction commits anyway.
**Cause** — nothing to do with the resolver chain: Spring's default rollback
rule is unchecked exceptions only, and if your exception extends `Exception`
rather than `RuntimeException`, no rollback happens. The HTTP status is still
404; the data is still written.
**Fix** — make domain exceptions unchecked, or set `rollbackFor` explicitly.
Status mapping and rollback semantics are independent decisions and neither
implies the other.

**Symptom** — throwing `ResponseStatusException(HttpStatus.NOT_FOUND)` from a
service class works, and a code reviewer objects.
**Cause** — the objection is correct. The service has taken an HTTP decision.
**Fix** — throw `OrderNotFoundException` (a plain unchecked domain exception)
from the service, and map it to 404 once in the advice. The controller and the
advice are the HTTP layer; nothing below them imports `HttpStatus`.

**Symptom** — you add a custom `HandlerExceptionResolver` bean and your
`@ExceptionHandler` methods stop being called.
**Cause** — your resolver has a lower `order` value than
`ExceptionHandlerExceptionResolver`, so it runs first, and it returns a
non-null `ModelAndView` for exceptions it does not really intend to claim.
**Fix** — return `null` for anything you do not deliberately handle. `null` is
the "not mine" signal in this contract and returning an empty `ModelAndView`
by accident swallows the whole chain behind you.

**Symptom** — Spring's own exceptions (unsupported method, unreadable body)
return a plain status with no body, while your exceptions return a nice
`ProblemDetail`.
**Cause** — those are handled by `DefaultHandlerExceptionResolver`, which maps
to a status code and stops. Your advice never saw them.
**Fix** — either extend `ResponseEntityExceptionHandler`
([chunk 10](10-responseentityexceptionhandler.md)) or set
`spring.mvc.problemdetails.enabled=true`
([chunk 6](06-problemdetail-and-rfc-9457.md)). The two routes are different and
chunk 10 explains which to pick.

## Interview questions

**★ What is a `HandlerExceptionResolver` and what are the three things it can
return?**
It is the `DispatcherServlet`'s extension point for turning a thrown exception
into a response. It returns a `ModelAndView` naming an error view; an empty
`ModelAndView` meaning "handled, response already written"; or `null` meaning
"not mine, try the next resolver". If every resolver returns `null` the
exception escapes to the servlet container, which is what triggers the `/error`
error-page dispatch.

**★ I have both a `@ResponseStatus` on my exception class and an
`@ExceptionHandler` for it. Which one applies?**
The `@ExceptionHandler`, because `ExceptionHandlerExceptionResolver` is ordered
before `ResponseStatusExceptionResolver` and returns a non-null result, ending
the chain. The `@ResponseStatus` annotation is silently ignored. This is a real
source of confusion because the annotation is still visible on the class and
looks like it is doing something.

**★ `@ResponseStatus` versus `ResponseStatusException` — how do you choose?**
`@ResponseStatus` binds the status to the exception *type*, so every throw site
gets the same status and the exception now depends on Spring's HTTP package.
`ResponseStatusException` binds it at the *throw site*, so the message can carry
request data and no new class is needed, but it puts `HttpStatus` in the
throwing code. Use the annotation when the exception has exactly one HTTP
meaning forever and the class is HTTP-adjacent anyway; use the exception inline
in a controller for a one-off; use neither in a service, where the right answer
is a plain domain exception mapped centrally.

**★ Is `ResponseStatusException` compatible with `ProblemDetail`?**
Yes, directly — it extends `ErrorResponseException` and implements
`ErrorResponse`, and its "reason" argument becomes the `detail` field of the
`ProblemDetail` body. So a bare `throw new ResponseStatusException(NOT_FOUND,
"No order with id 42")` already produces an RFC 9457 body without you writing a
handler at all.

**★ How would you handle a subset of exceptions in an advice and let the rest
follow Spring's defaults?**
Rethrow. The reference explicitly supports it: an `@ExceptionHandler` method
can rethrow the exception in its original form to back out, and resolution
continues through the remaining chain. It is cleaner than trying to enumerate
every exception you *don't* want to handle in the annotation's value list.

**★ Where in the pipeline does an exception thrown by a `HandlerInterceptor`'s
`preHandle` go?**
Into the same resolver chain, because it is thrown inside the
`DispatcherServlet`'s processing of the request. That is the difference between
an interceptor and a filter, and it is one of the strongest reasons to prefer
an interceptor when the choice is genuinely open — see
[filters vs interceptors vs AOP](../10-the-request-pipeline/05-the-decision-table.md).

**★ Why is writing your own `HandlerExceptionResolver` usually the wrong
answer?**
Because it works below the annotation model: it does not get `@ControllerAdvice`
scoping, content negotiation on the `produces` attribute, argument resolution,
or `ProblemDetail` support. You end up rebuilding, badly, what
`ExceptionHandlerExceptionResolver` already gives you. The narrow legitimate
cases are adapting a foreign framework's exceptions into your own types before
the advice sees them, or observing the chain — not replacing it.

---

← Prev: [The error shape is a contract](01-the-error-shape-is-a-contract.md) · Index: [Error handling](README.md) · Next → [Which handler wins](03-matching-which-handler-wins.md)
