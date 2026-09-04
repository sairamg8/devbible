---
title: "The one service, one capability test is the fastest boundary check there is, and it works because a capability is a verb — the moment you can only describe a service with a noun, it is a data store with an HTTP interface"
sidebar_label: "05 · One service, one capability"
sidebar_position: 8
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-01 against microservices.io *Decompose by business capability*
> ([microservices.io](https://microservices.io/patterns/decomposition/decompose-by-business-capability.html)),
> which defines a business capability as *"something that a business does in order to
> generate value"*, and *Service per team*
> ([microservices.io](https://microservices.io/patterns/decomposition/service-per-team.html)).
> Version spine: **JDK 25 · Spring Boot 4.1.1 / Framework 7.0.9 · Spring Cloud train
> 2025.1.x "Oakwood" (components 5.0.x) · Spring Modulith 2.1.1**.

**"One service, one capability" is the test people reach for when a design document lands
on their desk, and it is a good test — but only if you hold the definition of "capability"
strictly. microservices.io defines it as *"something that a business does in order to
generate value"*. That is a verb phrase. Order fulfilment. Price calculation. Credit
assessment. If the best description of your service is a noun — Customer, Order, Product —
you have not identified a capability, you have identified a table, and the test has just
told you the answer you did not want.**

## The test, stated so it can fail

Complete this sentence about the service, out loud, without using "and":

> This service exists so that the business can ______.

Good completions: *take an order*, *decide what a customer pays*, *know where stock is*,
*get a parcel to a door*, *collect money*, *answer a customer's question*.

Failing completions, with what each one is actually telling you:

| Completion | What it means |
|---|---|
| "…store customer data" | Storage is not a capability. This is an entity service — [13 · Entity services](13-entity-services.md). |
| "…manage orders" | "Manage" is a verb with no content. Which decisions does it make? |
| "…expose an API for products" | The boundary is a transport layer, not a capability. |
| "…take an order **and** send confirmation emails" | Two capabilities, and the second is generic. |
| "…handle all Kafka messages" | Split by technology — [12 · Splitting by layer](12-splitting-by-layer.md). |
| "…provide data to the mobile app" | Split by client. That is a gateway or a backend-for-frontend, and it should own no business rules. |

The "and" clause is the highest-yield part of the test. Almost every over-scoped service in
the wild announces itself with an "and" in its own README.

## Why the verb matters more than it sounds

A capability is a verb because verbs come with **decisions**, and decisions come with
**rules**, and rules are what you can own. A noun comes with fields, and fields are what
everybody wants a piece of.

Follow the consequence through. If your boundary is `Order` (noun), then the questions
"can this order be cancelled", "what does this order cost", "when will this order arrive"
and "has this order been paid for" all appear to belong to it, because they are all about
orders. Four different departments' rules end up inside one service, and each of them
changes on a different schedule. That is the Common Closure Principle violated four ways.

If your boundary is *take an order* (verb), then only the rules about accepting a
commitment live there — is the customer allowed to buy this, is the basket valid, what did
they agree to. "What does it cost" belongs to *decide what a customer pays*, "when will it
arrive" belongs to *get a parcel to a door*, and "has it been paid" belongs to *collect
money*. The `Order` data ends up distributed across those capabilities, each holding the
part it makes decisions about — which sounds alarming until you notice that each part
changes for its own reason, which is the entire objective.

## The first place the test lies: it does not tell you the granularity

"One capability" does not say how big a capability is. *Get a parcel to a door* is a
capability. So is *choose a carrier*, which is inside it. So is *sell things*, which
contains it. The test filters out incoherent services; it does not choose a level.

The level is chosen by the things the test cannot see:

- How many teams you have (`Service per team`: ideally one service per team).
- Which aggregates must be transactionally consistent — [09 · The transaction
  boundary](09-the-transaction-boundary.md).
- Which parts change together — [19 · Change history as
  evidence](19-change-history-as-evidence.md).
- The ten forces — [22 · The ten forces](22-the-ten-forces.md).

So the test is a **filter, not a selector**. It rejects bad candidates cheaply. It does not
produce the right answer on its own, and a design review that uses it as the only criterion
will approve an eleven-service architecture for a twelve-person company.

## The second place the test lies: capabilities nest, and the nesting is not neutral

Business capability maps are hierarchical. A retailer's map might have *Sell* containing
*Merchandise*, *Price*, *Take orders*; and *Deliver* containing *Allocate stock*, *Pick and
pack*, *Ship*, *Handle returns*. Every node in that tree passes "one service, one
capability".

What breaks ties between levels is where the **invariants** sit. *Allocate stock* and *Pick
and pack* share an invariant — you cannot pick what was not allocated, and the allocation
must not be double-spent — so putting them in separate services converts an ACID check into
a distributed workflow. That is a real cost, and it argues for one service at the *Deliver*
level rather than four at the leaf level. Meanwhile *Price* shares no invariant with *Take
orders*: the order records the price it was quoted, and pricing changing later does not
invalidate anything. That pair separates cleanly.

**This is the practical order of operations: use the capability test to generate candidates,
then let the invariants choose the level.** Chunks [09](06-invariants-are-the-criterion.md)
through [13](09-the-transaction-boundary.md) are that second step.

## What it looks like when a service passes

```java
package com.retailer.pricing;

/// Capability: decide what a customer pays.
/// Every method on this interface is a decision, not a data access.
public interface PricingService {

    /// The whole point of the boundary: this is the only place in the company
    /// that can answer this question, and it answers it the same way every time.
    QuotedPrice quote(PriceQuery query);

    /// A second decision in the same capability: whether a promotion applies.
    PromotionOutcome evaluate(PromotionCode code, Basket basket, CustomerSegment segment);
}
```

Contrast with a service that fails, written the way it usually appears:

```java
package com.retailer.product;

/// Capability: ...store products? This interface makes no decisions at all.
/// Every caller must know the pricing rules in order to use the data it returns.
public interface ProductService {

    ProductDto findById(String id);

    List<ProductDto> findAll(Pageable pageable);

    ProductDto create(CreateProductRequest request);

    ProductDto update(String id, UpdateProductRequest request);

    void delete(String id);
}
```

The second interface is a table with HTTP in front of it. The tell is that no method encodes
a rule: every caller receives fields and decides for itself what they mean, which means the
rules live in the callers, which means the rules are duplicated across the callers, which
means a rule change is an N-service release. [13b · CRUD is not a
capability](13b-crud-is-not-a-capability.md) develops this.

## The variant worth knowing: "one service, one reason to change"

The Single Responsibility Principle's better formulation — one reason to change, where a
"reason" is a *person or role who requests changes* — transfers to services almost
unaltered, and it is sometimes sharper than the capability test because it names the
requester.

Ask: **who asks this service to change?** If the answer is "the merchandising team, the
finance team and the warehouse manager", you have three reasons to change in one deployable,
and three groups queueing behind each other's releases. That queue is the cost, and it is
observable in your ticket tracker before it is observable in your architecture.

## Gotchas

**★ Symptom: a service README whose first sentence contains "and".** Cause: two
capabilities. Fix: split, or — more often — move the second one to where it belongs, which
is usually an existing service that already owns that capability partially.

**★ "Management" as a capability.** `OrderManagementService`, `UserManagementService`.
"Management" is what you write when you cannot name the decision. Ask which decisions the
service makes; if the honest answer is create, read, update and delete, it is an entity
service.

**★ Passing the test with a noun by adding a verb prefix.** Renaming `CustomerService` to
`CustomerManagementService` or `ManageCustomersService` changes nothing. The test is about
the behaviour, and the check is whether the API's methods encode rules or expose fields.

**★ Using the test to justify the level you already chose.** Because capabilities nest,
every proposed decomposition passes at some level. If the test is being used to defend an
existing design rather than to reject candidates, it is doing no work. Make it falsifiable
by asking for the invariants that would be split at that level.

**★ Treating a backend-for-frontend as a capability.** A BFF exists to shape data for one
client. That is a legitimate component and it belongs to the gateway/edge discussion in
**07 · API gateway** *(not written yet)* — but it is not a capability and must own no
business rules, or the rules now depend on which client asked.

**★ Symptom: three teams file changes against one service.** Cause: several reasons to
change. Fix: this is the "one reason to change" test failing, and it is usually a stronger
and earlier signal than anything in the code. Look at who authored the last hundred commits
before you look at the class diagram.

## Interview questions

**★ What is the "one service, one capability" test and where does it break down?**
It asks you to complete "this service exists so that the business can ______" without using
"and", where the blank must be a verb phrase — something the business does to generate
value. It is excellent at rejecting bad candidates: entity services, layer splits, and
services scoped by client all fail it immediately. It breaks down on granularity, because
business capabilities nest, so nearly any decomposition passes at some level of the
hierarchy. It tells you a candidate is coherent; it does not tell you it is the right size.
For size you need the invariants, the team count and the change rates.

**★ Why insist that a capability is a verb?**
Because verbs carry decisions and decisions carry rules, and rules are the thing a service
can meaningfully own. A noun carries fields, and fields attract every department that wants
one, so a noun-shaped service accumulates several departments' rules on several schedules.
The `Order` service ends up answering questions about cancellation policy, pricing, delivery
promises and payment status, which are four capabilities owned by four groups. The verb test
makes that visible on day one instead of in year two.

**★ A service is described as "Customer Management". Is that necessarily wrong?**
It is a strong signal but not proof, and the way to settle it is to look at the API. If the
methods are `create`, `find`, `update`, `delete` and the callers apply their own rules to
the returned fields, it is an entity service and the rules are duplicated in every caller.
If instead the methods are `register`, `verifyIdentity`, `closeAccount`, `mergeDuplicate` —
each of which enforces a policy nobody else can override — then the service owns a real
capability and it is simply named badly. Rename it after the decisions it makes.

**★ How do you use the capability test together with the invariant test?**
The capability test generates candidates and rejects incoherent ones; the invariant test
chooses the level. Concretely: list the capabilities at a few levels of the hierarchy, then
for each candidate boundary ask which business rules would now span it and would therefore
need a distributed workflow instead of a transaction. A boundary that splits an invariant
costs you compensation logic forever; a boundary that does not is nearly free. Pick the
finest level that does not split an invariant, then coarsen it further if you do not have
enough teams to own the pieces.

**★ What is the "one reason to change" version of the test, and when is it more useful?**
It asks who requests changes to this service — which role or department — and treats more
than one requester as a boundary problem. It is more useful than the capability test in a
legacy system, because you can answer it from the ticket tracker and the commit log without
understanding the domain first. Three departments filing tickets against one service means
three roadmaps queueing behind one release process, and that queue is a measurable cost you
can put in front of people who do not care about domain modelling.

---

← [A service is not a context](04-a-service-is-not-a-context.md) · [Topic index](README.md) · Next → [Invariants are the criterion](06-invariants-are-the-criterion.md)
