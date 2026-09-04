---
title: "The single best tie-breaker in boundary design is not technical at all: ask whether it is the job of the user performing this action to make the data consistent, because if it is somebody else's job the system may take its time and the line can go there"
sidebar_label: "08 · Whose job is it?"
sidebar_position: 12
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-01 against Vaughn Vernon, *Effective Aggregate Design, Part II: Making
> Aggregates Work Together* (2011), section "Ask Whose Job It Is", and *Part III: Gaining
> Insight Through Discovery* ([dddcommunity.org](https://www.dddcommunity.org/library/vernon_2011/),
> CC BY-ND 3.0); the guideline is attributed there to a discussion with Eric Evans.
> Version spine: **JDK 25 · Spring Boot 4.1.1 / Framework 7.0.9 · Spring Cloud train
> 2025.1.x "Oakwood" (components 5.0.x) · Spring Modulith 2.1.1**.

**When you cannot decide whether two things must be transactionally consistent, every
technical instinct available to you is a bias rather than an argument: people who learned
classical DDD lean transactional, people who learned CQRS lean eventual, and neither leaning
is about the domain. There is one question that is about the domain, it takes ten seconds to
ask, and it settles most cases. Whose job is it to make this consistent? If it is the job of
the user doing the thing, aim for one transaction. If it is another user's job, or the
system's, eventual consistency is correct — and a service boundary may go between them.**

## The guideline, from the source

Vernon states both the problem and the rule plainly:

> *"Those who use DDD in a classic/traditional way may lean toward transactional
> consistency. Those who use CQRS may tend to lean toward eventual consistency. But which
> is correct? Frankly, neither of those leanings provide a domain-specific answer, only a
> technical preference."*

And then, crediting the guideline to Eric Evans:

> *"When examining the use case (or story), ask whether it's the job of the user executing
> the use case to make the data consistent. If it is, try to make it transactionally
> consistent, but only by adhering to the other rules of aggregate. If it is another user's
> job, or the job of the system, allow it to be eventually consistent."*

The reason it works is given in the next sentence and is the part usually left out of the
retelling:

> *"It exposes the real system invariants: the ones that must be kept transactionally
> consistent."*

The question is not a shortcut around the analysis. It *is* the analysis, phrased in a way a
domain expert can answer without knowing what a transaction is.

## Why it beats every technical framing

Ask an engineer "must these be atomic?" and you will get an answer shaped by what they last
built. Ask a warehouse manager "when a picker scans the last item on a pick list, is it
their job to tell the system the order is complete, or does the system work that out?" and
you get a fact about the business, and it is a fact that maps directly onto a boundary.

The question also survives translation to the people who decide. It can be asked in a
requirements meeting, of someone who will never read your architecture diagram, and their
answer is authoritative in a way that yours is not.

## Worked through six order-system decisions

| Use case | Whose job? | Verdict | Boundary consequence |
|---|---|---|---|
| Customer adds a line to a draft basket; the basket total must update | The customer's — they are looking at the total and will act on it | **Transactional** | Basket and its lines are one aggregate, one service |
| Customer places an order; stock must be reserved | The customer's — they are being told "yours" | **Transactional, if the business means it** | Ties order placement to stock. See below — this is the contested one. |
| Order is placed; the customer's loyalty points must increase | The system's — the customer is not doing points arithmetic | **Eventual** | Loyalty may be its own service |
| Picker scans the last item; the shipment becomes ready to dispatch | The picker's — they are standing there and will move the parcel | **Transactional** | Pick lines and shipment status are one aggregate |
| Shipment dispatched; the sales order shows as "on its way" | Nobody's, really — it is a notification | **Eventual** | Sales and Fulfilment separate cleanly here |
| Payment captured; the invoice is marked paid | Depends. If a finance clerk clicks "capture" and expects to see it paid, theirs. If a nightly batch captures, the system's. | **Both answers exist** | The boundary follows the workflow, not the data |

The last row is the general lesson: **the same two pieces of data can require different
consistency in different workflows**, and the answer is determined by who is standing there
when it happens.

## The contested row, in detail

"Customer places an order; stock must be reserved" is where most retail architectures are
actually decided, and both answers are defensible.

**If it is the customer's job** — the confirmation page says "reserved for you", the
business does not want to cancel orders after the fact, and the category is scarce — then
order placement and stock reservation are one transaction, so `Order` and `StockItem` are in
one service, or order placement calls a synchronous reserve that must succeed before the
order exists.

**If it is the system's job** — the business is happy to accept an order, attempt
allocation asynchronously, and cancel with an apology in the rare miss — then order
placement writes an order in a `PENDING` state and publishes an event, and Sales and
Inventory are separate services with no shared transaction. This is precisely
microservices.io's *Self-contained Service* pattern: *"Design a service so that it can
respond to a synchronous request without waiting for the response from any other service"*,
with the order created in a pending state and completed asynchronously.

Notice what determined the architecture: not scale, not technology, but a business policy
about whether you are willing to cancel an order you already accepted. Get that policy
stated, and the boundary follows. Fail to get it stated, and an engineer will pick, and
their pick will be a technical preference wearing domain clothing.

## The question's second output: it changes the domain model

Vernon's Part III shows the team asking whose job it is and discovering something they did
not know about their own domain — that a status transition they had assumed was automatic
might legitimately be a manual approval, which means *neither* transactional nor eventual
consistency is required, because a human performs the transition later. His summary of the
episode:

> *"Asking 'whose job is it?' led them to a few vital perceptions about their domain."*

This is worth expecting rather than treating as a bonus. A surprising fraction of the time
the answer is "actually nobody does that, we discussed it and never built it", or "the
warehouse supervisor does it on Fridays", and both answers dissolve a consistency problem
that had been holding a boundary hostage.


The two code shapes the answer produces, and the case where two stakeholders answer
differently, are in [08b · The answer, in code](08b-the-answer-in-code.md).

## Gotchas

**★ Asking the question of an engineer.** They will answer with a technical preference,
because they have one and the domain expert does not. Ask the person who does the job, or
their manager. If neither exists — the workflow is fully automated — the answer is the
system's job and eventual consistency is correct by construction.

**★ Symptom: "the user expects to see it immediately".** Cause: conflating *visibility*
with *consistency*. A user seeing the result immediately can be satisfied by returning the
computed answer from the same request while the write propagates asynchronously. Ask what
happens if they refresh in three seconds and see the old value — often the answer is that
the screen simply shows a "processing" state, which is a UI decision, not a boundary
constraint.

**★ Taking "yes it must be immediate" at face value from a stakeholder.** People say yes to
that question by default, because slower sounds worse. Follow up with the cost: "if making
it immediate means an order sometimes fails at checkout because inventory is briefly
unavailable, is that still the right trade?" That reframing changes a substantial fraction
of answers.

**★ Symptom: the answer is the acting user's job, but they are acting on data they cannot
see.** Cause: the use case is misdescribed. If a customer "reserves stock" they never see,
their job is to place an order, not to maintain stock consistency. Re-scope the use case to
what the user is actually doing before answering.

**★ Using the question to justify eventual consistency everywhere.** It cuts both ways and
often argues for a bigger aggregate. The picker scanning the last item is a case where the
honest answer is transactional, and honouring it means keeping pick lines and shipment
status together even though separating them would be tidier.

**★ Forgetting to re-ask when the workflow changes.** When a manual step is automated, the
job moves from a user to the system, and a boundary that was forbidden becomes available.
That is one of the few architectural changes that gets *cheaper* over time, and almost
nobody revisits it.

## Interview questions

**★ You cannot decide whether two operations need to be in one transaction. What do you
ask?**
Whose job it is to make the data consistent. If it is the job of the user performing the
action — they are looking at the result and will act on it — aim for transactional
consistency, which means the state involved belongs in one aggregate and therefore one
service. If it is another user's job or the system's, eventual consistency is correct and a
service boundary may go between them. It is Evans' guideline as reported by Vernon, and its
value is that it produces a domain answer rather than a technical preference, and that a
non-technical stakeholder can answer it.

**★ Why is "is it the user's job?" a better question than "must this be atomic?"**
Because "must this be atomic" can only be answered by someone who knows what atomic means,
and those people have priors from whatever they last built — classical DDD leans
transactional, CQRS leans eventual, and neither leaning is evidence about this domain.
"Whose job is it" can be answered by the person who actually does the job, and their answer
is a fact about the business. It also exposes the real invariants as a by-product, because
the cases where the answer is "the acting user's" are exactly the cases where consistency is
observable and acted upon.

**★ Give an example where the same pair of entities needs different consistency in
different workflows.**
Payment capture and invoice status. When a finance clerk clicks "capture" and watches the
screen, it is their job — they will act on the result, and the sensible design is one
transaction. When a nightly batch captures thousands of authorisations, it is the system's
job, nobody is watching, and eventual consistency is not merely acceptable but preferable,
because it lets the batch make progress without holding long transactions. Same data,
different workflow, different answer — which is why the question is asked of use cases and
not of entities.

**★ A stakeholder says everything must be immediately consistent. How do you proceed?**
Price it, then re-ask. "Immediate" for stock reservation means checkout fails when inventory
is briefly unavailable, and it means orders and inventory cannot be scaled or deployed
independently. Present the alternative honestly: accept the order in a pending state,
allocate asynchronously, and cancel with an apology in the small number of misses — which is
what microservices.io's *Self-contained Service* pattern describes. Many businesses prefer
the second once the first is priced, and the ones that do not have told you something real
about their domain, which is a legitimate architectural constraint rather than an obstacle.

---

← [False invariants](07b-false-invariants.md) · [Topic index](README.md) · Next → [The answer, in code](08b-the-answer-in-code.md)
