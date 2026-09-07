---
title: "Functional requirements are three to five user journeys in scope, an explicit out-of-scope list, and the actors — written on the board so the interviewer can redirect you before you design"
sidebar_label: "01 · Functional requirements"
sidebar_position: 1
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-07. Method, not a quoted standard; the actors-and-external-systems framing
> is the C4 model's System Context level ([c4model.com](https://c4model.com/), summarised — no
> verbatim quote). Interview-format observations are tendencies. Examples on the bible's PERN
> storefront. **No sandbox run.**

**Functional requirements are not a feature list. They are the three to five user journeys the
design will be built around, the explicit list of what is out, and the actors who perform them —
and they are written on the board, because a requirement in your head cannot be corrected and a
requirement on the board can.** A journey is an actor doing something that changes or reads state
end to end: a customer placing an order, a seller updating stock, the payment provider confirming
a charge. Five is the ceiling because each journey becomes a numbered flow on the diagram and a
row in the data-model discussion, and a diagram with nine flows is a diagram nobody can follow in
forty-five minutes. The out-of-scope list is as graded as the in-scope one: it is the evidence
that you chose, and it is the interviewer's chance to pull something back in before you have
designed without it. The actors are the System Context of the C4 model — the people and the
external systems that touch the design — and naming the payment provider as an actor is what
puts the hardest boundary in the design on the board in minute two.

## The three parts

| Part | What it contains | Why it is graded |
|---|---|---|
| **Journeys in scope** | three to five, each an actor plus a verb plus the state it touches: "customer browses the catalogue", "customer checks out", "admin updates stock" | they become the flows, the API, the data model and the deep-dive candidates; everything later traces to one |
| **Out of scope** | the journeys deliberately excluded, named: "returns, reviews, recommendations, seller onboarding" | proves a choice was made; invites the redirect early; bounds the diagram |
| **Actors** | people and external systems: guest, customer, admin, the payment provider, the courier's API, the email gateway | each external system is a boundary the design must handle failure across; each person is an auth and authorisation question |

## Writing them: the storefront's checkout

"Design the storefront's checkout" — the functional requirements as they go on the board, in
about ninety seconds:

```text
In scope
  1. Customer views cart and starts checkout            (customer)
  2. Customer places an order for the cart's items       (customer → inventory, payment provider)
  3. Payment provider confirms or fails the charge        (payment provider → order)
  4. Customer sees order status and history               (customer)
  5. Admin adjusts stock for a product                    (admin → inventory)

Out of scope
  - building the cart itself (assume it exists and holds product ids and quantities)
  - returns and refunds; reviews; recommendations; coupons beyond a flat code
  - seller onboarding; multi-currency

Actors
  customer (authenticated), guest (may browse, must sign in to check out), admin,
  payment provider (external, asynchronous confirmation), email gateway (external)
```

Illustrative — the shape is what matters. Each in-scope line is one actor, one verb, and the
state it touches, with the arrow showing which other actor or system it involves. Journey 2 and
journey 3 together are the reason this design is interesting: an order is placed synchronously
and confirmed asynchronously, and that split will drive the state machine, the API and the deep
dive. Writing them as two journeys, not one, is the first design decision, made in the
requirements step.

## Choosing which five

Not every feature the product has is a journey the design needs. The selection rule: **a journey
is in scope if the design changes shape without it.** Checkout changes shape around the payment
confirmation and the inventory reservation; it does not change shape around whether the customer
can save an address. So:

- **Include the journey that carries the hardest requirement** — the one with money, contention,
  or an external dependency. It is where the deep dive will be, and it has to be in scope for
  the deep dive to be legitimate.
- **Include the read journey that the write journey exists for** — order status, for checkout;
  the feed, for posting. A write path with no read path is half a design.
- **Include the administrative journey if it changes the data model** — stock adjustment does
  (inventory is written by two actors); editing a product description does not.
- **Exclude the journey that is a separate system** — search, recommendations, returns. Name it
  as out of scope so the interviewer knows you saw it.

If the interviewer pulls an excluded journey back in, that is information about what they want
the deep dive to be — take it as the agenda ([phase 0](../phase-0-the-interview/09-communication-mechanics.md)).

## The out-of-scope list is not an apology

Candidates under-use the out-of-scope list because it feels like admitting limits. It is the
opposite: it is the evidence that the scope was chosen rather than inherited. The graded form
is a named list with, where useful, a one-clause reason: "returns are out — they are a separate
state machine on a completed order and would double the design; reviews are out — a different
write path with uploads." A reason per item is not required; a *named* list is. "And the usual
other stuff" is the ungraded form.

## Actors, and what each one implies

Naming an actor puts a set of questions on the board for free:

| Actor | Questions it raises, to be answered later |
|---|---|
| **Guest** | what can be done without an account; where the session lives; the moment sign-in is forced |
| **Customer** | authentication; what they may see (their own orders, not others'); rate limits per user |
| **Admin** | a separate authorisation model; an audit trail on stock changes; usually a different traffic profile |
| **Payment provider** | an external, slow, sometimes-down dependency; asynchronous confirmation via a callback; idempotency on the call; reconciliation when the callback never arrives |
| **Email gateway** | fire-and-forget with retries; never on the checkout's critical path |

The external systems are the ones that matter most for the design, because each is a boundary
across which failure has to be handled. A candidate who names the payment provider as an actor
in minute two has set up the payment-boundary deep dive; one who discovers it at minute thirty
has to redesign the write path.

## What "written on the board" means

Top-left, in text, protected from erasure, and stated aloud as it is written. Then the ask:
"Is that the scope you want, or should I pull something in?" A yes is consent for the next forty
minutes; a redirect is information. The written list is also the rubric's line-1 evidence and
the legend the numbered flows will refer to ([phase 0's tooling page](../phase-0-the-interview/11-whiteboard-and-remote-tooling.md)).
The [reading protocol](../phase-0-the-interview/06-reading-the-question.md) is how the answers
are gathered; this page is how they are recorded.

## Gotchas

**★ Symptom: minute twenty, and the interviewer says "I actually wanted to see returns."**
Cause: returns were excluded silently, so the interviewer could not redirect at minute two. Fix:
the out-of-scope list, written and read aloud, with the ask — a redirect at minute two costs
nothing; at minute twenty it costs the deep dive.

**★ Symptom: nine journeys on the board and a diagram nobody can follow.** Cause: the product's
feature list transcribed as requirements. Fix: three to five journeys chosen by the rule — in
scope if the design changes shape without it — and the rest named as out.

**Symptom: the payment provider appears at minute thirty as a surprise.** Cause: external
systems not listed as actors. Fix: actors include external systems; each is a failure boundary
and the hardest one is usually the deep dive.

**Symptom: "customer buys a product" as one journey, and a state machine with no room for the
asynchronous confirmation.** Cause: a synchronous placement and an asynchronous confirmation
folded into one line. Fix: split journeys at the boundary where the actor changes — placing is
the customer's journey, confirming is the provider's.

**Symptom: requirements said aloud, not written, and the design drifted from them.** Cause:
nothing on the board to hold the design to. Fix: text, top-left, protected; the flows are
numbered against it.

**Symptom: the admin journey omitted, and inventory has one writer in the model when it has
two.** Cause: administrative journeys treated as uninteresting. Fix: include an admin journey
when it changes the data model — two writers to inventory is a concurrency question the design
must answer.

**Symptom: an out-of-scope list read as a weakness by the candidate, so it was skipped.**
Cause: scope treated as apology. Fix: a named list is evidence of choice, and interviewers grade
it as such; "and the usual other stuff" is the only ungraded form.

## Interview questions

**★ What are functional requirements in a design round, and how many should there be?**
The three to five user journeys the design is built around — each an actor, a verb and the
state it touches — plus an explicit out-of-scope list and the actors, people and external
systems, who perform the journeys. Five is the ceiling because each journey becomes a numbered
flow, an API endpoint and a data-model row, and a design with nine flows cannot be followed or
deep-dived in forty-five minutes. They are written on the board so the interviewer can redirect
before anything is designed against them.

**★ Why is the out-of-scope list graded?**
Because it is the evidence that scope was chosen rather than inherited, and it is the
interviewer's opportunity to pull a journey back in at minute two instead of minute twenty. A
named list — "returns, reviews, recommendations, seller onboarding" — shows the candidate saw
the product's full surface and bounded the design deliberately; an unstated exclusion leaves
the interviewer to discover the gap when the design cannot accommodate it.

**How do you choose which journeys are in scope?**
A journey is in scope if the design changes shape without it. Always include the journey carrying
the hardest requirement — money, contention or an external dependency — because it is where the
deep dive lives; the read journey the write journey exists for; and the administrative journey if
it changes the data model, such as a second writer to inventory. Exclude journeys that are
separate systems — search, returns — and name them as out.

**What does naming the payment provider as an actor do for the design?**
It puts the hardest boundary on the board in minute two: an external, slow, sometimes-unavailable
system whose confirmation arrives asynchronously. That single line sets up the order state
machine (placed, then confirmed or failed), the idempotent call, the callback, the reconciliation
job for callbacks that never arrive, and the decision to keep the provider outside the database
transaction — all of which would otherwise be discovered as surprises at minute thirty.

**Why split "place an order" and "confirm the payment" into two journeys?**
Because the actor changes — the customer places, the provider confirms — and the timing changes
— synchronous placement, asynchronous confirmation. Splitting them at that boundary is the first
design decision, made in the requirements step: it makes the order a state machine, the API a
pair of endpoints plus a callback, and the payment boundary a legitimate deep dive. Folding them
into one journey hides the asynchrony until the design cannot express it.

---

← Index: [Phase 1 — The method](README.md) · Next → **Non-functional requirements** *(not written yet)*
