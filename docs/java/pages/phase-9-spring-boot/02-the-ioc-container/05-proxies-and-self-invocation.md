---
title: "Proxies and self-invocation"
sidebar_label: "5 · Proxies and self-invocation"
sidebar_position: 5
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-19 against the Spring Framework 7.0 reference *Aspect
> Oriented Programming with Spring → Proxying Mechanisms*
> (docs.spring.io/spring-framework/reference/core/aop/proxying.html — JDK
> dynamic proxies versus CGLIB, the self-invocation limitation, `final` and
> `private` method constraints), the *Declarative Transaction Management*
> section on proxy-mode limitations, and the Spring Boot reference for
> `spring.aop.proxy-target-class`.
> Spring Boot 4.1.0, Spring Framework 7.0.x, JDK 25.

**The object the container injects into your class is frequently not an
instance of the class you wrote. It is a generated wrapper that implements the
same contract, intercepts calls, does something extra, and delegates. That
substitution is what makes `@Transactional` work on a plain method call — and
it is also the source of a whole family of failures that share one signature:
the annotation is present, the code compiles, the application starts, and
nothing happens. Every one of them is explained by asking a single question —
*did this call actually pass through the proxy?***

## Which proxy, and why it matters

Spring has two proxying mechanisms and the choice is visible to you:

| | JDK dynamic proxy | CGLIB subclass |
|---|---|---|
| Requires | the bean implements an interface | a non-final class, non-final methods |
| The proxy **is** | an object implementing those interfaces | a generated **subclass** of your class |
| Injecting by concrete class | ⛔ fails — proxy is not your class | ✅ works |
| `final` methods | n/a | ⚠️ silently not advised |

Spring Boot defaults to CGLIB (`spring.aop.proxy-target-class=true`), which is
why injecting a concrete `OrderService` normally works. Two failure modes fall
out of the table and both are silent:

- **A `final` method on a CGLIB-proxied bean cannot be overridden**, so its
  advice never runs. `@Transactional` on a `final` method does nothing.
- **`private` methods are never advised** either, for the same reason.

## The rule that explains all of it

A proxy can only intercept a call that **goes through the proxy reference**.
Spring hands the proxy to everyone who injects your bean, so calls arriving
from other beans are intercepted. Calls originating *inside* the object use
`this` — the raw target, which the proxy wraps but does not replace — and are
invisible to it.

```java
@Service
public class ImportService {

    @Transactional
    public void importAll(List<Row> rows) {
        rows.forEach(this::writeOne);      // ⛔ `this` — bypasses the proxy
    }

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void writeOne(Row row) {
        // runs inside importAll's transaction; REQUIRES_NEW is ignored
    }
}
```

`writeOne` is annotated, `public`, and non-`final`. It still gets no new
transaction, because `importAll` called it on `this`. Nothing logs a warning.

The same rule governs `@Async` (the call runs on the caller's thread),
`@Cacheable` (the cache is never consulted) and `@Retryable` (no retry
happens). One mechanism, four annotations, identical symptom.

## Gotchas

### Expecting `@Transactional` to work when a bean calls its own method

**Symptom.** A method annotated `@Transactional` runs without a transaction
when called from another method of the same class.

**Cause.** The behaviour comes from a proxy the container wraps the bean in.
An internal call goes through `this`, not through the proxy, so no advice runs.
This is the clearest everyday consequence of "the container hands you a
reference, and the reference may not be the object you wrote".

**Fix.** Move the transactional method to a different bean so the call crosses
the proxy boundary:

```java
@Service
class ImportService {
    private final RowWriter writer;                  // ✅ separate bean, real proxy
    ImportService(RowWriter writer) { this.writer = writer; }

    void importAll(List<Row> rows) {
        rows.forEach(writer::writeInNewTransaction);  // ✅ crosses the boundary
    }
}
```

Self-injection and `AopContext.currentProxy()` also work and both are worse;
the split is the honest fix.

### `@Transactional` on a `final` or `private` method

**Symptom.** One annotated method never opens a transaction while its
neighbours in the same class work correctly.

**Cause.** Boot proxies with CGLIB, which works by generating a subclass and
overriding methods. A `final` method cannot be overridden and a `private` one
is not visible to the subclass, so no advice is woven in. Nothing warns you.

**Fix.** Make the advised method `public` (or at least non-`final`,
non-`private`) and reachable from outside the bean:

```java
@Service
public class LedgerService {

    @Transactional
    public void post(Entry e) { /* ✅ public, non-final: proxied */ }

    @Transactional
    private void postInternal(Entry e) { /* ⛔ never advised */ }
}
```

### Injecting an interface when Spring built a JDK proxy — or the reverse

**Symptom.** Startup fails with `NoSuchBeanDefinitionException` for a concrete
class that visibly exists and is annotated `@Service`.

**Cause.** With `spring.aop.proxy-target-class=false`, a bean that implements
an interface is proxied as a JDK dynamic proxy, which implements the interface
but is **not** an instance of your class. Injecting by concrete type cannot
match it.

**Fix.** Inject the interface — which you should be doing anyway, per
[chunk 1](01-the-inversion.md) — or leave Boot's CGLIB default in place:

```java
@Service
class Checkout {
    private final PaymentGateway gateway;              // ✅ the interface

    Checkout(PaymentGateway gateway) { this.gateway = gateway; }
}
```

### A proxy that breaks `equals`, `hashCode` or a `getClass()` check

**Symptom.** Code comparing `bean.getClass() == OrderService.class` fails, or a
bean used as a map key behaves oddly.

**Cause.** A CGLIB proxy's `getClass()` returns the generated subclass, whose
name contains `$$SpringCGLIB$$`. It is a subclass, so `instanceof` still works
— but exact class comparison does not.

**Fix.** Never compare classes exactly on a bean; use `instanceof`, or unwrap
deliberately when you genuinely need the target:

```java
Class<?> real = AopProxyUtils.ultimateTargetClass(bean);   // ✅ the class you wrote
boolean ok = AopUtils.isAopProxy(bean);
```

## Interview questions

**★ Why does calling a `@Transactional` method from within the same class not open a transaction?**
Because the behaviour is added by a proxy that wraps the bean, and the
container injects the proxy into collaborators. Calls that arrive from outside
go through the proxy, which runs the transaction advice before delegating.
A call from another method of the same class goes through `this` — the raw
object — so no advice runs and no transaction starts. The honest fix is to move
the annotated method onto a separate bean so the call crosses the proxy
boundary; self-injection or `AopContext.currentProxy()` work but obscure the
problem. This is the everyday consequence of the container handing you a
reference that need not be the object you wrote.

**★ What is the difference between JDK dynamic proxies and CGLIB proxies, and which does Spring Boot use?**
A JDK dynamic proxy implements the bean's interfaces and is not an instance of
the bean's concrete class, so injecting by concrete type fails. A CGLIB proxy is
a generated subclass of the bean's class, so injecting by either the class or
its interfaces works — but it cannot override `final` or `private` methods, so
advice on those silently does nothing. Spring Boot defaults to CGLIB
(`spring.aop.proxy-target-class=true`) precisely to avoid the injection-by-class
failure. The practical takeaway is that an annotation like `@Transactional` on a
`final` method compiles, deploys and does nothing at all.

**★ Why can a bean end up without its `@Transactional` proxy, and how would you spot it?**
Because it was instantiated too early — typically pulled in as a dependency of
a `BeanFactoryPostProcessor` or a non-static `@Bean` method that declares one,
which forces creation during phase one before the proxying
`BeanPostProcessor`s are registered. The bean is real and correctly wired; it
simply never got wrapped, so the annotation does nothing. Spring logs an
info-level warning that the bean is "not eligible for getting processed by all
BeanPostProcessors", which is the diagnostic to look for. The fix is to declare
`BeanFactoryPostProcessor` beans from `static` `@Bean` methods with no
dependencies, reading what they need from the `Environment` instead.
**★ Why do `@Async`, `@Cacheable` and `@Retryable` fail in exactly the same situations as `@Transactional`?**
Because all four are implemented the same way: a `BeanPostProcessor` replaces
the bean with a proxy that intercepts calls and applies behaviour before
delegating to the target. Any condition that stops a call reaching the proxy
disables all of them identically — a self-invocation through `this`, a `final`
or `private` method that CGLIB cannot override, or a bean instantiated too
early to be proxied at all. The symptom is the same in every case and it is the
worst kind: no exception, no warning, the annotation simply does nothing. This
is why "did the call go through the proxy?" is the first diagnostic question
for any of these annotations.

**★ Is there a legitimate way to make self-invocation work, and should you use it?**
There are three. You can inject the bean into itself so the field holds the
proxy; you can call `((MyService) AopContext.currentProxy()).method()` with
`@EnableAspectJAutoProxy(exposeProxy = true)`; or you can switch to AspectJ
load-time or compile-time weaving, which advises the bytecode itself and has no
proxy boundary at all. The first two work but leave a confusing artefact in the
code that a future reader must decode, and self-injection in particular hides a
circular reference. The honest fix is almost always to move the method to a
separate bean, because the need for self-invocation advice is usually a signal
that one class is doing two jobs.

**★ How do you tell at runtime whether a bean is proxied, and what class it really is?**
`AopUtils.isAopProxy(bean)` reports whether it is a proxy at all, with
`isJdkDynamicProxy` and `isCglibProxy` distinguishing the kind, and
`AopProxyUtils.ultimateTargetClass(bean)` returns the class you actually wrote
rather than the generated subclass. The cheap eyeball check is the class name:
a CGLIB proxy's contains `$$SpringCGLIB$$`. This matters because exact class
comparison (`getClass() == Foo.class`) fails on a proxied bean even though
`instanceof Foo` succeeds, so any code doing type checks on beans needs to
unwrap deliberately.

---

← Prev: [Instantiation and post-processors](04-instantiation-and-post-processors.md) · Index: [Phase 9 — Spring Boot and the web](../README.md) · Next → [The stereotype annotations](06-the-stereotypes.md)
