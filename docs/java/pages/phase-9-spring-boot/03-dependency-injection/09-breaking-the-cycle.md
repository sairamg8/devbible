---
title: "Breaking the cycle"
sidebar_label: "9 · Breaking the cycle"
sidebar_position: 9
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-19 against the Spring Framework reference — *Constructor-based
> or setter-based DI*
> (docs.spring.io/spring-framework/reference/core/beans/dependencies/factory-collaborators.html
> — the workarounds the docs list and the "not recommended" framing) and *Using
> `@Autowired`*
> (docs.spring.io/spring-framework/reference/core/beans/annotation-config/autowired.html
> — `ApplicationEventPublisher` among the always-resolvable dependencies).
> Spring Boot 4.1.0, Spring Framework 7.0.x, JDK 25.

**The previous chunk argued that a cycle is a real statement about the graph, so
this one takes that seriously: if A and B genuinely cannot be ordered, the
question is not "how do I make the container tolerate it" but "which edge should
not exist". In practice the answer is one of three, and the first is right far
more often than the other two — a cycle almost always means a third class is
missing.**

## The actual fix: find the third thing

A cycle almost always means **the two classes are sharing a responsibility that
belongs to neither of them** — or that one of them is doing something for the
other that should be inverted. Two reliable moves:

### Extract the shared collaborator

```java
// before: OrderService <-> InvoiceService, because both need to price things

// after: the shared responsibility becomes its own bean
@Service class PricingService { }

@Service
class OrderService {
    OrderService(PricingService pricing, InvoiceService invoices) { }
}

@Service
class InvoiceService {
    InvoiceService(PricingService pricing) { }      // no longer needs OrderService
}
```

The graph becomes a DAG, both classes shrink, and the thing they were both
reaching for now has a name.

### Invert the direction with an event

When the dependency is *notification* rather than collaboration — "when an
invoice is raised, the order must be updated" — the callee should not know the
caller at all:

```java
@Service
class InvoiceService {
    private final ApplicationEventPublisher events;

    InvoiceService(ApplicationEventPublisher events) { this.events = events; }

    public void raise(OrderId id) {
        // ...
        events.publishEvent(new InvoiceRaised(id));     // no reference to OrderService
    }
}

@Service
class OrderService {
    @EventListener
    void onInvoiceRaised(InvoiceRaised e) { /* ... */ }
}
```

`ApplicationEventPublisher` is one of the always-resolvable dependencies from
[the previous chunk](07-optional-and-deferred.md), so this costs one constructor
parameter and removes an edge from the graph entirely.

### Or defer the edge honestly

If A genuinely needs B only occasionally, `ObjectProvider<B>` removes the
construction-time edge without a proxy and without a lie:

```java
OrderService(ObjectProvider<InvoiceService> invoices) { this.invoices = invoices; }
```

This is `@Lazy`'s honest sibling: the deferral is visible in the type, the
injected object is exactly what it appears to be, and a test supplies a stub
provider in one line.

## Reading the failure

When a cycle stops startup, Spring Boot prints a failure analysis that draws the
cycle as a list of beans with arrows from each to the next, and the cycle is
readable directly off that list. Two things are worth knowing about how to use it:

- **The bean named first is where detection began, not necessarily the culprit.**
  Detection starts wherever creation happened to start, so do not assume the
  first entry is the interesting one — read the whole ring and ask which edge
  should not exist.
- **The shortest edge to delete is rarely the one you were looking at.** The
  useful question is which of the beans in the ring is doing work that belongs
  to a third class, not which annotation is cheapest to add.

*(The exact rendering is produced by Boot's failure analyzers and this page does
not reproduce it, since no application was run to capture it.)*

## Gotchas

**Symptom:** the shared collaborator is extracted but the cycle remains
**Cause:** only part of the shared responsibility moved, so one of the original edges
survives — typically the callee still needs the caller for one method
**Fix:** look at what the surviving edge is used for. If it is notification, invert it
with an event; if it is one method, that method probably belongs to the extracted class
too

**Symptom:** an event is introduced to break the cycle and the listener now runs
inside the publisher's transaction, causing surprising rollback behaviour
**Cause:** `@EventListener` is synchronous by default — publishing does not hand off,
it calls the listener on the publishing thread
**Fix:** decide deliberately. Synchronous is often right; when it is not, use
`@TransactionalEventListener` to run after commit, or `@Async` to hand off, and accept
the delivery semantics that come with each

**Symptom:** two `@Configuration` classes reference each other and startup fails
**Cause:** configuration classes are beans, so `@Bean` methods needing each other's
products form the same ring
**Fix:** declare the needed bean as a *method parameter* on the `@Bean` method instead
of injecting the other `@Configuration` class:

```java
// instead of injecting OtherConfig, take the bean itself
@Bean
InvoiceService invoiceService(PricingService pricing) {   // parameter, not field
    return new InvoiceService(pricing);
}
```

**Symptom:** `ObjectProvider` is used to break the cycle and the code now calls
`getObject()` on every request in a hot path
**Cause:** the deferral is per-call by design, so resolution happens each time
**Fix:** that is usually fine — resolving a singleton is a map lookup — but if the
provider wraps a prototype, be sure per-call creation is what you meant

## Interview questions

**★ How do you actually break a cycle?**
Usually by finding the third class. A cycle nearly always means the two beans
share a responsibility that belongs to neither, so extracting it — a
`PricingService` both of them call — makes the graph a DAG and shrinks both
classes. The second move is inverting the direction when the relationship is
really notification: publish an `ApplicationEvent` and let the other side
`@EventListener` it, so the publisher holds no reference at all. The third, when
an edge is genuine but occasional, is `ObjectProvider<B>`, which defers
resolution visibly in the type rather than behind a proxy.

**★ `@Lazy` versus `ObjectProvider` for breaking a cycle — what is the difference?**
Both defer resolution; they differ in honesty and in what you hold. `@Lazy`
injects a proxy typed as the dependency, so the code reads exactly as if the
edge were immediate and the deferral is discoverable only from one annotation.
`ObjectProvider<B>` changes the field's type, so every reader sees that
resolution happens later, the object you hold is a real provider rather than a
stand-in for the bean, and a test can pass a stub provider without any proxying.
If an edge must be deferred, defer it in the type.

**★ When is an application event the right way to remove an edge, and when is it a mistake?**
It is right when the relationship is genuinely notification — "this happened,
whoever cares may react" — because then the publisher has no business knowing the
listener, and removing the reference is a modelling improvement, not a trick. It
is a mistake when the caller needs a *result*, because you have replaced a typed
method call with an untyped fire-and-forget and lost both the return value and
the compiler's knowledge that anyone is listening at all.

**★ Two `@Configuration` classes depend on each other's beans. Same problem?**
Yes — configuration classes are beans, and `@Bean` methods that take each
other's products form the same ring. The clean fix is usually available and
small: have the `@Bean` method declare the bean it needs as a *method parameter*
rather than injecting the other `@Configuration` class, which removes the
class-level edge and leaves only the real bean-level dependency the container
can order.

**★ How do you read Boot's cycle report, and what is the trap in it?**
It renders the ring as a list of beans with arrows from each to the next, so the
cycle itself is readable directly. The trap is assuming the first bean named is
the culprit — detection begins wherever bean creation happened to begin, so the
starting point is an artefact of ordering, not a diagnosis. Read the whole ring
and ask which edge should not exist, which is a design question the report
cannot answer for you.

---

← Prev: [Circular dependencies](08-circular-dependencies.md) · Index: [Phase 9 — Spring Boot and the web](../README.md)
