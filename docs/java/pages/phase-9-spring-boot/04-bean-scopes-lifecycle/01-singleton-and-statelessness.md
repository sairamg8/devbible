---
title: "Singleton by default, therefore stateless"
sidebar_label: "1 · Singleton and statelessness"
sidebar_position: 1
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-19 against the Spring Framework reference — *Bean Scopes*
> and *The Singleton Scope*
> (docs.spring.io/spring-framework/reference/core/beans/factory-scopes.html —
> the six built-in scopes, "only one shared instance of a singleton bean is
> managed", and the per-container-per-bean framing that distinguishes it from
> the Gang of Four pattern). Spring Boot 4.1.1, Spring Framework 7.0.x, JDK 25.

**Every `@Service`, `@Repository` and `@RestController` you write is, by
default, exactly one object for the life of the application — and that one
object is executing on every request thread at the same time. The single most
consequential fact in Spring is not that beans are singletons; it is what
follows from it: **a field on a Spring bean is shared mutable state across all
concurrent requests unless it is final and immutable.** Most Spring
concurrency bugs are one instance variable that somebody thought was per-request.**

## The six scopes, and how rarely you leave the first

| Scope | One instance per | Web-only? |
|---|---|---|
| `singleton` *(default)* | container, per bean definition | no |
| `prototype` | request for the bean — a new one every time | no |
| `request` | HTTP request | yes |
| `session` | HTTP session | yes |
| `application` | `ServletContext` | yes |
| `websocket` | WebSocket lifecycle | yes |

In a normal service, essentially everything is `singleton`. The other five are
covered in [the next chunk](02-prototype-and-the-trap.md); this one is about why the
default is what it is and what it obliges you to do.

## "Singleton" does not mean the Gang of Four singleton

The docs are careful about this and it is worth being careful too:

> *"The scope of the Spring singleton is best described as being per-container
> and per-bean."*

The GoF singleton is one instance **per classloader**, enforced by the class
itself through a private constructor and a static accessor. A Spring singleton
is one instance **per bean definition, per `ApplicationContext`** — the class
has an ordinary public constructor, nothing prevents you making ten of them
with `new`, and two application contexts in the same JVM each get their own.

That difference is not pedantry. It is why:

- the same class can be registered twice under different names with different
  configuration, and both are "singletons";
- a `@SpringBootTest` in the same JVM as another one gets a *different*
  instance, because it is a different context;
- you can still write `new InvoiceService(stub, repo)` in a unit test — which
  is chunk 1 of **[Topic 03 — Dependency injection](../03-dependency-injection/README.md)**, and
  would be impossible with a GoF singleton.

## What "shared across every request" actually means

The servlet container hands each incoming request to a thread — a platform
thread from a pool, or a virtual thread if you have enabled them
([platform vs virtual threads](../../phase-6-concurrency/02-platform-vs-virtual-threads/README.md)).
All of those threads call methods on **the same** controller instance and the
same service instance beneath it.

So this class is a data race waiting for a second concurrent request:

```java
@Service
public class InvoiceService {

    private Invoice current;                        // ← shared by every thread

    public Invoice raise(OrderId id) {
        this.current = new Invoice(id);             // thread A writes
        this.current.addLines(lookupLines(id));     // thread B overwrote it
        return this.current;                        // A returns B's invoice
    }
}
```

Nothing here looks like concurrent code, there is no `Thread` anywhere, and it
will pass every test that issues one request at a time. Under load it returns
one customer's invoice to another customer — a data-leak bug, not merely a
wrong-answer bug ([race conditions](../../phase-6-concurrency/03-race-conditions/README.md)).

The fix is not `synchronized`, which would serialise the whole service. The fix
is that `current` should never have been a field:

```java
@Service
public class InvoiceService {

    private final InvoiceRepository repository;      // final, shared, safe

    public InvoiceService(InvoiceRepository repository) {
        this.repository = repository;
    }

    public Invoice raise(OrderId id) {
        Invoice invoice = new Invoice(id);           // a local — per call, per thread
        invoice.addLines(lookupLines(id));
        return invoice;
    }
}
```

**Locals are per-invocation and therefore per-thread. Fields are per-instance
and therefore shared.** That sentence is the whole discipline.

## The rule, stated so it can be applied in review

A field on a singleton bean is acceptable when it is:

1. `final`, **and**
2. either immutable, or a thread-safe object designed to be shared.

Category 2 covers most of what a service holds: other Spring beans (themselves
stateless), a `DataSource`, a `RestClient`, a `MeterRegistry`, a `Clock`, a
`ConcurrentHashMap` used as a cache, an `AtomicLong` counter. These are built to
be called from many threads.

What is *not* acceptable: a mutable domain object, a `SimpleDateFormat`, a
non-thread-safe builder, an `ArrayList` accumulating results, a "current user"
or "current tenant", a `StringBuilder`, or anything holding per-request context.

`final` matters here beyond preventing reassignment. A final field assigned in
the constructor carries the memory model's freeze guarantee, so every thread
that sees the bean sees the field fully initialised without synchronisation
([the Java memory model](../../phase-6-concurrency/05-java-memory-model/README.md)).
This is the concrete, load-bearing reason constructor injection is preferred —
field injection cannot use `final` at all.

## Where per-request state actually goes

Three legitimate homes, in order of preference:

1. **A method parameter or a local.** Almost always the right answer, and the
   one that requires no framework knowledge to understand.
2. **A `request`-scoped bean.** Real, supported, and covered in the next chunk —
   but it needs a scoped proxy to be injectable into a singleton, which is
   machinery to justify.
3. **A `ScopedValue` or `ThreadLocal`.** For genuinely cross-cutting context —
   trace id, tenant, principal — that would otherwise be threaded through every
   signature. `ScopedValue` (final in JDK 25) is the modern form and is far
   better behaved than `ThreadLocal` with virtual threads
   ([`ThreadLocal` and `ScopedValue`](../../phase-6-concurrency/12-threadlocal-scopedvalue/README.md)).
   ⚠️ A `ThreadLocal` on a pooled platform thread that is never cleared leaks
   into the next request that reuses that thread, which is the same class of
   data-leak bug as the mutable field.

## The trade-off

One instance is a real choice, not a free win.

- **You cannot hold per-instance configuration.** If two parts of the system
  need the same service configured differently, one singleton cannot do it —
  you need two bean definitions with different names, and consumers must
  qualify between them.
- **State that genuinely belongs to the bean is awkward.** A rate limiter or a
  circuit breaker is legitimately stateful; it just has to be *thread-safe*
  stateful, which means atomics and concurrent collections rather than plain
  fields.
- **What you get in exchange** is that construction happens once, injected
  references are plain final fields, and the framework does no work per request
  to give you a service. That is why it is the default and why leaving it should
  be a decision you can justify.

## Gotchas

**Symptom:** under load, a response occasionally contains another user's data
**Cause:** per-request state was kept in an instance field of a singleton bean, so
concurrent threads overwrite each other between the write and the read
**Fix:** make it a local variable. If it must outlive the method, pass it as a
parameter; the field was never the right place

**Symptom:** a `SimpleDateFormat` or non-thread-safe formatter field produces garbled
or wrong values only in production
**Cause:** the formatter is mutable and shared across request threads; low-traffic
environments simply never interleave
**Fix:** use `java.time`'s `DateTimeFormatter`, which is immutable and thread-safe, and
keep it `static final`

**Symptom:** adding `synchronized` to a service method fixes the corruption and the
endpoint's throughput collapses
**Cause:** the whole service is one object, so one lock serialises every request through
it — the state was the problem, not the absence of a lock
**Fix:** remove the field instead. Locks are for state that genuinely must be shared,
and per-request data is not that

**Symptom:** two `@SpringBootTest` classes in the same JVM see different instances of
what "should be a singleton"
**Cause:** singleton means per-container, not per-JVM — different contexts have
different beans, and the test framework caches contexts by configuration
**Fix:** nothing to fix; this is the documented semantics. If a test depends on sharing,
make the two tests share a context configuration so the cache returns the same one

**Symptom:** a `ThreadLocal` holding tenant context returns the wrong tenant intermittently
**Cause:** the value was set on a pooled platform thread and never cleared, so the next
request served by that thread inherits it
**Fix:** clear it in a `finally`, or move to `ScopedValue`, which is scoped to a
bounded execution rather than to the thread's lifetime

**Symptom:** a counter field on a service reports numbers that are too low
**Cause:** `count++` is read-modify-write and is not atomic; concurrent increments are
lost
**Fix:** `private final AtomicLong count = new AtomicLong();` — or better, a
`MeterRegistry` counter, since this is metrics and there is infrastructure for it

## Interview questions

**★ What is the default scope of a Spring bean, and what is the single most important consequence?**
`singleton` — one instance per bean definition per application context. The
consequence is that the one instance serves every concurrent request
simultaneously, so any mutable instance field is shared mutable state across
threads. This is why the standard advice is that Spring beans should be
stateless: not as a style preference, but because a field holding per-request
data is a data race that leaks one user's data into another user's response.

**★ How does a Spring singleton differ from the classic singleton pattern?**
The docs describe Spring's as *per-container and per-bean* rather than per
classloader. The class keeps an ordinary public constructor — nothing stops you
calling `new` on it — the container simply manages one instance for that bean
definition, and a second `ApplicationContext` in the same JVM has its own. That
is what makes the class unit-testable with `new` and what allows the same class
to be registered twice under different names with different configuration.

**★ Which fields are safe on a singleton bean?**
Ones that are `final` and either immutable or explicitly thread-safe. That covers
almost everything a service legitimately holds: other beans, a `DataSource`, a
`RestClient`, a `Clock`, a `DateTimeFormatter`, a `ConcurrentHashMap`, an
`AtomicLong`. What is unsafe is anything mutable and not designed for sharing —
a domain object under construction, a `SimpleDateFormat`, an accumulating list,
or any "current" anything.

**★ A colleague fixes intermittent data corruption by making the service method `synchronized`. What do you say?**
That it works and it is the wrong fix. The bean is one object, so the lock
serialises every request through that method and throughput collapses under the
load that exposed the bug in the first place. The real finding is that
per-request data was stored in an instance field; moving it to a local removes
both the race and the need for a lock, because locals are per-invocation and
therefore per-thread.

**★ Where should genuinely per-request state live?**
A local or a method parameter first — it needs no framework knowledge and cannot
leak. When the value is cross-cutting enough that threading it through every
signature is unreasonable, the options are a `request`-scoped bean injected via
a scoped proxy, or a `ScopedValue` (final in JDK 25) which binds a value for a
bounded execution. `ThreadLocal` is the legacy form and carries a real hazard:
on a pooled platform thread, a value never cleared is inherited by the next
request that reuses the thread.

**★ Why does `final` on an injected field matter here specifically, beyond stopping reassignment?**
Because of the final-field freeze guarantee in the memory model: a final field
assigned in the constructor is visible, fully initialised, to any thread that
obtains a reference to the safely-constructed object, with no synchronisation
needed. A Spring bean is by definition referenced from many threads at once, so
that guarantee is doing real work. It is also the concrete reason constructor
injection is preferred over field injection — reflection-assigned fields cannot
be `final`, so the guarantee is simply unavailable.

---

← Index: [Phase 9 — Spring Boot and the web](../README.md) · Next → [Prototype scope and the singleton trap](02-prototype-and-the-trap.md)
