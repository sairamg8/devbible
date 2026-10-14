---
title: "Link map · System design · Part 3 (phases 4–5)"
sidebar_label: "03 · storage & data"
sidebar_position: 3
---

# Link map · System design · Part 3 (phases 4–5)

Covers every topic row of phases 4 and 5 in `docs/system-design/syllabus/03-storage-and-data.md`: storage engines, transactions and replication (T04-01 to T04-17) and partitioning, sharding and the data estate (T05-01 to T05-17). That is 34 rows. We have no written page for any of them yet (`docs/system-design/pages` holds phases 0 to 3 only), so every block is marked not written and its "Our delta" line records what the syllabus row promises.
*read* = I read the passage on the fetched page that supports the claim. *headings only* = the page returned HTTP 200 and I checked its headings but did not read the passage behind the claim. Third-party links carry a date only where the page shows one. No `#anchors` are given. A block with no "Beyond the docs" line is one where I found no good non-official explanation. "Official" means vendor documentation (PostgreSQL, PgBouncer, Cassandra, MongoDB, Vitess, AWS and similar) plus Wikipedia for named concepts.

---

## Phase 4 — Storage engines, transactions and replication

### T04-01 · B-tree vs LSM engines — Master · 🔲 not written
- **Read this:** [Storage Engine](https://cassandra.apache.org/doc/latest/cassandra/architecture/storage-engine.html) · Apache Cassandra docs · memtables in memory and immutable SSTables on disk, with a commit log for crash resilience. Compaction reads several small SSTables, merges them and rewrites a new one, which the page names write amplification. Bloom filters offset the read cost (*read*) · covers our angle: **partial — no B-tree side** · fetched 2026-10-14
- **Also good:** [Log-structured merge-tree](https://en.wikipedia.org/wiki/Log-structured_merge-tree) · Wikipedia · two merge policies. Levelling keeps one component per level, which means fewer components and more write amplification. Tiering lets several components coexist in a level, which means less write amplification and higher read cost (*read*) · covers our angle: **partial — no choose-by-workload guidance** · fetched 2026-10-14
- **Beyond the docs:** [B-Tree vs LSM-Tree](https://tikv.org/deep-dive/key-value-engine/b-tree-vs-lsm/) · TiKV deep dive · compares the two structures on write, read and space amplification, with worked ratios · fetched 2026-10-14 (*read*)
- **Our delta:** choosing between the engines from the read/write mix, with named examples (PostgreSQL and MySQL use B-trees, Cassandra and RocksDB use LSM trees). We frame it as a decision, not a product comparison. The RocksDB wiki returned 403 to the fetcher, so it is not linked.

### T04-02 · The write-ahead log and durability — Master · 🔲 not written
- **Read this:** [Write-Ahead Logging (WAL)](https://www.postgresql.org/docs/current/wal-intro.html) · PostgreSQL docs · data pages are changed only after their WAL records are flushed to permanent storage. After a crash the server rolls forward (REDO) from the log, so data pages need not be flushed on every commit (*read*) · covers our angle: **full** · fetched 2026-10-14
- **Also good:** [Reliability](https://www.postgresql.org/docs/current/wal-reliability.html) · PostgreSQL docs · the operating-system cache, controller caches and drive write caches all sit between the WAL and the platter. `wal_sync_method` sets how PostgreSQL forces the writes through (*read*) · covers our angle: **partial — hardware focus** · fetched 2026-10-14
- **Also good:** [Asynchronous Commit](https://www.postgresql.org/docs/current/wal-async-commit.html) · PostgreSQL docs · `synchronous_commit` trades durability certainty for commit speed, per transaction, and risks data loss but not corruption. The page contrasts it with `commit_delay`, which delays the flush so that one flush can serve several committing transactions (group commit) (*read*) · covers our angle: **partial** · fetched 2026-10-14
- **Beyond the docs:** [PostgreSQL's fsync() surprise](https://lwn.net/Articles/752063/) · LWN.net, 2018-04-18 · how the kernel's handling of I/O errors could lose data even after `fsync()` reported success · fetched 2026-10-14 (*read*)
- **Our delta:** what "committed" promises and to whom, plus the crash that lands between the log and the data file and why the log wins. The docs state the mechanism; we add the interview framing.

### T04-03 · Index design from access patterns — Master · 🔲 not written
- **Read this:** [Multicolumn Indexes](https://www.postgresql.org/docs/current/indexes-multicolumn.html) · PostgreSQL docs · a B-tree multicolumn index is most efficient with constraints on the leading (leftmost) columns: equality on the leading columns plus an inequality on the first column that has no equality constraint (*read*) · covers our angle: **partial — no choose-by-pattern procedure** · fetched 2026-10-14
- **Also good:** [Partial Indexes](https://www.postgresql.org/docs/current/indexes-partial.html) · PostgreSQL docs · an index over the subset of rows that a predicate defines (*read*) · covers our angle: **partial** · fetched 2026-10-14
- **Also good:** [Index-Only Scans and Covering Indexes](https://www.postgresql.org/docs/current/indexes-index-only-scans.html) · PostgreSQL docs · an `INCLUDE` clause adds payload columns that are not part of the search key. An index-only scan still checks the visibility map for each heap page (*read*) · covers our angle: **partial** · fetched 2026-10-14
- **Beyond the docs:** [The right column order in multi-column indexes](https://use-the-index-luke.com/sql/where-clause/the-equals-operator/concatenated-keys) · Use The Index, Luke · the database cannot use single columns of a concatenated index arbitrarily, so column order follows the queries · fetched 2026-10-14 (*read*)
- **Our delta:** deriving the index from the access pattern, the index that made every write slower, and reading the plan before adding another index. The mechanics stay in the PostgreSQL track.

### T04-04 · Choosing the store from the access pattern — Master · 🔲 not written
- **Read this:** [Choose Boring Technology](https://mcfunley.com/choose-boring-technology) · Dan McKinley · every company gets about three innovation tokens, and a new datastore spends one · fetched 2026-10-14 (*read*) · covers our angle: **partial — argues for a default but has no pattern-to-store table**
- **Also good:** [NoSQL](https://en.wikipedia.org/wiki/NoSQL) · Wikipedia · the types table names the families (key-value, document, graph, wide-column) with example products, plus sections on handling relational data in NoSQL (*read*) · covers our angle: **partial** · fetched 2026-10-14
- **Also good:** [Polyglot Persistence](https://martinfowler.com/bliki/PolyglotPersistence.html) · Martin Fowler, 2011-11-16 · ask first how the data will be manipulated and only then which store fits; every extra store costs complexity (*read*) · covers our angle: **partial** · fetched 2026-10-14
- **Beyond the docs:** [Just Use Postgres for Everything](https://www.amazingcto.com/postgres-for-everything/) · Amazing CTO, updated 2025-12-13 · PostgreSQL in place of a cache (UNLOGGED tables), a queue (`SKIP LOCKED`), a document store (`JSONB`), search and vectors · fetched 2026-10-14 (*read*)
- **Our delta:** the "this pattern → this store" table, and why "PostgreSQL until proven otherwise" is a senior answer.

### T04-05 · Transactions and isolation levels — Master · 🔲 not written
- **Read this:** [Transaction Isolation](https://www.postgresql.org/docs/current/transaction-iso.html) · PostgreSQL docs · defines dirty read, nonrepeatable read, phantom read and serialization anomaly against the four levels, and what PostgreSQL does at each. The page does not name lost update or write skew (*read*) · covers our angle: **partial — no lost-update or write-skew storefront example** · fetched 2026-10-14
- **Also good:** [Introduction (MVCC)](https://www.postgresql.org/docs/current/mvcc-intro.html) · PostgreSQL docs · locks taken for reading do not conflict with locks taken for writing, so reading never blocks writing and writing never blocks reading (*read*) · covers our angle: **full on MVCC** · fetched 2026-10-14
- **Also good:** [Explicit Locking](https://www.postgresql.org/docs/current/explicit-locking.html) · PostgreSQL docs · `SELECT` with `FOR UPDATE`, `FOR NO KEY UPDATE`, `FOR SHARE` or `FOR KEY SHARE` takes row-level locks (*read*) · covers our angle: **partial** · fetched 2026-10-14
- **Also good:** [Consistency Models](https://jepsen.io/consistency) · Jepsen · reference guide to consistency models, the phenomena that define them and the dependency graphs behind them (*read*) · covers our angle: **partial — formal, not applied** · fetched 2026-10-14
- **Beyond the docs:** [Hermitage](https://github.com/ept/hermitage) · Martin Kleppmann · hand-run tests of what each database's isolation levels actually prevent. Its table shows PostgreSQL repeatable read preventing lost update but not write skew; only serializable prevents write skew · fetched 2026-10-14 (*read*)
- **Our delta:** the anomaly each level permits, tied to the storefront's stock row and `SELECT … FOR UPDATE`.

### T04-06 · Constraints as the last line of defence — Master · 🔲 not written
- **Read this:** [Constraints](https://www.postgresql.org/docs/current/ddl-constraints.html) · PostgreSQL docs · check, not-null, unique, primary-key, foreign-key and exclusion constraints, with their semantics (*read*) · covers our angle: **partial — no incident framing** · fetched 2026-10-14
- **Beyond the docs:** [Feral Concurrency Control](https://www.bailis.org/papers/feral-sigmod2015.pdf) · Bailis et al., SIGMOD 2015 · Rails applications enforce uniqueness and referential integrity with application-level validations rather than with the database, and some of those validations let corrupt data in under concurrency · fetched 2026-10-14 (*read*)
- **Our delta:** the double booking a unique index prevented at 2 a.m. We treat constraints as a backstop for application bugs rather than as a modelling feature.

### T04-07 · Replication topologies — Master · 🔲 not written
- **Read this:** [High Availability, Load Balancing, and Replication](https://www.postgresql.org/docs/current/high-availability.html) · PostgreSQL docs · servers working together so that a second one takes over quickly if the primary fails, or several serve the same data. The chapter covers the solution families (*read*) · covers our angle: **partial** · fetched 2026-10-14
- **Also good:** [Comparison of Different Solutions](https://www.postgresql.org/docs/current/different-replication-solutions.html) · PostgreSQL docs · a standby can be made the new primary quickly, and replication can be synchronous or asynchronous (*read*) · covers our angle: **partial — leader-follower only** · fetched 2026-10-14
- **Also good:** [Log-Shipping Standby Servers](https://www.postgresql.org/docs/current/warm-standby.html) · PostgreSQL docs · log shipping is asynchronous, which leaves a window for data loss. The page also covers streaming, cascading and synchronous replication; cascading replication is currently asynchronous (*read*) · covers our angle: **partial** · fetched 2026-10-14
- **Our delta:** leader-follower, multi-leader and leaderless side by side, with each one's failover risk and per-write cost.

### T04-08 · Replication lag and read-your-writes — Master · 🔲 not written
- **Read this:** [Hot Standby](https://www.postgresql.org/docs/current/hot-standby.html) · PostgreSQL docs · data takes a measurable time to reach the standby, so the same query can return different results on the primary and the standby. `max_standby_streaming_delay` decides when conflicting standby queries are cancelled (*read*) · covers our angle: **partial — mechanics, no routing patterns** · fetched 2026-10-14
- **Also good:** [Read Your Writes](https://jepsen.io/consistency/models/read-your-writes) · Jepsen · a read by a process must observe that same process's earlier writes. Other processes get no such guarantee (*read*) · covers our angle: **partial** · fetched 2026-10-14
- **Also good:** [Monotonic Reads](https://jepsen.io/consistency/models/monotonic-reads) · Jepsen · within one process, reads cannot go backwards (*read*) · covers our angle: **partial** · fetched 2026-10-14
- **Beyond the docs:** [Eventually Consistent - Revisited](https://www.allthingsdistributed.com/2008/12/eventually_consistent.html) · Werner Vogels, 2008-12-23 · read-your-writes, session and monotonic-read consistency as client-side guarantees on top of eventual consistency · fetched 2026-10-14 (*read*)
- **Our delta:** the customer who cannot see the order they just placed, the routing fixes, and admitting the lag window in the design.

### T04-09 · Connection pooling at scale — Master · 🔲 not written
- **Read this:** [Features](https://www.pgbouncer.org/features.html) · PgBouncer docs · session pooling supports all PostgreSQL features. Transaction pooling assigns a server connection only for the length of a transaction, and the page's table lists the features it breaks (for example `PREPARE`/`DEALLOCATE` and `WITH HOLD` cursors). Statement pooling disallows multi-statement transactions (*read*) · covers our angle: **partial — no pods-times-pool arithmetic** · fetched 2026-10-14
- **Also good:** [Configuration](https://www.pgbouncer.org/config.html) · PgBouncer docs · `pool_mode` (session is the default, then transaction and statement), and `default_pool_size` per user/database pair (*read*) · covers our angle: **partial** · fetched 2026-10-14
- **Also good:** [Number Of Database Connections](https://wiki.postgresql.org/wiki/Number_Of_Database_Connections) · PostgreSQL wiki · for best throughput, active connections should be near `(core_count * 2) + effective_spindle_count`, so size the pool from the database's side (*read*) · covers our angle: **partial** · fetched 2026-10-14
- **Beyond the docs:** [About Pool Sizing](https://github.com/brettwooldridge/HikariCP/wiki/About-Pool-Sizing) · HikariCP wiki · why a small pool beats a large one, with the same formula as a starting point for testing · fetched 2026-10-14 (*read*)
- **Our delta:** pool-per-pod times pods against the server's limit, and what breaks in transaction mode.

### T04-10 · Schema design at scale — Understand · 🔲 not written
- **Read this:** [JSON Types](https://www.postgresql.org/docs/current/datatype-json.html) · PostgreSQL docs · `jsonb`, with sections on designing JSON documents, containment and indexing (*headings only*) · covers our angle: **partial — the types, not when to use them** · fetched 2026-10-14
- **Our delta:** normalisation against deliberate denormalisation, with strict orders and flexible catalogue attributes.

### T04-11 · Failover — Understand · 🔲 not written
- **Read this:** [Failover](https://www.postgresql.org/docs/current/warm-standby-failover.html) · PostgreSQL docs · `pg_ctl promote` or `pg_promote()` triggers failover. The old primary must be told it is no longer primary (STONITH), but PostgreSQL leaves that mechanism to you (*read*) · covers our angle: **partial** · fetched 2026-10-14
- **Also good:** [Configuring and managing a Multi-AZ deployment](https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/Concepts.MultiAZ.html) · AWS docs · a Multi-AZ DB instance has one standby for failover that does not serve reads; a Multi-AZ DB cluster has two standbys that can also serve reads (*read*) · covers our angle: **partial — the managed-service side** · fetched 2026-10-14
- **Beyond the docs:** [October 21 post-incident analysis](https://github.blog/news-insights/company-news/oct21-post-incident-analysis/) · GitHub, 2018-10-30 · a cross-coast failover by Orchestrator left both data centres holding writes the other lacked, which caused 24 hours of degraded service · fetched 2026-10-14 (*read*)
- **Beyond the docs:** [How to do distributed locking](https://martin.kleppmann.com/2016/02/08/how-to-do-distributed-locking.html) · Martin Kleppmann, 2016 · the fencing token is a number that increases with every lock grant and travels with each write, so the storage rejects writes from a stale holder. The same idea fences an old primary · fetched 2026-10-14 (*read*)
- **Our delta:** automatic against manual promotion, split brain, and the writes that asynchronous replication loses.

### T04-12 · Quorum reads and writes — Understand · 🔲 not written
- **Read this:** [Dynamo](https://cassandra.apache.org/doc/latest/cassandra/architecture/dynamo.html) · Apache Cassandra docs · consistency levels (ONE, QUORUM, ALL and others) are Cassandra's version of Dynamo's `R + W > N`; choose `W + R > RF` so that replica sets overlap. Read repair and hinted handoff are best-effort, and anti-entropy repair with Merkle trees provides the guarantee (*read*) · covers our angle: **partial — no sloppy quorum** · fetched 2026-10-14
- **Also good:** [Dynamo: Amazon's Highly Available Key-value Store](https://www.allthingsdistributed.com/files/amazon-dynamo-sosp2007.pdf) · DeCandia et al., SOSP 2007 · `R + W > N` gives a quorum-like system. A sloppy quorum uses the first N healthy nodes on the ring, and hinted handoff covers a node that is down (*read*) · covers our angle: **full on the model** · fetched 2026-10-14
- **Beyond the docs:** [Eventually Consistent - Revisited](https://www.allthingsdistributed.com/2008/12/eventually_consistent.html) · Werner Vogels, 2008-12-23 · N, W and R, with `W+R > N` as the condition for strong consistency, worked through for primary-backup setups · fetched 2026-10-14 (*read*)
- **Our delta:** N, R and W with sloppy quorums, and the Dynamo lineage of Cassandra and similar stores.

### T04-13 · Buffer pools and the working set — Understand · 🔲 not written
- **Read this:** [Resource Consumption](https://www.postgresql.org/docs/current/runtime-config-resource.html) · PostgreSQL docs · `shared_buffers` sets the memory for shared buffers; the default is typically 128MB (*read*) · covers our angle: **partial** · fetched 2026-10-14
- **Also good:** [pg_prewarm](https://www.postgresql.org/docs/current/pgprewarm.html) · PostgreSQL docs · loads relation data into the OS or PostgreSQL buffer cache, by hand or automatically through the autoprewarm worker. This is the cure for a cold cache (*read*) · covers our angle: **partial** · fetched 2026-10-14
- **Our delta:** memory as the real size of the database, and the cold cache after a failover.

### T04-14 · Large objects and files — Understand · 🔲 not written
- **Read this:** [Download and upload objects with presigned URLs](https://docs.aws.amazon.com/AmazonS3/latest/userguide/using-presigned-url.html) · AWS docs · a presigned URL grants time-limited access, so another party can upload without AWS credentials. The URL can be reused until it expires (*read*) · covers our angle: **partial** · fetched 2026-10-14
- **Also good:** [TOAST](https://www.postgresql.org/docs/current/storage-toast.html) · PostgreSQL docs · when a row is wider than about 2 kB, PostgreSQL compresses field values and/or moves them out of line (*read*) · covers our angle: **partial** · fetched 2026-10-14
- **Our delta:** never in the row: object storage plus a reference, and the review image that would have bloated every backup.

### T04-15 · Storage in the storefront — Understand · 🔲 not written
- **Read this:** [Redis data types](https://redis.io/docs/latest/develop/data-types/) · Redis docs · strings, hashes (records of field-value pairs), lists, sets, sorted sets and others. Fitting them to sessions and carts is our inference (*read*) · covers our angle: **partial** · fetched 2026-10-14
- **Also good:** [Polyglot Persistence](https://martinfowler.com/bliki/PolyglotPersistence.html) · Martin Fowler, 2011-11-16 · one application, several stores, each chosen by how its data is manipulated. Fowler says his diagram is not a recommendation of which store to use for what (*read*) · covers our angle: **partial** · fetched 2026-10-14
- **Our delta:** our own worked case: orders and inventory in PostgreSQL, sessions and carts in Redis, search in a search engine, images in object storage, with one sentence of reason each.

### T04-16 · Where NoSQL genuinely wins — Know · 🔲 not written
- **Read this:** [NoSQL](https://en.wikipedia.org/wiki/NoSQL) · Wikipedia · the families (key-value, document, graph, wide-column) with example products, and the trade-offs in handling relational data (*read*) · covers our angle: **partial — no where-it-wins analysis** · fetched 2026-10-14
- **Also good:** [Choose Boring Technology](https://mcfunley.com/choose-boring-technology) · Dan McKinley · the argument for defaulting to the familiar (*read*) · fetched 2026-10-14
- **Beyond the docs:** [How Discord stores trillions of messages](https://discord.com/blog/how-discord-stores-trillions-of-messages) · Discord, 2023-03-06 · a write-heavy message store that moved from MongoDB to Cassandra and then to ScyllaDB, and the hot partitions along the way · fetched 2026-10-14 (*read*)
- **Our delta:** where each NoSQL family genuinely wins, and the story of rebuilding on PostgreSQL. The Uber write-up returned 406 to the fetcher, so it is not linked.

### T04-17 · Engine internals worth knowing — Know · 🔲 not written
- **Read this:** [Database Page Layout](https://www.postgresql.org/docs/current/storage-page-layout.html) · PostgreSQL docs · tables and indexes are arrays of fixed-size pages (usually 8 kB) holding item pointers and tuples, with the tuple header layout (*read*) · covers our angle: **partial** · fetched 2026-10-14
- **Also good:** [Routine Vacuuming](https://www.postgresql.org/docs/current/routine-vacuuming.html) · PostgreSQL docs · VACUUM removes dead row versions and marks the space reusable, but does not normally return it to the operating system (*read*) · covers our angle: **partial** · fetched 2026-10-14
- **Also good:** [Heap-Only Tuples (HOT)](https://www.postgresql.org/docs/current/storage-hot.html) · PostgreSQL docs · an update that changes no indexed column needs no new index entries. Lowering a table's fillfactor makes HOT updates more likely (*read*) · covers our angle: **partial** · fetched 2026-10-14
- **Beyond the docs:** [The Part of PostgreSQL We Hate the Most](https://www.cs.cmu.edu/~pavlo/blog/2023/04/the-part-of-postgresql-we-hate-the-most.html) · Andy Pavlo, 2023-04-26 · PostgreSQL's MVCC copies the whole row on every update, which causes bloat, index maintenance and vacuum pressure · fetched 2026-10-14 (*read*)
- **Our delta:** what makes an `UPDATE` expensive and a hot row hotter, with fill factor.


## Phase 5 — Partitioning, sharding and the data estate

### T05-01 · Horizontal sharding — Master · 🔲 not written
- **Read this:** [Sharding](https://www.mongodb.com/docs/manual/sharding/) · MongoDB docs · horizontal scaling splits the dataset and the load over more servers at the cost of more complexity in infrastructure and maintenance. MongoDB shards at the collection level, using a shard key (*read*) · covers our angle: **partial — no statement of the price paid** · fetched 2026-10-14
- **Also good:** [Table Partitioning](https://www.postgresql.org/docs/current/ddl-partitioning.html) · PostgreSQL docs · range, list and hash partitioning, all within one server (*read*) · covers our angle: **partial — one node, not sharding** · fetched 2026-10-14
- **Beyond the docs:** [How Figma's databases team lived to tell the scale](https://www.figma.com/blog/how-figmas-databases-team-lived-to-tell-the-scale/) · Figma engineering · horizontally sharding a Postgres stack after vertical partitioning bought them runway. Sharding the first table took roughly nine months · fetched 2026-10-14 (*read*)
- **Our delta:** the price signed for on day one: no cross-shard joins or transactions, and operational weight forever.

### T05-02 · Choosing the shard key — Master · 🔲 not written
- **Read this:** [Choose a Shard Key](https://www.mongodb.com/docs/manual/core/sharding-choose-a-shard-key/) · MongoDB docs · judge a key by its cardinality, by how often each value occurs, and by whether it grows monotonically. Cardinality caps the number of chunks (*read*) · covers our angle: **partial** · fetched 2026-10-14
- **Also good:** [Hashed Sharding](https://www.mongodb.com/docs/manual/core/hashed-sharding/) · MongoDB docs · hashing spreads data more evenly, but range queries then become broadcast operations; equality matches still hit one shard (*read*) · covers our angle: **partial** · fetched 2026-10-14
- **Also good:** [Ranged Sharding](https://www.mongodb.com/docs/manual/core/ranged-sharding/) · MongoDB docs · close key values land in the same chunk, which makes range reads efficient; this is the default method (*read*) · covers our angle: **partial** · fetched 2026-10-14
- **Also good:** [Choosing Distribution Column](https://docs.citusdata.com/en/stable/sharding/data_modeling.html) · Citus docs · distribute by tenant id for multi-tenant apps so that one tenant's queries go to one node (co-location), with separate advice for real-time and time-series workloads (*read*) · covers our angle: **partial** · fetched 2026-10-14
- **Beyond the docs:** [Herding elephants: Lessons learned from sharding Postgres at Notion](https://www.notion.com/blog/sharding-postgres-at-notion) · Notion, 2021-10-06 · partitioned by workspace ID because every block belongs to exactly one workspace · fetched 2026-10-14 (*read*)
- **Our delta:** hotspot and celebrity analysis, and the key you cannot change later without a migration.

### T05-03 · Rebalancing and resharding — Master · 🔲 not written
- **Read this:** [Resharding](https://vitess.io/docs/24.0/user-guides/configuration-advanced/resharding/) · Vitess docs · an online reshard splits a shard into smaller ones, and VDiff checks that source and target match. Replica and rdonly reads switch first, then writes and primary reads (*read*) · covers our angle: **partial** · fetched 2026-10-14
- **Also good:** [Consistent hashing](https://en.wikipedia.org/wiki/Consistent_hashing) · Wikipedia · virtual nodes are several labels pointing to one real server, which balances the ring (*read*) · covers our angle: **partial** · fetched 2026-10-14
- **Beyond the docs:** [Herding elephants: Lessons learned from sharding Postgres at Notion](https://www.notion.com/blog/sharding-postgres-at-notion) · Notion, 2021-10-06 · 480 logical shards over 32 physical databases, a count chosen so the shards divide evenly as hosts are added · fetched 2026-10-14 (*read*)
- **Beyond the docs:** [How Figma's databases team lived to tell the scale](https://www.figma.com/blog/how-figmas-databases-team-lived-to-tell-the-scale/) · Figma engineering · logical sharding at the application layer kept separate from physical sharding in Postgres · fetched 2026-10-14 (*read*)
- **Our delta:** a fixed number of logical partitions over a growing number of nodes, and the dual-write plus backfill procedure.

### T05-04 · Cross-shard queries and transactions — Master · 🔲 not written
- **Read this:** [Vindexes](https://vitess.io/docs/24.0/reference/features/vindexes/) · Vitess docs · a vindex maps column values to shards. Secondary vindexes let VTGate target only the relevant shards, and without one it scatters the query to all shards. Lookup vindexes are cross-shard indexes (*read*) · covers our angle: **partial** · fetched 2026-10-14
- **Also good:** [VTGate](https://vitess.io/docs/24.0/concepts/vtgate/) · Vitess docs · a lightweight proxy that routes queries to the right tablets and consolidates the results (*read*) · covers our angle: **partial** · fetched 2026-10-14
- **Our delta:** scatter-gather, global secondary indexes and denormalised lookups, plus what replaces cross-shard transactions (Part 4).

### T05-05 · Object storage — Master · 🔲 not written
- **Read this:** [What is Amazon S3?](https://docs.aws.amazon.com/AmazonS3/latest/userguide/Welcome.html) · AWS docs · buckets and objects, the features, how S3 works, and the data consistency model (*read*) · covers our angle: **partial** · fetched 2026-10-14
- **Also good:** [Amazon S3 Strong Consistency](https://aws.amazon.com/s3/consistency/) · AWS · after a successful write, overwrite or delete, any later read returns the latest version, and list operations are strongly consistent too (*read*) · covers our angle: **partial** · fetched 2026-10-14
- **Also good:** [Versioning](https://docs.aws.amazon.com/AmazonS3/latest/userguide/Versioning.html) · AWS docs · a delete inserts a delete marker, and an overwrite creates a new version (*read*) · covers our angle: **partial** · fetched 2026-10-14
- **Also good:** [Multipart upload](https://docs.aws.amazon.com/AmazonS3/latest/userguide/mpuoverview.html) · AWS docs · parts upload independently and a failed part can be retransmitted alone; the page recommends multipart for objects of 100 MB or more (*read*) · covers our angle: **partial** · fetched 2026-10-14
- **Also good:** [Lifecycle](https://docs.aws.amazon.com/AmazonS3/latest/userguide/object-lifecycle-mgmt.html) · AWS docs · transition actions move objects to cheaper storage classes, and expiration actions delete them (*read*) · covers our angle: **partial** · fetched 2026-10-14
- **Our delta:** the storefront's images and invoices, presigned uploads straight from the browser, and egress cost.

### T05-06 · OLTP vs OLAP — Master · 🔲 not written
- **Read this:** [Online analytical processing](https://en.wikipedia.org/wiki/Online_analytical_processing) · Wikipedia · OLAP is optimised mostly for reads, while OLTP has to handle every kind of query. A database designed for OLTP does not work well for ROLAP, so the analytics copy is extra (*read*) · covers our angle: **partial** · fetched 2026-10-14
- **Also good:** [What is ClickHouse?](https://clickhouse.com/docs/get-started/about/intro) · ClickHouse docs · a column-oriented SQL database for OLAP (*read*) · covers our angle: **partial** · fetched 2026-10-14
- **Also good:** [Debezium Architecture](https://debezium.io/documentation/reference/stable/architecture.html) · Debezium docs · the PostgreSQL connector reads the logical replication stream into Kafka, and sink connectors feed Elasticsearch, warehouses and caches (*read*) · covers our angle: **partial** · fetched 2026-10-14
- **Our delta:** why analytics on the primary kills checkout, and a read replica against a warehouse against a columnar store.

### T05-07 · Search engines — Master · 🔲 not written
- **Read this:** [Text analysis](https://www.elastic.co/docs/manage-data/data-store/text-analysis) · Elastic docs · analysis makes full-text search possible by tokenizing text into tokens (*read*) · covers our angle: **partial** · fetched 2026-10-14
- **Also good:** [Introduction (full text search)](https://www.postgresql.org/docs/current/textsearch-intro.html) · PostgreSQL docs · plain text operators offer no ranking. PostgreSQL normalises tokens into lexemes and stores preprocessed documents (`tsvector`) for search and ranking (*read*) · covers our angle: **partial — the when-it-is-enough side** · fetched 2026-10-14
- **Beyond the docs:** [Elasticsearch from the bottom up](https://www.elastic.co/blog/found-elasticsearch-from-the-bottom-up) · Elastic blog · starts from the inverted index and builds up to how Lucene and Elasticsearch work · fetched 2026-10-14 (*read*)
- **Our delta:** keeping the index in sync with PostgreSQL through CDC, and when `tsvector` is already enough.

### T05-08 · Backups, point-in-time recovery and restore drills — Master · 🔲 not written
- **Read this:** [Continuous Archiving and Point-in-Time Recovery](https://www.postgresql.org/docs/current/continuous-archiving.html) · PostgreSQL docs · a base backup plus archived WAL. Replay can stop at any point, which gives point-in-time recovery (*read*) · covers our angle: **partial — procedure, no drills** · fetched 2026-10-14
- **Also good:** [Backup and Restore](https://www.postgresql.org/docs/current/backup.html) · PostgreSQL docs · SQL dump, file-system-level backup and continuous archiving (*read*) · covers our angle: **partial** · fetched 2026-10-14
- **Beyond the docs:** [Postmortem of database outage of January 31](https://about.gitlab.com/blog/postmortem-of-database-outage-of-january-31/) · GitLab, 2017-02-10 · after an accidental deletion on the primary, the `pg_dump` backups to S3 turned out never to have been written · fetched 2026-10-14 (*read*)
- **Our delta:** recovery objectives as backup requirements, and the restore nobody tested.

### T05-09 · Schema migrations at scale — Master · 🔲 not written
- **Read this:** [Parallel Change](https://martinfowler.com/bliki/ParallelChange.html) · Martin Fowler · expand and contract: make a backward-incompatible change safely in three phases (expand, migrate, contract) (*read*) · covers our angle: **partial — interfaces, not databases** · fetched 2026-10-14
- **Also good:** [ALTER TABLE](https://www.postgresql.org/docs/current/sql-altertable.html) · PostgreSQL docs · takes an ACCESS EXCLUSIVE lock unless noted otherwise. Adding a column with a non-volatile default avoids a table rewrite; a volatile default forces one (*read*) · covers our angle: **partial** · fetched 2026-10-14
- **Beyond the docs:** [Online migrations at scale](https://stripe.com/blog/online-migrations) · Stripe · four phases: dual-write, move reads, move writes, remove the old data · fetched 2026-10-14 (*read*)
- **Our delta:** online DDL, batched backfills, and the lock that took the site down for a column rename.

### T05-10 · Vertical partitioning first — Understand · 🔲 not written
- **Read this:** [Partition (database)](https://en.wikipedia.org/wiki/Partition_(database)) · Wikipedia · horizontal partitioning splits rows. Here vertical partitioning means splitting columns into narrower tables, not moving tables to separate databases (*read*) · covers our angle: **partial — the column sense, not the by-table and by-service sense** · fetched 2026-10-14
- **Also good:** [Database per service](https://microservices.io/patterns/data/database-per-service.html) · microservices.io · each service's data is private to it. A query that joins across services becomes a problem, and private tables per service need no separate server (*read*) · covers our angle: **partial** · fetched 2026-10-14
- **Beyond the docs:** [How Figma's databases team lived to tell the scale](https://www.figma.com/blog/how-figmas-databases-team-lived-to-tell-the-scale/) · Figma engineering · vertical partitioning (groups of tables moved to their own databases) bought significant runway quickly and was a stepping stone to sharding · fetched 2026-10-14 (*read*)
- **Our delta:** splitting by table and by service before splitting rows, as the cheaper move.

### T05-11 · Sharding middleware vs application sharding — Understand · 🔲 not written
- **Read this:** [VTGate](https://vitess.io/docs/24.0/concepts/vtgate/) · Vitess docs · a lightweight proxy that speaks the MySQL protocol, routes each query to the right shard and consolidates the results, so the application sees one database (*read*) · covers our angle: **partial** · fetched 2026-10-14
- **Also good:** [Choosing Distribution Column](https://docs.citusdata.com/en/stable/sharding/data_modeling.html) · Citus docs · sharding inside PostgreSQL: Citus inspects each query for the tenant id and routes it to the worker that holds that shard (*read*) · covers our angle: **partial** · fetched 2026-10-14
- **Also good:** [Architecture](https://vitess.io/docs/24.0/overview/architecture/) · Vitess docs · short overview of the components, with a diagram (*headings only*) · covers our angle: **partial** · fetched 2026-10-14
- **Our delta:** proxy routers against routing in the application, and the ORM that does not know the data is sharded.

### T05-12 · Multi-tenancy models — Understand · 🔲 not written
- **Read this:** [Architectural approaches for storage and data in multitenant solutions](https://learn.microsoft.com/en-us/azure/architecture/guide/multitenant/approaches/storage-data) · Microsoft Learn · shared multitenant databases, sharding and a database per tenant, weighed on isolation, the noisy-neighbour problem, deploying schema updates across the estate, and per-tenant restore (*read*) · covers our angle: **partial** · fetched 2026-10-14
- **Our delta:** shared schema, schema per tenant and database per tenant, with noisy neighbours and running a migration across thousands of tenants.

### T05-13 · Data lifecycle — Understand · 🔲 not written
- **Read this:** [Lifecycle](https://docs.aws.amazon.com/AmazonS3/latest/userguide/object-lifecycle-mgmt.html) · AWS docs · lifecycle rules move objects to cheaper storage classes or expire them (*read*) · covers our angle: **partial — storage tiers only** · fetched 2026-10-14
- **Also good:** [Art. 17 GDPR](https://gdpr-info.eu/art-17-gdpr/) · gdpr-info.eu · the data subject may obtain erasure without undue delay (*read*) · covers our angle: **partial — the legal text only** · fetched 2026-10-14
- **Our delta:** erasure that must reach every shard, backup and search index.

### T05-14 · The storefront's data estate — Understand · 🔲 not written
- **Read this:** [Debezium Architecture](https://debezium.io/documentation/reference/stable/architecture.html) · Debezium docs · the change-capture path. Connectors read the binlog or logical replication stream into Kafka topics, one topic per table, and sinks feed search, warehouses and caches (*read*) · covers our angle: **partial** · fetched 2026-10-14
- **Our delta:** one diagram with every arrow labelled with its sync mechanism and its lag.

### T05-15 · Time-series and metrics stores — Know · 🔲 not written
- **Read this:** [Storage](https://prometheus.io/docs/prometheus/latest/storage/) · Prometheus docs · samples are grouped into two-hour blocks on local disk, each with chunks, metadata and an index (*read*) · covers our angle: **partial** · fetched 2026-10-14
- **Our delta:** append-only writes, downsampling and retention, and why metrics stay out of the orders database.

### T05-16 · Data lakes, warehouses and the lakehouse idea — Know · 🔲 not written
- **Read this:** [Apache Iceberg documentation](https://iceberg.apache.org/docs/latest/) · Apache Iceberg · an open table format for huge analytic datasets: schema evolution, hidden partitioning, time travel and serializable isolation, designed for eventually consistent object stores (*read*) · covers our angle: **partial** · fetched 2026-10-14
- **Also good:** [Parquet overview](https://parquet.apache.org/docs/overview/) · Apache Parquet · an open-source, column-oriented file format with compression and encoding schemes (*read*) · covers our angle: **partial** · fetched 2026-10-14
- **Beyond the docs:** [Lakehouse: A New Generation of Open Platforms](https://www.cidrdb.org/cidr2021/papers/cidr2021_paper17.pdf) · Armbrust et al. (Databricks), CIDR 2021 · argues that the warehouse will give way to a Lakehouse built on open direct-access formats such as Parquet · fetched 2026-10-14 (*read*)
- **Our delta:** where the clickstream goes and who reads it.

### T05-17 · Global data — Know · 🔲 not written
- **Read this:** [Multi-Region Capabilities Overview](https://docs.cockroachlabs.com/docs/stable/multiregion-overview) · CockroachDB docs · database regions, survival goals and table localities (global, regional by table, regional by row); super regions provide data domiciling (*read*) · covers our angle: **partial** · fetched 2026-10-14
- **Also good:** [Art. 44 GDPR](https://gdpr-info.eu/art-44-gdpr/) · gdpr-info.eu · a transfer of personal data to a third country may happen only under the conditions of Chapter V (*read*) · covers our angle: **partial** · fetched 2026-10-14
- **Beyond the docs:** [Spanner: Google's Globally-Distributed Database](https://research.google/pubs/spanner-googles-globally-distributed-database-2/) · Corbett et al., OSDI 2012 · a synchronously replicated global database with externally consistent distributed transactions, built on a time API that exposes clock uncertainty (abstract read) · fetched 2026-10-14 (*read*)
- **Our delta:** residency, multi-region reads and geo-partitioning. The compliance angle continues in Part 9 (not written yet).
