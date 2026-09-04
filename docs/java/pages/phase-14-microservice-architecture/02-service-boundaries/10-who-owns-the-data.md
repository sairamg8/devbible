---
title: "Ownership of a piece of data belongs to whoever enforces the rules about it, not to whoever created it, stores it, or reads it most — and once you apply that test, most disputed data turns out to have an obvious owner nobody had named"
sidebar_label: "10 · Who owns the data"
sidebar_position: 16
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-01 against Vaughn Vernon, *Effective Aggregate Design, Part II: Making
> Aggregates Work Together* (2011), rule *"Reference Other Aggregates By Identity"*
> ([dddcommunity.org](https://www.dddcommunity.org/library/vernon_2011/), CC BY-ND 3.0);
> microservices.io *Database per Service*
> ([microservices.io](https://microservices.io/patterns/data/database-per-service.html)) and
> *Aggregate* ([microservices.io](https://microservices.io/patterns/data/aggregate.html)).
> Version spine: **JDK 25 · Spring Boot 4.1.1 / Framework 7.0.9 · Spring Cloud train
> 2025.1.x "Oakwood" (components 5.0.x) · Spring Modulith 2.1.1**.

**"Who owns the customer record" is the argument that consumes the most time in a
decomposition and it is almost always the wrong question, because it is asked about a
*record* rather than about *facts*. Nobody owns the customer. Somebody owns their credit
limit, somebody else owns their delivery address preferences, somebody else owns their
marketing consent, and those may be three different somebodies. The test that resolves it is
short: the owner of a fact is whoever can reject a change to it. Everyone else is a reader,
and readers do not need ownership — they need a copy and a contract.**

## The test

For each field, ask: **is there a rule that can refuse a change to this value, and who
enforces it?**

| Fact | Rule that can refuse a change | Owner |
|---|---|---|
| Customer's email address | Must be unique and verified before use | Identity |
| Customer's credit limit | Set by credit policy, refused above a risk threshold | Credit / Finance |
| Customer's marketing consent | Must record lawful basis and timestamp | Consent / Privacy |
| Customer's default delivery address | Must be a deliverable address for a served region | Fulfilment |
| Customer's display name | None — free text | Identity, by default |
| Product's price | Must be within margin floor, effective-dated, one active per channel | Pricing |
| Product's description | Must be approved before publication | Catalogue |
| Stock on hand at a warehouse | Must never go below reservations | Inventory |

Read that table and notice what happened: the "customer record" split into four owners, and
the argument about which service owns customers dissolved, because it was never one thing.

Facts with no rule attached are the easy ones and they follow the mass — put them wherever
most of the constrained facts already are.

## Why "whoever created it" is the wrong test

The registration form creates the customer record, so Sales must own customers. This
reasoning is intuitive and wrong for a specific reason: creation is a single event and
ownership is a permanent obligation. The credit limit is created empty and set by Finance
three days later, according to Finance's rules, and Finance is the party that will be asked
why it is wrong. Ownership follows the rule, not the `INSERT`.

The same argument disposes of "whoever reads it most". The reporting service reads
everything and owns nothing. High read volume argues for a replica or a read model — the
data-side question that belongs to **03 · Database-per-service** *(not written yet)* — and
never for ownership.

## Reference by identity is what makes single ownership survivable

Once a fact has one owner, everyone else holds a reference. Vernon's rule is the mechanism:

> *"Reference Other Aggregates By Identity"*

And the reason it scales beyond a single process is stated in the same essay:

> *"Since there are always multiple bounded contexts at play in a given core domain
> initiative, reference by identity allows distributed domain models to have associations
> from afar. When an event-driven approach is in use, message-based domain events containing
> aggregate identities are sent around the enterprise."*

Which is exactly what a service boundary needs. The identifier is the only thing that
crosses; everything else is a copy with a known staleness or a request.

```java
package com.retailer.fulfilment;

/// Fulfilment does not own the customer and does not hold Identity's Customer type.
/// It holds the identifier, plus the small number of facts it has been given and is
/// allowed to act on, with the time they were true.
public record DeliveryProfile(
        CustomerId customer,
        Address deliverTo,
        DeliveryPreference preference,
        java.time.Instant asOf) {

    /// A copy carries its age. A consumer that cannot state how stale its data may be
    /// has not modelled the boundary, it has ignored it.
    public boolean isStale(java.time.Duration tolerance, java.time.Clock clock) {
        return asOf.isBefore(clock.instant().minus(tolerance));
    }
}
```

## The three legitimate relationships to data you do not own

Naming these three, and forbidding everything else, removes most of the ambiguity from a
decomposition:

**1. Reference.** You hold the identifier. You can name the thing, correlate on it, and pass
it back to the owner. You cannot answer any question about it. Cheapest, and the default.

**2. Replica.** You hold a copy of specific facts, updated by events from the owner, with a
known staleness bound. You can answer questions about those facts, with a caveat. You can
never write them. microservices.io names this shape as the *Command-side replica* pattern
when the copy exists to serve a write-side decision.

**3. Query.** You ask the owner at the moment you need the answer. Always current, and it
buys that with a runtime dependency — availability multiplication and latency, which is
topic 04's argument. Correct when the answer must be fresh and the caller can fail if the
owner is down.

Anything else — reading the owner's tables, writing the owner's fields, holding a copy with
no update mechanism — is not a relationship, it is the absence of a boundary.

## Ownership is not exclusivity of knowledge

A frequent overcorrection: "Inventory owns stock, so nobody else may know about stock". That
makes every product page a synchronous call to Inventory, which is a runtime coupling
disaster and rarely necessary.

Owning a fact means owning the **rules** about it. Others may hold copies for display, for
filtering, for approximate decisions. The line is whether the copy is used to make a
decision the owner would need to validate. Showing "only 3 left!" from a replica is fine and
the number can be wrong. Deciding that a reservation succeeds from a replica is not fine,
because that is the invariant, and the invariant belongs to the owner.

The rule in one sentence: **replicas can inform, they cannot decide.**

## The awkward case: a fact with two rules

Occasionally two contexts each have a genuine rule about the same field. An order's delivery
address must be a deliverable address (Fulfilment's rule) and must match the address on the
payment instrument for high-value orders (Fraud's rule).

That is not shared ownership, and treating it as such produces a field two services both
write. It is two rules applied at different times to two different things:

- The **customer's address book** is owned by one context, with the deliverability rule.
- The **address recorded on an order** is a value copied at order time, owned by Sales,
  immutable thereafter.
- Fraud's rule is not a rule about the address at all — it is a rule about whether the
  *order* may proceed, evaluated once, owned by Fraud, and expressed as an approval on the
  order.

Almost every apparent shared-ownership case resolves this way when you separate "the current
value of a fact" from "a value recorded at a moment" from "a decision made about a value".
If it does not resolve, the two contexts probably should be one.

## Gotchas

**★ Symptom: two services both write the same column.** Cause: no owner was named, or a
fact with two rules was not decomposed. Fix: name the owner, and turn the other writer into
a request the owner can refuse. If the second writer cannot be refused, it is the owner and
the first one is not.

**★ Symptom: a service that owns a fact learns about changes to it from a third party.**
Cause: an update path that bypasses the owner — usually an admin tool or a data-fix script
writing directly to the database. Fix: the owner's API is the only write path, including for
admin tools; a back-office screen that writes another service's tables is the same violation
in nicer clothing.

**★ Deciding on a replica.** A replica used to enforce an invariant is an invariant that is
not enforced. Showing an approximate stock count is fine; accepting an order because the
replica said there was stock is oversell with extra steps.

**★ Symptom: a replica with no `asOf` and no update mechanism.** Cause: a one-off copy made
during a migration that became permanent. Fix: every replicated fact carries the time it was
true and a named update path; if you cannot name the update path, you have a fork, not a
replica.

**★ Assigning ownership by data volume.** "Orders is the biggest table so Orders owns
everything about the order" is storage reasoning. The delivery promise on an order is
Fulfilment's rule even though it is a column on the orders table.

**★ Symptom: an argument about the customer record that never ends.** Cause: the question
was asked about a record. Fix: enumerate the facts and their rules. In practice the argument
ends within an hour once the table above is on the wall, because most rows have an
uncontroversial owner and only two or three are genuinely contested.

**★ Confusing ownership with the system of record for compliance.** A regulator may require
a specific system to be the authoritative record for retention or audit. That is a
constraint on where data is durably kept, and it does not automatically make that system the
owner of the rules — a data warehouse can be the system of record and own no business rule
at all.

## Interview questions

**★ Which service should own the customer data?**
The question is malformed and saying so is the answer. "The customer" is not one fact; it is
a bundle — identity credentials, credit limit, marketing consent, delivery preferences,
support history — each governed by a different rule, enforced by a different team. The
owner of a fact is whoever can refuse a change to it. Once you enumerate the facts and their
rules, ownership usually falls out uncontroversially, and the residual disputes are two or
three genuinely ambiguous fields rather than an argument about a whole entity.

**★ What are the acceptable ways for a service to use data it does not own?**
Three. Hold a reference — just the identifier, enough to correlate and to hand back to the
owner. Hold a replica of specific facts, updated by the owner's events, carrying an explicit
staleness, and used only to inform, never to decide. Or query the owner at the moment of
need, accepting a runtime dependency in exchange for freshness. Anything else — reading the
owner's tables, writing the owner's fields, or holding a copy with no update path — is not a
relationship with the owner, it is the absence of a boundary.

**★ Why is "informs" versus "decides" the line for replicas rather than "read" versus
"write"?**
Because a read can be as damaging as a write when it is the input to an invariant. If
Inventory owns the rule that available stock never goes negative, and Sales accepts an order
based on a replicated stock count, then Sales has enforced Inventory's invariant against
stale data — the write happens in Inventory's ledger later, and by then the guarantee is
gone. Displaying the same number on a product page is harmless because nothing depends on
it. The test is whether an operation is accepted or refused on the strength of the copy.

**★ Two teams each insist they own the same field. How do you resolve it?**
Separate three things that are usually conflated: the current value of a fact, a value
recorded at a moment in time, and a decision made about a value. Almost every dispute is two
of those wearing one name. The customer's address book entry is one owner's; the address
copied onto an order at order time is Sales', immutable; and the fraud team's concern is not
the address at all but whether the order may proceed, which is a decision they own and
express as an approval. If after that decomposition two rules genuinely apply to the same
mutable value at the same time, the two contexts are probably one context and should be
merged.

**★ Does ownership mean nobody else may know the data?**
No, and that overcorrection is expensive — it turns every page render into a synchronous
call and multiplies your availability failures. Ownership means owning the *rules*. Others
may hold copies for display, for filtering, for approximate decisions, provided the copies
carry their staleness and are never used to enforce the owner's invariants. The practical
formulation is that replicas inform and only the owner decides.

---

← [Finding it in the code](09b-finding-it-in-the-code.md) · [Topic index](README.md) · Next → [The ownership register](10b-the-ownership-register.md)
