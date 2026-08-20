---
title: "The number you configured was never the promise your caller relies on"
sidebar_label: "11 · Deadlines"
sidebar_position: 11
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-20 against the JDK 25 API for
> `java.net.http.HttpRequest.Builder.timeout(Duration)`
> (docs.oracle.com/en/java/javase/25/docs/api/java.net.http/), the Spring
> Framework reference *REST Clients*, and the Spring Framework reference *Core →
> Resilience* for the `@Retryable` `timeout` attribute
> (docs.spring.io/spring-framework/reference/core/resilience.html). Spring Boot
> 4.1.0, Spring Framework 7.0.x, JDK 25.

**Everything so far has been about configuring a number. This chunk is about the
gap between that number and the promise your own callers are relying on. A
timeout bounds one phase of one attempt at one call. A *deadline* bounds the
whole operation, counts down as it is spent, and is inherited by everything the
operation does next. No HTTP client gives you the second one, because no client
knows what operation it is part of — so you build it, and the reward is that your
service stops doing work nobody is waiting for.**

## A timeout is per attempt; a deadline is per operation

Here is the arithmetic that catches people. A handler calls three dependencies in
sequence, each configured with a two-second read timeout:

```java
Customer customer = customerClient.get().uri("/customers/{id}", id)
        .retrieve().body(Customer.class);
Pricing pricing = pricingClient.get().uri("/pricing/{tier}", customer.tier())
        .retrieve().body(Pricing.class);
Inventory stock = inventoryClient.get().uri("/stock/{sku}", sku)
        .retrieve().body(Inventory.class);
```

Every client is bounded at two seconds. The handler is bounded at **six**, plus
connection acquisition, plus any retry. And the caller who issued the original
request — a mobile client with a five-second patience, a gateway with a
three-second timeout of its own — gave up two seconds ago. Your service is now
doing work that nobody is waiting for, holding a connection, a thread and
whatever the handler is holding, on behalf of a response that will be discarded.

That is the whole argument for a deadline. Three properties distinguish it from a
timeout:

| | Timeout | Deadline |
|---|---|---|
| Scope | one attempt at one call | the whole operation |
| Value | fixed, from configuration | *decreasing* — it is a point in time, not a duration |
| Propagation | none | passed to everything the operation calls |

## Building one, since the client will not

The mechanism is a point in time carried through the operation, and every
outbound call bounded by whatever is left of it.

```java
public record Deadline(Instant expiresAt) {

    static Deadline in(Duration budget) {
        return new Deadline(Instant.now().plus(budget));
    }

    Duration remaining() {
        Duration left = Duration.between(Instant.now(), expiresAt);
        return left.isNegative() ? Duration.ZERO : left;
    }

    boolean expired() {
        return remaining().isZero();
    }
}
```

Two places to use it. **Before** a call, so you never start work you cannot
finish:

```java
if (deadline.expired()) {
    throw new DeadlineExceeded("no budget left before calling pricing");
}
```

and **on the wire**, so the downstream service knows too:

```java
restClient.get()
        .uri("/pricing/{tier}", tier)
        .header("X-Request-Deadline", deadline.expiresAt().toString())
        .retrieve()
        .body(Pricing.class);
```

⚠️ **A propagated deadline is a convention, not a standard.** There is no
registered HTTP header for it that I could point you at, so both sides have to
agree on the name and the format, and a service that does not understand the
header simply ignores it. Within a fleet you control that is a cheap and
effective agreement; across an organisational boundary it is a negotiation. Where
a deadline cannot be propagated, the fallback is to *shrink the timeout* you
configure for the call to whatever the remaining budget allows — less good,
because the downstream keeps working after you have stopped waiting, but still
better than a fixed number.

Carrying the deadline through the call stack without threading it through every
signature is what `ScopedValue` is for on JDK 25 — see
[Phase 6 — Concurrency](../../phase-6-concurrency/README.md). A `ThreadLocal`
works too, with the usual caveat that it does not cross a thread boundary unless
you make it.

## Where a deadline still does not help

Two honest limits, because overselling this is how it gets distrusted.

**Abandoning a call does not stop the work.** If you give up at the deadline, the
downstream service is still processing your request, still holding its own
resources, and will still write whatever it was going to write. That matters
enormously for non-idempotent operations: "I timed out" and "it did not happen"
are different statements, and conflating them is the subject of
[chunk 15](15-retrying-safely.md).

**The servlet model has no deadline of its own.** Nothing in the container tells
your handler how long its caller is prepared to wait; there is no ambient budget
to read. So the budget has to come from somewhere you choose — a header your
gateway sets, or a constant per endpoint derived from the SLO you published. The
request pipeline itself is **Topic 10 — The request pipeline** *(not written
yet)*.

## Gotchas

**⚠️ Sequential calls, each "correctly" bounded**
**Symptom:** an endpoint with a 500 ms SLO regularly takes four seconds, and
every individual client's timeout is set to a value the team defends.
**Cause:** the timeouts compose additively and nobody added them up.
**Fix:** write the worst case down — sum the per-call bounds including retries
and acquisition — and compare it to the SLO. If the sum exceeds it, either the
calls must go in parallel or the bounds must come down. There is no third option
that does not involve lying in the SLO.

**⚠️ A retry that is invisible in the timeout arithmetic**
**Symptom:** the documented bound is two seconds and the p99 is eight.
**Cause:** three retries at two seconds each plus backoff, none of it counted.
**Fix:** count retries in the budget, or bound the whole retry sequence — see
[chunk 15](15-retrying-safely.md).

**⚠️ Continuing to work after the caller has gone**
**Symptom:** load stays high after an upstream timeout storm, because every
abandoned request is still being processed.
**Cause:** nothing checks whether there is any budget left before starting the
next stage.
**Fix:** check the deadline before each outbound call, and fail immediately if it
has passed. Refusing to start work you cannot finish is the cheapest capacity you
will ever buy.

**⚠️ Propagating a deadline as a duration rather than an instant**
**Symptom:** each hop gets the full budget, so a three-hop chain has three times
the intended bound.
**Cause:** sending `X-Timeout: 2s` rather than an absolute expiry.
**Fix:** propagate the *instant*, so time already spent is subtracted
automatically at every hop. A duration resets the clock; a deadline does not.

**⚠️ Treating a client-side timeout as proof the operation did not happen**
**Symptom:** duplicate orders, double charges, or a retry that succeeds against
work that had already been done.
**Cause:** the request was received and processed; only the response was lost.
**Fix:** treat a timeout as *unknown*, not as *failed*, and make the operation
idempotent so that resolving the unknown is safe.

## Interview questions

**★ What is the difference between a timeout and a deadline, and why does an HTTP
client only give you the first?**
A timeout is a fixed duration bounding one phase of one attempt — connect, read —
and it starts fresh for every call. A deadline is a point in time bounding the
whole operation: it *decreases* as it is spent, and it propagates to everything
the operation subsequently does. HTTP clients only offer timeouts because a
client library has no idea what operation it is part of or how much of the
caller's patience has already been consumed; that context lives in your
application. The consequence is that a handler making three two-second calls is
bounded at six seconds even though every configuration file in the repository
says two, and the original caller may have given up long before.

**★ How would you implement request deadlines across a fleet of services?**
Establish a budget at the edge — the gateway sets it from the endpoint's SLO —
and carry it as an absolute *instant*, not a duration, so time already spent is
subtracted at every hop rather than reset. Inside a service, carry it in a
`ScopedValue` so it does not have to be threaded through every method signature,
check it before each outbound call, and refuse to start work when it has passed.
Propagate it outward on a header both sides have agreed on; there is no
standardised header for this, so it is a convention within the fleet, and any
service that does not understand it simply ignores it. Where propagation is not
possible — a third party — the fallback is to shrink the configured timeout to
the remaining budget, which at least stops *you* waiting.

**★ Your handler times out calling a payment service. Has the payment been
taken?**
Unknown, and that is the only honest answer. A client-side timeout means the
response did not arrive in time; it says nothing about whether the request was
received, processed, or committed. Treating it as "failed" is how duplicate
charges happen, because the natural next step is a retry. The engineering
response is to make the operation idempotent — an idempotency key the payment
service deduplicates on — so that resolving the ambiguity is safe, and to have a
reconciliation path for the cases where it is not. This is also why a blanket
retry policy on non-idempotent operations is dangerous.

**★ Why propagate an absolute instant rather than a remaining duration?**
Because a duration resets the clock at every hop. If A sends "you have two
seconds" to B, and B spends 1.5 of them before calling C with "you have two
seconds", the chain is bounded at 3.5 seconds against a budget of two — and it
gets worse with depth. An instant is monotonic through the chain: each hop
computes what is left by subtraction, and a hop that finds nothing left fails
immediately instead of starting work nobody will wait for. The one real
requirement is that clocks are reasonably synchronised across the fleet, which
NTP handles at the granularity deadlines care about.

**★ Does abandoning a call at the deadline free the downstream service's
resources?**
No, and it is important not to imply otherwise. Your client stops waiting and, if
the transport supports it, may reset the connection — but the downstream service
is typically still executing the request, still holding its own database
connection, and will still complete whatever side effect it was going to
complete. So a deadline protects *your* capacity and *your* caller's experience;
it does not protect the dependency. Propagating the deadline is what lets the
dependency protect itself, which is the whole reason to bother sending it rather
than just enforcing it locally.

---

← Prev: [The pool is the real limit](09-the-pool-is-the-real-limit.md) · Index: [Phase 9 — Spring Boot and the web](../README.md) · Next → [Error mapping](12-error-mapping.md)

---

← Prev: [The cascade](10-the-cascade.md) · Index: [Phase 9 — Spring Boot and the web](../README.md) · Next → [Error mapping](12-error-mapping.md)
