---
title: "In a Customer-Supplier relationship, the downstream customer has genuine leverage over the upstream supplier — upstream prioritizes downstream requirements and negotiates delivery dates in sprint planning"
sidebar_label: "31 · Customer-supplier"
sidebar_position: 51
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-04 against Eric Evans, *Domain-Driven Design Reference* (2015),
> *Customer/Supplier Development*, reproduced verbatim in the ddd-crew *Context Mapping Guide*
> ([github.com/ddd-crew/context-mapping](https://github.com/ddd-crew/context-mapping)); Eric Evans,
> *Domain-Driven Design* (Addison-Wesley, 2003), Chapter 14 *Maintaining Model Integrity*.
> Version spine: **JDK 25 · Spring Boot 4.1.1 / Framework 7.0.9 · Spring Cloud train 2025.1.x "Oakwood"**. Documentation-validated; **no sandbox run**.

**A Customer-Supplier relationship exists only when the downstream team possesses genuine organizational authority or executive mandate over the upstream provider. In this pattern, the upstream team acts as a dedicated supplier whose success is evaluated by how effectively it fulfills the downstream customer's business requirements. The downstream customer submits feature requests, negotiates interface contracts, and directly influences upstream sprint priorities and delivery schedules. When organizations claim to practice Customer-Supplier without executive alignment or shared management backing, the downstream team discovers it has no real leverage, upstream delivers whatever it chooses, and the dynamic collapses into an uncooperative Conformist relationship.**

## The definition, and the single test it contains

> *"Establish a clear customer/supplier relationship between the two teams, meaning downstream
> priorities factor into upstream planning."*

**The whole pattern is in the last five words.** Not "the upstream is friendly", not "we have a good
relationship with that team", not "they said they would look at it". *Downstream priorities factor
into upstream planning* — which is a checkable claim about an artefact:

🔴 **Open the upstream team's backlog. If nothing in it was requested by the downstream team, you do
not have Customer/Supplier. You have [32 · Conformist](32-conformist.md) with a nicer story.**

That test matters because the two situations feel identical for months and then diverge sharply. A
downstream team that believes it is the customer *waits* — it plans around a field arriving next
quarter, and blocks. A downstream team that knows it is conformist *adapts* — it builds against what
exists today, or writes an ACL. Both are workable strategies. Believing the first while living in
the second is the one that costs a quarter.

## What establishes genuine customer leverage

A team does not become a "Customer" merely because it sends HTTP requests to an upstream service. In software architecture, leverage is organizational, not technological.

A true Customer-Supplier dynamic requires at least one of three structural conditions:
1. **Strategic asymmetry:** The downstream system represents the company's core revenue-generating domain (e.g. Checkout or Order Placement), while the upstream service is internal supporting infrastructure (e.g. Notification, Auditing, or Document Generation).
2. **Budgetary and executive mandate:** Shared leadership explicitly establishes that the upstream team's primary OKR is unblocking downstream delivery.
3. **Formal joint planning:** Downstream representatives participate directly in upstream backlog refinement, sprint planning, and acceptance review.

Without these mechanisms, calling a relationship "Customer-Supplier" is wishful thinking. If the upstream team can refuse downstream requests without executive consequence, downstream is not a customer—it is an external dependent.

## Collaborative mechanics in practice

In a functioning Customer-Supplier relationship:
- **Contract negotiation:** Downstream dictates the shape of the data it requires to execute business logic, rather than accepting whatever schema upstream's database happens to use.
- **Consumer-driven acceptance tests:** Downstream authors automated acceptance test suites defining contract expectations. Upstream executes these tests in its own CI pipeline; a commit that breaks downstream contracts fails upstream's build.
- **Synchronized milestones:** Upstream commits to delivery dates for new endpoints before downstream initiates dependent feature development.

## Runnable Java implementation: Consumer contract verification

In this implementation, the downstream `Order` team acts as customer, providing an automated contract expectation that the upstream `CustomerProfile` supplier service must satisfy:

```java
package com.retailer.order.client;

import java.time.Duration;
import java.util.UUID;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;

// Downstream customer client expecting negotiated contract
@Component
// src/main/java/com/retailer/order/client/CustomerProfileClient.java
public class CustomerProfileClient {

    private final RestClient restClient;

    public CustomerProfileClient(RestClient.Builder builder) {
        this.restClient = builder
            .baseUrl("http://customer-profile-service")
            .build();
    }

    public CustomerVerification verifyCustomerCredit(UUID customerId) {
        return restClient.get()
            .uri("/internal/v1/customers/{id}/credit-standing", customerId)
            .accept(MediaType.APPLICATION_JSON)
            .retrieve()
            .body(CustomerVerification.class);
    }
}

// Negotiated contract record authored to meet downstream Order validation needs
// src/main/java/com/retailer/order/client/CustomerVerification.java
public record CustomerVerification(
    UUID customerId,
    boolean eligibleForCredit,
    String riskTier
) {}
```

Upstream supplier controller implementing the agreed contract:

```java
package com.retailer.customer.web;

import java.util.UUID;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/internal/v1/customers")
class CustomerStandingController {

    private final CustomerCreditService creditService;

    CustomerStandingController(CustomerCreditService creditService) {
        this.creditService = creditService;
    }

    @GetMapping("/{id}/credit-standing")
    ResponseEntity<CustomerStandingResponse> getStanding(@PathVariable UUID id) {
        // Implements the contract explicitly requested by the Order customer team
        CustomerStanding standing = creditService.evaluate(id);
        return ResponseEntity.ok(new CustomerStandingResponse(
            id,
            standing.isEligible(),
            standing.getRiskBand().name()
        ));
    }
}

record CustomerStandingResponse(UUID customerId, boolean eligibleForCredit, String riskTier) {}
interface CustomerCreditService { CustomerStanding evaluate(UUID id); }
record CustomerStanding(boolean isEligible, RiskBand riskBand) {}
enum RiskBand { LOW, MEDIUM, HIGH }
```

## When Customer-Supplier collapses

The Customer-Supplier pattern breaks down in two common scenarios:

1. **Upstream has too many customers:** When an upstream service serves forty different downstream teams, it cannot accommodate bespoke requests from all of them. Prioritizing one customer breaks others. Upstream must transition from Customer-Supplier to an **Open Host Service** with a unified **Published Language**.
2. **Leverage inversion:** If the upstream service is owned by a remote platform team or third-party vendor with its own roadmap, the downstream team has zero influence. Continuing to act as a customer leads to missed deadlines and blocked sprints.

## What the supplier owes, and what it does not

Leverage is not unlimited, and the pattern collapses just as reliably from the customer overreaching
as from the supplier ignoring them.

| The customer may ask for | The customer may not ask for |
|---|---|
| A field on an existing contract | A change to the upstream's internal model |
| A new operation the upstream's domain can legitimately perform | An operation that belongs to the customer's domain, hosted upstream |
| A compatibility guarantee, with notice periods | A bespoke endpoint that exists only for them |
| Inclusion in the upstream's contract test suite | A veto over the upstream's release schedule |

🔴 **The right-hand column's last two rows are how a Customer/Supplier relationship degrades into
something worse.** Bespoke endpoints per consumer are the failure that
[34 · Open host and published language](34-open-host-and-published-language.md) exists to prevent —
at three consumers the upstream is maintaining three contracts, and its own roadmap has stopped being
its own. And a customer with a veto over releases is not a customer; that is
[35 · Partnership](35-partnership-and-separate-ways.md), with double the coordination cost and none
of the acknowledgement.

**The healthy version has a specific shape:** one contract, versioned, with the customer's needs
represented as *items in the supplier's backlog* and *tests in the supplier's build*. The tests are
the part that makes it survive personnel changes — a promise lives in someone's memory, a failing
build does not.

## Gotchas

**★ Symptom: Downstream team waits three sprints for an upstream endpoint, blocking a critical release.**
Cause: Downstream believed it had a Customer-Supplier relationship, but upstream had competing business priorities and no managerial obligation to comply.
Fix: Escalate to executive leadership to enforce supplier prioritization, or accept reality: build an Anticorruption Layer and switch to Conformist.

**★ Symptom: Upstream team deploys an API change that silently breaks downstream production services.**
Cause: Lack of consumer-driven contract tests in upstream's build pipeline.
Fix: Downstream delivers an automated contract test suite (e.g. Pact or Spring Cloud Contract) that executes during upstream's CI build, preventing breaking changes from merging.

**★ Symptom: Downstream customer attempts to dictate upstream's internal database tables and ORM classes.**
Cause: Customer overstepping the boundary.
Fix: The customer negotiates the *public wire contract* (DTOs and HTTP verbs), never the supplier's internal domain model or database schema.

**★ Symptom: the relationship is called Customer/Supplier and the downstream team is blocked every quarter anyway.**
Cause: the label was assigned from the org chart or from goodwill rather than from evidence. The
defining property — *"downstream priorities factor into upstream planning"* — was never true.
Fix: check the artefact rather than the sentiment, and relabel if it fails:
```bash
# The only evidence that matters: downstream-originated items in the upstream's backlog
gh issue list --repo org/upstream-service --label "requested-by:billing" --state all
```
An empty result means the relationship is Conformist. Relabelling it is not a defeat — it frees the
downstream team to build an ACL and stop waiting, which is a quarter of work they get back.

**★ Symptom: the customer starts specifying the supplier's internal design, and the supplier stops cooperating.**
Cause: leverage over the *contract* was extended into leverage over the *model*. The supplier is now
being told how to store its data, and reasonably resists.
Fix: the customer's requests stay on the outside of the boundary — fields, operations, guarantees,
notice periods. What is behind the contract is not the customer's to specify, and a customer that
crosses that line converts a supplier into an adversary who will start looking for reasons to say no.

**★ Symptom: Upstream builds five bespoke variations of the same endpoint for five different internal teams.**
Cause: Misapplying Customer-Supplier to a generalized shared service.
Fix: Refactor the API into an Open Host Service with a single, coherent Published Language.

## Interview questions

**★ What organizational prerequisites are required for a Customer-Supplier relationship to succeed?**
A Customer-Supplier relationship requires genuine downstream leverage backed by organizational authority, budget, or strategic alignment. The upstream team's performance metrics must include downstream satisfaction, and both teams must participate in joint backlog refinement and release planning. Without executive alignment, upstream will prioritize its own localized goals, leaving downstream stranded.

**★ How do consumer-driven contract tests enforce the Customer-Supplier dynamic?**
In consumer-driven contract testing, the downstream customer writes automated assertions defining the exact HTTP endpoints, request parameters, and response bodies it expects. These contract specifications are handed to the upstream supplier, who runs them in their CI pipeline. If an upstream developer commits a change that alters a field name or response structure expected by the customer, upstream's build fails before deployment.

**★ When should an upstream service refuse the Customer-Supplier pattern and adopt Open Host Service instead?**
When the upstream service moves from supporting one or two tightly aligned internal teams to supporting many diverse consumers across the enterprise. At that scale, attempting to negotiate individual customer contracts creates combinatorial complexity and fragmented APIs. Upstream must establish an Open Host Service—a standardized, public protocol that treats all consumers equally.

**★ How do you tell a genuine Customer/Supplier relationship from a Conformist one that people are describing generously?**
Look at the upstream's backlog, not at the relationship. The pattern's defining property is that
*"downstream priorities factor into upstream planning"*, so the evidence is downstream-originated
items appearing in the upstream's actual plan — and, in the mature version, downstream-authored
contract tests running in the upstream's build. If neither exists, the relationship is Conformist
however cordial it is. The distinction is not academic: a team that believes it is the customer
*waits* for a field to arrive and blocks on it, while a team that knows it is conformist builds
against what exists today. Mislabelling the edge costs the downstream team a quarter.

**★ What is a customer entitled to ask for, and what request signals the relationship is degrading?**
A customer may ask for fields, operations the upstream's domain can legitimately perform,
compatibility guarantees with notice periods, and a place in the upstream's contract test suite. Two
requests signal degradation. A **bespoke endpoint** — an interface that exists only for this one
consumer — turns one contract into N and hands the upstream's roadmap to its consumers, which is
precisely the failure Open Host Service solves. And a **veto over releases** is not customer
leverage at all; that is Partnership, which is a legitimate pattern with twice the coordination cost,
and it should be adopted deliberately rather than arrived at by escalation.

**★ What is the primary difference between Customer-Supplier and Partnership?**
In a Partnership, the relationship is symmetric: both teams have equal leverage, shared accountability, and mutual dependency; if either fails, both fail. In Customer-Supplier, the relationship is asymmetric: downstream acts as the client whose needs dictate upstream's delivery backlog, while upstream operates as a service provider fulfilling those requirements.

---

← [Context mapping](30-context-mapping.md) · [Topic index](README.md) · Next → [Conformist](32-conformist.md)
