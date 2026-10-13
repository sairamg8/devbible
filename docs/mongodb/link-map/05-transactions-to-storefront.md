---
title: "Link map · MongoDB · T59–T82 (phases 10–14)"
sidebar_label: "05 · MongoDB · T59–T82 (phases 10–14)"
sidebar_position: 5
---

# Link map · MongoDB · T59–T82 (phases 10–14)

Last file for MongoDB. Continues [04-indexes-driver-mongoose.md](04-indexes-driver-mongoose.md). **All 24 topics are 🔲 not written** (source banks for future pages).
T59–T64 phase 10, T65–T68 phase 11, T69–T71 phase 12, T72–T76 phase 13, T77–T82 phase 14. Spine: `docs/mongodb/syllabus/03-from-node.md` and `04-production.md`. *read* = I read the passage; *headings only* = fetched, headings/size checked. Manual links carry no `#anchors`.
Node driver base: `https://www.mongodb.com/docs/drivers/node/current/`.

🔴 **Phase 14 is composite by design** (the storefront is our own worked example). No single outside page covers it; each topic lists the Manual pages for its *parts* and says the assembly is ours.

---

## Phase 10 — Transactions, sessions and consistency

### T59 · 🔴 Single-document atomicity covers most cases — Master · 🔲
- **Read this:** [Atomicity and Transactions](https://www.mongodb.com/docs/manual/core/write-operations-atomicity/) · mongodb.com · distributed transactions cost more and "should not be a replacement for effective schema design"; denormalized embedded data stays optimal for many scenarios (*read*; same page as T02) · covers our angle: full · fetched 2026-10-12

### T60 · Multi-document transactions — Master · 🔲
- **Read this:** [Transactions](https://www.mongodb.com/docs/manual/core/transactions/) · mongodb.com · ≈3.9k words; transactions are supported on replica sets and sharded clusters, all-or-nothing, with uncommitted changes invisible outside (*read*) · covers our angle: **partial** — "even for a single node" (a one-member replica set) is not stated on this page (searched it for single node / one-member / standalone: nothing) · fetched 2026-10-12
- **Also good:** [Production Considerations](https://www.mongodb.com/docs/manual/core/transactions-production-consideration/) · mongodb.com · ≈3k words (headings only) · fetched 2026-10-12
- **Also good:** [Why replica set is mandatory for transactions?](https://www.mongodb.com/community/forums/t/why-replica-set-is-mandatory-for-transactions-in-mongodb/9533) · MongoDB Community forum, 2020-09-23, answered by user Pavel_Duchovny (whether he is MongoDB staff is not shown in the extracted text) · transactions rely on logical sessions and oplog mechanics found only in replica sets, and a standalone converted to a single-node replica set will run transactions (*read*) · closes the single-node gap, but it is a forum answer, not Manual text · fetched 2026-10-12
- **Also good:** [Convert a Standalone to a Replica Set](https://www.mongodb.com/docs/manual/tutorial/convert-standalone-to-replica-set/) · mongodb.com · standalone is for testing and development; run `rs.initiate()` once, and the new set has a single member (*read*) · the how-to for the single-node setup · fetched 2026-10-12

### T61 · Sessions — Master · 🔲
- **Read this:** [Server Sessions](https://www.mongodb.com/docs/manual/reference/server-sessions/) · mongodb.com · server (logical) sessions underpin causal consistency and retryable writes; applications use *client* sessions; server sessions exist for replica sets and sharded clusters only (*read*) · covers our angle: **partial** — "thread the session through every operation" is a driver matter, see T62 · fetched 2026-10-12

### T62 · `withTransaction` — Master · 🔲
- **Read this (1/2):** [Transactions — Node.js driver](https://www.mongodb.com/docs/drivers/node/current/crud/transactions/) · mongodb.com · `withTransaction()` runs your callback in a transaction and commits when it returns; the Convenient API retries on certain error types (*read*) · covers our angle: full for Node · fetched 2026-10-12
- **Read this (2/2):** [Handle Transactions in Applications with the Drivers API](https://www.mongodb.com/docs/manual/core/transactions-in-applications/) · mongodb.com · Callback API vs Core API: the callback API handles `TransientTransactionError` and `UnknownTransactionCommitResult` for you; the Core API does not (*read*) · covers our angle: full for "why hand-rolled is usually wrong" · fetched 2026-10-12

### T63 · 🔴 `TransientTransactionError` and retries — Master · 🔲
- **Read this:** [Handle Transactions in Applications with the Drivers API](https://www.mongodb.com/docs/manual/core/transactions-in-applications/) · see T62 (*read*) · covers our angle: **partial** — I read that the Core API does not handle either error and the callback API retries the whole transaction on `TransientTransactionError` and the commit alone on `UnknownTransactionCommitResult`; a worked Core API retry loop was not read · fetched 2026-10-12
- **Also good:** [Transactions — Node.js driver → Transaction Errors](https://www.mongodb.com/docs/drivers/node/current/crud/transactions/) · the driver's own section: if these occur your application must retry the transaction — `TransientTransactionError` (a write error before commit) and `UnknownTransactionCommitResult` (an error during commit); the Convenient API has retry logic built in (*read*) · covers the Node angle · fetched 2026-10-12

### T64 · Write concern — Master · 🔲
- **Read this:** [Write Concern](https://www.mongodb.com/docs/manual/reference/write-concern/) · mongodb.com · ≈4.3k words; `{ w, j, wtimeout }` defined (*read*), and the global default write concern is `majority` (*read*) · covers our angle: full · fetched 2026-10-12
- **Also good:** [Read Concern](https://www.mongodb.com/docs/manual/reference/read-concern/) · mongodb.com · the matching read side; `local` is the default level for reads on primary and secondaries, `majority` returns data acknowledged by a majority (*read*) · fetched 2026-10-12

## Phase 11 — Replication, sharding and the cluster

### T65 · 🔴 Replica sets — Master · 🔲
- **Read this:** [Replication](https://www.mongodb.com/docs/manual/replication/) · mongodb.com · ≈3.3k words; one primary receives all writes, secondaries replicate asynchronously, and transactions are available for replica sets (*read*) · covers our angle: **partial** — the "single-node dev setup" advice is not on this page; see T60's forum and Convert pages · fetched 2026-10-12
- **Also good:** [Replica Set Primary](https://www.mongodb.com/docs/manual/core/replica-set-primary/) · mongodb.com · ≈1.4k words (headings only) · fetched 2026-10-12
- **Also good:** [Change Streams](https://www.mongodb.com/docs/manual/changestreams/) · mongodb.com · change streams are available for replica sets and sharded clusters (*read*) · fetched 2026-10-12
- **Our delta:** why a single-node dev setup should still be a replica set (transactions, change streams); the two requirements are each confirmed above, the single-node conclusion is ours.

### T66 · Elections and failover — Master · 🔲
- **Read this:** [Replica Set Elections](https://www.mongodb.com/docs/manual/core/replica-set-elections/) · mongodb.com · an election triggers on adding a member, `rs.stepDown()`/`rs.reconfig()`, or secondaries losing the primary for longer than the timeout (10 s default); median time to a new primary should not typically exceed 12 s with default settings; tunable via `settings.electionTimeoutMillis` (*read*) · covers our angle: **partial** — in-flight operations are not described on this page · fetched 2026-10-12
- **Also good:** [Retryable Writes](https://www.mongodb.com/docs/manual/core/retryable-writes/) · mongodb.com · by default a write is retried once, which covers transient network errors and elections; drivers wait `serverSelectionTimeoutMS` for a new primary, and the write fails if failover takes longer (*read*) · fills the in-flight gap for writes · fetched 2026-10-12
- **Beyond the docs:** [MongoDB Replica Set Scenarios and Internals, Part II: Elections](https://www.percona.com/blog/mongodb-replica-set-scenarios-and-internals-part-ii-elections/) · Percona blog, published 2019-01-23 · walks an actual `rs.stepDown()` through the server log: the dry-run election, term increment, vote request and new-primary heartbeat, which the Manual page states only as a summary (dated: 2019 log output) · fetched 2026-10-13 (*read*)

### T67 · Reading from secondaries — Master · 🔲
- **Read this:** [Read Preference](https://www.mongodb.com/docs/manual/core/read-preference/) · mongodb.com · every mode except `primary` may return stale data because secondaries replicate asynchronously; your application must tolerate it (*read*) · covers our angle: full · fetched 2026-10-12

### T68 · When you do *not* need sharding — Master · 🔲
- **Read this:** **none found for the "scaling ladder"** — [Sharding](https://www.mongodb.com/docs/manual/sharding/) (≈3.2k words) says the trade-off is increased infrastructure and maintenance complexity (*read*) but does not lay out indexes → schema → vertical → replica set → shard; its Considerations Before Sharding section only says to plan for infrastructure complexity and shard key choice (*read*) · fetched 2026-10-12
- *Checked, not chosen:* Percona's [When to enable MongoDB sharding](https://www.percona.com/blog/when-should-i-enable-mongodb-sharding/) (modified 2026-05-29, ≈4.2k words, headings and vertical-scaling passage read) lists reasons to shard but advises sharding early and does not give the ladder, so it contradicts our framing; other search hits were blogs (dev.to, Studio 3T, slicker.me) not opened.
- **Also good:** [Sharded Cluster Components](https://www.mongodb.com/docs/manual/core/sharded-cluster-components/) · mongodb.com · each shard must itself be a replica set (*read* on Sharding page) · fetched 2026-10-12
- **Our delta:** the ladder.

## Phase 12 — Performance, monitoring and operations

### T69 · 🔴 The slow query log and the profiler — Master · 🔲
- **Read this:** [Database Profiler](https://www.mongodb.com/docs/manual/tutorial/manage-the-database-profiler/) · mongodb.com · levels; level 1 captures operations over `slowms` (or matching a filter, in which case `slowms`/`sampleRate` are ignored); level 2 captures all; profiling has a performance and disk cost (*read*) · covers our angle: full for levels and `slowms` · fetched 2026-10-12
- **Also good:** [Database Profiler Output](https://www.mongodb.com/docs/manual/reference/database-profiler/) · mongodb.com · ≈5k words — the `system.profile` field reference; `system.profile` is a capped collection you query normally (*read*) · fetched 2026-10-12

### T70 · The working set — Master · 🔲
- **Read this:** [Through the Looking Glass: memory, disk and read performance](https://www.mongodb.com/company/blog/through-the-looking-glass-analyzing-the-interplay-between-memory-disk-and-read-performance) · mongodb.com blog · published 2018-07-03, modified 2019-03-11, ≈2.5k words; a YCSB benchmark that varies the working set against disk speed (*read* the intro) · covers our angle: **partial** — and **dated**: MongoDB 3.4/3.6-era synthetic tests · fetched 2026-10-12
- **Also good:** [FAQ: Self-Managed MongoDB Diagnostics](https://www.mongodb.com/docs/manual/faq/diagnostics/) · mongodb.com · "Must my working set size fit RAM? **No.**" — WiredTiger evicts pages from its cache when it fills (*read*) · fetched 2026-10-12
- 🔴 **Source conflict, worth a note on the page:** an older community thread ([Working set MUST fit in memory?](https://www.mongodb.com/community/forums/t/working-set-must-fit-in-memory/3287)) points out the Manual then said both "must fit" and "no". Our syllabus's "performance falls off a cliff" framing needs the FAQ's nuance. · fetched 2026-10-12
- *Not opened:* sitepoint, CleverTap and a monitoring vendor's "hit rate under 95%" rule of thumb — an anecdote and a vendor heuristic, not official thresholds.

### T71 · Capacity: connections and pool exhaustion — Master · 🔲
- **Read this:** [Manage Connections with Connection Pools — Node.js driver](https://www.mongodb.com/docs/drivers/node/current/connect/connection-options/connection-pools/) · mongodb.com · `maxPoolSize` default 100, the next request waits when the pool is full (*read*; as T48) · covers our angle: **partial** — driver side only; the server-side limit (`net.maxIncomingConnections` in [Configuration File Options](https://www.mongodb.com/docs/manual/reference/configuration-options/), ≈20k words); `net.maxIncomingConnections` default on Linux is (RLIMIT_NOFILE / 2) * 0.8, and the value must not exceed it (*read*) · fetched 2026-10-12

## Phase 13 — Security and deployment

### T72 · 🔴 Authentication — Master · 🔲
- **Read this:** [Security Checklist for Self-Managed Deployments](https://www.mongodb.com/docs/manual/administration/security-checklist/) · mongodb.com · "Enable Access Control and Enforce Authentication"; Community supports SCRAM (default) and X.509 (*read*) · covers our angle: **partial** — least privilege (unique user per person/application, only the roles needed) is stated (*read*), but the "unauthenticated instance on the public internet" failure is not narrated · fetched 2026-10-12
- **Also good:** [SCRAM](https://www.mongodb.com/docs/manual/core/security-scram/) · [Enable Access Control](https://www.mongodb.com/docs/manual/tutorial/enable-authentication/) · [Authentication](https://www.mongodb.com/docs/manual/core/authentication/) · mongodb.com · (headings only) · fetched 2026-10-12

### T73 · Authorization — Master · 🔲
- **Read this (1/2):** [Role-Based Access Control](https://www.mongodb.com/docs/manual/core/authorization/) · mongodb.com · ≈1.8k words; a user has no access outside its roles, roles never limit privileges (the greater access wins), access control is not enabled by default, and user-defined roles exist when built-ins do not fit (*read*) · fetched 2026-10-12
- **Read this (2/2):** [Built-In Roles](https://www.mongodb.com/docs/manual/reference/built-in-roles/) · mongodb.com · ≈1.2k words; the HTML text I extracted held only the h1, but the page's Markdown rendering (the same URL with `.md` appended) lists the roles: each applies to the database it is defined on, and `readWrite` is all of `read` plus the ability to modify data on non-system collections of that database (*read*) · covers our angle: partial — it names the candidate role for the app user, not the storefront's choice · fetched 2026-10-12

### T74 · The application user — Master · 🔲
- **Read this:** [Users in Self-Managed Deployments](https://www.mongodb.com/docs/manual/core/security-users/) · mongodb.com · ≈1.7k words; the first user needs `userAdmin`/`userAdminAnyDatabase` to create others, and roles are assigned at `createUser` (*read*); "which privileges the app user needs" is **not confirmed** (the Security Checklist on T72 gives the least-privilege rule) · fetched 2026-10-12
- **Also good:** [Database Users](https://www.mongodb.com/docs/manual/reference/database-users/) · mongodb.com · (headings only) · fetched 2026-10-12
- **Our delta:** the exact least-privilege role for a storefront app user.

### T75 · Network exposure — Master · 🔲
- **Read this (1/2):** [Self-Managed Network and Configuration Hardening](https://www.mongodb.com/docs/manual/core/security-hardening/) · mongodb.com · ≈1.6k words; mongod and mongos bind to localhost by default; before binding to a publicly reachable address, enable authentication and harden the network; firewalls limit incoming traffic by port (*read*; the section is titled IP binding, the literal `bindIp` option name was not on it) · covers our angle: partial — VPC peering is not covered on this page (the Atlas page below mentions only a peered-VPC security group for AWS) · fetched 2026-10-12
- **Read this (2/2):** [Configure IP Access List Entries — Atlas](https://www.mongodb.com/docs/atlas/security/ip-access-list/) · mongodb.com · the Atlas side (≈2.2k words); clients connect only from entries in the project IP access list, each a single IP or a CIDR range (*read*) · fetched 2026-10-12

### T76 · 🔴 NoSQL injection — Master · 🔲
- **Read this:** [NoSQL injection — Web Security Academy](https://portswigger.net/web-security/nosql-injection) · portswigger.net · ≈2.7k words; separates *syntax* injection from *operator* injection and shows submitting operators like `$ne`, `$in`, `$regex`, `$where` where a value was expected (*read* the section list and operator list) · covers our angle: **partial** — generic, not Express-specific; the `req.body` object-in-string-position framing is not in what I read · fetched 2026-10-12
- **Also good:** [Mongoose API → `Mongoose.prototype.sanitizeFilter()`](https://mongoosejs.com/docs/api/mongoose.html) · mongoosejs.com · the maintainers' built-in defence: wraps any nested object with a `$`-prefixed key in `$eq`, so an object such as `{ $ne: null }` in a password position is neutralised (*read*; anchor id `Mongoose.prototype.sanitizeFilter()` seen in the HTML, but it contains parentheses so no anchor is used) · covers the Mongoose half of our delta · fetched 2026-10-12
- *Checked, not listed:* `express-mongo-sanitize` on GitHub and npm both answer HTTP 403 to curl — **not fetchable, unverified**, so not recommended here even though search results describe it. OWASP's `NoSQL_injection` community page returned 404.
- *Not opened:* DEV, levelup.gitconnected, Synopsys/Black Duck posts (search hits only).
- **Our delta:** the Express `req.body`/`req.query` angle, with the type-check-before-query fix.

## Phase 14 — The storefront data layer (composite; the assembly is ours)

### T77 · Products, variants and inventory — Master · 🔲
- **Read this:** **none as a whole** — parts: [Embedding vs referencing](https://www.mongodb.com/docs/manual/data-modeling/best-practices/) (T18) · [Schema Design Patterns](https://www.mongodb.com/docs/manual/data-modeling/design-patterns/) (T22) · [Polymorphic Data pattern](https://www.mongodb.com/docs/manual/data-modeling/design-patterns/polymorphic-data/) · mongodb.com (the last: documents in one collection that vary in fields or types, grouped by the Polymorphic and Inheritance patterns (*read*), which is the variants shape; the Schema Design Patterns index page lists it but I did not find an Extended Reference entry in its text) · fetched 2026-10-12

### T78 · Catalogue browsing — filtering, facets, pagination — Master · 🔲
- **Read this:** [$facet](https://www.mongodb.com/docs/manual/reference/operator/aggregation/facet/) · mongodb.com · runs multiple sub-pipelines in one stage over the same input, each in its own output field (*read*) · covers our angle: **partial** — "faceted counts and pagination in one aggregation" is the use; the page is the stage reference · fetched 2026-10-12
- **Also good:** [$bucket](https://www.mongodb.com/docs/manual/reference/operator/aggregation/bucket/) · mongodb.com · groups documents into buckets by `boundaries` and emits one document per bucket, the price-range facet (≈4.4k words; *read* the definition and syntax) · fetched 2026-10-12

### T79 · The cart — atomic add/update/remove, and TTL expiry — Master · 🔲
- **Read this (1/2):** [TTL Indexes](https://www.mongodb.com/docs/manual/core/index-ttl/) · mongodb.com · `expireAfterSeconds` on a date field; the background delete is not instant (it stops its current loop every 60 s) (*read*) · covers our angle: full for TTL · fetched 2026-10-12
- **Read this (2/2):** [$push](https://www.mongodb.com/docs/manual/reference/operator/update/push/) · mongodb.com · `$push` appends a value to an array (*read* the definition); atomicity of the single-document update is T02/T59 · fetched 2026-10-12
- **Also good:** [Expire Data from Collections by Setting TTL](https://www.mongodb.com/docs/manual/tutorial/expire-data/) · mongodb.com · TTL index is single-field only (compound indexes do not support TTL) and `expireAfterSeconds` can be changed with `collMod` (*read*) · fetched 2026-10-12

### T80 · Checkout and stock — decrement-and-order — Master · 🔲
- **Read this:** **none as a whole** — parts: [db.collection.findOneAndUpdate()](https://www.mongodb.com/docs/manual/reference/method/db.collection.findoneandupdate/) · mongodb.com · updates one document by filter and returns the original by default (*read*); the word "atomic" is not on it, so atomicity rests on the Atomicity page (T59), which says to put the expected current value in the update filter so concurrent updates do not conflict (*read*) — that is the conditional-decrement idea; the page does not spell out the stock example · and T60/T62 for the multi-document alternative · fetched 2026-10-12
- **Our delta:** "resolved in the schema" — the conditional-decrement pattern.

### T81 · Orders and history — Master · 🔲
- **Read this:** [$lookup](https://www.mongodb.com/docs/manual/reference/operator/aggregation/lookup/) · mongodb.com · ≈6.6k words; a left outer join to another collection in the same database, equality match of `localField` to `foreignField`, results as an array field (*read*) · covers our angle: **partial** — "what to denormalise onto the order" is the extended reference pattern (T22) · fetched 2026-10-12

### T82 · 🔴 The index set for the whole application — Master · 🔲
- **Read this:** [The ESR (Equality, Sort, Range) Guideline](https://www.mongodb.com/docs/manual/tutorial/equality-sort-range-guideline/) · mongodb.com · see T43 (*read*) · covers our angle: **partial** — the method, not the storefront's list · fetched 2026-10-12
- **Also good:** [Indexing Strategies](https://www.mongodb.com/docs/manual/applications/indexes/) · [Remove Unnecessary Indexes](https://www.mongodb.com/docs/manual/data-modeling/design-antipatterns/unnecessary-indexes/) · mongodb.com · for "nothing speculative" (Indexing Strategies: best indexes depend on query mix, read/write ratio and free memory (*read*); Remove Unnecessary Indexes: rarely used, redundant or unused indexes degrade performance (*read*)) · fetched 2026-10-12
- **Our delta:** every index justified by a named query.
