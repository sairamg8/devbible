---
title: "Retries at every layer multiply, so three attempts across five layers is 243 requests hitting a database that was already overloaded — and Amazon's own guidance is to retry at a single point in the stack"
sidebar_label: "32 · Retries and amplification"
sidebar_position: 32
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-01 against Marc Brooker, "Timeouts, retries, and backoff with jitter",
> Amazon Builders' Library
> ([aws.amazon.com](https://aws.amazon.com/builders-library/timeouts-retries-and-backoff-with-jitter/)),
> and the Google SRE book, "Addressing Cascading Failures"
> ([sre.google](https://sre.google/sre-book/addressing-cascading-failures/)).
> 🔴 **No sandbox.** The multiplication figures below are **arithmetic from the sources**
> (243 = 3⁵ in Brooker's example, 64 = 4³ in the SRE book's) and are reproduced with
> attribution. Nothing was measured here. Version spine: JDK 25 · Spring Boot 4.1.0 / Spring
> Framework 7.0.8.

**Retrying is the most natural response to a failed call and the most reliably dangerous one at
scale. The danger is not the extra request; it is that retries at independent layers *multiply*,
so a system where every tier retries three times turns one user action into hundreds of requests
against the component that was already failing. Two of the best-documented engineering
organisations in the industry independently landed on the same conclusion: retry in one place,
budget it, and stop when it is not helping.**

## The two worked calculations, from the sources

Brooker, on a five-deep call stack:

> *"Distributed systems often have multiple layers. Consider a system where the customer's call
> causes a five-deep stack of service calls. It ends with a query to a database, and three
> retries at each layer. What happens when the database starts failing queries under load? If
> each layer retries independently, the load on the database will increase 243x, making it
> unlikely to ever recover. This is because the retries at each layer multiply — first three
> tries, then nine tries, and so on. On the contrary, retrying at the highest layer of the stack
> may waste work from previous calls, which reduces efficiency. In general, for low-cost
> control-plane and data-plane operations, our best practice is to retry at a single point in
> the stack."*

The SRE book, with a shorter stack and four attempts per layer:

> *"avoid amplifying retries by issuing retries at multiple levels: a single request at the
> highest layer may produce a number of attempts as large as the product of the number of
> attempts at each layer to the lowest layer. If the database can't service requests because it's
> overloaded, and the backend, frontend, and JavaScript layers all issue 3 retries (4 attempts),
> then a single user action may create 64 attempts (4³) on the database."*

`3⁵ = 243`. `4³ = 64`. **Both are the same arithmetic as the availability product, applied to
load instead of probability**, and both are exactly the shape you would predict from
[05](03-availability-multiplication.md) — which is a good sign that the mental model transfers.

## Why retries are structurally selfish

Brooker's framing is the most useful sentence to carry into a design review:

> *"Retries are 'selfish.' In other words, when a client retries, it spends more of the server's
> time to get a higher chance of success. Where failures are rare or transient, that's not a
> problem. ... When failures are caused by overload, retries that increase load can make matters
> significantly worse. They can even delay recovery by keeping the load high long after the
> original issue is resolved."*

and the analogy:

> *"Retries are similar to a powerful medicine — useful in the right dose, but can cause
> significant damage when used too much."*

The crucial asymmetry: **retries help with the failures they were designed for (random, transient,
uncorrelated) and actively harm in the failures that actually take systems down (overload,
saturation, correlated).** They are calibrated for the easy case and deployed during the hard one.

And the reason you cannot solve it locally:

> *"Unfortunately, in distributed systems there's almost no way to coordinate between all of the
> clients to achieve the right number of retries."*

## Where to retry, and the trade

Brooker's recommendation — *"retry at a single point in the stack"* — needs its cost stated,
because he states it: *"retrying at the highest layer of the stack may waste work from previous
calls, which reduces efficiency."*

| Retry location | Amplification | Wasted work | Practical use |
|---|---|---|---|
| Lowest layer (nearest the failure) | high if any layer above also retries | minimal | good **only** if every layer above provably does not retry |
| Single chosen layer | none | some | the recommended shape |
| Highest layer (the edge) | none | maximum — repeats the whole tree | fine for cheap operations |
| Every layer | multiplicative | minimal per attempt | the default, and the disaster |

**"Every layer" is the default not because anyone chose it but because each layer's author made a
locally sensible decision** — exactly the structure of the latency-budget problem in
[11](04-the-latency-budget.md). The fix is the same: decide it at the top and impose it downward,
as an explicit policy that says which tier retries and requires every other tier not to.

## Finding the retries you did not write

Before adding a retry, find the ones already there. In a Spring Boot service on the current
stack, they can be hiding in:

- **The HTTP client library.** Some clients retry idempotent requests on connection failure by
  default. Which library you have is classpath-dependent —
  [14](04c2-the-client-you-actually-get.md).
- **The load balancer or service mesh.** Envoy-style sidecars commonly retry, configured by a
  platform team you may not have spoken to.
- **The API gateway.** Another tier, another retry policy.
- **A vendor SDK.** AWS SDKs, payment provider SDKs and database drivers frequently retry
  internally — Brooker notes AWS added token-bucket throttling to the SDK in 2016 precisely
  because of this.
- **The browser or mobile client.** The SRE book counts the JavaScript layer as one of its three.
- **The user.** Pressing the button again is a retry with no backoff and no budget, and it happens
  most during an incident.

**Count the tiers before adding one.** The multiplication is over everything in the chain, and
half of it is not in your repository.

## What to retry, and what never to

Brooker's rule and its caveat, both worth quoting:

> *"HTTP provides a clear distinction between client and server errors. It indicates that client
> errors should not be retried with the same request because they aren't going to succeed later,
> while server errors may succeed on subsequent tries. Unfortunately, eventual consistency in
> systems significantly blurs this line. A client error one moment may change into a success the
> next moment as state propagates."*

The SRE book's version:

> *"Use clear response codes and consider how different failure modes should be handled. For
> example, separate retriable and nonretriable error conditions. Don't retry permanent errors or
> malformed requests in a client, because neither will ever succeed. Return a specific status when
> overloaded so that clients and other layers back off and do not retry."*

The last clause is a **server-side** obligation and it is frequently missed: if you are overloaded,
say so distinctly, so callers can distinguish "you broke" from "I am saturated" and behave
differently. [38 · Backpressure and load shedding](07h-backpressure-and-load-shedding.md).

And the hardest constraint of all:

> *"our view is that APIs with side effects aren't safe to retry unless they provide idempotency"*

which is [34 · Idempotency on the wire](07d-idempotency-on-the-wire.md), and is the reason a
retry policy cannot be decided independently of the API's semantics.

## The retry that costs you the deadline

Retries interact badly with the latency budget, and the interaction is usually unmanaged. A hop
with a 250 ms timeout and two retries can consume 750 ms plus backoff. If the operation's budget
was 400 ms, **the retry policy has guaranteed a budget violation on every retried request** — and
the retried response, when it arrives, is discarded by a caller that has already given up.

The rule: **a retry must fit inside the remaining budget, or it must not happen.**

```java
Optional<Money> quoteWithRetry(String sku, int quantity, Clock clock) {
    for (int attempt = 1; attempt <= 2; attempt++) {
        if (Deadlines.remaining(clock).toMillis() < MIN_BUDGET_FOR_ATTEMPT_MS) {
            return Optional.empty();          // no time left: do not start what we cannot finish
        }
        try {
            return Optional.of(pricing.quote(sku, quantity));
        } catch (PricingUnavailableException retryable) {
            if (attempt == 2) return Optional.empty();
            sleepWithJitter(attempt);          // see chunk 33
        } catch (PricingRejectedException permanent) {
            return Optional.empty();           // 4xx: will not succeed later
        }
    }
    return Optional.empty();
}
```

Three properties: the budget check before each attempt, the distinction between retryable and
permanent, and the absence of a retry on the permanent branch. All three are omitted by the
average retry helper.

## Gotchas

**★ You almost certainly have more retry layers than you think.** Client library, mesh sidecar,
gateway, SDK, browser, and the user's finger. Adding "just one retry" to a five-tier chain where
three tiers already retry is a multiplicative change, not an additive one, and none of the other
tiers are in your repository.

**★ Retries help with the failures you designed for and hurt during the failures that matter.**
They are calibrated for rare, random, transient faults and deployed during correlated overload,
where they keep load high long after the original cause is resolved and materially delay recovery.
That is Brooker's core warning and it is the opposite of the intuition.

**★ Retrying a 4xx wastes capacity forever.** A malformed request will be malformed on every
attempt. Separate retryable from non-retryable explicitly — with the caveat that eventual
consistency blurs the line, so a `404` for a just-created resource may legitimately succeed
shortly after and deserves a narrow, deliberate exception.

**★ A retry outside the latency budget produces a response nobody reads.** If the caller's deadline
expired during the backoff, the retried request is pure cost: your resources, the callee's
resources, and a result that is discarded. Check the remaining budget before each attempt.

**★ Retrying at the lowest layer looks efficient and is only safe if you can prove no layer above
retries.** You usually cannot, because some of those layers belong to other teams. The single
chosen retry point has to be an explicit, documented, system-wide decision — otherwise the
default is "everywhere".

**★ Capped exponential backoff without a limit on attempts leaves clients retrying forever at the
cap.** Brooker names this: once every client hits the maximum backoff, they all retry at that fixed
rate indefinitely. The remedy is to limit the number of attempts and handle the failure higher up —
which is usually fine, because the caller has its own timeout anyway.

**★ Retrying a non-idempotent write is how customers get charged twice.** A timeout does not mean
the work did not happen. Without an idempotency mechanism, the retry is a second execution, and the
caller has no way to know. This is the strongest constraint on retry policy and it is a property of
the API, not of the client.

## Interview questions

**★ Why are retries at multiple layers dangerous, and by how much?**
Because attempts multiply rather than add: the load at the bottom is the product of the attempt
counts at every layer. Brooker's example is a five-deep stack with three retries per layer,
producing a 243-times increase on a database that was already failing under load; the SRE book's
is three layers with four attempts each, giving 64 attempts from one user action. In both cases the
amplification arrives precisely when the target is least able to absorb it, and it keeps the load
high long after the triggering fault is fixed.

**★ Where should retries live?**
At a single point in the stack, chosen deliberately and documented, with every other layer required
not to retry. Brooker's guidance is explicit about this and equally explicit about its cost —
retrying at the highest layer wastes the work already done by lower layers, which reduces
efficiency. The trade is worth making because wasted work is bounded and multiplicative
amplification is not. What makes it hard in practice is that some of the layers are meshes,
gateways and SDKs owned by other teams.

**★ Which failures should you retry?**
Transient and server-side ones — connection failures, 5xx responses, and explicit overload
signals, subject to a budget. Not client errors, because a malformed request will fail identically
on every attempt. The caveat Brooker adds is important: eventual consistency blurs the boundary, so
a `404` for a resource created moments ago may succeed shortly afterwards, and that specific case
deserves a narrow deliberate exception rather than a blanket policy of retrying 4xx.

**★ How do retries interact with a latency budget?**
Badly, unless managed. Two retries on a hop with a 250 ms timeout can consume 750 ms plus backoff,
so an operation with a 400 ms budget is guaranteed to blow it whenever a retry occurs — and the
eventual response is discarded by a caller that already gave up. The rule is that a retry must fit
in the *remaining* budget: check before each attempt, and if there is not enough time to complete
one, fail immediately rather than starting work whose result nobody will read.

**★ Your service already sits behind a mesh that retries and calls an SDK that retries. You are
asked to add application-level retries. What do you say?**
That the change is multiplicative and needs a system-level decision rather than a local one. With
three retrying layers the bottom sees the product of the attempt counts, and during an overload
that is what prevents recovery. The right response is to establish which single layer owns retries
— probably the one closest to the business decision about whether the operation is worth
repeating — and to turn the others off, which means a conversation with the platform team about the
mesh and reading the SDK's configuration rather than writing new code.

{/* FOOTER */}
