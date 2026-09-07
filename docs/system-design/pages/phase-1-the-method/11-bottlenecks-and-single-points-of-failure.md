---
title: "Walk the diagram twice — once asking of every box \"what if this dies\", once asking of every number \"what if this doubles\" — and the answers fill the rubric's failure line; a design that was never walked has a single point of failure the interviewer finds in one question"
sidebar_label: "11 · Bottlenecks and single points of failure"
sidebar_position: 11
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-07. Method; the availability definitions are the Google SRE book,
> [*Embracing Risk*](https://sre.google/sre-book/embracing-risk/) (verbatim); the majority rule for a
> replicated store is the [Raft paper](https://raft.github.io/raft.pdf) §2 (verbatim); the
> always-writeable end of the trade is the
> [Dynamo paper](https://www.allthingsdistributed.com/files/amazon-dynamo-sosp2007.pdf) §4.6 (verbatim).
> The serial and parallel availability arithmetic is elementary probability, stated as such. The
> storefront components are the ones drawn on [07](07-the-high-level-diagram.md). **No sandbox run.**

**A diagram is not a design until it has been walked. The walk is two passes over the same
boxes and arrows: for every box, *what does the user see if this dies right now*; for every
number written in estimation, *which box saturates first if this doubles*.** The first pass finds
the single points of failure — the boxes whose death is the system's death — and the second finds
the bottleneck, which is almost never the box the candidate expected, because fleets scale and
single rows do not. Both passes produce sentences of one shape: *this box dies, the user sees X,
we survive it by Y, and Y costs W* — the trade-off form of [10](10-trade-offs-in-one-sentence.md)
applied to failure. The rubric's failure line ([phase 0's rubric page](../phase-0-the-interview/03-the-rubric.md))
is filled by those sentences said unprompted, in order, left to right across the board; an
interviewer who has to ask "and what if the database goes away?" has found the walk missing, and
the next question will be the box you did not think about. This page is the failure walk on the
storefront and the checklist of the points people miss; its sibling
[11b](11b-the-load-walk-and-the-price-of-redundancy.md) is the load walk, the arithmetic that
says why a chain of boxes is weaker than its weakest, and the price every piece of redundancy
carries.

## The two walks

| Walk | The question at each stop | What it finds | The answer's shape |
|---|---|---|---|
| **Failure** | "this box dies now — what does the buyer see?" | single points of failure, and the dependencies you cannot remove | *dies → symptom → survival mechanism → its cost* |
| **Load** | "this number doubles — which box saturates first?" | the bottleneck, and the order in which the rest follow | *doubles → the first box to saturate → the symptom → the relief and its cost* |

Walk in the direction of a request, left to right, because that is the order the user
experiences a failure and the order the diagram was drawn. Say each stop out loud, including the
boring ones: "DNS — managed, anycast, not ours to lose; if it *is* lost nothing resolves and no
design of ours helps." Skipping a box because its answer is obvious is how the interviewer gets to
ask about it.

## The failure walk on the storefront

Every box from [07](07-the-high-level-diagram.md), what its death looks like from the buyer's
side, and the sentence that survives it:

| Box | Dies → the buyer sees | Survive by | And pay with |
|---|---|---|---|
| **DNS** | nothing resolves; the site is gone | a managed anycast provider; long TTLs on the apex record | a provider we do not control and slow record changes |
| **CDN / TLS edge** | static assets and cached product pages fail | two CDNs is rare; most accept one — origin still serves, at origin's speed | origin exposed to full read load for the outage |
| **Load balancer / gateway** | every request fails at the front door | the provider's balancer is itself replicated; two gateway replicas behind it | admission state (the sale-day wait page) must live outside the gateway |
| **Catalogue service** | product pages 5xx | stateless replicas; the balancer stops routing to the dead one | nothing beyond the replicas' cost — this is the easy case |
| **Product cache** | *not* an error — every read goes to the replica at once | a warm standby cache, or request coalescing at the service so one miss fills one key | a second cache tier, or code in the read path |
| **PostgreSQL primary** | every write fails: no order, no inventory change; reads survive on the replica | automatic failover to a synchronous replica | seconds of write unavailability; a synchronous replica costs a round trip per commit |
| **PostgreSQL replica** | reads fall back to the primary | two replicas, or accept primary load for the outage | double the replica bill, or a primary that is now the bottleneck |
| **Redis (carts)** | carts vanish, or writes fail | a replica with failover; the cart merges from the client's copy on next load | a lost cart in the window between write and replication |
| **Order service** | checkout 5xx | stateless replicas, as the catalogue | none extra; the state is in the database |
| **Payment adapter** | checkout cannot charge | replicas, as above — but see the next row | none extra |
| **Payment provider** *(external)* | checkout cannot charge, and no replica of ours helps | **accept it** — a SPOF we cannot remove; degrade to "order saved, payment pending, we will retry" | a pending state, a retry job, and stock held for orders that may never pay |
| **Outbox publisher** | orders commit; no event leaves — no email, no fulfilment, no index update | two publishers with a lease on the outbox table; the outbox row is durable, so nothing is lost, only late | a lease to implement and a delay to alert on |
| **The log** | the publisher cannot publish; consumers starve | a replicated log with a minimum in-sync replica count | a cluster to run; writes wait for the replica set |
| **A worker** | its consumer group falls behind; nothing lost | the group rebalances to the survivors | lag, and an alert on it |
| **Search index** | search returns nothing, or stale | serve the catalogue's own filtered listing while the index rebuilds from the log | a degraded search page and a rebuild that reads the whole log |
| **Email gateway** *(external)* | no confirmation mail | retry from the worker with backoff; the order stands | late mail, and a dead-letter path after N attempts |
| **The region** | all of the above at once | a second region with asynchronous replication and a DNS failover | a recovery point of the unreplicated writes, and a second bill |

Three of those rows carry most of the marks. The **cache** row, because a cache dying is not an
error and candidates walk past it: the failure is the *origin* receiving, in one second, every
read the cache had been absorbing, which is the read-path load of [08](08-read-path-and-write-path.md)
at its full unshielded rate. The **primary** row, because it is the SPOF every product system
has, and the answer has to include the *time* to fail over, not just the fact of a replica. And
the **payment provider** row, because the senior answer to an external dependency is not a
replica but an honest "we accept this one, and here is what the buyer sees while it is down."

## The SPOF checklist

The five that every design has and the walk must name, plus the five that walk past unnoticed:

**The classic five.**
1. **DNS** — one zone, one provider. Owned by someone else; the design's answer is the TTL.
2. **The load balancer** — one entry point by construction. Managed balancers are replicated
   underneath; a self-run one needs a floating address and a pair.
3. **The primary database** — one writer. The answer is a replica *and the failover mechanism*
   and how long it takes; "we have a replica" without "and failover is automatic within thirty
   seconds" is half an answer.
4. **The one queue or log** — every asynchronous journey funnels through it. A replicated log with
   an in-sync minimum, or a queue with the provider's own redundancy.
5. **The one region** — everything shares a power grid, a network fabric and a change window.
   The answer is a second region, and the honest cost is a recovery point and doubled spend.

**The five that walk past.**
6. **The cache** — its death is a load event, not an error (above). The fix in code is
   request coalescing: the first miss for a key fetches, the concurrent misses wait on that
   fetch rather than each going to origin.
7. **A single consumer** — one outbox publisher, one worker, one cron box running "the nightly
   job". Durable input plus one process equals late, not lost — but late is an incident when it
   is the email that says "your order is confirmed".
8. **A secret or certificate** — one TLS certificate with an expiry, one signing key for
   sessions, one API key for the provider. Expiry is a scheduled outage nobody scheduled.
9. **The configuration or feature-flag store** — every replica reads it at boot; if it is down,
   no replica can start, which is discovered during the incident that made you scale up.
10. **The deploy itself** — one pipeline that pushes to every replica at once turns a bad build
    into a full outage. Rolling and canary deploys are the redundancy for change.

Name the ones you accept as well as the ones you remove. "The payment provider is a single point
of failure we keep, because a second provider doubles the integration and the reconciliation
work; while it is down, orders save as pending" is a stronger sentence than a second provider
drawn without its price.

## Gotchas

**★ Symptom: "and what if the database goes down?" — asked by the interviewer.** Cause: the walk
never happened, or skipped the obvious box. Fix: walk every box left to right, out loud, before
the interviewer can; the obvious boxes take five seconds each and their absence is what gets
noticed.

**★ Symptom: the cache was walked past as "just a cache".** Cause: its failure is not an error,
so it did not look like one. Fix: say the load event — "if the cache dies, origin takes the full
read rate in one second" — and show coalescing or a standby as the survival mechanism.

**★ Symptom: "we have a replica" and the interviewer keeps probing.** Cause: half an answer; the
mechanism and time of failover are missing. Fix: "three nodes, automatic failover on majority,
writes pause for tens of seconds, reads continue on the replica."

**Symptom: a second payment provider drawn on the board.** Cause: treating every SPOF as
removable. Fix: name the ones you accept and the degraded product while they are down; a second
provider is a real option only with its integration and reconciliation cost stated.

**Symptom: the walk was done at the end, as a list.** Cause: collected rather than said at the
diagram. Fix: walk immediately after the diagram is drawn, box by box, so the failure line is
filled before the deep dive starts.

**Symptom: "multi-region" offered as the answer to everything.** Cause: the largest hammer
reached for first. Fix: the region is the last stop on the walk and carries a recovery point and
a doubled bill; most of the walk is answered within one region.

## Interview questions

**★ Walk the storefront's checkout and name its single points of failure.**
Left to right: DNS, owned by a provider, answered by TTLs; the balancer, replicated by the
provider; the gateway, two replicas with admission state kept outside it; the services, stateless
replicas; the product cache, whose death is a load event answered by coalescing or a standby;
the primary, the SPOF every product has, answered by three nodes with automatic failover on a
majority and a write pause of tens of seconds; Redis for carts, a replica plus merge-on-read; the
payment provider, an external SPOF we accept and degrade around with pending orders; the outbox
publisher, two with a lease; the log, replicated with an in-sync minimum; the workers, a
consumer group that rebalances; and the region, a second one with asynchronous replication, a
recovery point and a second bill.

**★ What happens when the product cache dies, and why is that the box candidates miss?**
Nothing errors, which is why it is missed: every read the cache was absorbing arrives at the
replica in the same second, at the full unshielded read rate — two orders of magnitude above what
the replica was sized for. The survival mechanisms are a warm standby cache, or request
coalescing in the service so that concurrent misses for one key wait on a single origin fetch
instead of each going to origin; the cost is a second cache tier or code in the read path.

**★ Why is a single replica not an answer to "what if the primary dies"?**
Because two nodes cannot decide which is primary during a partition; each may believe the other
dead and accept writes, producing two histories. A majority settles it — three or five nodes, and
the Raft paper's rule that a cluster is available while a majority can communicate, so five
tolerate two failures. The complete answer includes the failover's time: writes pause for the
election, reads continue on replicas, and the synchronous replica costs a round trip per commit.

---

← Prev: [10 · Trade-offs in one sentence](10-trade-offs-in-one-sentence.md) · Index: [Phase 1 — The method](README.md) · Next → [11b · The load walk and the price of redundancy](11b-the-load-walk-and-the-price-of-redundancy.md)
