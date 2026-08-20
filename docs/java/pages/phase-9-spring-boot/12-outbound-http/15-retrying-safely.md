---
title: "Retries amplify an outage unless something bounds them"
sidebar_label: "15 · Retrying safely"
sidebar_position: 15
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-20 against the Spring Framework reference *Core →
> Resilience* — including its explicit statement that circuit-breaker
> functionality is **not** part of core Spring Framework
> (docs.spring.io/spring-framework/reference/core/resilience.html) — and the
> Spring Framework 7.0.x API for `@Retryable` and `@ConcurrencyLimit`. Spring
> Boot 4.1.0, Spring Framework 7.0.x, JDK 25.

**Retrying is the most instinctive response to a failed call and the most
dangerous one, because the failures worth retrying and the failures made worse by
retrying look identical from the client. A retry against a transient network blip
is free. The same retry against a dependency failing *because it is overloaded*
multiplies its load by your retry count, at exactly the moment it needs less —
and every other client of that dependency is doing the same arithmetic. This
chunk is the two questions that decide whether a retry policy helps: is the
operation safe to repeat, and is the *total* retry load bounded.**

## When a retry is safe, and it is not usually

A retry is safe when the operation is **idempotent**: performing it twice has the
same effect as performing it once. That is a property of the operation, not of
the HTTP method, though the methods are a decent first approximation.

| | Safe to retry? |
|---|---|
| `GET`, `HEAD`, `OPTIONS` | yes — no side effect by definition |
| `PUT`, `DELETE` | yes *if implemented idempotently*, which is the contract but not a guarantee |
| `POST` | **no**, unless the endpoint deduplicates on an idempotency key |
| `PATCH` | depends entirely on the patch — `set status = shipped` is idempotent, `increment quantity` is not |

And the trap that makes all of this harder: **a timeout does not tell you the
request was not processed.** The request may have been received, executed and
committed, with only the response lost. So retrying a `POST` after a timeout can
create a second order. The mechanism that fixes this is an **idempotency key**:

```java
restClient.post()
        .uri("/orders")
        .header("Idempotency-Key", idempotencyKey)   // stable across retries
        .body(order)
        .retrieve()
        .toEntity(OrderCreated.class);
```

🔴 **The key must be generated once, before the first attempt, and reused by
every retry.** Generating it inside the retried method defeats the entire
mechanism, because each attempt then looks like a new request to the server. That
is the single most common way idempotency keys are implemented wrongly.

## Why retries amplify an outage

This is the part worth internalising, because it is counter-intuitive under
pressure.

A dependency failing at 100 requests per second because it is *overloaded* has a
demand problem. Your retry policy of three attempts turns 100 requests per second
of demand into as much as 400. Every client of that dependency doing the same
thing multiplies it again. The dependency that might have recovered on its own
now cannot, and the recovery is delayed for exactly as long as the retries
continue.

Three properties keep a retry policy from becoming an amplifier:

1. **Bound the attempts.** Two retries is usually plenty; three is generous.
2. **Back off exponentially, with jitter.** Backoff gives the dependency room;
   jitter de-synchronises the herd. `jitter` with a `multiplier` is exactly
   this, and `jitter = 0` — the default — is the thundering-herd setting.
3. **Have a retry budget.** Bound retries as a *fraction of total traffic* — say,
   retries may not exceed 10% of requests — so that when everything is failing,
   retrying stops rather than scaling with the failure. ⚠️ Framework 7's
   `@Retryable` has no budget attribute that I could find in the javadoc; the
   attributes are all per-invocation. A fleet-wide budget is something you
   implement yourself or take from a dedicated library.

And the rule that follows from all three: **never retry at more than one layer.**
Three retries in the HTTP client, three in the gateway class and three in the
caller is 27 requests for one logical call. Pick a layer — the gateway class that
owns the client is the right one — and make the others pass failures through.

## `@ConcurrencyLimit`

The companion annotation caps how many threads may be inside a method at once:

```java
@ConcurrencyLimit(20)
public Pricing lookup(String tier) { ... }
```

The reference notes it is **particularly useful with virtual threads**, which
have no pool limit — the point [chunk 10](10-the-cascade.md) made about the
accidental bulkhead disappearing. For synchronous invocations it uses
`ConcurrencyThrottleInterceptor`; for asynchronous tasks it constrains
`SimpleAsyncTaskExecutor`. `@ConcurrencyLimit(1)` effectively serialises access
to the target bean instance.

## What Framework 7 does *not* give you

🔴 **There is no circuit breaker.** The resilience documentation is explicit that
circuit-breaker functionality is not part of core Spring Framework and points at
Spring Cloud Circuit Breaker instead.

That matters for the question everyone asks — "do I still need Resilience4j?" —
and the honest answer is: **less than before, but not never.**

| You need | Framework 7 core | Something else |
|---|---|---|
| Retry with backoff and jitter | ✅ `@Retryable` | — |
| A bound on the whole retry sequence | ✅ `timeout` attribute | — |
| Concurrency limiting / bulkhead | ✅ `@ConcurrencyLimit` | — |
| Circuit breaker | ❌ | Spring Cloud Circuit Breaker (Resilience4j) |
| Rate limiting | ❌ | Resilience4j, or a gateway |
| Retry budgets across a fleet | ❌ | your own, or a service mesh |
| Fallbacks | ❌ | ordinary Java — a `catch` and a default |

So the framework now covers the two things most services actually needed, which
removes the reason many teams pulled in a resilience library at all. If you need
a breaker, you still reach outside.

## Gotchas

**⚠️ Retrying at three layers**
**Symptom:** one logical call produces 27 requests, and the dependency's own
graphs show an order of magnitude more traffic than your request count explains.
**Cause:** retries in the client, in the gateway and in the caller, multiplying.
**Fix:** retry in exactly one place — the gateway class — and let the others
propagate.

**⚠️ Generating the idempotency key inside the retried method**
**Symptom:** duplicate orders despite an idempotency key being implemented.
**Cause:** each attempt generates a new key, so the server sees new requests.
**Fix:** generate it once at the boundary and pass it in; the retried method must
receive the key, never mint it.

**⚠️ Retrying a `POST` because the timeout "means it failed"**
**Symptom:** duplicate side effects — two orders, two charges.
**Cause:** a timeout means the *response* was lost, not that the request was not
processed.
**Fix:** treat a timeout as unknown. Retry only with an idempotency key the
server deduplicates on, or do not retry and reconcile instead.

## Interview questions

**★ When is retrying an HTTP call dangerous?**
When the dependency is failing because it is overloaded, which is most of the
time in a real incident. A retry policy of three attempts multiplies the demand
on a system that is failing from too much demand, every client doing the same
multiplies it again, and the dependency that might have recovered on its own now
cannot until the retries stop. The second danger is correctness rather than
capacity: retrying a non-idempotent operation after a *timeout* can duplicate a
side effect, because a timeout means the response was lost, not that the request
was not processed. Both dangers are invisible in testing, because in testing the
dependency is either up or down and the retry looks free.

**★ You retry a `POST` that timed out. What could go wrong, and how do you make
it safe?**
The request may already have been received and committed, with only the response
lost, so the retry creates a second order or a second charge. The fix is an
idempotency key: a value generated once for the logical operation and sent on
every attempt, which the server stores and uses to return the original result
rather than re-executing. The detail that gets this wrong in practice is *where*
the key is generated — if it is minted inside the retried method, each attempt
carries a different key and the server sees genuinely new requests, so the
mechanism is present in the code and absent in effect. Generate it at the
boundary and pass it in.

**★ What is a retry budget and why does `@Retryable` not give you one?**
A retry budget caps retries as a proportion of total traffic — for example,
retries may not exceed 10% of requests — so that when a dependency is failing
broadly, retrying *stops* instead of scaling with the failure. It is the control
that prevents the amplification, because per-call limits like `maxRetries` bound
each call independently and therefore scale linearly with how many calls are
failing. `@Retryable`'s attributes are all per-invocation, and I could not find a
budget attribute in the javadoc, so a budget is something you implement yourself,
take from a dedicated library, or push into a service mesh.

**★ Why does `@ConcurrencyLimit` matter more now than it would have five years
ago?**
Because a bounded platform-thread pool used to provide a crude concurrency limit
for free: 200 threads meant at most 200 concurrent outbound calls, whatever your
client was configured to do. Virtual threads remove that ceiling, so the
container will happily run tens of thousands of concurrent requests and every one
of them can queue behind the same downstream dependency. The resilience reference
calls the annotation out as particularly useful with virtual threads for exactly
this reason. The limit that used to exist by accident now has to be stated on
purpose, at a boundary you choose, where exceeding it produces an attributable
failure rather than an invisible queue inside a connection pool.

**★ Framework 7 shipped `@Retryable` and `@ConcurrencyLimit`. Do you still need
Resilience4j?**
Less often, but not never, and the boundary is clear because the reference draws
it. Core Spring now covers retry with exponential backoff, jitter and a bound on
the total retry window, plus concurrency limiting — which is what most services
actually needed and the reason many of them pulled in a resilience library at
all. What core does *not* include, explicitly, is a circuit breaker; the
documentation points at Spring Cloud Circuit Breaker for that. It also does not
give you rate limiting or fleet-wide retry budgets. So the decision becomes: if
you need a breaker, reach outside; if you needed retries and bulkheads, you no
longer have to.

**★ You are asked to add retries to a call chain that already has retries in two
other layers. What do you say?**
That the layers multiply, so three retries at each of three layers is 27 requests
for one logical call, and the dependency's traffic graph will show an order of
magnitude more load than your request count explains. Retries belong in exactly
one place — the gateway class that owns the client for that dependency, because
that is where the knowledge of which failures are transient lives — and every
other layer should propagate the failure. If a caller genuinely needs different
retry behaviour, that is an argument for a different policy in the gateway, not
for a second layer of retries stacked on the first.

---

← Prev: [@Retryable](14-retries-and-resilience.md) · Index: [Phase 9 — Spring Boot and the web](../README.md) · Next → [Observing outbound calls](16-observing-outbound-calls.md)
