---
title: "A dependency you can serve a defined answer past does not appear in the availability product at all, so the highest-leverage engineering move in a microservice system is converting hard dependencies into soft ones"
sidebar_label: "10 · Hard and soft dependencies"
sidebar_position: 10
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-01 against Chris Richardson, "Dark matter force: minimize runtime
> coupling"
> ([microservices.io](https://microservices.io/articles/dark-energy-dark-matter/dark-matter/minimize-runtime-coupling.html)),
> the Google SRE book, "Addressing Cascading Failures"
> ([sre.google](https://sre.google/sre-book/addressing-cascading-failures/)), and Marc
> Brooker, "Timeouts, retries, and backoff with jitter", Amazon Builders' Library
> ([aws.amazon.com](https://aws.amazon.com/builders-library/timeouts-retries-and-backoff-with-jitter/)).
> 🔴 **Arithmetic only, nothing measured.** Version spine: JDK 25 · Spring Boot 4.1.1 /
> Spring Framework 7.0.9.

**Every hop in your request path is one of two things. A *hard* dependency: without its
answer, the operation cannot complete and the user gets an error. A *soft* dependency:
without its answer, the operation completes with a defined, degraded result. Only hard
dependencies enter the availability product. That means the cheapest large improvement
available to most services is not making anything more reliable — it is deciding, for each
hop, what you would serve if it were down, and then writing that down in code. The decision
is usually a product decision, it usually takes five minutes, and it usually has never been
made.**

## The definition, and why it is not about the code

A dependency is soft **if and only if there is a defined, acceptable response the operation
can produce without it.** Not "if the call is wrapped in a try/catch". Not "if there is a
circuit breaker". The test is whether somebody has decided what the user sees, and whether
that decision is acceptable to the business.

That makes it a product question wearing engineering clothes:

| Call | Could it be soft? | The degraded answer someone has to approve |
|---|---|---|
| Fetch customer's display name for the confirmation page | Yes | Show the email address, or "your order" |
| Fetch product image URL for a line item | Yes | Show a placeholder |
| Fetch loyalty tier to compute a discount | Maybe | Charge full price and apply the discount later — is that acceptable? |
| Check stock before accepting an order | Maybe | Accept and cancel later, if the business tolerates cancellations |
| Authorise the payment card | No | There is no order without money |
| Verify the user's session | No | There is no operation without identity |

The rows in the middle are the interesting ones, and they are the ones an engineer cannot
decide alone. "Accept the order and cancel it later if we are out of stock" is a completely
reasonable business policy at one company and a catastrophe at another. **Get the answer
before you build, and record it beside the code.**

## The arithmetic, restated

Split the dependency set. `H` is the set of hard dependencies; `S` is the soft ones.

```text
A(operation) = Π p_i  for i in H          — soft dependencies do not appear
```

Softening one dependency does not improve that dependency by a fraction of a point; it
**deletes a term**. That is why it dominates every other lever, as
[03b · What it does to an SLO](03b-what-it-does-to-an-slo.md) works through numerically.

The soft dependency has not become free. It has moved out of the availability equation and
into a different one: **the fraction of requests served with a degraded answer**, which is a
quality metric you now have to track. That is a much better place for it to be, because a
degraded answer is a smaller loss than an error, and because it is now measurable and
alertable rather than being a 500 in somebody's log.

## Three ways to soften a dependency, in order of preference

**1 · Hold the data locally, so the call does not happen.** The strongest form: there is no
dependency to be soft about. Reference data — names, titles, categories, addresses, tiers —
can be replicated into the caller and read from its own store. [06c · The read that could
have been a copy](06c-the-read-that-could-have-been-a-copy.md) and
**09e** *(not written yet)*.

**2 · Serve a cached answer.** The call happens, and on failure you serve the last value you
saw. This is weaker than a copy because the cache can be cold — a fresh pod that has never
seen a successful response has nothing to fall back to, which is exactly the situation during
a deploy that coincides with an outage.

**3 · Omit the field or substitute a default.** The weakest and the most universally
applicable. The response has a hole in it, and the client is built to tolerate the hole. This
requires the API contract to permit the hole, which is a design decision to make *up front* —
retrofitting nullability into a response that clients assume is complete is a breaking change.

## The warning: fallbacks are not free, and can make things worse

Marc Brooker's article in the Amazon Builders' Library sits next to a companion piece titled
*"Avoiding fallback in distributed systems"*, and the reason is worth internalising: **a
fallback path is code that only runs during an incident, which is to say, code that is never
tested under the conditions it exists for.**

The specific failure modes:

- **The fallback itself calls something.** A "cached" fallback that reads from a shared cache
  cluster has swapped one dependency for another, and the cache may be the thing that is
  down.
- **The fallback is slow.** If the primary times out after two seconds and the fallback takes
  another second, you have made the degraded path slower than the healthy one, and the
  latency budget in [04 · The latency budget](04-the-latency-budget.md) does not have room
  for it.
- **The fallback path is cold.** JIT-uncompiled, unwarmed, with no connections in its pool,
  running for the first time under the highest load the system has ever seen.
- **The fallback masks the outage.** If the degraded response looks like a normal response,
  nobody is paged and the "temporary" degradation runs for three weeks.

The mitigations are all about making the fallback ordinary: exercise it in tests and in
production (a scheduled or randomised forced-fallback), make it strictly simpler than the
primary path, make it call nothing, and **emit a distinct metric every time it fires** so
that "we are serving degraded" is a visible state rather than a silent one.

## Kubernetes will happily convert soft into hard for you

Two platform behaviours to watch, because both take a design where you have carefully made a
dependency soft and put the hardness back:

**Readiness probes that check dependencies.** If your readiness endpoint calls the
dependency, then when the dependency fails your pods are removed from the Service and the
degraded answer you built is never served. You have turned a partial degradation into a total
outage, automatically. A readiness probe answers "can this process serve traffic", not "is the
system healthy". Spring Boot's readiness group is configurable for exactly this reason — be
deliberate about what goes in it.

**Liveness probes that fail under load.** If a slow dependency makes your request threads
pile up and your liveness endpoint is served by the same pool, the probe times out, the
kubelet restarts the pod, in-flight work is lost, and the load moves to the remaining pods,
which then also restart. This is a cascading failure with the orchestrator as the
amplifier — the SRE book's *"Missed RPC deadlines"* and health-check discussion describe the
same mechanism:

> *"If the server can't respond in time because it's waiting for a lock, health checks may
> fail if the health check endpoint can't be served in time."*

## Writing it down: the dependency's own row

For each hop, four fields, in the design document and ideally in a comment above the client:

```text
Dependency:  Pricing Service, GET /quote
Hard/soft:   soft
On failure:  use the SKU's list price from our own catalogue copy
Approved by: <product owner>, <date>
Signal:      counter pricing.fallback.used, alert if > 1% of requests for 15 minutes
```

The fourth line is the one that gets left out and the one that turns a fallback from a hidden
liability into an operated feature.

## Gotchas

**★ An untested fallback is a hard dependency that you have mislabelled.** The first time it
runs, it throws a `NullPointerException` on a field the degraded path never populated, and the
user gets a 500 anyway — with an extra two-second timeout in front of it. Until the fallback
has been exercised with the dependency genuinely unavailable, count the dependency as hard in
the arithmetic.

**★ A fallback that reads a shared cache is not a soft dependency, it is a different hard
one.** Swapping Pricing Service for Redis is a real improvement only if Redis is more
available than Pricing Service, which is a claim someone should check rather than assume.
A fallback that reads the caller's *own* database is the version that actually removes the
dependency.

**★ Cold pods have no cache, and deploys coincide with incidents.** The classic sequence:
dependency degrades, your pods restart (or are scaled up), the new pods have never seen a
successful response, the "cached fallback" has nothing to serve. Fallbacks based on data you
own or on a static default do not have this failure mode; fallbacks based on remembered
responses do.

**★ Silent degradation lasts weeks.** If the degraded answer is indistinguishable from the
real one in your metrics, nothing pages and nothing gets fixed. Every fallback needs its own
counter, and "percentage of responses that were degraded" should be a first-class SLI beside
availability — otherwise you have optimised your availability number by hiding the failures
inside successful responses.

**★ Making a dependency soft can be a breaking API change for your callers.**
If your response has always contained `customer.name` and you decide to omit it under
degradation, every client that dereferences it without a null check breaks. The nullability
has to be in the contract from the start, or the change has to be versioned. This is why
"which fields may be absent" belongs in the API design conversation and not in the incident
retrospective.

**★ A readiness probe that checks dependencies undoes all of this.** It is worth stating
twice because it is common and it is invisible in application code: the degraded path you
built is unreachable if the platform has already removed your pod from the load balancer.

**★ "Soft" is per operation, not per dependency.** Pricing may be soft for rendering a product
page (show list price) and hard for placing an order (you cannot charge a guess). The same
client, the same service, two different classifications. Recording it per dependency rather
than per interaction is how the wrong one ends up in the arithmetic.

## Interview questions

**★ What makes a dependency hard rather than soft?**
Whether there is a defined, acceptable response the operation can produce without it. Not
whether the call is wrapped in error handling — an exception handler that rethrows or returns
a 500 leaves the dependency hard. It is soft only when somebody has decided what the user sees
instead, that decision is acceptable to the business, and the path that produces it has been
tested. Only hard dependencies enter the availability product.

**★ Why is converting one hard dependency to soft usually worth more than making your own
service more reliable?**
Because it removes a term from the product rather than nudging one closer to 1. With four
dependencies at 99.9%, improving your own service from 99.95% to 99.99% moves the composite by
a few hundredths of a point; softening one dependency removes a whole 0.1% of unavailability.
When every term is already close to 1, deletion dominates improvement, and softening is usually
the smaller piece of work as well.

**★ Your team adds a fallback and the availability metric improves immediately. What should
you check?**
That the improvement is real and not accounting. If the fallback returns a 200 with a missing
or default field, every degraded response now counts as a success, and your availability number
went up because you stopped measuring the failure. The check is whether there is a separate
counter for fallback usage and whether "percentage degraded" is tracked as its own SLI. Without
that, a fallback is a way to make a dashboard green while the user experience gets worse.

**★ What is wrong with a readiness probe that checks the service's dependencies?**
It converts a partial outage into a total one, automatically and quickly. When the dependency
fails, the probe fails, the orchestrator removes every pod from the Service, and requests that
could have been answered with a degraded response are not answered at all. Readiness should
answer whether this process can serve traffic; liveness should answer whether it should be
restarted. Neither should answer whether the wider system is healthy — that is what monitoring
is for.

**★ Name three ways a fallback path can fail, and how you would prevent each.**
It can call something that is also down — prevent by making the fallback read only data the
service owns, or a static default. It can be cold, unwarmed and connectionless on its first
execution — prevent by exercising it in tests and periodically in production so it is ordinary
code. It can be slow enough to blow the latency budget on top of the primary's timeout —
prevent by budgeting the fallback explicitly inside the operation's deadline rather than after
it. A fourth, and the most common: it can be silent, so nobody knows it is running — prevent
with a dedicated counter and an alert.

**★ Is a circuit breaker a way of making a dependency soft?**
No, though it is often deployed as if it were. A breaker changes a slow failure into a fast
one, which protects the caller's resources and stops the failure spreading — genuinely
valuable, and phase 16 covers it. But if the fallback behind the breaker is "throw an
exception", the operation still fails and the dependency is still hard. What makes it soft is
the *content* of the fallback, and the breaker is only the mechanism that decides when to use
it. See **07g · Circuit breaking as a
consequence** *(not written yet)* and
[Phase 16 · Resilience and operations](../../phase-16-resilience-operations/README.md).

{/* FOOTER */}
