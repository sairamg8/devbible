---
title: "Part 12 — The HLD problem catalogue"
sidebar_label: "12 · HLD catalogue"
sidebar_position: 12
---

> Phases 21–22 · The systems interviewers actually ask for, each reduced to its core challenge and the deep dive they are waiting for

Every classic question is a composition of the building blocks in Parts 2 to 10. This part
is the catalogue: one row per system, naming the challenge that makes it interesting, the
components a complete answer needs, and the deep dive an interviewer usually steers toward.
Phase 21 is the canon every loop draws from; Phase 22 is the set of systems shaped by
India-scale traffic and products, which local product companies ask in their own words.
Each row is a future page with the full worked design.

---

## Phase 21 — The classic systems

| Topic | Tier |
|---|---|
| **URL shortener** — key generation, redirect at read-heavy scale, analytics; the deep dive: id generation and the cache in front of the store | <span className="db-tier t-master">Master</span> |
| **Rate limiter as a service** — the algorithms, distributed counters, the client contract; the deep dive: accuracy against cost across nodes | <span className="db-tier t-master">Master</span> |
| **Key-value store, Dynamo-style** — partitioning, replication, quorums, versioning, anti-entropy; the deep dive: the write path during a partition | <span className="db-tier t-master">Master</span> |
| **Distributed cache** — consistent hashing, eviction, hot keys, replication; the deep dive: the stampede on an expired key | <span className="db-tier t-master">Master</span> |
| **Notification system** — fan-out, channels, preferences, retries, rate limits; the deep dive: once per device, even when the worker crashes | <span className="db-tier t-master">Master</span> |
| **News feed** — fan-out on write vs on read, the celebrity problem, ranking, pagination; the deep dive: the hybrid fan-out | <span className="db-tier t-master">Master</span> |
| **Chat, messenger-style** — connection servers, ordering, delivery and read receipts, offline storage, groups; the deep dive: ordering inside one conversation | <span className="db-tier t-master">Master</span> |
| **Typeahead and autocomplete** — prefix structures, top-k per prefix, offline builds, personalisation; the deep dive: refreshing suggestions without downtime | <span className="db-tier t-master">Master</span> |
| **Video platform** — upload, the transcoding pipeline, CDN delivery, adaptive bitrate, metadata; the deep dive: the transcoding graph | <span className="db-tier t-master">Master</span> |
| **Proximity service** — geospatial cells, nearby search, the write path for moving objects; the deep dive: the cell-boundary problem | <span className="db-tier t-master">Master</span> |
| **Ride hailing** — location ingestion, matching, ETA, surge, the trip state machine; the deep dive: matching under load | <span className="db-tier t-master">Master</span> |
| **Ticket booking** — seat inventory, holds, payment, the burst when sales open; the deep dive: the seat lock and the queue at the gate | <span className="db-tier t-master">Master</span> |
| **E-commerce platform** — catalogue, inventory, cart, checkout, orders, search — the storefront at a hundred times its size; the deep dive: inventory correctness during a sale | <span className="db-tier t-master">Master</span> |
| **Payment system** — the ledger, double-entry, idempotency, reconciliation, provider webhooks; the deep dive: the money that must balance every night | <span className="db-tier t-master">Master</span> |
| **Distributed message queue** — partitions, replication, consumer groups, delivery guarantees; the deep dive: rebuilding Kafka from its parts | <span className="db-tier t-master">Master</span> |
| **Unique id generator** — time-ordered ids, clock skew, ordering guarantees; the deep dive: the clock that went backwards | <span className="db-tier t-understand">Understand</span> |
| **Web crawler** — the frontier, politeness, dedupe, robots rules, storage; the deep dive: the frontier and freshness | <span className="db-tier t-understand">Understand</span> |
| **File sync, cloud-drive-style** — chunking, dedup, delta sync, the metadata service, conflicts; the deep dive: the sync protocol | <span className="db-tier t-understand">Understand</span> |
| **Social graph and timeline** — followers, posts, the read path, counters; the deep dive: counts at scale | <span className="db-tier t-understand">Understand</span> |
| **Hotel reservation** — inventory by date, overbooking policy, pricing; the deep dive: concurrency on date ranges | <span className="db-tier t-understand">Understand</span> |
| **Digital wallet** — balances, transfers, ledger consistency; the deep dive: the transfer across two shards | <span className="db-tier t-understand">Understand</span> |
| **Stock exchange** — the order book, the matching engine, market-data fan-out; the deep dive: deterministic sequencing | <span className="db-tier t-understand">Understand</span> |
| **Ad click aggregation** — event ingestion, exactly-once counting, windows, late data; the deep dive: the stream-processing pipeline | <span className="db-tier t-understand">Understand</span> |
| **Metrics and monitoring system** — ingestion, time-series storage, downsampling, alerting; the deep dive: cardinality | <span className="db-tier t-understand">Understand</span> |
| **Distributed job scheduler** — the job store, leader election, workers, exactly-once execution; the deep dive: the missed-run policy | <span className="db-tier t-understand">Understand</span> |
| **Collaborative editing** — operational transformation vs CRDTs, presence, history; the deep dive: convergence | <span className="db-tier t-understand">Understand</span> |
| **Object storage, S3-like** — metadata separated from data, erasure coding, durability, consistency; the deep dive: the durability arithmetic | <span className="db-tier t-understand">Understand</span> |
| **Leaderboard** — sorted sets, sharding by score bucket, top-k and rank queries; the deep dive: rank at scale | <span className="db-tier t-understand">Understand</span> |
| **Distributed lock and coordination service** — leases, fencing, consensus underneath; the deep dive: the lease that expired mid-operation | <span className="db-tier t-understand">Understand</span> |
| **Logging pipeline** — agents, buffering, storage tiers, search; the deep dive: backpressure when the store is slow | <span className="db-tier t-understand">Understand</span> |
| **Maps and ETA** — the road graph, shortest paths at scale, precomputation, traffic; the deep dive: what is precomputed and when | <span className="db-tier t-know">Know</span> |
| **Email service** — the sending pipeline, deliverability, inbox storage, search; the deep dive: the outbound queue and its retries | <span className="db-tier t-know">Know</span> |
| **Code deployment system** — artifacts, distribution to thousands of hosts, rollouts, rollback; the deep dive: the distribution tree | <span className="db-tier t-know">Know</span> |
| **Search engine basics** — crawling, indexing, the inverted index, ranking, serving; the deep dive: index sharding | <span className="db-tier t-know">Know</span> |
| **Recommendation basics** — candidate generation, ranking, feature stores, feedback loops; the deep dive: the online and offline split | <span className="db-tier t-know">Know</span> |

**Gate — move on when:** you can take any Master row cold and deliver the full method from
[Part 1](01-the-interview-and-the-method.md) in forty-five minutes — and, for the deep dive
named in the row, say what breaks first at ten times the load.

---

## Phase 22 — Product-company systems, India-scale

The same building blocks under traffic shapes and products that are specific to this market:
a hard-deadline burst measured in seconds, hundreds of millions of low-end devices on patchy
networks, payments that settle through banks with their own timeouts. Company names appear
only as "-style" shorthand for the problem shape; nothing here claims to describe any
company's internals.

| Topic | Tier |
|---|---|
| **A UPI-style payment switch** — idempotency across banks, timeouts at the bank leg, reconciliation, reversals; the deep dive: the transaction that neither succeeded nor failed | <span className="db-tier t-master">Master</span> |
| **Sale-day checkout** — pre-scaling, a queue at the gate, inventory decrement, degraded modes; the deep dive: fairness against throughput when demand is a hundred times supply | <span className="db-tier t-master">Master</span> |
| **A tatkal-style ticket burst** — a fixed window where demand exceeds inventory by orders of magnitude, queue tokens, bot defence; the deep dive: the first sixty seconds | <span className="db-tier t-master">Master</span> |
| **Ten-minute delivery from dark stores** — per-store inventory, serviceability by location, rider dispatch, ETA; the deep dive: inventory that is local to a store, not global | <span className="db-tier t-master">Master</span> |
| **Food delivery: order and rider dispatch** — restaurant acceptance, rider assignment, live tracking, ETA; the deep dive: assignment under uncertainty | <span className="db-tier t-master">Master</span> |
| **OTP and SMS gateway** — carrier failover, rate limits, retries, delivery reports; the deep dive: the carrier that silently drops messages | <span className="db-tier t-master">Master</span> |
| **Movie-ticket seat locking at city scale** — shows, seats, holds, payment, the hot premiere; the deep dive: the one show everyone wants | <span className="db-tier t-master">Master</span> |
| **The monolith-to-services migration** — the strangler pattern, data ownership, the first service to carve out; the deep dive: the shared database nobody can leave | <span className="db-tier t-master">Master</span> |
| **Live streaming at tens of millions concurrent** — CDN fan-out, adaptive bitrate, live commentary and reactions, ad insertion; the deep dive: the comment firehose | <span className="db-tier t-understand">Understand</span> |
| **Fantasy-sports contest joins at match start** — a write spike against a hard deadline, wallet debits, contest capacity; the deep dive: the deadline write path | <span className="db-tier t-understand">Understand</span> |
| **Cab and auto dispatch in dense cities** — location ingestion at scale, matching, surge, cancellations; the deep dive: the location stream | <span className="db-tier t-understand">Understand</span> |
| **Broker order flow at market open** — validation, risk checks, the exchange gateway, market data; the deep dive: latency in the first minute | <span className="db-tier t-understand">Understand</span> |
| **Marketplace with sellers and settlements** — multi-party orders, commissions, payouts, disputes; the deep dive: the settlement run | <span className="db-tier t-understand">Understand</span> |
| **Travel search and fare caching** — supplier fan-out, caching volatile prices, the price that changed at checkout; the deep dive: freshness against supplier cost | <span className="db-tier t-understand">Understand</span> |
| **Serving the next billion users** — low-end devices, patchy networks, vernacular content, lite clients; the deep dive: payload budgets and offline-first | <span className="db-tier t-understand">Understand</span> |
| **A credit-card bill and rewards platform** — statements, payments, a rewards ledger, partner offers; the deep dive: the rewards ledger | <span className="db-tier t-know">Know</span> |
| **Social-commerce reselling feeds** — catalogue sharing, feeds, orders on behalf of buyers; the deep dive: the feed on a low-end device | <span className="db-tier t-know">Know</span> |
| **A vernacular search and voice pipeline** — transliteration, mixed-script queries, speech to text; the deep dive: query normalisation | <span className="db-tier t-know">Know</span> |

**Gate — deliverable:** the sale-day checkout designed end to end — the gate queue, the
inventory service, the payment leg with its timeouts, the degradation ladder — with the
numbers estimated for a burst that is a hundred times normal traffic.

---

{/* NAV */}
