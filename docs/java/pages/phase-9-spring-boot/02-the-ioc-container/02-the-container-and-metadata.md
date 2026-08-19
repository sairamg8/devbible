---
title: "The container and its metadata"
sidebar_label: "2 · The container and its metadata"
sidebar_position: 2
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-19 against the Spring Framework 7.0 reference *The IoC
> Container* (docs.spring.io/spring-framework/reference/core/beans/ — the
> `BeanFactory`/`ApplicationContext` relationship and the additional features
> `ApplicationContext` contributes, configuration metadata forms), the
> Framework 7.0.8 Javadoc for
> `org.springframework.beans.factory.BeanFactory` and
> `org.springframework.context.ApplicationContext`, and the Spring Boot
> reference for `spring.main.lazy-initialization`.
> Spring Boot 4.1.0, Spring Framework 7.0.x, JDK 25.

**The container you actually use is `ApplicationContext`, and the thing it
reads is not your source code — it is a normalised model of bean definitions
that three completely different dialects all compile down to. XML elements,
scanned annotations and `@Bean` methods are interchangeable notations for the
same underlying `BeanDefinition`, which is why a Spring Boot application can be
half auto-configuration (Java config, written by someone else) and half your
own annotated classes, and why debugging a wiring problem is always a question
about the resulting definition rather than about the notation that produced
it.**

## Two interfaces, and which one you use

**`org.springframework.beans.factory.BeanFactory`** is the base contract: given
a name or a type, produce a fully configured object. It is the minimum
definition of a container.

**`org.springframework.context.ApplicationContext`** is a sub-interface of
`BeanFactory` that adds what a real application needs:

| Adds | What it means in practice |
|---|---|
| AOP integration | `@Transactional`, `@Async`, `@Cacheable` work at all |
| `MessageSource` | i18n message resolution |
| Event publication | `ApplicationEventPublisher`, `@EventListener` |
| `ResourceLoader` | `classpath:` / `file:` resource resolution |
| `Environment` | property sources and profiles |
| Web-aware variants | `WebApplicationContext`, `ServletWebServerApplicationContext` |

`ApplicationContext` is a complete superset, and the documentation recommends
it for essentially all use. **You will use `ApplicationContext` in every
application you write.** `BeanFactory` shows up when you write framework-level
code that manipulates definitions — most visibly in the
`BeanFactoryPostProcessor` callback that [chunk 3](03-the-two-phases.md)
covers.

One consequence of the superset relationship matters daily:
**`ApplicationContext` pre-instantiates singletons during refresh**, while a
bare `BeanFactory` creates them on demand. That eagerness is a feature, not
overhead — a misconfigured bean fails when the application starts rather than
when the first request touches it at 3am.

## Configuration metadata: three dialects, one model

The container does not read your classes directly. It reads **configuration
metadata**, which it normalises into `BeanDefinition` objects. Three dialects
produce the same model:

```xml
<!-- XML: the original. You will meet it in legacy codebases; do not start here. -->
<bean id="orderService" class="com.acme.OrderService">
  <constructor-arg ref="orderRepository"/>
</bean>
```

```java
// Annotations + scanning: the class declares itself.
@Service
public class OrderService { /* ... */ }
```

```java
// Java configuration: a method declares it. The only option for types you
// don't own — you cannot annotate a class from a third-party jar.
@Configuration
class ClientConfig {
    @Bean
    StripeClient stripeClient(BillingProperties props) {
        return StripeClient.builder().apiKey(props.apiKey()).build();
    }
}
```

All three end as `BeanDefinition`s and are freely mixed. **Spring Boot's entire
auto-configuration is the third dialect**, layered underneath your
second-dialect classes — which is the single most useful thing to know about
it, because it means auto-configuration is not magic, it is `@Bean` methods in
classes you did not write.

Choosing between them is not a matter of taste:

| Situation | Dialect |
|---|---|
| A class you own, one obvious implementation | stereotype annotation |
| A class from a third-party jar | `@Bean` method — you cannot annotate it |
| Construction needs logic, arguments or a builder | `@Bean` method |
| Several beans of one type, differently configured | `@Bean` methods |
| Legacy application already using it | XML, and leave it alone |

## The costs that are specific to the container

[Chunk 1](01-the-inversion.md) named the design cost — losing compile-time
verification. The container adds two runtime costs worth naming.

**Startup does real work.** Scanning the classpath, evaluating conditions,
creating proxies and instantiating every singleton all happen before the first
request. For a service that runs for weeks this is irrelevant. For a
short-lived function, a CLI tool or a scale-to-zero workload it dominates, and
it is exactly what Spring's AOT processing and GraalVM native images exist to
remove — by doing the definition work at build time and emitting code instead
of reflecting at runtime.

**Reflection and proxies cost memory and clarity.** Every proxied bean is a
generated subclass or a JDK dynamic proxy, and every one adds frames to stack
traces. This is the price of `@Transactional` working on a plain method call.

## Gotchas

### Reaching for `ApplicationContext` to fetch beans yourself

**Symptom.** A class injects `ApplicationContext` and calls
`context.getBean(SomeService.class)` where it needs a collaborator.

**Cause.** It is the Service Locator pattern — the thing dependency injection
replaced. The dependency is now invisible to the constructor, so it is
invisible to the compiler, to tests and to anyone reading the class.

**Fix.** Declare it. If the choice is genuinely dynamic, inject an
`ObjectProvider` or a `Map<String, T>` — Spring populates a `Map` keyed by bean
name automatically — which keeps the dependency explicit:

```java
@Service
class PaymentDispatcher {
    private final Map<String, PaymentHandler> handlers;   // ✅ all of them, by bean name

    PaymentDispatcher(Map<String, PaymentHandler> handlers) {
        this.handlers = handlers;
    }

    void pay(String method, Order order) {
        handlers.getOrDefault(method, handlers.get("default")).handle(order);
    }
}
```

### Declaring the same type both ways

**Symptom.** Two beans of one type exist, an injection point becomes ambiguous,
or a `@Bean` method's carefully configured instance is not the one used.

**Cause.** The class carries `@Service` *and* appears in a `@Bean` method. Both
dialects register a definition, so you get two — with different names, so
nothing complains until something injects by type.

**Fix.** Pick one dialect per type. Stereotypes for classes you own, `@Bean`
methods for classes you do not:

```java
// ⛔ OrderService.java carries @Service ...
@Configuration
class BadConfig {
    @Bean OrderService orderService(OrderRepository r) {   // ⛔ ... and this. Two beans.
        return new OrderService(r);
    }
}
```

### Assuming a bean is created lazily

**Symptom.** An application that starts fine in a test fails at startup in
production, on a bean nothing has called yet.

**Cause.** `ApplicationContext` instantiates singletons **eagerly** during
refresh. A bean whose constructor opens a connection does so at startup,
whether or not anything uses it.

**Fix.** This is usually the behaviour you want — fail fast. Where a bean is
genuinely expensive and rarely used, mark it `@Lazy` deliberately, and
understand that you have traded a startup failure for a runtime one:

```java
@Bean
@Lazy                                   // ✅ deliberate: created on first use
ReportEngine reportEngine() { return new ReportEngine(); }
```

### Turning on global lazy initialisation to speed up startup

**Symptom.** Startup gets faster; weeks later a configuration error surfaces as
a 500 on a rarely used endpoint in production.

**Cause.** `spring.main.lazy-initialization=true` defers every singleton until
first use, which also defers every wiring and configuration failure until first
use — and endpoints have very different traffic.

**Fix.** Use it in the development inner loop only, and keep it out of the
production profile:

```yaml
# application-dev.yml — ✅ scoped to a profile, never the default
spring:
  main:
    lazy-initialization: true
```

If startup time is a production problem, the real answers are AOT processing
and a native image, not deferring failure detection.

## Interview questions

**★ `BeanFactory` versus `ApplicationContext` — which do you use and why?**
`ApplicationContext`, effectively always. `BeanFactory` is the base contract
for retrieving configured objects; `ApplicationContext` extends it with AOP
integration — which is what makes `@Transactional` and `@Async` work at all —
plus `MessageSource` internationalisation, event publication, resource loading,
`Environment` and property-source support, and the web-aware variants. It is a
complete superset and the documentation recommends it for all use. A practically
important difference is that `ApplicationContext` pre-instantiates singletons at
refresh while a bare `BeanFactory` is lazy, which is why configuration errors
surface at startup. You meet `BeanFactory` directly mainly in framework-level
code such as a `BeanFactoryPostProcessor`.

**★ What is configuration metadata, and what forms can it take?**
It is the description the container reads to learn which beans should exist and
how they relate; the container normalises every form into `BeanDefinition`
objects. It comes in three dialects: XML `<bean>` elements, annotations plus
classpath scanning, and Java configuration with `@Configuration` classes and
`@Bean` methods. They are interchangeable and routinely mixed — Spring Boot's
auto-configuration is Java configuration sitting underneath your annotated
classes. The reason to know they converge is that debugging a bean problem is
always a question about the resulting `BeanDefinition`, never about which
notation produced it.

**★ When must you use a `@Bean` method rather than a stereotype annotation?**
Whenever you cannot or should not put an annotation on the class. The
unavoidable case is a type from a third-party jar — you do not own the source,
so `@Bean` is the only option, which is why every `DataSource`, `ObjectMapper`
and HTTP client in a Spring application is declared that way. The other cases
are construction that needs real logic (a builder, conditional configuration,
values pulled from `Environment`), and needing several beans of the same type
configured differently, which one annotated class cannot express. Stereotypes
are for your own classes with one obvious construction.

**★ Why does Spring instantiate singletons eagerly, and when would you turn that off?**
To convert configuration errors into startup failures. A missing dependency, an
ambiguous injection point or a constructor that cannot reach its database
surfaces before the application accepts any traffic, which behind a load
balancer means the instance never enters rotation. You turn it off per bean with
`@Lazy` when a bean is genuinely expensive and rarely used, accepting that its
failure has moved to first use. Turning it off globally with
`spring.main.lazy-initialization=true` is a development-loop convenience —
using it in production trades fast startup for latent runtime failures on
low-traffic endpoints, and the correct production answer to slow startup is AOT
processing or a native image.

**★ What does the container cost at startup, and what removes that cost?**
Classpath scanning, condition evaluation for auto-configuration, proxy
generation and eager instantiation of every singleton — all before the first
request is served. For a long-running service this is a one-off cost nobody
notices; for a short-lived function, a CLI or a scale-to-zero workload it can
dominate the process lifetime. Spring's answer is AOT processing, which moves
the definition and condition work to build time and emits generated code
instead of runtime reflection, and GraalVM native images, which additionally
remove JVM warm-up. That is also why frameworks like Quarkus and Micronaut do
their dependency injection at compile time — the subject of
**Topic 16 — The alternatives** *(not written yet)*.

---

← Prev: [The inversion](01-the-inversion.md) · Index: [Phase 9 — Spring Boot and the web](../README.md) · Next → [Two phases: definition, then instantiation](03-the-two-phases.md)
