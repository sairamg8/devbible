---
title: "The Service Boundary Review Checklist: a rigorous architecture rubric for evaluating proposed boundaries before writing code"
sidebar_label: "45 · The checklist"
sidebar_position: 64
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-04 against Neal Ford & Mark Richards, *Software Architecture: The Hard Parts* (O'Reilly);
> Sam Newman, *Building Microservices* (2nd ed., O'Reilly), Chapter 3; Michael Nygard, *Release It!* (2nd ed.).
> Version spine: **JDK 25 · Spring Boot 4.1.1 / Framework 7.0.9 · Spring Cloud train 2025.1.x "Oakwood"**. Documentation-validated; **no sandbox run**.

**Every microservice boundary represents an irreversible operational commitment: once provisioned with a dedicated database, CI/CD pipeline, and public API, collapsing or redrawing that boundary costs months of engineering effort. Architecture review boards and tech leads must subject every proposed service boundary to rigorous, adversarial evaluation before approval. This checklist provides a structured, production-tested rubric across six architectural dimensions—domain integrity, data autonomy, communication coupling, operational viability, team ownership, and blast radius—designed to catch bad boundaries during the design phase rather than in a production post-mortem.**

## The five deadly red flags

If a proposed architecture review answers **YES** to any of these five questions, the proposal must be rejected or revised immediately:

```
[ ! ] RED FLAG 1: Does the service share a database schema or table with another service?
[ ! ] RED FLAG 2: Does an ordinary business operation require a distributed two-phase commit (2PC)?
[ ! ] RED FLAG 3: Does a standard user request require a synchronous call chain deeper than 3 hops?
[ ! ] RED FLAG 4: Does deploying Service A require a coordinated, simultaneous release of Service B?
[ ! ] RED FLAG 5: Is the service proposed for a team with fewer than three dedicated engineers?
```

---

## The complete boundary evaluation rubric

### 1. Domain integrity & invariant consistency
- [ ] **Aggregate Cohesion**: Does the proposed service contain complete DDD aggregate roots? (A boundary must never split an aggregate across services).
- [ ] **Transactional Atomicity**: Are all strict, immediate business invariants satisfied within the boundaries of this single service?
- [ ] **Eventual Consistency Acceptance**: Has the business explicitly accepted eventual consistency for any cross-service workflows?
- [ ] **Ubiquitous Language**: Does the service model a single, coherent bounded context where terms have unambiguous definitions?

### 2. Data autonomy & persistence
- [ ] **Dedicated Storage**: Does the service own its private database instance or strictly isolated schema with zero external read/write access?
- [ ] **Scalar Identifier References**: Are all references to external entities modeled strictly as scalar IDs (`UUID`, `String`), with zero database foreign keys or ORM join mappings across boundaries?
- [ ] **Independent Data Migrations**: Can Flyway or Liquibase migrations execute on this service's database without coordinating with any other service?
- [ ] **Historical Backfill Plan**: If extracting from a monolith, is there an explicit Change Data Capture (CDC) and data parity verification strategy?

### 3. Communication & coupling
- [ ] **Asynchronous by Default**: Are downstream notifications and updates modeled as asynchronous domain events (Kafka, RabbitMQ) rather than synchronous REST/gRPC calls?
- [ ] **Query Aggregation Strategy**: Does the design avoid N+1 cross-service HTTP calls by using local read replicas, CQRS view models, or bulk endpoints?
- [ ] **Published Language Stability**: Are public API contracts and event schemas versioned, with explicit rules forbidding breaking changes without deprecation cycles?
- [ ] **Zero Cyclic Dependencies**: Is the dependency graph strictly acyclic? (Service A must never call Service B if Service B directly or indirectly calls Service A).

### 4. Team ownership & Conway's Law
- [ ] **Single Team Ownership**: Is the service owned by exactly one stream-aligned team responsible for development, deployment, and 24/7 on-call rotation?
- [ ] **Cognitive Load Limits**: Does adding this service respect the team's cognitive load (no team owning more than 2–3 active, high-churn services)?
- [ ] **Independent Pull Requests**: Can the team deliver 90%+ of their roadmap features without opening pull requests in repositories owned by other teams?

### 5. Operational viability & telemetry
- [ ] **Independent Deployment Pipeline**: Does the service have its own isolated CI/CD pipeline capable of deploying to production in under 15 minutes?
- [ ] **Distributed Tracing Context**: Does the service propagate OpenTelemetry trace and span contexts (`traceparent` headers) across all incoming and outgoing requests?
- [ ] **Standardized Health & Metrics**: Does the service expose Spring Boot Actuator endpoints (`/actuator/health/liveness`, `/actuator/health/readiness`, `/actuator/metrics`)?
- [ ] **SLO Definition**: Are explicit Service Level Objectives (SLOs) defined for p95/p99 latency, error rates, and availability?

### 6. Failure modes & blast radius
- [ ] **Fault Containment**: If this service crashes or becomes unavailable, can upstream services degrade gracefully (via caching or fallbacks) without crashing?
- [ ] **Circuit Breakers & Timeouts**: Are all outbound network clients wrapped in explicit timeouts (e.g., connect timeout 1s, read timeout 2s) and Resilience4j circuit breakers?
- [ ] **Idempotent Consumers**: Do all message listeners and webhook handlers support idempotent processing to survive duplicate message delivery?
- [ ] **Rate Limiting & Shedding**: Does the service implement client rate-limiting or concurrency limits to protect itself against thundering herds?

## Example architectural scorecard

Before signing an Architecture Decision Record (ADR), compile the review findings into an objective scorecard:

```markdown
# Architecture Review Scorecard: InventoryAllocationService

| Dimension | Score (1-5) | Notes / Mitigations Required |
| :--- | :---: | :--- |
| Domain Integrity | 5 | Clean aggregate root; stock allocation invariants fully enclosed |
| Data Autonomy | 5 | Dedicated PostgreSQL instance; Flyway migrations isolated |
| Communication | 4 | Event-driven via Kafka; fallback to cached read replica on outage |
| Team Ownership | 5 | Dedicated Logistics Squad (6 engineers); single repo ownership |
| Operational Viability | 4 | GitHub Actions pipeline, OpenTelemetry tracing instrumented |
| Fault Isolation | 4 | Upstream Order service queues orders if inventory is offline |
| **Overall Verdict** | **APPROVED** | Ready for pilot extraction in Sprint 34 |
```

## Gotchas

**★ Approving the "We will separate the database later" compromise.**
Engineers frequently propose: *"Let's build the microservice first to save time, and we'll point it to the monolith's database, then split the schema next quarter."* This promise is never kept. The two services immediately develop tight database-level coupling, resulting in an unmaintainable distributed monolith. Database separation must precede or accompany service launch.

**★ Splitting an aggregate root across services.**
If a proposal places `Order` in Service A and `OrderLine` in Service B, atomic updates require distributed locking or two-phase commit. This violates fundamental DDD principles. Aggregates must remain indivisible.

**★ Failing to mandate idempotency in async message consumers.**
In any distributed broker (Kafka, RabbitMQ, SQS), at-least-once delivery guarantees that duplicate messages will occur during broker rebalances or network retries. Approving an event consumer without an idempotency guard (like a unique event log table or Redis key) guarantees data corruption in production.

## Interview questions

**★ What are the top three red flags that should cause an architect to reject a proposed microservice boundary?**
The top three red flags are: (1) Shared database access—two services querying or mutating the same database schema; (2) Lockstep deployment dependencies—Service A cannot be deployed without simultaneously deploying Service B; and (3) Distributed transaction requirements—business workflows requiring two-phase commit (2PC) to preserve transactional consistency across boundaries.

**★ How do you determine whether a service has proper data autonomy?**
A service has data autonomy if and only if its underlying data store is inaccessible to all other services. No external service may execute direct SQL queries or joins against its tables. All external data access must flow through published APIs or asynchronous domain events, and database schema migrations (via Flyway or Liquibase) can execute without coordinating with other applications.

**★ Why must a microservice boundary review verify team ownership and headcount?**
Operating a microservice incurs a baseline operational tax: dedicated CI/CD, Kubernetes manifests, monitoring dashboards, vulnerability scanning, and on-call rotations. If an engineering team has fewer than 3 to 4 engineers, assigning them multiple microservices causes cognitive overload, context-switching fatigue, and operational neglect. Architecture must align with sustainable team structures.

**★ How does the checklist ensure fault isolation between services?**
The checklist verifies that all outbound synchronous network calls have strict connection/socket timeouts, circuit breakers, and graceful fallback behaviors. Furthermore, it verifies that message consumers are idempotent and that an outage in a downstream dependency degrades non-critical features rather than triggering cascading failures across the entire system.

---

← [Worked example: two teams vs twelve](44c-worked-example-two-teams-and-twelve.md) · [Topic index](README.md)
