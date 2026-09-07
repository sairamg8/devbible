---
title: "Part 3 — Storage and data"
sidebar_label: "3 · Storage & data"
sidebar_position: 3
---

> Phases 4–5 · Choosing where data lives, keeping it correct under concurrency and failure, and splitting it when one box is no longer enough

The database is where a design is usually won or lost, because it is the one component that
cannot be made stateless. Interviewers push here hardest: which store and why, what happens
on failover, how the customer sees their own order a second after placing it, and what you do
on the day the primary is full. The mechanics of PostgreSQL — indexes, MVCC, `EXPLAIN`,
pooling — live in the [PostgreSQL track](../../postgresql/README.md); the MERN mirror in
[MongoDB](../../mongodb/README.md). This part is the decision layer that chooses between them.

---

## Phase 4 — Storage engines, transactions and replication

One primary, done properly, carries most products further than people expect. This phase is
what "properly" means: the engine under the table, the guarantees a transaction really gives,
and the copies of the data that keep it available when the primary is gone.

| Topic | Tier |
|---|---|
| **B-tree vs LSM engines** — read path vs write amplification, compaction, why PostgreSQL and MySQL are B-tree and Cassandra and RocksDB are LSM; choosing by the read/write mix rather than by the product name | <span className="db-tier t-master">Master</span> |
| **The write-ahead log and durability** — `fsync`, group commit, what "committed" promises and to whom; the crash that lands between the log and the data file, and why the log wins | <span className="db-tier t-master">Master</span> |
| **Index design from access patterns** — composite column order, covering and partial indexes, the index that made every write slower; reading the plan before adding another (mechanics in [PostgreSQL](../../postgresql/README.md)) | <span className="db-tier t-master">Master</span> |
| **Choosing the store from the access pattern** — relational, document, wide-column, key-value, graph, time-series, search; the "this pattern → this store" table, and why "PostgreSQL until proven otherwise" is a senior answer, not a lazy one | <span className="db-tier t-master">Master</span> |
| **Transactions and isolation levels** — read committed, repeatable read, serializable; the anomaly each permits (lost update, write skew, phantom); MVCC and why readers do not block writers; `SELECT … FOR UPDATE` on the storefront's stock row | <span className="db-tier t-master">Master</span> |
| **Constraints as the last line of defence** — unique indexes, foreign keys and check constraints catching what the application forgot; the double booking a unique index prevented at 2 a.m. | <span className="db-tier t-master">Master</span> |
| **Replication topologies** — leader-follower, multi-leader, leaderless; synchronous vs asynchronous vs semi-synchronous; what each one risks on failover and what it costs on every write | <span className="db-tier t-master">Master</span> |
| **Replication lag and read-your-writes** — the customer who cannot see the order they just placed; routing reads after writes, session consistency, monotonic reads, and admitting the lag window in the design | <span className="db-tier t-master">Master</span> |
| **Connection pooling at scale** — pool-per-pod times pods exceeding the server's limit; PgBouncer's modes and what breaks in transaction mode (prepared statements, session state); sizing from the database's side, not the app's | <span className="db-tier t-master">Master</span> |
| **Schema design at scale** — normalisation vs deliberate denormalisation, wide rows, JSONB where it earns its place; the storefront's orders (strict) against its catalogue attributes (flexible) | <span className="db-tier t-understand">Understand</span> |
| **Failover** — automatic vs manual promotion, split brain, fencing the old primary, the writes async replication loses; what a managed service does for you and the part it still leaves to you | <span className="db-tier t-understand">Understand</span> |
| **Quorum reads and writes** — N, R and W, sloppy quorums, hinted handoff, read repair, anti-entropy; the Dynamo model that Cassandra and similar stores inherit | <span className="db-tier t-understand">Understand</span> |
| **Buffer pools and the working set** — memory as the real size of the database, cache-hit ratio at the storage layer, the cold cache after a failover that made a healthy replica slow | <span className="db-tier t-understand">Understand</span> |
| **Large objects and files** — never in the row: object storage plus a reference, presigned URLs, the review image that would have bloated every backup | <span className="db-tier t-understand">Understand</span> |
| **Storage in the storefront** — orders and inventory in PostgreSQL, sessions and carts in Redis, catalogue search in a search engine, images in object storage; one sentence of reason per choice | <span className="db-tier t-understand">Understand</span> |
| **Where NoSQL genuinely wins** — write-heavy time series, huge sparse rows, simple key-value at extreme scale, graph traversals; and the common story of rebuilding on PostgreSQL once the access patterns turned relational | <span className="db-tier t-know">Know</span> |
| **Engine internals worth knowing** — page layout, tuple versions, vacuum and bloat, fill factor; what makes an `UPDATE` expensive and a hot row hotter | <span className="db-tier t-know">Know</span> |

**Gate — move on when:** you can explain what the storefront's checkout needs from its
database — isolation level, the row lock, the constraint, the replication mode — and what the
customer sees in the second after the write if reads go to a replica.

---

## Phase 5 — Partitioning, sharding and the data estate

The primary is full, or the writes are, or the analysts are slowing checkout. This phase is
the set of moves that follow: split the data, add the stores that are built for the other
workloads, and keep the whole estate in sync — while knowing what each move costs.

| Topic | Tier |
|---|---|
| **Horizontal sharding** — when a single primary cannot hold the writes or the data; the price you sign for on day one: no cross-shard joins, no cross-shard transactions, operational weight forever | <span className="db-tier t-master">Master</span> |
| **Choosing the shard key** — hash vs range vs directory, cardinality, hotspots and the celebrity problem, query locality (tenant, user, region); the key you cannot change later without a migration | <span className="db-tier t-master">Master</span> |
| **Rebalancing and resharding** — consistent hashing, virtual shards, a fixed number of logical partitions over a growing number of nodes, moving a shard live with dual writes and a backfill | <span className="db-tier t-master">Master</span> |
| **Cross-shard queries and transactions** — scatter-gather, global secondary indexes, denormalised lookups; why cross-shard transactions are avoided and what replaces them ([Part 4](04-distributed-systems-theory.md)) | <span className="db-tier t-master">Master</span> |
| **Object storage** — the S3 model: flat keys, versioning, consistency, presigned uploads straight from the browser, multipart, lifecycle tiers, egress cost; the storefront's images and invoices | <span className="db-tier t-master">Master</span> |
| **OLTP vs OLAP** — row vs columnar storage, why analytics on the primary kills checkout; read replica vs warehouse vs a columnar store, and CDC or ELT to feed it | <span className="db-tier t-master">Master</span> |
| **Search engines** — the inverted index, analysers, relevance scoring, facets; keeping the search index in sync with PostgreSQL through change data capture; when `tsvector` is already enough | <span className="db-tier t-master">Master</span> |
| **Backups, point-in-time recovery and restore drills** — base backup plus the log, the restore nobody has tested, recovery objectives as *backup* requirements rather than slogans | <span className="db-tier t-master">Master</span> |
| **Schema migrations at scale** — expand and contract, online DDL, backfills in batches, dual-read and dual-write phases, the lock that took the site down for a column rename | <span className="db-tier t-master">Master</span> |
| **Vertical partitioning first** — splitting by table and by service before splitting rows; the cheaper move that postpones sharding by years | <span className="db-tier t-understand">Understand</span> |
| **Sharding middleware vs application sharding** — proxy-style routers versus routing in the application; the ORM that does not know the data is sharded | <span className="db-tier t-understand">Understand</span> |
| **Multi-tenancy models** — shared schema with a tenant column, schema per tenant, database per tenant; isolation, noisy neighbours, running a migration across thousands of tenants | <span className="db-tier t-understand">Understand</span> |
| **Data lifecycle** — hot, warm and cold tiers, archival, retention policies, right-to-erasure deletion that must reach every shard, backup and search index | <span className="db-tier t-understand">Understand</span> |
| **The storefront's data estate** — primary and replicas, Redis, the search index, object storage, the warehouse; every arrow labelled with its sync mechanism and its lag | <span className="db-tier t-understand">Understand</span> |
| **Time-series and metrics stores** — append-only writes, downsampling, retention; why metrics do not belong in the orders database | <span className="db-tier t-know">Know</span> |
| **Data lakes, warehouses and the lakehouse idea** — columnar files and open table formats, where the clickstream goes, and who reads it | <span className="db-tier t-know">Know</span> |
| **Global data** — residency, multi-region reads, geo-partitioning so a region's data stays in its region; the compliance angle continues in **Part 9** *(not written yet)* | <span className="db-tier t-know">Know</span> |

**Gate — deliverable:** the storefront's sharding plan on one page: the shard key with the
hotspot analysis, the query that no longer works and its replacement, the resharding
procedure, and the sync path from the primary to search and analytics with each lag stated.

---

← [Part 2 — The network path and caching](02-the-network-path-and-caching.md) · [Index](../README.md) · Next → [Part 4 — Distributed systems theory](04-distributed-systems-theory.md)
