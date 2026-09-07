---
title: "The same question gets three right answers — an SDE-2 builds one component correctly, a senior chooses between designs and says what each gives up, a staff engineer says where it breaks in two years"
sidebar_label: "01 · Design at each level"
sidebar_position: 1
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-07. Technical claims against the Google SRE book —
> [*Embracing Risk*](https://sre.google/sre-book/embracing-risk/),
> [*Service Level Objectives*](https://sre.google/sre-book/service-level-objectives/) — and the
> [Dynamo paper](https://www.allthingsdistributed.com/files/amazon-dynamo-sosp2007.pdf) (§2.2, §2.3,
> §4.5). What each level is *asked* has no primary source: stated as tendencies, never statistics.
> Examples on the bible's PERN storefront. **No sandbox run.**

**"Design a URL shortener" is one question with three correct answers, and the interviewer knows
which one they are waiting for before you speak.** An SDE-2 is expected to scope it, build one
coherent design and get one component demonstrably right. A senior is expected to put two or three
designs for the hard part on the board, choose one for a reason, and say what the choice costs —
unprompted. A staff engineer is expected to say which assumption breaks first, when, what to build
now versus later, and what the team will pay to operate it. The diagram can be identical at all
three levels. The *sentences around the diagram* are what is graded, and most candidates lose a
level not by being wrong but by answering one level below the loop they are in.

## The three answers, side by side

| | SDE-2 | Senior | Staff |
|---|---|---|---|
| **Asked to** | build it | choose it | own it |
| **Scoping** | asks the questions, writes the answers down | scopes, then *names what is deliberately out* and why | scopes, and says which out-of-scope item will be forced back in first |
| **The hard part** (key generation) | one working scheme — a base-62 counter, or random keys with a collision check | counter vs random vs hash-of-URL, each with its failure: the counter is a single point of contention, random keys need a uniqueness check, hashing leaks the URL and collides | which one the *org* can run: a ticket-server counter needs an on-call rota; random keys need a store that can do a cheap existence check at the write rate |
| **Numbers** | rough QPS and storage when asked | states them before drawing, and sizes the cache from the hot fraction | knows which number is uncertain, and designs so that being wrong by 10× is survivable |
| **Failure** | handles the obvious one (store down → error) | walks the diagram: balancer, primary, the one counter, the one region | asks which failure the business notices — a slow redirect loses revenue, a lost analytics event does not |
| **Trade-off sentence** | says it when asked | says it unprompted: "we chose X over Y because Z, and we pay with W" | adds the reversal condition: "and we would switch to Y when the write rate crosses…" |
| **Time horizon** | ships this quarter | ships and survives 10× | says what to build in week one, what in year one, and what never |

The rows are cumulative. A staff answer contains the senior answer, which contains the SDE-2
answer. What changes is not the amount of technology named but the amount of *judgement* shown per
box: **why this box, why not the other box, what happens when this box lies to you.**

## What "correctly" means at SDE-2

The SDE-2 bar is not "simple". It is *one component built so that a reviewer finds nothing to
fix*. For the shortener that is the create-link path. Correct means idempotent under retry, safe
under concurrent duplicates, and honest about its store. In the storefront the equivalent component
is order creation, which is why the loop keeps returning to it:

```ts
// order creation as an SDE-2 would be expected to write it: one transaction,
// one idempotency key, no double-order on a retried POST
import { Pool } from 'pg';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

type Line = { productId: string; qty: number; unitPriceCents: number };

export async function createOrder(userId: string, idempotencyKey: string, lines: Line[]) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. a retried request with the same key returns the same order, never a second one
    const existing = await client.query(
      'SELECT id FROM orders WHERE user_id = $1 AND idempotency_key = $2',
      [userId, idempotencyKey],
    );
    if (existing.rowCount) {
      await client.query('COMMIT');
      return { orderId: existing.rows[0].id, replayed: true };
    }

    // 2. reserve stock atomically; a row that cannot cover qty is not updated
    for (const line of lines) {
      const r = await client.query(
        'UPDATE inventory SET available = available - $1 WHERE product_id = $2 AND available >= $1',
        [line.qty, line.productId],
      );
      if (r.rowCount === 0) throw new Error(`out of stock: ${line.productId}`);
    }

    // 3. the unique index on (user_id, idempotency_key) is the real guard under concurrency;
    //    the SELECT above is the fast path, the index is the correctness path
    const order = await client.query(
      `INSERT INTO orders (user_id, idempotency_key, total_cents, status)
       VALUES ($1, $2, $3, 'PENDING_PAYMENT') RETURNING id`,
      [userId, idempotencyKey, lines.reduce((s, l) => s + l.qty * l.unitPriceCents, 0)],
    );
    await client.query('COMMIT');
    return { orderId: order.rows[0].id, replayed: false };
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}
```

An SDE-2 who writes this, explains why the unique index and not the `SELECT` is the guarantee, and
says what the `UPDATE … WHERE available >= $1` buys under concurrency, has cleared the bar. The
senior follow-up is already visible in the code: **the payment call is not in it.** Charging inside
the transaction holds a row lock across a network call to a provider; charging after it leaves an
order that is reserved but unpaid when the provider times out. Which one, and what cleans up the
other — that question is where the next level starts.

## What "choose" means at senior

A senior is graded on whether alternatives were *on the board* before one was picked. The habit is
mechanical and it is worth making explicit, because interviewers can only grade what they heard:

1. **Name the hard part.** In the shortener it is key generation and the read path; in checkout it
   is inventory contention and the payment boundary. Everything else is plumbing.
2. **Put two or three designs down**, each with the failure it invites. Not five — three is
   enough to show the space, five is stalling.
3. **Choose, with the reason tied to a requirement you wrote down earlier.** "Random keys, because
   we scoped to a single region and the store can do the existence check at 200 writes per second"
   is a senior sentence. "Random keys, they're standard" is not.
4. **Say the cost.** Every choice has one. The senior says it before being asked, in the shape
   *we chose X over Y because Z, and we pay for it with W*.

The Dynamo paper is the canonical example of this sentence written at length, and a senior who has
read it explains quorums differently. The design sacrifices consistency to stay writeable — and says
so in its abstract:

> *"To achieve this level of availability, Dynamo sacrifices consistency under certain failure
> scenarios."* — Dynamo, abstract

And it grounds the choice in a requirement, not a preference:

> *"the shopping cart service must allow customers to add and remove items from their shopping cart
> even amidst network and server failures. This requirement forces us to push the complexity of
> conflict resolution to the reads in order to ensure that writes are never rejected."* — §2.3

That is the whole senior rubric in two sentences: a requirement, a choice, and the price named
(conflict resolution moved to the read path). When you say "we'll use eventual consistency here",
the interviewer is waiting for the second half of that sentence.

The staff answer — the time axis, the organisation, and how to read which level the room expects —
continues in [01b · Staff, and reading the room](01b-staff-and-reading-the-room.md). The two files
are one topic; this half ends where "choose" ends.

## Gotchas

**★ Symptom: a strong SDE-2 answer, and no offer for the senior role.** Cause: one design, built
correctly, with the alternatives never mentioned. The interviewer graded judgement and heard
execution. Fix: before choosing anything hard, put the two rejected options on the board *with the
reason each was rejected*. In the shortener: "counter — single writer, contention; hash — leaks the
URL, collides on duplicates; random with an existence check — chosen, costs one read per write."

**★ Symptom: told the design was "over-engineered".** Cause: answering at staff level to a
question scoped at SDE-2 — multi-region and sharding for a link table sized at gigabytes. Fix:
size first, then let the numbers license the boxes. Say "at this size a single primary with a
replica is enough; sharding becomes necessary when the table passes what one node can hold — I'd
watch table size and p99 write latency for that."

**Symptom: "you never said what it costs."** Cause: choices stated as facts ("we'll use a cache")
rather than as trade-offs. Fix: attach the price to the sentence. "A cache in front of the redirect
path cuts store reads for the hot links, and we pay with stale redirects for the TTL after a link is
edited — acceptable because edits are rare and we scoped them out of the SLO."

**Symptom: the follow-up "what if writes are 10× reads?" stalls you.** Cause: a design remembered
rather than derived — the read-heavy cache was the *answer* rather than a consequence of the ratio.
Fix: rebuild from the numbers out loud: "then the cache stops mattering, the store's write
throughput is the constraint, and the counter becomes the bottleneck — I'd move to random keys and
partition the link table by key."

**Symptom: the trade-off sentence has no requirement in it.** Cause: "we chose Kafka because it
scales" — the reason names a property, not one of *your* requirements. Fix: point the reason at a
number or a journey you wrote down: "we chose a log over a queue because two consumers — fulfilment
and analytics — need the same order events, and a queue would deliver each to one of them."

**Symptom: the diagram is complete and the interviewer looks unconvinced.** Cause: the diagram was
the deliverable; the judgement never left your head. Fix: narrate the *why not* at each box as you
draw it. One sentence per box: what it replaces and what it would break if removed.

**Symptom: the SDE-2 component is "correct" but you cannot say why each line is there.** Cause:
the pattern was copied — idempotency key, unique index, conditional decrement — without the failure
each one prevents. Fix: for every guard in the code, name the race it closes. The unique index
closes two concurrent first requests with the same key; the conditional `UPDATE` closes two
checkouts racing for the last unit; the transaction closes a crash between the decrement and the
insert. A guard you cannot explain is one the interviewer assumes you would drop under pressure.

## Interview questions

**★ What is the difference between an SDE-2 answer and a senior answer to "design a URL
shortener"?**
The SDE-2 answer scopes the problem and builds one correct design: an API, one key-generation
scheme, a store, a redirect path with a cache, and one component (usually create-link or the
redirect) worked through properly. The senior answer contains all of that and adds the choosing:
two or three schemes for key generation on the board with the failure each invites, one chosen
for a reason tied to a stated requirement, and the cost of that choice said unprompted — "random
keys, because we scoped to one region and the store can absorb an existence check per write; we
pay with one extra read per create." The follow-up that changes a number is where the two answers
separate: the derived design re-derives, the remembered one stalls.

**★ Why do interviewers grade the sentences around the diagram rather than the diagram?**
Because the diagram is learnable and the judgement is not. A memorised diagram for a shortener,
a news feed or a chat system is the same for every candidate, so it carries no information about
the person. Scoping, estimation, the trade-off sentence, the failure walk and the reaction to a
changed constraint are the behaviours that predict how the candidate will make decisions at work
with no interviewer present. The diagram is the occasion for those behaviours, not the deliverable.

**★ Give the trade-off sentence for choosing eventual consistency in a shopping cart.**
"We chose to keep the cart writeable during a partition over keeping it consistent, because a
rejected add-to-cart loses a sale and a briefly stale cart does not; we pay for it with conflict
resolution on the read path — merging divergent versions when the client reads the cart." That is
the Dynamo paper's own reasoning: the requirement that writes are never rejected forces the
complexity to the reads.

**What does "one component built correctly" mean, concretely, for order creation?**
Idempotent under retry (the same key returns the same order, guaranteed by a unique index rather
than a read-then-write), atomic stock reservation (the decrement is conditional on availability in
the same statement), everything in one transaction, and the payment boundary explicitly *outside*
it with a stated reason — a row lock must not span a network call to a provider. Being able to say
why each of those is there is the bar; writing the code without the reasons is not.

**Why is "we'll use Kafka because it scales" a junior sentence even when Kafka is the right
choice?**
The reason names a property of the tool rather than a requirement of the system. It cannot be
graded, because it would be equally true of any question. The senior form ties the choice to
something written on the board earlier — two consumers need the same events, or the order of
events per key matters, or the producer must not block on the consumer — and names the cost that
comes with it: operating a cluster, or a managed service's throughput ceiling.

**Why is "three alternatives" the right number to put on the board, not one or five?**
One alternative is a fact, not a choice — nothing was weighed. Five is stalling: the interviewer
cannot tell whether you can decide. Two or three show the shape of the design space (usually a
centralised option, a randomised one, and a derived one) and leave time to choose and to say the
cost. If a fourth is genuinely relevant, name it in one clause as "also possible, rejected
because…" rather than developing it.

---

← Index: [Phase 0 — What system design interviews test](README.md) · Next → [01b · Staff, and reading the room](01b-staff-and-reading-the-room.md)
