---
title: "Initialization code is the one shape that fails twice, because the proxy has not been built yet and no reference to it exists to be had"
sidebar_label: "3b · The initialization variant"
sidebar_position: 7
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 against the Spring Framework 7.0 reference *Using
> `@Transactional`*
> ([docs.spring.io/spring-framework/reference/data-access/transaction/declarative/annotations.html](https://docs.spring.io/spring-framework/reference/data-access/transaction/declarative/annotations.html))
> and *Core → AOP → Proxying mechanisms*
> ([docs.spring.io/spring-framework/reference/core/aop/proxying.html](https://docs.spring.io/spring-framework/reference/core/aop/proxying.html)).
> JDK 25, Spring Boot 4.1.0, Spring Framework 7.0.8.

**Every fix in [chunk 4](04-fixing-self-invocation.md) works the same way: get a
reference to the proxy into the call. This shape is the one where that is not
available, because at the moment your code runs the proxy has not been created.
The reference gives it its own warning sentence, and it is the reason startup
data loading is so often silently untransactional.**

## The code

```java
@Service
public class ReferenceDataService {

    @PostConstruct
    void warmCache() {
        loadAll();                 // ← same trap as chunk 3, plus a second one
    }

    @Transactional(readOnly = true)
    public void loadAll() { ... }
}
```

> *"Also, the proxy must be fully initialized to provide the expected behavior,
> so you should not rely on this feature in your initialization code — for
> example, in a `@PostConstruct` method."*

## Two problems, not one

- `warmCache()` calls `loadAll()` on `this`. That is the ordinary self-invocation
  from [chunk 3](03-the-self-invocation-trap.md).
- Even if the call *did* go through a proxy, `@PostConstruct` runs **during** bean
  creation. Spring's order is: instantiate → populate properties → run
  `BeanPostProcessor`s' `postProcessBeforeInitialization` → run initialization
  callbacks (`@PostConstruct`, `afterPropertiesSet`, a custom init method) → run
  `postProcessAfterInitialization`. **The proxy is created in that last step.**
  While your `@PostConstruct` body is executing, the proxy for this bean does not
  exist.

**That second point is what makes this shape different from every other one.**
Self-injection, `AopContext`, an injected collaborator — each of those is a way
of obtaining a proxy reference. Here there is no proxy yet to obtain.

## The same applies to more than `@PostConstruct`

| Where the code runs | Proxy exists? | Transactional? |
|---|---|---|
| constructor body | no — the object is still being built | never |
| a field initialiser | no | never |
| `@PostConstruct` | no — runs before the proxy is created | never |
| `InitializingBean.afterPropertiesSet()` | no — same phase | never |
| a custom `initMethod` on `@Bean` | no — same phase | never |
| `@EventListener(ContextRefreshedEvent.class)` | yes — the context is refreshed | **yes** |
| `@EventListener(ApplicationReadyEvent.class)` | yes | **yes** |
| `ApplicationRunner` / `CommandLineRunner` | yes | **yes** |

**Nothing you do in a bean's own initialization is transactional. Everything you
do after the context is refreshed can be.** The dividing line is exactly the end
of bean creation.

## The fix: move the work out of initialization

```java
@Component
class ReferenceDataWarmer {

    private final ReferenceDataService service;    // the PROXY, fully built

    ReferenceDataWarmer(ReferenceDataService service) { this.service = service; }

    @EventListener(ApplicationReadyEvent.class)
    void warm() {
        service.loadAll();                         // external call → intercepted
    }
}
```

By the time `ApplicationReadyEvent` fires, every bean in the context exists and
every proxy has been built. The call is external, through an injected reference,
and the annotation is honoured.

⚠️ **Which event you choose matters.** `ContextRefreshedEvent` fires when the
application context is refreshed, which in a web application is before the
server has started accepting requests; `ApplicationReadyEvent` is a Spring Boot
event that fires after the application is fully started. For warming a cache
before traffic arrives, `ApplicationReadyEvent` is usually what you want, and it
also fires exactly once, where `ContextRefreshedEvent` can fire more than once in
a hierarchical context.

## Why the obvious workarounds do not work here

**Self-injection.** Injecting the bean into itself and calling
`self.loadAll()` is the standard trick, and it is genuinely useful elsewhere. In
a `@PostConstruct` it does not save you: the field is populated during property
population, which happens *before* initialization callbacks — so at best the
field holds a partially-built reference, and depending on how the injection is
declared you may get a circular-reference failure at startup instead. Even where
it resolves, you are relying on the ordering of two internal phases, which is not
a contract.

**`AopContext.currentProxy()`.** This reads the proxy for the *currently
executing* proxied invocation from a `ThreadLocal`. During bean creation there is
no such invocation, so there is nothing to read and the call throws
`IllegalStateException`.

**`TransactionTemplate`.** This one *does* work, because it does not need a proxy
at all — it asks the transaction manager directly. If the work genuinely must
happen during initialization, a `TransactionTemplate` is the honest answer. It is
also a signal to reconsider: work that needs a transaction is usually work that
belongs after startup, not inside it.

## The trade-off

Deferring startup work to `ApplicationReadyEvent` costs you the guarantee that it
completed *before* the bean was published. A cache warmed on
`ApplicationReadyEvent` is empty for the first few requests unless something
blocks on it; a `@PostConstruct` that fails prevents the context from starting at
all, which is sometimes exactly the failure you want. So the choice is: run it in
initialization and accept that it is not transactional, or run it after and
accept that the bean is live before the work is done. Where neither is
acceptable, `TransactionTemplate` inside the initialization callback gives you
both, at the cost of coupling that bean to Spring's transaction API.

## Gotchas

**⚠️ `@PostConstruct` calling a transactional method**
**Symptom:** startup data loading that is not atomic, or a `readOnly` hint that
never applies.
**Cause:** self-invocation *and* a proxy that does not exist yet.
**Fix:** do the work on `ApplicationReadyEvent` from another bean.

**⚠️ Self-injection used to fix a `@PostConstruct` call**
**Symptom:** the standard self-injection fix from
[chunk 4](04-fixing-self-invocation.md) does not help here, and may fail with a
circular-reference error at startup.
**Cause:** initialization runs before the proxy is created; there is nothing
correct for the field to hold at that instant.
**Fix:** move the work out of initialization. This is the one case where
obtaining a proxy reference is not the answer.

**⚠️ `AopContext.currentProxy()` in an initialization callback**
**Symptom:** `IllegalStateException` at startup rather than a silent no-op.
**Cause:** there is no currently-executing proxied invocation to read a proxy
from.
**Fix:** as above. The exception is at least honest, which is more than the other
failures on this page offer.

**⚠️ A constructor calling a transactional method**
**Symptom:** the same silent bypass, with an added risk that a field the method
needs is not assigned yet.
**Cause:** the object under construction is the target; there is no proxy at all,
and there cannot be.
**Fix:** never do work in a constructor. Constructors assign fields.

**⚠️ A field initialiser that calls a repository**
**Symptom:** the same, in code with no visible method call at all —
`private final Map<String,Rate> rates = loadRates();`
**Cause:** field initialisers run inside the constructor.
**Fix:** move it to the deferred listener with everything else.

**⚠️ `@Transactional` on the `@PostConstruct` method itself**
**Symptom:** looks like the correct fix; changes nothing.
**Cause:** the proxy does not exist while the method runs, so the annotation on
it is never consulted either.
**Fix:** there is no annotation-only fix for this shape.

**⚠️ Choosing `ContextRefreshedEvent` in a hierarchical context**
**Symptom:** the warming work runs twice.
**Cause:** each context in a parent/child hierarchy publishes its own refresh
event.
**Fix:** `ApplicationReadyEvent`, which fires once, or guard on the event's
source.

## Interview questions

**★ Why does `@PostConstruct` deserve its own warning if it is just another case
of self-invocation?**
Because it fails twice, for two different reasons, and fixing one leaves the
other. The self-invocation part is ordinary. The additional part is timing: the
reference says "the proxy must be fully initialized to provide the expected
behavior, so you should not rely on this feature in your initialization code". A
`@PostConstruct` method runs as part of bean creation, and the proxy is created
in the `postProcessAfterInitialization` step that comes *after* initialization
callbacks — so even a call routed through a self-injected reference has no
properly built proxy to route to. That is why the usual fixes do not apply here
and why the answer is structural: move the work to an `ApplicationReadyEvent`
listener on a different bean.

**★ Where exactly in the bean lifecycle is the proxy created?**
In `postProcessAfterInitialization`, run by the auto-proxy creator
`BeanPostProcessor` after every initialization callback has completed. The order
is instantiate, populate properties, `postProcessBeforeInitialization`, the
initialization callbacks (`@PostConstruct`, then `afterPropertiesSet`, then any
custom init method), then `postProcessAfterInitialization` — and it is that last
step that returns the proxy in place of your bean. Everything before it sees the
raw target. This single fact explains the whole page: not "Spring chose not to
apply transactions during startup", but "there was no proxy yet to apply them".

**★ If startup work genuinely must be transactional, what do you do?**
Two acceptable answers, and the right one depends on whether the work must
complete before the bean is usable. If it does not, move it to an
`@EventListener(ApplicationReadyEvent.class)` method on a separate component and
call the transactional bean through its injected reference — by then the context
is fully built and the call is an ordinary external call. If it genuinely must
happen inside initialization, use a `TransactionTemplate`, which asks the
transaction manager directly and needs no proxy at all. What you must not do is
annotate the `@PostConstruct` method, or self-inject and call through the field,
or reach for `AopContext` — the first two are silent no-ops and the third throws.

**★ Is there any shape of self-invocation that Spring can detect and warn about?**
Not within proxy-based AOP, and the reason is structural rather than a missing
feature. Interception happens when a call arrives at the proxy; a self-invocation
never arrives, so there is no event at which Spring could observe that something
was skipped. Spring would have to inspect the bodies of your methods to know an
internal call was made, which is precisely what it declines to do in proxy mode —
that is bytecode weaving, and it is the other mode. Detection has to come from a
tool that reads bytecode or source: an ArchUnit rule, a Checkstyle or PMD rule,
or an IDE inspection. Some IDEs do flag it, which is worth turning on, but the
framework cannot report it at runtime.

**★ A colleague moves cache warming from `@PostConstruct` to
`ApplicationReadyEvent` and says the transaction problem is solved. What else
changed?**
The guarantee about *when* the work is complete. A `@PostConstruct` runs before
the bean is published to anything, so no other component can observe a
half-warmed cache, and a failure there aborts context startup — the application
does not come up broken. Moving to `ApplicationReadyEvent` means the bean is
fully live, injected everywhere, and in a web application the server is already
accepting requests, while the warming is still running. So the transaction
problem is solved and a concurrency/readiness question has been created in its
place. It is usually the right trade, but it needs to be made deliberately —
typically by making the cache tolerate being empty, or by gating readiness on the
warmer having finished.

**★ Why can self-injection not rescue a `@PostConstruct`, given that it is the standard
fix everywhere else?**
Two reasons stacked, and the second is fatal on its own. First, the timing: property
population happens before initialization callbacks, so at the instant `@PostConstruct`
runs the field can only hold whatever existed then — and the proxy for this bean is
created later, in `postProcessAfterInitialization`. Second, a bean that injects itself
is a circular reference, and Spring Boot has disallowed those by default since 2.6:
`SpringApplication.setAllowCircularReferences` is documented as "Sets whether to allow
circular references between beans and automatically try to resolve them. Defaults to
`false`." So on a modern Boot application the trick usually does not start the context
at all, and turning the flag back on to make it start is trading a silent failure for a
loud design smell. The structural answer stands: move the work out of initialization.

**★ `ContextRefreshedEvent` or `ApplicationReadyEvent` — does the choice matter?**
Yes, in two ways. `ContextRefreshedEvent` is a Framework event published whenever an
`ApplicationContext` is refreshed, so in a parent/child hierarchy — a Boot application
with a separate servlet or Spring Cloud bootstrap context, for instance — it fires once
per context, and warming work hung off it runs more than once. `ApplicationReadyEvent`
is a Boot event published once, after the application has fully started, which is also
after the web server is accepting requests. For warming a cache the second is normally
what you want, both because it fires once and because everything in the context
genuinely exists by then. The wrinkle to be deliberate about is exactly that "after the
server is accepting requests" clause: if the cache must be populated before the first
request, neither event gives you that, and you want a readiness check that reports
not-ready until the warmer has finished.

---

← Prev: [3 · The self-invocation trap](03-the-self-invocation-trap.md) · Index: [Spring @Transactional](README.md) · Next → [3c · Bound receivers](03c-bound-receivers.md)
