---
title: "Latency is not throughput, availability is not durability, consistency is not correctness, scalability is not performance, reliability is not resilience — the words are a contract, and using them loosely is the fastest way to sound junior"
sidebar_label: "04 · The vocabulary contract"
sidebar_position: 5
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-07 against the Google SRE book —
> [*Service Level Objectives*](https://sre.google/sre-book/service-level-objectives/),
> [*Embracing Risk*](https://sre.google/sre-book/embracing-risk/) — the
> [Dynamo paper](https://www.allthingsdistributed.com/files/amazon-dynamo-sosp2007.pdf) §2.3 and
> [Jepsen's consistency models](https://jepsen.io/consistency/models). Code is TypeScript targeting
> Node 24 (LTS); **nothing was run**.

**Five pairs of words carry most of a design conversation, and each pair names two different
things that are routinely used as synonyms.** Latency is a time per request; throughput is a count
per unit time; they trade against each other through queueing. Availability is whether the service
answers; durability is whether the data survives. Consistency is a property of what readers can
observe across replicas; correctness is whether the application's invariants hold. Scalability is
how capacity responds to added resources; performance is how fast the system is at a given load.
Reliability is doing the expected thing over time; resilience is recovering when something has
already gone wrong. An interviewer hears the pair used interchangeably and downgrades everything
that follows, because the design decisions that hang off each word are different.

## The five pairs, at a glance

| Word | Names | Measured as | Storefront example |
|---|---|---|---|
| **Latency** | time for one request | a percentile (p50, p99) over a window | checkout p99 under 500 ms |
| **Throughput** | requests completed per unit time | requests/second, sustained | 300 checkouts/second at the sale peak |
| **Availability** | the service answers correctly | successful requests ÷ total, or uptime ÷ (uptime + downtime) | three nines on the order API |
| **Durability** | data, once accepted, survives | probability of loss over a period | a paid order is never lost |
| **Consistency** | what readers can observe across replicas | a model (linearizable → sequential → causal → eventual) | read-your-writes after placing an order |
| **Correctness** | the application's invariants hold | an invariant, checked | stock never goes negative; money is conserved |
| **Scalability** | capacity grows with added resources | capacity per added unit; the cost curve | double the pods, double the checkout rate |
| **Performance** | speed at a given load | latency and throughput at that load | 50 ms p50 on the product page today |
| **Reliability** | does the expected thing, over time | SLOs met over a window | orders confirmed within a minute, month after month |
| **Resilience** | recovers from failure already happening | time to recover, blast radius, graceful degradation | search down, checkout still works |

## Latency vs throughput

Latency is how long one request takes; throughput is how many complete per second. They are not
inverses. A system can have low latency and low throughput (one fast worker) or high throughput and
high latency (a deep batch pipeline). They are coupled by queueing: as offered load approaches
capacity, requests wait, and latency rises steeply while throughput flattens — the reason a
"latency target" in a requirements list is only meaningful *at a stated load*.

Two consequences for the board. First, **latency is a distribution, reported as a percentile**, and
the percentile you choose is a design decision: p50 describes the typical user, p99 describes the
one in a hundred who hits the tail — and a page that makes twenty backend calls hits some call's
tail on most views. Second, **throughput is a capacity claim**, and stating it obliges you to say
what happens above it: queue, shed, or degrade.

```ts
// what the two words compute to — the shapes an SLI dashboard actually holds
export function percentile(sortedMs: readonly number[], p: number): number {
  // nearest-rank: the value at or above which p% of samples fall
  if (sortedMs.length === 0) throw new RangeError('no samples');
  const rank = Math.ceil((p / 100) * sortedMs.length);
  return sortedMs[Math.max(0, rank - 1)];
}

export function throughputPerSecond(completed: number, windowMs: number): number {
  return completed / (windowMs / 1000);
}

// request-based availability, the SRE book's second form
export function availability(successful: number, total: number): number {
  return total === 0 ? 1 : successful / total;
}
```

The functions are trivial; the point is that each word has a *formula*, and a requirement that
cannot be written as one of them is an adjective, not a requirement.

## Availability vs durability

Availability is whether the service answers correctly *now*; durability is whether data, once
accepted, is still there *later*. A store can be down for a day and lose nothing (unavailable,
durable). A store can answer every request and silently lose writes on a crash (available, not
durable). The SRE book keeps them as separate indicators:

> *"Availability, or the fraction of the time that a service is usable. It is often defined in terms
> of the fraction of well-formed requests that succeed, sometimes called yield."* — SRE book, ch. 4

> *"Durability—the likelihood that data will be retained over a long period of time—is equally
> important for data storage systems."* — SRE book, ch. 4

Availability has two standard formulas, and the choice between them is itself a design statement —
uptime-based counts a partial outage as either up or down; request-based counts the requests that
failed:

> *"Availability = Uptime / (Uptime + Downtime)"* · *"instead of using metrics around uptime, we
> define availability in terms of the request success rate."* · *"Availability = Successful
> Requests / Total Requests"* — SRE book, ch. 3

For the storefront: the product page can tolerate lower availability than the order API, but a
*paid* order needs durability that nothing else on the site needs — which is why the write path for
orders is synchronous to a replicated store and the write path for page views is not. Saying
"the orders database must be highly available" when you mean "a paid order must never be lost"
leads the design to replicas for reads when it needed synchronous replication for writes.

## Consistency vs correctness

Consistency, in the distributed-systems sense, is a property of *what readers can observe* when
data is replicated: whether a read reflects the latest write, whether two readers can disagree,
whether a reader can see its own write. It comes in models, and the models form a hierarchy:

> *"When we say that model x implies y, we mean that for every history where x holds, y does too;
> x is 'stronger' than y."* · *"For single-object models, strict serializable implies linearizable,
> which implies sequential, which implies causal."* — Jepsen, consistency models

Correctness is different: it is whether the *application's* invariants hold — stock never negative,
every debit has a credit, a seat is booked at most once. A linearizable store can hold incorrect
data (the code decremented stock below zero, consistently, on every replica). An eventually
consistent store can be perfectly correct if the invariant tolerates temporary divergence, which is
precisely Dynamo's argument for the cart:

> *"Dynamo is designed to be an eventually consistent data store; that is all updates reach all
> replicas eventually."* — Dynamo, §2.3

The interview sentence that shows the distinction: "the cart can be eventually consistent because
its invariant — the user sees what they added — survives a merge; inventory cannot, because its
invariant — never oversell — does not survive two replicas each selling the last unit." That is a
correctness argument choosing a consistency model, which is the right direction. The wrong
direction is "we'll use strong consistency to be safe", which buys the observation property and
says nothing about the invariant.

## Scalability vs performance

Performance is how fast the system is at a given load: the latency and throughput you measure
today. Scalability is how capacity responds when you add resources: whether doubling the workers
doubles the throughput, and what it costs. A system can be fast and unscalable (a single hot
process with everything in memory) or scalable and slow (a horizontally sharded store where every
request crosses the network twice).

The distinction matters because the fixes are different. A performance problem is fixed by making
the request cheaper — a better query, a cache, less serialisation. A scalability problem is fixed
by removing the thing that stops added resources from helping — a shared lock, a single primary, a
coordinator that every request touches. Telling the interviewer "we'd scale it horizontally" in
response to a *latency* complaint is the classic confusion: more pods do nothing for a request that
is slow on its own.

The storefront's inventory row is the illustration: at the sale peak the checkout is *slow* because
every checkout waits on one row's lock. Adding order-service pods does not help — the row is the
serialisation point. The scalability fix is to remove it (a reservation ledger, per-product
counters); the performance fix would be to make each lock hold shorter. Which one you reach for is
what the interviewer is listening for.

## Reliability vs resilience

Reliability is the probability that the system does what is expected over a period — in practice,
that its SLOs are met over a window. Resilience is the capacity to keep providing service, possibly
degraded, when a fault has *already* occurred, and to recover from it. Reliability is an outcome
measured over time; resilience is a set of properties (redundancy, isolation, graceful degradation,
fast recovery) that produce that outcome under failure.

The pair is confused in the sentence "we'll make it reliable by adding retries." Retries are a
resilience mechanism; whether they make the system more reliable depends on the failure — against a
transient network error they do, against an overloaded dependency they make the outage worse. The
SRE book's warning is the cost side:

> *"Extreme reliability comes at a cost: maximizing stability limits how fast new features can be
> developed and how quickly products can be delivered to users, and dramatically increases their
> cost."* — SRE book, ch. 3

The storefront sentence: "search is allowed to fail — the page renders without the suggestions
panel — so that checkout stays reliable; that isolation is resilience, and the reliability target
is on checkout only."

## Words that are frequently confused, briefly

- **Fault vs failure.** A fault is a component doing the wrong thing (a disk returning bad
  sectors); a failure is the system not delivering its service. Fault tolerance is preventing
  faults from becoming failures.
- **Error rate vs error budget.** The rate is an SLI; the budget is the SLO's complement — the
  amount of unreliability you are *allowed* to spend, which is what licenses risky deploys.
- **Bandwidth vs throughput.** Bandwidth is the link's capacity; throughput is what you achieve
  through it.
- **Sync vs async.** Synchronous means the caller waits for the result; asynchronous means the
  work completes later and the caller is told, or polls. "Async" is not a performance word — it
  moves latency, it does not remove it.
- **Idempotent vs safe.** Safe means no state change is expected; idempotent means repeating has
  the same effect as doing it once. A `DELETE` is idempotent and not safe; a `GET` is both.
- **Hot, warm and cold standby.** Hot takes traffic now; warm is running and can take it within
  a short failover; cold must be started. The word chosen sets the recovery time you can claim.

## Gotchas

**★ Symptom: "we need high availability on the orders database" — and the design has read
replicas.** Cause: availability said where durability was meant; replicas answer reads, they do not
make a paid order survive a primary crash. Fix: say the invariant — "a paid order must never be
lost" — and let it choose synchronous replication or a replicated commit for the write path, with
availability handled separately by failover.

**★ Symptom: a latency complaint answered with "scale horizontally."** Cause: performance and
scalability confused; a request slow on its own is not helped by more copies of the thing running
it. Fix: ask which it is — is *each* request slow (performance: cheaper query, cache) or do
requests get slow *under load* (scalability: find and remove the serialisation point).

**Symptom: "we'll use strong consistency to be safe."** Cause: consistency used as a synonym for
correctness. Fix: name the invariant first, then the model it needs: "inventory must never
oversell, so the decrement is a conditional write on one primary; the cart only needs the user to
see their own adds, so read-your-writes is enough and it can be eventually consistent across
regions."

**Symptom: a latency target with no load attached.** Cause: latency stated as if it were a
constant. Fix: "p99 under 500 ms *at 300 checkouts a second*; above that we shed with a queue and
a wait page." A target without a load is not testable and the interviewer knows it.

**Symptom: "retries make it reliable."** Cause: a resilience mechanism mistaken for a reliability
outcome. Fix: say what failure the retry is for and what it does under the other kind: "retry with
backoff for transient network errors; for an overloaded dependency the circuit breaker opens
instead, because retrying makes that failure worse."

**Symptom: an average latency in the estimation.** Cause: the tail forgotten. Fix: state p50 and
p99 and say why p99 matters for this journey — "checkout fans out to five services, so the page's
p50 is close to some dependency's p99."

**Symptom: "the system is 99.99% available" with no formula.** Cause: the two availability
formulas give different answers for the same outage, and the number was said without choosing. Fix:
"request-based — successful over total, over a rolling thirty days — because a partial outage on one
shard should count as the fraction of users it hit, not as a full outage."

**Symptom: "durable" used for a cache.** Cause: the word attached to the wrong tier. Fix: caches
are neither durable nor the source of truth; say "the cache is disposable — a cold cache costs us
latency, never data — and the durable copy is the primary."

## Interview questions

**★ What is the difference between latency and throughput, and why can improving one hurt the
other?**
Latency is the time one request takes, reported as a percentile; throughput is the number of
requests completed per second. Batching improves throughput by amortising fixed costs and raises
latency because requests wait for the batch; adding parallelism can raise throughput while leaving
each request's latency unchanged; pushing load toward capacity keeps throughput flat while latency
climbs, because requests queue. A target for either is only meaningful at a stated load.

**★ Availability versus durability: give a system that has one and not the other.**
A database that is down for maintenance for an hour and loses nothing is durable and unavailable. A
service that acknowledges writes into memory and answers every request, then loses the last few
seconds on a crash, is available and not durable. The SRE book keeps them as separate indicators;
in the storefront the product page can accept lower availability than checkout, while a paid order
needs durability nothing else on the site needs, which is why only that write path is synchronous
to replicated storage.

**★ Consistency versus correctness — why is "strong consistency to be safe" a weak answer?**
Consistency is a property of what readers observe across replicas — Jepsen's hierarchy from strict
serializable down to eventual. Correctness is whether the application's invariants hold. A
linearizable store can hold wrong data, and an eventually consistent one can be correct when the
invariant tolerates divergence — Dynamo's cart is the canonical case. The strong answer names the
invariant and derives the model from it: inventory must never oversell, so its decrement is a
conditional write on one primary; the cart needs only read-your-writes and can converge later.

**Scalability versus performance: same symptom, different fix — explain with the inventory row.**
At the sale peak checkout is slow because every checkout waits on the sale product's inventory row.
Adding order-service pods does not help, because the row is the serialisation point — that is a
scalability problem, fixed by removing the point (a reservation ledger, per-product counters). If
instead each checkout were slow on its own because of an expensive query, that would be a
performance problem, fixed by making the request cheaper. Answering the first with a cache or the
second with more pods is the confusion the interviewer is listening for.

**Reliability versus resilience — where do retries and circuit breakers belong?**
Both are resilience mechanisms: they act when a fault has already occurred. Whether they improve
reliability — the SLO being met over time — depends on the failure. Retries with backoff help
against transient errors and hurt against an overloaded dependency, where the circuit breaker is
what helps. Reliability is the outcome measured over a window; resilience is the set of properties
that produce it under failure, and the storefront's version is "search may fail and the page still
renders, so checkout's SLO is protected."

**Which availability formula would you choose for the storefront, and why does it matter?**
Request-based — successful requests over total, over a rolling window — because a partial outage
that hits one shard or one region should count as the fraction of users it affected rather than as
the whole site being down, and because it can be computed from the same counters that drive the
error-rate SLI. Uptime-based is simpler to state and worse at describing distributed failures; the
SRE book presents both and explains why it moved to the request form.

**Why is a percentile the right shape for a latency requirement, and which percentile?**
Because latency is a distribution and users experience its tail, not its mean. p50 describes the
typical request; p99 describes the one-in-a-hundred that is slow, and a page that fans out to many
calls hits some dependency's tail on most views. Dynamo's paper states its SLAs at the 99.9th
percentile for exactly that reason. The percentile chosen should follow the journey: checkout gets
a p99 target, an offline report gets a p50 or none.

**What is the difference between a fault and a failure, and what does fault tolerance mean?**
A fault is a component misbehaving — a disk returning bad data, a node crashing. A failure is the
system not delivering its service to the user. Fault tolerance is the set of measures that stop
faults from becoming failures: redundancy so one node's crash is absorbed, checksums so bad data is
detected, isolation so one dependency's fault does not take the page down. Every fault-tolerance
measure has a cost, and a senior answer says which faults are tolerated and which are allowed to
become failures.

---

← Prev: [03 · The rubric](03-the-rubric.md) · Index: [Phase 0 — What system design interviews test](README.md) · Next → [05 · The latency ladder](05-the-latency-ladder.md)
