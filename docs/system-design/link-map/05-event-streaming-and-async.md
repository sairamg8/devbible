---
title: "Link map · System design · Part 5 (phases 8–9)"
sidebar_label: "05 · event streaming"
sidebar_position: 5
---

# Link map · System design · Part 5 (phases 8–9)

Covers every topic row of `docs/system-design/syllabus/05-event-streaming-and-async.md`: Phase 8 (messaging fundamentals and choosing a broker, 19 rows) and Phase 9 (Kafka, CDC and event-driven architecture, 18 rows). Our pages under `docs/system-design/pages` stop at phase 3, so all 37 rows are marked not written; the "Our delta" line then records what the syllabus row promises.
*read* = I read the passage that supports the claim in the fetched text; *headings only* = fetched at 200, headings or opening checked, passage not read. Fetches returned condensed text, so *read* means the stated claim was in that text. Third-party links carry a date only where the page or its address shows one. No `#anchors` are given. Where no good non-official explanation turned up, the block has no "Beyond the docs" line. Every URL below was fetched on 2026-10-14 and served its content at the address shown (the O'Reilly and GitHub wiki pages answer a bare `curl` with 403 but load in a browser). Kafka pages are the 4.3 documentation.

---

## Phase 8 — Messaging fundamentals and choosing a broker

### T08-01 · Why asynchronous at all — Master · 🔲 not written
- **Read this:** [Queue-Based Load Leveling pattern](https://learn.microsoft.com/en-us/azure/architecture/patterns/queue-based-load-leveling) · Microsoft Learn, Azure Architecture Center · a queue between task and service lets the service work at its own pace, keeps the caller working when the service is down, and costs only average-load capacity; it is unsuitable when the caller needs a synchronous low-latency answer (*read*) · covers our angle: **partial** — decoupling, buffering and the "wrong answer" cases are there, with no fan-out or time-shifting story and no order-confirmation email example · fetched 2026-10-14
- **Also good:** [Amazon SQS standard queues](https://docs.aws.amazon.com/AWSSimpleQueueService/latest/SQSDeveloperGuide/standard-queues.html) · AWS · lists "decoupling live user requests from intensive background work" as the first use case, with the at-least-once caveat that consumers must tolerate duplicates and reordering (*read*) · fetched 2026-10-14
- **Beyond the docs:** [Avoiding insurmountable queue backlogs](https://builder.aws.com/content/3EuRcgkTP1MI0c7zM8W6HL3WIqA/avoiding-insurmountable-queue-backlogs) · Amazon Builders' Library · the cost side of async: a queue turns a fast mode into a slow backlogged mode, and recovery can take far longer than the outage (*read*) · fetched 2026-10-14
- **Our delta:** the syllabus row ties five benefits (decoupling, buffering, fan-out, time-shifting, retry isolation) to one storefront case, the order-confirmation email, and names when async is wrong.

### T08-02 · Queue vs log semantics — Master · 🔲 not written
- **Read this:** [Apache Kafka introduction](https://kafka.apache.org/43/getting-started/introduction/) · Apache Kafka 4.3 docs · events are not deleted after being read; retention decides how long they live, and each consumer reads on its own (*read*) · covers our angle: **partial** — the log side only; the queue side (delete on consume) is not contrasted · fetched 2026-10-14
- **Also good:** [RabbitMQ streams](https://www.rabbitmq.com/docs/streams) · RabbitMQ docs · the queue-to-log contrast inside one broker: classic queues delete on consume, streams keep messages and let a consumer attach at first, last, an offset or a timestamp (*read*) · fetched 2026-10-14
- **Beyond the docs:** [Using logs to build a solid data infrastructure](https://martin.kleppmann.com/2015/05/27/logs-for-data-infrastructure.html) · Martin Kleppmann, 2015 · why an ordered append-only log lets many stores follow one history and be rebuilt by replay (*read*) · fetched 2026-10-14
- **Our delta:** what replay, several independent consumers and ordering each imply for choosing queue or log.

### T08-03 · Delivery guarantees — Master · 🔲 not written
- **Read this:** [RabbitMQ consumer acknowledgements and publisher confirms](https://www.rabbitmq.com/docs/confirms) · RabbitMQ docs · manual acks versus automatic "fire-and-forget"; unacked deliveries are requeued when a channel closes; consumers "should be idempotent"; publisher confirms and consumer acks are independent; no exactly-once claim (*read*) · covers our angle: **partial** — acknowledgement modes and duplicates are covered, while at-most-once versus effectively-once is not framed · fetched 2026-10-14
- **Also good:** [Idempotent Receiver](https://www.enterpriseintegrationpatterns.com/patterns/messaging/IdempotentReceiver.html) · Enterprise Integration Patterns · a sender may send once yet the receiver can still see duplicates; either de-duplicate explicitly or make the semantics idempotent (*read*) · fetched 2026-10-14
- **Beyond the docs:** [You Cannot Have Exactly-Once Delivery](https://bravenewgeek.com/you-cannot-have-exactly-once-delivery/) · Tyler Treat · Two Generals framing: an unacked sender cannot tell lost message from lost ack, so choose at-most-once or at-least-once and make operations idempotent (*read*) · fetched 2026-10-14
- **Our delta:** names the guarantee each component in the "email once per order" gate provides and where the duplicate is stopped, linking to Part 4.

### T08-04 · Ordering guarantees — Master · 🔲 not written
- **Read this:** [Amazon SQS FIFO queues](https://docs.aws.amazon.com/AWSSimpleQueueService/latest/SQSDeveloperGuide/sqs-fifo-queues.html) · AWS · strict order within a message group, unlimited groups per queue, and a throughput ceiling that high-throughput mode raises (*read*) · covers our angle: **partial** — per-key order and its cost are covered; retry detours are not · fetched 2026-10-14
- **Also good:** [Resequencer](https://www.enterpriseintegrationpatterns.com/patterns/messaging/Resequencer.html) · Enterprise Integration Patterns · parallel routes deliver messages out of order, and a stateful buffer re-orders them (*read*) · fetched 2026-10-14
- **Also good:** [Using dead-letter queues in Amazon SQS](https://docs.aws.amazon.com/AWSSimpleQueueService/latest/SQSDeveloperGuide/sqs-dead-letter-queues.html) · AWS · warns not to put a dead-letter queue on a FIFO queue if you want to keep exact order (*read*) · fetched 2026-10-14
- **Our delta:** per-key versus global ordering, what a retry or dead-letter detour does to order, and the "events for one order stay in order" requirement.

### T08-05 · Consumer groups and competing consumers — Master · 🔲 not written
- **Read this:** [Competing Consumers](https://www.enterpriseintegrationpatterns.com/patterns/messaging/CompetingConsumers.html) · Enterprise Integration Patterns · several consumers on one point-to-point channel; Kafka does it with partitions, so consumers do not truly compete and a group cannot have more consumers than partitions (*read*) · covers our angle: **partial** — partition as the unit of parallelism is there; rebalancing is not · fetched 2026-10-14
- **Also good:** [Kafka design](https://kafka.apache.org/43/design/_print/) · Apache Kafka 4.3 docs · each partition goes to exactly one consumer per subscribing group; static membership via `group.instance.id` avoids needless rebalances (*read*) · fetched 2026-10-14
- **Beyond the docs:** [Apache Kafka 101 architecture course](https://developer.confluent.io/courses/architecture/get-started/) · Confluent Developer, Jun Rao · a 15-module course whose "Consumer Group Protocol" module covers rebalancing (*headings only*) · fetched 2026-10-14
- **Our delta:** one consumer per partition and what happens on a membership change.

### T08-06 · Backpressure and bounded queues — Master · 🔲 not written
- **Read this:** [Avoiding insurmountable queue backlogs](https://builder.aws.com/content/3EuRcgkTP1MI0c7zM8W6HL3WIqA/avoiding-insurmountable-queue-backlogs) · Amazon Builders' Library · message age is a better health signal than producer errors; techniques include sidelining old messages, TTL, concurrency limits and upstream backpressure (*read*) · covers our angle: **full** for lag as the signal and for buffer, shed or slow · fetched 2026-10-14
- **Also good:** [Queue-Based Load Leveling pattern](https://learn.microsoft.com/en-us/azure/architecture/patterns/queue-based-load-leveling) · Microsoft Learn · if the producer rate exceeds the consumer rate the queue grows forever, so monitor depth and shed work at the producer (*read*) · fetched 2026-10-14
- **Also good:** [RabbitMQ consumer prefetch](https://www.rabbitmq.com/docs/consumer-prefetch) · RabbitMQ docs · prefetch caps unacked messages per consumer; zero means unlimited (*read*) · fetched 2026-10-14
- **Our delta:** "an unbounded queue is an outage on a timer" as the framing, with lag on the dashboard.

### T08-07 · Dead-letter queues and poison messages — Master · 🔲 not written
- **Read this:** [Using dead-letter queues in Amazon SQS](https://docs.aws.amazon.com/AWSSimpleQueueService/latest/SQSDeveloperGuide/sqs-dead-letter-queues.html) · AWS · a redrive policy with `maxReceiveCount` moves a message after N receives; redrive moves it back; alarm on DLQ arrivals; set DLQ retention longer than the source's (*read*) · covers our angle: **partial** — DLQ and alarms are covered; per-partition retry topics are Kafka-specific and absent · fetched 2026-10-14
- **Also good:** [RabbitMQ dead letter exchanges](https://www.rabbitmq.com/docs/dlx) · RabbitMQ docs · four dead-letter triggers (reject, TTL, length limit, delivery limit) and the `x-death` header; at-least-once dead lettering only on quorum queues (*read*) · fetched 2026-10-14
- **Also good:** [Dead Letter Channel](https://www.enterpriseintegrationpatterns.com/patterns/messaging/DeadLetterChannel.html) · Enterprise Integration Patterns · the general pattern, with SQS and Kafka Connect `errors.deadletterqueue.topic.name` examples (*read*) · fetched 2026-10-14
- **Our delta:** retry with backoff, retry topics that stop one bad message stalling a partition, and the alert that makes the DLQ get read.

### T08-08 · Message schemas and evolution — Master · 🔲 not written
- **Read this:** [Schema evolution and compatibility](https://docs.confluent.io/platform/current/schema-registry/fundamentals/schema-evolution.html) · Confluent docs · `BACKWARD` is the default; each mode (backward, forward, full, transitive) with its upgrade order (*read*) · covers our angle: **partial** — compatibility rules are exact; the renamed-field incident and JSON Schema versus Protobuf choice are not · fetched 2026-10-14
- **Beyond the docs:** [Schema evolution in Avro, Protocol Buffers and Thrift](https://martin.kleppmann.com/2012/12/05/schema-evolution-in-avro-protocol-buffers-thrift.html) · Martin Kleppmann, 2012 · Protobuf and Thrift evolve by field tag (never reuse a tag), Avro by resolving writer against reader schema with defaults and aliases for renames (*read*) · fetched 2026-10-14
- **Our delta:** the renamed field that broke every consumer at once, as the worked failure.

### T08-09 · Three things called "events" — Master · 🔲 not written
- **Read this:** [What do you mean by Event-Driven?](https://martinfowler.com/articles/201701-event-driven.html) · Martin Fowler · separates event notification, event-carried state transfer, event sourcing and CQRS, with the coupling and duplication cost of each (*read*) · covers our angle: **partial** — the taxonomy is the same; it does not pick one for an inventory service · fetched 2026-10-14
- **Also good:** [Event-driven architecture style](https://learn.microsoft.com/en-us/azure/architecture/guide/architecture-styles/event-driven) · Microsoft Learn · full-payload events versus keys-only events and the consistency and coupling trade-off (*read*) · fetched 2026-10-14
- **Also good:** [Introduction to designing events and event streams](https://developer.confluent.io/courses/event-design/intro/) · Confluent Developer · an intro module that names fact versus delta events and "transferring state" as an event purpose; the detail is in later modules (*read*) · fetched 2026-10-14
- **Our delta:** which of the three the storefront's inventory service actually wants.

### T08-10 · Choosing the broker — Master · 🔲 not written
- **Read this:** [Event-driven architecture style](https://learn.microsoft.com/en-us/azure/architecture/guide/architecture-styles/event-driven) · Microsoft Learn · contrasts pub/sub (no durable log, new subscribers miss history) with event streaming (ordered per partition, replayable) (*read*) · covers our angle: **partial** — queue versus log, no named RabbitMQ, NATS or Redis comparison · fetched 2026-10-14
- **Also good:** [RabbitMQ work queues tutorial](https://www.rabbitmq.com/tutorials/tutorial-two-python) · RabbitMQ · per-message acks, round-robin and fair dispatch with prefetch (*read*) · fetched 2026-10-14
- **Also good:** [NATS JetStream](https://docs.nats.io/concepts/jetstream) · NATS docs · core NATS is at-most-once and never replayed; JetStream adds persistence, at-least-once and replay (*read*) · fetched 2026-10-14
- **Also good:** [Redis Streams](https://redis.io/docs/latest/develop/data-types/streams/) · Redis docs · append-only log with consumer groups, `XACK`, `XPENDING`, and `MAXLEN` trimming (*read*) · fetched 2026-10-14
- **Also good:** [Pub/Sub overview](https://docs.cloud.google.com/pubsub/docs/overview) · Google Cloud · contrasts itself with partitioned systems, where the partition count caps concurrent clients; Pub/Sub leases individual messages to subscribers instead (*read*) · fetched 2026-10-14
- **Beyond the docs:** [RabbitMQ vs Kafka Part 1 - Two Different Takes on Messaging](https://jack-vanlightly.com/blog/2017/12/4/rabbitmq-vs-kafka-part-1-messaging-topologies) · Jack Vanlightly, December 2017 · exchanges and queues against the partitioned log, consumer offsets and groups, push versus pull and ordering, side by side; part 1 of a six-part series that goes on to delivery semantics and fault tolerance (*read*) · fetched 2026-10-14
- **Our delta:** a decision table by access pattern, built to survive "why not the other one?".

### T08-11 · Push vs pull — Understand · 🔲 not written
- **Read this:** [Kafka design](https://kafka.apache.org/43/design/_print/) · Apache Kafka 4.3 docs · consumers pull so each sets its own rate and a push overload risk is avoided; long polling avoids busy waiting (*read*) · covers our angle: **full** for why pull gives backpressure · fetched 2026-10-14
- **Also good:** [Pub/Sub subscription types](https://docs.cloud.google.com/pubsub/docs/subscriber) · Google Cloud · pull for high volume with subscriber-controlled rate; push has server-side flow control and an HTTP error as the overload signal (*read*) · fetched 2026-10-14
- **Also good:** [Polling Consumer](https://www.enterpriseintegrationpatterns.com/patterns/messaging/PollingConsumer.html) · Enterprise Integration Patterns · the application decides when to receive (*read*) · fetched 2026-10-14
- **Our delta:** what has to be built by hand for push (prefetch, windows) that pull gives free.

### T08-12 · Fan-out patterns — Understand · 🔲 not written
- **Read this:** [Publish-Subscribe Channel](https://www.enterpriseintegrationpatterns.com/patterns/messaging/PublishSubscribeChannel.html) · Enterprise Integration Patterns · one copy per subscriber, each consumed once; Pub/Sub maps topics to pub-sub and subscriptions to competing consumers (*read*) · covers our angle: **partial** · fetched 2026-10-14
- **Also good:** [RabbitMQ exchanges](https://www.rabbitmq.com/docs/exchanges) · RabbitMQ docs · fanout, topic (`*` and `#` patterns) and direct exchanges, plus the default exchange (*read*) · fetched 2026-10-14
- **Also good:** [Fanout SNS notifications to SQS queues](https://docs.aws.amazon.com/sns/latest/dg/sns-sqs-as-subscriber.html) · AWS · an SNS topic copying each publish into subscribed queues that persist for later processing (*read*) · fetched 2026-10-14
- **Our delta:** one event feeding email, inventory and search without the producer knowing any of them.

### T08-13 · Transactions and messaging — Understand · 🔲 not written
- **Read this:** [Transactional outbox](https://microservices.io/patterns/data/transactional-outbox.html) · microservices.io, Chris Richardson · write the message to an outbox in the same transaction as the business row, then a relay publishes it; the relay may duplicate, so "a message consumer must be idempotent" (*read*) · covers our angle: **partial** — the dual write and outbox are covered; the offset-with-side-effect transactional consumer is not · fetched 2026-10-14
- **Also good:** [Reliable microservices data exchange with the outbox pattern](https://debezium.io/blog/2019/02/19/reliable-microservices-data-exchange-with-the-outbox-pattern/) · Debezium blog, 2019 · Kafka cannot join an XA transaction, so the order and its event can diverge; the outbox plus WAL capture fixes it, and the consumer de-duplicates on the event UUID (*read*) · fetched 2026-10-14
- **Beyond the docs:** [Using logs to build a solid data infrastructure](https://martin.kleppmann.com/2015/05/27/logs-for-data-infrastructure.html) · Martin Kleppmann, 2015 · why dual writes leave stores permanently inconsistent and change data capture is the remedy (*read*) · fetched 2026-10-14
- **Our delta:** the outbox as the answer, and consumers that commit the offset with the side effect.

### T08-14 · Request-reply over messaging — Understand · 🔲 not written
- **Read this:** [RabbitMQ RPC tutorial](https://www.rabbitmq.com/tutorials/tutorial-six-python) · RabbitMQ · `reply_to` callback queue plus `correlation_id`; calls RPC "often criticised", and lists missing timeouts and duplicate replies as caveats (*read*) · covers our angle: **full** for correlation ids, reply queues and timeouts · fetched 2026-10-14
- **Also good:** [Request-Reply](https://www.enterpriseintegrationpatterns.com/patterns/messaging/RequestReply.html) · Enterprise Integration Patterns · a pair of messages on two channels, with the reply channel almost always point-to-point (*read*) · fetched 2026-10-14
- **Also good:** [Asynchronous Request-Reply pattern](https://learn.microsoft.com/en-us/azure/architecture/patterns/asynchronous-request-reply) · Microsoft Learn · the HTTP version: 202 Accepted, a status endpoint and `Retry-After` (*read*) · fetched 2026-10-14
- **Our delta:** when it is legitimate and when it is HTTP wearing a costume.

### T08-15 · Payload design — Understand · 🔲 not written
- **Read this:** [Claim Check pattern](https://learn.microsoft.com/en-us/azure/architecture/patterns/claim-check) · Microsoft Learn · store the payload externally and send a reference; lifecycle ownership, publish the token only after the write succeeds, and the extra retrieval hop (*read*) · covers our angle: **partial** — claim check only, no envelope or header design · fetched 2026-10-14
- **Also good:** [Claim Check](https://www.enterpriseintegrationpatterns.com/patterns/messaging/StoreInLibrary.html) · Enterprise Integration Patterns · the original definition, with the airport luggage analogy (*read*) · fetched 2026-10-14
- **Also good:** [Envelope Wrapper](https://www.enterpriseintegrationpatterns.com/patterns/messaging/EnvelopeWrapper.html) · Enterprise Integration Patterns · wrap the payload to meet the infrastructure's header requirements and unwrap on arrival (*read*) · fetched 2026-10-14
- **Our delta:** headers versus body, a type-and-version envelope, and large payloads in object storage.

### T08-16 · Observability for async work — Understand · 🔲 not written
- **Read this:** [Messaging spans semantic conventions](https://opentelemetry.io/docs/specs/semconv/messaging/messaging-spans/) · OpenTelemetry · producers attach a creation context to each message; receive and process spans use links, since a span has one parent (*read*) · covers our angle: **partial** — tracing across the hop only; no lag or DLQ dashboards · fetched 2026-10-14
- **Also good:** [Kafka monitoring](https://kafka.apache.org/43/operations/monitoring/) · Apache Kafka 4.3 docs · `records-lag-max`, `UnderReplicatedPartitions`, `UnderMinIsrPartitionCount` and what each should read (*read*) · fetched 2026-10-14
- **Also good:** [Avoiding insurmountable queue backlogs](https://builder.aws.com/content/3EuRcgkTP1MI0c7zM8W6HL3WIqA/avoiding-insurmountable-queue-backlogs) · Amazon Builders' Library · age of oldest message beats error rates as the alarm (*read*) · fetched 2026-10-14
- **Also good:** [Available CloudWatch metrics for Amazon SQS](https://docs.aws.amazon.com/AWSSimpleQueueService/latest/SQSDeveloperGuide/sqs-available-cloudwatch-metrics.html) · AWS · `ApproximateAgeOfOldestMessage` and its traps: poison messages are excluded from it, the age resets when a message moves to a DLQ, and `ApproximateNumberOfMessagesVisible` is the metric to watch on the DLQ itself (*read*) · fetched 2026-10-14
- **Beyond the docs:** [Burrow consumer lag evaluation rules](https://github.com/linkedin/Burrow/wiki/Consumer-Lag-Evaluation-Rules) · LinkedIn Burrow wiki · lag judged over a sliding window of committed offsets rather than a fixed threshold, with explicit STALLED, STOPPED and falling-behind states (*read*) · fetched 2026-10-14
- **Our delta:** continues Part 8 with the four async signals: trace across the hop, lag, dead-letter alerts and oldest-message age.

### T08-17 · The storefront's order events end to end — Understand · 🔲 not written
- **Read this:** [Choreography pattern](https://learn.microsoft.com/en-us/azure/architecture/patterns/choreography) · Microsoft Learn · services react to each other's events with no orchestrator; needs idempotent consumers, an outbox for atomic state and event, and correlation ids (*read*) · covers our angle: **partial** — a drone-delivery example, not an order lifecycle · fetched 2026-10-14
- **Also good:** [What do you mean by Event-Driven?](https://martinfowler.com/articles/201701-event-driven.html) · Martin Fowler · the event kinds behind each lifecycle step (*read*) · fetched 2026-10-14
- **Our delta:** nobody else maps placed, paid, packed, shipped to publishers, consumers and a harmless-versus-harmful duplicate table for this storefront.

### T08-18 · Delayed and scheduled messages — Know · 🔲 not written
- **Read this:** [Amazon SQS delay queues](https://docs.aws.amazon.com/AWSSimpleQueueService/latest/SQSDeveloperGuide/sqs-delay-queues.html) · AWS · delay 0 to 15 minutes; per-message timers; for longer or recurring schedules use EventBridge Scheduler (*read*) · covers our angle: **partial** — the delay-queue way; no cart-reminder walkthrough · fetched 2026-10-14
- **Also good:** [Amazon SQS visibility timeout](https://docs.aws.amazon.com/AWSSimpleQueueService/latest/SQSDeveloperGuide/sqs-visibility-timeout.html) · AWS · default 30 seconds, 12 hours maximum, `ChangeMessageVisibility` to extend or reset (*read*) · fetched 2026-10-14
- **Our delta:** the abandoned-cart reminder built three ways.

### T08-19 · Priority and fairness — Know · 🔲 not written
- **Read this:** [RabbitMQ priority queues](https://www.rabbitmq.com/docs/priority) · RabbitMQ docs · classic queues cost a sub-queue per level, so use 2 to 4; strict priority on quorum queues can starve lower classes, so separate queues are suggested (*read*) · covers our angle: **partial** · fetched 2026-10-14
- **Also good:** [Priority Queue pattern](https://learn.microsoft.com/en-us/azure/architecture/patterns/priority-queue) · Microsoft Learn · single versus multiple queues and consumer pools; low priority can wait forever unless aged up (*read*) · fetched 2026-10-14
- **Also good:** [Amazon SQS fair queues](https://docs.aws.amazon.com/AWSSimpleQueueService/latest/SQSDeveloperGuide/sqs-fair-queues.html) · AWS · exactly this row's incident: a tenant's backlog raises dwell time for everyone; tagging messages with a tenant `MessageGroupId` on a standard queue lets SQS favour quiet tenants without capping the noisy one (*read*) · fetched 2026-10-14
- **Beyond the docs:** [Fairness in multi-tenant systems](https://builder.aws.com/content/3Eupj3d2bo4fEvlzYbICMZNhQ3B/fairness-in-multi-tenant-systems) · Amazon Builders' Library · per-tenant quotas, token buckets and cheap load shedding give each client a single-tenant experience (*read*) · fetched 2026-10-14
- **Our delta:** the tenant whose backlog starves everyone else.

---

## Phase 9 — Kafka, CDC and event-driven architecture

### T09-01 · Kafka's architecture — Master · 🔲 not written
- **Read this:** [Kafka design](https://kafka.apache.org/43/design/_print/) · Apache Kafka 4.3 docs · each partition has one leader and followers that pull; the KRaft controller elects leaders from the ISR and watches broker heartbeats (*read*) · covers our angle: **full** · fetched 2026-10-14
- **Also good:** [Apache Kafka introduction](https://kafka.apache.org/43/getting-started/introduction/) · Apache Kafka 4.3 docs · topics split into partitions across brokers, replication factor 3 is common, order holds only within a partition (*read*) · fetched 2026-10-14
- **Beyond the docs:** [Apache Kafka 101 architecture course](https://developer.confluent.io/courses/architecture/get-started/) · Confluent Developer, Jun Rao · broker internals, replication protocol and control plane module by module (*headings only*) · fetched 2026-10-14
- **Our delta:** the log as the primitive everything else is built on.

### T09-02 · Producers — Master · 🔲 not written
- **Read this:** [Kafka producer configs](https://kafka.apache.org/43/configuration/producer-configs/) · Apache Kafka 4.3 docs · defaults: `acks=all`, `enable.idempotence=true`, `linger.ms=5` (raised from 0 in 4.0), `batch.size=16384`, `compression.type=none`, `delivery.timeout.ms=120000` (*read*) · covers our angle: **partial** — the dials are exact; the key-decides-partition ordering link and trade-off are not drawn · fetched 2026-10-14
- **Also good:** [Exactly-once semantics are possible](https://www.confluent.io/blog/exactly-once-semantics-are-possible-heres-how-apache-kafka-does-it/) · Confluent blog · idempotent producer works like TCP with per-batch sequence numbers persisted in the replicated log (*read*) · fetched 2026-10-14
- **Our delta:** latency and throughput on one dial.

### T09-03 · Consumers — Master · 🔲 not written
- **Read this:** [Kafka design](https://kafka.apache.org/43/design/_print/) · Apache Kafka 4.3 docs · one offset per partition per group, rewind to re-consume, static membership; consumers needing exactly-once set `enable.auto.commit=false` (*read*) · covers our angle: **partial** — rebalance storms not covered · fetched 2026-10-14
- **Also good:** [Basic Kafka operations](https://kafka.apache.org/43/operations/basic-kafka-operations/) · Apache Kafka 4.3 docs · `kafka-consumer-groups.sh --describe` shows current offset, log-end offset and LAG per partition (*read*) · fetched 2026-10-14
- **Our delta:** lag as the metric that matters.

### T09-04 · In-sync replicas and durability — Master · 🔲 not written
- **Read this:** [Kafka design](https://kafka.apache.org/43/design/_print/) · Apache Kafka 4.3 docs · `min.insync.replicas` with `acks=all`, `replica.lag.time.max.ms`, and `unclean.leader.election.enable` false by default so Kafka favours consistency (*read*) · covers our angle: **partial** — does not walk through when "acked by all" still loses data · fetched 2026-10-14
- **Also good:** [Kafka monitoring](https://kafka.apache.org/43/operations/monitoring/) · Apache Kafka 4.3 docs · `UnderMinIsrPartitionCount` (ISR smaller than `min.insync.replicas`) and `UncleanLeaderElectionsPerSec` both list a normal value of 0; what a non-zero value costs is our inference, not the page's (*read*) · fetched 2026-10-14
- **Our delta:** exactly what "acknowledged by all" promises.

### T09-05 · Exactly-once within Kafka — Master · 🔲 not written
- **Read this:** [Transactions in Apache Kafka](https://www.confluent.io/blog/transactions-apache-kafka/) · Confluent blog · atomic multi-partition writes with offsets committed in the transaction; `transactional.id` epoch fences zombies; `read_committed`; covers only Kafka reads and writes (*read*) · covers our angle: **full** for the boundary · fetched 2026-10-14
- **Also good:** [Exactly-once semantics are possible](https://www.confluent.io/blog/exactly-once-semantics-are-possible-heres-how-apache-kafka-does-it/) · Confluent blog · the guarantee holds only inside Kafka Streams' processing; external stores need an exactly-once connector (*read*) · fetched 2026-10-14
- **Beyond the docs:** [You Cannot Have Exactly-Once Delivery](https://bravenewgeek.com/you-cannot-have-exactly-once-delivery/) · Tyler Treat · the sceptical counterweight: the practical bridge is idempotence (*read*) · fetched 2026-10-14
- **Our delta:** what you build to bridge Kafka and your own database.

### T09-06 · Partition count and parallelism — Master · 🔲 not written
- **Read this:** [Basic Kafka operations](https://kafka.apache.org/43/operations/basic-kafka-operations/) · Apache Kafka 4.3 docs · adding partitions changes `hash(key) % partitions` routing, so existing keys can move; counts cannot be reduced (*read*) · covers our angle: **partial** — the cost of changing the count; no sizing method · fetched 2026-10-14
- **Also good:** [Competing Consumers](https://www.enterpriseintegrationpatterns.com/patterns/messaging/CompetingConsumers.html) · Enterprise Integration Patterns · a group cannot have more consumers than partitions (*read*) · fetched 2026-10-14
- **Our delta:** choosing the count with reasoning, hot partitions from key skew.

### T09-07 · Change data capture with Debezium — Master · 🔲 not written
- **Read this:** [Logical decoding concepts](https://www.postgresql.org/docs/current/logicaldecoding-explanation.html) · PostgreSQL docs · "replication slots ... know nothing about the state of their consumer(s)", so WAL piles up and in extreme cases the database can shut down to avoid transaction ID wraparound (*read*) · covers our angle: **partial** — the slot disk risk exactly; no Debezium specifics · fetched 2026-10-14
- **Also good:** [Debezium PostgreSQL connector](https://debezium.io/documentation/reference/stable/connectors/postgresql.html) · Debezium docs · first-start consistent snapshot, `snapshot.mode` default `initial`, `pgoutput` plug-in on PostgreSQL 10+; its "WAL disk space consumption" section names the busy-database, few-captured-tables case and prescribes `heartbeat.interval.ms` with the heartbeat table added to the publication (*read*) · fetched 2026-10-14
- **Also good:** [Outbox event router](https://debezium.io/documentation/reference/stable/transformations/outbox-event-router.html) · Debezium docs · `aggregateid` becomes the Kafka key; the outbox is insert-only (*read*) · fetched 2026-10-14
- **Beyond the docs:** [Mastering Postgres replication slots](https://www.morling.dev/blog/mastering-postgres-replication-slots/) · Gunnar Morling, July 2025 · the stalled-slot incident from the former Debezium lead: a stopped consumer means unbounded WAL backlog, an idle database's slot never advances because WAL is per instance but slots are per database, `max_slot_wal_keep_size` (PostgreSQL 13+) invalidates the slot and forces a re-snapshot, `pg_logical_emit_message` (14+) as a table-less heartbeat, and deleting a connector does not drop its slot (*read*) · fetched 2026-10-14
- **Our delta:** the outbox implemented through CDC and the stalled-consumer slot incident.

### T09-08 · Kafka as a system-design component — Master · 🔲 not written
- **Read this:** [Event-driven architecture style](https://learn.microsoft.com/en-us/azure/architecture/guide/architecture-styles/event-driven) · Microsoft Learn · when a log (replay, per-partition order, durability) is justified over pub/sub (*read*) · covers our angle: **partial** · fetched 2026-10-14
- **Also good:** [Apache Kafka introduction](https://kafka.apache.org/43/getting-started/introduction/) · Apache Kafka 4.3 docs · events retained, same-key events in one partition (*read*) · fetched 2026-10-14
- **Beyond the docs:** [Turning the database inside-out](https://martin.kleppmann.com/2015/03/04/turning-the-database-inside-out.html) · Martin Kleppmann, 2015 · the strongest "why a log" argument: history kept, views rebuilt by replay (*read*) · fetched 2026-10-14
- **Our delta:** "why Kafka?" answered with replay, ordering and fan-out, not fashion.

### T09-09 · Retention, compaction and tiered storage — Understand · 🔲 not written
- **Read this:** [Kafka tiered storage](https://kafka.apache.org/43/operations/tiered-storage/) · Apache Kafka 4.3 docs · local tier plus remote tier; `local.retention.ms` and `retention.ms`; compacted topics are not supported (*read*) · covers our angle: **full** for tiered storage · fetched 2026-10-14
- **Also good:** [Kafka design](https://kafka.apache.org/43/design/_print/) · Apache Kafka 4.3 docs · `log.cleanup.policy=compact` keeps the latest value per key; null value is a tombstone removed after `delete.retention.ms` (*read*) · fetched 2026-10-14
- **Our delta:** time and size retention against changelog compaction.

### T09-10 · Kafka Connect — Understand · 🔲 not written
- **Read this:** [Kafka Connect overview](https://kafka.apache.org/43/kafka-connect/overview/) · Apache Kafka 4.3 docs · scalable streaming between Kafka and other systems; standalone or distributed mode; offsets managed for you (*read*) · covers our angle: **partial** — no source-versus-sink detail, no CDC-versus-polling argument · fetched 2026-10-14
- **Also good:** [Kafka Connect](https://docs.confluent.io/platform/current/connect/index.html) · Confluent docs · the vocabulary the Apache overview lacks: source connectors ingest databases and table updates, sink connectors deliver to secondary indexes such as Elasticsearch, plus workers, stateless tasks, converters, single-message transforms and the sink dead letter queue under `errors.tolerance` (*read*) · fetched 2026-10-14
- **Also good:** [Dead Letter Channel](https://www.enterpriseintegrationpatterns.com/patterns/messaging/DeadLetterChannel.html) · Enterprise Integration Patterns · Kafka Connect sink errors go to a DLQ with `errors.tolerance = all` (*read*) · fetched 2026-10-14
- **Beyond the docs:** [Data ingestion with Kafka Connect and change data capture](https://developer.confluent.io/courses/data-pipelines/kafka-data-ingestion-with-cdc/) · Confluent Developer, Tim Berglund · the CDC-versus-polling argument directly: a polling query cannot see deletes, misses intermediate changes between polls and trades staleness against load on the database, while log-based CDC sees every mutation (*read*) · fetched 2026-10-14
- **Our delta:** why a CDC source beats a polling one, and sinks into search and the warehouse.

### T09-11 · Stream processing — Understand · 🔲 not written
- **Read this:** [Kafka Streams core concepts](https://kafka.apache.org/43/streams/core-concepts/) · Apache Kafka 4.3 docs · windows per key with a grace period, event versus processing time, state stores, stream-table duality (*read*) · covers our angle: **partial** — no tumbling, hopping or session taxonomy, no batch-replacement framing · fetched 2026-10-14
- **Beyond the docs:** [The world beyond batch: Streaming 101](https://www.oreilly.com/radar/the-world-beyond-batch-streaming-101/) · Tyler Akidau, O'Reilly, 2015 · event time versus processing time; fixed, sliding and session windows; completeness as an optimisation (*read*) · fetched 2026-10-14
- **Our delta:** where a stream processor replaces a nightly batch.

### T09-12 · Event sourcing — Understand · 🔲 not written
- **Read this:** [Event Sourcing pattern](https://learn.microsoft.com/en-us/azure/architecture/patterns/event-sourcing) · Microsoft Learn · rehydration, snapshots, event versioning by upcasting, and the warning that most systems should stay with traditional data management (*read*) · covers our angle: **full** · fetched 2026-10-14
- **Also good:** [Event Sourcing](https://martinfowler.com/eaaDev/EventSourcing.html) · Martin Fowler · replay, snapshots, and gateways that suppress external effects during replay (*read*) · fetched 2026-10-14
- **Beyond the docs:** [Turning the database inside-out](https://martin.kleppmann.com/2015/03/04/turning-the-database-inside-out.html) · Martin Kleppmann, 2015 · the log as source of truth (*read*) · fetched 2026-10-14
- **Our delta:** where it pays versus where it is an expensive audit log.

### T09-13 · CQRS — Understand · 🔲 not written
- **Read this:** [CQRS](https://martinfowler.com/bliki/CQRS.html) · Martin Fowler · "for most systems CQRS adds risky complexity"; confine it to bounded contexts (*read*) · covers our angle: **partial** — little on eventual consistency · fetched 2026-10-14
- **Also good:** [CQRS pattern](https://learn.microsoft.com/en-us/azure/architecture/patterns/cqrs) · Microsoft Learn · separate stores sync by events; use an outbox and an idempotent read-model consumer (*read*) · fetched 2026-10-14
- **Also good:** [CQRS](https://microservices.io/patterns/data/cqrs.html) · microservices.io · a read-only view database kept current by subscribing to domain events; replication lag (*read*) · fetched 2026-10-14
- **Our delta:** the screen that must read its own write.

### T09-14 · Event-driven architecture — Understand · 🔲 not written
- **Read this:** [Event-driven architecture style](https://learn.microsoft.com/en-us/azure/architecture/guide/architecture-styles/event-driven) · Microsoft Learn · broker versus mediator topology; eventual consistency, ordering and observability challenges (*read*) · covers our angle: **partial** — no event storming or bounded-context step · fetched 2026-10-14
- **Also good:** [Choreography pattern](https://learn.microsoft.com/en-us/azure/architecture/patterns/choreography) · Microsoft Learn · lists emergent event storms and the observability cost (*read*) · fetched 2026-10-14
- **Also good:** [What do you mean by Event-Driven?](https://martinfowler.com/articles/201701-event-driven.html) · Martin Fowler · event notification lowers coupling yet makes the whole flow hard to see (*read*) · fetched 2026-10-14
- **Our delta:** the coupling that events hide instead of removing.

### T09-15 · Clients in this stack — Understand · 🔲 not written
- **Read this:** [KafkaJS consuming messages](https://kafka.js.org/docs/consuming) · KafkaJS docs · `autoCommit` on by default; handlers must not outlast the 30000 ms session timeout or a rebalance follows; `heartbeat()` for slow work; shutdown is not documented on this page; the last stable KafkaJS release on npm is 2.2.4 (February 2023) (*read*) · covers our angle: **partial** — Node side only · fetched 2026-10-14
- **Also good:** [Migrate to the Confluent JavaScript client](https://docs.confluent.io/kafka-clients/javascript/current/migration.html) · Confluent docs · the librdkafka-based Node client with a KafkaJS-compatible API, and where semantics differ: auto-commit is periodic (5 s default) not per message, heartbeats are automatic, `stop` is unsupported so you disconnect to stop, `rebalanceTimeout` also sets the max poll interval (*read*) · fetched 2026-10-14
- **Also good:** [Spring Kafka message listener containers](https://docs.spring.io/spring-kafka/reference/kafka/receiving-messages/message-listener-container.html) · Spring docs · `AckMode` defaults to `BATCH`, framework sets `enable.auto.commit` false unless you set it; stop behaviour not documented here (*read*) · fetched 2026-10-14
- **Also good:** [Spring Kafka listener container properties](https://docs.spring.io/spring-kafka/reference/kafka/container-props.html) · Spring docs · the shutdown dials: `shutdownTimeout` (10000 ms) bounds how long `stop()` blocks for consumers to finish, and `stopImmediate` (false) decides whether a stop finishes the rest of the last poll or only the current record (*read*) · fetched 2026-10-14
- **Our delta:** the deploy that lost messages on restart.

### T09-16 · Schema registry in practice — Understand · 🔲 not written
- **Read this:** [Schema evolution and compatibility](https://docs.confluent.io/platform/current/schema-registry/fundamentals/schema-evolution.html) · Confluent docs · backward: upgrade consumers first; forward: producers first; full: either order (*read*) · covers our angle: **full** for deploy order · fetched 2026-10-14
- **Also good:** [Schema Registry fundamentals](https://docs.confluent.io/platform/current/schema-registry/fundamentals/index.html) · Confluent docs · a subject is the scope for evolution; `TopicNameStrategy` gives `orders-value`; the schema id is embedded in each message (*read*) · fetched 2026-10-14
- **Our delta:** subject naming choices for the storefront.

### T09-17 · Operating Kafka — Understand · 🔲 not written
- **Read this:** [Basic Kafka operations](https://kafka.apache.org/43/operations/basic-kafka-operations/) · Apache Kafka 4.3 docs · `kafka-reassign-partitions.sh` generate, execute, verify; throttle and remove it afterwards; `controlled.shutdown.enable` for rolling restarts (*read*) · covers our angle: **partial** — no managed-versus-self-run comparison · fetched 2026-10-14
- **Also good:** [Kafka monitoring](https://kafka.apache.org/43/operations/monitoring/) · Apache Kafka 4.3 docs · replication-health metrics, idle ratios, request-latency breakdown (*read*) · fetched 2026-10-14
- **Our delta:** managed Kafka against running it yourself, and upgrade discipline.

### T09-18 · Multi-cluster and cross-region replication — Know · 🔲 not written
- **Read this:** [Geo-replication (MirrorMaker 2)](https://kafka.apache.org/43/operations/geo-replication-cross-cluster-data-mirroring/) · Apache Kafka 4.3 docs · replicates topics, configs, consumer-group offsets and ACLs; active/active versus active/passive flows; the page gives no failover procedure or offset-translation detail (*read*) · covers our angle: **partial** · fetched 2026-10-14
- **Also good:** [KIP-382: MirrorMaker 2.0](https://cwiki.apache.org/confluence/spaces/KAFKA/pages/95650722/KIP-382+MirrorMaker+2.0) · Apache Kafka wiki · the design the docs page omits: checkpoints emitted to a compacted `us-west.checkpoints.internal`-style topic, `RemoteClusterUtils.translateOffsets` for consumer migration and failover, only some offsets translatable, and source-prefixed topic names that make active/active cycle-free (*read*) · fetched 2026-10-14
- **Also good:** [Apache Kafka 101 architecture course](https://developer.confluent.io/courses/architecture/get-started/) · Confluent Developer · has a Geo-Replication module and a Cluster Linking exercise (*headings only*) · fetched 2026-10-14
- **Our delta:** active-active pitfalls, offset translation and disaster recovery for the log.
