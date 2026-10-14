---
title: "Link map · System design · Part 8 (phases 15–16)"
sidebar_label: "08 · reliability & observability"
sidebar_position: 8
---

# Link map · System design · Part 8 (phases 15–16)

Covers every topic row of phases 15 and 16 in `docs/system-design/syllabus/08-reliability-and-observability.md`: reliability engineering (T15-01 to T15-17) and observability at scale (T16-01 to T16-15). That is 32 rows. Six have a written page of ours (the SLI and SLO vocabulary, availability arithmetic, timeouts with retries and breakers, degradation and shedding, redundancy and the dashboard signals); `docs/system-design/pages` holds phases 0 to 3 only, so the rest are marked not written and their delta describes what the syllabus row promises.
*read* = I read the passage that supports the claim on the fetched page; *headings only* = fetched at HTTP 200 and the title or headings checked, passage not read for the claim. Third-party links carry a date only where the page shows one. No `#anchors` are given. Where no good non-official explanation turned up, the block has no "Beyond the docs" line. Official means specifications, standards, vendor and project documentation, and the Google SRE books; blogs and talks count as beyond the docs.

---

## Phase 15 — Reliability engineering

### T15-01 · SLIs, SLOs and SLAs — Master · ✅ written `docs/system-design/pages/phase-1-the-method/02-non-functional-requirements.md`
- **Read this:** [Service Level Objectives](https://sre.google/sre-book/service-level-objectives/) · Google SRE book, ch. 4 · separates the SLI, the SLO and the SLA; an SLA is a contract with consequences, often financial, and "most people really mean SLO when they say 'SLA'"; pick a few indicators from what users care about, not from what you can measure (*read*) · covers our angle: **partial** — vocabulary and indicator choice, not the per-journey objectives · fetched 2026-10-14
- **Also good:** [Implementing SLOs](https://sre.google/workbook/implementing-slos/) · Google SRE workbook · write SLOs in terms of user-centric actions using critical user journeys, with the online-shop example of searching, adding to a cart and completing a purchase (*read*) · covers our angle: **full** for journey-based objectives · fetched 2026-10-14
- **Beyond the docs:** [What are Service-Level Objectives (SLOs)?](https://www.atlassian.com/incident-management/kpis/sla-vs-slo-vs-sli) · Atlassian · an SLO is an internal target, an SLA is the agreement with the customer, shown with a streaming service promising 99.9% uptime, about 43.2 minutes down a month (*read*) · why it explains differently: states the contract side plainly · fetched 2026-10-14
- **Our delta:** the page quotes the SLI and SLO definitions, both availability formulas, and already sets targets per journey (checkout three nines, the product page lower) and turns "highly available" into an SLO with its formula; it never defines the SLA, so this phase adds the agreement as the contract with a penalty and indicators measured at the user's edge.

### T15-02 · Error budgets and the policy that spends them — Master · 🔲 not written
- **Read this:** [Example Error Budget Policy](https://sre.google/workbook/error-budget-policy/) · Google SRE workbook, appendix B · if the service has exceeded its error budget for the preceding four-week window, all changes and releases halt except P0 issues and security fixes until it is back within its SLO (*read*) · covers our angle: **partial** — the freeze, not burn-rate alerting · fetched 2026-10-14
- **Also good:** [Embracing Risk](https://sre.google/sre-book/embracing-risk/) · Google SRE book, ch. 3 · the error budget as the objective metric product and SRE teams agree on; as long as budget remains, new releases can be pushed (*read*) · fetched 2026-10-14
- **Also good:** [Alerting on SLOs](https://sre.google/workbook/alerting-on-slos/) · Google SRE workbook · burn rate is how fast, relative to the SLO, the service consumes the budget; at 99.9% over 30 days a burn rate of 1 exhausts it in exactly 30 days (*read*) · fetched 2026-10-14
- **Beyond the docs:** [How to implement multi-window, multi-burn-rate alerts with Grafana Cloud](https://grafana.com/blog/how-to-implement-multi-window-multi-burn-rate-alerts-with-grafana-cloud/) · Grafana Labs, Andrew Dedesko and Adriano Mariani, 1 Mar 2025 · a worked implementation of the workbook's alerts for a 99.9% SLO: 1-hour and 5-minute windows at burn rate 14.4, 6-hour and 30-minute windows at 6 (*read*) · fetched 2026-10-14
- **Our delta:** the budget as permission to ship, the freeze policy and the product-engineering conversation it replaces, with a burn-rate alert attached.

### T15-03 · Availability arithmetic — Master · ✅ written `docs/system-design/pages/phase-1-the-method/11b-the-load-walk-and-the-price-of-redundancy.md`
- **Read this:** [Embracing Risk](https://sre.google/sre-book/embracing-risk/) · Google SRE book, ch. 3 · availability expressed as the "nines" of acceptable unplanned downtime, and the point that a user on a 99% reliable phone cannot tell 99.99% from 99.999% (*read*) · covers our angle: **partial** — the target and its cost, not series and parallel arithmetic · fetched 2026-10-14
- **Also good:** [Composite availability: calculating the overall availability of cloud infrastructure](https://cloud.google.com/blog/products/devops-sre/composite-cloud-availability) · Google Cloud Blog, 16 Nov 2022 · the combined availability of the services that make up an application, and how their dependency relationships set the result (*read*) · covers our angle: **full** for serial and parallel composition · fetched 2026-10-14
- **Also good:** [Appendix A: Availability Table](https://sre.google/sre-book/availability-table/) · Google SRE book · downtime allowed per year, quarter, month, week, day and hour for each level; 99.9% is 43.2 minutes a month, 99.99% is 4.32 (*read*) · covers our angle: **full** for the nines as minutes · fetched 2026-10-14
- **Our delta:** the page does the series product and the parallel product, gives the series result as hours a year, and says what a shared deploy does to independence; the Part 1 requirements page argues against five nines on cost. The syllabus row adds the nines as minutes per month and why five nines is a different discipline, not just a bigger number.

### T15-04 · Timeouts, retries, circuit breakers and bulkheads — Master · ✅ written `docs/system-design/pages/phase-2-request-path/08-timeouts-retries-and-budgets.md`
- **Read this:** [CircuitBreaker](https://martinfowler.com/bliki/CircuitBreaker.html) · Martin Fowler, 6 March 2014 · wrap the protected call in an object that monitors failures; past a threshold it trips and further calls return an error without making the call (*read*) · covers our angle: **partial** — the breaker only · fetched 2026-10-14
- **Also good:** [Bulkhead pattern](https://learn.microsoft.com/en-us/azure/architecture/patterns/bulkhead) · Microsoft Azure Architecture Center · isolate elements of an application into pools so a failure in one does not cascade, named after a ship's hull partitions (*read*) · fetched 2026-10-14
- **Also good:** [CircuitBreaker](https://resilience4j.readme.io/docs/circuitbreaker) · Resilience4j · a state machine with CLOSED, OPEN and HALF_OPEN, a sliding window of call outcomes and failure-rate and slow-call-rate thresholds (*read*) · fetched 2026-10-14
- **Beyond the docs:** [Avoiding fallback in distributed systems](https://builder.aws.com/content/3EuS9Sakq7L3VLQIF3qzfMfke1Y/avoiding-fallback-in-distributed-systems) · Amazon Builders' Library · why Amazon almost never uses fallback paths, since untested ones add risk, and what to do instead (*read*) · why it explains differently: argues against the usual reflex after a breaker opens · fetched 2026-10-14
- **Our delta:** the page covers the shrinking deadline, retry multiplication, the breaker and the slow dependency that became an outage; this phase ties the four together as a budget per hop.

### T15-05 · Graceful degradation and load shedding — Master · ✅ written `docs/system-design/pages/phase-2-request-path/18e-degrading-instead-of-falling-over.md`
- **Read this:** [Using load shedding to avoid overload](https://builder.aws.com/content/3Eun1EEyX6p2e3VYNyRLSJzLuMV/using-load-shedding-to-avoid-overload) · Amazon Builders' Library · when a server approaches overload it should reject excess requests so it can serve the ones it lets in, keeping their latency low enough to beat the client timeout (*read*) · covers our angle: **partial** — shedding, not feature-level fallbacks · fetched 2026-10-14
- **Also good:** [Handling Overload](https://sre.google/sre-book/handling-overload/) · Google SRE book, ch. 21 · every backend request carries one of four criticality values, CRITICAL_PLUS down to SHEDDABLE, used by quotas and throttling (*read*) · covers our angle: **full** for priority-based shedding · fetched 2026-10-14
- **Also good:** [REL05-BP01 Implement graceful degradation](https://docs.aws.amazon.com/wellarchitected/latest/reliability-pillar/rel_mitigate_interaction_failure_graceful_degradation.html) · AWS Well-Architected · turn hard dependencies into soft ones so a component keeps its core function while serving stale, alternate or no data (*read*) · fetched 2026-10-14
- **Our delta:** the page treats shedding as a concurrency decision, adds admission and a waiting room, and gives the storefront's degradation order.

### T15-06 · Disaster recovery — Master · 🔲 not written
- **Read this:** [Disaster recovery options in the cloud](https://docs.aws.amazon.com/whitepapers/latest/disaster-recovery-workloads-on-aws/disaster-recovery-options-in-the-cloud.html) · AWS whitepaper · four strategies from backup and restore through pilot light and warm standby to multi-site active/active, tied to RTO and RPO; backup frequency sets the achievable recovery point (*read*) · covers our angle: **partial** — AWS vocabulary, no interview framing · fetched 2026-10-14
- **Also good:** [REL13-BP03 Test disaster recovery implementation](https://docs.aws.amazon.com/wellarchitected/latest/reliability-pillar/rel_planning_for_recovery_dr_tested.html) · AWS Well-Architected · regularly test failover to the recovery site to verify it works and that RTO and RPO are met; "never exercise failovers in production" is listed as an anti-pattern (*read*) · fetched 2026-10-14
- **Also good:** [Disaster recovery](https://learn.microsoft.com/en-us/azure/well-architected/reliability/disaster-recovery) · Azure Well-Architected · defines active-passive warm standby and cold standby as patterns for the secondary region (*read*) · fetched 2026-10-14
- **Our delta:** RPO and RTO per tier, active-passive against active-active, and the failover drill; the plan that had never been run. The phase 1 page on redundancy already says an untested restore is not a backup.

### T15-07 · Incident management — Master · 🔲 not written
- **Read this:** [Managing Incidents](https://sre.google/sre-book/managing-incidents/) · Google SRE book, ch. 14 · built on the Incident Command System, with recursive separation of responsibilities and an incident commander who holds the high-level state and delegates roles (*read*) · covers our angle: **partial** — roles, not severities or status pages · fetched 2026-10-14
- **Also good:** [Severity Levels](https://response.pagerduty.com/before/severity_levels/) · PagerDuty incident response docs · SEV-1 is a critical issue warranting public notification; when unsure between two levels, treat it as the higher one and review in the postmortem (*read*) · fetched 2026-10-14
- **Also good:** [The Atlassian Incident Management Handbook](https://www.atlassian.com/incident-management/handbook) · Atlassian · a summary of Atlassian's own process, "inspired by teams like Google"; each incident is driven by an incident manager with overall responsibility and authority (*read*) · fetched 2026-10-14
- **Also good:** [On-Call](https://sre.google/workbook/on-call/) · Google SRE workbook, ch. 8 · a target of at most two incidents per on-call shift, and a bare minimum of five people per site for a multisite 24/7 rotation, eight for single-site (*read*) · fetched 2026-10-14
- **Our delta:** severity levels, rotation, commander, communication cadence and status page, as the first fifteen minutes of a Sev-1.

### T15-08 · Blameless postmortems — Master · 🔲 not written
- **Read this:** [Postmortem Culture: Learning from Failure](https://sre.google/sre-book/postmortem-culture/) · Google SRE book, ch. 15 · a blameless postmortem identifies contributing causes without indicting any individual or team, and the culture came from healthcare and avionics (*read*) · covers our angle: **partial** — culture, little on follow-through · fetched 2026-10-14
- **Also good:** [Postmortem Culture: Learning from Failure](https://sre.google/workbook/postmortem-culture/) · Google SRE workbook, ch. 10 · a worked case study of a satellite-drain outage, with what went well and what went poorly (*read*) · covers our angle: **full** for a model postmortem · fetched 2026-10-14
- **Our delta:** timeline, contributing factors over root cause, owned action items and the follow-through most teams skip; the gate asks for a one-page postmortem.

### T15-09 · Backpressure end to end — Understand · 🔲 not written
- **Read this:** [Backpressuring in Streams](https://nodejs.org/learn/modules/backpressuring-in-streams) · Node.js · backpressure as the flow-control problem of data arriving faster than a consumer can handle, with the memory and garbage-collection costs it causes (*read*) · covers our angle: **partial** — one process, not edge to queue to worker · fetched 2026-10-14
- **Also good:** [Addressing Cascading Failures](https://sre.google/sre-book/addressing-cascading-failures/) · Google SRE book, ch. 22 · servers should fail early and cheaply when overloaded, via load shedding and graceful degradation (*read*) · fetched 2026-10-14
- **Beyond the docs:** [Queues Don't Fix Overload](https://ferd.ca/queues-don-t-fix-overload.html) · Fred Hebert, 19 Nov 2014 · a large buffer holds temporary data but fails under prolonged overload, so the system crashes anyway (*read*) · why it explains differently: argues from Erlang experience that bounding the queue is the fix · fetched 2026-10-14
- **Our delta:** bounded queues, slow consumers signalling producers and rejecting early at the edge; the system that failed gracefully because it said no.

### T15-10 · Redundancy and failure domains — Understand · ✅ written `docs/system-design/pages/phase-1-the-method/11b-the-load-walk-and-the-price-of-redundancy.md`
- **Read this:** [Static stability using Availability Zones](https://builder.aws.com/content/3K9SiqiJ369TGkkGzqPM95BuYWI/static-stability-using-availability-zones) · Amazon Builders' Library, Oct 2026 · defines static stability and applies it to Availability Zones, so a system keeps working when a dependency is impaired (*read*) · covers our angle: **partial** — zones, not providers or deploys · fetched 2026-10-14
- **Also good:** [AWS Fault Isolation Boundaries](https://docs.aws.amazon.com/whitepapers/latest/aws-fault-isolation-boundaries/abstract-and-introduction.html) · AWS whitepaper, 16 Nov 2022 · the boundaries that give a predictable scope of impact and the zonal, Regional and global scopes of services (*read*) · fetched 2026-10-14
- **Beyond the docs:** [Availability in AWS' Physalia](https://www.the-paper-trail.org/post/2020-04-06-physalia/) · Henry Robinson, the-paper-trail · notes on the NSDI 2020 paper about reducing the effect of failures with many small independent cells (*read*) · why it explains differently: a design where cells are placed so one failure cannot take most of another · fetched 2026-10-14
- **Our delta:** the page says parallel availability assumes independent failures and that a shared region, deploy and secret break it; the syllabus row adds same rack, same deploy, same bug.

### T15-11 · Capacity planning — Understand · 🔲 not written
- **Read this:** [Software Engineering in SRE](https://sre.google/sre-book/software-engineering-in-sre/) · Google SRE book, ch. 18 · the Auxon case study opens with traditional capacity planning as a cycle: collect demand forecasts, devise build and allocation plans, review and sign off, deploy and configure (*read*) · covers our angle: **partial** — long-horizon hardware planning, not flash sales · fetched 2026-10-14
- **Also good:** [REL07-BP01 Use automation when obtaining or scaling resources](https://docs.aws.amazon.com/wellarchitected/latest/reliability-pillar/rel_adapt_to_changes_proactive_adapt_auto.html) · AWS Well-Architected · automatic scaling options including metric-based and scheduled scaling, with load testing used to pick scaling metrics and targets (*read*) · fetched 2026-10-14
- **Beyond the docs:** [How to Build Peak Capacity Planning](https://oneuptime.com/blog/post/2026-01-30-peak-capacity-planning/view) · OneUptime, 30 Jan 2026 · a practical guide to forecasting peak traffic and calculating headroom, with a table of the signals to collect (*read*) · why it explains differently: written around a traffic peak rather than quarterly budgeting · fetched 2026-10-14
- **Our delta:** headroom, growth curves, the flash-sale forecast and pre-scaling against autoscaling, presented as a spreadsheet.

### T15-12 · Load and performance testing — Understand · 🔲 not written
- **Read this:** [Load test types](https://grafana.com/docs/k6/latest/testing-guides/test-types/) · Grafana k6 · average-load, stress, soak and spike tests, each with its load level and duration; no single test can uncover all issues (*read*) · covers our angle: **partial** — the taxonomy, not realistic data or testing in production · fetched 2026-10-14
- **Our delta:** realistic traffic shapes, testing in production carefully, and the load test that only proved the test rig's limit.

### T15-13 · Chaos engineering and game days — Understand · 🔲 not written
- **Read this:** [Principles of Chaos Engineering](https://principlesofchaos.org/) · principlesofchaos.org · define steady state as a measurable output, hypothesise it holds in control and experiment, introduce real-world events, and try to disprove the hypothesis (*read*) · covers our angle: **partial** — the method, not the abort condition or game-day logistics · fetched 2026-10-14
- **Our delta:** killing pods, adding latency and failing a zone on purpose, with a hypothesis, an abort condition and a small start.

### T15-14 · Runbooks and operational readiness — Understand · 🔲 not written
- **Read this:** [The Evolving SRE Engagement Model](https://sre.google/sre-book/evolving-sre-engagement-model/) · Google SRE book, ch. 32 · the Production Readiness Review as the typical first step of SRE engagement, identifying a service's reliability needs before SREs take responsibility (*read*) · covers our angle: **partial** — the review, not runbooks · fetched 2026-10-14
- **Also good:** [Appendix E: Launch Coordination Checklist](https://sre.google/sre-book/launch-checklist/) · Google SRE book · the pre-launch checklist in ten sections, from architecture and capacity through failover, monitoring and external dependencies, phrased as questions such as what happens when a machine, a rack or a cluster fails (*read*) · fetched 2026-10-14
- **Also good:** [Alerting](https://prometheus.io/docs/practices/alerting/) · Prometheus · alerts should link to relevant consoles and make it easy to see which component is at fault, and pages with nothing to do should be avoided (*read*) · fetched 2026-10-14
- **Also good:** [On-Call](https://sre.google/workbook/on-call/) · Google SRE workbook, ch. 8 · whenever an alert is created a playbook entry is usually created with it, and the chapter covers keeping playbooks from going stale (*read*) · covers our angle: **full** for the runbook per alert · fetched 2026-10-14
- **Our delta:** a runbook per alert, the production-readiness review before launch, ownership and escalation.

### T15-15 · Mean time to recovery over mean time between failures — Understand · 🔲 not written
- **Read this:** [DORA's software delivery metrics](https://dora.dev/guides/dora-metrics/) · DORA · change lead time, deployment frequency and failed deployment recovery time as measures; smaller changes are easier to recover from (*read*) · covers our angle: **partial** — recovery time of deployments, not all incidents · fetched 2026-10-14
- **Beyond the docs:** [MTTR is more important than MTBF (for most types of F)](https://www.kitchensoap.com/2010/11/07/mttr-mtbf-for-most-types-of-f/) · John Allspaw, Kitchen Soap, 7 Nov 2010 · since failure will happen, build for fast recovery, citing dark launching, percentage rollouts and feature flags; an October 2017 update says the averages themselves are statistically meaningless (*read*) · why it explains differently: the original argument plus its author's own correction · fetched 2026-10-14
- **Our delta:** optimising for fast detection and rollback rather than never failing, and what that changes in the pipeline.

### T15-16 · The storefront's reliability plan — Understand · 🔲 not written
- **Read this:** [Implementing SLOs](https://sre.google/workbook/implementing-slos/) · Google SRE workbook · critical user journeys as the unit for objectives, including searching, adding to a cart and completing a purchase (*read*) · covers our angle: **partial** — objectives only, no degradation ladder or DR posture · fetched 2026-10-14
- **Our delta:** one page, defended: an SLO per journey, the budget policy, the degradation ladder for a sale day and the DR posture; the gate also asks for the checkout SLO as an indicator, objective and burn-rate alert.

### T15-17 · Reliability of third parties — Know · 🔲 not written
- **Read this:** [Error handling](https://docs.stripe.com/error-handling) · Stripe · to recover from connection errors, retry with the same idempotency key and parameters within 24 hours; if the outcome is still unknown, verify before repeating (*read*) · covers our angle: **partial** — one provider's contract, not multi-vendor failover · fetched 2026-10-14
- **Also good:** [Avoiding fallback in distributed systems](https://builder.aws.com/content/3EuS9Sakq7L3VLQIF3qzfMfke1Y/avoiding-fallback-in-distributed-systems) · Amazon Builders' Library · why a second mechanism for the same result is risky unless it is exercised (*read*) · fetched 2026-10-14
- **Our delta:** timeouts, fallbacks, multi-vendor failover for payments, SMS and maps, and the SLA you inherit; ties to the idempotency row in Part 4.

---

## Phase 16 — Observability at scale

### T16-01 · Logs, metrics, traces and profiles — Master · 🔲 not written
- **Read this:** [Signals](https://opentelemetry.io/docs/concepts/signals/) · OpenTelemetry · traces are the path of a request, metrics a measurement captured at runtime, logs a recording of an event, with baggage and profiles alongside (*read*) · covers our angle: **partial** — definitions, not what each can and cannot answer · fetched 2026-10-14
- **Also good:** [Observability primer](https://opentelemetry.io/docs/concepts/observability-primer/) · OpenTelemetry · observability as understanding a system from the outside by asking questions without knowing its inner workings (*read*) · fetched 2026-10-14
- **Beyond the docs:** [THERE ARE NO THREE PILLARS OF OBSERVABILITY](https://threadreaderapp.com/thread/1044666259898593282.html) · Charity Majors (@mipsytipsy), thread archive · argues that repeating the three-pillars mantra is why observability tooling lags the rest of the toolchain (*read*) · why it explains differently: a deliberate counter-argument to the list above · fetched 2026-10-14
- **Our delta:** what each signal can and cannot answer, and the outage that logs could not explain but one trace did.

### T16-02 · OpenTelemetry — Master · 🔲 not written
- **Read this:** [Semantic Conventions](https://opentelemetry.io/docs/concepts/semantic-conventions/) · OpenTelemetry · common names for kinds of operations and data, standardised across a codebase, libraries and platforms, for traces, metrics, logs, profiles and resources (*read*) · covers our angle: **partial** — naming, not propagation or the pipeline · fetched 2026-10-14
- **Also good:** [Context propagation](https://opentelemetry.io/docs/concepts/context-propagation/) · OpenTelemetry · the concept that enables distributed tracing and lets traces, metrics and logs be correlated wherever they are generated (*read*) · fetched 2026-10-14
- **Also good:** [Collector](https://opentelemetry.io/docs/collector/) · OpenTelemetry · a vendor-agnostic way to receive, process and export telemetry, removing the need to run multiple agents (*read*) · fetched 2026-10-14
- **Our delta:** instrument once and export anywhere, propagation over HTTP and queues, and the collector as the pipeline; Node's observability phase has the instrumentation code.

### T16-03 · Alerting on symptoms — Master · 🔲 not written
- **Read this:** [Alerting](https://prometheus.io/docs/practices/alerting/) · Prometheus · alert on symptoms tied to end-user pain rather than every possible cause, page on user-visible errors, and only page on latency at one point in the stack (*read*) · covers our angle: **partial** — the principle, not burn-rate windows · fetched 2026-10-14
- **Also good:** [Alerting on SLOs](https://sre.google/workbook/alerting-on-slos/) · Google SRE workbook · six approaches, from a simple error-rate threshold up to burn-rate alerts; a 100% error spike every 10 minutes consumed about 12% of the monthly budget yet never triggered the naive alert (*read*) · covers our angle: **full** for multi-window burn rate · fetched 2026-10-14
- **Also good:** [Monitoring Distributed Systems](https://sre.google/sre-book/monitoring-distributed-systems/) · Google SRE book, ch. 6 · the symptom against cause distinction, with the two questions of what is broken and why (*read*) · fetched 2026-10-14
- **Beyond the docs:** [How to implement multi-window, multi-burn-rate alerts with Grafana Cloud](https://grafana.com/blog/how-to-implement-multi-window-multi-burn-rate-alerts-with-grafana-cloud/) · Grafana Labs, 1 Mar 2025 · turns the workbook's alerts into PromQL rules, for availability and for latency over 750 ms from histogram buckets (*read*) · fetched 2026-10-14
- **Our delta:** paging against ticketing, and the alert that fired every night and taught the team to ignore it.

### T16-04 · Dashboards that answer questions — Master · ✅ written `docs/system-design/pages/phase-1-the-method/14-evolution-and-operations.md`
- **Read this:** [Monitoring Distributed Systems](https://sre.google/sre-book/monitoring-distributed-systems/) · Google SRE book, ch. 6 · dashboards should answer basic questions about your service and normally include some form of the four golden signals (*read*) · covers our angle: **partial** — signals, not drill-down paths · fetched 2026-10-14
- **Also good:** [The RED Method: How to instrument your services](https://grafana.com/blog/the-red-method-how-to-instrument-your-services/) · Grafana Labs, from Tom Wilkie's talk · rate, errors and duration for every service, set beside the USE method (*read*) · fetched 2026-10-14
- **Beyond the docs:** [The USE Method](https://www.brendangregg.com/usemethod.html) · Brendan Gregg · for every resource, check utilization, saturation and errors, as a checklist for finding bottlenecks early in an investigation (*read*) · why it explains differently: resource-side where RED is request-side · fetched 2026-10-14
- **Our delta:** the page lists the four golden signals per service, adds consumer lag and business counters, and says alerts fire on symptoms while dashboards show causes; it names neither RED nor USE, so this phase adds those, one overview per service, drill-down paths and the dashboard nobody opened during the incident.

### T16-05 · Correlation and request ids end to end — Master · 🔲 not written
- **Read this:** [Trace Context](https://www.w3.org/TR/trace-context/) · W3C Recommendation · two headers, `traceparent` for the request's position in its trace and `tracestate` for vendor data; tools must at least propagate both so traces are not broken (*read*) · covers our angle: **partial** — the header, not logs and queues · fetched 2026-10-14
- **Also good:** [Context propagation](https://opentelemetry.io/docs/concepts/context-propagation/) · OpenTelemetry · lets signals be correlated regardless of where they are generated (*read*) · fetched 2026-10-14
- **Beyond the docs:** [Fast and flexible observability with canonical log lines](https://stripe.com/blog/canonical-log-lines) · Stripe · in addition to normal log traces, each request emits one long line at the end with its key characteristics, making queries and aggregations faster to write (*read*) · why it explains differently: the log line is the thing you search by id · fetched 2026-10-14
- **Our delta:** from the edge through services, queues and workers to the log line, with the id as the first thing you search.

### T16-06 · Metrics at scale — Understand · 🔲 not written
- **Read this:** [Overview](https://prometheus.io/docs/introduction/overview/) · Prometheus · time series collection happens via a pull model over HTTP, with pushing supported through an intermediary gateway (*read*) · covers our angle: **partial** — the pull model only · fetched 2026-10-14
- **Also good:** [Histograms and summaries](https://prometheus.io/docs/practices/histograms/) · Prometheus · pre-computed quantiles cannot be recalculated for another window and cannot be aggregated across replicas, which is why histograms exist (*read*) · covers our angle: **full** for percentiles done honestly · fetched 2026-10-14
- **Also good:** [Recording rules](https://prometheus.io/docs/practices/rules/) · Prometheus · a naming scheme for recording rules that avoids meaningless calculations (*read*) · fetched 2026-10-14
- **Also good:** [Metric and label naming](https://prometheus.io/docs/practices/naming/) · Prometheus · a metric should represent the same logical thing across all label dimensions (*read*) · fetched 2026-10-14
- **Beyond the docs:** [Cardinality is key](https://www.robustperception.io/cardinality-is-key/) · Brian Brazil, Robust Perception, 2 Sep 2019 · Prometheus performance almost always comes down to label cardinality, which multiplies across dimensions (*read*) · why it explains differently: a worked series-count example · fetched 2026-10-14
- **Our delta:** the metric that exploded storage, recording rules, and percentiles done honestly.

### T16-07 · Logs at scale — Understand · 🔲 not written
- **Read this:** [Labels](https://grafana.com/docs/loki/latest/get-started/labels/) · Grafana Loki · labels should hold low-cardinality values describing the source, because the log line content itself is not indexed (*read*) · covers our angle: **partial** — one store's indexing choice · fetched 2026-10-14
- **Also good:** [Log retention](https://grafana.com/docs/loki/latest/operations/storage/retention/) · Grafana Loki · retention is done by the compactor and is off by default, so logs live forever unless enabled; per-tenant and per-stream policies are supported (*read*) · fetched 2026-10-14
- **Beyond the docs:** [Fast and flexible observability with canonical log lines](https://stripe.com/blog/canonical-log-lines) · Stripe · one dense line per request in place of many small ones (*read*) · why it explains differently: a log-volume answer, not a storage one · fetched 2026-10-14
- **Our delta:** structured logs, sampling, retention tiers and indexing cost; the log line that cost more than the feature it described.

### T16-08 · Distributed tracing — Understand · 🔲 not written
- **Read this:** [Sampling](https://opentelemetry.io/docs/concepts/sampling/) · OpenTelemetry · head sampling decides as early as possible, is easy and efficient, but cannot use data from the whole trace; sampling has compute, engineering and missed-information costs (*read*) · covers our angle: **partial** — head against tail, not async hops · fetched 2026-10-14
- **Also good:** [Dapper, a Large-Scale Distributed Systems Tracing Infrastructure](https://research.google/pubs/dapper-a-large-scale-distributed-systems-tracing-infrastructure/) · Google, 2010 · the abstract credits sampling and restricting instrumentation to a few common libraries for its success (*read*, abstract) · fetched 2026-10-14
- **Also good:** [Grafana Tempo](https://grafana.com/docs/tempo/latest/) · Grafana · a high-scale tracing backend that needs only object storage and accepts Jaeger, Zipkin and OpenTelemetry protocols (*read*) · fetched 2026-10-14
- **Our delta:** spans, head against tail sampling, traces across asynchronous hops, the trace as the debugger for microservices.

### T16-09 · The storage and query layer — Understand · 🔲 not written
- **Read this:** [Loki overview](https://grafana.com/docs/loki/latest/get-started/overview/) · Grafana Loki · a horizontally scalable, highly available, multi-tenant log aggregation system (*read*) · covers our angle: **partial** — logs only · fetched 2026-10-14
- **Also good:** [Grafana Tempo](https://grafana.com/docs/tempo/latest/) · Grafana · tracing backend needing only object storage, which is its cost story (*read*) · fetched 2026-10-14
- **Also good:** [Grafana Pyroscope introduction](https://grafana.com/docs/pyroscope/latest/introduction/) · Grafana · a multi-tenant continuous profiling system aligned in design with Mimir, Loki and Tempo (*read*) · fetched 2026-10-14
- **Also good:** [Get started with Grafana Mimir](https://grafana.com/docs/mimir/latest/get-started/) · Grafana · a setup walkthrough with Prometheus sending metrics to Mimir over remote write; the page does not itself describe Mimir's design (*read*) · fetched 2026-10-14
- **Our delta:** time-series, log and trace stores, open-source stacks against vendors, and the cost model of each.

### T16-10 · Observability for asynchronous work — Understand · 🔲 not written
- **Read this:** [Available CloudWatch metrics for Amazon SQS](https://docs.aws.amazon.com/AWSSimpleQueueService/latest/SQSDeveloperGuide/sqs-available-cloudwatch-metrics.html) · AWS · `ApproximateAgeOfOldestMessage` is the age of the oldest unprocessed message in the queue, in seconds (*read*) · covers our angle: **partial** — one broker, no consumer throughput · fetched 2026-10-14
- **Beyond the docs:** [The Hidden Problem with Kafka Lag Monitoring](https://softwaremill.com/the-hidden-problem-with-kafka-lag-monitoring/) · Krzysztof Grajek, SoftwareMill, 30 Jan 2026 · offset lag says little about health because 1,000 messages can be one second or one day, so time lag matters more (*read*) · why it explains differently: turns lag into a delay users feel · fetched 2026-10-14
- **Our delta:** queue lag, age of the oldest message, dead-letter counts and consumer throughput; continues [Part 5](05-event-streaming-and-async.md).

### T16-11 · Observability for LLM calls — Understand · 🔲 not written
- **Read this:** [Semantic conventions for generative AI inference token metrics](https://github.com/open-telemetry/semantic-conventions-genai/blob/main/docs/gen-ai/gen-ai-token-metrics.md) · OpenTelemetry GenAI semantic conventions repository, status Development · usage counters per token category track tokens spent over time and "serve as a proxy for cost approximation", while per-operation histograms are for percentiles and outliers, not totals (*read*) · covers our angle: **partial** — tokens and cost proxy, not cost per feature or tenant · fetched 2026-10-14
- **Also good:** [Semantic conventions for generative client AI spans](https://github.com/open-telemetry/semantic-conventions-genai/blob/main/docs/gen-ai/gen-ai-spans.md) · same repository, status Development · span attributes such as `gen_ai.usage.input_tokens`; message, instruction and retrieval content attributes are Opt-In, should not be captured by default, and carry a warning that they may hold sensitive or PII data (*read*) · covers our angle: **full** for capture with privacy limits · fetched 2026-10-14
- **Also good:** [Generative AI semantic conventions](https://opentelemetry.io/docs/specs/semconv/gen-ai/) · OpenTelemetry · now only a notice that the GenAI conventions moved to the repository above and the page is no longer maintained (*read*) · fetched 2026-10-14
- **Beyond the docs:** [Inside the LLM Call: GenAI Observability with OpenTelemetry](https://opentelemetry.io/blog/2026/genai-observability/) · OpenTelemetry blog, 14 May 2026 · an agent span parenting one chat span per LLM call and one span per tool call, a latency histogram and a token histogram that "let you estimate per-request cost"; by default no prompt content or tool arguments are captured (*read*) · why it explains differently: a worked trace of a real assistant, though its `gen_ai.client.token.usage` metric predates the repository's newer usage counters · fetched 2026-10-14
- **Our delta:** tokens in and out, cost per feature and tenant, latency per stage, and prompt and completion capture with privacy limits; continues **Part 10** *(not written yet)*. The conventions are still in Development, so pin attribute names to a release when the page is written.

### T16-12 · Frontend observability — Understand · 🔲 not written
- **Read this:** [Best practices for measuring Web Vitals in the field](https://web.dev/articles/vitals-field-measurement-best-practices) · web.dev, Philip Walton · without field data it is impossible to know whether changes actually help; many RUM providers already support the Core Web Vitals (*read*) · covers our angle: **partial** — vitals, not error tracking or replay · fetched 2026-10-14
- **Also good:** [Web Vitals](https://web.dev/articles/vitals) · web.dev, Philip Walton, 2020 (updated 31 Oct 2024) · the Core Web Vitals are the subset that applies to all pages and should be measured by all site owners (*read*) · fetched 2026-10-14
- **Also good:** [Session Replay](https://docs.sentry.io/product/session-replay/) · Sentry · video-like reproductions of real user sessions for debugging errors and slow transactions (*read*) · covers our angle: **partial** — a vendor product, no consent guidance · fetched 2026-10-14
- **Our delta:** real-user monitoring, error tracking and session replay with consent; the client side of the performance track.

### T16-13 · Continuous profiling — Know · 🔲 not written
- **Read this:** [Grafana Pyroscope introduction](https://grafana.com/docs/pyroscope/latest/introduction/) · Grafana · continuous profiling helps teams find bottlenecks by profiling applications in production with minimal overhead, with differences between labels and time intervals (*read*) · covers our angle: **partial** — a tool, not the profile-diff regression story · fetched 2026-10-14
- **Also good:** [Google-Wide Profiling](https://research.google/pubs/google-wide-profiling-a-continuous-profiling-infrastructure-for-data-centers/) · Ren et al., IEEE Micro 2010 · a continuous profiling infrastructure for data centers with negligible overhead (*read*, abstract) · fetched 2026-10-14
- **Our delta:** CPU and memory profiles in production and the regression found by a profile diff, with Node's and the JVM's profilers as the source.

### T16-14 · Synthetic monitoring — Know · 🔲 not written
- **Read this:** [Synthetic monitoring (canaries)](https://docs.aws.amazon.com/AmazonCloudWatch/latest/monitoring/CloudWatch_Synthetics_Canaries.html) · Amazon CloudWatch · canaries are scripts on a schedule that follow the same routes as a customer, verifying the experience even with no customer traffic (*read*) · covers our angle: **partial** — one vendor's version, no DNS-failure example · fetched 2026-10-14
- **Our delta:** scripted checks from outside, uptime probes, and the check that catches the DNS failure metrics cannot see.

### T16-15 · The cost of observability — Know · 🔲 not written
- **Read this:** [Sampling](https://opentelemetry.io/docs/concepts/sampling/) · OpenTelemetry · lists the direct compute cost, the engineering cost and the opportunity cost of sampling (*read*) · covers our angle: **partial** — one lever · fetched 2026-10-14
- **Also good:** [Log retention](https://grafana.com/docs/loki/latest/operations/storage/retention/) · Grafana Loki · retention as a lever, off by default (*read*) · fetched 2026-10-14
- **Beyond the docs:** [I Set Up OpenTelemetry. Now My Bill Is 10x Higher.](https://openobserve.ai/blog/opentelemetry-cost-reduction/) · OpenObserve, vendor blog · bill shock comes from per-GB backend pricing, and it lists tail sampling, attribute and log filtering, retention tiers and backend choice as levers; the savings figure is a vendor claim (*read*) · why it explains differently: written from the bill backwards, but treat the numbers as marketing · fetched 2026-10-14
- **Our delta:** telemetry as a fraction of the bill, sampling and retention as the levers, and what to drop first.
