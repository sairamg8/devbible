---
title: "Living with an imperfect boundary is often the rational economic choice — mitigating coupling through read replicas, caching, and circuit breakers"
sidebar_label: "43 · When not to fix it"
sidebar_position: 70
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-04 against Michael Nygard, *Release It!* (2nd ed., Pragmatic Bookshelf);
> Sam Newman, *Monolith to Microservices* (O'Reilly), Chapter 1: Just Enough Microservices.
> Version spine: **JDK 25 · Spring Boot 4.1.1 / Framework 7.0.9 · Spring Cloud train 2025.1.x "Oakwood"**. Documentation-validated; **no sandbox run**.

**Software architecture is an exercise in economic trade-offs, not theoretical perfection. When an engineering team discovers an improper service boundary — characterized by synchronous network chattiness or awkward data dependencies — the immediate instinct of software purists is to schedule a multi-quarter refactoring. In production realities, however, the financial and opportunity cost of redrawing a boundary often far exceeds the operational drag of living with it. If the affected services have low change frequency, stable throughput, or a planned sunset horizon, the rational engineering decision is to contain the boundary through tactical mitigations rather than rewiring production infrastructure.**

## The economic triage matrix

Before approving an expensive boundary refactoring, evaluate the boundary against three operational criteria:

```
                          ┌────────────────────────────────┐
                          │ Rate of Change (Code Churn)    │
                          └───────┬────────────────┬───────┘
                                  │                │
                             Low Churn        High Churn
                                  │                │
            ┌─────────────────────┴─────┐     ┌────┴────────────────────────┐
            │ Sunset within 12-18 mos?  │     │ Is coupling causing outages │
            ├──────────────┬────────────┤     │ or blocking feature delivery?│
            │ YES          │ NO         │     ├──────────────┬──────────────┤
            │              │            │     │ YES          │ NO           │
            ▼              ▼            ▼     ▼              ▼              ▼
       [ Do Not Fix ] [ Contain ]  [ Contain ] [ Refactor ]   [ Contain ]
```

1. **Code Churn**: If the code spanning the boundary has not been modified in six months and bug rates are near zero, leave it alone. Refactoring stable code introduces fresh defects.
2. **Planned Sunset**: If the subsystem is slated for replacement within 12 to 18 months, spending three months refactoring its boundary is pure value destruction.
3. **Operational Impact**: If the flaw causes minor latency but zero SLA violations or customer-facing outages, apply lightweight mitigations. Only when coupling paralyzes delivery or crashes production does refactoring become justifiable.

## Containment patterns: Mitigating a bad boundary

When you choose to live with an imperfect boundary, use these architectural containment patterns to neutralize the operational pain:

```
Mitigation 1: Local Read Replica (Eliminates Synchronous Query Latency)
[Service A] --(CDC / Kafka)--> [Local DB Replica] <== [Service B (Local Query)]

Mitigation 2: Strategic Caching with Resilient Fallback
[Service B] ===> [Caffeine / Redis Cache] ===(Cache Miss)===> [Service A (HTTP)]
                        || (Timeout / 503)
                        \/
             [Resilience4j Fallback]
```

### 1. Local Read Replicas via Event Streaming
If Service B constantly makes synchronous HTTP calls to Service A just to fetch user display names or catalog prices, eliminate the network hop by streaming events:
- Service A emits `PriceUpdatedEvent` or `UserRenamedEvent` to Kafka.
- Service B consumes the events and maintains a local read-only table in its own database.
- Service B queries its local table with zero network latency and zero runtime dependency on Service A's availability.

### 2. Strategic Caching with Resilience4j Fallbacks
If cross-boundary calls are strictly read-only and tolerate short-term staleness (e.g., 60 seconds), wrap the remote client in a local in-memory cache and a circuit breaker:

```java
package com.example.containment.client;

import io.github.resilience4j.circuitbreaker.annotation.CircuitBreaker;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;

import java.util.Optional;

// src/main/java/com/example/containment/client/CustomerSummary.java
public record CustomerSummary(String customerId, String displayName, String tier) {}

@Service
// src/main/java/com/example/containment/client/ResilientCustomerClient.java
public class ResilientCustomerClient {

    private final RestClient restClient;

    public ResilientCustomerClient(RestClient.Builder restClientBuilder) {
        this.restClient = restClientBuilder.baseUrl("http://customer-service:8080").build();
    }

    @Cacheable(value = "customerSummaries", key = "#customerId", unless = "#result.isEmpty()")
    @CircuitBreaker(name = "customerService", fallbackMethod = "fallbackCustomer")
    public Optional<CustomerSummary> getCustomer(String customerId) {
        CustomerSummary summary = restClient.get()
                .uri("/api/customers/{id}/summary", customerId)
                .retrieve()
                .body(CustomerSummary.class);
        return Optional.ofNullable(summary);
    }

    // Fallback executes if Customer Service times out or circuit opens
    public Optional<CustomerSummary> fallbackCustomer(String customerId, Throwable ex) {
        // Return a degraded, safe default rather than failing the user request
        return Optional.of(new CustomerSummary(customerId, "Valued Customer", "STANDARD"));
    }
}
```

### 3. Bulk Lookup Endpoints
If Service B suffers from N+1 query chattiness (calling Service A once for each item in a list of 50 items), do not redraw the boundary. Simply add a batch lookup endpoint to Service A:
- Change `GET /items/\{id\}` to `POST /items/batch-lookup` taking a `List<UUID>`.
- Reduces 50 sequential network round-trips to a single bulk payload.

### 4. Quarantine with an Anti-Corruption Layer (ACL)
To prevent the flawed boundary from contaminating new feature development, build a strict Anti-Corruption Layer inside Service B. All new code talks exclusively to the ACL interface. If the boundary is ever refactored in the future, only the ACL implementation needs to change.

## Containment needs an expiry date, or it becomes the architecture

Every pattern above is a compensation for a boundary you have decided not to move, and all of them
share one failure: they work. A cache that hides chattiness, a circuit breaker that hides a fragile
dependency, an ACL that hides an incoherent upstream — each removes the pain that would otherwise
have forced the decision, and the decision is then never revisited.

**So containment gets recorded like a deprecation, not like an improvement:**

```markdown
CONTAINMENT: read replica of catalogue product data in pricing
  Compensating for : pricing makes 40+ synchronous catalogue calls per quote
  Accepted because : catalogue rewrite is scheduled for FY27; not worth pre-empting
  Revisit when     : the catalogue rewrite starts, OR a second consumer needs the same replica,
                     OR staleness causes a customer-visible incident
  Owner            : pricing team
  Recorded         : 2026-09
```

🔴 **The "revisit when" line is the part that makes this honest.** A containment with no trigger is
not a deliberate decision to tolerate a boundary; it is the boundary becoming permanent while
everybody describes it as temporary. And the triggers that matter are rarely dates — they are events:
a second consumer needing the same workaround, an incident caused by the compensation itself, or the
constraint that justified the decision expiring.

**The strongest signal that containment has become architecture** is a second team adopting the same
workaround. One team caching another service's data is a local decision; three teams caching it means
the data has the wrong owner and the boundary should move —
[10 · Who owns the data](10-who-owns-the-data.md).

## When containment is the wrong answer entirely

Tolerating a bad boundary is a decision about cost, and it stops being available when the boundary is
wrong in a specific way:

| Situation | Contain? | Why |
|---|---|---|
| Chatty reads across the line | ✅ | A replica or a cache genuinely removes the cost |
| Multiplied unavailability | ✅ | Fallbacks and circuit breakers are the right tool for a dependency you cannot remove |
| An incoherent upstream model | ✅ | An ACL is the pattern for exactly this, indefinitely |
| 🔴 **An invariant that must hold transactionally** | ❌ | Nothing compensates for this. A saga schedules the violation; a distributed lock relocates it |
| 🔴 **Lockstep deployment** | ❌ | A release train makes it comfortable and permanent — the boundary does not exist and no tooling creates one |

**The two ❌ rows are the two conclusive tells from
[37 · The tells of a wrong boundary](37-the-tells-of-a-wrong-boundary.md)**, and that is not a
coincidence: a conclusive tell means the line is in the wrong place, and containment compensates for
costs, not for wrongness. Everything else on the list is a cost you can decide to keep paying.

## Gotchas

**★ Using caching to paper over broken write invariants.**
Caching is effective only for read operations that tolerate eventual consistency. If Service A and Service B must both write and agree on a balance atomically, placing a cache in between causes catastrophic split-brain state and financial discrepancies.

**★ Allowing "temporary containment" to degrade into undocumented rot.**
Teams often implement a local read replica or cache as a "stopgap" but fail to document the known trade-offs. Two years later, new engineers do not understand why data takes 5 seconds to propagate, leading to phantom bug reports. Always document containment trade-offs in an Architecture Decision Record (ADR).

**★ A containment measure is four years old and is now described as 'how the system works'.**
Cause: it was recorded as an improvement rather than as a deliberate, temporary compensation with a
revisit trigger. Nothing ever fired, because nothing was ever set to fire.
Fix: record containment the way you record a deprecation — what it compensates for, why the boundary
was left alone, and the **event** that should reopen the decision. Event triggers beat dates: a second
consumer adopting the same workaround, an incident caused by the compensation, or the expiry of the
constraint that justified it.

**★ Three teams have independently built the same cache of another service's data.**
Cause: each team made a locally reasonable containment decision. Collectively they have established
that the data is in the wrong place.
Fix: stop containing and move the boundary. Repeated identical workarounds by unrelated teams is the
strongest available evidence about ownership, and it is stronger than any single team's argument
because none of them coordinated to produce it.

**★ A saga is introduced to contain an invariant that spans the boundary, and inconsistencies persist.**
Cause: containment was applied to a conclusive tell. A saga is correct for a genuinely long-running
process that tolerates intermediate states; it cannot make an immediate invariant immediate.
Fix: this is one of the two cases where tolerating is not on the menu. Either the invariant is not
really transactional — establish that explicitly and the saga is fine — or the boundary is in the
wrong place and has to move.

**★ Inconsistent cache invalidation creating ghost records.**
When caching remote service responses locally, relying solely on TTLs means updates in Service A will be invisible in Service B until the TTL expires. Where possible, pair caches with event-driven invalidation (e.g., Service B listens to Kafka events to evict cached keys immediately).

## Interview questions

**★ Under what circumstances is it architecturally correct to leave a known bad service boundary in place?**
When the financial and engineering cost of redrawing the boundary exceeds the operational impact. Specifically, when: (1) the code spanning the boundary has very low churn (stable, rarely modified); (2) the subsystem is scheduled for deprecation or replacement in the near future; and (3) operational availability meets business SLAs through caching, read replication, or circuit breakers.

**★ How do local read replicas solve the problem of a chatty, synchronous service boundary?**
Instead of making synchronous REST/gRPC calls for every transaction, the consuming service subscribes to domain events or CDC streams from the producing service and caches read-only state in its own database. Queries execute locally in microseconds without network hops, and an outage in the producing service does not bring down the consuming service.

**★ What is the primary limitation of using Resilience4j circuit breakers to contain a bad boundary?**
Circuit breakers only protect availability during read operations or non-critical asynchronous actions by returning fallbacks. They cannot fix broken transactional write boundaries. If a business command requires immediate atomic consistency across two services, a circuit breaker fallback cannot safely complete the write without introducing corrupt or partial business state.

**★ Are there boundary defects that cannot be contained, and how do you recognise them?**
Two, and they are the same two signals that conclusively identify a wrong boundary. An **invariant
that must hold transactionally across the line** cannot be compensated for: a saga schedules the
violation rather than preventing it, and a distributed lock relocates it into an availability problem.
And **lockstep deployment** cannot be compensated for either — a release train makes it comfortable
and therefore permanent, but no tooling manufactures a boundary that does not exist. Everything else
on the containment list — chattiness, multiplied unavailability, an incoherent upstream — is a *cost*,
and costs are exactly what you are allowed to decide to keep paying. Containment answers costs; it
does not answer wrongness.

**★ How do you keep a deliberate decision to tolerate a bad boundary from silently becoming the architecture?**
Record it like a deprecation, not like an improvement: what it compensates for, why the boundary was
left alone, who owns it, and — the load-bearing line — the **event** that should reopen the decision.
Triggers work better as events than as dates: a second consumer needing the same workaround, an
incident caused by the compensation itself, or the expiry of whatever constraint justified the
deferral. The strongest single trigger is repetition by others: one team caching another service's
data is a local call, three teams doing it independently is evidence about ownership that nobody
coordinated to produce, and it should move the boundary rather than add a fourth cache.

**★ How does an Anti-Corruption Layer (ACL) protect a system when living with an imperfect boundary?**
An ACL isolates the consuming service's internal domain model from the awkward, leaked concepts of the imperfect boundary. By translating external legacy structures into clean internal value objects at the entry boundary, new business features can be written cleanly. If the external boundary is later refactored, only the ACL translator requires updating.

---

← [The cost of changing a boundary](42-the-cost-of-changing-a-boundary.md) · [Topic index](README.md) · Next → [Worked example: operations and aggregates](44-worked-example-operations-and-aggregates.md)
