---
title: "The option that requires no work produces no design document, so it never reaches the comparison table and is never rejected on the merits — and it happens to win every dark-matter force by construction, which makes it the baseline every other proposal has to beat"
sidebar_label: "22c · Proposal C, do nothing"
sidebar_position: 41
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-04 against microservices.io — the dark energy and dark matter force descriptions
> ([microservices.io](https://microservices.io/post/architecture/2023/03/26/dark-energy-dark-matter-force-descriptions.html)).
> Version spine: **JDK 25 · Spring Boot 4.1.1 / Framework 7.0.9 · Spring Cloud train 2025.1.x "Oakwood" (components 5.0.x) · Spring Modulith 2.1.1**. Documentation-validated; **no sandbox run**.

**[22b · Scoring one cut](22b-scoring-one-cut.md) works two candidate boundaries end to end, including the one that gets rejected — which is already better than most treatments. It still has the bias every such exercise has: both proposals involve building something. The option of keeping the current boundary and applying a targeted fix requires no design document, arrives with no advocate, and therefore never gets scored at all. That matters more than it sounds, because when you do score it, it wins all five dark-matter forces by construction — no operation becomes distributed, no new hops, every invariant stays local, nothing new can be unavailable. That is not a rhetorical trick; it is the baseline, and a comparison that omits it has quietly assumed its own conclusion.**

## Proposal C — do nothing, scored honestly

Every worked example scores the options that involve building something, which quietly biases the
exercise: an option that requires no work produces no design document, so it never appears on the
comparison table and is never rejected on the merits. It should be on the table, and scored the same
way as the others.

**The claim being tested:** the current boundary stays, and the specific pain that prompted this
exercise is addressed with a targeted fix rather than a cut.

| Force | Proposal C | Note |
|---|---|---|
| Simple components | ⬜ unchanged | The component stays as complex as it is |
| Team autonomy | ⬜ unchanged | Nobody gains independence |
| Fast deployment pipeline | ⬜ unchanged | — |
| Multiple technology stacks | ⬜ unchanged | — |
| Segregate by characteristics | ⬜ unchanged | The scaling pressure remains inside one deployable |
| Simple interactions | ✅ **best available** | No operation becomes distributed |
| Efficient interactions | ✅ **best available** | No new network hops |
| Prefer ACID over BASE | ✅ **best available** | Every invariant stays local |
| Minimize runtime coupling | ✅ **best available** | Nothing new to be unavailable |
| Minimize design time coupling | ⚠️ unchanged | The coordination cost that prompted this remains |

🔴 **Proposal C wins every dark-matter force by construction, and that is not a trick — it is the
baseline the others must beat.** Any cut has to pay all five of those costs, so the question a scoring
exercise is really asking is whether the dark-energy gains are worth them. Presented this way the
comparison is honest; presented as "Proposal A versus Proposal B" it has already assumed the answer.

**What makes C a real proposal rather than a straw man** is that it comes with the targeted fix and
its own review trigger, exactly as in
[43 · When not to fix it](43-when-not-to-fix-it.md):

```markdown
PROPOSAL C: keep the current boundary
  Targeted fix : batch the three chattiest calls into one; add a read model for the report path
  Accepted cost: the release coordination between pricing and sales continues
  Revisit when : pricing needs to scale independently, OR a second team takes ownership of pricing,
                 OR the coordination cost exceeds one engineer-week per month
  Owner        : sales team
```

⚠️ **C loses honestly when the dark-energy case is real** — a genuinely different scaling profile, a
second team that needs autonomy, a compliance boundary. The point is not that doing nothing usually
wins. It is that a comparison which never scores it cannot tell you whether it would have.

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

## When C is genuinely the wrong answer

Presenting the baseline well is not the same as advocating for it, and a page that only made the case
for inaction would be as biased as the comparison it is correcting. Three situations where C loses
cleanly:

| Situation | Why C loses | Which force decides |
|---|---|---|
| The two parts have genuinely different scaling profiles — one read-heavy and growing, one not | You cannot scale half a deployable, and the constraint compounds | *Segregate by characteristics* |
| A second team is being formed to own one part | Shared ownership of one artefact is the coordination cost that never goes away | *Team autonomy* |
| One part falls inside a compliance or audit boundary and the other does not | Extraction shrinks the audit scope, which module discipline cannot do | *Segregate by characteristics* |

🔴 **Note what is not on that list: "the code is hard to understand".** That is *simple components*,
and it is the force a modular boundary satisfies without any of the distribution cost — see
[15b · The module is the alternative](15b-the-module-is-the-alternative.md). A cut justified only by
comprehensibility is a cut whose stated benefit was available for free.

## The wording that makes C survive the meeting

Framed as "do nothing", C loses on presentation regardless of its merits, because it sounds like an
absence of decision in a room convened to make one. Framed with its three components it competes:

1. **The targeted fix** — the specific work that addresses the pain that prompted the exercise.
2. **The accepted cost** — named out loud, so nobody can later claim it was overlooked.
3. **The revisit trigger** — the event, not the date, that reopens the decision.

**Without the third element it is not a proposal, it is a deferral**, and the difference is what
happens in eighteen months: a deferral is rediscovered as neglect, while a recorded decision with a
trigger is rediscovered as a decision somebody made on purpose and can now revisit with new evidence.

## Gotchas

**★ Symptom: a comparison of two proposals, both of which involve building something.**
Cause: the do-nothing option produces no design document, so it never reaches the table and is never
rejected on the merits.
Fix: score it as Proposal C, with the targeted fix and the revisit trigger attached. It wins every
dark-matter force by construction, which is exactly the baseline the other proposals have to beat —
and a comparison that omits it has assumed its own conclusion.

**★ Symptom: the do-nothing option is presented and dismissed in under a minute.**
Cause: it was framed as "do nothing", which sounds like an absence of a decision in a room convened to
make one.
Fix: present it with its three parts — the targeted fix, the cost being accepted, and the event that
reopens it. A named cost and a trigger make it a position; without them it is a deferral, and a
deferral is rediscovered later as neglect rather than as a choice.

**★ Symptom: the boundary is kept for the third quarter running and nobody remembers deciding to.**
Cause: the revisit trigger was a date that passed, or was never written.
Fix: triggers are events, not dates — a second team taking ownership, a scaling divergence, a
coordination cost crossing a stated threshold. An event trigger fires when the situation changes; a
date fires when everybody is busy.

## Interview questions

**★ Your candidate-cut comparison has two proposals. What is missing, and why does its absence bias the result?**
The do-nothing option. It is missing because it requires no work and therefore produces no design
document, so it never gets written up, never reaches the comparison table, and is never rejected on
the merits — while both real proposals arrive with an advocate. Scored properly it wins every
dark-matter force by construction: no operation becomes distributed, no new network hops, every
invariant stays local, nothing new can be unavailable. That is not a trick, it is the baseline any cut
has to beat, and stating it makes explicit what a scoring exercise is actually asking — whether the
dark-energy gains are worth all five of those costs. To be a genuine proposal rather than a straw man
it needs the same rigour as the others: the targeted fix for the pain that prompted the exercise, the
cost being accepted, an owner, and the event that should reopen the decision.

**★ When does the do-nothing proposal lose cleanly?**
When a dark-energy force is genuinely present rather than merely appealing. Three cases: the two parts
have different scaling profiles, because you cannot scale half a deployable and the constraint
compounds; a second team is being formed to own one part, because shared ownership of one artefact is
a coordination cost that never goes away; or one part sits inside a compliance boundary and the other
does not, because extraction shrinks the audit scope in a way no amount of module discipline can. What
is conspicuously not on that list is "the code is hard to understand" — that is *simple components*,
and an enforced in-process module delivers it without paying any of the distribution costs, so a cut
justified on comprehensibility alone is buying something that was already available for free.

---

← [Scoring one cut](22b-scoring-one-cut.md) · [Topic index](README.md) · Next → [The monolith already told you](23-the-monolith-already-told-you.md)
