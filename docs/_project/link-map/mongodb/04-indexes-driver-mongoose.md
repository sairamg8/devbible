---
name: link-map-mongodb-04
description: Link map, MongoDB topics T41–T58 (phase 7 indexes and the planner, phase 8 the Node.js driver, phase 9 Mongoose) — all 🔲 not written yet — the best explanation per topic, fetched 2026-10-12
metadata:
  type: reference
---

# Link map · MongoDB · T41–T58 (phases 7–9)

Continues [03-crud-operators-aggregation.md](03-crud-operators-aggregation.md). **All 18 topics are 🔲 not written** — this is the *not-written side* the pilot could not test: no page of ours
exists, so each block is a source bank for the day the page is written. T41–T46 phase 7 (Indexes), T47–T52 phase 8 (Node.js driver), T53–T58 phase 9 (Mongoose).
Spine: `docs/mongodb/syllabus/02-querying.md` and `03-from-node.md`. Rules: [../../CURSOR-LINK-MAP.md](../../CURSOR-LINK-MAP.md). *read* = I read the passage; *headings only* = fetched,
headings/size checked. Manual links carry no `#anchors`; **Mongoose and Node-driver pages do** and the Mongoose ids below were taken from the pages' heading ids.

🔴 **Version note.** The Manual and the Node driver docs are served as a current/9.0-era site; the Mongoose docs are **v9.11.1** (also listing v8.24.5, v7.8.12). When these pages are written,
pin the version in the `> Verified:` line — the link text here is version-agnostic.

---

## Phase 7 — Indexes and the query planner

### T41 · What an index is here — Master · 🔲
- **Read this:** [Indexes](https://www.mongodb.com/docs/manual/indexes/) · mongodb.com · "MongoDB indexes use a B-tree"; ordered entries support equality, range and sorted results; adding an index has a negative write impact — every insert must update every index (*read*) · covers our angle: **partial** — the `_id` index is not covered in the text I read · fetched 2026-10-12
- **Also good:** [Indexing Strategies](https://www.mongodb.com/docs/manual/applications/indexes/) · mongodb.com · ≈1.4k words (headings only) · fetched 2026-10-12

### T42 · Single-field indexes — Master · 🔲
- **Read this:** [Single Field Indexes](https://www.mongodb.com/docs/manual/core/indexes/index-types/index-single/) · mongodb.com · ≈1.35k words (headings only; "direction does not matter" **not confirmed**) · fetched 2026-10-12

### T43 · 🔴 Compound indexes and the ESR rule — Master · 🔲
- **Read this (1/2):** [The ESR (Equality, Sort, Range) Guideline](https://www.mongodb.com/docs/manual/tutorial/equality-sort-range-guideline/) · mongodb.com · ≈2.7k words; an index sorts only when the query has equality conditions on all prefix keys that precede the sort keys, shown on a movies example (*read*) · covers our angle: full · fetched 2026-10-12
- **Read this (2/2):** [Compound Indexes](https://www.mongodb.com/docs/manual/core/indexes/index-types/index-compound/) · mongodb.com · field order matters because the B-tree stores data in index order; points to ESR for efficient compound indexes (*read*) · fetched 2026-10-12

### T44 · 🔴 Index prefixes — Master · 🔲
- **Read this:** [Compound Indexes → Index Prefixes](https://www.mongodb.com/docs/manual/core/indexes/index-types/index-compound/) · mongodb.com · a compound index supports queries on any prefix; the page's own example `{item, location, stock}` has prefixes `{item}` and `{item, location}` (*read*) · covers our angle: full — "not on `b` alone" follows from the definition · fetched 2026-10-12

### T45 · Multikey indexes — Master · 🔲
- **Read this:** [Multikey Indexes](https://www.mongodb.com/docs/manual/core/indexes/index-types/index-multikey/) · mongodb.com · "You cannot create a compound multikey index if more than one field in the index specification is an array" (*read*); also bounds, unique multikey, sorting · covers our angle: full · fetched 2026-10-12

### T46 · 🔴 Unique indexes — and `null` / missing — Master · 🔲
- **Read this:** [Unique Indexes](https://www.mongodb.com/docs/manual/core/index-unique/) · mongodb.com · a null **or missing** value in a unique single-field index is stored as `null`, so a second such document violates the constraint (*read*) · covers our angle: **partial** — the concurrent-upsert fix named in the syllabus row was **not found** on this page · fetched 2026-10-12
- **Also good:** [Sparse Indexes](https://www.mongodb.com/docs/manual/core/index-sparse/) · mongodb.com · only documents *having* the field are indexed; the usual remedy for the null/missing collision (*read* the definition) · [Partial Indexes](https://www.mongodb.com/docs/manual/core/index-partial/) · the more general remedy (existence only) · fetched 2026-10-12
- **Our delta:** the upsert race (two concurrent upserts both inserting) and its fix.

## Phase 8 — The Node.js driver, end to end

Base: `https://www.mongodb.com/docs/drivers/node/current/`.

### T47 · `MongoClient` — installing, constructing, connecting — Master · 🔲
- **Read this:** [Get Started with the Node.js Driver](https://www.mongodb.com/docs/drivers/node/current/get-started/) · mongodb.com · ≈2.1k words (size only; not read) · fetched 2026-10-12
- **Also good:** [Create a MongoClient](https://www.mongodb.com/docs/drivers/node/current/connect/mongoclient/) · mongodb.com · ≈2k words; includes the `serverApi` (Stable API) option (*read* in part) · fetched 2026-10-12

### T48 · 🔴 One client, reused — Master · 🔲
- **Read this (1/2):** [Create a MongoClient](https://www.mongodb.com/docs/drivers/node/current/connect/mongoclient/) · mongodb.com · "most applications only require a single instance of a MongoClient, even across multiple requests" (*read*) · covers our angle: full for "reuse" · fetched 2026-10-12
- **Read this (2/2):** [Manage Connections with Connection Pools](https://www.mongodb.com/docs/drivers/node/current/connect/connection-options/connection-pools/) · mongodb.com · every `MongoClient` has a built-in pool per server; `maxPoolSize` default 100, further requests wait; `minPoolSize` unset means sockets open on demand (*read*) · covers our angle: full for "the client is the pool" · fetched 2026-10-12
- **Our delta:** the per-request-client failure mode (symptom → cause → fix) — neither page narrates it.

### T49 · Connection strings in practice — Master · 🔲
- **Read this:** [Connection Strings](https://www.mongodb.com/docs/manual/reference/connection-string/) · mongodb.com · `mongodb+srv` (*read*, see T12) · covers our angle: **partial** — `authSource`, `retryWrites`, `appName` options **not read** · fetched 2026-10-12
- **Also good:** [Choose a Connection Target](https://www.mongodb.com/docs/drivers/node/current/connect/connection-targets/) · [Connection Options](https://www.mongodb.com/docs/drivers/node/current/connect/connection-options/) · mongodb.com · the driver-side options (size / HTTP status only; **not read**) · fetched 2026-10-12

### T50 · `db()` and `collection()` — cheap handles — Master · 🔲
- **Read this:** **none confirmed** — the "no I/O" claim was not found in a page I read. Candidate: [Get Started](https://www.mongodb.com/docs/drivers/node/current/get-started/) (not read for it). This topic is likely ours to own.

### T51 · The CRUD API from the driver — Master · 🔲
- **Read this:** [CRUD Operations](https://www.mongodb.com/docs/drivers/node/current/crud/) · mongodb.com · the section index (≈0.9k words); children **exist (HTTP 200)**: [insert](https://www.mongodb.com/docs/drivers/node/current/crud/insert/), [update](https://www.mongodb.com/docs/drivers/node/current/crud/update/), [query](https://www.mongodb.com/docs/drivers/node/current/crud/query/) · none of the children read · covers our angle: **unverified** · fetched 2026-10-12
- **Our delta:** "where the signatures differ from the shell".

### T52 · 🔴 Cursors in Node — Master · 🔲
- **Read this:** [Access Data From a Cursor](https://www.mongodb.com/docs/drivers/node/current/crud/query/cursor/) · mongodb.com · a cursor fetches in batches to cut memory and network use; `find`, `aggregate`, `listIndexes` etc. return cursors; mixing `hasNext()`/`toArray()` on one cursor gives unexpected results, and concurrent async calls on one cursor are undefined behaviour (*read*) · covers our angle: **partial** — `for await` and "`toArray()` on an unbounded result exhausts memory" are **not stated in the passages I read** · fetched 2026-10-12

## Phase 9 — Mongoose

Version: **Mongoose v9.11.1** at fetch. Base: `https://mongoosejs.com/docs/`.

### T53 · 🔴 What Mongoose is, and what it costs — Master · 🔲
- **Read this:** [Getting Started](https://mongoosejs.com/docs/index.html) · mongoosejs.com · ≈0.6k words, the project's own introduction (size only) · covers our angle: **partial** — "what it costs" is not argued there · fetched 2026-10-12
- **Also good:** [Faster Mongoose Queries With Lean](https://mongoosejs.com/docs/tutorials/lean.html#faster-mongoose-queries-with-lean) · documents are "much heavier than vanilla JavaScript objects" because of change tracking (*read*) — the cost, from the maintainers · fetched 2026-10-12
- **Our delta:** the schemas / casting / validation / middleware vs "a layer between you and the query" argument.

### T54 · Schemas and SchemaTypes — Master · 🔲
- **Read this (1/2):** [Schemas](https://mongoosejs.com/docs/guide.html#definition) · mongoosejs.com · ≈9k words; ids include `#definition`, `#ids`, `#indexes`, `#virtuals`, `#options` (ids verified) · fetched 2026-10-12
- **Read this (2/2):** [SchemaTypes](https://mongoosejs.com/docs/schematypes.html) · mongoosejs.com · ≈5.2k words (headings only) · fetched 2026-10-12

### T55 · Models and documents — Master · 🔲
- **Read this (1/2):** [Models](https://mongoosejs.com/docs/models.html#compiling) · mongoosejs.com · "Compiling your first model", constructing, querying, updating (ids verified) · fetched 2026-10-12
- **Read this (2/2):** [Documents](https://mongoosejs.com/docs/documents.html) · mongoosejs.com · ≈2k words (headings only; the "retrieving" wording I probed for did not appear, so what a hydrated document carries is **not confirmed**) · fetched 2026-10-12

### T56 · Validation — and where it does not run — Master · 🔲
- **Read this:** [Validation](https://mongoosejs.com/docs/validation.html) · mongoosejs.com · validators do not run on `undefined` values (except `required`); **update validators are off by default** and need `runValidators` on `updateOne`, `updateMany`, `findOneAndUpdate` (*read*) · covers our angle: full for "where validation does not run" · fetched 2026-10-12

### T57 · The Query builder — not executed until awaited — Master · 🔲
- **Read this:** [Queries](https://mongoosejs.com/docs/queries.html#queries-are-not-promises) · mongoosejs.com · a query runs via `await` or `.then()`; the section "Queries are Not Promises" (heading id verified; passage not read) · covers our angle: **partial** · fetched 2026-10-12

### T58 · 🔴 `lean()` — Master · 🔲
- **Read this:** [Faster Mongoose Queries With Lean](https://mongoosejs.com/docs/tutorials/lean.html#using-lean) · mongoosejs.com · `lean` skips hydrating: faster and lighter, but results are plain objects, not Mongoose documents (*read*); sections `#lean-and-populate`, `#when-to-use-lean`, `#plugins` (ids verified); virtuals/getters/defaults do not run on lean results (*read* the plugin example) · covers our angle: full · fetched 2026-10-12
