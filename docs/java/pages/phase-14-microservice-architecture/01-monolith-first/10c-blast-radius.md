---
title: "A JVM is a shared-fate boundary: one OutOfMemoryError, one saturated pool, one runaway thread and every module in the process goes down together — and the in-process mitigations are real but strictly weaker than a process boundary"
sidebar_label: "10c · Blast radius"
sidebar_position: 23
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-01 against Chris Richardson, *Pattern: Monolithic Architecture*
> ([microservices.io](https://microservices.io/patterns/monolithic.html)); Martin Fowler,
> *Microservice Prerequisites*
> ([martinfowler.com](https://martinfowler.com/bliki/MicroservicePrerequisites.html)); the
> Java SE 25 specification of `OutOfMemoryError` and thread-pool behaviour as described in
> the `java.util.concurrent` package documentation.
> Version spine: JDK 25 · Spring Boot 4.1.0 · Spring Modulith 2.1.1. **No sandbox** — no
> heap dumps, GC logs or failure traces here come from a run.

**Modularity is a compile-time and design-time property. Failure isolation is a runtime
property, and the JVM does not provide it between packages. This is the one place where the
modular monolith's answer is genuinely partial, and pretending otherwise is the fastest way
to lose an architecture argument to someone who has actually operated a large monolith.**

## What is shared, and therefore what is fatal

| Resource | Shared across modules | What one module can do to everyone |
|---|---|---|
| Heap | Yes | `OutOfMemoryError` → process death |
| Garbage collector | Yes | A large allocating module lengthens everyone's pauses |
| Threads / request executor | Yes | Blocking on a slow dependency starves unrelated requests |
| Connection pool | Usually | A long query holds a connection nobody else can use |
| Classpath | Yes | A dependency version is one version, for everyone |
| Native memory, file handles | Yes | A leak in one module exhausts a process-wide limit |
| CPU quota (in a container) | Yes | A hot loop throttles the whole pod |
| Process lifecycle | Yes | Any fatal error, any restart, hits every module |

The most damaging in practice is the third row, because it is subtle. A module calling a
slow external API on the request thread does not fail — it *waits*, holding a thread from a
shared pool. When enough of them wait, unrelated endpoints stop being served, and the
symptom is "the whole application is down" while every dashboard shows a healthy module.

## What you can actually do in-process

These are real mitigations. They are also strictly weaker than a process boundary, and it
matters to be precise about which failures each one covers.

**Separate thread pools per integration.** A dedicated bounded executor for calls to a slow
dependency, so saturation is contained.

```java
package com.acme.commerce.pricing;

import java.util.concurrent.Executor;
import java.util.concurrent.ThreadPoolExecutor;
import java.util.concurrent.LinkedBlockingQueue;
import java.util.concurrent.TimeUnit;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
class PricingIntegrationConfig {

    /** Bounded pool and bounded queue: pricing cannot consume more than this. */
    @Bean("pricingExecutor")
    Executor pricingExecutor() {
        var executor = new ThreadPoolExecutor(
                4, 8, 60L, TimeUnit.SECONDS,
                new LinkedBlockingQueue<>(100),
                new ThreadPoolExecutor.AbortPolicy());   // fail fast, do not queue forever
        executor.allowCoreThreadTimeOut(true);
        return executor;
    }
}
```

**Covers:** thread starvation from one slow dependency. **Does not cover:** heap, GC, the
process.

**A bounded queue with a rejection policy, not an unbounded one.** `AbortPolicy` turns
overload into a fast failure you can observe. An unbounded queue turns it into heap growth
and then into `OutOfMemoryError`, which is the process. This single choice is the difference
between "pricing is degraded" and "the application restarted".

**A separate connection pool per module.** Real, and it costs connections at the database,
which is itself a bounded resource — so it is a trade rather than a fix. Phase 10 topic 02
owns pooling.

**Timeouts on every outbound call.** The cheapest and most frequently omitted mitigation. A
call with no timeout holds its thread until the OS gives up, which can be minutes. Timeouts
are a client-side obligation owned by **05 · Inter-service REST** *(not written yet)*.

**Circuit breakers and bulkheads.** They work in-process exactly as they do across services —
this is a common misconception, that resilience patterns require a network. Phase 16 owns
Resilience4j; the point here is that you can and should apply it to *module* boundaries
inside a monolith.

**Asynchronous handoff at module boundaries.** `@ApplicationModuleListener` runs the listener
on a separate executor in its own transaction, so a slow or failing consumer does not block
the producer's request thread. **46 · @ApplicationModuleListener** *(not written yet)*.

## What you genuinely cannot do

**Contain an `OutOfMemoryError`.** The `Error` may be thrown on any thread that attempts an
allocation, not necessarily the thread that caused the pressure, and the process's remaining
behaviour is not something to rely on. There is no per-package heap limit in the JVM.
Phase 12 topic 04 owns the diagnosis.

**Contain GC pressure.** One collector, one set of pauses, shared by every module.

**Contain a classpath conflict.** One version of every library. A module needing an
incompatible version has no in-process answer short of shading, which is a maintenance
burden of its own.

**Contain a JVM-wide crash or a container OOM kill.** Everything in the process, every time.

**Give two modules different availability tiers.** Same process, same restarts, same
deployments, same risk.

## The middle option, again

The two-deployables answer from [22 · Independent scaling](10b-independent-scaling.md)
applies here and is the best available compromise: run the same artefact as an API
deployment and a batch deployment. A batch job that exhausts its heap kills the batch pod;
the API pods keep serving. That is a **genuine process boundary between workload types**,
obtained without splitting the codebase, without a network call between subdomains and
without losing the shared transaction — because the two deployments do not call each other
synchronously in the first place.

It is not a boundary between *subdomains*, so it does not help when checkout and catalogue
must both live in the API deployment. But the classic blast-radius incident — a reporting or
import job taking down the customer-facing path — is exactly the case it solves.

## Gotchas

**★ Thread starvation is the blast-radius failure you will actually meet, and it looks like
a total outage.** One module blocking on a slow dependency holds threads from a shared pool
until unrelated endpoints stop being served. Every per-module dashboard looks healthy;
the application is down. Bounded, dedicated executors per integration and timeouts on every
outbound call are the mitigations, and both are usually missing.

**★ An unbounded work queue converts overload into `OutOfMemoryError`.** `LinkedBlockingQueue`
with no capacity argument is unbounded, and it is the default in a lot of sample code. Under
sustained overload it grows until the heap is gone, turning a recoverable degradation into a
process death. Always bound the queue and always choose an explicit rejection policy.

**★ Resilience patterns are not only for network calls, and teams believe they are.**
Circuit breakers, bulkheads, rate limits and timeouts apply perfectly well to a call between
two modules in one JVM — especially one that fans out to a slow database query or an
external API. Applying them at module boundaries in the monolith is both good practice and
the rehearsal for applying them at service boundaries later.

**★ Separate connection pools trade one bounded resource for another.** Per-module pools
stop one module monopolising connections, and they multiply the total connections your
database must accept. The database's connection limit is itself a shared fate boundary, so
this improves isolation inside the JVM and may create a new constraint outside it. Size the
total, not the parts.

**★ There is no way to bound a module's heap usage inside a JVM, and no amount of
architecture changes that.** If a module can allocate an unbounded result set, it can kill
the process. The mitigations are all about not allocating unboundedly — streaming results,
paginating, capping request sizes — which is code discipline, not isolation.

**★ Health checks that only test liveness hide partial failure.** A process with every
thread blocked on a slow dependency will happily answer a trivial `/actuator/health` request
if that endpoint does not touch the exhausted pool, so the platform sees a healthy pod while
users see nothing. Make readiness reflect the resources that actually gate request handling.

**★ The two-deployables trick separates workload types, not subdomains.** It solves the
common incident where a batch or import job takes down the customer path, and it does
nothing for two interactive subdomains that must both serve traffic from the same
deployment. Be clear about which of those your incident history actually contains.

**★ A shared classpath means a shared upgrade schedule, and that is a blast radius too.**
A module pinned to an old library version pins everyone, and a CVE in a shared dependency
means the whole application is affected. This is the slow-motion version of the same
shared-fate problem, and it is item 2 on
[21 · What genuinely does not work](10-what-genuinely-does-not-work.md).

## Interview questions

**★ What does a JVM share between modules, and why does that matter?**
Heap, garbage collector, thread pools, usually the connection pool, the classpath, native
memory and file handles, the container's CPU quota, and the process lifecycle itself. It
matters because modularity is a compile-time and design-time property while failure
isolation is a runtime one, and the JVM offers no runtime partitioning between packages. So
a module can kill the process with an `OutOfMemoryError`, lengthen everyone's GC pauses, or —
most commonly — starve unrelated request handling by blocking shared threads on a slow
dependency.

**★ What in-process mitigations actually work, and what do they not cover?**
Dedicated bounded executors per integration contain thread starvation but not heap, GC or
process death. Bounded queues with an explicit rejection policy convert overload into a fast
observable failure instead of heap growth. Per-module connection pools stop one module
monopolising connections, at the cost of more total connections against a database limit
that is itself shared. Timeouts on every outbound call stop threads being held indefinitely.
Circuit breakers and bulkheads work in-process and are commonly assumed not to. None of them
contains an `OutOfMemoryError`, a GC pause, a classpath conflict or a container OOM kill.

**★ Describe the blast-radius incident you are most likely to actually experience.**
A module makes a synchronous call to a slow dependency — an external API, an unindexed query
— on the request thread, with no timeout. Threads from the shared pool accumulate in that
call. Once the pool is exhausted, unrelated endpoints stop being served, so the symptom is a
total outage while every module-level metric looks fine and the liveness probe still passes
because it does not touch the exhausted resource. The fix is a bounded dedicated executor
for that integration, an aggressive timeout, and a readiness probe that reflects the
resources request handling actually needs.

**★ How much blast-radius isolation can you get without splitting the codebase?**
Meaningful but partial. Deploying the same artefact as separate API and batch deployments
gives a genuine process boundary between workload types, so an import or reporting job that
exhausts its heap kills only its own pods — and that is the classic incident. Within a
deployment, bounded executors, bounded queues, per-module pools, timeouts and circuit
breakers at module boundaries contain thread and dependency failures. What remains
uncontainable is anything process-wide: heap exhaustion, GC pressure, classpath conflicts,
crashes and restarts. If two interactive subdomains must both serve traffic and genuinely
require different availability tiers, that is the point where a process boundary between
subdomains is the honest answer.

{/* FOOTER */}
