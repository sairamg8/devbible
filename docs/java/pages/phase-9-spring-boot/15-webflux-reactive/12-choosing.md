---
title: "Choosing, and the failure mode in between"
sidebar_label: "12 · Choosing"
sidebar_position: 12
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-08-19 against the Spring Framework reference *Web on Reactive
> Stack → Overview → Applicability* (the dependency-check heuristic, "if you
> have a Spring MVC application that works fine, there is no need to change",
> and the recommendation to use `WebClient` from MVC), *Concurrency Model →
> Invoking a Blocking API*, the Spring Boot reference for
> `spring.threads.virtual.enabled`, and JEP 444. Spring Boot 4.1.0, Spring
> Framework 7.0.x, JDK 25.

**There is a right answer for most services and it is no longer the exciting
one: Spring MVC with virtual threads. But the decision that matters more than
MVC-versus-WebFlux is the one people make by accident — a reactive controller
in front of a blocking repository, which is slower, less scalable and harder to
debug than either coherent choice. Whichever stack you pick, pick it for the
whole request path.**

## The decision, by situation

| Situation | Choose |
|---|---|
| Greenfield CRUD or business service on JDK 21+ | **MVC**, `spring.threads.virtual.enabled=true` |
| Data access is JPA, JDBC, or any blocking driver | **MVC** — the reference says so outright |
| API gateway or BFF: mostly fan-out over HTTP, no local database | **WebFlux** is a genuine fit |
| Long-lived streaming: SSE, websockets, many idle connections | **WebFlux** for expressiveness; MVC is now feasible too |
| A fast producer must be throttled by a slow consumer | **WebFlux** — backpressure is the differentiator |
| The team and codebase are already reactive and it works | **Keep it.** There is no prize for migrating |
| "We are doing microservices" | Not an argument. Ignore it |
| A benchmark shows one is faster on hello-world | Not an argument. Ignore it |

The Spring reference's own heuristic is the most useful single sentence in the
whole topic: *"A simple way to evaluate an application is to check its
dependencies. If you have blocking persistence APIs (JPA, JDBC) or networking
APIs to use, Spring MVC is the best choice for common architectures at least."*
It is a dependency question before it is an architecture question.

## The failure mode in between

The worst outcome is not choosing the wrong stack. It is choosing both:

```java
@RestController
class OrderController {

    private final OrderRepository jpaRepository;    // ← blocking, Spring Data JPA

    @GetMapping("/orders/{id}")
    Mono<Order> one(@PathVariable String id) {
        return Mono.just(jpaRepository.findById(id).orElseThrow());   // ❌ blocks the event loop
    }
}
```

This compiles, passes tests, and behaves acceptably in development. In
production it is the worst of every world:

- **The blocking call runs on an event-loop worker.** There is roughly one per
  core for the entire application, so this endpoint's database latency reduces
  the whole service's capacity, not just its own.
- **Concurrency is now *lower* than plain MVC.** MVC would have had a
  200-thread pool to absorb the wait; WebFlux has one thread per core.
- **You pay every reactive cost anyway** — stack traces, `ThreadLocal`s,
  testing, the vocabulary — for none of the benefit.
- **It is invisible in review.** The signature says `Mono`. The blocking is
  inside a repository method that looks exactly like it did in the MVC service
  next door.

The two coherent versions of the same endpoint:

```java
// ✅ blocking stack, blocking data access, virtual threads for scale
@GetMapping("/orders/{id}")
Order one(@PathVariable String id) {
    return jpaRepository.findById(id).orElseThrow(() -> new OrderNotFound(id));
}

// ✅ reactive stack, reactive data access all the way down
@GetMapping("/orders/{id}")
Mono<Order> one(@PathVariable String id) {
    return r2dbcRepository.findById(id)
                          .switchIfEmpty(Mono.error(new OrderNotFound(id)));
}
```

And if the blocking call genuinely cannot be replaced but the stack must stay
reactive, the offload has to be explicit and deliberate, with the pool sized as
the real concurrency limit it now is:

```java
@GetMapping("/orders/{id}")
Mono<Order> one(@PathVariable String id) {
    return Mono.fromCallable(() -> jpaRepository.findById(id)
                                                .orElseThrow(() -> new OrderNotFound(id)))
               .subscribeOn(Schedulers.boundedElastic());   // ⚠️ a thread pool, by another name
}
```

That third version is honest rather than good. If most of your endpoints look
like it, chunk 11's argument applies and you are running an MVC application in
Reactor's clothing.

## Partial adoption, done properly

There is one blend the Spring reference actively recommends, and it is the
opposite of the failure above: **an MVC application using `WebClient`.** Keep
the blocking server stack, and use the non-blocking client to overlap
downstream calls. The blocking side never becomes reactive; the reactive types
stay inside a method. On Framework 7 the alternative for plain synchronous
calls is `RestClient`, since `RestTemplate` is deprecated.

The rule that distinguishes the good blend from the bad one: **reactive types
may travel *downward* into a blocking application's outbound calls; blocking
calls may never travel *upward* into a reactive request path.**

## How to decide in practice

Four questions, in order. The first one that gives a clear answer usually ends
the discussion:

1. **What does your data access look like?** JPA or JDBC means MVC. R2DBC or
   reactive Mongo means WebFlux is available.
2. **Does the service stream, or apply backpressure to a fast source?** If yes,
   WebFlux earns its cost.
3. **Is the team already fluent in Reactor?** If not, price several months of
   reduced throughput and a harder on-call rotation, and weigh that against
   what you are buying.
4. **Is anything else forcing it?** A library that only ships a reactive API, a
   platform requirement, an existing reactive codebase you are extending.

If none of those points to WebFlux, MVC with virtual threads is the answer, and
it is the answer for most services.

## Gotchas

### "Microservices need reactive"

**Symptom.** The decision is made from the architecture style rather than from
the workload.

**Cause.** Reactive and microservices were popular at the same time, and a lot
of conference material conflated them.

**Fix.** Nothing about splitting a system into services implies anything about
the concurrency model inside one. A small service handling a few hundred
concurrent requests over a JDBC database is the archetypal case *against*.

### Adopting WebFlux for a scalability requirement nobody quantified

**Symptom.** The stated reason is "we expect high load", with no number.

**Cause.** The scaling argument is memorable and the cost is not.

**Fix.** Get the number. A service peaking at a few hundred concurrent requests
is inside a default Tomcat pool's comfort zone before virtual threads are even
involved. If the number is genuinely tens of thousands of concurrent
connections, that is a real reason — and it is worth checking whether it is
*connections* rather than *requests*, because idle connections are exactly what
both models now handle cheaply.

### Migrating to WebFlux one controller at a time

**Symptom.** A partly-migrated codebase where some paths are reactive, most
services are shared, and the boundaries are unclear.

**Cause.** Colour propagates, so a shared service can only be one colour. Making
it reactive forces its blocking callers to `block()`, and leaving it blocking
forces its reactive callers to offload.

**Fix.** Migrate by service boundary, not by endpoint. If a whole deployable
cannot move at once, it should not start moving.

### Choosing by benchmark

**Symptom.** A hello-world throughput comparison decides the architecture.

**Cause.** Such a benchmark has no I/O latency, so it measures JSON
serialisation on both sides and shows them roughly tied — or shows noise.

**Fix.** Either measure realistically — real data layer, realistic downstream
latency, concurrency high enough to hit a limit — or accept that the decision is
about maintainability and ecosystem rather than throughput, which for most
services it is.

### Keeping a reactive codebase that nobody enjoys, out of sunk cost

**Symptom.** Every incident takes longer than it should, new hires take months
to be productive, and the team quietly avoids touching the reactive services.

**Cause.** The stack was chosen for scalability that never materialised, and
the cost is being paid every day.

**Fix.** This one cuts the other way from the usual advice: if the reactive
properties are not being used, a rewrite to MVC with virtual threads is a real
option, because the target is simpler code with the same scaling behaviour. It
is still a rewrite — price it — but "we already built it" is not by itself a
reason to keep paying.

## Interview questions

**★ How do you decide between Spring MVC and WebFlux for a new service?**
Start from the dependencies, as the Spring reference suggests: JPA or JDBC data
access means MVC, because the blocking driver poisons the whole reactive path.
Then ask whether the service streams or needs backpressure against a fast
producer, and whether it is mostly wide fan-out with no local database — those
are the cases where WebFlux still earns its cost. Finally weigh the team's
fluency, because the debugging and context costs are paid daily. For a
greenfield CRUD service on JDK 21+, MVC with `spring.threads.virtual.enabled`
is the right default.

**★ What is wrong with a reactive controller calling a blocking repository?**
It is worse than either coherent choice. The blocking call occupies one of a
handful of event-loop workers, so its latency consumes a measurable share of
the whole application's capacity; the resulting concurrency is *lower* than
plain MVC, which had a couple of hundred pool threads to absorb the wait; and
the codebase pays every reactive cost — traces, context, testing, vocabulary —
for none of the benefit. It is also nearly invisible in review, because the
method signature returns a `Mono`.

**★ Is there a legitimate way to mix the two stacks?**
Yes, one: a Spring MVC application using `WebClient` for outbound calls, which
the Spring reference explicitly recommends, and MVC controllers may return
reactive types directly. The direction is what makes it safe — reactive types
travel downward into a blocking application's outbound calls, and blocking
calls never travel upward into a reactive request path. That blend gets you
concurrent fan-out without adopting the reactive model anywhere else.

**★ Someone says "we should use WebFlux because we are building microservices". What do you say?**
That the two are unrelated. Service decomposition is about deployment,
ownership and coupling; the concurrency model is about how one process handles
in-flight work. A typical microservice serving a few hundred concurrent
requests over a relational database is the clearest case *against* WebFlux,
because its data access is blocking and its concurrency is well inside what a
thread-per-request server handles — trivially so once virtual threads are on.

**★ When would you migrate an existing WebFlux application to MVC?**
When it is not using what reactive gives — no streaming, no backpressure, no
wide fan-out — and the costs are visible: incidents that take too long because
traces are unreadable, slow onboarding, an offloaded blocking data layer that
makes the elastic scheduler the real concurrency limit. The target is simpler
code with equivalent scaling behaviour on virtual threads. It is a genuine
rewrite and should be priced as one, but sunk cost alone is not a reason to
keep paying.

**★ If you had to justify choosing WebFlux today, what would the justification look like?**
Something specific and workload-shaped: "we relay a Kafka topic into tens of
thousands of SSE subscribers and need the producer throttled when consumers
fall behind", or "this gateway makes six downstream calls per request and holds
no database connection at all", or "the team has run Reactor in production for
four years and our data layer is already R2DBC". What it should not look like
is a projected request rate with no measurement, a preference for functional
style, or an architectural label.

---

← Prev: [Why virtual threads moved the default back](11-why-virtual-threads-changed-the-answer.md) · Index: [WebFlux and reactive](README.md)
