---
title: "Timeouts, cancellation, and why @Async is not this"
sidebar_label: "18 · Timeouts and @Async"
sidebar_position: 18
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-20 against the `AsyncRequestTimeoutException` javadoc
> (*"Exception to be thrown when an async request times out"*, *"By default the
> exception will be handled as a 503 error"*), the
> `AsyncSupportConfigurer.setDefaultTimeout` javadoc (*"If this value is not
> set, the default timeout of the underlying implementation is used"*), and the
> `DefaultHandlerExceptionResolver` / `ResponseEntityExceptionHandler` javadoc
> for the 503 mapping and `handleAsyncRequestTimeoutException` — all at
> docs.spring.io/spring-framework/docs/current/javadoc-api. `@Async` behaviour
> from the Spring Framework reference *Task Execution and Scheduling*
> (docs.spring.io/spring-framework/reference/integration/scheduling.html).
> Spring Boot 4.1.1, Spring Framework 7.0.x, JDK 25.

**Two async failures behave unlike anything else in this topic, and they behave
that way for the same reason: the response has already been decided by the time
they happen. A timeout sends a 503 and leaves your work running. An `@Async`
method fails after the client already has its 200. Neither is a hole in your
error handling — both are requests whose story ended before the failure
started, and the only honest response to each is to stop treating them as
things a `@ControllerAdvice` could ever catch.**

## The timeout is a response, not a cancellation

`AsyncRequestTimeoutException` is *"[e]xception to be thrown when an async
request times out"*, and its javadoc adds: *"By default the exception will be
handled as a 503 error."* `DefaultHandlerExceptionResolver` maps it to **503**,
and `ResponseEntityExceptionHandler` exposes
`handleAsyncRequestTimeoutException` so you can shape the body like any other
([chunk 10](10-responseentityexceptionhandler.md)). So far, ordinary.

The value that triggers it is not Spring's.
`AsyncSupportConfigurer.setDefaultTimeout` says plainly: *"If this value is not
set, the default timeout of the underlying implementation is used"* — it is a
**container** default, and it differs by container and by version. Boot exposes
it as `spring.mvc.async.request-timeout`:

```yaml
spring:
  mvc:
    async:
      request-timeout: 20s     # explicit, so it is yours and not the container's
```

For the one endpoint that legitimately needs longer, `WebAsyncTask` carries a
per-request timeout rather than forcing the global value up for everything
([chunk 17](17-async-requests.md)).

🔴 **What surprises people: the timeout does not stop your work.** The 503 goes
out, the response completes — and the worker thread carries on, finishes, and
tries to set a result on a request that is over. You now have a client that
believes the operation failed and a system in which it succeeded, which is a
correctness problem, not an error-handling one.

## Cancelling, properly

The javadoc names the mechanism in the same breath as the exception:
*"[a]lternatively an applications can register a
`DeferredResultProcessingInterceptor` or a `CallableProcessingInterceptor` to
handle the timeout"*. That callback is the only place you get told the request
is over while your task is still running.

```java
@Configuration
class AsyncConfig implements WebMvcConfigurer {

    @Override
    public void configureAsyncSupport(AsyncSupportConfigurer configurer) {
        configurer.setDefaultTimeout(20_000);
        configurer.registerDeferredResultInterceptors(new DeferredResultProcessingInterceptor() {
            @Override
            public <T> boolean handleTimeout(NativeWebRequest request, DeferredResult<T> result) {
                Future<?> task = (Future<?>) request.getAttribute("inFlightTask", RequestAttributes.SCOPE_REQUEST);
                if (task != null) {
                    task.cancel(true);          // the work must actually be cancellable
                }
                return true;                     // continue with normal timeout handling
            }
        });
    }
}
```

⚠️ **`cancel(true)` is a request, not a guarantee.** It interrupts the thread; a
task that is blocked in a JDBC call, or that never checks
`Thread.interrupted()`, keeps going regardless. Cancellation has to be designed
into the work — a periodic interruption check in a loop, a query timeout on the
statement, a deadline passed down to the HTTP client you are calling. Writing
`cancel(true)` and assuming the side effects stopped is worse than not calling
it, because it makes the incident harder to reason about later.

⚠️ **The safest shape is idempotent, resumable work.** If the operation writes,
give it a client-supplied idempotency key so the retry after a 503 does not
duplicate it. That converts "the client thinks it failed and it succeeded" from
a correctness bug into a retry that no-ops — which is the only version of this
you can actually promise a caller.

**Three signals worth emitting from the timeout callback**, because none of them
appears anywhere else: a counter tagged by endpoint (timeouts are usually
concentrated), the elapsed time (to tell "just over the limit" from "hung"), and
the correlation id ([chunk 14](14-correlation-ids-and-logging.md)) so the 503 the
client saw can be joined to the work that outlived it.

## `@Async` is a different thing entirely, and the confusion is common

`@Async` on a service method has nothing to do with async MVC. It hands the call
to a `TaskExecutor` and returns immediately; the `DispatcherServlet` is not
involved, no request is dispatched back, and no `@ExceptionHandler` will ever
see the failure. The reference states the consequence for the common case:

> *"When an `@Async` method has a `Future`-typed return value, it is easy to
> manage an exception that was thrown during the method execution, as this
> exception is thrown when calling `get` on the `Future` result. With a `void`
> return type, however, the exception is uncaught and cannot be transmitted."*

So an `@Async void` method that fails produces **no response effect whatsoever**
— the client already has its 200. The documented place to catch it is an
`AsyncUncaughtExceptionHandler`, supplied via `AsyncConfigurer`:

```java
@Configuration
@EnableAsync
class TaskConfig implements AsyncConfigurer {

    @Override
    public AsyncUncaughtExceptionHandler getAsyncUncaughtExceptionHandler() {
        return (ex, method, params) ->
                log.error("Uncaught exception in @Async {}", method.getName(), ex);
    }
}
```

**The decision rule is about who needs to know.** If the client's response
depends on the work, it is not background work: return a `CompletableFuture`
from the controller and let async MVC handle the failure
([chunk 17](17-async-requests.md)). If the client genuinely does not need to
know — an audit write, a cache warm, an email — then `@Async void` is correct,
and its failure belongs to your alerting rather than to any HTTP response. What
you must not do is use `@Async void` for work the client depends on and then
wonder why the error contract has a hole in it.

## The trade-off

Every mitigation on this page trades simplicity for honesty. An explicit timeout
means one more number to get wrong, and a wrong one turns healthy slow requests
into 503s. Real cancellation means threading a deadline through code that did
not want one. Idempotency keys mean a storage table and a client contract.

The proportionate position: **always set the timeout explicitly, always emit the
timeout signal, and only invest in cancellation and idempotency where the work
has side effects.** A read that times out and keeps running wastes a thread and
nothing else. A payment that times out and keeps running is an incident, and for
that one endpoint the whole apparatus is cheap.

## Gotchas

**⚠️ Timeouts inherited from the container**
**Symptom:** the same endpoint times out at a different point in two
environments, or in dev and production.
**Cause:** no default timeout was configured, so *"the default timeout of the
underlying implementation is used"*.
**Fix:** set `spring.mvc.async.request-timeout` explicitly, and use
`WebAsyncTask` for the one endpoint that legitimately needs longer.

**⚠️ Work continues after the timeout response**
**Symptom:** a 503 is returned, and later the log records an
`AsyncRequestNotUsableException` for the same request — or a write lands for a
request the client believes failed.
**Cause:** the timeout completes the *response*; it does not cancel the *task*.
**Fix:** cancel from a timeout interceptor callback *and* make the work
genuinely cancellable. See [chunk 19](19-committed-responses.md) for why the
resulting exception cannot be reported to anyone.

**⚠️ `cancel(true)` that cancels nothing**
**Symptom:** the cancellation code runs and the side effect happens anyway.
**Cause:** interruption only affects code that is interruptible or that checks
for it; a blocking JDBC call or a tight computation ignores it.
**Fix:** a statement/query timeout, a deadline on the outbound HTTP call, and an
explicit `Thread.interrupted()` check in any loop. If none of those is possible,
say so and use idempotency instead of pretending to cancel.

**⚠️ The retry duplicates the operation**
**Symptom:** a client retries after a 503 and the action happens twice.
**Cause:** the first attempt completed server-side after the timeout response.
**Fix:** an idempotency key on the request, checked before the side effect.
Status-code choice alone cannot fix this — a 503 correctly means "try again",
and the server has to make trying again safe.

**⚠️ `@Async void` treated as error handling**
**Symptom:** a failure in a background method is invisible — no 500, no metric,
nothing in the error dashboard.
**Cause:** *"[w]ith a `void` return type … the exception is uncaught and cannot
be transmitted"*, and the client already received its response.
**Fix:** an `AsyncUncaughtExceptionHandler` at minimum. If the client needs to
know, it is not background work and should not be `@Async void`.

**⚠️ `@Async` on a method called from within the same bean**
**Symptom:** the method runs synchronously and any failure surfaces in the
controller after all — the opposite of the previous gotcha, and just as
confusing.
**Cause:** `@Async` is proxy-based; a self-invocation bypasses the proxy.
**Fix:** call it through another bean. This is the same proxy self-invocation
rule as `@Transactional`, and it is worth checking before concluding anything
about async error behaviour.

**⚠️ The timeout body is Boot's, not yours**
**Symptom:** 503s from async timeouts have a different shape from every other
error.
**Cause:** nothing overrode `handleAsyncRequestTimeoutException`, and the
exception reached `DefaultHandlerExceptionResolver`, which maps to a status and
stops.
**Fix:** extend `ResponseEntityExceptionHandler` and override that method, or
enable the `problemdetails` route — [chunk 10](10-responseentityexceptionhandler.md)
compares the two. Then check it still applies once the response is committed,
which for a streaming endpoint it usually is.

## Interview questions

**★ What is the default async request timeout, and what does hitting it
produce?**
There is no Spring default — `setDefaultTimeout`'s javadoc says that if it is
not set, *"the default timeout of the underlying implementation is used"*, so it
is the container's and it varies by container and version. On expiry Spring
raises `AsyncRequestTimeoutException`, which is handled as a **503**, and
`ResponseEntityExceptionHandler` gives you `handleAsyncRequestTimeoutException`
to shape the body. Set `spring.mvc.async.request-timeout` explicitly so the
number is a decision rather than an inheritance.

**★ The timeout fired. Is the work cancelled?**
No. The timeout completes the response; the task keeps running. When it finally
tries to write, the response is gone and Spring raises
`AsyncRequestNotUsableException`, which nothing can turn into a client-visible
error. If the work has side effects you must cancel it yourself from a
`CallableProcessingInterceptor` or `DeferredResultProcessingInterceptor` timeout
callback — otherwise you have a request the client believes failed and a
database that disagrees.

**★ How do you actually make an async task cancellable?**
`cancel(true)` interrupts the thread, and that only helps code that is
interruptible. In practice it means pushing a deadline down: a query timeout on
the JDBC statement, a response timeout on the outbound HTTP client, and an
explicit interruption check in any long loop. If the work is a single
uninterruptible call you cannot cancel it at all, and the honest design is
idempotency — make the retry after the 503 safe rather than pretending the first
attempt stopped.

**★ A client gets a 503 from a timeout and retries. What guarantees do you owe
it?**
That the retry does not double the effect. A 503 is a "try again" status, so the
server is inviting the retry; if the first attempt can still complete after the
response, the operation must be idempotent — an idempotency key checked before
the side effect is the standard mechanism. Choosing the status correctly and
leaving the operation non-idempotent is the combination that produces duplicate
orders.

**★ How is `@Async` different from returning a `CompletableFuture` from a
controller?**
Completely. `@Async` moves a *method call* onto a `TaskExecutor` and returns
immediately; MVC never learns about the failure, and with a `void` return type
the reference says the exception *"is uncaught and cannot be transmitted"* —
only an `AsyncUncaughtExceptionHandler` sees it. Returning a `CompletableFuture`
from a controller is async **MVC**: Spring adapts it like a `DeferredResult`,
dispatches back when it completes, and your advice handles the failure normally.
The two are frequently combined, and the combination works only because the
controller awaits the future.

**★ When is `@Async void` the right choice?**
When the client genuinely does not need to know the outcome — an audit record, a
cache warm, a notification email. The test is whether you would ever want the
failure to change the HTTP response; if the answer is yes, it is not background
work. For the legitimate cases, the failure still needs somewhere to go, and
that is an `AsyncUncaughtExceptionHandler` plus an alert, not the error
contract.

**★ Your async 503s look different from the rest of your errors. Why, and how
do you fix it?**
Because `AsyncRequestTimeoutException` reached `DefaultHandlerExceptionResolver`,
which maps to a status and writes nothing else — the same reason Spring's own
exceptions look different before you extend `ResponseEntityExceptionHandler`.
Override `handleAsyncRequestTimeoutException`, or turn on the `problemdetails`
route. Then verify it on a streaming endpoint, because if the response has
already been committed no handler can change what the client receives.

---

← Prev: [Async requests](17-async-requests.md) · Index: [Error handling](README.md) · Next → [Committed responses](19-committed-responses.md)
