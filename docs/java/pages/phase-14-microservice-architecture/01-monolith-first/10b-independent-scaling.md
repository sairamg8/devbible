---
title: "\"We need to scale it independently\" is the most commonly stated and least commonly true reason for splitting, because a monolith scales horizontally perfectly well — the real requirement is almost always a different resource shape, and that has a much cheaper answer"
sidebar_label: "10b · Independent scaling"
sidebar_position: 22
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-01 against Chris Richardson, *Pattern: Monolithic Architecture* and
> *Pattern: Microservice Architecture*
> ([microservices.io](https://microservices.io/patterns/monolithic.html)); Martin Fowler,
> *Microservice Premium*
> ([martinfowler.com](https://martinfowler.com/bliki/MicroservicePremium.html)); Spring Boot
> 4.1 reference, profiles.
> Version spine: JDK 25 · Spring Boot 4.1.1 · Spring Modulith 2.1.1. **No sandbox** — no
> throughput, memory or instance-count figures on this page were measured.

**A monolith scales horizontally. Richardson says so in the pattern's own example section.
So "we need to scale" is almost never the real requirement — the real requirement is that
two subdomains want *different* resources, different limits or different scaling triggers,
and that has an answer that costs a deployment manifest rather than an architecture.**

## The claim the pattern itself makes

> *"You can run multiple instances of the application behind a load balancer in order to
> scale and improve availability."*

That is the monolith pattern page, not a defence of monoliths. Raw throughput scaling is not
a distinguishing benefit of microservices, and a proposal that says "we need microservices to
handle more traffic" has not identified a real constraint.

What Richardson actually lists as the force is narrower and more precise:

> *"Segregate by characteristics - e.g. resource requirements to improve scalability, their
> availability requirements to improve availability, their security requirements to improve
> security, etc."*

**Characteristics**, not volume. The question is not "can we handle more load" but "do two
subdomains want incompatible configuration".

## What "incompatible configuration" concretely means

| Characteristic | Checkout API | Nightly report generator |
|---|---|---|
| Heap | Small, stable | Large, spiky |
| GC objective | Low pause | Throughput |
| Instance count driver | Request rate | Fixed, or one |
| Latency budget | Tight | Irrelevant |
| Restart tolerance | Must drain gracefully | Restart freely |
| Failure impact | Revenue stops | A report is late |

In one process those are one heap, one collector, one instance count, one restart policy.
That is a genuine constraint and it is item 6 on
[21 · What genuinely does not work](10-what-genuinely-does-not-work.md).

## The answer that is not a split, and is skipped almost every time

**Deploy the same artefact more than once, with different configuration.** One codebase, one
build, one version, several deployments with different profiles, different resource limits
and different scaling rules.

```java
package com.acme.commerce.reporting;

import org.springframework.context.annotation.Profile;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

@Component
@Profile("batch")                       // only active in the batch deployment
class NightlyReportRunner {

    private final ReportGenerator generator;

    NightlyReportRunner(ReportGenerator generator) {
        this.generator = generator;
    }

    @Scheduled(cron = "0 0 2 * * *")
    void run() {
        generator.generateDailySalesReport();
    }
}
```

```yaml
# api deployment
spring:
  profiles:
    active: api
---
# batch deployment — same JAR, same version, different shape
spring:
  profiles:
    active: batch
```

What that buys, immediately:

- **Different heaps and collectors** — the batch deployment gets a large heap and a
  throughput collector; the API gets a small heap and a low-pause collector.
- **Different instance counts and autoscaling rules.**
- **Blast-radius reduction** — a batch job that exhausts its heap kills the batch pod, and
  the API keeps serving. That is a real process boundary between two workloads.
- **Different restart and drain policies.**

What it does **not** buy:

- **Independent release.** One artefact version. The reporting team still cannot ship
  without the ordering team's code being releasable. That is item 1 and it has no
  substitute.
- **Different technology stacks.**
- **Separate databases**, unless you separate them deliberately.

**This is the single most under-used option in the whole decision**, and it answers a large
fraction of what people mean by "scale independently". It is also fully reversible, which
almost nothing else in this topic is.

## When the monolith genuinely cannot scale

Three real cases, stated without hedging:

**1. One subdomain's resource appetite forces the whole fleet up.** If checkout needs 40
instances only because the shared connection pool must accommodate the reporting queries
running in the same processes, you are paying for 40 copies of everything to satisfy one
module. The two-deployables answer usually fixes this; if it does not, the split does.

**2. The stateful component cannot be replicated.** An in-memory cache that must be
coherent, a scheduler that must run exactly once, a long-lived session store. These are
not "the monolith cannot scale" — they are "this component cannot scale" — and extracting
that component is the fix, not extracting everything else.

**3. The database is the bottleneck, and it is one database.** This one deserves care,
because splitting the *application* does nothing for it. What helps is splitting the *data*,
and that is a different and larger project owned by **03 · Database-per-service** *(not
written yet)*. Teams routinely split services, keep one database, and are surprised when the
bottleneck does not move.

## The order to try things in

1. **Measure.** Which resource, which subdomain, at what time. If nobody can answer, stop.
2. **Tune.** Heap sizing, collector choice, connection pool sizing, query fixes. Phase 12
   owns all of it and it is by far the cheapest tier.
3. **Scale horizontally.** More instances of the whole application.
4. **Split the deployable, not the codebase.** Profiles, several deployments, one artefact.
5. **Extract the one subdomain** whose characteristics genuinely cannot be reconciled.
6. **Split the data**, which is the expensive irreversible step, and only if 1–5 did not do
   it.

Most teams jump from 1 (or from no measurement at all) directly to 6.

## Gotchas

**★ "Scale independently" almost always means "different resource shape", and those have
completely different prices.** Different shape costs a deployment manifest and a profile.
Independent release costs an architecture. Ask which one is meant before evaluating
anything else; the conflation is close to universal.

**★ Splitting the application does not fix a database bottleneck.** If one database is the
constraint, six services against that same database is six sets of connection pools
competing for it — usually worse, because you have lost the ability to reason about total
concurrency in one place. The fix for a data bottleneck is a data change: indexes, query
rewrites, read replicas, caching, or eventually splitting the data itself.

**★ Two deployables from one artefact is fully reversible and nearly free, and hardly anyone
considers it.** Same JAR, same version, different profiles, different limits. It delivers
resource segregation, blast-radius reduction between workload types and independent
autoscaling, without a single network hop between subdomains and without giving up
`@Transactional`. If someone rejects it, make them say which of those they need that it does
not give.

**★ A stateful component that cannot be replicated is an argument for extracting *that
component*, not for splitting the system.** A single-instance scheduler, a coherent
in-memory cache, a sticky session store. Each is one boundary with a specific technical
justification, and each is usually solvable by replacing the component — a distributed lock
for the scheduler, an external cache — rather than by restructuring the application.

**★ Scaling by request rate hides the subdomain that is actually consuming the resource.**
Autoscaling on CPU or request count scales the whole application because one module is
expensive. Before splitting, get per-module attribution — Spring Modulith's observability
support gives you per-module spans and event counters
(**51** *(not written yet)*) — so you know which module is driving the fleet
size rather than guessing.

**★ Availability requirements segregate as usefully as resource requirements, and are
easier to argue.** Checkout must be up; the admin CMS need not be. In one deployable they
share an availability tier, so the less-disciplined team's changes set the risk profile for
the revenue path. That is a legitimate segregation argument and it is more persuasive than
throughput, because it is about risk rather than capacity.

**★ Every scaling argument should carry a measurement, and most carry an anecdote.** "The
site was slow at Christmas" is not a resource attribution. Which subdomain, which resource,
what limit, at what time. Without those four, any architectural change is being proposed on
the basis of a feeling.

## Interview questions

**★ Can a monolith scale?**
Horizontally, yes — Richardson's own monolith pattern page says you can run multiple
instances behind a load balancer to scale and improve availability. What a monolith cannot do
is give two subdomains *different* characteristics: different heap sizes, different garbage
collectors, different instance counts, different autoscaling triggers, different restart
policies, different availability tiers. So "we need to scale" is rarely the real constraint;
"these two workloads want incompatible configuration" usually is, and that has an answer far
short of splitting.

**★ What is the cheapest fix for two subdomains with incompatible resource profiles?**
Deploy the same artefact twice with different Spring profiles, different resource limits and
different scaling rules — an API deployment and a batch deployment from one JAR at one
version. You get separate heaps and collectors, independent instance counts, genuine
blast-radius separation between the two workloads, and different restart policies, with no
network hop between subdomains, no lost transactions and full reversibility. What you do not
get is independent release cadence, because it is still one artefact version. If that is the
actual requirement, this does not help; if it is not, nothing more expensive is warranted.

**★ Your database is the bottleneck. Does splitting into microservices help?**
Not by itself, and it can make things worse. Six services against one shared database means
six connection pools competing for the same resource with no single place to reason about
total concurrency. What helps is changing the data layer: indexing, query rewrites, read
replicas for read-heavy paths, caching, and eventually partitioning the data by ownership.
That last one is the genuinely expensive, genuinely irreversible step, and it is a data
project rather than an application-topology project — which is why teams that split services
first and keep the shared database are surprised that the bottleneck did not move.

**★ In what order should you attempt to solve a scaling problem?**
Measure first — which subdomain, which resource, at what time — and stop if nobody can
answer. Then tune: heap sizing, collector choice, pool sizing, the expensive queries. Then
scale horizontally, more instances of the whole application. Then split the *deployable*
rather than the codebase, using profiles to produce several deployments from one artefact.
Then extract the one subdomain whose characteristics genuinely cannot be reconciled with the
rest. Only then split the data, which is the expensive and irreversible step. The common
failure is jumping from an unmeasured complaint straight to the last item.

{/* FOOTER */}
