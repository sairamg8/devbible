---
title: "Threads, scope and async: where the context dies"
sidebar_label: "10 · Threads, scope and async"
sidebar_position: 10
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-20 against the Spring Framework 7.0 javadoc for
> `RequestContextFilter`, `RequestContextHolder` and
> `ContextPropagatingTaskDecorator`
> (docs.spring.io/spring-framework/docs/current/javadoc-api), the Framework 7.0
> reference *Integration → Observability Support* (context propagation), the
> `OncePerRequestFilter` javadoc on async dispatches, and spring-projects
> issues #31130 (the context-propagating decorator) and
> spring-boot#14655 / #19336 (request scope under `@Async`). Spring Boot 4.1.0,
> Spring Framework 7.0.x, JDK 25.

**Every convenience in this topic is thread-bound state: the MDC, the security
context, `RequestContextHolder`, `LocaleContextHolder`, and every request-scoped
bean. That works because the servlet model gives one request one thread — and it
stops working the instant the work moves to a different thread, which is what
`@Async`, an executor, a `CompletableFuture` and an async dispatch all do. The
failure is not a compile error and usually not an exception; it is a `null` where
a tenant used to be, or a log line with no correlation ID, on exactly the
long-running requests you most wanted to trace.**

## What is actually thread-bound

| Holder | Set by | Used by |
|---|---|---|
| `RequestContextHolder` | `DispatcherServlet` (and `RequestContextFilter`) | `@RequestScope` beans, `LocaleContextHolder`, anything reaching for the current request |
| `SecurityContextHolder` | Spring Security's filter chain | `@PreAuthorize`, `AuthorizationFilter`, auditing |
| The SLF4J `MDC` | your correlation filter, or Micrometer Tracing | every log line |
| `TransactionSynchronizationManager` | `@Transactional` | the `EntityManager`/`Connection` bound to the transaction |

All four are `ThreadLocal`-based, which is why the servlet pipeline is so
comfortable to write against — and why crossing a thread boundary silently
empties all of them at once. The mechanics of `ThreadLocal` itself, and the
`ScopedValue` alternative, are
[Phase 6, topic 12](../../phase-6-concurrency/12-threadlocal-scopedvalue/README.md).

Request scope is the same mechanism wearing a bean annotation. A `@RequestScope`
bean is resolved through `RequestContextHolder`, so "no request bound to this
thread" and "request-scoped bean unavailable" are the same fault. It also means a
request-scoped bean injected into a singleton must be injected as a scoped proxy,
which is [Topic 04 — Bean scopes and lifecycle](../04-bean-scopes-lifecycle/README.md).

## `@Async` does not take the request with it

```java
@RestController
class ReportController {

    @PostMapping("/reports")
    ResponseEntity<Void> start(@RequestBody ReportRequest body) {
        reports.generate(body);          // @Async — returns immediately
        return ResponseEntity.accepted().build();
    }
}

@Service
class ReportService {

    @Async
    void generate(ReportRequest request) {
        // MDC: empty. SecurityContextHolder: empty.
        // RequestContextHolder: nothing bound → IllegalStateException if you ask.
        log.info("generating");          // no correlation ID on this line
    }
}
```

Nothing here is wrong enough to fail. The report is generated; the log line is
just orphaned, and any code reaching for the current request throws an
`IllegalStateException` saying the request is no longer active. Worse, the
controller has already returned a 202, so the request may genuinely be *over* —
`RequestContextHolder` is not merely on the wrong thread, the thing it would
point at has been recycled.

Two consequences worth stating separately:

- **Never pass a request-scoped bean, an `HttpServletRequest`, or anything reading
  from them into async work.** Pass values. `ReportRequest` above is a DTO, which
  is correct; a `@RequestScope CurrentTenant` would not be.
- **Do not "fix" it by capturing the request object and using it later.** After the
  response is committed the container is free to recycle the request and response
  objects, so a captured reference may describe a different request entirely.

The supported mechanism for carrying *context* across the boundary is a
`TaskDecorator`. Spring ships `ContextPropagatingTaskDecorator`, built on the
Micrometer context-propagation library, and its documented purpose is restoring a
logging context or an observation context for the task execution:

```java
@Bean
AsyncTaskExecutor applicationTaskExecutor() {
    var executor = new SimpleAsyncTaskExecutor();
    executor.setVirtualThreads(true);
    executor.setTaskDecorator(new ContextPropagatingTaskDecorator());
    return executor;
}
```

⚠️ **Stated with a caveat.** Context propagation is not enabled for `@Async`
methods by default, and what a decorator propagates depends on which
`ThreadLocalAccessor` implementations are on the classpath — Micrometer registers
accessors for observation and tracing context, Spring Security has its own. It is
not a blanket "copy every `ThreadLocal`". Confirm which contexts actually cross
for your dependency set rather than assuming all four rows of the table above come
along. In particular, **request scope is not one of them**: there is no
`ThreadLocalAccessor` that can make a finished request live again.

## The async dispatch, and the filter that must run twice

A handler that returns a `Callable`, `DeferredResult` or `CompletableFuture`
releases the container thread and delivers its result on a later `ASYNC` dispatch
— a different thread, entering the filter chain again. Two coordination points
exist for exactly this:

- **`AsyncHandlerInterceptor.afterConcurrentHandlingStarted(..)`** replaces
  `postHandle` and `afterCompletion` on the first pass. It is the signal that the
  container thread is being released, and the right place for an interceptor to
  drop thread-bound state instead of leaking it.
- **`OncePerRequestFilter.shouldNotFilterAsyncDispatch()`** decides whether your
  filter body runs again on that dispatch. The javadoc's reason for the method
  being there at all is that filters may be invoked "as part of a `REQUEST` or
  `ASYNC` dispatches that occur in separate threads" and containers assume
  different defaults — so subclasses declare statically whether they should be
  invoked "once, during both types of dispatches in order to provide thread
  initialization, logging, security, and so on".

Any filter that establishes thread state must return `false` from that method.
Any filter that counts or times must think about whether it wants to run twice.

## Virtual threads change the cost, not the model

Boot enables virtual threads for request handling with a single property:

```properties
spring.threads.virtual.enabled=true
```

Three things to be clear about, because the pipeline reads identically either way:

- **`ThreadLocal` still works.** A virtual thread has its own thread-locals; the
  filter, the interceptor and the handler still run on one thread from start to
  finish, and `RequestContextHolder` still resolves.
- **The pooling assumption disappears.** A virtual thread is created per task and
  discarded, so a stale `ThreadLocal` no longer leaks into the *next* request the
  way it does on a pooled platform thread. That removes one class of bug and
  removes nothing else — you still clean up in a `finally`, because your filter has
  to be correct on both models and because a leak within one request is still a
  leak.
- **The cost of `ThreadLocal` changes shape.** With hundreds of thousands of
  threads, per-thread copies of context objects add up, which is part of why
  `ScopedValue` exists. See
  [Phase 6, topic 2](../../phase-6-concurrency/02-platform-vs-virtual-threads/README.md)
  and [Topic 01, chunk 6](../01-why-frameworks-servlet-model/06-living-with-virtual-threads.md).

⚠️ **Virtual threads do not remove the need for `@Async` context propagation.**
The boundary that loses context is *a different thread*, not *a pooled thread*.
Handing work to any executor still crosses it.

The reactive stack has the same problem and solves it differently — a `Context`
carried in the pipeline rather than on the thread. That contrast is
[Topic 15, chunk 10](../15-webflux-reactive/10-context-and-threadlocals.md), and
it is one of the clearer arguments for why WebFlux code feels foreign.

## Cleaning up: the rule with no exceptions

Whatever you put on the thread, remove in a `finally`, at the same depth you set
it. Spring Security's own `FilterChainProxy` clears the `SecurityContext` for
precisely this reason — see
[Topic 11, chunk 4](../11-spring-security/04-the-threadlocal-caveat.md).

```java
MDC.put(MDC_KEY, id);
TenantContext.set(tenant);
try {
    chain.doFilter(request, response);
} finally {
    TenantContext.clear();
    MDC.remove(MDC_KEY);
}
```

The failure this prevents is the nastiest kind: correct behaviour under low load
(threads rarely reused between the requests you are watching) and cross-tenant
data leakage under high load. It is not reproducible on a laptop.

## Gotchas

**⚠️ `@Async` losing the correlation ID**
**Symptom:** background work logs with no trace ID; the trace ends at the
controller.
**Cause:** the MDC is thread-bound and the executor thread has an empty one.
**Fix:** set a `TaskDecorator` — `ContextPropagatingTaskDecorator` — on the
executor, and confirm the contexts you need actually have accessors.

**⚠️ Reaching for `RequestContextHolder` in async work**
**Symptom:** `IllegalStateException` saying the request is not active, or a
request-scoped bean that cannot be resolved.
**Cause:** no request is bound to that thread, and the original request may have
completed.
**Fix:** pass the values the async method needs as parameters.

**⚠️ Capturing `HttpServletRequest` for later use**
**Symptom:** intermittently reading another request's data.
**Cause:** the container may recycle request and response objects after the
response is committed.
**Fix:** copy out the values you need, immediately, while still on the request
thread.

**⚠️ Thread state not cleared in a `finally`**
**Symptom:** the previous request's tenant or user appears in this request, under
load only.
**Cause:** a pooled platform thread was reused with state still on it.
**Fix:** clear in a `finally` at the same depth it was set.

**⚠️ A filter that skips the async dispatch**
**Symptom:** logs and security context vanish after an async handler resumes.
**Cause:** `shouldNotFilterAsyncDispatch()` left at a default that skips it.
**Fix:** override it to return `false` in any filter that initialises thread
state.

**⚠️ Assuming virtual threads fixed context propagation**
**Symptom:** `@Async` still loses the MDC after enabling
`spring.threads.virtual.enabled`.
**Cause:** the boundary is a different thread, not a pooled one.
**Fix:** the decorator, as above. Virtual threads change cost, not semantics.

**⚠️ A request-scoped bean injected into a singleton without a proxy**
**Symptom:** the singleton captures the first request's instance forever, or
startup fails.
**Cause:** a singleton is created once; a request-scoped dependency is not.
**Fix:** use a scoped proxy — [Topic 04](../04-bean-scopes-lifecycle/README.md).

## Interview questions

**★ Why does `SecurityContextHolder` return null inside an `@Async` method?**
Because it is `ThreadLocal`-based and the async method runs on an executor thread
that the security filter never touched. The same applies to the MDC,
`RequestContextHolder` and `LocaleContextHolder` — one thread boundary empties all
of them. Fixing it means propagating context deliberately with a `TaskDecorator`,
and checking which contexts the available `ThreadLocalAccessor` implementations
actually cover, rather than assuming everything comes along.

**★ Can you make a request-scoped bean available to async work?**
Not meaningfully, and you should not try. The controller may already have
returned, so "the current request" no longer exists in any useful sense — and the
container may have recycled the request object. The right move is to read the
values you need while still on the request thread and pass them as ordinary method
parameters, which also makes the async method testable without a web context.

**★ What is a `TaskDecorator` and what does `ContextPropagatingTaskDecorator` do?**
A `TaskDecorator` wraps every `Runnable` an executor is given, so it can run setup
and teardown around the task on the executor thread.
`ContextPropagatingTaskDecorator` uses the Micrometer context-propagation library
to capture the registered contexts on the submitting thread and restore them
around execution — its documented purpose is restoring a logging context or an
observation context. It is opt-in: `@Async` does not propagate context by default.

**★ Do virtual threads change any of this?**
They change the cost model and remove one bug class. A virtual thread still has
thread-locals and still runs one request end to end, so `RequestContextHolder` and
the MDC work unchanged. Because virtual threads are created per task rather than
pooled, stale state cannot leak into the next request the way it can on a pooled
platform thread. But work handed to an executor still crosses a thread boundary,
so `@Async` still loses context, and you still clean up in a `finally`.

**★ Why does `afterConcurrentHandlingStarted` exist?**
Because on an async handler the container thread is released before the response
is produced, so `postHandle` and `afterCompletion` would fire on the wrong thread
at the wrong time — or fire once for what is really two dispatches. Replacing them
with a single "concurrent handling has started" callback gives an interceptor a
correct place to release thread-bound state, and the pipeline then runs again for
the `ASYNC` dispatch when the result is ready.

**★ You see one tenant's data returned to another user, but only in production. Where do you look first?**
At every `ThreadLocal` set in the pipeline and whether each is cleared in a
`finally`. On pooled platform threads, a value left behind is inherited by the next
request on that thread, which makes the bug load-dependent and invisible locally.
`FilterChainProxy` clearing the `SecurityContext` is Spring's own version of this
discipline; anything you set — tenant, MDC key, locale — needs the same treatment
at the same depth it was set.

**★ Where should thread-bound context be established, and why not deeper?**
In a filter, before `chain.doFilter`, so it covers requests that never match a
handler and is in place before security, routing and data access run. Setting it in
an interceptor means it does not exist for 404s and for anything the filter chain
handles; setting it in an aspect means it does not exist for anything outside a
method call. And whatever sets it must be the thing that clears it — splitting
setup and teardown across two depths guarantees a leak on the paths where their
coverage differs.

---

← Prev: [Wrapping and request logging](09-wrapping-and-request-logging.md) · Index: [Phase 9 — Spring Boot and the web](../README.md)
