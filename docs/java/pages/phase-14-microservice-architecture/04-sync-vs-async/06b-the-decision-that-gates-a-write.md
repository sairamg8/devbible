---
title: "A check only has to be synchronous when a compensating action would be unacceptable, so the real question is never 'is this consistent' but 'what does it cost to undo' — and most teams have never priced the undo"
sidebar_label: "26 · The decision that gates a write"
sidebar_position: 26
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-01 against microservices.io "Pattern: Saga"
> ([microservices.io](https://microservices.io/patterns/data/saga.html)), "Pattern:
> Event-driven architecture"
> ([microservices.io](https://microservices.io/patterns/data/event-driven-architecture.html)),
> and Chris Richardson, "Dark matter force: minimize runtime coupling"
> ([microservices.io](https://microservices.io/articles/dark-energy-dark-matter/dark-matter/minimize-runtime-coupling.html)).
> 🔴 **No sandbox, and no saga implementation** — phase 15 topic 10 owns that. Version spine:
> JDK 25 · Spring Boot 4.1.0 / Spring Framework 7.0.8.

**Category 2 from [25](06-what-must-be-synchronous.md) is where the genuinely hard architecture
decisions live: a check that gates a write. The instinct is to reason about consistency, which
leads nowhere because everybody agrees consistency is desirable. The productive question is
about the *compensation*: if you proceed without the check and it later turns out you should not
have, what does undoing it cost, in money, in trust, and in whether it is possible at all? That
question has a number, the number is a business input, and once you have it the architecture
follows.**

## The reframing

Stop asking: *"must this be consistent?"* Start asking: *"what is the compensating action, and
is it acceptable?"*

| The check | If we proceed and were wrong | Compensation | Acceptable? |
|---|---|---|---|
| Is the card valid? | We shipped goods for free | Debt collection | Rarely |
| Is stock available? | We oversold | Cancel and apologise, or back-order | **Often** — many retailers do this deliberately |
| Is the coupon still valid? | Customer got an extra discount | Absorb it, or claw back | **Usually** — it is bounded and small |
| Is the user over their quota? | They used more than allowed | Bill them, or throttle later | **Usually** |
| Is this username taken? | Two accounts with one name | Rename one | **No** — user-visible and confusing |
| Is the seat still free? | Two people on one seat | Bump one, compensate | Depends entirely on the business |
| Is this account sanctioned? | We transacted with a sanctioned party | There is none | **No** — regulatory |

Notice how many rows say "often" or "usually". **Airlines overbook on purpose. Retailers oversell
on purpose.** These are not engineering compromises; they are revenue-maximising business
policies that happen to also relax an availability constraint. When an engineer says "we cannot
accept the order without checking stock", they are frequently asserting a business policy that
the business does not actually hold — and has sometimes explicitly rejected.

**Ask. The answer is often "yes, accept it" and the conversation takes five minutes.**

## What "acceptable" actually has to cover

Three separate costs, and teams usually price only the first:

1. **The direct financial cost.** The margin lost on a cancelled order, the extra discount
   absorbed. Usually small and usually the only one considered.
2. **The trust cost.** A customer who receives a confirmation and then a cancellation is more
   annoyed than one who was told "unavailable" at the time. This is real and it is not on any
   engineering dashboard.
3. **The operational cost.** Somebody has to build the compensating path, test it, monitor it,
   and handle the cases where the compensation itself fails. The Saga pattern is explicit that
   this is the developer's work rather than the database's:

> *"design compensating transactions that explicitly undo changes made earlier in a saga rather
> than relying on the automatic rollback feature of ACID transactions"*

and that isolation does not come for free either:

> *"risk that the concurrent execution of multiple sagas and transactions can use data
> anomalies"*

Cost 3 is the one that most often makes the synchronous check the right answer despite costs 1
and 2 being low. A synchronous call is one line. A saga with compensations, isolation
countermeasures and a monitored state machine is a project. **For a low-traffic endpoint with a
dependency that is reliably up, keeping the hop is frequently the correct engineering
judgement**, and this topic is not asking you to pretend otherwise. It is asking you to know that
you made a choice.

## The middle options, which get skipped

The debate is usually framed as "check synchronously" versus "accept and compensate". There are
at least four positions, and two of them are much cheaper than either extreme.

**A · Check synchronously.** Full coupling. The baseline.

**B · Check against a local copy, then confirm asynchronously.** You hold a replicated view of
the constraint — a stock level, a tier, a quota — and check that. It can be stale, so you may
occasionally accept something you should not, but the *rate* of being wrong is bounded by the
staleness window rather than being unbounded. Availability of the owner leaves your product.
This is [23 · Event-carried state transfer](05f-event-carried-state-transfer.md) applied to a
gate rather than to a read, and it is the option people forget exists.

**C · Move the invariant.** If two services both need to enforce a rule about the same thing, the
boundary is probably wrong — the invariant and the data it constrains should live together. That
is **02 · Service boundaries** *(not written yet)*, and it is the structural fix rather than the
tactical one. Richardson's dark-matter framing is relevant: colocating an operation's subdomains
in one service eliminates runtime coupling for that operation entirely.

**D · Accept and compensate.** A saga. Maximum availability, maximum implementation cost.

**Option B is the sweet spot far more often than it is chosen**, because it converts an
availability dependency into a bounded correctness risk that the business can price. "We may
accept an order for something that sold out in the last four seconds" is a sentence a product
owner can evaluate. "The order service will be down when the inventory service is down" is a
sentence they cannot.

## The degraded-gate pattern

A useful hybrid when the owner is down and the check is genuinely important: **tighten the rule
rather than abandoning it.**

```java
StockDecision decide(String sku, int quantity) {
    try {
        return inventory.reserve(sku, quantity);              // authoritative
    } catch (InventoryUnavailableException e) {
        StockCopy local = stockCopies.find(sku);              // our replicated view
        if (local != null && local.available() > SAFETY_MARGIN + quantity) {
            return StockDecision.provisional(local.asOf());   // accept, flag for confirmation
        }
        return StockDecision.rejected("stock check unavailable");
    }
}
```

Two properties worth naming:

- **The safety margin is the price of the degradation.** During an outage you accept only orders
  that are comfortably within the last known stock level, so the rate of oversell is bounded by a
  number you chose rather than by luck.
- **`provisional` is a real state, not a log line.** A provisional acceptance has to be confirmed
  when the owner returns, and the confirmation path is code that must exist before this is
  deployed. A degraded gate with no reconciliation is just a broken gate.

This is a soft dependency ([10](03e-hard-and-soft-dependencies.md)) applied to a write path, and
everything in that chunk about untested fallbacks applies with more force here, because the
fallback moves money.

## Gotchas

**★ Engineers assert business policies the business does not hold.** "We cannot oversell" is
stated as a fact and is frequently false — many retailers and every airline deliberately do.
Never infer a policy from the current implementation; the current implementation is what one
developer found easiest three years ago.

**★ The compensation's failure mode is the one nobody designs.** You accepted the order, stock
turned out to be unavailable, and the cancellation email fails to send. Compensating actions are
themselves distributed operations that can fail, and the Saga pattern is clear that you write them
by hand. Budget for compensating the compensation, or at minimum for alerting when one fails.

**★ Sagas remove isolation, and the resulting anomalies are subtle.** The pattern names the risk
directly: concurrent sagas can produce data anomalies, because intermediate states are visible to
other transactions in a way an ACID transaction's would not be. A customer can see an order in a
half-created state; two sagas can both read a quota before either writes. Countermeasures exist
and they are design work, not configuration.

**★ A local-copy gate with no staleness budget is worse than no gate**, because it produces
confident wrong answers. The window between the owner's change and your copy seeing it is the
window in which you are wrong; you must know its size and the business must accept it. That means
measuring propagation lag as an SLI, not assuming it.

**★ "Provisional" states leak into every downstream system if you are not careful.** An order in
a provisional state has to be represented in the API, in the UI, in reports and in the warehouse's
view. Adding a state is cheap in one service and expensive across a system, and it is often the
reason a degraded gate is not worth building.

**★ The cheap option is sometimes to keep the hop.** If the endpoint handles low traffic, the
dependency is reliable, and the compensation would be a project, then paying the availability cost
is the right call. The failure is not choosing the synchronous check — it is choosing it without
having asked what the undo costs.

## Interview questions

**★ What is the right question to ask about a check that gates a write?**
Not "must this be consistent" — everyone agrees consistency is nice. Ask what the compensating
action is if you proceed without the check and turn out to be wrong, and whether that compensation
is acceptable in money, in customer trust, and in engineering cost. If the compensation is cheap
and routine — cancel and apologise, absorb a discount — the check does not have to be synchronous.
If there is no compensation, as with a sanctions screening, it does.

**★ Give an example where a business deliberately accepts the inconsistency.**
Airline overbooking and retail overselling. Both accept orders they may not be able to fulfil,
because the revenue from selling everything available exceeds the cost of occasionally
compensating a customer. Engineers frequently assert that the system "cannot oversell" as though
it were a law, when it is a policy the business may have already decided against. It is worth
asking, because the answer converts a hard synchronous dependency into an event.

**★ What is the option between "check synchronously" and "accept and compensate"?**
Checking against a locally replicated copy of the constraint, then confirming asynchronously. The
copy is stale, so you occasionally accept something you should not, but the error rate is bounded
by the propagation lag rather than being unbounded — and the owner's availability leaves your
arithmetic entirely. It converts an availability dependency into a quantified correctness risk,
which is a form a product owner can actually evaluate. It is skipped mostly because the debate
gets framed as a binary.

**★ What does the saga pattern cost that an ACID transaction does not?**
Two things the pattern names explicitly. You write the compensating transactions by hand rather
than relying on automatic rollback, which means every step needs an inverse that itself can fail
and must be monitored. And you lose isolation: concurrent sagas can observe each other's
intermediate states, producing anomalies that need deliberate countermeasures. Those are design
problems, not configuration, which is why "we'll just use a saga" is rarely a five-minute change.

**★ Sketch a degraded gate for a stock check.**
Try the authoritative reservation first. On failure, fall back to a locally replicated stock view
and accept the order only if the last known level exceeds the requested quantity by a safety
margin — so the oversell rate during an outage is bounded by a number you chose. Mark the
acceptance provisional, and have a confirmation path that reconciles against the owner when it
returns. The parts that make it real rather than decorative are the safety margin, the provisional
state being represented properly rather than logged, and the confirmation path existing before
deployment.

{/* FOOTER */}
