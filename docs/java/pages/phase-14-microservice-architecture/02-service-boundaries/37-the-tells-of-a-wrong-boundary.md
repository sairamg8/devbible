---
title: "A bad service boundary announces itself through concrete operational pathology — lockstep deployments, distributed transactions, chatty network roundtrips, and cross-repo feature branches prove a line was drawn in the wrong place"
sidebar_label: "37 · The tells of a wrong boundary"
sidebar_position: 51
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-04 against Sam Newman, *Building Microservices* 2nd ed. (O'Reilly), Chapter 3:
> Splitting the Monolith; Michael Nygard, *Release It!* 2nd ed. (Pragmatic Bookshelf), Chapter 8:
> Cascading Failures.
> Version spine: **JDK 25 · Spring Boot 4.1.1 / Framework 7.0.9 · Spring Cloud train 2025.1.x "Oakwood"**. Documentation-validated; **no sandbox run**.

**When a service boundary is drawn incorrectly, the system does not fail quietly—it screams through unmistakable operational, architectural, and organizational symptoms. You do not need an abstract architectural review to know a boundary is wrong; you need only observe how the team builds, tests, and deploys software. Lockstep deployments where multiple services must be released in exact sequential order, cross-repo pull requests where a single user story modifies four repositories, chatty synchronous networks where fulfilling one user click takes fifteen sequential HTTP hops, and distributed transactions where a failure in Service C corrupts Service A are all definitive proof that an aggregate was severed. Identifying these symptoms early allows teams to repair or merge boundaries before distributed complexity becomes irreversible.**

## The six operational tells

Every incorrect service boundary manifests in at least one of these six symptoms:

```text
1. Lockstep Deployments    ──► Services cannot ship independently; synchronized release trains
2. Multi-Repo Features     ──► A single Jira story requires PRs in 3+ separate Git repositories
3. Chatty Remote Chains    ──► 15 sequential HTTP hops to render a single user web page
4. Distributed Saga Hell   ──► Business cannot tolerate eventual consistency; continuous manual fixes
5. Circular Call Chains    ──► Service A ──► Service B ──► Service C ──► Service A (deadlocks)
6. Shared Database         ──► Two "microservices" connecting to the exact same database schema
```

### 1. Lockstep deployments (the release train deadlock)

If deploying version 2.4 of the Order Service requires deploying version 3.1 of the Inventory Service and version 1.8 of the Billing Service simultaneously, your services are not autonomous. They are a distributed monolith. High design-time coupling has survived the network split, giving you all the operational costs of microservices with none of the release independence.

### 2. The multi-repo feature branch

Observe the pull requests required to ship a routine business feature. If a single change requires coordinated commits across `order-service`, `customer-service`, and `billing-service`:
- The boundary was drawn along technical or entity lines rather than cohesive business capabilities.
- Developers spend their days coordinating merge orders, resolving cross-repo branch dependencies, and attending multi-team status meetings.
- The Common Closure Principle—*"classes that change together should be packaged together"*—has been violated.

### 3. Chatty synchronous call chains

When microservices are sliced too finely (such as Nygard's entity services), domain logic remains centralized while data is scattered across the network. To execute a single business operation, an orchestrator service must make dozens of synchronous roundtrips to fetch individual fields.

This triggers two catastrophic consequences:
1. **Latency amplification:** Network roundtrips, serialization, and connection pooling overhead turn an in-memory method call into an HTTP cascade whose latency is set by the number of sequential hops rather than by the work being done.
2. **Availability degradation:** As detailed in the availability arithmetic of microservices, if five sequential services each maintain 99% availability, the composite interaction achieves only `0.99^5`, or roughly **95.1%** availability.

### 4. Distributed transactions and compensation hell

If a business operation spanning two services requires ACID atomicity—meaning the business genuinely cannot tolerate eventual consistency or compensating transactions—splitting those services was an architectural error. When Service C fails mid-saga and compensation fails, developers are forced to write manual database cleanup scripts to reconcile orphan records. A true invariant must never cross a service boundary.

### 5. Circular call chains

When Service A calls Service B, which calls Service C, which then calls Service A to verify a customer status, the boundary has failed. Circular call chains cause:
- Distributed thread pool starvation under high load.
- Infinite recursion during unexpected error states.
- Inability to reason about system state or debug production incidents.

### 6. The shared database

If two different services connect to the same PostgreSQL or Oracle database and query each other's tables, the service boundary is a fiction. A database migration in Service A breaks queries in Service B without warning. The network boundary was created in Kubernetes, but the data boundary was never established.

## Diagnostic table: Tell to architectural fix

| Observed Tell | Root DDD Violation | The Architectural Remedy |
|---|---|---|
| **Lockstep deployments** | Shared design-time model; unversioned wire contracts | Adopt tolerant reader DTOs, or merge the services |
| **Multi-repo features** | Slicing by layer or entity instead of capability | Consolidate related subdomains into a single service |
| **Chatty synchronous calls** | Anemic domain model; entity service anti-pattern | Move business logic to the data; push computation downstream |
| **Distributed saga hell** | Invariant severed across a transaction boundary | Co-locate aggregates into a single database and transaction |
| **Circular call chains** | Unclear upstream/downstream roles; bi-directional coupling | Invert dependency using asynchronous domain events |
| **Shared database** | Lack of single-service data ownership | Enforce database-per-service; access data via published APIs |

## Merging is not failure

When an architecture exhibits three or more of these tells, continuing to patch the boundary with distributed tracing, retries, and API gateways is an exercise in sunk cost fallacy. The most professional engineering decision is to acknowledge that the boundary was drawn incorrectly, merge the services back into a single modular deployable, and enforce the boundary in-process using package structure and verification tests.

## Gotchas

**★ Symptom: The team attempts to resolve chatty HTTP calls by introducing a distributed cache between microservices.**
Cause: Treating a boundary defect as a performance issue. A shared cache simply reintroduces shared database coupling under a faster technology.
Fix: Redraw the boundary to co-locate the chatty data with the business logic.

**★ Symptom: High-concurrency deadlocks occur across microservices.**
Cause: Circular synchronous call chains locking resources across multiple databases in conflicting orders.
Fix: Eliminate circular calls. Invert the dependency using asynchronous domain events published over Kafka or RabbitMQ.

**★ Symptom: Developers build home-grown distributed lock managers (using Redis or ZooKeeper) to coordinate writes across services.**
Cause: Severing a single transactional aggregate across two microservices.
Fix: Move the two entities into the same service and database, using local ACID transactions.

**★ Symptom: Staging environments are perpetually broken because services can only be tested when deployed together.**
Cause: High design-time coupling and lockstep deployments.
Fix: Decouple services using consumer-driven contract tests, or merge tightly coupled services into a single deployable unit.

## Interview questions

**★ What are the most reliable operational signals that a service boundary has been drawn incorrectly?**
The most reliable operational signals are lockstep deployments (inability to release a service without deploying others), multi-repo pull requests for single user stories, chatty synchronous HTTP call chains causing severe latency, circular service dependencies, and frequent data corruption requiring manual reconciliation due to severed transaction boundaries.

**★ Why is a requirement for "lockstep deployments" the definitive proof of an architectural failure in microservices?**
The core promise of microservice architecture is independent deployability—the ability for an autonomous team to deliver business value without coordinating release schedules with other teams. When services must be deployed in lockstep, release independence is zero. The system suffers all the distributed complexity, network failure modes, and operational overhead of microservices while retaining the deployment friction of a monolith.

**★ How does slicing a system into "entity services" cause chatty network calls?**
Entity services (e.g. `CustomerService`, `OrderService`, `ProductService`) simply wrap database tables in CRUD HTTP endpoints. Because the services lack business logic, orchestrator services must repeatedly invoke multiple entity endpoints over the network to assemble state, perform computations, and write back results. This replaces local memory lookups with high-latency network roundtrips.

**★ Under what circumstances should an engineering organization merge two microservices back into one?**
An organization should merge two services when: (1) they are always deployed together in lockstep; (2) business invariants require atomic consistency across both services' data stores; (3) features consistently require synchronized changes across both codebases; or (4) the operational overhead of running two services exceeds the value of separate deployment.

---

← [Choosing a relationship](36-choosing-a-relationship.md) · [Topic index](README.md) · Next → [Merging two services](38-merging-two-services.md)
