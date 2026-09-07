---
title: "Part 4 — Distributed systems theory"
sidebar_label: "4 · Distributed theory"
sidebar_position: 4
---

> Phases 6–7 · The guarantees a network of machines can and cannot give, and the patterns that make money-moving work correct across them

Everything in a distributed system is a partial failure waiting to be misread. This part is
the vocabulary and the proofs behind the patterns the rest of the track uses: why a cache can
lie, why a lock can be held by a dead process, why a retry charged the customer twice, and
what a saga is actually promising. The Java track's
[microservice](../../java/pages/phase-14-microservice-architecture/README.md) and
[messaging](../../java/pages/phase-15-messaging-event-driven/README.md) phases and Node's
[background-work phase](../../nodejs/pages/phase-7-background-work/README.md) implement several
of these; this part is where you learn to say *why* they are shaped that way.

---

## Phase 6 — Consistency, clocks and consensus

The theory that interviewers test through practical questions: "what does the customer see",
"what happens when the lock holder pauses", "how does the cluster pick a leader". Each row is
a concept you should be able to explain with a failure story attached.

| Topic | Tier |
|---|---|
| **The fallacies of distributed computing** — the network is not reliable, latency is not zero, bandwidth is not infinite, topology changes, there is more than one administrator; each fallacy read as a bug you have already shipped | <span className="db-tier t-master">Master</span> |
| **CAP as used vs CAP as written** — under a partition you choose consistency or availability; why "CA" is not on the menu; PACELC adding the latency-vs-consistency trade-off that exists even when nothing is broken | <span className="db-tier t-master">Master</span> |
| **Consistency models** — linearizable, sequential, causal, eventual; the session guarantees (read-your-writes, monotonic reads, monotonic writes); choosing per user journey rather than per system | <span className="db-tier t-master">Master</span> |
| **Time in a distributed system** — clock drift and NTP, why timestamps cannot order events across machines; Lamport clocks, vector clocks, hybrid logical clocks, bounded-uncertainty clocks | <span className="db-tier t-master">Master</span> |
| **Raft in detail** — leader election, log replication, the commit index, membership changes; etcd, Consul and Kafka's controller quorum as Raft in production | <span className="db-tier t-master">Master</span> |
| **Quorums and majorities** — why clusters are 3 or 5 and never 4, what losing a majority means, quorum intersection as the reason it works | <span className="db-tier t-master">Master</span> |
| **Leases and fencing tokens** — a lease is a lock with an expiry; the process paused by garbage collection that still believes it holds the lock; monotonic fencing tokens checked at the resource | <span className="db-tier t-master">Master</span> |
| **Distributed locks** — with a database row, with etcd or ZooKeeper, with Redis; the Redlock debate and what it teaches about clocks; the many cases where a unique constraint or idempotency removes the need for a lock | <span className="db-tier t-master">Master</span> |
| **Idempotency** — idempotency keys, dedupe tables, naturally idempotent operations; why "exactly-once delivery" is at-least-once delivery plus idempotent handling; the retry that charged the customer twice | <span className="db-tier t-master">Master</span> |
| **Retries, backoff, jitter and deadlines** — exponential backoff with jitter, retry budgets, deadlines propagated across hops, retrying only what is idempotent; the retry storm that turned a blip into an outage | <span className="db-tier t-master">Master</span> |
| **Happens-before and ordering** — causal order vs total order, why a total order needs a coordinator or a single partition, ordering keys as a partial order you can afford | <span className="db-tier t-understand">Understand</span> |
| **Consensus, the problem** — agreeing on one value despite crashes, what impossibility results actually forbid, and why leader election, configuration and locks all reduce to it | <span className="db-tier t-understand">Understand</span> |
| **Failure detection** — heartbeats, timeouts, phi-accrual detectors; the slow node that is indistinguishable from the dead one; gray failures | <span className="db-tier t-understand">Understand</span> |
| **CRDTs and conflict resolution** — last-writer-wins and what it silently drops, merge functions, counters and sets that converge; the basis of collaborative editing in **Part 12** *(not written yet)* | <span className="db-tier t-understand">Understand</span> |
| **Paxos and ZAB** — the ideas, why Raft won on understandability, where ZooKeeper still runs | <span className="db-tier t-know">Know</span> |
| **Gossip protocols** — membership and failure information spreading without a coordinator; epidemic broadcast in Cassandra-style clusters | <span className="db-tier t-know">Know</span> |
| **Byzantine vs crash faults** — why almost nothing you build tolerates lying nodes, and the few places where it matters | <span className="db-tier t-know">Know</span> |
| **The end-to-end argument** — correctness checks belong at the endpoints; why a reliable transport still needs an application-level acknowledgement | <span className="db-tier t-know">Know</span> |

**Gate — move on when:** you can explain, with a diagram, how a lock holder that pauses for
thirty seconds corrupts data despite a "distributed lock", and show the two-line fix — then
explain why the storefront's checkout does not need that lock at all.

---

## Phase 7 — Distributed transactions, IDs and the probabilistic toolkit

The patterns that make multi-service writes correct, the identifiers those writes need, and
the approximate data structures that make counting at scale affordable. The checkout saga is
the running example: reserve stock, charge, confirm, notify — and undo the right things when
step three fails.

| Topic | Tier |
|---|---|
| **Two-phase commit** — coordinator, prepare, commit; the participant blocked forever when the coordinator dies mid-protocol; where XA still lives and why cloud-native systems avoid it | <span className="db-tier t-master">Master</span> |
| **Sagas** — a sequence of local transactions with compensations; orchestration vs choreography; the storefront's checkout saga step by step, with the compensation for each step | <span className="db-tier t-master">Master</span> |
| **Compensation design** — semantic rollback, the pivot step after which you can only go forward, retryable vs compensatable steps, the compensation that itself fails | <span className="db-tier t-master">Master</span> |
| **The outbox pattern** — the dual-write problem, the outbox row written in the same transaction, the relay, publish-once-in-effect; implemented in Node's [background-work phase](../../nodejs/pages/phase-7-background-work/README.md) and the [storefront services](../../real-world/pages/phase-2-node-services/README.md) | <span className="db-tier t-master">Master</span> |
| **The inbox pattern and idempotent consumers** — dedupe on message id, a processed-messages table, the ordering caveat when the same key arrives twice out of order | <span className="db-tier t-master">Master</span> |
| **Distributed ID generation** — random UUIDs vs time-ordered UUIDs, Snowflake-style time + node + sequence, ticket servers, ULID-style keys; index locality and why random keys bloat a B-tree | <span className="db-tier t-master">Master</span> |
| **Bloom and cuckoo filters** — "definitely not, probably yes"; sizing from the false-positive rate; in front of caches, inside LSM engines, in crawlers and dedupe pipelines | <span className="db-tier t-master">Master</span> |
| **Exactly-once end to end in the storefront** — an order placed once, charged once, emailed once: idempotency key at the API, outbox to the queue, inbox at the mailer; where each duplicate is stopped | <span className="db-tier t-master">Master</span> |
| **TCC — try, confirm, cancel** — reservations as the try phase; when it is cleaner than a saga and what it demands from every participant | <span className="db-tier t-understand">Understand</span> |
| **Distributed counters and rate limits** — sharded counters, atomic increments with expiry in Redis, approximate counts when exact is too expensive; continues [Part 2](02-the-network-path-and-caching.md) | <span className="db-tier t-understand">Understand</span> |
| **HyperLogLog, count-min sketch and top-k** — cardinality and frequency at a fraction of the memory; unique visitors, trending products, heavy hitters | <span className="db-tier t-understand">Understand</span> |
| **Geospatial indexing** — geohash, quadtrees, hierarchical cells; nearby search and the cell-boundary problem; the spatial extension of a relational database as the boring answer | <span className="db-tier t-understand">Understand</span> |
| **Distributed scheduling** — leader-elected cron, a job store, at-least-once execution with idempotent jobs, missed-run policies; drift-safe jobs in Node's background-work phase | <span className="db-tier t-understand">Understand</span> |
| **Leader election in practice** — Kubernetes leases, ephemeral nodes in etcd or ZooKeeper, database advisory locks; the split-brain drill you run before trusting any of them | <span className="db-tier t-understand">Understand</span> |
| **Change data capture as a primitive** — reading the database's log, feeding caches, search and the warehouse without dual writes; detailed in **Part 5** *(not written yet)* | <span className="db-tier t-understand">Understand</span> |
| **Durable execution and workflow engines** — code as the workflow, replay from history, timers that survive restarts; when it replaces a hand-written saga and what it costs to operate | <span className="db-tier t-know">Know</span> |
| **Three-phase commit** — what it tried to fix in 2PC and why it did not survive real networks | <span className="db-tier t-know">Know</span> |

**Gate — deliverable:** the checkout saga drawn as a sequence diagram with every compensation,
the pivot step marked, the idempotency key and outbox placed, and a written answer to "what
happens if the payment provider times out after charging".

---

{/* NAV */}
