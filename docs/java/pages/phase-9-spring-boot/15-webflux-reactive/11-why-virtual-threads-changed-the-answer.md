---
title: "Why virtual threads moved the default back"
sidebar_label: "11 · Why virtual threads changed it"
sidebar_position: 11
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-08-19 against JEP 444 (Virtual Threads, final in JDK 21 — its
> motivation section on thread-per-request and the "write blocking code" goal),
> JEP 491 (Synchronize Virtual Threads without Pinning, JDK 24), the JDK 25
> Core Libraries virtual-threads guide, the Spring Boot reference for
> `spring.threads.virtual.enabled`, the Spring Framework reference *Web on
> Reactive Stack → Overview → Performance* ("reactive and non-blocking
> generally do not make applications run faster"), and the Reactor reference
> for `reactor.schedulers.defaultBoundedElasticOnVirtualThreads`.
> Spring Boot 4.1.0, Spring Framework 7.0.x, JDK 25.

**The reactive stack's entire scalability argument rested on one premise: that
a thread parked on I/O is an expensive thing to waste. JDK 21 removed that
premise. A virtual thread parked on a blocking call costs a few heap objects
and no OS thread, so thread-per-request scales the way the event loop does —
while keeping ordinary control flow, real stack traces, working debuggers and
profilers, and the entire blocking library ecosystem including JDBC. The
argument for WebFlux is therefore no longer "we need to handle many concurrent
connections". That reason is gone. The remaining reasons are real, and they are
narrower.**

## What changed, mechanically

A virtual thread is a `java.lang.Thread` whose stack lives on the heap in
resizable segments and which runs by mounting a *carrier* — a platform thread
from a small scheduler pool. When it blocks on a JDK blocking operation, the
runtime parks the virtual thread and releases the carrier to run something
else. The stack stays on the heap; nothing OS-level is held. See
[Phase 6 · Platform vs virtual threads](../../phase-6-concurrency/02-platform-vs-virtual-threads/README.md)
for the mechanism in full.

The consequence is exact: **the thing the event loop was avoiding no longer
costs what it cost.** Both models now express "many requests in flight, most of
them waiting" as heap state on a small number of OS threads. The difference is
only in how you write the code.

In Spring Boot that is one property:

```properties
spring.threads.virtual.enabled=true
```

which switches the servlet container's request handling — and several other
executors Boot configures — onto virtual threads. Boot 4 also configures
auto-configured JDK `HttpClient`-backed HTTP clients for virtual threading when
it is on.

## The comparison, stated honestly

| | MVC + virtual threads | WebFlux |
|---|---|---|
| Concurrency limit | heap, not threads | heap, not threads |
| Programming model | ordinary Java: `if`, `for`, `try` | operator chains |
| Stack traces | complete and meaningful | describe the delivery path |
| Debugger | works normally | breakpoints work, stepping does not |
| Profilers, thread dumps | a thread per request, readable | event loops, opaque |
| Blocking libraries (JDBC, JPA, most SDKs) | all usable | unusable, or offloaded to a pool |
| `ThreadLocal`, MDC, `SecurityContextHolder`, JTA | work as they always did | each needs a reactive counterpart |
| Backpressure | not modelled | first-class, end to end |
| Streaming responses | possible (`SseEmitter`, reactive return types) | native and composable |
| Ecosystem to learn | none | Reactor, several hundred operators |

Read that table as the whole topic compressed. Every row except the last two
favours the blocking column, and it favours it *without* giving up the property
the reactive column was adopted for.

## The clearest evidence is Reactor's own

`Schedulers.boundedElastic()` exists to hold blocking calls off the event loop.
On Java 21+, Reactor can back it with **a virtual thread per task** rather than
a pool — the
`reactor.schedulers.defaultBoundedElasticOnVirtualThreads` property. In other
words, the reactive library's own answer to "where do blocking calls go" is now
*virtual threads*. If they are the best home for the blocking part of a
reactive application, the question of why the rest of the application is not
simply running on them answers itself for most services.

The same signal appears at framework level: Spring Cloud Gateway, the canonical
WebFlux application, now ships a servlet-stack variant alongside the reactive
one.

## Be fair: what WebFlux still genuinely wins

This is not a demolition. Four things survive the change, and they are the
reasons to still choose it.

**1. Backpressure as a protocol.** Virtual threads make blocking cheap; they do
not give you a way for a consumer to tell a producer to slow down across an
asynchronous boundary. Where you are relaying a fast stream into a slow sink —
a database cursor into an HTTP response, a broker topic into a websocket —
Reactive Streams' `request(n)` is a real answer and there is no blocking
equivalent short of building your own.

**2. Streaming and long-lived connections.** `Flux<ServerSentEvent<T>>` is a
natural way to express a response that arrives over time, and a WebFlux server
holds tens of thousands of idle SSE or websocket connections as small heap
objects. Virtual threads make the blocking version affordable too, so this is
now a matter of expressiveness rather than feasibility — but composing,
merging, throttling and windowing an event stream is genuinely nicer with
operators.

**3. Composed fan-out.** `Mono.zip(a, b, c)` with typed error handling and
cancellation of the losers is a compact way to express a gateway that
aggregates several downstream calls. Structured concurrency is the blocking
answer to the same problem and it is excellent, but it remains a preview API
through JDK 25 — see
[Phase 6 · Structured concurrency](../../phase-6-concurrency/08-structured-concurrency.md).

**4. A codebase that is already reactive.** If your team knows Reactor, your
data access is R2DBC and your services return publishers, the cost of the model
is already paid. Rewriting a working reactive application to blocking code buys
nothing — the argument here is about which way to *start*, not about which way
to migrate.

## What virtual threads do not fix

Being fair in both directions:

- **They do not give you backpressure.** Removing the thread-pool ceiling
  removes the accidental backpressure that ceiling provided, so downstream
  limits must be reintroduced deliberately — a bounded connection pool, a
  `Semaphore`, or Framework 7's `@ConcurrencyLimit`. This is covered in detail
  in [Topic 01 · Living with virtual threads](../01-why-frameworks-servlet-model/06-living-with-virtual-threads.md).
- **They do not make anything faster.** Same CPU, same downstream latency. They
  raise the concurrency ceiling, nothing else — the identical caveat the Spring
  reference makes about reactive.
- **Pinning still exists, though much less.** Before JDK 24 a virtual thread
  blocking inside `synchronized` could not unmount, silently reinstating the
  platform-thread ceiling; JEP 491 fixed monitors in 24, leaving native frames
  as the remaining cause on a JDK 25 target
  ([Phase 6 · Virtual-thread pinning](../../phase-6-concurrency/14-virtual-thread-pinning.md)).
- **They change `ThreadLocal` economics.** A thread per request means a
  thread-local map per request rather than per pooled worker, which is usually
  harmless and occasionally a memory surprise.

## The trade-off

Choosing MVC with virtual threads means accepting that you have no backpressure
protocol and that streaming responses are expressible but not elegant. Choosing
WebFlux means accepting every cost in chunks 8, 9 and 10 in exchange for those
two properties. Before JDK 21 the trade also bought you scalability, which was
usually the deciding factor; it no longer does, and that is why the default
answer moved.

## Gotchas

### Treating "virtual threads won" as "WebFlux is obsolete"

**Symptom.** A team rewrites a working reactive gateway into blocking code and
loses streaming semantics and backpressure they were relying on.

**Cause.** Confusing "the scaling argument is gone" with "there is no argument".

**Fix.** Check what the application actually uses. If it streams, applies
backpressure to a fast source, or composes wide fan-outs, the reactive stack is
still doing work for you. If it is request/response CRUD, it is not.

### Enabling virtual threads and keeping the reactive code

**Symptom.** `spring.threads.virtual.enabled=true` is set on a WebFlux
application and nothing improves.

**Cause.** The property affects the servlet stack's request handling and the
executors Boot configures. WebFlux's event loop is not a thread pool being
sized; there is nothing there for the property to change.

**Fix.** Understand which stack you are on. The property is an MVC-side
setting; a reactive application's equivalent lever is the `boundedElastic`
virtual-thread flag, and only for the blocking parts it was already offloading.

### Assuming a benchmark settles it

**Symptom.** A hello-world comparison "proves" one stack is faster and drives an
architecture decision.

**Cause.** With no downstream latency and no real data access, both stacks
measure the same JSON serialiser. The property that distinguishes them —
behaviour under concurrency with slow, unpredictable I/O — is the one such a
benchmark removes.

**Fix.** If a measurement is going to decide this, it must include realistic
downstream latency, a real data layer, and enough concurrency to reach a limit.
And be honest that the decision is usually about maintainability, not
throughput, because both stacks scale well past what most services need.

### Expecting the migration to be one property

**Symptom.** Virtual threads are enabled and the service starts timing out
against its database.

**Cause.** The bounded thread pool was the only thing limiting concurrent
database access. It is gone.

**Fix.** Introduce the limit where it belongs — connection pool maximums,
semaphores around expensive downstream calls, `@ConcurrencyLimit`. Removing a
ceiling is only safe if you know which ceilings were load-bearing.

## Interview questions

**★ Why do virtual threads change the case for WebFlux?**
Because they remove the premise it rested on. Reactive stacks exist so that a
request waiting on I/O does not consume an expensive thread; with virtual
threads a waiting request consumes a parked heap-resident stack and no OS
thread, so thread-per-request reaches comparable concurrency. You then get that
scalability while keeping ordinary control flow, complete stack traces, working
debuggers and profilers, `ThreadLocal`-based infrastructure, and every blocking
library including JDBC — none of which the reactive stack lets you keep.

**★ So is WebFlux obsolete?**
No, its justification narrowed. It still wins where backpressure matters as a
protocol — relaying a fast producer into a slow consumer — where responses
stream over time and you want to compose those streams, where a service is
mostly wide fan-out over many downstream calls, and where the codebase is
already reactive so the cost is sunk. What it no longer wins is the general
case of "we need to serve many concurrent requests", which was the reason most
teams adopted it.

**★ What does Reactor backing `boundedElastic` with virtual threads tell you?**
That the two models converged at the point where reactive code has to deal with
blocking calls. `boundedElastic` exists to hold blocking work off the event
loop, and on Java 21+ Reactor can create one virtual thread per task there
instead of maintaining a pool. If virtual threads are the best home for the
blocking parts of a reactive application, then for an application that is
mostly blocking calls, running the whole thing on them is the simpler design.

**★ Does `spring.threads.virtual.enabled=true` help a WebFlux application?**
Essentially no. It switches the servlet container's request handling and
several Boot-configured executors onto virtual threads; WebFlux does not use a
servlet container's thread pool for request handling, so there is nothing there
to switch. A reactive application's nearest equivalent is enabling virtual
threads behind `Schedulers.boundedElastic()`, which only affects the blocking
work it was already offloading.

**★ What can virtual threads not do that Reactive Streams can?**
Backpressure. Making blocking cheap does not give a consumer any way to signal
a producer to slow down across an asynchronous boundary; the blocking analogue
is a bounded queue or a semaphore, which you must build and place yourself.
They also do not provide a compositional vocabulary for streams — merging,
windowing, throttling and combining event sources is where the operator model
still reads better than loops.

**★ Is a virtual-threads migration risk-free?**
No, and the risk is specific: the thread pool you removed was providing
accidental backpressure to everything downstream. With unlimited in-flight
requests, a fixed-size connection pool, a rate-limited API and a fragile
downstream all meet their limits at once. The migration is one property plus a
deliberate decision about where concurrency is now bounded. Pinning is a much
smaller concern on JDK 25 than the published guidance suggests, since JEP 491
fixed `synchronized` in JDK 24, leaving native frames.

**★ How would you settle the choice with data rather than opinion?**
By measuring the thing that actually differs: sustained throughput and tail
latency under high concurrency with realistic downstream latency and a real
data layer. A hello-world benchmark removes exactly the variable in question
and will show the two stacks tied. And it is worth saying that for most
services the measurement will show both are far past sufficient, at which point
the decision is properly about debuggability, hiring, and the libraries you
need — which is where chunk 12 lands.

---

← Prev: [Context and ThreadLocals](10-context-and-threadlocals.md) · Index: [WebFlux and reactive](README.md) · Next → [Choosing, and the failure mode in between](12-choosing.md)
