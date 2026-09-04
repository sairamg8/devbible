---
title: "@Retryable is new, welcome, and its defaults are wrong for a network call"
sidebar_label: "14 · @Retryable"
sidebar_position: 14
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-20 against the Spring Framework reference *Core →
> Resilience* (docs.spring.io/spring-framework/reference/core/resilience.html),
> the Spring Framework 7.0.x API for
> `org.springframework.resilience.annotation.Retryable` and
> `@EnableResilientMethods`
> (docs.spring.io/spring-framework/docs/current/javadoc-api/), and the Spring
> Boot issue tracker for the auto-configuration decision
> (github.com/spring-projects/spring-boot/issues/46916). Spring Boot 4.1.1,
> Spring Framework 7.0.x, JDK 25.

**Framework 7 puts retry support in the core framework, which is genuinely good
news — no extra dependency, no `@EnableRetry` from a separate project, and a
`timeout` attribute that finally bounds the whole retry sequence. It also hands
you an amplifier with the safety catch off: the defaults retry *every*
exception, including the 4xx that cannot possibly succeed, with *no jitter* and
*no bound on the total elapsed time*. Every attribute in the table below is one
you should set deliberately, and one of them — `@EnableResilientMethods` — is not
an attribute at all but a switch Boot deliberately does not flip for you.**

## `@Retryable`, and its defaults are not your defaults

The annotation is `org.springframework.resilience.annotation.Retryable`, new in
Framework 7. The reference states the defaults plainly: **any exception** is
retried, at most **3** retries after the initial failure (so up to four
invocations), with a **1 second** delay, and the last original exception
propagates on exhaustion.

```java
@Retryable
public void sendNotification() {
    this.jmsClient.destination("notifications").send(...);
}
```

Every one of those defaults is wrong for an outbound HTTP call:

- **"Any exception"** includes `HttpClientErrorException`. Retrying a 400 or a
  404 three times is pure waste — the response will not change.
- **A fixed 1 second delay** with no jitter means that if a hundred callers fail
  together, they all retry together, one second later, in a thundering herd.
- **No multiplier** means no exponential backoff, so a dependency that needs ten
  seconds to recover gets hit at 1s, 2s and 3s and then given up on.
- **No overall bound** unless you set one, so the worst case is four attempts of
  whatever your read timeout is, plus the delays.

The full attribute set, from the javadoc:

| Attribute | Default | Javadoc meaning |
|---|---|---|
| `includes` / `value` | `{}` | exception types to retry on |
| `excludes` | `{}` | exception types *not* to retry on |
| `predicate` | — | a `MethodRetryPredicate` for finer control |
| `maxRetries` | `3` | retries *after* the initial attempt: total = 1 + `maxRetries` |
| `delay` | `1000` | base delay after the initial invocation |
| `jitter` | `0` | randomly added to or subtracted from the calculated delay |
| `multiplier` | `1.0` | applied to the previous delay for the next attempt |
| `maxDelay` | `Long.MAX_VALUE` | caps how far jitter and multiplier can push the delay |
| `timeout` | `0` (none) | "the maximum amount of elapsed time allowed for the initial invocation and any subsequent retry attempts, including delays" |
| `timeUnit` | `MILLISECONDS` | the unit for the duration attributes |

🔴 **`maxRetries` is not `maxAttempts`.** The javadoc is explicit: total attempts
= 1 + `maxRetries`. If you are migrating from Spring Retry, whose annotation used
`maxAttempts`, the same number now means one more invocation than it used to.

🔴 **`timeout` is the attribute that turns a retry policy back into a deadline**,
and it exists as of 7.0.2. It bounds the whole sequence — initial call, every
retry, and the delays between them — which is precisely the arithmetic
[chunk 11](11-deadlines-not-timeouts.md) said nothing else gave you.

A policy that is actually safe for an outbound call:

```java
@Retryable(
        includes = { ResourceAccessException.class, HttpServerErrorException.class },
        excludes = HttpClientErrorException.class,
        maxRetries = 2,
        delay = 200,
        jitter = 100,
        multiplier = 2,
        maxDelay = 2000,
        timeout = 3000)
public Pricing lookup(String tier) {
    return restClient.get().uri("/pricing/{tier}", tier).retrieve().body(Pricing.class);
}
```

Read it as a sentence: retry only I/O failures and their 5xx, never their 4xx, at
most twice, backing off 200 ms then 400 ms with ±100 ms of jitter, capped at 2
seconds per delay and 3 seconds for the whole thing.

## Turning it on — Boot does not do it for you

`@Retryable` and `@ConcurrencyLimit` are processed only when the support is
enabled:

```java
@Configuration
@EnableResilientMethods
public class ResilienceConfiguration { }
```

⚠️ **Spring Boot does not auto-configure `@EnableResilientMethods`.** The
enhancement request to do so (`spring-boot#46916`) was **closed as declined**. So
the annotation is required, and the failure mode if you forget it is the worst
kind: the code compiles, the annotation is present, the tests that do not
actually exercise a failure pass, and nothing retries. ⚠️ This is a project
decision that could change in a later release — confirm against the Boot
reference for the version you are on rather than trusting this page forever.

The alternative to the annotation is declaring
`RetryAnnotationBeanPostProcessor` and `ConcurrencyLimitBeanPostProcessor` as
beans yourself.

Because the support is proxy-based — the javadoc describes the annotation as
applying to "all proxy-invoked methods" — the standard Spring AOP caveat applies:
**a call from another method inside the same bean does not go through the proxy
and is not retried.** Put the annotation on a method that is called from outside
its own class.

The programmatic equivalent, for code you do not want to annotate:

```java
var policy = RetryPolicy.builder()
        .includes(ResourceAccessException.class)
        .maxRetries(2)
        .delay(Duration.ofMillis(200))
        .jitter(Duration.ofMillis(100))
        .multiplier(2)
        .maxDelay(Duration.ofSeconds(2))
        .build();

var pricing = new RetryTemplate(policy).invoke(() -> gateway.lookup(tier));
```

`invoke` propagates the last original exception; `execute` throws a checked
`RetryException` exposing every attempt's outcome, which is the better choice
when you want to log what happened across the whole sequence. A `RetryListener`
(and `CompositeRetryListener`) reacts to each step, and the framework publishes a
`MethodRetryEvent` for every exception encountered by annotation-driven retry —
which is how you get a metric for "how often are we retrying" without
instrumenting each method.

## Gotchas

**⚠️ `@Retryable` present, nothing retried**
**Symptom:** the annotation is on the method and failures propagate on the first
attempt.
**Cause:** `@EnableResilientMethods` is missing. Boot does not auto-configure it.
**Fix:** add it to a `@Configuration` class, and write one test that actually
fails twice and succeeds on the third attempt — the annotation being present is
not evidence it is active.

**⚠️ Self-invocation**
**Symptom:** a retried method works when called from a controller and does not
when called from a sibling method in the same service.
**Cause:** the support is proxy-based; an internal call bypasses the proxy.
**Fix:** move the annotated method to a separate bean, or call it through the
proxy. Splitting the gateway out is usually the better design anyway.

**⚠️ `maxRetries` read as `maxAttempts`**
**Symptom:** a migration from Spring Retry produces one more request per call
than intended, and the worst-case latency budget is exceeded.
**Cause:** `maxRetries = 3` means four invocations.
**Fix:** subtract one when translating, and write the total in a comment next to
the annotation so the next reader does not have to remember.

**⚠️ Retrying a 4xx**
**Symptom:** four identical 400s in the logs for every malformed request, and a
downstream rate limit hit by requests that could never succeed.
**Cause:** the default is to retry *any* exception.
**Fix:** always set `includes` or `excludes`. `excludes = HttpClientErrorException.class`
is the minimum viable policy.

**⚠️ `jitter = 0` and a synchronised herd**
**Symptom:** load on the recovering dependency arrives in sharp spikes exactly
one delay apart.
**Cause:** every failed caller retries on the same schedule.
**Fix:** set `jitter`. It is the cheapest line in the annotation and the one most
often omitted.

## Interview questions

**★ What are `@Retryable`'s defaults and why are they wrong for an HTTP call?**
Retry any exception, three retries after the initial attempt, a fixed one-second
delay, and the last original exception propagated on exhaustion. "Any exception"
means a 400 or a 404 gets retried three times, which cannot succeed and wastes
the dependency's capacity. The fixed delay with `jitter` defaulting to zero means
a hundred callers that failed together retry together one second later — a
thundering herd. `multiplier` defaults to 1.0, so there is no exponential backoff
to give a recovering dependency room. And `timeout` defaults to zero, meaning the
whole sequence is unbounded. The defaults are reasonable for a local JMS send;
they are close to worst-case for a network call.

**★ What is the difference between `maxRetries` and `maxAttempts`, and why does
it matter?**
`maxRetries` counts retries *after* the initial invocation — the javadoc says
total attempts = 1 + `maxRetries`, so `maxRetries = 4` means up to five calls.
Spring Retry's annotation used `maxAttempts`, which counted the total. So copying
a number across during a migration silently adds an invocation per call, which
matters twice over: it exceeds the latency budget you calculated, and it applies
25% more load to the dependency than you intended at exactly the moment you were
trying to be careful.

**★ `@Retryable` is on the method and nothing is being retried. What do you
check?**
Two things, in order. First, whether `@EnableResilientMethods` is present on a
configuration class — Spring Boot does not auto-configure it, and the request for
it to do so was declined, so without it the annotation is inert and completely
silent about being inert. Second, self-invocation: the support is proxy-based, so
a call from a sibling method inside the same bean bypasses the proxy and is not
retried. Both failures look identical from the outside, which is why the test
that matters is one that makes the dependency fail twice and asserts the third
call succeeded — the annotation being present in the source is not evidence of
anything.

**★ What does the `timeout` attribute on `@Retryable` bound, and why is it the
most important one?**
Its javadoc says it is "the maximum amount of elapsed time allowed for the initial
invocation and any subsequent retry attempts, including delays" — so it bounds the
whole sequence, not one attempt. That makes it the only attribute that converts a
retry policy back into something you can promise a caller: without it, the worst
case is `1 + maxRetries` attempts of whatever the read timeout is, plus every
backoff delay, and nobody adds that up correctly. It defaults to `0`, meaning no
limit, and it arrived in 7.0.2 rather than in 7.0.0, so a codebase pinned to an
early 7.0 patch may not have it.

**★ When would you use `RetryTemplate` instead of the annotation, and what is the
difference between `invoke` and `execute`?**
The template when the retry decision is dynamic — a policy built from
configuration at runtime, or a retry around something that is not a proxied bean
method, where the annotation simply cannot apply. `invoke` propagates the last
original exception directly, so the caller catches the domain exception it
expected and the retry is invisible in the signature. `execute` throws a checked
`RetryException` that exposes every attempt's outcome, which is what you want when
you need to log or report what happened across the whole sequence rather than only
how it ended. `invoke` is the better default precisely because it does not leak
the retry into your exception contract.

**★ How would you get a metric for how often your service is retrying?**
The framework publishes a `MethodRetryEvent` for every exception encountered by
annotation-driven retry, so an application listener can increment a counter
without instrumenting each retried method — which is what you want, because
retries are exactly the thing that should be visible in aggregate. A rising retry
rate is an early signal of a dependency degrading, often before its error rate
crosses any threshold, and it is also how you notice the failure mode where a
retry policy has quietly become an amplifier. For finer-grained visibility inside
a programmatic sequence, `RetryListener` — and `CompositeRetryListener` to combine
several — reacts to each step.

---

← Prev: [Their failure is not your failure](13-their-failure-is-not-yours.md) · Index: [Phase 9 — Spring Boot and the web](../README.md) · Next → [Retrying safely](15-retrying-safely.md)
