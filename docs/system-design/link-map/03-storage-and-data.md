---
title: "Link map · System design · Part 3 (phases 4–5)"
sidebar_label: "03 · storage & data"
sidebar_position: 3
---

# Link map · System design · Part 3 (phases 4–5)

Covers every topic row of phases 4 and 5 in `docs/system-design/syllabus/03-storage-and-data.md`: storage engines, transactions and replication (T04-01 to T04-17) and partitioning, sharding and the data estate (T05-01 to T05-17). That is 34 rows. None has a written page of ours yet (`docs/system-design/pages` holds phases 0 to 3 only), so every block is marked not written and its "Our delta" line records what the syllabus row promises.
*read* = I read the passage that supports the claim on the fetched page; *headings only* = fetched at HTTP 200 and headings checked, passage not read for the claim. Third-party links carry a date only where the page shows one. No `#anchors` are given. Where no good non-official explanation turned up, the block has no "Beyond the docs" line. Official means the PostgreSQL, PgBouncer, Cassandra, MongoDB, Vitess, AWS and similar vendor documentation, plus Wikipedia for named concepts.

---

## Phase 4 — Storage engines, transactions and replication

### T04-01 · B-tree vs LSM engines — Master · 🔲 not written
- **Read this:** [Storage Engine](https://cassandra.apache.org/doc/latest/cassandra/architecture/storage-engine.html) · Apache Cassandra docs · writes go through a memtable to SSTables, and compaction re-writes SSTables so every write is rewritten several times, which the page names write amplification (*read*) · covers our angle: **partial — no B-tree side and no read-path comparison** · fetched 2026-10-14
- **Also good:** [Log-structured merge-tree](https://en.wikipedia.org/wiki/Log-structured_merge-tree) · Wikipedia · levelled merging gives fewer components and more write amplification, tiering gives less write amplification and costlier reads (*read*) · covers our angle: **partial — no choose-by-workload guidance** · fetched 2026-10-14
- **Our delta:** the choice made from the read/write mix and the named engines (PostgreSQL and MySQL B-tree, Cassandra and RocksDB LSM), as a decision rather than a product comparison. The RocksDB wiki returned 403 to the fetcher, so it is not linked.

### T04-02 · The write-ahead log and durability — Master · 🔲 not written
- **Read this:** [Write-Ahead Logging (WAL)](https://www.postgresql.org/docs/current/wal-intro.html) · PostgreSQL docs · data pages are changed only after the WAL records are flushed to permanent storage, so after a crash the server rolls forward (REDO) and data pages need not be flushed on every commit (*read*) · covers our angle: **full** · fetched 2026-10-14
- **Also good:** [Reliability](https://www.postgresql.org/docs/current/wal-reliability.html) · PostgreSQL docs · disk write caches and `wal_sync_method` and `fsync` decide whether a flushed record is really durable (*read*) · covers our angle: **partial — hardware focus** · fetched 2026-10-14
- **Also good:** [Asynchronous Commit](https://www.postgresql.org/docs/current/wal-async-commit.html) · PostgreSQL docs · `synchronous_commit` trades durability certainty for commit speed, per transaction (*read*) · covers our angle: **partial — no group-commit mechanics** · fetched 2026-10-14
- **Our delta:** what 'committed' promises and to whom, plus the crash between the log and the data file and why the log wins; the docs state the mechanism but not the interview framing.

### T04-03 · Index design from access patterns — Master · 🔲 not written
- **Read this:** [Multicolumn Indexes](https://www.postgresql.org/docs/current/indexes-multicolumn.html) · PostgreSQL docs · a B-tree multicolumn index is most efficient with constraints on the leading (leftmost) columns: equality on leading columns plus an inequality on the first non-equality column (*read*) · covers our angle: **partial — no choose-by-pattern procedure** · fetched 2026-10-14
- **Also good:** [Partial Indexes](https://www.postgresql.org/docs/current/indexes-partial.html) · PostgreSQL docs · an index built over a subset of rows defined by a predicate (*read*) · covers our angle: **partial** · fetched 2026-10-14
- **Also good:** [Index-Only Scans and Covering Indexes](https://www.postgresql.org/docs/current/indexes-index-only-scans.html) · PostgreSQL docs · page for covering indexes via `INCLUDE` (*headings only*) · covers our angle: **partial** · fetched 2026-10-14
- **Beyond the docs:** [The right column order in multi-column indexes](https://use-the-index-luke.com/sql/where-clause/the-equals-operator/concatenated-keys) · Use The Index, Luke · an explainer on choosing column order from the queries, with plans · fetched 2026-10-14 (*headings only*)
- **Our delta:** deriving the index from the access pattern, the write cost of the index that made every write slower, and reading the plan first; mechanics stay in the PostgreSQL track.

### T04-04 · Choosing the store from the access pattern — Master · 🔲 not written
- **Read this:** [Choose Boring Technology](https://mcfunley.com/choose-boring-technology) · Dan McKinley · a company gets about three innovation tokens, and a new datastore spends one · fetched 2026-10-14 (*read*) · covers our angle: **partial** — the argument for a default, not the pattern-to-store table
- **Also good:** [NoSQL](https://en.wikipedia.org/wiki/NoSQL) · Wikipedia · lists the families (document, graph, wide-column and others) with their data models (*headings only*) · covers our angle: **partial** · fetched 2026-10-14
- **Also good:** [Polyglot Persistence](https://martinfowler.com/bliki/PolyglotPersistence.html) · Martin Fowler · the idea of using different stores for different needs (*headings only*) · covers our angle: **partial** · fetched 2026-10-14
- **Beyond the docs:** [Just Use Postgres for Everything](https://www.amazingcto.com/postgres-for-everything/) · Amazing CTO, updated 2025-12-13 · argues for one PostgreSQL instead of Redis, MongoDB and Kafka · fetched 2026-10-14 (*headings only*)
- **Our delta:** the this-pattern-to-this-store table and why 'PostgreSQL until proven otherwise' is a senior answer.

### T04-05 · Transactions and isolation levels — Master · 🔲 not written
- **Read this:** [Transaction Isolation](https://www.postgresql.org/docs/current/transaction-iso.html) · PostgreSQL docs · defines the phenomena (including phantom read and serialization anomaly) against the four levels and what PostgreSQL does at each (*read*) · covers our angle: **partial — no lost-update or write-skew storefront example** · fetched 2026-10-14
- **Also good:** [Introduction (MVCC)](https://www.postgresql.org/docs/current/mvcc-intro.html) · PostgreSQL docs · locks for reading do not conflict with locks for writing, so reading never blocks writing and writing never blocks reading (*read*) · covers our angle: **full on MVCC** · fetched 2026-10-14
- **Also good:** [Explicit Locking](https://www.postgresql.org/docs/current/explicit-locking.html) · PostgreSQL docs · `SELECT` with `FOR UPDATE`, `FOR NO KEY UPDATE`, `FOR SHARE` and `FOR KEY SHARE` takes row-level locks (*read*) · covers our angle: **partial** · fetched 2026-10-14
- **Beyond the docs:** [Consistency Models](https://jepsen.io/consistency) · Jepsen · map of isolation and consistency models, including write skew · fetched 2026-10-14 (*headings only*)
- **Our delta:** the anomaly each level permits tied to the storefront's stock row and `SELECT … FOR UPDATE`.

### T04-06 · Constraints as the last line of defence — Master · 🔲 not written
- **Read this:** [Constraints](https://www.postgresql.org/docs/current/ddl-constraints.html) · PostgreSQL docs · check, not-null, unique, primary key, foreign key and exclusion constraints, with their semantics (*read*) · covers our angle: **partial — no incident framing** · fetched 2026-10-14
- **Our delta:** the double booking a unique index prevented at 2 a.m.; constraints as a backstop for application bugs rather than a modelling feature.

### T04-07 · Replication topologies — Master · 🔲 not written
- **Read this:** [High Availability, Load Balancing, and Replication](https://www.postgresql.org/docs/current/high-availability.html) · PostgreSQL docs · chapter opening on why one would run several servers and the solution families (*headings only*) · covers our angle: **partial** · fetched 2026-10-14
- **Also good:** [Comparison of Different Solutions](https://www.postgresql.org/docs/current/different-replication-solutions.html) · PostgreSQL docs · a standby can be made the new primary quickly and replication can be synchronous or asynchronous (*read*) · covers our angle: **partial — leader-follower only** · fetched 2026-10-14
- **Also good:** [Log-Shipping Standby Servers](https://www.postgresql.org/docs/current/warm-standby.html) · PostgreSQL docs · streaming, cascading and synchronous replication; cascading replication is currently asynchronous (*read*) · covers our angle: **partial** · fetched 2026-10-14
- **Our delta:** leader-follower, multi-leader and leaderless side by side with the failover risk and per-write cost of each.

### T04-08 · Replication lag and read-your-writes — Master · 🔲 not written
- **Read this:** [Hot Standby](https://www.postgresql.org/docs/current/hot-standby.html) · PostgreSQL docs · queries on a standby, with a section on handling query conflicts (*headings only*) · covers our angle: **partial — mechanics, no routing patterns** · fetched 2026-10-14
- **Also good:** [Read Your Writes](https://jepsen.io/consistency/models/read-your-writes) · Jepsen · formal definition of the model (*headings only*) · covers our angle: **partial** · fetched 2026-10-14
- **Also good:** [Monotonic Reads](https://jepsen.io/consistency/models/monotonic-reads) · Jepsen · formal definition of the model (*headings only*) · covers our angle: **partial** · fetched 2026-10-14
- **Our delta:** the customer who cannot see the order just placed, the routing fixes, and admitting the lag window in the design.

### T04-09 · Connection pooling at scale — Master · 🔲 not written
- **Read this:** [Features](https://www.pgbouncer.org/features.html) · PgBouncer docs · session pooling supports all features; transaction pooling assigns a server connection only for the length of a transaction and breaks some features; statement pooling disallows multi-statement transactions (*read*) · covers our angle: **partial — no pods-times-pool arithmetic** · fetched 2026-10-14
- **Also good:** [Configuration](https://www.pgbouncer.org/config.html) · PgBouncer docs · `pool_mode` (session is the default, then transaction and statement) and the pool-size settings (*read*) · covers our angle: **partial** · fetched 2026-10-14
- **Also good:** [Number Of Database Connections](https://wiki.postgresql.org/wiki/Number_Of_Database_Connections) · PostgreSQL wiki · sizing the connection count from the database's side (*headings only*) · covers our angle: **partial** · fetched 2026-10-14
- **Our delta:** pool-per-pod times pods against the server limit, and what breaks in transaction mode.

### T04-10 · Schema design at scale — Understand · 🔲 not written
- **Read this:** [JSON Types](https://www.postgresql.org/docs/current/datatype-json.html) · PostgreSQL docs · `jsonb`, with sections on designing JSON documents and indexing (*headings only*) · covers our angle: **partial — types, not when to use them** · fetched 2026-10-14
- **Our delta:** normalisation against deliberate denormalisation, with orders strict and catalogue attributes flexible.

### T04-11 · Failover — Understand · 🔲 not written
- **Read this:** [Failover](https://www.postgresql.org/docs/current/warm-standby-failover.html) · PostgreSQL docs · what happens when the primary fails and a standby is promoted (*headings only*) · covers our angle: **partial** · fetched 2026-10-14
- **Also good:** [Multi-AZ DB deployments](https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/Concepts.MultiAZ.html) · AWS docs · a Multi-AZ instance has one standby for failover that does not serve reads; a cluster has two readable standbys (*read*) · covers our angle: **partial — the managed-service side** · fetched 2026-10-14
- **Beyond the docs:** [How to do distributed locking](https://martin.kleppmann.com/2016/02/08/how-to-do-distributed-locking.html) · Martin Kleppmann, 2016 · the fencing token: a number that increases with every lock grant and is sent with each write so a stale holder is rejected, which is the idea behind fencing an old primary · fetched 2026-10-14 (*read*)
- **Our delta:** automatic against manual promotion, split brain, and the writes asynchronous replication loses.

### T04-12 · Quorum reads and writes — Understand · 🔲 not written
- **Read this:** [Dynamo](https://cassandra.apache.org/doc/latest/cassandra/architecture/dynamo.html) · Apache Cassandra docs · read repair and hinted handoff are best-effort techniques to converge replicas, with anti-entropy repair for the guarantee (*read*) · covers our angle: **partial — no N, R and W arithmetic** · fetched 2026-10-14
- **Also good:** [Dynamo: Amazon's Highly Available Key-value Store](https://www.allthingsdistributed.com/files/amazon-dynamo-sosp2007.pdf) · Amazon, SOSP 2007 · the original paper (*headings only*) · covers our angle: **partial** · fetched 2026-10-14
- **Our delta:** N, R and W with sloppy quorums, and the Dynamo lineage of Cassandra and similar stores.

### T04-13 · Buffer pools and the working set — Understand · 🔲 not written
- **Read this:** [Resource Consumption](https://www.postgresql.org/docs/current/runtime-config-resource.html) · PostgreSQL docs · `shared_buffers` sets the memory for shared buffers, default typically 128MB (*read*) · covers our angle: **partial** · fetched 2026-10-14
- **Also good:** [pg_prewarm](https://www.postgresql.org/docs/current/pgprewarm.html) · PostgreSQL docs · preloads relation data into buffer caches, relevant to a cold cache (*headings only*) · covers our angle: **partial** · fetched 2026-10-14
- **Our delta:** memory as the real size of the database and the cold cache after failover.

### T04-14 · Large objects and files — Understand · 🔲 not written
- **Read this:** [Download and upload objects with presigned URLs](https://docs.aws.amazon.com/AmazonS3/latest/userguide/using-presigned-url.html) · AWS docs · presigned URLs let a client download or upload an object without its own credentials (*headings only*) · covers our angle: **partial** · fetched 2026-10-14
- **Also good:** [TOAST](https://www.postgresql.org/docs/current/storage-toast.html) · PostgreSQL docs · how large values are stored out of line (*headings only*) · covers our angle: **partial** · fetched 2026-10-14
- **Our delta:** never in the row: object storage plus a reference, and the review image that would have bloated every backup.

### T04-15 · Storage in the storefront — Understand · 🔲 not written
- **Read this:** [Redis data types](https://redis.io/docs/latest/develop/data-types/) · Redis docs · the structures (strings, hashes, lists and others) that fit sessions and carts (*headings only*) · covers our angle: **partial** · fetched 2026-10-14
- **Also good:** [Polyglot Persistence](https://martinfowler.com/bliki/PolyglotPersistence.html) · Martin Fowler · one store per need (*headings only*) · covers our angle: **partial** · fetched 2026-10-14
- **Our delta:** our own worked case: orders and inventory in PostgreSQL, sessions and carts in Redis, search in a search engine, images in object storage, one sentence of reason each.

### T04-16 · Where NoSQL genuinely wins — Know · 🔲 not written
- **Read this:** [NoSQL](https://en.wikipedia.org/wiki/NoSQL) · Wikipedia · the families (wide-column, graph, document) with typical uses (*headings only*) · covers our angle: **partial** · fetched 2026-10-14
- **Also good:** [Choose Boring Technology](https://mcfunley.com/choose-boring-technology) · Dan McKinley · the default-to-the-familiar argument (*read*) · fetched 2026-10-14
- **Our delta:** where each NoSQL family genuinely wins and the story of rebuilding on PostgreSQL. The Uber write-up returned 406 to the fetcher, so it is not linked.

### T04-17 · Engine internals worth knowing — Know · 🔲 not written
- **Read this:** [Database Page Layout](https://www.postgresql.org/docs/current/storage-page-layout.html) · PostgreSQL docs · page and tuple layout (*headings only*) · covers our angle: **partial** · fetched 2026-10-14
- **Also good:** [Routine Vacuuming](https://www.postgresql.org/docs/current/routine-vacuuming.html) · PostgreSQL docs · VACUUM removes dead row versions and marks space reusable, but does not normally return it to the operating system (*read*) · covers our angle: **partial** · fetched 2026-10-14
- **Also good:** [Heap-Only Tuples (HOT)](https://www.postgresql.org/docs/current/storage-hot.html) · PostgreSQL docs · the HOT update path (*headings only*) · covers our angle: **partial** · fetched 2026-10-14
- **Our delta:** what makes an `UPDATE` expensive and a hot row hotter, with fill factor.


## Phase 5 — Partitioning, sharding and the data estate

### T05-01 · Horizontal sharding — Master · 🔲 not written
- **Read this:** [Sharding](https://www.mongodb.com/docs/manual/sharding/) · MongoDB docs · shards data at collection level using a shard key across the shards in a cluster (*read*) · covers our angle: **partial — no statement of the price paid** · fetched 2026-10-14
- **Also good:** [Table Partitioning](https://www.postgresql.org/docs/current/ddl-partitioning.html) · PostgreSQL docs · range partitioning and the other built-in forms, within one server (*read*) · covers our angle: **partial — one node, not sharding** · fetched 2026-10-14
- **Beyond the docs:** [How Figma's databases team lived to tell the scale](https://www.figma.com/blog/how-figmas-databases-team-lived-to-tell-the-scale/) · Figma engineering · nine-month account of horizontally sharding a Postgres stack after vertical partitioning bought runway · fetched 2026-10-14 (*read*)
- **Our delta:** the day-one price: no cross-shard joins or transactions and permanent operational weight.

### T05-02 · Choosing the shard key — Master · 🔲 not written
- **Read this:** [Shard Keys](https://www.mongodb.com/docs/manual/core/sharding-shard-key/) · MongoDB docs · shard key selection, with cardinality, frequency and monotonic change as concerns (*headings only*) · covers our angle: **partial** · fetched 2026-10-14
- **Also good:** [Hashed Sharding](https://www.mongodb.com/docs/manual/core/hashed-sharding/) · MongoDB docs · hash-based distribution (*headings only*) · covers our angle: **partial** · fetched 2026-10-14
- **Also good:** [Ranged Sharding](https://www.mongodb.com/docs/manual/core/ranged-sharding/) · MongoDB docs · range-based distribution (*headings only*) · covers our angle: **partial** · fetched 2026-10-14
- **Also good:** [Choosing Distribution Column](https://docs.citusdata.com/en/stable/sharding/data_modeling.html) · Citus docs · choosing the distribution column for a multi-tenant or real-time workload (*headings only*) · covers our angle: **partial** · fetched 2026-10-14
- **Our delta:** hotspot and celebrity analysis, and the key you cannot change without a migration.

### T05-03 · Rebalancing and resharding — Master · 🔲 not written
- **Read this:** [Resharding](https://vitess.io/docs/24.0/user-guides/configuration-advanced/resharding/) · Vitess docs · a guide to resharding live with traffic switching (*headings only*) · covers our angle: **partial** · fetched 2026-10-14
- **Also good:** [Consistent hashing](https://en.wikipedia.org/wiki/Consistent_hashing) · Wikipedia · virtual nodes: several labels pointing to one real server to balance the ring (*read*) · covers our angle: **partial** · fetched 2026-10-14
- **Beyond the docs:** [How Figma's databases team lived to tell the scale](https://www.figma.com/blog/how-figmas-databases-team-lived-to-tell-the-scale/) · Figma engineering · logical shards over physical ones, from a team that did it · fetched 2026-10-14 (*read*)
- **Our delta:** fixed logical partitions over growing nodes and the dual-write plus backfill procedure.

### T05-04 · Cross-shard queries and transactions — Master · 🔲 not written
- **Read this:** [Vindexes](https://vitess.io/docs/24.0/reference/features/vindexes/) · Vitess docs · vindexes map column values to shards, and the reference lists scatter behaviour and distributed transactions (*headings only*) · covers our angle: **partial** · fetched 2026-10-14
- **Also good:** [Architecture](https://vitess.io/docs/24.0/overview/architecture/) · Vitess docs · the query-routing layer in front of shards (*headings only*) · covers our angle: **partial** · fetched 2026-10-14
- **Our delta:** scatter-gather, global secondary indexes and denormalised lookups, with what replaces cross-shard transactions (Part 4).

### T05-05 · Object storage — Master · 🔲 not written
- **Read this:** [What is Amazon S3?](https://docs.aws.amazon.com/AmazonS3/latest/userguide/Welcome.html) · AWS docs · buckets and objects, features, how it works and the data consistency model (*read*) · covers our angle: **partial** · fetched 2026-10-14
- **Also good:** [Amazon S3 Strong Consistency](https://aws.amazon.com/s3/consistency/) · AWS · page on strong read-after-write consistency (*headings only*) · covers our angle: **partial** · fetched 2026-10-14
- **Also good:** [Versioning](https://docs.aws.amazon.com/AmazonS3/latest/userguide/Versioning.html) · AWS docs · a delete inserts a delete marker, and an overwrite makes a new version (*read*) · covers our angle: **partial** · fetched 2026-10-14
- **Also good:** [Multipart upload](https://docs.aws.amazon.com/AmazonS3/latest/userguide/mpuoverview.html) · AWS docs · splitting large uploads into parts (*headings only*) · covers our angle: **partial** · fetched 2026-10-14
- **Also good:** [Lifecycle](https://docs.aws.amazon.com/AmazonS3/latest/userguide/object-lifecycle-mgmt.html) · AWS docs · lifecycle rules transition objects to lower-cost classes or delete expired ones (*read*) · covers our angle: **partial** · fetched 2026-10-14
- **Our delta:** the storefront's images and invoices, presigned browser uploads and egress cost.

### T05-06 · OLTP vs OLAP — Master · 🔲 not written
- **Read this:** [Online analytical processing](https://en.wikipedia.org/wiki/Online_analytical_processing) · Wikipedia · overview of OLAP systems and how they differ from transactional ones (*headings only*) · covers our angle: **partial** · fetched 2026-10-14
- **Also good:** [What is ClickHouse?](https://clickhouse.com/docs/get-started/about/intro) · ClickHouse docs · a column-oriented SQL database for OLAP (*read*) · covers our angle: **partial** · fetched 2026-10-14
- **Also good:** [Architecture](https://debezium.io/documentation/reference/stable/architecture.html) · Debezium docs · how change data capture feeds other systems (*headings only*) · covers our angle: **partial** · fetched 2026-10-14
- **Our delta:** why analytics on the primary kills checkout, and replica against warehouse against columnar store.

### T05-07 · Search engines — Master · 🔲 not written
- **Read this:** [Text analysis](https://www.elastic.co/docs/manage-data/data-store/text-analysis) · Elastic docs · analysis makes full-text search possible through tokenization into tokens (*read*) · covers our angle: **partial** · fetched 2026-10-14
- **Also good:** [Introduction (full text search)](https://www.postgresql.org/docs/current/textsearch-intro.html) · PostgreSQL docs · `tsvector` full-text search built into PostgreSQL (*headings only*) · covers our angle: **partial — the when-it-is-enough side** · fetched 2026-10-14
- **Beyond the docs:** [Elasticsearch from the bottom up](https://www.elastic.co/blog/found-elasticsearch-from-the-bottom-up) · Elastic blog · starts from the inverted index and builds up to a near-real-time system · fetched 2026-10-14 (*read*)
- **Our delta:** keeping the index in sync with PostgreSQL through CDC, and when `tsvector` is already enough.

### T05-08 · Backups, point-in-time recovery and restore drills — Master · 🔲 not written
- **Read this:** [Continuous Archiving and Point-in-Time Recovery](https://www.postgresql.org/docs/current/continuous-archiving.html) · PostgreSQL docs · base backup plus archived WAL for point-in-time recovery (*headings only*) · covers our angle: **partial — procedure, no drills** · fetched 2026-10-14
- **Also good:** [Backup and Restore](https://www.postgresql.org/docs/current/backup.html) · PostgreSQL docs · SQL dump, file-system backup and continuous archiving (*read*) · covers our angle: **partial** · fetched 2026-10-14
- **Our delta:** recovery objectives as backup requirements and the restore nobody tested.

### T05-09 · Schema migrations at scale — Master · 🔲 not written
- **Read this:** [Parallel Change](https://martinfowler.com/bliki/ParallelChange.html) · Martin Fowler · expand and contract: expand, migrate, contract (*read*) · covers our angle: **partial — interfaces, not databases** · fetched 2026-10-14
- **Also good:** [ALTER TABLE](https://www.postgresql.org/docs/current/sql-altertable.html) · PostgreSQL docs · the command reference, including locking behaviour (*headings only*) · covers our angle: **partial** · fetched 2026-10-14
- **Beyond the docs:** [Online migrations at scale](https://stripe.com/blog/online-migrations) · Stripe · four phases: dual write, switch reads, switch writes, remove the old · fetched 2026-10-14 (*read*)
- **Our delta:** online DDL, batch backfills, and the lock that took the site down for a column rename.

### T05-10 · Vertical partitioning first — Understand · 🔲 not written
- **Read this:** [Partition (database)](https://en.wikipedia.org/wiki/Partition_(database)) · Wikipedia · covers horizontal and vertical partitioning (*headings only*) · covers our angle: **partial** · fetched 2026-10-14
- **Also good:** [Database per service](https://microservices.io/patterns/data/database-per-service.html) · microservices.io · splitting data by service (*headings only*) · covers our angle: **partial** · fetched 2026-10-14
- **Beyond the docs:** [How Figma's databases team lived to tell the scale](https://www.figma.com/blog/how-figmas-databases-team-lived-to-tell-the-scale/) · Figma engineering · vertical partitioning bought significant runway and was a stepping stone to sharding · fetched 2026-10-14 (*read*)
- **Our delta:** splitting by table and service before rows as the cheaper move.

### T05-11 · Sharding middleware vs application sharding — Understand · 🔲 not written
- **Read this:** [Architecture](https://vitess.io/docs/24.0/overview/architecture/) · Vitess docs · a proxy-style routing layer (*headings only*) · covers our angle: **partial** · fetched 2026-10-14
- **Also good:** [Choosing Distribution Column](https://docs.citusdata.com/en/stable/sharding/data_modeling.html) · Citus docs · sharding inside the database (*headings only*) · covers our angle: **partial** · fetched 2026-10-14
- **Our delta:** proxy routers against routing in the application, and the ORM unaware of sharding.

### T05-12 · Multi-tenancy models — Understand · 🔲 not written
- **Read this:** [Architectural approaches for storage and data in multitenant solutions](https://learn.microsoft.com/en-us/azure/architecture/guide/multitenant/approaches/storage-data) · Microsoft Learn · tenant isolation approaches for storage and data (*headings only*) · covers our angle: **partial** · fetched 2026-10-14
- **Our delta:** shared schema, schema per tenant and database per tenant, with noisy neighbours and migrations across thousands of tenants.

### T05-13 · Data lifecycle — Understand · 🔲 not written
- **Read this:** [Lifecycle](https://docs.aws.amazon.com/AmazonS3/latest/userguide/object-lifecycle-mgmt.html) · AWS docs · lifecycle rules move objects to cheaper classes or expire them (*read*) · covers our angle: **partial — storage tiers only** · fetched 2026-10-14
- **Also good:** [Art. 17 GDPR](https://gdpr-info.eu/art-17-gdpr/) · gdpr-info.eu · the data subject may obtain erasure without undue delay (*read*) · covers our angle: **partial — the legal text only** · fetched 2026-10-14
- **Our delta:** erasure that must reach every shard, backup and search index.

### T05-14 · The storefront's data estate — Understand · 🔲 not written
- **Read this:** [Architecture](https://debezium.io/documentation/reference/stable/architecture.html) · Debezium docs · the change-capture path that feeds search and a warehouse (*headings only*) · covers our angle: **partial** · fetched 2026-10-14
- **Our delta:** one diagram with every arrow labelled by sync mechanism and lag.

### T05-15 · Time-series and metrics stores — Know · 🔲 not written
- **Read this:** [Storage](https://prometheus.io/docs/prometheus/latest/storage/) · Prometheus docs · samples are grouped into two-hour blocks on local disk, each with chunks, metadata and an index (*read*) · covers our angle: **partial** · fetched 2026-10-14
- **Our delta:** append-only writes, downsampling and retention, and why metrics stay out of the orders database.

### T05-16 · Data lakes, warehouses and the lakehouse idea — Know · 🔲 not written
- **Read this:** [Apache Iceberg documentation](https://iceberg.apache.org/docs/latest/) · Apache Iceberg · an open table format for huge analytic datasets (*read*) · covers our angle: **partial** · fetched 2026-10-14
- **Also good:** [Parquet overview](https://parquet.apache.org/docs/overview/) · Apache Parquet · columnar file format (*headings only*) · covers our angle: **partial** · fetched 2026-10-14
- **Beyond the docs:** [Lakehouse: A New Generation of Open Platforms](https://www.cidrdb.org/cidr2021/papers/cidr2021_paper17.pdf) · CIDR 2021 paper · the original statement of the lakehouse idea · fetched 2026-10-14 (*headings only*)
- **Our delta:** where the clickstream goes and who reads it.

### T05-17 · Global data — Know · 🔲 not written
- **Read this:** [Multi-Region Capabilities Overview](https://docs.cockroachlabs.com/docs/stable/multiregion-overview) · CockroachDB docs · multi-region capabilities (*headings only*) · covers our angle: **partial** · fetched 2026-10-14
- **Also good:** [Art. 44 GDPR](https://gdpr-info.eu/art-44-gdpr/) · gdpr-info.eu · general principle for transfers (*headings only*) · covers our angle: **partial** · fetched 2026-10-14
- **Beyond the docs:** [Spanner: Google's Globally-Distributed Database](https://research.google/pubs/spanner-googles-globally-distributed-database-2/) · Google Research · a globally distributed database paper · fetched 2026-10-14 (*headings only*)
- **Our delta:** residency, multi-region reads and geo-partitioning; the compliance angle continues in Part 9 (not written yet).
