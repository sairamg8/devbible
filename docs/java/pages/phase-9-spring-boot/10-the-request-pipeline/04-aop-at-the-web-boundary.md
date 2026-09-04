---
title: "AOP: below the web, and it sees your types"
sidebar_label: "4 · AOP"
sidebar_position: 4
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-20 against the Spring Framework 7.0 reference *Core → AOP →
> Proxying Mechanisms* (docs.spring.io/spring-framework/reference/core/aop/proxying.html
> — self-invocation, `AopContext.currentProxy()`, `exposeProxy`, and the CGLIB
> constraints) and *Core → AOP*, plus the Spring Boot 4.0 release notes and
> spring-projects/spring-boot#42948 for the `spring-boot-starter-aop` →
> **`spring-boot-starter-aspectj`** rename. Spring Boot 4.1.1, Spring Framework
> 7.0.x, JDK 25.

**AOP is the only one of the three mechanisms that has no idea it is on the web.
An aspect sees a Java method call: the declaring class, the typed arguments, the
return value, the thrown exception. It does not see a URL, a header, or a status
code, and the moment you write `RequestContextHolder.currentRequestAttributes()`
inside an aspect you have admitted you are at the wrong depth. That blindness is
the feature — it is what lets one aspect audit a domain action whether the call
arrived over HTTP, off a message queue, or from a scheduled job.**

## What an aspect actually receives

```java
@Aspect
@Component
class AuditAspect {

    private final AuditLog auditLog;

    @Around("@annotation(audited)")
    Object record(ProceedingJoinPoint joinPoint, Audited audited) throws Throwable {
        Object[] args = joinPoint.getArgs();            // TYPED domain arguments
        var signature = (MethodSignature) joinPoint.getSignature();

        try {
            Object result = joinPoint.proceed();
            auditLog.succeeded(audited.action(), signature.getMethod(), args, result);
            return result;
        } catch (Throwable ex) {
            auditLog.failed(audited.action(), signature.getMethod(), args, ex);
            throw ex;                                    // never swallow it
        }
    }
}
```

`args` is `Object[]`, but the objects in it are your `TransferCommand`, your
`Money`, your `AccountId` — already bound, already validated, already converted
from JSON. No layer above this has that. A filter has bytes; an interceptor has
an `HttpServletRequest` and a `HandlerMethod` whose parameters have not been
resolved yet. If the concern's rule is expressed in domain terms — *audit every
transfer over ten thousand*, *retry when the payment gateway times out*,
*forbid a cross-tenant read* — this is the only layer where the rule can be
written without re-parsing something.

The mirror image is what it cannot do:

| Question | Answer |
|---|---|
| Can it read a header? | Only by reaching for `RequestContextHolder`, which couples a domain aspect to HTTP |
| Can it set a status code or header? | Not directly; it can throw an exception the resolver maps |
| Does it run for a 404? | No — nothing was invoked |
| Does it run for a request rejected by security? | No — the filter chain stopped first |
| Does it run for calls that did not arrive over HTTP? | **Yes.** That is the point |

## The starter changed name in Boot 4

`spring-boot-starter-aop` is now **`spring-boot-starter-aspectj`**, renamed "to
clarify the scope" of what it pulls in. Two consequences:

- Every pre-2026 tutorial names a starter that no longer exists.
- The migration guide's advice is worth following literally: if your application
  does not use AspectJ — "typically an annotation in the
  `org.aspectj.lang.annotation` package" — you probably do not need the starter
  at all. Spring's own proxy-based advice (`@Transactional`, `@Async`,
  `@Cacheable`, `@Retryable`) works without it. You need the starter when *you*
  write `@Aspect`.

## Self-invocation: the failure that makes AOP look broken

Every proxy-based mechanism in Spring shares one hole, and it is documented
plainly:

> Once the call has finally reached the target object, any method calls that it
> may make on itself, such as `this.bar()` or `this.foo()`, are going to be
> invoked against the `this` reference, and not the proxy. This has important
> implications. It means that self invocation is not going to result in the
> advice associated with a method invocation getting a chance to run.

```java
@Service
class TransferService {

    public void transferBatch(List<Transfer> transfers) {
        transfers.forEach(this::transferOne);   // ← the proxy is bypassed here
    }

    @Audited(action = "TRANSFER")
    @Transactional
    public void transferOne(Transfer t) { ... }
}
```

`transferBatch` is called through the proxy, so any advice on *it* runs. The
`this::transferOne` calls are plain Java calls on the target instance, so
`@Audited` produces no audit record and `@Transactional` opens no transaction.
Nothing fails, nothing logs — you simply have no audit trail, which you discover
during an incident review.

The reference gives three ways out, in the order it prefers them.

**1. Refactor so the call crosses a bean boundary.** The advised method moves to
another bean, which is injected, so the call goes through that bean's proxy:

```java
@Service
class TransferService {
    private final SingleTransferService single;      // a different bean → a proxy
    public void transferBatch(List<Transfer> transfers) {
        transfers.forEach(single::transferOne);
    }
}
```

**2. Inject the bean into itself**, so the call goes through the proxy:

```java
@Component
class MyService {
    @Autowired private MyService self;               // the proxy, not `this`
    public void foo() { self.bar(); }
    public void bar() { ... }
}
```

**3. `AopContext.currentProxy()`**, which the documentation itself flags as
coupling your code to Spring AOP, and which requires the proxy to be exposed
(`@EnableAspectJAutoProxy(exposeProxy = true)`, or `setExposeProxy(true)` on a
`ProxyFactory`):

```java
((Pojo) AopContext.currentProxy()).bar();
```

The deeper treatment of proxies and when Spring chooses CGLIB over a JDK dynamic
proxy is in
[Topic 02, chunk 5](../02-the-ioc-container/05-proxies-and-self-invocation.md).
What matters here is the consequence list: with CGLIB, `final` classes cannot be
proxied, `final` and `private` methods cannot be advised, and package-private
methods in a parent class effectively cannot be either. AspectJ compile-time or
load-time weaving has none of these limits because it changes bytecode instead of
wrapping objects — which is exactly why the starter carries AspectJ's name.

## Ordering aspects, and ordering against the web layers

Aspects are ordered with `@Order` or by implementing `Ordered`, and the ordering
is *among aspects*, on the same join point. There is no ordering relationship
between an aspect and a filter or an interceptor to configure, because there is
nothing to configure: an aspect is inside the handler call, so it is always
innermost. A filter always wraps an interceptor, which always wraps an aspect.
That is the stack in [chunk 1](01-the-full-path.md), and it is fixed.

The one practical consequence: an aspect on a controller method runs **after**
argument resolution, so it observes the DTO the client sent only after binding
and validation have already succeeded. A request rejected by `@Valid` never
reaches the aspect. If your rule must see rejected input, it does not belong in
an aspect.

## Gotchas

**⚠️ `@Aspect` on a class that is not a bean**
**Symptom:** the advice silently never runs.
**Cause:** `@Aspect` marks the aspect; it does not register the bean.
**Fix:** add `@Component` too (or declare it with an `@Bean` method).

**⚠️ Self-invocation**
**Symptom:** `@Transactional`, `@Async`, `@Cacheable` or your own advice does
nothing on an internal call.
**Cause:** `this.method()` bypasses the proxy.
**Fix:** move the method to another bean, inject a self-reference, or — as a last
resort — `AopContext.currentProxy()` with `exposeProxy = true`. All three shown
above.

**⚠️ Advising a `private` or `final` method**
**Symptom:** no advice, no error.
**Cause:** CGLIB advises by subclassing and overriding; neither modifier can be
overridden.
**Fix:** make the method public or protected and non-final, or move to AspectJ
weaving.

**⚠️ An aspect that swallows the exception**
**Symptom:** failures return 200 with a `null` body.
**Cause:** an `@Around` advice that catches and does not rethrow, or one that
forgets to return `proceed()`'s result.
**Fix:** rethrow in the catch, as in the audit aspect above; an `@Around` that
logs must still return or rethrow.

**⚠️ An aspect reaching for `RequestContextHolder`**
**Symptom:** it works over HTTP and throws in a scheduled job, a message
listener or a test.
**Cause:** the request-bound thread state does not exist outside a request, and
does not follow the work onto another thread.
**Fix:** pass what the aspect needs as a method parameter, or move the concern
up to an interceptor or filter, which have the request legitimately.
[Chunk 10](10-threads-scope-and-async.md) covers the threading half.

**⚠️ Still depending on `spring-boot-starter-aop`**
**Symptom:** the dependency cannot be resolved on Boot 4.
**Cause:** it was renamed to `spring-boot-starter-aspectj`.
**Fix:** rename it — and first check whether you need it at all, since
proxy-based Spring advice works without it.

## Interview questions

**★ What can an aspect see that an interceptor cannot, and vice versa?**
An aspect sees the resolved, typed arguments and the return value of a Java
method — your DTOs and domain objects, after binding and validation. An
interceptor sees the raw `HttpServletRequest` and the `HandlerMethod`, but the
arguments have not been resolved yet, so it has the *signature* and not the
*values*. Neither can see the other's world without reaching outside its own
abstraction.

**★ Why does `@Transactional` do nothing when a method calls another method in the same class?**
Because Spring's advice is applied by a proxy that wraps the bean. External
callers hold the proxy, so calls through them are advised; but once execution is
inside the target object, `this.other()` is an ordinary Java call on the target
reference and the proxy is not involved. The documentation states it directly:
"self invocation is not going to result in the advice associated with a method
invocation getting a chance to run."

**★ Someone proposes an aspect that checks the caller's role before a service method. Good idea?**
As a *second* layer, yes — Spring's own method security is exactly that, an
aspect. As the *only* layer, no: it runs after routing, after binding and after
validation, so it cannot protect anything that never reaches a method, and it
never sees requests security should have rejected outright. The first line is
the filter chain. Method-level checks are defence in depth on top, and the
trade-off is argued in
[Topic 11, chunk 8](../11-spring-security/08-method-vs-url-security.md).

**★ Where does an aspect belong in the request pipeline, and can you change that?**
Innermost, inside the controller invocation, and no — there is nothing to
configure. A filter wraps `DispatcherServlet`, which runs interceptors, which
invokes the handler through the AOP proxy. `@Order` only sequences aspects
relative to each other on the same join point.

**★ Give me a concern where AOP is clearly the right answer.**
Auditing a domain action. The rule is stated in domain terms ("record every
completed transfer with its amount and both accounts"), it needs the typed
arguments and the return value, and it must apply however the action was
triggered — HTTP request, message listener, batch job. A filter would have to
re-parse the body and would miss the non-HTTP callers entirely; an interceptor
would miss them too and would only see unresolved parameters.

---

← Prev: [Interceptors](03-interceptors.md) · Index: [Phase 9 — Spring Boot and the web](../README.md) · Next → [The decision table](05-the-decision-table.md)
