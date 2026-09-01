---
title: "The availability product assumes your dependencies fail independently, which they do not — so use it as a comparison tool and a bound, and never quote it as a forecast you will be held to"
sidebar_label: "09 · Where the arithmetic lies"
sidebar_position: 9
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-01 against the Google SRE book, "Addressing Cascading Failures"
> ([sre.google](https://sre.google/sre-book/addressing-cascading-failures/)) and "Embracing
> Risk" ([sre.google](https://sre.google/sre-book/embracing-risk/)), and Martin Fowler &
> James Lewis, "Microservices"
> ([martinfowler.com](https://martinfowler.com/articles/microservices.html)).
> 🔴 **Arithmetic only.** No figure here was measured, and this page is largely about why the
> arithmetic should not be treated as a measurement. Version spine: JDK 25 · Spring Boot
> 4.1.0 / Spring Framework 7.0.8.

**A page that teaches `pⁿ` and stops there has taught you something you will be embarrassed
by in a design review, because the first competent person you meet will point out that the
model's central assumption is false. Failures in a real system are correlated: services share
platforms, configs, deploy pipelines, cloud zones and each other. Knowing exactly how the
model is wrong is what makes it usable — it tells you which direction the error runs in, and
therefore which decisions the model can and cannot support.**

## The assumption, stated precisely

`A = p₁ × p₂ × … × pₙ` is the probability of a conjunction of **independent** events. Two
events are independent when knowing that one occurred tells you nothing about the
probability of the other.

In a microservice system that is essentially never true. Some ways it fails:

## 1 · Shared infrastructure makes failures positively correlated

Your five services run on the same Kubernetes cluster, in the same cloud region, behind the
same ingress, pulling images from the same registry, resolving names through the same DNS,
reading secrets from the same store. Any one of those failing takes several of your terms
down at the same instant.

The effect on the model: **`pⁿ` is too optimistic about the frequency of total failure and
too pessimistic about the frequency of partial failure.** The real distribution is lumpier
than the model — long stretches of everything working, punctuated by everything breaking at
once.

The practical consequence is not "the model is useless"; it is that **shared infrastructure
is itself a term in the product, and it is the term with the largest exponent.** If the
cluster is 99.95% available, then no operation in it exceeds 99.95%, no matter how many
services you delete from the request path. Counting only your own services and ignoring the
platform is a very common way to produce a number that is confidently wrong in the
optimistic direction.

## 2 · A shared database is one failure domain wearing several service names

Three services that read from the same PostgreSQL instance are not three independent terms.
If the database is down, all three are down together. Modelling them as `p³` when they are
effectively `p_db` overstates the problem by a lot, and — worse — points the remediation at
the wrong place. The fix for that shape is not "remove a hop"; it is
**03 · Database-per-service** *(not written yet)*, which is the topic that owns why they
should not be sharing in the first place.

**Count distinct failure domains, not services.** A failure domain is the set of things that
go down together. Two services sharing a database are one domain for availability purposes,
even though they are two deployments.

## 3 · Cascading failure makes the model qualitatively wrong, not just numerically

This is the important one, and it is the reason the SRE book devotes a chapter to it. In the
independence model, a dependency failing costs you exactly that dependency. In reality, a
dependency *slowing down* consumes the caller's resources, and the caller then fails for
reasons of its own.

The SRE book's list of what runs out is worth reading in full; the mechanism is:

> *"As a server becomes overloaded, its responses to RPCs from its clients arrive later,
> which may exceed any deadlines those clients set. The work the server did to respond is
> then wasted, and clients may retry the RPCs, leading to even more overload."*

and, on memory specifically, the Java-relevant one:

> *"Increased rate of garbage collection (GC) in Java, resulting in increased CPU usage. A
> vicious cycle can occur in this scenario: less CPU is available, resulting in slower
> requests, resulting in increased RAM usage, resulting in more GC, resulting in even lower
> availability of CPU. This is known colloquially as the 'GC death spiral.'"*

So the true conditional probability — your service being up *given* that a dependency is
degraded — is much lower than your standalone availability. The product model has no place
to express that. It treats your own `p` as a constant when it is a function of your
dependencies' state.

**Direction of the error: the model is optimistic.** Real systems fail worse than `pⁿ`
predicts, in exactly the scenarios that matter.

## 4 · Partial failure is not binary, and neither is "available"

`p` is a single number standing in for a distribution. A dependency is rarely all-the-way
down; it is more often down for 3% of requests, or down for one shard, or down for one
region, or slow for the 5% of requests that touch a particular key range. The SRE book's
bimodal-latency worked example — reproduced in
[04e](04e-bimodal-latency-and-exhaustion.md) — shows a 5% failure rate turning into an 80.4%
error rate through nothing but a badly chosen deadline.

That is the single most important reason not to treat `pⁿ` as a forecast. **The amplification
factor between a dependency's fault rate and your fault rate is a property of your timeout
and retry configuration, not of the dependency**, and the product model cannot see it at all.

## 5 · Requests are not uniformly distributed over dependencies

The model implicitly assumes every request needs every dependency. In practice, the loyalty
service is only called for logged-in users, the tax service only for certain jurisdictions,
the fraud service only above a threshold. If 10% of requests touch a dependency, that
dependency's outage costs you 10% of requests, not 100%.

**Direction of the error: pessimistic.** This is the main way `pⁿ` overstates the damage, and
it is worth computing when the number you get is being used to block a design. The
request-weighted version — sum over dependencies of `(fraction of requests using it) ×
(its unavailability)` — is more work and much more defensible.

## 6 · Correlated *recovery* is a thing too

When the shared cause is fixed, everything comes back at once — and the retries that
accumulated during the outage all fire at the same moment. The SRE book names the failure
mode:

> *"If retries aren't randomly distributed over the retry window, a small perturbation (e.g.,
> a network blip) can cause retry ripples to schedule at the same time, which can then
> amplify themselves"*

so the outage is sometimes longer than the fault, because recovery is itself an overload
event. Nothing in `pⁿ` hints at this. It is why jitter, covered in
[07c](07c-backoff-jitter-and-budgets.md), is not a micro-optimisation.

## What the model is still good for

Three things, and they are enough to justify teaching it:

1. **Comparing two designs.** The errors above apply roughly equally to both candidates, so
   the *ratio* survives even when the absolute numbers do not. "Design B has two fewer hard
   dependencies than design A" is a robust conclusion.
2. **Establishing an upper bound.** Because the dominant errors (correlation, cascading) run
   in the pessimistic direction for the system, `pⁿ` is closer to a **ceiling** than a
   forecast. "This endpoint cannot exceed 99.5% even in the best case" is a defensible
   sentence, and it is usually the sentence you need.
3. **Making an invisible cost visible.** Its real work is converting "we added a call" into a
   number that appears in a design document. The number does not have to be accurate to do
   that job.

The SRE book's framing of why extreme precision is not the point is relevant:

> *"a user on a 99% reliable smartphone cannot tell the difference between 99.99% and
> 99.999% service reliability!"*

You are not computing a physical constant. You are deciding whether to add a hop.

## How to state it so it survives scrutiny

Bad: *"Checkout is 95% available."*

Good: *"Checkout has five hard synchronous dependencies. If each runs at 99% and their
failures were independent, the ceiling would be 95.1%. Failures are not independent — they
share a cluster and a config service — so the real figure is worse during correlated events
and better during single-service ones. Either way, the design cannot meet a 99.9% target, and
removing two of the five is the only lever that changes that."*

The second version is longer and it is the one that ends the argument, because it has already
made the objection the sceptic was going to make.

## Gotchas

**★ Ignoring the platform is the most common way to under-count.** The cluster, the ingress,
the DNS, the certificate, the image registry and the config source are all terms. On a
managed platform they are usually high, which is fine — but they cap everything, and a design
that claims 99.99% on a 99.95% platform is claiming something impossible.

**★ Counting services rather than failure domains is the most common way to over-count.**
Two services on one database, or one service called twice, are one term. Over-counting makes
the analysis look alarmist, which is how the whole practice gets discarded.

**★ The model has no term for your own service's dependency-induced failure.** Your `p` is
not a constant; it drops when a dependency is slow, because slow dependencies consume your
threads, connections and heap. That coupling is the mechanism behind cascading failure and it
is invisible in the arithmetic. Bound it with timeouts and shedding, not with a better model.

**★ A "soft" dependency with an untested fallback is a hard dependency.** The fallback path
that has never been exercised will throw an unexpected exception on its first real use. Until
it is tested — deliberately, with the dependency actually broken — classify it as hard in the
arithmetic. This is the single most reliable way to be wrong in the optimistic direction.

**★ Availability targets are often quoted per month while incidents last hours.**
A 99.9% monthly SLO is 43.2 minutes; one four-hour incident is five and a half months of
budget. Modelling with a *rate* implies frequent small failures, when the real distribution is
rare large ones. This is another reason to treat the model as a comparator rather than a
predictor, and to talk about incident duration separately.

**★ Nobody will ever check your arithmetic, but they will check your assumptions.**
The number is easy to compute and hard to challenge; the assumption "all five are hard and
independent" is where a design review actually goes. Write the assumption above the number,
every time.

## Interview questions

**★ What is the central assumption behind `A = p₁ × p₂ × … × pₙ`, and is it true?**
Independence: that one dependency being unavailable tells you nothing about whether another
is. It is essentially never true in a microservice system, because services share clusters,
regions, ingresses, DNS, config, deploy pipelines and often databases, and because a slow
dependency degrades its callers directly. The correct response is not to abandon the model but
to know which direction each violation pushes it, and to present it as a bound and a
comparator rather than a forecast.

**★ Does correlation make the model too optimistic or too pessimistic?**
Both, in different places, and the optimistic errors are the dangerous ones. Positive
correlation from shared infrastructure and cascading failure makes real systems worse than the
model predicts, precisely during large incidents. Non-uniform request distribution — where
only a fraction of requests touch a given dependency — makes real systems better than the
model predicts, during ordinary single-service outages. Net: use it as a ceiling, because the
errors that dominate the tail run against you.

**★ Two of your five dependencies share a database. How does that change the calculation?**
They stop being two independent terms and become approximately one, because the database
outage takes both down simultaneously. The product goes from five terms to four, so the
modelled availability improves — and the actual system has not improved at all. That is the
tell that you should be counting failure domains rather than services, and it is also an
argument for **03 · Database-per-service** *(not written yet)*, because a shared database is
a shared blast radius wearing two service names.

**★ Someone challenges your `0.99^5 = 95.1%` figure as unrealistic. How do you respond?**
By agreeing, and then narrowing the claim. It is not a prediction of production availability;
it is the ceiling implied by five hard dependencies at an assumed availability, under an
independence assumption that is known to be false in both directions. What it supports is the
comparative claim — that a design with three hard dependencies has a materially higher ceiling
than one with five — and that claim is robust to every objection to the model, because the same
objections apply to both designs.

**★ Why does a badly chosen timeout make the availability model wrong rather than just
inaccurate?**
Because it introduces an amplification factor the model has no term for. The SRE book's
bimodal example shows a dependency fault affecting 5% of requests producing an 80.4% error
rate in the caller, purely because a long deadline let the slow 5% consume the caller's entire
thread pool. The caller's availability is therefore a function of its own timeout
configuration, not just of the dependency's availability, and no product of independent `p`
values can express that.

{/* FOOTER */}
