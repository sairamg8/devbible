---
title: "What dependency injection actually buys"
sidebar_label: "1 · What DI buys"
sidebar_position: 1
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-19 against the Spring Framework reference, *Dependency
> Injection* and *Constructor-based or setter-based DI*
> (docs.spring.io/spring-framework/reference/core/beans/dependencies/factory-collaborators.html
> — the Spring team's own recommendation, the "large number of constructor
> arguments is a bad code smell" note, and the setter-injection guidance).
> Spring Boot 4.1.1, Spring Framework 7.0.x, JDK 25.

**Dependency injection is not a Spring feature. It is a plain-Java design
constraint — *a class never constructs its own collaborators* — and Spring is
merely the thing that honours it at the one edge of the program where somebody
finally has to. The payoff is not "loose coupling" in the abstract. It is that
every class below that edge can be built with `new` in a test, by hand, in one
line, with no container, no annotations processed, and no framework on the test
classpath at all. If your test needs Spring to construct the class under test,
you did not get the benefit — you only got the annotations.**

## The constraint, stated without any framework

Here is a class that violates it:

```java
public class InvoiceService {

    private final PricingClient pricing = new PricingClient("https://pricing.internal");
    private final InvoiceRepository repository = new JdbcInvoiceRepository(DataSourceHolder.get());

    public Invoice raise(OrderId id) { /* ... */ }
}
```

Nothing here is *wrong* in the compiler's eyes. It is wrong in one specific,
measurable way: **there is no way to exercise `raise` without also reaching a
real HTTP endpoint and a real database.** The dependencies are welded in at the
point of use, so the only seam available to a test is the network.

The same class obeying the constraint:

```java
public class InvoiceService {

    private final PricingClient pricing;
    private final InvoiceRepository repository;

    public InvoiceService(PricingClient pricing, InvoiceRepository repository) {
        this.pricing = pricing;
        this.repository = repository;
    }

    public Invoice raise(OrderId id) { /* ... */ }
}
```

That is the whole of dependency injection. No annotation appears in either
version. The second one is testable with:

```java
var service = new InvoiceService(stubPricing, inMemoryRepository);
```

and that line is the entire argument.

## What "inversion of control" actually inverts

The name is older than Spring and it describes *who decides*. In the first
version, `InvoiceService` decides that pricing is reached over HTTP at a
particular URL. In the second, it decides nothing — it declares a *need* and
someone above it decides how that need is met.

That "someone above" is the interesting part, because the decision does not
vanish; it moves. Somebody still has to write `new PricingClient(...)`. What DI
buys is that the decision is made **once, in one place, at the top of the
program**, instead of being scattered through every class that happens to need
a collaborator.

Without a container you would write that place by hand:

```java
// the composition root — plain Java, no framework
var pricing    = new PricingClient(config.pricingUrl());
var repository = new JdbcInvoiceRepository(dataSource);
var invoices   = new InvoiceService(pricing, repository);
var controller = new InvoiceController(invoices);
```

This works, and for a small program it is genuinely the right answer. It stops
being the right answer at about the point where the graph is two hundred nodes
deep, the order is load-bearing, and half the nodes want the same
`DataSource` instance. Then you want something that reads the declarations and
does the topological sort for you. **That is the container's entire job**, and
it is covered in **[Topic 02 — The IoC container](../02-the-ioc-container/README.md)**.

## The object graph is assembled at exactly one edge

Picture the program as a graph. Controllers depend on services, services on
repositories and clients, those on a `DataSource` and an HTTP client, that on
configuration. Every arrow points down.

The container walks that graph once, at startup, bottom-up. After it finishes,
**every reference in the running program is already resolved** — there is no
lookup at request time, no service locator, no `ApplicationContext.getBean()`
in your business code. A `@Service` holding a `final` field is just an object
holding a reference, and calling through it costs exactly what a virtual call
costs on the JVM ([dispatch](../../phase-2-classes-objects/04-polymorphism-dispatch/README.md)).

Two consequences follow immediately, and they are the practical ones:

- **Wiring mistakes are startup failures, not runtime failures.** A missing or
  ambiguous dependency stops the process at boot with a message naming the
  injection point. It cannot get to production and then fail on a Tuesday when
  a rarely-used code path is finally hit. This is the single most valuable
  property of the whole arrangement and topic 04 spends a chunk on the case
  where people deliberately throw it away.
- **The graph is a design document.** If `InvoiceService`'s constructor takes
  nine things, that is not a wiring problem, it is a design problem the wiring
  made visible. The reference documentation says so directly: *"a large number
  of constructor arguments is a bad code smell, implying that the class likely
  has too many responsibilities and should be refactored."*

## The three ways Spring can inject, in one table

| | Mandatory? | `final` possible? | Testable with `new`? | Container needed to construct? |
|---|---|---|---|---|
| **Constructor** | enforced by the compiler | ✅ | ✅ | no |
| **Setter** | only if `@Autowired` is on the setter | ❌ | ✅ (verbosely) | no |
| **Field** | enforced only at startup | ❌ | ❌ — needs reflection | effectively yes |

The rest of this topic is that table argued out. Chunk 2 makes the case for the
first row, chunk 3 makes the case against the third, and the last column is why
the argument is not a matter of taste.

## The trade-off, stated honestly

DI is not free, and pretending it is makes people suspicious of the parts that
matter.

- **You lose "jump to the implementation".** In the welded version, `PricingClient`
  is named in the file. In the injected version the field is typed
  `PricingClient` but *which* instance — which base URL, which timeouts, which
  decorating proxy — is decided somewhere you cannot see from here. IDEs paper
  over this; code review does not.
- **Stack traces get taller.** Between your controller and your service there
  may be a transaction proxy, a security proxy and a metrics advice, each
  adding frames ([reading stack traces](../../phase-5-exceptions/05-reading-stack-traces/README.md)).
- **Startup does real work.** Scanning, condition evaluation and graph
  construction all happen before the first request. That is the price of moving
  failures to startup, and it is worth paying — but it is a price, and it is
  why lazy initialization exists as a tempting, dangerous option (topic 04).

What you do **not** trade away is runtime performance. The graph is built once;
after that, injected collaborators are ordinary object references.

## Gotchas

**Symptom:** the team adopts constructor injection everywhere, and unit tests still
start a Spring context and take four minutes
**Cause:** the classes are injectable but nobody changed the tests. The benefit of
DI is only realised at the moment a test calls `new` — the annotations alone buy
nothing
**Fix:** for a service with no framework behaviour, drop `@SpringBootTest` entirely
and construct it directly; keep context-loading tests for the wiring itself, which
is the only thing that actually needs a container

**Symptom:** a class has three constructor parameters, then five, then nine, and each
addition passes review because "it's just one more dependency"
**Cause:** each step is individually small, and constructor injection makes the total
visible in exactly one place — which is the mechanism working, not failing
**Fix:** read the parameter count as the design signal the docs say it is, and split
the class. Adding `@Autowired` fields to hide the count is the anti-fix; it removes
the signal without removing the problem

**Symptom:** `ApplicationContext.getBean("thing")` appears in business logic
**Cause:** somebody needed a collaborator in a class the container does not manage,
and reached for the locator instead of passing the dependency in
**Fix:** pass it in. If the calling class genuinely is not a bean — a JPA entity, a
domain object, something constructed by a library — the dependency belongs as a
method parameter on the call, not as a hidden global reach-out:

```java
// not this
public BigDecimal total() {
    return ctx.getBean(TaxCalculator.class).apply(this);
}

// this — the caller, which IS a bean, supplies it
public BigDecimal total(TaxCalculator tax) {
    return tax.apply(this);
}
```

**Symptom:** a class is annotated `@Service`, and `@Transactional` or `@Cacheable` on
it does nothing in one code path
**Cause:** that code path constructed the class with `new` instead of using the injected
bean. A hand-constructed instance is not managed — no injection, and no proxy applying
the advice
**Fix:** inject the bean rather than constructing it. If the object genuinely must be
created per call, it should not be carrying container-dependent annotations at all

**Symptom:** a bean's collaborator is created inside a method with `new` "just for this
one case", and it later needs configuration nobody can supply
**Cause:** the dependency was welded in at the point of use, so the composition root has
no say and no test can substitute it
**Fix:** promote it to a constructor parameter. The signature growing is the honest
signal that the class acquired a new dependency

## Interview questions

**★ What does dependency injection actually give you, in one sentence, without using the words "loose coupling"?**
It gives you the ability to construct any class in the system with `new`, in a
test, supplying whatever collaborators the test needs — because no class
constructs its own. Everything else people claim for DI follows from that or is
decoration. The concrete test is: if your unit test cannot build the class under
test without starting a container, the codebase has the annotations but not the
benefit.

**★ Is dependency injection a Spring concept?**
No. It is a design constraint expressible in plain Java — a class receives its
collaborators rather than creating them — and the composition root that honours
it can be four lines of hand-written `new` calls. Spring is a *dependency
injection container*: it reads declarations, works out the construction order,
and builds the graph so you do not maintain that root by hand. You can and
should be able to explain the constraint without mentioning `@Autowired` at all.

**★ Where does the decision about which implementation to use actually go, then?**
Up, to the composition root — the one place in the program that knows about
concrete types. That is the trade: individual classes become ignorant and
testable, and in exchange there is exactly one location where the real wiring
lives. With Spring that location is spread across `@Configuration` classes,
component scanning and auto-configuration rather than a single file, which is
convenient and is also why "which bean am I actually getting" becomes a real
question with real tooling behind it.

**★ Why is it valuable that a missing dependency fails at startup rather than at first use?**
Because a startup failure is caught by the deployment, in every environment, on
every rollout — the process does not come up and the rollout stops. A
first-use failure is caught by whichever unlucky request first traverses that
code path, which may be days later and in production. Moving failure earlier is
the whole point of the arrangement, and it is why constructor injection (checked
by the compiler and the container) is preferred to field injection (checked only
by the container) and why lazy initialization is not the default.

**★ Is dependency injection the same thing as the Dependency Inversion Principle?**
No, and conflating them is common. The Dependency Inversion Principle is about
*what* you depend on — high-level policy should depend on abstractions rather
than on low-level details, so `InvoiceService` should be typed against an
`InvoiceRepository` interface rather than against `JdbcInvoiceRepository`.
Dependency injection is about *how* the dependency arrives — from outside,
rather than being constructed internally. You can do DI while injecting a
concrete class (no inversion at all), and you can honour inversion while
building the graph by hand with no container. They travel together because
inversion is what makes substitution useful and injection is what makes it
possible.

**★ Is a DI container the same as a service locator?**
No, and the difference is the direction of the arrow. With injection, the class
declares what it needs and something else supplies it — the dependency is in the
signature and the class never names the container. With a service locator the
class asks a global registry for what it wants, so the dependency is invisible
from outside, the class is coupled to the locator, and a test must populate the
registry rather than pass an argument. Spring can be used either way:
constructor parameters are injection, `ApplicationContext.getBean(...)` in a
service is a service locator, and that is why the second one is a smell in a
class that could have declared the need instead.

**★ Someone argues DI is unnecessary because you can just use static factories or singletons. What is the counter?**
A static factory hard-codes the decision inside the consuming class again, so you
are back to having no seam — the only way to substitute the collaborator is a
static mock or a classloader trick, both of which are worse than the problem.
Static state is also shared process-wide, so tests interfere with each other and
must run in a fixed order. The counter is not "DI is more elegant"; it is that
static wiring gives you no place to stand when you need to replace one node of
the graph.

**★ What does DI cost?**
Navigability, stack depth and startup time. You lose the ability to read the
concrete collaborator out of the file you are looking at; proxies add frames
between your code and its callers, so traces get taller; and scanning plus graph
construction happen before the first request is served. It costs essentially
nothing at steady-state runtime — once built, an injected collaborator is a
plain field holding a plain reference.

---

← Index: [Phase 9 — Spring Boot and the web](../README.md) · Next → [Constructor injection is the default](02-constructor-injection.md)
