---
title: "Living with virtual threads"
sidebar_label: "6 · Living with virtual threads"
sidebar_position: 6
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-19 against the Spring Boot reference and common application
> properties appendix (docs.spring.io/spring-boot —
> `spring.threads.virtual.enabled`, `server.tomcat.threads.max`),
> spring-projects/spring-boot issue #41937 (virtual threads and thread-pool
> limits — resolved as a documentation clarification), JEP 444 (Virtual
> Threads), JEP 491 (Synchronize Virtual Threads without Pinning, JDK 24), the
> JDK 25 Core Libraries virtual-threads guide, and the Spring Framework 7.0
> release notes (`@ConcurrencyLimit`, `@EnableResilientMethods`).
> Spring Boot 4.1.0, Spring Framework 7.0.x, JDK 25.

**One property turns a Spring Boot service from a few hundred concurrent
requests to effectively unbounded concurrency, and the second half of that
sentence is the part nobody plans for. The bounded thread pool you removed was
not only a limit on your own threads — it was, accidentally, the only thing
stopping your service from applying its full offered load to every database and
downstream API it talks to. Enabling virtual threads is therefore not a
one-line change: it is a one-line change plus a deliberate decision about where
your backpressure now lives.**

## What the property does not do

This is where the property is more subtle than the one-liner suggests.

**It does not bound concurrency any more.** `server.tomcat.threads.max` governs
the platform-thread pool. Once requests run on virtual threads there is no pool
to cap, so that property stops limiting in-flight requests — Spring Boot issue
#41937 exists precisely because this surprised people, and the resolution was a
documentation change rather than a code change. The scheduler's carrier
parallelism is JVM-wide (`jdk.virtualThreadScheduler.parallelism`), not a
per-application knob.

The practical consequence: **the backpressure you thought you had is gone.**
A pool of 200 was, accidentally, a limit on how hard you could hit your
database. Remove it and 10,000 concurrent requests will all try to borrow a
connection from a pool of 20, or all hammer a downstream service that has its
own limits. You have to reintroduce the limit deliberately — a bounded
connection pool, a `Semaphore`, or Framework 7's new `@ConcurrencyLimit` — as
[Phase 6 · Using them well](../../phase-6-concurrency/02-platform-vs-virtual-threads/03-using-them-well.md)
argues.

**It does not make anything faster.** Virtual threads improve *throughput under
concurrency*, not the latency of any single request. A CPU-bound handler gets
no benefit at all; there is exactly as much CPU as before.

**It does not fix thread-locals.** Anything relying on `ThreadLocal` still
works, but a virtual thread per request means a new thread-local map per
request rather than a reused one — usually harmless, occasionally a memory
surprise if you were caching something expensive per thread. `ScopedValue`
is the modern answer.

**And pinning still exists, though much less than it did.** Before JDK 24 a
virtual thread blocking inside `synchronized` could not unmount, silently
reintroducing the platform-thread ceiling. JEP 491 fixed monitors in 24, so on
our JDK 25 target the remaining cause is native frames — see
[Phase 6 · Virtual-thread pinning](../../phase-6-concurrency/14-virtual-thread-pinning.md).

## The trade-off, stated honestly

Thread-per-request with virtual threads is the right default for the
overwhelming majority of services, and that is a change from the advice of five
years ago. What you are trading:

- **You keep** blocking code, real stack traces, working debuggers and
  profilers, and a straightforward mental model.
- **You give up** the automatic backpressure a bounded pool provided, and you
  must reintroduce it explicitly at every downstream boundary.
- **You do not get** what a reactive stack genuinely offers beyond scaling:
  composable streaming operators, and a natural model for server-sent events
  and long-lived connections where the data arrives over time.

That last bullet is why WebFlux is not obsolete — it is why it is now a
*specialised* choice rather than the scaling answer, which is the argument
**Topic 15 — WebFlux and reactive** *(not written yet)* takes up.

## Gotchas

### Enabling virtual threads and losing your rate limit

**Symptom.** After setting `spring.threads.virtual.enabled=true`, throughput
improves and then the database starts timing out under load, or a downstream
service starts returning 429s it never returned before.

**Cause.** `server.tomcat.threads.max` was silently acting as a global
concurrency limit. Virtual threads remove it, so the application now applies
its full offered load to every downstream dependency at once.

**Fix.** Make the limit explicit where it belongs — at the resource:

```java
@Service
class InventoryClient {
    private final Semaphore permits = new Semaphore(50);   // ✅ explicit ceiling

    Stock check(String sku) throws InterruptedException {
        permits.acquire();
        try {
            return restClient.get().uri("/stock/{sku}", sku)
                             .retrieve().body(Stock.class);
        } finally {
            permits.release();
        }
    }
}
```

Framework 7's `@ConcurrencyLimit` (enabled with `@EnableResilientMethods`)
expresses the same thing declaratively, and your connection pool's maximum size
is the other half of the answer.

### Expecting virtual threads to speed up a CPU-bound endpoint

**Symptom.** A report-generation endpoint is enabled for virtual threads and
its latency does not move.

**Cause.** Virtual threads help when threads are *parked on I/O*. A handler
that is computing has no parked time to reclaim, and the carrier pool is sized
to the CPU count either way.

**Fix.** Treat it as the CPU problem it is — cache, precompute, page the work,
or move it off the request path onto a queue. If you must parallelise the
computation itself, a bounded platform-thread pool sized to the cores is still
the right tool, not virtual threads.

### Pooling virtual threads

**Symptom.** Someone configures a fixed-size executor of virtual threads to
"control resource usage", and throughput is no better than before.

**Cause.** Pooling exists because platform threads are expensive to create.
Virtual threads are cheap to create and the pool just reinstates the ceiling
you were trying to remove.

**Fix.** Never pool them. Use
`Executors.newVirtualThreadPerTaskExecutor()`, and if you need a limit, use a
semaphore for the *resource* rather than a pool for the *threads*.

### A `ThreadLocal` that grew a memory problem

**Symptom.** Heap usage climbs after enabling virtual threads, with many small
retained maps.

**Cause.** With a pool of 200 platform threads there were 200 thread-local
maps. With a virtual thread per request there is one per in-flight request, and
anything expensive cached per thread is now allocated per request.

**Fix.** Audit what you put in `ThreadLocal`. Small context values are fine;
caches, buffers and `SimpleDateFormat`-style scratch objects should be either
shared and immutable or genuinely per-call. `ScopedValue` is the JDK 25 answer
for request-scoped context and is designed for this model.

### Assuming a blocking call inside a reactive pipeline is merely slow

**Symptom.** A WebFlux application degrades badly under moderate load after
someone adds a blocking JDBC call inside a `map`.

**Cause.** The event loop has one thread per core. Blocking one of them removes
a significant fraction of the application's total capacity — not just that
request's.

**Fix.** Don't mix. Either the whole path is reactive, or use MVC with virtual
threads, which is why the second option is now the default recommendation. If
you genuinely must block inside a reactive pipeline, it has to be offloaded to
a bounded elastic scheduler, and at that point you have rebuilt the thread pool
you were avoiding.

## Interview questions

**★ After enabling virtual threads, does `server.tomcat.threads.max` still limit concurrency?**
No, and this is the trap. That property sizes a platform-thread pool; once
requests run on virtual threads there is no pool to bound, so in-flight request
concurrency becomes effectively unlimited. Spring Boot issue #41937 was raised
over exactly this and was resolved as a documentation clarification. The
carrier-thread parallelism is a JVM-wide system property
(`jdk.virtualThreadScheduler.parallelism`), not an application-level limit. The
practical implication is that a bounded pool was providing accidental
backpressure to your database and downstream services, and after the switch you
must reintroduce it deliberately — bounded connection pools, semaphores, or
Framework 7's `@ConcurrencyLimit`.

**★ Do virtual threads make requests faster?**
No. They improve throughput under concurrency by letting far more requests be
in flight simultaneously; they do nothing for the latency of an individual
request and nothing at all for CPU-bound work, since the carrier pool is sized
to the available cores. If a single endpoint is slow because it computes a lot,
virtual threads will not help and the fix is the ordinary one — cache,
precompute, or move the work off the request path.

**★ Why should you never pool virtual threads?**
Pooling is an optimisation for objects that are expensive to create, which is
true of platform threads and false of virtual threads. Putting virtual threads
in a fixed-size pool reinstates exactly the ceiling you adopted them to remove,
while adding the pool's own overhead and the thread-local reuse hazards.
The correct idiom is `Executors.newVirtualThreadPerTaskExecutor()` — one thread
per task — and when you need to limit concurrent access to a resource, limit
the *resource* with a semaphore or a bounded connection pool rather than
limiting the threads.

**★ Is pinning still something to worry about on JDK 25?**
Much less than it was. Before JDK 24, a virtual thread that blocked while
holding a `synchronized` monitor could not unmount from its carrier, which
silently reintroduced the platform-thread ceiling and produced migration advice
telling everyone to rewrite hot `synchronized` blocks as `ReentrantLock`.
JEP 491 in JDK 24 fixed monitors properly, so on a JDK 25 target the remaining
pinning cause is blocking inside a native frame. It is worth knowing the
history because a great deal of published guidance predates the fix and is now
wrong.

---

← Prev: [Thread per request, and what virtual threads changed](05-thread-per-request.md) · Index: [Phase 9 — Spring Boot and the web](../README.md)
