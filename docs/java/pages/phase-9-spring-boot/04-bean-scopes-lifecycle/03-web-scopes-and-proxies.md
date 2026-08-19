---
title: "Web scopes and scoped proxies"
sidebar_label: "3 · Web scopes and proxies"
sidebar_position: 3
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-19 against the Spring Framework reference — *Request,
> Session, Application, and WebSocket Scopes* and *Scoped Beans as Dependencies*
> (docs.spring.io/spring-framework/reference/core/beans/factory-scopes.html —
> the proxy mechanism, `proxy-target-class` / `TARGET_CLASS` vs `INTERFACES`, the
> note that CGLIB proxies do not intercept private methods, and the
> `@RequestScope`/`@SessionScope`/`@ApplicationScope` composed annotations).
> Spring Boot 4.1.0, Spring Framework 7.0.x, JDK 25.

**A request-scoped bean injected into a singleton is the prototype trap again,
with a sharper edge: at startup there is no request to resolve against at all.
The fix is not a different injection style but a different *object* — Spring
hands the singleton a proxy that looks like the bean and, on every call, goes
and finds whichever real instance belongs to the request currently in flight.
Once you see the injected field as a permanent stand-in rather than as the bean,
every surprising thing about web scopes becomes predictable.**

## The web scopes, and the same problem again

`request`, `session`, `application` and `websocket` exist only in a web-aware
context. Boot provides the composed annotations:

```java
@Component
@RequestScope                       // == @Scope(value="request", proxyMode=TARGET_CLASS)
public class RequestContext {
    private String traceId;
    // per-request state lives HERE, safely
}
```

A `request`-scoped bean injected into a singleton has the identical lifetime
mismatch — resolved once at startup, when there is no request at all. The
documented fix is a **scoped proxy**:

> the proxy *"exposes the same public interface as the scoped object but that
> can also retrieve the real target object from the relevant scope (such as an
> HTTP request) and delegate method calls onto the real object."*

So the singleton holds one proxy forever, and each method call goes to whichever
request-scoped instance belongs to the current request. `@RequestScope`,
`@SessionScope` and `@ApplicationScope` include `proxyMode = TARGET_CLASS`
already, which is why they usually "just work" and plain
`@Scope("request")` does not.

### `TARGET_CLASS` versus `INTERFACES`

- **`TARGET_CLASS`** — a CGLIB class-based proxy. Works without an interface.
  ⚠️ The docs note **CGLIB proxies do not intercept private methods**, and the
  class needs a non-final class and non-final methods.
- **`INTERFACES`** — a JDK dynamic proxy. Requires the class to implement at
  least one interface, and *"all collaborators must reference the bean through
  an interface"*. Avoids CGLIB but constrains the design.

## The trade-off

Every non-singleton scope buys per-lifetime state and charges for it:

- **Prototypes charge you the destruction callback.** No `@PreDestroy`, ever, and
  the docs hand the cleanup obligation to you. If you were going to manage the
  lifetime yourself anyway, `new` is simpler and more honest than a scope
  annotation plus a provider.
- **Web scopes charge you a proxy.** An extra hop on every call, an object that
  is not the bean when you inspect it in a debugger, and a `NullPointerException`
  waiting in any code path that runs outside a request — a `@Scheduled` job, an
  `ApplicationRunner`, an `@Async` method on a thread with no request bound.
- **Both charge you comprehension.** A reader now has to know the scope to
  reason about the object, and the scope is one annotation on a class they are
  probably not looking at.

Most designs are better served by passing the per-request value as a parameter.

## Gotchas

**Symptom:** `@Scope("request")` on a bean injected into a service, and startup fails
or the bean is stale
**Cause:** without a proxy mode there is nothing to defer resolution, and at startup
there is no request to resolve against
**Fix:** use `@RequestScope`, which is `@Scope(value="request", proxyMode=TARGET_CLASS)`,
so the singleton holds a proxy that resolves per request

**Symptom:** a request-scoped bean throws when touched from a `@Scheduled` job or an
`@Async` method
**Cause:** the proxy resolves against the current request, and those threads have none
bound
**Fix:** do not reach for request state off the request thread. Pass the values the job
needs as parameters, or capture them while still on the request thread

**Symptom:** a private method on a scoped-proxied bean does not behave as expected
**Cause:** documented CGLIB limitation — class-based proxies do not intercept private
methods
**Fix:** make the method non-private if it must be intercepted, or restructure so the
interception point is a public entry

**Symptom:** switching a scoped proxy to `INTERFACES` breaks compilation across several
collaborators
**Cause:** with a JDK dynamic proxy the injected type is the interface, and the docs
require all collaborators to reference the bean through it
**Fix:** either introduce the interface everywhere deliberately, or stay on
`TARGET_CLASS`, which is the default for the composed annotations for this reason

**Symptom:** a debugger shows the injected field as a `$$SpringCGLIB$$` type rather
than the bean, and `equals` comparisons behave oddly
**Cause:** the field genuinely holds the proxy, not the target — that is the mechanism
**Fix:** nothing to fix, but stop comparing identity on scoped beans and read state
through their methods, which is what the proxy delegates

**Symptom:** session-scoped state grows until the application runs out of memory
**Cause:** `session` scope keeps an instance per HTTP session for the session's
lifetime, and sessions outlive requests by a long way
**Fix:** keep session-scoped beans tiny, or hold the identifier in the session and the
data in a real store. A session is not a cache

## Interview questions

**★ Name the six scopes and say which need a web-aware context.**
`singleton` (default), `prototype`, `request`, `session`, `application` and
`websocket`. The last four are web-only: `request` is one instance per HTTP
request, `session` per HTTP session, `application` per `ServletContext`, and
`websocket` per WebSocket lifecycle. In a typical service almost everything is
`singleton`, and each departure from that should be justifiable.

**★ Why does a request-scoped bean need a scoped proxy to be used from a singleton?**
Because the singleton is created once, at startup, when no request exists — a
direct injection would either fail or capture one instance forever. The proxy
exposes the same public interface, and on each method call retrieves the real
target from the current request scope and delegates to it. `@RequestScope`,
`@SessionScope` and `@ApplicationScope` bundle `proxyMode = TARGET_CLASS`, which
is why they work out of the box while a bare `@Scope("request")` does not.

**★ `TARGET_CLASS` versus `INTERFACES` — what is the trade?**
`TARGET_CLASS` uses CGLIB to subclass the target, so it works with no interface
at all, at the cost of requiring a non-final class and non-final methods — and
the docs note that CGLIB proxies do not intercept private methods. `INTERFACES`
uses a JDK dynamic proxy, avoiding CGLIB, but the class must implement an
interface and every collaborator must reference the bean through that interface.
`TARGET_CLASS` is the default in the composed annotations because it constrains
the design less.

**★ What breaks when request-scoped state is touched outside a request?**
The proxy has no scope to resolve against, so a `@Scheduled` job, an
`ApplicationRunner` or an `@Async` method that touches it fails at that point.
This is the practical argument for treating request-scoped beans as a last
resort: a plain method parameter carries the same value with no thread affinity
and no proxy, and it keeps working when the code is later called from somewhere
you did not anticipate.

**★ What is actually in the field when you inject a scoped bean into a singleton?**
A proxy, permanently — one object, created once, that never changes. It is not
the bean and it is not swapped out per request; it simply delegates each call to
whichever real instance the current scope holds. Understanding that is what makes
the failure modes predictable: it explains why the debugger shows a generated
type, why identity comparisons are meaningless, and why calling it from a thread
with no request bound fails at the moment of the call rather than at injection.

---

← Prev: [Prototype scope and the singleton trap](02-prototype-and-the-trap.md) · Index: [Phase 9 — Spring Boot and the web](../README.md) · Next → [Lifecycle callbacks](04-lifecycle-callbacks.md)
