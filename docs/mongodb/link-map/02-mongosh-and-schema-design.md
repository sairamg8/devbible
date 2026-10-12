---
title: "Link map · MongoDB · T12–T22 (phases 2–3)"
sidebar_label: "02 · MongoDB · T12–T22 (phases 2–3)"
sidebar_position: 2
---

# Link map · MongoDB · T12–T22 (phases 2–3)

All 11 topics are ✅ written. Numbering continues from [01-how-it-runs-and-bson.md](01-how-it-runs-and-bson.md): T12–T16 are phase 2
(`docs/mongodb/pages/phase-2-mongosh/01–05`), T17–T22 are phase 3 (`…/phase-3-schema-design/01–06`). Manual links carry no `#anchors`
(the Manual exposes no heading ids). *read* = I read the passage; *headings only* = page fetched, headings and size checked.

---

### T12 · Connecting — Master · ✅ `docs/mongodb/pages/phase-2-mongosh/01-connecting.md`
- **Read this (1/2):** [Connection Strings](https://www.mongodb.com/docs/manual/reference/connection-string/) · mongodb.com · the formats, with `mongodb+srv://` described as simplifying connection by auto-including the seed list (*read*) · covers our angle: **partial** — anatomy and SRV yes; the page defers options to a separate page (see *Also good*) · fetched 2026-10-12
- **Read this (2/2):** [Connect to a Deployment — mongosh](https://www.mongodb.com/docs/mongodb-shell/connect/) · mongodb.com · sections for Atlas (a `mongodb+srv://` template run with `--apiVersion` and `--username`, password then prompted), local default and non-default port, remote host, authentication, replica set, TLS, switching deployments (*read* the headings and the Atlas example) · covers our angle: full for "connecting to Atlas" · fetched 2026-10-12
- **Also good:** [Connection String Options](https://www.mongodb.com/docs/manual/reference/connection-string-options/) · mongodb.com · the option reference: `retryWrites` (drivers default true), `authSource` (defaults to the named default db, else `admin`), `replicaSet`, `appName` (shows in logs and profiler), `tls`, `maxPoolSize` (default 100) (*read*) · covers the "options" part of our angle · fetched 2026-10-12

### T13 · Navigating — Master · ✅ `…/02-navigating.md`
- **Read this:** [Run Commands — mongosh](https://www.mongodb.com/docs/mongodb-shell/run-commands/) · mongodb.com · `use <db>`, `show dbs`, and that `use` followed by an insert creates the database and collection (*read*) · covers our angle: full for "why a database that does not exist still lets you type `use`" · fetched 2026-10-12
- **Also good:** [mongosh Help](https://www.mongodb.com/docs/mongodb-shell/reference/access-mdb-shell-help/) · mongodb.com · how to list databases, collections and methods from the shell and get per-method help: `show dbs`, `show collections`, `db.help()`, `db.collection.help()`, `<method>.help()` (*read*) · fetched 2026-10-12

### T14 · Cursors — Master · ✅ `…/03-cursors.md`
- **Read this:** [Iterate a Cursor in mongosh](https://www.mongodb.com/docs/manual/tutorial/iterate-a-cursor/) · mongodb.com · a cursor returns documents in batches; mongosh shows 20 per iteration by default, changed with `displayBatchSize`; `toArray()` returns all as an array (*read*) · covers our angle: **partial** — batching and `it` yes; "a cursor is not a result set" is implied, not argued · fetched 2026-10-12
- **Also good:** [cursor.batchSize()](https://www.mongodb.com/docs/manual/reference/method/cursor.batchsize/) · mongodb.com · the server-side batch knob, distinct from the shell's display batch; initial batch is the lesser of 101 documents or 16 MiB, later batches up to 16 MiB, and `mongos` does not forward it to shards (*read*) · fetched 2026-10-12

### T15 · 🔴 `explain()` from the shell — Master · ✅ `…/04-explain.md`
- **Read this (1/2):** [Interpret Explain Plan Results](https://www.mongodb.com/docs/manual/tutorial/analyze-query-plan/) · mongodb.com · a worked `find().explain("executionStats")`: `winningPlan` stage `COLLSCAN` vs the counters `nReturned`, `totalKeysExamined`, `totalDocsExamined` (*read*) · covers our angle: full for reading the plan · fetched 2026-10-12
- **Read this (2/2):** [cursor.explain()](https://www.mongodb.com/docs/manual/reference/method/cursor.explain/) · mongodb.com · the three verbosity modes — `queryPlanner` (default), `executionStats`, `allPlansExecution` (*read*) · covers our angle: full for the three levels · fetched 2026-10-12
- **Also good:** [Explain Results](https://www.mongodb.com/docs/manual/reference/explain-results/) · mongodb.com · the field-by-field reference, ≈6.5k words — look things up, do not read it through (headings only; not read in full) · fetched 2026-10-12

### T16 · ⚠️ Shell safety on production — Master · ✅ `…/05-shell-safety.md`
- **Read this:** **none found** as one article — tried: the mongosh docs index, `run-commands`, `access-mdb-shell-help` (no page on destructive helpers or read-only habits), a web search for production-safety guidance (only third-party how-tos on dropping databases), and the Manual's reference pages below. No page explains "the commands that do not ask twice" as a topic.
- **Also good (1/3):** [Built-In Roles](https://www.mongodb.com/docs/manual/reference/built-in-roles/) · mongodb.com · the `read` role provides read access to all non-system collections plus `system.js`; `readWrite` adds modification (*read* via the page's markdown rendering) · covers our angle: partial — the read-only mechanism, not the habits · fetched 2026-10-12
- **Also good (2/3):** [db.dropDatabase()](https://www.mongodb.com/docs/manual/reference/method/db.dropdatabase/) · mongodb.com · removes the current database and its data files; the example is `use temp` then `db.dropDatabase()` with no confirmation step; it does not remove users (*read*); it does not name the privilege needed — **not confirmed** · fetched 2026-10-12
- **Also good (3/3):** [db.collection.deleteMany()](https://www.mongodb.com/docs/manual/reference/method/db.collection.deletemany/) · mongodb.com · an empty `{}` filter deletes every document; no confirmation is mentioned (*read*) · fetched 2026-10-12
- **Our delta:** this topic is ours to own outright.

### T17 · 🔴 Schema design is a query exercise — Master · ✅ `docs/mongodb/pages/phase-3-schema-design/01-schema-design-is-a-query-exercise.md`
- **Read this:** [Designing Your Schema](https://www.mongodb.com/docs/manual/data-modeling/schema-design-process/) · mongodb.com · the Manual's process page, ≈1.3k words, a four-step process: identify the workload, map relationships (link or embed), apply patterns, create indexes; the workload comes first, but it never mentions normalization or says "design for reads" in so many words (*read*) · covers our angle: **partial** — workload-first is there, the explicit reversal from a normal form is not · fetched 2026-10-12
- **Also good:** [Data Modeling in MongoDB](https://www.mongodb.com/docs/manual/data-modeling/) · mongodb.com · its "Differences Between Relational and Document Databases" table says the document model stores data by application access patterns, and embedding avoids joins (*read*) · covers the reversal better than the process page · fetched 2026-10-12
- **Our delta:** the explicit reversal from the PostgreSQL normal-form habit.

### T18 · 🔴 Embed vs reference — the decision procedure — Master · ✅ `…/02-embed-vs-reference.md`
- **Read this:** [Best Practices for Data Modeling in MongoDB](https://www.mongodb.com/docs/manual/data-modeling/best-practices/) · mongodb.com · "Link Related Data" and "Duplicate Data" sections, plus atomicity and small-documents considerations (*read*) a table of when to embed (queried together, updated together, archived together) and when to reference (high cardinality, unbounded growth, data written at different times, child exists without parent, too large for memory or bandwidth) · covers our angle: **partial** — the criteria are all there but unordered, and the 16 MB limit is **not mentioned** on this page · fetched 2026-10-12
- **Also good:** [6 Rules of Thumb for MongoDB Schema Design](https://www.mongodb.com/company/blog/mongodb/6-rules-of-thumb-for-mongodb-schema-design) · mongodb.com blog · published 2014-06-11, modified 2022-11-02, ≈4.7k words: sorts one-to-N into few / many / squillions and picks a model for each (*read* the framing) · fetched 2026-10-12
- **Our delta:** the *ordered* procedure — nobody I opened gives it as a checklist.

### T19 · One-to-few — Master · ✅ `…/03-one-to-few.md`
- **Read this:** [6 Rules of Thumb → Modeling one-to-few](https://www.mongodb.com/company/blog/mongodb/6-rules-of-thumb-for-mongodb-schema-design) · mongodb.com blog · the example is a person's addresses, embedded as an array — "a good use case for embedding" (*read*); dated 2014, modified 2022 · covers our angle: full · fetched 2026-10-12
- **Also good:** [Model One-to-One Relationships with Embedded Documents](https://www.mongodb.com/docs/manual/tutorial/model-embedded-one-to-one-relationships-between-documents/) · mongodb.com · the Manual's embedded shape (headings only; not read) · fetched 2026-10-12

### T20 · One-to-many — Master · ✅ `…/04-one-to-many.md`
- **Read this (1/2):** [Model One-to-Many Relationships with Embedded Documents](https://www.mongodb.com/docs/manual/tutorial/model-embedded-one-to-many-relationships-between-documents/) · mongodb.com · the embed side: a patron with two addresses in an array, so one read returns everything; it says embedding reduces the number of reads and does not discuss tradeoffs (*read*) · covers our angle: partial — read benefit only, no write or growth cost · fetched 2026-10-12
- **Read this (2/2):** [Model One-to-Many Relationships with Document References](https://www.mongodb.com/docs/manual/tutorial/model-referenced-one-to-many-relationships-between-documents/) · mongodb.com · the reference side: publishers and books, with `publisher_id` on each book; it says to keep the id array in the parent only when the count is small with limited growth, and to put `publisher_id` on each book when the count is unbounded, to avoid mutable growing arrays (*read*) · covers our angle: partial — it does not discuss the extra query or `$lookup` cost; the read cost of each is not stated there · fetched 2026-10-12
- **Also good:** [6 Rules of Thumb](https://www.mongodb.com/company/blog/mongodb/6-rules-of-thumb-for-mongodb-schema-design) · the one-to-many section for the parts-in-an-array-of-ids case (not re-read) · fetched 2026-10-12

### T21 · One-to-squillions — Master · ✅ `…/05-one-to-squillions.md`
- **Read this:** [Avoid Unbounded Arrays](https://www.mongodb.com/docs/manual/data-modeling/design-antipatterns/unbounded-arrays/) · mongodb.com · an unlimited array can push a document past the 16 MB BSON limit and hurt index performance; the fix is subsetting and referencing (*read*) · covers our angle: **partial** — the trap is covered; its worked fix keeps an array of review ids on the *one* side (book) and joins with `$lookup`, noting added latency (*read*), which is a bounded-array variant, not the many-side reference our topic teaches — the many-side reference is shown on the one-to-many reference page above · fetched 2026-10-12
- **Also good:** [6 Rules of Thumb → one-to-squillions](https://www.mongodb.com/company/blog/mongodb/6-rules-of-thumb-for-mongodb-schema-design) · the original statement of the pattern (*read* the framing) · fetched 2026-10-12

### T22 · The extended reference pattern — Master · ✅ `…/06-extended-reference.md`
- **Read this:** [Building with Patterns: The Extended Reference Pattern](https://www.mongodb.com/company/blog/building-with-patterns-the-extended-reference-pattern) · mongodb.com blog · published 2019-03-07, ≈1.3k words, one sample use case (*read*) duplicate only the few frequently displayed fields, best for rarely changing values; the cost is deciding which copies to update and when; duplication can also preserve history (a shipping address on an order) · covers our angle: **full** — the pattern and the update question both covered; the blog poses the update cost as questions (which copies change, when to update) rather than quantifying it · fetched 2026-10-12
- **Also good:** [Schema Design Patterns](https://www.mongodb.com/docs/manual/data-modeling/design-patterns/) · mongodb.com · the Manual's current pattern index; it lists six patterns (computed values, group data, polymorphic, schema versioning, archive, single collection) and **the extended reference pattern is not on it** (*read*) · fetched 2026-10-12
- **Our delta:** the update cost, named knowingly.
