---
title: "Lifecycle callbacks and their order"
sidebar_label: "4 · Lifecycle callbacks"
sidebar_position: 4
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-19 against the Spring Framework reference — *Lifecycle
> Callbacks*, *Initialization Callbacks*, *Destruction Callbacks*, *Default
> Initialization and Destroy Methods*, *Using the `@Bean` Annotation* (destroy-method inference) and *Combining Lifecycle Mechanisms*
> (docs.spring.io/spring-framework/reference/core/beans/factory-nature.html —
> the three mechanisms, their invocation order, the "same method name runs only
> once" rule, and the recommendation of the JSR-250 annotations) and the
> **Spring Framework 7.0 release notes**
> (github.com/spring-projects/spring-framework/wiki/Spring-Framework-7.0-Release-Notes
> — removal of `javax.annotation` support). Spring Boot 4.1.1, Spring Framework
> 7.0.x, JDK 25.

**There are three ways to be told a bean has been created and three to be told
it is going away, they all fire, and they fire in a documented order most people
have never looked up. The more useful question is *why the callback exists at
all*: a constructor cannot do this work, because at the moment your constructor
runs the bean is not yet proxied, not yet fully wired if you used field
injection, and certainly not yet part of a finished context. `@PostConstruct` is
the first moment the object is genuinely itself.**

## Initialization: three mechanisms, one order

In the order the reference gives:

1. **`@PostConstruct`** — the JSR-250 annotation
2. **`InitializingBean.afterPropertiesSet()`** — the Spring interface
3. **a custom init method** — `@Bean(initMethod = "...")` or XML `init-method`

```java
@Component
public class WarmCache {

    private final PriceRepository prices;
    private Map<Sku, BigDecimal> cache;

    WarmCache(PriceRepository prices) {           // 1. constructor: dependencies arrive
        this.prices = prices;
    }

    @PostConstruct
    void warm() {                                 // 2. everything is wired; do the work
        this.cache = prices.loadAll();
    }
}
```

Destruction mirrors it exactly:

1. **`@PreDestroy`**
2. **`DisposableBean.destroy()`**
3. **a custom destroy method** — `@Bean(destroyMethod = "...")`

Two documented rules about combining them:

- If several mechanisms are configured **with different method names**, all of
  them run, in the order above.
- If **the same method name** is configured for more than one mechanism, that
  method runs **only once**. So annotating `init()` with `@PostConstruct` *and*
  naming it in `@Bean(initMethod="init")` is harmless, not doubled.

## Which one to use

The reference is direct:

> *"The JSR-250 `@PostConstruct` and `@PreDestroy` annotations are generally
> considered best practice for receiving lifecycle callbacks in a modern Spring
> application. Using these annotations means that your beans are not coupled to
> Spring-specific interfaces."*

So: **`@PostConstruct` / `@PreDestroy` by default.** `InitializingBean` and
`DisposableBean` couple your class to Spring types for no benefit, and exist
largely for historical reasons.

The one case for `@Bean(initMethod=..., destroyMethod=...)` is a **third-party
class you cannot annotate**:

```java
@Bean(destroyMethod = "shutdown")
ExternalClient externalClient() {
    return new ExternalClient(config);        // not your class; cannot add @PreDestroy
}
```

### Destroy-method inference — the one that happens without you

⚠️ **`@Bean` infers a destroy method by default.** The reference states that
*"beans defined with Java configuration that have a public `close` or `shutdown`
method are automatically enlisted with a destruction callback."* So the
`externalClient` above would have had `shutdown()` called even without the
attribute — and any `@Bean` returning something with a public `close()` gets it
closed on context shutdown whether you intended that or not.

Disable it with an empty string:

```java
@Bean(destroyMethod = "")                    // do NOT infer close()/shutdown()
DataSource dataSource() throws NamingException {
    return (DataSource) jndiTemplate.lookup("MyDS");
}
```

The docs single out exactly this case: do it for a resource whose lifecycle is
managed outside the application, and *"in particular, make sure to always do it
for a `DataSource`, as it is known to be problematic on Jakarta EE application
servers."*

⚠️ **The import is `jakarta.annotation`, not `javax.annotation`.**

```java
import jakarta.annotation.PostConstruct;
import jakarta.annotation.PreDestroy;
```

Framework 7 **removed `javax.annotation` support entirely** (along with
`javax.inject`), so a copied snippet using the old package does not merely
warn — the annotation is not recognised and **your method silently never runs**.
That is the worst possible failure shape for a lifecycle callback, and it is a
common one when following older tutorials.

## Why not the constructor?

The constructor is the right place for *assigning dependencies* and the wrong
place for *using* them. Three reasons, in increasing order of subtlety:

1. **With field or setter injection, the fields are still null.** Population
   happens in a `BeanPostProcessor` after instantiation. This is the classic
   "it's null in the constructor" confusion, and constructor injection removes it.
2. **The bean is not yet proxied.** If the class carries `@Transactional`,
   `@Cacheable` or `@Async`, the proxy wraps the instance *after* construction.
   A `this.method()` call from the constructor gets no advice at all — no
   transaction, no cache, nothing. It fails silently and looks like the
   annotation does not work.
3. **Publishing `this` from a constructor is unsafe.** Registering the
   half-built object with a listener, a scheduler or a static registry lets
   another thread see it before construction finishes, which forfeits the
   final-field guarantee that makes a shared singleton safe in the first place
   ([the Java memory model](../../phase-6-concurrency/05-java-memory-model/README.md)).

`@PostConstruct` runs after all three problems are gone for that bean.

## But `@PostConstruct` is still too early for some things

It runs when **this** bean is ready — not when the **context** is. Other beans
may not exist yet, and the web server is certainly not accepting traffic. If
your init work touches other beans, or should happen once everything is up, you
want a later hook:

| Hook | Fires when |
|---|---|
| `@PostConstruct` | this bean is constructed and injected |
| `SmartInitializingSingleton.afterSingletonsInstantiated()` | **all** non-lazy singletons exist |
| `ApplicationRunner` / `CommandLineRunner` | context refreshed, just before `run()` returns |
| `@EventListener(ApplicationReadyEvent.class)` | after the runners have completed |

`SmartInitializingSingleton` is the one people miss, and it is exactly right for
"build an index over every bean of type X":

```java
@Component
class HandlerIndex implements SmartInitializingSingleton {

    private final ObjectProvider<Handler> handlers;
    private Map<String, Handler> index;

    HandlerIndex(ObjectProvider<Handler> handlers) { this.handlers = handlers; }

    @Override
    public void afterSingletonsInstantiated() {
        this.index = handlers.orderedStream()
                             .collect(toMap(Handler::code, identity()));
    }
}
```

## The trade-off

Initialization work in a callback is startup work, and startup work is latency
you pay on every deploy, every scale-out and every restart.

- **Eager warming buys a fast first request and costs deploy time.** Warming a
  cache in `@PostConstruct` means the first user is not the one who pays — good.
  It also means a rolling deploy of twenty pods each spends that time before
  taking traffic — a real cost, and the reason readiness probes exist.
- **Anything in `@PostConstruct` that can fail turns into a boot failure.**
  Usually desirable: better to fail the deploy than to serve broken responses.
  But an init method that calls a flaky downstream service makes your startup
  depend on their availability, which is a coupling you probably did not intend.
- **`@PreDestroy` is best-effort.** It runs on an orderly context close. It does
  not run on `SIGKILL`, on a JVM crash, or on a container OOM-kill. Correctness
  must never depend on it — treat it as tidying, not as a commit point.

## Gotchas

**Symptom:** a `@PostConstruct` method never runs and nothing is logged
**Cause:** the annotation was imported from `javax.annotation`, whose support Framework
7 removed — so it is just an unrecognised annotation on a method
**Fix:** import `jakarta.annotation.PostConstruct`. This is the most likely cause when
copying from any pre-Jakarta tutorial

**Symptom:** `@Transactional` has no effect when called from the bean's constructor
**Cause:** the proxy that applies the advice wraps the instance after construction, so
during the constructor there is nothing between you and the raw object
**Fix:** move the work to `@PostConstruct`, which runs after proxying — and note that
this is the same reason self-invocation bypasses `@Transactional` in general

**Symptom:** a `@PostConstruct` method reads another bean and gets a partially
initialised one, or fails outright
**Cause:** `@PostConstruct` fires when *this* bean is ready, not when the context is
**Fix:** use `SmartInitializingSingleton.afterSingletonsInstantiated()` for "all
singletons exist", or an `ApplicationRunner` for "the context is up"

**Symptom:** a JNDI-looked-up `DataSource` is closed on context shutdown and the
application server complains, or a shared client is closed out from under something else
**Cause:** `@Bean` infers a destruction callback from a public `close()` or `shutdown()`
method — nobody wrote `destroyMethod`, and it happened anyway
**Fix:** `@Bean(destroyMethod = "")` to opt out. The docs say to always do this for a
`DataSource` obtained from JNDI, whose lifecycle belongs to the container

**Symptom:** a resource is not released when the application stops in Kubernetes
**Cause:** `@PreDestroy` runs on an orderly context close only — a `SIGKILL`, a crash or
an OOM-kill skips it entirely
**Fix:** do not depend on it for correctness. Make the downstream state recoverable, and
where cleanup matters, make it idempotent so a restart repairs it

**Symptom:** both `@PostConstruct` and `@Bean(initMethod=...)` are configured and a
reviewer worries the method runs twice
**Cause:** it does not — the docs state that when the same method name is configured for
multiple mechanisms, it runs only once
**Fix:** no change needed; remove one for clarity if you like, but there is no bug

## Interview questions

**★ Name the initialization callbacks and the order they fire in.**
`@PostConstruct` first, then `InitializingBean.afterPropertiesSet()`, then a
custom init method configured via `@Bean(initMethod=...)` or XML. Destruction
mirrors it: `@PreDestroy`, then `DisposableBean.destroy()`, then the custom
destroy method. If several mechanisms name *different* methods they all run in
that order; if they name the *same* method, it runs once.

**★ Which mechanism should you use, and why?**
`@PostConstruct` and `@PreDestroy` — the reference calls them best practice for a
modern Spring application specifically because they do not couple your class to
Spring interfaces. `InitializingBean`/`DisposableBean` are the legacy shape. The
genuine use for `@Bean(initMethod=..., destroyMethod=...)` is a third-party class
you cannot annotate, where you are declaring the lifecycle from the outside.

**★ Why do initialization work in `@PostConstruct` rather than in the constructor?**
Because during the constructor the bean is not yet itself. With field or setter
injection the dependencies are still null, since population happens in a
`BeanPostProcessor` afterwards. More subtly, the AOP proxy is applied after
construction, so any `@Transactional`, `@Cacheable` or `@Async` behaviour is
absent — the annotation appears not to work. And publishing `this` from a
constructor to a listener or registry lets other threads see a half-built object,
which forfeits the final-field visibility guarantee.

**★ `@PostConstruct` fires and your code needs another bean that isn't ready. What do you use?**
`SmartInitializingSingleton.afterSingletonsInstantiated()`, which fires once every
non-lazy singleton has been created — the right hook for building an index or a
registry over other beans. If you need the whole context up, including the web
server, use an `ApplicationRunner`/`CommandLineRunner`, or listen for
`ApplicationReadyEvent`, which is published after the runners complete.

**★ Does a `@Bean` method need `destroyMethod` for its object to be cleaned up?**
Usually not, and that is the surprise: Spring infers one. The reference says
beans defined with Java configuration that have a public `close` or `shutdown`
method are automatically enlisted with a destruction callback, so an
`HttpClient`, an `ExecutorService` or a connection pool returned from a `@Bean`
method gets closed on shutdown with nothing written. The important consequence
is the inverse — when you do *not* want that, you must say so with
`@Bean(destroyMethod = "")`, and the docs explicitly tell you to always do it for
a JNDI-obtained `DataSource`, whose lifecycle belongs to the application server.

**★ Can you rely on `@PreDestroy` to release resources?**
Only for orderly shutdown. It runs when the context is closed normally, and it
does not run on `SIGKILL`, a JVM crash, or a container OOM-kill. So it is the
right place for tidying — flushing a buffer, deregistering from a discovery
service — and the wrong place for anything correctness depends on. Design the
downstream state so that an abrupt death is recoverable and restart is
idempotent.

---

← Prev: [Web scopes and scoped proxies](03-web-scopes-and-proxies.md) · Index: [Phase 9 — Spring Boot and the web](../README.md) · Next → [Startup, shutdown and the cycle error](05-startup-shutdown-and-cycles.md)
