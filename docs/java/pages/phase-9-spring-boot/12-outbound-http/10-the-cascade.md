---
title: "How one merely-slow dependency takes down a service that was correctly configured"
sidebar_label: "10 · The cascade"
sidebar_position: 10
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-20 against the Apache HttpComponents Client 5.x API for the
> pooling connection manager
> (hc.apache.org/httpcomponents-client-5.5.x/current/httpclient5/apidocs/), and
> the Spring Framework reference *Core → Resilience* for `@ConcurrencyLimit`
> (docs.spring.io/spring-framework/reference/core/resilience.html). Spring Boot
> 4.1.0, Spring Framework 7.0.x, JDK 25.

**Every ingredient of the classic cascading failure is individually harmless. A
dependency gets slower — not down, slower. A read timeout is a bit generous. A
connection pool has its default size. A connection-acquisition timeout was never
set because nobody knew it existed. None of those is worth an incident review on
its own. Together they turn a dependency's bad afternoon into your outage, and
they do it in a way that makes the thread dump look like the wrong problem. This
chunk walks the sequence, then argues for the two limits that stop it: bounded
waiting, and explicit concurrency control now that virtual threads have removed
the accidental kind.**

## Pool exhaustion plus a missing timeout is the outage

Take the two failure modes separately and they are survivable. Take them
together and they compound into the classic cascading failure:

1. A downstream service degrades. It still accepts connections; it just answers
   slowly — say ten seconds instead of fifty milliseconds.
2. Because there is no read timeout (or it is far too generous), each in-flight
   request holds its pooled connection for those ten seconds.
3. Five concurrent requests exhaust the per-route pool.
4. Every subsequent caller blocks in **step 1**, waiting to acquire a connection.
   On Apache this wait is bounded by the *connection request timeout* — which
   almost nobody sets, so it is effectively unbounded.
5. Your request-handling threads fill up with callers waiting for a connection to
   a service that is merely slow.
6. Your own service now fails its health checks and starts returning errors to
   *its* callers, who retry, which adds load, which makes it worse.

The instructive detail is **where the threads are parked**. A naive reading of a
thread dump expects to see them in a socket read against the slow dependency. In
this scenario most of them are parked in the pool's lease call, having never
talked to the dependency at all — which is why "the downstream is slow" and "we
are out of connections" look like different incidents until you look closely.

Three settings turn this from an outage into a fast, contained failure:

```yaml
spring:
  http:
    clients:
      connect-timeout: 1s
      read-timeout: 2s     # bounds step 3, so connections come back
```

plus a **connection-request timeout** on the pool, so step 4 fails fast instead
of queueing without bound. Fail fast is not a consolation prize here: a caller
that gets an error in 50 ms can shed load, serve a cached value, or return a
degraded response. A caller that waits eight seconds and then gets an error has
consumed the resource *and* failed.

## Virtual threads removed the accidental limit

This is the part that has changed and is not widely internalised.

On platform threads, a bounded request-handling pool acted as an unintentional
admission control: a servlet container with 200 threads could not have more than
200 outbound calls in flight, because it could not have more than 200 requests in
flight. The number was arbitrary, but it existed.

Virtual threads remove it. The container will happily run tens of thousands of
concurrent requests, so tens of thousands of callers can queue for your five
connections. Nothing breaks — the queue is just very long, and every one of those
callers is waiting.

The consequence is that **an explicit concurrency limit is now something you have
to add on purpose**, and there are two places to put it:

- **The pool**, sized deliberately with a bounded acquisition timeout, which
  bounds concurrency per downstream host.
- **The caller**, with Framework 7's `@ConcurrencyLimit` — covered in
  [chunk 15](15-retrying-safely.md) — which bounds how many threads may be
  inside a method at once, and which the resilience documentation explicitly
  calls out as being particularly useful with virtual threads for exactly this
  reason.

Background on the threading model: [Phase 6 — Concurrency](../../phase-6-concurrency/README.md).

## Bulkheads: the fix is not sharing

The reason a slow dependency reaches an unrelated one is almost always a shared
resource — one connection pool, one thread pool, one client. The remedy has a
name and it is unglamorous: **do not share**.

- **One `RestClient` per downstream service**, each with its own pool. A partner
  API exhausting its own five connections cannot then take the ones your session
  lookup needed.
- **A concurrency limit per dependency**, so the number of threads that can be
  inside a call to it is bounded by policy rather than by accident:

```java
@Service
public class PricingGateway {

    @ConcurrencyLimit(20)
    public Pricing lookup(String tier) {
        return restClient.get().uri("/pricing/{tier}", tier)
                .retrieve().body(Pricing.class);
    }
}
```

`@ConcurrencyLimit` needs `@EnableResilientMethods` on a configuration class, and
the mechanics are in [chunk 14](14-retries-and-resilience.md). The point here is
the *shape*: the twenty-first concurrent caller is rejected or made to wait by
your own policy, at a boundary you chose, rather than queueing invisibly inside a
connection pool.

## Shedding load is a feature, not a failure

The instinct when a dependency is slow is to wait longer. It is the wrong
instinct, and it is worth being explicit about why.

A caller that fails in 50 ms has options: serve a cached value, degrade the
response, return `503` with a `Retry-After` so its own client backs off, or fail
the request cheaply and free the capacity for the requests that can still be
served. A caller that waits eight seconds and then fails has consumed a
connection, a thread, and eight seconds of its own caller's patience, and
achieved nothing.

⚠️ **Health checks are part of this loop and are frequently misconfigured.** If
your readiness probe calls the degraded dependency, then a dependency being slow
takes *your* instances out of rotation, concentrating traffic on the remaining
ones, which makes them slower. A readiness probe should answer whether *this
instance* can serve traffic, not whether the whole dependency graph is healthy.
That is **[Topic 13 — Actuator](../13-actuator/README.md)**'s territory, and it is worth
checking before an incident rather than during one.

## Retries make it worse, and this is the part people get wrong

The natural response to errors is to retry, and in a cascade that is precisely
the wrong move: every retry is *additional load applied to a system that is
failing because it is overloaded*. Three retries turn a 100 requests-per-second
dependency problem into a 400 requests-per-second one, and the dependency that
might have recovered on its own now cannot.

This is important enough to get its own chunk, with the conditions under which
retrying is safe and the mechanisms Framework 7 gives you —
[chunk 14](14-retries-and-resilience.md). The rule to carry out of this one is:
**a retry policy without a bound is an amplifier, not a mitigation.**

## Gotchas

**⚠️ Assuming the thread dump will show socket reads**
**Symptom:** an incident is misdiagnosed as "the network is slow" because nothing
appears to be talking to the dependency.
**Cause:** the threads are parked leasing a connection from an exhausted pool,
not reading from a socket.
**Fix:** read the pool's own metrics — leased, pending, available — alongside the
`http.client.requests` timer, and know which stack frame the lease call is.

**⚠️ A readiness probe that fails when a dependency is slow**
**Symptom:** instances drop out of the load balancer during a downstream
slowdown, concentrating load on those remaining and accelerating the collapse.
**Cause:** the probe checks the dependency rather than the instance.
**Fix:** readiness answers "can this instance serve traffic"; a dependency's
health belongs in a separate, non-probe indicator that alerts without removing
capacity.

**⚠️ Raising the timeout during the incident**
**Symptom:** the change is made, the incident gets worse, and the looser value is
still in the configuration a year later.
**Cause:** waiting longer for a saturated dependency increases the number of
in-flight requests holding resources.
**Fix:** in a saturation incident, timeouts come *down*, not up. Shedding load is
what lets the dependency recover.

**⚠️ Testing resilience against a dependency that is *down***
**Symptom:** the chaos test passes and the real incident — a dependency that is
slow — still takes the service out.
**Cause:** a refused connection fails in milliseconds and exercises none of the
mechanisms above. Slowness is the hard case.
**Fix:** test against a stub that *delays*, not one that refuses. That is one of
the better arguments for a programmable stub server over a purely in-process
mock, which [chunk 18](18-testing-the-failures.md) makes.

**⚠️ A shared client used "to save connections"**
**Symptom:** an outage in a non-critical dependency degrades a critical path that
does not call it.
**Cause:** a single client, and therefore a single pool, shared across
dependencies.
**Fix:** one client per downstream service. Connections are cheap compared with
the coupling.

## Interview questions

**★ Walk me through how one slow dependency takes down a whole service.**
The dependency degrades but keeps accepting connections, so nothing trips a
connect timeout. Each in-flight request now holds its pooled connection for the
degraded duration, and if there is no read timeout — or it is far too generous —
that duration is long. The per-route pool exhausts. Every subsequent caller
blocks acquiring a connection, and on most configurations that wait is unbounded
because the connection-request timeout was never set. The service's own
request-handling capacity fills with callers waiting for a connection, health
checks fail, the service starts erroring, and its callers retry, which adds load.
The thing worth noticing is that most of your threads are parked in the pool
lease, not in a socket read, so the thread dump looks nothing like "downstream is
slow" unless you know to look for it.

**★ Why did virtual threads make connection-pool sizing more important rather
than less?**
Because the bounded request-handling thread pool used to be an accidental
admission control. With 200 platform threads you could not have more than 200
outbound calls in flight, so the pool was never asked for more than that. Virtual
threads remove that ceiling: the container will run tens of thousands of
concurrent requests, so tens of thousands of callers can queue behind five
connections. Nothing crashes — the queue just grows and everybody waits. So the
concurrency limit that used to exist by accident now has to be created on
purpose, either by sizing the pool with a bounded acquisition timeout or by an
explicit limiter such as Framework 7's `@ConcurrencyLimit`, which the resilience
documentation calls out as being particularly useful precisely because virtual
threads have no pool limit.

**★ Why is a bounded connection-acquisition timeout better than an unbounded
wait, when both end in the request being slow?**
Because they do not end the same way. An unbounded wait consumes the caller's
entire budget and then may still fail, so you have paid the full cost and got
nothing; and while it waits it holds whatever the caller is holding — a database
transaction, a lock, an in-flight HTTP response of your own. A bounded
acquisition that fails in 50 ms leaves the caller with time to do something else:
serve a cached value, return a degraded response, or fail fast with a 503 and a
`Retry-After` so the client backs off. Fast failure is a resource-management
decision, not a worse outcome.

**★ During an incident a dependency is responding slowly. Someone proposes
raising the read timeout. What do you say?**
That it will make things worse, and explain the mechanism rather than just
objecting. Raising the timeout increases how long each in-flight request holds a
connection and a thread, which increases the number of concurrent requests
waiting, which deepens the queue behind the connection pool. The dependency is
not going to answer faster because you are more patient. The moves that help are
the opposite ones: bring timeouts down so connections cycle, shed load so the
dependency gets less traffic and has a chance to recover, and serve degraded
responses where the product allows it. Raising a timeout is a reasonable *design*
change made calmly when a dependency is legitimately slow; it is close to always
the wrong *incident* action.

**★ What is a bulkhead in this context, and how do you implement one in Spring?**
It is the practice of isolating resources so that one dependency's failure cannot
consume what another needs — named after ship compartments that stop one breach
sinking the vessel. In practice it is mostly implemented by *not sharing*: one
`RestClient` per downstream service, so each has its own connection pool and its
own timeouts, rather than one shared client whose pool is a common resource. On
top of that you can bound concurrency explicitly with Framework 7's
`@ConcurrencyLimit` on the gateway method for a dependency, which caps how many
threads can be inside that call at once. The reason the second one has become
more necessary is virtual threads: the bounded request thread pool used to
provide a crude bulkhead for free, and it no longer does.

**★ Why is a slow dependency harder to survive than a dependency that is down?**
Because down fails fast and slow does not. A refused connection or a DNS failure
trips the connect timeout in milliseconds, so the request fails cheaply, nothing
accumulates, and a circuit breaker has a clean signal to open on. A slow
dependency completes the handshake normally and then holds every resource the
request needs — connection, thread, whatever the handler is holding — for as long
as your timeouts allow. Nothing looks like an error until the queues are already
deep. It is also the case that most resilience testing exercises the easy version:
if your chaos experiment kills the dependency rather than delaying it, it is
validating the failure mode you would have survived anyway.

**★ Where would you put the concurrency limit for calls to a particular
dependency — the connection pool or the application?**
Both, and they answer different questions. The pool bounds how many connections
exist to that host, which is a resource question, and it must have a bounded
acquisition timeout or exhaustion turns into an unbounded queue. An application
limit such as `@ConcurrencyLimit` bounds how many threads are inside the call,
which is a policy question, and it fails at a boundary you control with an
exception you can map to a sensible response. If I had to choose one I would take
the application limit, because it produces a clean, attributable failure instead
of a queue inside a library — but the honest answer is that a pool without an
acquisition timeout is broken regardless of what else you add.

---

← Prev: [The pool is the real limit](09-the-pool-is-the-real-limit.md) · Index: [Phase 9 — Spring Boot and the web](../README.md) · Next → [Deadlines, not timeouts](11-deadlines-not-timeouts.md)
