---
title: "Half the rules that look like invariants are constraints nobody in the business ever asked for, and every one of them glues together state that could have been split — the false invariant is how a boundary gets refused for a reason that does not exist"
sidebar_label: "11 · False invariants"
sidebar_position: 11
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-01 against Vaughn Vernon, *Effective Aggregate Design, Part I* (2011)
> ([dddcommunity.org](https://www.dddcommunity.org/library/vernon_2011/), CC BY-ND 3.0),
> whose worked example turns on an aggregate *"designed with false invariants in mind, not
> real business rules"*; Eric Evans, *Domain-Driven Design* (2003), Ch. 6, cited by concept.
> Version spine: **JDK 25 · Spring Boot 4.1.0 / Framework 7.0.8 · Spring Cloud train
> 2025.1.x "Oakwood" (components 5.0.x) · Spring Modulith 2.1.1**.

**The invariant is the only binding boundary criterion, which makes a fake one the most
expensive mistake in the analysis: it blocks a split that was available, it inflates an
aggregate until it cannot be loaded efficiently, and it produces transaction contention that
looks like a scaling problem and is actually a modelling problem. Vernon's whole Part I is
built around a team that did exactly this. Learning to recognise the shapes is worth more
than learning to enumerate the real ones.**

## Vernon's example, because it is the archetype

The team modelled `Product` as a large cluster aggregate containing all of its
`BacklogItem`s, `Release`s and `Sprint`s. Adding any one of them meant loading and version-
checking the whole `Product`, so simultaneous users collided constantly. Vernon's diagnosis:

> *"the aggregate was designed with false invariants in mind, not real business rules. These
> false invariants are artificial constraints"*

The specific false invariant was compositional: it *felt* as though a backlog item belonged
inside a product and therefore had to be consistent with it. But as he then observes:

> *"There is no invariant on the total number of created BacklogItem, Release, or Sprint
> instances"*

Nothing in the business required the count, the set or the collection to be atomically
correct. The constraint came from the object graph, not from a rule. His conclusion is the
line worth memorising:

> *"aggregates are chiefly about consistency boundaries and not driven by a desire to design
> object graphs"*

Every false invariant is some version of that: a graph relationship mistaken for a rule.

## The seven shapes, and how to test each one

### 1. The containment illusion

*"An order line belongs to an order, so they must be consistent."* Belonging is not a rule.
The test: state what would be *wrong* if they were briefly inconsistent. For order lines the
answer is real (the total would not match), so this one survives. For *"a customer's orders
belong to the customer"* the answer is nothing at all — a customer whose order list is two
seconds stale harms nobody — and that "invariant" is what makes `Customer` an aggregate
containing every order the person ever placed.

### 2. The derived total

*"A customer's lifetime value must equal the sum of their paid orders."* This is arithmetic
over a set, not a constraint on a transition. Nobody makes a decision that breaks if it is
computed a minute late. Derived values across aggregates are the single most common false
invariant, and they are all fixed the same way: compute it, do not store it as a
transactionally maintained field. If it must be stored for query performance, that is a read
model, which belongs to **03 · Database-per-service** *(not written yet)*.

**Test:** does anything *reject an operation* based on this value? If a credit limit check
reads it, it may be real. If only a dashboard reads it, it is not.

### 3. The reporting requirement

*"Finance's month-end report must be consistent."* Consistent *when*? At month end. That is a
batch requirement with a twenty-day window and it imposes no constraint on a transaction
boundary whatsoever. Reporting requirements dressed as invariants pull the entire schema
into one consistency boundary if you let them.

### 4. The audit reflex

*"Every change must be recorded in the audit log atomically with the change."* Sometimes
genuinely required by regulation, usually not. The honest version is "no change may be
lost", which is a durability requirement solved by an outbox or an event log, not a
consistency requirement that forces the audit store into the aggregate.

### 5. The uniqueness that is actually a preference

*"A customer may only have one active cart."* Ask what happens if they briefly have two. In
most retailers: nothing, and the UI picks the most recent. Compare with *"a promotion code
may be redeemed at most 100 times"*, where the second one is real money and a race means
you gave away stock you did not have. Same shape, opposite answers, and only the domain can
tell you which is which.

### 6. The referential comfort blanket

*"An order line must reference a product that exists."* It must reference an identifier that
*was* valid. If the product is later deleted, the order line is still correct — it records
history. Treating this as an invariant is what makes people believe catalogue and orders
cannot be separated, when in fact they separate more cleanly than almost anything else in a
retailer.

### 7. The invariant inherited from the UI

*"The screen shows the order and its shipment together, so they must be consistent."* A
screen is a query. If the two are a second apart the screen shows a second-old shipment
status, which is what every tracking page in the world already does. UI composition is not a
consistency requirement — it is the API composition problem, again **03 ·
Database-per-service** *(not written yet)*.

## The two questions that kill a false invariant

Applied to any candidate rule, in this order:

**Q1 — Does any operation *reject* something because of this rule?**
An invariant constrains transitions. If no code path anywhere refuses an action because this
value would become wrong, the rule is descriptive, not prescriptive, and it constrains
nothing.

**Q2 — If it were false for ten seconds, who is harmed and how?**
Name a person and an outcome. "The report would be wrong" is not harm; the report is run
tomorrow. "A customer buys an item we do not have and we have to cancel and apologise" is
harm. If you cannot name a person, you have a preference.

A candidate that survives both is real. In practice a first-pass invariant list loses most
of its rows here, and the survivors are a small, stable set that genuinely determines the
architecture.

## The cost, made concrete

```java
/// FALSE INVARIANT: Customer is treated as the consistency boundary for its orders.
/// Nothing in the business requires it. What it produces:
///   - every order placement loads the customer and all prior orders
///   - two concurrent orders from the same customer collide on the version column
///   - the customer aggregate grows without bound over a customer's lifetime
///   - orders and customers can never be separated, because they share a lock
@Entity
public class Customer {

    @Id private CustomerId id;

    @OneToMany(mappedBy = "customer", cascade = CascadeType.ALL, fetch = FetchType.LAZY)
    private List<Order> orders = new ArrayList<>();

    @Version private long version;      // now contended by every order the customer places

    public Order placeOrder(Basket basket) {
        var order = new Order(this, basket);
        orders.add(order);
        return order;
    }
}
```

```java
/// CORRECTED: two aggregates, joined by identity. Vernon's rule "Reference Other
/// Aggregates By Identity" applied. Nothing was lost, because there was no invariant.
@Entity
public class Order {

    @Id private OrderId id;

    /// An identifier, not an association. Orders no longer contend on the customer.
    @Embedded private CustomerId placedBy;

    @ElementCollection private List<OrderLine> lines = new ArrayList<>();

    @Version private long version;
}
```

The corrected version is not merely tidier. It is the difference between a boundary being
available and a boundary being impossible: with the first model, moving orders into their
own service means breaking a lock that is enforcing nothing, and someone will correctly
point out that you are removing a consistency guarantee — which is true, and irrelevant,
because the guarantee was never required.

## Where false invariants come from

- **ORM defaults.** A `@OneToMany` with cascade and a shared version column creates a
  consistency boundary by accident. The mapping was chosen for convenience of loading.
- **Object-oriented instinct.** Composition in the model is read as consistency in the
  database. Vernon's "not driven by a desire to design object graphs" is aimed exactly here.
- **Defensive engineering.** "Better safe" applied to a rule nobody stated, which is how a
  `SERIALIZABLE` isolation level appears in a service that reads product names.
- **Screens.** A form that edits three things at once implies three things must save
  together. Usually the form is wrong, and it can be three saves.
- **A past incident.** Something went wrong once, the fix was a bigger transaction, and the
  transaction is now load-bearing folklore. Read the incident: often the real cause was a
  missing idempotency key, not a missing lock.

## Gotchas

**★ Symptom: version-conflict retries on a "parent" entity under load.** Cause: a false
containment invariant — children are being added through the parent, so every child write
contends on the parent's version. Fix: make the child its own aggregate and reference the
parent by identity, as in the corrected code above.

**★ Symptom: an aggregate that gets slower every year for the same operation.** Cause: an
unbounded collection inside a consistency boundary. Fix: the collection is not part of the
invariant — nothing is checked across all its members — so it is a separate aggregate with
an identity reference and a query.

**★ Deleting a real invariant while pruning false ones.** The pruning is aggressive by
design, so protect against over-pruning by requiring Q1's answer to be checked in code, not
from memory: find the code path that rejects the operation. If it exists, keep the rule even
if nobody can articulate the harm.

**★ Symptom: "we cannot split these, they must be consistent" with no example.** Cause:
usually a false invariant defended by instinct. Fix: ask for one concrete scenario in which
a ten-second lag causes a named person a named problem. The absence of an answer is the
answer.

**★ Treating a false invariant as harmless because it never fires.** It is not harmless.
It costs contention under load, it costs aggregate size, and — the reason it is in this
topic — it costs you a boundary, because removing it later looks like removing a safety
guarantee and will be resisted.

**★ Converting a false invariant into an event-driven workflow.** If the rule was not real,
you do not need eventual consistency for it either — you need to compute it on read or
delete it. Building a saga to maintain a value nobody checks is the worst of both designs.

## Interview questions

**★ What is a false invariant and why is it more dangerous than a missing one?**
It is a constraint the code enforces that the business never required — usually a graph
relationship or a derived total that got mistaken for a rule. It is more dangerous than a
missing invariant because a missing invariant announces itself as a defect, while a false
one announces itself as safety. It quietly enlarges aggregates, creates lock contention that
gets misdiagnosed as a scaling problem, and — most relevant here — makes a legitimate service
boundary look like it would break consistency, so the split gets refused for a reason that
does not exist.

**★ Give me two rules that look identical and are not.**
"A customer may have only one active cart" and "a promotion code may be redeemed at most 100
times". Both are uniqueness or counting rules over a set. The first is a preference: if a
race produces two carts, the UI shows the most recent and nobody is harmed, so it does not
constrain a boundary. The second is real: a race gives away stock or margin you do not have,
and there is a named victim — the business — so the promotion and its redemptions are one
consistency boundary and cannot be split across services. The shape of the rule tells you
nothing; only the consequence of violating it does.

**★ How do you test a candidate invariant in a design review?**
Two questions. First: does any operation reject something because of this rule? An invariant
constrains transitions, so if no code path refuses an action to preserve it, it is
descriptive rather than prescriptive. Second: if it were false for ten seconds, name the
person harmed and the harm. "A report would be wrong" fails, because the report runs
tomorrow. "A customer is told they bought something we do not have" passes. Both questions
are answerable in the meeting, which is the point.

**★ You inherit a design where every write goes through one root entity and there is heavy
lock contention. What is your diagnosis?**
Almost certainly a false containment invariant, expressed as an ORM mapping. Children are
added through the parent, so the parent's version column is contended by every child write,
and the "aggregate" is enforcing a rule nobody ever stated. The check is to look for the
code that rejects a child write on account of some property of the whole collection; if
there is none, the boundary is false. The fix is to promote the children to their own
aggregate with an identity reference to the parent, which removes the contention and, not
incidentally, makes a service boundary possible where it was previously "unsafe".

**★ Is a derived total ever a real invariant?**
Yes, when something rejects an operation based on it. A customer's outstanding balance is a
derived total, and if a credit limit check refuses new orders when the balance exceeds a
limit, then the balance and the orders are under a real constraint and cannot drift
arbitrarily. A customer's lifetime value is the same arithmetic shape and nothing rejects
anything based on it, so it is a read model. The arithmetic does not tell you which one you
have; the rejection does.

{/* FOOTER */}
