---
title: "Link map · System design · Part 12 (phases 21–22)"
sidebar_label: "12 · HLD catalogue"
sidebar_position: 12
---

# Link map · System design · Part 12 (phases 21–22)

Covers every topic row of phases 21 and 22 in `docs/system-design/syllabus/12-the-hld-catalogue.md`: the classic systems (T21-01 to T21-35) and the India-scale product-company systems (T22-01 to T22-18). That is 53 rows. `docs/system-design/pages` holds phases 0 to 3 only, so every row is marked not written and its delta describes what the syllabus row promises.
*read* = I read the passage that supports the claim on the fetched page; *headings only* = fetched at HTTP 200 and the title or abstract checked, passage not read for the claim. Third-party links carry a date only where the page shows one. No `#anchors` are given. Where no good non-official explanation turned up, the block has no "Beyond the docs" line. Walk-throughs (Hello Interview, ByteByteGo) and company write-ups are the main reads for this part; several ByteByteGo and Hello Interview chapters sit behind a login or paywall and are left out. For the India-scale rows few companies publish internals, so some blocks lean on adjacent primary material and say so.

---

## Phase 21 — The classic systems

### T21-01 · URL shortener — Master · 🔲 not written
- **Read this:** [Design a URL Shortener Like Bitly](https://www.hellointerview.com/learn/system-design/problem-breakdowns/bitly) · Hello Interview · a unique counter encoded in base62 guarantees no collisions, Redis suits the counter, custom aliases need a separate namespace, and the cache TTL should match or be shorter than URL expiry (*read*) · covers our angle: **partial** — id generation and cache, not an analytics pipeline · fetched 2026-10-14
- **Also good:** [Design A URL Shortener](https://bytebytego.com/courses/system-design-interview/design-a-url-shortener) · ByteByteGo · hash plus collision resolution against base 62 conversion, 301 redirect to cut load against 302 to keep click analytics, and a Bloom filter to cut lookups (*read*) · covers our angle: **partial** · fetched 2026-10-14
- **Beyond the docs:** [Ticket Servers: Distributed Unique Primary Keys on the Cheap](https://code.flickr.net/2010/02/08/ticket-servers-distributed-unique-primary-keys-on-the-cheap/) · Flickr Engineering, 8 Feb 2010 · a centralised id source built on MySQL REPLACE INTO, an alternative to the counter for the id-generation deep dive (*read*) · fetched 2026-10-14
- **Our delta:** the deep dive named in the row, id generation and the cache in front of the store, with the 301 against 302 trade-off tied to analytics.

### T21-02 · Rate limiter as a service — Master · 🔲 not written
- **Read this:** [Scaling your API with rate limiters](https://stripe.com/blog/rate-limiters) · Stripe · rate limiters against load shedders, a concurrent-requests limiter, and a token bucket with a centralised bucket host implemented on Redis (*read*) · covers our angle: **partial** — one company's setup, not the cross-node accuracy trade-off · fetched 2026-10-14
- **Also good:** [Design a Distributed Rate Limiter](https://www.hellointerview.com/learn/system-design/problem-breakdowns/distributed-rate-limiter) · Hello Interview · picks token bucket, weighs gateway placement, and discusses fail open against fail closed when the limiter store is down (*read*) · covers our angle: **partial** · fetched 2026-10-14
- **Also good:** [Design A Rate Limiter](https://bytebytego.com/courses/system-design-interview/design-a-rate-limiter) · ByteByteGo · five algorithms compared, then the race condition and synchronisation issue across limiter servers, with Lua scripts or sorted sets as fixes (*read*) · fetched 2026-10-14
- **Beyond the docs:** [How we built rate limiting capable of scaling to millions of domains](https://blog.cloudflare.com/counting-things-a-lot-of-different-things/) · Cloudflare, 7 Jun 2017 · a sliding-window approximation from two counters when only GET, SET and INCR are available (*read*) · fetched 2026-10-14
- **Our delta:** accuracy against cost across nodes as the deep dive, plus the client contract (what the caller sees when limited).

### T21-03 · Key-value store, Dynamo-style — Master · 🔲 not written
- **Read this:** [Dynamo: Amazon's Highly Available Key-value Store](https://www.allthingsdistributed.com/files/amazon-dynamo-sosp2007.pdf) · DeCandia et al., SOSP 2007 · its technique table pairs sloppy quorum and hinted handoff for temporary failures, Merkle trees for permanent ones, and vector clocks for versioning (*read*) · covers our angle: **full** for partitioning, quorums, versioning and anti-entropy · fetched 2026-10-14
- **Also good:** [Design A Key-value Store](https://bytebytego.com/courses/system-design-interview/design-a-key-value-store) · ByteByteGo · sloppy quorum takes the first W or R healthy servers on the ring, anti-entropy uses Merkle trees, and the write path is drawn in a diagram (*read*) · covers our angle: **full** as an interview walk-through · fetched 2026-10-14
- **Beyond the docs:** [Amazon DynamoDB, a Fast and Scalable NoSQL Database Service](https://www.allthingsdistributed.com/2012/01/amazon-dynamodb.html) · Werner Vogels, 18 Jan 2012 · the follow-up announcement post that places the managed service next to the Dynamo paper (*headings only*) · fetched 2026-10-14
- **Our delta:** the write path during a partition, followed step by step: which replicas accept the write, what hints are stored, and how it heals.

### T21-04 · Distributed cache — Master · 🔲 not written
- **Read this:** [Scaling Memcache at Facebook](https://www.usenix.org/system/files/conference/nsdi13/nsdi13-final170_update.pdf) · Nishtala et al., NSDI 2013 · a Leases section that names stale sets and thundering herds as the two problems leases solve (*read*) · covers our angle: **partial** — the stampede fix, not consistent hashing or hot-key replication · fetched 2026-10-14
- **Also good:** [Key eviction](https://redis.io/docs/latest/develop/reference/eviction/) · Redis · the maxmemory directive and the policies allkeys-lru, allkeys-lfu, allkeys-random and the volatile variants (*read*) · covers our angle: **partial** — eviction only · fetched 2026-10-14
- **Beyond the docs:** [Redis Deep Dive for System Design Interviews](https://www.hellointerview.com/learn/system-design/deep-dives/redis) · Hello Interview · Redis as a building block for caches, counters and queues in interview designs (*headings only*) · fetched 2026-10-14
- **Our delta:** consistent hashing, eviction, hot keys and replication together, with the stampede on an expired key as the deep dive.

### T21-05 · Notification system — Master · 🔲 not written
- **Read this:** [Amazon SNS message delivery retries](https://docs.aws.amazon.com/sns/latest/dg/sns-message-delivery-retries.html) · AWS · a delivery retry policy, jitter on retries, and a dead-letter queue to catch messages once the policy is exhausted (*read*) · covers our angle: **partial** — retries and dead letters, not preferences or once-per-device · fetched 2026-10-14
- **Also good:** [Set the lifespan of a message](https://firebase.google.com/docs/cloud-messaging/customize-messages/setting-message-lifespan) · Firebase Cloud Messaging · messages are stored while a device is offline or in Doze, and a collapse key makes a newer message replace an older one waiting for delivery (*read*) · covers our angle: **partial** — the device leg only · fetched 2026-10-14
- **Beyond the docs:** [How Slack Put Kafka in Front of Its Redis Job Queue](https://www.hellointerview.com/learn/system-design/in-the-wild/slack-job-queue) · Hello Interview · a database slowdown filled Redis memory so the queue could neither accept nor hand out jobs, and Kafka was added in front as a buffer (*read*) · fetched 2026-10-14
- **Our delta:** fan-out, channels, preferences and rate limits, with once-per-device even when the worker crashes as the deep dive.

### T21-06 · News feed — Master · 🔲 not written
- **Read this:** [Design Facebook's News Feed](https://www.hellointerview.com/learn/system-design/problem-breakdowns/fb-news-feed) · Hello Interview · async feed workers writing precomputed feeds, and a hybrid that chooses which accounts to precompute and which not, with a celebrity example (*read*) · covers our angle: **full** for the hybrid fan-out · fetched 2026-10-14
- **Also good:** [Design A News Feed System](https://bytebytego.com/courses/system-design-interview/design-a-news-feed-system) · ByteByteGo · fanout on write against fanout on read, their pros and cons, and the hybrid adopted (*read*) · covers our angle: **partial** — ranking and pagination are thin · fetched 2026-10-14
- **Beyond the docs:** [Timelines at Scale](https://www.infoq.com/presentations/Twitter-Timeline-Scalability/) · Raffi Krikorian, Twitter, QCon SF talk on InfoQ · the architecture Twitter used for thousands of events per second (tweets, graph changes, direct messages) (*read*, summary only) · fetched 2026-10-14
- **Our delta:** the celebrity problem, ranking and cursor pagination, with the hybrid fan-out as the deep dive.

### T21-07 · Chat, messenger-style — Master · 🔲 not written
- **Read this:** [Design a Messaging App Like WhatsApp](https://www.hellointerview.com/learn/system-design/problem-breakdowns/whatsapp) · Hello Interview · a per-chat monotonically increasing sequence number from Redis INCR with gap detection on the client, and an inbox per user for offline delivery (*read*) · covers our angle: **full** for ordering within one conversation · fetched 2026-10-14
- **Also good:** [Design A Chat System](https://bytebytego.com/courses/system-design-interview/design-a-chat-system) · ByteByteGo · message_id must be unique and time-sortable, and the group-chat key is (channel_id, message_id) with the channel as partition key (*read*) · covers our angle: **full** · fetched 2026-10-14
- **Beyond the docs:** [How Discord Stores Trillions of Messages](https://discord.com/blog/how-discord-stores-trillions-of-messages) · Discord, 6 Mar 2023 · a hot channel and bucket pair hurt latency across the whole Cassandra cluster, the reason for the move off it (*read*) · fetched 2026-10-14
- **Our delta:** connection servers, receipts and groups, with ordering inside one conversation as the deep dive.

### T21-08 · Typeahead and autocomplete — Master · 🔲 not written
- **Read this:** [Design YouTube's Top K Videos Feature](https://www.hellointerview.com/learn/system-design/problem-breakdowns/top-k) · Hello Interview · top-k kept as state inside a Flink job and written to a cache at the end of every minute, replacing a Postgres table and a cron (*read*) · covers our angle: **partial** — the top-k aggregation, not the prefix structure · fetched 2026-10-14
- **Also good:** [Data Structures for Big Data in System Design Interviews](https://www.hellointerview.com/learn/system-design/deep-dives/data-structures-for-big-data) · Hello Interview · the probabilistic structures behind counting and top-k (*headings only*) · fetched 2026-10-14
- **Our delta:** prefix structures with top-k per prefix, the offline build and personalisation, and refreshing suggestions without downtime as the deep dive. No company write-up on the prefix serving path was found, so the row stands on the syllabus.

### T21-09 · Video platform — Master · 🔲 not written
- **Read this:** [Design YouTube](https://bytebytego.com/courses/system-design-interview/design-youtube) · ByteByteGo · a directed acyclic graph model for transcoding, because creators need different processing such as watermarks and thumbnails, plus streaming protocols DASH and HLS (*read*) · covers our angle: **full** for the transcoding graph · fetched 2026-10-14
- **Also good:** [Design a Video Streaming Platform Like YouTube](https://www.hellointerview.com/learn/system-design/problem-breakdowns/youtube) · Hello Interview · segments in several formats plus a manifest file for adaptive bitrate, and resumable uploads (*read*) · covers our angle: **full** · fetched 2026-10-14
- **Beyond the docs:** [SVE: Distributed Video Processing at Facebook Scale](https://research.facebook.com/publications/sve-distributed-video-processing-at-facebook-scale/) · Huang et al., SOSP 2017 · the move from a monolithic encoding script to the Streaming Video Engine for low latency and robustness to faults and overload (*read*, abstract) · fetched 2026-10-14
- **Our delta:** upload, CDN delivery and metadata around the transcoding graph named as the deep dive.

### T21-10 · Proximity service — Master · 🔲 not written
- **Read this:** [Proximity Search in System Design Interviews](https://www.hellointerview.com/learn/system-design/deep-dives/proximity-search) · Hello Interview · quadtrees, geohash, S2 and H3, and the candidate set that includes neighbouring cells so nobody just across a boundary is missed (*read*) · covers our angle: **full** for the cell-boundary problem · fetched 2026-10-14
- **Also good:** [H3 at Uber](https://www.uber.com/blog/h3/) · Uber Engineering · hexagons have one neighbour distance, which simplifies analysis, and children sit only approximately inside a parent (*read*) · covers our angle: **partial** · fetched 2026-10-14
- **Beyond the docs:** [S2 Geometry](https://s2geometry.io/) · Google · regions approximated as collections of discrete S2 cells, which makes distributed spatial indexes easy to build (*read*) · fetched 2026-10-14
- **Our delta:** the write path for moving objects, not just static places, with the cell-boundary problem as the deep dive.

### T21-11 · Ride hailing — Master · 🔲 not written
- **Read this:** [Design a Ride-Sharing Service Like Uber](https://www.hellointerview.com/learn/system-design/problem-breakdowns/uber) · Hello Interview · fare estimate then ride request, a geospatial index for nearby drivers, batched location writes, and surges in demand that outrun horizontal scaling of the matching service (*read*) · covers our angle: **partial** — trip state machine and ETA are lighter · fetched 2026-10-14
- **Also good:** [How Uber Scales Their Real-time Market Platform](https://highscalability.com/how-uber-scales-their-real-time-market-platform/) · High Scalability · DISCO plans into the future instead of matching only currently available supply, with geo indexes by supply and by demand (*read*) · covers our angle: **partial** — a 2015-era design · fetched 2026-10-14
- **Beyond the docs:** [Uber Unveils its Realtime Market Platform](https://www.infoq.com/news/2015/03/uber-realtime-market-platform/) · InfoQ · dispatch rewritten as supply and demand services plus DISCO, data sharded by city, built on ringpop (*read*) · fetched 2026-10-14
- **Our delta:** location ingestion, matching, ETA, surge and the trip state machine, with matching under load as the deep dive.

### T21-12 · Ticket booking — Master · 🔲 not written
- **Read this:** [Design a Ticket Booking Site Like Ticketmaster](https://www.hellointerview.com/learn/system-design/problem-breakdowns/ticketmaster) · Hello Interview · a distributed lock with a TTL so a reservation expires on its own, PostgreSQL for the booking record, and a virtual queue over SSE or WebSocket backed by a Redis sorted set (*read*) · covers our angle: **full** for the seat lock and the queue at the gate · fetched 2026-10-14
- **Also good:** [Cloudflare Waiting Room](https://developers.cloudflare.com/waiting-room/) · Cloudflare · a managed queue in front of a site, with scheduled events, and users keep their place in line if they leave (*read*) · covers our angle: **partial** — the gate, not the seat inventory · fetched 2026-10-14
- **Beyond the docs:** [How Shopify Moved Inventory Reservations from Redis to MySQL](https://www.hellointerview.com/learn/system-design/in-the-wild/shopify-inventory-reservations) · Hello Interview · why a reservation counter in Redis and the permanent record in MySQL could not commit together (*read*) · fetched 2026-10-14
- **Our delta:** seat inventory, holds, payment and the burst when sales open.

### T21-13 · E-commerce platform — Master · 🔲 not written
- **Read this:** [How Shopify Moved Inventory Reservations from Redis to MySQL](https://www.hellointerview.com/learn/system-design/in-the-wild/shopify-inventory-reservations) · Hello Interview · two-phase commit or an outbox does not close the window between two databases, and wrong inventory for a short time in a flash sale can mean selling a unit twice (*read*) · covers our angle: **partial** — inventory correctness only · fetched 2026-10-14
- **Also good:** [Surviving Flashes of High-Write Traffic Using Scriptable Load Balancers (Part I)](https://shopify.engineering/surviving-flashes-of-high-write-traffic-using-scriptable-load-balancers-part-i) · Shopify Engineering · the edge tier is Nginx with OpenResty Lua scripts, and the post starts from a 2007 flash sale (*read*) · covers our angle: **partial** · fetched 2026-10-14
- **Beyond the docs:** [Design a Local Delivery Service like Gopuff](https://www.hellointerview.com/learn/system-design/problem-breakdowns/gopuff) · Hello Interview · availability aggregated across nearby distribution centres and orders placed without double booking (*read*) · fetched 2026-10-14
- **Our delta:** catalogue, cart, checkout, orders and search at a hundred times the storefront size, with inventory correctness during a sale as the deep dive.

### T21-14 · Payment system — Master · 🔲 not written
- **Read this:** [Idempotent requests](https://docs.stripe.com/api/idempotent_requests) · Stripe · an idempotency key lets you repeat a create or update safely instead of performing the operation twice (*read*) · covers our angle: **partial** — the contract, not the ledger or reconciliation · fetched 2026-10-14
- **Also good:** [How to Scale a Ledger, Part I](https://www.moderntreasury.com/journal/how-to-scale-a-ledger-part-i) · Modern Treasury · companies that move money need a scalable double-entry ledger (*read*) · covers our angle: **partial** · fetched 2026-10-14
- **Also good:** [Debit/Credit: The Schema for OLTP](https://docs.tigerbeetle.com/concepts/debit-credit/) · TigerBeetle · every transfer moves value between accounts, so money never appears from nowhere or disappears (*read*) · fetched 2026-10-14
- **Beyond the docs:** [Implementing Stripe-like Idempotency Keys in Postgres](https://brandur.org/idempotency-keys) · Brandur Leach · atomic phases and recovery points around an idempotency key, with a state machine (*read*, contents) · fetched 2026-10-14
- **Our delta:** double-entry, provider webhooks and nightly reconciliation, with the money that must balance as the deep dive.

### T21-15 · Distributed message queue — Master · 🔲 not written
- **Read this:** [Apache Kafka design](https://kafka.apache.org/43/design/design/) · Apache Kafka 4.3 · topics split into totally ordered partitions, each consumed by one consumer per group, so consumer position is a single offset (*read*) · covers our angle: **full** for partitions and consumer groups; replication is in the contents · fetched 2026-10-14
- **Also good:** [Kafka Deep Dive for System Design Interviews](https://www.hellointerview.com/learn/system-design/deep-dives/kafka) · Hello Interview · Kafka framed for interviews (*headings only*) · fetched 2026-10-14
- **Beyond the docs:** [Kafka: a Distributed Messaging System for Log Processing](https://notes.stephenholiday.com/Kafka.pdf) · Kreps, Narkhede and Rao, LinkedIn · the original paper (*headings only*) · fetched 2026-10-14
- **Our delta:** rebuilding Kafka from its parts, one decision at a time.

### T21-16 · Unique id generator — Understand · 🔲 not written
- **Read this:** [Snowflake ID](https://en.wikipedia.org/wiki/Snowflake_ID) · Wikipedia · 64 bits with the top bit zero, then 41 bits of timestamp, then machine and sequence bits (*read*) · covers our angle: **partial** — layout, not clock skew · fetched 2026-10-14
- **Also good:** [RFC 9562, Universally Unique IDentifiers](https://www.rfc-editor.org/rfc/rfc9562.html) · IETF · defines UUID version 7 and has best-practice sections on timestamps, monotonicity and distributed generation (*headings only*) · fetched 2026-10-14
- **Beyond the docs:** [Ticket Servers](https://code.flickr.net/2010/02/08/ticket-servers-distributed-unique-primary-keys-on-the-cheap/) · Flickr Engineering, 8 Feb 2010 · a centralised alternative to time-ordered ids (*read*) · fetched 2026-10-14
- **Our delta:** time-ordered ids and the clock that went backwards as the deep dive.

### T21-17 · Web crawler — Understand · 🔲 not written
- **Read this:** [High-Performance Web Crawling](https://www.cs.cornell.edu/courses/cs685/2002fa/mercator.pdf) · Najork and Heydon, Compaq SRC Report 173, 2001 · a crawler must download at a very high rate without overwhelming any server and keep data structures too large for memory (*read*) · covers our angle: **partial** — an older design · fetched 2026-10-14
- **Also good:** [RFC 9309, Robots Exclusion Protocol](https://www.rfc-editor.org/rfc/rfc9309.html) · IETF · the standard, with definition language, error handling and caching instructions (*read*, abstract) · fetched 2026-10-14
- **Also good:** [Design A Web Crawler](https://bytebytego.com/courses/system-design-interview/design-a-web-crawler) · ByteByteGo · the frontier ensures politeness, URL prioritisation and freshness, and robots.txt results are cached (*read*) · fetched 2026-10-14
- **Beyond the docs:** [Design a Web Crawler](https://www.hellointerview.com/learn/system-design/problem-breakdowns/web-crawler) · Hello Interview · fault tolerance, resuming without losing progress, and politeness listed as requirements (*read*) · fetched 2026-10-14
- **Our delta:** the frontier and freshness as the deep dive.

### T21-18 · File sync, cloud-drive-style — Understand · 🔲 not written
- **Read this:** [Rewriting the heart of our sync engine](https://dropbox.tech/infrastructure/rewriting-the-heart-of-our-sync-engine) · Dropbox, Sujay Jayakar, 9 Mar 2020 · the Nucleus rewrite, with a strong data model and tight invariants because they make a system testable (*read*) · covers our angle: **partial** — client sync, not chunk dedup · fetched 2026-10-14
- **Also good:** [Design a File Storage Service Like Dropbox](https://www.hellointerview.com/learn/system-design/problem-breakdowns/dropbox) · Hello Interview · resumable uploads, signed URLs that bypass application servers, and chunking (*read*) · covers our angle: **partial** · fetched 2026-10-14
- **Our delta:** chunking, dedup, delta sync, the metadata service and conflicts, with the sync protocol as the deep dive.

### T21-19 · Social graph and timeline — Understand · 🔲 not written
- **Read this:** [TAO: Facebook's Distributed Data Store for the Social Graph](https://www.usenix.org/system/files/conference/atc13/atc13-bronson.pdf) · Bronson et al., USENIX ATC 2013 · a simple data model and API for the social graph served from a geographically distributed store with a fixed set of queries (*read*, abstract) · covers our angle: **partial** — the read path, not counters · fetched 2026-10-14
- **Also good:** [Distributed counters](https://firebase.google.com/docs/firestore/solutions/counters) · Firebase · a counter as shards summed on read (*headings only*) · fetched 2026-10-14
- **Our delta:** followers, posts, the read path and counts at scale as the deep dive.

### T21-20 · Hotel reservation — Understand · 🔲 not written
- **Read this:** [Hotel Reservation System](https://bytebytego.com/courses/system-design-interview/hotel-reservation-system) · ByteByteGo · reservationID as idempotency key against double booking, and pessimistic and optimistic locking compared (*read*) · covers our angle: **full** for concurrency · fetched 2026-10-14
- **Also good:** [Range Types](https://www.postgresql.org/docs/current/rangetypes.html) · PostgreSQL · ranges of timestamp can represent the time a room is reserved, with a section on constraints on ranges (*read*) · covers our angle: **partial** · fetched 2026-10-14
- **Our delta:** inventory by date, overbooking policy and pricing, with concurrency on date ranges as the deep dive.

### T21-21 · Digital wallet — Understand · 🔲 not written
- **Read this:** [Debit/Credit: The Schema for OLTP](https://docs.tigerbeetle.com/concepts/debit-credit/) · TigerBeetle · double-entry as the schema, so every movement of value is accounted for (*read*) · covers our angle: **partial** — single-ledger, not across shards · fetched 2026-10-14
- **Also good:** [How to Scale a Ledger, Part I](https://www.moderntreasury.com/journal/how-to-scale-a-ledger-part-i) · Modern Treasury · a scalable double-entry ledger (*read*) · fetched 2026-10-14
- **Our delta:** balances and transfers, with the transfer across two shards as the deep dive.

### T21-22 · Stock exchange — Understand · 🔲 not written
- **Read this:** [The LMAX Architecture](https://martinfowler.com/articles/lmax.html) · Martin Fowler · a trading platform centred on a Business Logic Processor, with input and output disruptors and everything kept in memory (*read*) · covers our angle: **full** for deterministic sequencing · fetched 2026-10-14
- **Also good:** [LMAX Disruptor](https://lmax-exchange.github.io/disruptor/disruptor.html) · LMAX · the cost of locks and queues, and the sequencing design (*read*, contents) · fetched 2026-10-14
- **Our delta:** order book, matching engine and market-data fan-out.

### T21-23 · Ad click aggregation — Understand · 🔲 not written
- **Read this:** [Design an Ad Click Aggregator](https://www.hellointerview.com/learn/system-design/problem-breakdowns/ad-click-aggregator) · Hello Interview · requirements include no lost clicks, near-real-time queries and idempotent click tracking (*read*) · covers our angle: **partial** — requirements, not the window design · fetched 2026-10-14
- **Also good:** [Timely Stream Processing](https://nightlies.apache.org/flink/flink-docs-stable/docs/concepts/time/) · Apache Flink · event time and watermarks (*headings only*) · fetched 2026-10-14
- **Beyond the docs:** [Exactly-once Semantics is Possible](https://www.confluent.io/blog/exactly-once-semantics-are-possible-heres-how-apache-kafka-does-it/) · Confluent · how Kafka does exactly-once (*headings only*) · fetched 2026-10-14
- **Our delta:** exactly-once counting, windows and late data, with the stream-processing pipeline as the deep dive.

### T21-24 · Metrics and monitoring system — Understand · 🔲 not written
- **Read this:** [Gorilla: A Fast, Scalable, In-Memory Time Series Database](https://www.vldb.org/pvldb/vol8/p1816-teller.pdf) · Pelkonen et al., Facebook, VLDB 2015 · monitoring tens of millions of measurements per second, using delta-of-delta timestamps and XOR floating-point compression (*read*) · covers our angle: **partial** — storage, not alerting · fetched 2026-10-14
- **Also good:** [Metric and label naming](https://prometheus.io/docs/practices/naming/) · Prometheus · do not use labels for high-cardinality values such as user IDs or email addresses (*read*) · covers our angle: **full** for cardinality · fetched 2026-10-14
- **Beyond the docs:** [Rollup: Managing 300 Billion Daily Metrics at PhonePe](https://tech.phonepe.com/rollup-managing-300-billion-daily-metrics-at-phonepe/) · PhonePe Tech Blog · rollup as aggregating time series over intervals, so a year of per-minute data becomes lower-resolution (*read*) · fetched 2026-10-14
- **Our delta:** ingestion, downsampling and alerting, with cardinality as the deep dive.

### T21-25 · Distributed job scheduler — Understand · 🔲 not written
- **Read this:** [Distributed Periodic Scheduling with Cron](https://sre.google/sre-book/distributed-periodic-scheduling/) · Google SRE Book · a distributed cron on Paxos replicas, with a section on idempotency of jobs (*read*) · covers our angle: **partial** — one policy · fetched 2026-10-14
- **Also good:** [CronJob](https://kubernetes.io/docs/concepts/workloads/controllers/cron-jobs/) · Kubernetes · startingDeadlineSeconds bounds a delayed job start (*read*) · covers our angle: **partial** — the missed-run policy · fetched 2026-10-14
- **Beyond the docs:** [Clockwork: The Backbone of PhonePe's 2 Billion Daily Jobs](https://tech.phonepe.com/clockwork-the-backbone-of-phonepes-2-billion-daily-jobs/) · PhonePe Tech Blog, Snehasish Roy, 14 Feb 2024 · jobs persisted in HBase with random partition ids, a leader per client assigning partitions through Zookeeper (*read*) · fetched 2026-10-14
- **Our delta:** job store, leader election, workers and exactly-once execution, with the missed-run policy as the deep dive.

### T21-26 · Collaborative editing — Understand · 🔲 not written
- **Read this:** [How Figma's multiplayer technology works](https://www.figma.com/blog/how-figmas-multiplayer-technology-works/) · Figma Blog · a company write-up on multiplayer editing (*headings only*) · covers our angle: **partial** · fetched 2026-10-14
- **Also good:** [How Figma Built Multiplayer Editing on Simplified CRDTs](https://www.hellointerview.com/learn/system-design/in-the-wild/figma-multiplayer) · Hello Interview · a central server ordering optimistic edits with last-writer-wins per property, so every copy converges (*read*) · covers our angle: **full** for convergence · fetched 2026-10-14
- **Also good:** [Operational transformation](https://en.wikipedia.org/wiki/Operational_transformation) · Wikipedia · the OT side of the comparison (*headings only*) · fetched 2026-10-14
- **Beyond the docs:** [CRDT.tech](https://crdt.tech/) · crdt.tech · an introduction to CRDTs, papers and implementations (*headings only*) · fetched 2026-10-14
- **Our delta:** OT against CRDTs, presence and history, with convergence as the deep dive.

### T21-27 · Object storage, S3-like — Understand · 🔲 not written
- **Read this:** [f4: Facebook's Warm BLOB Storage System](https://www.usenix.org/system/files/conference/osdi14/osdi14-paper-muralidhar.pdf) · Muralidhar et al., OSDI 2014 · hot and warm BLOBs, with Reed-Solomon coding to lower the effective replication factor while tolerating disk, host, rack and datacentre failures (*read*) · covers our angle: **partial** · fetched 2026-10-14
- **Also good:** [Amazon S3 FAQs](https://aws.amazon.com/s3/faqs/) · AWS · the durability figure stated as 11 9s (*read*) · covers our angle: **partial** — a claim, not the arithmetic · fetched 2026-10-14
- **Beyond the docs:** [Backblaze Open Sources Reed-Solomon Code](https://www.backblaze.com/blog/reed-solomon/) · Backblaze · a file split into 17 pieces plus 3 parity pieces, rebuildable from any 17 of 20 (*read*) · fetched 2026-10-14
- **Our delta:** metadata separate from data, erasure coding and consistency, with the durability arithmetic as the deep dive.

### T21-28 · Leaderboard — Understand · 🔲 not written
- **Read this:** [Real-time Gaming Leaderboard](https://bytebytego.com/courses/system-design-interview/real-time-gaming-leaderboard) · ByteByteGo · Redis sorted sets as the fit for leaderboards, each member carrying a score (*read*) · covers our angle: **partial** — single node · fetched 2026-10-14
- **Also good:** [Redis sorted sets](https://redis.io/docs/latest/develop/data-types/sorted-sets/) · Redis · ZADD and ZRANK commands with O(log N) complexity (*read*) · fetched 2026-10-14
- **Our delta:** sharding by score bucket, top-k and rank queries, with rank at scale as the deep dive.

### T21-29 · Distributed lock and coordination service — Understand · 🔲 not written
- **Read this:** [The Chubby lock service for loosely-coupled distributed systems](https://static.googleusercontent.com/media/research.google.com/en//archive/chubby-osdi06.pdf) · Burrows, Google · coarse-grained locking, used to elect a master, as in GFS and Bigtable (*read*, abstract) · covers our angle: **partial** · fetched 2026-10-14
- **Also good:** [How to do distributed locking](https://martin.kleppmann.com/2016/02/08/how-to-do-distributed-locking.html) · Martin Kleppmann, 8 Feb 2016 · a fencing token increases each time a client acquires the lock and is sent with every write (*read*) · covers our angle: **full** for the expired lease · fetched 2026-10-14
- **Also good:** [Distributed Locks with Redis](https://redis.io/docs/latest/develop/clients/patterns/distributed-locks/) · Redis · modelled on safety (mutual exclusion) and liveness guarantees (*read*) · fetched 2026-10-14
- **Our delta:** leases, fencing and consensus underneath, with the lease that expired mid-operation as the deep dive.

### T21-30 · Logging pipeline — Understand · 🔲 not written
- **Read this:** [How Netflix optimized its petabyte-scale logging system with ClickHouse](https://clickhouse.com/blog/netflix-petabyte-scale-logging) · ClickHouse · 5 petabytes a day in the largest namespace, 10.6 million events per second on average and 12.5 million at peak (*read*) · covers our angle: **partial** · fetched 2026-10-14
- **Also good:** [How Slack Put Kafka in Front of Its Redis Job Queue](https://www.hellointerview.com/learn/system-design/in-the-wild/slack-job-queue) · Hello Interview · a buffer in front of a store that filled its memory, a case of backpressure (*read*) · fetched 2026-10-14
- **Our delta:** agents, buffering, storage tiers and search, with backpressure when the store is slow as the deep dive.

### T21-31 · Maps and ETA — Know · 🔲 not written
- **Read this:** [Traffic prediction with advanced Graph Neural Networks](https://deepmind.google/blog/traffic-prediction-with-advanced-graph-neural-networks/) · Google DeepMind, 3 Sep 2020 · Google Maps combines live traffic on road segments with machine learning to predict ETAs (*read*) · covers our angle: **partial** — traffic, not routing · fetched 2026-10-14
- **Also good:** [Contraction hierarchies](https://en.wikipedia.org/wiki/Contraction_hierarchies) · Wikipedia · a preprocessed speed-up for shortest paths on road graphs (*headings only*) · fetched 2026-10-14
- **Our delta:** the road graph and shortest paths at scale, with what is precomputed and when as the deep dive.

### T21-32 · Email service — Know · 🔲 not written
- **Read this:** [Email sender guidelines](https://support.google.com/mail/answer/81126) · Gmail Help · keep spam rates in Postmaster Tools below 0.3 percent, and set up SPF (*read*) · covers our angle: **partial** — deliverability only · fetched 2026-10-14
- **Also good:** [RFC 5321, Simple Mail Transfer Protocol](https://www.rfc-editor.org/rfc/rfc5321.html) · IETF · a section on retry strategies, after a transient failure the client may requeue (*headings only*) · fetched 2026-10-14
- **Our delta:** the sending pipeline, inbox storage and search, with the outbound queue and its retries as the deep dive.

### T21-33 · Code deployment system — Know · 🔲 not written
- **Read this:** [Introducing Kraken](https://www.uber.com/blog/introducing-kraken/) · Uber Engineering · a plain sharded registry could not keep up, so a peer-to-peer system supports at least 8,000 hosts per cluster (*read*) · covers our angle: **partial** — image distribution, not rollouts · fetched 2026-10-14
- **Also good:** [Performing a Rolling Update](https://kubernetes.io/docs/tutorials/kubernetes-basics/update/update-intro/) · Kubernetes · the rollout mechanism (*headings only*) · fetched 2026-10-14
- **Our delta:** artifacts, rollouts and rollback, with the distribution tree as the deep dive.

### T21-34 · Search engine basics — Know · 🔲 not written
- **Read this:** [The Anatomy of a Large-Scale Hypertextual Web Search Engine](http://infolab.stanford.edu/~backrub/google.html) · Brin and Page · the indexer builds a forward index in barrels and an anchors file of link text (*read*) · covers our angle: **partial** · fetched 2026-10-14
- **Also good:** [A first take at building an inverted index](https://nlp.stanford.edu/IR-book/html/htmledition/a-first-take-at-building-an-inverted-index-1.html) · Stanford, Introduction to Information Retrieval · the steps to build the index in advance (*read*) · fetched 2026-10-14
- **Beyond the docs:** [Elasticsearch Deep Dive for System Design Interviews](https://www.hellointerview.com/learn/system-design/deep-dives/elasticsearch) · Hello Interview · Elasticsearch framed for interviews (*headings only*) · fetched 2026-10-14
- **Our delta:** crawling, indexing, ranking and serving, with index sharding as the deep dive.

### T21-35 · Recommendation basics — Know · 🔲 not written
- **Read this:** [Deep Neural Networks for YouTube Recommendations](https://static.googleusercontent.com/media/research.google.com/en//pubs/archive/45530.pdf) · Covington, Adams and Sargin, Google · a two-stage split into candidate generation and ranking (*read*, abstract) · covers our angle: **partial** · fetched 2026-10-14
- **Beyond the docs:** [System Design for Recommendations and Search](https://eugeneyan.com/writing/system-design-for-discovery/) · Eugene Yan, June 2021 · components split into offline and online environments and into retrieval and ranking, offline hosting batch work such as model training (*read*) · fetched 2026-10-14
- **Our delta:** feature stores and feedback loops, with the online and offline split as the deep dive.

---

## Phase 22 — Product-company systems, India-scale

### T22-01 · A UPI-style payment switch — Master · 🔲 not written
- **Read this:** [Demystifying TStore: The Backbone of Billions of Transactions at PhonePe](https://tech.phonepe.com/demystifying-tstore-the-backbone-of-billions-of-transactions-at-phonepe/) · PhonePe Tech Blog, 6 Aug 2024 · the app tracks a payment as PENDING (non-terminal) then COMPLETED or ERRORED (terminal) (*read*) · covers our angle: **partial** — the status model, not the bank leg · fetched 2026-10-14
- **Also good:** [Idempotent requests](https://docs.stripe.com/api/idempotent_requests) · Stripe · idempotency key to repeat safely (*read*) · fetched 2026-10-14
- **Beyond the docs:** [Implementing Stripe-like Idempotency Keys in Postgres](https://brandur.org/idempotency-keys) · Brandur Leach · recovery points around an external call (*read*, contents) · fetched 2026-10-14
- **Our delta:** idempotency across banks, bank-leg timeouts, reconciliation and reversals, with the transaction that neither succeeded nor failed as the deep dive. The NPCI circulars were not reachable, so no regulator source is cited.

### T22-02 · Sale-day checkout — Master · 🔲 not written
- **Read this:** [How Shopify Moved Inventory Reservations from Redis to MySQL](https://www.hellointerview.com/learn/system-design/in-the-wild/shopify-inventory-reservations) · Hello Interview · reservation counter and permanent inventory in different databases cannot commit together (*read*) · covers our angle: **partial** · fetched 2026-10-14
- **Also good:** [Using load shedding to avoid overload](https://builder.aws.com/content/3Eun1EEyX6p2e3VYNyRLSJzLuMV/using-load-shedding-to-avoid-overload) · AWS Builder Center, Jun 2026 · rejecting excess work early so the system keeps serving what it can (*read*, introduction) · covers our angle: **partial** — the degraded mode · fetched 2026-10-14
- **Also good:** [Cloudflare Waiting Room](https://developers.cloudflare.com/waiting-room/) · Cloudflare · a queue at the gate (*read*) · fetched 2026-10-14
- **Our delta:** pre-scaling, the gate queue, inventory decrement and the degradation ladder, with fairness against throughput as the deep dive.

### T22-03 · A tatkal-style ticket burst — Master · 🔲 not written
- **Read this:** [IRCTC Tackles Tatkal Ticketing Issues With Anti-Bot System and CDN](https://www.medianama.com/2025/06/223-indian-railways-tackles-tatkal-booking-problems-with-anti-bot-system/) · MediaNama, Jun 2025 · bot traffic is 50 percent of login attempts in the first five minutes of Tatkal (*read*) · covers our angle: **partial** — news-level, no architecture · fetched 2026-10-14
- **Also good:** [Design a Ticket Booking Site Like Ticketmaster](https://www.hellointerview.com/learn/system-design/problem-breakdowns/ticketmaster) · Hello Interview · the virtual queue (*read*) · fetched 2026-10-14
- **Our delta:** queue tokens and bot defence, with the first sixty seconds as the deep dive.

### T22-04 · Ten-minute delivery from dark stores — Master · 🔲 not written
- **Read this:** [Design a Local Delivery Service like Gopuff](https://www.hellointerview.com/learn/system-design/problem-breakdowns/gopuff) · Hello Interview · availability is the union of inventory in nearby distribution centres, and orders must not double book (*read*) · covers our angle: **full** for local inventory · fetched 2026-10-14
- **Our delta:** serviceability by location, rider dispatch and ETA, with inventory local to a store as the deep dive.

### T22-05 · Food delivery: order and rider dispatch — Master · 🔲 not written
- **Read this:** [Swiggy Cuts Order-Dispatch AI Latency by 2x](https://akka.io/customer-stories/swiggy) · Akka customer story · order assignment scores every order-and-executive pairing across a city inside a one-minute SLA (*read*) · covers our angle: **partial** — a vendor story · fetched 2026-10-14
- **Also good:** [How Uber Scales Their Real-time Market Platform](https://highscalability.com/how-uber-scales-their-real-time-market-platform/) · High Scalability · DISCO plans into the future (*read*) · fetched 2026-10-14
- **Our delta:** restaurant acceptance, tracking and ETA, with assignment under uncertainty as the deep dive.

### T22-06 · OTP and SMS gateway — Master · 🔲 not written
- **Read this:** [Track the Message Status of Outbound Messages](https://www.twilio.com/docs/messaging/guides/track-outbound-message-status) · Twilio · status callbacks carry an error code when a message is failed or undelivered (*read*) · covers our angle: **partial** — delivery reports · fetched 2026-10-14
- **Also good:** [Amazon SNS message delivery retries](https://docs.aws.amazon.com/sns/latest/dg/sns-message-delivery-retries.html) · AWS · retry policy, jitter and dead letters (*read*) · fetched 2026-10-14
- **Our delta:** carrier failover, rate limits and retries, with the carrier that silently drops messages as the deep dive.

### T22-07 · Movie-ticket seat locking at city scale — Master · 🔲 not written
- **Read this:** [Design a Ticket Booking Site Like Ticketmaster](https://www.hellointerview.com/learn/system-design/problem-breakdowns/ticketmaster) · Hello Interview · a Redis lock with TTL for temporary holds (*read*) · covers our angle: **partial** · fetched 2026-10-14
- **Also good:** [Explicit Locking](https://www.postgresql.org/docs/current/explicit-locking.html) · PostgreSQL · advisory locks for application-controlled locking (*read*) · fetched 2026-10-14
- **Our delta:** shows, seats, holds and payment, with the one show everyone wants as the deep dive.

### T22-08 · The monolith-to-services migration — Master · 🔲 not written
- **Read this:** [Strangler Fig](https://martinfowler.com/bliki/StranglerFigApplication.html) · Martin Fowler · the gradual replacement metaphor (*read*) · covers our angle: **partial** · fetched 2026-10-14
- **Also good:** [Strangler Fig Pattern](https://learn.microsoft.com/en-us/azure/architecture/patterns/strangler-fig) · Azure Architecture Center · a facade routes requests to legacy or new services (*read*) · fetched 2026-10-14
- **Also good:** [Pattern: Database per service](https://microservices.io/patterns/data/database-per-service.html) · microservices.io · data ownership (*headings only*) · fetched 2026-10-14
- **Beyond the docs:** [Under Deconstruction: The State of Shopify's Monolith](https://shopify.engineering/shopify-monolith) · Shopify Engineering, 16 Sep 2020 · a modular monolith, with what they would do differently (*read*, introduction) · fetched 2026-10-14
- **Our delta:** the first service to carve out, with the shared database nobody can leave as the deep dive.

### T22-09 · Live streaming at tens of millions concurrent — Understand · 🔲 not written
- **Read this:** [How Disney Hotstar Scaled Its Infra for 60 Million Concurrent Users](https://blog.bytebytego.com/p/how-disney-hotstar-now-jiohotstar) · ByteByteGo, 18 Nov 2025 · before it, 25 million on two self-managed Kubernetes clusters, then redesigned gateways and managed Kubernetes (*read*) · covers our angle: **partial** · fetched 2026-10-14
- **Also good:** [How Hotstar.com dealt with 25 million concurrent viewers](https://dev.classmethod.jp/articles/reinvent-2019-cmy302/) · Classmethod, re:Invent 2019 session report · gamedays and a load-testing tool called Hulk aimed at 50M peak (*read*) · fetched 2026-10-14
- **Also good:** [Design Facebook's Live Comments System](https://www.hellointerview.com/learn/system-design/problem-breakdowns/fb-live-comments) · Hello Interview · comments over Server-Sent Events and pub/sub (*read*) · fetched 2026-10-14
- **Our delta:** CDN fan-out, adaptive bitrate and ad insertion, with the comment firehose as the deep dive.

### T22-10 · Fantasy-sports contest joins at match start — Understand · 🔲 not written
- **Read this:** [Dream11 Scales to 30,000 Joins Per Second](https://akka.io/customer-stories/dream11) · Akka customer story · the old design could not keep up, and contests over participant limits were cancelled with refunds (*read*) · covers our angle: **partial** — a vendor story · fetched 2026-10-14
- **Also good:** [Using load shedding to avoid overload](https://builder.aws.com/content/3Eun1EEyX6p2e3VYNyRLSJzLuMV/using-load-shedding-to-avoid-overload) · AWS Builder Center · shedding at overload (*read*) · fetched 2026-10-14
- **Our delta:** wallet debits and contest capacity, with the deadline write path as the deep dive.

### T22-11 · Cab and auto dispatch in dense cities — Understand · 🔲 not written
- **Read this:** [Design a Ride-Sharing Service Like Uber](https://www.hellointerview.com/learn/system-design/problem-breakdowns/uber) · Hello Interview · batched location writes and a geospatial index (*read*) · covers our angle: **partial** · fetched 2026-10-14
- **Also good:** [H3](https://www.uber.com/blog/h3/) · Uber Engineering · hexagonal cells (*read*) · fetched 2026-10-14
- **Our delta:** surge and cancellations, with the location stream as the deep dive.

### T22-12 · Broker order flow at market open — Understand · 🔲 not written
- **Read this:** [Introducing Kite Backup: A WhatsApp-based emergency mode](https://zerodha.com/z-connect/kite/introducing-kite-backup-a-whatsapp-based-emergency-mode) · Zerodha, 13 Aug 2025 · the OMS is sharded across physically independent datacentres, with exchange links on leased lines (*read*) · covers our angle: **partial** · fetched 2026-10-14
- **Also good:** [The LMAX Architecture](https://martinfowler.com/articles/lmax.html) · Martin Fowler · in-memory processing (*read*) · fetched 2026-10-14
- **Our delta:** validation, risk checks and the exchange gateway, with latency in the first minute as the deep dive.

### T22-13 · Marketplace with sellers and settlements — Understand · 🔲 not written
- **Read this:** [Understand how charges work in a Connect integration](https://docs.stripe.com/connect/charges) · Stripe · direct, destination, and separate charges and transfers (*read*) · covers our angle: **partial** · fetched 2026-10-14
- **Also good:** [Clockwork](https://tech.phonepe.com/clockwork-the-backbone-of-phonepes-2-billion-daily-jobs/) · PhonePe Tech Blog · daily merchant settlements as a scheduled job (*read*) · fetched 2026-10-14
- **Our delta:** commissions, payouts and disputes, with the settlement run as the deep dive.

### T22-14 · Travel search and fare caching — Understand · 🔲 not written
- **Read this:** [Scaling Memcache at Facebook](https://www.usenix.org/system/files/conference/nsdi13/nsdi13-final170_update.pdf) · Nishtala et al. · leases against stale sets (*read*) · covers our angle: **partial** — caching theory, not travel · fetched 2026-10-14
- **Also good:** [Key eviction](https://redis.io/docs/latest/develop/reference/eviction/) · Redis · cache memory limits (*read*) · fetched 2026-10-14
- **Our delta:** supplier fan-out and the price that changed at checkout, with freshness against supplier cost as the deep dive. No fare-specific engineering write-up was fetched.

### T22-15 · Serving the next billion users — Understand · 🔲 not written
- **Read this:** [Flipkart triples time-on-site with Progressive Web App](https://web.dev/case-studies/flipkart) · web.dev · 63 percent of Flipkart Lite users reach the site over 2G, so service workers and a streamlined site were needed (*read*) · covers our angle: **partial** · fetched 2026-10-14
- **Also good:** [Adaptive loading](https://web.dev/articles/adaptive-loading-cds-2019) · web.dev · device capability and network vary a lot (*read*) · fetched 2026-10-14
- **Our delta:** vernacular content and lite clients, with payload budgets and offline-first as the deep dive.

### T22-16 · A credit-card bill and rewards platform — Know · 🔲 not written
- **Read this:** [How to Scale a Ledger, Part I](https://www.moderntreasury.com/journal/how-to-scale-a-ledger-part-i) · Modern Treasury · a double-entry ledger (*read*) · covers our angle: **partial** · fetched 2026-10-14
- **Also good:** [Debit/Credit](https://docs.tigerbeetle.com/concepts/debit-credit/) · TigerBeetle · value moves between accounts (*read*) · fetched 2026-10-14
- **Our delta:** statements, payments and partner offers, with the rewards ledger as the deep dive.

### T22-17 · Social-commerce reselling feeds — Know · 🔲 not written
- **Read this:** [Adaptive loading](https://web.dev/articles/adaptive-loading-cds-2019) · web.dev · sites can be unusable on low-end devices (*read*) · covers our angle: **partial** · fetched 2026-10-14
- **Also good:** [Design Facebook's News Feed](https://www.hellointerview.com/learn/system-design/problem-breakdowns/fb-news-feed) · Hello Interview · precomputed feeds (*read*) · fetched 2026-10-14
- **Our delta:** catalogue sharing and orders on behalf of buyers, with the feed on a low-end device as the deep dive. No reselling-platform engineering write-up was fetched.

### T22-18 · A vernacular search and voice pipeline — Know · 🔲 not written
- **Read this:** [ICU transform token filter](https://www.elastic.co/docs/reference/elasticsearch/plugins/analysis-icu-transform) · Elasticsearch · ICU transforms handle case mapping, normalization and transliteration (*read*) · covers our angle: **partial** · fetched 2026-10-14
- **Also good:** [Study of Encoder-Decoder Architectures for Code-Mix Search Query Translation](https://arxiv.org/abs/2208.03713) · Kulkarni et al., 2022 · translating code-mixed queries to English (*headings only*) · fetched 2026-10-14
- **Our delta:** transliteration and speech to text, with query normalisation as the deep dive.

---

← [Part 12 syllabus](../syllabus/12-the-hld-catalogue.md)
