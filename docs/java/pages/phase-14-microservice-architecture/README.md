---
title: "Phase 14 — Microservice architecture"
sidebar_label: "Overview"
sidebar_position: 0
---

> **Target: JDK 25 · Spring Boot 4.1.0 / Spring Framework 7.0.8 · Spring Cloud
> 2025.1.x "Oakwood" (every component 5.0.x), Kubernetes-first.**
> Documentation-validated — every page names its sources on a `> Verified:`
> line (spring.io projects docs, microservices.io patterns, the Spring Cloud
> Gateway and Contract references, grpc.io). No sandbox: pages carry code and
> config, never fabricated logs or traffic captures.
>
> 🔴 **Oakwood was a breaking train, so most published samples are wrong here.**
> `spring-cloud-starter-gateway` and `spring-cloud-starter-parent` no longer
> resolve, `RestTemplate` support is gone from Spring Cloud Netflix, REST Assured
> is gone from Spring Cloud Contract, and gRPC now lives in Spring Boot itself.
> The full list is in `_PHASE-NOTES.md` — read it before writing any page here.

The decision layer. Most microservice pain is not Kafka config — it is
boundaries drawn wrong, sync calls where events belonged, and a distributed
system nobody priced in. These pages are deliberately opinionated: monolith
first, split on proof, and every split pays the availability math.

🚧 **0 of 12 written.**

| # | Page | Tier | In one line |
|---|---|---|---|
| 01 | **Monolith first — honestly** *(not written yet)* | <span className="db-tier t-understand">Understand</span> | Spring Modulith; what microservices actually buy, and from whom |
| 02 | **Service boundaries from bounded contexts** *(not written yet)* | <span className="db-tier t-master">Master</span> | One service, one capability, its own data — split by invariants |
| 03 | **Database-per-service** *(not written yet)* | <span className="db-tier t-understand">Understand</span> | The joins you lose; API composition; duplicated reference data |
| 04 | **Sync vs async as the coupling decision** *(not written yet)* | <span className="db-tier t-master">Master</span> | Availability multiplication; latency budgets across hops |
| 05 | **Inter-service REST that survives change** *(not written yet)* | <span className="db-tier t-understand">Understand</span> | Tolerant reader, DTO versioning, deploy-order deadlocks |
| 06 | **gRPC** *(not written yet)* | <span className="db-tier t-know">Know</span> | Protobuf contracts, deadlines — where it beats REST |
| 07 | **API gateway with Spring Cloud Gateway** *(not written yet)* | <span className="db-tier t-understand">Understand</span> | One edge for routing, auth, rate limits — no business logic |
| 08 | **Service discovery** *(not written yet)* | <span className="db-tier t-understand">Understand</span> | Eureka/Consul vs the platform answer (K8s Services + DNS) |
| 09 | **Centralized configuration** *(not written yet)* | <span className="db-tier t-know">Know</span> | Spring Cloud Config vs ConfigMaps/Secrets |
| 10 | **Correlation across services** *(not written yet)* | <span className="db-tier t-understand">Understand</span> | W3C `traceparent` through MDC — or incidents become archaeology |
| 11 | **Consumer-driven contract testing** *(not written yet)* | <span className="db-tier t-understand">Understand</span> | Spring Cloud Contract / Pact as the provider's CI gate |
| 12 | **The distributed monolith** *(not written yet)* | <span className="db-tier t-understand">Understand</span> | The tells, and the honest fix (merge back or re-draw) |

## Phase gate

Move on when: given "split this order system", you can argue *against* the
split for a two-team shop, and for the split at scale — naming boundaries by
invariant, the sync/async choice per interaction, and the availability cost
of each sync hop.

## Where this connects

- This bible's **[Node.js microservices reference](../../../nodejs/README.md)**
  implements these patterns with Express + RabbitMQ — same architecture,
  different runtime.
- **[Phase 12](../phase-12-jvm-production/README.md)** topic 09's tracing
  becomes load-bearing here (topic 10).
- **Phase 15 — Messaging** is topic 04's async half in full;
  **Phase 16** operates what this phase designs.
