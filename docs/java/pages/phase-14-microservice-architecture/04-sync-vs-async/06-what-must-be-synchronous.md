---
title: "Only three kinds of interaction genuinely have to be synchronous, and everything else in a typical codebase is synchronous because that is what the method signature looked like"
sidebar_label: "25 · What must be synchronous"
sidebar_position: 25
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-01 against microservices.io "Pattern: Remote Procedure Invocation (RPI)"
> ([microservices.io](https://microservices.io/patterns/communication-style/rpi.html)),
> "Pattern: Saga" ([microservices.io](https://microservices.io/patterns/data/saga.html)), and
> Chris Richardson, "Dark matter force: minimize runtime coupling"
> ([microservices.io](https://microservices.io/articles/dark-energy-dark-matter/dark-matter/minimize-runtime-coupling.html)).
> 🔴 **No sandbox.** Version spine: JDK 25 · Spring Boot 4.1.0 / Spring Framework 7.0.8.

**This is the honest table the topic has been building toward. Take any request path and
classify each hop. Three categories genuinely require the callee's answer before the caller can
proceed, and a fourth — much the largest — contains calls that are synchronous because
synchronous is what a Java method call looks like. The categories are not subtle and the
classification takes minutes per endpoint. The reason nobody does it is that nothing forces the
question, which is why this chunk is a table rather than an argument.**

## The three that must be synchronous

**1 · A decision the caller is not allowed to make.**
Authorisation, authentication, a payment capture, a credit check, a regulatory eligibility
check. Some other party owns the decision, and proceeding without it is not "eventually
consistent" — it is *wrong*. You cannot capture a payment optimistically and reconcile later
unless the business has explicitly agreed to bear the losses that policy creates. Covered in
[26 · The decision that gates a write](06b-the-decision-that-gates-a-write.md).

**2 · An invariant that must hold at the moment of the write.**
A uniqueness constraint, a limit that must not be exceeded, an allocation that must not be
double-issued — where the *cost of being wrong* is greater than the cost of being unavailable.
Note the framing: it is not "must be consistent", it is "the compensation is unacceptable". If
you can cancel the order and apologise, the invariant does not need to hold synchronously. If
you cannot un-ship the item, it does.

**3 · A read whose answer only exists at the callee, and cannot be copied.**
A live quote from an external market, the current position of a vehicle, a one-time code. Not
"we don't have it locally" — **cannot** have it, because it is a fact about the present held by
somebody else. The distinguishing test is whether a copy would be *wrong* rather than merely
*stale*.

That is the complete list. Everything else is category four.

## The honest table

Applied to a typical order-placement path. The **Really?** column is the one to argue about.

| Hop | Usual justification | Really? | Right shape |
|---|---|---|---|
| Authorise payment card | must know if it succeeded | **Yes — category 1** | request/reply |
| Verify session / permissions | must know who is calling | **Yes — category 1** | request/reply, and usually already at the gateway |
| Reserve the last unit of stock | must not oversell | **Depends** — is a cancellation acceptable? | request/reply if not; event if it is |
| Fetch live FX rate for a foreign-currency total | rate must be current | **Yes — category 3** | request/reply, tightly budgeted |
| Fetch customer's name and tier | needed on the confirmation | **No** — reference data | local copy |
| Fetch product title, image, category | needed on the line items | **No** — reference data | local copy |
| Fetch loyalty points balance to display | user wants to see it | **No** — soft, or copy | soft dependency, omit on failure |
| Compute a discount from the loyalty tier | affects the total | **Depends** — is the tier copy fresh enough? | copy with a staleness budget |
| Write an audit record | compliance | **No** | event |
| Send the confirmation email | user expects it | **No** | event |
| Index the order for search | needed for the order list | **No** | event |
| Notify the warehouse | fulfilment must happen | **No** — must happen, need not happen *now* | event |
| Update the analytics warehouse | reporting | **No** | event |
| Invalidate the cached order list | list must be fresh | **No** | event |

Fourteen hops, **three genuinely synchronous**, two arguable, nine that are synchronous out of
habit. That ratio is not a rhetorical exaggeration; it is what a real classification tends to
produce, because the nine were never questioned.

The nine are [28 · Synchronous out of habit](06d-synchronous-out-of-habit.md).

## The two questions that do the classification

**"If the callee is down, what is the least-bad thing I could do?"**

- Fail the whole operation → possibly category 1 or 2. Continue to the second question.
- Serve a slightly worse answer → soft dependency, not category anything.
  [10](03e-hard-and-soft-dependencies.md).
- Do it later → event.
- Nothing, because nobody would notice → delete the call.

**"What breaks if the answer is thirty seconds old?"**

- Money moves incorrectly, or a rule is violated → category 1, 2 or 3. Keep it synchronous.
- A user sees a slightly stale name or count → copy it.
- Nothing → copy it, or delete the call.

Two questions, four minutes per hop, and they can be asked in a design review by someone who has
not read the code.

## The category that hides: "we need it for validation"

The most common defence of a synchronous hop is that it validates something. Validation splits
into two very different things, and conflating them is why hops survive review:

**Gating validation** — the write must not happen if the check fails, and a compensating action
is unacceptable. Category 2. Keep it synchronous.

**Advisory validation** — the check improves the outcome, and being wrong occasionally is
recoverable. "Does this customer exist?" is almost always advisory: if they do not, the order
fails downstream anyway, and you have paid a synchronous hop on 100% of requests to catch a case
that occurs in a fraction of a percent.

**The test is what happens when the check is wrong, not when it fails.** If a false positive is
survivable, the check is advisory and can be moved off the request path — done asynchronously, or
replaced by a constraint that catches it at the point where it actually matters.

## Sagas exist for the "depends" rows, and are somebody else's chapter

Rows like "reserve the last unit of stock" are where a multi-step business transaction with
compensations belongs. The Saga pattern states the mechanism:

> *"Implement each business transaction that spans multiple services as a saga. A saga is a
> sequence of local transactions. Each local transaction updates the database and publishes a
> message or event to trigger the next local transaction in the saga. If a local transaction
> fails because it violates a business rule then the saga executes a series of compensating
> transactions that undo the changes that were made by the preceding local transactions."*

and its cost, plainly:

> *"design compensating transactions that explicitly undo changes made earlier in a saga rather
> than relying on the automatic rollback feature of ACID transactions"*

🔴 **Sagas belong to phase 15 topic 10.** What belongs here is the decision input: a saga is what
you build when you have decided that an invariant does *not* need to hold synchronously and a
compensation is acceptable. If the compensation is not acceptable, no saga will help you and the
hop stays synchronous. Deciding that is this topic's job; building it is
[Phase 15's](../../phase-15-messaging-event-driven/README.md).

## Gotchas

**★ "Must happen" is confused with "must happen now" in almost every design discussion.**
The warehouse must be told about the order. It does not have to be told within the HTTP response.
Separating the two words is the single highest-yield rephrasing available in this topic, and it
resolves most "we can't make that asynchronous" objections on the spot.

**★ Advisory validation is defended as gating validation.** "We check the customer exists" sounds
like a rule and is usually a courtesy. Ask what happens if the check is *wrong* — not if it
fails — and if the answer is "the order fails later, which it would anyway", the hop is advisory
and does not belong on the request path.

**★ A category-1 dependency is still worth budgeting and bounding.** Deciding a hop must be
synchronous is not the end of the work: it still needs a timeout from the budget, a concurrency
cap, a defined meaning for a timeout, and an idempotency story if it is retried. "It has to be
synchronous" is sometimes used to close the conversation before those exist.

**★ The classification changes when the product changes.** A stock check is category 2 when
cancellations are unacceptable and category "event" the day the business decides overselling by a
small margin is cheaper than lost conversions. The table has to be revisited when the business
rules move, which is why it belongs in the design document rather than only in the code.

**★ Auth is category 1 and usually already handled at the edge.** If the gateway terminates
authentication, the service does not need its own synchronous identity call — it needs to trust a
validated token. Re-verifying per service is a common way to add a hard dependency on the identity
provider to every single request. **07 · API gateway** *(not written yet)* owns the edge; phase 13
owns the tokens.

**★ Category 3 is the smallest category and the one most often claimed.** "We can't copy it, it
changes constantly" is usually a claim about convenience rather than correctness. Ask what happens
if it is thirty seconds old, and insist on an answer in business terms. Genuinely uncopyable
facts — a live market price, a one-time code, a current physical position — are rare in a typical
line-of-business system.

## Interview questions

**★ Which interactions genuinely must be synchronous?**
Three kinds. A decision the caller is not allowed to make, where another party owns the answer and
proceeding without it is wrong rather than merely eventual — payment authorisation, authentication,
a credit decision. An invariant that must hold at the moment of the write, where the compensation
for being wrong is unacceptable rather than merely inconvenient. And a read whose answer only
exists at the callee and cannot be copied, because a copy would be *wrong* rather than *stale* —
a live market rate, a one-time code. Everything else is a design choice.

**★ How do you distinguish "must happen" from "must happen now"?**
By asking what the user or the business observes if it happens ten seconds later. The warehouse
must be told about an order — that is "must happen". Nothing in the user's experience or the
business's correctness depends on it being told inside the HTTP response — so it is not "must
happen now". The distinction resolves most objections to asynchrony, and the obligation it creates
is that "must happen" now needs a durable handoff and a monitored consumer rather than a stack
frame.

**★ Someone defends a synchronous hop as necessary validation. How do you test the claim?**
Ask what happens when the check is *wrong*, not when it fails. Gating validation means the write
must not occur and a compensating action is unacceptable — that is a real constraint. Advisory
validation means being occasionally wrong is recoverable, in which case you are paying a
synchronous hop on every request to catch a rare case that a downstream constraint would catch
anyway. Most "does X exist" checks are advisory once the question is put that way.

**★ Where does the saga pattern fit into this classification?**
It is what you build for the "depends" rows — an invariant you have decided does not have to hold
synchronously because a compensating action is acceptable. The saga executes a sequence of local
transactions and compensations when one fails, which is exactly the trade of "consistency now" for
"availability now plus a cleanup path". If the compensation is *not* acceptable — you cannot
un-ship an item, you cannot un-tell a customer their card was charged — a saga does not help and
the hop stays synchronous. Deciding which case you are in is architecture; building the saga is
phase 15's work.

**★ Your endpoint has fourteen outbound calls. Roughly how many would you expect to survive
classification?**
In a typical line-of-business path, a small handful — often two or three. The rest divide into
reference-data reads that should be local copies, notifications that should be events, and
advisory checks that should be constraints enforced somewhere cheaper. That ratio is not a
rhetorical device; it is what happens when nobody has ever been forced to justify a hop, because
adding one is a one-line change and nothing in the toolchain flags it as an architectural
decision.

{/* FOOTER */}
