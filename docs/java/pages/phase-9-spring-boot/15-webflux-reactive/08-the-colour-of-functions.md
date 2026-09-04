---
title: "The cost: the colour of your functions"
sidebar_label: "8 · The colour of functions"
sidebar_position: 8
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-08-19 against the Spring Framework reference *Web on Reactive
> Stack → WebFlux → Overview → Applicability* ("If you have blocking
> persistence APIs (JPA, JDBC) or networking APIs to use, Spring MVC is the
> best choice for common architectures at least") and *Concurrency Model →
> Invoking a Blocking API*, the Reactor reference on
> `Schedulers.boundedElastic()` and its cores × 10 cap, the Spring Data R2DBC
> reference (docs.spring.io/spring-data/relational/reference/r2dbc.html), and
> the Spring Framework reference on reactive transaction management
> (`ReactiveTransactionManager`, `TransactionalOperator`). Spring Boot 4.1.1,
> Spring Framework 7.0.x, JDK 25.

**Non-blocking is not a property of your code; it is a property of the entire
call path, and it holds only if every participant honours it. One blocking call
anywhere — a JDBC driver, a logging appender writing to a slow disk, an SDK
that has not been rewritten — costs you a core's worth of the whole
application's capacity, not one slow request. This is the reactive tax, and it
is charged not once at adoption but continuously, every time anyone adds a
dependency.**

## The colour metaphor, and why it is exact

Bob Nystrom's 2015 essay *What Color is Your Function?* named the pattern:
in a language with asynchronous functions, functions come in two colours, and
a function of one colour cannot simply call a function of the other. Java has
no `async`/`await`, but Reactor gives the same effect through types:

- A method that returns `Mono<T>` can be composed into a chain.
- A method that returns `T` by blocking cannot — not without either wrapping it
  on another scheduler or calling `block()`.
- And critically, **colour propagates upward**. The moment one repository
  method returns `Mono<Order>`, every caller must return a publisher too, all
  the way to the controller. There is no local decision to go reactive; the
  types force the whole stack.

The consequence people underestimate: a codebase is either reactive or it is
not. A half-reactive one has the disadvantages of both.

## What must be reactive, in practice

| Concern | Blocking | Reactive counterpart |
|---|---|---|
| Relational data | JDBC, JPA/Hibernate | **R2DBC** + Spring Data R2DBC |
| MongoDB | sync driver | reactive streams driver, `ReactiveMongoTemplate` |
| Redis | Jedis | **Lettuce** (reactive API) |
| HTTP out | `RestClient`, `RestTemplate` | **`WebClient`** |
| Kafka | the standard client | Reactor Kafka |
| Messaging / AMQP | `RabbitTemplate` | Reactor RabbitMQ |
| Security context | `SecurityContextHolder` | `ReactiveSecurityContextHolder` |
| Transactions | `PlatformTransactionManager` | `ReactiveTransactionManager` (chunk 9) |
| Files | `java.io`, `Files.readAllBytes` | asynchronous channels — or `boundedElastic` |

The relational row is the one that decides most projects, and the Spring
reference is unusually direct about it:

> "A simple way to evaluate an application is to check its dependencies. If you
> have blocking persistence APIs (JPA, JDBC) or networking APIs to use, Spring
> MVC is the best choice for common architectures at least."

**R2DBC is not JPA with different types.** It is a driver-level specification
with a Spring Data module on top, and it deliberately does not attempt an
object-relational mapper. What you give up moving from Spring Data JPA:

- no lazy loading, no persistence context, no dirty checking, no first-level
  cache;
- no relationship mapping worth the name — joins and aggregates are yours to
  assemble, typically with explicit queries and manual composition;
- no JPQL, no Criteria API, no entity graphs;
- a smaller driver ecosystem than JDBC, though the mainstream databases are
  covered.

For a team whose domain model leans on JPA, that is not a migration. It is a
rewrite of the persistence layer, and it should be priced as one.

## The escape hatch, and what it costs

Reactor and the Spring reference both offer the same answer for a blocking
library: move it off the event loop.

```java
Mono<Report> legacyReport(String id) {
    return Mono.fromCallable(() -> legacyJdbcReport(id))   // blocking, wrapped
               .subscribeOn(Schedulers.boundedElastic());  // ...on a thread pool
}
```

This works. It is also the moment the argument for the whole architecture gets
quieter, and it is worth being precise about why:

1. **You have reintroduced a thread pool.** `boundedElastic` caps at cores × 10
   threads, so the number of concurrent blocking calls is now bounded by a pool
   — which is exactly the constraint the event-loop model was adopted to
   escape. If the blocking dependency is on the critical path of most requests,
   your application's real concurrency limit is that pool, and the event loop
   in front of it is decoration.
2. **You pay for the handoff.** Every wrapped call costs a scheduling handoff
   in each direction, plus the thread's memory. Compared to just having made
   the call on a request thread, it is strictly more work.
3. **You now maintain two models at once.** Some of the code is imperative,
   some is a chain, and the boundary between them is a place bugs live —
   forgotten `subscribeOn`, `ThreadLocal`s that survive on one side and not the
   other, exceptions that change shape as they cross.
4. **It is easy to forget.** Nothing in the compiler stops the next developer
   from calling the blocking method directly. Which brings us to the real
   problem.

Spring's own wording about the escape hatch is notably unenthusiastic: *"there
is an easy escape hatch. Keep in mind, however, that blocking APIs are not a
good fit for this concurrency model."*

## Blocking you did not know you had

The dangerous blocking is never the JDBC call somebody argued about. It is:

- **Logging.** A synchronous file or console appender writes to disk on the
  calling thread. Under load, on a slow volume or a full container filesystem,
  that is a blocking write on an event loop. Asynchronous appenders exist for
  this reason.
- **DNS resolution.** `InetAddress.getByName` blocks. Netty ships a
  non-blocking resolver precisely because the JDK's is not.
- **Class loading and first-call initialisation.** A lazily-initialised
  library, a `ServiceLoader` scan, or a JIT-cold path that reads a resource
  file blocks the first time through.
- **Vendor SDKs.** Cloud SDKs, payment gateways, auth libraries and mail
  clients ship blocking implementations far more often than reactive ones. If
  the SDK's async variant returns a `CompletableFuture`, you can adapt it with
  `Mono.fromFuture`; if it returns nothing but values, it is blocking.
- **Caches.** A `@Cacheable` method backed by a synchronous cache client
  blocks, and the annotation makes it invisible at the call site.
- **`Files` and `java.io` generally.** Reading a certificate, a template, or a
  config file on request path is a blocking syscall.

The tool for finding these is **BlockHound**, a Reactor-project Java agent that
instruments the JDK to detect blocking calls made on threads marked
non-blocking and raise an error instead. It is a test-time tool — running it in
production is not the intent — and it is the only reliable way to answer "is
anything on this path blocking?" for real. That such a tool is *necessary* is
itself the strongest argument in this chunk.

## The trade-off

The honest summary: the reactive stack's scalability claim holds only for a
path that is non-blocking end to end, and buying that means auditing and often
replacing your data access layer, your caching, your logging configuration and
your third-party SDKs — then defending that property against every future pull
request. In exchange you get a concurrency ceiling set by memory rather than
threads, and a backpressure protocol. Whether that is a good trade is the
question chunk 10 answers, and the answer changed in JDK 21.

## Gotchas

### The blocking call nobody sees

**Symptom.** A WebFlux service performs beautifully in load tests and collapses
in production under moderate traffic.

**Cause.** Something on the path blocks — commonly a synchronous logging
appender, a DNS lookup, or a cache client — and only the production
environment's latency or disk behaviour makes it visible.

**Fix.** Run BlockHound in integration tests so the build fails on a blocking
call, and treat the event-loop threads as a resource with a documented rule:
nothing on them may block, ever.

### Wrapping the whole service in `boundedElastic` and calling it reactive

**Symptom.** A "reactive" service in which almost every repository call is a
`Mono.fromCallable(...).subscribeOn(boundedElastic())`.

**Cause.** The team wanted reactive types without replacing the persistence
layer.

**Fix.** Recognise what you have built: a thread-pool application with a
harder-to-read syntax, whose concurrency limit is the elastic scheduler. If the
blocking data layer is staying, MVC — with virtual threads on a modern JDK — is
the better implementation of the same architecture.

### Assuming a reactive driver exists because a reactive library does

**Symptom.** A migration plan assumes "reactive Hibernate" or "reactive JDBC".

**Cause.** JDBC is a blocking API by specification; there is no non-blocking
mode of it. R2DBC is a *different* specification with different drivers, and
Hibernate Reactive is a separate project with a different programming model,
not a switch on Hibernate ORM.

**Fix.** Check driver availability and feature parity for your specific
database and your specific query patterns before committing, and price the
persistence layer as a rewrite.

### A `ThreadLocal`-based library that silently does nothing

**Symptom.** Tenant resolution, correlation ids or auditing work in tests and
produce nulls in production.

**Cause.** The library stores context in a `ThreadLocal` and the pipeline
crosses threads, so the value is set on one thread and read on another.

**Fix.** Chunk 9 — Reactor `Context` and the context-propagation library — and
be aware that some libraries simply cannot be adapted.

## Interview questions

**★ What does "coloured functions" mean in the context of Reactor?**
That a method returning `Mono`/`Flux` and a method returning a plain value are
not interchangeable: a chain can compose the first and can only reach the
second by wrapping it on another scheduler or by blocking. Because callers of a
publisher-returning method must themselves return publishers to stay
non-blocking, the colour propagates all the way up to the controller. There is
no local decision to make one component reactive — the types make it a
whole-application property.

**★ Why is one blocking call in a WebFlux application worse than one slow request?**
Because it occupies an event-loop worker, and there is roughly one of those per
core for the entire application. Blocking it removes a measurable fraction of
total capacity for the duration, affecting every concurrent request, not just
the one that blocked. In a thread-per-request server the same call would tie up
one of hundreds of pool threads and degrade only itself.

**★ What is R2DBC and how does it differ from JPA?**
R2DBC is a specification for non-blocking relational database drivers, with
Spring Data R2DBC layered on top. It is not an ORM: no persistence context, no
lazy loading, no dirty checking, no JPQL or Criteria API, and no meaningful
relationship mapping — you write queries and assemble aggregates yourself. For
a codebase built on Spring Data JPA, adopting it is a rewrite of the
persistence layer rather than a dependency swap, and that cost is usually the
deciding factor in the whole WebFlux question.

**★ If you must call a blocking library from a reactive pipeline, how do you do it — and what have you given up?**
Wrap it in `Mono.fromCallable(...)` and put it on
`Schedulers.boundedElastic()`, which is the documented escape hatch. What you
give up is the property you adopted the stack for: `boundedElastic` is a
thread pool capped at cores × 10, so concurrent blocking calls are once again
limited by threads, plus you pay a scheduling handoff each way and maintain two
programming models in one codebase. If that call is on the critical path of
most requests, the event loop in front of it is decoration.

**★ How would you find out whether anything in a request path blocks?**
BlockHound — a Reactor-project Java agent that instruments the JDK to detect
blocking calls on threads marked non-blocking and fail instead. It belongs in
integration tests, so the build breaks when someone adds a blocking dependency.
Code review does not scale for this, because the blocking is usually inside a
library rather than in the diff: a synchronous log appender, a DNS lookup, a
cache client, an SDK.

**★ A team says they will "keep JPA and just wrap the repository calls". What is your response?**
That this is the worst of both worlds. The wrapped calls run on a bounded
elastic pool, so the application's concurrency is limited by that pool exactly
as it would have been by a servlet thread pool; the codebase carries Reactor's
debugging and context costs; and it now has two programming models with a
fragile boundary between them. If JPA stays, the coherent choice is Spring MVC
— and on JDK 21+ with virtual threads it scales like the reactive version
anyway.

**★ Which is more likely to block in production: your code or your dependencies?**
Dependencies, by a wide margin, which is why this cost is ongoing rather than
one-off. The obvious blocking calls get argued about in review; the ones that
cause incidents are a synchronous logging appender under disk pressure, a
JDK DNS resolution, a `ServiceLoader` scan on first use, a `@Cacheable` backed
by a blocking client, or a vendor SDK with no reactive variant. Every new
dependency is a fresh opportunity to violate the invariant the entire
architecture rests on.

---

← Prev: [Functional endpoints and WebClient](07-functional-endpoints-and-webclient.md) · Index: [WebFlux and reactive](README.md) · Next → [Debugging and testing](09-debugging-and-testing.md)
