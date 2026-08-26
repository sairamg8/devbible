---
title: "The bean you injected is not the object you wrote, and which kind of impostor it is decides what the annotation can reach"
sidebar_label: "2 · The proxy"
sidebar_position: 2
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 against the Spring Framework 7.0 reference *Core → AOP →
> Proxying mechanisms*
> ([docs.spring.io/spring-framework/reference/core/aop/proxying.html](https://docs.spring.io/spring-framework/reference/core/aop/proxying.html)),
> the `@EnableTransactionManagement` javadoc
> ([docs.spring.io/spring-framework/docs/current/javadoc-api/org/springframework/transaction/annotation/EnableTransactionManagement.html](https://docs.spring.io/spring-framework/docs/current/javadoc-api/org/springframework/transaction/annotation/EnableTransactionManagement.html))
> and the Spring Boot 4.1 `AopAutoConfiguration` javadoc
> ([docs.spring.io/spring-boot/docs/current/api/org/springframework/boot/autoconfigure/aop/AopAutoConfiguration.html](https://docs.spring.io/spring-boot/docs/current/api/org/springframework/boot/autoconfigure/aop/AopAutoConfiguration.html)).
> JDK 25, Spring Boot 4.1.0, Spring Framework 7.0.8.

**When Spring finds `@Transactional` on a bean, it does not modify your class. It
builds a second object that stands in front of yours, and injects that one
everywhere your bean is wanted. There are two ways it can build that object, they
have different limits, and the default is different in bare Spring Framework than
it is in Spring Boot. Everything the annotation can and cannot reach — a private
method, a `final` method, a call from inside the class — is a consequence of
which impostor you got and how it was made. This chunk is the mechanism; the next
three are the failures it produces.**

## Two ways to build a stand-in

The reference states the rule in one sentence:

> *"If the target object to be proxied implements at least one interface, a JDK
> dynamic proxy is used, and all of the interfaces implemented by the target type
> are proxied. If the target object does not implement any interfaces, a CGLIB
> proxy is created which is a runtime-generated subclass of the target type."*

### JDK dynamic proxy — a sibling, not a subclass

`java.lang.reflect.Proxy` generates a class at runtime that implements the
interfaces you name and routes every call to an `InvocationHandler`. Spring holds
your real bean inside that handler.

```java
public interface OrderService {                       // the proxied type
    long placeOrder(NewOrder order);
}

@Service
class DefaultOrderService implements OrderService {   // the target
    @Transactional
    public long placeOrder(NewOrder order) { ... }
}
```

The proxy `implements OrderService`. It is **not** a `DefaultOrderService` and
never will be — so a field declared as `DefaultOrderService` cannot be injected
with it, and only methods **declared on the interface** exist to be intercepted.

### CGLIB proxy — a runtime subclass

CGLIB (repackaged inside `spring-core`) generates a subclass of your concrete
class and overrides every method it is allowed to override, delegating to the
real instance. The proxy **is** an `OrderService` in the `instanceof` sense, so
concrete-type injection works, and any overridable method can be advised.

## The limits, and where they come from

Both mechanisms share one property: **they can only intercept what they can
override or implement.** The reference's CGLIB list falls straight out of that:

> - *"`final` classes cannot be proxied, because they cannot be extended."*
> - *"`final` methods cannot be advised, because they cannot be overridden."*
> - *"`private` methods cannot be advised, because they cannot be overridden."*
> - *"Methods that are not visible – for example, package-private methods in a
>   parent class from a different package – cannot be advised because they are
>   effectively private."*

Two more from the same page, worth knowing before they bite:

- *"The constructor of your proxied object will not be called twice, since the
  CGLIB proxy instance is created through Objenesis. However, if your JVM does
  not allow for constructor bypassing, you might see double invocations and
  corresponding debug log entries from Spring's AOP support."*
- *"Your CGLIB proxy usage may face limitations with the Java Module System… you
  cannot create a CGLIB proxy for a class from the `java.lang` package when
  deploying on the module path."*

⚠️ **`static` methods are absent from that list because they are not even a
question.** A static method is not dispatched on an instance, so there is no
proxy in the call at all. `@Transactional` on a `static` method is unreachable by
construction — and so is a call written as `new OrderService().placeOrder(o)`,
because that reference is the target, never the proxy.

## The default is not the same in Framework and in Boot

This is the single most common source of "it works on my colleague's project".

| | Setting | Default | Result |
|---|---|---|---|
| Spring Framework 7.0.8 | `@EnableTransactionManagement(proxyTargetClass = …)` | **`false`** | JDK proxy when interfaces exist, CGLIB otherwise |
| Spring Boot 4.1 | `spring.aop.proxy-target-class` | **`true`** | **CGLIB always** |

The `@EnableTransactionManagement` javadoc gives the Framework default as
`false`, with a warning attached: *"Note that setting this attribute to `true`
will affect all Spring-managed beans requiring proxying, not just those marked
with `@Transactional`."*

Boot's `AopAutoConfiguration` javadoc gives Boot's default as `true`, meaning
**CGLIB proxies**, with `spring.aop.auto` (default `true`) controlling whether
the auto-configuration runs at all.

🔴 **Practical consequence: in a Spring Boot application, you almost certainly
have CGLIB subclass proxies even for beans that implement interfaces.** So the
old advice "extract an interface and it will work" solves nothing you had, and
the `final class` you wrote for immutability is the thing that breaks.

## Choosing, if you get to choose

| Want | Choose | Cost |
|---|---|---|
| concrete-class injection, all overridable methods advised | CGLIB (`proxy-target-class=true`) | no `final` classes or methods on proxied beans |
| a hard boundary at the interface, no subclassing | JDK (`false`) | every advised method must be on the interface and `public` |
| self-invocation to work as well | neither — AspectJ weaving (chunk 4) | build-time or agent setup |

There is no per-bean switch in proxy mode. The choice is application-wide, which
is exactly why it should be made once and written down rather than discovered.

## Gotchas

**⚠️ A `final` class annotated `@Transactional`**
**Symptom:** in a Boot application (CGLIB by default), context startup fails, or
the bean is used unproxied and the annotation does nothing.
**Cause:** CGLIB proxies are subclasses, and a final class cannot be extended.
**Fix:** drop `final` from the class, or give it an interface *and* set
`spring.aop.proxy-target-class=false` — which then affects every proxy in the
application.

**⚠️ A `final` method inside a proxied class**
**Symptom:** every other method in the class is transactional; this one silently
is not.
**Cause:** CGLIB cannot override it, so no advice is applied to it.
**Fix:** remove `final`. There is no configuration that fixes this in proxy mode.

**⚠️ Kotlin classes and methods being final by default**
**Symptom:** the same two failures, on a codebase where nobody wrote `final`.
**Cause:** Kotlin classes and members are `final` unless declared `open`.
**Fix:** the `kotlin-spring` compiler plugin, which opens Spring-annotated
classes. (This bible is Java; the trap is listed because mixed codebases hit it.)

**⚠️ Injecting the concrete class when a JDK proxy is in play**
**Symptom:** startup failure — no qualifying bean of type
`DefaultOrderService` — or a `ClassCastException` on `getBean`.
**Cause:** a JDK proxy implements the interfaces and is not an instance of your
class.
**Fix:** inject the interface. In Boot the default is already CGLIB, so seeing
this failure means somebody set `proxy-target-class=false` deliberately.

**⚠️ `@Transactional` on a `static` method**
**Symptom:** absolutely nothing happens, with no diagnostic.
**Cause:** static dispatch never touches an instance, so it never touches the
proxy.
**Fix:** make it an instance method on a bean.

**⚠️ Constructing the bean with `new` in a test or a helper**
**Symptom:** a test that proves the method commits atomically, against a service
that does not.
**Cause:** `new DefaultOrderService(...)` gives you the target, not the proxy.
**Fix:** obtain the bean from the context. A transaction test that does not go
through the container is testing your method body, not your boundary.

**⚠️ Setting `proxyTargetClass = true` to fix one bean**
**Symptom:** unrelated beans start failing to start, or an interface-typed
injection point that used to work stops.
**Cause:** the javadoc's warning — the flag "will affect all Spring-managed beans
requiring proxying".
**Fix:** treat it as an application-wide decision, made once. In Boot it has
already been made for you (`true`).

**⚠️ Debug logs about a constructor running twice**
**Symptom:** side effects in a constructor happening twice on a proxied bean.
**Cause:** CGLIB normally bypasses the constructor via Objenesis; on a JVM that
does not allow constructor bypassing you get double invocation.
**Fix:** keep constructors free of side effects — good practice regardless, and
the only reliable defence.

**⚠️ Proxying a class from `java.*` on the module path**
**Symptom:** proxy creation failure that no amount of Spring configuration fixes.
**Cause:** the module system will not let CGLIB define a subclass in a sealed
JDK package; the `--add-opens` escape hatch is not available for modules.
**Fix:** proxy your own types. This is a sign the design has put advice somewhere
it does not belong.

## Interview questions

**★ How does Spring decide between a JDK dynamic proxy and a CGLIB proxy?**
By default it looks at the target class: if it implements at least one interface,
a JDK dynamic proxy implementing all of those interfaces is created; if it
implements none, CGLIB generates a runtime subclass. That default can be
overridden — `@EnableTransactionManagement(proxyTargetClass = true)` or, more
broadly, `spring.aop.proxy-target-class`. The crucial detail for anyone working
in Spring Boot is that Boot flips the default: `AopAutoConfiguration` sets
`spring.aop.proxy-target-class` to `true`, so a Boot application gets CGLIB
subclass proxies even for beans that do implement interfaces.

**★ Why can a `final` method not be transactional in proxy mode?**
Because a proxy intercepts by *overriding*. A CGLIB proxy is a generated subclass
whose overridden methods call the interceptor before delegating to the real
instance; a `final` method cannot be overridden, so the generated subclass
inherits your implementation verbatim and there is nowhere for the advice to run.
A JDK proxy has the same problem in a different shape — it can only intercept
methods declared on the proxied interfaces, and `final` is irrelevant there
because interface methods are never final. The failure is silent: the class is
still proxied, most of its methods are still advised, and just this one quietly
is not.

**★ Why does `@Transactional` on a `static` method not even produce a warning?**
Because there is no interception point to warn about. A proxy works by standing
between a caller and an *instance*; static dispatch resolves at the class level
and never passes through an instance reference, so the proxy is not in the call
path at all. From Spring's point of view nothing unusual happened — no bean
method was invoked. The annotation is simply metadata in the class file that
nothing reads. The same reasoning explains why `new MyService().doWork()` does
nothing: you are holding the target object, not the proxy.

**★ Someone proposes `spring.aop.proxy-target-class=false` to make a `final`
class proxyable. What do you say?**
That it is the wrong lever. Setting it to `false` does not make a final class
proxyable — it means Spring prefers JDK proxies *when interfaces exist*, so the
final class must also gain an interface, every advised method must be public and
declared on it, and every injection point must be typed to the interface rather
than the class. And the setting is global: it changes the proxy strategy for
every proxied bean in the application, which can break concrete-type injection
somewhere unrelated. Removing `final` from the one class is a one-word change
with no blast radius, and `final` on a Spring-managed service was not buying much
anyway.

**★ You are told a bean is proxied but a breakpoint in the interceptor never
fires for one particular method. What are the candidate causes?**
In order of likelihood: the method is `private` (never advisable), `final` (not
overridable under CGLIB), or `static` (no instance dispatch at all); the call is
a self-invocation from another method of the same class, so the proxy was
bypassed; under a JDK proxy the method is not declared on the proxied interface;
the object in hand was created with `new` or unwrapped from the proxy; or there
is no transaction attribute for the method because neither it nor its class
carries an annotation that applies. Each of those is silent — none produces a
warning — which is why the diagnosis has to be a checklist rather than a log
search.

**★ A CGLIB proxy is a subclass. Does that mean your constructor runs twice?**
Normally no, and the reference explains why: "The constructor of your proxied object
will not be called twice, since the CGLIB proxy instance is created through Objenesis."
Objenesis instantiates the generated subclass without invoking any constructor at all,
so you get one construction — the real bean's — and a proxy that delegates to it. The
caveat in the same sentence is the one to remember: "However, if your JVM does not
allow for constructor bypassing, you might see double invocations and corresponding
debug log entries from Spring's AOP support." So it is a JVM-dependent guarantee, not
an absolute one. The practical conclusion is a design rule rather than a configuration
one: keep constructors free of side effects. A constructor that only assigns fields is
safe under either behaviour, and one that opens a connection or registers a listener is
a latent double-execution bug on some JVM you have not tried yet.

**★ How would you check at runtime which kind of proxy a bean actually got?**
`AopUtils` has the three predicates and they are worth knowing by name:
`isAopProxy(Object)` — "Check whether the given object is a JDK dynamic proxy or a
CGLIB proxy" — plus `isJdkDynamicProxy` and `isCglibProxy` for the specific answer.
Each of them, per the javadoc, goes beyond the plain JDK or `ClassUtils` check "by
additionally checking if the given object is an instance of `SpringProxy`", so they
answer "is this a *Spring* proxy" rather than merely "is this a generated class".
`AopUtils.getTargetClass(Object)` then gives you what is underneath — "the target class
for an AOP proxy or the plain class otherwise" — which is the call you want when a log
line or an error message shows a mangled `$$SpringCGLIB$$` name and you need the real
type. This is a diagnostic tool, not something to branch on in production code: a
service that asks whether it is proxied has already lost the argument.

**★ Why does the module system break CGLIB proxying of JDK classes, and what is that
telling you?**
Because a CGLIB proxy must define a subclass, and defining a subclass of a
`java.lang` class means defining a class *in* that package — which the module system
seals. The reference states the limitation plainly: "Your CGLIB proxy usage may face
limitations with the Java Module System… you cannot create a CGLIB proxy for a class
from the `java.lang` package when deploying on the module path." There is no Spring
setting that fixes it, and the `--add-opens` escape used for reflective access does not
apply to defining new classes in a sealed package. The useful reading is the design
one: if your transaction advice needs to be applied to a JDK type, the boundary has
been put on the wrong object. Proxy your own service types, which you control and can
keep non-final.

---

← Prev: [1 · Not a language feature](01-not-a-language-feature.md) · Index: [04 · Spring @Transactional](README.md) · Next → [2b · Where the annotation lives](02b-where-the-annotation-lives.md)
