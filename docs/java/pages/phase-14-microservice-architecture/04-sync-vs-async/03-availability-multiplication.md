---
title: "Availability across synchronous hops multiplies rather than averages, so five dependencies at 99% give you 95.1% — and this is arithmetic you can redo on paper, not a measurement anyone took"
sidebar_label: "05 · Availability multiplication"
sidebar_position: 5
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-01 against Martin Fowler & James Lewis, "Microservices" — the
> "Synchronous calls considered harmful" section
> ([martinfowler.com](https://martinfowler.com/articles/microservices.html)) — and
> microservices.io "Pattern: Remote Procedure Invocation (RPI)"
> ([microservices.io](https://microservices.io/patterns/communication-style/rpi.html)).
> 🔴 **Every number on this page is arithmetic, computed from an assumed input, not a
> measurement.** No system was observed and no latency, error rate or uptime figure here
> came from a running service. Version spine: JDK 25 · Spring Boot 4.1.1 / Spring Framework
> 7.0.8.

**This is the one calculation in microservice architecture that every engineer should be
able to do from memory, on a whiteboard, in ten seconds. If an operation requires n
independent services to be available, and each is available with probability p, then the
operation is available with probability p to the power n. Not the average of the p's. Not
the minimum. The product. That single fact is why "we'll just call the other service" is an
architectural decision and not an implementation detail, and it is why a design review that
does not count hops is not a design review.**

## The sentence to quote when someone objects

From Fowler and Lewis, under a heading that is itself the argument — *"Synchronous calls
considered harmful"*:

> *"Any time you have a number of synchronous calls between services you will encounter the
> multiplicative effect of downtime. Simply, this is when the downtime of your system
> becomes the product of the downtimes of the individual components. You face a choice,
> making your calls asynchronous or managing the downtime."*

And the two named responses in the same paragraph, which are worth citing because they show
the range of legitimate answers:

> *"At www.guardian.co.uk they have implemented a simple rule on the new platform — one
> synchronous call per user request while at Netflix, their platform API redesign has built
> asynchronicity into the API fabric."*

microservices.io states the same thing as a pattern drawback, in the RPI page:

> *"Reduced availability since the client and the service must be available for the
> duration"*

## The arithmetic, stated once

Let an operation depend on n services, each independently available with probability p, all
of which must succeed for the operation to succeed. Then:

```text
A(operation) = p₁ × p₂ × … × pₙ

and when every pᵢ is the same p:

A(operation) = pⁿ
```

That is the whole model. It has exactly two assumptions and both matter:

1. **Every dependency is *hard*** — the operation cannot complete without it. A dependency
   you can serve a degraded answer past does not belong in the product. See
   [03e](03e-hard-and-soft-dependencies.md).
2. **Failures are *independent*** — one service being down does not change the probability
   that another is. This is generally false in practice and it makes the model optimistic in
   some ways and pessimistic in others. See [03d · Where the arithmetic
   lies](03d-where-the-arithmetic-lies.md), which you should read before you take any number
   here to a stakeholder.

## The table, computed

Every figure below is `pⁿ`, evaluated exactly. Redo any cell with a calculator.

| Hops (n) | p = 99% | p = 99.9% | p = 99.99% |
|---|---|---|---|
| 1 | 99.0000% | 99.9000% | 99.9900% |
| 2 | 98.0100% | 99.8001% | 99.9800% |
| 3 | 97.0299% | 99.7003% | 99.9700% |
| 4 | 96.0596% | 99.6006% | 99.9600% |
| 5 | 95.0990% | 99.5010% | 99.9500% |
| 6 | 94.1480% | 99.4015% | 99.9400% |
| 8 | 92.2745% | 99.2028% | 99.9200% |
| 10 | 90.4382% | 99.0045% | 99.9000% |

Two readings of that table are the reason to memorise it.

**First**: the top-left corner is a disaster and the bottom-right corner is fine. At
p = 99%, five hops costs you nearly four points of availability. At p = 99.99%, ten hops
costs you a tenth of a point. **The number of hops you can afford is a function of how good
your dependencies are**, and the two numbers are not independent decisions.

**Second, and more useful**: notice the diagonal. `0.9999^10` is exactly `0.999`, and
`0.999^10` is very nearly `0.99`. **Ten hops costs you one nine.** That is the rule of thumb
worth carrying: each order-of-magnitude increase in hop count eats one nine of availability.
It is not exact — `0.999^10 = 99.0045%`, slightly better than 99% — but it is close enough
to reason with on a whiteboard and it is easy to remember.

## The same table as downtime, which is what people actually feel

A percentage is abstract. Converting to time is what makes an executive care. Using a
365-day year (525,600 minutes):

| Hops (n) at p = 99.9% | Availability | Unavailable per year |
|---|---|---|
| 1 | 99.9000% | 8.76 h |
| 2 | 99.8001% | 17.51 h |
| 3 | 99.7003% | 26.25 h |
| 4 | 99.6006% | 34.99 h |
| 5 | 99.5010% | 43.71 h |
| 10 | 99.0045% | 87.21 h |

Read the p = 99.9% column as: **each additional hard synchronous dependency costs you
roughly another 8.76 hours of downtime per year**, because at these levels unavailability
adds almost linearly (`1 - pⁿ ≈ n(1 - p)` for small `1 - p`). That approximation is the
fastest way to do this in your head: **sum the unavailabilities.** Five dependencies at
99.9% is five times 0.1%, so about 0.5% unavailable, so about 99.5%. Compare to the exact
99.5010% — the approximation is good to four decimal places at this scale.

For p = 99%, the same approximation gives 5 × 1% = 5%, so 95%, against an exact 95.0990%.
Still fine for a whiteboard, and it degrades as p drops, which is itself informative: the
worse your dependencies, the more the exact product matters.

## Applying it to the controller from chunk 01

The `POST /orders` endpoint in [01](01-coupling-is-the-decision.md) made three hard
synchronous calls — Customer, Inventory, Pricing — plus its own database and its own
process. That is five things that must be up.

If each of the five is independently available 99.9% of the time, the endpoint's ceiling is
`0.999^5 = 99.5010%`. **Note the word ceiling**: that is the availability the endpoint has
*if its own code is perfect*. Every bug, every bad deploy, every OOM in Order Service comes
out of the remaining budget.

Now suppose the product owner has committed to 99.9% for checkout. The arithmetic says that
is unreachable with this design **no matter how well Order Service is written**, because the
dependencies alone consume five times the entire error budget. The design has to change or
the commitment has to change; there is no third option, and no amount of effort inside Order
Service is the third option. That is the conversation this table is for, and it is why the
arithmetic is worth doing *before* the commitment rather than during the post-mortem.

[03b · What it does to an SLO](03b-what-it-does-to-an-slo.md) works that argument through
properly.

## Why you should distrust round p values

The `p = 99%` column exists because it is the number people say. Almost nothing you depend
on has a real availability of exactly 99%, and you usually do not know the true figure for
an internal service at all. That does not make the arithmetic useless — it makes it a
**sensitivity analysis**. Run it at three plausible values of p and look at whether your
design's answer changes. If your endpoint is acceptable at 99.9% and unacceptable at 99.5%,
you have discovered that your architecture is betting on a number nobody has measured, which
is a finding worth having.

The failure mode to avoid is the opposite one: quoting `0.99^5 = 95.1%` as though it were an
observation about your system. It is a consequence of an assumption you chose. Say the
assumption out loud every time you say the result.

## Gotchas

**★ The arithmetic is about *hard* dependencies, and most people count every call.**
If a call has a genuine fallback — a cached value, a default, a field omitted from the
response — the operation still succeeds when it fails, and it does not multiply. Counting it
in the product overstates the problem and, worse, makes the exercise feel like doom-mongering
so people stop doing it. Count only the calls without which you return an error.

**★ Adding a hop is not the only way n grows.** Your own process, your own database, the
network path, the ingress, the gateway and any service mesh sidecar are all in the product
for a request that crosses them. A "one hop" architecture with a gateway and a database is
already n = 4. The arithmetic does not care that some of the terms are infrastructure.

**★ Retries do not restore the product, they change p.** A retried call has a higher
effective availability than a single attempt *for independent transient faults* — and no
higher availability at all for a dependency that is genuinely down, because every attempt
hits the same dead service. Since outages, not packet loss, dominate real unavailability
budgets, modelling retries as a fix for the product is usually wrong. They also cost you
latency budget and can amplify load; see [07b](07b-retries-and-amplification.md).

**★ Multiple instances of the same dependency do not give you independence.**
Three replicas of Pricing behind one load balancer share a deployment, a config, a database
and a bad release. Their failures are strongly correlated, so their combined availability is
nowhere near `1 - (1-p)³`. Redundancy within a service raises its p; it does not remove that
service as a single term in your product.

**★ Quoting the number without the assumption destroys your credibility the first time
someone checks.** "Checkout is 95% available" is a claim about production and it is false —
it is a modelled ceiling under an assumed p. Say "if each of the five dependencies is 99%
available and their failures are independent, the ceiling is 95.1%." The extra clause is
what makes the argument survive scrutiny.

## Interview questions

**★ Five services, each 99.9% available, all required for one request. What is the request's
availability, and how did you get it?**
`0.999^5`, which is 99.5010% — about 43.7 hours of unavailability per year against 8.76 for
a single service. The reasoning is that all five must be up simultaneously and, assuming
independence, the probability of a conjunction of independent events is the product of their
probabilities. The fast mental version is to add the unavailabilities: five times 0.1% is
0.5%, so roughly 99.5%.

**★ Why is it a product and not an average?**
Because the operation requires a conjunction, not a selection. It succeeds only if
dependency 1 *and* dependency 2 *and* … all succeed. The average would be the right model if
you needed *one* of them and could pick whichever was up — that is a redundancy model, and it
gives `1 - Π(1-pᵢ)`, which increases with each addition instead of decreasing. Confusing the
two is the single most common error, and it is diagnosable by asking whether adding a
dependency should make the system better or worse.

**★ Your team has an SLO of 99.9% and the endpoint has four hard synchronous dependencies.
What do you tell them?**
That the SLO is not achievable by improving their own code. Even if all four dependencies
run at 99.9% and their own service never fails, the ceiling is `0.999^4 = 99.6006%`, which
is already four times over budget. The options are to remove dependencies from the request
path (cache, copy, defer), to convert hard dependencies into soft ones by defining a degraded
response, to get the dependencies to a higher availability, or to renegotiate the SLO.
Effort spent on their own reliability is spent on the smallest term.

**★ Does making the calls parallel instead of sequential improve the availability?**
No. Parallelism changes latency, not availability: you still need all n answers, so the
product is unchanged. It is a real and worthwhile latency optimisation — the total wait
becomes the slowest call rather than the sum — but it is worth being explicit that it buys
nothing on the availability axis, because "we'll parallelise them" is a common and confident
non-answer to an availability objection. See [03c](03c-chains-fan-out-and-composition.md).

**★ Is `0.99^n` something you measured?**
No, and neither is anyone else who quotes it. It is arithmetic evaluated on an assumed input.
Its value is not that it predicts your uptime; it is that it shows the *shape* of the
relationship — that hops compound rather than add up gently — and it lets you compare two
candidate designs before either exists. Presenting it as an observation is both wrong and
easy to disprove, and it discredits the argument it was meant to support.

**★ What real-world effect makes this model too optimistic, and what makes it too
pessimistic?**
Too optimistic: failures are correlated. Shared infrastructure, a shared platform upgrade, a
shared config service or a shared cloud zone can take several dependencies down together, and
a single overloaded dependency can cascade into its callers, so the real joint distribution
is worse than the product suggests in the ways that matter most. Too pessimistic: not every
call is truly hard, requests are not uniformly distributed across dependencies, and partial
outages usually affect a fraction of requests rather than all of them. The honest use is as a
bound and a comparison tool, not a forecast — [03d](03d-where-the-arithmetic-lies.md) is the
long version.

{/* FOOTER */}
