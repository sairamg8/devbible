---
title: "Part 8 — Reliability and observability"
sidebar_label: "8 · Reliability & observability"
sidebar_position: 8
---

> Phases 15–16 · Deciding how reliable the system must be, engineering it to get there, and seeing what it is actually doing

Every design is a promise about behaviour under failure, and this part is where the promise
is written down as a number, defended with mechanisms, and checked with telemetry. Senior
loops ask it directly ("what's your SLO and what happens when you burn the budget") and
through incidents ("walk me through an outage you owned"). The Node instrumentation —
structured logs, OpenTelemetry, metrics, health checks — is in Node's
[observability phase](../../nodejs/pages/phase-10-observability/README.md) and Java's
[resilience phase](../../java/pages/phase-16-resilience-operations/README.md); this part is
the practice those tools serve.

---

## Phase 15 — Reliability engineering

Reliability is a product decision expressed as an engineering budget. This phase turns
"it should be up" into indicators, objectives and the policy that spends an error budget —
then the mechanisms that keep a dependency's bad day from becoming yours.

| Topic | Tier |
|---|---|
| **SLIs, SLOs and SLAs** — indicators measured at the user's edge, objectives chosen per journey (checkout stricter than search), agreements as the contract with a penalty; why "99.99 %" without a definition is meaningless | <span className="db-tier t-master">Master</span> |
| **Error budgets and the policy that spends them** — the budget as the permission to ship, freezing releases when it burns, burn-rate alerting; the conversation between product and engineering it replaces | <span className="db-tier t-master">Master</span> |
| **Availability arithmetic** — the nines as minutes per month, serial dependencies multiplying failure, parallel redundancy dividing it; why five nines is a different engineering discipline from three | <span className="db-tier t-master">Master</span> |
| **Timeouts, retries, circuit breakers and bulkheads** — the four together, as a budget per hop; the dependency whose slowness became your outage because nothing gave up | <span className="db-tier t-master">Master</span> |
| **Graceful degradation and load shedding** — feature-level fallbacks (search without personalisation, checkout without recommendations), priority-based shedding, admission control at the edge | <span className="db-tier t-master">Master</span> |
| **Disaster recovery** — recovery point and recovery time objectives, backup strategies, active-passive vs active-active regions, the failover drill; the plan that had never been run | <span className="db-tier t-master">Master</span> |
| **Incident management** — severity levels, the on-call rotation, the incident commander, communication cadence, status pages; the first fifteen minutes of a Sev-1 | <span className="db-tier t-master">Master</span> |
| **Blameless postmortems** — timeline, contributing factors over root cause, action items with owners, the follow-through that most teams skip; writing one an interviewer would respect | <span className="db-tier t-master">Master</span> |
| **Backpressure end to end** — bounded queues, slow consumers signalling producers, rejecting early at the edge; the system that failed gracefully because it said no | <span className="db-tier t-understand">Understand</span> |
| **Redundancy and failure domains** — instances, zones, regions, providers; the correlated failure hiding behind "we have three replicas" (same rack, same deploy, same bug) | <span className="db-tier t-understand">Understand</span> |
| **Capacity planning** — headroom, growth curves, the flash-sale forecast, pre-scaling vs autoscaling; the capacity model presented as a spreadsheet, not a guess | <span className="db-tier t-understand">Understand</span> |
| **Load and performance testing** — scripted load tools, soak and spike tests, realistic data and traffic shapes, testing in production carefully; the load test that only proved the test rig's limit | <span className="db-tier t-understand">Understand</span> |
| **Chaos engineering and game days** — killing pods, adding latency, failing a zone on purpose, with a hypothesis and an abort condition; starting small | <span className="db-tier t-understand">Understand</span> |
| **Runbooks and operational readiness** — the runbook per alert, the production-readiness review before launch, ownership and escalation | <span className="db-tier t-understand">Understand</span> |
| **Mean time to recovery over mean time between failures** — optimising for fast detection and rollback rather than for never failing; what that changes in the pipeline | <span className="db-tier t-understand">Understand</span> |
| **The storefront's reliability plan** — an SLO per journey, the budget policy, the degradation ladder for a sale day, the DR posture; one page, defended | <span className="db-tier t-understand">Understand</span> |
| **Reliability of third parties** — payment providers, SMS gateways, maps; timeouts, fallbacks, multi-vendor failover, the SLA you inherit | <span className="db-tier t-know">Know</span> |

**Gate — deliverable:** the storefront's checkout SLO written as an indicator, an objective
and a burn-rate alert; the degradation ladder for a sale day; and a one-page postmortem of a
real or simulated outage with owned action items.

---

## Phase 16 — Observability at scale

You cannot operate what you cannot see, and at scale the seeing itself has a cost. This
phase is the signals, the open standard that carries them, the storage and query systems
behind the dashboards, and alerting that wakes people for symptoms rather than causes.

| Topic | Tier |
|---|---|
| **Logs, metrics, traces and profiles** — what each signal can and cannot answer; the outage that logs could not explain and one trace did | <span className="db-tier t-master">Master</span> |
| **OpenTelemetry** — the signals, semantic conventions, context propagation across HTTP and queues, the collector as the pipeline; instrumenting once and exporting anywhere | <span className="db-tier t-master">Master</span> |
| **Alerting on symptoms** — user-facing indicators over internal causes, SLO burn-rate alerts with multiple windows, paging vs ticketing; the alert that fired every night and taught the team to ignore it | <span className="db-tier t-master">Master</span> |
| **Dashboards that answer questions** — the golden signals and RED/USE methods, one overview per service, drill-down paths; the dashboard nobody opened during the incident | <span className="db-tier t-master">Master</span> |
| **Correlation and request ids end to end** — from the edge through services, queues and workers to the log line; the id as the thing you search first | <span className="db-tier t-master">Master</span> |
| **Metrics at scale** — the pull-based model, label cardinality and the metric that exploded storage, recording rules, histograms and percentiles done honestly | <span className="db-tier t-understand">Understand</span> |
| **Logs at scale** — structured logs, sampling, retention tiers, indexing cost; the log line that cost more than the feature it described | <span className="db-tier t-understand">Understand</span> |
| **Distributed tracing** — spans, sampling strategies (head vs tail), traces across asynchronous hops, the trace as the debugger for microservices | <span className="db-tier t-understand">Understand</span> |
| **The storage and query layer** — time-series stores, log stores, trace stores; open-source stacks against vendors, and the cost model of each | <span className="db-tier t-understand">Understand</span> |
| **Observability for asynchronous work** — queue lag, age of the oldest message, dead-letter counts, consumer throughput; continues [Part 5](05-event-streaming-and-async.md) | <span className="db-tier t-understand">Understand</span> |
| **Observability for LLM calls** — tokens in and out, cost per feature and tenant, latency per stage, prompt and completion capture with privacy limits; continues [Part 10](10-ai-systems-design.md) | <span className="db-tier t-understand">Understand</span> |
| **Frontend observability** — real-user monitoring, web vitals, error tracking, session replay with consent; the [performance track](../../web-vitals-performance/README.md) on the client side | <span className="db-tier t-understand">Understand</span> |
| **Continuous profiling** — CPU and memory profiles in production, the regression found by a profile diff; Node's and the JVM's profilers as the source | <span className="db-tier t-know">Know</span> |
| **Synthetic monitoring** — scripted checks from outside, uptime probes, the check that catches the DNS failure your metrics cannot see | <span className="db-tier t-know">Know</span> |
| **The cost of observability** — telemetry as a fraction of the bill, sampling and retention as the levers, what to drop first | <span className="db-tier t-know">Know</span> |

**Gate — move on when:** you can design the storefront's telemetry so that a slow checkout
at 2 a.m. pages one person with a burn-rate alert, and that person can go from the alert to
the offending trace and the log lines in under five minutes — and you can say what each
signal costs to keep.

---

{/* NAV */}
