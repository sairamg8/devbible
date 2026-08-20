---
title: "Async requests: the thread is gone, the advice is not"
sidebar_label: "17 · Async requests"
sidebar_position: 17
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-20 against the Spring Framework reference *Asynchronous
> Requests*
> (docs.spring.io/spring-framework/reference/web/webmvc/mvc-ann-async.html —
> `DeferredResult`, `Callable`, `WebAsyncTask`, the two processing sequences,
> the **Exception Handling** subsection, reactive return values,
> `AsyncHandlerInterceptor`, and the `asyncSupported` / `ASYNC` dispatcher-type
> requirement), and the `WebAsyncTask` description on the same page. Spring
> Boot 4.1.0, Spring Framework 7.0.x, JDK 25.

**An async controller returns before the work is finished, on a thread that is
then released back to the container. That sounds like it should break everything
in this topic, and it does not: Spring dispatches the request *back* into the
container when the result arrives, so the same resolver chain runs and your
`@ControllerAdvice` fires normally. What actually breaks is everything hanging
off the original thread — the MDC, the filters that were not declared for the
`ASYNC` dispatch, the interceptor callback that is now a different callback —
and every one of those failures is silent.**

## The four ways a controller goes async, and they are two mechanisms

| Return type | Adapted like | You control the failure by |
|---|---|---|
| `Callable<T>` | itself — run on the configured `AsyncTaskExecutor` | throwing from the `Callable` |
| `WebAsyncTask<T>` | `Callable`, plus a per-request timeout and executor | throwing from the `Callable` |
| `DeferredResult<T>` | itself — completed by any thread you like | `setErrorResult(ex)` |
| `CompletableFuture<T>`, `CompletionStage<T>`, `Mono`, `Single` | `DeferredResult` | completing the promise exceptionally |

The reference is explicit about the last row: *"A single-value promise is adapted
to, similar to using `DeferredResult`. Examples include `CompletionStage` (JDK),
`Mono` (Reactor), and `Single` (RxJava)."* So there are really only two
mechanisms to understand, and `CompletableFuture` — the one most services
actually return — is the `DeferredResult` one wearing a familiar type.

`WebAsyncTask` exists for one reason worth knowing: it *"allows customizing
additional settings such as request timeout value, and the `AsyncTaskExecutor`
to execute the `java.util.concurrent.Callable` with instead of the defaults set
up globally"*. If one endpoint legitimately takes longer than the rest, that is
where the exception to the global timeout goes.

## What actually happens to the thread

The reference's own sequence for `Callable`, quoted because the third step is
the whole point:

> *"The controller returns a `Callable`. Spring MVC calls `request.startAsync()`
> and submits the `Callable` to an `AsyncTaskExecutor` for processing in a
> separate thread. Meanwhile, the `DispatcherServlet` and all filters exit the
> Servlet container thread, but the response remains open. Eventually the
> `Callable` produces a result, and Spring MVC dispatches the request back to
> the Servlet container to complete processing. The `DispatcherServlet` is
> invoked again, and processing resumes with the asynchronously produced return
> value."*

`DeferredResult` is the same shape with the application, rather than an
executor, providing the result: *"the `DispatcherServlet` and all configured
filters exit the request processing thread, but the response remains open."*

**"All filters exit"** is the sentence to remember. Your correlation-id filter's
`finally` has already run. The MDC is already clear. The request attribute is
still there, because it belongs to the request rather than the thread — which is
the second time [chunk 14](14-correlation-ids-and-logging.md)'s insistence on
storing it in both places pays for itself.

## How the exception gets back

Directly, and by design:

> *"When you use a `DeferredResult`, you can choose whether to call `setResult`
> or `setErrorResult` with an exception. In both cases, Spring MVC dispatches
> the request back to the Servlet container to complete processing. It is then
> treated either as if the controller method returned the given value or as if
> it produced the given exception. The exception then goes through the regular
> exception handling mechanism (for example, invoking `@ExceptionHandler`
> methods). When you use `Callable`, similar processing logic occurs, the main
> difference being that the result is returned from the `Callable` or an
> exception is raised by it."*

So the async gap is not a gap in the handler model. It is a gap in everything
*around* it.

```java
@GetMapping("/orders/{id}/report")
public DeferredResult<Report> report(@PathVariable String id) {
    DeferredResult<Report> result = new DeferredResult<>();

    reports.buildAsync(id).whenComplete((report, ex) -> {
        if (ex != null) {
            result.setErrorResult(unwrap(ex));   // NOT setResult(someErrorBody)
        }
        else {
            result.setResult(report);
        }
    });
    return result;
}

/** CompletableFuture wraps failures in CompletionException; hand over the real one. */
private static Throwable unwrap(Throwable ex) {
    return (ex instanceof CompletionException && ex.getCause() != null) ? ex.getCause() : ex;
}
```

Two decisions in nine lines, and both are the ones people get wrong.

**`setErrorResult`, not `setResult` with an error body.** Passing an error object
to `setResult` means the framework treats it as a *successful* return value: it
serialises with a 200 and your advice never runs. `setErrorResult` re-enters the
exception path. The distinction is the async version of
[chunk 1](01-the-error-shape-is-a-contract.md)'s "no endpoint constructs an
error body".

**Unwrap the `CompletionException`.** A `CompletableFuture` that fails hands its
callbacks a `CompletionException` wrapping the real cause. If you pass that
through, an `@ExceptionHandler(OrderNotFoundException.class)` matches only
because of the cause-level matching described in
[chunk 3](03-matching-which-handler-wins.md) — which does work, but leaves the
wrapper in your logs and in any `instanceof` you write. Unwrapping once at the
boundary is cheaper than reasoning about it forever.

## The plumbing that has to be right

Two requirements, both quoted from the reference, both invisible until they
bite:

> *"Filter and Servlet declarations have an `asyncSupported` flag that needs to
> be set to `true` to enable asynchronous request processing. In addition,
> Filter mappings should be declared to handle the `ASYNC`
> `jakarta.servlet.DispatchType`."*

> *"`HandlerInterceptor` instances can be of type `AsyncHandlerInterceptor`, to
> receive the `afterConcurrentHandlingStarted` callback on the initial request
> that starts asynchronous processing (instead of `postHandle` and
> `afterCompletion`)."*

The first is why a filter that works for synchronous endpoints silently stops
covering the async ones. The second is why an interceptor that cleans up in
`afterCompletion` gets a *different* callback for async requests — and if it only
implements `HandlerInterceptor`, gets no notification at that point at all.

**Whatever you propagate to the worker thread, propagate it explicitly.**

```java
String correlationId = (String) request.getAttribute(CorrelationIdFilter.ATTRIBUTE);
return CompletableFuture.supplyAsync(() -> {
    MDC.put(CorrelationIdFilter.ATTRIBUTE, correlationId);
    try {
        return reports.build(id);
    }
    finally {
        MDC.remove(CorrelationIdFilter.ATTRIBUTE);   // pooled executor threads leak too
    }
}, reportExecutor);
```

Capture the value on the container thread — reading the request attribute from
inside the task is a race, because the request may already have been recycled.
The `ThreadLocal` lifecycle argument is the one from
[ThreadLocal and ScopedValue](../../phase-6-concurrency/12-threadlocal-scopedvalue/README.md),
and it applies to *every* pool, not just the container's.

## The trade-off

Async request handling buys you container threads back while slow work runs, and
costs you a request lifecycle that no longer maps onto a single thread. Every
thread-scoped mechanism you own — MDC, security context, transaction context,
tenant context — needs an explicit propagation decision, and each one is silent
when you get it wrong: the logs simply lose their correlation id, the audit
record simply says `anonymous`.

The honest guidance is that async is worth it when the waiting is genuinely
long and genuinely concurrent, and not worth it to shave milliseconds off a
database call. If you take it, take the plumbing with it in the same change:
`asyncSupported`, the `ASYNC` dispatcher type, `AsyncHandlerInterceptor`,
context propagation, and the explicit timeout of
[chunk 18](18-timeouts-and-async.md) — not later, when a support ticket teaches
you which one you forgot.

## Gotchas

**⚠️ The 200 with an error body**
**Symptom:** an async endpoint returns HTTP 200 with a body describing a
failure.
**Cause:** the code called `setResult(errorObject)` instead of
`setErrorResult(exception)`, so the framework treated it as a successful return
value.
**Fix:** `setErrorResult(ex)`. The advice then produces the same body as every
synchronous endpoint.

**⚠️ The handler that matches only by cause**
**Symptom:** logs and metrics are full of `CompletionException`, and a
narrowly-typed `instanceof` in a handler stops matching.
**Cause:** a failed `CompletableFuture` wraps the cause, and that wrapper was
passed to `setErrorResult`.
**Fix:** unwrap once at the boundary, as in the `unwrap` helper above.

**⚠️ The correlation id vanishes on async endpoints only**
**Symptom:** synchronous requests are traceable and async ones are not.
**Cause:** *"the `DispatcherServlet` and all filters exit the Servlet container
thread"* — the filter's `finally` cleared the MDC before the work started.
**Fix:** capture the id on the container thread, set the MDC inside the task,
clear it in a `finally`. Read the request attribute, never the MDC, from the
worker.

**⚠️ A filter silently stops covering async requests**
**Symptom:** a header, a metric or an audit entry is present on synchronous
responses and missing on async ones.
**Cause:** the filter is not declared for the `ASYNC` dispatcher type, or
`asyncSupported` is false, so it does not participate in the dispatch that
completes the request.
**Fix:** declare both. Registration mechanics are [Topic 10 — the request
pipeline](../10-the-request-pipeline/README.md).

**⚠️ `afterCompletion` never fires for async requests**
**Symptom:** cleanup runs for synchronous requests and leaks for async ones.
**Cause:** an interceptor that only implements `HandlerInterceptor` receives
`afterConcurrentHandlingStarted` semantics it did not implement — the reference
says `AsyncHandlerInterceptor` gets that callback *"instead of `postHandle` and
`afterCompletion`"* on the initial request.
**Fix:** implement `AsyncHandlerInterceptor` and put the cleanup where it is
actually called, or move it out of the interceptor entirely.

## Interview questions

**★ Does `@ControllerAdvice` work for async controller methods?**
Yes, and by design. When a `DeferredResult` is completed with `setErrorResult`,
or a `Callable` throws, Spring MVC dispatches the request back into the servlet
container and it *"is then treated … as if it produced the given exception"*,
which goes *"through the regular exception handling mechanism (for example,
invoking `@ExceptionHandler` methods)"*. What breaks around it is the
thread-scoped context and any filter not declared for the `ASYNC` dispatch.

**★ Walk me through what happens to the container thread when a controller
returns a `Callable`.**
Spring MVC calls `request.startAsync()` and submits the `Callable` to the
configured `AsyncTaskExecutor`. The `DispatcherServlet` and all filters then exit
the container thread while the response stays open. When the `Callable` produces
a result — or throws — Spring dispatches the request back to the container, the
`DispatcherServlet` runs again, and processing resumes with that value or that
exception. Two passes through the servlet, one response.

**★ Why is `setResult` with an error object wrong?**
Because the framework treats whatever you pass to `setResult` as the controller's
successful return value: it serialises it and sends a 200. Your advice, your
`ProblemDetail`, your status mapping — all bypassed, and the client now has an
error described in a body it was told was a success. `setErrorResult` is the only
way back into the exception path.

**★ Why does my `@ExceptionHandler` for a domain exception not fire for a
`CompletableFuture` endpoint?**
Almost always because the future failed with a `CompletionException` wrapping the
domain exception, and the handler is declared for the domain type. Spring's
cause-level matching often saves you, but not if a more specific handler for the
wrapper exists or if you branch on the type yourself. Unwrap at the boundary
before calling `setErrorResult`, or return the future directly and make sure the
service completes it with the real exception.

**★ Your correlation ids disappear from async endpoints. Diagnose it.**
The MDC is thread-scoped and the filter's `finally` cleared it the moment the
container thread was released — which the reference says happens as soon as
`startAsync` is called. The worker thread never had it. The fix is to read the
id from the request attribute on the container thread, capture it into the task,
set the MDC inside the task and clear it in a `finally`, because the executor's
threads are pooled too.

**★ A filter of yours works on synchronous endpoints and not on async ones.
Why?**
Because it is not participating in the `ASYNC` dispatch. The reference requires
that filter and servlet declarations set `asyncSupported` to `true` and that
*"[f]ilter mappings should be declared to handle the `ASYNC`
`jakarta.servlet.DispatchType`"*. Without that, the filter runs on the initial
pass, exits when the container thread is released, and is absent from the
dispatch that actually completes the response.

---

← Prev: [The /error floor](16-the-error-floor.md) · Index: [Error handling](README.md) · Next → [Timeouts, cancellation and @Async](18-timeouts-and-async.md)
