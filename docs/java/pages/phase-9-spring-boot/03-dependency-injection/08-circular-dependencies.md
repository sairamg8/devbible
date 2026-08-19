---
title: "Circular dependencies, and why the failure is the feature"
sidebar_label: "8 · Circular dependencies"
sidebar_position: 8
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-19 against the Spring Framework reference —
> *Constructor-based or setter-based DI*
> (docs.spring.io/spring-framework/reference/core/beans/dependencies/factory-collaborators.html
> — `BeanCurrentlyInCreationException`, the two workarounds the docs list, and
> the statement that configuring circular dependencies with setter injection is
> "not recommended") and the **Spring Boot 2.6 release notes**
> (github.com/spring-projects/spring-boot/wiki/Spring-Boot-2.6-Release-Notes —
> circular references prohibited by default, and `spring.main.allow-circular-references`
> restoring the 2.5 behaviour). That default has stood ever since and is the
> behaviour in Boot 4.1. Spring Boot 4.1.0, Spring Framework 7.0.x, JDK 25.

**A circular dependency is not a container limitation you work around. It is a
statement about your object graph — A cannot exist before B and B cannot exist
before A — and with constructor injection it is a genuine logical impossibility,
not a policy. The container is not refusing to do something it could do; there
is no order in which those two constructors can run. Every "fix" that makes the
error go away works by introducing a moment when one of the objects exists in a
half-built state, which is the guarantee chunk 2 spent its length establishing.**

## Why constructor injection makes it impossible rather than discouraged

```java
@Service
class OrderService {
    OrderService(InvoiceService invoices) { }     // needs InvoiceService first
}

@Service
class InvoiceService {
    InvoiceService(OrderService orders) { }       // needs OrderService first
}
```

To call `new OrderService(...)` you need an `InvoiceService`. To call
`new InvoiceService(...)` you need an `OrderService`. There is no first step.
Write it by hand in a `main` method with no framework anywhere and you will hit
the same wall — which is the cleanest way to see that this is not Spring's rule.

The container detects it and throws `BeanCurrentlyInCreationException`: it began
creating A, was asked for B while A was still under construction, began creating
B, and was asked for A again.

## Why setter and field injection *can* do it, and what that costs

With setters or fields there is a first step, because construction and wiring
are separate phases:

1. `new OrderService()` — fields null.
2. `new InvoiceService()` — fields null.
3. Set `orderService.invoices = invoiceService`.
4. Set `invoiceService.orders = orderService`.

It works. What it costs is precisely the guarantee you gave up to get it:
**between steps 1 and 3 there exists an `OrderService` whose collaborator is
null.** Ordinarily nobody observes that window — but `@PostConstruct` runs
inside it for one of the two beans, and any bean that does real work during
initialisation can observe a half-built peer. That is the class of bug this
whole arrangement is designed to make impossible.

The reference documentation lists the workarounds without enthusiasm — *"edit
the source code of some classes to be configured by setters rather than
constructors"*, *"avoid constructor injection and use setter injection only"* —
and then states plainly: *"Although it is not recommended, you can configure
circular dependencies with setter injection."*

## Spring Boot's default: prohibited

Since **Spring Boot 2.6**, circular references are **prohibited by default**,
and that remains the behaviour through Boot 4.1. From the 2.6 release notes:
circular references between beans are now prohibited by default, and if the
application fails to start with a `BeanCurrentlyInCreationException` you are
*"strongly encouraged to update your configuration to break the dependency
cycle."*

The escape hatch exists and is named:

```yaml
spring:
  main:
    allow-circular-references: true   # restores Spring Boot 2.5 behaviour
```

or `SpringApplication.setAllowCircularReferences(true)` /
`SpringApplicationBuilder.allowCircularReferences(true)`.

**Treat this property as a migration aid with an expiry date, not a setting.**
It is the right lever when you inherit a large application and need it booting
today; it is the wrong lever when a cycle appears in code you are writing this
afternoon, because it disables the check globally — including for the next cycle
nobody has noticed yet.

## `@Lazy` — the workaround that is not a fix

```java
@Service
class OrderService {
    OrderService(@Lazy InvoiceService invoices) { }   // injects a proxy
}
```

`@Lazy` on the injection point makes Spring inject a proxy that resolves the
real bean on first method call, so the constructor completes without needing the
real `InvoiceService`. The cycle in the *construction order* is broken; the
cycle in the *design* is untouched.

It is worth being precise about what it costs, since "it works" is doing a lot
of heavy lifting in most codebases that use it:

- A proxy now sits in the call path, so stack traces gain frames and the
  injected reference is not the bean you think it is when debugging.
- The failure you avoided at startup moves to first use, which is the exact
  trade lazy initialisation makes and the reason it is not the default.
- The design problem is now invisible. Nothing in the code says "these two
  services are mutually dependent"; there is one annotation that reads like a
  performance hint.

## Gotchas

**Symptom:** the application fails at startup with `BeanCurrentlyInCreationException`
after a routine refactor
**Cause:** two beans now require each other in their constructors, so no construction
order exists; Boot has prohibited this by default since 2.6
**Fix:** break the cycle — the moves are in [the next chunk](09-breaking-the-cycle.md).
Setting `spring.main.allow-circular-references=true` makes the message go away and
leaves the design untouched

**Symptom:** `spring.main.allow-circular-references=true` is set in the base
`application.yml` and nobody remembers why
**Cause:** it was added during a Boot 2.5→2.6 upgrade as a migration aid and never
removed, so cycle detection is now off for the whole application
**Fix:** remove it and fix whatever fails; if the backlog is large, remove it and add
the cycles to the list rather than leaving the check disabled indefinitely

**Symptom:** a `@Lazy` cycle "works" until an unrelated change, then produces a
`NullPointerException` or an odd proxy-related failure at first request
**Cause:** the cycle was never resolved, only deferred — the failure moved from
startup to first use, and the injected reference is a proxy, not the bean
**Fix:** treat the original startup error as the real report and fix the graph;
`ObjectProvider` is the honest deferral if an edge genuinely must be late

**Symptom:** a cycle is broken with setter injection and now a `@PostConstruct` method
sees a null collaborator
**Cause:** with setter/field injection there is a window in which one of the two beans
is constructed but not yet wired, and one bean's initialisation callback necessarily
runs inside that window
**Fix:** this is the cost of the workaround, not a separate bug. Break the cycle
properly; if you cannot yet, move the work out of `@PostConstruct` to an
`ApplicationRunner`, which runs after the whole context is up

**Symptom:** the cycle only appears when a particular profile is active
**Cause:** the extra edge comes from a bean that only exists under that profile, so
the graph is genuinely different there
**Fix:** the same fixes apply, but verify under that profile — and treat it as a sign
that profile-conditional beans are participating in core wiring, which is worth
questioning on its own

## Interview questions

**★ Why does constructor injection turn a circular dependency into a hard failure?**
Because it is a hard failure. To construct A you need B, to construct B you need
A, so there is no valid order — you would hit the same wall writing the
composition root by hand in plain Java with no framework present. The container
reports it as `BeanCurrentlyInCreationException`: it started creating A, was
asked for B, started creating B, and was asked for A again. Setter and field
injection can complete the cycle only because they separate construction from
wiring, which means accepting a window where one object exists half-built.

**★ Is the failure a Spring limitation?**
No, and that is the point worth making in an interview. Spring is not declining
to do something it could do; there is no ordering of two mutually-dependent
constructors. What Spring *chose* is to prohibit the setter-injection workaround
by default — Boot has done that since 2.6 — because tolerating the cycle means
tolerating a bean that can be observed before it is fully wired.

**★ What does `spring.main.allow-circular-references=true` actually do, and when is it acceptable?**
It restores the pre-2.6 behaviour in which Spring will resolve cycles through
setter/field injection instead of failing. It is acceptable as a time-boxed
migration aid — you inherit a large application, you need it booting, you plan
the fixes. It is not acceptable as a standing setting, because it disables
detection globally, including for cycles nobody has noticed yet. The release
notes' own framing is that you are "strongly encouraged" to break the cycle
instead.

**★ Does `@Lazy` fix a circular dependency?**
It makes it start. `@Lazy` on the injection point injects a proxy that resolves
the real bean on first method call, so the constructor completes; the design
cycle is entirely intact. The costs are that a proxy now sits in the call path
so traces get taller and the injected object is not the bean you are looking at,
that the failure moves from startup to first use, and — worst — that the
annotation reads like a performance hint, so the mutual dependency becomes
invisible to the next reader.

**★ Does a cycle have to be between exactly two beans?**
No — the ring can be any length, and longer ones are the harder version of the
problem. A → B → C → D → A fails for the identical reason: there is no
construction order, because every bean in the ring transitively requires itself.
A bean can also depend on itself directly, which is the degenerate one-element
case. Length matters in practice because a two-bean cycle is usually obvious to
the people who wrote it, whereas a five-bean ring typically crosses package or
team boundaries and no single author sees it — which is exactly why the report
lists the whole ring rather than just the pair that happened to collide.

**★ What exactly is lost by allowing a cycle through setter injection?**
The guarantee that a bean handed to anyone is fully initialised. The sequence
must be: construct A with nulls, construct B with nulls, wire A, wire B — so
between the first and third steps an `OrderService` exists whose collaborator is
null. Usually nobody looks into that window, but one of the two beans'
`@PostConstruct` necessarily runs inside it, and any initialisation that touches
the peer can observe it half-built. That is the class of bug the whole
arrangement exists to make impossible.

---

← Prev: [Optional, plural and deferred](07-optional-and-deferred.md) · Index: [Phase 9 — Spring Boot and the web](../README.md) · Next → [Breaking the cycle](09-breaking-the-cycle.md)
