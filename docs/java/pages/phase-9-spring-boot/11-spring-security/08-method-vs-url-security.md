---
title: "Method security vs URL rules"
sidebar_label: "8 · Method vs URL rules"
sidebar_position: 8
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-19 against the Spring Security reference — *Method Security*
> (docs.spring.io/spring-security/reference/servlet/authorization/method-security.html
> — the `AuthorizationManagerBeforeMethodInterceptor` /
> `AuthorizationManagerAfterMethodInterceptor` implementation, "built using
> native Spring AOP", the `offset` attribute for ordering against
> `@Transactional`, and the unannotated-methods warning). Spring Boot 4.1.0,
> Spring Security 7.x, JDK 25.

**Method security is Spring AOP wearing a security hat, so every proxy
limitation you already know applies to it unchanged — and it is default-open,
where URL rules are default-closed. Those two facts decide what each layer is
for, and they are the reason the answer to "method security or URL rules" is
always "both, for different jobs".**

## It is AOP, and that is the whole mechanism

Two interceptors do the work:

- `AuthorizationManagerBeforeMethodInterceptor` — `@PreAuthorize`, `@PreFilter`
- `AuthorizationManagerAfterMethodInterceptor` — `@PostAuthorize`, `@PostFilter`

The reference notes it is "built using native Spring AOP, allowing Spring AOP
customizations", and that `@EnableMethodSecurity` supersedes the deprecated
`@EnableGlobalMethodSecurity` by using the simplified `AuthorizationManager` API
instead of the old voters and decision managers.

Being AOP means it is a **proxy**, and everything in
[proxies and self-invocation](../02-the-ioc-container/05-proxies-and-self-invocation.md)
carries over exactly.

### Self-invocation bypasses it, silently

```java
@Service
public class OrderService {

    public void process(Long id) {
        cancel(id);            // ⛔ internal call — never touches the proxy
    }

    @PreAuthorize("hasRole('ADMIN')")
    public void cancel(Long id) { ... }
}
```

`cancel` is protected when another bean calls it and unprotected when `process`
calls it. Nothing warns you. The two call paths look identical in the source and
differ entirely in whether a security check runs.

The design fix is to move `cancel` onto a different bean, so every call is
external and goes through the proxy:

```java
@Service
public class OrderCancellationService {
    @PreAuthorize("hasRole('ADMIN')")
    public void cancel(Long id) { ... }
}

@Service
public class OrderService {
    private final OrderCancellationService cancellation;   // injected → proxy
    public void process(Long id) { cancellation.cancel(id); }
}
```

Self-injection (injecting the bean into itself and calling through the field)
also works and is a patch rather than a fix — it leaves the class with two ways
to call its own method, one safe and one not.

### Private and final methods are never advised

A JDK dynamic proxy implements interfaces; a CGLIB proxy subclasses the class.
Neither can intercept a `private` method, and a subclass cannot override a
`final` one. An annotation on either is inert, with no error.

### Ordering against `@Transactional`

`@Transactional` is also interceptor-based, so the relative order decides whether
the security check happens inside or outside the transaction. The reference
exposes the knob:

```java
@EnableMethodSecurity(offset = 10)
```

This matters for `@PostAuthorize` on a method that has written: if security runs
inside the transaction, the denial can roll the write back; if outside, it
cannot. The better answer is usually to not need the ordering — authorize before
writing — but the knob is there when the design is already fixed.

## 🔴 Unannotated methods are not secured

> When you use annotation-based Method Security, then unannotated methods are
> not secured. To protect against this, declare a catch-all authorization rule
> in your `HttpSecurity` instance.

That sentence is the crux of this chunk. Method security is **default-open**: a
new method with no annotation is reachable by anyone who can reach the object.
URL security with `anyRequest().authenticated()` is **default-closed**: a new
endpoint nobody wrote a rule for requires a login.

The consequence is not theoretical. Over the life of a codebase, methods get
added by people who did not read the security configuration. With URL rules as
the outer layer, those methods are behind a login by default. Without them, they
are public by default, and the only thing standing between you and an incident
is that everybody remembered.

## The honest comparison

| | URL rules | Method security |
|---|---|---|
| Where the policy lives | one file | scattered across services |
| Default for something new | **closed** (`anyRequest()`) | **open** |
| Can it see the domain object? | no | yes (`@PostAuthorize`, `@PostFilter`) |
| Covers non-HTTP entry points | no | yes |
| Reviewable in one sitting | yes | no |
| Survives refactoring | mostly | breaks silently on internal calls |
| Enabled by default | yes | **no** |

**Use both, for different jobs.**

- **URL rules are the perimeter and the reviewable statement of policy.** What
  is public, what needs a login, what needs an admin role. One file, ordered,
  default-closed, and readable by somebody who does not know the codebase.
- **Method security is for decisions that need the domain object** — ownership,
  tenancy, state-dependent permissions — **and for behaviour reachable without
  HTTP**: a `@Scheduled` job, a `@KafkaListener`, a CLI runner. A URL rule
  cannot protect any of those, because there is no URL.

What method security should *not* be is a second copy of the URL policy. Two
descriptions of the same rule drift apart, and when they do, the one that is
wrong is whichever one you did not read.

## The case for putting rules on the service, not the controller

When method security is used, it belongs on the **service** layer rather than
the controller. A rule on a controller method is a worse URL rule — it protects
one entry point and nothing else. A rule on the service protects every caller,
which is the whole reason to be at this layer at all.

The cost is that service methods now depend on there being a `SecurityContext`,
which brings back [chunk 4](04-the-threadlocal-caveat.md): call that service
from an `@Async` method or a scheduled job without propagating the context and
`@PreAuthorize` denies a request that should have succeeded. Method security and
the ambient identity are the same design bet, made twice.

## Gotchas

**Symptom:** A method is protected from other beans and not from its own class.
**Cause:** Self-invocation bypasses the proxy.
**Fix:** Move the method to another bean and inject it — shown above. Self-
injection is the patch if the move is impractical.

**Symptom:** `@PreAuthorize` on a `private` or `final` method does nothing.
**Cause:** Neither can be advised by a proxy.
**Fix:** Make it a public, non-final method on a Spring bean.

**Symptom:** Method security works from a controller and not from a `@Scheduled`
job that calls the same service.
**Cause:** No `SecurityContext` on the scheduler thread, so the rule sees an
empty authentication.
**Fix:** Give the job a deliberate identity — [chunk 4](04-the-threadlocal-caveat.md).

**Symptom:** The security check runs outside the transaction, or inside it, and
you needed the opposite.
**Cause:** Interceptor ordering between method security and `@Transactional`.
**Fix:** `@EnableMethodSecurity(offset = ...)`.

**Symptom:** Method security passes in a `@WebMvcTest` and fails in production,
or the reverse.
**Cause:** The slice does not load your `@EnableMethodSecurity` configuration or
the real service beans it advises, so nothing is proxied.
**Fix:** Import the configuration into the slice, or test method security at the
service layer in a context that includes it.

**Symptom:** A new endpoint was public for months.
**Cause:** Method security only, with no catch-all URL rule; the new service
method had no annotation.
**Fix:** Keep `anyRequest().authenticated()` as the outer layer, always. This is
the failure the reference's own warning is about.

**Symptom:** After extracting a helper method for readability, a rule stopped
applying.
**Cause:** The extraction turned an external call into an internal one.
**Fix:** Nothing about the refactor looks security-relevant, which is exactly
why the rule belongs on a bean boundary rather than on a method that might be
inlined or extracted by anyone.

## Interview questions

**★ Why is method security bypassed by an internal call?**
Because it is implemented with Spring AOP proxies. A call from one method of an
object to another goes through `this`, never the proxy, so no interceptor runs.
The same limitation applies to `@Transactional` and every other proxy-based
annotation; private and final methods cannot be advised at all.

**★ Method security or URL rules — which do you use?**
Both, for different things. URL rules are the perimeter, live in one reviewable
file, and are default-closed. Method security handles decisions that need the
domain object and behaviour with no URL at all, and it is default-open. Dropping
the URL layer gives up the property that code nobody thought about is denied.

**★ Someone proposes deleting the URL rules because every service method is annotated. Objection?**
That method security is default-open and not enabled by default. Every method
someone forgets to annotate is unprotected, and nothing reports it — no startup
warning, no test failure. `anyRequest().authenticated()` is the only thing
making the unknown case safe.

**★ Controller or service — where do the annotations belong?**
The service. An annotation on a controller method is a strictly worse URL rule:
it protects one entry point and nothing else. On the service it protects every
caller, which is the only reason to be at this layer rather than the URL layer.

**★ What does a service-layer `@PreAuthorize` assume, and when is that assumption false?**
That a `SecurityContext` exists on the current thread. It is false for scheduled
jobs, message listeners, `@Async` work and anything on a new thread — where the
rule will deny a legitimate operation, or, if propagation was configured
carelessly, evaluate against the wrong identity.

**★ How would you control whether the security check runs inside the transaction?**
`@EnableMethodSecurity(offset = ...)` shifts the security advisor relative to the
transaction advisor. It matters when a `@PostAuthorize` denial needs to roll back
work the method already did — though redesigning so the authorization happens
before the write is nearly always better than tuning advisor order.

**★ Why did `@EnableMethodSecurity` replace `@EnableGlobalMethodSecurity`?**
Because the newer implementation is built on the simplified `AuthorizationManager`
API instead of the old voter/decision-manager stack, uses native Spring AOP so
ordinary AOP customisation applies, checks for conflicting annotations, and
enables the core annotations by default. The old annotation is deprecated.

---

← Prev: [Method security: the annotations](07-method-security.md) · Index: [Phase 9 — Spring Boot and the web](../README.md) · Next → [The stateless JWT resource server](09-jwt-resource-server.md)
