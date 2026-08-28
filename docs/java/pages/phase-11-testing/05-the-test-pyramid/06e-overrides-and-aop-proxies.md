---
title: "Whether an overridden bean keeps its @Transactional and @Cacheable advice depends entirely on which strategy overrode it — REPLACE gives you a bare object with no proxy at all, and WRAP keeps the proxy, which produces the nastiest bug in Spring testing: stubbing a cached method poisons the cache with the empty value Mockito returned while recording the stub"
sidebar_label: "06e · Overrides and AOP proxies"
sidebar_position: 15
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-28 against the Spring Framework 7.0.x reference *Testing → TestContext
> Framework → Bean Overriding in Tests → Bean Overrides and Spring AOP Proxies*
> ([bean-overriding](https://docs.spring.io/spring-framework/reference/testing/testcontext-framework/bean-overriding.html))
> and *Testing → Annotations → `@MockitoSpyBean` and Spring AOP Proxies*
> ([annotation-mockitobean](https://docs.spring.io/spring-framework/reference/testing/annotations/integration-spring/annotation-mockitobean.html));
> both quoted passages and the `dateService` example are read from those pages.
> Version spine from `spring-boot-dependencies:4.1.0`: JDK 25, Spring Boot 4.1.0,
> Spring Framework 7.0.8, Mockito 5.23.0.
> **No sandbox** — Java source only, no test-run output.

**Almost nothing written outside the reference covers this, and it produces failures that look
impossible. A bean in a Spring context is often not your object — it is an AOP proxy around your
object, which is how `@Transactional`, `@Cacheable`, `@Retryable` and method security work at all.
Overriding that bean therefore raises a question with two different answers: does the override
keep the proxy? `REPLACE` says no. `WRAP` says yes. Both answers cause bugs, and they are
different bugs.**

## `REPLACE` and `REPLACE_OR_CREATE` — no proxy at all

> *"Overrides that use the `REPLACE` or `REPLACE_OR_CREATE` strategy (such as `@TestBean` and
> `@MockitoBean`) register their override instance directly as a manual singleton, which bypasses
> the container's normal bean post-processing. Consequently, the override instance is a bare
> object: **none of the AOP advice that would otherwise apply to the original bean**
> (`@Transactional`, `@Cacheable`, `@Retryable`, method security, and so on) is present."*

```text
caller
  │
  ▼
[ override instance ]
```

So a `@MockitoBean` or `@TestBean` is invoked **directly**. Read what that costs:

- A `@Transactional` method on the overridden bean **starts no transaction**.
- A `@Cacheable` method **caches nothing**.
- A `@Retryable` method **never retries**.
- `@PreAuthorize` on it **enforces nothing**.

Usually this is fine and even desirable — you replaced the bean precisely so it would not do its
real work. It becomes a defect the moment the *test's subject* is the advice. A test asserting
"the retry kicks in" against a `@MockitoBean`-overridden bean asserts nothing: there is no retry
advice in the object graph any more. The test goes green and the behaviour is untested.

🔴 **If the advice is what you are testing, do not override the bean that carries it.**

## `WRAP` — the proxy survives and wraps the mock

> *"Overrides that use the `WRAP` strategy (such as `@MockitoSpyBean`) capture an early reference
> to the original bean and use it to create the override instance, before the rest of the
> container's post-processors — including the one responsible for creating AOP proxies — have run.
> Consequently, if the original bean would have been proxied, that proxy is still created, but it
> now wraps the override instance instead of the original bean."*

```text
caller
  │
  ▼
[ AOP proxy ]          (for example, retry, caching, or transaction advice)
  │
  │  delegates to its target
  ▼
[ override instance ]  (for example, a Mockito spy created by @MockitoSpyBean)
```

So **what gets injected into your test and into collaborating beans is the proxy**, not the spy.
The reference is careful to separate two different wrappings that are easy to conflate:

> *"the 'wrapping' performed by the AOP proxy is unrelated to the manner in which the resulting
> Mockito spy itself 'wraps' the original bean instance it was created from. The proxy … determines
> which object a caller actually invokes, whereas the spy's relationship to the original instance
> only determines what happens when an unstubbed method is invoked on the spy."*

Two layers, two jobs. And the bug lives in the gap between them.

## 🔴 The `@Cacheable` trap — a stub that permanently disables itself

This is the one to remember, and the reference states the mechanism precisely:

> *"Advice that caches or otherwise memoizes the outcome of an invocation — such as `@Cacheable` —
> does not behave the same way. While a `doReturn(…)`, `doThrow(…)`, or similar declaration is
> being recorded, Mockito does not invoke the spy's real or previously stubbed behavior; instead,
> the invocation used to declare the stubbing returns an empty value (for example, `null`). If
> that invocation is made on the proxy, the caching advice caches this empty value, which then
> **permanently shadows the spy for that combination of arguments** — including for the very
> invocation that was supposed to configure the stubbing."*

Step through it, because the failure is genuinely counter-intuitive:

```java
doReturn(1L).when(dateService).getDate(false);   // (1)
dateService.getDate(false);                       // (2)
```

**(1)** `dateService` is the injected **proxy**. Mockito's stubbing infrastructure intercepts the
call before it reaches the spy and returns an empty value — but the call went *through the caching
advice on its way in*, so the cache now holds **`null` for argument `false`**.

**(2)** Returns that cached empty value, **not `1L`**. The cache was populated by the act of
setting up the stub.

So the stubbing statement is the thing that broke the stubbing. And it is permanent for that
argument combination, for the life of that cache entry.

The symptom in the wild: *"my `doReturn` is ignored"*, on a method that has `@Cacheable` on it, in
a test where everything looks right. People conclude Mockito is broken, or that spies do not work
on Spring beans. Neither is true.

### The fix, from the reference

Stub the spy directly instead of the proxy, unwrapping with `AopTestUtils`:

```java
DateService spy = AopTestUtils.getUltimateTargetObject(dateService);
doReturn(1L).when(spy).getDate(false);
```

`getUltimateTargetObject` walks all the way through nested proxies to the real target — the spy —
so the stubbing call never passes through the caching advice.

**Note that the ultimate target is the spy, not the original bean.** That is exactly what you
want: you are stubbing the spy, and callers still go through the proxy and reach the spy
underneath.

### Verification is not affected

> *"Verification via Mockito's `verify()` API is unaffected by this and works transparently,
> regardless of whether it is invoked on the proxy or on the underlying spy."*

So `verify(dateService).getDate(false)` is fine either way. It is only **stubbing** that has to
route around the advice. Worth knowing, because it explains a test where verification behaves and
stubbing does not — which otherwise looks like nonsense.

## The decision table

| You want to | Use | Because |
|---|---|---|
| Stop a collaborator running | `@MockitoBean` | Bare object, no advice, nothing happens |
| Supply predictable behaviour | `@TestBean` | Same, plus real reviewable code |
| Observe a real collaborator | `@MockitoSpyBean` | `WRAP` — real behaviour and the proxy both survive |
| **Test the advice itself** (`@Transactional`, `@Cacheable`, `@Retryable`, security) | **no override on that bean** | Any `REPLACE` override deletes the advice; a `WRAP` override keeps it but entangles stubbing with it |

## Gotchas and pitfalls

**★ Asserting that a retry, a cache or a transaction works, on an overridden bean.**
With `REPLACE`/`REPLACE_OR_CREATE` there is no advice on that object at all, so the test proves
nothing and passes. If the advice is the subject, leave the bean alone.

**★ `doReturn` "being ignored" on a `@MockitoSpyBean` whose method is `@Cacheable`.**
It is not being ignored. The stubbing call travelled through the caching advice and cached the
empty value Mockito returns while recording, which then shadows the spy for those arguments. Stub
through `AopTestUtils.getUltimateTargetObject(...)`.

**★ Assuming `getUltimateTargetObject` gives you the original bean.**
It gives you the **spy**, because the spy is the proxy's target. That is the object you want to
stub.

**★ Debugging this as a Mockito problem.**
Mockito is behaving exactly as documented; the interaction is with Spring's proxy. `verify()`
working while `doReturn` does not is the tell.

**★ Assuming the same trap applies to `@Transactional` or `@Retryable`.**
The reference singles out advice that *caches or memoizes*. Transaction and retry advice do not
store the recording invocation's return value, so they do not shadow later calls. The general
lesson — the stubbing call passes through the advice — still applies, so unwrapping remains the
safer habit.

**★ Trying to spy a scoped proxy.**
`@MockitoSpyBean` cannot wrap a `@Scope(proxyMode = TARGET_CLASS)` bean and throws.
[06c](06c-mockitospybean.md).

**★ Forgetting that the injected field is the proxy.**
In a `WRAP` override, the object in your test field is the AOP proxy with the spy as its target —
not the spy. Every reasoning error in this chunk starts with forgetting that.

**★ Reaching for `@DirtiesContext` when a cached value misbehaves.**
It rebuilds the context and hides the mechanism. The problem is the stubbing route, not a dirty
context.

## Interview questions

**★ Does `@Transactional` still work on a bean you replaced with `@MockitoBean`?**
No. `REPLACE` and `REPLACE_OR_CREATE` register the override directly as a manual singleton,
bypassing the container's normal bean post-processing, so the override is a bare object with none
of the AOP advice that would have applied — no transactions, no caching, no retry, no method
security. The caller invokes the override instance directly.

**★ And with `@MockitoSpyBean`?**
Different. `WRAP` captures an early reference to the original bean before the proxy-creating
post-processor runs, so the proxy is still created — it now wraps the override instance. What is
injected into your test and into collaborators is the **proxy**, with the spy as its target.

**★ Why might `doReturn(...)` appear to be ignored on a spy bean?**
Because the method is `@Cacheable` and you stubbed through the proxy. While recording a stub,
Mockito does not invoke the spy's real behaviour and the invocation returns an empty value; that
call passed through the caching advice, so the cache stores the empty value, which then
*permanently shadows the spy for that combination of arguments* — including the invocation you
were configuring.

**★ How do you fix it?**
Unwrap the proxy and stub the spy directly:
`DateService spy = AopTestUtils.getUltimateTargetObject(dateService);` then
`doReturn(1L).when(spy).getDate(false);`. The stubbing call then never travels through the advice.

**★ Is `verify()` affected by the same problem?**
No. The reference states verification *"is unaffected by this and works transparently, regardless
of whether it is invoked on the proxy or on the underlying spy"*. Only stubbing needs to route
around the advice — which is exactly why a test where `verify` behaves and `doReturn` does not is
so confusing until you know this.

**★ What does `AopTestUtils.getUltimateTargetObject` return for a `@MockitoSpyBean`?**
The spy — it walks through nested proxies to the ultimate target, and the proxy's target is the
spy created by the override. Not the original bean.

**★ You need to test that a `@Retryable` method actually retries. How do you set that up?**
Do not override the bean carrying the advice — any `REPLACE` override removes the advice entirely.
Override or stub something *below* it, so that the real proxied bean is invoked and its retry
advice is exercised by a collaborator that fails on demand.

**★ Why does this only really bite with caching advice?**
Because caching advice stores the outcome of the invocation, and the stub-recording invocation has
an empty outcome. Transaction and retry advice do not memoize a return value, so the recording
call passes through without leaving anything behind. The recording call still travels through the
advice in every case, which is why unwrapping is the safer habit generally.

{/* FOOTER */}
