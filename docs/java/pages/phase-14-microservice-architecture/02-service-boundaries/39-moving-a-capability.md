---
title: "Moving an aggregate across service boundaries requires a zero-downtime expand-and-contract migration rather than a high-risk cutover"
sidebar_label: "39 · Moving a capability"
sidebar_position: 65
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-04 against Martin Fowler, *ParallelChange*
> ([martinfowler.com](https://martinfowler.com/bliki/ParallelChange.html)); Sam Newman,
> *Monolith to Microservices* (O'Reilly), on data migration patterns — **cited by book, not
> independently verifiable here.**
> Version spine: **JDK 25 · Spring Boot 4.1.1 / Framework 7.0.9 · Spring Cloud train 2025.1.x "Oakwood"**. Documentation-validated; **no sandbox run**.

**In an evolving distributed system, capability boundaries are not static. As business workflows clarify, an aggregate originally assigned to Service A often proves to have far higher affinity with the domain invariants of Service B. Forcing the aggregate to remain in Service A generates distributed coupling, cross-service synchronous queries, and distributed transactions. Relocating an aggregate across running microservices cannot be done with a stop-the-world maintenance window. It requires a disciplined six-phase Expand-and-Contract migration: implementing the capability in the destination service, establishing continuous data synchronization via Change Data Capture (CDC), backfilling historical state, verifying data parity with shadow traffic, cutting over reads and writes, and decommissioning the legacy schema.**

## Why aggregates end up in the wrong service

Aggregates are misallocated across services for predictable reasons:
1. **Initial domain ambiguity**: At project launch, the `ReturnRequest` aggregate was placed in `CatalogService` because returns referenced product SKUs. Two years later, almost all of its interactions are with `InventoryService` and `BillingService`.
2. **Feature drift**: A small auxiliary table grew into a complex domain model with independent lifecycle states.
3. **Conway's Law shifts**: Team ownership reorganized, leaving one squad maintaining an isolated table inside a repository owned by another squad.

When an aggregate is in the wrong service, the system exhibits classic symptoms: Service B constantly queries Service A via HTTP/gRPC for state that belongs in Service B's transaction boundary.

## The pattern this is an instance of

Expand-and-contract is not specific to aggregates; it is Fowler's *Parallel Change* applied to data
instead of to a method signature, and the three phases are stated the same way:

> **Expand** — *"you augment the interface to support both the old and the new versions."*
> **Migrate** — *"you update all clients using the old version to the new version. This can be done incrementally."*
> **Contract** — *"you perform the contract phase to remove the old version and change the interface so that it only supports the new version."*

The property that makes it safe is that code can be *"released in any of these three phases"* — every
intermediate state is a shippable, revertible state. That is what distinguishes it from a cutover:
there is no moment at which the system is half-migrated and unshippable.

🔴 **The phase teams compress is Migrate, and compressing it is what turns Contract into an
outage.** Expand is satisfying and visible. Contract is a deletion, which feels like finishing.
Migrate is a period of *waiting and watching* with nothing to demo, so it gets scheduled as a sprint
rather than as "until the evidence says so" — and the evidence is the only thing that makes Contract
safe. The same failure appears with API contracts in
[28c · Changing a published contract](28c-changing-a-published-contract.md); it is the same pattern
and the same mistake.

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

## Dual-write or CDC: the choice, stated properly

Both keep two stores in step during Migrate, and they fail differently. Choosing on familiarity
rather than on failure mode is the common error.

| | Application dual-write | Change Data Capture |
|---|---|---|
| **Where it runs** | Inside your service's transaction path | Off the database's replication log, outside the transaction |
| **Atomicity** | 🔴 **None.** Two writes, one process, no shared transaction — a crash between them leaves the stores divergent, permanently and silently | Reads committed changes only; cannot observe a write the database rolled back |
| **Ordering** | Whatever the application did, per request | Log order, which is the database's own commit order |
| **Coverage** | Only writes that go through your code path | **Every** committed change, including migrations, admin scripts and that one manual `UPDATE` |
| **Cost** | A few lines | Infrastructure to run and operate |
| **Failure mode** | Silent divergence | Lag — visible, measurable, and it catches up |

🔴 **The Coverage row is the one that decides it in practice.** Dual-writing assumes every write to
the aggregate goes through the code you instrumented. In a system old enough to need this migration,
that assumption is nearly always false: there is a nightly correction job, a support tool, or a DBA
with a `psql` session. CDC does not care how the row changed.

**If you must dual-write** — and sometimes the infrastructure is not there — then make the second
write recoverable rather than best-effort. A transactional outbox turns "two writes and hope" into
"one write, then a retried delivery":

```java
@Transactional
public void updateReturn(ReturnRequest request) {
    returnRepository.save(request);                                  // the write
    outbox.save(new OutboxRecord("ReturnUpdated", request.id(), toJson(request)));  // same transaction
}
// A separate poller drains the outbox with retries. A crash loses nothing; it delays.
```

⚠️ **Whichever you choose, the target write must be idempotent**, because both mechanisms redeliver.
Key the target upsert on the aggregate id and reject stale versions rather than assuming
exactly-once delivery, which neither mechanism provides.

## Gotchas

**★ Dual-writing in application code causes silent data corruption.**
Dual-writing via Spring service code (`orderRepo.save(order); billingClient.save(order);`) has no two-phase commit. If the JVM crashes or the network drops between the two operations, the data models permanently diverge without any trace in the logs. Always use Change Data Capture (CDC) or a transactional outbox.

**★ Dangling foreign keys in the origin database.**
If Service A had database foreign keys pointing from `Order` to the relocated `ReturnRequest`, extracting `ReturnRequest` breaks relational integrity. Foreign key constraints must be dropped before or during Phase 1, and replaced with application-level identifier validation.

**★ Unsynchronized Kafka consumer group offsets.**
Downstream consumers listening to domain events emitted by Service A (`ReturnRequestedEvent`) will be stranded if Service B begins publishing a different event schema on a different Kafka topic. Service B must maintain the published language contract or downstream consumers must be migrated concurrently.

**★ The Migrate phase is scheduled as a two-week sprint, and Contract breaks a consumer.**
Cause: Migrate is not a work item, it is a wait for evidence — and it was given a duration instead of
an exit criterion. The old path was removed while something was still reading it.
Fix: give the phase a condition rather than a date. Instrument reads of the old store, wait out a
full business cycle including monthly and quarterly jobs, and let the graph reaching zero authorise
the deletion.
```java
if (log.isInfoEnabled()) {
    log.info("legacy-read aggregate=ReturnRequest id={} caller={}", id, callerId);
}
```

**★ The two stores diverge and nothing reports it until a customer complains.**
Cause: dual-writing without atomicity. The service crashed, was redeployed, or timed out between the
two writes, and there is no mechanism that notices.
Fix: prefer CDC, and if dual-writing is unavoidable, use a transactional outbox so the second write is
retried rather than lost — plus a continuous parity check that compares the two stores and alerts on
difference, rather than a report somebody reads.

**★ Redelivery creates duplicate rows in the target store.**
Cause: the target write was treated as exactly-once. Neither dual-writing nor CDC provides that; both
redeliver on retry.
Fix: make the target write idempotent on the aggregate id, and version-guard it so an older
redelivery cannot overwrite a newer state:
```java
// upsert keyed on the aggregate, and refuses to move backwards
int updated = targetRepo.upsertIfNewer(event.aggregateId(), event.version(), event.payload());
```

**★ Out-of-order backfill overwriting live mutations.**
If the historical backfill job reads row #1000 at 12:00:00, a live customer update mutates row #1000 at 12:00:01 via CDC, and the backfill worker inserts its stale snapshot at 12:00:02, the modern state is clobbered. Ensure the target uses monotonic version checks (optimistic locking / version columns) so older timestamps never overwrite newer writes.

## Interview questions

**★ What is the difference between migrating an aggregate using dual-writes versus Change Data Capture?**
Application-level dual-writes lack atomicity across network boundaries; if the secondary write fails, state diverges silently unless complex distributed compensation is implemented. CDC streams mutations directly from the source database transaction log (WAL), guaranteeing that every committed change is captured and forwarded in exact commit order without modifying application logic.

**★ How do you prevent data clobbering during an aggregate backfill?**
Use version vectors, monotonic sequence numbers, or database update timestamps. When applying backfilled records to the destination database, use conditional SQL updates (`WHERE source_version > target_version` or `ON CONFLICT DO UPDATE WHERE target.updated_at < excluded.updated_at`). If an event with a newer timestamp has already been applied via CDC, the backfill write is safely discarded.

**★ What role does Martin Fowler's "Branch by Abstraction" play when moving an aggregate?**
Branch by Abstraction provides an abstraction layer (an interface or routing adapter) inside consumer code. Initially, the abstraction delegates calls to the legacy service. As the new service is constructed and verified, the abstraction switches delegates dynamically (via feature toggles) without changing consumer business logic.

**★ Why is Migrate the phase that goes wrong, when Expand and Contract are the ones that touch code?**
Because Expand and Contract are work and Migrate is waiting. Expand ships something visible; Contract
is a deletion that feels like finishing; Migrate is a period of watching instrumentation with nothing
to demonstrate, so it gets planned as a sprint rather than as a condition. That is the substitution
that causes the incident — the pattern's safety comes entirely from Contract being authorised by
evidence that nothing reads the old path, and a date is not evidence. The mechanism is the same
whether you are moving an aggregate between stores or removing a field from a published contract: the
phase with nothing to show for it is the one that makes the other two safe.

**★ Dual-write or CDC — how do you actually choose?**
On coverage and failure mode, not on effort. Dual-writing assumes every write to the aggregate passes
through the code you instrumented, and in a system old enough to need this migration that assumption
is almost always wrong — there is a correction job, a support tool, or somebody with a database
session. CDC reads the commit log, so it sees every committed change regardless of origin. They also
fail differently: dual-writing fails by **silent divergence** when a process dies between the two
writes, while CDC fails by **lag**, which is visible, measurable and self-correcting. If dual-writing
is forced by circumstance, a transactional outbox converts the silent failure into a delayed one,
which is the property you actually needed. Either way the target write must be idempotent and
version-guarded, because neither mechanism delivers exactly once.

**★ What is the rollback plan if the target service fails during write cutover?**
Establish bidirectional synchronization prior to cutover. When writes switch to Service B, Service B immediately replicates writes back to Service A via CDC or outbox. If Service B experiences unexpected load or errors, traffic can be redirected back to Service A instantly without losing the writes processed by Service B.

---

← [Merging two services](38-merging-two-services.md) · [Topic index](README.md) · Next → [Splitting a service](40-splitting-a-service.md)
