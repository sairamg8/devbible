---
title: "The thread-local caveat"
sidebar_label: "4 · The thread-local caveat"
sidebar_position: 4
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-19 against the Spring Security reference — *Concurrency
> Support*
> (docs.spring.io/spring-security/reference/features/integrations/concurrency.html
> — "when work is done on a new `Thread`, the `SecurityContext` is lost", the
> `DelegatingSecurityContext*` family and the `DelegatingSecurityContextRunnable`
> implementation) and *Servlet Architecture*
> (docs.spring.io/spring-security/reference/servlet/architecture.html —
> `FilterChainProxy` clearing the context). Spring Boot 4.1.1, Spring Security
> 7.x, JDK 25.

**The identity is ambient: any code, at any depth, can ask who the caller is
without being passed it. That convenience is bought with a `ThreadLocal`, and a
`ThreadLocal` has exactly two failure modes — it is not cleared when a thread is
reused, or it is not carried when work moves to another thread. Spring Security
handles the first for you and hands you the second.**

## 1. It must be cleared, and inside a request it is

`FilterChainProxy` clears the `SecurityContext` after the request completes, and
the reference calls this one of the tasks that are "not viewed as optional".

This is not tidiness. Platform request threads are pooled and reused, so an
uncleared context would hand the next caller the previous caller's identity —
a privilege escalation with no attacker involved, and one that would appear
intermittently under load and never in a test.

The consequence for you: **if you ever set a context outside the filter chain,
you own the clearing.** A scheduled job, a message listener, a startup task:

```java
@Scheduled(cron = "0 0 3 * * *")
public void nightlyReconcile() {
    SecurityContext ctx = SecurityContextHolder.createEmptyContext();
    ctx.setAuthentication(UsernamePasswordAuthenticationToken.authenticated(
            "svc-reconciler", null, List.of(new SimpleGrantedAuthority("ROLE_BATCH"))));
    SecurityContextHolder.setContext(ctx);
    try {
        reconcile();
    } finally {
        SecurityContextHolder.clearContext();   // ← not optional
    }
}
```

Note that this job gets its *own* identity, deliberately constructed. It does
not inherit one, and it should not: whatever a pooled thread carries from an
earlier request is not the identity a batch job should run with.

## 2. It does not cross a thread boundary

The reference is blunt:

> In most environments, Security is stored on a per `Thread` basis. This means
> that when work is done on a new `Thread`, the `SecurityContext` is lost.

So this fails — and fails as an *empty context*, not as an exception, which is
much worse:

```java
@Service
class ReportService {
    @Async
    public CompletableFuture<Report> build(long id) {
        var auth = SecurityContextHolder.getContext().getAuthentication();  // ← empty
        ...
    }
}
```

Downstream, `auth` is `null` or anonymous, and a `@PreAuthorize` inside the
async call denies access for a user who is perfectly entitled — or, if the rule
happens to be permissive, the work runs with no identity at all and the audit
trail is wrong.

### The wrappers

Spring Security ships a decorator for every concurrency abstraction in Spring:

`DelegatingSecurityContextRunnable` · `DelegatingSecurityContextCallable` ·
`DelegatingSecurityContextExecutor` ·
`DelegatingSecurityContextExecutorService` ·
`DelegatingSecurityContextScheduledExecutorService` ·
`DelegatingSecurityContextTaskExecutor` ·
`DelegatingSecurityContextAsyncTaskExecutor` ·
`DelegatingSecurityContextSchedulingTaskExecutor` ·
`DelegatingSecurityContextTaskScheduler`

The mechanism is exactly what you would write by hand, which is the point — it
is small enough to trust:

```java
public void run() {
    try {
        SecurityContextHolder.setContext(securityContext);
        delegate.run();
    } finally {
        SecurityContextHolder.clearContext();
    }
}
```

For `@Async`, wrap the executor once and every annotated method starts working:

```java
@Bean
Executor taskExecutor(ThreadPoolTaskExecutor delegate) {
    return new DelegatingSecurityContextExecutor(delegate);
}
```

The one-argument constructor captures `SecurityContextHolder.getContext()` at
**submission** time, on the caller's thread — which is what you want, and is
also why submitting from a thread that has no context propagates nothing.

For `CompletableFuture` chains, the same reasoning applies to every stage that
might run on a different thread; passing a wrapped executor explicitly to
`supplyAsync(supplier, executor)` is the reliable form, rather than relying on
the common pool ([`CompletableFuture`](../../phase-6-concurrency/07-completablefuture/README.md)).

### `MODE_INHERITABLETHREADLOCAL` is not the general fix

It copies the context at thread **creation**. That works for a thread you
`new Thread(...)` and start inside a request. It does nothing useful for a
pooled executor, whose threads were created at pool warm-up — they inherited
whatever context existed *then*, typically none, and they keep it forever.

Worse, if a pool thread happens to be created lazily during a request, it
inherits *that* request's identity and retains it for every future task. That is
not "no identity", it is "the wrong identity", which is the harder bug of the
two and the reason this mode is a poor default.

## 3. Virtual threads

Under `spring.threads.virtual.enabled=true` each request runs on a fresh virtual
thread. `ThreadLocal` still works on a virtual thread, so `SecurityContextHolder`
behaves identically and nothing in your security configuration changes. See
[living with virtual threads](../01-why-frameworks-servlet-model/06-living-with-virtual-threads.md).

Two things do shift, and both are worth knowing:

- **The reuse hazard largely disappears.** A virtual thread is created per task
  and discarded, so there is no pooled carrier of stale identity. The clearing
  in `FilterChainProxy` is still correct and still runs; it is simply no longer
  the last line of defence.
- **Boundary crossing is unchanged.** A virtual thread you start inside a handler
  — including the ones a structured-concurrency scope creates — is still a new
  thread with an empty context. The wrappers are still required.

`ScopedValue`, the modern answer to exactly this problem
([Phase 6](../../phase-6-concurrency/12-threadlocal-scopedvalue/README.md)),
has the inheritance semantics you would want here, but
`SecurityContextHolder`'s default strategy is not built on it. Do not assume
inheritance you have not configured.

## The trade-off

The ambient `ThreadLocal` is why a service method three layers down can ask who
the caller is without every signature carrying a `Principal`. That is a genuine
and large ergonomic win, and it is why nobody seriously proposes removing it.

The price is that **the dependency is invisible in the type system**. Nothing in
a method's signature says it needs the current user, so nothing warns you when
it is called from a scheduler, a message listener, a test, or a new thread — and
the failure is a `null` principal or, if propagation was configured carelessly,
the wrong one. Passing the identity explicitly as a parameter is more honest and
much noisier; almost everyone takes the `ThreadLocal` and pays for it once.

## Gotchas

**Symptom:** `getAuthentication()` returns `null` inside an `@Async` method.
**Cause:** New thread, empty `ThreadLocal`.
**Fix:** `new DelegatingSecurityContextExecutor(delegate)` as the `@Async`
executor.

**Symptom:** A scheduled job sees a user identity belonging to some earlier HTTP
request.
**Cause:** `MODE_INHERITABLETHREADLOCAL` with a pooled executor, or a context set
manually and never cleared.
**Fix:** Return to `MODE_THREADLOCAL`, and give the job its own identity in a
try/finally as shown above.

**Symptom:** Propagation works for `@Async` and not for a
`CompletableFuture.supplyAsync(...)` call in the same class.
**Cause:** The no-executor overload uses the common `ForkJoinPool`, which is not
your wrapped bean.
**Fix:** Always pass the wrapped executor explicitly:
`CompletableFuture.supplyAsync(this::work, securityAwareExecutor)`.

**Symptom:** A `@PreAuthorize` inside an async method denies a legitimate user.
**Cause:** Method security reads the same empty context.
**Fix:** Same propagation fix. Method security has no separate identity source
— see [chunk 7](07-method-security.md).

**Symptom:** Everything propagates correctly in tests and not in production.
**Cause:** Tests often run the "async" work on the calling thread (a
`SyncTaskExecutor`, or no `@EnableAsync` in the slice), so the boundary is never
crossed.
**Fix:** Test the propagation with the real executor, or at minimum assert the
executor bean is a `DelegatingSecurityContextExecutor`.

**Symptom:** Reactive code (`WebClient`, WebFlux) loses the identity even though
you wrapped every executor.
**Cause:** Reactive pipelines do not use thread-locals for context at all; they
carry a `ContextView` on the subscription. The wrappers are the wrong tool.
**Fix:** Use Spring Security's reactive integration
(`ReactiveSecurityContextHolder`), which reads from the Reactor context rather
than a `ThreadLocal`.

## Interview questions

**★ Your `@Async` method sees no authentication. Explain and fix it.**
`@Async` hands the work to another thread and the default `ThreadLocal` strategy
does not cross that boundary, so the context is empty. Wrap the executor in
`DelegatingSecurityContextExecutor`: it captures the caller's context at
submission, installs it on the worker thread, and clears it in a `finally`.

**★ Why not just switch to `MODE_INHERITABLETHREADLOCAL`?**
Because it copies at thread creation, not at task submission. Pool threads are
created once and reused for thousands of tasks, so they either inherit nothing
(useless) or inherit one request's identity and keep it forever (dangerous).
It only helps for threads you create yourself inside a request, which is rare in
a Spring application.

**★ Why is clearing the context "not optional"?**
Because platform request threads are pooled. An uncleared `ThreadLocal` means
the next request served by that thread starts out holding the previous caller's
identity. `FilterChainProxy` clears it in a `finally`, which is why it has to be
the outermost security component.

**★ Do virtual threads change any of this?**
Not the API — `ThreadLocal` works on virtual threads, so `SecurityContextHolder`
is unchanged. What changes is that threads are no longer pooled, so stale
identity from reuse effectively cannot happen. Crossing to a new thread still
loses the context, so the delegating wrappers remain necessary.

**★ How would you give a scheduled job an identity?**
Construct an `Authentication` explicitly for a service account with exactly the
authorities the job needs, install it with `createEmptyContext()` /
`setContext(...)`, and clear it in a `finally`. Never inherit — the identity a
thread happens to carry is not a decision anyone made.

**★ Does any of this apply to a reactive stack?**
No, and that is a trap. Reactor does not use thread-locals for context; it
carries a `ContextView` down the subscription, so the delegating wrappers do
nothing there. The reactive equivalent is `ReactiveSecurityContextHolder`, which
reads from the Reactor context.

**★ What is the fundamental cost of the ambient identity, stated in one sentence?**
That the dependency on "who is calling" does not appear in any signature, so the
compiler cannot tell you when a method has been moved somewhere the identity is
not available.

---

← Prev: [Authentication and authorization](03-authentication-and-authorization.md) · Index: [Phase 9 — Spring Boot and the web](../README.md) · Next → [Configuring the chain](05-configuring-the-chain.md)
