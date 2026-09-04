---
title: "Context: what ThreadLocal used to do"
sidebar_label: "10 · Context and ThreadLocals"
sidebar_position: 10
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-08-19 against the Reactor 3 reference guide — *Adding a
> Context to a Reactive Sequence* (`Context` is "somewhat comparable to
> `ThreadLocal` but can be applied to a `Flux` or a `Mono` instead of a
> `Thread`", its immutability, and that it propagates from downstream to
> upstream at subscription time) and *Context-Propagation Support*
> (the `io.micrometer:context-propagation` library, `contextCapture()`,
> `ThreadLocalAccessor`, `ContextRegistry`; embedded in Reactor-Core from
> 3.5.0, automatic mode from 3.5.3)
> (projectreactor.io/docs/core/release/reference/advancedFeatures/context.html)
> — the Spring Security reference for reactive applications
> (`ReactiveSecurityContextHolder`), and the Spring Framework reference on
> `ReactiveTransactionManager` and `TransactionalOperator`. Spring Boot 4.1.1,
> Spring Framework 7.0.x, JDK 25.

**`ThreadLocal` is how Java has carried per-request state for twenty-five
years — the MDC in your logs, the authenticated principal, the current
transaction, the tenant, the trace id. None of it survives a reactive pipeline,
because there is no thread that belongs to the request. Every one of those
mechanisms has a reactive replacement, each replacement has a different name
and a different failure mode, and the cost of the migration is usually
underestimated because the failures are silent.**

## Why `ThreadLocal` breaks

Reactor's own explanation is the clearest one: in reactive programming a single
thread processes several asynchronous sequences at roughly the same time, and
execution jumps easily and often from one thread to another. A value stashed
against thread A during subscription is simply not there when an operator later
runs on thread B — and worse, thread A may by then be carrying a *different*
request's value.

So the failure mode is not an exception. It is a null, or the wrong tenant's
data, appearing under load and not in tests.

## The Reactor `Context`

`Context` is the replacement, and its shape follows from the problem: since
state cannot hang off a thread, it hangs off the **subscription**.

- It is **immutable**. `put` returns a new instance, exactly like a persistent
  map.
- It is **per-subscription**, so two concurrent requests through the same
  operator chain have different contexts.
- It propagates **from downstream to upstream** — bottom to top — because it
  travels with the *subscription* signal, which flows that way. This is the
  detail that catches everybody.

```java
return orders.view(id)
             .flatMap(this::enrich)
             .contextWrite(ctx -> ctx.put("tenant", tenant));   // ← written at the BOTTOM
```

`contextWrite` is placed *after* the operators that read it, because the
subscription travels upward through it before any data flows down. Writing it
at the top of the chain — where an imperative reader's instinct puts it — means
nothing above it can see the value.

Reading is deferred, because the value only exists at subscription time:

```java
Mono<Order> enrich(Order order) {
    return Mono.deferContextual(ctx ->
            pricing.quote(order, ctx.get("tenant")));    // ContextView, read-only
}
```

`ContextView` is the read-only face of the same map, which is what
`deferContextual` and the `doOn*` variants hand you.

## Bridging to libraries that still want a `ThreadLocal`

Rewriting every library to read a `ContextView` is not an option, so Reactor
integrates with the **`io.micrometer:context-propagation`** library. Its model:

- A **`ThreadLocalAccessor`** knows how to read and write one particular
  `ThreadLocal` (the MDC, the security context, a tracing scope).
- The **`ContextRegistry`** holds the accessors that are in play.
- **`contextCapture()`** captures the current `ThreadLocal` values at
  subscription time and stores them in the Reactor `Context`, so they can be
  restored later, on whatever thread is running.
- In **automatic mode**, operators restore those `ThreadLocal`s around user
  code rather than only in a few designated operators, so an unmodified library
  reading a `ThreadLocal` inside a `map` finds what it expects.

Reactor's reference records the timeline: context-propagation support was
embedded in Reactor-Core from **3.5.0**, and the automatic mode arrived in
**3.5.3**. That this machinery exists — an entire library whose purpose is to
simulate thread-local storage on threads that do not belong to the request —
is a fair measure of what the model costs.

## The three you will actually meet

**Logging (MDC).** Correlation ids put in the MDC vanish across a scheduler
boundary. The fixes are, in increasing order of intrusiveness: carry the id in
the Reactor `Context` and log it explicitly, register a `ThreadLocalAccessor`
for the MDC via context propagation, or accept structured logging where the
fields come from the pipeline's data rather than from ambient state.

**Security.** `SecurityContextHolder` is a `ThreadLocal` and does not work.
Spring Security's reactive support provides
**`ReactiveSecurityContextHolder`**, whose `getContext()` returns a
`Mono<SecurityContext>` read out of the Reactor `Context` — so obtaining the
principal becomes part of the pipeline:

```java
return ReactiveSecurityContextHolder.getContext()
        .map(SecurityContext::getAuthentication)
        .map(Authentication::getName)
        .flatMap(orders::forUser);
```

Method security annotations (`@PreAuthorize` and friends) work on
publisher-returning methods, and the whole security filter chain has a reactive
counterpart configured through `SecurityWebFilterChain` rather than
`SecurityFilterChain`. It is a parallel implementation, not a shared one, which
means examples, custom filters and third-party integrations from the servlet
world do not transfer.

**Transactions.** `@Transactional` does work in a reactive stack, but with
different infrastructure: a `ReactiveTransactionManager` (the R2DBC one, for
example) rather than a `PlatformTransactionManager`, with the transaction bound
to the subscriber's Reactor `Context` instead of a `ThreadLocal`. For
programmatic control there is `TransactionalOperator`. What to know:

- A reactive `@Transactional` method must return a publisher; annotating a
  method that returns a plain value gets you nothing useful.
- Everything transactional must be part of the returned pipeline — a detached
  `subscribe()` inside the method runs outside the transaction.
- **There is no reactive JTA/XA.** Distributed transactions across resources
  are unavailable, which for some architectures settles the question on its
  own.

## The trade-off

`Context` is a better design than `ThreadLocal` in one respect that is worth
conceding: it is explicit, scoped to a subscription rather than to an ambient
thread, and immune to the leak-through-a-pooled-thread bug that has plagued
thread-locals forever. `ScopedValue` in modern Java is a move in the same
direction for blocking code
([Phase 6 · ThreadLocal and ScopedValue](../../phase-6-concurrency/12-threadlocal-scopedvalue/README.md)).
What it costs is that every ambient mechanism in the ecosystem — logging
context, security, transactions, tracing, tenancy — needs a reactive
counterpart, each with its own API, and a library without one cannot be used at
all.

## Gotchas

### `contextWrite` placed above the readers

**Symptom.** `deferContextual` throws `NoSuchElementException`, or a default is
silently used, for a key that is obviously written in the same method.

**Cause.** Context propagates upward from the subscriber, so `contextWrite`
only affects operators **above** it in the chain.

**Fix.** Put `contextWrite` at the end of the chain — the bottom — where an
imperative reader least expects it:

```java
return orders.view(id)
             .flatMap(this::enrich)          // reads "tenant"
             .contextWrite(ctx -> ctx.put("tenant", tenant));   // ✅ below the readers
```

### Log correlation ids that disappear halfway through a request

**Symptom.** Early log lines carry the trace id; later ones do not.

**Cause.** The MDC is thread-bound, and the pipeline crossed a scheduler
boundary.

**Fix.** Register the MDC with the context-propagation library and enable
automatic propagation, or stop relying on ambient state and pass the id through
the pipeline's own data. Half-measures produce logs that are correlated
sometimes, which is worse than never.

### A `SecurityContextHolder` call that returns null in production

**Symptom.** Code copied from a servlet application returns no authentication
under load, but works in a single-threaded test.

**Cause.** `SecurityContextHolder` reads a `ThreadLocal` that WebFlux never
populates. In a test that happens to run everything on one thread, it may
appear to work.

**Fix.** `ReactiveSecurityContextHolder.getContext()`, composed into the
pipeline. Any helper that "gets the current user" synchronously has to change
signature to return a `Mono`, and the colour propagates from there.

### Transactions that quietly do not cover what you think

**Symptom.** A failure part-way through a reactive `@Transactional` method
leaves half the writes committed.

**Cause.** Work that is not part of the returned publisher is not part of the
transaction. A `subscribe()` called inside the method, or a `flatMap` whose
result is discarded, runs outside it.

**Fix.** Return one pipeline containing every write, and never subscribe
internally. If you need to sequence an effect whose value you do not need,
compose it with `then` so it stays in the chain.

### A `ThreadLocal` that leaks between requests

**Symptom.** Occasionally, a request sees another request's tenant or user.

**Cause.** Something set a `ThreadLocal` on an event-loop thread and did not
clear it. That thread then served a different request — and unlike a servlet
container, it does so within microseconds and thousands of times a second.

**Fix.** Never write ambient state on an event-loop thread. If a library must,
it needs a `ThreadLocalAccessor` so the framework can set and clear it around
each piece of user code, which is exactly what automatic context propagation
does.

## Interview questions

**★ Why does `ThreadLocal` not work in WebFlux?**
Because no thread belongs to a request. One thread interleaves many sequences
and a single sequence hops threads at every scheduler boundary, so a value
stashed on the subscribing thread is absent — or belongs to another request —
by the time a later operator runs. The failure is silent: a null or the wrong
tenant under load, not an exception, and single-threaded tests usually miss it.

**★ What is the Reactor `Context` and how does it propagate?**
An immutable key/value map attached to the **subscription** rather than to a
thread, so each subscriber has its own. It propagates from downstream to
upstream — bottom to top — because it travels with the subscription signal,
which flows that way. That means `contextWrite` affects only the operators
above it, so it is written at the *end* of a chain, and values are read with
`deferContextual` or the `ContextView`-aware operator variants.

**★ How do you get the authenticated user in a WebFlux handler?**
`ReactiveSecurityContextHolder.getContext()`, which returns a
`Mono<SecurityContext>` read from the Reactor `Context`, and then compose it
into the pipeline. `SecurityContextHolder` is thread-bound and returns nothing.
The wider point is that any existing helper method with a signature like
`String currentUser()` must become `Mono<String> currentUser()`, and every
caller changes with it — the colour problem again.

**★ What is the context-propagation library for?**
Bridging the two worlds. `io.micrometer:context-propagation` defines
`ThreadLocalAccessor`s registered in a `ContextRegistry`, so Reactor can
capture `ThreadLocal` values into its `Context` at subscription
(`contextCapture()`) and restore them around user code on whatever thread runs
it. In automatic mode this happens across operators generally rather than only
in designated ones, which is what lets an unmodified library that reads a
`ThreadLocal` keep working. Reactor embedded the support in 3.5.0 and added
automatic mode in 3.5.3.

**★ Does `@Transactional` work in WebFlux?**
Yes, with a `ReactiveTransactionManager` such as the R2DBC one, and the
transaction is carried in the Reactor `Context` rather than a `ThreadLocal`.
The method must return a publisher, and every write must be part of that
returned pipeline — anything subscribed separately inside the method runs
outside the transaction. There is no reactive JTA/XA, so distributed
transactions across resources are unavailable.

**★ Is `Context` better or worse than `ThreadLocal` as a design?**
Better in the ways that matter for correctness, worse in ecosystem cost. It is
explicit rather than ambient, scoped to a subscription rather than to a pooled
thread, and immune to the classic leak where a value survives into the next
task on the same thread. But it is a different API that every library must
adopt, whereas `ThreadLocal` was universal — which is why an entire bridging
library exists. `ScopedValue` brings the same immutable, scoped design to
blocking code without the ecosystem split.

---

← Prev: [Debugging and testing](09-debugging-and-testing.md) · Index: [WebFlux and reactive](README.md) · Next → [Why virtual threads moved the default back](11-why-virtual-threads-changed-the-answer.md)
