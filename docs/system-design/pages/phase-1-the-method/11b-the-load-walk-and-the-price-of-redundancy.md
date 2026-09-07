---
title: "The second walk asks of every number \"what if this doubles\" and finds that fleets absorb it and singular things do not; then the arithmetic — availabilities in series multiply — and the honest price of every replica, failover and standby the first walk drew"
sidebar_label: "11b · The load walk and the price of redundancy"
sidebar_position: 12
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-07. Method; the availability definitions are the Google SRE book,
> [*Embracing Risk*](https://sre.google/sre-book/embracing-risk/) (verbatim); the majority rule for a
> replicated store is the [Raft paper](https://raft.github.io/raft.pdf) §2 (verbatim); the
> always-writeable end of the trade is the
> [Dynamo paper](https://www.allthingsdistributed.com/files/amazon-dynamo-sosp2007.pdf) §4.6 (verbatim).
> The serial and parallel availability arithmetic is elementary probability, stated as such; the
> concurrency formula is stated as method. Second half of topic 11 —
> [11](11-bottlenecks-and-single-points-of-failure.md) is the failure walk and the SPOF checklist.
> **No sandbox run.**

**The failure walk found the boxes whose death is the system's death; the load walk finds the box
whose saturation is the system's ceiling, and it is almost never the box the candidate expected.**
Fleets of stateless replicas absorb a doubling; a single row, a single writer, a single hot key do
not, so the bottleneck is always the narrowest *singular* thing on the path. Then two pieces of
arithmetic that the walk needs: availabilities in series multiply, which is why the synchronous
chain must be short and everything on it replicated; and concurrency equals arrival rate times
time in the system, which converts any latency on the board into a count of connections, pool
slots or locked rows. And finally the part that separates a senior walk from a list of replicas:
every survival mechanism drawn in [11](11-bottlenecks-and-single-points-of-failure.md) is a box
with its own failure mode and its own price — failover needs a majority, always-writeable pays
with divergence, a standby drifts, retries become a storm — and the best answers are often not a
replica at all but a smaller product the buyer can still use.

## The load walk: what if this number doubles

The numbers came from [03](03-back-of-the-envelope-estimation.md) and the shape from
[04](04-traffic-shapes.md). Take each one and find the *first* box to saturate:

| Number that doubles | First to saturate | Why it, and not the fleet | Relief and its cost |
|---|---|---|---|
| Catalogue reads per second | the product cache's memory, then its network | the fleet of stateless replicas scales sideways; the cache's hot set does not shrink | a second cache node with the keyspace split; hot keys still land on one node |
| Orders per second (normal day) | the primary's write throughput and its connection count | one writer; every replica added is more *readers* | the outbox publisher and the workers are already off the write path; next is partitioning orders by tenant or time |
| Checkouts on one product (sale day) | **one inventory row** | every checkout of that product contends on the same lock; adding servers adds waiters | admission at the gateway, or a reservation counter in Redis in front of the row — and the trade-off sentence for each |
| Cart writes | Redis, single-threaded per key | one key per cart, so this scales well until one cart is written from many devices | nothing, until a merge-on-read is needed |
| Events per second on the log | the slowest consumer's lag, not the log | the log takes it; the search indexer does one index write per event | more partitions, and consumers scaled to the partition count |
| Concurrent connections | the primary's connection limit | each service replica holds a pool; doubling replicas doubles pools | a connection pooler in front of the primary, at the cost of session-level features |

The pattern in the third column is the point of the walk: **anything replicated absorbs a
doubling; anything singular does not.** The inventory row is singular. The primary's write
throughput is singular. A hot key in the cache is singular. The bottleneck is always the narrowest
singular thing on the path, and the order in which bottlenecks appear as load grows is the
**scaling walk** *(not written yet)* of the next page — said here as "first the row, then the primary, then the
cache's memory."

One formula settles most "how many" questions on this walk and is worth stating as method:
**concurrency equals arrival rate times time in the system.** A service taking 200 checkouts per
second at 50 ms each holds ten in flight; the same service with the provider call *inside* the
transaction at 30 s holds six thousand, which is why [08](08-read-path-and-write-path.md) commits
before the call. The formula converts a latency into a connection count, a pool size, or a
number of rows locked, and the interviewer will recognise it.

## Why a chain is weaker than its weakest link

The SRE book's two definitions of availability are the ones to use, and to keep apart:

> *"Availability = Uptime / (Uptime + Downtime)"* — time-based; and, request-based:
> *"Availability = Successful Requests / Total Requests"* — SRE book, *Embracing Risk*

A request that passes through boxes in **series** succeeds only if every box does, so the
availabilities multiply: four boxes at 99.9 % each give a path at roughly 99.6 % — about
thirty-five hours a year of failed requests, not nine. That arithmetic is the reason the failure
walk goes left to right: the path's availability is set by its *longest chain*, and every box
added to the synchronous path lowers it. Boxes in **parallel** — two replicas where either
serves — fail together only if both fail, so the pair's unavailability is the product of the
individual unavailabilities: two at 99.9 % give 99.9999 %, on the assumption their failures are
independent, which a shared region, a shared deploy and a shared secret all violate. The two
rules together are the whole argument for the diagram's shape: keep the synchronous chain short,
replicate what is on it, and move everything that can be asynchronous below the line where its
failure is *late* rather than *failed*.

## Redundancy has its own failure modes

Every fix in the failure walk is a box with its own row. The senior walk names the price:

**Failover needs a decision-maker, and the decision-maker is the new SPOF.** Two database nodes
cannot decide alone which is primary; a network partition between them produces two primaries
and two divergent histories. The standard answer is a majority, and the Raft paper states the
rule:

> *"They are fully functional (available) as long as any majority of the servers are
> operational and can communicate with each other and with clients. Thus, a typical cluster of
> five servers can tolerate the failure of any two servers."* — Raft, §2

So the honest sentence is "three nodes, automatic failover on majority, and a write pause of
tens of seconds while the election runs" — not "we have a replica".

**Always-writeable is the other end of the same trade.** The cart does not need a majority; it
needs to never refuse a write. Dynamo's answer, and its price:

> *"If Dynamo used a traditional quorum approach it would be unavailable during server failures
> and network partitions, and would have reduced durability even under the simplest of failure
> conditions. To remedy this it does not enforce strict quorum membership and instead it uses a
> 'sloppy quorum'; all read and write operations are performed on the first N healthy nodes from
> the preference list"* — Dynamo, §4.6

Availability bought with divergent versions merged on read — which is the cart's row above.

**The untested backup is not a backup.** A restore that has never been run has an unknown
duration and an unknown success rate; the walk's sentence is "nightly snapshot, restore tested
monthly, recovery time of about an hour", and the interviewer hears the second clause.

**Active-passive standby drifts.** A standby that takes no traffic has untested capacity,
stale configuration and cold caches; the failover to it is the first time it has been load
tested. Active-active removes that and pays with the conflict problem above.

**Retries turn one failure into a load event.** Every client of a dead box retries; without
backoff and a budget, the box that recovers is immediately knocked down by the retry storm. The
survival mechanism for any box needs its callers' retry policy as a clause.

## Degrade, do not fail

The failure walk's best answers are not "a replica" but "a smaller product". Decide, per journey,
what the buyer gets when a dependency is gone:

| Dependency down | Full product | Degraded product |
|---|---|---|
| search index | search | the catalogue's own filtered listing, labelled "search is limited" |
| product cache | fast catalogue | the same catalogue, slower, behind coalescing |
| primary (failing over) | checkout | "checkout is briefly unavailable — your cart is saved"; browsing continues |
| payment provider | paid orders | orders saved pending, retried; stock held with a TTL |
| email gateway | confirmation mail | the confirmation page and an order history; mail arrives late |
| recommendations, reviews | the full page | the page without them — these are the rows to cut first |

The degraded column is a product decision, and saying "I would confirm with the product owner
that pending orders are acceptable" is a senior sentence, because the buyer's experience during a
partial outage is a requirement that [01](01-functional-requirements.md) rarely wrote down.

## Gotchas

**★ Symptom: the bottleneck named was "the servers".** Cause: walking the fleet instead of the
singular things. Fix: find the narrowest singular element on the path — the inventory row, the
primary's write rate, a hot key — and say why adding servers does not move it.

**Symptom: the availability target from the NFRs and the diagram's chain disagree.** Cause: five
boxes in series at 99.9 % cannot deliver 99.9 %. Fix: do the multiplication on the board, then
shorten the chain or replicate the boxes on it, and say which.

**Symptom: a retry policy was never mentioned.** Cause: failure treated as a box's problem, not
its callers'. Fix: backoff with jitter and a retry budget as a clause on every external call, and
the thundering-herd sentence for the recovering box.

**Symptom: failover described as instant.** Cause: no election, no DNS TTL, no connection reset
in the account. Fix: give the number — tens of seconds for a majority election, minutes for a
DNS-based region failover — and what the buyer sees during it.

## Interview questions

**★ What is the first bottleneck on sale day, and why does adding servers not help?**
One inventory row. Every checkout of the sale item contends on the same lock, and every server
added is another waiter on that lock, not more throughput. Relief is admission at the gateway so
the row sees a rate it can serve, or a reservation counter in a store that decrements faster than
a row lock, each with a trade-off sentence — a wait for some buyers, or a second source of truth
to reconcile.

**Four boxes in series at 99.9 % each — what does the path deliver, and what does that change?**
Roughly 99.6 %, because availabilities in series multiply; about thirty-five hours a year of
failed requests against an NFR that asked for under nine. It changes the diagram: shorten the
synchronous chain, replicate the boxes on it — two in parallel at 99.9 % give 99.9999 % if their
failures are independent — and move everything that can be asynchronous below the line, where
its failure is late rather than failed.

**How should an external dependency you cannot replicate be answered?**
By accepting it out loud and designing the degraded product: the payment provider is a single
point of failure we keep, because a second provider doubles integration and reconciliation; while
it is down, orders save as pending with stock held on a TTL and a retry job, and the buyer sees
"payment pending" rather than a failure. The senior part is the sentence about what the buyer
sees, and the note that it is a product decision to confirm.

**What does concurrency equal arrival rate times time in the system tell you on the walk?**
How many of anything are in flight — connections, locked rows, pool slots. Two hundred checkouts
per second at 50 ms is ten in flight; with a 30 s provider call inside the transaction it is six
thousand, which exhausts any pool and holds six thousand row locks. It converts a latency on the
board into a resource count, and it is the arithmetic behind committing before the provider call.

---

← Prev: [11 · Bottlenecks and single points of failure](11-bottlenecks-and-single-points-of-failure.md) · Index: [Phase 1 — The method](README.md) · Next → **The scaling walk** *(not written yet)*
