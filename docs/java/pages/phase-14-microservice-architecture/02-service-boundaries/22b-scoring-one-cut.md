---
title: "A boundary decision worked end to end, including the one that gets rejected — because the useful skill is not scoring a cut you already wanted, it is recognising the gate failure and then finding the axis along which the same system does split"
sidebar_label: "22b · Scoring one cut"
sidebar_position: 34
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-01 against microservices.io *About dark energy and dark matter*
> ([microservices.io](https://microservices.io/post/architecture/2023/03/26/dark-energy-dark-matter-force-descriptions.html));
> *Dark matter force: prefer ACID over BASE*
> ([microservices.io](https://microservices.io/articles/dark-energy-dark-matter/dark-matter/prefer-acid-over-base.html));
> Vaughn Vernon, *Effective Aggregate Design, Part I* (2011)
> ([dddcommunity.org](https://www.dddcommunity.org/library/vernon_2011/), CC BY-ND 3.0), for
> the invariant test. Version spine: **JDK 25 · Spring Boot 4.1.1 / Framework 7.0.9 · Spring
> Cloud train 2025.1.x "Oakwood" (components 5.0.x) · Spring Modulith 2.1.1**.

**Every worked example in architecture writing scores a boundary that turns out to be right,
which teaches the arithmetic and not the judgement. This chunk scores one that is wrong,
identifies exactly which check kills it, and then finds the axis along which the same
overloaded service genuinely does divide. The pattern generalises: when a proposed cut fails
the consistency gate, the answer is almost never "do it anyway with a saga" — it is that you
picked the wrong axis, and there is usually another one.**

## The situation

The `inventory` service has grown. It holds stock levels, reservations, warehouse transfers,
stock takes, supplier receipts and the allocation logic that decides which warehouse serves an
order. One team owns it, and that team is stretched. Two proposals are on the table.

**Proposal A:** split off a `reservations` service. Reservations are conceptually distinct,
they have their own lifecycle, and the reservation logic is where most of the complexity is.

**Proposal B:** split by warehouse region — `inventory-eu` and `inventory-apac`.

Proposal A is the one everybody prefers, because it is a conceptual split and it looks like
domain design. Score both.

## Proposal A — extract reservations

### The gate first

The rule from [22 · The ten forces](22-the-ten-forces.md): check *prefer ACID over BASE*
before scoring anything else, because it can end the discussion.

**Which invariants would span the new line?**

From the invariant list: `onHand − Σ reservations ≥ 0`, per SKU per warehouse. That rule
constrains the stock level and every reservation against it — a single consistency boundary,
in Vernon's terms *"synonymous with transactional consistency boundary"*.

**Which operations write both sides?** From the operation table: `placeOrder` (writes
`StockItem` including a reservation), `cancelOrder` (releases one), `receiveReturn`,
`recordStockTake` (adjusts `onHand` and must not invalidate existing reservations),
`transferStock` (moves `onHand` between warehouses and must not strand a reservation).

Five commands write both sides. Every one of them becomes a distributed operation.

**Would the guarantee survive?** No. To keep it you would need reserve-and-confirm with
compensation, idempotent retries, a reconciliation job for leaked reservations, and a decision
about what customers see during the window. The guarantee becomes "converges" rather than
"never negative", which means oversell becomes possible.

**Is anyone willing to accept that?** This is the question to take to the business, and for a
retailer selling scarce goods the answer is usually no — that is precisely what a reservation
*is*. If the answer were yes, the correct design would not be a reservations service; it would
be to stop reserving at all and allocate asynchronously.

**GATE: FAILED.** The proposal is rejected. The remaining nine forces are not scored, because
none of them can restore the invariant.

### Why it was attractive anyway

Worth naming, because the same attraction recurs:

- Reservations have their own lifecycle, so they *feel* like a separate concept.
- Most of the complexity is there, so splitting looks like it would reduce cognitive load.
- The name is a noun, and a noun with a lifecycle looks like an aggregate.

All three observations are true. None of them is about the invariant, and the invariant is the
one that decides. This is exactly the false-invariant test run in reverse: the mistake in
[07b · False invariants](07b-false-invariants.md) is believing in a rule that does not exist;
the mistake here is not noticing one that does.

## Proposal B — split by warehouse region

### The gate

**Which invariants span the line?** `onHand − Σ reservations ≥ 0` is scoped *per SKU per
warehouse*. A warehouse is entirely within one region. So the invariant does not span the
line — it is replicated on both sides, over disjoint state.

**Which operations write both sides?** One: `transferStock` between an EU and an APAC
warehouse. Check whether that is common; for most retailers inter-regional transfers are rare,
planned, and already treated as a multi-day process with a shipment attached. It is not an
atomic operation today and pretending it is would be dishonest.

**GATE: PASSED**, with one operation to handle as a workflow rather than a transaction — and
that operation is already a workflow in the physical world.

### The nine remaining forces

```text
Candidate boundary: split inventory by region (inventory-eu / inventory-apac)

DARK ENERGY (for)
  Simple components        WEAK. Same domain twice; each instance is simpler only in
                           data volume, not in concepts. This does not reduce what an
                           engineer must understand.
  Team autonomy            NO. One team owns both. Splitting creates two services for
                           one team, which Service per team advises against.
  Fast pipeline            NO. Same codebase, two deployments.
  Tech stacks              NO.
  Segregate by chars       STRONG. APAC peak is in EU night hours; data residency
                           requires APAC stock data to stay in region; the EU instance
                           carries a compliance obligation APAC does not.

DARK MATTER (against)
  Simple interactions      Good. Almost every operation is single-region.
  Efficient interactions   Good. No cross-region chatter on the hot path.
  Prefer ACID over BASE    PASSED (see gate). transferStock becomes a workflow; it is
                           already a physical workflow.
  Min. runtime coupling    Good — better than today. An EU outage no longer affects
                           APAC orders, which is currently a single point of failure.
  Min. design-time coupling SAME CODE, TWO DEPLOYMENTS. A change to the inventory
                           model changes both. This is the honest cost: it is one
                           codebase deployed twice, not two services.

FIXED PER-SERVICE COST     Doubled deployment, monitoring and on-call surface for one
                           team. Real. Partially offset by the same artefact.

DECISION: proceed, but as ONE service deployed per region rather than two codebases.
Revisit if the regions' models genuinely diverge, at which point it becomes two.
```

### The important part of that decision

The split that works is **not a decomposition of the domain**. It is a partition of the *data*
along a line the invariant already respects, deployed as multiple instances of one service.
Design-time coupling stays at one — a model change changes both — and that is accepted
deliberately, because the benefit being bought is segregation by characteristics
(residency, peak profile, blast radius), not team autonomy.

Naming that honestly matters. Calling it "two services" would imply independence that does not
exist and would invite the two instances to diverge, at which point you have two codebases
with one model and no owner for the difference.

## What to do about the original problem

Neither proposal addressed the actual complaint: the team is stretched because `inventory`
holds too much. The gate analysis suggests where to look instead.

The aggregates in `inventory` are `StockItem` (with its reservations), `Transfer`, `StockTake`
and `SupplierReceipt`. Which of them share an invariant with `StockItem`?

- `Transfer` — adjusts `onHand` at two warehouses. Writes `StockItem`. Coupled.
- `StockTake` — adjusts `onHand`, must not invalidate reservations. Coupled.
- `SupplierReceipt` — increases `onHand`. Writes `StockItem`, but **only upward**. An increase
  can never violate `onHand − reserved ≥ 0`. Whose job is it to make receipt and stock level
  consistent? The system's — the goods-in clerk scans a delivery and nobody is waiting for the
  stock figure to move in the same instant.

So `SupplierReceipt` is separable, and `inventory-receiving` is a viable service: it owns
supplier deliveries, discrepancies, and goods-in workflow, and it publishes
`GoodsReceived` events that Inventory applies. That is a genuine domain split, it passes the
gate, and it removes a meaningful chunk of the team's surface.

**The generalisable move:** when a cut fails the gate, look for the operations that touch the
shared state in only one direction, or where the whose-job answer is "the system's". Those are
where the real seams are, and they are usually not where the conceptual vocabulary suggests.

## Gotchas

**★ Symptom: a proposal that scores well on nine forces and fails the gate.** Cause: the gate
was scored rather than gated. Fix: check it first and stop if it fails. Nine good scores cannot
restore a consistency guarantee, and continuing to score creates a document that argues for a
decision that has already been ruled out.

**★ Mistaking a lifecycle for an aggregate boundary.** Reservations have a lifecycle — created,
confirmed, released, expired — and are still inside `StockItem`'s consistency boundary. A
distinct lifecycle is evidence about modelling, not about transactions.

**★ Symptom: a "split" that is one codebase deployed twice, described as two services.**
Cause: a data partition presented as a decomposition. Fix: say what it is. It buys segregation
by characteristics and buys no team autonomy or design-time decoupling, and calling it two
services invites divergence with nobody owning the difference.

**★ Not asking what the original complaint was.** Both proposals here were plausible and
neither addressed "the team is stretched". Always restate the problem before scoring a
solution, because a scored proposal has momentum.

**★ Looking only at conceptual vocabulary for seams.** The vocabulary suggested reservations;
the invariant analysis found receiving. The domain's words tell you where concepts differ, and
the operations tell you where state can be separated — and they disagree more often than the
literature admits.

**★ Assuming a one-directional write is always separable.** `SupplierReceipt` only increases
`onHand`, which is why it cannot break the invariant. If receiving could also *correct* a stock
level downward, the analysis changes and the answer flips. Check the direction of every write,
not the entity.

## Interview questions

**★ Walk me through rejecting a proposed service boundary.**
Check the consistency gate before anything else. For extracting a reservations service from
inventory, the invariant `onHand − Σ reservations ≥ 0` binds the stock level and the
reservations into one consistency boundary — Vernon's point that an aggregate *is* a
transactional consistency boundary. Five commands write both sides, so all five become
distributed operations needing compensation, idempotency and reconciliation, and the guarantee
degrades from "never negative" to "converges", which means oversell. Since the business will
not accept oversell for scarce goods, the proposal is rejected and the other nine forces are
not scored, because none of them can restore an invariant.

**★ The conceptual split failed. Where do you look next?**
At the operations rather than the vocabulary. Two patterns give you separable state even when
the concepts look entangled: operations that write the shared state in only one direction, and
operations where the whose-job answer is "the system's". In the inventory case, supplier
receipts only ever increase stock on hand, so they can never violate the invariant, and nobody
stands waiting for the level to move as the delivery is scanned. That makes a receiving
service viable where a reservations service was not — and it is not the split the domain's
own words would have suggested.

**★ When is deploying one service per region a legitimate architecture, and what is it not?**
It is legitimate when the invariants are already scoped within a region — stock per warehouse,
where warehouses do not span regions — and you are buying data residency, blast-radius
isolation or a different peak profile. It is not a decomposition: design-time coupling stays at
one, because a model change changes every instance, and it delivers no team autonomy. The
honest description is "one service, several deployments", and describing it as two services
invites them to diverge with nobody owning the difference.

**★ Why check the consistency gate before the other nine forces rather than alongside them?**
Because it is the only one whose failure removes a capability rather than adding a cost. Team
autonomy, pipeline speed and cognitive load are all things you can trade; a transactional
invariant is not something you can buy back with a good score elsewhere. Checking it first also
saves the work, and — more importantly — prevents a document from existing that argues nine
ways for a decision that has already been ruled out. Such documents have momentum, and
somebody eventually implements them.

**★ What would make you accept a boundary that fails the gate?**
An explicit business decision that the weakened guarantee is worth the availability, made by
someone with the authority to accept the consequence, and designed as a customer experience
rather than as an error path. A retailer that would rather accept an order and occasionally
cancel with an apology than fail a checkout has made exactly that trade — it is
microservices.io's *Self-contained Service* pattern. What makes it legitimate is that the
cancellation flow, the customer communication and the compensation are designed deliberately.
What makes it a defect is when nobody enumerated the invariant and the drift shows up later as
a reconciliation job.

---

← [The ten forces](22-the-ten-forces.md) · [Topic index](README.md) · Next → [The monolith already told you](23-the-monolith-already-told-you.md)
