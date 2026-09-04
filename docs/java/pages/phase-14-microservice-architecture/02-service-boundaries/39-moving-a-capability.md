---
title: "Moving an aggregate across service boundaries requires a zero-downtime expand-and-contract migration rather than a high-risk cutover"
sidebar_label: "39 · Moving a capability"
sidebar_position: 58
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-04 against Sam Newman, *Monolith to Microservices* (O'Reilly), Chapter 4: Migrating
> Existing Functionality; Martin Fowler, *Branch by Abstraction* and *Parallel Run*.
> Version spine: **JDK 25 · Spring Boot 4.1.1 / Framework 7.0.9 · Spring Cloud train 2025.1.x "Oakwood"**. Documentation-validated; **no sandbox run**.

**In an evolving distributed system, capability boundaries are not static. As business workflows clarify, an aggregate originally assigned to Service A often proves to have far higher affinity with the domain invariants of Service B. Forcing the aggregate to remain in Service A generates distributed coupling, cross-service synchronous queries, and distributed transactions. Relocating an aggregate across running microservices cannot be done with a stop-the-world maintenance window. It requires a disciplined six-phase Expand-and-Contract migration: implementing the capability in the destination service, establishing continuous data synchronization via Change Data Capture (CDC), backfilling historical state, verifying data parity with shadow traffic, cutting over reads and writes, and decommissioning the legacy schema.**

## Why aggregates end up in the wrong service

Aggregates are misallocated across services for predictable reasons:
1. **Initial domain ambiguity**: At project launch, the `ReturnRequest` aggregate was placed in `CatalogService` because returns referenced product SKUs. Two years later, almost all of its interactions are with `InventoryService` and `BillingService`.
2. **Feature drift**: A small auxiliary table grew into a complex domain model with independent lifecycle states.
3. **Conway's Law shifts**: Team ownership reorganized, leaving one squad maintaining an isolated table inside a repository owned by another squad.

When an aggregate is in the wrong service, the system exhibits classic symptoms: Service B constantly queries Service A via HTTP/gRPC for state that belongs in Service B's transaction boundary.

## The Expand-and-Contract migration lifecycle

```
Phase 1: Expand      [Service A (Primary)] ---> CDC / Outbox ---> [Service B (Shadow)]
Phase 2: Replicate   Historical Backfill Job ensures Parity between A and B
Phase 3: Verify      Shadow Reads / Automated Parity Check verifies consistency
Phase 4: Contract 1  Switch Writes to Service B; Service B syncs back to A (if rollback needed)
Phase 5: Contract 2  Switch Reads to Service B; remove sync
Phase 6: Delete      Drop table in Service A; remove legacy code
```

### Phase 1: Expand — implement the destination capability
Create the aggregate, tables, and domain logic in Service B without routing live production traffic to it yet. Service B exposes the new API endpoints or message handlers.

### Phase 2: Continuous replication via Change Data Capture (CDC)
Do not use dual-writing in application code. Application dual-writes suffer from partial failure modes: if write A succeeds but write B fails (due to network timeout), the databases diverge silently.

Instead, stream committed transactions from Service A's database log using Debezium CDC or an outbox publisher. Every mutation to the aggregate in Service A emits an event consumed by Service B to update its local replica.

### Phase 3: Historical backfill and parity verification
While CDC streams new writes, run a background batch job that paginates through historical records in Service A and publishes them to Service B. Debezium handles ordering if using event timestamps or Kafka partition keys keyed by the aggregate ID.

Verify data integrity by running a read-reconciliation job:
```java
package com.example.migration.verifier;

import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.Objects;
import java.util.Optional;

// src/main/java/com/example/migration/verifier/ParityDiscrepancy.java
public record ParityDiscrepancy(String aggregateId, String fieldName, Object sourceValue, Object targetValue, Instant detectedAt) {}

// src/main/java/com/example/migration/verifier/ReturnAggregateState.java
public record ReturnAggregateState(String returnId, String orderId, String status, long amountCents) {}

// src/main/java/com/example/migration/verifier/ReturnSourceClient.java
public interface ReturnSourceClient {
    Optional<ReturnAggregateState> fetchFromSource(String returnId);
}

// src/main/java/com/example/migration/verifier/ReturnTargetClient.java
public interface ReturnTargetClient {
    Optional<ReturnAggregateState> fetchFromTarget(String returnId);
}

@Service
// src/main/java/com/example/migration/verifier/ParityVerificationService.java
public class ParityVerificationService {

    private final ReturnSourceClient sourceClient;
    private final ReturnTargetClient targetClient;

    public ParityVerificationService(ReturnSourceClient sourceClient, ReturnTargetClient targetClient) {
        this.sourceClient = sourceClient;
        this.targetClient = targetClient;
    }

    public Optional<ParityDiscrepancy> verifyAggregate(String returnId) {
        Optional<ReturnAggregateState> source = sourceClient.fetchFromSource(returnId);
        Optional<ReturnTargetClient> target = targetClient.fetchFromTarget(returnId).map(t -> targetClient);

        if (source.isEmpty() && targetClient.fetchFromTarget(returnId).isEmpty()) {
            return Optional.empty();
        }
        if (source.isPresent() && targetClient.fetchFromTarget(returnId).isEmpty()) {
            return Optional.of(new ParityDiscrepancy(returnId, "existence", "PRESENT", "MISSING", Instant.now()));
        }

        ReturnAggregateState src = source.get();
        ReturnAggregateState tgt = targetClient.fetchFromTarget(returnId).get();

        if (!Objects.equals(src.status(), tgt.status())) {
            return Optional.of(new ParityDiscrepancy(returnId, "status", src.status(), tgt.status(), Instant.now()));
        }
        if (src.amountCents() != tgt.amountCents()) {
            return Optional.of(new ParityDiscrepancy(returnId, "amountCents", src.amountCents(), tgt.amountCents(), Instant.now()));
        }

        return Optional.empty();
    }
}
```

### Phase 4: Route writes to Service B
Once verification shows 100% parity across active aggregates:
1. Update client applications or the API Gateway to route write commands (`POST /returns`, `PUT /returns/\{id\}/approve`) directly to Service B.
2. If zero-downtime rollback is required, configure reverse-CDC from Service B back to Service A temporarily.

### Phase 5 & 6: Route reads and decommission Service A
1. Shift all read queries to Service B.
2. Verify Service A receives zero read/write traffic for the relocated aggregate.
3. Drop the legacy tables and database columns in Service A.
4. Remove the unused entity models and repositories from Service A's codebase.

## Gotchas

**★ Dual-writing in application code causes silent data corruption.**
Dual-writing via Spring service code (`orderRepo.save(order); billingClient.save(order);`) has no two-phase commit. If the JVM crashes or the network drops between the two operations, the data models permanently diverge without any trace in the logs. Always use Change Data Capture (CDC) or a transactional outbox.

**★ Dangling foreign keys in the origin database.**
If Service A had database foreign keys pointing from `Order` to the relocated `ReturnRequest`, extracting `ReturnRequest` breaks relational integrity. Foreign key constraints must be dropped before or during Phase 1, and replaced with application-level identifier validation.

**★ Unsynchronized Kafka consumer group offsets.**
Downstream consumers listening to domain events emitted by Service A (`ReturnRequestedEvent`) will be stranded if Service B begins publishing a different event schema on a different Kafka topic. Service B must maintain the published language contract or downstream consumers must be migrated concurrently.

**★ Out-of-order backfill overwriting live mutations.**
If the historical backfill job reads row #1000 at 12:00:00, a live customer update mutates row #1000 at 12:00:01 via CDC, and the backfill worker inserts its stale snapshot at 12:00:02, the modern state is clobbered. Ensure the target uses monotonic version checks (optimistic locking / version columns) so older timestamps never overwrite newer writes.

## Interview questions

**★ What is the difference between migrating an aggregate using dual-writes versus Change Data Capture?**
Application-level dual-writes lack atomicity across network boundaries; if the secondary write fails, state diverges silently unless complex distributed compensation is implemented. CDC streams mutations directly from the source database transaction log (WAL), guaranteeing that every committed change is captured and forwarded in exact commit order without modifying application logic.

**★ How do you prevent data clobbering during an aggregate backfill?**
Use version vectors, monotonic sequence numbers, or database update timestamps. When applying backfilled records to the destination database, use conditional SQL updates (`WHERE source_version > target_version` or `ON CONFLICT DO UPDATE WHERE target.updated_at < excluded.updated_at`). If an event with a newer timestamp has already been applied via CDC, the backfill write is safely discarded.

**★ What role does Martin Fowler's "Branch by Abstraction" play when moving an aggregate?**
Branch by Abstraction provides an abstraction layer (an interface or routing adapter) inside consumer code. Initially, the abstraction delegates calls to the legacy service. As the new service is constructed and verified, the abstraction switches delegates dynamically (via feature toggles) without changing consumer business logic.

**★ What is the rollback plan if the target service fails during write cutover?**
Establish bidirectional synchronization prior to cutover. When writes switch to Service B, Service B immediately replicates writes back to Service A via CDC or outbox. If Service B experiences unexpected load or errors, traffic can be redirected back to Service A instantly without losing the writes processed by Service B.

---

← [Merging two services](38-merging-two-services.md) · [Topic index](README.md) · Next → [Splitting a service](40-splitting-a-service.md)
