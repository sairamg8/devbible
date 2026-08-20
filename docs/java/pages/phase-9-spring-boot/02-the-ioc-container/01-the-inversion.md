---
title: "The inversion"
sidebar_label: "1 · The inversion"
sidebar_position: 1
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-19 against the Spring Framework 7.0 reference *The IoC
> Container → Introduction to the Spring IoC Container and Beans*
> (docs.spring.io/spring-framework/reference/core/beans/introduction.html — the
> definition of a bean, dependency injection as a specialisation of IoC), and
> *Bean Overview* (docs.spring.io/spring-framework/reference/core/beans/definition.html).
> Spring Boot 4.1.0, Spring Framework 7.0.x, JDK 25.

**A bean is not a special kind of object. It is an ordinary Java object that
somebody else constructed. That is the entire inversion, and everything else in
Spring is machinery for making it practical: the container reads a description
of what objects should exist and how they depend on each other, builds the
whole graph in the right order, and hands you references. Your classes never
name their collaborators' concrete types, never decide when to construct them,
and never manage their lifetimes — which is why they can be unit-tested without
a framework at all, and that testability, not the annotations, is the actual
product.**

## The problem it solves, stated without jargon

Write a service layer without a container and the wiring shows up as
constructor calls scattered through the code:

```java
public class OrderController {
    private final OrderService service =
        new OrderService(
            new JdbcOrderRepository(
                new HikariDataSource(loadConfigSomehow())),   // ⚠️
            new SmtpEmailSender("smtp.example.com", 587),
            new StripeClient(System.getenv("STRIPE_KEY")));
}
```

Four things are wrong with that, and only the first is obvious.

1. **`OrderController` now depends on everything transitively.** It names
   `HikariDataSource` and `StripeClient` — classes it has no business knowing —
   so it cannot compile without them and cannot be tested without a real
   database and a payment provider.
2. **Lifetime is implicit and wrong.** Each `OrderController` builds its own
   connection pool. Nothing shares, nothing is closed.
3. **Configuration leaks upward.** The SMTP host and port are literals in a web
   class, so changing environments means changing code.
4. **Substitution is impossible.** There is no seam. You cannot put a fake
   `EmailSender` in without editing `OrderController`.

Hand-rolling a fix produces a factory class, then a registry, then something
that reads configuration and decides what to build — and at that point you have
written a worse IoC container. That is not hypothetical; it is what every large
pre-Spring Java codebase actually contained.

## The inversion itself

The container's version:

```java
@Service
public class OrderService {
    private final OrderRepository repo;
    private final EmailSender email;

    OrderService(OrderRepository repo, EmailSender email) {   // ✅ asks, does not build
        this.repo = repo;
        this.email = email;
    }
}
```

`OrderService` declares *what it needs*, as interfaces, and is given them. It
does not know which implementation arrives, when it was created, or whether it
is shared. **Control over construction has been inverted** — from the object
that needs a collaborator, to a third party that knows the whole graph.

The reference documentation is precise about the relationship between the two
terms: **dependency injection is a specialisation of inversion of control**.
IoC is the general idea that something else drives the flow; DI is the specific
mechanism where dependencies arrive through constructor arguments, factory
method arguments, or properties set after construction. The alternative form of
IoC — the object asking a registry for what it needs — is the Service Locator
pattern, and Spring deliberately does not encourage it.

Note what the class above is *not*: it is not annotated on its constructor, it
does not extend a framework base class, and it imports nothing from
`org.springframework` except the `@Service` stereotype — which you could remove
and replace with a `@Bean` method elsewhere. **A Spring bean is a POJO.** That
is a design goal Spring has held since 2003, and it is why this class can be
instantiated in a test with `new OrderService(fakeRepo, fakeEmail)` and needs
no Spring at all.

## Why a Spring codebase looks the way it does

Three ubiquitous conventions fall directly out of what has been said so far,
and none of them is arbitrary style:

- **Fields are `final` and set in the constructor.** The container supplies
  collaborators at construction time, so there is no reason for them to be
  mutable — and `final` makes the object safely publishable to other threads
  under the Java Memory Model, which matters because beans are shared. The
  mechanism is
  [Phase 6 · The Java Memory Model](../../phase-6-concurrency/05-java-memory-model/README.md).
- **Beans are stateless singletons.** One instance serves every concurrent
  request — the servlet lifecycle from
  [topic 01](../01-why-frameworks-servlet-model/01-the-servlet-contract.md) —
  so mutable instance state is a race condition with extra steps.
- **Dependencies are declared as interfaces.** Not because interfaces are
  intrinsically virtuous, but because the substitution seam is the entire point
  of the inversion, and a concrete type has no seam. This is
  [Phase 2 · Abstract classes vs interfaces](../../phase-2-classes-objects/05-abstract-vs-interfaces/README.md)
  applied at architectural scale.

## Where the inversion stops being worth it

It is not free, and pretending otherwise is how people get hurt by it.

**You lose compile-time verification of the object graph.** `new
OrderService(repo, email)` fails to compile if the arguments are wrong. A
missing bean fails at *startup* instead — better than at runtime, far worse than
at compile time. This is the single largest cost of the whole approach, and the
reason Spring invests so heavily in readable startup failures.

**You gain a layer of indirection to debug through.** A stack trace through
proxied, container-constructed objects is longer and less obvious than one
through code you wrote. When something is not injected, the answer is never in
the class you are looking at.

The trade is clearly worth it for an application with a real object graph and a
real configuration surface. It is *not* obviously worth it for a small program
with five collaborators, and "we used Spring because it is what we use" is a
bad reason. The rest of the costs — startup time, proxying, and what they mean
for native images — are in [chunk 2](02-the-container-and-metadata.md).

## Gotchas

### Field injection, and why reviewers reject it

**Symptom.** A class with `@Autowired` on its fields cannot be constructed in a
test without reflection, and its dependency list is invisible in its signature.

**Cause.** Field injection happens after construction, so there is no
constructor that expresses what the class needs, the fields cannot be `final`,
and nothing prevents the class from growing to fifteen dependencies unnoticed.

**Fix.** Constructor injection, which is the default and needs no annotation at
all when there is a single constructor:

```java
@Service
public class OrderService {
    private final OrderRepository repo;          // ✅ final

    OrderService(OrderRepository repo) {         // ✅ no @Autowired needed
        this.repo = repo;
    }
}
```

The full argument, including the circular-dependency consequences, is
**[Topic 03 — Dependency injection](../03-dependency-injection/README.md)**.

### Doing work in a constructor that the container calls

**Symptom.** Startup is slow, or fails with a confusing error from deep inside
bean creation, because a constructor opens a socket or runs a query.

**Cause.** The container calls your constructor during context refresh, before
the rest of the graph necessarily exists. A constructor that does I/O couples
object creation to external availability.

**Fix.** Constructors assign fields. Anything that touches the outside world
belongs in a lifecycle callback, where the graph is complete:

```java
@Service
class WarmCache {
    private final PriceClient client;
    private volatile Map<String, Price> prices = Map.of();

    WarmCache(PriceClient client) { this.client = client; }   // ✅ assignment only

    @PostConstruct
    void warm() { this.prices = client.fetchAll(); }          // ✅ after wiring
}
```

Lifecycle callbacks are **[Topic 04 — Bean scopes and lifecycle](../04-bean-scopes-lifecycle/README.md)**
.

### Assuming the inversion means "no `new` anywhere"

**Symptom.** Value objects, DTOs, records and domain entities get turned into
beans, and the context fills with things that have no business being singletons.

**Cause.** Over-applying the rule. The inversion is about *collaborators* —
long-lived objects with dependencies and behaviour. It says nothing about data.

**Fix.** Keep `new` for values and entities. An `Order`, a `Money`, a request
record are created with `new` (or a record constructor) thousands of times a
second and are not beans:

```java
public record Money(BigDecimal amount, Currency currency) {}   // ✅ never a bean

@Service
class Pricing {
    Money total(List<LineItem> items) {
        return items.stream()                                  // ✅ plain construction
                    .map(LineItem::subtotal)
                    .reduce(Money.zero(), Money::plus);
    }
}
```

## Interview questions

**★ What is Inversion of Control, and what specifically is inverted?**
Control over the construction and wiring of collaborators. Without it, an
object decides which implementations it uses and when to create them — it calls
`new`, or asks a factory or a service locator. With it, an object declares what
it needs and an external assembler supplies instances it never chose. The
Spring documentation frames dependency injection as a *specialisation* of IoC:
DI is the particular form where dependencies arrive via constructor arguments,
factory-method arguments, or properties set after construction. The payoff is
that the class no longer references concrete types, which is what makes
substitution — for tests, for environments, for alternate implementations —
possible without editing it.

**★ What is a Spring bean, exactly?**
An object that is instantiated, assembled and managed by the Spring IoC
container. There is nothing structurally special about the class: it does not
implement a framework interface or extend a base class, and the same class used
outside a container is an ordinary object. What makes it a bean is that a
`BeanDefinition` describes it and the container owns its construction and
lifecycle. That POJO property is deliberate and is what allows a service class
to be unit-tested with a plain `new` call and hand-built fakes — which is the
practical benefit people actually get from the framework.

**★ Why do Spring codebases use constructor injection with `final` fields as a convention?**
Because it makes the dependency set explicit and the object immutable once
built. Explicit, because the constructor signature is a compile-time-visible
list of everything the class needs — you cannot forget one, and a class with
eight constructor parameters is visibly doing too much, which field injection
hides. Immutable, because `final` fields assigned in the constructor are safely
published to other threads under the Java Memory Model, and that matters
precisely because a singleton bean is shared across concurrent requests. It
also means the class is usable without Spring at all, which is what makes fast
unit tests possible.

**★ Is dependency injection the same thing as inversion of control?**
No — DI is one way of achieving IoC, and the distinction is worth keeping
because the other way is a common mistake. IoC is the general principle that
something external drives the flow rather than your object. DI achieves it by
*pushing* dependencies in through constructors, factory methods or setters. The
Service Locator pattern achieves IoC too, by having the object *pull* what it
needs from a registry — which is what injecting `ApplicationContext` and
calling `getBean` amounts to. Both invert control, but only DI keeps the
dependency visible in the type signature, and that visibility is the entire
practical benefit.

**★ Does using Spring mean you should never write `new`?**
No, and treating it that way produces bad designs. The inversion applies to
*collaborators*: long-lived objects with behaviour and dependencies, of which
there are a bounded number and which benefit from substitution. It does not
apply to *values* — DTOs, records, domain entities, `Money`, an `Order` being
constructed to be saved. Those are created with `new` constantly and turning
them into beans is a category error that produces singletons where you needed
instances. The rule of thumb is that if you would ever want two of them at once
with different data, it is not a bean.

**★ What is the largest cost of moving object graph construction into a container?**
Losing compile-time verification of the graph. A hand-written `new` expression
with a wrong or missing argument does not compile; a missing or ambiguous bean
does not surface until the context refreshes at startup. Startup failure is far
better than a runtime failure and this is why Spring pre-instantiates singletons
eagerly — but it is strictly worse than a compiler error, and it is why Spring
puts so much effort into diagnostic messages naming the bean, the injection
point and the candidates it considered. The secondary cost is debugging through
proxies and container-built objects, where a stack trace no longer maps to code
you wrote.

---

← Index: [Phase 9 — Spring Boot and the web](../README.md) · Next → [The container and its metadata](02-the-container-and-metadata.md)
