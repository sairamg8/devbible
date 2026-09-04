---
title: "Thread per request, and what virtual threads changed"
sidebar_label: "5 · Thread per request"
sidebar_position: 5
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-19 against the Spring Boot reference *Servlet Web
> Applications* and the common application properties appendix
> (docs.spring.io/spring-boot — `server.tomcat.threads.max` and its documented
> default of 200, `spring.threads.virtual.enabled`), JEP 444 (Virtual Threads,
> final in JDK 21), the JDK 25 Core Libraries virtual-threads guide
> (docs.oracle.com/en/java/javase/25/core/), and spring-projects/spring-boot
> issue #41937 (enabling virtual threads and the effect on thread-pool limits).
> Spring Boot 4.1.1, Spring Framework 7.0.x, JDK 25.

**The servlet model's defining property is that a request owns a thread from
the first byte to the last. That is the reason Spring code is pleasant to write
— ordinary blocking calls, real stack traces, a debugger that works — and it
was, for two decades, the reason it did not scale past a few hundred concurrent
in-flight requests, because a thread is an OS resource and you cannot have many.
Virtual threads did not make anything faster. They made threads cheap, which
removed the only real argument for abandoning the model. That is the whole of
why reactive programming stopped being the default recommendation.**

## The arithmetic that used to force the choice

A servlet container serves concurrency by having threads. Tomcat's documented
default in Spring Boot is:

```yaml
server:
  tomcat:
    threads:
      max: 200       # the documented default
```

That number is not arbitrary and it is not a Tomcat limitation. A platform
thread is a 1:1 wrapper over an OS thread with a reserved stack — the reason
[Phase 6 · What a thread costs](../../phase-6-concurrency/02-platform-vs-virtual-threads/01-what-a-thread-costs.md)
puts the practical ceiling in the low thousands. Beyond a few hundred, memory
and scheduler overhead grow faster than useful work.

Now put a typical request through it. The handler validates input, calls a
database, calls two other services, serialises a response. Nearly all of the
wall-clock time is spent *waiting on I/O* — and a platform thread that is
waiting on a socket is parked, holding its stack, contributing nothing.

The consequence, stated as a rule rather than a measurement: **maximum
concurrent in-flight requests equals the thread pool size.** Request 201
arrives, all 200 threads are parked waiting on downstream I/O, and it queues —
not because the CPU is busy, but because the *thread* is the scarce resource
and it is being spent on waiting.

That is the classic servlet-stack failure, and it has a distinctive shape:
latency collapses while CPU utilisation sits low. Adding CPU does not help.
Raising `threads.max` helps until memory or context-switching costs bite, then
stops helping.

### The answer nobody liked: async servlets

There was a third option, and it is worth knowing because you will meet it in
existing code. Servlet 3.0 added asynchronous request handling: a handler can
call `startAsync()`, return the container thread immediately, and complete the
response later from another thread. Spring MVC exposes it through return types
rather than the raw API:

```java
@GetMapping("/orders/{id}")
DeferredResult<OrderView> find(@PathVariable String id) {
    DeferredResult<OrderView> result = new DeferredResult<>(Duration.ofSeconds(5).toMillis());
    orders.findAsync(id)                       // returns a CompletableFuture
          .thenAccept(result::setResult)       // container thread already released
          .exceptionally(ex -> { result.setErrorResult(ex); return null; });
    return result;
}
```

Returning `Callable<T>`, `DeferredResult<T>` or `CompletableFuture<T>` from a
controller all release the container thread while the work proceeds elsewhere.

It never became the default, for a reason worth naming: **it moves the problem
rather than solving it.** The request still has to wait somewhere, so unless
the downstream call is itself non-blocking you have merely shifted a blocked
thread from the container's pool to yours. What it genuinely buys is
long-polling and server-sent events — cases where the response is deliberately
held open for a long time — which is why `SseEmitter` and
`StreamingResponseBody` are the async return types still in everyday use.

## The two answers, and why one of them won

The industry had two responses to that arithmetic.

**Answer one: stop blocking threads.** Rewrite everything as callbacks or
reactive streams so a small fixed pool of event-loop threads is never parked.
This works, and it is what WebFlux, Netty and Node.js do. The price is that
*every* layer must participate: one blocking JDBC call inside a reactive
pipeline parks an event-loop thread and degrades the whole application. It
colours your entire codebase — `Mono<Order>` instead of `Order`, all the way
down — and it costs you the stack trace and the debugger, because the logical
call chain no longer corresponds to any physical stack.

**Answer two: make threads cheap enough that blocking is fine.** A virtual
thread's stack lives on the heap and mounts a carrier thread only while it is
actually executing; when it blocks on I/O it *unmounts* and costs nothing but
memory. Now "one thread per request" scales to hundreds of thousands, and the
blocking code you already have is correct as written.

Answer two won for mainstream services because it required no rewrite. In
Spring Boot it is one property:

```yaml
spring:
  threads:
    virtual:
      enabled: true      # requires JDK 21+; we target 25
```

With it set, Tomcat's request executor becomes a virtual-thread executor and
each request gets a fresh virtual thread. Your controllers, your JDBC calls,
your `RestClient` calls are unchanged. The mechanism is
[Phase 6 · Platform vs virtual threads](../../phase-6-concurrency/02-platform-vs-virtual-threads/README.md).

## Interview questions

**★ What does "thread per request" mean, and what limits it?**
The servlet container assigns a thread to a request for its full duration and
that thread executes the handler synchronously, so the code can block freely.
What limits it is that a platform thread is a 1:1 wrapper over an OS thread
with a reserved stack, which puts the practical ceiling in the low thousands
and Tomcat's documented Spring Boot default at 200. Because most request time
is spent waiting on I/O rather than computing, the pool size — not the CPU —
becomes the cap on concurrent in-flight requests. The signature of hitting it
is latency collapsing while CPU utilisation stays low.

**★ Why did reactive programming become popular, and why is it no longer the default answer?**
It became popular because it broke the thread-per-request ceiling: a small
fixed set of event-loop threads is never parked, so a handful of threads can
hold tens of thousands of in-flight requests. It stopped being the default
because virtual threads achieve the same scaling without the cost — reactive
"colours" the entire codebase (`Mono`/`Flux` all the way down), one blocking
call anywhere degrades the whole application, and you lose meaningful stack
traces and debugger stepping. Virtual threads made blocking cheap, which
removed the *scaling* reason to adopt reactive. Reactive remains the right
choice for streaming, backpressure-sensitive pipelines and long-lived
connections.

**★ What exactly does `spring.threads.virtual.enabled=true` change?**
It switches Spring Boot's task executors — including the embedded container's
request executor — to virtual-thread-based ones, so each request runs on a
freshly created virtual thread instead of borrowing from a bounded platform
pool. It requires JDK 21 or later. Application code does not change: blocking
JDBC, blocking `RestClient` calls and ordinary control flow are all still
correct. What it does *not* change is the amount of CPU available or the
correctness rules around shared state — races, visibility and locking are
identical on virtual threads.

**★ How does the servlet threading model interact with statelessness?**
Directly. Because the container reuses request threads from a pool in the
platform-thread model, anything stored in a `ThreadLocal` outlives the request
unless explicitly removed, and because a servlet is a single shared instance,
any mutable field is shared across concurrent requests. Both hazards are
properties of the threading model rather than of Spring. With virtual threads
the thread-local reuse hazard largely disappears — each request gets a fresh
thread — but the shared-singleton hazard does not change at all, because the
bean is still one object serving every request.

**★ What are async servlets, and why did they not become the default?**
Servlet 3.0 added `startAsync()`, letting a handler release the container
thread and complete the response later from a different thread; Spring MVC
surfaces this through `Callable<T>`, `DeferredResult<T>` and
`CompletableFuture<T>` return types. It did not become the default because it
relocates the blocking rather than removing it — unless the downstream call is
itself non-blocking, some thread of yours is still parked waiting, and you have
traded a well-understood container pool for one you now manage. Its lasting
value is in genuinely long-lived responses: `SseEmitter` for server-sent events
and `StreamingResponseBody` for streaming payloads, where holding a container
thread open for minutes would be indefensible.

**★ If most request time is I/O wait, why does adding CPU not fix a saturated servlet application?**
Because the exhausted resource is threads, not cycles. Every in-flight request
holds a thread for its whole duration including the waiting, so once all 200
are parked on sockets the 201st request queues no matter how idle the
processors are. The diagnostic signature is exactly that mismatch — response
times climbing while CPU utilisation stays low — and it tells you to look at
pool sizing and downstream latency rather than at compute. Raising
`server.tomcat.threads.max` buys headroom until memory and context-switching
costs overtake the benefit, which is the ceiling virtual threads remove
outright.

---

← Prev: [The embedded container](04-the-embedded-container.md) · Index: [Phase 9 — Spring Boot and the web](../README.md) · Next → [Living with virtual threads](06-living-with-virtual-threads.md)
