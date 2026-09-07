---
title: "Non-functional requirements are the numbers — scale, latency at p50 and p99, availability, consistency per journey, durability, retention, compliance — and each one you skip is a question you will be asked"
sidebar_label: "02 · Non-functional requirements"
sidebar_position: 2
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-07 against the Google SRE book —
> [*Service Level Objectives*](https://sre.google/sre-book/service-level-objectives/),
> [*Embracing Risk*](https://sre.google/sre-book/embracing-risk/) — for the SLI/SLO vocabulary and
> the availability formulas; the rest is method. Vocabulary per
> [phase 0's contract](../phase-0-the-interview/04-the-vocabulary-contract.md). Examples on the
> PERN storefront. **No sandbox run.**

**Non-functional requirements are where the design's numbers come from, and a design with no
numbers is a drawing.** Scale — daily active users, peak requests per second, the read-to-write
ratio — decides whether one store survives. Latency at p50 and p99, per journey, decides what may
be synchronous. Availability as a target with a formula decides where redundancy is spent.
Consistency per journey — not one setting for the system — decides which paths need a single
writer and which may converge later. Durability decides which writes are synchronous to
replicated storage. Retention and compliance decide what is stored, for how long, where, and
what must be deletable. Each of these is a line the interviewer expects to see and will ask about
if it is missing; each is also an *input* to a later step — estimation, the API, the deep dive —
so skipping one does not save time, it moves the question to a worse moment.

## The seven, with the storefront's answers

| Requirement | The question to settle | The storefront's checkout, as an example |
|---|---|---|
| **Scale** | daily active users; peak QPS; read : write | a million daily users; a sale-day peak of 300 checkouts a second; catalogue reads two orders of magnitude above writes |
| **Latency** | p50 and p99 per journey, at a stated load | product page p99 under 300 ms; checkout p99 under 500 ms at the peak, dominated by the provider |
| **Availability** | the target, and which formula | three nines on the order API, request-based; the product page may be lower |
| **Consistency** | per journey — what must a reader see, and when | inventory must never oversell (single writer, conditional decrement); the cart may be eventually consistent; a customer must see their own order immediately after placing it |
| **Durability** | which writes must never be lost | a placed order and its payment state, synchronous to replicated storage; page-view analytics are best-effort |
| **Retention** | how long data lives, and the growth it implies | orders for seven years (a placeholder — the real figure is a legal question); carts for thirty days; analytics rolled up after ninety |
| **Compliance** | what regulates the data and where it may live | card data never touches our systems (the provider holds it); personal data deletable on request; region pinning if the interviewer says "global" |

The figures in the table are *assumptions stated for the example*, which is exactly how they
should be presented in the round: "I'll assume a million daily users and a sale peak of three
hundred checkouts a second — correct me if you have different numbers."

## Targets, not adjectives

The SRE book's vocabulary is the translation the interviewer performs on your words, so use it
first:

> *"An SLI is a service level indicator—a carefully defined quantitative measure of some aspect
> of the level of service that is provided."* · *"An SLO is a service level objective: a target
> value or range of values for a service level that is measured by an SLI."* — SRE book, ch. 4

"Highly available" is an adjective. "Three nines, measured as successful requests over total
requests over a rolling thirty days" is an SLO on an SLI, and it names the formula:

> *"Availability = Successful Requests / Total Requests"* — SRE book, ch. 3

The same translation applies to latency ("fast" → "p99 under 500 ms at 300 requests a second"),
durability ("never lose an order" → "a committed order survives the loss of any single node"),
and consistency ("consistent" → "a customer reads their own order immediately; other customers
may see it within a second"). A requirement that cannot be written as an indicator and a target
is not yet a requirement.

## Consistency is per journey

The most common failure in this step is one consistency setting for the whole system. Systems
do not have a consistency level; journeys do. The storefront has at least three in one design:

- **Inventory decrement** — must never oversell: a conditional write on one primary, no
  replica lag on the write path. The invariant is the requirement.
- **Order placement** — read-your-writes for the placing customer: after "place order" returns,
  the order-history read must show it, which rules out reading from a lagging replica for that
  user for that window.
- **Cart** — eventual is fine: a briefly stale cart costs nothing, and staying writeable during
  a partition is worth more than agreement between replicas.

Stating the three separately is the senior signal, because each one drives a different part of
the diagram — the single writer, the read-after-write routing, the replicated cache — and a
single "strong consistency" would have made the cart slower for no benefit.

## Availability: pick the formula, then argue the number down

Two formulas exist and give different answers for the same outage:

> *"Availability = Uptime / (Uptime + Downtime)"* · *"instead of using metrics around uptime,
> we define availability in terms of the request success rate."* — SRE book, ch. 3

Request-based counts a partial outage as the fraction of users it hit; uptime-based counts it
as up or down. Say which you are using. Then set the target per journey and be prepared to argue
for *less* where the user cannot tell — the SRE book's cost curve licenses it:

> *"an incremental improvement in reliability may cost 100x more than the previous increment."*
> — SRE book, ch. 3

"Checkout gets three nines; the product page gets two and a half and a cache that serves stale
on failure; analytics gets best effort" is a graded sentence. "Everything five nines" is not,
because it cannot be built with the team and the budget the interviewer has in mind.

## Durability and retention are the storage design

Durability decides which writes are synchronous to replicated storage and which can be
acknowledged from memory. Retention decides the growth rate — the storage estimate in
[03 · Back-of-the-envelope estimation](03-back-of-the-envelope-estimation.md)
is retention times write rate times record size — and the archival tier. The two together are
most of the storage part of the diagram before it is drawn: orders durable and retained for
years go to the replicated primary with an archive; carts, short-lived and recoverable, go to a
store that may lose them; analytics, best-effort and rolled up, go to an append-only sink.

## Compliance: the requirement that changes the diagram's borders

Three compliance facts change a design's shape and cost nothing to state:

- **Card data** — kept out of your systems entirely by tokenising through the provider; the
  design then never stores a card number, and an entire class of controls disappears. Say it.
- **Personal data** — deletable on request, which means every store that holds it needs a
  deletion path, including backups and the analytics sink; "we'd anonymise the order and keep
  the aggregate" is the usual answer.
- **Residency** — if "global" is in the prompt, data may have to stay in a region, which turns
  multi-region from a latency decision into a legal one and constrains replication topology.

None of these needs a legal citation in the round; naming them is the evidence.

## Writing them on the board

Under the functional requirements, as a short block, each line an indicator and a target:

```text
Scale       1M DAU · peak 300 checkouts/s · catalogue reads ≫ writes
Latency     product p99 < 300 ms · checkout p99 < 500 ms @ peak
Availability order API 99.9% (request-based, 30-day) · product page lower, cache serves stale
Consistency inventory: never oversell · order: read-your-writes for the buyer · cart: eventual
Durability  order + payment state: replicated, synchronous · analytics: best effort
Retention   orders 7y (assumed) · carts 30d · analytics rolled up @ 90d
Compliance  no card data stored (provider tokenises) · PII deletable · residency if global
```

Seven lines, ninety seconds, and every later step has its inputs.

## Gotchas

**★ Symptom: a diagram with no numbers, and "how many requests is that?" at minute fifteen.**
Cause: non-functional requirements skipped as a detour. Fix: the seven lines before the first
box; they are the inputs to estimation and the API, not a detour from them.

**★ Symptom: "strong consistency everywhere" and a slow cart.** Cause: one consistency setting
for the system. Fix: consistency per journey — the invariant for inventory, read-your-writes for
the buyer's order, eventual for the cart — each driving a different part of the diagram.

**Symptom: "highly available" on the board, and "what does that mean?"** Cause: an adjective
where a target was needed. Fix: the SLI and the SLO with its formula: three nines, request-based,
over thirty days.

**Symptom: five nines for everything, and "what would that cost?"** Cause: reliability targets
set without the cost curve. Fix: per-journey targets, argued down where the user cannot tell,
using the SRE book's point that increments cost non-linearly.

**Symptom: the storage estimate came out tiny because retention was never stated.** Cause:
retention treated as operations detail. Fix: retention is the multiplier in the storage
estimate; state it per data class.

**Symptom: a design that stores card numbers.** Cause: compliance not considered. Fix: the
provider tokenises; card data never enters the system; say so in the requirements and the
diagram loses a class of controls.

**Symptom: "global" in the prompt, replication drawn for latency, and "where may the data
live?"** Cause: residency missed. Fix: compliance line — residency constraints turn multi-region
into a legal question; ask or assume, and write it down.

**Symptom: latency targets with no load attached.** Cause: latency stated as a constant. Fix:
"p99 under 500 ms at 300 checkouts a second"; above that, say what sheds.

## Interview questions

**★ What non-functional requirements do you write down, and why each?**
Scale — DAU, peak QPS, read-to-write — because it decides whether one store survives; latency at
p50 and p99 per journey at a stated load, because it decides what may be synchronous;
availability as an SLO with its formula, because it decides where redundancy is spent;
consistency per journey, because different journeys need a single writer, read-your-writes, or
nothing; durability, because it decides which writes are synchronous to replicated storage;
retention, because it multiplies into the storage estimate and sets the archive tier; and
compliance, because card data, personal data and residency change the diagram's borders. Each is
an input to a later step, so skipping one moves the question to a worse moment.

**★ Why is consistency a per-journey requirement rather than a system property?**
Because the invariants differ. Inventory must never oversell, so its decrement is a conditional
write on a single primary with no replica lag on the path. A customer must see their own order
immediately after placing it — read-your-writes — which constrains where that read is served
from, for that user, for a window. The cart only needs to stay writeable and converge, so it can
be eventually consistent and faster for it. One setting would either slow the cart for nothing
or risk the inventory invariant; three settings drive three different parts of the diagram.

**Turn "highly available" into a requirement.**
An indicator and a target with a formula: availability measured as successful requests over
total requests, over a rolling thirty days, with a target of 99.9% on the order API — and a
lower target on the product page, where a cache serving stale content on failure is acceptable.
Naming the request-based formula matters because the uptime-based one counts a partial outage
differently, and saying the target per journey rather than for the system is what lets the
number be argued down where users cannot perceive the difference.

**How do durability and retention shape the storage part of the design?**
Durability sorts writes into those that must be synchronous to replicated storage — a placed
order and its payment state — and those that may be acknowledged from memory or lost —
page-view analytics. Retention multiplies the write rate and record size into a storage estimate
and decides the archive tier: orders kept for years go to the replicated primary with archival,
carts kept for days go to a store that may lose them, analytics rolled up after ninety days go to
an append-only sink. Most of the storage diagram follows from the two lines.

**Which compliance facts should you state even without being a lawyer?**
That card data never enters the system because the payment provider tokenises it, which removes
a class of controls from the design; that personal data must be deletable on request, so every
store holding it — backups and the analytics sink included — needs a deletion or anonymisation
path; and that "global" may mean data residency, which turns multi-region replication from a
latency decision into a legal constraint on topology. Naming them is the evidence; citations are
not expected.

---

← Prev: [01 · Functional requirements](01-functional-requirements.md) · Index: [Phase 1 — The method](README.md) · Next → [03 · Estimation](03-back-of-the-envelope-estimation.md)
