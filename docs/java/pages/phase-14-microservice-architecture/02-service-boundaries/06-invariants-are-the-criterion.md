---
title: "Every other criterion for drawing a boundary is advisory; the invariant is the one that is binding, because an aggregate is a transactional consistency boundary and a line drawn through one converts an atomic rule into a distributed workflow you will maintain forever"
sidebar_label: "06 · Invariants are the criterion"
sidebar_position: 9
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-01 against Vaughn Vernon, *Effective Aggregate Design, Part I: Modeling
> a Single Aggregate* (2011)
> ([dddcommunity.org](https://www.dddcommunity.org/library/vernon_2011/), CC BY-ND 3.0);
> microservices.io *Dark matter force: Prefer ACID over BASE*
> ([microservices.io](https://microservices.io/articles/dark-energy-dark-matter/dark-matter/prefer-acid-over-base.html));
> Eric Evans, *Domain-Driven Design* (2003), Ch. 6, cited by concept.
> Version spine: **JDK 25 · Spring Boot 4.1.1 / Framework 7.0.9 · Spring Cloud train
> 2025.1.x "Oakwood" (components 5.0.x) · Spring Modulith 2.1.1**.

**Team size, org chart, change rate, capability, language — every criterion in this topic
is a judgement you can revisit. The invariant is different in kind. If two pieces of state
must satisfy a business rule at the same instant, and you put them in different services,
you have not made a trade-off; you have deleted the rule and replaced it with a workflow
that approximates it, plus compensation for when the approximation fails. That is
occasionally the right decision. It is never a free one, and it is the single decision most
often made without anyone noticing they made it.**

## The definition, in the words of the source

Vernon's *Effective Aggregate Design* is the primary text here and its definitions are
sharp:

> *"An invariant is a business rule that must always be consistent."*

And immediately after, the distinction that does all the work:

> *"There are different kinds of consistency. One is transactional, which is considered
> immediate and atomic. There is also eventual consistency. When discussing invariants, we
> are referring to transactional consistency."*

Then the sentence that turns aggregate design into boundary design:

> *"aggregate is synonymous with transactional consistency boundary"*

And the one that makes it a rule rather than a description:

> *"A properly designed aggregate is one that can be modified in any way required by the
> business with its invariants completely consistent within a single transaction. And a
> properly designed bounded context modifies only one aggregate instance per transaction in
> all cases."*

Read that last clause slowly, because it is the whole chain. If a bounded context modifies
only one aggregate instance per transaction, and an aggregate is a transactional consistency
boundary, then **the set of state that must be consistent at an instant is exactly one
aggregate, and one aggregate cannot straddle two services.** Boundary design is therefore
downstream of aggregate design, and aggregate design is downstream of the invariants.

Vernon is explicit that this is not optional analysis:

> *"we cannot correctly reason on aggregate design without applying transactional analysis"*

## What an invariant looks like in an order system

The abstract form Vernon gives is `c = a + b`: when `a` is 2 and `b` is 3, `c` must be 5,
and any state where it is not is a violation. Real ones look like this:

| Invariant | Between | Kind |
|---|---|---|
| An order's total equals the sum of its line totals plus tax minus discount | Fields of one order | Transactional, trivially |
| An order must have at least one line | Order and its lines | Transactional |
| Stock available at a warehouse is never negative: `onHand - reserved >= 0` | Fields of one stock item | Transactional |
| A reservation exists only against stock that was available when it was made | Reservation and stock item | **Transactional — and this is the interesting one** |
| A customer's lifetime spend equals the sum of their paid orders | Customer and all orders | Not an invariant. See [07b · False invariants](07b-false-invariants.md). |
| An order cannot ship before payment is captured | Order, payment, shipment | Usually not transactional — see [08 · Whose job is it](08-whose-job-is-it.md) |
| A promotion may be redeemed at most `n` times in total | Promotion and every redemption | Transactional, and it is a boundary constraint on the promotion aggregate |

The fourth and the last rows are where boundaries get decided. If a reservation and the
stock it reserves must be consistent atomically — and they must, because that is what
"reserved" means — then reservations and stock levels are in one aggregate and therefore in
one service. No amount of wanting a separate "reservations service" changes that; it only
changes whether you pay for the workaround.

## The concrete cost of cutting an invariant

Put stock levels in `inventory` and reservations in a new `reservations` service. The rule
`onHand - reserved >= 0` now spans two databases. Here is what you must build, in full,
none of it optional:

1. **A protocol** — reservations asks inventory to decrement available stock, inventory
   confirms, reservations records. Two network calls, at least.
2. **A failure path for every step.** Reservation recorded, inventory call lost: stock is
   reserved twice. Inventory decremented, reservation record write fails: stock is leaked.
3. **Compensation.** A "release stock" operation, and something to invoke it — which is a
   saga, which is **phase 15 topic 10** *(not written yet)*, and which is a component with
   its own state, retries, and failure modes.
4. **Idempotency** on both sides, because the compensation will be retried.
5. **A reconciliation job** that finds leaked reservations, because compensations do fail.
6. **A decision about what the customer sees during the window** where the two disagree.
7. **A permanent weakening of the guarantee.** You can no longer say stock never goes
   negative. You can say it converges. Someone will oversell, and you now need a policy for
   what happens when they do.

Every item on that list is real engineering with real defects, and it exists **only**
because a line was drawn through an invariant. The line bought you… a separate deployable
for a thing that changes when inventory changes.

This is why the rule is worth stating flatly: **do not draw a boundary through an invariant
unless you are willing to build all seven items and can name the benefit that justifies
them.**

## In Java: the invariant lives inside the aggregate, and that is what makes it enforceable

```java
package com.retailer.inventory;

import java.util.ArrayList;
import java.util.List;

/// The aggregate root. Everything the invariant "available >= 0" touches is inside
/// this object, which is why the invariant can be enforced by ordinary Java rather
/// than by a distributed protocol.
public final class StockItem {

    private final Sku sku;
    private final WarehouseId warehouse;
    private int onHand;
    private final List<Reservation> reservations = new ArrayList<>();
    private long version;

    public Reservation reserve(OrderRef order, int quantity) {
        if (quantity <= 0) {
            throw new IllegalArgumentException("quantity must be positive");
        }
        if (available() < quantity) {
            throw new InsufficientStockException(sku, warehouse, quantity, available());
        }
        var reservation = new Reservation(ReservationId.next(), order, quantity);
        reservations.add(reservation);
        return reservation;            // invariant holds at every return point
    }

    public void release(ReservationId id) {
        reservations.removeIf(r -> r.id().equals(id));
    }

    public int available() {
        return onHand - reservations.stream().mapToInt(Reservation::quantity).sum();
    }
}
```

```java
package com.retailer.inventory.internal;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
class ReservationApplicationService {

    private final StockItemRepository stockItems;

    ReservationApplicationService(StockItemRepository stockItems) {
        this.stockItems = stockItems;
    }

    /// One aggregate instance, one transaction. The optimistic lock on StockItem is
    /// what makes concurrent reservations safe; there is no distributed protocol here
    /// because there is no boundary here.
    @Transactional
    ReservationId reserve(Sku sku, WarehouseId warehouse, OrderRef order, int quantity) {
        var item = stockItems.findBySkuAndWarehouse(sku, warehouse)
                .orElseThrow(() -> new UnknownStockItemException(sku, warehouse));
        return item.reserve(order, quantity).id();
    }
}
```

The optimistic lock matters and is easy to skip past. Two concurrent reservations both read
`available() == 1`, both pass the check, and both add a reservation. The version column and
a failed commit on the loser is what turns "we checked" into "the invariant holds". Without
it the invariant is a suggestion even inside one service — and if that is the state of your
monolith, splitting it will not make things worse, but it will make the defect distributed
and much harder to see.

## The rule of thumb has a status, and Vernon says so

Vernon does not present one-aggregate-per-transaction as an absolute:

> *"Limiting the modification of one aggregate instance per transaction may sound overly
> strict. However, it is a rule of thumb and should be the goal in most cases."*

He then lists four specific reasons to break it, which are covered in
[11 · Reasons to break the rule](11-reasons-to-break-the-rule.md). Knowing that they exist,
and that they are four rather than "use judgement", is what keeps this from being dogma.

## Why this criterion outranks the others

Every other boundary criterion is a claim about **cost**: this split will cost coordination,
that one will cost latency, this one will cost a team's autonomy. Costs trade against each
other and reasonable people weigh them differently.

The invariant criterion is a claim about **capability**: after this split, the system can no
longer guarantee a thing it used to guarantee. You can decide to accept that, and sometimes
you should — availability may be worth more than strict consistency for a particular rule —
but it is a different kind of decision and it deserves to be made explicitly, by someone who
can speak for the business, rather than falling out of a diagram.

The practical procedure: **list the invariants, group state by invariant, and only then
consider where lines could go.** Any candidate boundary that cuts a group is either
rejected or escalated. Nothing else in this topic is allowed to overrule that step silently.

## Gotchas

**★ Symptom: a service split ships, and three months later there is a nightly
reconciliation job nobody planned.** Cause: an invariant was cut and the drift it produces
is being repaired in batch. Fix: the reconciliation job is evidence, not a solution — go
back and ask which rule it is repairing, and whether that rule should have kept its state
together.

**★ Assuming every rule that sounds absolute is transactional.** "An order cannot ship
before payment" sounds absolute and is usually not — most retailers ship on authorisation,
not capture, and tolerate a window. Test each candidate with the whose-job-is-it question in
[08 · Whose job is it](08-whose-job-is-it.md) before treating it as a constraint on your
architecture.

**★ Enforcing an invariant with a read-then-write and no lock.** `if (available() >= qty)`
followed by a save is not an invariant, it is a race. Inside one aggregate, optimistic
locking on the root makes it real. Across services there is no equivalent, which is exactly
the point.

**★ Symptom: an invariant enforced in the caller.** If service A checks stock by calling
service B and then acts, the rule lives in A and the state lives in B, and between the
check and the act anything can happen. The rule belongs where the state is, expressed as an
operation B performs — `reserve(...)`, not `getAvailable()` followed by a decision.

**★ Discovering the invariant after the split.** The usual sequence: split, ship,
oversell, add a lock, add a retry, add a compensation, add reconciliation, add a dashboard.
Each step is locally reasonable and the total is a saga nobody designed. Enumerate the
invariants *before* the split; it is a half-day exercise and it is the highest-return
half-day in this topic.

**★ Treating the database's foreign keys as the invariant list.** Foreign keys record
referential integrity, which is a much weaker claim than a business invariant, and they miss
every rule that is arithmetic or temporal. They are a useful prompt and a bad inventory.

## Interview questions

**★ Why are invariants the primary criterion for a service boundary rather than one
criterion among several?**
Because they are the only criterion whose violation removes a capability rather than adding
a cost. If I split by the wrong team boundary, I pay in coordination and I can merge later.
If I split through an invariant, the system can no longer enforce a rule atomically —
oversell becomes possible, double-spend becomes possible — and getting it back means
building a distributed workflow with compensation, idempotency and reconciliation. Vernon's
formulation makes the chain explicit: an aggregate *is* a transactional consistency
boundary, a well-designed context modifies one aggregate per transaction, and therefore the
set of state under one invariant cannot span services without changing what the system
guarantees.

**★ Give me a concrete invariant and show how it constrains a decomposition.**
Stock availability: `onHand - reserved >= 0` for a SKU at a warehouse. That rule ties the
stock level and every reservation against it into one consistency boundary. So a design with
an "inventory service" holding levels and a "reservations service" holding holds is not two
services, it is one invariant cut in half. To keep the guarantee you would need a
reserve-and-confirm protocol, compensation for each failure mode, idempotent retries, and a
reconciliation job for leaked reservations — and even then the guarantee is "converges"
rather than "never negative". So reservations and stock levels go in one service, and if
that service is too large the split must be found somewhere else, for example between
warehouses rather than between concepts.

**★ What is the difference between an invariant and a business rule?**
Every invariant is a business rule; most business rules are not invariants. The
discriminator is Vernon's: an invariant must be *transactionally* consistent — true at every
observable instant, atomically. "An order's total equals the sum of its lines" is an
invariant. "A customer's loyalty tier reflects their spend over the last twelve months" is a
rule that may lag by minutes and nobody is harmed; enforcing it transactionally would tie
the customer record into every order commit for no benefit. Misclassifying the second kind
as the first is how aggregates become enormous.

**★ Can you have an invariant that legitimately spans services?**
Not as a transactional invariant — that is the definition. What you can have is a rule that
spans aggregates and is enforced eventually, which Evans anticipates directly: *"Any rule
that spans AGGREGATES will not be expected to be up-to-date at all times."* The engineering
question then becomes how long the window is, what the system does with observations made
inside it, and who compensates. If the answer to "what happens during the window" is
unacceptable to the business, the rule is a real invariant and the boundary is wrong.

**★ How do you actually collect the invariant list?**
Start from system operations rather than from the data model: for each thing the system can
be asked to do, ask what must be true immediately afterwards and what would be a bug if a
user could observe it. Then ask, for each candidate rule, whether a delay of ten seconds
would harm anyone — and if the answer is genuinely no, it is not transactional. Cross-check
with the existing code: every optimistic-lock version column, every `SELECT … FOR UPDATE`,
every unique constraint and every nightly reconciliation job is a place where somebody
already decided a rule needed protecting.

---

← [One service, one capability](05-one-service-one-capability.md) · [Topic index](README.md) · Next → [Finding the invariants](07-finding-the-invariants.md)
