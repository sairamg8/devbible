---
title: "One server, then replicas behind a balancer, then a cache, then read replicas, then sharding, then asynchronous work, then a second region — each step taken only when a named symptom forces it; a design presented as that sequence is graded on judgement, one that starts at the end is graded on vocabulary"
sidebar_label: "12 · The scaling walk"
sidebar_position: 13
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-07. Method; the one quoted number is the Google SRE book,
> [*Embracing Risk*](https://sre.google/sre-book/embracing-risk/) (the cost of each reliability
> increment, verbatim); the scale that partitioning was invented for is the
> [Bigtable paper's](https://research.google/pubs/bigtable-a-distributed-storage-system-for-structured-data/)
> abstract (verbatim). The thresholds are the tendencies stated on
> [03](03-back-of-the-envelope-estimation.md); the storefront's numbers are that page's. **No sandbox run.**

**A system is scaled by taking steps, and every step is taken because a symptom forced it.** The
sequence is well known — one server, stateless replicas behind a balancer, a cache, read
replicas, sharding, asynchronous work, a second region — and knowing it is worth nothing; what
is graded is the *symptom* that licenses each step and the *cost* each step introduces, said in
order. A candidate who opens with the last stage has drawn a system for a scale the question did
not state and has skipped every decision the interviewer wanted to see; a candidate who starts
at one server and walks forward, naming at each stage "this is where the numbers say we are, and
this is what would push us on", is showing the judgement the rubric's scaling line grades. The
walk also answers the follow-up before it is asked: "and if traffic went up tenfold?" maps to a
step already on the board. This page is the sequence, the symptom and the price at each stage,
the order's dependence on *which* number moved, and the storefront walked from a single box to
the design [07](07-the-high-level-diagram.md) drew.

## The sequence, with what forces each step

| Step | The symptom that forces it | What it buys | What it costs — the new failure mode |
|---|---|---|---|
| **0. One server** | nothing yet — this is where you start | nothing to operate; one deploy, one log, one backup | one box is every SPOF at once; scaling is a bigger box |
| **1. Split app from database** | app CPU and database I/O contend on one box; they need to scale on different axes | independent sizing; the database gets its own disk and memory | a network hop on every query; two things to back up and secure |
| **2. Stateless replicas behind a balancer** | app CPU or connection count saturates at peak; one deploy takes the site down | horizontal read *and* write capacity at the app tier; rolling deploys | session state must leave the process (a session store, or a signed cookie); the balancer is a new box on the failure walk |
| **3. A cache** | the same reads dominate the database's CPU; the read/write ratio is two orders of magnitude | most reads never reach the database; latency drops from a disk read to a memory read | invalidation — staleness bounded by a TTL or by events; a cold cache is a load event ([11](11-bottlenecks-and-single-points-of-failure.md)) |
| **4. Read replicas** | the database is still read-bound after the cache — uncacheable or long-tail reads | reads spread across N nodes; a failover candidate for free | replication lag; read-your-writes must be routed to the primary ([08](08-read-path-and-write-path.md)) |
| **5. A bigger primary, and a pooler** | the primary's write throughput or connection count is the wall | years, usually — vertical scaling of the writer goes further than candidates expect | a ceiling with a price tag, and a pooler that drops session-level features |
| **6. Sharding** | write throughput or working set exceeds what one primary can hold — or an operational limit (backup time, failover time) | writes and data spread by a key; each shard is a small database again | cross-shard queries and transactions; rebalancing; a hot shard is the row problem at a larger grain |
| **7. Asynchronous work** | request latency is dominated by work that need not finish before the response | a short synchronous path; consumers scaled independently; retries owned by the queue | eventual consistency between the write and its effects; a queue or log to run; idempotent consumers |
| **8. A second region** | far users see the speed of light on every round trip, or the availability target exceeds one region's | latency near the user; survival of a regional failure | replication and its consistency problem; data residency; roughly double the bill |

Two rows deserve a note. Step 5 is the one candidates skip and interviewers respect: before
sharding, the writer is usually made bigger, because a single node's write throughput is far
above the storefront's fifty writes a second at a flash sale and sharding's cost is permanent.
And step 7 is placed by *its* symptom, not by its row number — for the storefront it comes
before step 4, because a checkout that waits on an email gateway is the latency problem, and
catalogue reads were never the bottleneck.

## The order is chosen by which number moved

The sequence above is a default, not a law. The walk is driven by the estimation numbers from
[03](03-back-of-the-envelope-estimation.md), and the number that moved decides the next step:

| The number that grew | The step it licenses | Not this |
|---|---|---|
| reads per second, on a hot set | a cache (3), then a CDN for the static share | read replicas — lag and cost for reads a cache would have absorbed |
| reads per second, long tail | read replicas (4) | a bigger cache — a long tail does not hit |
| writes per second | a bigger primary and a pooler (5), then sharding (6) | more app replicas — they add writers to the same lock |
| requests per second at the app tier | replicas behind a balancer (2) | a cache — the app tier is CPU, not data |
| latency, with slow dependencies on the path | asynchronous work (7) | sharding — the database was not the slow part |
| dataset size past a node's disk | sharding by time or tenant (6), or object storage for the bulk | a cache — size is not a read problem |
| users far from the region, or an availability target past one region's | a second region (8) | anything earlier — no local step fixes distance |

Saying which column applies is the scaling-walk sentence: "our reads are a hundred a second on a
hot fifth of the catalogue — that licenses a cache, not replicas; the replica is for failover."
The interviewer hears a number, a step, and the rejected alternative, which is
[10](10-trade-offs-in-one-sentence.md)'s form again.

## The storefront, walked

The numbers: a million users, a hundred page views a second on average and a thousand at a
sale, half an order a second on average and fifty at a flash sale, a quarter terabyte of orders
over seven years, a hundred-megabyte hot set.

```text
step 0   [app + PostgreSQL on one box]                          — a hundred reads a second: fine. Stop here if the question stops here.

step 1   [app] ──► (PostgreSQL)                                  — symptom: the sale-day peak makes the app and the database fight for one CPU.

step 2   [LB] ──► [app ×3] ──► (PostgreSQL)                      — symptom: a thousand reads a second at peak saturates one app process;
                                                                  a deploy is an outage. Sessions move to a signed cookie.

step 7   [LB] ──► [app ×3] ──► (PostgreSQL) ──► (outbox) ──► [publisher] ──► (log) ──► [email · fulfilment · indexer]
                                                                — symptom: checkout waits two seconds on the email gateway. Taken before
                                                                  step 3 because latency on the write path was the complaint.

step 3   [LB] ──► [app ×3] ──► (cache) ──► (PostgreSQL)          — symptom: product reads are two orders above writes and the hot set is
                                                                  a hundred megabytes; the database's CPU is mostly the same ten thousand
                                                                  products. Invalidated from the outbox on a price change.

step 4   (PostgreSQL primary ⇄ replica)                         — symptom: none yet on reads — taken for *failover*, and the analytics
                                                                  queries move to it. Read-your-writes routed to the primary.

step 5   a larger primary + a connection pooler                 — symptom: fifty writes a second at a flash sale is trivial; the pooler
                                                                  is for the app replicas' pools, not throughput. Sharding is NOT taken.

step 8   a second region, asynchronous replication              — symptom: only if the availability target or a European market
                                                                  demands it; otherwise stated as the next step and left undrawn.
```

The end state is the diagram on [07](07-the-high-level-diagram.md), reached in six steps with
two of the eight deliberately not taken and one taken out of order — and every one of those
three decisions is something to say out loud, because the not-taken steps are where the judgement
shows. "We do not shard; fifty writes a second is three orders of magnitude below where a single
primary becomes the problem, and sharding's cost is permanent" is worth more than a sharded
diagram.

## The sale day is not a scaling step

The walk scales for the *average* shape and shelters the peak, because
[04](04-traffic-shapes.md) showed the peak is a hundred times the average on the write path for
an hour a quarter. Provisioning the walk's steps for that hour is the SRE book's cost curve:

> *"experience shows that as we build systems, cost does not increase linearly as reliability
> increments—an incremental improvement in reliability may cost 100x more than the previous
> increment."* — SRE book, *Embracing Risk*

So the sale day gets admission at the gateway and a reservation counter in front of the
inventory row — the *shedding* answers of [04](04-traffic-shapes.md) — rather than another step
of the walk. Presenting a spike as a reason to shard is the most common way the walk goes wrong.

## Where sharding actually starts

Because sharding is the step most often taken too early, it is worth having the scale it was
invented for on the board. The systems that partition by design were built for a size no single
node reaches:

> *"Bigtable is a distributed storage system for managing structured data that is designed to
> scale to a very large size: petabytes of data across thousands of commodity servers."* —
> Bigtable, OSDI 2006

Petabytes and thousands of servers, against the storefront's quarter terabyte. The honest
thresholds are the ones [03](03-back-of-the-envelope-estimation.md) stated as tendencies: tens
of thousands of writes a second, or a working set past a node's memory and disk, or an
operational limit — a backup that no longer completes overnight, a failover that copies too much.
Before any of those, the sharding sentence is "not yet, and here is the key we would shard on
when it comes: tenant for a multi-tenant store, time for orders, and never a monotonic ID."

## Saying the walk in the round

The walk is spoken, not drawn in full; only the end state is drawn. The form is one sentence per
step, in order, each with its symptom and its cost, and it takes two minutes:

1. "One box serves this at the average; I'll start there and walk forward."
2. "The sale-day peak is the first symptom — the app tier goes to three stateless replicas
   behind a balancer, sessions in a signed cookie; the balancer joins the failure walk."
3. "Checkout latency is the second — email and fulfilment go behind an outbox and a log; we pay
   with eventual consistency on the confirmation email."
4. "Reads are two orders above writes on a hundred-megabyte hot set — a cache, invalidated from
   the outbox; a cold cache is a load event, so it gets a standby."
5. "A replica for failover and analytics; read-your-writes to the primary."
6. "Writes are fifty a second at the worst hour — no sharding; a larger primary and a pooler
   when the connection count says so."
7. "A second region when the availability target or a distant market says so — not before,
   because it doubles the bill and introduces a recovery point."

Then the follow-up. "Ten times the traffic?" — reads go to a thousand a second average: the
cache and the CDN absorb them, the replica count doubles; writes go to five a second average,
five hundred at a sale: admission is now needed on every sale, and the inventory counter moves
out of the row. "A hundred times?" — the primary's write rate is finally the wall: partition
orders by time, keep inventory as a counter service, and that is the first real sharding
sentence. Each answer is a step already on the walk with a number attached.

## Gotchas

**★ Symptom: the first diagram has shards, a log, three caches and two regions.** Cause:
starting at the end; a system drawn for a scale the numbers never reached. Fix: start at one
server, say which number moves you off it, and take steps only as symptoms arrive — the not-taken
steps are the evidence.

**★ Symptom: "we'll shard the database" for fifty writes a second.** Cause: the peak mistaken for
a scaling step, or sharding taken as the reflex answer to "the database". Fix: name the write
rate, compare it to the tendency threshold, take the bigger primary and the pooler first, and say
the shard key you would use later.

**Symptom: read replicas added for a hot-set read problem.** Cause: the wrong step for the
number that moved. Fix: a hot set licenses a cache; replicas are for the long tail and for
failover — say which reads each serves.

**Symptom: replicas behind a balancer, but sessions still in process memory.** Cause: step 2
taken without its cost. Fix: sessions to a signed cookie or a shared store; sticky sessions
named as the anti-pattern that defeats the balancer's point.

**Symptom: asynchronous work listed last because the sequence lists it last.** Cause: the
default order recited as a law. Fix: place each step by its symptom; for a checkout that waits
on an email gateway, the log comes second.

**Symptom: the walk delivered with no numbers.** Cause: the sequence known, the licensing
forgotten. Fix: each step's sentence carries the number from estimation that forced it —
"a thousand a second at peak saturates one process".

**Symptom: the follow-up "ten times the traffic?" answered with "add more servers".** Cause: no
step mapped to the number. Fix: recompute the two or three numbers, find the first singular
thing to saturate ([11b](11b-the-load-walk-and-the-price-of-redundancy.md)), and name the step
that relieves it.

**Symptom: multi-region drawn for a national store.** Cause: the last step taken for its own
sake. Fix: state the two symptoms that license it — distance, or an availability target above
one region's — and that neither is present.

**Symptom: the walk narrated as history — "then we added, then we added".** Cause: an operations
story instead of a decision sequence. Fix: each step as symptom → step → cost, present tense, so
the interviewer can grade each decision.

## Interview questions

**★ Walk the storefront from one server to the diagram, and say which steps you would not take.**
One box serves a hundred reads a second. The sale-day peak splits the app from the database and
puts three stateless replicas behind a balancer, sessions in a signed cookie. Checkout latency
puts email, fulfilment and indexing behind an outbox and a log. Reads two orders above writes on
a hundred-megabyte hot set license a cache, invalidated from the outbox. A replica for failover
and analytics, with read-your-writes on the primary. Not taken: sharding, because fifty writes a
second at the worst hour is three orders below where a single primary is the wall, and a second
region, because neither distance nor the availability target demands it — both are stated as
the next steps with their symptoms.

**★ What symptom licenses each of: a cache, read replicas, sharding, a second region?**
A cache: the same hot reads dominating the database's CPU, with a read/write ratio around two
orders of magnitude. Read replicas: the database still read-bound after the cache, on long-tail
or uncacheable reads, or the need for a failover candidate. Sharding: write throughput or working
set beyond a single primary, or an operational limit such as backup and failover time — and only
after a larger primary and a pooler. A second region: users far enough that the round trip
dominates latency, or an availability target one region cannot meet.

**Why is asynchronous work sometimes taken before the cache?**
Because the order is set by the symptom, not the list. If the complaint is that checkout waits
two seconds on an email gateway, the problem is latency on the write path, and no cache helps;
moving the email behind a log fixes it and costs eventual consistency on the confirmation. If the
complaint is database CPU under product reads, the cache comes first. Reciting the sequence in a
fixed order is the tell that the licensing was never understood.

**What does step 2 cost that candidates forget?**
State. Replicas behind a balancer only work if any replica can serve any request, so session
state must leave the process — a signed cookie or a shared session store — and file uploads must
go to object storage rather than local disk. Sticky sessions paper over it and defeat the
balancer: a replica's death loses its users' sessions, and load is no longer spread. The
balancer itself is a new box on the failure walk.

**Where does sharding really start, and what would you shard on?**
At tens of thousands of writes a second, a working set past one node's memory and disk, or an
operational wall such as a backup that cannot finish overnight — after a larger primary and a
pooler have been used up. The systems built to partition were designed for petabytes across
thousands of servers. The key is chosen by the access pattern: tenant for a multi-tenant store,
time for an append-mostly orders table, and never a monotonic ID, which puts every new write on
the same shard.

**"Ten times the traffic" — what changes on the storefront?**
Reads become a thousand a second average and ten thousand at a sale, absorbed by the cache and
the CDN with more replicas behind the balancer. Writes become five a second average and five
hundred at a flash sale, which is the first point where the inventory row is a wall on every
sale rather than one a quarter: admission at the gateway becomes standing, and the inventory
counter moves out of the row into a counter service. The primary is still not sharded; at a
hundred times, partitioning orders by time is the first real sharding step.

---

← Prev: [11b · The load walk and the price of redundancy](11b-the-load-walk-and-the-price-of-redundancy.md) · Index: [Phase 1 — The method](README.md) · Next → [13 · Designing for cost](13-designing-for-cost.md)
