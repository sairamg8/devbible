---
title: "Every choice has a cost, and the sentence that says it — \"we chose X over Y because Z, and we pay for it with W\" — is the one the interviewer is waiting to write down; said unprompted, it fills the trade-off line, said on request it only proves you knew"
sidebar_label: "10 · Trade-offs in one sentence"
sidebar_position: 10
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-07. Method; the one quoted example of a trade-off written at length is the
> [Dynamo paper](https://www.allthingsdistributed.com/files/amazon-dynamo-sosp2007.pdf) §2.3
> (verbatim); the cost-of-reliability quote is the Google SRE book,
> [*Embracing Risk*](https://sre.google/sre-book/embracing-risk/). The rubric line it serves is on
> [phase 0's rubric page](../phase-0-the-interview/03-the-rubric.md). **No sandbox run.**

**A design decision without its cost is a fact, and facts are not graded. The trade-off sentence
turns every decision into evidence: *we chose X over Y because Z, and we pay for it with W* —
the choice, the rejected alternative, a reason that points at a requirement already on the
board, and the price.** Four clauses, ten seconds, said in the same breath as the decision. The
rubric's trade-off line is filled only by sentences said *unprompted*; a cost supplied when the
interviewer asks "and the downside?" is evidence that you knew it, which is the depth line, not
the trade-off line. The four canonical axes — consistency against availability, latency against
durability, simplicity against flexibility, cost against all of them — cover most decisions, and
the storefront's checkout produces at least eight such sentences in a normal round. This page
is the sentence, its clauses, the axes, and a bank of the storefront's, so that the habit is
built before it is needed under a clock.

## The four clauses

| Clause | What it must contain | The junior version |
|---|---|---|
| **we chose X** | the decision, concretely — "a log for order events" | "we'll use Kafka" |
| **over Y** | the alternative that was on the board — "over a queue" | (absent — no alternative was considered) |
| **because Z** | a reason pointing at a requirement written earlier — "because fulfilment and analytics both need the same events" | "because it scales" |
| **and we pay with W** | the price, specific — "offset management on the consumer side and a cluster to run" | (absent, or "no real downside") |

The test of clause Z is whether it would be equally true for a different question. "Because it
scales" is true of every system and therefore names nothing; "because two consumers need the
same events" is true of *this* system and traces to journey 4 on the board. The test of clause
W is whether the interviewer could argue with it — a real cost is one someone would push back
on.

## The four axes

Most decisions in a design round sit on one of four axes, and naming the axis is a shortcut to
the sentence:

**Consistency against availability.** The cart stays writeable during a partition and pays
with divergent versions merged on read; inventory refuses writes it cannot verify and pays with
unavailability during a primary failover. The Dynamo paper is the canonical statement of one
end, written as a requirement, a choice and a price:

> *"For a number of Amazon services, rejecting customer updates could result in a poor customer
> experience. For instance, the shopping cart service must allow customers to add and remove
> items from their shopping cart even amidst network and server failures. This requirement
> forces us to push the complexity of conflict resolution to the reads in order to ensure that
> writes are never rejected."* — Dynamo, §2.3

**Latency against durability.** A write acknowledged from memory is fast and may be lost; a
write acknowledged after replication is durable and pays a round trip. Orders take the round
trip; page-view analytics do not.

**Simplicity against flexibility.** One deployable is simpler to run and pays with coupled
scaling and a shared release; services split by scaling profile are flexible and pay with
network hops, distributed transactions and an operations bill.

**Cost against all of them.** Cross-region replication, a second cache tier, a warm standby —
each buys one of the above and is paid for monthly. The SRE book's version for reliability:

> *"Extreme reliability comes at a cost: maximizing stability limits how fast new features can
> be developed and how quickly products can be delivered to users, and dramatically increases
> their cost."* — SRE book, *Embracing Risk*

## The storefront's sentences

A bank of the trade-offs a checkout design produces, each in the four-clause form. These are
the sentences to have rehearsed, because most of them come up in every version of the question:

1. **Commit before the provider call.** "We commit the order before calling the provider, over
   charging inside the transaction, because a row lock must not span a network call to a system
   that can take thirty seconds; we pay with a pending state, an expiry that releases stock, and
   a reconciliation job."
2. **A log over a queue for order events.** "…because fulfilment, notifications and the search
   indexer all need the same events; we pay with consumer-side offsets and a cluster to run —
   with one consumer we'd use a queue."
3. **The outbox over publishing after commit.** "…because a crash between commit and publish
   would lose the event; we pay with a publisher process and the possibility of double-publish,
   which consumers absorb by being idempotent."
4. **The cart in a key-value store, eventually consistent.** "…over the relational primary,
   because it is a single-key read-modify-write on every page view and may be lost; we pay with
   a merge on read when two devices edit the same cart."
5. **Read-your-writes from the primary for the buyer's fresh order.** "…over reading from the
   replica everywhere, because the confirmation page must show the order just placed; we pay
   with primary load for that one read pattern."
6. **A cache in front of the product catalogue.** "…over serving from the replica, because
   product reads are two orders of magnitude above writes and the hot set is a fifth of the
   catalogue; we pay with staleness for the TTL after a price change, bounded by invalidation
   from the outbox."
7. **Admission with a wait page on sale day.** "…over provisioning for the full spike, because
   the inventory row cannot take a hundred times its normal write rate whatever the fleet size;
   we pay with a wait for some customers and a queue to operate."
8. **Reservation with a TTL over immediate decrement.** "…because an unpaid checkout must give
   its stock back; we pay with an expiry job and a window in which stock is held by carts that
   will never pay."
9. **One region with asynchronous replication to a second.** "…over synchronous multi-region,
   because a cross-continent round trip on every write would consume the checkout latency
   budget; we pay with a recovery point — the writes not yet replicated when a region fails."
10. **Managed database and managed log.** "…over self-hosted, because the team is six people;
    we pay with the provider's ceilings and bill, which are far above our estimate."

Each is said at the moment the decision goes on the board, not collected for the end.

## When to say it

In the same breath as the decision, every time — which is the habit that needs practice. The
diagnostic is the "why?" question: an interviewer who asks "why a log?" is trying to fill the
trade-off line for you, and two such questions in a row mean the sentences are not arriving
unprompted. Once they arrive, the "why?" questions stop, because the line is filled.

Two further moments. At each ten-minute summary, the decisions so far are restated with their
costs in a clause each ([phase 0's communication page](../phase-0-the-interview/09-communication-mechanics.md)).
And in the deep dive, the two alternatives on the board each get the sentence — the chosen one
with its price, the rejected ones with the failure that rejected them.

## The reversal clause

A senior sentence often has a fifth clause: *and we would switch to Y when…* — the condition
under which the trade reverses. "A cache for the catalogue; we'd drop it if writes rose to
within an order of magnitude of reads." "Asynchronous replication; we'd pay for synchronous on
the orders table alone if the business decided a lost order was worse than a slower checkout."
The reversal clause is what makes the follow-up easy: when the interviewer changes the
constraint, the answer was already on the board ([phase 0, reasoned beats memorised](../phase-0-the-interview/08-reasoned-wrong-beats-memorised-right.md)).

## Gotchas

**★ Symptom: "the design was fine; trade-offs were weak."** Cause: every decision stated as a
fact, the cost supplied only when asked. Fix: the four-clause sentence in the same breath as
each decision; count them on a recording — a checkout design should produce eight or more.

**★ Symptom: "why a log?" asked twice.** Cause: the interviewer filling the trade-off line for
you. Fix: read the question as "say the trade-off" and answer in the form; after two such
answers the question stops.

**Symptom: clause Z is "because it scales" or "because it's standard".** Cause: a reason that
names a property, not a requirement. Fix: point Z at something written on the board — a
journey, a number, a consistency line — so it could not be said of a different system.

**Symptom: clause W is "no real downside".** Cause: the price unexamined. Fix: every choice has
one; if you cannot find it, the alternative was not seriously considered — find the failure
the alternative would have avoided, and that is W.

**Symptom: no alternative on the board.** Cause: clause Y missing; the decision was a reflex.
Fix: the rejected option in one clause with the failure that rejected it: "over a queue, which
delivers each event to one consumer."

**Symptom: all the trade-offs delivered as a list at the end.** Cause: collected rather than
said. Fix: in the same breath as the decision, and restated in a clause at each summary; a list
at the end reads as an afterthought.

**Symptom: the follow-up changed a constraint and the trade reversed, and you had not said
when it would.** Cause: no reversal clause. Fix: add "and we'd switch when…" to the load-bearing
sentences; the follow-up then finds its answer already on the board.

## Interview questions

**★ What is the trade-off sentence, and why does saying it unprompted matter?**
"We chose X over Y because Z, and we pay for it with W" — the decision, the alternative that
was on the board, a reason that points at a requirement written earlier, and the specific
price. It matters unprompted because the rubric's trade-off line is filled only by volunteered
evidence: a cost supplied when the interviewer asks "and the downside?" proves the candidate
knew it, which fills the depth line, but not that stating costs is a habit, which is what the
trade-off line grades. A senior loop weights that line heavily.

**★ Give four trade-off sentences from the storefront's checkout.**
We commit the order before calling the provider, over charging inside the transaction, because
a row lock must not span a thirty-second network call; we pay with a pending state, a stock
expiry and a reconciliation job. We use a log over a queue for order events because three
consumers need the same events; we pay with offset management and a cluster. We write an outbox
row in the order's transaction over publishing after commit, because a crash between the two
would lose the event; we pay with a publisher and the chance of double-publish, absorbed by
idempotent consumers. We keep the cart in a key-value store, eventually consistent, over the
relational primary, because it is a single-key read-modify-write on every page view; we pay with
a merge on read when two devices edit it.

**What are the four axes most trade-offs sit on?**
Consistency against availability — the cart stays writeable and merges on read; inventory
refuses what it cannot verify and is unavailable during failover. Latency against durability —
a write acknowledged from memory versus after replication; orders pay the round trip, analytics
do not. Simplicity against flexibility — one deployable versus services split by scaling
profile, paid for in hops and operations. Cost against all of them — replication, cache tiers
and standbys each buy one of the above monthly. Naming the axis is a shortcut to the sentence.

**What makes a reason ("because Z") junior or senior?**
Whether it could be said of a different system. "Because it scales" and "because it's standard"
name properties of the tool and are true everywhere, so they carry no information. "Because
fulfilment, notifications and the indexer all need the same events" is true of this design and
traces to a journey on the board, so the interviewer can grade it — and argue with it, which is
the same thing.

**What is the reversal clause, and why add it?**
"And we would switch to Y when…" — the condition under which the trade reverses: the cache is
dropped if writes approach reads; synchronous replication is paid for on the orders table if a
lost order becomes worse than a slower checkout. It makes the constraint-changing follow-up
easy, because the answer is already on the board, and it is the difference between a design
presented as a snapshot and one presented as a set of decisions with triggers.

---

← Prev: [09 · Choosing the deep dives](09-choosing-the-deep-dives.md) · Index: [Phase 1 — The method](README.md) · Next → **Bottlenecks and single points of failure** *(not written yet)*
