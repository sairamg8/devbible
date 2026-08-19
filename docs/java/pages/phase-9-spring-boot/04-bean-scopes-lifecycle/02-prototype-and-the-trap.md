---
title: "Prototype scope and the singleton trap"
sidebar_label: "2 · Prototype and the trap"
sidebar_position: 2
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-19 against the Spring Framework reference — *Bean Scopes*,
> *The Prototype Scope*, *Singleton Beans with Prototype-bean Dependencies*,
> *Request, Session, Application, and WebSocket Scopes* and *Scoped Beans as
> Dependencies*
> (docs.spring.io/spring-framework/reference/core/beans/factory-scopes.html) —
> including the statement that destruction callbacks are **not** called for
> prototypes, the "sole instance ever supplied" wording, and the
> `ObjectFactory`/`ObjectProvider`/`Provider` alternatives — and *Method
> Injection*
> (docs.spring.io/spring-framework/reference/core/beans/dependencies/factory-method-injection.html
> — `@Lookup`, the CGLIB subclassing requirements and limitations). Spring Boot
> 4.1.0, Spring Framework 7.0.x, JDK 25.

**Leaving `singleton` introduces a lifetime mismatch, and the container will not
warn you about it. A bean that lives for one request injected into a bean that
lives forever is resolved exactly once — you get the first request's instance,
for every request thereafter. Both of this chunk's real problems are that same
sentence: the prototype trap and the request-scope trap are one bug wearing two
hats, and both fixes work by making the injection point a *handle* rather than
an *instance*.**

## `prototype` — a new one every time you ask

```java
@Component
@Scope("prototype")
public class ReportBuilder { }
```

Every retrieval produces a fresh instance. Two things about it are commonly
misunderstood, and the second is the important one.

**First: "every time you ask" means every *retrieval*, not every *use*.** If a
singleton injects it once, it asks once.

**Second: Spring stops caring about it after handing it over.** Quoting the
reference:

> *"In contrast to the other scopes, Spring does not manage the complete
> lifecycle of a prototype bean. The container instantiates, configures, and
> otherwise assembles a prototype object and hands it to the client, with no
> further record of that prototype instance. Thus, although initialization
> lifecycle callback methods are called on all objects regardless of scope, in
> the case of prototypes, configured destruction lifecycle callbacks are not
> called."*

So `@PostConstruct` runs on a prototype and **`@PreDestroy` does not, ever**.
The docs put the obligation on you: *"the client code must clean up
prototype-scoped objects and release expensive resources that the prototype
beans hold."* A prototype holding a connection, a file handle or a native
resource is a leak with no framework safety net — which is a strong argument for
prototypes being plain data holders, or for not using the scope at all and
simply calling `new`.

## The trap: a prototype injected into a singleton

```java
@Service
public class ReportService {

    private final ReportBuilder builder;         // prototype-scoped… once.

    ReportService(ReportBuilder builder) {       // resolved at STARTUP
        this.builder = builder;
    }
}
```

The reference states the outcome exactly:

> *"if you dependency-inject a prototype-scoped bean into a singleton-scoped
> bean, a new prototype bean is instantiated and then dependency-injected into
> the singleton bean. **The prototype instance is the sole instance that is ever
> supplied to the singleton-scoped bean.**"*

There is no error and no warning. The scope annotation is present, it looks
correct, and it does nothing — the bean behaves as a singleton with extra
ceremony. If `ReportBuilder` is stateful, you now have exactly the shared-state
bug from [chunk 1](01-singleton-and-statelessness.md), disguised by an
annotation that appears to prevent it.

### Fix 1 — `ObjectProvider` (the default choice)

```java
@Service
public class ReportService {

    private final ObjectProvider<ReportBuilder> builders;

    ReportService(ObjectProvider<ReportBuilder> builders) {
        this.builders = builders;
    }

    public Report build(Query q) {
        ReportBuilder builder = builders.getObject();   // fresh instance, per call
        return builder.with(q).build();
    }
}
```

The docs describe `ObjectFactory<T>` as *"allowing for a `getObject()` call to
retrieve the current instance on demand every time it is needed — without
holding on to the instance or storing it separately"*, with `ObjectProvider` as
the extended variant adding `getIfAvailable` and `getIfUnique`. This is the one
to reach for: it is a plain typed field, it requires no subclassing, and a test
passes a lambda.

### Fix 2 — JSR-330 `Provider<T>`

```java
ReportService(Provider<ReportBuilder> builders) { ... }   // builders.get()
```

Identical in effect, standard rather than Spring-specific. Worth knowing;
`ObjectProvider` gives you strictly more.

### Fix 3 — `@Lookup` method injection

```java
@Service
public abstract class ReportService {

    public Report build(Query q) {
        return createBuilder().with(q).build();          // fresh each call
    }

    @Lookup
    protected abstract ReportBuilder createBuilder();     // Spring overrides this
}
```

Spring generates a CGLIB subclass that overrides the method. The documented
signature is
`<public|protected> [abstract] <return-type> theMethodName(no-arguments);` — the
target bean is resolved from the return type, or by name with
`@Lookup("beanName")`.

The limitations are real and are why this is third:

- **the class cannot be `final` and neither can the method** — CGLIB must
  subclass and override;
- **an `abstract` class must be subclassed by hand in a unit test** to supply a
  stub, which is exactly the constructibility problem from Topic 03;
- **lookup methods do not work with `@Bean` methods or factory methods**,
  because the container is not the one creating the instance there.

Use it when you want the abstract-factory shape in the class's own API.
Otherwise `ObjectProvider` is less machinery for the same result.

## Gotchas

**Symptom:** a bean marked `@Scope("prototype")` behaves exactly like a singleton
**Cause:** it was constructor-injected into a singleton, so it was resolved once —
the docs call that instance "the sole instance that is ever supplied"
**Fix:** inject `ObjectProvider<T>` and call `getObject()` per use, or use `@Lookup`.
The scope annotation alone does nothing at a singleton injection point

**Symptom:** a prototype bean holds a resource and the application leaks handles
**Cause:** destruction callbacks are never invoked for prototypes; Spring keeps no
record of the instance after handing it over
**Fix:** close it yourself — `try`-with-resources if it is `AutoCloseable` — and
consider whether the scope is buying anything over a plain `new`
([try-with-resources](../../phase-5-exceptions/03-try-with-resources/README.md))

**Symptom:** `@Lookup` is added and the class can no longer be unit-tested easily
**Cause:** the class was made `abstract` so CGLIB could override the method, so a test
must now subclass it and supply a stub
**Fix:** use `ObjectProvider` instead unless the abstract-factory method is genuinely
part of the class's API — it gives the same per-call resolution with a constructor
parameter a test can fill in one line

**Symptom:** `@Lookup` is placed on a method in a `@Configuration` class's `@Bean` and
silently does nothing
**Cause:** documented limitation — lookup methods do not work with `@Bean` or factory
methods, because the container is not the one creating that instance
**Fix:** move the lookup to a component the container instantiates, or use
`ObjectProvider` as a method parameter on the `@Bean` method

**Symptom:** a class is made `final` for immutability and `@Lookup` stops working
**Cause:** CGLIB has to subclass the class and override the method; neither the class
nor the method may be `final`
**Fix:** `ObjectProvider` has no such constraint — it is a field, not a subclass

## Interview questions

**★ What actually happens when you inject a prototype bean into a singleton?**
Exactly one prototype instance is created, at the point the singleton is
instantiated, and — in the reference's words — that instance "is the sole
instance that is ever supplied to the singleton-scoped bean." There is no error
and no warning, so the scope annotation looks correct while doing nothing. If
the prototype is stateful, you have quietly reintroduced shared mutable state on
a bean whose annotation suggests the opposite.

**★ Give three ways to get a fresh prototype instance from a singleton, and say which you would pick.**
`ObjectProvider<T>` (or `ObjectFactory<T>`) with `getObject()` per call, the
JSR-330 `Provider<T>` with `get()`, or `@Lookup` method injection where Spring
generates a CGLIB subclass overriding an abstract factory method. I would pick
`ObjectProvider`: it is a plain typed constructor parameter, requires no
subclassing, keeps the class `final`-able and unit-testable, and adds
`getIfAvailable`/`getIfUnique` for free. `@Lookup` earns its limitations only
when the factory method genuinely belongs in the class's own API.

**★ Are lifecycle callbacks invoked for prototype beans?**
Initialization callbacks are — `@PostConstruct` runs on objects of every scope.
Destruction callbacks are **not**: the docs state that for prototypes,
configured destruction lifecycle callbacks are not called, because the container
keeps no record of the instance after handing it over. The cleanup obligation is
explicitly the client's. That is a strong reason to keep prototypes free of
resources, and a decent argument that `new` is often the more honest tool.

**★ What are `@Lookup`'s limitations, and where do they come from?**
All of them come from CGLIB subclassing: the class cannot be `final`, the
overridden method cannot be `final`, and the documented signature is a
no-argument `public` or `protected` method resolved by return type or by the
name given to the annotation. Two further consequences matter in practice — an
`abstract` class must be hand-subclassed in a unit test to supply a stub, and
lookup methods do not work with `@Bean` or factory methods at all, since the
container is not creating those instances.

**★ Would you ever prefer plain `new` over prototype scope?**
Often, yes. The two things the container adds to a prototype are dependency
injection into it and initialization callbacks — it explicitly does not manage
its destruction. So if the object needs no injected collaborators, `new` gives
the same lifetime with less indirection and no risk of the singleton-injection
trap. Prototype scope earns its place when the object genuinely needs beans
wired into it each time it is created.

---

← Prev: [Singleton by default](01-singleton-and-statelessness.md) · Index: [Phase 9 — Spring Boot and the web](../README.md) · Next → [Web scopes and scoped proxies](03-web-scopes-and-proxies.md)
