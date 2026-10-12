---
title: "Link map · MongoDB · T41–T58 (phases 7–9)"
sidebar_label: "04 · MongoDB · T41–T58 (phases 7–9)"
sidebar_position: 4
---

# Link map · MongoDB · T41–T58 (phases 7–9)

Continues [03-crud-operators-aggregation.md](03-crud-operators-aggregation.md). **All 18 topics are 🔲 not written** — this is the *not-written side* the pilot could not test: no page of ours
exists, so each block is a source bank for the day the page is written. T41–T46 phase 7 (Indexes), T47–T52 phase 8 (Node.js driver), T53–T58 phase 9 (Mongoose).
Spine: `docs/mongodb/syllabus/02-querying.md` and `03-from-node.md`. *read* = I read the passage; *headings only* = fetched,
headings/size checked. Manual links carry no `#anchors`; **Mongoose and Node-driver pages do** and the Mongoose ids below were taken from the pages' heading ids.

🔴 **Version note.** The Manual and the Node driver docs are served as a current/9.0-era site; the Mongoose docs are **v9.11.1** (also listing v8.24.5, v7.8.12). When these pages are written,
pin the version in the `> Verified:` line — the link text here is version-agnostic.

---

## Phase 7 — Indexes and the query planner

### T41 · What an index is here — Master · 🔲
- **Read this:** [Indexes](https://www.mongodb.com/docs/manual/indexes/) · mongodb.com · "MongoDB indexes use a B-tree"; ordered entries support equality, range and sorted results; adding an index has a negative write impact — every insert must update every index (*read*) · the Default Index section: MongoDB creates a unique index on `_id` at collection creation, it stops two documents sharing an `_id`, and it cannot be dropped (*read*) · covers our angle: full · fetched 2026-10-12
- **Also good:** [Indexing Strategies](https://www.mongodb.com/docs/manual/applications/indexes/) · mongodb.com · a hub page of strategy sub-pages (sort support, selective indexes, unique indexes with schema validation); links only, no body argument (*read* the intro) · fetched 2026-10-12

### T42 · Single-field indexes — Master · 🔲
- **Read this:** [Single Field Indexes](https://www.mongodb.com/docs/manual/core/indexes/index-types/index-single/) · mongodb.com · you give the field and a sort order (1 ascending, -1 descending); the default `_id` index is mentioned (*read*) · covers our angle: **partial** — "direction does not matter for a single field" is **not stated** on this page · fetched 2026-10-12
- **Also good:** [Compound Index Sort Order](https://www.mongodb.com/docs/manual/core/indexes/index-types/index-compound/sort-order/) · mongodb.com · direction matters only for a sort on several fields in opposite directions; compound indexes support the index's order or its exact reverse (*read*) · the closest primary statement for the direction rule · fetched 2026-10-12

### T43 · 🔴 Compound indexes and the ESR rule — Master · 🔲
- **Read this (1/2):** [The ESR (Equality, Sort, Range) Guideline](https://www.mongodb.com/docs/manual/tutorial/equality-sort-range-guideline/) · mongodb.com · ≈2.7k words; an index sorts only when the query has equality conditions on all prefix keys that precede the sort keys, shown on a movies example (*read*) · covers our angle: full · fetched 2026-10-12
- **Read this (2/2):** [Compound Indexes](https://www.mongodb.com/docs/manual/core/indexes/index-types/index-compound/) · mongodb.com · field order matters because the B-tree stores data in index order; points to ESR for efficient compound indexes (*read*) · fetched 2026-10-12

### T44 · 🔴 Index prefixes — Master · 🔲
- **Read this:** [Compound Indexes → Index Prefixes](https://www.mongodb.com/docs/manual/core/indexes/index-types/index-compound/) · mongodb.com · a compound index supports queries on any prefix; the page's own example `{item, location, stock}` has prefixes `{item}` and `{item, location}` (*read*) · covers our angle: full — "not on `b` alone" follows from the definition · fetched 2026-10-12

### T45 · Multikey indexes — Master · 🔲
- **Read this:** [Multikey Indexes](https://www.mongodb.com/docs/manual/core/indexes/index-types/index-multikey/) · mongodb.com · "You cannot create a compound multikey index if more than one field in the index specification is an array" (*read*); also bounds, unique multikey, sorting · covers our angle: full · fetched 2026-10-12

### T46 · 🔴 Unique indexes — and `null` / missing — Master · 🔲
- **Read this:** [Unique Indexes](https://www.mongodb.com/docs/manual/core/index-unique/) · mongodb.com · a null **or missing** value in a unique single-field index is stored as `null`, so a second such document violates the constraint (*read*) · covers our angle: **partial** — this page does not discuss upserts · fetched 2026-10-12
- **Upsert race (the syllabus row's fix):** [`updateOne()`](https://www.mongodb.com/docs/manual/reference/method/db.collection.updateone/) · mongodb.com · to avoid multiple upserts, the filter fields should be uniquely indexed (*read*); the deprecated mongosh [`update()`](https://www.mongodb.com/docs/manual/reference/method/db.collection.update/) page adds an "Upsert with Duplicate Values" section: without a unique index, concurrent upserts may each insert (*read*) · covers our angle: full for the fix (both are mongosh method pages, not Node driver pages) · fetched 2026-10-12
- **Also good:** [Sparse Indexes](https://www.mongodb.com/docs/manual/core/index-sparse/) · mongodb.com · only documents *having* the field are indexed; the usual remedy for the null/missing collision (*read* the definition) · [Partial Indexes](https://www.mongodb.com/docs/manual/core/index-partial/) · the more general remedy (existence only) · fetched 2026-10-12
- **Our delta:** a worked reproduction of two concurrent upserts, and the retry on the duplicate-key error — neither page narrates it.

## Phase 8 — The Node.js driver, end to end

Base: `https://www.mongodb.com/docs/drivers/node/current/`.

### T47 · `MongoClient` — installing, constructing, connecting — Master · 🔲
- **Read this:** [Get Started with the Node.js Driver](https://www.mongodb.com/docs/drivers/node/current/get-started/) · mongodb.com · ≈2.1k words; the quickstart installs the package, builds `new MongoClient(uri)`, then calls `client.db(...)` and `.collection(...)` (*read*) · covers our angle: full for install and construct · fetched 2026-10-12
- **Also good:** [Create a MongoClient](https://www.mongodb.com/docs/drivers/node/current/connect/mongoclient/) · mongodb.com · ≈2k words; includes the `serverApi` (Stable API) option; a note says the driver calls `connect()` itself on first operation, so an explicit call is only to verify the connection (*read*) · fetched 2026-10-12

### T48 · 🔴 One client, reused — Master · 🔲
- **Read this (1/2):** [Create a MongoClient](https://www.mongodb.com/docs/drivers/node/current/connect/mongoclient/) · mongodb.com · "most applications only require a single instance of a MongoClient, even across multiple requests" (*read*) · covers our angle: full for "reuse" · fetched 2026-10-12
- **Read this (2/2):** [Manage Connections with Connection Pools](https://www.mongodb.com/docs/drivers/node/current/connect/connection-options/connection-pools/) · mongodb.com · every `MongoClient` has a built-in pool per server; `maxPoolSize` default 100, further requests wait; `minPoolSize` unset means sockets open on demand (*read*) · covers our angle: full for "the client is the pool" · fetched 2026-10-12
- **Our delta:** the per-request-client failure mode (symptom → cause → fix) — neither page narrates it.

### T49 · Connection strings in practice — Master · 🔲
- **Read this:** [Connection Strings](https://www.mongodb.com/docs/manual/reference/connection-string/) · mongodb.com · `mongodb+srv` (*read*, see T12) · covers our angle: **partial** — the Manual page's own text on `authSource`, `retryWrites`, `appName` is **not confirmed** (search of the fetched text found none) · fetched 2026-10-12
- **Also good:** [Choose a Connection Target](https://www.mongodb.com/docs/drivers/node/current/connect/connection-targets/) · [Connection Options](https://www.mongodb.com/docs/drivers/node/current/connect/connection-options/) · mongodb.com · Connection Options (*read*): its options table lists `authSource` (the database connections authenticate against), `retryWrites` (boolean, default true) and `appName` (sent to the server in the handshake metadata) · covers our angle: full for these three options; Connection Targets not read · fetched 2026-10-12

### T50 · `db()` and `collection()` — cheap handles — Master · 🔲
- **Read this:** [Databases and Collections](https://www.mongodb.com/docs/drivers/node/current/databases-collections/) · mongodb.com · `db()` is called on a `MongoClient` and `collection()` on a `Db`; if the name does not exist the collection is created implicitly on first insert, and `createCollection()` is the explicit route (*read*) · covers our angle: **partial** — the page never states "no network I/O"; that claim is **not confirmed** and stays ours · fetched 2026-10-12

### T51 · The CRUD API from the driver — Master · 🔲
- **Read this:** [CRUD Operations](https://www.mongodb.com/docs/drivers/node/current/crud/) · mongodb.com · the section index (≈0.9k words); children **exist (HTTP 200)**: [insert](https://www.mongodb.com/docs/drivers/node/current/crud/insert/), [update](https://www.mongodb.com/docs/drivers/node/current/crud/update/), [query](https://www.mongodb.com/docs/drivers/node/current/crud/query/) · headings checked: insert covers `insertOne`/`insertMany` and the `_id` note, and only points to the Bulk Operations guide for `bulkWrite`; update lists `updateOne`/`replaceOne`/`updateMany` with an upsert section (*read* the intro); the [Find Documents](https://www.mongodb.com/docs/drivers/node/current/crud/query/retrieve/) page (a child of query) has `findOne`/`find`, aggregate and change-stream sections · covers our angle: **partial** — a side-by-side with shell signatures is **not on these pages** · fetched 2026-10-12
- **Our delta:** "where the signatures differ from the shell".

### T52 · 🔴 Cursors in Node — Master · 🔲
- **Read this:** [Access Data From a Cursor](https://www.mongodb.com/docs/drivers/node/current/crud/query/cursor/) · mongodb.com · a cursor fetches in batches to cut memory and network use; `find`, `aggregate`, `listIndexes` etc. return cursors; mixing `hasNext()`/`toArray()` on one cursor gives unexpected results, and concurrent async calls on one cursor are undefined behaviour; cursors implement `AsyncIterator`, so `for await...of` works; for `toArray()` the page warns that large result sets can cause performance issues or failures if memory limits are exceeded and suggests `for await...of` instead (*read*) · covers our angle: full · fetched 2026-10-12

## Phase 9 — Mongoose

Version: **Mongoose v9.11.1** at fetch. Base: `https://mongoosejs.com/docs/`.

### T53 · 🔴 What Mongoose is, and what it costs — Master · 🔲
- **Read this:** [Getting Started](https://mongoosejs.com/docs/index.html) · mongoosejs.com · ≈0.6k words, the project's own quickstart (schema, a method, save, query) (*read*) · covers our angle: **partial** — it does not argue cost · fetched 2026-10-12
- **Also good:** [Faster Mongoose Queries With Lean](https://mongoosejs.com/docs/tutorials/lean.html#faster-mongoose-queries-with-lean) · documents are "much heavier than vanilla JavaScript objects" because of change tracking (*read*) — the cost, from the maintainers · fetched 2026-10-12
- **Also good:** [Integrate with Mongoose](https://www.mongodb.com/docs/drivers/node/current/integrations/mongoose/) · mongodb.com · the driver docs' framing of an ODM: schema and validation rules live only in application code, so other clients bypass them, and the trade-off is reduced flexibility when the data shape changes (*read*) · [Documents → Hydrated vs Lean](https://mongoosejs.com/docs/documents.html#hydrated-documents-vs-lean-documents) · hydrated documents are not plain objects; they carry internal state for change tracking, validation, middleware, methods, getters/setters/virtuals (*read*) · covers our angle: partial for "what it costs" (no measurements) · fetched 2026-10-12
- *Checked, not chosen:* the developer.mongodb.com "Mongoose versus Node.js driver" article — the URL now redirects to the docs home page, so it is dropped.
- **Our delta:** the schemas / casting / validation / middleware vs "a layer between you and the query" argument.

### T54 · Schemas and SchemaTypes — Master · 🔲
- **Read this (1/2):** [Schemas](https://mongoosejs.com/docs/guide.html#definition) · mongoosejs.com · ≈9k words; everything starts with a Schema, and each schema maps to a MongoDB collection and defines its documents' shape (*read*); ids include `#definition`, `#ids`, `#indexes`, `#virtuals`, `#options` (ids verified) · fetched 2026-10-12
- **Read this (2/2):** [SchemaTypes](https://mongoosejs.com/docs/schematypes.html) · mongoosejs.com · ≈5.2k words; a SchemaType is a configuration object for one path: its type, any getters/setters, and which values are valid (*read*); ids such as `#schematype-options`, `#type-key` verified · covers our angle: full for the concept · fetched 2026-10-12

### T55 · Models and documents — Master · 🔲
- **Read this (1/2):** [Models](https://mongoosejs.com/docs/models.html#compiling) · mongoosejs.com · models are constructors compiled from a Schema, an instance is a document, and models create and read documents in MongoDB (*read*); sections: compiling, constructing, querying, updating (ids verified) · fetched 2026-10-12
- **Read this (2/2):** [Documents](https://mongoosejs.com/docs/documents.html) · mongoosejs.com · ≈2k words; a query result or new document is a hydrated Mongoose document, an instance of the `Document` class, with internal state for change tracking, validation, middleware, methods and getters/setters/virtuals; `Model` extends `Document` (*read*) · covers our angle: full · fetched 2026-10-12

### T56 · Validation — and where it does not run — Master · 🔲
- **Read this:** [Validation](https://mongoosejs.com/docs/validation.html) · mongoosejs.com · validators do not run on `undefined` values (except `required`); **update validators are off by default** and need `runValidators` on `updateOne`, `updateMany`, `findOneAndUpdate` (*read*) · covers our angle: full for "where validation does not run" · fetched 2026-10-12

### T57 · The Query builder — not executed until awaited — Master · 🔲
- **Read this:** [Queries](https://mongoosejs.com/docs/queries.html#queries-are-not-promises) · mongoosejs.com · a query runs via `await` or `.then()`; the section "Queries are Not Promises" (heading id verified). Queries are thenables, not promises, and calling `.then()` on one executes it, so a second `.then()` on the same query throws "Query was already executed" (*read*) · covers our angle: full for "runs when awaited / then called"; that a chained query is not sent until awaited is implied but **not stated verbatim** in the passages read · fetched 2026-10-12

### T58 · 🔴 `lean()` — Master · 🔲
- **Read this:** [Faster Mongoose Queries With Lean](https://mongoosejs.com/docs/tutorials/lean.html#using-lean) · mongoosejs.com · `lean` skips hydrating: faster and lighter, but results are plain objects, not Mongoose documents (*read*); sections `#lean-and-populate`, `#when-to-use-lean`, `#plugins` (ids verified); virtuals/getters/defaults do not run on lean results (*read* the plugin example) · covers our angle: full · fetched 2026-10-12
