---
title: "Phase 16 — Resilience and operating the fleet"
sidebar_label: "Overview"
sidebar_position: 0
---

> **Target: Resilience4j 2.x · Spring Boot 3.x · Kubernetes.**
> Documentation-validated — every page names its sources on a `> Verified:`
> line (resilience4j.readme.io, the Spring Boot production-ready reference,
> kubernetes.io docs, the Istio/Linkerd docs for the mesh page). No sandbox:
> pages carry code and config, never fabricated metrics or incident logs.

A distributed system is a machine for turning one service's bad day into
everyone's. Resilience4j is the Java toolkit, but the patterns are the
syllabus: timeouts, retries, breakers, bulkheads — in that order, because
each protects against the previous one's failure mode.

🚧 **0 of 13 written.**

| # | Page | Tier | In one line |
|---|---|---|---|
| 01 | **Timeouts first, everywhere** *(not written yet)* | <span className="db-tier t-master">Master</span> | Budgets across hops; most cascades are missing timeouts |
| 02 | **Retries without making it worse** *(not written yet)* | <span className="db-tier t-master">Master</span> | Backoff + jitter, idempotency, retry amplification |
| 03 | **Circuit breakers with Resilience4j** *(not written yet)* | <span className="db-tier t-master">Master</span> | Closed → open → half-open; fallbacks that degrade honestly |
| 04 | **Bulkheads and rate limiting** *(not written yet)* | <span className="db-tier t-understand">Understand</span> | Isolation so one slow dependency can't eat every thread |
| 05 | **Composing the decorators** *(not written yet)* | <span className="db-tier t-understand">Understand</span> | The canonical order, annotations vs functional, metrics |
| 06 | **Load shedding and backpressure** *(not written yet)* | <span className="db-tier t-know">Know</span> | A fast 503 beats a slow 200; bounded queues everywhere |
| 07 | **Health checks that don't lie** *(not written yet)* | <span className="db-tier t-understand">Understand</span> | Liveness vs readiness — and the self-inflicted outage |
| 08 | **Deploying without downtime** *(not written yet)* | <span className="db-tier t-understand">Understand</span> | Rolling, blue-green, canary; feature flags and flag debt |
| 09 | **Kubernetes for the Java developer** *(not written yet)* | <span className="db-tier t-understand">Understand</span> | What the platform provides; requests/limits × `MaxRAMPercentage` |
| 10 | **Service mesh** *(not written yet)* | <span className="db-tier t-know">Know</span> | mTLS and traffic policy in sidecars — and when it's overkill |
| 11 | **Observability across the fleet** *(not written yet)* | <span className="db-tier t-understand">Understand</span> | One incident, one trace id, every service's view |
| 12 | **Distributed locks and leader election** *(not written yet)* | <span className="db-tier t-know">Know</span> | ShedLock — and the design smell a distributed lock usually is |
| 13 | **Chaos engineering** *(not written yet)* | <span className="db-tier t-when">When Needed</span> | Testing the resilience config before production does |

## Phase gate

**Deliverable:** the Phase 9/10 service split into two (order + payment) with
client-credentials auth between them, an outbox-relayed event consumed
idempotently, Resilience4j timeout + retry + breaker on the sync path, and
readiness checks that do *not* include each other — plus a one-paragraph
narrative of what happens when payment goes down for five minutes.

## Where this connects

- **[Phase 13](../phase-13-oauth2-oidc/README.md)**,
  **[Phase 14](../phase-14-microservice-architecture/README.md)** and
  **[Phase 15](../phase-15-messaging-event-driven/README.md)** built the
  fleet this phase keeps alive.
- **[Phase 12](../phase-12-jvm-production/README.md)** owns the
  single-service observability these pages federate.
- The [Docker section](../../../docker/README.md) covers the container
  platform underneath topic 09.
