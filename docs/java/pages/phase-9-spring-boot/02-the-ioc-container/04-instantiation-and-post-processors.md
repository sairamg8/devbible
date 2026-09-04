---
title: "Instantiation and post-processors"
sidebar_label: "4 · Instantiation and post-processors"
sidebar_position: 4
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-19 against the Spring Framework 7.0 reference *The IoC
> Container → Container Extension Points* and *Customizing the Nature of a
> Bean* (docs.spring.io/spring-framework/reference/core/beans/ —
> `BeanPostProcessor` semantics and ordering, initialisation callbacks,
> `@DependsOn`), the Framework 7.0.9 Javadoc for
> `org.springframework.beans.factory.config.BeanPostProcessor` and
> `org.springframework.core.annotation.Order`, and the Spring Framework
> reference on proxying mechanisms.
> Spring Boot 4.1.1, Spring Framework 7.0.x, JDK 25.

**Phase two is where objects finally exist, and it contains the single most
consequential piece of machinery in Spring: a callback that is allowed to
*replace* your bean with something else. Every annotation that appears to
change how a plain method call behaves — `@Transactional`, `@Async`,
`@Cacheable`, `@Retryable`, method-level security — works because a
`BeanPostProcessor` handed the container a wrapper instead of your object.
Understanding that one line of indirection explains why some annotations
silently do nothing, why an injected type is sometimes not the class you wrote,
and why calling your own method skips the behaviour entirely.**

## Phase 2's hook: `BeanPostProcessor`

A `BeanPostProcessor` sees every bean *instance*, twice — once before
initialisation callbacks and once after:

```java
@Component
class TimingPostProcessor implements BeanPostProcessor {

    @Override
    public Object postProcessAfterInitialization(Object bean, String name) {
        if (bean instanceof PaymentGateway gateway) {
            return new TimedPaymentGateway(gateway);   // ✅ return a REPLACEMENT
        }
        return bean;
    }
}
```

The return value replaces the bean. **That is the mechanism behind every proxy
in Spring**: `@Transactional`, `@Async`, `@Cacheable`, `@Retryable`, Spring
Security's method security and `@ConfigurationProperties` validation are all
implemented as `BeanPostProcessor`s that hand back a wrapper. When people say
"Spring wraps your bean in a proxy", this is literally the line of code where
it happens.

Two consequences fall straight out:

- **A bean created before the post-processors are ready is never proxied.** It
  is a real object, correctly wired, silently missing its annotations'
  behaviour.
- **The type you get injected is not always the type you wrote.** With a CGLIB
  proxy it is a generated subclass; with a JDK dynamic proxy it implements the
  interfaces only, which is why injecting a concrete class that Spring proxied
  through interfaces fails.

## Initialisation callbacks, in order

Between the two `BeanPostProcessor` calls, the container runs the bean's own
initialisation hooks, in this order:

1. `@PostConstruct` (the Jakarta annotation — Spring's recommended choice)
2. `InitializingBean.afterPropertiesSet()`
3. the `initMethod` named on `@Bean(initMethod = "...")`

Destruction mirrors it: `@PreDestroy`, then `DisposableBean.destroy()`, then
`destroyMethod`. Prefer the annotations — implementing `InitializingBean`
couples your class to Spring for no benefit, which is exactly the coupling the
POJO principle from [chunk 1](01-the-inversion.md) exists to avoid.

⚠️ **`@PostConstruct` is not "after the application starts".** It runs during
*this* bean's initialisation, when other beans may not exist yet. That
distinction is the first gotcha below.

The same phase-two timing is why a field-injected `@Value` is still `null`
inside the constructor — field injection happens after construction. That
argument, and why constructor injection avoids the whole class of problem,
belongs to **[Topic 03 — Dependency injection](../03-dependency-injection/README.md)**.

## Gotchas

### Expecting `@PostConstruct` to run at definition time

**Symptom.** A `@PostConstruct` method tries to look up beans that "should"
exist and gets an incomplete picture, or ordering between two beans' callbacks
is not what you assumed.

**Cause.** `@PostConstruct` runs in phase 2, per bean, as that bean is
initialised — not after the whole context is ready. Other beans may not exist
yet.

**Fix.** For work that needs the *entire* context, use an
`ApplicationListener<ApplicationReadyEvent>` or `ApplicationRunner`, which fire
once after refresh completes:

```java
@Component
class WarmUp implements ApplicationRunner {
    private final Catalog catalog;
    WarmUp(Catalog catalog) { this.catalog = catalog; }

    @Override
    public void run(ApplicationArguments args) {   // ✅ whole context is up
        catalog.preload();
    }
}
```

### Assuming `@Order` controls bean creation order

**Symptom.** Two beans are annotated `@Order` and still initialise in the
"wrong" sequence.

**Cause.** `@Order` governs position *in an injected collection* and the order
of ordered infrastructure such as filters and post-processors. It does not
control instantiation order, which comes from the dependency graph.

**Fix.** If B genuinely must be created after A, express the dependency —
either by injecting A into B, which is honest, or with `@DependsOn` when the
relationship is real but not expressed in the signature:

```java
@Bean
@DependsOn("flywayMigration")            // ✅ ordering as an explicit edge
CacheWarmer cacheWarmer(DataSource ds) { return new CacheWarmer(ds); }
```

### A `BeanPostProcessor` that returns the wrong thing

**Symptom.** Startup fails with an injection error saying a bean of the
expected type could not be found, naming a bean that clearly exists.

**Cause.** A `BeanPostProcessor` returned a wrapper that does not implement the
interface the injection point requires — or returned `null`, which removes the
bean entirely.

**Fix.** Always return the original bean when you do not intend to wrap it, and
make sure a wrapper preserves the type contract:

```java
@Override
public Object postProcessAfterInitialization(Object bean, String name) {
    if (!(bean instanceof PaymentGateway g)) {
        return bean;                       // ✅ untouched, never null
    }
    return new TimedPaymentGateway(g);     // ✅ still a PaymentGateway
}
```

## Interview questions

**★ What is a `BeanPostProcessor`, and what famous Spring features are built on it?**
It is the phase-two extension point, invoked for every bean instance both
before and after initialisation callbacks, and — critically — its return value
*replaces* the bean. That replacement is the mechanism behind essentially every
proxy in Spring: `@Transactional`, `@Async`, `@Cacheable`, `@Retryable` and
Spring Security's method security are all `BeanPostProcessor`s handing back a
wrapper around your object. It is also why "the injected type is not the class
I wrote" — with CGLIB you get a generated subclass, with a JDK dynamic proxy
you get something implementing only the interfaces.

**★ Does `@Order` control the order beans are created in?**
No, and this is a common misreading. `@Order` (and `Ordered`) determines
position in an injected `List<T>` or `Map<String,T>`, and the order of ordered
infrastructure such as filters, interceptors and post-processors. Instantiation
order is derived from the dependency graph: a bean is created after everything
it depends on. If you need a creation-order guarantee that the signatures do
not express — a cache warmer that must run after a database migration bean, say
— the explicit tool is `@DependsOn`, which adds a real edge to the graph.

**★ When does `@PostConstruct` run, and what should you use instead for whole-application startup work?**
It runs in phase two, during that individual bean's initialisation, between the
`BeanPostProcessor` before- and after-initialisation callbacks. That means the
bean's own dependencies are injected, but other unrelated beans may not exist
yet and the context is not refreshed. For work that needs the whole application
— warming caches, starting a poller, logging a readiness summary — use
`ApplicationRunner`, `CommandLineRunner`, or an
`ApplicationListener<ApplicationReadyEvent>`, all of which fire after refresh
completes.

**★ In what order do a bean's initialisation callbacks run?**
Within phase two, after dependencies are injected and between the
`BeanPostProcessor` before- and after-initialisation callbacks:
`@PostConstruct` first, then `InitializingBean.afterPropertiesSet()`, then any
`initMethod` declared on `@Bean`. Destruction mirrors it — `@PreDestroy`,
`DisposableBean.destroy()`, `destroyMethod`. The annotations are preferred over
the interfaces because implementing `InitializingBean` or `DisposableBean`
couples your class to Spring types for no functional gain, and that coupling is
the thing the whole POJO design goal exists to avoid.

---

← Prev: [Two phases: definition, then instantiation](03-the-two-phases.md) · Index: [Phase 9 — Spring Boot and the web](../README.md) · Next → [Proxies and self-invocation](05-proxies-and-self-invocation.md)
