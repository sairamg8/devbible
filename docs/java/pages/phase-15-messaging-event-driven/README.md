---
title: "Phase 15 — Messaging and event-driven architecture"
sidebar_label: "Overview"
sidebar_position: 0
---

> **Target: Kafka 4.x · RabbitMQ 4.x · Spring for Apache Kafka / Spring AMQP.**
> Documentation-validated — every page names its sources on a `> Verified:`
> line (kafka.apache.org docs, rabbitmq.com docs, the Spring Kafka and Spring
> AMQP references, microservices.io for outbox/saga, debezium.io). No sandbox
> and no broker on this machine: pages carry code and config, never fabricated
> broker output, offsets or lag numbers.

Where the hardest correctness bugs in distributed Java live. The theme
throughout: **at-least-once delivery is the reality, so idempotency is not
optional** — everything else is detail on top of that sentence.

🚧 **0 of 14 written.**

| # | Page | Tier | In one line |
|---|---|---|---|
| 01 | **Why queues** *(not written yet)* | <span className="db-tier t-understand">Understand</span> | Temporal decoupling, load leveling — and the price |
| 02 | **RabbitMQ model** *(not written yet)* | <span className="db-tier t-master">Master</span> | Exchanges, acks, DLQs — and the poison message that loops |
| 03 | **Kafka is a log, not a queue** *(not written yet)* | <span className="db-tier t-master">Master</span> | Partitions, offsets, consumer groups — the model shift |
| 04 | **Producing from Spring** *(not written yet)* | <span className="db-tier t-understand">Understand</span> | Keys decide ordering; `acks=all`; idempotent producer |
| 05 | **Consuming and rebalancing** *(not written yet)* | <span className="db-tier t-understand">Understand</span> | Commit strategies; lag as the health metric |
| 06 | **Spring Kafka in practice** *(not written yet)* | <span className="db-tier t-understand">Understand</span> | `@KafkaListener`, retry topics, dead-letter publishing |
| 07 | **Delivery semantics, honestly** *(not written yet)* | <span className="db-tier t-master">Master</span> | What "exactly-once" actually covers — and doesn't |
| 08 | **Idempotent consumers** *(not written yet)* | <span className="db-tier t-master">Master</span> | Dedup tables, natural idempotency — at-least-once made safe |
| 09 | **The transactional outbox** *(not written yet)* | <span className="db-tier t-master">Master</span> | The dual-write problem and its standard fix; Debezium/CDC |
| 10 | **Sagas** *(not written yet)* | <span className="db-tier t-understand">Understand</span> | Choreography vs orchestration; compensating transactions |
| 11 | **Event design** *(not written yet)* | <span className="db-tier t-know">Know</span> | Notification vs state transfer vs event sourcing |
| 12 | **Schema evolution** *(not written yet)* | <span className="db-tier t-know">Know</span> | Avro/Protobuf + Schema Registry; compatibility modes |
| 13 | **Spring Cloud Stream** *(not written yet)* | <span className="db-tier t-know">Know</span> | The binder abstraction — what it hides |
| 14 | **Choosing the broker** *(not written yet)* | <span className="db-tier t-understand">Understand</span> | Kafka vs RabbitMQ vs cloud queues, by access pattern |

## Phase gate

Move on when you can explain the dual-write bug in naive "save then publish"
code, fix it with an outbox on paper, and state what the consumer must do
because the relay delivers at-least-once — without using "exactly-once"
incorrectly.

## Where this connects

- **[Phase 10](../phase-10-data-access/README.md)** topic 04's transactions
  are the outbox's foundation.
- This bible's **[Node.js microservices reference](../../../nodejs/README.md)**
  implements the RabbitMQ saga these pages analyze.
- **Phase 16 — Resilience** handles the sync half of what messaging solves
  asynchronously.
