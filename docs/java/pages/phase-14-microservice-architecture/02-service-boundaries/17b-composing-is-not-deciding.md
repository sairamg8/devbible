---
title: "Every system has a component that calls several services, so the god service cannot be identified by counting its dependencies — the line is whether it assembles other services' answers or makes a decision of its own, and one deletion test separates them"
sidebar_label: "17b · Composing is not deciding"
sidebar_position: 32
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-04 against microservices.io — *API Composition*
> ([microservices.io](https://microservices.io/patterns/data/api-composition.html)) and the dark
> energy / dark matter force descriptions
> ([microservices.io](https://microservices.io/post/architecture/2023/03/26/dark-energy-dark-matter-force-descriptions.html)).
> Version spine: **JDK 25 · Spring Boot 4.1.1 / Framework 7.0.9 · Spring Cloud train 2025.1.x "Oakwood" (components 5.0.x) · Spring Modulith 2.1.1**. Documentation-validated; **no sandbox run**.

**[17 · The god service](17-the-god-service.md) describes a component that has absorbed other teams' rules, and the fair objection to it is that plenty of legitimate components call several services — a backend-for-frontend, an API composition layer, a report builder. If "calls many services" were the diagnostic, half of every microservice architecture would be an antipattern. It is not the diagnostic. The line is whether the component **assembles** answers other services decided, or **decides** something itself, and there is a single question that separates them reliably: if this component were deleted, would any business rule stop being enforced? A composition layer's deletion costs you an endpoint. A god service's deletion costs you the rules — which is also why you cannot fix one by deleting it.**

## Composing is not deciding, and only one of them is the antipattern

The strongest objection to this chunk is a fair one: *"every system has something that calls several
services — is a BFF a god service?"* No, and the distinction is precise enough to apply in a review.

| | **Composition** — legitimate | **Orchestration with rules** — the god service |
|---|---|---|
| What it does | Reads from several services and assembles a response | Reads several services, **decides**, and tells them what to do |
| Where the rules are | In the services it reads from | 🔴 In the orchestrator |
| What it owns | Nothing. Delete it and no rule is lost | The rules — delete it and the system stops enforcing things |
| Failure mode | A degraded response | An inconsistent system |
| The test | Can it return a partial answer? | Can it be wrong about a business rule? |

🔴 **The single question that separates them:** *if this component were deleted, would any business
rule stop being enforced?* A composition layer deleted costs you a convenient endpoint. A god service
deleted costs you the rules, which is why removing one requires
[the correction in 17](17-the-god-service.md#the-correction) rather than a delete.

**Composition also has a boundary obligation of its own**, and it is where BFFs go wrong: it may
**assemble**, and it may not **interpret**. The moment the composition layer computes a total,
decides eligibility, or applies a discount, it has started holding rules and is on its way to being
the thing this chunk is about.

```java
// Composition: assembles, decides nothing. Deleting it loses an endpoint, not a rule.
CheckoutView view(UUID orderId) {
    return new CheckoutView(
        orders.summary(orderId),            // order service decided the total
        payments.status(orderId),           // payment service decided the status
        shipping.estimate(orderId));        // shipping service decided the date
}

// God service: reads state, applies a rule that belongs to Orders, writes back.
void maybeCancel(UUID orderId) {
    var order = orders.get(orderId);
    var payment = payments.get(orderId);
    if (payment.status() == FAILED && order.age().toHours() > 24) {   // 🔴 whose rule is this?
        orders.setStatus(orderId, CANCELLED);
    }
}
```

## The arithmetic that makes it fragile as well as wrong

A god service is on the common path by construction, and it calls several services synchronously to
do its job. That composes availability multiplicatively rather than taking the minimum: an operation
that requires five services to answer is available only when all five are, so each service's
individual excellence is beside the point.

**Two consequences worth stating separately from the design argument:**

- **Its dashboards will look fine.** Every dependency meets its SLO; the operation does not. This is
  the same measurement failure as [13 · Entity services](13-entity-services.md), and it produces the
  same complaint — everything green, customers unhappy.
- **Retries make it worse, not better.** A god service retrying a slow dependency holds its own
  request open, consuming its own threads, while the dependency is already struggling — the load
  amplification lands on whichever service is least healthy.

⚠️ **Do not read this as "add a circuit breaker".** A circuit breaker makes the fragility survivable
and permanent, which is exactly the pattern [37 · The tells of a wrong boundary](37-the-tells-of-a-wrong-boundary.md)
warns about: the remedy works, removes the pain, and capitalises the wrong boundary.

## Gotchas

**★ Symptom: a BFF that started as composition and now computes eligibility.**
Cause: composition drifted into interpretation. Assembling several services' answers is legitimate;
deciding something from them is a rule, and rules belong to whoever owns the data they are about.
Fix: apply the deletion test — if this component vanished, would a business rule stop being enforced?
Move any rule that answers yes back to the service that owns its data, and leave the layer assembling:
```java
// before: the BFF decides
boolean eligible = order.total().compareTo(THRESHOLD) > 0 && customer.tier() == GOLD;

// after: the service that owns the rule decides, the BFF reports
boolean eligible = promotions.eligibility(orderId).eligible();
```

**★ Symptom: an orchestrator whose dependencies all meet their SLOs while the operation it serves does not.**
Cause: availability composes multiplicatively along a synchronous chain, and per-service dashboards
measure services rather than operations.
Fix: put the SLO on the operation, spanning every service it touches, so the coupling is visible where
people look during an incident rather than only in a design document.

**★ Assuming a "saga" is not a god service.** It can be. A saga that reads participants' data
and makes decisions about it has all three defects; a saga that invokes operations which
decide for themselves, and holds only its own workflow state, does not.

## Interview questions

**★ Is a backend-for-frontend or an API composition layer a god service?**
No, provided it composes rather than decides, and the boundary between those is sharp enough to apply
in review. A composition layer reads from several services and assembles a response; every decision in
that response was made by the service that owns the relevant data. A god service reads from several
services, **applies a rule of its own**, and tells them what to do. The test is a deletion test: if
this component vanished, would any business rule stop being enforced? For a composition layer the
answer is no — you lose a convenient endpoint. For a god service the answer is yes, which is precisely
why you cannot simply delete one. The failure mode differs too: a composition layer that loses a
dependency returns a degraded response, while a god service that fails leaves the system inconsistent.

**★ Beyond holding other teams' rules, why is a god service operationally fragile?**
Because it sits on the common path and calls several services synchronously, so the availability of
the operation is the product of its dependencies rather than the minimum. Five dependencies at high
individual availability compose to something noticeably worse, and none of the per-service dashboards
shows it — every dependency meets its SLO while the operation does not, which produces the "everything
is green and the site is broken" complaint. Retries make it worse rather than better, because the
orchestrator holds its own request open and amplifies load onto whichever dependency is already
struggling. The important thing is what *not* to conclude: adding a circuit breaker makes the
fragility survivable and therefore permanent, which capitalises the wrong boundary instead of fixing
it.

**★ Can a saga be a god service?**
Yes, and it is the most common modern form. If the saga fetches participants' data and applies
business rules to it, it has all three defects wearing the name of a pattern. A saga that is
not a god service holds only its own workflow state — which step, which attempt, what
compensation is outstanding — and invokes participant operations that enforce their own rules
and can refuse. The distinction is not the technology or the framework; it is where the
decision is made.

---

← [The god service](17-the-god-service.md) · [Topic index](README.md) · Next → [Boundaries from a whiteboard](18-boundaries-from-a-whiteboard.md)
