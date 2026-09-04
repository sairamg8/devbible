---
title: "The operator vocabulary"
sidebar_label: "3 · The operator vocabulary"
sidebar_position: 3
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-08-19 against the Reactor 3 reference guide — *Reactor Core
> Features*, *Handling Errors* and the *Which operator do I need?* appendix
> (projectreactor.io/docs/core/release/reference/) — and the `Mono`/`Flux`
> Javadoc for `flatMap` concurrency defaults. Spring Boot 4.1.1, Spring
> Framework 7.0.x, JDK 25.

**Control flow in a reactive codebase is not a language feature any more; it is
a library API with several hundred entries. You do not need to write them
fluently to satisfy this topic — you need to read them. About fifteen operators
account for the overwhelming majority of production chains, and knowing what
they mean is the difference between reactive code being unreadable and being
merely unfamiliar.**

## The map from imperative constructs to operators

| You would have written | The operator |
|---|---|
| `x = f(x)` | `map` |
| `x = otherService.call(x)` (async) | `flatMap` |
| `for (a : list) call(a)` preserving order | `concatMap` |
| two calls in parallel, then combine | `zip` |
| `if (x == null) throw` | `switchIfEmpty(Mono.error(...))` |
| `if (x == null) x = default` | `defaultIfEmpty` |
| `try { ... } catch (E e) { fallback }` | `onErrorResume(E.class, e -> fallback)` — chunk 4 |
| `catch` and rethrow as another type | `onErrorMap` — chunk 4 |
| retry loop with backoff | `retryWhen(Retry.backoff(...))` — chunk 4 |
| `finally { ... }` | `doFinally` |
| a statement whose value you discard | `then(...)` |
| logging or metrics on the way past | `doOnNext` / `doOnError` |

## Transforming

- **`map(T -> R)`** — synchronous 1:1 transform. Same idea as `Stream.map`. If
  the function blocks, you have just blocked an event-loop thread.
- **`flatMap(T -> Publisher<R>)`** — the workhorse. For each element, start
  another asynchronous call and merge its results into the output. Use it
  whenever the transform itself returns a `Mono` or `Flux`; `map` there gives
  you a `Mono<Mono<T>>` and the compiler will say so. **Interleaved and
  unordered**, with a default concurrency of 16 inner subscriptions in flight.
- **`concatMap`** — `flatMap` that preserves order by subscribing to the inner
  publishers one at a time. Deterministic, slower.
- **`flatMapSequential`** — subscribes eagerly like `flatMap` but emits in
  source order. The middle option people forget exists.
- **`flatMapMany`** — on a `Mono`, expand the single element into a `Flux`.
- **`then(Mono<V>)`** — discard this sequence's elements, wait for completion,
  continue with another. The reactive semicolon.
- **`thenReturn(value)`** — the same, producing a constant.

## Combining

- **`Mono.zip(a, b)`** / **`zipWith`** — wait for one element from each source
  and combine them. This is the fan-out-and-join primitive: two independent
  downstream calls run concurrently, so you pay the slower one's latency rather
  than the sum. It is also the one place a reactive rewrite can genuinely
  reduce latency rather than just increase throughput.
- **`merge`** — interleave several `Flux` sources as their elements arrive.
- **`concat`** — subscribe to sources one after another, appending in order.

## Filtering and defaults

- **`filter(predicate)`** — drop non-matching elements.
- **`switchIfEmpty(Publisher)`** — if the source completed empty, continue with
  this instead. The idiomatic "not found", usually
  `switchIfEmpty(Mono.error(new NotFound(id)))`.
- **`defaultIfEmpty(value)`** — the same with a constant.
- **`take(n)`**, **`distinct()`**, **`sort()`** — as they sound; note `sort()`
  must buffer the whole sequence, so it is a trap on an unbounded stream.

## Side effects and inspection

- **`doOnNext`, `doOnError`, `doOnSubscribe`, `doOnCancel`, `doFinally`** —
  hooks that observe signals without changing them. Logging and metrics belong
  here. A `doOn*` callback that blocks is exactly as damaging as a blocking
  `map`.
- **`log()`** — Reactor's own operator that logs every signal passing through
  it. The single most useful debugging tool in the library, because it shows
  the signals rather than the stack.

## Bridging into and out of the model

- **`Mono.just(v)` / `Flux.fromIterable(c)`** — lift existing values in, eagerly.
- **`Mono.fromCallable(supplier)` / `Mono.defer(supplier)`** — the lazy forms.
- **`Mono.empty()` / `Mono.error(e)`** — the two terminal constants.
- **`Mono.fromFuture(cf)`** — adapt a `CompletableFuture`, which is how a chunk
  of pre-Reactor async code usually enters a pipeline
  ([Phase 6 · CompletableFuture](../../phase-6-concurrency/07-completablefuture/README.md)).
- **`block()`** — subscribe and wait for the result on the calling thread.
  Legal in a `main` method or a test, and a production incident anywhere on an
  event loop. Chunk 4 is largely about this call.

## Reading a real chain

```java
public Mono<OrderView> view(String orderId) {
    return orders.findById(orderId)                                  // Mono<Order>
        .switchIfEmpty(Mono.error(new OrderNotFound(orderId)))       // empty -> error
        .flatMap(order -> Mono.zip(                                  // two calls, concurrently
                customers.findById(order.customerId()),              // Mono<Customer>
                pricing.quote(order))                                // Mono<Quote>
            .map(t -> OrderView.of(order, t.getT1(), t.getT2())))
        .onErrorResume(PricingUnavailable.class,
                e -> Mono.just(OrderView.withoutPricing(orderId)));  // degrade
}
```

Read top to bottom as a description: *fetch the order; if there is none, fail
with `OrderNotFound`; otherwise fetch the customer and the quote concurrently
and combine all three; and if pricing specifically is down, degrade instead of
failing.* Every step is asynchronous, none blocks a thread, and the method
returns immediately with a description of the work.

Now notice what the equivalent blocking method would be: four statements, a
null check, a `try`/`catch`, and an executor to make the two calls concurrent.
That comparison is the whole argument of this topic, and chunk 6 is where it
gets settled.

## The trade-off

The vocabulary is genuinely expressive. Retry with exponential backoff,
timeout, concurrent fan-out and typed fallback are one operator each, where the
imperative equivalents are several lines apiece and easy to get subtly wrong.
What you give up is that control flow has become a library API: `if`, `for`,
`try`, `finally`, early return and a debugger's step-over stop applying, and
every developer on the team must know which of a large catalogue of operators
means what. Reactor ships an entire "Which operator do I need?" appendix
precisely because this is the sharp edge, and needing an index to express an
`if` is a real cost to weigh.

## Gotchas

### `flatMap` reordering your results

**Symptom.** A `Flux` of ids mapped through a lookup comes back in a different
order on each run.

**Cause.** `flatMap` subscribes to up to 16 inner publishers at once and merges
whichever completes first.

**Fix.** Use `concatMap` when order matters and concurrency does not, or
`flatMapSequential` when you want both. Do not "fix" it by setting `flatMap`'s
concurrency to 1 — that is `concatMap` with extra steps and it hides the
intent from the next reader.

### `flatMap` opening more connections than the pool has

**Symptom.** Under load, a fan-out over a `Flux` starts timing out waiting for
database connections or HTTP sockets.

**Cause.** The default concurrency of 16 is *per `flatMap` operator*, not per
application. A thousand concurrent requests each running a `flatMap` of 16 is
sixteen thousand attempted inner subscriptions.

**Fix.** Pass the concurrency argument explicitly — `flatMap(fn, 4)` — and size
it against the resource, not against the source. The same reasoning as bounding
downstream concurrency after enabling virtual threads, discussed in
[Topic 01 · Living with virtual threads](../01-why-frameworks-servlet-model/06-living-with-virtual-threads.md).

### An empty `Mono` silently skipping the rest of the chain

**Symptom.** A `flatMap` after a repository lookup never runs, and the endpoint
returns 200 with an empty body.

**Cause.** The lookup completed empty. Operators that map elements have nothing
to map, so the entire tail is skipped — an empty sequence is a valid, successful
outcome.

**Fix.** Decide what empty means immediately after the source that can produce
it, with `switchIfEmpty` or `defaultIfEmpty`.

### Blocking inside `doOnNext` or `map`

**Symptom.** Throughput collapses under load with a handful of event-loop
threads pinned.

**Cause.** These callbacks run on whatever thread delivered the signal, which is
normally an event-loop worker. A JDBC call, a `Thread.sleep`, or a synchronous
HTTP client inside one removes a core's worth of capacity from the whole
application.

**Fix.** Do not block on those threads at all — chunk 4 covers the escape hatch
and what it costs.

## Interview questions

**★ What is the difference between `map` and `flatMap`?**
`map` applies a synchronous function, one element in and one out. `flatMap`
applies a function that itself returns a publisher, subscribes to those inner
publishers, and merges their elements into the output — so it is what you use
whenever the transform calls another service or a repository. `flatMap` also
interleaves and runs several inner publishers concurrently, so it does not
preserve order; `concatMap` is the ordered, serial variant and
`flatMapSequential` is eager-but-ordered.

**★ You see `switchIfEmpty(Mono.error(...))`. What is it doing?**
Turning "no result" into a failure. Empty completion is a successful outcome in
Reactive Streams, so a lookup that finds nothing skips the rest of the chain
and produces an empty 200. `switchIfEmpty` intercepts that case and substitutes
another publisher; pairing it with `Mono.error` is the direct translation of
`Optional.orElseThrow`.

**★ What does `then()` do, and how does it differ from `flatMap`?**
`then()` discards the upstream elements, waits for completion, and continues
with something else — the equivalent of a semicolon between two statements
whose first value you do not need. `flatMap` uses each element to build the
next stage, so it is the equivalent of *using* the previous result. Reaching
for `then()` when you needed the value shows up immediately as a variable you
have no way to reference.

**★ How would you run two independent downstream calls concurrently and combine them?**
`Mono.zip(callA, callB).map(tuple -> combine(tuple.getT1(), tuple.getT2()))`.
Both are subscribed at once, so the combined latency is the slower of the two
rather than their sum, and `zip` handles the failure case by propagating the
first error and cancelling the other. This is the one scenario where a reactive
implementation is genuinely faster than a naive blocking one — though a
blocking version with an executor, or with virtual threads and structured
concurrency, gets the same win.

**★ Is a Reactor chain the same as a Java `Stream` pipeline?**
They share the lazy assemble-then-run shape and much of the vocabulary, but
differ in two important ways. A `Stream` is pull-based and synchronous: the
terminal operation runs the whole thing on the calling thread and returns a
value. A `Flux` is push-based and asynchronous: elements arrive over time,
possibly on other threads, and subscribing returns immediately. And a `Flux`
carries backpressure and error signals as part of its protocol, which `Stream`
has no notion of at all. See
[Phase 4 · Lambdas and streams](../../phase-4-lambdas-streams/README.md) for
the synchronous half of the comparison.

**★ What does the `log()` operator give you that a `doOnNext` with a logger does not?**
Every signal, not just elements. `log()` reports `onSubscribe`, `request(n)`,
each `onNext`, and the terminal `onComplete`/`onError`/`cancel`, which means it
shows you demand and cancellation — the two things that are invisible in the
data flow and are usually what is actually wrong. It is the first thing to
reach for when a pipeline "does nothing", because it distinguishes "never
subscribed" from "subscribed and requested zero" from "completed empty".

---

← Prev: [Mono, Flux and laziness](02-mono-flux-and-laziness.md) · Index: [WebFlux and reactive](README.md) · Next → [Errors, retries and cancellation](04-errors-retries-cancellation.md)
