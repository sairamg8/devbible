---
title: "Part 5 — Event streaming and async"
sidebar_label: "5 · Event streaming"
sidebar_position: 5
---

> Phases 8–9 · Moving work off the request path without losing it, and the log-based architecture that most large systems settle on

"We'll put it on a queue" is the most common sentence in a design interview and the least
often justified. This part makes the justification explicit: what asynchrony buys, what it
costs in ordering and duplicates, how to pick a broker from the access pattern, and how Kafka
and change data capture turn a set of databases into one consistent estate. The
implementations live in [Java's messaging phase](../../java/pages/phase-15-messaging-event-driven/README.md),
[Redis streams](../../redis/README.md) and Node's
[background-work phase](../../nodejs/pages/phase-7-background-work/README.md); this part is the
design layer over them.

---

## Phase 8 — Messaging fundamentals and choosing a broker

The vocabulary and guarantees that hold for every broker, and the decision table that picks
one. The running example is the storefront's order lifecycle: placed, paid, packed, shipped —
with an email, an inventory update and a search-index refresh hanging off each step.

| Topic | Tier |
|---|---|
| **Why asynchronous at all** — decoupling, buffering, fan-out, time-shifting, isolating retries from the user's request; the order-confirmation email as the canonical case, and the cases where async is the wrong answer | <span className="db-tier t-master">Master</span> |
| **Queue vs log semantics** — a queue deletes on consume, a log retains and lets each consumer track its own position; what replay, multiple independent consumers and ordering each imply for the choice | <span className="db-tier t-master">Master</span> |
| **Delivery guarantees** — at-most-once, at-least-once, effectively-once; acknowledgement modes; why the consumer must be idempotent regardless of what the broker promises ([Part 4](04-distributed-systems-theory.md)) | <span className="db-tier t-master">Master</span> |
| **Ordering guarantees** — per-key ordering vs global ordering and its cost, what a retry or a dead-letter detour does to order, the "order events for one order stay in order" requirement | <span className="db-tier t-master">Master</span> |
| **Consumer groups and competing consumers** — the partition as the unit of parallelism, one consumer per partition, rebalancing when membership changes | <span className="db-tier t-master">Master</span> |
| **Backpressure and bounded queues** — an unbounded queue is an outage on a timer; lag as the health signal; buffering vs shedding vs slowing the producer | <span className="db-tier t-master">Master</span> |
| **Dead-letter queues and poison messages** — retry with backoff, retry topics that keep one bad message from stalling a partition, the dead-letter queue nobody reads and the alert that fixes that | <span className="db-tier t-master">Master</span> |
| **Message schemas and evolution** — JSON Schema, Avro, Protobuf; a schema registry; backward and forward compatibility rules; the renamed field that broke every consumer at once | <span className="db-tier t-master">Master</span> |
| **Three things called "events"** — event notification, event-carried state transfer, event sourcing; what each one couples, and which one the storefront's inventory service actually wants | <span className="db-tier t-master">Master</span> |
| **Choosing the broker** — RabbitMQ (routing, per-message acks, work queues), Kafka (replay, ordering, throughput, stream processing), cloud queues and topics (operational zero), NATS, Redis Streams; decided by access pattern, not fashion | <span className="db-tier t-master">Master</span> |
| **Push vs pull** — broker-driven vs consumer-driven flow; why backpressure falls out of pull for free and has to be built for push | <span className="db-tier t-understand">Understand</span> |
| **Fan-out patterns** — topics and subscriptions, exchange types, one event feeding email, inventory and search without the producer knowing any of them | <span className="db-tier t-understand">Understand</span> |
| **Transactions and messaging** — the dual write, the outbox as the answer, transactional consumers that commit the offset with the side effect | <span className="db-tier t-understand">Understand</span> |
| **Request-reply over messaging** — correlation ids, reply queues, timeouts; when it is a legitimate pattern and when it is HTTP wearing a costume | <span className="db-tier t-understand">Understand</span> |
| **Payload design** — headers vs body, an envelope with type and version, the claim-check pattern for large payloads that belong in object storage | <span className="db-tier t-understand">Understand</span> |
| **Observability for async work** — tracing across a queue hop, lag dashboards, dead-letter alerts, age-of-oldest-message; continues [Part 8](08-reliability-and-observability.md) | <span className="db-tier t-understand">Understand</span> |
| **The storefront's order events end to end** — who publishes each transition, who consumes it, what each consumer guarantees, and where a duplicate is harmless versus harmful | <span className="db-tier t-understand">Understand</span> |
| **Delayed and scheduled messages** — delay queues, visibility timeouts, scheduled delivery; the abandoned-cart reminder built three ways | <span className="db-tier t-know">Know</span> |
| **Priority and fairness** — priority queues, per-tenant fairness, the tenant whose backlog starves everyone else | <span className="db-tier t-know">Know</span> |

**Gate — move on when:** given "the confirmation email must be sent once per order, even if
the mailer crashes", you can name the guarantee each component provides, where the duplicate
is stopped, and which broker you would pick with a reason that survives "why not the other
one?"

---

## Phase 9 — Kafka, CDC and event-driven architecture

Kafka is the broker interviewers assume you know, and the one whose model surprises
queue-thinkers most. This phase is Kafka as a system component: the guarantees, the dials,
the way it feeds every other store through change data capture, and the architectures —
event sourcing, CQRS — that only make sense on a log.

| Topic | Tier |
|---|---|
| **Kafka's architecture** — brokers, topics, partitions, replicas, leaders and followers per partition, and the controller quorum that replaced the external coordinator; the log as the primitive everything else is built on | <span className="db-tier t-master">Master</span> |
| **Producers** — the key decides the partition and therefore the ordering, acknowledgement levels, the idempotent producer, batching, linger and compression; latency and throughput on one dial | <span className="db-tier t-master">Master</span> |
| **Consumers** — offsets, automatic vs manual commits, consumer groups, rebalancing and rebalance storms, lag as the metric that matters | <span className="db-tier t-master">Master</span> |
| **In-sync replicas and durability** — the in-sync set, the minimum in-sync count, unclean leader election; exactly what "acknowledged by all" promises and when it still loses data | <span className="db-tier t-master">Master</span> |
| **Exactly-once within Kafka** — transactions and read-committed consumers; the boundary: exactly-once *processing inside Kafka*, never across your database, and what you build to bridge it | <span className="db-tier t-master">Master</span> |
| **Partition count and parallelism** — choosing the count, the ceiling it sets on consumers, hot partitions from key skew, the cost of changing it later | <span className="db-tier t-master">Master</span> |
| **Change data capture with Debezium** — PostgreSQL logical decoding, replication slots and the disk they fill when a consumer stalls, snapshotting, the outbox implemented through CDC | <span className="db-tier t-master">Master</span> |
| **Kafka as a system-design component** — when a queue is enough, when the log is justified; the interviewer's "why Kafka?" answered with replay, ordering and fan-out rather than with fashion | <span className="db-tier t-master">Master</span> |
| **Retention, compaction and tiered storage** — time and size retention, log compaction for changelog topics, tiered storage for long retention at lower cost | <span className="db-tier t-understand">Understand</span> |
| **Kafka Connect** — source and sink connectors, why a CDC source beats a polling one, sinks into the search index and the warehouse | <span className="db-tier t-understand">Understand</span> |
| **Stream processing** — windows (tumbling, hopping, session), joins, state stores, watermarks and late events; where a stream processor replaces a nightly batch | <span className="db-tier t-understand">Understand</span> |
| **Event sourcing** — state as a log of events, projections, replay, snapshots, versioning old events; where it pays and where it is an expensive audit log | <span className="db-tier t-understand">Understand</span> |
| **CQRS** — separate read and write models, the eventual consistency between them, the screen that must read its own write | <span className="db-tier t-understand">Understand</span> |
| **Event-driven architecture** — event storming, bounded contexts, choreography vs orchestration at the system level; the coupling that events hide instead of removing (see [Java's microservice phase](../../java/pages/phase-14-microservice-architecture/README.md)) | <span className="db-tier t-understand">Understand</span> |
| **Clients in this stack** — Node clients vs Spring Kafka; the consumer loop, graceful shutdown, commit strategy, and the deploy that lost messages on restart | <span className="db-tier t-understand">Understand</span> |
| **Schema registry in practice** — subject naming, compatibility modes, the safe deploy order for producers and consumers | <span className="db-tier t-understand">Understand</span> |
| **Operating Kafka** — lag monitoring, broker capacity, partition reassignment, upgrade discipline; managed Kafka against running it yourself | <span className="db-tier t-understand">Understand</span> |
| **Multi-cluster and cross-region replication** — mirroring between clusters, active-active pitfalls, offset translation, disaster recovery for the log | <span className="db-tier t-know">Know</span> |

**Gate — deliverable:** the storefront's event backbone on one page: topics and keys, the
partition count with its reasoning, the CDC path from PostgreSQL to search and analytics,
the retry and dead-letter topics, and the answer to "what happens to ordering when the
inventory consumer crashes mid-batch".

---

{/* NAV */}
