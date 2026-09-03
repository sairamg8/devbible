---
title: "Operational load scales with the number of services, not with the number of users — so a split that changes nothing about your traffic can still multiply your alerts, your dashboards, your runbooks and your pages by twelve"
sidebar_label: "07 · The on-call surface"
sidebar_position: 16
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-01 against Martin Fowler, *Microservice Prerequisites*
> ([martinfowler.com](https://martinfowler.com/bliki/MicroservicePrerequisites.html)) and
> *Microservice Premium*
> ([martinfowler.com](https://martinfowler.com/bliki/MicroservicePremium.html)); Chris
> Richardson, *Pattern: Microservice Architecture*
> ([microservices.io](https://microservices.io/patterns/microservices.html)); Team
> Topologies, *Key Concepts* ([teamtopologies.com](https://teamtopologies.com/key-concepts)).
> Version spine: JDK 25 · Spring Boot 4.1.0 · Spring Modulith 2.1.1. **No sandbox** — the
> counts below are structural arithmetic, not observations from a production estate.

**Every service you create is a permanent operational object. It needs alerts that someone
tuned, a dashboard someone maintains, a runbook someone wrote, a deployment pipeline someone
fixes when it rots, a dependency-upgrade stream someone follows, and a place in a pager
rotation someone staffs. None of that scales with traffic and none of it goes away. This is
the recurring cost of a split, it is paid monthly, and it appears on no architecture
diagram.**

## What one service costs, itemised

Per service, forever:

| Artefact | Rots if unmaintained | Who notices when it rots |
|---|---|---|
| Deployment pipeline | Yes — base images, plugin versions, credentials expire | Whoever deploys next, urgently |
| Alert set (error rate, latency, saturation, dependency health) | Yes — thresholds drift as traffic changes | Nobody, until an outage is missed |
| Dashboard | Yes — panels break as metric names change | Whoever is on call, at 3am |
| Runbook | Yes — fastest to rot, since it encodes procedures | The next new joiner |
| Health and readiness endpoints | Yes — a readiness probe that lies causes rolling-update outages | The platform, loudly |
| Dependency-upgrade stream (CVEs, framework versions) | Yes — this is the one that becomes unignorable | Security review |
| Log retention, index and cost | Yes | Finance |
| Capacity and resource limits | Yes | The pod, via OOMKill |
| On-call ownership and escalation path | Yes — reorganisations orphan services | An incident with no owner |

Nine recurring commitments. A monolith has one of each. Twelve services have twelve of
each, **plus** the interaction concerns that belong to no single service.

## The alert arithmetic, and the thing that actually kills you

Structural arithmetic, not measurement: if a service warrants roughly five alerts (error
rate, p99 latency, saturation, dependency failure, queue depth) then twelve services warrant
about sixty, before any alert about interactions between them.

The number of alerts is not the problem. **The problem is that alert quality falls as the
count rises**, and it falls non-linearly:

- Each alert is tuned by someone who owns that service; consistency across sixty alerts
  requires a standard nobody has time to enforce.
- A single user-visible failure now fires alerts in every service on the path, so one
  incident becomes five pages to three teams, and the first ten minutes go on establishing
  that it is one incident.
- Alerts that fire without action get muted, and muting is per-alert, so the estate silently
  develops holes.

This is the concrete mechanism behind alert fatigue, and it is a direct function of service
count.

## Fowler's prerequisites are the mitigation, and they are not free

> *"Basic Monitoring: with many loosely-coupled services collaborating in production, things
> are bound to go wrong in ways that are difficult to detect in test environments. As a
> result it's essential that a monitoring regime is in place to detect serious problems
> quickly. The baseline here is detecting technical issues (counting errors, service
> availability, etc) but it's also worth monitoring business issues (such as detecting a
> drop in orders)."*

Note *"monitoring business issues (such as detecting a drop in orders)"*. That is the alert
that catches the failures your per-service technical alerts miss — every service healthy,
orders down 40%, because a semantic mismatch between two of them is silently discarding
carts. In a monolith the same class of bug exists but produces an exception somewhere. Across
services it produces a successful HTTP 200 containing nothing useful.

And the organisational half:

> *"These capabilities imply an important organizational shift — close collaboration between
> developers and operations: the DevOpsCulture. This collaboration is needed to ensure that
> provisioning and deployment can be done rapidly, it's also important to ensure you can
> react quickly when your monitoring indicates a problem. In particular any incident
> management needs to involve the development team and operations, both in fixing the
> immediate problem and the root-cause analysis to ensure the underlying problems are
> fixed."*

"You build it, you run it" is Team Topologies' framing of the same thing — stream-aligned
teams with *"no hand-offs to other teams for any purpose"*. Which means the engineers
writing features carry the pager for their services. That is a real change to people's
lives and it should be agreed with them, not announced.

## The incident that has no owner

The cost people genuinely fail to anticipate: **a service has an owner, an interaction does
not.** Checkout fails because inventory returns a reservation the payment service treats as
already-consumed. Three teams each verify their service behaved exactly as specified.
Nobody's alert is wrong. Nobody's code is wrong. The incident is real.

The mitigations all cost something:

- **Name an owner per user-facing flow**, not just per service — usually the team closest to
  the customer outcome. This creates a responsibility that spans team boundaries, which is
  organisationally awkward and therefore usually skipped.
- **Alert on business outcomes**, not just service health, so the flow's failure is
  detectable even when every component is green.
- **Contract tests** so semantic mismatches fail in a pipeline instead of in production —
  **11 · Contract testing** *(not written yet)*.

## What the monolith gets for free, and how much of it you keep

One deployable: one pipeline, one alert set, one dashboard, one runbook, one rotation, one
log stream, one dependency-upgrade stream. A failure anywhere produces an exception in one
place, with a stack trace.

That is not an argument for never splitting. It is the reason the operational line on the
split's bill is not a rounding error, and the reason [18 · The prerequisites and the
headcount](08b-the-prerequisites-and-the-headcount.md) treats these as staffing rather than
tooling.

The part you can rehearse in-process: Spring Modulith's actuator and observability support
give per-module metrics and spans inside one deployable —
**51 · Actuator and observability** *(not written yet)*. Two counters exist for
event publications:

> *"module.events.published – a counter summarizing all event publications."*
>
> *"module.events.published.$moduleIdentifier.$simpleEventTypeName - a counter for the
> individual event that can be further enriched with domain-specific values."*

If your team will not build a dashboard on those, or will not alert on a module's event
count dropping to zero, that is useful evidence about whether they will maintain twelve sets
of dashboards after a split.

## Gotchas

**★ Operational cost scales with service count, not with load, so a split that changes
nothing about traffic still multiplies the recurring work.** Nine recurring commitments per
service — pipeline, alerts, dashboard, runbook, probes, dependency upgrades, log budget,
capacity, ownership — each of which rots if unmaintained. Count them explicitly when
proposing a split; "twelve services" means "one hundred and eight standing commitments".

**★ Alert quality falls as alert count rises, and the failure is silent.** Alerts that fire
without a corresponding action get muted individually, so the estate develops holes nobody
has inventoried. Review muted alerts as a standing agenda item, and treat a muted alert as
a bug in the alert rather than a solved problem.

**★ One user-visible failure fires alerts in every service on the path.** The first ten
minutes of every incident go on establishing that five pages are one problem. Alert on the
user-facing outcome at the edge, and make per-service alerts secondary, or your paging
volume grows with path length rather than with incident count.

**★ Interactions have no owner and that is where the hard incidents live.** Every service
behaved as specified, the flow failed anyway, and the postmortem has three teams each
correctly declining responsibility. Assign an owner per user-facing flow explicitly — it is
organisationally awkward, which is why it is skipped, which is why the incidents recur.

**★ The dependency-upgrade stream is the cost that becomes unignorable first.** A CVE in a
common library means twelve pull requests, twelve pipeline runs and twelve deployments
rather than one. This is not dramatic, it is just relentless, and it is the line item most
likely to consume the platform engineer you did not budget for.

**★ Business-outcome alerting is the only thing that catches semantic failures, and it is
always built last.** Every service green and orders down 40% is a real and common failure
shape after a split, because a mismatch between two services produces successful responses
containing nothing useful. Fowler names business monitoring in the prerequisite itself for
exactly this reason.

**★ Reorganisations orphan services, and nothing in the system notices.** A team splits, a
team is dissolved, someone leaves — and a service continues running with no owner, no one
watching its alerts and no one applying its upgrades. Maintain an ownership registry that is
checked in CI against the deployed service list, or discover the orphans during an incident.

**★ "You build it, you run it" is a change to people's working conditions.** Moving the
pager to the feature teams is the correct model and it is not a purely technical decision.
It affects hiring, compensation expectations, working hours and retention. Agree it with the
people who will carry it before the architecture assumes it.

## Interview questions

**★ What scales with service count that does not scale with traffic?**
Essentially all the operational work: deployment pipelines, alert sets, dashboards,
runbooks, health and readiness endpoints, dependency and CVE upgrade streams, log retention
budgets, capacity configuration, and on-call ownership. Each of those is a standing
commitment that rots if unmaintained, and each is multiplied by the number of services
regardless of whether a single additional user arrived. This is the recurring half of the
microservice premium, and it is paid monthly by a team that usually was not in the room when
the split was decided.

**★ Why does alert quality degrade as an estate grows?**
Because the count grows linearly while the attention available to tune each alert does not,
and because one user-visible failure now fires alerts across every service on the path — so
paging volume tracks path length rather than incident count. The natural human response is
to mute noisy alerts individually, which creates holes in coverage that are invisible until
something is missed. The structural fixes are alerting on user-facing outcomes at the edge
with per-service alerts as secondary detail, and reviewing muted alerts as a standing item
rather than treating a mute as a resolution.

**★ Who owns an incident where every service behaved correctly?**
Nobody, unless you assigned an owner per user-facing flow rather than only per service. This
is the characteristic hard incident of a distributed system: inventory returned a
reservation, payment interpreted it as consumed, checkout failed, and three teams each
verified their component matched its specification. The mitigations are naming a flow owner —
usually the team closest to the customer outcome — alerting on business outcomes so the
failure is detectable when all components are green, and consumer-driven contract tests so
the semantic mismatch fails in a pipeline instead of in production.

**★ How would you test whether your organisation is ready for the operational load of a
split?**
Check whether it maintains the operational artefacts it already has. Is there a runbook for
the monolith, and was it updated this year? Are there alerts that have been muted for more
than a month? Is there a dashboard that anyone opens outside an incident? Does the team
carrying the pager also write the features? Then run a cheap rehearsal: add Spring
Modulith's observability support, build a dashboard on the per-module event counters and
module invocation spans, and alert on a module's event rate falling to zero. A team that
will not maintain one set of module dashboards will not maintain twelve sets of service
dashboards, and finding that out costs a sprint rather than a year.

{/* FOOTER */}
